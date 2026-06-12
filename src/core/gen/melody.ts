import { PPQ, type NoteEvent } from '../types';
import type { GenContext, PartGenerator } from '../genres/types';
import type { Rng } from '../prng';
import type { Chord } from '../theory/chords';
import type { Mode } from '../types';
import { inScale, mod12 } from '../theory/scales';

const STEP = PPQ / 4; // 16th-note grid
const UNIT_BARS = 2; // motif length

interface RhythmEvent {
  step: number;
  durSteps: number;
}

/**
 * Motif rhythm on a 16th grid (any meter — stepsPerBar derives from the bar).
 * Onset probability is highest on strong beats and scales with density;
 * off-16th positions only fire via syncopation.
 */
function buildRhythm(rng: Rng, cfg: GenContext['cfg']['melody'], stepsPerBar: number): RhythmEvent[] {
  const steps = UNIT_BARS * stepsPerBar;
  const half = stepsPerBar / 2;
  const onsets: number[] = [];
  for (let s = 0; s < steps; s++) {
    const inBar = s % stepsPerBar;
    let w: number;
    if (inBar === 0) w = 1;
    else if (inBar === half) w = 0.85;
    else if (inBar % 4 === 0) w = 0.7;
    else if (inBar % 2 === 0) w = 0.5;
    else w = 0.4 * cfg.syncopation;
    if (s === 0 || rng.next() < w * cfg.density) onsets.push(s);
  }
  return onsets.map((s, i) => {
    const next = onsets[i + 1] ?? steps;
    let durSteps = Math.min(next - s, 8);
    if (rng.chance(cfg.restProb)) durSteps = Math.max(1, Math.ceil(durSteps / 2));
    return { step: s, durSteps };
  });
}

export function nextScalePitch(p: number, dir: 1 | -1, tonic: number, mode: Mode): number {
  let q = p + dir;
  while (!inScale(q, tonic, mode)) q += dir;
  return q;
}

export function nearestChordTone(p: number, chord: Chord): number {
  for (let d = 0; d < 12; d++) {
    if (chord.pitchClasses.includes(mod12(p - d))) return p - d;
    if (chord.pitchClasses.includes(mod12(p + d))) return p + d;
  }
  return p;
}

export function clampRegister(p: number, lo: number, hi: number): number {
  while (p > hi) p -= 12;
  while (p < lo) p += 12;
  return p;
}

/** Pitch walk over a rhythm: chord tones on strong beats, steps between, leap recovery. */
function assignPitches(
  rng: Rng,
  ctx: GenContext,
  rhythm: RhythmEvent[],
  unitStartTick: number,
  stepsPerBar: number,
  state: { pitch: number; leapDir: 0 | 1 | -1 },
): NoteEvent[] {
  const { register, leapProb } = ctx.cfg.melody;
  const [lo, hi] = register;
  const center = (lo + hi) / 2;
  const tonic = ctx.key.tonic;
  const mode = ctx.cfg.melody.scale ?? ctx.key.mode;
  const strongEvery = Math.max(2, stepsPerBar / 2);
  const notes: NoteEvent[] = [];

  for (const ev of rhythm) {
    const tick = unitStartTick + ev.step * STEP;
    const chord = ctx.chordAt(tick);
    const strong = ev.step % strongEvery === 0;

    if (strong) {
      state.pitch = clampRegister(nearestChordTone(state.pitch, chord), lo, hi);
      state.leapDir = 0;
    } else if (state.leapDir !== 0) {
      // Recover from a leap by stepping back the opposite way.
      state.pitch = clampRegister(
        nextScalePitch(state.pitch, state.leapDir === 1 ? -1 : 1, tonic, mode),
        lo,
        hi,
      );
      state.leapDir = 0;
    } else if (rng.chance(leapProb)) {
      const candidates: number[] = [];
      for (let p = Math.max(lo, state.pitch - 12); p <= Math.min(hi, state.pitch + 12); p++) {
        if (chord.pitchClasses.includes(mod12(p)) && Math.abs(p - state.pitch) >= 3) {
          candidates.push(p);
        }
      }
      if (candidates.length > 0) {
        const target = rng.pick(candidates);
        state.leapDir = target > state.pitch ? 1 : -1;
        if (Math.abs(target - state.pitch) < 5) state.leapDir = 0;
        state.pitch = target;
      }
    } else {
      // Stepwise, biased back toward the register center.
      const towardCenter: 1 | -1 = state.pitch > center ? -1 : 1;
      const dir: 1 | -1 = rng.chance(0.65) ? towardCenter : ((-towardCenter) as 1 | -1);
      state.pitch = clampRegister(nextScalePitch(state.pitch, dir, tonic, mode), lo, hi);
    }

    notes.push({
      pitch: state.pitch,
      start: tick,
      dur: Math.max(30, ev.durSteps * STEP - 20),
      vel: (strong ? rng.int(96, 110) : rng.int(78, 96)) | 0,
    });
  }
  return notes;
}

/**
 * Phrase plan per section: 2-bar units following A A B A — unit A repeats its
 * RHYTHM (motif identity) while pitches re-walk the actual harmony; unit B is
 * a fresh contrasting motif; the section's last unit cadences onto the chord.
 */
export const genMelody: PartGenerator = (ctx) => {
  const inst = ctx.cfg.instruments.lead;
  if (!inst) return null;
  const rng = ctx.rng('melody');
  const stepsPerBar = Math.round(ctx.barTicks / STEP);
  const unitTicks = UNIT_BARS * ctx.barTicks;
  const cache = new Map<string, NoteEvent[]>(); // section name → notes relative to section start
  const notes: NoteEvent[] = [];

  for (const section of ctx.sections) {
    const sectionStart = section.startBar * ctx.barTicks;
    const sectionTicks = section.bars * ctx.barTicks;

    const cached = cache.get(section.name);
    if (cached) {
      notes.push(...cached.map((n) => ({ ...n, start: n.start + sectionStart })));
      continue;
    }

    const rhythmA = buildRhythm(rng, ctx.cfg.melody, stepsPerBar);
    const rhythmB = buildRhythm(rng, ctx.cfg.melody, stepsPerBar);
    const units = Math.ceil(section.bars / UNIT_BARS);
    const state = { pitch: Math.round((ctx.cfg.melody.register[0] + ctx.cfg.melody.register[1]) / 2), leapDir: 0 as 0 | 1 | -1 };
    const sectionNotes: NoteEvent[] = [];

    for (let u = 0; u < units; u++) {
      const unitStart = sectionStart + u * unitTicks;
      const rhythm = u % 4 === 2 ? rhythmB : rhythmA;
      const unitNotes = assignPitches(rng, ctx, rhythm, unitStart, stepsPerBar, state);

      if (u === units - 1 && unitNotes.length > 0) {
        // Cadence: last note lands on the chord's root or fifth and rings out.
        const last = unitNotes[unitNotes.length - 1]!;
        const chord = ctx.chordAt(last.start);
        const targetPc = rng.chance(0.7) ? chord.root : (chord.pitchClasses[2] ?? chord.root);
        let p = last.pitch;
        for (let d = 0; d < 12; d++) {
          if (mod12(p - d) === targetPc) { p = p - d; break; }
          if (mod12(p + d) === targetPc) { p = p + d; break; }
        }
        last.pitch = clampRegister(p, ctx.cfg.melody.register[0], ctx.cfg.melody.register[1]);
        last.dur = Math.max(last.dur, sectionStart + sectionTicks - last.start - 20);
        last.vel = 104;
      }
      sectionNotes.push(...unitNotes);
    }

    // Clip events that spill past the section (odd-length sections).
    const clipped = sectionNotes.filter((n) => n.start < sectionStart + sectionTicks);
    for (const n of clipped) {
      n.dur = Math.min(n.dur, sectionStart + sectionTicks - n.start);
    }

    cache.set(section.name, clipped.map((n) => ({ ...n, start: n.start - sectionStart })));
    notes.push(...clipped);
  }

  return { name: inst.name, channel: 0, program: inst.program, role: 'lead', notes };
};
