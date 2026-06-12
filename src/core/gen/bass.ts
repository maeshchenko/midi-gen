import { PPQ, type NoteEvent } from '../types';
import type { ChordSpan, GenContext, PartGenerator } from '../genres/types';
import { mod12 } from '../theory/scales';

/** Lowest pitch of the given pitch class inside [lo, hi]. */
function placeInRegister(pc: number, lo: number, hi: number): number {
  for (let p = lo; p <= hi; p++) {
    if (mod12(p) === pc) return p;
  }
  return lo;
}

/**
 * 'synth8' — driving eighth-note synth bass: root pumping with octave pops
 * and an approach note into the next chord. The keygen workhorse; other
 * styles (walking, boogie, 808…) land with their genres in phase 6.
 */
function synth8(ctx: GenContext): NoteEvent[] {
  const rng = ctx.rng('bass');
  const [lo, hi] = ctx.cfg.bass.register;
  const eighth = PPQ / 2;
  const notes: NoteEvent[] = [];

  for (let si = 0; si < ctx.chords.length; si++) {
    const span = ctx.chords[si]!;
    const next: ChordSpan | undefined = ctx.chords[si + 1];
    const root = placeInRegister(span.chord.root, lo, hi);
    const fifthPc = span.chord.pitchClasses[2] ?? span.chord.root;
    const count = Math.floor(span.dur / eighth);

    for (let i = 0; i < count; i++) {
      const start = span.start + i * eighth;
      let pitch = root;
      const isLast = i === count - 1;

      if (isLast && next && next.chord.root !== span.chord.root && rng.chance(0.55)) {
        // Chromatic approach into the next root from a semitone away.
        const target = placeInRegister(next.chord.root, lo, hi);
        pitch = target + (rng.chance(0.5) ? 1 : -1);
        if (pitch < lo) pitch = target + 1;
        if (pitch > hi) pitch = target - 1;
      } else if (i % 4 === 2 && rng.chance(0.55)) {
        pitch = root + 12 <= hi ? root + 12 : root;
      } else if (i % 4 === 3 && rng.chance(0.2)) {
        pitch = placeInRegister(fifthPc, lo, hi);
      }

      const onBeat = i % 2 === 0;
      notes.push({
        pitch,
        start,
        dur: eighth - 30,
        vel: (onBeat ? 100 : 84) + rng.int(-4, 4),
      });
    }
  }
  return notes;
}

export const genBass: PartGenerator = (ctx) => {
  const inst = ctx.cfg.instruments.bass;
  if (!inst) return null;

  let notes: NoteEvent[];
  switch (ctx.cfg.bass.style) {
    case 'synth8':
      notes = synth8(ctx);
      break;
    default:
      // Remaining styles arrive with their genres (phase 6).
      notes = synth8(ctx);
      break;
  }

  return { name: inst.name, channel: 0, program: inst.program, role: 'bass', notes };
};
