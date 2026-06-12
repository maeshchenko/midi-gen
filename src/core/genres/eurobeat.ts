import type { GenreConfig, StepPattern } from './types';

/**
 * Eurobeat: racing-arcade adrenaline (Initial D tapes, OutRun cabinets) —
 * 150–162 BPM four-on-the-floor, relentless octave bass on every eighth,
 * synth-brass stabs, a sawtooth riff tearing through the top. Minor-key
 * euphoria: sounds like a hairpin turn at 180 km/h.
 */

const EB_FLOOR: StepPattern = {
  name: 'eb-floor',
  kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  hatClosed: [0.7, 0.3, 0.5, 0.3, 0.7, 0.3, 0.5, 0.3, 0.7, 0.3, 0.5, 0.3, 0.7, 0.3, 0.5, 0.3],
  hatOpen: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0], // offbeat pump
};

const EB_DRIVE: StepPattern = {
  name: 'eb-drive',
  kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0.6, 0],
  snare: [0, 0, 0, 0, 1, 0, 0, 0.4, 0, 0, 0, 0, 1, 0, 0, 0.5],
  hatClosed: [0.8, 0.4, 0.6, 0.4, 0.8, 0.4, 0.6, 0.4, 0.8, 0.4, 0.6, 0.4, 0.8, 0.4, 0.6, 0.4],
  hatOpen: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
  perc: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0], // clap pickup into the next bar
};

export const EUROBEAT: GenreConfig = {
  id: 'eurobeat',
  name: 'Eurobeat',
  naming: {
    patterns: [
      { w: 3, v: '{verb} IN THE {noun}' },
      { w: 3, v: '{adj} {noun}' },
      { w: 2, v: '{noun} {noun2}' },
      { w: 1, v: '{noun} {noun2} {noun2}' }, // GAS GAS GAS energy
      { w: 1, v: 'MAX {noun}' },
    ],
    words: {
      verb: ['RUNNING', 'BURNING', 'RACING', 'DANCING', 'CRASHING', 'DRIFTING', 'FLYING'],
      adj: ['CRAZY', 'MIDNIGHT', 'TURBO', 'WILD', 'ETERNAL', 'SUPERSONIC', 'DANGEROUS', 'GOLDEN'],
      noun: ['NIGHT', 'FIRE', 'POWER', 'HIGHWAY', 'HEARTBEAT', 'ENGINE', 'THUNDER', 'SPEED', 'LOVE', 'DESIRE'],
    },
  },
  bpm: [150, 162],
  timeSig: [4, 4],
  keys: [
    { w: 3, v: 9 }, // A — the eurobeat home key
    { w: 2, v: 4 }, // E
    { w: 2, v: 2 }, // D
    { w: 1, v: 11 }, // B
    { w: 1, v: 7 }, // G
  ],
  modes: [
    { w: 3, v: 'naturalMinor' },
    { w: 1, v: 'harmonicMinor' }, // raised-leading-tone drama
    { w: 1, v: 'major' },
  ],
  swing: [0, 0],
  structures: [
    // Same rhythm-game arc as outrun: quiet valley (break) between two peaks.
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
    // The eurobeat staples, minor-side.
    { w: 3, v: [{ degree: 0, beats: 4 }, { degree: 5, beats: 4 }, { degree: 6, beats: 4 }, { degree: 0, beats: 4 }] },
    { w: 2, v: [{ degree: 0, beats: 4 }, { degree: 6, beats: 4 }, { degree: 5, beats: 4 }, { degree: 6, beats: 4 }] },
    { w: 2, v: [{ degree: 0, beats: 4 }, { degree: 5, beats: 4 }, { degree: 2, beats: 4 }, { degree: 6, beats: 4 }] },
    { w: 1, v: [{ degree: 0, beats: 4 }, { degree: 3, beats: 4 }, { degree: 5, beats: 4 }, { degree: 4, beats: 4 }] },
  ],
  distinctProgressions: true,
  melody: {
    register: [69, 91], // screaming saw riff on top
    density: 0.75,
    leapProb: 0.3,
    restProb: 0.06,
    syncopation: 0.45,
  },
  bass: { style: 'octave8', register: [33, 47] }, // root/octave see-saw — THE eurobeat engine
  comping: { register: [57, 76], style: 'stabs' }, // synth-brass hits
  arp: { register: [64, 86], rate: 4, patterns: [{ w: 2, v: 'updown' }, { w: 1, v: 'octaves' }] },
  drums: {
    patterns: [
      { w: 2, v: EB_FLOOR },
      { w: 1, v: EB_DRIVE },
    ],
    fillEvery: 8,
    fillStyle: 'mixed',
  },
  instruments: {
    lead: { program: 81, name: 'Saw Lead' }, // GM Lead 2 (sawtooth)
    chords: { program: 62, name: 'Synth Brass' },
    arp: { program: 81, name: 'Euro Arp' },
    bass: { program: 38, name: 'Octave Bass' }, // GM Synth Bass 1
    drums: { program: 0, name: 'Euro Kit' },
  },
  arrange: {
    // Energy per section = terrain height, mirroring outrun.
    layers: {
      intro: ['arp', 'bass'],
      build: ['arp', 'bass', 'drums'],
      drop: 'all',
      break: ['chords', 'arp', 'bass'],
    },
    sectionVelocity: { intro: 0.8, build: 0.92, break: 0.82, drop: 1.05 },
  },
  // Zero timing jitter: note.start ticks ARE the beatmap (rhythm-game contract).
  humanize: { timingTicks: 0, velocity: 0.06 },
  filterAutomation: {
    // Master lowpass: muffled valley in the break, sweep up through the build.
    target: 'master',
    open: 9000,
    sections: {
      intro: { move: 'sweep', fromHz: 600 },
      build: { move: 'sweep', fromHz: 900 },
      break: { move: 'closed', hz: 1400 },
    },
  },
};
