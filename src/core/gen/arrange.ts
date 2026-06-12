import type { Section, Track } from '../types';
import type { GenContext } from '../genres/types';

function sectionAt(sections: Section[], barTicks: number, tick: number): Section {
  for (let i = sections.length - 1; i >= 0; i--) {
    const s = sections[i]!;
    if (tick >= s.startBar * barTicks) return s;
  }
  return sections[0]!;
}

/**
 * Arrangement pass:
 *  - per-section layering (intro/outro play fewer voices),
 *  - per-section velocity curve.
 *
 * Songs are seamless LOOPS by design — there is deliberately no "ending":
 * the last bar plays at full drive and the progression's final chord (VII/VI
 * in minor templates) resolves into the first chord of bar one. Drum fills
 * already land on the last bar of every section, including the loop seam.
 */
export function arrange(tracks: Track[], ctx: GenContext): Track[] {
  const { sections, barTicks, cfg } = ctx;
  const total = ctx.totalBars * barTicks;
  const layersOf = (name: string) => cfg.arrange.layers[name] ?? 'all';
  const isActive = (role: Track['role'], layers: Track['role'][] | 'all') =>
    layers === 'all' || layers.includes(role);

  return tracks.map((track) => {
    const kept = track.notes
      .filter((n) => {
        if (n.start >= total) return false;
        const section = sectionAt(sections, barTicks, n.start);
        return isActive(track.role, layersOf(section.name));
      })
      .map((n) => {
        const section = sectionAt(sections, barTicks, n.start);
        const scale = cfg.arrange.sectionVelocity?.[section.name] ?? 1;
        return {
          ...n,
          vel: Math.max(1, Math.min(127, Math.round(n.vel * scale))),
          dur: Math.min(n.dur, total - n.start),
        };
      });

    return { ...track, notes: kept };
  });
}
