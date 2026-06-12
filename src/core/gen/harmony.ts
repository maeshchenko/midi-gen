import type { Rng } from '../prng';
import type { Mode, Section } from '../types';
import type { ChordSpan, GenreConfig } from '../genres/types';
import { chordFromDegree } from '../theory/chords';
import { expandProgression, type ProgressionTemplate } from '../theory/progressions';

/**
 * Build the chord timeline. The progression template is chosen once per
 * section NAME (memoized), so every repeat of section "A" carries the same
 * harmony — repetition is what makes the form readable to the ear.
 */
export function buildHarmony(
  sections: Section[],
  cfg: GenreConfig,
  key: { tonic: number; mode: Mode },
  barTicks: number,
  beatTicks: number,
  rng: Rng,
): ChordSpan[] {
  const beatsPerBar = barTicks / beatTicks;
  const templateByName = new Map<string, ProgressionTemplate>();

  const spans: ChordSpan[] = [];
  for (const section of sections) {
    let template = templateByName.get(section.name);
    if (!template) {
      template = rng.weighted(cfg.progressions);
      templateByName.set(section.name, template);
    }
    const sectionStart = section.startBar * barTicks;
    const steps = expandProgression(template, section.bars * beatsPerBar);
    for (const step of steps) {
      spans.push({
        chord: chordFromDegree(key.tonic, key.mode, step.degree, {
          seventh: step.seventh,
          ninth: step.ninth,
          quality: step.quality,
        }),
        start: sectionStart + step.startBeat * beatTicks,
        dur: step.beats * beatTicks,
      });
    }
  }
  return spans;
}

export function makeChordLookup(spans: ChordSpan[]): (tick: number) => ChordSpan['chord'] {
  return (tick) => {
    for (let i = spans.length - 1; i >= 0; i--) {
      const span = spans[i]!;
      if (tick >= span.start) return span.chord;
    }
    return spans[0]!.chord;
  };
}
