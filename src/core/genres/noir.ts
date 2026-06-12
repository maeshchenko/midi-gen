import type { GenreConfig, PartGenerator } from './types';
import type { NoteEvent } from '../types';
import { DRUM_CHANNEL, PPQ } from '../types';
import { inScale, mod12 } from '../theory/scales';
import { closeVoicing } from '../theory/chords';
import { GM_DRUMS } from '../gen/drums';

/**
 * Cinematic Noir / Dark Jazz, rebuilt to spec (2026-06-12): 60–80 BPM, hard
 * swing (~66%), blues-scale soloist with rubato (10–40ms behind the beat)
 * playing 2–3 bar phrases separated by silence, drop-2 jazz voicings strummed
 * 10–20ms per note, brushes-and-dark-ride texture drums (kick vel < 50),
 * sparse-then-walking upright bass with accents on 2 & 4.
 *
 * Structure: intro (ambience + lone bass) → A → development (denser, triplet
 * runs up high) → B → outro (instruments stop one by one; the soloist's last
 * note rings into the reverb). No fade-out — the near-empty outro loops into
 * the near-empty intro over continuous rain/vinyl ambience (audio layer), so
 * the seam is inaudible. Tape wow, rain, vinyl, brush stirring: instruments.ts.
 */

const ticksPerMs = (bpm: number) => (PPQ * bpm) / 60000;

function placeLow(pc: number, lo: number, hi: number): number {
  for (let p = lo; p <= hi; p++) {
    if (mod12(p) === pc) return p;
  }
  return lo;
}

function nearestPc(pc: number, around: number, lo: number, hi: number): number {
  let best = placeLow(pc, lo, hi);
  for (let p = lo; p <= hi; p++) {
    if (mod12(p) === pc && Math.abs(p - around) < Math.abs(best - around)) best = p;
  }
  return best;
}

/** Texture drums: quiet thumping kick, brush slaps on 2 & 4, dark swing ride. */
const genNoirDrums: PartGenerator = (ctx) => {
  const inst = ctx.cfg.instruments.drums;
  if (!inst) return null;
  const rng = ctx.rng('drums');
  const beat = ctx.beatTicks;
  const notes: NoteEvent[] = [];

  for (const section of ctx.sections) {
    if (section.name === 'outro') continue;
    const sStart = section.startBar * ctx.barTicks;
    for (let bar = 0; bar < section.bars; bar++) {
      const b0 = sStart + bar * ctx.barTicks;

      // Dull kick, barely there — an acoustic push under the bass.
      // The very first bar stays empty: opening on a thump hits too hard —
      // the track fades in from pure ambience (user feedback 2026-06-12).
      const firstBar = section.name === 'intro' && bar === 0;
      if (!firstBar && rng.chance(section.name === 'intro' ? 0.7 : 0.85)) {
        notes.push({ pitch: GM_DRUMS.kick, start: b0, dur: 200, vel: rng.int(38, 48) });
      }
      if (section.name === 'intro') continue;

      // Brush slaps strictly on 2 and 4, vel 40–60.
      notes.push(
        { pitch: GM_DRUMS.snare, start: b0 + beat, dur: 120, vel: rng.int(40, 60) },
        { pitch: GM_DRUMS.snare, start: b0 + 3 * beat, dur: 120, vel: rng.int(40, 60) },
      );

      // Classic jazz ride: quarter, swing-eighths, quarter, swing-eighths.
      for (let q = 0; q < 4; q++) {
        notes.push({ pitch: GM_DRUMS.ride, start: b0 + q * beat, dur: 200, vel: rng.int(48, 56) });
        if (q === 1 || q === 3) {
          // Offbeat 8th — humanize's swing pushes it to the triplet position.
          notes.push({ pitch: GM_DRUMS.ride, start: b0 + q * beat + beat / 2, dur: 140, vel: rng.int(34, 42) });
        }
      }

      if (section.name === 'dev' && rng.chance(0.25)) {
        notes.push({ pitch: GM_DRUMS.snare, start: b0 + rng.pick([1.5, 2.5, 3.5]) * beat, dur: 80, vel: rng.int(22, 32) });
      }
    }
  }

  return { name: inst.name, channel: DRUM_CHANNEL, program: inst.program, role: 'drums', notes };
};

/** Bass: lone tonic in the intro, sparse in A, walking with 2&4 accents in dev/B. */
const genNoirBass: PartGenerator = (ctx) => {
  const inst = ctx.cfg.instruments.bass;
  if (!inst) return null;
  const rng = ctx.rng('bass');
  const [lo, hi] = ctx.cfg.bass.register;
  const beat = ctx.beatTicks;
  const notes: NoteEvent[] = [];
  let prev = placeLow(ctx.key.tonic, lo, hi);

  for (const section of ctx.sections) {
    if (section.name === 'outro') continue;
    const sStart = section.startBar * ctx.barTicks;

    for (let bar = 0; bar < section.bars; bar++) {
      const b0 = sStart + bar * ctx.barTicks;
      const chord = ctx.chordAt(b0);

      if (section.name === 'intro') {
        // The lone contrabass enters partway through the intro.
        if (bar >= Math.floor(section.bars / 2)) {
          notes.push({ pitch: placeLow(ctx.key.tonic, lo, hi), start: b0, dur: ctx.barTicks - 40, vel: rng.int(54, 62) });
        }
        continue;
      }

      if (section.name === 'A') {
        // Sparse: root on 1, ring half the bar; sometimes the fifth on 3.
        const root = nearestPc(chord.root, prev, lo, hi);
        prev = root;
        notes.push({ pitch: root, start: b0, dur: 2 * beat - 40, vel: rng.int(62, 72) });
        if (rng.chance(0.35)) {
          const fifth = nearestPc(chord.pitchClasses[2] ?? chord.root, prev, lo, hi);
          notes.push({ pitch: fifth, start: b0 + 2 * beat, dur: 2 * beat - 60, vel: rng.int(54, 64) });
        }
        continue;
      }

      // dev / B: walking quarters, accents on 2 and 4.
      for (let q = 0; q < 4; q++) {
        const tick = b0 + q * beat;
        const here = ctx.chordAt(tick);
        const next = ctx.chordAt(tick + beat);
        let pc: number;
        if (q === 0) pc = here.root;
        else if (q === 1) pc = here.pitchClasses[1] ?? here.root;
        else if (q === 2) pc = here.pitchClasses[2] ?? here.root;
        else if (next.root !== here.root) {
          const target = nearestPc(next.root, prev, lo, hi);
          const approach = target + (rng.chance(0.5) ? 1 : -1);
          prev = Math.min(hi, Math.max(lo, approach));
          notes.push({ pitch: prev, start: tick, dur: beat - 50, vel: rng.int(86, 94) });
          continue;
        } else pc = here.pitchClasses[3] ?? here.pitchClasses[1] ?? here.root;
        prev = nearestPc(pc, prev, lo, hi);
        const accent = q === 1 || q === 3; // 2 and 4
        notes.push({ pitch: prev, start: tick, dur: beat - 50, vel: rng.int(accent ? 84 : 72, accent ? 94 : 80) });
      }
    }
  }

  return { name: inst.name, channel: 0, program: inst.program, role: 'bass', notes };
};

/** Comping: extended chords only, drop-2 voicings, strummed, on syncopated offbeats. */
const genNoirComp: PartGenerator = (ctx) => {
  const inst = ctx.cfg.instruments.chords;
  if (!inst) return null;
  const rng = ctx.rng('comping');
  const beat = ctx.beatTicks;
  const strumTick = () => Math.round(rng.int(10, 20) * ticksPerMs(ctx.bpm));
  const notes: NoteEvent[] = [];

  for (const section of ctx.sections) {
    if (section.name === 'intro' || section.name === 'outro') continue;
    const sStart = section.startBar * ctx.barTicks;

    for (let bar = 0; bar < section.bars; bar++) {
      const b0 = sStart + bar * ctx.barTicks;
      const hitCount = section.name === 'dev' ? rng.int(2, 3) : rng.chance(0.35) ? 2 : 1;
      const positions = rng
        .shuffle([1.5, 2.5, 0.5, 2, 3])
        .slice(0, hitCount)
        .sort((a, b) => a - b);

      for (const pos of positions) {
        const tick = b0 + Math.round(pos * beat);
        const chord = ctx.chordAt(tick);
        // Drop 2: take the close voicing, drop its second-from-top an octave.
        const voicing = closeVoicing(chord, 56);
        if (voicing.length >= 4) {
          voicing[voicing.length - 2] = voicing[voicing.length - 2]! - 12;
          voicing.sort((a, b) => a - b);
        }
        const ringUntil = b0 + ctx.barTicks + beat; // hang and decay
        let strum = 0;
        for (const pitch of voicing) {
          notes.push({
            pitch,
            start: tick + strum,
            dur: Math.max(beat, ringUntil - tick - strum),
            vel: rng.int(46, 62),
          });
          strum += strumTick();
        }
      }
    }
  }

  return { name: inst.name, channel: 0, program: inst.program, role: 'chords', notes };
};

/**
 * The soloist: 2–3 bar phrases separated by 1–2 bars of silence, every note
 * dragged 10–40ms behind the grid (rubato), long ringing phrase endings,
 * triplet runs up high in the development. Blues scale over the changes.
 */
const genNoirLead: PartGenerator = (ctx) => {
  const inst = ctx.cfg.instruments.lead;
  if (!inst) return null;
  const rng = ctx.rng('melody');
  const beat = ctx.beatTicks;
  const tpm = ticksPerMs(ctx.bpm);
  const rubato = () => Math.round(rng.int(10, 40) * tpm);
  const { tonic } = ctx.key;
  const notes: NoteEvent[] = [];

  const stepScale = (p: number, dir: 1 | -1): number => {
    let q = p + dir;
    while (!inScale(q, tonic, 'blues')) q += dir;
    return q;
  };
  const clampReg = (p: number, lo: number, hi: number) => {
    while (p > hi) p -= 12;
    while (p < lo) p += 12;
    return p;
  };

  let pitch = clampReg(placeLow(tonic, 68, 80), 62, 84);

  for (const section of ctx.sections) {
    const sStart = section.startBar * ctx.barTicks;

    if (section.name === 'intro') continue;
    if (section.name === 'outro') {
      // The last word: one long note sinking into the reverb.
      const chord = ctx.chordAt(sStart);
      const last = clampReg(nearestPc(rng.chance(0.6) ? chord.root : (chord.pitchClasses[2] ?? chord.root), pitch, 62, 84), 62, 84);
      notes.push({
        pitch: last,
        start: sStart + rubato(),
        dur: Math.min(2 * ctx.barTicks, section.bars * ctx.barTicks) - beat,
        vel: 72,
      });
      continue;
    }

    const isDev = section.name === 'dev';
    const [lo, hi] = isDev ? [70, 86] : [62, 84];
    pitch = clampReg(pitch, lo, hi);

    let bar = 0;
    while (bar < section.bars) {
      const phraseLen = Math.min(rng.int(2, 3), section.bars - bar);
      for (let pb = 0; pb < phraseLen; pb++) {
        const b0 = sStart + (bar + pb) * ctx.barTicks;
        const lastBarOfPhrase = pb === phraseLen - 1;

        if (isDev && rng.chance(0.35)) {
          // Triplet run: quick climb, then settle.
          const startBeat = rng.int(0, 1);
          const count = rng.int(4, 6);
          const dir: 1 | -1 = rng.chance(0.6) ? 1 : -1;
          for (let i = 0; i < count; i++) {
            pitch = clampReg(stepScale(pitch, dir), lo, hi);
            notes.push({
              pitch,
              start: b0 + startBeat * beat + Math.round((i * beat) / 3) + rubato(),
              dur: Math.round(beat / 3) - 20,
              vel: rng.int(78, 90),
            });
          }
          continue;
        }

        // Sparse long notes: 2–4 onsets a bar, swung positions.
        const onsetCount = rng.int(2, lastBarOfPhrase ? 3 : 4);
        const slots = rng
          .shuffle([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5])
          .slice(0, onsetCount)
          .sort((a, b) => a - b);
        for (let i = 0; i < slots.length; i++) {
          const tick = b0 + Math.round(slots[i]! * beat);
          const chord = ctx.chordAt(tick);
          const strong = slots[i]! % 1 === 0;
          if (strong || rng.chance(0.3)) {
            pitch = clampReg(nearestPc(rng.pick(chord.pitchClasses), pitch, lo, hi), lo, hi);
          } else {
            pitch = clampReg(stepScale(pitch, rng.chance(0.5) ? 1 : -1), lo, hi);
          }
          const nextSlot = slots[i + 1];
          const isPhraseEnd = lastBarOfPhrase && i === slots.length - 1;
          const until = nextSlot !== undefined ? b0 + Math.round(nextSlot * beat) : b0 + ctx.barTicks;
          // Phrase endings ring on — the vibrato and the reverb take over.
          const dur = isPhraseEnd ? ctx.barTicks : Math.min(until - tick - 20, 2 * beat);
          notes.push({
            pitch,
            start: tick + rubato(),
            dur: Math.max(120, dur),
            vel: rng.int(isPhraseEnd ? 84 : 72, isPhraseEnd ? 96 : 90),
          });
        }
      }
      bar += phraseLen + rng.int(1, 2); // the silence between phrases
    }
  }

  return { name: inst.name, channel: 0, program: inst.program, role: 'lead', notes };
};

export const NOIR: GenreConfig = {
  id: 'noir',
  name: 'Noir',
  naming: {
    patterns: [
      { w: 2, v: '{adj} {noun}' },
      { w: 2, v: 'The {adj} {noun}' },
      { w: 2, v: '{noun} in {place}' },
      { w: 1, v: 'Last Train to {place}' },
      { w: 1, v: 'Smoke over {place}' },
      { w: 1, v: '{noun} & {noun2}' },
    ],
    words: {
      adj: ['Smoky', 'Velvet', 'Midnight', 'Crooked', 'Hollow', 'Bitter', 'Pale', 'Rain-Slick', 'Borrowed', 'Lonesome', 'Faded', 'Sleepless'],
      noun: ['Alley', 'Dame', 'Trenchcoat', 'Cigarette', 'Streetlight', 'Saxophone', 'Motel', 'Verdict', 'Alibi', 'Goodbye', 'Whiskey', 'Shadow'],
      place: ['Nowhere', 'the Docks', 'Room 9', 'the Last Bar', 'Union Station', 'the Rain', 'Downtown', 'the Morgue'],
    },
  },
  bpm: [60, 80],
  timeSig: [4, 4],
  keys: [
    { w: 3, v: 2 }, // D
    { w: 2, v: 7 }, // G
    { w: 2, v: 0 }, // C
    { w: 1, v: 9 }, // A
    { w: 1, v: 4 }, // E
  ],
  modes: [
    { w: 2, v: 'dorian' },
    { w: 1, v: 'naturalMinor' },
  ],
  swing: [0.85, 1], // ≈63–67% — full shuffle drag
  structures: [
    {
      w: 2,
      v: [
        { name: 'intro', bars: 2 },
        { name: 'A', bars: 8 },
        { name: 'dev', bars: 8 },
        { name: 'B', bars: 8 },
        { name: 'outro', bars: 2 },
      ],
    },
    {
      w: 1,
      v: [
        { name: 'intro', bars: 2 },
        { name: 'A', bars: 8 },
        { name: 'A', bars: 8 },
        { name: 'dev', bars: 8 },
        { name: 'B', bars: 8 },
        { name: 'outro', bars: 2 },
      ],
    },
  ],
  progressions: [
    // Extended chords only — min7/min9/ø7/dom7, never plain triads.
    {
      w: 3,
      v: [
        { degree: 0, beats: 4, seventh: true, ninth: true },
        { degree: 3, beats: 4, seventh: true },
        { degree: 1, beats: 4, quality: 'halfDim7' },
        { degree: 4, beats: 4, quality: 'dom7' },
      ],
    },
    {
      w: 2,
      v: [
        { degree: 0, beats: 8, seventh: true, ninth: true },
        { degree: 3, beats: 4, seventh: true },
        { degree: 4, beats: 4, quality: 'dom7' },
      ],
    },
    {
      w: 2,
      v: [
        { degree: 0, beats: 4, seventh: true },
        { degree: 5, beats: 4, seventh: true },
        { degree: 1, beats: 4, quality: 'halfDim7' },
        { degree: 4, beats: 4, quality: 'dom7' },
      ],
    },
  ],
  melody: {
    register: [62, 84],
    density: 0.3,
    leapProb: 0.3,
    restProb: 0.3,
    syncopation: 0.3,
    scale: 'blues', // the signature ache — used by the custom lead too
  },
  bass: { style: 'walking', register: [36, 55] },
  comping: { register: [55, 78] },
  drums: {
    patterns: [], // custom generator
    fillEvery: 8,
  },
  instruments: {
    lead: { program: 59, name: 'Muted Trumpet' },
    bass: { program: 32, name: 'Upright Bass' },
    chords: { program: 11, name: 'Vibraphone' },
    drums: { program: 0, name: 'Brushes' },
  },
  arrange: {
    layers: {},
    sectionVelocity: { intro: 0.9, dev: 1, outro: 0.85 },
  },
  humanize: { timingTicks: 8, velocity: 0.18 }, // the soloist adds its own rubato on top
  filterAutomation: {
    // Old radio warming up: muffled intro opens into the room.
    target: 'master',
    open: 11000,
    sections: {
      intro: { move: 'sweep', fromHz: 1800 },
    },
  },
  hooks: {
    drums: genNoirDrums,
    bass: genNoirBass,
    comping: genNoirComp,
    melody: genNoirLead,
  },
};
