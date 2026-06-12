/**
 * Tone.js voices for song tracks. Pure synthesis — no samples, no network.
 *
 * Nodes are created against the CURRENT Tone context: call buildEnsemble()
 * live for playback, or inside Tone.Offline() for rendering — same code path
 * (that's the whole reason this is a factory).
 */

import * as Tone from 'tone';
import type { Song, Track } from '../core/types';
import { GM_DRUMS } from '../core/gen/drums';

export interface Voice {
  trigger(pitch: number, timeSec: number, durSec: number, velocity: number): void;
  dispose(): void;
}

const midiHz = (pitch: number): number => 440 * 2 ** ((pitch - 69) / 12);

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
  return {
    trigger: (p, t, d, v) => synth.triggerAttackRelease(midiHz(p), d, t, v),
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
    trigger: (p, t, d, v) => synth.triggerAttackRelease(midiHz(p), d, t, v),
    dispose: () => synth.dispose(),
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

function makeDrumKit(out: Tone.ToneAudioNode): Voice {
  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.04,
    octaves: 6,
    envelope: { attack: 0.001, decay: 0.35, sustain: 0.01, release: 0.4 },
  });
  kick.volume.value = -2;

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

  kick.connect(out);
  hat.connect(out);
  hatOpen.connect(out);
  crash.connect(out);
  tom.connect(out);

  return {
    trigger: (pitch, t, d, v) => {
      switch (pitch) {
        case GM_DRUMS.kick:
          kick.triggerAttackRelease(midiHz(36), d, t, v);
          break;
        case GM_DRUMS.snare:
          snare.triggerAttackRelease(d, t, v);
          break;
        case GM_DRUMS.hatClosed:
          hat.triggerAttackRelease(midiHz(90), 0.05, t, v);
          break;
        case GM_DRUMS.hatOpen:
          hatOpen.triggerAttackRelease(midiHz(88), 0.3, t, v);
          break;
        case GM_DRUMS.crash:
          crash.triggerAttackRelease(midiHz(85), 1.4, t, v * 0.8);
          break;
        case GM_DRUMS.tomLow:
          tom.triggerAttackRelease(midiHz(45), d, t, v);
          break;
        case GM_DRUMS.tomMid:
          tom.triggerAttackRelease(midiHz(50), d, t, v);
          break;
        case GM_DRUMS.tomHigh:
          tom.triggerAttackRelease(midiHz(55), d, t, v);
          break;
        default:
          snare.triggerAttackRelease(d, t, v * 0.5);
      }
    },
    dispose: () => {
      kick.dispose();
      snare.dispose();
      snareBody.dispose();
      hat.dispose();
      hatOpen.dispose();
      crash.dispose();
      tom.dispose();
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
    default:
      return makeGenericPoly(out);
  }
}

export interface Ensemble {
  voices: Voice[];
  dispose(): void;
}

export function buildEnsemble(song: Song): Ensemble {
  const compressor = new Tone.Compressor(-14, 3);
  const limiter = new Tone.Limiter(-1);
  compressor.chain(limiter, Tone.getDestination());

  const voices = song.tracks.map((t) => voiceForTrack(t, song.bpm, compressor));
  return {
    voices,
    dispose: () => {
      for (const v of voices) v.dispose();
      compressor.dispose();
      limiter.dispose();
    },
  };
}
