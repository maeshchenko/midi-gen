import { PPQ, type NoteEvent } from '../types';
import type { GenreConfig, PartGenerator, StepPattern } from './types';
import type { Rng } from '../prng';
import { clampRegister, nextScalePitch } from '../gen/melody';
import { mod12 } from '../theory/scales';

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

const HALFTIME_BREAK: StepPattern = {
  name: 'halftime-break',
  kick: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  snare: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
  hatClosed: [0.9, 0, 0.5, 0, 0.9, 0, 0, 0, 0.9, 0, 0.5, 0, 0.9, 0, 0, 0],
  hatOpen: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0],
};

/* ------------------------------------------------------------------ */
/* Keygen lead: motif-based hook melody.                               */
/*                                                                     */
/* A one-bar motif (rhythm + chord-tone contour with da-da-da repeats  */
/* and one octave pop) is TRANSPOSED through the changing harmony      */
/* instead of re-walked — that chord-following phrase is the keygen    */
/* sound. Bars pair up call/response (the response resolves to the     */
/* root), 4-bar phrases may end in a 16th-note scale run, and octave   */
/* leaps occasionally slide (tracker 3xx, see NoteEvent.slide).        */
/* ------------------------------------------------------------------ */

const STEP = PPQ / 4; // 16th grid

interface MotifCell {
  step: number;
  durSteps: number;
  /** Chord-tone index (0 root, 1 third, 2 fifth). */
  ct: number;
  /** Diatonic neighbour colour. */
  shift: -1 | 0 | 1;
  oct: 0 | 1;
}

function buildMotif(rng: Rng, syncopation: number, restProb: number, stepsPerBar: number): MotifCell[] {
  const onsets: number[] = [0];
  for (let s = 1; s < stepsPerBar; s++) {
    const w = s % 4 === 0 ? 0.6 : s % 2 === 0 ? 0.42 : 0.32 * syncopation;
    if (rng.next() < w) onsets.push(s);
  }
  const cells: MotifCell[] = [];
  let prev: MotifCell | null = null;
  let usedOct = false;
  for (let i = 0; i < onsets.length; i++) {
    const step = onsets[i]!;
    let durSteps = (onsets[i + 1] ?? stepsPerBar) - step;
    if (rng.chance(restProb)) durSteps = Math.max(1, Math.ceil(durSteps / 2));
    let cell: MotifCell;
    if (prev && rng.chance(0.4)) {
      cell = { ...prev, step, durSteps }; // repeated-note hook
    } else {
      const oct = !usedOct && rng.chance(0.25) ? 1 : 0;
      if (oct) usedOct = true;
      cell = {
        step,
        durSteps,
        ct: rng.pick([0, 1, 2]),
        shift: rng.chance(0.18) ? (rng.chance(0.5) ? 1 : -1) : 0,
        oct: oct as 0 | 1,
      };
    }
    cells.push(cell);
    prev = cell;
  }
  return cells;
}

/** The answering bar: same rhythm and contour, but the ending resolves home. */
function makeResponse(call: MotifCell[]): MotifCell[] {
  const resp = call.map((c) => ({ ...c }));
  const last = resp[resp.length - 1];
  if (last) {
    last.ct = 0;
    last.shift = 0;
    last.oct = 0;
  }
  return resp;
}

/** Instance of pitch class nearest to `prev` within [lo, hi]. */
function nearestPc(pc: number, prev: number, lo: number, hi: number): number {
  let best = -1;
  for (let p = lo; p <= hi; p++) {
    if (mod12(p) === pc && (best < 0 || Math.abs(p - prev) < Math.abs(best - prev))) best = p;
  }
  return best < 0 ? prev : best;
}

const genKeygenLead: PartGenerator = (ctx) => {
  const inst = ctx.cfg.instruments.lead;
  if (!inst) return null;
  const rng = ctx.rng('melody');
  const { register, syncopation, restProb } = ctx.cfg.melody;
  const [lo, hi] = register;
  const tonic = ctx.key.tonic;
  const mode = ctx.cfg.melody.scale ?? ctx.key.mode;
  const stepsPerBar = Math.round(ctx.barTicks / STEP);
  const cache = new Map<string, NoteEvent[]>(); // section name → notes relative to section start
  const notes: NoteEvent[] = [];

  for (const section of ctx.sections) {
    const sectionStart = section.startBar * ctx.barTicks;
    const sectionEnd = sectionStart + section.bars * ctx.barTicks;

    const cached = cache.get(section.name);
    if (cached) {
      notes.push(...cached.map((n) => ({ ...n, start: n.start + sectionStart })));
      continue;
    }

    const call = buildMotif(rng, syncopation, restProb, stepsPerBar);
    const response = makeResponse(call);
    const anchor = { pitch: Math.round((lo + hi) / 2) };
    const sectionNotes: NoteEvent[] = [];

    for (let bar = 0; bar < section.bars; bar++) {
      const barStart = sectionStart + bar * ctx.barTicks;
      const motif = bar % 2 === 0 ? call : response;
      const lastOfPhrase = bar % 4 === 3 || bar === section.bars - 1;
      const useRun = lastOfPhrase && rng.chance(0.3);
      const cells = useRun ? motif.filter((m) => m.step < stepsPerBar - 6) : motif;

      for (const m of cells) {
        const tick = barStart + m.step * STEP;
        const chord = ctx.chordAt(tick);
        const pc = chord.pitchClasses[m.ct % chord.pitchClasses.length] ?? chord.root;
        let pitch = nearestPc(pc, anchor.pitch, lo, hi);
        if (m.shift !== 0) pitch = clampRegister(nextScalePitch(pitch, m.shift, tonic, mode), lo, hi);
        if (m.oct === 1 && pitch + 12 <= hi) pitch += 12;
        anchor.pitch = pitch;
        sectionNotes.push({
          pitch,
          start: tick,
          dur: Math.max(30, m.durSteps * STEP - 20),
          vel: m.step % 8 === 0 ? rng.int(96, 110) : rng.int(78, 94),
        });
      }

      if (useRun) {
        // 16th run into the next phrase, walking the scale toward its first chord.
        const runStart = stepsPerBar - 6;
        const target = nearestPc(ctx.chordAt(barStart + ctx.barTicks).root, anchor.pitch, lo, hi);
        const dir: 1 | -1 = target >= anchor.pitch ? 1 : -1;
        let p = anchor.pitch;
        for (let i = 0; i < 6; i++) {
          p = clampRegister(nextScalePitch(p, dir, tonic, mode), lo, hi);
          sectionNotes.push({
            pitch: p,
            start: barStart + (runStart + i) * STEP,
            dur: STEP - 15,
            vel: 72 + i * 5,
          });
        }
        anchor.pitch = p;
      }
    }

    // Cadence: the section's last note lands on the root or fifth and rings out.
    const last = sectionNotes[sectionNotes.length - 1];
    if (last) {
      const chord = ctx.chordAt(last.start);
      const targetPc = rng.chance(0.7) ? chord.root : (chord.pitchClasses[2] ?? chord.root);
      last.pitch = nearestPc(targetPc, last.pitch, lo, hi);
      last.dur = Math.max(last.dur, sectionEnd - last.start - 20);
      last.vel = 104;
    }

    // Tracker 3xx slides on big leaps: the previous (carrier) note is extended
    // to ring through the slide target so the audio layer can glide, no retrigger.
    for (let i = 1; i < sectionNotes.length; i++) {
      const n = sectionNotes[i]!;
      const prev = sectionNotes[i - 1]!;
      if (prev.start >= n.start || Math.abs(n.pitch - prev.pitch) < 7) continue;
      if (!rng.chance(0.35)) continue;
      let c = i - 1;
      while (c >= 0 && sectionNotes[c]!.slide) c--;
      const carrier = c >= 0 ? sectionNotes[c]! : null;
      if (!carrier || carrier.start >= n.start) continue;
      n.slide = true;
      carrier.dur = Math.max(carrier.dur, n.start + n.dur - carrier.start);
    }

    const clipped = sectionNotes.filter((n) => n.start < sectionEnd);
    for (const n of clipped) n.dur = Math.min(n.dur, sectionEnd - n.start);

    cache.set(section.name, clipped.map((n) => ({ ...n, start: n.start - sectionStart })));
    notes.push(...clipped);
  }

  return { name: inst.name, channel: 0, program: inst.program, role: 'lead', notes };
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
    {
      w: 1,
      v: [
        { name: 'intro', bars: 4 },
        { name: 'A', bars: 8 },
        { name: 'B', bars: 8 },
        { name: 'break', bars: 4 },
        { name: 'A', bars: 8 },
        { name: 'outro', bars: 2 },
      ],
    },
  ],
  progressions: [
    // Degrees are 0-based: in minor 0=i, 5=VI, 2=III, 6=VII, 4=v/V.
    { w: 3, v: [{ degree: 0, beats: 4 }, { degree: 5, beats: 4 }, { degree: 2, beats: 4 }, { degree: 6, beats: 4 }] },
    { w: 2, v: [{ degree: 0, beats: 4 }, { degree: 3, beats: 4 }, { degree: 5, beats: 4 }, { degree: 4, beats: 4 }] },
    { w: 2, v: [{ degree: 0, beats: 4 }, { degree: 6, beats: 4 }, { degree: 5, beats: 4 }, { degree: 6, beats: 4 }] },
    { w: 1, v: [{ degree: 0, beats: 8 }, { degree: 5, beats: 4 }, { degree: 4, beats: 4 }] },
    // Andalusian descent into a hard major V — the harmonic-minor cracktro cadence.
    { w: 2, v: [{ degree: 0, beats: 4 }, { degree: 6, beats: 4 }, { degree: 5, beats: 4 }, { degree: 4, beats: 4, quality: 'maj' }] },
    { w: 2, v: [{ degree: 0, beats: 4 }, { degree: 5, beats: 4 }, { degree: 6, beats: 4 }, { degree: 4, beats: 4, quality: 'maj' }] },
    // Hypnotic two-chord vamp.
    { w: 1, v: [{ degree: 0, beats: 8 }, { degree: 5, beats: 8 }] },
    // Fast harmonic rhythm: two beats per chord.
    { w: 2, v: [{ degree: 0, beats: 2 }, { degree: 0, beats: 2 }, { degree: 5, beats: 2 }, { degree: 6, beats: 2 }, { degree: 0, beats: 2 }, { degree: 2, beats: 2 }, { degree: 5, beats: 2 }, { degree: 6, beats: 2 }] },
    // Suspension release: Vsus4 → V major.
    { w: 1, v: [{ degree: 0, beats: 4 }, { degree: 5, beats: 4 }, { degree: 4, beats: 2, quality: 'sus4' }, { degree: 4, beats: 2, quality: 'maj' }] },
  ],
  distinctProgressions: true,
  melody: {
    register: [69, 93], // A4–A6
    density: 0.6,
    leapProb: 0.22,
    restProb: 0.12,
    syncopation: 0.45,
  },
  bass: {
    style: 'octave8',
    styles: [
      { w: 3, v: 'octave8' },
      { w: 2, v: 'syncopated16' },
      { w: 1, v: 'synth8' },
    ],
    register: [31, 55], // G1–G3: a full octave above every root, so octave8 always bounces
  },
  arp: {
    register: [57, 84],
    rate: 8, // 32nd-note tracker arps
    patterns: [
      { w: 3, v: 'up' },
      { w: 2, v: 'updown' },
      { w: 2, v: 'octaves' },
      { w: 1, v: 'down' },
      { w: 1, v: 'thumb' },
    ],
  },
  drums: {
    patterns: [
      { w: 2, v: FOUR_ON_FLOOR },
      { w: 1, v: DRIVING_8S },
      { w: 1, v: HALFTIME_BREAK },
    ],
    fillEvery: 8,
    fillStyle: 'rush',
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
      break: ['arp', 'bass'],
      outro: ['arp', 'bass', 'drums'],
    },
    sectionVelocity: { intro: 0.85, break: 0.8, outro: 0.9 },
  },
  humanize: { timingTicks: 3, velocity: 0.06 }, // machine-tight, it's a tracker
  filterAutomation: {
    // Cracktro staple: the arp fades in through an opening filter.
    target: 'arp',
    open: 4800,
    sections: {
      intro: { move: 'sweep', fromHz: 600 },
      outro: { move: 'closed', hz: 1400 }, // duck under before the loop seam
    },
  },
  hooks: {
    melody: genKeygenLead,
  },
};
