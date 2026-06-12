import type { Rng } from '../prng';
import type { GenreId, Mode, Section, Track, TrackRole } from '../types';
import type { ProgressionTemplate } from '../theory/progressions';
import type { Chord } from '../theory/chords';

export interface Weighted<T> {
  w: number;
  v: T;
}

export interface SectionSpec {
  name: string;
  bars: number;
}

/** 16 steps per bar; value 0..1 is the accent (0 = no hit). */
export interface StepPattern {
  name: string;
  kick: number[];
  snare: number[];
  hatClosed: number[];
  hatOpen?: number[];
  perc?: number[];
}

export interface ChordSpan {
  chord: Chord;
  /** Ticks. */
  start: number;
  /** Ticks. */
  dur: number;
}

/** Everything a part generator needs. Built once per generate() call. */
export interface GenContext {
  seed: bigint;
  cfg: GenreConfig;
  /** Memoized named PRNG streams — the only randomness source. */
  rng: (name: string) => Rng;
  bpm: number;
  timeSig: [number, number];
  key: { tonic: number; mode: Mode };
  swing: number;
  sections: Section[];
  totalBars: number;
  barTicks: number;
  beatTicks: number;
  chords: ChordSpan[];
  chordAt: (tick: number) => Chord;
}

export type PartGenerator = (ctx: GenContext) => Track | null;

export interface GenreConfig {
  id: GenreId;
  name: string;
  bpm: [number, number];
  timeSig: [number, number];
  keys: Weighted<number>[];
  modes: Weighted<Mode>[];
  swing: [number, number];
  structures: Weighted<SectionSpec[]>[];
  progressions: Weighted<ProgressionTemplate>[];
  melody: {
    register: [number, number];
    /** 0..1 — how busy the rhythm is. */
    density: number;
    leapProb: number;
    restProb: number;
    /** 0..1 — weight of off-16th onsets. */
    syncopation: number;
  };
  bass: {
    style: 'synth8' | 'walking' | 'boogie' | 's808' | 'march' | 'arpeggiated';
    register: [number, number];
  };
  /** Tracker-style arpeggio voice (keygen and friends). */
  arp?: {
    register: [number, number];
    /** Notes per beat: 4 = 16ths, 8 = 32nds. */
    rate: 4 | 8;
  };
  comping?: { register: [number, number] };
  drums: {
    patterns: Weighted<StepPattern>[];
    /** A fill lands every N bars (and on the last bar of a section). */
    fillEvery: number;
  };
  instruments: Partial<Record<TrackRole, { program: number; name: string }>>;
  arrange: {
    /** Section name → active roles; missing name = all roles. */
    layers: Record<string, TrackRole[] | 'all'>;
    sectionVelocity?: Record<string, number>;
  };
  humanize: {
    /** Max timing jitter in ticks. */
    timingTicks: number;
    /** Max velocity jitter as a fraction (0.1 = ±10%). */
    velocity: number;
  };
  /** Genre-specific overrides for the default part generators. */
  hooks?: Partial<Record<'melody' | 'bass' | 'drums' | 'comping' | 'arp', PartGenerator>>;
}
