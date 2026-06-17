import * as Tone from 'tone';
import { PPQ, type Song } from '../core/types';
import { buildEnsemble } from './instruments';
import { perform } from './perform';

/**
 * Render a song to a PCM buffer with Tone.Offline. The SAME buildEnsemble()
 * runs here as in live playback — Tone swaps the global context inside the
 * callback, so the graph builds against the offline context for free.
 */
export async function renderSong(song: Song, opts: { real?: boolean } = {}): Promise<AudioBuffer> {
  const secPerTick = 60 / song.bpm / PPQ;
  const durationSec = song.durationTicks * secPerTick + 2; // reverb/echo tail

  const real = opts.real ?? false;
  const toneBuffer = await Tone.Offline(
    async ({ transport }) => {
      const ensemble = buildEnsemble(song, { real });
      await ensemble.ready; // reverb IRs must exist before rendering starts
      song.tracks.forEach((track, i) => {
        const voice = ensemble.voices[i]!;
        const events = real
          ? perform(track, song)
          : track.notes.map((n) => ({
              time: n.start * secPerTick,
              pitch: n.pitch,
              dur: Math.max(0.02, n.dur * secPerTick),
              vel: n.vel / 127,
              slide: n.slide,
            }));
        new Tone.Part((time, ev) => {
          // A throw inside an offline-render callback hangs the whole render —
          // never let one bad trigger (e.g. a sample one-shot restart) do that.
          try {
            voice.trigger(ev.pitch, time, ev.dur, ev.vel, ev.slide);
          } catch {
            /* drop this note */
          }
        }, events).start(0);
      });
      for (const a of ensemble.automations) {
        transport.schedule((t) => a.apply(t), a.time);
      }
      transport.start(0.02);
    },
    durationSec,
    2,
    44100,
  );

  return toneBuffer.get() as AudioBuffer;
}
