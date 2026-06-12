/**
 * midi-gen/audio — browser playback and rendering on Tone.js.
 *
 * Note: renderToMp3 is NOT exported here — its Web Worker is wired through
 * Vite's `new URL` asset handling and only works inside the app build. Games
 * embedding the library get live playback + WAV; MP3 stays an app feature.
 */

import type { Song } from '../core/types';
import { renderSong } from './offline';
import { audioBufferToWav } from './encode/wav';

export { createPlayer, type Player } from './player';
export { buildEnsemble, type Ensemble, type Voice, type EnsembleAutomation } from './instruments';
export { renderSong } from './offline';
export { audioBufferToWav } from './encode/wav';

/** Render a song offline and pack it as a WAV blob. */
export async function renderToWav(song: Song): Promise<Blob> {
  return audioBufferToWav(await renderSong(song));
}
