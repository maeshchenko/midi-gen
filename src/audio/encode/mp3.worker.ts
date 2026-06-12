/**
 * MP3 encoding in a worker — lame is CPU-heavy, the UI must not freeze.
 * In: { left, right, sampleRate, bitrate }. Out: progress 0..1, then the blob bytes.
 */
import { Mp3Encoder } from '@breezystack/lamejs';

interface EncodeRequest {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
  bitrate: number;
}

const post = (msg: unknown, transfer?: Transferable[]) =>
  (self as unknown as Worker).postMessage(msg, transfer ?? []);

function toInt16(f32: Float32Array): Int16Array {
  const out = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) {
    const v = Math.max(-1, Math.min(1, f32[i]!));
    out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  return out;
}

self.onmessage = (e: MessageEvent<EncodeRequest>) => {
  const { left, right, sampleRate, bitrate } = e.data;
  const encoder = new Mp3Encoder(2, sampleRate, bitrate);
  const l = toInt16(left);
  const r = toInt16(right);

  const BLOCK = 1152;
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < l.length; i += BLOCK) {
    const data = encoder.encodeBuffer(l.subarray(i, i + BLOCK), r.subarray(i, i + BLOCK));
    if (data.length > 0) chunks.push(new Uint8Array(data));
    if (i % (BLOCK * 200) === 0) post({ type: 'progress', value: i / l.length });
  }
  const tail = encoder.flush();
  if (tail.length > 0) chunks.push(new Uint8Array(tail));

  const total = chunks.reduce((s, c) => s + c.length, 0);
  const bytes = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    bytes.set(c, off);
    off += c.length;
  }
  post({ type: 'done', bytes }, [bytes.buffer]);
};
