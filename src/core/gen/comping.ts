import { PPQ, type NoteEvent } from '../types';
import type { ArpPattern, PartGenerator } from '../genres/types';
import { closeVoicing } from '../theory/chords';

/** Expand a chord voicing into one cycle of the given tracker arp shape. */
function arpCycle(pattern: ArpPattern, voicing: number[], hi: number): number[] {
  const up = [...voicing, voicing[0]! + 12].filter((p) => p <= hi);
  switch (pattern) {
    case 'down':
      return [...up].reverse();
    case 'updown':
      return up.length > 2 ? [...up, ...up.slice(1, -1).reverse()] : up;
    case 'octaves': {
      const out: number[] = [];
      for (const p of voicing) {
        out.push(p);
        if (p + 12 <= hi) out.push(p + 12);
      }
      return out;
    }
    case 'thumb': {
      const root = voicing[0]!;
      const out: number[] = [];
      for (const p of up.slice(1)) {
        out.push(root, p);
      }
      return out.length > 0 ? out : up;
    }
    default:
      return up;
  }
}

/**
 * Tracker-style arpeggio: a chord faked by one fast voice cycling its tones —
 * the defining sound of keygen/chiptune music. Rate 8 = 32nd notes.
 * With `arp.patterns` set, each section name draws its own cycle shape and
 * gets cycle/beat velocity accents; otherwise the legacy plain 'up' cycle.
 */
export const genTrackerArp: PartGenerator = (ctx) => {
  const inst = ctx.cfg.instruments.arp;
  const arpCfg = ctx.cfg.arp;
  if (!inst || !arpCfg) return null;

  const [lo, hi] = arpCfg.register;
  const stepTicks = PPQ / arpCfg.rate;
  const notes: NoteEvent[] = [];

  // Pattern per section name — same memoization idea as harmony templates.
  // No RNG is touched without the config field, so other genres are untouched.
  const patternByName = new Map<string, ArpPattern>();
  const patternFor = (name: string): ArpPattern => {
    if (!arpCfg.patterns) return 'up';
    let p = patternByName.get(name);
    if (!p) {
      p = ctx.rng('comping').weighted(arpCfg.patterns);
      patternByName.set(name, p);
    }
    return p;
  };
  const accented = !!arpCfg.patterns;

  for (const section of ctx.sections) {
    const s0 = section.startBar * ctx.barTicks;
    const s1 = s0 + section.bars * ctx.barTicks;
    const pattern = patternFor(section.name);

    for (const span of ctx.chords) {
      if (span.start < s0 || span.start >= s1) continue;
      const voicing = closeVoicing(span.chord, lo);
      const seq = arpCycle(pattern, voicing, hi);
      if (seq.length === 0) continue;
      const count = Math.floor(span.dur / stepTicks);
      for (let i = 0; i < count; i++) {
        const cycleStart = i % seq.length === 0;
        const beatStart = (i * stepTicks) % PPQ === 0;
        notes.push({
          pitch: seq[i % seq.length]!,
          start: span.start + i * stepTicks,
          dur: stepTicks,
          vel: accented ? (cycleStart ? 84 : beatStart ? 74 : 62) : cycleStart ? 80 : 64,
        });
      }
    }
  }

  return { name: inst.name, channel: 0, program: inst.program, role: 'arp', notes };
};

/**
 * 'chords' role, three textures:
 *  - sustained (default): whole-span pads,
 *  - stabs: short voicings on every beat (brass section),
 *  - alberti: broken-chord eighths low–high–mid–high (classical keyboard).
 */
export const genSustainedChords: PartGenerator = (ctx) => {
  const inst = ctx.cfg.instruments.chords;
  if (!inst) return null;
  const [lo] = ctx.cfg.comping?.register ?? [55, 75];
  const style = ctx.cfg.comping?.style ?? 'sustained';
  const rng = ctx.rng('comping');
  const notes: NoteEvent[] = [];

  for (const span of ctx.chords) {
    const voicing = closeVoicing(span.chord, lo);

    if (style === 'stabs') {
      const beats = Math.floor(span.dur / ctx.beatTicks);
      for (let b = 0; b < beats; b++) {
        const start = span.start + b * ctx.beatTicks;
        const accent = (start / ctx.barTicks) % 1 === 0;
        for (const pitch of voicing) {
          notes.push({
            pitch,
            start,
            dur: Math.floor(ctx.beatTicks * 0.4),
            vel: (accent ? 84 : 70) + rng.int(-4, 4),
          });
        }
      }
    } else if (style === 'alberti') {
      const eighth = PPQ / 2;
      const low = voicing[0]!;
      const mid = voicing[1] ?? low;
      const high = voicing[2] ?? mid;
      const seq = [low, high, mid, high];
      const count = Math.floor(span.dur / eighth);
      for (let i = 0; i < count; i++) {
        notes.push({
          pitch: seq[i % 4]!,
          start: span.start + i * eighth,
          dur: eighth - 20,
          vel: (i % 4 === 0 ? 74 : 62) + rng.int(-4, 4),
        });
      }
    } else {
      for (const pitch of voicing) {
        notes.push({ pitch, start: span.start, dur: span.dur - 20, vel: 62 });
      }
    }
  }

  return { name: inst.name, channel: 0, program: inst.program, role: 'chords', notes };
};
