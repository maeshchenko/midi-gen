import { PPQ, type Track } from '../types';
import type { GenContext } from '../genres/types';

/**
 * Swing + timing/velocity jitter. All randomness comes from the seeded
 * 'humanize' stream — humanization is part of the reproducible result.
 * Swing shifts offbeat 8ths (up to a triplet feel at swing = 1) and is baked
 * into ticks so MIDI export and audio playback stay identical.
 */
export function humanize(tracks: Track[], ctx: GenContext): Track[] {
  const rng = ctx.rng('humanize');
  const t = ctx.cfg.humanize.timingTicks;
  const v = ctx.cfg.humanize.velocity;
  const swingShift = Math.round(ctx.swing * (PPQ / 6));

  const total = ctx.totalBars * ctx.barTicks;
  return tracks.map((track) => {
    const notes = track.notes.map((n) => {
      let start = n.start;
      if (swingShift > 0 && start % PPQ === PPQ / 2) start += swingShift;
      if (t > 0) start = Math.max(0, start + rng.int(-t, t));
      // Keep every onset strictly inside the loop — events at/after the loop
      // point would silently never fire.
      start = Math.min(start, total - 10);
      const vel = Math.max(1, Math.min(127, Math.round(n.vel * (1 + (rng.next() * 2 - 1) * v))));
      return { ...n, start, vel };
    });
    notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch || a.dur - b.dur);
    return { ...track, notes };
  });
}
