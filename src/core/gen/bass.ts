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

/** Instance of pitch class nearest to `prev` within [lo, hi] — voice leading. */
function nearestInRegister(pc: number, prev: number, lo: number, hi: number): number {
  let best = placeInRegister(pc, lo, hi);
  for (let p = lo; p <= hi; p++) {
    if (mod12(p) === pc && Math.abs(p - prev) < Math.abs(best - prev)) best = p;
  }
  return best;
}

/**
 * 'synth8' — driving eighth-note synth bass: root pumping with octave pops
 * and an approach note into the next chord. The keygen workhorse.
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

/**
 * 'octave8' — THE keygen bass: a strict root/root+12 see-saw on every eighth,
 * with the synth8 chromatic approach into the next chord.
 */
function octave8(ctx: GenContext): NoteEvent[] {
  const rng = ctx.rng('bass');
  const [lo, hi] = ctx.cfg.bass.register;
  const eighth = PPQ / 2;
  const notes: NoteEvent[] = [];

  for (let si = 0; si < ctx.chords.length; si++) {
    const span = ctx.chords[si]!;
    const next: ChordSpan | undefined = ctx.chords[si + 1];
    const root = placeInRegister(span.chord.root, lo, hi);
    const high = root + 12 <= hi ? root + 12 : root;
    const count = Math.floor(span.dur / eighth);

    for (let i = 0; i < count; i++) {
      let pitch = i % 2 === 0 ? root : high;
      const isLast = i === count - 1;
      if (isLast && next && next.chord.root !== span.chord.root && rng.chance(0.55)) {
        const target = placeInRegister(next.chord.root, lo, hi);
        pitch = target + (rng.chance(0.5) ? 1 : -1);
        if (pitch < lo) pitch = target + 1;
        if (pitch > hi) pitch = target - 1;
      }
      notes.push({
        pitch,
        start: span.start + i * eighth,
        dur: eighth - 30,
        vel: (i % 2 === 0 ? 102 : 88) + rng.int(-4, 4),
      });
    }
  }
  return notes;
}

/**
 * 'syncopated16' — late-Amiga drive: a 3-3-2 sixteenth mask repeated per
 * half-bar, octave pops on the syncopated hits.
 */
function syncopated16(ctx: GenContext): NoteEvent[] {
  const rng = ctx.rng('bass');
  const [lo, hi] = ctx.cfg.bass.register;
  const s16 = PPQ / 4;
  const mask = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0];
  const notes: NoteEvent[] = [];

  for (let si = 0; si < ctx.chords.length; si++) {
    const span = ctx.chords[si]!;
    const next: ChordSpan | undefined = ctx.chords[si + 1];
    const root = placeInRegister(span.chord.root, lo, hi);
    const high = root + 12 <= hi ? root + 12 : root;
    const steps = Math.floor(span.dur / s16);

    let lastHit = -1;
    for (let s = steps - 1; s >= 0; s--) {
      if (!mask[s % 16]) continue;
      if (lastHit < 0) lastHit = s;
    }
    for (let s = 0; s < steps; s++) {
      if (!mask[s % 16]) continue;
      let nextHit = s + 1;
      while (nextHit < steps && !mask[nextHit % 16]) nextHit++;

      const downbeat = s % 8 === 0;
      let pitch = !downbeat && rng.chance(0.45) ? high : root;
      if (s === lastHit && next && next.chord.root !== span.chord.root && rng.chance(0.5)) {
        const target = placeInRegister(next.chord.root, lo, hi);
        pitch = target + (rng.chance(0.5) ? 1 : -1);
        if (pitch < lo) pitch = target + 1;
        if (pitch > hi) pitch = target - 1;
      }
      notes.push({
        pitch,
        start: span.start + s * s16,
        dur: (nextHit - s) * s16 - 25,
        vel: (downbeat ? 104 : 90) + rng.int(-4, 4),
      });
    }
  }
  return notes;
}

/**
 * 'walking' — jazz quarter notes: root → third → fifth → chromatic approach
 * into the next root, with voice leading (nearest octave to the last note).
 */
function walking(ctx: GenContext): NoteEvent[] {
  const rng = ctx.rng('bass');
  const [lo, hi] = ctx.cfg.bass.register;
  const totalBeats = (ctx.totalBars * ctx.barTicks) / ctx.beatTicks;
  const notes: NoteEvent[] = [];
  let prev = placeInRegister(ctx.chordAt(0).root, lo, hi);

  for (let beat = 0; beat < totalBeats; beat++) {
    const tick = beat * ctx.beatTicks;
    const chord = ctx.chordAt(tick);
    const nextChord = ctx.chordAt(tick + ctx.beatTicks);
    const pos = beat % 4;
    let pitch: number;

    if (pos === 0) {
      pitch = nearestInRegister(chord.root, prev, lo, hi);
    } else if (pos === 1) {
      pitch = nearestInRegister(chord.pitchClasses[1] ?? chord.root, prev, lo, hi);
    } else if (pos === 2) {
      pitch = nearestInRegister(chord.pitchClasses[2] ?? chord.root, prev, lo, hi);
    } else if (nextChord.root !== chord.root) {
      // Chromatic approach from a semitone above or below the coming root.
      const target = nearestInRegister(nextChord.root, prev, lo, hi);
      pitch = Math.min(hi, Math.max(lo, target + (rng.chance(0.5) ? 1 : -1)));
    } else {
      const sixth = chord.pitchClasses[3] ?? chord.pitchClasses[1] ?? chord.root;
      pitch = nearestInRegister(sixth, prev, lo, hi);
    }

    prev = pitch;
    notes.push({
      pitch,
      start: tick,
      dur: ctx.beatTicks - 40,
      vel: (pos === 0 ? 92 : 78) + rng.int(-6, 6),
    });
  }
  return notes;
}

/**
 * 's808' — phonk/trap 808: long legato root notes on sparse syncopated hits.
 * Durations run right up to the next hit so the audio layer's portamento
 * turns repeated notes into the signature glide.
 */
function s808(ctx: GenContext): NoteEvent[] {
  const rng = ctx.rng('bass');
  const [lo, hi] = ctx.cfg.bass.register;
  const hitPatterns: number[][] = [
    [0, 1.5, 3],
    [0, 2.5],
    [0, 1.75, 3],
    [0, 3.5],
    [0, 2, 3.5],
    [0, 0.75, 3],
    [0, 2, 2.75],
  ];
  const notes: NoteEvent[] = [];

  for (let si = 0; si < ctx.chords.length; si++) {
    const span = ctx.chords[si]!;
    const next: ChordSpan | undefined = ctx.chords[si + 1];
    const root = placeInRegister(span.chord.root, lo, hi);
    const fifthPc = span.chord.pitchClasses[2] ?? span.chord.root;
    const bars = Math.ceil(span.dur / ctx.barTicks);

    for (let bar = 0; bar < bars; bar++) {
      const barStart = span.start + bar * ctx.barTicks;
      if (barStart >= span.start + span.dur) break;
      const hits = rng.pick(hitPatterns);
      const lastBarOfSpan = barStart + ctx.barTicks >= span.start + span.dur;

      for (let h = 0; h < hits.length; h++) {
        const start = barStart + Math.round(hits[h]! * ctx.beatTicks);
        const nextStart =
          h + 1 < hits.length
            ? barStart + Math.round(hits[h + 1]! * ctx.beatTicks)
            : barStart + ctx.barTicks;
        let pitch = root;
        if (h > 0 && rng.chance(0.18)) pitch = placeInRegister(fifthPc, lo, hi);
        else if (h > 0 && rng.chance(0.12)) pitch = root + 12 <= hi ? root + 12 : root;
        else if (h > 0 && root - 12 >= lo && rng.chance(0.1)) pitch = root - 12; // sub drop
        // Anticipate the chord change: the glide lands on the new root early.
        const isLastHit = h === hits.length - 1;
        if (isLastHit && lastBarOfSpan && next && next.chord.root !== span.chord.root && rng.chance(0.3)) {
          pitch = placeInRegister(next.chord.root, lo, hi);
        }

        notes.push({
          pitch,
          start,
          dur: nextStart - start - 10, // near-legato → portamento glide
          vel: (h === 0 ? 112 : 98) + rng.int(-4, 4),
        });
      }
    }
  }
  return notes;
}

/**
 * 'boogie' — the classic blues eighth-note line: root–3–5–6–b7–6–5–3 over
 * each chord, third taken from the chord itself (works over dom7 and minor).
 */
function boogie(ctx: GenContext): NoteEvent[] {
  const rng = ctx.rng('bass');
  const [lo, hi] = ctx.cfg.bass.register;
  const eighth = PPQ / 2;
  const notes: NoteEvent[] = [];

  for (const span of ctx.chords) {
    const root = placeInRegister(span.chord.root, lo, hi);
    const third = (12 + (span.chord.pitchClasses[1] ?? span.chord.root) - span.chord.root) % 12;
    const line = [0, third, 7, 9, 10, 9, 7, third];
    const count = Math.floor(span.dur / eighth);
    for (let i = 0; i < count; i++) {
      let pitch = root + line[i % 8]!;
      if (pitch > hi) pitch -= 12;
      notes.push({
        pitch,
        start: span.start + i * eighth,
        dur: eighth - 40,
        vel: (i % 2 === 0 ? 96 : 82) + rng.int(-5, 5),
      });
    }
  }
  return notes;
}

/**
 * 'gallop' — post-punk lead bass. Each section name draws its own FEEL from a
 * pool so the bass isn't the same horse-gallop the whole track: octave gallop
 * (low 1/8 → octave 1/16 → octave 1/16, the Joy Division / Молчат-Дома engine),
 * a straight driving eighth line, a root/octave see-saw, or brooding half-note
 * roots. Melodic low notes (root → fifth → third) with a chromatic approach.
 */
function gallop(ctx: GenContext): NoteEvent[] {
  const rng = ctx.rng('bass');
  const [lo, hi] = ctx.cfg.bass.register;
  const eighth = PPQ / 2;
  const s16 = PPQ / 4;
  const half = ctx.barTicks / 2;
  const notes: NoteEvent[] = [];

  type Feel = 'gallop' | 'straight' | 'octave' | 'half';
  const FEELS: Feel[] = ['gallop', 'gallop', 'straight', 'octave', 'half'];
  const feelByName = new Map<string, Feel>();
  const sectionName = (tick: number): string => {
    for (let i = ctx.sections.length - 1; i >= 0; i--) {
      const s = ctx.sections[i]!;
      if (tick >= s.startBar * ctx.barTicks) return s.name;
    }
    return ctx.sections[0]!.name;
  };
  const feelFor = (name: string): Feel => {
    let f = feelByName.get(name);
    if (!f) {
      f = rng.pick(FEELS);
      feelByName.set(name, f);
    }
    return f;
  };

  for (let si = 0; si < ctx.chords.length; si++) {
    const span = ctx.chords[si]!;
    const next: ChordSpan | undefined = ctx.chords[si + 1];
    const root = placeInRegister(span.chord.root, lo, hi);
    const thirdPc = span.chord.pitchClasses[1] ?? span.chord.root;
    const fifthPc = span.chord.pitchClasses[2] ?? span.chord.root;
    const feel = feelFor(sectionName(span.start));

    if (feel === 'half') {
      const count = Math.max(1, Math.floor(span.dur / half));
      for (let i = 0; i < count; i++) {
        notes.push({ pitch: root, start: span.start + i * half, dur: half - 20, vel: 96 + rng.int(-4, 4) });
      }
      continue;
    }
    if (feel === 'straight' || feel === 'octave') {
      const count = Math.floor(span.dur / eighth);
      const high = root + 12 <= hi ? root + 12 : root;
      for (let i = 0; i < count; i++) {
        let pitch = feel === 'octave' && i % 2 === 1 ? high : root;
        if (i === count - 1 && next && next.chord.root !== span.chord.root && rng.chance(0.45)) {
          const target = placeInRegister(next.chord.root, lo, hi);
          pitch = target + (rng.chance(0.5) ? 1 : -1);
          if (pitch < lo) pitch = target + 1;
          if (pitch > hi) pitch = target - 1;
        }
        notes.push({ pitch, start: span.start + i * eighth, dur: eighth - 15, vel: (i % 2 === 0 ? 104 : 92) + rng.int(-3, 3) });
      }
      continue;
    }

    // gallop
    const beats = Math.floor(span.dur / ctx.beatTicks);
    for (let b = 0; b < beats; b++) {
      const beatStart = span.start + b * ctx.beatTicks;
      const isLastBeat = b === beats - 1;
      let low = root;
      if (isLastBeat && next && next.chord.root !== span.chord.root && rng.chance(0.5)) {
        const target = placeInRegister(next.chord.root, lo, hi);
        low = target + (rng.chance(0.5) ? 1 : -1);
        if (low < lo) low = target + 1;
        if (low > hi) low = target - 1;
      } else if (b > 0 && rng.chance(0.3)) {
        low = placeInRegister(rng.chance(0.6) ? fifthPc : thirdPc, lo, hi);
      }
      const high = low + 12 <= hi ? low + 12 : low;
      notes.push({ pitch: low, start: beatStart, dur: eighth - 20, vel: 104 + rng.int(-4, 4) });
      notes.push({ pitch: high, start: beatStart + eighth, dur: s16 - 10, vel: 90 + rng.int(-4, 4) });
      notes.push({ pitch: high, start: beatStart + eighth + s16, dur: s16 - 10, vel: 88 + rng.int(-4, 4) });
    }
  }
  return notes;
}

/**
 * 'chug' — metal picked bass doubling the rhythm guitar/kick. Each section name
 * draws its own feel from a pool (straight 1/8 / 1/16 drive / octave see-saw /
 * 3-3-2 syncopation), so the low wall varies per seed and per section instead
 * of being a dead-straight root line. A chromatic approach leads into the next
 * chord. Sixteenth grid throughout (beatmap-safe).
 */
function chug(ctx: GenContext): NoteEvent[] {
  const rng = ctx.rng('bass');
  const [lo, hi] = ctx.cfg.bass.register;
  const eighth = PPQ / 2;
  const s16 = PPQ / 4;
  const notes: NoteEvent[] = [];

  // Per-section-name feel (3-3-2 mask on a 16th grid).
  type Feel = 'straight' | 'drive16' | 'octave' | 'synco';
  const FEELS: Feel[] = ['straight', 'straight', 'drive16', 'octave', 'synco'];
  const SYNCO = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0];
  const feelByName = new Map<string, Feel>();
  const sectionName = (tick: number): string => {
    for (let i = ctx.sections.length - 1; i >= 0; i--) {
      const s = ctx.sections[i]!;
      if (tick >= s.startBar * ctx.barTicks) return s.name;
    }
    return ctx.sections[0]!.name;
  };
  const feelFor = (name: string): Feel => {
    let f = feelByName.get(name);
    if (!f) {
      f = rng.pick(FEELS);
      feelByName.set(name, f);
    }
    return f;
  };

  for (let si = 0; si < ctx.chords.length; si++) {
    const span = ctx.chords[si]!;
    const next: ChordSpan | undefined = ctx.chords[si + 1];
    const root = placeInRegister(span.chord.root, lo, hi);
    const high = root + 12 <= hi ? root + 12 : root;
    const feel = feelFor(sectionName(span.start));
    const unit = feel === 'drive16' || feel === 'synco' ? s16 : eighth;
    const steps = Math.floor(span.dur / unit);

    for (let i = 0; i < steps; i++) {
      if (feel === 'synco' && !SYNCO[i % 16]) continue;
      let pitch = root;
      if (feel === 'octave' && i % 2 === 1) pitch = high;
      const isLast = i === steps - 1;
      if (isLast && next && next.chord.root !== span.chord.root && rng.chance(0.45)) {
        const target = placeInRegister(next.chord.root, lo, hi);
        pitch = target + (rng.chance(0.5) ? 1 : -1);
        if (pitch < lo) pitch = target + 1;
        if (pitch > hi) pitch = target - 1;
      }
      notes.push({
        pitch,
        start: span.start + i * unit,
        dur: unit - 12,
        vel: (i % 2 === 0 ? 104 : 94) + rng.int(-3, 3),
      });
    }
  }
  return notes;
}

/** 'march' — tuba oom-pah: root on the strong beat, fifth on the weak one. */
function march(ctx: GenContext): NoteEvent[] {
  const rng = ctx.rng('bass');
  const [lo, hi] = ctx.cfg.bass.register;
  const totalBeats = (ctx.totalBars * ctx.barTicks) / ctx.beatTicks;
  const notes: NoteEvent[] = [];

  for (let beat = 0; beat < totalBeats; beat++) {
    const tick = beat * ctx.beatTicks;
    const chord = ctx.chordAt(tick);
    const beatsPerBar = ctx.barTicks / ctx.beatTicks;
    const strong = beat % beatsPerBar === 0;
    const pc = strong ? chord.root : (chord.pitchClasses[2] ?? chord.root);
    notes.push({
      pitch: placeInRegister(pc, lo, hi),
      start: tick,
      dur: Math.floor(ctx.beatTicks * 0.55),
      vel: (strong ? 104 : 88) + rng.int(-4, 4),
    });
  }
  return notes;
}

/** 'sustain' — bowed cello roots: half-bar notes, fifth as occasional colour. */
function sustain(ctx: GenContext): NoteEvent[] {
  const rng = ctx.rng('bass');
  const [lo, hi] = ctx.cfg.bass.register;
  const half = ctx.barTicks / 2;
  const notes: NoteEvent[] = [];

  for (const span of ctx.chords) {
    const count = Math.max(1, Math.floor(span.dur / half));
    for (let i = 0; i < count; i++) {
      const start = span.start + i * half;
      const useFifth = i > 0 && rng.chance(0.25);
      const pc = useFifth ? (span.chord.pitchClasses[2] ?? span.chord.root) : span.chord.root;
      notes.push({
        pitch: placeInRegister(pc, lo, hi),
        start,
        dur: half - 20,
        vel: (i === 0 ? 88 : 76) + rng.int(-5, 5),
      });
    }
  }
  return notes;
}

export const genBass: PartGenerator = (ctx) => {
  const inst = ctx.cfg.instruments.bass;
  if (!inst) return null;

  // Per-seed style pool (keygen); without it the fixed style costs no RNG.
  const style = ctx.cfg.bass.styles
    ? ctx.rng('bass').weighted(ctx.cfg.bass.styles)
    : ctx.cfg.bass.style;

  let notes: NoteEvent[];
  switch (style) {
    case 'walking':
      notes = walking(ctx);
      break;
    case 's808':
      notes = s808(ctx);
      break;
    case 'boogie':
      notes = boogie(ctx);
      break;
    case 'march':
      notes = march(ctx);
      break;
    case 'sustain':
      notes = sustain(ctx);
      break;
    case 'octave8':
      notes = octave8(ctx);
      break;
    case 'syncopated16':
      notes = syncopated16(ctx);
      break;
    case 'synth8':
      notes = synth8(ctx);
      break;
    case 'gallop':
      notes = gallop(ctx);
      break;
    case 'chug':
      notes = chug(ctx);
      break;
  }

  return { name: inst.name, channel: 0, program: inst.program, role: 'bass', notes };
};
