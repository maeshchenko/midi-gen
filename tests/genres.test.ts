import { describe, expect, it } from 'vitest';
import { generate, listGenres } from '../src/core';
import { fnv1a32 } from '../src/core/prng';
import type { Song } from '../src/core/types';

function fingerprint(song: Song): string {
  const json = JSON.stringify(song, (_k, v: unknown) =>
    typeof v === 'bigint' ? v.toString() : v,
  );
  return fnv1a32(json).toString(16).padStart(8, '0');
}

function checkInvariants(song: Song): void {
  for (const track of song.tracks) {
    expect(track.notes.length).toBeGreaterThan(0);
    if (track.role === 'drums') expect(track.channel).toBe(9);
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
}

describe('genre registry', () => {
  it('lists implemented genres', () => {
    const ids = listGenres().map((g) => g.id);
    for (const id of ['keygen', 'grime', 'noir', 'anime', 'blues', 'military', 'darkacademia']) {
      expect(ids).toContain(id);
    }
    expect(ids).toContain('phonk'); // drift phonk v3 (spec) — back since 2026-06-12
  });
});

describe('grime (ex-Memphis phonk)', () => {
  const song = generate({ genre: 'grime', seed: 0xfade1n });

  it('passes MIDI invariants and is deterministic', () => {
    checkInvariants(song);
    expect(fingerprint(generate({ code: song.code }))).toBe(fingerprint(song));
  });

  it('has the cowbell lead and 808 bass', () => {
    expect(song.tracks.find((t) => t.role === 'lead')!.program).toBe(113);
    expect(song.tracks.find((t) => t.role === 'bass')!.program).toBe(39);
  });

  it('808 plays long legato notes, sub register', () => {
    const bass = song.tracks.find((t) => t.role === 'bass')!;
    for (const n of bass.notes) {
      expect(n.pitch).toBeLessThanOrEqual(53); // sub register + octave pops
    }
    const avgDur = bass.notes.reduce((s, n) => s + n.dur, 0) / bass.notes.length;
    expect(avgDur).toBeGreaterThan(480); // longer than a quarter on average
  });

  it('halftime: snare lands on beat 3', () => {
    const drums = song.tracks.find((t) => t.role === 'drums')!;
    const snares = drums.notes.filter((n) => n.pitch === 38 && n.vel > 60);
    const beat3 = snares.filter((n) => {
      const inBar = n.start % (4 * 480);
      return Math.abs(inBar - 2 * 480) < 30;
    });
    expect(beat3.length / snares.length).toBeGreaterThan(0.5);
  });

  it('canary', () => {
    expect({ code: song.code, bpm: song.bpm, fingerprint: fingerprint(song) }).toMatchSnapshot();
  });
});

describe('noir (dark jazz, spec)', () => {
  const song = generate({ genre: 'noir', seed: 1947n });
  const barTicks = 4 * 480;
  const sectionOf = (start: number) =>
    [...song.sections].reverse().find((s) => start >= s.startBar * barTicks)!;

  it('passes MIDI invariants and is deterministic', () => {
    checkInvariants(song);
    expect(fingerprint(generate({ code: song.code }))).toBe(fingerprint(song));
  });

  it('60–80 BPM, hard shuffle (swing ≥ 0.85)', () => {
    expect(song.bpm).toBeGreaterThanOrEqual(60);
    expect(song.bpm).toBeLessThanOrEqual(80);
    expect(song.swing).toBeGreaterThanOrEqual(0.85);
  });

  it('soloist is sparse: phrases with silence between', () => {
    const lead = song.tracks.find((t) => t.role === 'lead')!;
    const bars = song.durationTicks / barTicks;
    expect(lead.notes.length / bars).toBeLessThan(4);
  });

  it('walking only in dev/B with 2&4 accents; sparse in A; nothing in outro', () => {
    const bass = song.tracks.find((t) => t.role === 'bass')!;
    const devOrB = bass.notes.filter((n) => ['dev', 'B'].includes(sectionOf(n.start).name));
    const inA = bass.notes.filter((n) => sectionOf(n.start).name === 'A');
    const inOutro = bass.notes.filter((n) => sectionOf(n.start).name === 'outro');
    expect(devOrB.length).toBeGreaterThan(inA.length);
    expect(inOutro.length).toBe(0);
    // accents: offbeat (2,4) walking notes louder on average than 1,3
    const beatPos = (n: { start: number }) => Math.round((n.start % barTicks) / 480) % 4;
    const acc = devOrB.filter((n) => beatPos(n) === 1 || beatPos(n) === 3);
    const plain = devOrB.filter((n) => beatPos(n) === 0 || beatPos(n) === 2);
    const avg = (xs: { vel: number }[]) => xs.reduce((s, x) => s + x.vel, 0) / xs.length;
    expect(avg(acc)).toBeGreaterThan(avg(plain));
  });

  it('comping: extended voicings (≥4 notes), strummed (spread starts)', () => {
    const chords = song.tracks.find((t) => t.role === 'chords')!;
    const groups = new Map<number, number[]>();
    for (const n of chords.notes) {
      const bucket = Math.round(n.start / 240);
      groups.set(bucket, [...(groups.get(bucket) ?? []), n.start]);
    }
    const big = [...groups.values()].filter((g) => g.length >= 4);
    expect(big.length).toBeGreaterThan(0);
    // strum: starts inside a chord are NOT identical
    const spread = big.filter((g) => Math.max(...g) - Math.min(...g) > 4);
    expect(spread.length).toBeGreaterThan(big.length * 0.5);
  });

  it('texture drums: dark ride present, kick whisper-quiet, slaps 40–60', () => {
    const drums = song.tracks.find((t) => t.role === 'drums')!;
    expect(drums.notes.some((n) => n.pitch === 51)).toBe(true);
    for (const n of drums.notes.filter((x) => x.pitch === 36)) {
      expect(n.vel).toBeLessThanOrEqual(55);
    }
  });

  it('outro empties out (only the soloist rings)', () => {
    const outro = song.sections[song.sections.length - 1]!;
    expect(outro.name).toBe('outro');
    for (const track of song.tracks) {
      const inOutro = track.notes.filter(
        (n) => n.start >= outro.startBar * barTicks + 10,
      );
      if (track.role === 'lead') expect(inOutro.length).toBeLessThanOrEqual(2);
      else expect(inOutro.length).toBe(0);
    }
  });

  it('canary', () => {
    expect({ code: song.code, bpm: song.bpm, fingerprint: fingerprint(song) }).toMatchSnapshot();
  });
});

describe('anime', () => {
  const song = generate({ genre: 'anime', seed: 0xa17e2n });

  it('passes invariants, deterministic', () => {
    checkInvariants(song);
    expect(fingerprint(generate({ code: song.code }))).toBe(fingerprint(song));
  });

  it('bright major, fast, piano lead + strings', () => {
    expect(song.key.mode).toBe('major');
    expect(song.bpm).toBeGreaterThanOrEqual(128);
    expect(song.tracks.find((t) => t.role === 'lead')!.program).toBe(1);
    expect(song.tracks.find((t) => t.role === 'chords')!.program).toBe(48);
  });

  it('canary', () => {
    expect({ code: song.code, bpm: song.bpm, fingerprint: fingerprint(song) }).toMatchSnapshot();
  });
});

describe('blues', () => {
  const song = generate({ genre: 'blues', seed: 0xb1e5n });

  it('passes invariants, deterministic', () => {
    checkInvariants(song);
    expect(fingerprint(generate({ code: song.code }))).toBe(fingerprint(song));
  });

  it('strict 12-bar form, shuffle swing', () => {
    for (const s of song.sections) {
      expect(s.bars).toBe(12);
    }
    expect(song.swing).toBeGreaterThanOrEqual(0.5);
  });

  it('boogie bass: eighth notes walking the dom7 line', () => {
    const bass = song.tracks.find((t) => t.role === 'bass')!;
    const eighthsTotal = song.durationTicks / 240;
    expect(bass.notes.length).toBeGreaterThan(eighthsTotal * 0.9);
  });

  it('harmonica lead within register', () => {
    const lead = song.tracks.find((t) => t.role === 'lead')!;
    expect(lead.program).toBe(22);
    for (const n of lead.notes) {
      expect(n.pitch).toBeGreaterThanOrEqual(60);
      expect(n.pitch).toBeLessThanOrEqual(81);
    }
  });

  it('canary', () => {
    expect({ code: song.code, bpm: song.bpm, fingerprint: fingerprint(song) }).toMatchSnapshot();
  });
});

describe('military', () => {
  const song = generate({ genre: 'military', seed: 0x1812n });

  it('passes invariants, deterministic', () => {
    checkInvariants(song);
    expect(fingerprint(generate({ code: song.code }))).toBe(fingerprint(song));
  });

  it('2/4 march: oom-pah tuba alternates root/fifth per beat', () => {
    expect(song.timeSig).toEqual([2, 4]);
    const bass = song.tracks.find((t) => t.role === 'bass')!;
    expect(bass.program).toBe(58);
    const totalBeats = song.durationTicks / 480;
    expect(bass.notes.length).toBeGreaterThan(totalBeats * 0.8);
  });

  it('brass stabs + trumpet fanfare in major', () => {
    expect(song.key.mode).toBe('major');
    expect(song.tracks.find((t) => t.role === 'lead')!.program).toBe(56);
    expect(song.tracks.find((t) => t.role === 'chords')!.program).toBe(61);
  });

  it('canary', () => {
    expect({ code: song.code, bpm: song.bpm, fingerprint: fingerprint(song) }).toMatchSnapshot();
  });
});

describe('dark academia', () => {
  const song = generate({ genre: 'darkacademia', seed: 0xacaden });

  it('passes invariants, deterministic', () => {
    checkInvariants(song);
    expect(fingerprint(generate({ code: song.code }))).toBe(fingerprint(song));
  });

  it('chamber ensemble: no drums at all', () => {
    expect(song.tracks.find((t) => t.role === 'drums')).toBeUndefined();
    expect(song.tracks.length).toBe(3); // violin, cello, harpsichord
  });

  it('harpsichord plays Alberti eighths, cello sustains', () => {
    const chords = song.tracks.find((t) => t.role === 'chords')!;
    expect(chords.program).toBe(6);
    const avgDur = chords.notes.reduce((s, n) => s + n.dur, 0) / chords.notes.length;
    expect(avgDur).toBeLessThan(240); // broken eighths, not pads
    const bass = song.tracks.find((t) => t.role === 'bass')!;
    const avgBassDur = bass.notes.reduce((s, n) => s + n.dur, 0) / bass.notes.length;
    expect(avgBassDur).toBeGreaterThan(700); // bowed half-bars
  });

  it('canary', () => {
    expect({ code: song.code, bpm: song.bpm, fingerprint: fingerprint(song) }).toMatchSnapshot();
  });
});

describe('nightcore', () => {
  const song = generate({ genre: 'nightcore', seed: 0xca7n });

  it('passes invariants, deterministic', () => {
    checkInvariants(song);
    expect(fingerprint(generate({ code: song.code }))).toBe(fingerprint(song));
  });

  it('fast, lead screams up high, trance arp present', () => {
    expect(song.bpm).toBeGreaterThanOrEqual(160);
    expect(song.bpm).toBeLessThanOrEqual(180);
    const lead = song.tracks.find((t) => t.role === 'lead')!;
    expect(lead.program).toBe(90);
    for (const n of lead.notes) {
      expect(n.pitch).toBeGreaterThanOrEqual(76);
    }
    expect(song.tracks.find((t) => t.role === 'arp')).toBeDefined();
  });

  it('four on the floor: kick on every beat', () => {
    const drums = song.tracks.find((t) => t.role === 'drums')!;
    const kicks = drums.notes.filter((n) => n.pitch === 36 && n.vel > 80);
    const bars = song.durationTicks / (4 * 480);
    expect(kicks.length).toBeGreaterThan(bars * 3.2); // ~4 per bar minus fills/variation
  });

  it('canary', () => {
    expect({ code: song.code, bpm: song.bpm, fingerprint: fingerprint(song) }).toMatchSnapshot();
  });
});

describe('phonk (drift, spec v3)', () => {
  const song = generate({ genre: 'phonk', seed: 0xd21f73n });

  it('passes invariants, deterministic', () => {
    checkInvariants(song);
    expect(fingerprint(generate({ code: song.code }))).toBe(fingerprint(song));
  });

  it('120–135 BPM, phrygian or natural minor', () => {
    expect(song.bpm).toBeGreaterThanOrEqual(120);
    expect(song.bpm).toBeLessThanOrEqual(135);
    expect(['phrygian', 'naturalMinor']).toContain(song.key.mode);
  });

  it('spec structure: intro→buildup→drop→bridge→drop→outro', () => {
    expect(song.sections.map((s) => s.name)).toEqual([
      'intro', 'buildup', 'drop', 'bridge', 'drop', 'outro',
    ]);
  });

  it('halftime law: in drop bars every loud snare sits on step 8', () => {
    const drums = song.tracks.find((t) => t.role === 'drums')!;
    const drops = song.sections.filter((s) => s.name === 'drop');
    for (const s of drops) {
      const from = s.startBar * 4 * 480;
      const to = (s.startBar + s.bars) * 4 * 480;
      const snares = drums.notes.filter(
        (n) => n.pitch === 38 && n.vel > 100 && n.start >= from && n.start < to,
      );
      expect(snares.length).toBeGreaterThanOrEqual(s.bars - 1);
      for (const n of snares) {
        const inBar = n.start % (4 * 480);
        expect(Math.abs(inBar - 8 * 120)).toBeLessThanOrEqual(8);
      }
    }
  });

  it('808 is kick-locked: every bass onset has a kick within 8 ticks', () => {
    const drums = song.tracks.find((t) => t.role === 'drums')!;
    const bass = song.tracks.find((t) => t.role === 'bass')!;
    const kicks = drums.notes.filter((n) => n.pitch === 36).map((n) => n.start);
    for (const n of bass.notes) {
      const nearest = Math.min(...kicks.map((k) => Math.abs(k - n.start)));
      expect(nearest).toBeLessThanOrEqual(8);
    }
  });

  it('lead vocabulary: tonic, second, minor third, tritone, fifth, b7 only', () => {
    const lead = song.tracks.find((t) => t.role === 'lead')!;
    const second = song.key.mode === 'phrygian' ? 1 : 2;
    const allowed = new Set([0, second, 3, 6, 7, 10].map((o) => (song.key.tonic + o) % 12));
    for (const n of lead.notes) {
      expect(allowed.has(n.pitch % 12)).toBe(true);
    }
  });

  it('intro and outro are bare lead; bridge has no bass', () => {
    const barTicks = 4 * 480;
    // 10-tick margin: humanize jitter can nudge boundary notes across the line.
    const within = (s: { startBar: number; bars: number }, n: { start: number }) =>
      n.start >= s.startBar * barTicks + 10 && n.start < (s.startBar + s.bars) * barTicks - 10;
    const intro = song.sections[0]!;
    const bridge = song.sections.find((s) => s.name === 'bridge')!;
    for (const track of song.tracks) {
      if (track.role !== 'lead') {
        expect(track.notes.filter((n) => within(intro, n)).length).toBe(0);
      }
      if (track.role === 'bass') {
        expect(track.notes.filter((n) => within(bridge, n)).length).toBe(0);
      }
    }
  });

  it('buildup ends in silence: no onsets in its last beat', () => {
    const buildup = song.sections.find((s) => s.name === 'buildup')!;
    const barTicks = 4 * 480;
    const cutFrom = (buildup.startBar + buildup.bars) * barTicks - 480 + 10;
    const cutTo = (buildup.startBar + buildup.bars) * barTicks - 10;
    for (const track of song.tracks) {
      const inCut = track.notes.filter((n) => n.start >= cutFrom && n.start < cutTo);
      expect(inCut.length).toBe(0);
    }
  });

  it('canary', () => {
    expect({ code: song.code, bpm: song.bpm, fingerprint: fingerprint(song) }).toMatchSnapshot();
  });
});
