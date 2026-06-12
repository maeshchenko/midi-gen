import { DRUM_CHANNEL, PPQ, type NoteEvent } from '../types';
import type { GenreConfig, PartGenerator, StepPattern, Weighted } from './types';
import { GM_DRUMS } from '../gen/drums';
import { mod12 } from '../theory/scales';

/**
 * Tune: a naive, super-catchy minor loop in the spirit of mizhgan.com's
 * page tune — one short arpeggio motif on straight eighths that repeats for
 * the whole song (retransposed through the harmony), sustained root bass,
 * offbeat hat ticks, zero humanization. Y2K chiptune innocence.
 */

const EIGHTH = PPQ / 2;
const SLOTS_PER_BAR = 8; // eighth-note grid, 4/4 only

/* ------------------------------------------------------------------ */
/* Lead: one ladder motif per song.                                    */
/*                                                                     */
/* The motif is a rise-and-fall walk up the chord arpeggio (root →     */
/* third → fifth → octave → back), one bar long, on a fixed eighth-    */
/* note rhythm. Every bar replays it over the current chord; odd bars  */
/* answer by resolving the last note to the root — exactly the shape   */
/* of the hardcoded mizhgan loop, but seeded.                          */
/* ------------------------------------------------------------------ */

/** Eighth-note onsets within one bar. */
const RHYTHMS: Weighted<number[]>[] = [
  { w: 3, v: [0, 1, 2, 3, 4, 5, 6, 7] },
  { w: 2, v: [0, 1, 2, 4, 5, 6] },
  { w: 2, v: [0, 2, 3, 4, 6, 7] },
  { w: 1, v: [0, 2, 4, 6] },
];

/** Lowest instance of the pitch class at or above `lo`. */
function rootAbove(pc: number, lo: number): number {
  for (let p = lo; p < lo + 12; p++) {
    if (mod12(p) === pc) return p;
  }
  return lo;
}

const genTuneLead: PartGenerator = (ctx) => {
  const inst = ctx.cfg.instruments.lead;
  if (!inst) return null;
  const rng = ctx.rng('melody');
  const [lo, hi] = ctx.cfg.melody.register;

  const onsets = rng.weighted(RHYTHMS);
  const n = onsets.length;
  const peakPos = rng.int(2, Math.min(4, n - 2));
  // Ladder of chord-tone indices: climb to the peak, then walk back down.
  const call: number[] = [];
  let v = 0;
  for (let i = 0; i < n; i++) {
    call.push(v);
    v += i < peakPos ? 1 : -1;
    if (v < 0) v = 0;
  }
  // The answering bar lands home on the root.
  const response = [...call];
  response[n - 1] = 0;

  const notes: NoteEvent[] = [];
  for (let bar = 0; bar < ctx.totalBars; bar++) {
    const barStart = bar * ctx.barTicks;
    const ladder = bar % 2 === 0 ? call : response;
    const chord = ctx.chordAt(barStart);
    const third = mod12(12 + (chord.pitchClasses[1] ?? chord.root) - chord.root);
    const fifth = mod12(12 + (chord.pitchClasses[2] ?? chord.root) - chord.root);
    const offsets = [0, third, fifth, 12, 12 + third, 12 + fifth];
    const base = rootAbove(chord.root, lo);

    for (let i = 0; i < n; i++) {
      const step = onsets[i]!;
      const nextStep = onsets[i + 1] ?? SLOTS_PER_BAR;
      let pitch = base + offsets[Math.min(ladder[i]!, offsets.length - 1)]!;
      while (pitch > hi) pitch -= 12;
      notes.push({
        pitch,
        start: barStart + step * EIGHTH,
        dur: Math.max(30, (nextStep - step) * EIGHTH - 25), // staccato, mizhgan's 0.9-step blips
        vel: step === 0 ? 104 : step % 2 === 0 ? 98 : 84,
      });
    }
  }

  return { name: inst.name, channel: 0, program: inst.program, role: 'lead', notes };
};

/* ------------------------------------------------------------------ */
/* Drums: pattern steps verbatim — no crashes, no fills, no ghosts.    */
/* ------------------------------------------------------------------ */

const OFFBEAT_HATS: StepPattern = {
  name: 'offbeat-hats',
  kick: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  snare: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  hatClosed: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
};

const KICK_AND_HATS: StepPattern = {
  name: 'kick-and-hats',
  kick: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  snare: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  hatClosed: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
};

const genTuneDrums: PartGenerator = (ctx) => {
  const inst = ctx.cfg.instruments.drums;
  if (!inst) return null;
  const rng = ctx.rng('drums');
  const pattern = rng.weighted(ctx.cfg.drums.patterns);
  const stepTicks = ctx.barTicks / 16;
  const notes: NoteEvent[] = [];

  for (let bar = 0; bar < ctx.totalBars; bar++) {
    const barStart = bar * ctx.barTicks;
    for (let s = 0; s < 16; s++) {
      if ((pattern.kick[s] ?? 0) > 0) {
        notes.push({ pitch: GM_DRUMS.kick, start: barStart + s * stepTicks, dur: 60, vel: 102 });
      }
      if ((pattern.hatClosed[s] ?? 0) > 0) {
        notes.push({ pitch: GM_DRUMS.hatClosed, start: barStart + s * stepTicks, dur: 30, vel: 46 });
      }
    }
  }

  return { name: inst.name, channel: DRUM_CHANNEL, program: inst.program, role: 'drums', notes };
};

export const TUNE: GenreConfig = {
  id: 'tune',
  hidden: true, // internal — out of listGenres() and docs by user request
  name: 'Tune',
  bpm: [138, 152],
  timeSig: [4, 4],
  keys: [
    { w: 4, v: 9 }, // A — the mizhgan key
    { w: 2, v: 4 }, // E
    { w: 1, v: 2 }, // D
    { w: 1, v: 7 }, // G
  ],
  modes: [{ w: 1, v: 'naturalMinor' }],
  swing: [0, 0],
  structures: [
    {
      w: 2,
      v: [
        { name: 'A', bars: 8 },
        { name: 'A', bars: 8 },
        { name: 'A', bars: 8 },
        { name: 'A', bars: 8 },
      ],
    },
    {
      w: 1,
      v: [
        { name: 'A', bars: 8 },
        { name: 'A', bars: 8 },
        { name: 'A', bars: 8 },
      ],
    },
  ],
  progressions: [
    // One chord per bar, looping — degrees 0-based in minor.
    { w: 3, v: [{ degree: 0, beats: 4 }, { degree: 5, beats: 4 }, { degree: 2, beats: 4 }, { degree: 4, beats: 4 }] }, // i–VI–III–v (Am–F–C–Em: the mizhgan bass line)
    { w: 2, v: [{ degree: 0, beats: 4 }, { degree: 5, beats: 4 }, { degree: 2, beats: 4 }, { degree: 6, beats: 4 }] }, // i–VI–III–VII
    { w: 1, v: [{ degree: 0, beats: 4 }, { degree: 6, beats: 4 }, { degree: 5, beats: 4 }, { degree: 4, beats: 4 }] }, // i–VII–VI–v
  ],
  melody: {
    register: [62, 86], // D4–D6, mizhgan's F4–A5 sits in the middle
    density: 0.9, // nominal — the hook uses its own rhythm templates
    leapProb: 0.2,
    restProb: 0,
    syncopation: 0,
  },
  bass: {
    style: 'sustain', // long roots on the chord changes, nothing else
    register: [33, 50], // A1–D3
  },
  drums: {
    patterns: [
      { w: 1, v: OFFBEAT_HATS },
      { w: 1, v: KICK_AND_HATS },
    ],
    fillEvery: 8, // unused — the drums hook plays the pattern verbatim, no fills
  },
  instruments: {
    lead: { program: 80, name: 'Square Lead' },
    bass: { program: 38, name: 'Synth Bass' },
    drums: { program: 0, name: 'Hats' },
  },
  arrange: {
    layers: {}, // everyone plays all the time — it's a loop, not a song
  },
  humanize: { timingTicks: 0, velocity: 0.02 }, // machine grid, like the original setInterval
  hooks: {
    melody: genTuneLead,
    drums: genTuneDrums,
  },
};
