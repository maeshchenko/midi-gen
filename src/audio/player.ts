import * as Tone from 'tone';
import { PPQ, type Song } from '../core/types';
import { buildEnsemble, type Ensemble } from './instruments';

export interface Player {
  play(): Promise<void>;
  stop(): void;
  isPlaying(): boolean;
  positionSec(): number;
  /** Exact loop length (one pass of the song). */
  durationSec: number;
  setLoop(on: boolean): void;
  looping(): boolean;
  /** Called when playback ends (non-loop mode only). */
  onEnded?: () => void;
  dispose(): void;
}

/**
 * Live playback on the shared Tone Transport. Note ticks are converted to
 * seconds here — the Transport's own BPM/PPQ are not used, so what you hear
 * is exactly the IR (and exactly what MIDI export will contain).
 *
 * Songs are composed as seamless loops; looping is ON by default. The loop
 * point sits exactly at durationTicks — synth releases and delay tails ring
 * over the seam, which is what makes it sound continuous.
 */
export function createPlayer(song: Song, opts: { loop?: boolean } = {}): Player {
  const secPerTick = 60 / song.bpm / PPQ;
  const durationSec = song.durationTicks * secPerTick;
  const TAIL = 1.5;

  let ensemble: Ensemble | null = null;
  let parts: Tone.Part[] = [];
  let playing = false;
  let loop = opts.loop ?? true;
  let endEventId = -1;

  const transport = Tone.getTransport();

  const applyLoop = () => {
    transport.loop = loop;
    if (loop) {
      transport.loopStart = 0;
      transport.loopEnd = durationSec;
    }
  };

  const scheduleEnd = () => {
    if (endEventId >= 0) transport.clear(endEventId);
    endEventId = -1;
    if (!loop && playing) {
      endEventId = transport.scheduleOnce(() => {
        player.stop();
        player.onEnded?.();
      }, durationSec + TAIL);
    }
  };

  const build = () => {
    ensemble = buildEnsemble(song);
    parts = song.tracks.map((track, i) => {
      const voice = ensemble!.voices[i]!;
      const events = track.notes.map((n) => ({
        time: n.start * secPerTick,
        pitch: n.pitch,
        dur: Math.max(0.02, n.dur * secPerTick),
        vel: n.vel / 127,
      }));
      const part = new Tone.Part((time, ev) => {
        voice.trigger(ev.pitch, time, ev.dur, ev.vel);
      }, events);
      part.start(0);
      return part;
    });
    for (const a of ensemble!.automations) {
      transport.schedule((t) => a.apply(t), a.time);
    }
  };

  const player: Player = {
    durationSec,
    async play() {
      await Tone.start();
      if (!ensemble) build();
      if (playing) return;
      playing = true;
      applyLoop();
      scheduleEnd();
      transport.start();
    },
    stop() {
      if (endEventId >= 0) transport.clear(endEventId);
      endEventId = -1;
      transport.stop();
      transport.position = 0;
      transport.loop = false;
      playing = false;
    },
    isPlaying: () => playing,
    positionSec: () => {
      // What the UI should show is what the EAR hears now: transport time
      // minus the scheduling look-ahead and the device output latency —
      // otherwise the playhead runs ~100–150ms ahead of the sound.
      const ctx = Tone.getContext();
      const raw = ctx.rawContext as AudioContext;
      const latency = ctx.lookAhead + (raw.outputLatency || raw.baseLatency || 0);
      return Math.max(0, Math.min(transport.seconds - latency, durationSec));
    },
    setLoop(on) {
      loop = on;
      if (playing) {
        applyLoop();
        scheduleEnd();
      }
    },
    looping: () => loop,
    dispose() {
      player.stop();
      for (const p of parts) p.dispose();
      parts = [];
      ensemble?.dispose();
      ensemble = null;
      transport.cancel();
    },
  };
  return player;
}
