import { PPQ, type NoteEvent } from '../types';
import type { GenreConfig, PartGenerator, StepPattern } from './types';
import type { Rng } from '../prng';
import { mod12 } from '../theory/scales';
import { nextScalePitch, clampRegister } from '../gen/melody';

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

/* ------------------------------------------------------------------ */
/* Cowbell lead: a 2-bar hypnotic ostinato — Memphis loops repeat, they */
/* don't wander. Heavy note repeats, octave DROPS (the cowbell move),   */
/* every other repeat ends short (breathing room), pitches re-anchor    */
/* to the vamp's chords.                                                */
/* ------------------------------------------------------------------ */

const STEP = PPQ / 4; // 16th grid
const UNIT_BARS = 2;

interface OstCell {
  step: number;
  durSteps: number;
  /** Chord-tone index, root-heavy. */
  ct: number;
  shift: -1 | 0 | 1;
  /** Octave drop — the cowbell signature. */
  drop: boolean;
}

function buildOstinato(rng: Rng, stepsPerBar: number): OstCell[] {
  const total = UNIT_BARS * stepsPerBar;
  const onsets: number[] = [0];
  for (let s = 1; s < total; s++) {
    const inBar = s % stepsPerBar;
    const w = inBar === 0 ? 0.5 : inBar % 4 === 0 ? 0.35 : inBar % 2 === 0 ? 0.26 : 0.3;
    if (rng.next() < w) onsets.push(s);
  }
  const cells: OstCell[] = [];
  let prev: OstCell | null = null;
  for (let i = 0; i < onsets.length; i++) {
    const step = onsets[i]!;
    let durSteps = (onsets[i + 1] ?? total) - step;
    if (rng.chance(0.3)) durSteps = Math.max(1, Math.ceil(durSteps / 2)); // staccato space
    let cell: OstCell;
    if (prev && rng.chance(0.55)) {
      cell = { ...prev, step, durSteps }; // hypnotic repeat
    } else {
      cell = {
        step,
        durSteps,
        ct: rng.pick([0, 0, 1, 2]),
        shift: rng.chance(0.12) ? (rng.chance(0.5) ? 1 : -1) : 0,
        drop: rng.chance(0.18),
      };
    }
    cells.push(cell);
    prev = cell;
  }
  return cells;
}

/** Instance of pitch class nearest to `prev` within [lo, hi]. */
function nearestPc(pc: number, prev: number, lo: number, hi: number): number {
  let best = -1;
  for (let p = lo; p <= hi; p++) {
    if (mod12(p) === pc && (best < 0 || Math.abs(p - prev) < Math.abs(best - prev))) best = p;
  }
  return best < 0 ? prev : best;
}

const genGrimeLead: PartGenerator = (ctx) => {
  const inst = ctx.cfg.instruments.lead;
  if (!inst) return null;
  const rng = ctx.rng('melody');
  const [lo, hi] = ctx.cfg.melody.register;
  const tonic = ctx.key.tonic;
  const mode = ctx.key.mode;
  const stepsPerBar = Math.round(ctx.barTicks / STEP);
  const unitTicks = UNIT_BARS * ctx.barTicks;
  const cache = new Map<string, NoteEvent[]>();
  const notes: NoteEvent[] = [];

  for (const section of ctx.sections) {
    const sectionStart = section.startBar * ctx.barTicks;
    const sectionEnd = sectionStart + section.bars * ctx.barTicks;

    const cached = cache.get(section.name);
    if (cached) {
      notes.push(...cached.map((n) => ({ ...n, start: n.start + sectionStart })));
      continue;
    }

    const base = buildOstinato(rng, stepsPerBar);
    // Every other pass ends early — the loop breathes instead of droning.
    const varied = base.length > 2 ? base.slice(0, base.length - 1) : base;
    const anchor = { pitch: Math.round((lo + hi) / 2) };
    const units = Math.ceil(section.bars / UNIT_BARS);
    const sectionNotes: NoteEvent[] = [];

    for (let u = 0; u < units; u++) {
      const unitStart = sectionStart + u * unitTicks;
      const cells = u % 2 === 1 ? varied : base;
      for (const m of cells) {
        const tick = unitStart + m.step * STEP;
        if (tick >= sectionEnd) break;
        const chord = ctx.chordAt(tick);
        const pc = chord.pitchClasses[m.ct % chord.pitchClasses.length] ?? chord.root;
        let pitch = nearestPc(pc, anchor.pitch, lo, hi);
        if (m.shift !== 0) pitch = clampRegister(nextScalePitch(pitch, m.shift, tonic, mode), lo, hi);
        if (m.drop && pitch - 12 >= lo) pitch -= 12;
        anchor.pitch = pitch;
        sectionNotes.push({
          pitch,
          start: tick,
          dur: Math.max(30, m.durSteps * STEP - 30),
          vel: m.step % 8 === 0 ? rng.int(92, 106) : rng.int(72, 88),
        });
      }
    }

    // Section close: settle on the root, let it ring a half bar.
    const last = sectionNotes[sectionNotes.length - 1];
    if (last) {
      last.pitch = nearestPc(ctx.chordAt(last.start).root, last.pitch, lo, hi);
      last.dur = Math.max(last.dur, Math.min(sectionEnd - last.start - 20, ctx.barTicks / 2));
      last.vel = 100;
    }

    const clipped = sectionNotes.filter((n) => n.start < sectionEnd);
    for (const n of clipped) n.dur = Math.min(n.dur, sectionEnd - n.start);

    cache.set(section.name, clipped.map((n) => ({ ...n, start: n.start - sectionStart })));
    notes.push(...clipped);
  }

  return { name: inst.name, channel: 0, program: inst.program, role: 'lead', notes };
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
    {
      w: 1,
      v: [
        { name: 'intro', bars: 4 },
        { name: 'A', bars: 8 },
        { name: 'B', bars: 8 },
        { name: 'strip', bars: 4 },
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
    // Bar-rate rocking — twice the menace of the 8-beat vamps.
    { w: 2, v: [{ degree: 0, beats: 4 }, { degree: 1, beats: 4 }] },
    { w: 2, v: [{ degree: 0, beats: 4 }, { degree: 3, beats: 4 }, { degree: 0, beats: 4 }, { degree: 5, beats: 4 }] },
    // Open sus2 drone colour over the pad.
    { w: 1, v: [{ degree: 0, beats: 8, quality: 'sus2' }, { degree: 5, beats: 8 }] },
  ],
  distinctProgressions: true,
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
    fillStyle: 'mixed', // snare rushes half the time — trap, not rock toms
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
      strip: ['bass', 'drums'], // the trap breakdown: sub + kit only
    },
    sectionVelocity: { intro: 0.9, strip: 0.95 },
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
  hooks: {
    melody: genGrimeLead,
  },
};
