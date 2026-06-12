import { describe, expect, it } from 'vitest';
import { Midi } from '@tonejs/midi';
import { generate, songToMidi } from '../src/core';

describe('songToMidi', () => {
  const song = generate({ genre: 'keygen', seed: 0x51dn });
  const bytes = songToMidi(song);
  const parsed = new Midi(bytes);

  it('produces a valid SMF that parses back', () => {
    expect(bytes.length).toBeGreaterThan(1000);
    expect(parsed.header.ppq).toBe(480);
    expect(parsed.tracks.length).toBe(song.tracks.length);
  });

  it('keeps tempo and time signature', () => {
    expect(Math.round(parsed.header.tempos[0]!.bpm)).toBe(song.bpm);
    expect(parsed.header.timeSignatures[0]!.timeSignature).toEqual([4, 4]);
  });

  it('notes roundtrip exactly: ticks, pitch, duration', () => {
    for (let i = 0; i < song.tracks.length; i++) {
      const src = song.tracks[i]!;
      const dst = parsed.tracks[i]!;
      expect(dst.notes.length).toBe(src.notes.length);
      expect(dst.channel).toBe(src.channel);
      for (let j = 0; j < src.notes.length; j++) {
        expect(dst.notes[j]!.ticks).toBe(src.notes[j]!.start);
        expect(dst.notes[j]!.midi).toBe(src.notes[j]!.pitch);
        expect(dst.notes[j]!.durationTicks).toBe(src.notes[j]!.dur);
      }
    }
  });

  it('drums land on channel 9, programs survive', () => {
    const drumIdx = song.tracks.findIndex((t) => t.role === 'drums');
    expect(parsed.tracks[drumIdx]!.channel).toBe(9);
    const leadIdx = song.tracks.findIndex((t) => t.role === 'lead');
    expect(parsed.tracks[leadIdx]!.instrument.number).toBe(song.tracks[leadIdx]!.program);
  });

  it('section markers present', () => {
    const markers = parsed.header.meta.filter((m) => m.type === 'marker');
    expect(markers.length).toBe(song.sections.length);
    expect(markers[0]!.text).toBe(song.sections[0]!.name);
  });

  it('works for every implemented genre, including 2/4 military', () => {
    for (const genre of ['grime', 'noir', 'anime', 'blues', 'military', 'darkacademia', 'nightcore', 'phonk'] as const) {
      const s = generate({ genre, seed: 7n });
      const p = new Midi(songToMidi(s));
      expect(p.tracks.length).toBe(s.tracks.length);
      if (genre === 'military') {
        expect(p.header.timeSignatures[0]!.timeSignature).toEqual([2, 4]);
      }
    }
  });
});
