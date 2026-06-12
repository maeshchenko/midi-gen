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

/** Plain sustained chord pads — default 'chords' role for slower genres. */
export const genSustainedChords: PartGenerator = (ctx) => {
  const inst = ctx.cfg.instruments.chords;
  if (!inst) return null;
  const [lo] = ctx.cfg.comping?.register ?? [55, 75];
  const notes: NoteEvent[] = [];

  for (const span of ctx.chords) {
    for (const pitch of closeVoicing(span.chord, lo)) {
      notes.push({ pitch, start: span.start, dur: span.dur - 20, vel: 62 });
    }
  }

  return { name: inst.name, channel: 0, program: inst.program, role: 'chords', notes };
};
