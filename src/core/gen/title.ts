import type { Rng } from '../prng';
import type { NamingSpec } from '../genres/types';

/**
 * Deterministic genre-flavored track title. Consumes only its own named
 * stream (rng('title')) — adding or editing titles never shifts the notes.
 *
 * Patterns are strings with `{slot}` tokens resolved from the word banks.
 * A trailing digit selects the same bank but guarantees a word distinct from
 * earlier picks of that bank ("{noun} of {noun2}" never repeats itself).
 * Casing and decorations (♥, .EXE, [tags]) live in the banks/patterns —
 * there is no separate transform layer.
 */
export function buildTitle(spec: NamingSpec, rng: Rng): string {
  const pattern = rng.weighted(spec.patterns);
  const used = new Map<string, Set<string>>();

  return pattern.replace(/\{([a-z]+)(\d*)\}/g, (_m, slot: string, _idx: string) => {
    const bank = spec.words[slot];
    if (!bank || bank.length === 0) {
      throw new Error(`naming: unknown or empty slot "{${slot}}" in pattern "${pattern}"`);
    }
    let taken = used.get(slot);
    if (!taken) {
      taken = new Set();
      used.set(slot, taken);
    }
    let word = rng.pick(bank);
    for (let i = 0; i < 8 && taken.has(word) && taken.size < bank.length; i++) {
      word = rng.pick(bank);
    }
    taken.add(word);
    return word;
  });
}
