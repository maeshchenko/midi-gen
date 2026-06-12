import type { ChordQuality } from './chords';

export interface ProgressionStep {
  /** 0-based scale degree (0 = tonic). */
  degree: number;
  /** Length in beats. */
  beats: number;
  seventh?: boolean;
  ninth?: boolean;
  quality?: ChordQuality;
}

export type ProgressionTemplate = ProgressionStep[];

/** Canonical 12-bar blues, one chord per bar, all dominant 7ths. */
export const BLUES_12BAR: ProgressionTemplate = [
  { degree: 0, beats: 4, quality: 'dom7' },
  { degree: 0, beats: 4, quality: 'dom7' },
  { degree: 0, beats: 4, quality: 'dom7' },
  { degree: 0, beats: 4, quality: 'dom7' },
  { degree: 3, beats: 4, quality: 'dom7' },
  { degree: 3, beats: 4, quality: 'dom7' },
  { degree: 0, beats: 4, quality: 'dom7' },
  { degree: 0, beats: 4, quality: 'dom7' },
  { degree: 4, beats: 4, quality: 'dom7' },
  { degree: 3, beats: 4, quality: 'dom7' },
  { degree: 0, beats: 4, quality: 'dom7' },
  { degree: 4, beats: 4, quality: 'dom7' },
];

export function progressionBeats(template: ProgressionTemplate): number {
  return template.reduce((sum, step) => sum + step.beats, 0);
}

/**
 * Expand a template to absolute beat positions, repeating it until
 * `totalBeats` is filled. The last step is clipped to fit.
 */
export function expandProgression(
  template: ProgressionTemplate,
  totalBeats: number,
): Array<ProgressionStep & { startBeat: number }> {
  const out: Array<ProgressionStep & { startBeat: number }> = [];
  let beat = 0;
  while (beat < totalBeats) {
    for (const step of template) {
      if (beat >= totalBeats) break;
      const beats = Math.min(step.beats, totalBeats - beat);
      out.push({ ...step, beats, startBeat: beat });
      beat += beats;
    }
  }
  return out;
}
