import type { GenreConfig, StepPattern } from './types';
import { genGrimeLead } from './grime';

/**
 * Grime Run: grime DNA (half-time trap kit, gliding 808, hypnotic cowbell
 * ostinato) rebuilt for the user's rhythm-racing game. Same beatmap contract
 * as outrun/eurobeat: intro → build → drop → break → drop dynamics arc,
 * zero timing humanize (onsets = block spawn times), master lowpass valley.
 * Night motorway menace instead of night motorway neon.
 */

const RUN_HALFTIME: StepPattern = {
  name: 'run-halftime',
  kick: [1, 0, 0, 0, 0, 0, 0, 0.7, 0, 0, 0.6, 0, 0, 0, 0, 0],
  snare: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
  hatClosed: [0.9, 0, 0.5, 0, 0.7, 0, 0.5, 0.4, 0.9, 0, 0.5, 0, 0.7, 0, 0.5, 0],
};

const RUN_BUSY: StepPattern = {
  name: 'run-busy',
  kick: [1, 0, 0, 0.6, 0, 0, 1, 0, 0, 0, 0, 0.6, 0, 0.7, 0, 0],
  snare: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0.4],
  hatClosed: [0.9, 0.4, 0.5, 0.4, 0.7, 0.4, 0.5, 0.4, 0.9, 0.4, 0.5, 0.4, 0.7, 0.4, 0.5, 0.4],
  hatOpen: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0],
};

export const GRIMERUN: GenreConfig = {
  id: 'grimerun',
  name: 'Grime Run',
  naming: {
    patterns: [
      { w: 3, v: '{adj} {noun}' },
      { w: 1, v: '{adj} {noun} (VIP)' },
      { w: 1, v: '140 {noun}' },
      { w: 1, v: 'M25 {noun}' },
    ],
    words: {
      adj: ['Midnight', 'Motorway', 'Nitro', 'Burnout', 'Slipstream', 'Hairpin', 'Redline', 'Backstreet', 'Overtake', 'Concrete'],
      noun: ['Riddim', 'Drift', 'Pressure', 'Skid', 'Heat', 'Velocity', 'Chase', 'Tarmac', 'Dubplate', 'Wheel-Up'],
    },
  },
  bpm: [132, 148],
  timeSig: [4, 4],
  keys: [
    { w: 3, v: 1 }, // C#
    { w: 2, v: 6 }, // F#
    { w: 2, v: 9 }, // A
    { w: 2, v: 2 }, // D
  ],
  modes: [
    { w: 2, v: 'naturalMinor' },
    { w: 1, v: 'phrygian' },
  ],
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
  ],
  progressions: [
    // Dark grime vamps — two chords, menace over movement.
    { w: 3, v: [{ degree: 0, beats: 8 }, { degree: 5, beats: 8 }] },
    { w: 2, v: [{ degree: 0, beats: 8 }, { degree: 3, beats: 8 }] },
    { w: 2, v: [{ degree: 0, beats: 8 }, { degree: 1, beats: 8 }] },
    { w: 2, v: [{ degree: 0, beats: 4 }, { degree: 1, beats: 4 }] },
    { w: 2, v: [{ degree: 0, beats: 4 }, { degree: 3, beats: 4 }, { degree: 0, beats: 4 }, { degree: 5, beats: 4 }] },
  ],
  distinctProgressions: true,
  melody: {
    register: [60, 76], // the cowbell octave
    density: 0.5,
    leapProb: 0.18,
    restProb: 0.22,
    syncopation: 0.6,
  },
  bass: { style: 's808', register: [26, 41] },
  comping: { register: [48, 65] },
  drums: {
    patterns: [
      { w: 2, v: RUN_HALFTIME },
      { w: 1, v: RUN_BUSY },
    ],
    fillEvery: 8,
    rollProb: 0.35,
    fillStyle: 'mixed',
  },
  instruments: {
    lead: { program: 113, name: 'Cowbell Lead' },
    bass: { program: 39, name: '808 Bass' },
    chords: { program: 89, name: 'Dark Pad' },
    drums: { program: 0, name: 'Trap Kit' },
  },
  arrange: {
    // Energy per section = terrain height (rhythm-game contract).
    layers: {
      intro: ['bass', 'drums'],
      build: ['bass', 'drums', 'chords'],
      drop: 'all',
      break: ['chords', 'bass'],
    },
    sectionVelocity: { intro: 0.85, build: 0.92, break: 0.8, drop: 1.05 },
  },
  // Zero timing jitter: note.start ticks ARE the beatmap. Velocity stays loose — grime swagger.
  humanize: { timingTicks: 0, velocity: 0.12 },
  filterAutomation: {
    // Master lowpass: muffled valley in the break, sweep up through intro/build.
    target: 'master',
    open: 9500,
    sections: {
      intro: { move: 'sweep', fromHz: 900 },
      build: { move: 'sweep', fromHz: 1000 },
      break: { move: 'closed', hz: 1200 },
    },
  },
  hooks: {
    melody: genGrimeLead,
  },
};
