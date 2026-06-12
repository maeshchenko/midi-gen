import { DRUM_CHANNEL, type NoteEvent } from '../types';
import type { PartGenerator, StepPattern } from '../genres/types';

export const GM_DRUMS = {
  kick: 36,
  snare: 38,
  hatClosed: 42,
  hatOpen: 46,
  crash: 49,
  ride: 51,
  tambourine: 54,
  clap: 39,
  shaker: 70,
  tomLow: 45,
  tomMid: 47,
  tomHigh: 50,
  cowbell: 56,
} as const;

const STEPS_PER_BAR = 16;

function laneNotes(
  pattern: StepPattern,
  lane: keyof typeof GM_DRUMS & ('kick' | 'snare' | 'hatClosed' | 'hatOpen'),
  barStart: number,
  stepTicks: number,
  skipFrom: number,
  rng: { chance(p: number): boolean; int(a: number, b: number): number },
  skipSteps?: Set<number>,
): NoteEvent[] {
  const accents = pattern[lane];
  if (!accents) return [];
  const notes: NoteEvent[] = [];
  for (let s = 0; s < STEPS_PER_BAR; s++) {
    if (s >= skipFrom) break;
    if (skipSteps?.has(s)) continue;
    const accent = accents[s] ?? 0;
    if (accent <= 0) continue;
    // Main hits (accent 1) are sacred; weaker ones occasionally drop out.
    if (accent < 1 && rng.chance(0.08)) continue;
    // Open hat replaces closed hat on the same step.
    if (lane === 'hatClosed' && pattern.hatOpen && (pattern.hatOpen[s] ?? 0) > 0) continue;
    notes.push({
      pitch: GM_DRUMS[lane],
      start: barStart + s * stepTicks,
      dur: Math.max(30, Math.floor(stepTicks / 2)),
      vel: Math.min(127, Math.round(45 + accent * 70) + rng.int(-4, 4)),
    });
  }
  return notes;
}

export const genDrums: PartGenerator = (ctx) => {
  const inst = ctx.cfg.instruments.drums;
  if (!inst) return null;
  const rng = ctx.rng('drums');
  const stepTicks = ctx.barTicks / STEPS_PER_BAR;
  const patternByName = new Map<string, StepPattern>();
  const notes: NoteEvent[] = [];

  for (const section of ctx.sections) {
    let pattern = patternByName.get(section.name);
    if (!pattern) {
      pattern = rng.weighted(ctx.cfg.drums.patterns);
      patternByName.set(section.name, pattern);
    }

    // Crash marks every section start.
    notes.push({
      pitch: GM_DRUMS.crash,
      start: section.startBar * ctx.barTicks,
      dur: ctx.beatTicks,
      vel: 100,
    });

    for (let bar = 0; bar < section.bars; bar++) {
      const barStart = (section.startBar + bar) * ctx.barTicks;
      const isFillBar =
        (bar + 1) % ctx.cfg.drums.fillEvery === 0 || bar === section.bars - 1;
      const skipFrom = isFillBar ? 12 : STEPS_PER_BAR;

      // Trap/phonk hat rolls: a 1/32 burst REPLACING two 16th steps — the
      // pattern's own hat hits on those steps are suppressed, otherwise the
      // mono hat synth gets two events at the same instant.
      const rollSteps = new Set<number>();
      if (ctx.cfg.drums.rollProb && !isFillBar && rng.chance(ctx.cfg.drums.rollProb)) {
        const rollStep = rng.int(2, 13);
        rollSteps.add(rollStep);
        rollSteps.add(rollStep + 1);
        const t32 = stepTicks / 2;
        for (let i = 0; i < 4; i++) {
          notes.push({
            pitch: GM_DRUMS.hatClosed,
            start: barStart + rollStep * stepTicks + i * t32,
            dur: 25,
            vel: 48 + i * 9,
          });
        }
      }

      notes.push(
        ...laneNotes(pattern, 'kick', barStart, stepTicks, skipFrom, rng),
        ...laneNotes(pattern, 'snare', barStart, stepTicks, skipFrom, rng),
        ...laneNotes(pattern, 'hatClosed', barStart, stepTicks, skipFrom, rng, rollSteps),
        ...laneNotes(pattern, 'hatOpen', barStart, stepTicks, skipFrom, rng, rollSteps),
      );

      // Ghost snare flavour on a weak 16th.
      if (!isFillBar && rng.chance(0.07)) {
        notes.push({
          pitch: GM_DRUMS.snare,
          start: barStart + (rng.chance(0.5) ? 7 : 15) * stepTicks,
          dur: 30,
          vel: rng.int(20, 32),
        });
      }

      if (isFillBar) {
        const useToms = rng.chance(0.4);
        const fillPitches = useToms
          ? [GM_DRUMS.tomHigh, GM_DRUMS.tomMid, GM_DRUMS.tomLow, GM_DRUMS.snare]
          : [GM_DRUMS.snare, GM_DRUMS.snare, GM_DRUMS.snare, GM_DRUMS.snare];
        for (let i = 0; i < 4; i++) {
          notes.push({
            pitch: fillPitches[i]!,
            start: barStart + (12 + i) * stepTicks,
            dur: Math.max(30, Math.floor(stepTicks / 2)),
            vel: 70 + i * 13,
          });
        }
      }
    }
  }

  return {
    name: inst.name,
    channel: DRUM_CHANNEL,
    program: inst.program,
    role: 'drums',
    notes,
  };
};
