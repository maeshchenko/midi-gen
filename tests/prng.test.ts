import { describe, expect, it } from 'vitest';
import { fnv1a32, splitmix64, streamFor } from '../src/core/prng';

describe('streamFor', () => {
  it('is deterministic: same seed + name → identical sequence', () => {
    const a = streamFor(123456789n, 'melody');
    const b = streamFor(123456789n, 'melody');
    for (let i = 0; i < 1000; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('different stream names diverge', () => {
    const a = streamFor(42n, 'melody');
    const b = streamFor(42n, 'drums');
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('different seeds diverge', () => {
    const a = streamFor(1n, 'melody');
    const b = streamFor(2n, 'melody');
    expect(Array.from({ length: 20 }, () => a.next())).not.toEqual(
      Array.from({ length: 20 }, () => b.next()),
    );
  });

  it('next() stays in [0, 1)', () => {
    const rng = streamFor(7n, 'x');
    for (let i = 0; i < 10000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int() covers the inclusive range and stays inside it', () => {
    const rng = streamFor(99n, 'int');
    const seen = new Set<number>();
    for (let i = 0; i < 5000; i++) {
      const v = rng.int(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
      seen.add(v);
    }
    expect(seen.size).toBe(5);
  });

  it('weighted() respects weights roughly', () => {
    const rng = streamFor(5n, 'w');
    let heavy = 0;
    const n = 10000;
    for (let i = 0; i < n; i++) {
      if (rng.weighted([{ w: 9, v: 'a' }, { w: 1, v: 'b' }]) === 'a') heavy++;
    }
    expect(heavy / n).toBeGreaterThan(0.85);
    expect(heavy / n).toBeLessThan(0.95);
  });

  it('shuffle() returns a permutation without mutating input', () => {
    const rng = streamFor(11n, 's');
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const frozen = input.slice();
    const out = rng.shuffle(input);
    expect(input).toEqual(frozen);
    expect(out.slice().sort((x, y) => x - y)).toEqual(frozen);
  });

  it('known-answer: first values are pinned (cross-version canary)', () => {
    const rng = streamFor(0xdeadbeefn, 'canary');
    const got = Array.from({ length: 4 }, () => rng.next());
    // If this snapshot ever changes, every existing code breaks → bump CODE_VERSION.
    expect(got).toMatchSnapshot();
  });
});

describe('primitives', () => {
  it('splitmix64 known answer for state 0', () => {
    const { value } = splitmix64(0n);
    expect(value).toBe(0xe220a8397b1dcdafn);
  });

  it('fnv1a32 known answers', () => {
    expect(fnv1a32('')).toBe(0x811c9dc5);
    expect(fnv1a32('a')).toBe(0xe40c292c);
  });
});
