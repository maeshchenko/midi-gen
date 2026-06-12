import type { GenreId } from '../types';
import type { GenreConfig } from './types';
import { KEYGEN } from './keygen';

/** Implemented genres. The rest of GENRE_IDS land in phase 6. */
export const GENRES: Partial<Record<GenreId, GenreConfig>> = {
  keygen: KEYGEN,
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
