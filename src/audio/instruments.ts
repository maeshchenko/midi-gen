/**
 * Tone.js voices for song tracks. Synthesis by default; the "real" mode swaps
 * in sampled instruments (Tone.Sampler / Tone.Players from /samples — see
 * samples.ts), falling back to synth for any program without a sample.
 *
 * Nodes are created against the CURRENT Tone context: call buildEnsemble()
 * live for playback, or inside Tone.Offline() for rendering — same code path
 * (that's the whole reason this is a factory).
 */

import * as Tone from 'tone';
import { PPQ, type Song, type Track } from '../core/types';
import { GM_DRUMS } from '../core/gen/drums';
import { getGenre } from '../core/genres';
import {
  SAMPLE_SETS,
  REAL_PROGRAM_MAP,
  REAL_DRUM_KITS,
  type SampleSetDef,
  type DrumKitDef,
} from './samples';

export interface Voice {
  trigger(pitch: number, timeSec: number, durSec: number, velocity: number, slide?: boolean): void;
  dispose(): void;
  /** Exposed low-pass cutoff for section automation (phonk intro/build-up). */
  cutoff?: Tone.Signal<'frequency'>;
  /** Async insert FX (per-voice reverb IR) — awaited before offline render. */
  ready?: Promise<unknown>;
}

const midiHz = (pitch: number): number => 440 * 2 ** ((pitch - 69) / 12);

/** Boss CE-2-style chorus: lush, slow, wide — the doomerwave/post-punk glue. */
function makeChorus(depth = 0.7, rate = 0.8): Tone.Chorus {
  const ch = new Tone.Chorus(rate, 3.5, depth);
  ch.wet.value = 0.5;
  return ch.start();
}

/**
 * Monophonic Tone synths throw "Start time must be strictly greater than
 * previous start time" on same-instant retriggers (possible after humanize
 * jitter). Nudge each trigger 2ms past the previous one — inaudible.
 */
function monoGuard(trigger: Voice['trigger']): Voice['trigger'] {
  let last = -1;
  return (p, t, d, v) => {
    if (t <= last + 0.002) t = last + 0.002;
    last = t;
    trigger(p, t, d, v);
  };
}

/**
 * Deterministic 0..1 PRNG (mulberry32) for per-hit micro-variation (detune,
 * gain wobble). Deterministic so offline render matches live preview exactly.
 */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeSquareLead(out: Tone.ToneAudioNode, bpm: number): Voice {
  const synth = new Tone.MonoSynth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.005, decay: 0.08, sustain: 0.55, release: 0.08 },
    filter: { type: 'lowpass', Q: 1 },
    filterEnvelope: { attack: 0.005, decay: 0.12, sustain: 0.7, release: 0.1, baseFrequency: 900, octaves: 2.5 },
  });
  synth.volume.value = -4;
  const vibrato = new Tone.Vibrato(5.5, 0.12);
  // The echoing lead is THE keygen sound: dotted-8th feedback delay.
  const delay = new Tone.FeedbackDelay((60 / bpm) * 0.75, 0.35);
  delay.wet.value = 0.28;
  synth.chain(vibrato, delay, out);
  const attack = monoGuard((p, t, d, v) => synth.triggerAttackRelease(midiHz(p), d, t, v));
  return {
    trigger: (p, t, d, v, slide) => {
      if (slide) {
        // Tracker 3xx tone-portamento: glide the carrier note (the generator
        // keeps it ringing through this span) — no envelope retrigger.
        // Part callbacks fire in time order, so toggling the property is safe.
        synth.portamento = 0.06;
        synth.setNote(midiHz(p), t);
        synth.portamento = 0;
        return;
      }
      attack(p, t, d, v);
    },
    dispose: () => {
      synth.dispose();
      vibrato.dispose();
      delay.dispose();
    },
  };
}

function makeSawArp(out: Tone.ToneAudioNode): Voice {
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.002, decay: 0.05, sustain: 0.3, release: 0.04 },
  });
  synth.volume.value = -14;
  const filter = new Tone.Filter(4500, 'lowpass');
  synth.chain(filter, out);
  return {
    trigger: (p, t, d, v) => synth.triggerAttackRelease(midiHz(p), d, t, v * 0.8),
    cutoff: filter.frequency,
    dispose: () => {
      synth.dispose();
      filter.dispose();
    },
  };
}

function makeSynthBass(out: Tone.ToneAudioNode): Voice {
  const synth = new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.004, decay: 0.12, sustain: 0.5, release: 0.08 },
    filter: { type: 'lowpass', Q: 2 },
    filterEnvelope: { attack: 0.004, decay: 0.15, sustain: 0.4, release: 0.1, baseFrequency: 250, octaves: 2 },
  });
  synth.volume.value = -6;
  synth.connect(out);
  return {
    trigger: monoGuard((p, t, d, v) => synth.triggerAttackRelease(midiHz(p), d, t, v)),
    dispose: () => synth.dispose(),
  };
}

/** Pitched 808-cowbell-ish lead: square through a bandpass, fast decay, dirt. */
function makeCowbellLead(out: Tone.ToneAudioNode): Voice {
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'square' },
    envelope: { attack: 0.001, decay: 0.18, sustain: 0.03, release: 0.06 },
  });
  synth.volume.value = -6;
  const band = new Tone.Filter({ frequency: 1100, type: 'bandpass', Q: 1.2 });
  const dist = new Tone.Distortion(0.35);
  synth.chain(band, dist, out);
  return {
    trigger: (p, t, d, v) => synth.triggerAttackRelease(midiHz(p), Math.max(0.12, d), t, v),
    dispose: () => {
      synth.dispose();
      band.dispose();
      dist.dispose();
    },
  };
}

/**
 * Phonk cowbell per spec: staccato square (decay ~150ms, sustain 0) through a
 * bitcrusher (lo-fi grit) and a band emphasis, with an exposed low-pass for
 * the underwater-intro automation.
 */
function makePhonkCowbell(out: Tone.ToneAudioNode): Voice {
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'square' },
    envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.04 },
  });
  synth.volume.value = -5;
  const crush = new Tone.BitCrusher(10);
  crush.wet.value = 0.5;
  const band = new Tone.Filter({ frequency: 950, type: 'bandpass', Q: 1 });
  const lowpass = new Tone.Filter(9000, 'lowpass');
  const dist = new Tone.Distortion(0.4);
  synth.chain(crush, band, lowpass, dist, out);
  return {
    trigger: (p, t, d, v) => synth.triggerAttackRelease(midiHz(p), Math.max(0.1, d), t, v),
    cutoff: lowpass.frequency,
    dispose: () => {
      synth.dispose();
      crush.dispose();
      band.dispose();
      lowpass.dispose();
      dist.dispose();
    },
  };
}

/** Gliding 808: sine MonoSynth with portamento — legato note durs do the slide. */
function makeBass808(out: Tone.ToneAudioNode): Voice {
  const synth = new Tone.MonoSynth({
    oscillator: { type: 'sine' },
    portamento: 0.08,
    envelope: { attack: 0.005, decay: 0.4, sustain: 0.85, release: 0.12 },
    filter: { type: 'lowpass', Q: 0.5 },
    filterEnvelope: { attack: 0.005, decay: 0.2, sustain: 1, release: 0.1, baseFrequency: 350, octaves: 0.5 },
  });
  synth.volume.value = -2;
  const dist = new Tone.Distortion(0.45); // harmonics so the sub reads on small speakers
  dist.wet.value = 0.33;
  synth.chain(dist, out);
  return {
    trigger: monoGuard((p, t, d, v) => synth.triggerAttackRelease(midiHz(p), d, t, v)),
    dispose: () => {
      synth.dispose();
      dist.dispose();
    },
  };
}

function makeMutedTrumpet(out: Tone.ToneAudioNode): Voice {
  const synth = new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' },
    portamento: 0.045, // wide intervals smear into a short gliss/bend
    envelope: { attack: 0.05, decay: 0.2, sustain: 0.7, release: 0.25 },
    filter: { type: 'lowpass', Q: 3 },
    filterEnvelope: { attack: 0.06, decay: 0.25, sustain: 0.5, release: 0.25, baseFrequency: 650, octaves: 1.2 },
  });
  synth.volume.value = -10;
  const vibrato = new Tone.Vibrato(4.5, 0.09);
  synth.chain(vibrato, out);
  return {
    trigger: monoGuard((p, t, d, v) => synth.triggerAttackRelease(midiHz(p), d, t, v)),
    dispose: () => {
      synth.dispose();
      vibrato.dispose();
    },
  };
}

function makeUprightBass(out: Tone.ToneAudioNode): Voice {
  const synth = new Tone.MonoSynth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.012, decay: 0.3, sustain: 0.35, release: 0.25 },
    filter: { type: 'lowpass', Q: 0.8 },
    filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.2, baseFrequency: 420, octaves: 0.8 },
  });
  synth.volume.value = -4;
  synth.connect(out);
  return {
    trigger: monoGuard((p, t, d, v) => synth.triggerAttackRelease(midiHz(p), d, t, v)),
    dispose: () => synth.dispose(),
  };
}

/** GM 10: plucked steel comb — glassy bell attack, no sustain, long undamped ring. */
function makeMusicBox(out: Tone.ToneAudioNode): Voice {
  const synth = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 5,
    modulationIndex: 9,
    envelope: { attack: 0.002, decay: 1.8, sustain: 0, release: 1.2 },
    modulationEnvelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.2 },
  });
  synth.volume.value = -10;
  const shimmer = new Tone.Reverb({ decay: 1.6, wet: 0.22 });
  synth.chain(shimmer, out);
  return {
    // Envelope has no sustain — the tine rings by itself; ignore short durs.
    trigger: (p, t, d, v) => synth.triggerAttackRelease(midiHz(p), Math.max(1.2, d), t, v),
    ready: shimmer.ready,
    dispose: () => {
      synth.dispose();
      shimmer.dispose();
    },
  };
}

function makeVibraphone(out: Tone.ToneAudioNode): Voice {
  const synth = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 4,
    modulationIndex: 1.4,
    envelope: { attack: 0.004, decay: 1.4, sustain: 0, release: 0.9 },
    modulationEnvelope: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.3 },
  });
  synth.volume.value = -7;
  const tremolo = new Tone.Tremolo(4, 0.35).start();
  synth.chain(tremolo, out);
  return {
    trigger: (p, t, d, v) => synth.triggerAttackRelease(midiHz(p), Math.max(0.8, d), t, v),
    dispose: () => {
      synth.dispose();
      tremolo.dispose();
    },
  };
}

function makeDarkPad(out: Tone.ToneAudioNode): Voice {
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.6, decay: 0.4, sustain: 0.7, release: 1.4 },
  });
  synth.volume.value = -18;
  const filter = new Tone.Filter(850, 'lowpass');
  synth.chain(filter, out);
  return {
    trigger: (p, t, d, v) => synth.triggerAttackRelease(midiHz(p), d, t, v),
    dispose: () => {
      synth.dispose();
      filter.dispose();
    },
  };
}

/** FM piano — bright enough for J-pop, soft enough for blues comping. */
function makePiano(out: Tone.ToneAudioNode): Voice {
  const synth = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 3,
    modulationIndex: 9,
    envelope: { attack: 0.002, decay: 1.1, sustain: 0.12, release: 0.5 },
    modulationEnvelope: { attack: 0.002, decay: 0.25, sustain: 0, release: 0.2 },
  });
  synth.volume.value = -8;
  synth.connect(out);
  return {
    trigger: (p, t, d, v) => synth.triggerAttackRelease(midiHz(p), d, t, v),
    dispose: () => synth.dispose(),
  };
}

/** String section / solo violin: slow-attack saws; solo adds vibrato. */
function makeStrings(out: Tone.ToneAudioNode, solo: boolean): Voice {
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sawtooth' },
    envelope: { attack: solo ? 0.08 : 0.35, decay: 0.3, sustain: 0.8, release: solo ? 0.3 : 0.9 },
  });
  synth.volume.value = solo ? -8 : -16;
  const filter = new Tone.Filter(solo ? 3200 : 2200, 'lowpass');
  const vibrato = new Tone.Vibrato(5, solo ? 0.15 : 0.06);
  synth.chain(filter, vibrato, out);
  return {
    trigger: (p, t, d, v) => synth.triggerAttackRelease(midiHz(p), d, t, v),
    dispose: () => {
      synth.dispose();
      filter.dispose();
      vibrato.dispose();
    },
  };
}

function makeHarmonica(out: Tone.ToneAudioNode): Voice {
  const synth = new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.03, decay: 0.1, sustain: 0.85, release: 0.12 },
    filter: { type: 'bandpass', Q: 2 },
    filterEnvelope: { attack: 0.03, decay: 0.1, sustain: 0.9, release: 0.1, baseFrequency: 1500, octaves: 0.5 },
  });
  synth.volume.value = -7;
  const vibrato = new Tone.Vibrato(5.5, 0.2); // wailing
  synth.chain(vibrato, out);
  return {
    trigger: monoGuard((p, t, d, v) => synth.triggerAttackRelease(midiHz(p), d, t, v)),
    dispose: () => {
      synth.dispose();
      vibrato.dispose();
    },
  };
}

function makeTrumpet(out: Tone.ToneAudioNode): Voice {
  const synth = new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.03, decay: 0.1, sustain: 0.8, release: 0.12 },
    filter: { type: 'lowpass', Q: 1.5 },
    filterEnvelope: { attack: 0.04, decay: 0.15, sustain: 0.7, release: 0.15, baseFrequency: 1200, octaves: 1.3 },
  });
  synth.volume.value = -5;
  synth.connect(out);
  return {
    trigger: monoGuard((p, t, d, v) => synth.triggerAttackRelease(midiHz(p), d, t, v)),
    dispose: () => synth.dispose(),
  };
}

function makeBrassSection(out: Tone.ToneAudioNode): Voice {
  const synth = new Tone.PolySynth(Tone.AMSynth, {
    harmonicity: 2,
    envelope: { attack: 0.04, decay: 0.15, sustain: 0.7, release: 0.15 },
  });
  synth.volume.value = -12;
  const filter = new Tone.Filter(2600, 'lowpass');
  synth.chain(filter, out);
  return {
    trigger: (p, t, d, v) => synth.triggerAttackRelease(midiHz(p), d, t, v),
    dispose: () => {
      synth.dispose();
      filter.dispose();
    },
  };
}

function makeTuba(out: Tone.ToneAudioNode): Voice {
  const synth = new Tone.MonoSynth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.02, decay: 0.15, sustain: 0.6, release: 0.15 },
    filter: { type: 'lowpass', Q: 1 },
    filterEnvelope: { attack: 0.02, decay: 0.15, sustain: 0.5, release: 0.15, baseFrequency: 280, octaves: 1 },
  });
  synth.volume.value = -4;
  synth.connect(out);
  return {
    trigger: monoGuard((p, t, d, v) => synth.triggerAttackRelease(midiHz(p), d, t, v)),
    dispose: () => synth.dispose(),
  };
}

function makeCello(out: Tone.ToneAudioNode): Voice {
  const synth = new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.12, decay: 0.3, sustain: 0.8, release: 0.4 },
    filter: { type: 'lowpass', Q: 1 },
    filterEnvelope: { attack: 0.1, decay: 0.3, sustain: 0.6, release: 0.3, baseFrequency: 600, octaves: 0.8 },
  });
  synth.volume.value = -6;
  const vibrato = new Tone.Vibrato(4.5, 0.08);
  synth.chain(vibrato, out);
  return {
    trigger: monoGuard((p, t, d, v) => synth.triggerAttackRelease(midiHz(p), d, t, v)),
    dispose: () => {
      synth.dispose();
      vibrato.dispose();
    },
  };
}

function makeHarpsichord(out: Tone.ToneAudioNode): Voice {
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.002, decay: 0.45, sustain: 0.06, release: 0.12 },
  });
  synth.volume.value = -12;
  const filter = new Tone.Filter(3800, 'lowpass');
  synth.chain(filter, out);
  return {
    trigger: (p, t, d, v) => synth.triggerAttackRelease(midiHz(p), Math.max(0.15, d), t, v),
    dispose: () => {
      synth.dispose();
      filter.dispose();
    },
  };
}

/** Detuned supersaw lead with synced echo — the nightcore scream. */
function makeSupersawLead(out: Tone.ToneAudioNode, bpm: number): Voice {
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'fatsawtooth', count: 3, spread: 24 },
    envelope: { attack: 0.01, decay: 0.12, sustain: 0.7, release: 0.15 },
  });
  synth.volume.value = -9;
  const filter = new Tone.Filter(5200, 'lowpass');
  const delay = new Tone.FeedbackDelay((60 / bpm) / 2, 0.3); // 8th echo
  delay.wet.value = 0.22;
  synth.chain(filter, delay, out);
  return {
    trigger: (p, t, d, v) => synth.triggerAttackRelease(midiHz(p), d, t, v),
    dispose: () => {
      synth.dispose();
      filter.dispose();
      delay.dispose();
    },
  };
}



/** Cold darkwave lead: MONO square synth with portamento (Молчат-Дома ostinato
 * glide), dark lowpass, chorus, dotted-8th echo. Mono so consecutive notes
 * glide instead of stacking. */
function makeColdLead(out: Tone.ToneAudioNode, bpm: number): Voice {
  const synth = new Tone.MonoSynth({
    oscillator: { type: 'square' },
    portamento: 0.06, // 60ms glide between notes — the spec's 40–80ms
    envelope: { attack: 0.015, decay: 0.2, sustain: 0.7, release: 0.35 },
    filter: { type: 'lowpass', Q: 1.5 },
    filterEnvelope: { attack: 0.02, decay: 0.2, sustain: 0.6, release: 0.3, baseFrequency: 700, octaves: 2 },
  });
  synth.volume.value = -10;
  const chorus = makeChorus(0.8, 0.7);
  const delay = new Tone.FeedbackDelay((60 / bpm) * 0.75, 0.28); // dotted-8th
  delay.wet.value = 0.24;
  synth.chain(chorus, delay, out);
  return {
    trigger: monoGuard((p, t, d, v) => synth.triggerAttackRelease(midiHz(p), d, t, v)),
    dispose: () => {
      synth.dispose();
      chorus.dispose();
      delay.dispose();
    },
  };
}

/** Picked post-punk bass: bright saw, mid-forward clang, chorus — leads the
 * track alongside the vocal/lead (Joy Division / Молчат-Дома). */
function makePostPunkBass(out: Tone.ToneAudioNode): Voice {
  const synth = new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.006, decay: 0.18, sustain: 0.6, release: 0.12 },
    filter: { type: 'lowpass', Q: 2.5 },
    filterEnvelope: { attack: 0.005, decay: 0.12, sustain: 0.55, release: 0.1, baseFrequency: 500, octaves: 2.6 },
  });
  synth.volume.value = -5;
  const clang = new Tone.Distortion(0.18); // pick attack / string clang
  clang.wet.value = 0.3;
  const chorus = makeChorus(0.6, 0.6);
  synth.chain(clang, chorus, out);
  return {
    trigger: monoGuard((p, t, d, v) => synth.triggerAttackRelease(midiHz(p), d, t, v)),
    dispose: () => {
      synth.dispose();
      clang.dispose();
      chorus.dispose();
    },
  };
}

/** Cold-wave pad: slow-attack saws (PWM-ish), dark lowpass, wide chorus. */
function makeColdPad(out: Tone.ToneAudioNode): Voice {
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'fatsawtooth', count: 2, spread: 18 },
    envelope: { attack: 0.45, decay: 0.5, sustain: 0.75, release: 1.6 },
  });
  synth.volume.value = -19;
  const filter = new Tone.Filter(1500, 'lowpass');
  const chorus = makeChorus(0.9, 0.8);
  synth.chain(filter, chorus, out);
  return {
    trigger: (p, t, d, v) => synth.triggerAttackRelease(midiHz(p), d, t, v),
    dispose: () => {
      synth.dispose();
      filter.dispose();
      chorus.dispose();
    },
  };
}

/** Clean post-punk guitar: thin (HPF 200Hz), bright pluck, chorus + reverb +
 * slapback — high arpeggios that merge into a wash. */
function makeCleanGuitar(out: Tone.ToneAudioNode): Voice {
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.004, decay: 0.4, sustain: 0.2, release: 0.4 },
  });
  synth.volume.value = -15;
  const hp = new Tone.Filter(200, 'highpass');
  const lp = new Tone.Filter(3600, 'lowpass');
  const chorus = makeChorus(0.7, 1.0);
  const verb = new Tone.Reverb({ decay: 1.8, wet: 0.26 });
  synth.chain(hp, lp, chorus, verb, out);
  return {
    trigger: (p, t, d, v) => synth.triggerAttackRelease(midiHz(p), Math.max(0.12, d), t, v),
    ready: verb.ready,
    dispose: () => {
      synth.dispose();
      hp.dispose();
      lp.dispose();
      chorus.dispose();
      verb.dispose();
    },
  };
}

/** Overdriven power-chord guitar, hard double-tracked: two distortion takes
 * panned L/R (the right one Haas-delayed ~13ms) for a wide wall of sound. */
function makePowerGuitar(out: Tone.ToneAudioNode): Voice {
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'fatsawtooth', count: 2, spread: 22 },
    envelope: { attack: 0.005, decay: 0.3, sustain: 0.55, release: 0.18 },
  });
  synth.volume.value = -11;
  const distL = new Tone.Distortion(0.6);
  distL.wet.value = 0.9;
  const distR = new Tone.Distortion(0.64);
  distR.wet.value = 0.9;
  const panL = new Tone.Panner(-0.92);
  const panR = new Tone.Panner(0.92);
  const haas = new Tone.FeedbackDelay(0.013, 0); // ~13ms, no feedback → double-track
  haas.wet.value = 1;
  synth.connect(distL);
  distL.connect(panL);
  panL.connect(out);
  synth.connect(haas);
  haas.connect(distR);
  distR.connect(panR);
  panR.connect(out);
  return {
    trigger: (p, t, d, v) => synth.triggerAttackRelease(midiHz(p), d, t, v),
    dispose: () => {
      synth.dispose();
      distL.dispose();
      distR.dispose();
      panL.dispose();
      panR.dispose();
      haas.dispose();
    },
  };
}

/** Picked metal bass: bright saw, hard attack, string clang + overdrive. */
function makeMetalBass(out: Tone.ToneAudioNode): Voice {
  const synth = new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.004, decay: 0.16, sustain: 0.7, release: 0.1 },
    filter: { type: 'lowpass', Q: 2.5 },
    filterEnvelope: { attack: 0.003, decay: 0.1, sustain: 0.6, release: 0.1, baseFrequency: 600, octaves: 2.8 },
  });
  synth.volume.value = -4;
  const drive = new Tone.Distortion(0.3); // pick clang / light overdrive
  drive.wet.value = 0.4;
  synth.chain(drive, out);
  return {
    trigger: monoGuard((p, t, d, v) => synth.triggerAttackRelease(midiHz(p), d, t, v)),
    dispose: () => {
      synth.dispose();
      drive.dispose();
    },
  };
}

/** Symphonic / pitched-anime-vocal lead: bright saw, MONO with portamento for
 * wide-interval glide, long stadium hall reverb + synced delay. */
function makeSymphonicLead(out: Tone.ToneAudioNode, bpm: number): Voice {
  // MONO + portamento: wide leaps glide (the loved "wee-oo"); vibrato wavers the
  // long held notes; stadium hall for scale.
  const synth = new Tone.MonoSynth({
    oscillator: { type: 'fatsawtooth', count: 3, spread: 30 },
    portamento: 0.05,
    envelope: { attack: 0.02, decay: 0.2, sustain: 0.8, release: 0.4 },
    filter: { type: 'lowpass', Q: 1 },
    filterEnvelope: { attack: 0.02, decay: 0.3, sustain: 0.8, release: 0.4, baseFrequency: 1200, octaves: 2.2 },
  });
  synth.volume.value = -9;
  const vibrato = new Tone.Vibrato(5, 0.07);
  const delay = new Tone.FeedbackDelay((60 / bpm) / 2, 0.25);
  delay.wet.value = 0.2;
  const hall = new Tone.Reverb({ decay: 2.6, wet: 0.34 }); // stadium hall
  synth.chain(vibrato, delay, hall, out);
  return {
    trigger: monoGuard((p, t, d, v) => synth.triggerAttackRelease(midiHz(p), d, t, v)),
    ready: hall.ready,
    dispose: () => {
      synth.dispose();
      vibrato.dispose();
      delay.dispose();
      hall.dispose();
    },
  };
}

function makeGenericPoly(out: Tone.ToneAudioNode): Voice {
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.2 },
  });
  synth.volume.value = -8;
  synth.connect(out);
  return {
    trigger: (p, t, d, v) => synth.triggerAttackRelease(midiHz(p), d, t, v),
    dispose: () => synth.dispose(),
  };
}

interface DrumKitOpts {
  /** Route hats here instead of `out` (sidechain duck bus). */
  hatBus?: Tone.ToneAudioNode;
  /** Fired at every kick trigger time — drives sidechain ducking. */
  onKick?: (timeSec: number) => void;
  /** Noir: dull thump — no click, nothing above ~180Hz, no pitch sweep. */
  dullKick?: boolean;
  /** Doomerwave: punchy but click-free — short pitch sweep, softened beater. */
  softKick?: boolean;
  /** Doomerwave/post-punk: snare through a short dense reverb that cuts abruptly. */
  gatedSnare?: boolean;
}

function makeDrumKit(out: Tone.ToneAudioNode, opts: DrumKitOpts = {}): Voice {
  const kick = new Tone.MembraneSynth(
    opts.dullKick
      ? {
          pitchDecay: 0.015,
          octaves: 1.5,
          envelope: { attack: 0.01, decay: 0.3, sustain: 0.01, release: 0.3 },
        }
      : opts.softKick
        ? {
            // Short pitch sweep + a few ms of amp attack — punchy body, no beater click.
            pitchDecay: 0.025,
            octaves: 2.5,
            envelope: { attack: 0.006, decay: 0.32, sustain: 0.01, release: 0.35 },
          }
        : {
            // octaves 6→3.5 + attack 1ms→3ms: keeps the punch, kills the harsh
            // beater click and the huge sub-transient that slammed the limiter.
            pitchDecay: 0.03,
            octaves: 3.5,
            envelope: { attack: 0.003, decay: 0.35, sustain: 0.01, release: 0.4 },
          },
  );
  kick.volume.value = opts.dullKick ? -8 : opts.softKick ? -4 : -2;
  // Tame the click transient on the soft kick without gutting the body (320Hz).
  const kickFilter = opts.dullKick
    ? new Tone.Filter(180, 'lowpass')
    : opts.softKick
      ? new Tone.Filter(320, 'lowpass')
      : null;

  const snare = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.16, sustain: 0 },
  });
  snare.volume.value = -8;
  const snareBody = new Tone.Filter(1800, 'bandpass');
  // Gated reverb: dense short tail that dies fast (decay ~0.3s) — 80s big snare.
  const gateVerb = opts.gatedSnare ? new Tone.Reverb({ decay: 0.32, wet: 0.5 }) : null;
  if (gateVerb) snare.chain(snareBody, gateVerb, out);
  else snare.chain(snareBody, out);

  // Hi-hats are NOISE, not MetalSynth: Tone.MetalSynth's FM feedback produces
  // wildly hot, peaky output (measured >17000 peak) that the master limiter
  // clips into a harsh digital "цк"/electrical crackle. Filtered white noise is
  // a clean, stable "tss" that never explodes.
  const hatTone = new Tone.Filter(7800, 'highpass'); // shared hat brightness shaping
  const hatTop = new Tone.Filter(13000, 'lowpass'); // tame the very top
  const hat = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.035, sustain: 0, release: 0.015 },
  });
  hat.volume.value = -14;

  const hatOpen = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.08 },
  });
  hatOpen.volume.value = -17;

  // Crash is also NOISE (MetalSynth exploded to >10000 peak → limiter crackle).
  const crash = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 1.1, sustain: 0, release: 0.6 },
  });
  crash.volume.value = -13;
  const crashHp = new Tone.Filter(4500, 'highpass');
  crash.chain(crashHp, out);

  const tom = new Tone.MembraneSynth({
    pitchDecay: 0.06,
    octaves: 3,
    envelope: { attack: 0.001, decay: 0.25, sustain: 0.01, release: 0.3 },
  });
  tom.volume.value = -6;

  const clap = new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.001, decay: 0.09, sustain: 0 },
  });
  clap.volume.value = -8;
  const clapBand = new Tone.Filter({ frequency: 1400, type: 'bandpass', Q: 1.2 });
  clap.chain(clapBand, out);

  const shaker = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.04, sustain: 0 },
  });
  shaker.volume.value = -20;
  const shakerHp = new Tone.Filter(7500, 'highpass');
  shaker.chain(shakerHp, out);

  const tambourine = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.12, release: 0.05 },
    harmonicity: 7,
    modulationIndex: 10, // tamed so the FM doesn't explode into limiter crackle
    resonance: 5500,
    octaves: 1.4,
  });
  tambourine.volume.value = -19;

  // Dark jazz ride — long, low, washy.
  const ride = new Tone.MetalSynth({
    envelope: { attack: 0.002, decay: 0.8, release: 0.4 },
    harmonicity: 4.1,
    modulationIndex: 10,
    resonance: 2400,
    octaves: 1.2,
  });
  ride.volume.value = -25;

  const hatOut = opts.hatBus ?? out;
  if (kickFilter) kick.chain(kickFilter, out);
  else kick.connect(out);
  hatTone.chain(hatTop, hatOut); // noise hats → highpass → lowpass → out
  hat.connect(hatTone);
  hatOpen.connect(hatTone);
  tom.connect(out);
  ride.connect(out);
  tambourine.connect(hatOut);

  // Every sub-synth is monophonic — guard each against same-instant retriggers.
  const gKick = monoGuard((p, t, d, v) => {
    kick.triggerAttackRelease(midiHz(p), d, t, v);
    opts.onKick?.(t);
  });
  const gSnare = monoGuard((_p, t, d, v) => snare.triggerAttackRelease(d, t, v));
  const gHat = monoGuard((_p, t, _d, v) => hat.triggerAttackRelease(0.04, t, v));
  const gHatOpen = monoGuard((_p, t, _d, v) => hatOpen.triggerAttackRelease(0.25, t, v));
  const gCrash = monoGuard((_p, t, _d, v) => crash.triggerAttackRelease(1.1, t, v * 0.8));
  const gTom = monoGuard((p, t, d, v) => tom.triggerAttackRelease(midiHz(p), d, t, v));
  const gRide = monoGuard((p, t, _d, v) => ride.triggerAttackRelease(midiHz(p), 0.7, t, v));
  const gTamb = monoGuard((p, t, _d, v) => tambourine.triggerAttackRelease(midiHz(p), 0.15, t, v));
  const gClap = monoGuard((_p, t, d, v) => clap.triggerAttackRelease(d, t, v));
  const gShaker = monoGuard((_p, t, d, v) => shaker.triggerAttackRelease(d, t, v));

  return {
    ready: gateVerb?.ready,
    trigger: (pitch, t, d, v) => {
      switch (pitch) {
        case GM_DRUMS.kick:
          gKick(36, t, d, v);
          break;
        case GM_DRUMS.snare:
          gSnare(0, t, d, v);
          break;
        case GM_DRUMS.hatClosed:
          gHat(90, t, d, v);
          break;
        case GM_DRUMS.hatOpen:
          gHatOpen(88, t, d, v);
          break;
        case GM_DRUMS.crash:
          gCrash(85, t, d, v);
          break;
        case GM_DRUMS.ride:
          gRide(72, t, d, v);
          break;
        case GM_DRUMS.tambourine:
          gTamb(86, t, d, v);
          break;
        case GM_DRUMS.clap:
          gClap(0, t, d, v);
          break;
        case GM_DRUMS.shaker:
          gShaker(0, t, d, v);
          break;
        case GM_DRUMS.tomLow:
          gTom(45, t, d, v);
          break;
        case GM_DRUMS.tomMid:
          gTom(50, t, d, v);
          break;
        case GM_DRUMS.tomHigh:
          gTom(55, t, d, v);
          break;
        default:
          gSnare(0, t, d, v * 0.5);
      }
    },
    dispose: () => {
      kick.dispose();
      kickFilter?.dispose();
      snare.dispose();
      snareBody.dispose();
      gateVerb?.dispose();
      hat.dispose();
      hatTone.dispose();
      hatTop.dispose();
      hatOpen.dispose();
      crash.dispose();
      crashHp.dispose();
      tom.dispose();
      ride.dispose();
      tambourine.dispose();
      clap.dispose();
      clapBand.dispose();
      shaker.dispose();
      shakerHp.dispose();
    },
  };
}

interface SamplerStereo {
  bus: Tone.ToneAudioNode;
  reverb: Tone.ToneAudioNode;
  send: number;
  spread: number;
}

/**
 * Real-instrument voice from a pitched multisample, with the processing a real
 * instrument implies:
 *  - cabinet sim (hp+lp after distortion) so overdriven guitar/bass read as a
 *    miked amp, not fizzy DI;
 *  - palm-mute: short notes play dark/tight (chug), long notes ring open;
 *  - velocity-brightness: harder = brighter timbre, not just louder;
 *  - vibrato: pitch wobble that makes a solo string sound alive;
 *  - double-tracking: two takes hard L/R with a Haas offset (metal width).
 * Timing/dynamics come from the performance pass (perform.ts).
 */
function makeSampler(
  def: SampleSetDef,
  out: Tone.ToneAudioNode,
  exposeCutoff = false,
  stereo?: SamplerStereo,
): Voice {
  const useStereo = !!(def.doubleTrack && stereo);
  const dynamic = !exposeCutoff; // free to drive the lowpass from note dynamics
  const created: Tone.ToneAudioNode[] = [];

  // Build one signal path (sampler → vibrato → distortion → cab hp → bright lp)
  // ending at `dest`. The bright lowpass doubles as cab lp and is modulated.
  const buildPath = (dest: Tone.ToneAudioNode) => {
    const sampler = new Tone.Sampler({
      urls: def.urls,
      baseUrl: def.baseUrl,
      release: def.release ?? 0.4,
      attack: def.attack ?? 0,
    });
    sampler.volume.value = def.volumeDb ?? -6;
    const chain: Tone.ToneAudioNode[] = [];
    if (def.vibrato) {
      const vib = new Tone.Vibrato(def.vibrato.rate, def.vibrato.depth);
      chain.push(vib);
    }
    if (def.distortion) {
      const dist = new Tone.Distortion(def.distortion);
      dist.oversample = '2x';
      dist.wet.value = 0.9;
      chain.push(dist);
    }
    if (def.cab) chain.push(new Tone.Filter(def.cab.hp, 'highpass'));
    const bright = new Tone.Filter(def.cab?.lp ?? (exposeCutoff ? 12000 : 16000), 'lowpass');
    chain.push(bright);
    sampler.chain(...chain, dest);
    created.push(sampler, ...chain);
    return { sampler, bright };
  };

  const paths: { sampler: Tone.Sampler; bright: Tone.Filter }[] = [];
  if (useStereo) {
    for (let i = 0; i < 2; i++) {
      const pan = new Tone.Panner(i === 0 ? -stereo!.spread : stereo!.spread);
      pan.connect(stereo!.bus);
      created.push(pan);
      if (stereo!.send > 0) {
        const g = new Tone.Gain(stereo!.send);
        pan.connect(g);
        g.connect(stereo!.reverb);
        created.push(g);
      }
      paths.push(buildPath(pan));
    }
  } else {
    paths.push(buildPath(out));
  }

  const brightHzFor = (d: number, v: number): number => {
    let hz: number;
    if (def.palmMute) {
      const open = Math.min(1, d / 0.22); // <220ms note = palm-muted chug
      hz = 1100 + 5000 * open * (0.55 + 0.45 * v);
    } else {
      hz = 2200 + 13800 * Math.min(1, v * v);
    }
    return def.cab ? Math.min(hz, def.cab.lp) : hz;
  };

  let trigger: Voice['trigger'] = (p, t, d, v) => {
    const hz = brightHzFor(d, v);
    paths.forEach((path, i) => {
      if (dynamic) {
        try {
          path.bright.frequency.setValueAtTime(hz, Math.max(0, t - 0.001));
        } catch {
          /* coalesced automation point — ignore */
        }
      }
      // Right track lands a hair late — Haas widening for the double-track.
      const tt = useStereo && i === 1 ? t + 0.012 : t;
      path.sampler.triggerAttackRelease(midiHz(p), Math.max(0.05, d), tt, v);
    });
  };
  if (def.monophonic) trigger = monoGuard(trigger);

  return {
    trigger,
    cutoff: useStereo ? undefined : paths[0]!.bright.frequency,
    ready: Tone.loaded(),
    dispose: () => {
      for (const n of created) n.dispose();
    },
  };
}

/**
 * Real drum kit from velocity-layered round-robin one-shots (Tone.Players),
 * keyed by GM drum note — same trigger contract as makeDrumKit. Velocity picks
 * the layer (timbre), round-robin cycles variants (no immediate repeat → no
 * machine-gun), and each hit gets a touch of detune + gain wobble.
 */
// Per-voice stereo placement + reverb send (real mode), by track role.
const VOICE_PAN: Record<string, number> = { chords: 0.22, arp: -0.2, counter: 0.3, lead: 0, bass: 0 };
const VOICE_SEND: Record<string, number> = {
  lead: 0.2,
  chords: 0.32,
  bass: 0.04,
  arp: 0.12,
  drums: 0.08,
  counter: 0.2,
  fx: 0.16,
};

// Stereo placement of each drum lane — "overheads" width that makes a kit feel
// like a real room rather than a centered machine.
const DRUM_LANE_PAN: Record<string, number> = {
  kick: 0,
  snare: 0,
  hatClosed: 0.22,
  hatOpen: 0.28,
  crash: -0.35,
  tomHigh: 0.3,
  tomLow: -0.3,
  clap: -0.18,
};

function makeRealDrumKit(
  out: Tone.ToneAudioNode,
  def: DrumKitDef,
  opts: { onKick?: (timeSec: number) => void; reverb?: Tone.ToneAudioNode; send?: number } = {},
): Voice {
  // Per-lane panner → kit sum → out (+ optional reverb send). Individual
  // Tone.Players (not the Players collection) so each lane can be placed.
  const kitGain = new Tone.Gain(1);
  kitGain.connect(out);
  let sendGain: Tone.Gain | null = null;
  if (opts.reverb && opts.send && opts.send > 0) {
    sendGain = new Tone.Gain(opts.send);
    kitGain.connect(sendGain);
    sendGain.connect(opts.reverb);
  }
  const lanePanners: Record<string, Tone.Panner> = {};
  for (const laneName of Object.keys(def.lanes)) {
    const p = new Tone.Panner(DRUM_LANE_PAN[laneName] ?? 0);
    p.connect(kitGain);
    lanePanners[laneName] = p;
  }
  const fileToPlayer: Record<string, Tone.Player> = {};
  for (const [laneName, lane] of Object.entries(def.lanes))
    for (const layer of lane.layers)
      for (const f of layer.rr) {
        const key = f.replace(/\.mp3$/, '');
        const pl = new Tone.Player({ url: def.baseUrl + f, volume: -3 });
        pl.connect(lanePanners[laneName]!);
        fileToPlayer[key] = pl;
      }

  const NOTE_TO_LANE: Record<number, string> = {
    [GM_DRUMS.kick]: 'kick',
    [GM_DRUMS.snare]: 'snare',
    [GM_DRUMS.hatClosed]: 'hatClosed',
    [GM_DRUMS.hatOpen]: 'hatOpen',
    [GM_DRUMS.crash]: 'crash',
    [GM_DRUMS.ride]: 'crash',
    [GM_DRUMS.tomHigh]: 'tomHigh',
    [GM_DRUMS.tomMid]: 'tomLow',
    [GM_DRUMS.tomLow]: 'tomLow',
    [GM_DRUMS.clap]: 'clap',
    [GM_DRUMS.tambourine]: 'hatClosed',
    [GM_DRUMS.shaker]: 'hatClosed',
  };

  const rng = makeRng(0x9e3779b9);
  const lastRr = new Map<string, number>(); // `${lane}:${layer}` → last rr index
  const lastLayer = new Map<string, number>(); // lane → last velocity layer (hysteresis)
  const lastStart = new Map<string, number>(); // file → last start (Player guard)

  return {
    ready: Tone.loaded(),
    trigger: (pitch, t, _d, v) => {
      const lane = NOTE_TO_LANE[pitch];
      if (!lane) return;
      const laneDef = def.lanes[lane];
      if (!laneDef) return;
      v = Math.max(0.06, Math.min(1, v));
      // velocity → layer (timbre)
      let li = laneDef.layers.findIndex((l) => v <= l.vMax);
      if (li < 0) li = laneDef.layers.length - 1;
      // Hysteresis: don't flip to an adjacent layer when sitting right on a
      // threshold (velocity jitter on a crescendo roll → stuttering timbre).
      const prevLi = lastLayer.get(lane);
      if (prevLi !== undefined && Math.abs(li - prevLi) === 1) {
        const boundary = laneDef.layers[Math.min(li, prevLi)]!.vMax;
        if (Math.abs(v - boundary) < 0.06) li = prevLi;
      }
      lastLayer.set(lane, li);
      const layer = laneDef.layers[li]!;
      // round-robin → next variant, never the previous one
      const key = `${lane}:${li}`;
      const prev = lastRr.get(key);
      const ri = prev === undefined ? 0 : (prev + 1) % layer.rr.length;
      lastRr.set(key, ri);
      const file = layer.rr[ri]!.replace(/\.mp3$/, '');
      const pl = fileToPlayer[file];
      if (!pl) return;
      // monotonic guard per file (a Tone.Player rejects start <= its last start)
      const ls = lastStart.get(file) ?? -1;
      if (t <= ls + 0.002) t = ls + 0.002;
      lastStart.set(file, t);
      pl.volume.value = Tone.gainToDb(0.5 + 0.5 * v) + (rng() - 0.5); // ±0.5 dB
      pl.playbackRate = 1 + (rng() - 0.5) * 0.012; // ±~10 cents detune
      // An uncaught throw inside an offline-render callback HANGS the render.
      try {
        pl.start(t);
      } catch {
        return;
      }
      if (lane === 'kick') opts.onKick?.(t);
    },
    dispose: () => {
      for (const pl of Object.values(fileToPlayer)) pl.dispose();
      for (const p of Object.values(lanePanners)) p.dispose();
      sendGain?.dispose();
      kitGain.dispose();
    },
  };
}

function voiceForTrack(
  track: Track,
  bpm: number,
  out: Tone.ToneAudioNode,
  real: boolean,
  autoTarget?: 'lead' | 'arp' | 'master',
  stereoCtx?: { bus: Tone.ToneAudioNode; reverb: Tone.ToneAudioNode },
): Voice {
  if (track.role === 'drums') return makeDrumKit(out);
  if (real) {
    const set = REAL_PROGRAM_MAP[track.program];
    if (set) {
      const def = SAMPLE_SETS[set];
      // Only hand the cutoff to automation if THIS genre automates this role;
      // otherwise the sampler uses the filter for velocity-brightness.
      const exposeCutoff = autoTarget === track.role;
      const stereo =
        def.doubleTrack && stereoCtx
          ? { bus: stereoCtx.bus, reverb: stereoCtx.reverb, send: VOICE_SEND[track.role] ?? 0.12, spread: 0.75 }
          : undefined;
      return makeSampler(def, out, exposeCutoff, stereo);
    }
    // No real sample for this program → fall through to the synth voice.
  }
  switch (track.program) {
    case 80:
      return makeSquareLead(out, bpm);
    case 81:
      return makeSawArp(out);
    case 38:
      return makeSynthBass(out);
    case 33:
      return makePostPunkBass(out);
    case 27:
      return makeCleanGuitar(out);
    case 30:
      return makePowerGuitar(out);
    case 34:
      return makeMetalBass(out);
    case 49:
      return makeSymphonicLead(out, bpm);
    case 113:
      return makeCowbellLead(out);
    case 39:
      return makeBass808(out);
    case 59:
      return makeMutedTrumpet(out);
    case 32:
      return makeUprightBass(out);
    case 10:
      return makeMusicBox(out);
    case 11:
      return makeVibraphone(out);
    case 89:
      return makeDarkPad(out);
    case 0:
    case 1:
      return makePiano(out);
    case 40:
      return makeStrings(out, true);
    case 48:
      return makeStrings(out, false);
    case 22:
      return makeHarmonica(out);
    case 56:
      return makeTrumpet(out);
    case 61:
      return makeBrassSection(out);
    case 58:
      return makeTuba(out);
    case 42:
      return makeCello(out);
    case 6:
      return makeHarpsichord(out);
    case 90:
      return makeSupersawLead(out, bpm);
    case 88:
      return makeColdLead(out, bpm);
    case 91:
      return makeColdPad(out);
    default:
      return makeGenericPoly(out);
  }
}

export interface EnsembleAutomation {
  /** Transport-relative seconds. */
  time: number;
  apply(audioTime: number): void;
}

export interface Ensemble {
  voices: Voice[];
  /** Section-driven FX moves (phonk filter sweeps) — player schedules these. */
  automations: EnsembleAutomation[];
  /** Resolves when async FX (reverb IR generation) are ready — offline render must await this. */
  ready: Promise<unknown>;
  dispose(): void;
}

/** Genre colour on the master bus, between the voice bus and the compressor. */
function masterFx(genre: Song['genre']): Tone.ToneAudioNode[] {
  switch (genre) {
    case 'noir': {
      // Vintage tape chain: soft saturation (even-ish harmonics) → long dark
      // chamber → tape wow → old-gear EQ (no air above ~9k, no sub below 45).
      const sat = new Tone.Distortion(0.08);
      sat.wet.value = 0.4;
      const chamber = new Tone.Reverb({ decay: 4.5, wet: 0.32 });
      const wow = new Tone.Vibrato(0.7, 0.012);
      return [sat, chamber, wow, new Tone.Filter(9000, 'lowpass'), new Tone.Filter(45, 'highpass')];
    }
    case 'grime': {
      const dirt = new Tone.Distortion(0.06);
      dirt.wet.value = 0.5;
      return [dirt, new Tone.Filter(9000, 'lowpass')];
    }
    case 'phonk': {
      // Spec: hard clip on the master, dark top end.
      const clip = new Tone.Distortion(0.5);
      clip.wet.value = 0.7;
      return [clip, new Tone.Filter(7500, 'lowpass')];
    }
    case 'anime':
      return [new Tone.Reverb({ decay: 1.4, wet: 0.16 })];
    case 'nightcore':
      return [new Tone.Reverb({ decay: 1.6, wet: 0.18 })];
    case 'blues':
      return [new Tone.Reverb({ decay: 1.1, wet: 0.14 })];
    case 'military':
      return [new Tone.Reverb({ decay: 1.0, wet: 0.2 })]; // parade square air
    case 'darkacademia':
      return [new Tone.Reverb({ decay: 2.4, wet: 0.3 })]; // stone hall
    case 'musicbox':
      return [new Tone.Reverb({ decay: 2.2, wet: 0.28 }), new Tone.Filter(250, 'highpass')]; // tiny box in a quiet room
    case 'nightcorerun': {
      // Wall of sound: bus saturation glues guitars + drums; no low-pass.
      const glue = new Tone.Distortion(0.06);
      glue.wet.value = 0.35;
      return [glue];
    }
    case 'doomerwave':
    case 'doomerrun': {
      // Worn tape: slow wow/flutter pitch wobble + hi-cut, plus a cold room.
      const wow = new Tone.Vibrato(0.6, 0.012);
      const chamber = new Tone.Reverb({ decay: 2.0, wet: 0.2 });
      return [wow, chamber, new Tone.Filter(11000, 'lowpass')];
    }
    default:
      return [];
  }
}

/**
 * Interpret the genre's declarative filterAutomation spec into transport
 * events. Sections without a move snap to `open`; 'closed' ramps in over
 * 0.3s; 'sweep' opens linearly across the whole section.
 */
function buildFilterAutomations(
  song: Song,
  cutoff: Tone.Signal<'frequency'> | undefined,
): EnsembleAutomation[] {
  const spec = getGenre(song.genre).filterAutomation;
  if (!spec || !cutoff) return [];
  const beatTicks = (PPQ * 4) / song.timeSig[1];
  const barTicks = beatTicks * song.timeSig[0];
  const secPerTick = 60 / song.bpm / PPQ;
  const automations: EnsembleAutomation[] = [];

  for (const s of song.sections) {
    const t0 = s.startBar * barTicks * secPerTick;
    const durSec = s.bars * barTicks * secPerTick;
    const move = spec.sections[s.name];
    automations.push({
      time: t0,
      apply: (t) => {
        cutoff.cancelScheduledValues(t);
        if (move?.move === 'closed') {
          cutoff.setValueAtTime(cutoff.getValueAtTime(t), t);
          cutoff.linearRampToValueAtTime(move.hz, t + 0.3);
        } else if (move?.move === 'sweep') {
          cutoff.setValueAtTime(move.fromHz, t);
          cutoff.linearRampToValueAtTime(spec.open, t + durSec);
        } else {
          cutoff.setValueAtTime(spec.open, t);
        }
      },
    });
  }
  return automations;
}

export function buildEnsemble(song: Song, opts: { real?: boolean } = {}): Ensemble {
  const real = opts.real ?? false;
  const spec = getGenre(song.genre).filterAutomation;
  // Headroom: drive the master bus below 0dBFS so hot kick+bass transients don't
  // slam the limiter into low-frequency distortion (the "blown speaker / electrical
  // crackle" the user heard). A subsonic high-pass removes inaudible <30Hz energy
  // that otherwise eats headroom and over-excurses the cone.
  const bus = new Tone.Gain(0.9); // restored loudness (the crackle was real-time underrun, not level)
  const subCut = new Tone.Filter(30, 'highpass');
  // 'master' target gets its own automatable filter at the head of the chain.
  const masterFilter =
    spec?.target === 'master' ? new Tone.Filter(spec.open, 'lowpass') : null;
  const fx = masterFx(song.genre);
  // Slow attack (30ms > the kick's low-freq period) + soft knee so the bus
  // compressor doesn't follow the kick waveform and distort it ("fart") when
  // kick+snare/hat sum crosses the threshold.
  const compressor = new Tone.Compressor({ threshold: -14, ratio: 3, attack: 0.03, release: 0.25, knee: 8 });
  const limiter = new Tone.Limiter(-1);
  bus.chain(subCut, ...(masterFilter ? [masterFilter] : []), ...fx, compressor, limiter, Tone.getDestination());

  const isPhonk = song.genre === 'phonk';
  const extras: { dispose(): void }[] = [];

  // Real mode: a shared stereo reverb send gives every voice the same room →
  // depth and glue instead of a flat, dry, centered "demo" sound. wet:1 because
  // it's a 100%-wet return fed by per-voice send gains.
  const reverb = real ? new Tone.Reverb({ decay: 1.8, wet: 1 }) : null;
  reverb?.connect(bus);
  if (reverb) extras.push(reverb);

  // Per-voice placement + reverb send (real mode). Returns the node a voice
  // should output to. Mono sources (samplers/synths) get positioned; drums pan
  // their own lanes internally and route to `bus` directly.
  const spatials: { dispose(): void }[] = [];
  const spatialOut = (role: string): Tone.ToneAudioNode => {
    if (!real || !reverb) return bus;
    const pan = new Tone.Panner(VOICE_PAN[role] ?? 0);
    pan.connect(bus);
    const send = VOICE_SEND[role] ?? 0.1;
    if (send > 0) {
      const g = new Tone.Gain(send);
      pan.connect(g);
      g.connect(reverb);
      spatials.push(g);
    }
    spatials.push(pan);
    return pan;
  };

  // Noir spec: continuous foley bed — rain, vinyl crackle, brush stirring
  // (noise swelling in tempo). Always on, so the loop seam hides inside it.
  if (song.genre === 'noir') {
    // sync(): ambience runs WITH the transport — silence after stop().
    const rain = new Tone.Noise('pink');
    rain.volume.value = -41;
    const rainFilter = new Tone.Filter(1300, 'lowpass');
    rain.chain(rainFilter, bus);
    rain.sync().start(0);
    extras.push(rain, rainFilter);

    const vinyl = new Tone.Noise('white');
    vinyl.volume.value = -46;
    const vinylBand = new Tone.Filter({ frequency: 3200, type: 'bandpass', Q: 0.6 });
    vinyl.chain(vinylBand, bus);
    vinyl.sync().start(0);
    extras.push(vinyl, vinylBand);

    const stir = new Tone.Noise('white');
    stir.volume.value = -42;
    const stirBand = new Tone.Filter({ frequency: 5200, type: 'bandpass', Q: 1.2 });
    const stirSwell = new Tone.Tremolo(song.bpm / 60, 0.85).start(); // one swirl per beat
    stir.chain(stirBand, stirSwell, bus);
    stir.sync().start(0);
    extras.push(stir, stirBand, stirSwell);
  }

  // Phonk spec: sidechain — cowbell and hats duck hard on every kick
  // (attack ≤5ms, release ~130ms), plus constant tape hiss on the bus.
  let duck: Tone.Gain | null = null;
  let onKick: ((t: number) => void) | undefined;
  if (isPhonk) {
    duck = new Tone.Gain(1);
    duck.connect(bus);
    extras.push(duck);
    const hiss = new Tone.Noise('pink');
    hiss.volume.value = -42;
    hiss.connect(bus);
    hiss.sync().start(0); // with the transport — no infinite hiss after stop
    extras.push(hiss);
    const g = duck.gain;
    onKick = (t) => {
      g.cancelAndHoldAtTime(t);
      g.linearRampToValueAtTime(0.18, t + 0.005);
      g.linearRampToValueAtTime(1, t + 0.13);
    };
  }

  const voices = song.tracks.map((t) => {
    if (isPhonk && t.role === 'drums') return makeDrumKit(bus, { hatBus: duck!, onKick });
    if (isPhonk && t.role === 'lead') return makePhonkCowbell(duck!);
    if (t.role === 'drums') {
      const kit = real ? REAL_DRUM_KITS[song.genre] : undefined;
      if (kit) return makeRealDrumKit(bus, kit, { onKick, reverb: reverb ?? undefined, send: VOICE_SEND.drums });
      if (song.genre === 'noir') return makeDrumKit(bus, { dullKick: true });
      if (song.genre === 'doomerwave' || song.genre === 'doomerrun')
        return makeDrumKit(bus, { softKick: true, gatedSnare: true });
      return makeDrumKit(bus);
    }
    return voiceForTrack(
      t,
      song.bpm,
      spatialOut(t.role),
      real,
      spec?.target,
      real && reverb ? { bus, reverb } : undefined,
    );
  });

  // Genre filter automation (phonk underwater intro, keygen/nightcore arp
  // sweeps, grime/noir master filter-in). Re-fires every loop pass.
  const cutoffOf = (target: 'lead' | 'arp' | 'master') =>
    target === 'master'
      ? masterFilter?.frequency
      : voices[song.tracks.findIndex((t) => t.role === target)]?.cutoff;
  const automations = spec ? buildFilterAutomations(song, cutoffOf(spec.target)) : [];

  const ready = Promise.all([
    ...fx.filter((n): n is Tone.Reverb => n instanceof Tone.Reverb).map((n) => n.ready),
    ...(reverb ? [reverb.ready] : []),
    ...voices.map((v) => v.ready ?? Promise.resolve()),
  ]);

  return {
    voices,
    automations,
    ready,
    dispose: () => {
      for (const v of voices) v.dispose();
      for (const s of spatials) s.dispose();
      for (const x of extras) x.dispose();
      bus.dispose();
      subCut.dispose();
      masterFilter?.dispose();
      for (const node of fx) node.dispose();
      compressor.dispose();
      limiter.dispose();
    },
  };
}
