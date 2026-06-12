import { describe, expect, it } from 'vitest';
import {
  CodeError,
  decodeCode,
  encodeCode,
  nextSeed,
  normalizeCode,
  randomSeed,
} from '../src/core/code';
import { GENRE_IDS } from '../src/core/types';
import { streamFor } from '../src/core/prng';

describe('serial code codec', () => {
  it('formats as XXXX-XXXX-XXXX-XXXX in Crockford Base32', () => {
    const code = encodeCode('keygen', 12345n);
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
  });

  it('roundtrips 10k random (genre, seed) pairs', () => {
    const rng = streamFor(2024n, 'roundtrip');
    for (let i = 0; i < 10000; i++) {
      const genre = GENRE_IDS[rng.int(0, GENRE_IDS.length - 1)]!;
      const seed =
        (BigInt(rng.int(0, 0xfffffff)) << 32n) | BigInt(rng.int(0, 0xffffffff));
      const decoded = decodeCode(encodeCode(genre, seed));
      expect(decoded.genre).toBe(genre);
      expect(decoded.seed).toBe(seed);
      expect(decoded.version).toBe(1);
    }
  });

  it('CRC catches a corrupted character', () => {
    const code = encodeCode('phonk', 987654321n);
    const flat = normalizeCode(code);
    let corrupted = 0;
    for (let i = 0; i < flat.length; i++) {
      const replacement = flat[i] === 'A' ? 'B' : 'A';
      const bad = flat.slice(0, i) + replacement + flat.slice(i + 1);
      try {
        decodeCode(bad);
      } catch (e) {
        expect(e).toBeInstanceOf(CodeError);
        corrupted++;
      }
    }
    expect(corrupted).toBe(flat.length);
  });

  it('accepts lowercase, dashes optional, O→0 / I,L→1 confusables', () => {
    const code = encodeCode('blues', 555n);
    const decoded = decodeCode(code.toLowerCase().replace(/-/g, ''));
    expect(decoded.seed).toBe(555n);
    const with0 = normalizeCode(code);
    if (with0.includes('0')) {
      expect(decodeCode(with0.replace('0', 'O')).seed).toBe(555n);
    }
    if (with0.includes('1')) {
      expect(decodeCode(with0.replace('1', 'I')).seed).toBe(555n);
    }
  });

  it('rejects wrong length and bad charset', () => {
    expect(() => decodeCode('ABCD-EFGH')).toThrow(CodeError);
    expect(() => decodeCode('UUUU-UUUU-UUUU-UUUU')).toThrow(CodeError);
  });

  it('flags survive the roundtrip', () => {
    const decoded = decodeCode(encodeCode('noir', 777n, { flags: 5 }));
    expect(decoded.flags).toBe(5);
  });

  it('seed is masked to 60 bits', () => {
    const decoded = decodeCode(encodeCode('anime', (1n << 63n) | 42n));
    expect(decoded.seed).toBe(42n | ((1n << 63n) & ((1n << 60n) - 1n)));
  });

  it('randomSeed fits 60 bits and varies', () => {
    const a = randomSeed();
    const b = randomSeed();
    expect(a).toBeLessThan(1n << 60n);
    expect(a === b).toBe(false);
  });

  it('nextSeed is deterministic and fits 60 bits', () => {
    expect(nextSeed(1n)).toBe(nextSeed(1n));
    expect(nextSeed(1n)).not.toBe(1n);
    expect(nextSeed(nextSeed(1n))).toBeLessThan(1n << 60n);
  });

  it('known code stays stable across releases', () => {
    expect(encodeCode('keygen', 0x0123456789abcdefn & ((1n << 60n) - 1n))).toMatchSnapshot();
  });
});
