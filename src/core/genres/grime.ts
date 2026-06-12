import type { GenreConfig, StepPattern } from './types';

/**
 * Grime (né Memphis phonk): half-time trap drums with hat rolls, gliding
 * 808 bass, cowbell lead, dark 1–2 chord vamps. 130–145 BPM, minor/phrygian.
 */

const TRAP_HALFTIME: StepPattern = {
  name: 'trap-halftime',
  kick: [1, 0, 0, 0, 0, 0, 0, 0.7, 0, 0, 0.6, 0, 0, 0, 0, 0],
  snare: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
  hatClosed: [0.9, 0, 0.5, 0, 0.7, 0, 0.5, 0.4, 0.9, 0, 0.5, 0, 0.7, 0, 0.5, 0],
};

const TRAP_BUSY: StepPattern = {
  name: 'trap-busy',
  kick: [1, 0, 0, 0.6, 0, 0, 1, 0, 0, 0, 0, 0.6, 0, 0.7, 0, 0],
  snare: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0.4],
  hatClosed: [0.9, 0.4, 0.5, 0.4, 0.7, 0.4, 0.5, 0.4, 0.9, 0.4, 0.5, 0.4, 0.7, 0.4, 0.5, 0.4],
  hatOpen: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0],
};

export const GRIME: GenreConfig = {
  id: 'grime',
  name: 'Grime',
  bpm: [130, 145],
  timeSig: [4, 4],
  keys: [
    { w: 3, v: 1 }, // C#
    { w: 2, v: 6 }, // F#
    { w: 2, v: 9 }, // A
    { w: 2, v: 2 }, // D
    { w: 1, v: 7 }, // G
  ],
  modes: [
    { w: 2, v: 'naturalMinor' },
    { w: 1, v: 'phrygian' },
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
        { name: 'intro', bars: 4 },
        { name: 'A', bars: 8 },
        { name: 'A', bars: 8 },
        { name: 'B', bars: 8 },
        { name: 'A', bars: 8 },
      ],
    },
  ],
  progressions: [
    // Dark vamps, two chords per 4 bars: i–VI, i–iv, phrygian i–bII.
    { w: 3, v: [{ degree: 0, beats: 8 }, { degree: 5, beats: 8 }] },
    { w: 2, v: [{ degree: 0, beats: 8 }, { degree: 3, beats: 8 }] },
    { w: 2, v: [{ degree: 0, beats: 8 }, { degree: 1, beats: 8 }] },
    { w: 1, v: [{ degree: 0, beats: 12 }, { degree: 6, beats: 4 }] },
  ],
  melody: {
    register: [60, 76], // cowbell sits in one tight octave-and-a-bit
    density: 0.5,
    leapProb: 0.18,
    restProb: 0.22,
    syncopation: 0.6,
  },
  bass: { style: 's808', register: [26, 41] }, // D1–F2, sub territory
  comping: { register: [48, 65] },
  drums: {
    patterns: [
      { w: 2, v: TRAP_HALFTIME },
      { w: 1, v: TRAP_BUSY },
    ],
    fillEvery: 8,
    rollProb: 0.35,
  },
  instruments: {
    lead: { program: 113, name: 'Cowbell Lead' }, // GM Agogo ≈ closest pitched cowbell
    bass: { program: 39, name: '808 Bass' },
    chords: { program: 89, name: 'Dark Pad' },
    drums: { program: 0, name: 'Trap Kit' },
  },
  arrange: {
    layers: {
      intro: ['bass', 'drums'],
    },
    sectionVelocity: { intro: 0.9 },
  },
  humanize: { timingTicks: 6, velocity: 0.12 },
  filterAutomation: {
    // DJ filter-in: the whole mix opens up across the intro.
    target: 'master',
    open: 9500,
    sections: {
      intro: { move: 'sweep', fromHz: 900 },
    },
  },
};
