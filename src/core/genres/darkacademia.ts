import type { GenreConfig, StepPattern } from './types';

/**
 * Dark academia: candle-lit chamber music — harpsichord Alberti figures,
 * bowed cello roots, violin melody in harmonic minor, circle-of-fifths
 * sequences. No drums; the harpsichord is the pulse. 72–96 BPM.
 */

const NO_DRUMS: StepPattern = {
  name: 'none',
  kick: [],
  snare: [],
  hatClosed: [],
};

export const DARKACADEMIA: GenreConfig = {
  id: 'darkacademia',
  name: 'Dark Academia',
  bpm: [72, 96],
  timeSig: [4, 4],
  keys: [
    { w: 3, v: 9 }, // A
    { w: 2, v: 2 }, // D
    { w: 2, v: 4 }, // E
    { w: 2, v: 7 }, // G
    { w: 1, v: 11 }, // B
  ],
  modes: [
    { w: 2, v: 'harmonicMinor' },
    { w: 2, v: 'naturalMinor' },
  ],
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
        { name: 'B', bars: 8 },
        { name: 'A', bars: 8 },
        { name: 'B', bars: 8 },
      ],
    },
  ],
  progressions: [
    // i–iv–V7–i.
    {
      w: 2,
      v: [
        { degree: 0, beats: 4 },
        { degree: 3, beats: 4 },
        { degree: 4, beats: 4, quality: 'dom7' },
        { degree: 0, beats: 4 },
      ],
    },
    // Lament: i–VII–VI–V7.
    {
      w: 2,
      v: [
        { degree: 0, beats: 4 },
        { degree: 6, beats: 4 },
        { degree: 5, beats: 4 },
        { degree: 4, beats: 4, quality: 'dom7' },
      ],
    },
    // Circle-of-fifths sequence: i–iv–VII–III–VI–ii°–V7–i.
    {
      w: 1,
      v: [
        { degree: 0, beats: 2 },
        { degree: 3, beats: 2 },
        { degree: 6, beats: 2 },
        { degree: 2, beats: 2 },
        { degree: 5, beats: 2 },
        { degree: 1, beats: 2 },
        { degree: 4, beats: 2, quality: 'dom7' },
        { degree: 0, beats: 2 },
      ],
    },
  ],
  melody: {
    register: [64, 86], // violin
    density: 0.45,
    leapProb: 0.22,
    restProb: 0.18,
    syncopation: 0.15, // classical phrasing, mostly on the grid
  },
  bass: { style: 'sustain', register: [36, 55] }, // bowed cello
  comping: { register: [52, 72], style: 'alberti' },
  drums: {
    patterns: [{ w: 1, v: NO_DRUMS }],
    fillEvery: 8,
  },
  instruments: {
    // no drums entry — chamber ensemble
    lead: { program: 40, name: 'Violin' },
    bass: { program: 42, name: 'Cello' },
    chords: { program: 6, name: 'Harpsichord' },
  },
  arrange: {
    layers: {
      intro: ['chords', 'bass'], // harpsichord and cello set the scene
    },
    sectionVelocity: { intro: 0.85 },
  },
  humanize: { timingTicks: 16, velocity: 0.2 },
};
