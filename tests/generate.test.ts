import { describe, expect, it } from 'vitest';
import { generate } from '../src/core';
import { fnv1a32 } from '../src/core/prng';
import { inScale } from '../src/core/theory/scales';
import type { Song } from '../src/core/types';

const FIXED_CODE = generateFixed();

function generateFixed(): string {
  return generate({ genre: 'keygen', seed: 0x123456789abcden }).code;
}

function songFingerprint(song: Song): string {
  const json = JSON.stringify(song, (_k, v: unknown) =>
    typeof v === 'bigint' ? v.toString() : v,
  );
  return fnv1a32(json).toString(16).padStart(8, '0');
}

describe('generate (keygen)', () => {
  const song = generate({ code: FIXED_CODE });

  it('same code → byte-identical song', () => {
    const again = generate({ code: FIXED_CODE });
    expect(songFingerprint(again)).toBe(songFingerprint(song));
    expect(JSON.stringify(again, (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v)))
      .toBe(JSON.stringify(song, (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v)));
  });

  it('different seeds → different songs', () => {
    const a = generate({ genre: 'keygen', seed: 1n });
    const b = generate({ genre: 'keygen', seed: 2n });
    expect(songFingerprint(a)).not.toBe(songFingerprint(b));
  });

  it('song.code decodes back to the same song', () => {
    const fresh = generate({ genre: 'keygen', seed: 42n });
    const restored = generate({ code: fresh.code });
    expect(songFingerprint(restored)).toBe(songFingerprint(fresh));
  });

  it('snapshot canary: fixed seed produces a pinned fingerprint', () => {
    // Changed fingerprint = every issued code now sounds different → bump CODE_VERSION.
    expect({
      code: song.code,
      bpm: song.bpm,
      key: song.key,
      fingerprint: songFingerprint(song),
      noteCounts: song.tracks.map((t) => [t.name, t.notes.length]),
    }).toMatchSnapshot();
  });

  it('structural sanity: sections, tracks, duration', () => {
    expect(song.genre).toBe('keygen');
    expect(song.bpm).toBeGreaterThanOrEqual(140);
    expect(song.bpm).toBeLessThanOrEqual(180);
    expect(song.sections.length).toBeGreaterThanOrEqual(4);
    expect(song.durationTicks).toBe(
      song.sections.reduce((s, x) => s + x.bars, 0) * 4 * 480,
    );
    const roles = song.tracks.map((t) => t.role);
    expect(roles).toContain('lead');
    expect(roles).toContain('bass');
    expect(roles).toContain('arp');
    expect(roles).toContain('drums');
  });

  it('MIDI invariants: pitch/vel/dur ranges, channels, bounds', () => {
    for (const track of song.tracks) {
      expect(track.notes.length).toBeGreaterThan(0);
      if (track.role === 'drums') expect(track.channel).toBe(9);
      else expect(track.channel).not.toBe(9);
      for (const n of track.notes) {
        expect(n.pitch).toBeGreaterThanOrEqual(0);
        expect(n.pitch).toBeLessThanOrEqual(127);
        expect(n.vel).toBeGreaterThanOrEqual(1);
        expect(n.vel).toBeLessThanOrEqual(127);
        expect(n.dur).toBeGreaterThan(0);
        expect(n.start).toBeGreaterThanOrEqual(0);
        expect(n.start).toBeLessThan(song.durationTicks);
      }
    }
  });

  it('melody stays in register and in scale', () => {
    const lead = song.tracks.find((t) => t.role === 'lead')!;
    for (const n of lead.notes) {
      expect(n.pitch).toBeGreaterThanOrEqual(69);
      expect(n.pitch).toBeLessThanOrEqual(93);
      expect(inScale(n.pitch, song.key.tonic, song.key.mode)).toBe(true);
    }
  });

  it('notes are sorted by start within each track', () => {
    for (const track of song.tracks) {
      for (let i = 1; i < track.notes.length; i++) {
        expect(track.notes[i]!.start).toBeGreaterThanOrEqual(track.notes[i - 1]!.start);
      }
    }
  });

  it('intro plays only the configured layers', () => {
    const intro = song.sections[0]!;
    expect(intro.name).toBe('intro');
    const introEnd = (intro.startBar + intro.bars) * 4 * 480;
    const lead = song.tracks.find((t) => t.role === 'lead')!;
    const margin = 10; // humanize jitter
    expect(lead.notes.filter((n) => n.start < introEnd - margin).length).toBe(0);
  });

  it('loopable: every onset strictly inside the loop, full drive at the seam', () => {
    for (const seed of [3n, 99n, 4242n]) {
      const s = generate({ genre: 'keygen', seed });
      const lastBarStart = s.durationTicks - 4 * 480;
      let notesInLastBar = 0;
      for (const track of s.tracks) {
        for (const n of track.notes) {
          expect(n.start).toBeLessThan(s.durationTicks);
          if (n.start >= lastBarStart) notesInLastBar++;
        }
      }
      // No hard ending: the final bar still plays material that rolls into bar one.
      expect(notesInLastBar).toBeGreaterThan(4);
    }
  });

  it('genre override on top of a code re-uses the seed', () => {
    const base = generate({ genre: 'keygen', seed: 7n });
    const overridden = generate({ code: base.code, genre: 'keygen' });
    expect(overridden.seed).toBe(7n);
  });

  it('100 random seeds all generate without violating invariants', () => {
    for (let i = 0; i < 100; i++) {
      const s = generate({ genre: 'keygen', seed: BigInt(i * 7919 + 1) });
      for (const track of s.tracks) {
        for (const n of track.notes) {
          if (n.pitch < 0 || n.pitch > 127 || n.dur <= 0 || n.vel < 1 || n.vel > 127) {
            throw new Error(`invariant violated at seed ${i}: ${JSON.stringify(n)}`);
          }
        }
      }
    }
  });
});
