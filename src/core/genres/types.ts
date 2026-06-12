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
  /**
   * Cross-part scratchpad for genre hooks (e.g. phonk bass must duplicate the
   * kick pattern — drums write 'phonk.kicks', bass reads it). Generators run
   * in fixed order: drums → bass → chords → arp → melody.
   */
  shared: Map<string, unknown>;
}

export type PartGenerator = (ctx: GenContext) => Track | null;

/** Tracker arp cycle shapes. 'thumb' alternates the root with every other tone. */
export type ArpPattern = 'up' | 'down' | 'updown' | 'octaves' | 'thumb';

export type BassStyle =
  | 'synth8'
  | 'walking'
  | 'boogie'
  | 's808'
  | 'march'
  | 'sustain'
  | 'octave8'
  | 'syncopated16';

export interface GenreConfig {
  id: GenreId;
  name: string;
  /** Kept generatable (codes keep working) but excluded from listGenres(). */
  hidden?: boolean;
  bpm: [number, number];
  /** Bimodal tempo (shanson: lyrical 80–95 vs kabak 115–125). Overrides `bpm` when set. */
  bpmLanes?: Weighted<[number, number]>[];
  timeSig: [number, number];
  keys: Weighted<number>[];
  modes: Weighted<Mode>[];
  swing: [number, number];
  structures: Weighted<SectionSpec[]>[];
  progressions: Weighted<ProgressionTemplate>[];
  /** Each section NAME gets a progression no other name already took (when possible). */
  distinctProgressions?: boolean;
  melody: {
    register: [number, number];
    /** 0..1 — how busy the rhythm is. */
    density: number;
    leapProb: number;
    restProb: number;
    /** 0..1 — weight of off-16th onsets. */
    syncopation: number;
    /** Melody walks this scale instead of the key mode (blues over dom7 harmony). */
    scale?: Mode;
  };
  bass: {
    style: BassStyle;
    /** Per-seed style pool; overrides `style` when set. */
    styles?: Weighted<BassStyle>[];
    register: [number, number];
  };
  /** Tracker-style arpeggio voice (keygen and friends). */
  arp?: {
    register: [number, number];
    /** Notes per beat: 4 = 16ths, 8 = 32nds. */
    rate: 4 | 8;
    /** Cycle shape pool, picked once per section name. Missing = 'up'. */
    patterns?: Weighted<ArpPattern>[];
  };
  comping?: {
    register: [number, number];
    /** sustained pads (default) | short on-beat stabs (brass) | Alberti broken chords. */
    style?: 'sustained' | 'stabs' | 'alberti';
  };
  drums: {
    patterns: Weighted<StepPattern>[];
    /** A fill lands every N bars (and on the last bar of a section). */
    fillEvery: number;
    /** Per-bar probability of a 1/32 hat-roll burst (trap/phonk). */
    rollProb?: number;
    /** Fill flavour: tom/snare 16ths (default) or tracker snare-rush 32nds. */
    fillStyle?: 'toms' | 'rush' | 'mixed';
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
  /**
   * Declarative low-pass automation, interpreted by the audio layer.
   * Sections not listed sit at `open`. Pure data — core stays Tone-free.
   */
  filterAutomation?: {
    /** Whose cutoff to drive; 'master' inserts a filter on the master bus. */
    target: 'lead' | 'arp' | 'master';
    /** Fully-open cutoff in Hz. */
    open: number;
    sections: Record<
      string,
      | { move: 'closed'; hz: number } // hold closed (0.3s ramp in)
      | { move: 'sweep'; fromHz: number } // linear fromHz → open across the section
    >;
  };
  /** Genre-specific overrides for the default part generators. */
  hooks?: Partial<Record<'melody' | 'bass' | 'drums' | 'comping' | 'arp', PartGenerator>>;
}
