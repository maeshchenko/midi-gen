import type { Rng } from '../prng';
import type { Section } from '../types';
import type { GenreConfig } from '../genres/types';

export function buildForm(cfg: GenreConfig, rng: Rng): { sections: Section[]; totalBars: number } {
  const template = rng.weighted(cfg.structures);
  const sections: Section[] = [];
  let bar = 0;
  for (const spec of template) {
    sections.push({ name: spec.name, startBar: bar, bars: spec.bars });
    bar += spec.bars;
  }
  return { sections, totalBars: bar };
}
