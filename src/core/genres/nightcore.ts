import type { GenreConfig, StepPattern } from './types';

/**
 * Nightcore: sped-up eurodance euphoria — 160–180 BPM four-on-the-floor,
 * a soaring lead way up high (the pitched-up-vocal register), supersaw
 * energy, offbeat open hats, trance arp pulsing sixteenths.
 */

const EURO_FLOOR: StepPattern = {
  name: 'euro-floor',
  kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  hatClosed: [0, 0, 0.5, 0, 0, 0, 0.5, 0, 0, 0, 0.5, 0, 0, 0, 0.5, 0],
  hatOpen: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0], // the offbeat pump
};

const EURO_DRIVE: StepPattern = {
  name: 'euro-drive',
  kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0.6, 0],
  snare: [0, 0, 0, 0, 1, 0, 0, 0.4, 0, 0, 0, 0, 1, 0, 0, 0.5],
  hatClosed: [0.8, 0.4, 0.6, 0.4, 0.8, 0.4, 0.6, 0.4, 0.8, 0.4, 0.6, 0.4, 0.8, 0.4, 0.6, 0.4],
  hatOpen: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
};

export const NIGHTCORE: GenreConfig = {
  id: 'nightcore',
  name: 'Nightcore',
  naming: {
    patterns: [
      { w: 3, v: '{adj} {noun} ♥' },
      { w: 2, v: '{adj} {noun}!!' },
      { w: 1, v: '{noun} {noun2} ☆' },
      { w: 1, v: '(sped up) {adj} {noun}' },
    ],
    words: {
      adj: ['sweetheart', 'sugar', 'neon', 'moonlit', 'bubblegum', 'starry', 'midnight', 'glitter', 'cherry', 'dizzy'],
      noun: ['overdrive', 'rush', 'heartbeat', 'confession', 'parade', 'daydream', 'spin', 'sparkle', 'crush', 'melody'],
    },
  },
  bpm: [160, 180],
  timeSig: [4, 4],
  keys: [
    { w: 3, v: 9 }, // A
    { w: 2, v: 4 }, // E
    { w: 2, v: 11 }, // B
    { w: 2, v: 2 }, // D
    { w: 1, v: 6 }, // F#
  ],
  modes: [
    { w: 2, v: 'major' },
    { w: 2, v: 'naturalMinor' }, // uplifting minor — half the canon
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
    // I–V–vi–IV and the eurodance staples.
    { w: 2, v: [{ degree: 0, beats: 4 }, { degree: 4, beats: 4 }, { degree: 5, beats: 4 }, { degree: 3, beats: 4 }] },
    { w: 2, v: [{ degree: 5, beats: 4 }, { degree: 3, beats: 4 }, { degree: 0, beats: 4 }, { degree: 4, beats: 4 }] },
    { w: 2, v: [{ degree: 0, beats: 4 }, { degree: 5, beats: 4 }, { degree: 2, beats: 4 }, { degree: 6, beats: 4 }] },
    { w: 1, v: [{ degree: 0, beats: 4 }, { degree: 3, beats: 4 }, { degree: 4, beats: 4 }, { degree: 4, beats: 4 }] },
  ],
  melody: {
    register: [76, 96], // way up — the pitched-up voice
    density: 0.65,
    leapProb: 0.25,
    restProb: 0.08,
    syncopation: 0.5,
  },
  bass: { style: 'synth8', register: [33, 50] },
  arp: { register: [64, 88], rate: 4 }, // 16th trance arp
  drums: {
    patterns: [
      { w: 2, v: EURO_FLOOR },
      { w: 1, v: EURO_DRIVE },
    ],
    fillEvery: 8,
  },
  instruments: {
    lead: { program: 90, name: 'Supersaw Lead' }, // GM Pad 3 (polysynth)
    arp: { program: 81, name: 'Trance Arp' },
    bass: { program: 38, name: 'Euro Bass' },
    drums: { program: 0, name: 'Euro Kit' },
  },
  arrange: {
    layers: {
      intro: ['arp', 'bass', 'drums'],
    },
    sectionVelocity: { intro: 0.85 },
  },
  humanize: { timingTicks: 3, velocity: 0.07 },
  filterAutomation: {
    // Trance riser: the arp sweeps open across the intro into the first drop.
    target: 'arp',
    open: 5200,
    sections: {
      intro: { move: 'sweep', fromHz: 500 },
    },
  },
};
