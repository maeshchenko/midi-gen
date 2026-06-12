import { describe, expect, it } from 'vitest';
import {
  degreeToPitch,
  inScale,
  scalePitchClasses,
  snapToScale,
} from '../src/core/theory/scales';
import { chordFromDegree, chordTones, closeVoicing } from '../src/core/theory/chords';
import { BLUES_12BAR, expandProgression, progressionBeats } from '../src/core/theory/progressions';

describe('scales', () => {
  it('C major pitch classes', () => {
    expect(scalePitchClasses(0, 'major')).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });

  it('A natural minor = white keys from A', () => {
    expect(scalePitchClasses(9, 'naturalMinor').sort((a, b) => a - b)).toEqual([
      0, 2, 4, 5, 7, 9, 11,
    ]);
  });

  it('degreeToPitch: C4 is 60, octave wrap up and down', () => {
    expect(degreeToPitch(0, 'major', 0, 4)).toBe(60);
    expect(degreeToPitch(0, 'major', 7, 4)).toBe(72);
    expect(degreeToPitch(0, 'major', -1, 4)).toBe(59);
    expect(degreeToPitch(0, 'major', 4, 4)).toBe(67);
  });

  it('snapToScale moves chromatic notes onto the scale', () => {
    expect(snapToScale(61, 0, 'major')).toBe(60);
    expect(inScale(snapToScale(66, 0, 'major'), 0, 'major')).toBe(true);
    expect(snapToScale(62, 0, 'major')).toBe(62);
  });
});

describe('chords', () => {
  it('diatonic triads in C major', () => {
    expect(chordFromDegree(0, 'major', 0).pitchClasses).toEqual([0, 4, 7]);
    expect(chordFromDegree(0, 'major', 5).pitchClasses).toEqual([9, 0, 4]);
  });

  it('forced dom7 quality', () => {
    const g7 = chordFromDegree(0, 'major', 4, { quality: 'dom7' });
    expect(g7.root).toBe(7);
    expect(g7.pitchClasses).toEqual([7, 11, 2, 5]);
  });

  it('seventh chord in natural minor', () => {
    const i7 = chordFromDegree(9, 'naturalMinor', 0, { seventh: true });
    expect(i7.pitchClasses).toEqual([9, 0, 4, 7]);
  });

  it('chordTones lists every chord pitch in range, ascending', () => {
    const c = chordFromDegree(0, 'major', 0);
    const tones = chordTones(c, 60, 72);
    expect(tones).toEqual([60, 64, 67, 72]);
  });

  it('closeVoicing stacks upward from the root', () => {
    const c = chordFromDegree(0, 'major', 0);
    const v = closeVoicing(c, 60);
    expect(v).toEqual([60, 64, 67]);
    for (let i = 1; i < v.length; i++) expect(v[i]!).toBeGreaterThan(v[i - 1]!);
  });
});

describe('progressions', () => {
  it('12-bar blues is exactly 48 beats of dom7', () => {
    expect(progressionBeats(BLUES_12BAR)).toBe(48);
    expect(BLUES_12BAR.every((s) => s.quality === 'dom7')).toBe(true);
    expect(BLUES_12BAR.map((s) => s.degree)).toEqual([0, 0, 0, 0, 3, 3, 0, 0, 4, 3, 0, 4]);
  });

  it('expandProgression repeats and clips to total beats', () => {
    const steps = expandProgression(BLUES_12BAR, 96);
    expect(steps.length).toBe(24);
    expect(steps[12]!.startBeat).toBe(48);
    const clipped = expandProgression(BLUES_12BAR, 50);
    expect(clipped.at(-1)!.beats).toBe(2);
    expect(clipped.reduce((s, x) => s + x.beats, 0)).toBe(50);
  });
});
