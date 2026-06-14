import type { GenreConfig, StepPattern } from './types';
import {
  DW_NAMING,
  DW_KEYS,
  DW_MODES,
  DW_PROGRESSIONS,
  DW_INSTRUMENTS,
  genDoomerLead,
  genDoomerGuitar,
} from './doomerwave';

/**
 * Doomer Run: the doomerwave / Russian post-punk palette (galloping picked
 * bass, chorused clean-guitar arps, ostinato cold synth, gated-snare drum
 * machine, tape hiss) rebuilt for the user's rhythm-racing game. Same beatmap
 * contract as outrun/eurobeat/grimerun (invariant #12): intro → build → drop →
 * break → drop dynamics arc, zero timing humanize (onsets = block spawn times),
 * master lowpass valley in the break. "ВАЗ ночью" instead of neon highway.
 */

const RUN_PULSE: StepPattern = {
  name: 'run-pulse',
  kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  hatClosed: [0.6, 0, 0.4, 0, 0.6, 0, 0.4, 0, 0.6, 0, 0.4, 0, 0.6, 0, 0.4, 0],
};

const RUN_DRIVE: StepPattern = {
  name: 'run-drive',
  kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0.6],
  snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  hatClosed: [0.6, 0.3, 0.4, 0.3, 0.6, 0.3, 0.4, 0.3, 0.6, 0.3, 0.4, 0.3, 0.6, 0.3, 0.4, 0.3],
  hatOpen: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
};

export const DOOMERRUN: GenreConfig = {
  id: 'doomerrun',
  name: 'Doomer Run',
  naming: DW_NAMING,
  bpm: [122, 138],
  timeSig: [4, 4],
  keys: DW_KEYS,
  modes: DW_MODES,
  swing: [0, 0],
  structures: [
    // The shared rhythm-game arc: quiet valley (break) between two peaks.
    {
      w: 2,
      v: [
        { name: 'intro', bars: 4 },
        { name: 'build', bars: 8 },
        { name: 'drop', bars: 8 },
        { name: 'break', bars: 8 },
        { name: 'drop', bars: 8 },
      ],
    },
    {
      w: 1,
      v: [
        { name: 'intro', bars: 4 },
        { name: 'drop', bars: 8 },
        { name: 'break', bars: 8 },
        { name: 'build', bars: 4 },
        { name: 'drop', bars: 8 },
      ],
    },
    {
      // Long brooding opener into one extended 16-bar drop (single drop).
      w: 1,
      v: [
        { name: 'intro', bars: 8 },
        { name: 'build', bars: 8 },
        { name: 'drop', bars: 16 },
        { name: 'break', bars: 8 },
      ],
    },
    {
      // Two short drops around a long valley.
      w: 1,
      v: [
        { name: 'intro', bars: 4 },
        { name: 'drop', bars: 8 },
        { name: 'break', bars: 12 },
        { name: 'build', bars: 4 },
        { name: 'drop', bars: 8 },
      ],
    },
  ],
  progressions: DW_PROGRESSIONS,
  distinctProgressions: true,
  melody: {
    register: [64, 79],
    density: 0.4,
    leapProb: 0.1,
    restProb: 0.2,
    syncopation: 0.15,
  },
  bass: { style: 'gallop', register: [33, 57] },
  comping: { register: [52, 72], style: 'sustained' },
  arp: { register: [72, 91], rate: 4 },
  drums: {
    patterns: [
      { w: 2, v: RUN_PULSE },
      { w: 1, v: RUN_DRIVE },
    ],
    fillEvery: 8,
    fillStyle: 'toms',
  },
  instruments: DW_INSTRUMENTS,
  arrange: {
    // Energy per section = terrain height (rhythm-game contract).
    layers: {
      // Atmospheric intro: cold pad + guitar over the beat (melancholy first).
      intro: ['bass', 'drums', 'arp', 'chords'],
      build: ['bass', 'drums', 'arp', 'chords'],
      drop: 'all',
      break: ['chords', 'bass', 'arp'],
    },
    sectionVelocity: { intro: 0.74, build: 0.9, break: 0.78, drop: 1.0 },
  },
  // Zero timing jitter: note.start ticks ARE the beatmap.
  humanize: { timingTicks: 0, velocity: 0.04 },
  filterAutomation: {
    // Master lowpass, dark ceiling: grey valley in the break, sweep through build.
    target: 'master',
    open: 7000,
    sections: {
      intro: { move: 'sweep', fromHz: 700 },
      build: { move: 'sweep', fromHz: 900 },
      break: { move: 'closed', hz: 1100 },
    },
  },
  hooks: {
    melody: genDoomerLead,
    arp: genDoomerGuitar,
  },
};
