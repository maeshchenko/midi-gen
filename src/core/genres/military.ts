import type { GenreConfig, StepPattern } from './types';

/**
 * Military parade march: 2/4 at ~120, snare ostinato (the 16-step grid here
 * is 32nds — dense rudiment feel), tuba oom-pah, brass-section stabs on the
 * beats, trumpet fanfare melody in a bright major key.
 */

const PARADE_SNARE: StepPattern = {
  // 2/4 bar, steps are 32nds: continuous snare rudiments, kick on the downbeat.
  name: 'parade-snare',
  kick: [1, 0, 0, 0, 0, 0, 0, 0, 0.8, 0, 0, 0, 0, 0, 0, 0],
  snare: [1, 0, 0.4, 0, 0.6, 0, 0.4, 0, 0.9, 0, 0.4, 0, 0.6, 0, 0.4, 0.5],
  hatClosed: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

const PARADE_ROLLS: StepPattern = {
  name: 'parade-rolls',
  kick: [1, 0, 0, 0, 0, 0, 0, 0, 0.8, 0, 0, 0, 0, 0, 0, 0],
  snare: [1, 0.3, 0.4, 0.3, 0.7, 0.3, 0.4, 0.3, 0.9, 0.3, 0.4, 0.3, 0.7, 0.3, 0.5, 0.6],
  hatClosed: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

export const MILITARY: GenreConfig = {
  id: 'military',
  name: 'Military Parade',
  naming: {
    patterns: [
      { w: 3, v: 'March of the {adj} {noun}' },
      { w: 2, v: 'Parade of the {adj} {noun}' },
      { w: 2, v: '{adj} {noun} March' },
      { w: 1, v: 'The {adj} {noun}' },
    ],
    words: {
      adj: ['Iron', 'Scarlet', 'Granite', 'Northern', 'Unbroken', 'Thundering', 'Golden', 'Steadfast'],
      noun: ['Column', 'Banner', 'Garrison', 'Bugle', 'Regiment', 'Bastion', 'Vanguard', 'Standard', 'Brigade', 'Cadence'],
    },
  },
  bpm: [108, 124],
  timeSig: [2, 4],
  keys: [
    { w: 3, v: 10 }, // Bb — band key
    { w: 3, v: 3 }, // Eb
    { w: 2, v: 5 }, // F
    { w: 1, v: 0 }, // C
  ],
  modes: [{ w: 1, v: 'major' }],
  swing: [0, 0],
  structures: [
    {
      w: 2,
      v: [
        { name: 'intro', bars: 4 },
        { name: 'A', bars: 16 },
        { name: 'B', bars: 16 },
        { name: 'A', bars: 16 },
      ],
    },
    {
      w: 1,
      v: [
        { name: 'intro', bars: 8 },
        { name: 'A', bars: 16 },
        { name: 'B', bars: 16 },
        { name: 'A', bars: 16 },
      ],
    },
  ],
  progressions: [
    // I–IV–V–I over 4 bars of 2/4 (8 beats).
    {
      w: 2,
      v: [
        { degree: 0, beats: 4 },
        { degree: 3, beats: 2 },
        { degree: 4, beats: 2 },
      ],
    },
    {
      w: 2,
      v: [
        { degree: 0, beats: 2 },
        { degree: 4, beats: 2 },
        { degree: 0, beats: 2 },
        { degree: 4, beats: 2 },
      ],
    },
    {
      w: 1,
      v: [
        { degree: 0, beats: 2 },
        { degree: 3, beats: 2 },
        { degree: 0, beats: 2 },
        { degree: 4, beats: 2 },
      ],
    },
  ],
  melody: {
    register: [64, 82], // trumpet
    density: 0.55,
    leapProb: 0.3, // fanfare fourths and fifths
    restProb: 0.12,
    syncopation: 0.12, // straight, on the grid
  },
  bass: { style: 'march', register: [34, 50] }, // tuba oom-pah
  comping: { register: [55, 74], style: 'stabs' },
  drums: {
    patterns: [
      { w: 2, v: PARADE_SNARE },
      { w: 1, v: PARADE_ROLLS },
    ],
    fillEvery: 8,
  },
  instruments: {
    lead: { program: 56, name: 'Trumpet' },
    bass: { program: 58, name: 'Tuba' },
    chords: { program: 61, name: 'Brass Section' },
    drums: { program: 0, name: 'Field Drums' },
  },
  arrange: {
    layers: {
      intro: ['drums', 'bass'], // drums-and-tuba street beat opening
    },
    sectionVelocity: { intro: 0.9 },
  },
  humanize: { timingTicks: 5, velocity: 0.1 },
};
