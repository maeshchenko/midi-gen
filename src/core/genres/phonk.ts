import type { GenreConfig, PartGenerator } from './types';
import type { NoteEvent } from '../types';
import { DRUM_CHANNEL } from '../types';
import { SCALE_INTERVALS, mod12 } from '../theory/scales';

/**
 * Drift Phonk, third attempt — built to spec (2026-06-12):
 * 120–135 BPM halftime Memphis trap, phrygian/natural minor, staccato cowbell
 * riff on the weak eighths (tonic / minor second / tritone, octave jumps),
 * 808 bass LOCKED to the kick with glides and an octave slide at the end of
 * each 8-bar square, snare strictly on beat 3, hat rolls, build-up with snare
 * accelerando ending in a beat of dead silence.
 *
 * The audio layer adds the rest of the spec: sidechain ducking from the kick,
 * bitcrusher, hard clip, tape hiss, and a low-pass that keeps the intro
 * "underwater" and opens through the build-up (see instruments.ts).
 *
 * Structure: intro → buildup → drop → bridge → drop → outro(bare lead) — the
 * outro loops seamlessly into the filtered intro (loop invariant kept; the
 * spec's tape-stop ending is intentionally skipped, it would break looping).
 */

const KICK = 36;
const SNARE = 38;
const HAT = 42;

function placeLow(pc: number, lo: number, hi: number): number {
  for (let p = lo; p <= hi; p++) {
    if (mod12(p) === pc) return p;
  }
  return lo;
}

/** Drums: strict Memphis trap + build-up accelerando. Publishes kick ticks. */
const genPhonkDrums: PartGenerator = (ctx) => {
  const inst = ctx.cfg.instruments.drums;
  if (!inst) return null;
  const rng = ctx.rng('drums');
  const step = ctx.barTicks / 16;
  const t32 = step / 2;
  const kickTicks: number[] = [];
  const notes: NoteEvent[] = [];

  for (const section of ctx.sections) {
    const sStart = section.startBar * ctx.barTicks;
    for (let bar = 0; bar < section.bars; bar++) {
      const b0 = sStart + bar * ctx.barTicks;
      if (section.name === 'intro' || section.name === 'outro') continue;

      if (section.name === 'buildup') {
        // Snare accelerando: halves → quarters → 8ths → 16ths, crescendo;
        // the last beat of the final bar is dead silence (the cut).
        const div = [2, 4, 8, 16][Math.min(bar, 3)]!;
        const isLastBar = bar === section.bars - 1;
        for (let i = 0; i < div; i++) {
          const st = (16 / div) * i;
          if (isLastBar && st >= 12) break;
          notes.push({
            pitch: SNARE,
            start: b0 + st * step,
            dur: 40,
            vel: Math.min(120, 64 + Math.round((bar * 16 + st) * 0.85)),
          });
        }
        continue;
      }

      const isBridge = section.name === 'bridge';

      // Kick: beat 1 is law; extras on steps 7/10/14 (southern trap).
      const kicks = [0];
      if (!isBridge) {
        if (rng.chance(0.6)) kicks.push(rng.pick([7, 10]));
        if (rng.chance(0.35)) kicks.push(14);
      } else if (rng.chance(0.4)) {
        kicks.push(10);
      }
      for (const k of [...new Set(kicks)].sort((a, b) => a - b)) {
        const tick = b0 + k * step;
        notes.push({ pitch: KICK, start: tick, dur: 100, vel: 118 });
        kickTicks.push(tick);
      }

      // Snare: step 8 (beat 3), 100% — the halftime groove anchor.
      notes.push({ pitch: SNARE, start: b0 + 8 * step, dur: 60, vel: 112 });

      // Hats: steady 8ths (thinner on the bridge) + machine-gun rolls.
      for (let st = 0; st < 16; st += 2) {
        if (isBridge && rng.chance(0.35)) continue;
        notes.push({ pitch: HAT, start: b0 + st * step, dur: 30, vel: st % 4 === 0 ? 62 : 48 });
      }
      if (!isBridge && rng.chance(0.27)) {
        const st = rng.pick([3, 5, 11, 13]);
        if (rng.chance(0.5)) {
          for (let i = 0; i < 2; i++) {
            notes.push({ pitch: HAT, start: b0 + st * step + i * t32, dur: 25, vel: 55 + i * 12 });
          }
        } else {
          const t3 = (step * 2) / 3;
          for (let i = 0; i < 3; i++) {
            notes.push({ pitch: HAT, start: b0 + st * step + Math.round(i * t3), dur: 25, vel: 50 + i * 12 });
          }
        }
      }
    }
  }

  ctx.shared.set('phonk.kicks', kickTicks);
  return { name: inst.name, channel: DRUM_CHANNEL, program: inst.program, role: 'drums', notes };
};

/**
 * 808 bass: duplicates the kick rhythm verbatim (the lock is law). Downbeats
 * hold the root; mid-bar kicks occasionally lean onto the fifth or the
 * (phrygian) second — near-legato durations feed the synth's portamento, so
 * every move is a glide, not a jump. The last kick of every 8-bar square
 * still slides an octave up.
 */
const genPhonkBass: PartGenerator = (ctx) => {
  const inst = ctx.cfg.instruments.bass;
  if (!inst) return null;
  const rng = ctx.rng('bass');
  const kicks = (ctx.shared.get('phonk.kicks') as number[] | undefined) ?? [];
  const [lo, hi] = ctx.cfg.bass.register;
  const second = SCALE_INTERVALS[ctx.key.mode][1] ?? 1;
  const notes: NoteEvent[] = [];

  for (let i = 0; i < kicks.length; i++) {
    const tick = kicks[i]!;
    const next = kicks[i + 1];
    const root = ctx.chordAt(tick).root;
    let pitch = placeLow(root, lo, hi);

    const barIdx = Math.floor(tick / ctx.barTicks);
    const lastOfSquare =
      barIdx % 8 === 7 && (next === undefined || Math.floor(next / ctx.barTicks) !== barIdx);
    if (lastOfSquare && pitch + 12 <= hi + 12) {
      pitch += 12;
    } else if (tick % ctx.barTicks !== 0 && rng.chance(0.3)) {
      // Mid-bar lean: glide onto the fifth (weight) or the second (menace).
      pitch = placeLow(mod12(root + (rng.chance(0.5) ? 7 : second)), lo, hi);
    }

    const dur = next !== undefined ? Math.min(next - tick - 5, ctx.barTicks) : ctx.beatTicks * 2;
    notes.push({ pitch, start: tick, dur: Math.max(120, dur), vel: 115 });
  }

  return { name: inst.name, channel: 0, program: inst.program, role: 'bass', notes };
};

/**
 * Cowbell lead: one hypnotic 2-bar riff tiled across the whole track.
 * Staccato 16ths, onsets live on the weak eighths (steps 2/6/10/14, p≈0.85),
 * pitches favour tonic / minor second / tritone, octave jumps p=0.18.
 * Every second bar ends in a 1/32 tremolo roll with a crescendo.
 */
const genPhonkLead: PartGenerator = (ctx) => {
  const inst = ctx.cfg.instruments.lead;
  if (!inst) return null;
  const rng = ctx.rng('melody');
  const step = ctx.barTicks / 16;
  const [lo, hi] = ctx.cfg.melody.register;
  const tonicPitch = placeLow(ctx.key.tonic, lo + 4, hi);
  const second = SCALE_INTERVALS[ctx.key.mode][1] ?? 1;
  const OFFSETS = [
    { w: 4, v: 0 },
    { w: 3, v: second },
    { w: 2, v: 6 }, // tritone
    { w: 2, v: 3 },
    { w: 1, v: 7 },
    { w: 1, v: 10 },
  ];

  // The riff: 32 16th-steps (2 bars).
  interface RiffEvent { step: number; offset: number; oct: number }
  const riff: RiffEvent[] = [];
  for (let s = 0; s < 32; s++) {
    const inBar = s % 16;
    let p: number;
    if (inBar === 2 || inBar === 6 || inBar === 10 || inBar === 14) p = 0.85;
    else if (inBar === 0) p = s === 0 ? 0.9 : 0.5;
    else if (inBar % 4 === 0) p = 0.35;
    else p = 0.15;
    if (!rng.chance(p)) continue;
    riff.push({
      step: s,
      offset: rng.weighted(OFFSETS),
      oct: rng.chance(0.18) ? (rng.chance(0.5) ? 12 : -12) : 0,
    });
  }

  const clamp = (p: number) => {
    while (p > hi) p -= 12;
    while (p < lo) p += 12;
    return p;
  };

  const notes: NoteEvent[] = [];
  for (const section of ctx.sections) {
    const sStart = section.startBar * ctx.barTicks;
    for (let bar = 0; bar < section.bars; bar++) {
      const b0 = sStart + bar * ctx.barTicks;
      const globalBar = section.startBar + bar;
      const buildupCut = section.name === 'buildup' && bar === section.bars - 1;
      const roll = !buildupCut && globalBar % 2 === 1;

      for (const ev of riff) {
        if (Math.floor(ev.step / 16) !== globalBar % 2) continue;
        const inBar = ev.step % 16;
        if (buildupCut && inBar >= 12) continue; // the silence
        if (roll && inBar >= 12) continue; // replaced by the tremolo
        notes.push({
          pitch: clamp(tonicPitch + ev.offset + ev.oct),
          start: b0 + inBar * step,
          dur: Math.floor(step * 0.8), // staccato: decay ~100–200ms, no tail
          vel: rng.int(96, 110),
        });
      }

      if (roll) {
        for (let i = 0; i < 8; i++) {
          notes.push({
            pitch: tonicPitch,
            start: b0 + 12 * step + Math.floor(i * (step / 2)),
            dur: Math.floor(step / 2),
            vel: 60 + i * 7, // crescendo
          });
        }
      }
    }
  }

  return { name: inst.name, channel: 0, program: inst.program, role: 'lead', notes };
};

export const PHONK: GenreConfig = {
  id: 'phonk',
  name: 'Drift Phonk',
  bpm: [120, 135],
  timeSig: [4, 4],
  keys: [
    { w: 3, v: 1 }, // C#
    { w: 2, v: 2 }, // D
    { w: 2, v: 9 }, // A
    { w: 2, v: 5 }, // F
    { w: 1, v: 4 }, // E
  ],
  modes: [
    { w: 2, v: 'phrygian' }, // the minor second is the darkness
    { w: 2, v: 'naturalMinor' },
  ],
  swing: [0, 0],
  structures: [
    {
      w: 2,
      v: [
        { name: 'intro', bars: 4 },
        { name: 'buildup', bars: 4 },
        { name: 'drop', bars: 8 },
        { name: 'bridge', bars: 8 },
        { name: 'drop', bars: 8 },
        { name: 'outro', bars: 2 },
      ],
    },
    {
      w: 1,
      v: [
        { name: 'intro', bars: 4 },
        { name: 'buildup', bars: 4 },
        { name: 'drop', bars: 16 },
        { name: 'bridge', bars: 8 },
        { name: 'drop', bars: 8 },
        { name: 'outro', bars: 4 },
      ],
    },
  ],
  progressions: [
    // Monolithic vamps — the riff and the 808 carry the harmony.
    { w: 2, v: [{ degree: 0, beats: 16 }] },
    { w: 1, v: [{ degree: 0, beats: 8 }, { degree: 1, beats: 8 }] }, // i–bII
    { w: 1, v: [{ degree: 0, beats: 12 }, { degree: 5, beats: 4 }] },
  ],
  melody: {
    register: [58, 76],
    density: 0.6, // unused by the custom lead, kept for the type
    leapProb: 0.18,
    restProb: 0.1,
    syncopation: 0.6,
  },
  bass: { style: 's808', register: [26, 40] },
  drums: {
    patterns: [], // custom generator — patterns unused
    fillEvery: 8,
  },
  instruments: {
    lead: { program: 113, name: 'Phonk Cowbell' },
    bass: { program: 39, name: '808 Glide' },
    drums: { program: 0, name: 'Memphis Kit' },
  },
  arrange: {
    layers: {
      intro: ['lead'], // underwater cowbell alone (LPF closed — audio layer)
      buildup: ['lead', 'drums'],
      bridge: ['lead', 'drums'], // bass vanishes — the release
      outro: ['lead'], // bare riff → loops into the filtered intro
    },
    sectionVelocity: { intro: 0.8, buildup: 0.9, bridge: 0.92, outro: 0.75 },
  },
  humanize: { timingTicks: 2, velocity: 0.05 }, // sequencer-tight
  filterAutomation: {
    target: 'lead',
    open: 8800,
    sections: {
      intro: { move: 'closed', hz: 380 }, // underwater
      outro: { move: 'closed', hz: 380 },
      buildup: { move: 'sweep', fromHz: 380 }, // opens into the drop
    },
  },
  hooks: {
    drums: genPhonkDrums,
    bass: genPhonkBass,
    melody: genPhonkLead,
  },
};
