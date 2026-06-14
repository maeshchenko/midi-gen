import type { GenreConfig, GenContext, PartGenerator, SectionSpec } from './types';
import type { TrackRole, NoteEvent } from '../types';
import { GRIMERUN } from './grimerun';
import { genDrums } from '../gen/drums';

/**
 * TEST — diagnostic genre. The full grimerun drum kit, but each 2-bar section
 * keeps only some drum pieces (labelled in the piano roll), to find which
 * element or combination farts. DRUMONLY farted while isolated single hits were
 * clean → the distortion is in the drum SUM/density (or the fill). Not music.
 */

const ALLOW: Record<string, number[] | null> = {
  DALL: null, // everything (reproduces the fart)
  DKICK: [36],
  DSNARE: [38],
  DHATS: [42, 46],
  DTOMS: [45, 47, 50], // fills
  DCRASH: [49],
  DKS: [36, 38], // kick + snare
  DKH: [36, 42, 46], // kick + hats
};

const genTestDrums: PartGenerator = (ctx: GenContext) => {
  const full = genDrums(ctx);
  if (!full) return null;
  const secAt = (tick: number) =>
    [...ctx.sections].reverse().find((s) => tick >= s.startBar * ctx.barTicks) ?? ctx.sections[0]!;
  const notes: NoteEvent[] = full.notes.filter((n) => {
    const a = ALLOW[secAt(n.start).name];
    return a === null || a === undefined || a.includes(n.pitch);
  });
  if (notes.length === 0) notes.push(full.notes[0]!);
  return { ...full, notes };
};

const NAMES = Object.keys(ALLOW);
const layers: Record<string, TrackRole[] | 'all'> = {};
for (const n of NAMES) layers[n] = ['drums'];

export const TEST: GenreConfig = {
  ...GRIMERUN,
  id: 'test',
  name: 'Test (diagnostic)',
  structures: [{ w: 1, v: NAMES.map((name): SectionSpec => ({ name, bars: 2 })) }],
  arrange: { layers },
  filterAutomation: undefined, // pure mix test, no master sweep
  hooks: { ...GRIMERUN.hooks, drums: genTestDrums },
};
