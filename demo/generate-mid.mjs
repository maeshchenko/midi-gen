/**
 * Headless smoke-proof + asset baking demo: generate .mid files from the
 * terminal — no browser, no Tone.js, just the core.
 *
 *   npm run demo                       # 3 random keygen tracks
 *   node demo/generate-mid.mjs noir 5  # 5 noir tracks
 *   node demo/generate-mid.mjs 2001-4D2P-F2DB-SQJM   # restore one by code
 *
 * Requires `npm run build:lib` first (the npm script does it for you).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { generate, songToMidi, listGenres, GENRE_IDS } from '../dist/core.js';

const [, , arg = 'keygen', countArg = '3'] = process.argv;
const outDir = new URL('./out/', import.meta.url).pathname;
mkdirSync(outDir, { recursive: true });

const isCode = /^[0-9a-z]{4}(-?[0-9a-z]{4}){3}$/i.test(arg);
const jobs = isCode
  ? [{ code: arg }]
  : Array.from({ length: Number(countArg) || 1 }, () => ({ genre: arg }));

if (!isCode && !GENRE_IDS.includes(arg)) {
  console.error(`unknown genre "${arg}". Implemented: ${listGenres().map((g) => g.id).join(', ')}`);
  process.exit(1);
}

for (const job of jobs) {
  const song = generate(job);
  const file = `${outDir}${song.genre}-${song.code}.mid`;
  writeFileSync(file, songToMidi(song));
  console.log(
    `${song.code}  ${song.genre.padEnd(12)} ${String(song.bpm).padStart(3)} BPM  ` +
      `${song.tracks.reduce((s, t) => s + t.notes.length, 0)} notes  → ${file}`,
  );
}
