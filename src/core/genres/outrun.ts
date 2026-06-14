import type { GenreConfig, StepPattern } from './types';

/**
 * Outrun / spacesynth: a starship on a neon highway at night — 118–132 BPM
 * four-on-the-floor, sequenced 16th bass, glassy arps, gated-snare drama.
 *
 * Built as RHYTHM-GAME FUEL: the arrangement is a deliberate dynamics arc
 * (intro → build → drop → break → drop) so a game can map per-bar loudness
 * to terrain height and section energy to speed. humanize.timingTicks is 0 —
 * every onset sits exactly on the grid, so note starts double as beatmap
 * spawn times with no audio analysis.
 */

const OR_DRIVE: StepPattern = {
  name: 'or-drive',
  kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], // the big gated hit
  hatClosed: [0.7, 0.3, 0.5, 0.3, 0.7, 0.3, 0.5, 0.3, 0.7, 0.3, 0.5, 0.3, 0.7, 0.3, 0.5, 0.3],
  hatOpen: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
  perc: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], // clap glued to the snare
};

const OR_PULSE: StepPattern = {
  name: 'or-pulse',
  kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0.5],
  snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  hatClosed: [0.6, 0, 0.4, 0, 0.6, 0, 0.4, 0, 0.6, 0, 0.4, 0, 0.6, 0, 0.4, 0],
  hatOpen: [0, 0, 0.8, 0, 0, 0, 0.8, 0, 0, 0, 0.8, 0, 0, 0, 0.8, 0],
};

// Syncopated electro kick (1 + the "and of 2", "and of 3") — Italo bounce.
const OR_ELECTRO: StepPattern = {
  name: 'or-electro',
  kick: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0],
  snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  hatClosed: [0.7, 0.3, 0.5, 0.3, 0.7, 0.3, 0.5, 0.3, 0.7, 0.3, 0.5, 0.3, 0.7, 0.3, 0.5, 0.3],
  hatOpen: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
  perc: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
};

// Driving 1/16 hats, snare with a ghost pickup — peak-energy variant.
const OR_RUSH: StepPattern = {
  name: 'or-rush',
  kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  snare: [0, 0, 0, 0, 1, 0, 0, 0.4, 0, 0, 0, 0, 1, 0, 0, 0.4],
  hatClosed: [0.8, 0.5, 0.6, 0.5, 0.8, 0.5, 0.6, 0.5, 0.8, 0.5, 0.6, 0.5, 0.8, 0.5, 0.6, 0.5],
  hatOpen: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
};

export const OUTRUN: GenreConfig = {
  id: 'outrun',
  name: 'Outrun',
  naming: {
    patterns: [
      { w: 3, v: '{adj} {noun}' },
      { w: 2, v: 'NEON {noun}' },
      { w: 2, v: '{noun} {noun2}' },
      { w: 1, v: '{adj} {noun} 2087' },
    ],
    words: {
      adj: ['MIDNIGHT', 'CHROME', 'STELLAR', 'LASER', 'CRYSTAL', 'INFINITE', 'BINARY', 'PHANTOM', 'ELECTRIC'],
      noun: ['HORIZON', 'VELOCITY', 'STARFIELD', 'HIGHWAY', 'ORBIT', 'ECLIPSE', 'VECTOR', 'PULSAR', 'GRID', 'NEBULA'],
    },
  },
  bpm: [118, 132],
  timeSig: [4, 4],
  keys: [
    { w: 3, v: 9 }, // A
    { w: 2, v: 2 }, // D
    { w: 2, v: 4 }, // E
    { w: 1, v: 6 }, // F#
  ],
  modes: [
    { w: 3, v: 'naturalMinor' },
    { w: 1, v: 'dorian' }, // the hopeful night-drive tint
  ],
  swing: [0, 0],
  structures: [
    // The dynamics arc IS the level design: quiet valley sections between drops.
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
    {
      // One extended 16-bar cruise drop (single drop — loops break→intro).
      w: 1,
      v: [
        { name: 'intro', bars: 4 },
        { name: 'build', bars: 8 },
        { name: 'drop', bars: 16 },
        { name: 'break', bars: 8 },
      ],
    },
    {
      // Long neon valley between two drops.
      w: 1,
      v: [
        { name: 'intro', bars: 4 },
        { name: 'drop', bars: 8 },
        { name: 'break', bars: 12 },
        { name: 'build', bars: 4 },
        { name: 'drop', bars: 8 },
      ],
    },
  ],
  progressions: [
    // Minor spacesynth loops, one chord per bar, last chord pulls home.
    { w: 3, v: [{ degree: 0, beats: 4 }, { degree: 5, beats: 4 }, { degree: 2, beats: 4 }, { degree: 6, beats: 4 }] },
    { w: 2, v: [{ degree: 0, beats: 4 }, { degree: 6, beats: 4 }, { degree: 5, beats: 4 }, { degree: 6, beats: 4 }] },
    { w: 2, v: [{ degree: 0, beats: 4 }, { degree: 2, beats: 4 }, { degree: 5, beats: 4 }, { degree: 4, beats: 4 }] },
    { w: 1, v: [{ degree: 5, beats: 4 }, { degree: 6, beats: 4 }, { degree: 0, beats: 4 }, { degree: 0, beats: 4 }] },
    // More neon movement.
    { w: 2, v: [{ degree: 0, beats: 4 }, { degree: 5, beats: 4 }, { degree: 6, beats: 4 }, { degree: 4, beats: 4 }] }, // i–VI–VII–v
    { w: 1, v: [{ degree: 0, beats: 4 }, { degree: 4, beats: 4 }, { degree: 5, beats: 4 }, { degree: 2, beats: 4 }] }, // i–v–VI–III
    { w: 1, v: [{ degree: 0, beats: 4 }, { degree: 6, beats: 4 }, { degree: 3, beats: 4 }, { degree: 4, beats: 4 }] }, // i–VII–iv–v
    { w: 1, v: [{ degree: 5, beats: 4 }, { degree: 2, beats: 4 }, { degree: 0, beats: 4 }, { degree: 6, beats: 4 }] }, // VI–III–i–VII
  ],
  distinctProgressions: true,
  melody: {
    register: [64, 86],
    density: 0.55, // breathing room — collectable, not a note storm
    leapProb: 0.25,
    restProb: 0.12,
    syncopation: 0.4,
  },
  bass: {
    style: 'syncopated16',
    styles: [
      { w: 2, v: 'syncopated16' }, // sequenced spacesynth engine
      { w: 2, v: 'octave8' },
      { w: 1, v: 'synth8' }, // driving root-pump with octave pops
    ],
    register: [31, 45],
  },
  comping: { register: [52, 72], style: 'sustained' }, // analog pad bed
  // Backing arp, not a second melody — lower register + just up/octaves so it
  // doesn't wander through the lead's range and clash ("каконофония").
  arp: { register: [52, 74], rate: 4, patterns: [{ w: 2, v: 'up' }, { w: 1, v: 'octaves' }] },
  drums: {
    patterns: [
      { w: 3, v: OR_DRIVE },
      { w: 2, v: OR_PULSE },
      { w: 2, v: OR_ELECTRO },
      { w: 1, v: OR_RUSH },
    ],
    fillEvery: 8,
    fillStyle: 'toms', // the 80s tom cascade
  },
  instruments: {
    lead: { program: 81, name: 'Saw Lead' },
    chords: { program: 90, name: 'Space Pad' }, // GM Pad 3 (polysynth)
    arp: { program: 99, name: 'Crystal Arp' }, // GM FX 4 (atmosphere)... crystal shimmer
    bass: { program: 38, name: 'Seq Bass' },
    drums: { program: 0, name: 'Linn Kit' },
  },
  arrange: {
    // Energy per section = terrain height: valley (break) between two peaks (drop).
    layers: {
      intro: ['chords', 'arp'],
      build: ['chords', 'arp', 'bass', 'drums'],
      drop: 'all',
      break: ['chords', 'arp', 'bass'],
    },
    sectionVelocity: { intro: 0.8, build: 0.92, break: 0.82, drop: 1.05 },
  },
  // Zero timing jitter: note.start ticks ARE the beatmap. Velocity still breathes.
  humanize: { timingTicks: 0, velocity: 0.05 },
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
