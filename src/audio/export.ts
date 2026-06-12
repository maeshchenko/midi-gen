import type { Song } from '../core/types';
import { renderSong } from './offline';
import { audioBufferToWav } from './encode/wav';

export async function renderToWav(song: Song): Promise<Blob> {
  return audioBufferToWav(await renderSong(song));
}

export interface Mp3Options {
  bitrate?: number;
  /** 0..1 across render+encode. */
  onProgress?: (value: number) => void;
}

export async function renderToMp3(song: Song, opts: Mp3Options = {}): Promise<Blob> {
  const bitrate = opts.bitrate ?? 192;
  opts.onProgress?.(0.05);
  const buffer = await renderSong(song);
  opts.onProgress?.(0.4); // render done, encoding is the long half

  const left = buffer.getChannelData(0);
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;

  return new Promise<Blob>((resolve, reject) => {
    const worker = new Worker(new URL('./encode/mp3.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e: MessageEvent<{ type: string; value?: number; bytes?: Uint8Array }>) => {
      if (e.data.type === 'progress') {
        opts.onProgress?.(0.4 + e.data.value! * 0.6);
      } else if (e.data.type === 'done') {
        opts.onProgress?.(1);
        resolve(new Blob([e.data.bytes!.buffer as ArrayBuffer], { type: 'audio/mpeg' }));
        worker.terminate();
      }
    };
    worker.onerror = (err) => {
      worker.terminate();
      reject(new Error(`mp3 worker failed: ${err.message}`));
    };
    // Copy the channel data — the AudioBuffer stays usable for re-renders.
    worker.postMessage({
      left: Float32Array.from(left),
      right: Float32Array.from(right),
      sampleRate: buffer.sampleRate,
      bitrate,
    });
  });
}
