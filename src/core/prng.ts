/**
 * Deterministic randomness for the generation core.
 *
 * Every bit of randomness in `generate()` must flow through a named stream
 * created by `streamFor(seed, name)`. Math.random / Date are forbidden in
 * src/core — same seed must produce byte-identical songs on every platform.
 *
 * Design:
 *  - splitmix64 (BigInt) expands the 60-bit seed into sfc32 init state.
 *  - sfc32 runs on 32-bit integer ops (Math.imul / >>>) which are exactly
 *    specified by IEEE/ECMA — deterministic across JS engines.
 *  - Each named stream is seeded independently (seed ⊕ fnv1a(name)), so
 *    changing how one part consumes randomness does not shift the others.
 */

const MASK64 = (1n << 64n) - 1n;

export function splitmix64(state: bigint): { value: bigint; state: bigint } {
  const s = (state + 0x9e3779b97f4a7c15n) & MASK64;
  let z = s;
  z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK64;
  z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK64;
  z = z ^ (z >> 31n);
  return { value: z, state: s };
}

export function fnv1a32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max], inclusive. */
  int(min: number, max: number): number;
  pick<T>(arr: readonly T[]): T;
  weighted<T>(items: ReadonlyArray<{ w: number; v: T }>): T;
  chance(p: number): boolean;
  /** Fisher–Yates; returns a new array. */
  shuffle<T>(arr: readonly T[]): T[];
}

function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export function streamFor(seed: bigint, name: string): Rng {
  const hi = BigInt(fnv1a32(name)) << 32n;
  const lo = BigInt(fnv1a32(`${name}/lo`));
  let state = (seed ^ hi ^ lo) & MASK64;

  const r1 = splitmix64(state);
  const r2 = splitmix64(r1.state);
  state = r2.state;
  const next = sfc32(
    Number(r1.value & 0xffffffffn),
    Number(r1.value >> 32n),
    Number(r2.value & 0xffffffffn),
    Number(r2.value >> 32n),
  );
  // sfc32 needs a short warm-up before output is well mixed.
  for (let i = 0; i < 12; i++) next();

  const rng: Rng = {
    next,
    int(min, max) {
      if (max < min) throw new RangeError(`int(): max ${max} < min ${min}`);
      return min + Math.floor(next() * (max - min + 1));
    },
    pick(arr) {
      if (arr.length === 0) throw new RangeError('pick(): empty array');
      return arr[rng.int(0, arr.length - 1)] as (typeof arr)[number];
    },
    weighted(items) {
      if (items.length === 0) throw new RangeError('weighted(): empty list');
      let total = 0;
      for (const it of items) total += it.w;
      let roll = next() * total;
      for (const it of items) {
        roll -= it.w;
        if (roll < 0) return it.v;
      }
      return items[items.length - 1]!.v;
    },
    chance(p) {
      return next() < p;
    },
    shuffle(arr) {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = rng.int(0, i);
        const tmp = out[i]!;
        out[i] = out[j]!;
        out[j] = tmp;
      }
      return out;
    },
  };
  return rng;
}
