import type { GenreId } from '../types';
import type { GenreConfig } from './types';
import { KEYGEN } from './keygen';
import { NOIR } from './noir';
import { GRIME } from './grime';
import { ANIME } from './anime';
import { BLUES } from './blues';
import { MILITARY } from './military';
import { DARKACADEMIA } from './darkacademia';
import { NIGHTCORE } from './nightcore';
import { PHONK } from './phonk';
import { TUNE } from './tune';
import { MUSICBOX } from './musicbox';

/**
 * Implemented genres. ('phonk' is the third drift-phonk attempt, built to the
 * user's 2026-06-12 spec — see phonk.ts; attempts 1–2 are in the CHANGELOG.)
 */
export const GENRES: Partial<Record<GenreId, GenreConfig>> = {
  keygen: KEYGEN,
  grime: GRIME,
  phonk: PHONK,
  noir: NOIR,
  anime: ANIME,
  blues: BLUES,
  military: MILITARY,
  darkacademia: DARKACADEMIA,
  nightcore: NIGHTCORE,
  tune: TUNE,
  musicbox: MUSICBOX,
};

export function getGenre(id: GenreId): GenreConfig {
  const cfg = GENRES[id];
  if (!cfg) throw new Error(`genre "${id}" is not implemented yet`);
  return cfg;
}

export interface GenreInfo {
  id: GenreId;
  name: string;
  bpm: [number, number];
}

export function listGenres(): GenreInfo[] {
  return Object.values(GENRES).map((c) => ({ id: c.id, name: c.name, bpm: c.bpm }));
}
