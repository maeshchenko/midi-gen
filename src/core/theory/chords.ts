import type { Mode } from '../types';
import { SCALE_INTERVALS } from './scales';

export type ChordQuality = 'diatonic' | 'dom7' | 'min7' | 'maj7' | 'dim7' | 'halfDim7';

export interface Chord {
  /** Root pitch class 0–11. */
  root: number;
  /** Pitch classes, root first. */
  pitchClasses: number[];
  /** 0-based scale degree the chord was built on. */
  degree: number;
}

const mod12 = (n: number) => ((n % 12) + 12) % 12;

const QUALITY_INTERVALS: Record<Exclude<ChordQuality, 'diatonic'>, number[]> = {
  dom7: [0, 4, 7, 10],
  min7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  dim7: [0, 3, 6, 9],
  halfDim7: [0, 3, 6, 10],
};

export interface ChordOptions {
  seventh?: boolean;
  ninth?: boolean;
  quality?: ChordQuality;
}

/**
 * Build a chord on a scale degree by stacking scale thirds, or force an
 * explicit quality (e.g. every blues chord is dom7 regardless of the scale).
 */
export function chordFromDegree(
  tonic: number,
  mode: Mode,
  degree: number,
  opts: ChordOptions = {},
): Chord {
  const intervals = SCALE_INTERVALS[mode];
  const n = intervals.length;
  const at = (d: number) => mod12(tonic + intervals[((d % n) + n) % n]! + 12 * Math.floor(d / n));
  const root = at(degree);

  const quality = opts.quality ?? 'diatonic';
  if (quality !== 'diatonic') {
    const pcs = QUALITY_INTERVALS[quality].map((iv) => mod12(root + iv));
    if (opts.ninth) pcs.push(at(degree + 8));
    return { root, pitchClasses: pcs, degree };
  }

  const steps = [0, 2, 4];
  if (opts.seventh || opts.ninth) steps.push(6);
  if (opts.ninth) steps.push(8);
  const pcs: number[] = [];
  for (const s of steps) {
    const pc = at(degree + s);
    if (!pcs.includes(pc)) pcs.push(pc);
  }
  return { root, pitchClasses: pcs, degree };
}

/** All chord pitches inside [lo, hi], ascending. */
export function chordTones(chord: Chord, lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let p = lo; p <= hi; p++) {
    if (chord.pitchClasses.includes(mod12(p))) out.push(p);
  }
  return out;
}

/**
 * Simple close voicing: stack the chord's pitch classes upward starting from
 * the first chord tone at or above `lowest`.
 */
export function closeVoicing(chord: Chord, lowest: number): number[] {
  const start = ((): number => {
    for (let p = lowest; p < lowest + 12; p++) {
      if (mod12(p) === chord.root) return p;
    }
    return lowest;
  })();
  let prev = start;
  return chord.pitchClasses.map((pc, i) => {
    if (i === 0) return start;
    let p = prev + 1;
    while (mod12(p) !== pc) p++;
    prev = p;
    return p;
  });
}
