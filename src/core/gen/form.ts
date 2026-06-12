import type { Rng } from '../prng';
import type { Section } from '../types';
import type { GenreConfig, SectionSpec } from '../genres/types';

type SpecWithVariant = SectionSpec & { variant?: number };

export function buildForm(
  cfg: GenreConfig,
  rng: Rng,
  targetBars?: number,
): { sections: Section[]; totalBars: number } {
  let template: SpecWithVariant[] = rng.weighted(cfg.structures);
  if (targetBars) template = stretchTemplate(template, targetBars);
  const sections: Section[] = [];
  let bar = 0;
  for (const spec of template) {
    const section: Section = { name: spec.name, startBar: bar, bars: spec.bars };
    if (spec.variant) section.variant = spec.variant;
    sections.push(section);
    bar += spec.bars;
  }
  return { sections, totalBars: bar };
}

/**
 * Repeat the template's body (everything between intro and outro) until the
 * total lands as close to targetBars as possible. Repeats alternate A B A B:
 * odd passes carry variant 1, so per-section caches (keyed by sectionKey)
 * regenerate fresh material — new progression, drum pattern, melody — while
 * even passes literally reprise the original. No rng draws here; the extra
 * draws happen downstream and only in the stretched (minutes > 0) path.
 */
function stretchTemplate(template: SectionSpec[], targetBars: number): SpecWithVariant[] {
  const isEdge = (name: string) => name === 'intro' || name === 'outro';
  let bodyStart = template.findIndex((s) => !isEdge(s.name));
  if (bodyStart < 0) bodyStart = 0;
  let bodyEnd = template.length - 1;
  while (bodyEnd > bodyStart && isEdge(template[bodyEnd]!.name)) bodyEnd--;

  const body = template.slice(bodyStart, bodyEnd + 1);
  const bodyBars = body.reduce((sum, s) => sum + s.bars, 0);
  if (bodyBars <= 0) return template;

  const out: SpecWithVariant[] = template.slice(0, bodyEnd + 1);
  let total = template.reduce((sum, s) => sum + s.bars, 0);
  let pass = 0;
  while (Math.abs(total + bodyBars - targetBars) < Math.abs(total - targetBars)) {
    pass += 1;
    out.push(...body.map((s): SpecWithVariant => (pass % 2 ? { ...s, variant: 1 } : { ...s })));
    total += bodyBars;
  }
  out.push(...template.slice(bodyEnd + 1));
  return out;
}
