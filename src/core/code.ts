/**
 * Keygen-style serial codec: XXXX-XXXX-XXXX-XXXX (Crockford Base32).
 *
 * 80-bit payload, BigInt-packed, big-endian:
 *   version(4) | genre(5) | flags(3) | seed(60) | crc8(8)
 *
 * CRC-8 (poly 0x07) covers the first 72 bits and catches manual typos.
 * The genre is embedded, so a code alone fully restores a song — no DB.
 */

import { GENRE_IDS, type GenreId } from './types';

export const CODE_VERSION = 1;

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CHAR_VALUE = new Map<string, number>(
  [...ALPHABET].map((ch, i) => [ch, i] as const),
);
// Crockford confusables accepted on input.
CHAR_VALUE.set('O', 0);
CHAR_VALUE.set('I', 1);
CHAR_VALUE.set('L', 1);

export const SEED_BITS = 60;
const SEED_MASK = (1n << 60n) - 1n;
const CODE_CHARS = 16;

export class CodeError extends Error {
  constructor(
    message: string,
    public readonly reason: 'length' | 'charset' | 'checksum' | 'version' | 'genre',
  ) {
    super(message);
    this.name = 'CodeError';
  }
}

function crc8(bytes: Uint8Array): number {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x80 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
    }
  }
  return crc;
}

function payloadBytes(payload72: bigint): Uint8Array {
  const bytes = new Uint8Array(9);
  for (let i = 8; i >= 0; i--) {
    bytes[i] = Number((payload72 >> BigInt((8 - i) * 8)) & 0xffn);
  }
  return bytes;
}

export function encodeCode(
  genre: GenreId,
  seed: bigint,
  opts: { version?: number; flags?: number } = {},
): string {
  const version = opts.version ?? CODE_VERSION;
  const flags = opts.flags ?? 0;
  const genreIndex = GENRE_IDS.indexOf(genre);
  if (genreIndex < 0) throw new CodeError(`unknown genre: ${genre}`, 'genre');
  if (version < 0 || version > 15) throw new RangeError('version must fit 4 bits');
  if (flags < 0 || flags > 7) throw new RangeError('flags must fit 3 bits');

  const payload72 =
    (BigInt(version) << 68n) |
    (BigInt(genreIndex) << 63n) |
    (BigInt(flags) << 60n) |
    (seed & SEED_MASK);
  const full = (payload72 << 8n) | BigInt(crc8(payloadBytes(payload72)));

  let chars = '';
  for (let i = CODE_CHARS - 1; i >= 0; i--) {
    chars += ALPHABET[Number((full >> BigInt(i * 5)) & 0x1fn)];
  }
  return chars.match(/.{4}/g)!.join('-');
}

export interface DecodedCode {
  version: number;
  genre: GenreId;
  flags: number;
  seed: bigint;
}

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '');
}

export function decodeCode(input: string): DecodedCode {
  const raw = normalizeCode(input);
  if (raw.length !== CODE_CHARS) {
    throw new CodeError(`code must be ${CODE_CHARS} chars, got ${raw.length}`, 'length');
  }

  let full = 0n;
  for (const ch of raw) {
    const v = CHAR_VALUE.get(ch);
    if (v === undefined) throw new CodeError(`invalid character: ${ch}`, 'charset');
    full = (full << 5n) | BigInt(v);
  }

  const payload72 = full >> 8n;
  const crc = Number(full & 0xffn);
  if (crc !== crc8(payloadBytes(payload72))) {
    throw new CodeError('checksum mismatch — mistyped code?', 'checksum');
  }

  const version = Number((payload72 >> 68n) & 0xfn);
  if (version !== CODE_VERSION) {
    throw new CodeError(`unsupported code version ${version}`, 'version');
  }
  const genreIndex = Number((payload72 >> 63n) & 0x1fn);
  const genre = GENRE_IDS[genreIndex];
  if (!genre) throw new CodeError(`unknown genre index ${genreIndex}`, 'genre');

  return {
    version,
    genre,
    flags: Number((payload72 >> 60n) & 0x7n),
    seed: payload72 & SEED_MASK,
  };
}

/**
 * Fresh entropy for NEW codes only — generation itself never calls this.
 * crypto is available in browsers, workers and Node ≥ 19.
 */
export function randomSeed(): bigint {
  const words = new Uint32Array(2);
  globalThis.crypto.getRandomValues(words);
  return ((BigInt(words[0]!) << 32n) | BigInt(words[1]!)) & SEED_MASK;
}

/** Deterministic successor seed — endless playlist from one starting code. */
export function nextSeed(seed: bigint): bigint {
  let z = (seed + 0x9e3779b97f4a7c15n) & ((1n << 64n) - 1n);
  z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & ((1n << 64n) - 1n);
  z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & ((1n << 64n) - 1n);
  return (z ^ (z >> 31n)) & SEED_MASK;
}
