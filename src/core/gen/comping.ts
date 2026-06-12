import { PPQ, type NoteEvent } from '../types';
import type { PartGenerator } from '../genres/types';
import { closeVoicing } from '../theory/chords';

/**
 * Tracker-style arpeggio: a chord faked by one fast voice cycling its tones —
 * the defining sound of keygen/chiptune music. Rate 8 = 32nd notes.
 */
export const genTrackerArp: PartGenerator = (ctx) => {
  const inst = ctx.cfg.instruments.arp;
  const arpCfg = ctx.cfg.arp;
  if (!inst || !arpCfg) return null;

  const [lo, hi] = arpCfg.register;
  const stepTicks = PPQ / arpCfg.rate;
  const notes: NoteEvent[] = [];

  for (const span of ctx.chords) {
    const voicing = closeVoicing(span.chord, lo);
    const seq = [...voicing, voicing[0]! + 12].filter((p) => p <= hi);
    if (seq.length === 0) continue;
    const count = Math.floor(span.dur / stepTicks);
    for (let i = 0; i < count; i++) {
      notes.push({
        pitch: seq[i % seq.length]!,
        start: span.start + i * stepTicks,
        dur: stepTicks,
        vel: i % seq.length === 0 ? 80 : 64,
      });
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
