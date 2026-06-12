/**
 * Tone.js voices for song tracks. Pure synthesis — no samples, no network.
 *
 * Nodes are created against the CURRENT Tone context: call buildEnsemble()
 * live for playback, or inside Tone.Offline() for rendering — same code path
 * (that's the whole reason this is a factory).
 */

import * as Tone from 'tone';
import { PPQ, type Song, type Track } from '../core/types';
import { GM_DRUMS } from '../core/gen/drums';
import { getGenre } from '../core/genres';

export interface Voice {
  trigger(pitch: number, timeSec: number, durSec: number, velocity: number, slide?: boolean): void;
  dispose(): void;
  /** Exposed low-pass cutoff for section automation (phonk intro/build-up). */
  cutoff?: Tone.Signal<'frequency'>;
  /** Async insert FX (per-voice reverb IR) — awaited before offline render. */
  ready?: Promise<unknown>;
}

const midiHz = (pitch: number): number => 440 * 2 ** ((pitch - 69) / 12);

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
  synth.volume.value = -1;
  const dist = new Tone.Distortion(0.5); // harmonics so the sub reads on small speakers
  dist.wet.value = 0.35;
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
}

function makeDrumKit(out: Tone.ToneAudioNode, opts: DrumKitOpts = {}): Voice {
  const kick = new Tone.MembraneSynth(
    opts.dullKick
      ? {
          pitchDecay: 0.015,
          octaves: 1.5,
          envelope: { attack: 0.01, decay: 0.3, sustain: 0.01, release: 0.3 },
        }
      : {
          pitchDecay: 0.04,
          octaves: 6,
          envelope: { attack: 0.001, decay: 0.35, sustain: 0.01, release: 0.4 },
        },
  );
  kick.volume.value = opts.dullKick ? -8 : -2;
  const kickFilter = opts.dullKick ? new Tone.Filter(180, 'lowpass') : null;

  const snare = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.16, sustain: 0 },
  });
  snare.volume.value = -8;
  const snareBody = new Tone.Filter(1800, 'bandpass');
  snare.chain(snareBody, out);

  const hat = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.045, release: 0.02 },
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 4000,
    octaves: 1.5,
  });
  hat.volume.value = -18;

  const hatOpen = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.25, release: 0.1 },
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 4000,
    octaves: 1.5,
  });
  hatOpen.volume.value = -20;

  const crash = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 1.2, release: 0.6 },
    harmonicity: 5.0,
    modulationIndex: 40,
    resonance: 5000,
    octaves: 1.8,
  });
  crash.volume.value = -16;

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
    modulationIndex: 28,
    resonance: 5500,
    octaves: 1.4,
  });
  tambourine.volume.value = -16;

  // Dark jazz ride — long, low, washy.
  const ride = new Tone.MetalSynth({
    envelope: { attack: 0.002, decay: 0.8, release: 0.4 },
    harmonicity: 4.1,
    modulationIndex: 20,
    resonance: 2400,
    octaves: 1.2,
  });
  ride.volume.value = -22;

  const hatOut = opts.hatBus ?? out;
  if (kickFilter) kick.chain(kickFilter, out);
  else kick.connect(out);
  hat.connect(hatOut);
  hatOpen.connect(hatOut);
  crash.connect(out);
  tom.connect(out);
  ride.connect(out);
  tambourine.connect(hatOut);

  // Every sub-synth is monophonic — guard each against same-instant retriggers.
  const gKick = monoGuard((p, t, d, v) => {
    kick.triggerAttackRelease(midiHz(p), d, t, v);
    opts.onKick?.(t);
  });
  const gSnare = monoGuard((_p, t, d, v) => snare.triggerAttackRelease(d, t, v));
  const gHat = monoGuard((p, t, _d, v) => hat.triggerAttackRelease(midiHz(p), 0.05, t, v));
  const gHatOpen = monoGuard((p, t, _d, v) => hatOpen.triggerAttackRelease(midiHz(p), 0.3, t, v));
  const gCrash = monoGuard((p, t, _d, v) => crash.triggerAttackRelease(midiHz(p), 1.4, t, v * 0.8));
  const gTom = monoGuard((p, t, d, v) => tom.triggerAttackRelease(midiHz(p), d, t, v));
  const gRide = monoGuard((p, t, _d, v) => ride.triggerAttackRelease(midiHz(p), 0.7, t, v));
  const gTamb = monoGuard((p, t, _d, v) => tambourine.triggerAttackRelease(midiHz(p), 0.15, t, v));
  const gClap = monoGuard((_p, t, d, v) => clap.triggerAttackRelease(d, t, v));
  const gShaker = monoGuard((_p, t, d, v) => shaker.triggerAttackRelease(d, t, v));

  return {
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
      hat.dispose();
      hatOpen.dispose();
      crash.dispose();
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

function voiceForTrack(track: Track, bpm: number, out: Tone.ToneAudioNode): Voice {
  if (track.role === 'drums') return makeDrumKit(out);
  switch (track.program) {
    case 80:
      return makeSquareLead(out, bpm);
    case 81:
      return makeSawArp(out);
    case 38:
      return makeSynthBass(out);
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

export function buildEnsemble(song: Song): Ensemble {
  const spec = getGenre(song.genre).filterAutomation;
  const bus = new Tone.Gain(1);
  // 'master' target gets its own automatable filter at the head of the chain.
  const masterFilter =
    spec?.target === 'master' ? new Tone.Filter(spec.open, 'lowpass') : null;
  const fx = masterFx(song.genre);
  const compressor = new Tone.Compressor(-14, 3);
  const limiter = new Tone.Limiter(-1);
  bus.chain(...(masterFilter ? [masterFilter] : []), ...fx, compressor, limiter, Tone.getDestination());

  const isPhonk = song.genre === 'phonk';
  const extras: { dispose(): void }[] = [];

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
    if (song.genre === 'noir' && t.role === 'drums') return makeDrumKit(bus, { dullKick: true });
    return voiceForTrack(t, song.bpm, bus);
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
    ...voices.map((v) => v.ready ?? Promise.resolve()),
  ]);

  return {
    voices,
    automations,
    ready,
    dispose: () => {
      for (const v of voices) v.dispose();
      for (const x of extras) x.dispose();
      bus.dispose();
      masterFilter?.dispose();
      for (const node of fx) node.dispose();
      compressor.dispose();
      limiter.dispose();
    },
  };
}
