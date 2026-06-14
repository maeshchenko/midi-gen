export const GENRE_IDS = [
  'keygen',
  'noir',
  'anime',
  'phonk',
  'blues',
  'military',
  'darkacademia',
  'grime',
  'nightcore',
  'tune',
  'musicbox',
  'eurobeat',
  'outrun',
  'grimerun',
  'doomerwave',
  'doomerrun',
  'nightcorerun',
  'test',
] as const;

export type GenreId = (typeof GENRE_IDS)[number];

export type Mode =
  | 'major'
  | 'naturalMinor'
  | 'harmonicMinor'
  | 'dorian'
  | 'phrygian'
  | 'mixolydian'
  | 'blues'
  | 'minorPentatonic'
  | 'majorPentatonic';

export type TrackRole = 'lead' | 'chords' | 'bass' | 'drums' | 'arp' | 'counter' | 'fx';

export interface NoteEvent {
  /** MIDI pitch 0–127. */
  pitch: number;
  /** Start time in ticks (PPQ 480). */
  start: number;
  /** Duration in ticks, > 0. */
  dur: number;
  /** Velocity 1–127. */
  vel: number;
  /**
   * Tracker 3xx tone-portamento: the audio layer glides the already-sounding
   * voice to this pitch instead of retriggering. The generator must keep a
   * carrier note ringing through this note's span. MIDI export ignores it.
   */
  slide?: boolean;
}

export interface Track {
  name: string;
  /** MIDI channel; drums are always 9. */
  channel: number;
  /** GM program number 0–127 (ignored for drums). */
  program: number;
  role: TrackRole;
  notes: NoteEvent[];
}

export interface Section {
  name: string;
  startBar: number;
  bars: number;
  /**
   * Repeat variant for stretched (minutes > 0) songs: undefined = the
   * original pass, 1 = the alternate pass (A B A B form). Generators key
   * their per-section caches by `sectionKey`, so variant sections get fresh
   * material; arrange/audio keep using `name` (layers, velocity, filters).
   */
  variant?: number;
}

/** Cache key for per-section generated material. */
export function sectionKey(s: { name: string; variant?: number }): string {
  return s.variant ? `${s.name}#${s.variant}` : s.name;
}

export interface Song {
  code: string;
  /**
   * Genre-flavored track name, deterministic from the code. Drawn from its
   * own named PRNG stream — never affects the notes.
   */
  title: string;
  version: number;
  genre: GenreId;
  seed: bigint;
  ppq: 480;
  bpm: number;
  timeSig: [number, number];
  key: { tonic: number; mode: Mode };
  /** 0..1 — offbeat shift already baked into note ticks. */
  swing: number;
  sections: Section[];
  tracks: Track[];
  durationTicks: number;
}

export const PPQ = 480 as const;
export const DRUM_CHANNEL = 9 as const;
