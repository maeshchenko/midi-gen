import { type NoteEvent, PPQ, sectionKey } from '../types';
import type { GenContext, GenreConfig, PartGenerator, Weighted } from './types';
import type { Rng } from '../prng';
import type { Chord } from '../theory/chords';
import { clampRegister, nearestChordTone, nextScalePitch } from '../gen/melody';
import { mod12 } from '../theory/scales';

/**
 * Music box: a steel comb plucked by a pin cylinder. Everything follows from
 * the mechanism — high register (the comb has no bass), 3/4 lullaby meter,
 * flat velocities (a pin always plucks with the same force), and NO damper:
 * every note rings into the next. Melody on the high tines, a gentle waltz
 * arpeggio on the low ones, both the same timbre (GM 10).
 */

const EIGHTH = PPQ / 2;
const PHRASE_BARS = 4; // aligned with the 4-chords-per-cycle progressions
const RING = PPQ / 2; // tail past the next onset — the undamped comb

/** Eighth-note onsets within one 3/4 bar. */
const BAR_RHYTHMS: Weighted<number[]>[] = [
  { w: 3, v: [0, 2, 4] }, // plain quarters
  { w: 2, v: [0, 1, 2, 4] },
  { w: 2, v: [0, 2, 3, 4] },
  { w: 2, v: [0, 3, 4] }, // dotted lilt
  { w: 1, v: [0, 4] },
  { w: 1, v: [0, 1, 2, 3, 4] },
];

/** Cadence bar of a phrase: one or two long notes, never busy. */
const CADENCE_RHYTHMS: Weighted<number[]>[] = [
  { w: 2, v: [0] },
  { w: 1, v: [0, 2] },
];

/**
 * One 4-bar lullaby phrase as notes relative to the phrase start.
 * Stepwise scale walk; downbeats snap to the bar's chord; the contour rises
 * through the first half and settles through the second. `chords` holds the
 * chord of each of the 4 bars (harmony repeats every phrase, so a literal
 * replay stays consonant).
 */
function buildPhrase(
  rng: Rng,
  ctx: GenContext,
  chords: Chord[],
  state: { pitch: number },
): NoteEvent[] {
  const [lo, hi] = ctx.cfg.melody.register;
  const tonic = ctx.key.tonic;
  const mode = ctx.key.mode;
  const mainRhythm = rng.weighted(BAR_RHYTHMS);
  const cadenceRhythm = rng.weighted(CADENCE_RHYTHMS);
  const notes: NoteEvent[] = [];

  for (let bar = 0; bar < PHRASE_BARS; bar++) {
    const barStart = bar * ctx.barTicks;
    const chord = chords[bar]!;
    const isCadence = bar === PHRASE_BARS - 1;
    const onsets = isCadence ? cadenceRhythm : mainRhythm;
    // Rise toward the phrase middle, settle after it.
    const drift: 1 | -1 = bar < PHRASE_BARS / 2 ? 1 : -1;

    for (let i = 0; i < onsets.length; i++) {
      const slot = onsets[i]!;
      const tick = barStart + slot * EIGHTH;
      const nextTick =
        i + 1 < onsets.length ? barStart + onsets[i + 1]! * EIGHTH : barStart + ctx.barTicks;

      if (slot === 0) {
        state.pitch = clampRegister(nearestChordTone(state.pitch, chord), lo, hi);
      } else if (rng.chance(0.12)) {
        // Rare gentle leap onto a chord tone, at most a sixth away.
        const target = clampRegister(
          nearestChordTone(state.pitch + drift * rng.int(3, 8), chord),
          lo,
          hi,
        );
        state.pitch = Math.abs(target - state.pitch) <= 9 ? target : state.pitch;
      } else {
        const dir: 1 | -1 = rng.chance(0.7) ? drift : ((-drift) as 1 | -1);
        state.pitch = clampRegister(nextScalePitch(state.pitch, dir, tonic, mode), lo, hi);
      }

      // Twinkle: a short grace note one scale step above, just before the pluck.
      if (slot > 0 && rng.chance(0.08)) {
        notes.push({
          pitch: clampRegister(nextScalePitch(state.pitch, 1, tonic, mode), lo, hi),
          start: tick - 60,
          dur: 55,
          vel: 58,
        });
      }

      notes.push({
        pitch: state.pitch,
        start: tick,
        dur: nextTick - tick + RING, // no damper — ring into the next note
        vel: slot === 0 ? 76 : 70,
      });
    }
  }
  return notes;
}

const genMusicboxLead: PartGenerator = (ctx) => {
  const inst = ctx.cfg.instruments.lead;
  if (!inst) return null;
  const rng = ctx.rng('melody');
  const [lo, hi] = ctx.cfg.melody.register;
  const phraseTicks = PHRASE_BARS * ctx.barTicks;
  const cache = new Map<string, { a: NoteEvent[]; b: NoteEvent[] }>();
  const notes: NoteEvent[] = [];

  for (const section of ctx.sections) {
    const sectionStart = section.startBar * ctx.barTicks;
    const sectionEnd = sectionStart + section.bars * ctx.barTicks;

    let phrases = cache.get(sectionKey(section));
    if (!phrases) {
      const chords = Array.from({ length: PHRASE_BARS }, (_, bar) =>
        ctx.chordAt(sectionStart + bar * ctx.barTicks),
      );
      const state = { pitch: Math.round((lo + hi) / 2) };
      phrases = { a: buildPhrase(rng, ctx, chords, state), b: buildPhrase(rng, ctx, chords, state) };
      cache.set(sectionKey(section), phrases);
    }

    const count = Math.ceil(section.bars / PHRASE_BARS);
    const sectionNotes: NoteEvent[] = [];
    for (let u = 0; u < count; u++) {
      const phrase = u % 4 === 2 ? phrases.b : phrases.a; // A A B A
      const offset = sectionStart + u * phraseTicks;
      sectionNotes.push(...phrase.map((n) => ({ ...n, start: n.start + offset })));
    }

    // The section's last pluck lands on the tonic and rings to the seam.
    const last = sectionNotes[sectionNotes.length - 1];
    if (last) {
      let p = last.pitch;
      for (let d = 0; d < 12; d++) {
        if (mod12(p - d) === ctx.key.tonic) { p = p - d; break; }
        if (mod12(p + d) === ctx.key.tonic) { p = p + d; break; }
      }
      last.pitch = clampRegister(p, lo, hi);
      last.dur = Math.max(last.dur, sectionEnd - last.start - 10);
    }

    const clipped = sectionNotes.filter((n) => n.start < sectionEnd && n.start >= sectionStart);
    for (const n of clipped) n.dur = Math.min(n.dur, sectionEnd - n.start);
    notes.push(...clipped);
  }

  return { name: inst.name, channel: 0, program: inst.program, role: 'lead', notes };
};

/* ------------------------------------------------------------------ */
/* Low tines: waltz accompaniment, root low, colour above, all ringing.*/
/* ------------------------------------------------------------------ */

/** Lowest instance of the pitch class at or above `lo`. */
function rootAbove(pc: number, lo: number): number {
  for (let p = lo; p < lo + 12; p++) {
    if (mod12(p) === pc) return p;
  }
  return lo;
}

const genMusicboxAccomp: PartGenerator = (ctx) => {
  const inst = ctx.cfg.instruments.chords;
  if (!inst) return null;
  const rng = ctx.rng('comping');
  const cfg = ctx.cfg.comping;
  if (!cfg) return null;
  const [lo, hi] = cfg.register;
  // root–fifth–third waltz vs root–third–fifth roll, one shape per song.
  const ascending = rng.chance(0.4);
  const notes: NoteEvent[] = [];

  for (let bar = 0; bar < ctx.totalBars; bar++) {
    const barStart = bar * ctx.barTicks;
    const chord = ctx.chordAt(barStart);
    const root = rootAbove(chord.root, lo);
    const third = root + mod12(12 + (chord.pitchClasses[1] ?? chord.root) - chord.root);
    const fifth = root + mod12(12 + (chord.pitchClasses[2] ?? chord.root) - chord.root);
    const beats = ascending ? [root, third, fifth] : [root, fifth, third];

    for (let beat = 0; beat < 3; beat++) {
      let pitch = beats[beat]!;
      while (pitch > hi) pitch -= 12;
      notes.push({
        pitch,
        start: barStart + beat * ctx.beatTicks,
        dur: ctx.barTicks - beat * ctx.beatTicks + RING, // ring to the bar line and past it
        vel: beat === 0 ? 58 : 52,
      });
    }
  }

  // Clip the very last ring at the loop seam.
  const total = ctx.totalBars * ctx.barTicks;
  for (const n of notes) n.dur = Math.min(n.dur, total - n.start);

  return { name: inst.name, channel: 0, program: inst.program, role: 'chords', notes };
};

export const MUSICBOX: GenreConfig = {
  id: 'musicbox',
  name: 'Music Box',
  naming: {
    patterns: [
      { w: 3, v: '{adj} {noun}' },
      { w: 1, v: '{noun} for a {adj} {obj}' },
      { w: 1, v: 'Waltz for a {adj} {obj}' },
    ],
    words: {
      adj: ['Clockwork', 'Paper', 'Porcelain', 'Winter', 'Tarnished', 'Moonlight', 'Attic', 'Snowglobe', 'Faded', 'Velvet'],
      noun: ['Lullaby', 'Waltz', 'Carousel', 'Ballerina', 'Berceuse', 'Minuet', 'Reverie', 'Keepsake', 'Locket', 'Dream'],
      obj: ['Moon', 'Ballerina', 'Music Box', 'Snow Queen', 'Sleeping Fox', 'Tin Soldier', 'Lost Button', 'Winter Garden'],
    },
  },
  bpm: [66, 92],
  timeSig: [3, 4],
  keys: [
    { w: 2, v: 9 }, // A
    { w: 2, v: 0 }, // C
    { w: 1, v: 4 }, // E
    { w: 1, v: 2 }, // D
    { w: 1, v: 7 }, // G
    { w: 1, v: 5 }, // F
  ],
  modes: [
    { w: 2, v: 'major' }, // sweet lullaby
    { w: 2, v: 'naturalMinor' }, // nostalgic / eerie
    { w: 1, v: 'harmonicMinor' },
  ],
  swing: [0, 0],
  structures: [
    {
      w: 2,
      v: [
        { name: 'A', bars: 16 },
        { name: 'A', bars: 16 },
      ],
    },
    {
      w: 1,
      v: [
        { name: 'A', bars: 16 },
        { name: 'B', bars: 16 },
        { name: 'A', bars: 16 },
      ],
    },
  ],
  progressions: [
    // One chord per 3/4 bar, 4-bar cycles (phrase-aligned).
    { w: 2, v: [{ degree: 0, beats: 3 }, { degree: 4, beats: 3 }, { degree: 5, beats: 3 }, { degree: 3, beats: 3 }] },
    { w: 2, v: [{ degree: 0, beats: 3 }, { degree: 5, beats: 3 }, { degree: 3, beats: 3 }, { degree: 4, beats: 3 }] },
    { w: 2, v: [{ degree: 0, beats: 3 }, { degree: 3, beats: 3 }, { degree: 4, beats: 3 }, { degree: 0, beats: 3 }] },
    { w: 1, v: [{ degree: 0, beats: 3 }, { degree: 4, beats: 3 }, { degree: 0, beats: 3 }, { degree: 4, beats: 3 }] },
  ],
  distinctProgressions: true,
  melody: {
    register: [72, 96], // C5–C7: the high tines
    density: 0.6, // nominal — the hook uses its own bar rhythms
    leapProb: 0.12,
    restProb: 0,
    syncopation: 0,
  },
  bass: {
    style: 'sustain', // unused — no bass instrument; the comb has no bass
    register: [48, 60],
  },
  comping: {
    register: [55, 76], // G3–E5: the low tines
  },
  drums: {
    patterns: [], // no drums in a music box
    fillEvery: 16,
  },
  instruments: {
    lead: { program: 10, name: 'Music Box' },
    chords: { program: 10, name: 'Music Box Low' },
  },
  arrange: {
    layers: {},
  },
  humanize: { timingTicks: 3, velocity: 0.04 }, // clockwork with a faint spring flutter
  hooks: {
    melody: genMusicboxLead,
    comping: genMusicboxAccomp,
  },
};
