import { DRUM_CHANNEL, sectionKey, type NoteEvent } from '../types';
import { GM_DRUMS } from '../gen/drums';
import type { GenreConfig, PartGenerator, StepPattern } from './types';

/**
 * Medieval — calm, atmospheric underscore for a Tower-Defence game (Kingdom-Rush
 * setting), built to loop for a long time without tiring the player. A warm
 * string pad and a sustained low-cello drone hold the harmony, a gentle flute
 * carries a sparse pennywhistle tune, and soft tabor percussion only enters for
 * the busier "wave" sections — the calm verses run drum-free. 88–104 BPM, 4/4.
 */

// Soft tabor: a quiet heartbeat on beats 1 and 3, a light quarter-note pulse.
// No backbeat snare — kept gentle so it never dominates the loop.
const SOFT_TABOR: StepPattern = {
  name: 'soft-tabor',
  kick: [0.5, 0, 0, 0, 0, 0, 0, 0, 0.42, 0, 0, 0, 0, 0, 0, 0],
  snare: [],
  hatClosed: [0.22, 0, 0, 0, 0.18, 0, 0, 0, 0.22, 0, 0, 0, 0.18, 0, 0, 0],
};

// Marching tabor: still soft, a touch more motion for the wave sections — a
// frame-drum pickup before the downbeat plus a light tambourine on 2 and 4.
// Lanes are reinterpreted by the medievalDrums hook: snare→low frame drum,
// hatClosed→high frame tap, hatOpen→tambourine jingle.
const MARCH_TABOR: StepPattern = {
  name: 'march-tabor',
  kick: [0.55, 0, 0, 0, 0, 0, 0.4, 0, 0.5, 0, 0, 0, 0, 0, 0.4, 0],
  snare: [0, 0, 0, 0, 0.4, 0, 0, 0, 0, 0, 0, 0, 0.4, 0, 0, 0],
  hatClosed: [0.2, 0, 0.16, 0, 0, 0, 0.16, 0, 0.2, 0, 0.16, 0, 0, 0, 0.16, 0],
  hatOpen: [0, 0, 0, 0, 0.3, 0, 0, 0, 0, 0, 0, 0, 0.3, 0, 0, 0],
};

/**
 * Membrane-only medieval percussion. Replaces the default drum generator so the
 * hardcoded section-start crash and the noise-snare/hi-hat never fire. Each
 * StepPattern lane is rerouted onto a MEMBRANE GM pitch (or the tambourine),
 * and makeMedievalKit in the audio layer turns those into a tabor + frame drum.
 */
const LANE_TO_GM: Record<'kick' | 'snare' | 'hatClosed' | 'hatOpen', number> = {
  kick: GM_DRUMS.kick, // deep tabor
  snare: GM_DRUMS.tomLow, // low frame drum "doum"
  hatClosed: GM_DRUMS.tomHigh, // high frame tap "tek"
  hatOpen: GM_DRUMS.tambourine, // jingle accent
};

const PERC_STEPS = 16;

const medievalDrums: PartGenerator = (ctx) => {
  const inst = ctx.cfg.instruments.drums;
  if (!inst) return null;
  const rng = ctx.rng('drums');
  const stepTicks = ctx.barTicks / PERC_STEPS;
  const patternByName = new Map<string, StepPattern>();
  const notes: NoteEvent[] = [];

  for (const section of ctx.sections) {
    let pattern = patternByName.get(sectionKey(section));
    if (!pattern) {
      pattern = rng.weighted(ctx.cfg.drums.patterns);
      patternByName.set(sectionKey(section), pattern);
    }

    for (let bar = 0; bar < section.bars; bar++) {
      const barStart = (section.startBar + bar) * ctx.barTicks;
      const isFillBar = (bar + 1) % ctx.cfg.drums.fillEvery === 0 || bar === section.bars - 1;
      const skipFrom = isFillBar ? 12 : PERC_STEPS;

      for (const lane of ['kick', 'snare', 'hatClosed', 'hatOpen'] as const) {
        const accents = pattern[lane];
        if (!accents) continue;
        for (let s = 0; s < skipFrom; s++) {
          const a = accents[s] ?? 0;
          if (a <= 0) continue;
          if (a < 1 && rng.chance(0.08)) continue; // gentle humanizing dropout
          notes.push({
            pitch: LANE_TO_GM[lane],
            start: barStart + s * stepTicks,
            dur: Math.max(30, Math.floor(stepTicks / 2)),
            vel: Math.min(110, Math.round(38 + a * 58) + rng.int(-3, 3)),
          });
        }
      }

      // Soft frame-drum fill: a hi→mid→low hand-drum run into the next downbeat.
      if (isFillBar) {
        const run = [GM_DRUMS.tomHigh, GM_DRUMS.tomMid, GM_DRUMS.tomLow, GM_DRUMS.kick];
        for (let i = 0; i < 4; i++) {
          notes.push({
            pitch: run[i]!,
            start: barStart + (12 + i) * stepTicks,
            dur: Math.max(30, Math.floor(stepTicks / 2)),
            vel: 48 + i * 8,
          });
        }
      }
    }
  }

  return { name: inst.name, channel: DRUM_CHANNEL, program: inst.program, role: 'drums', notes };
};

export const MEDIEVAL: GenreConfig = {
  id: 'medieval',
  name: 'Medieval',
  naming: {
    patterns: [
      { w: 3, v: 'Siege of {place}' },
      { w: 3, v: 'March of the {noun}' },
      { w: 2, v: 'The {adj} {noun}' },
      { w: 2, v: '{adj} {place}' },
      { w: 1, v: 'Defense of {place}' },
    ],
    words: {
      adj: ['Iron', 'Forgotten', 'Last', 'Crimson', 'Ashen', 'Eternal', 'Broken', 'Hallowed', 'Wandering', 'Frostbound'],
      noun: ['Banner', 'Vanguard', 'Crusade', 'Watch', 'Order', 'Legion', 'Wardens', 'Templars', 'Kingsguard', 'Host'],
      place: ['Greymoor', 'the Northgate', 'Blackspire', 'Thornwall', 'the Iron Keep', 'Ravenholt', 'Stormhaven', 'the Old Bridge', 'Highrock', 'the Frozen Pass'],
    },
  },
  bpm: [88, 104],
  timeSig: [4, 4],
  keys: [
    { w: 3, v: 2 }, // D
    { w: 3, v: 9 }, // A
    { w: 2, v: 7 }, // G
    { w: 2, v: 4 }, // E
    { w: 1, v: 0 }, // C
  ],
  modes: [
    { w: 3, v: 'dorian' }, // wistful, pastoral medieval colour
    { w: 2, v: 'mixolydian' }, // gentle heroic lift
    { w: 2, v: 'naturalMinor' }, // calm, melancholy
  ],
  swing: [0, 0],
  // Through-composed forms (~48–56 bars ≈ 2 min) with several DISTINCT named
  // sections. Each name (A/B/C/bridge) caches its own melody + gets its own
  // progression (distinctProgressions), so the piece develops and recapitulates
  // like a game score instead of looping one 10-second phrase. intro/outro are
  // edges (not repeated when the user stretches with the minutes flag).
  structures: [
    {
      w: 2,
      v: [
        { name: 'intro', bars: 4 },
        { name: 'A', bars: 8 },
        { name: 'B', bars: 8 },
        { name: 'C', bars: 8 },
        { name: 'A', bars: 8 },
        { name: 'B', bars: 8 },
        { name: 'C', bars: 8 },
        { name: 'outro', bars: 4 },
      ],
    },
    {
      w: 2,
      v: [
        { name: 'intro', bars: 4 },
        { name: 'A', bars: 8 },
        { name: 'B', bars: 8 },
        { name: 'A', bars: 8 },
        { name: 'bridge', bars: 8 },
        { name: 'C', bars: 8 },
        { name: 'A', bars: 8 },
        { name: 'outro', bars: 4 },
      ],
    },
    {
      w: 1,
      v: [
        { name: 'intro', bars: 4 },
        { name: 'A', bars: 8 },
        { name: 'B', bars: 8 },
        { name: 'C', bars: 8 },
        { name: 'bridge', bars: 8 },
        { name: 'A', bars: 8 },
        { name: 'B', bars: 8 },
        { name: 'outro', bars: 4 },
      ],
    },
  ],
  distinctProgressions: true, // each section name gets its own harmony
  progressions: [
    // Pastoral dorian: i–IV–i–VII (the bright dorian IV, no leading tone).
    {
      w: 3,
      v: [
        { degree: 0, beats: 4 },
        { degree: 3, beats: 4 },
        { degree: 0, beats: 4 },
        { degree: 6, beats: 4 },
      ],
    },
    // Gentle lift: I–V–vi–IV.
    {
      w: 2,
      v: [
        { degree: 0, beats: 4 },
        { degree: 4, beats: 4 },
        { degree: 5, beats: 4 },
        { degree: 3, beats: 4 },
      ],
    },
    // Calm two-chord sway: i–VII held long.
    {
      w: 2,
      v: [
        { degree: 0, beats: 8 },
        { degree: 6, beats: 8 },
      ],
    },
    // Melancholy descent: i–VII–VI–VII.
    {
      w: 2,
      v: [
        { degree: 0, beats: 4 },
        { degree: 6, beats: 4 },
        { degree: 5, beats: 4 },
        { degree: 6, beats: 4 },
      ],
    },
    // Rising bridge: VI–VII–i–v (lifts then resolves).
    {
      w: 2,
      v: [
        { degree: 5, beats: 4 },
        { degree: 6, beats: 4 },
        { degree: 0, beats: 4 },
        { degree: 4, beats: 4 },
      ],
    },
    // Wandering: i–v–VI–III (modal, wistful).
    {
      w: 1,
      v: [
        { degree: 0, beats: 4 },
        { degree: 4, beats: 4 },
        { degree: 5, beats: 4 },
        { degree: 2, beats: 4 },
      ],
    },
    // Plagal sway: i–iv–i–IV.
    {
      w: 1,
      v: [
        { degree: 0, beats: 4 },
        { degree: 3, beats: 4 },
        { degree: 0, beats: 4 },
        { degree: 3, beats: 4 },
      ],
    },
  ],
  melody: {
    register: [72, 88], // flute / pennywhistle, comfortable middle range
    density: 0.36, // sparse and breathy — lots of space between phrases
    leapProb: 0.18, // mostly stepwise, singable
    restProb: 0.14,
    syncopation: 0.05, // sits calmly on the grid
  },
  bass: { style: 'sustain', register: [33, 50] }, // sustained low-cello drone
  comping: { register: [52, 74], style: 'sustained' }, // warm string pad
  drums: {
    patterns: [
      { w: 3, v: SOFT_TABOR },
      { w: 1, v: MARCH_TABOR },
    ],
    fillEvery: 16, // almost never — calm music doesn't want drum fills
  },
  instruments: {
    lead: { program: 73, name: 'Flute' }, // pennywhistle voice
    bass: { program: 42, name: 'Cello' }, // real-sample sustained drone
    chords: { program: 48, name: 'Strings' }, // real-sample warm pad
    drums: { program: 116, name: 'Soft Tabor' },
  },
  arrange: {
    // Dynamic arc so the loop breathes: quiet open, themes with gentle tabor,
    // a fuller bridge lift, a wound-down outro.
    layers: {
      intro: ['chords', 'bass'], // pad and drone open quietly, drums hold back
      A: ['chords', 'bass', 'lead', 'drums'], // main theme, soft tabor
      B: ['chords', 'bass', 'lead', 'drums'], // contrasting theme
      C: 'all', // fullest section
      bridge: 'all', // the lift
      outro: ['chords', 'bass'], // wind down, drums drop out
    },
    sectionVelocity: { intro: 0.75, A: 0.85, B: 0.85, C: 0.95, bridge: 0.92, outro: 0.7 },
  },
  humanize: { timingTicks: 8, velocity: 0.14 },
  hooks: { drums: medievalDrums }, // membrane-only kit, no crash/snare/hi-hat
};
