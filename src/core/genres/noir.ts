import type { GenreConfig, StepPattern } from './types';

/**
 * Film noir: smoky slow jazz — walking upright bass, brushed drums,
 * vibraphone seventh chords, sparse muted-trumpet melody, heavy swing.
 */

const BRUSHES: StepPattern = {
  name: 'brushes',
  kick: [0.8, 0, 0, 0, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0, 0, 0],
  snare: [0, 0, 0, 0, 0.5, 0, 0, 0.3, 0, 0, 0, 0, 0.55, 0, 0, 0],
  hatClosed: [0.6, 0, 0.4, 0, 0.6, 0, 0.4, 0, 0.6, 0, 0.4, 0, 0.6, 0, 0.4, 0],
};

const BRUSHES_SPARSE: StepPattern = {
  name: 'brushes-sparse',
  kick: [0.7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  snare: [0, 0, 0, 0, 0.45, 0, 0, 0, 0, 0, 0.3, 0, 0.5, 0, 0, 0],
  hatClosed: [0.55, 0, 0, 0, 0.55, 0, 0.35, 0, 0.55, 0, 0, 0, 0.55, 0, 0.35, 0],
};

export const NOIR: GenreConfig = {
  id: 'noir',
  name: 'Noir',
  bpm: [70, 95],
  timeSig: [4, 4],
  keys: [
    { w: 3, v: 2 }, // D
    { w: 2, v: 7 }, // G
    { w: 2, v: 0 }, // C
    { w: 1, v: 9 }, // A
    { w: 1, v: 4 }, // E
  ],
  modes: [
    { w: 3, v: 'naturalMinor' },
    { w: 2, v: 'dorian' },
    { w: 1, v: 'harmonicMinor' },
  ],
  swing: [0.4, 0.6],
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
      ],
    },
  ],
  progressions: [
    // Smoky seventh-chord turnarounds: i7–iv7–iiø7–V7 and friends.
    {
      w: 3,
      v: [
        { degree: 0, beats: 4, seventh: true },
        { degree: 3, beats: 4, seventh: true },
        { degree: 1, beats: 4, quality: 'halfDim7' },
        { degree: 4, beats: 4, quality: 'dom7' },
      ],
    },
    {
      w: 2,
      v: [
        { degree: 0, beats: 8, seventh: true },
        { degree: 3, beats: 4, seventh: true },
        { degree: 4, beats: 4, quality: 'dom7' },
      ],
    },
    {
      w: 2,
      v: [
        { degree: 0, beats: 4, seventh: true },
        { degree: 5, beats: 4, seventh: true },
        { degree: 1, beats: 4, quality: 'halfDim7' },
        { degree: 4, beats: 4, quality: 'dom7' },
      ],
    },
  ],
  melody: {
    register: [62, 81], // muted trumpet, mid range
    density: 0.32,
    leapProb: 0.3,
    restProb: 0.28,
    syncopation: 0.3,
  },
  bass: { style: 'walking', register: [36, 55] },
  comping: { register: [55, 75] },
  drums: {
    patterns: [
      { w: 2, v: BRUSHES },
      { w: 1, v: BRUSHES_SPARSE },
    ],
    fillEvery: 8,
  },
  instruments: {
    lead: { program: 59, name: 'Muted Trumpet' },
    bass: { program: 32, name: 'Upright Bass' },
    chords: { program: 11, name: 'Vibraphone' },
    drums: { program: 0, name: 'Brushes' },
  },
  arrange: {
    layers: {
      intro: ['bass', 'drums', 'chords'],
    },
    sectionVelocity: { intro: 0.85, B: 0.95 },
  },
  humanize: { timingTicks: 14, velocity: 0.2 },
  filterAutomation: {
    // Old radio warming up: muffled intro opens into the room.
    target: 'master',
    open: 11000,
    sections: {
      intro: { move: 'sweep', fromHz: 1800 },
    },
  },
};
