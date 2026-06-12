import type { GenreConfig, StepPattern } from './types';

/**
 * Classic keygen / cracktro chiptune: fast, square-wave lead with echoing
 * hooks, 32nd-note tracker arps faking chords, driving synth bass,
 * four-on-the-floor or halftime-break drums. Razor 1911 energy.
 */

const FOUR_ON_FLOOR: StepPattern = {
  name: 'four-on-floor',
  kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  hatClosed: [0.9, 0, 0.6, 0, 0.9, 0, 0.6, 0, 0.9, 0, 0.6, 0, 0.9, 0, 0.6, 0.4],
  hatOpen: [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
};

const DRIVING_8S: StepPattern = {
  name: 'driving-8s',
  kick: [1, 0, 0, 0, 0, 0, 0.7, 0, 1, 0, 0.6, 0, 0, 0, 0, 0],
  snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0.5],
  hatClosed: [0.9, 0.5, 0.7, 0.5, 0.9, 0.5, 0.7, 0.5, 0.9, 0.5, 0.7, 0.5, 0.9, 0.5, 0.7, 0.5],
};

export const KEYGEN: GenreConfig = {
  id: 'keygen',
  name: 'Classic Keygen',
  bpm: [140, 180],
  timeSig: [4, 4],
  keys: [
    { w: 3, v: 9 }, // A
    { w: 2, v: 0 }, // C
    { w: 2, v: 2 }, // D
    { w: 2, v: 4 }, // E
    { w: 1, v: 7 }, // G
    { w: 1, v: 5 }, // F
  ],
  modes: [
    { w: 3, v: 'naturalMinor' },
    { w: 1, v: 'dorian' },
    { w: 1, v: 'major' },
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
        { name: 'outro', bars: 2 },
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
        { name: 'outro', bars: 2 },
      ],
    },
  ],
  progressions: [
    // Degrees are 0-based: in minor 0=i, 5=VI, 2=III, 6=VII.
    { w: 3, v: [{ degree: 0, beats: 4 }, { degree: 5, beats: 4 }, { degree: 2, beats: 4 }, { degree: 6, beats: 4 }] },
    { w: 2, v: [{ degree: 0, beats: 4 }, { degree: 3, beats: 4 }, { degree: 5, beats: 4 }, { degree: 4, beats: 4 }] },
    { w: 2, v: [{ degree: 0, beats: 4 }, { degree: 6, beats: 4 }, { degree: 5, beats: 4 }, { degree: 6, beats: 4 }] },
    { w: 1, v: [{ degree: 0, beats: 8 }, { degree: 5, beats: 4 }, { degree: 4, beats: 4 }] },
  ],
  melody: {
    register: [69, 93], // A4–A6
    density: 0.6,
    leapProb: 0.22,
    restProb: 0.12,
    syncopation: 0.45,
  },
  bass: { style: 'synth8', register: [33, 50] }, // A1–D3
  arp: { register: [57, 84], rate: 8 }, // 32nd-note tracker arps
  drums: {
    patterns: [
      { w: 2, v: FOUR_ON_FLOOR },
      { w: 1, v: DRIVING_8S },
    ],
    fillEvery: 8,
  },
  instruments: {
    lead: { program: 80, name: 'Square Lead' },
    arp: { program: 81, name: 'Saw Arp' },
    bass: { program: 38, name: 'Synth Bass' },
    drums: { program: 0, name: 'Drums' },
  },
  arrange: {
    layers: {
      intro: ['arp', 'drums'],
      outro: ['arp', 'bass', 'drums'],
    },
    sectionVelocity: { intro: 0.85, outro: 0.9 },
  },
  humanize: { timingTicks: 3, velocity: 0.06 }, // machine-tight, it's a tracker
};
