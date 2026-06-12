import type { GenreConfig, StepPattern } from './types';

/**
 * Anime opening (J-pop): bright major key, the «royal road» progression
 * IV△7–V7–iii7–vi, energetic leaping piano melody over string pads,
 * pop-rock drums. 128–160 BPM.
 */

const POP_ROCK: StepPattern = {
  name: 'pop-rock',
  kick: [1, 0, 0, 0, 0, 0, 0.8, 0, 1, 0, 0, 0.6, 0, 0, 0, 0],
  snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  hatClosed: [0.9, 0, 0.6, 0, 0.9, 0, 0.6, 0, 0.9, 0, 0.6, 0, 0.9, 0, 0.6, 0],
  hatOpen: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
};

const POP_DRIVING: StepPattern = {
  name: 'pop-driving',
  kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0.6, 0],
  snare: [0, 0, 0, 0, 1, 0, 0, 0.4, 0, 0, 0, 0, 1, 0, 0, 0],
  hatClosed: [0.9, 0.5, 0.6, 0.5, 0.9, 0.5, 0.6, 0.5, 0.9, 0.5, 0.6, 0.5, 0.9, 0.5, 0.6, 0.5],
};

export const ANIME: GenreConfig = {
  id: 'anime',
  name: 'Anime Opening',
  naming: {
    patterns: [
      { w: 3, v: '{adj} {noun}' },
      { w: 1, v: 'Heart of the {adj} {noun}' },
      { w: 1, v: '{noun} Beyond the {noun2}' },
      { w: 1, v: 'My {adj} {noun}' },
    ],
    words: {
      adj: ['Sakura', 'Neon', 'Crimson', 'Shining', 'Infinite', 'Starlit', 'Burning', 'Crystal', 'Midnight', 'Eternal'],
      noun: ['Overdrive', 'Horizon', 'Heartbeat', 'Wings', 'Promise', 'Adventure', 'Tomorrow', 'Galaxy', 'Memories', 'Destiny'],
    },
  },
  bpm: [128, 160],
  timeSig: [4, 4],
  keys: [
    { w: 3, v: 0 }, // C
    { w: 2, v: 7 }, // G
    { w: 2, v: 2 }, // D
    { w: 2, v: 9 }, // A
    { w: 1, v: 4 }, // E
  ],
  modes: [{ w: 1, v: 'major' }],
  swing: [0, 0],
  structures: [
    {
      w: 2,
      v: [
        { name: 'intro', bars: 4 },
        { name: 'A', bars: 8 },
        { name: 'B', bars: 8 },
        { name: 'A', bars: 8 },
      ],
    },
    {
      w: 1,
      v: [
        { name: 'intro', bars: 2 },
        { name: 'A', bars: 8 },
        { name: 'A', bars: 8 },
        { name: 'B', bars: 8 },
        { name: 'A', bars: 8 },
      ],
    },
  ],
  progressions: [
    // The royal road (王道進行): IV△7–V7–iii7–vi.
    {
      w: 3,
      v: [
        { degree: 3, beats: 4, seventh: true },
        { degree: 4, beats: 4, quality: 'dom7' },
        { degree: 2, beats: 4, seventh: true },
        { degree: 5, beats: 4, seventh: true },
      ],
    },
    // I–V–vi–IV.
    {
      w: 2,
      v: [
        { degree: 0, beats: 4 },
        { degree: 4, beats: 4 },
        { degree: 5, beats: 4 },
        { degree: 3, beats: 4 },
      ],
    },
    // vi–IV–I–V.
    {
      w: 2,
      v: [
        { degree: 5, beats: 4 },
        { degree: 3, beats: 4 },
        { degree: 0, beats: 4 },
        { degree: 4, beats: 4 },
      ],
    },
  ],
  melody: {
    register: [67, 88], // bright, up top
    density: 0.6,
    leapProb: 0.32, // big J-pop leaps
    restProb: 0.1,
    syncopation: 0.45,
  },
  bass: { style: 'synth8', register: [33, 50] },
  comping: { register: [55, 76] },
  drums: {
    patterns: [
      { w: 2, v: POP_ROCK },
      { w: 1, v: POP_DRIVING },
    ],
    fillEvery: 4, // energetic fills
  },
  instruments: {
    lead: { program: 1, name: 'Bright Piano' },
    bass: { program: 33, name: 'Finger Bass' },
    chords: { program: 48, name: 'Strings' },
    drums: { program: 0, name: 'Pop Kit' },
  },
  arrange: {
    layers: {
      intro: ['chords', 'lead', 'drums'],
    },
    sectionVelocity: { intro: 0.85 },
  },
  humanize: { timingTicks: 8, velocity: 0.12 },
};
