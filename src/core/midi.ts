import { Midi } from '@tonejs/midi';
import { PPQ, type Song } from './types';

/**
 * Song IR → Standard MIDI File bytes. Ticks map 1:1 (both sides are PPQ 480),
 * so the .mid is exactly what the player performs. Sections become markers.
 */
export function songToMidi(song: Song): Uint8Array {
  const midi = new Midi();
  midi.header.name = `midi-gen ${song.code}`;
  midi.header.tempos.push({ ticks: 0, bpm: song.bpm });
  midi.header.timeSignatures.push({
    ticks: 0,
    timeSignature: [song.timeSig[0], song.timeSig[1]],
  });

  const beatTicks = (PPQ * 4) / song.timeSig[1];
  const barTicks = beatTicks * song.timeSig[0];
  for (const section of song.sections) {
    midi.header.meta.push({
      type: 'marker',
      text: section.name,
      ticks: section.startBar * barTicks,
    });
  }
  midi.header.update();

  for (const track of song.tracks) {
    const out = midi.addTrack();
    out.name = track.name;
    out.channel = track.channel;
    out.instrument.number = track.program;
    for (const n of track.notes) {
      out.addNote({
        midi: n.pitch,
        ticks: n.start,
        durationTicks: n.dur,
        velocity: n.vel / 127,
      });
    }
  }

  return midi.toArray();
}
