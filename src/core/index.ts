/**
 * midi-gen core — deterministic, headless song generation.
 * No DOM, no Tone.js: safe to import in Node, workers and games.
 */

export { generate, type GenerateOptions } from './gen/song';
export {
  encodeCode,
  decodeCode,
  normalizeCode,
  randomSeed,
  nextSeed,
  CodeError,
  CODE_VERSION,
  type DecodedCode,
} from './code';
export { songToMidi } from './midi';
export { listGenres, getGenre, type GenreInfo } from './genres';
export { GENRE_IDS, PPQ, DRUM_CHANNEL } from './types';
export type { GenreId, Mode, NoteEvent, Section, Song, Track, TrackRole } from './types';
