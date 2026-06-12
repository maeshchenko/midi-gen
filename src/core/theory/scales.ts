import type { Mode } from '../types';

export const SCALE_INTERVALS: Record<Mode, readonly number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  naturalMinor: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  blues: [0, 3, 5, 6, 7, 10],
  minorPentatonic: [0, 3, 5, 7, 10],
  majorPentatonic: [0, 2, 4, 7, 9],
};

const mod12 = (n: number) => ((n % 12) + 12) % 12;

export function scalePitchClasses(tonic: number, mode: Mode): number[] {
  return SCALE_INTERVALS[mode].map((iv) => mod12(tonic + iv));
}

/**
 * Scale degree → MIDI pitch. Degree is 0-based and unbounded: degree 7 in a
 * 7-note scale is the tonic an octave up, -1 is the 7th below. `octave` uses
 * MIDI convention where octave 4 starts at pitch 60 (C4).
 */
export function degreeToPitch(tonic: number, mode: Mode, degree: number, octave: number): number {
  const intervals = SCALE_INTERVALS[mode];
  const n = intervals.length;
  const octShift = Math.floor(degree / n);
  const idx = ((degree % n) + n) % n;
  return 12 * (octave + 1) + tonic + intervals[idx]! + 12 * octShift;
}

export function inScale(pitch: number, tonic: number, mode: Mode): boolean {
  return SCALE_INTERVALS[mode].includes(mod12(pitch - tonic));
}

/** Snap to nearest scale member; ties resolve downward. */
export function snapToScale(pitch: number, tonic: number, mode: Mode): number {
  for (let d = 0; d <= 6; d++) {
    if (inScale(pitch - d, tonic, mode)) return pitch - d;
    if (inScale(pitch + d, tonic, mode)) return pitch + d;
  }
  return pitch;
}
