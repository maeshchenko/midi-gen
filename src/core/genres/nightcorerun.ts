import { PPQ, DRUM_CHANNEL, sectionKey, type NoteEvent } from '../types';
import type { GenreConfig, GenContext, PartGenerator, StepPattern } from './types';
import type { Rng } from '../prng';
import { GM_DRUMS } from '../gen/drums';
import { nextScalePitch, nearestChordTone, clampRegister } from '../gen/melody';
import { mod12 } from '../theory/scales';

/**
 * Nightcore Run — Symphonic Rock / Power-Metal anime-AMV style. Sped-up
 * symphonic power metal (Nightwish energy) + high-octane action-anime openings:
 * a wall of double-tracked distorted guitars, double-kick blast beats, a
 * pitched-up symphonic lead shredding in the stratosphere, orchestral strings.
 *
 * The high-energy PEAK lane (opposite pole to doomerrun's grey baseline). Keeps
 * the rhythm-game beatmap contract (#12): intro → build → drop → break → drop
 * dynamics arc, zero timing humanize (onsets = block spawn times), seamless
 * loop. No master low-pass — the wall of sound stays full and wide.
 */

// Drum kit voice descriptor only — the section-aware pattern is built by the hook.
const NCR_KIT: StepPattern = {
  name: 'ncr-kit',
  kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  hatClosed: [0.6, 0, 0.5, 0, 0.6, 0, 0.5, 0, 0.6, 0, 0.5, 0, 0.6, 0, 0.5, 0],
};

const placeRoot = (pc: number, lo: number, hi: number): number => {
  for (let p = lo; p <= hi; p++) if (mod12(p) === ((pc % 12) + 12) % 12) return p;
  return lo;
};
const sectionNameAt = (ctx: GenContext, tick: number): string => {
  for (let i = ctx.sections.length - 1; i >= 0; i--) {
    const s = ctx.sections[i]!;
    if (tick >= s.startBar * ctx.barTicks) return s.name;
  }
  return ctx.sections[0]!.name;
};

// ── Hooks ────────────────────────────────────────────────────────────────────

// Per-beat power-chord rhythm masks on a 1/4 grid of sixteenths [0..3].
type GtrCell = { off: number; len: number; vel: number };
const GTR_RHYTHMS: GtrCell[][] = [
  // straight chug (1/8)
  [{ off: 0, len: 2, vel: 100 }, { off: 2, len: 2, vel: 90 }],
  // metal gallop (1/8 + 1/16 + 1/16)
  [{ off: 0, len: 2, vel: 104 }, { off: 2, len: 1, vel: 90 }, { off: 3, len: 1, vel: 88 }],
  // reverse gallop (1/16 1/16 + 1/8)
  [{ off: 0, len: 1, vel: 96 }, { off: 1, len: 1, vel: 86 }, { off: 2, len: 2, vel: 100 }],
  // syncopated palm-mute (off the downbeat)
  [{ off: 0, len: 1, vel: 102 }, { off: 2, len: 1, vel: 84 }, { off: 3, len: 1, vel: 92 }],
  // driving 1/16 (all four)
  [{ off: 0, len: 1, vel: 100 }, { off: 1, len: 1, vel: 82 }, { off: 2, len: 1, vel: 92 }, { off: 3, len: 1, vel: 84 }],
];

/**
 * Rhythm guitar (the 'arp' role): overdriven POWER CHORDS (root + fifth). Each
 * section name draws its own per-beat rhythm (chug / gallop / syncopation) from
 * the pool, so every seed and every section chugs differently. Skips intro/break.
 */
export const genNCRGuitar: PartGenerator = (ctx) => {
  const inst = ctx.cfg.instruments.arp;
  if (!inst) return null;
  const rng = ctx.rng('comping');
  const [lo, hi] = ctx.cfg.arp?.register ?? [40, 64];
  const s16 = PPQ / 4;
  const notes: NoteEvent[] = [];

  // One rhythm per section name (drops weight toward gallop/1-16 energy).
  const cellByName = new Map<string, GtrCell[]>();
  const rhythmFor = (name: string): GtrCell[] => {
    let c = cellByName.get(name);
    if (!c) {
      c = name === 'drop'
        ? rng.pick([GTR_RHYTHMS[1]!, GTR_RHYTHMS[1]!, GTR_RHYTHMS[4]!, GTR_RHYTHMS[2]!])
        : rng.pick(GTR_RHYTHMS);
      cellByName.set(name, c);
    }
    return c;
  };

  const chord = (start: number, dur: number, vel: number, root: number, fifth: number): void => {
    notes.push({ pitch: root, start, dur, vel });
    notes.push({ pitch: fifth, start, dur, vel: vel - 4 });
  };

  for (const span of ctx.chords) {
    const name = sectionNameAt(ctx, span.start);
    if (name === 'intro' || name === 'break') continue;
    const cells = rhythmFor(name);
    const root = placeRoot(span.chord.root, lo, hi);
    const fifth = root + 7 <= hi ? root + 7 : root;
    const beats = Math.floor(span.dur / ctx.beatTicks);
    for (let b = 0; b < beats; b++) {
      const beatStart = span.start + b * ctx.beatTicks;
      for (const cell of cells) {
        chord(beatStart + cell.off * s16, cell.len * s16 - 8, cell.vel, root, fifth);
      }
    }
  }
  return { name: inst.name, channel: 0, program: inst.program, role: 'arp', notes };
};

/**
 * Power-metal kit, section-aware: double-kick blast (1/16) under a half-time
 * 2&4 snare in the drop; a crescendoing 1/16→1/32 snare roll over four-floor
 * kick in the build; a calm quarter-note kick in the break; crashes on every
 * section start.
 */
export const genNCRDrums: PartGenerator = (ctx) => {
  const inst = ctx.cfg.instruments.drums;
  if (!inst) return null;
  const rng = ctx.rng('drums');
  const step = ctx.barTicks / 16;
  const beat = ctx.beatTicks;
  const jit = () => rng.int(-4, 4);
  const notes: NoteEvent[] = [];
  const hit = (pitch: number, start: number, dur: number, vel: number): void => {
    notes.push({ pitch, start, dur, vel: Math.max(1, Math.min(127, vel)) });
  };

  // Per-section blast density for drops: 1 = 1/16 double-kick, 2 = 1/8.
  const dropStepByName = new Map<string, number>();
  const dropStep = (name: string): number => {
    let d = dropStepByName.get(name);
    if (d === undefined) {
      d = rng.pick([1, 1, 2]);
      dropStepByName.set(name, d);
    }
    return d;
  };
  const toms = [GM_DRUMS.tomHigh, GM_DRUMS.tomMid, GM_DRUMS.tomLow];

  for (const section of ctx.sections) {
    for (let bar = 0; bar < section.bars; bar++) {
      const barStart = (section.startBar + bar) * ctx.barTicks;
      const lastBar = bar === section.bars - 1;
      if (bar === 0) hit(GM_DRUMS.crash, barStart, beat, 106 + jit());

      if (section.name === 'drop') {
        const kd = dropStep(sectionKey(section));
        for (let s = 0; s < 16; s += kd) hit(GM_DRUMS.kick, barStart + s * step, step - 10, 92 + jit());
        hit(GM_DRUMS.snare, barStart + 4 * step, step, 114 + jit());
        hit(GM_DRUMS.snare, barStart + 12 * step, step, 114 + jit());
        for (const s of [2, 6, 10, 14]) hit(GM_DRUMS.hatOpen, barStart + s * step, step, 72 + jit());
        if (bar % 2 === 0) hit(GM_DRUMS.crash, barStart, beat, 92 + jit());
        // Tom fill across the last beat of the section.
        if (lastBar) {
          for (let s = 12; s < 16; s++) {
            hit(toms[(s - 12) % 3]!, barStart + s * step, step - 6, 100 + jit());
          }
        }
      } else if (section.name === 'build') {
        for (const s of [0, 4, 8, 12]) hit(GM_DRUMS.kick, barStart + s * step, step - 10, 100 + jit());
        const lastBar = bar === section.bars - 1;
        for (let s = 0; s < 16; s++) {
          const vel = 56 + Math.round((s / 15) * 56); // crescendo across the bar
          hit(GM_DRUMS.snare, barStart + s * step, step - 8, vel);
          if (lastBar && s >= 8) hit(GM_DRUMS.snare, barStart + s * step + step / 2, step / 2, vel + 6); // 1/32 accel
        }
      } else if (section.name === 'break') {
        for (const s of [0, 4, 8, 12]) hit(GM_DRUMS.kick, barStart + s * step, step - 10, 88 + jit());
        hit(GM_DRUMS.snare, barStart + 4 * step, step, 96 + jit());
        hit(GM_DRUMS.snare, barStart + 12 * step, step, 96 + jit());
        for (const s of [2, 6, 10, 14]) hit(GM_DRUMS.hatClosed, barStart + s * step, step - 6, 54 + jit());
      }
      // intro: drumless (arrange layer excludes drums) — only the bar-0 crash rings.
    }
  }
  return { name: inst.name, channel: DRUM_CHANNEL, program: inst.program, role: 'drums', notes };
};

// Held-note layouts for the "emotional" bar (beat offsets + lengths in beats).
const HOLD_SHAPES: { off: number; len: number }[][] = [
  [{ off: 0, len: 4 }], // one whole-bar swell
  [{ off: 0, len: 2 }, { off: 2, len: 2 }], // two half notes
  [{ off: 0, len: 3 }, { off: 3, len: 1 }], // long + pickup
  [{ off: 0, len: 1 }, { off: 1, len: 1 }, { off: 2, len: 2 }], // two short + held
  [{ off: 0, len: 2 }, { off: 2, len: 1 }, { off: 3, len: 1 }], // half + two quarters
  [{ off: 1, len: 3 }], // delayed swell (rest on beat 1)
];

// Lead timbre pool — chosen once per seed (spec: synth OR strings OR piano).
// 49 symphonic synth (glide), 48 string section, 40 solo violin, 1 FM piano.
const NCR_LEAD_PROGRAMS = [49, 49, 48, 40, 1];

/** Build a 2-bar lead phrase (bar 1 = emotional holds, bar 2 = 1/16 shred run),
 * randomized per call. Returns notes relative to the phrase start. */
function ncrPhrase(rng: Rng, ctx: GenContext, anchorTick: number): NoteEvent[] {
  const [lo, hi] = ctx.cfg.melody.register;
  const tonic = ctx.key.tonic;
  const mode = ctx.key.mode;
  const beat = ctx.beatTicks;
  const s16 = PPQ / 4;
  const out: NoteEvent[] = [];

  // Bar 1 — held chord tones, high, picked by rng.
  const shape = rng.pick(HOLD_SHAPES);
  let cur = clampRegister(nearestChordTone(hi - rng.int(0, 6), ctx.chordAt(anchorTick)), lo, hi);
  for (const h of shape) {
    const t = h.off * beat;
    const chord = ctx.chordAt(anchorTick + t);
    cur = clampRegister(nearestChordTone(cur + rng.int(-2, 2), chord), lo, hi);
    out.push({ pitch: cur, start: t, dur: h.len * beat - 20, vel: 100 + rng.int(-4, 4) });
  }

  // Bar 2 — virtuoso 1/16 shred run; random start, direction, a mid-run flip.
  const start16 = rng.int(0, 4); // a short rest before the run sometimes
  const flip = rng.int(6, 11); // where the run reverses
  let dir: 1 | -1 = rng.chance(0.5) ? 1 : -1;
  for (let i = start16; i < 16; i++) {
    if (i === flip) dir = (dir === 1 ? -1 : 1) as 1 | -1;
    cur = clampRegister(nextScalePitch(cur, dir, tonic, mode), lo, hi);
    const last = i === 15;
    if (last) cur = clampRegister(nearestChordTone(cur, ctx.chordAt(anchorTick + ctx.barTicks)), lo, hi);
    out.push({
      pitch: cur,
      start: ctx.barTicks + i * s16,
      dur: last ? beat : s16 - 5,
      vel: last ? 104 : 80 + rng.int(-4, 8),
    });
  }
  return out;
}

/**
 * Symphonic / pitched-anime-vocal lead: emotional LONG held notes resolving
 * into a virtuoso 1/16 shred run, two 2-bar phrases per section in an A A B A
 * plan — fresh per seed AND per section (cached by sectionKey so repeated
 * drops reprise). Way up high (76–96); wide leaps glide via portamento.
 */
export const genNCRLead: PartGenerator = (ctx) => {
  const inst = ctx.cfg.instruments.lead;
  if (!inst) return null;
  const rng = ctx.rng('melody');
  const program = rng.pick(NCR_LEAD_PROGRAMS); // per-seed lead timbre
  const unit = 2 * ctx.barTicks;
  const cache = new Map<string, NoteEvent[]>();
  const notes: NoteEvent[] = [];

  for (const section of ctx.sections) {
    const secStart = section.startBar * ctx.barTicks;
    const secTicks = section.bars * ctx.barTicks;

    const cached = cache.get(sectionKey(section));
    if (cached) {
      notes.push(...cached.map((n) => ({ ...n, start: n.start + secStart })));
      continue;
    }

    const units = Math.ceil(section.bars / 2);
    const phraseA = ncrPhrase(rng, ctx, secStart);
    const phraseB = ncrPhrase(rng, ctx, secStart);
    const secNotes: NoteEvent[] = [];
    for (let u = 0; u < units; u++) {
      const uStart = u * unit;
      const ph = u % 4 === 2 ? phraseB : phraseA;
      for (const n of ph) {
        if (uStart + n.start >= secTicks) continue;
        secNotes.push({ ...n, start: uStart + n.start });
      }
    }
    cache.set(sectionKey(section), secNotes);
    notes.push(...secNotes.map((n) => ({ ...n, start: n.start + secStart })));
  }
  return { name: inst.name, channel: 0, program, role: 'lead', notes };
};

// ── Genre config ─────────────────────────────────────────────────────────────

export const NIGHTCORERUN: GenreConfig = {
  id: 'nightcorerun',
  name: 'Nightcore Run',
  naming: {
    patterns: [
      { w: 3, v: '{adj} {noun} ♥' },
      { w: 2, v: '{adj} {noun}!!' },
      { w: 2, v: 'ETERNAL {noun} ☆' },
      { w: 1, v: '{noun} {noun2} (opening)' },
    ],
    words: {
      adj: ['crimson', 'eternal', 'shattered', 'radiant', 'fated', 'midnight', 'azure', 'blazing', 'silver', 'last'],
      noun: ['requiem', 'resolve', 'horizon', 'crusade', 'oath', 'destiny', 'storm', 'wings', 'velocity', 'genesis'],
    },
  },
  bpm: [165, 190],
  timeSig: [4, 4],
  keys: [
    { w: 3, v: 9 }, // A
    { w: 2, v: 4 }, // E
    { w: 2, v: 2 }, // D
    { w: 2, v: 11 }, // B
    { w: 1, v: 6 }, // F#
  ],
  modes: [
    { w: 2, v: 'naturalMinor' },
    { w: 2, v: 'harmonicMinor' }, // raised leading-tone drama
  ],
  swing: [0, 0],
  structures: [
    // Anime-opening arc on the shared rhythm-game skeleton.
    {
      w: 2,
      v: [
        { name: 'intro', bars: 8 },
        { name: 'build', bars: 4 },
        { name: 'drop', bars: 8 },
        { name: 'break', bars: 8 },
        { name: 'drop', bars: 8 },
      ],
    },
    {
      w: 1,
      v: [
        { name: 'intro', bars: 4 },
        { name: 'drop', bars: 8 },
        { name: 'break', bars: 8 },
        { name: 'build', bars: 4 },
        { name: 'drop', bars: 8 },
      ],
    },
    {
      // Double-build tension stacker.
      w: 1,
      v: [
        { name: 'intro', bars: 4 },
        { name: 'build', bars: 4 },
        { name: 'drop', bars: 8 },
        { name: 'build', bars: 4 },
        { name: 'drop', bars: 8 },
      ],
    },
    {
      // Long opener, single huge chorus, verse, final chorus.
      w: 1,
      v: [
        { name: 'intro', bars: 8 },
        { name: 'drop', bars: 16 },
        { name: 'break', bars: 8 },
        { name: 'build', bars: 4 },
        { name: 'drop', bars: 16 },
      ],
    },
    {
      // Two verses between choruses.
      w: 1,
      v: [
        { name: 'intro', bars: 4 },
        { name: 'build', bars: 4 },
        { name: 'drop', bars: 8 },
        { name: 'break', bars: 8 },
        { name: 'build', bars: 4 },
        { name: 'drop', bars: 8 },
      ],
    },
  ],
  progressions: [
    // Royal Road and metal/anime minor squares (major dominant ends some).
    { w: 3, v: [{ degree: 0, beats: 4 }, { degree: 5, beats: 4 }, { degree: 2, beats: 4 }, { degree: 6, beats: 4 }] }, // i–VI–III–VII
    { w: 2, v: [{ degree: 0, beats: 4 }, { degree: 5, beats: 4 }, { degree: 3, beats: 4 }, { degree: 4, beats: 4 }] }, // i–VI–iv–V
    { w: 2, v: [{ degree: 0, beats: 4 }, { degree: 6, beats: 4 }, { degree: 5, beats: 4 }, { degree: 4, beats: 4 }] }, // i–VII–VI–V
    { w: 1, v: [{ degree: 0, beats: 4 }, { degree: 3, beats: 4 }, { degree: 4, beats: 4 }, { degree: 4, beats: 4 }] }, // i–iv–V–V
  ],
  distinctProgressions: true,
  melody: {
    register: [76, 96], // the pitched-up anime vocal / shred register
    density: 0.7,
    leapProb: 0.3,
    restProb: 0.05,
    syncopation: 0.4,
  },
  bass: { style: 'chug', register: [33, 50] }, // picked metal bass, doubles the guitar
  comping: { register: [60, 84], style: 'sustained' }, // orchestral strings bed
  arp: { register: [40, 64], rate: 8 }, // rhythm guitar power-chord register
  drums: { patterns: [{ w: 1, v: NCR_KIT }], fillEvery: 8 },
  instruments: {
    lead: { program: 49, name: 'Symphonic Lead' }, // makeSymphonicLead (hall reverb)
    chords: { program: 48, name: 'Strings' }, // GM Strings (makeStrings section)
    arp: { program: 30, name: 'Power Guitar' }, // makePowerGuitar (distortion, double-tracked)
    bass: { program: 34, name: 'Metal Bass' }, // makeMetalBass (picked + overdrive)
    drums: { program: 0, name: 'Metal Kit' },
  },
  arrange: {
    // Emotional swing: orchestral intro → guitar build → wall-of-sound drop →
    // verse valley (no guitars) → drop.
    layers: {
      intro: ['lead', 'chords'], // piano/strings + pitched lead, no rhythm section
      build: ['arp', 'bass', 'drums', 'chords'],
      drop: 'all',
      break: ['bass', 'chords'], // rhythm guitars gone; bass + symphonic pad
    },
    sectionVelocity: { intro: 0.72, build: 0.9, break: 0.78, drop: 1.05 },
  },
  // Beatmap grid: zero timing jitter; velocity breathes for a "live" drummer.
  humanize: { timingTicks: 0, velocity: 0.08 },
  hooks: {
    arp: genNCRGuitar,
    drums: genNCRDrums,
    melody: genNCRLead,
  },
};
