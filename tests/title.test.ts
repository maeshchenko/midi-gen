import { describe, expect, it } from 'vitest';
import { generate } from '../src/core';
import { GENRE_IDS } from '../src/core/types';
import { fnv1a32 } from '../src/core/prng';

describe('track titles', () => {
  it('deterministic: same code → same title', () => {
    for (const genre of GENRE_IDS) {
      const song = generate({ genre, seed: 42n });
      expect(generate({ code: song.code }).title).toBe(song.title);
    }
  });

  it('every genre × 20 seeds: non-empty, no unresolved {slot}, sane length', () => {
    for (const genre of GENRE_IDS) {
      for (let s = 1n; s <= 20n; s++) {
        const { title } = generate({ genre, seed: s });
        expect(title.length).toBeGreaterThan(2);
        expect(title.length).toBeLessThan(60);
        expect(title).not.toMatch(/[{}]/);
      }
    }
  });

  it('variety: 50 seeds of one genre give many distinct titles', () => {
    const titles = new Set<string>();
    for (let s = 1n; s <= 50n; s++) titles.add(generate({ genre: 'keygen', seed: s }).title);
    expect(titles.size).toBeGreaterThanOrEqual(30);
  });

  it('title stream never touches the notes', () => {
    // Tracks-only fingerprints captured BEFORE titles existed. The title
    // stream is independent by construction; this pins it forever.
    const PINNED: Record<string, string> = {
      keygen: 'ad8dd55b',
      noir: '3f589e2c',
      anime: '7908f21d',
      phonk: '6e6b293d',
      blues: '9195c871',
      military: '702e6279',
      darkacademia: '33fd72f4',
      grime: 'd3706159',
      nightcore: '1d6ebf7b',
      tune: '8eaef612',
      musicbox: '1cc23708',
      eurobeat: '11fb4fc0', // re-pinned 2026-06-12: outrun-style game arc (deliberate re-gen)
      outrun: '9cf5ca16',
      grimerun: 'dba378a3',
      doomerwave: 'a75ec1cc',
      doomerrun: '3cf86c74',
      nightcorerun: '29d93e0',
      test: 'ca956238',
    };
    for (const genre of GENRE_IDS) {
      const fp = fnv1a32(JSON.stringify(generate({ genre, seed: 12345n }).tracks)).toString(16);
      expect(`${genre}:${fp}`).toBe(`${genre}:${PINNED[genre]}`);
    }
  });
});
