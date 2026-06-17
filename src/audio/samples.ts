/**
 * Real-instrument sample sets for the "real" playback mode.
 *
 * Pitched instruments are multisampled (Tone.Sampler, repitched between zones);
 * drums are velocity-layered round-robin one-shots (Tone.Players). All files
 * live under /samples (Vite serves public/ verbatim — root-absolute URLs work
 * for the embed iframe too). Loading is lazy: a set is fetched only when a voice
 * that uses it is built, i.e. only for the current genre.
 *
 * Round-robin + velocity layers kill the "machine-gun" effect (identical buffer
 * every hit) — see docs/superpowers/specs/2026-06-17-live-performance-layer-design.md.
 *
 * Sources — see public/samples/CREDITS.md:
 *  - guitar-electric, bass-electric, violin: nbrosowsky/tonejs-instruments (CC-BY 3.0)
 *  - drums/metal: Versilian Community Sample Library (VCSL) (CC0)
 */

export type SampleSet =
  | 'electricGuitar'
  | 'electricBass'
  | 'strings'
  | 'violin'
  | 'contrabass'
  | 'cello'
  | 'mutedTrumpet'
  | 'vibraphone';

export interface SampleSetDef {
  baseUrl: string;
  /** note name → file (Tone.Sampler repitches to fill the gaps). */
  urls: Record<string, string>;
  volumeDb?: number;
  release?: number;
  attack?: number;
  /** Drive through Tone.Distortion (overdriven electric guitar/bass). */
  distortion?: number;
  /** Guard monophonic-style lines against same-instant retriggers (bass). */
  monophonic?: boolean;
  /**
   * Speaker-cabinet sim after distortion (hp/lp Hz). Turns fizzy raw distortion
   * into a miked amp — the single biggest realism fix for distorted guitar/bass.
   */
  cab?: { hp: number; lp: number };
  /** Double-track: two takes panned hard L/R with a Haas offset (metal width). */
  doubleTrack?: boolean;
  /** Guitar palm-mute: short notes play dark/tight (chug), long notes ring open. */
  palmMute?: boolean;
  /** Solo-string vibrato (pitch wobble) — the main "living instrument" cue. */
  vibrato?: { rate: number; depth: number };
}

export const SAMPLE_SETS: Record<SampleSet, SampleSetDef> = {
  electricGuitar: {
    baseUrl: '/samples/guitar-electric/',
    urls: { E2: 'E2.mp3', 'F#2': 'Fs2.mp3', A2: 'A2.mp3', C3: 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3', A3: 'A3.mp3', C4: 'C4.mp3' },
    volumeDb: -12,
    release: 0.35,
    distortion: 0.62,
    cab: { hp: 95, lp: 5200 }, // 4x12 cab sim — kills the fizz
    doubleTrack: true,
    palmMute: true,
  },
  electricBass: {
    baseUrl: '/samples/bass-electric/',
    urls: { E1: 'E1.mp3', G1: 'G1.mp3', 'A#1': 'As1.mp3', 'C#2': 'Cs2.mp3', E2: 'E2.mp3', G2: 'G2.mp3', 'A#2': 'As2.mp3', 'C#3': 'Cs3.mp3' },
    volumeDb: -6,
    release: 0.3,
    distortion: 0.16,
    cab: { hp: 40, lp: 3200 }, // bass cab — round, no fizz
    monophonic: true,
  },
  strings: {
    baseUrl: '/samples/violin/',
    urls: { G3: 'G3.mp3', C4: 'C4.mp3', E4: 'E4.mp3', G4: 'G4.mp3', C5: 'C5.mp3', E5: 'E5.mp3', G5: 'G5.mp3', C6: 'C6.mp3', E6: 'E6.mp3', G6: 'G6.mp3', C7: 'C7.mp3' },
    volumeDb: -13,
    release: 0.8,
    attack: 0.25,
    vibrato: { rate: 5.2, depth: 0.12 },
  },
  violin: {
    baseUrl: '/samples/violin/',
    urls: { G3: 'G3.mp3', C4: 'C4.mp3', E4: 'E4.mp3', G4: 'G4.mp3', C5: 'C5.mp3', E5: 'E5.mp3', G5: 'G5.mp3', C6: 'C6.mp3', A6: 'A6.mp3', E6: 'E6.mp3', G6: 'G6.mp3', C7: 'C7.mp3' },
    volumeDb: -9,
    release: 0.5,
    attack: 0.05,
    vibrato: { rate: 5.8, depth: 0.16 },
  },
  // Upright/double bass (noir walking bass) — warm, woody, monophonic.
  contrabass: {
    baseUrl: '/samples/contrabass/',
    urls: { G1: 'G1.mp3', 'A#1': 'As1.mp3', C2: 'C2.mp3', D2: 'D2.mp3', E2: 'E2.mp3', 'G#2': 'Gs2.mp3', A2: 'A2.mp3', 'C#3': 'Cs3.mp3', E3: 'E3.mp3', 'G#3': 'Gs3.mp3', B3: 'B3.mp3' },
    volumeDb: -7,
    release: 0.35,
    attack: 0.01,
    monophonic: true,
  },
  // Bowed cello (dark academia bass / chamber). Low register is densely sampled
  // (≈whole-tone) so notes aren't repitched far — wide stretch on a low string
  // sounds rubbery/detuned. Vibrato kept subtle so sustained low notes don't wobble.
  cello: {
    baseUrl: '/samples/cello/',
    urls: {
      C2: 'C2.mp3', D2: 'D2.mp3', 'D#2': 'Ds2.mp3', E2: 'E2.mp3', F2: 'F2.mp3', G2: 'G2.mp3', A2: 'A2.mp3', B2: 'B2.mp3',
      C3: 'C3.mp3', D3: 'D3.mp3', E3: 'E3.mp3', F3: 'F3.mp3', G3: 'G3.mp3', A3: 'A3.mp3', B3: 'B3.mp3',
      C4: 'C4.mp3', E4: 'E4.mp3', G4: 'G4.mp3', C5: 'C5.mp3',
    },
    volumeDb: -9,
    release: 0.6,
    attack: 0.12,
    vibrato: { rate: 5, depth: 0.04 },
  },
  // Muted (harmon) trumpet — trumpet samples through a nasal mid-band "mute".
  mutedTrumpet: {
    baseUrl: '/samples/trumpet/',
    urls: { A3: 'A3.mp3', C4: 'C4.mp3', 'D#4': 'Ds4.mp3', F4: 'F4.mp3', G4: 'G4.mp3', 'A#4': 'As4.mp3', D5: 'D5.mp3', F5: 'F5.mp3', A5: 'A5.mp3', C6: 'C6.mp3' },
    volumeDb: -11,
    release: 0.25,
    attack: 0.02,
    cab: { hp: 520, lp: 3400 }, // harmon-mute nasal honk
    vibrato: { rate: 5, depth: 0.07 },
  },
  // Vibraphone (noir comping) — soft mallets, long metallic ring.
  vibraphone: {
    baseUrl: '/samples/vibraphone/',
    urls: { C3: 'C3.mp3', E3: 'E3.mp3', G3: 'G3.mp3', B3: 'B3.mp3', D4: 'D4.mp3', F4: 'F4.mp3', A4: 'A4.mp3', C5: 'C5.mp3', E5: 'E5.mp3' },
    volumeDb: -10,
    release: 1.2,
    attack: 0,
  },
};

export const REAL_PROGRAM_MAP: Record<number, SampleSet> = {
  30: 'electricGuitar',
  34: 'electricBass',
  48: 'strings',
  40: 'violin',
  32: 'contrabass', // upright bass (noir)
  42: 'cello', // bowed cello (dark academia)
  59: 'mutedTrumpet', // noir soloist
  11: 'vibraphone', // noir comping
  // program 6 (harpsichord, dark academia) has no CC sample source → stays synth
};

/** One velocity layer: used when note velocity <= vMax; `rr` are round-robin files. */
export interface VelLayer {
  vMax: number;
  rr: string[];
}
export interface DrumLaneDef {
  /** Ascending by vMax. Velocity selects the layer (timbre), then rr cycles. */
  layers: VelLayer[];
}
export interface DrumKitDef {
  baseUrl: string;
  lanes: Record<string, DrumLaneDef>;
}

const L = (vMax: number, ...rr: string[]): VelLayer => ({ vMax, rr });

/** genre → real drum kit (velocity-layered round-robin). */
export const REAL_DRUM_KITS: Record<string, DrumKitDef> = {
  nightcorerun: {
    baseUrl: '/samples/drums/metal/',
    lanes: {
      kick: { layers: [
        L(0.5, 'kick_l0_r0.mp3', 'kick_l0_r1.mp3'),
        L(0.8, 'kick_l1_r0.mp3', 'kick_l1_r1.mp3'),
        L(1.0, 'kick_l2_r0.mp3', 'kick_l2_r1.mp3'),
      ] },
      snare: { layers: [
        L(0.5, 'snare_l0_r0.mp3', 'snare_l0_r1.mp3'),
        L(0.8, 'snare_l1_r0.mp3', 'snare_l1_r1.mp3'),
        L(1.0, 'snare_l2_r0.mp3', 'snare_l2_r1.mp3'),
      ] },
      hatClosed: { layers: [
        L(0.45, 'hatClosed_l0_r0.mp3', 'hatClosed_l0_r1.mp3'),
        L(0.75, 'hatClosed_l1_r0.mp3', 'hatClosed_l1_r1.mp3'),
        L(1.0, 'hatClosed_l2_r0.mp3', 'hatClosed_l2_r1.mp3'),
      ] },
      hatOpen: { layers: [L(1.0, 'hatOpen_l0_r0.mp3', 'hatOpen_l0_r1.mp3')] },
      crash: { layers: [
        L(0.35, 'crash_l0_r0.mp3'),
        L(0.6, 'crash_l1_r0.mp3'),
        L(0.85, 'crash_l2_r0.mp3'),
        L(1.0, 'crash_l3_r0.mp3'),
      ] },
      tomHigh: { layers: [
        L(0.6, 'tomHigh_l0_r0.mp3', 'tomHigh_l0_r1.mp3'),
        L(1.0, 'tomHigh_l1_r0.mp3', 'tomHigh_l1_r1.mp3'),
      ] },
      tomLow: { layers: [
        L(0.6, 'tomLow_l0_r0.mp3', 'tomLow_l0_r1.mp3'),
        L(1.0, 'tomLow_l1_r0.mp3', 'tomLow_l1_r1.mp3'),
      ] },
      clap: { layers: [L(1.0, 'clap_l0_r0.mp3', 'clap_l0_r1.mp3', 'clap_l0_r2.mp3', 'clap_l0_r3.mp3')] },
    },
  },
};
