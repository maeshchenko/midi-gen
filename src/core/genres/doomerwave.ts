import { PPQ, sectionKey, type NoteEvent } from '../types';
import type { GenreConfig, PartGenerator, StepPattern } from './types';
import { closeVoicing } from '../theory/chords';

/**
 * Doomerwave: Russian darkwave / post-punk — the "ВАЗ ночью" aesthetic
 * (doomer driving). Joy Division / The Cure / Молчат Дома: a cold drum machine
 * holding a mechanical 4/4, a melodic galloping bass leading the line, clean
 * chorused guitar arpeggios, a glassy ostinato synth lead, grey cold-wave pads,
 * minor-key bleakness drowned in chorus + tape hiss.
 *
 * This is the STANDARD (song-form) version — intro → verse → pre-chorus →
 * chorus → outro, layers thinning to a bare looping bass in the outro
 * (loop-safe, no hard cut — invariant #8). The rhythm-game sibling with the
 * same palette but the beatmap arc is `doomerrun`.
 */

// ── Shared post-punk palette (also consumed by doomerrun) ────────────────────

const DW_PULSE: StepPattern = {
  name: 'dw-pulse',
  // Four-on-the-floor machine, snare backbeat on 2 & 4, even eighth hats.
  kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  hatClosed: [0.6, 0, 0.4, 0, 0.6, 0, 0.4, 0, 0.6, 0, 0.4, 0, 0.6, 0, 0.4, 0],
};

const DW_DISCO: StepPattern = {
  name: 'dw-disco',
  // Disco-rock variant: kick on 1, 3 and the classic "and of 3" syncopation.
  kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0.7, 0, 0, 0, 0],
  snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  hatClosed: [0.6, 0, 0.4, 0, 0.6, 0, 0.4, 0, 0.6, 0, 0.4, 0, 0.6, 0, 0.4, 0],
  hatOpen: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0], // offbeat upbeat
};

export const DW_NAMING: GenreConfig['naming'] = {
  // Translit CAPS — Молчат-Дома bleakness without Cyrillic.
  patterns: [
    { w: 3, v: '{adj} {noun}' },
    { w: 2, v: '{noun} {noun2}' },
    { w: 2, v: 'POSLEDNIY {noun}' },
    { w: 1, v: '{noun} NOCHYU' },
  ],
  words: {
    adj: ['SERY', 'PUSTOY', 'KHOLODNY', 'POSLEDNIY', 'NOCHNOY', 'BETONNY', 'MERTVY', 'TIKHIY', 'TYOMNY'],
    noun: ['SUDNO', 'VOLNY', 'ETAZHI', 'BETON', 'NOCH', 'GOROD', 'PANELI', 'TRAMVAY', 'OKNO', 'DOZHD', 'ZIMA', 'TUMAN'],
  },
};

export const DW_KEYS = [
  { w: 3, v: 4 }, // E — the Em signature (Volny)
  { w: 2, v: 9 }, // A
  { w: 2, v: 2 }, // D
  { w: 1, v: 11 }, // B
  { w: 1, v: 6 }, // F#
];

// Exclusively natural minor (Aeolian) per spec.
export const DW_MODES = [{ w: 1, v: 'naturalMinor' as const }];

// Descending minor squares, one chord per bar (beats 4), last chord loops home.
export const DW_PROGRESSIONS: GenreConfig['progressions'] = [
  { w: 3, v: [{ degree: 0, beats: 4 }, { degree: 6, beats: 4 }, { degree: 5, beats: 4 }, { degree: 4, beats: 4 }] }, // i–VII–VI–V
  { w: 3, v: [{ degree: 0, beats: 4 }, { degree: 5, beats: 4 }, { degree: 2, beats: 4 }, { degree: 6, beats: 4 }] }, // i–VI–III–VII
  { w: 2, v: [{ degree: 0, beats: 4 }, { degree: 6, beats: 4 }, { degree: 5, beats: 4 }, { degree: 6, beats: 4 }] }, // i–VII–VI–VII
  { w: 2, v: [{ degree: 0, beats: 4 }, { degree: 4, beats: 4 }, { degree: 5, beats: 4 }, { degree: 6, beats: 4 }] }, // i–v–VI–VII
  { w: 1, v: [{ degree: 0, beats: 8 }, { degree: 5, beats: 8 }] }, // i–VI drone
];

export const DW_INSTRUMENTS: GenreConfig['instruments'] = {
  lead: { program: 88, name: 'Cold Synth' }, // mono square + portamento (makeColdLead)
  chords: { program: 91, name: 'Cold Pad' }, // slow saw pad + chorus (makeColdPad)
  arp: { program: 27, name: 'Clean Guitar' }, // chorused clean guitar (makeCleanGuitar)
  bass: { program: 33, name: 'Picked Bass' }, // picked post-punk bass + chorus (makePostPunkBass)
  drums: { program: 0, name: 'Drum Machine' },
};

// ── Shared hooks ─────────────────────────────────────────────────────────────

const NAT_MINOR = [0, 2, 3, 5, 7, 8, 10]; // semitone offsets — the only scale
// Sad minor ostinato motifs (3–4 notes), as scale-degree semitone offsets.
const MOTIFS = [
  [0, 3, 2, 0],
  [7, 8, 7, 3],
  [0, 7, 5, 3],
  [3, 2, 0, -2],
  [0, -2, -4, -5],
  [0, 3, 5, 7],
  [7, 5, 3, 2],
  [0, 5, 3, 0],
  [12, 10, 8, 7],
  [0, 2, 3, 2],
];
// Onset layouts for a 2-bar unit, in EIGHTH-note slots (0..15) + length.
const LEAD_RHYTHMS: { o: number; d: number }[][] = [
  [{ o: 0, d: 4 }, { o: 4, d: 4 }, { o: 8, d: 4 }, { o: 12, d: 4 }], // half notes
  [{ o: 0, d: 8 }, { o: 8, d: 8 }], // two whole notes (sparse, brooding)
  [{ o: 0, d: 2 }, { o: 2, d: 2 }, { o: 8, d: 2 }, { o: 10, d: 2 }], // quarter pairs
  [{ o: 0, d: 3 }, { o: 3, d: 5 }, { o: 8, d: 3 }, { o: 11, d: 5 }], // dotted syncopation
  [{ o: 0, d: 4 }, { o: 6, d: 2 }, { o: 8, d: 4 }, { o: 14, d: 2 }], // long + pickup
];

const clampReg = (p: number, lo: number, hi: number): number => {
  while (p > hi) p -= 12;
  while (p < lo) p += 12;
  return p;
};

/**
 * Ostinato lead: a 3–4 note minor motif over a chosen rhythm, repeated every 2
 * bars within a section — but EACH SECTION draws its own motif, rhythm and
 * octave (cached by sectionKey so repeated drops/choruses reprise). The
 * hypnotic Молчат-Дома hook without being one idea for the whole track. Pitches
 * are fixed against the TONIC, so the moving harmony creates tension; the audio
 * voice's portamento glides between them.
 */
export const genDoomerLead: PartGenerator = (ctx) => {
  const inst = ctx.cfg.instruments.lead;
  if (!inst) return null;
  const rng = ctx.rng('melody');
  const [lo, hi] = ctx.cfg.melody.register;
  const eighth = PPQ / 2;
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

    const motif = rng.pick(MOTIFS);
    const rhythm = rng.pick(LEAD_RHYTHMS);
    // Octave lift for higher-energy sections (chorus/drop sit a register up).
    const octave = (section.name === 'chorus' || section.name === 'drop') && rng.chance(0.6) ? 12 : 0;
    const base = clampReg(ctx.key.tonic + octave, lo, hi - 12 < lo ? lo : lo + 4);
    const secNotes: NoteEvent[] = [];

    const units = Math.ceil(section.bars / 2);
    for (let u = 0; u < units; u++) {
      const uStart = u * unit;
      for (let k = 0; k < rhythm.length; k++) {
        const slot = rhythm[k]!;
        const onset = uStart + slot.o * eighth;
        if (onset >= secTicks) continue;
        let deg = motif[k % motif.length]!;
        if (k === rhythm.length - 1 && u % 4 === 3) deg += NAT_MINOR[1]!; // late-unit nudge
        const dur = Math.min(slot.d * eighth - 10, secTicks - onset);
        secNotes.push({
          pitch: clampReg(base + deg, lo, hi),
          start: onset,
          dur: Math.max(30, dur),
          vel: k === 0 ? 100 : 90,
        });
      }
    }
    cache.set(sectionKey(section), secNotes);
    notes.push(...secNotes.map((n) => ({ ...n, start: n.start + secStart })));
  }
  return { name: inst.name, channel: 0, program: inst.program, role: 'lead', notes };
};

/** Arpeggio cycle order for a guitar voicing. */
function gtrCycle(shape: 'up' | 'down' | 'updown' | 'pedal', voicing: number[]): number[] {
  switch (shape) {
    case 'down':
      return [...voicing].reverse();
    case 'updown':
      return voicing.length > 2 ? [...voicing, ...voicing.slice(1, -1).reverse()] : voicing;
    case 'pedal': {
      const top = voicing[voicing.length - 1]!;
      const out: number[] = [];
      for (const p of voicing.slice(0, -1)) out.push(top, p);
      return out.length ? out : voicing;
    }
    default:
      return voicing;
  }
}

/**
 * Clean post-punk guitar (the 'arp' role): each calm section draws its own
 * picking shape (ascending / descending / up-down arpeggio, top-note pedal, or
 * on-beat chord stabs) — ringing into delay/reverb; peak sections (chorus/drop)
 * switch to 1/16 tremolo on the top chord tone for rising tension.
 */
export const genDoomerGuitar: PartGenerator = (ctx) => {
  const inst = ctx.cfg.instruments.arp;
  if (!inst) return null;
  const rng = ctx.rng('comping');
  const [lo, hi] = ctx.cfg.arp?.register ?? [72, 91];
  const eighth = PPQ / 2;
  const s16 = PPQ / 4;
  const notes: NoteEvent[] = [];

  type Shape = 'up' | 'down' | 'updown' | 'pedal' | 'stabs';
  const SHAPES: Shape[] = ['up', 'down', 'updown', 'pedal', 'stabs'];
  const shapeByName = new Map<string, Shape>();
  const sectionNameAt = (tick: number): string => {
    for (let i = ctx.sections.length - 1; i >= 0; i--) {
      const s = ctx.sections[i]!;
      if (tick >= s.startBar * ctx.barTicks) return s.name;
    }
    return ctx.sections[0]!.name;
  };
  const shapeFor = (name: string): Shape => {
    let sh = shapeByName.get(name);
    if (!sh) {
      sh = rng.pick(SHAPES);
      shapeByName.set(name, sh);
    }
    return sh;
  };

  for (const span of ctx.chords) {
    const name = sectionNameAt(span.start);
    const peak = name === 'chorus' || name === 'drop';
    const voicing = closeVoicing(span.chord, lo).filter((p) => p <= hi);
    if (voicing.length === 0) continue;
    const top = voicing[voicing.length - 1]!;

    if (peak) {
      // Tremolo picking on the top note.
      const count = Math.floor(span.dur / s16);
      for (let i = 0; i < count; i++) {
        notes.push({ pitch: top, start: span.start + i * s16, dur: s16, vel: i % 4 === 0 ? 78 : 66 });
      }
      continue;
    }

    const shape = shapeFor(name);
    if (shape === 'stabs') {
      const beats = Math.floor(span.dur / ctx.beatTicks);
      for (let b = 0; b < beats; b++) {
        const start = span.start + b * ctx.beatTicks;
        for (const pitch of voicing) {
          notes.push({ pitch, start, dur: Math.floor(ctx.beatTicks * 0.5), vel: b % 2 === 0 ? 72 : 60 });
        }
      }
    } else {
      const seq = gtrCycle(shape, voicing);
      const count = Math.floor(span.dur / eighth);
      for (let i = 0; i < count; i++) {
        notes.push({
          pitch: seq[i % seq.length]!,
          start: span.start + i * eighth,
          dur: eighth * 2, // overlap → delay/reverb wash
          vel: i % seq.length === 0 ? 74 : 62,
        });
      }
    }
  }
  return { name: inst.name, channel: 0, program: inst.program, role: 'arp', notes };
};

// ── Genre config (song form) ─────────────────────────────────────────────────

export const DOOMERWAVE: GenreConfig = {
  id: 'doomerwave',
  name: 'Doomerwave',
  naming: DW_NAMING,
  bpm: [110, 132],
  timeSig: [4, 4],
  keys: DW_KEYS,
  modes: DW_MODES,
  swing: [0, 0],
  structures: [
    {
      w: 2,
      v: [
        { name: 'intro', bars: 8 },
        { name: 'verse', bars: 16 },
        { name: 'prechorus', bars: 4 },
        { name: 'chorus', bars: 16 },
        { name: 'verse', bars: 16 },
        { name: 'chorus', bars: 16 },
        { name: 'outro', bars: 8 },
      ],
    },
    {
      w: 1,
      v: [
        { name: 'intro', bars: 8 },
        { name: 'verse', bars: 16 },
        { name: 'chorus', bars: 16 },
        { name: 'prechorus', bars: 4 },
        { name: 'chorus', bars: 16 },
        { name: 'outro', bars: 8 },
      ],
    },
  ],
  progressions: DW_PROGRESSIONS,
  distinctProgressions: true,
  melody: {
    register: [64, 79], // cold ostinato synth
    density: 0.4,
    leapProb: 0.1,
    restProb: 0.2,
    syncopation: 0.15,
  },
  bass: { style: 'gallop', register: [33, 57] }, // melodic galloping post-punk bass (root + octave pops)
  comping: { register: [52, 72], style: 'sustained' }, // cold-wave pad
  arp: { register: [72, 91], rate: 4 }, // clean guitar (genDoomerGuitar hook)
  drums: {
    patterns: [
      { w: 2, v: DW_PULSE },
      { w: 1, v: DW_DISCO },
    ],
    fillEvery: 8,
    fillStyle: 'toms',
  },
  instruments: DW_INSTRUMENTS,
  arrange: {
    // Hypnotic layering: bare bass+drums → guitar → +lead → full chorus → bass.
    layers: {
      // Intro sets the melancholy first: cold pad + ringing guitar over the
      // beat, no lead yet. Verse cools (synths drop) for the "vocal" space.
      intro: ['bass', 'drums', 'arp', 'chords'],
      verse: ['bass', 'drums', 'arp'],
      prechorus: ['bass', 'drums', 'arp', 'lead'],
      chorus: 'all',
      outro: ['bass'], // loop-safe thin outro: bass alone leads back to bar 1
    },
    sectionVelocity: { intro: 0.72, verse: 0.85, prechorus: 0.92, chorus: 1.0, outro: 0.68 },
  },
  // Mechanical drum machine — strictly on the grid; velocity barely breathes.
  humanize: { timingTicks: 0, velocity: 0.04 },
  hooks: {
    melody: genDoomerLead,
    arp: genDoomerGuitar,
  },
};
