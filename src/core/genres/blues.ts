import type { GenreConfig, StepPattern } from './types';
import { BLUES_12BAR } from '../theory/progressions';

/**
 * 12-bar blues: the strict dom7 square, shuffle feel, boogie bass line,
 * harmonica lead walking the blues scale over major-side harmony.
 * Key mode is mixolydian (correct I/IV/V roots), melody overrides to blues scale.
 */

const SHUFFLE: StepPattern = {
  name: 'shuffle',
  kick: [1, 0, 0, 0, 0, 0, 0, 0, 0.9, 0, 0, 0, 0, 0, 0, 0],
  snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  hatClosed: [0.8, 0, 0.5, 0, 0.8, 0, 0.5, 0, 0.8, 0, 0.5, 0, 0.8, 0, 0.5, 0],
};

const SHUFFLE_BUSY: StepPattern = {
  name: 'shuffle-busy',
  kick: [1, 0, 0, 0, 0, 0, 0.6, 0, 0.9, 0, 0, 0, 0, 0, 0.5, 0],
  snare: [0, 0, 0, 0, 1, 0, 0, 0.35, 0, 0, 0, 0, 1, 0, 0, 0.4],
  hatClosed: [0.8, 0, 0.5, 0, 0.8, 0, 0.5, 0, 0.8, 0, 0.5, 0, 0.8, 0, 0.5, 0],
};

export const BLUES: GenreConfig = {
  id: 'blues',
  name: 'Blues',
  naming: {
    patterns: [
      { w: 3, v: '{adj} {noun} Blues' },
      { w: 1, v: '{noun} Blues' },
      { w: 1, v: '{adj} {noun} Boogie' },
      { w: 1, v: 'Blues for a {adj} {noun}' },
    ],
    words: {
      adj: ['Dusty', 'Empty', 'Broken', 'Lonesome', 'Greyhound', 'Crossroad', 'Muddy', 'Bourbon', 'Rusty', 'Delta'],
      noun: ['Road', 'Bottle', 'Heart', 'Pocket', 'Train', "Mornin'", 'Levee', 'Porch', 'Dime', 'Hound'],
    },
  },
  bpm: [80, 116],
  timeSig: [4, 4],
  keys: [
    { w: 3, v: 4 }, // E
    { w: 3, v: 9 }, // A
    { w: 2, v: 7 }, // G
    { w: 1, v: 0 }, // C
    { w: 1, v: 2 }, // D
  ],
  modes: [{ w: 1, v: 'mixolydian' }],
  swing: [0.5, 0.65], // hard shuffle
  structures: [
    {
      w: 2,
      v: [
        { name: 'A', bars: 12 },
        { name: 'A', bars: 12 },
        { name: 'A', bars: 12 },
      ],
    },
    {
      w: 1,
      v: [
        { name: 'A', bars: 12 },
        { name: 'A', bars: 12 },
        { name: 'A', bars: 12 },
        { name: 'A', bars: 12 },
      ],
    },
  ],
  progressions: [{ w: 1, v: BLUES_12BAR }], // the square is the square
  melody: {
    register: [60, 81],
    density: 0.42,
    leapProb: 0.25,
    restProb: 0.25, // breathing room — call and response
    syncopation: 0.4,
    scale: 'blues', // blue notes over dom7 harmony
  },
  bass: { style: 'boogie', register: [36, 55] },
  comping: { register: [55, 75] },
  drums: {
    patterns: [
      { w: 2, v: SHUFFLE },
      { w: 1, v: SHUFFLE_BUSY },
    ],
    fillEvery: 12, // a fill per chorus, on the turnaround
  },
  instruments: {
    lead: { program: 22, name: 'Harmonica' },
    bass: { program: 32, name: 'Upright Bass' },
    chords: { program: 0, name: 'Piano' },
    drums: { program: 0, name: 'Shuffle Kit' },
  },
  arrange: {
    layers: {},
    sectionVelocity: {},
  },
  humanize: { timingTicks: 12, velocity: 0.18 },
};
