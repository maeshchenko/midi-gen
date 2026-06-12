import './styles.css';
import { CodeError, generate, listGenres } from '../core';
import type { GenreId, Song } from '../core/types';
import { createPlayer, type Player } from '../audio/player';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MODE_NAMES: Record<string, string> = {
  major: 'major',
  naturalMinor: 'minor',
  harmonicMinor: 'harm. minor',
  dorian: 'dorian',
  phrygian: 'phrygian',
  mixolydian: 'mixolydian',
  blues: 'blues',
  minorPentatonic: 'min. pentatonic',
  majorPentatonic: 'maj. pentatonic',
};

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <div class="panel">
    <h1 class="logo">≡ MIDI-GEN ≡</h1>
    <p class="tagline">KEYGEN MUSIC GENERATOR · NO DB · CODE = SONG</p>

    <div class="row">
      <label for="genre">GENRE</label>
      <select id="genre"></select>
      <button id="generate" class="primary">GENERATE</button>
    </div>

    <div class="code-box" id="code" title="click to copy">····-····-····-····</div>
    <p class="code-hint" id="code-hint">click code to copy</p>

    <div class="row">
      <label for="code-input">CODE</label>
      <input type="text" id="code-input" placeholder="XXXX-XXXX-XXXX-XXXX" spellcheck="false" />
      <button id="load">LOAD</button>
    </div>
    <p class="error-msg" id="error"></p>

    <p class="info" id="info">press GENERATE</p>
    <div class="progress"><div class="progress-fill" id="progress"></div></div>

    <div class="row transport">
      <button id="play" class="primary" disabled>▶ PLAY</button>
      <button id="stop" disabled>■ STOP</button>
      <label class="loop-label"><input type="checkbox" id="loop" checked /> LOOP</label>
    </div>

    <p class="footer">midi-gen v0.1 · greets to razor 1911</p>
  </div>
`;

const el = {
  genre: document.querySelector<HTMLSelectElement>('#genre')!,
  generate: document.querySelector<HTMLButtonElement>('#generate')!,
  code: document.querySelector<HTMLDivElement>('#code')!,
  codeHint: document.querySelector<HTMLParagraphElement>('#code-hint')!,
  codeInput: document.querySelector<HTMLInputElement>('#code-input')!,
  load: document.querySelector<HTMLButtonElement>('#load')!,
  error: document.querySelector<HTMLParagraphElement>('#error')!,
  info: document.querySelector<HTMLParagraphElement>('#info')!,
  progress: document.querySelector<HTMLDivElement>('#progress')!,
  play: document.querySelector<HTMLButtonElement>('#play')!,
  stop: document.querySelector<HTMLButtonElement>('#stop')!,
  loop: document.querySelector<HTMLInputElement>('#loop')!,
};

for (const g of listGenres()) {
  const opt = document.createElement('option');
  opt.value = g.id;
  opt.textContent = g.name;
  el.genre.appendChild(opt);
}

let song: Song | null = null;
let player: Player | null = null;
let rafId = 0;

function setSong(next: Song): void {
  player?.dispose();
  player = null;
  song = next;
  el.code.textContent = next.code;
  el.info.textContent = `${next.bpm} BPM · ${NOTE_NAMES[next.key.tonic]} ${MODE_NAMES[next.key.mode] ?? next.key.mode} · ${Math.round((next.durationTicks / 480) * (60 / next.bpm))}s`;
  el.play.disabled = false;
  el.stop.disabled = true;
  el.error.textContent = '';
  el.progress.style.width = '0%';
  history.replaceState(null, '', `?code=${next.code}`);
}

function tickProgress(): void {
  if (player?.isPlaying()) {
    el.progress.style.width = `${(player.positionSec() / player.durationSec) * 100}%`;
    rafId = requestAnimationFrame(tickProgress);
  }
}

el.generate.addEventListener('click', () => {
  setSong(generate({ genre: el.genre.value as GenreId }));
});

el.load.addEventListener('click', () => {
  const raw = el.codeInput.value.trim();
  if (!raw) return;
  try {
    setSong(generate({ code: raw }));
    el.codeInput.classList.remove('error');
    el.genre.value = song!.genre;
    el.codeInput.value = '';
  } catch (e) {
    el.codeInput.classList.add('error');
    el.error.textContent = e instanceof CodeError ? `BAD CODE: ${e.reason}` : String(e);
  }
});

el.codeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') el.load.click();
});

el.code.addEventListener('click', () => {
  if (!song) return;
  void navigator.clipboard.writeText(song.code).then(() => {
    el.codeHint.textContent = 'copied!';
    setTimeout(() => (el.codeHint.textContent = 'click code to copy'), 1200);
  });
});

el.play.addEventListener('click', () => {
  if (!song) return;
  if (!player) {
    player = createPlayer(song, { loop: el.loop.checked });
    player.onEnded = () => {
      el.stop.disabled = true;
      el.play.disabled = false;
      el.progress.style.width = '0%';
    };
  }
  void player.play().then(() => {
    el.play.disabled = true;
    el.stop.disabled = false;
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tickProgress);
  });
});

el.loop.addEventListener('change', () => {
  player?.setLoop(el.loop.checked);
});

el.stop.addEventListener('click', () => {
  player?.stop();
  cancelAnimationFrame(rafId);
  el.play.disabled = false;
  el.stop.disabled = true;
  el.progress.style.width = '0%';
});

// Deep link: ?code=XXXX-XXXX-XXXX-XXXX (no autoplay — browsers block it anyway).
const urlCode = new URLSearchParams(location.search).get('code');
if (urlCode) {
  try {
    setSong(generate({ code: urlCode }));
    el.genre.value = song!.genre;
  } catch {
    el.error.textContent = 'BAD CODE IN URL';
  }
}
