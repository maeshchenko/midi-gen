import { PPQ, type GenreId, type Song, type Track } from '../types';
import { decodeCode, encodeCode, randomSeed } from '../code';
import { streamFor, type Rng } from '../prng';
import { getGenre } from '../genres';
import type { GenContext } from '../genres/types';
import { buildForm } from './form';
import { buildTitle } from './title';
import { buildHarmony, makeChordLookup } from './harmony';
import { genDrums } from './drums';
import { genBass } from './bass';
import { genTrackerArp, genSustainedChords } from './comping';
import { genMelody } from './melody';
import { arrange } from './arrange';
import { humanize } from './humanize';

export interface GenerateOptions {
  genre?: GenreId;
  seed?: bigint;
  /** Serial code; restores genre + seed + minutes. Explicit `genre`/`minutes` override the code's. */
  code?: string;
  /**
   * Approximate target length in minutes, integer 1–7. Stored in the code's
   * 3 flags bits, so the code alone restores the full-length song. Omit (or 0)
   * for the genre's natural form — identical to pre-feature behavior.
   */
  minutes?: number;
}

export function generate(opts: GenerateOptions = {}): Song {
  let genre: GenreId;
  let seed: bigint;
  let minutes = opts.minutes ?? 0;
  if (opts.code) {
    const decoded = decodeCode(opts.code);
    genre = opts.genre ?? decoded.genre;
    seed = decoded.seed;
    minutes = opts.minutes ?? decoded.flags;
  } else {
    genre = opts.genre ?? 'keygen';
    seed = opts.seed ?? randomSeed();
  }
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 7) {
    throw new RangeError('minutes must be an integer 1–7 (or omitted)');
  }
  const code = encodeCode(genre, seed, { flags: minutes });
  const cfg = getGenre(genre);

  const streams = new Map<string, Rng>();
  const rng = (name: string): Rng => {
    let s = streams.get(name);
    if (!s) {
      s = streamFor(seed, `${genre}/${name}`);
      streams.set(name, s);
    }
    return s;
  };

  const global = rng('global');
  const bpmRange = cfg.bpmLanes ? global.weighted(cfg.bpmLanes) : cfg.bpm;
  const bpm = global.int(bpmRange[0], bpmRange[1]);
  const tonic = global.weighted(cfg.keys);
  const mode = global.weighted(cfg.modes);
  const swing =
    cfg.swing[0] === cfg.swing[1]
      ? cfg.swing[0]
      : cfg.swing[0] + global.next() * (cfg.swing[1] - cfg.swing[0]);

  const title = buildTitle(cfg.naming, rng('title'));

  const timeSig = cfg.timeSig as [number, number];
  const beatTicks = (PPQ * 4) / timeSig[1];
  const barTicks = beatTicks * timeSig[0];

  // Bars that make `minutes` of music at this bpm (bpm counts quarter notes).
  const targetBars = minutes
    ? Math.max(1, Math.round((minutes * 60 * bpm * PPQ) / 60 / barTicks))
    : undefined;
  const { sections, totalBars } = buildForm(cfg, rng('form'), targetBars);
  const chords = buildHarmony(sections, cfg, { tonic, mode }, barTicks, beatTicks, rng('harmony'));

  const ctx: GenContext = {
    seed,
    cfg,
    rng,
    bpm,
    timeSig,
    key: { tonic, mode },
    swing,
    sections,
    totalBars,
    barTicks,
    beatTicks,
    chords,
    chordAt: makeChordLookup(chords),
    shared: new Map(),
  };

  // Fixed order — part generators and humanize consume RNG sequentially.
  const hooks = cfg.hooks ?? {};
  const parts = [
    (hooks.drums ?? genDrums)(ctx),
    (hooks.bass ?? genBass)(ctx),
    (hooks.comping ?? genSustainedChords)(ctx),
    (hooks.arp ?? genTrackerArp)(ctx),
    (hooks.melody ?? genMelody)(ctx),
  ].filter((t): t is Track => t !== null);

  // Channels: drums stay on 9, the rest take 0,1,2,… skipping 9.
  let ch = 0;
  for (const track of parts) {
    if (track.role === 'drums') continue;
    if (ch === 9) ch++;
    track.channel = ch++;
  }

  const tracks = humanize(arrange(parts, ctx), ctx);

  return {
    code,
    title,
    version: 1,
    genre,
    seed,
    ppq: PPQ,
    bpm,
    timeSig,
    key: { tonic, mode },
    swing,
    sections,
    tracks,
    durationTicks: totalBars * barTicks,
  };
}
