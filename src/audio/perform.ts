/**
 * Performance pass — the "live player" layer. Pure function that turns the
 * grid-locked Song IR into humanized, scheduled audio events. Applied ONLY in
 * real mode at playback / offline render; the Song IR, MIDI export and game API
 * are never touched (this runs downstream of them).
 *
 * It adds what a human player does without thinking: micro-timing groove,
 * metric accents and dynamics, and note-length / legato shaping. Deterministic
 * from song.seed so the offline render matches the live preview exactly.
 *
 * See docs/superpowers/specs/2026-06-17-live-performance-layer-design.md.
 */

import { PPQ, type Song, type Track, type TrackRole } from '../core/types';
import { GM_DRUMS } from '../core/gen/drums';

export interface PerfEvent {
  time: number; // seconds
  pitch: number;
  dur: number; // seconds
  vel: number; // 0..1
  slide?: boolean;
}

/** mulberry32 — deterministic 0..1. */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const roleSeed: Record<TrackRole, number> = {
  lead: 0x1111,
  chords: 0x2222,
  bass: 0x3333,
  drums: 0x4444,
  arp: 0x5555,
  counter: 0x6666,
  fx: 0x7777,
};

interface RoleFeel {
  /** Max symmetric timing jitter, milliseconds. */
  jitterMs: number;
  /** Constant timing push (−) / drag (+), milliseconds. */
  pushMs: number;
  /** Velocity humanize spread, 0..1. */
  velSpread: number;
  /** Extend notes toward the next one (smooth, connected) — strings/lead. */
  legato: boolean;
}

const FEEL: Record<TrackRole, RoleFeel> = {
  lead: { jitterMs: 12, pushMs: 2, velSpread: 0.1, legato: true },
  chords: { jitterMs: 9, pushMs: 4, velSpread: 0.08, legato: true },
  bass: { jitterMs: 4, pushMs: 0, velSpread: 0.07, legato: false },
  arp: { jitterMs: 5, pushMs: 0, velSpread: 0.09, legato: false },
  // Drums stay tight: heavy timing jitter turns fast rolls/blasts into sloppy
  // stumbles, and wide velocity jitter flickers the kit's velocity layers.
  drums: { jitterMs: 1.5, pushMs: 0, velSpread: 0.05, legato: false },
  counter: { jitterMs: 8, pushMs: 2, velSpread: 0.09, legato: true },
  fx: { jitterMs: 6, pushMs: 0, velSpread: 0.06, legato: false },
};

/**
 * Humanize one track into scheduled audio events. Notes keep their pitch and
 * count; only timing, velocity and length move.
 */
export function perform(track: Track, song: Song): PerfEvent[] {
  const secPerTick = 60 / song.bpm / PPQ;
  const beatTicks = (PPQ * 4) / song.timeSig[1];
  const barTicks = song.timeSig[0] * beatTicks;
  const feel = FEEL[track.role];
  const rng = makeRng((Number(song.seed & 0xffffffffn) ^ roleSeed[track.role]) >>> 0);

  // Stable order for legato look-ahead.
  const notes = [...track.notes].sort((a, b) => a.start - b.start || a.pitch - b.pitch);

  return notes.map((n, i) => {
    const tickInBar = ((n.start % barTicks) + barTicks) % barTicks;
    const onBeat = tickInBar % beatTicks === 0;
    const downBeat = tickInBar === 0;

    // ── Timing: constant push + metric-aware jitter (offbeats breathe more) ──
    let offMs = feel.pushMs + (rng() - 0.5) * 2 * feel.jitterMs;
    if (track.role === 'drums' && n.pitch === GM_DRUMS.snare) offMs += 2; // slight laid-back backbeat
    const time = Math.max(0, n.start * secPerTick + offMs / 1000); // never before loop start

    // ── Velocity: metric accent + humanize, around the IR's own dynamics ──
    let vel = n.vel / 127;
    if (downBeat) vel += 0.08;
    else if (onBeat) vel += 0.04;
    else vel -= 0.03; // offbeats sit back
    vel += (rng() - 0.5) * 2 * feel.velSpread;
    vel = Math.max(0.05, Math.min(1, vel));

    // ── Length: louder = a touch longer; legato roles reach toward next note ──
    let dur = n.dur * secPerTick * (0.9 + 0.3 * vel);
    if (feel.legato) {
      const next = notes[i + 1];
      if (next) {
        const gapSec = (next.start - n.start) * secPerTick;
        if (gapSec > 0 && gapSec < 2) dur = Math.max(dur, gapSec * 0.97);
      }
    }
    dur = Math.max(0.02, dur);

    return { time, pitch: n.pitch, dur, vel, slide: n.slide };
  });
}
