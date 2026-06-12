import './styles.css';
import { CodeError, generate, listGenres, nextSeed, songToMidi } from '../core';
import type { GenreId, Song } from '../core/types';
import { createPlayer, type Player } from '../audio/player';
import { renderToMp3, renderToWav } from '../audio/export';
import { createPianoRoll } from './pianoroll';
import { createScope } from './scope';
import { createHistory } from './history';
import { renderEmbed } from './embed';

// ?embed=1 → compact iframe player instead of the full app.
const bootParams = new URLSearchParams(location.search);
if (bootParams.get('embed') === '1') {
  renderEmbed(document.querySelector<HTMLDivElement>('#app')!, bootParams.get('code'));
} else {
  initApp();
}

function initApp(): void {
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
      <p class="track-title" id="title"></p>
      <p class="code-hint" id="code-hint">click code to copy</p>

      <div class="row">
        <label for="code-input">CODE</label>
        <input type="text" id="code-input" placeholder="XXXX-XXXX-XXXX-XXXX" spellcheck="false" />
        <button id="load">LOAD</button>
      </div>
      <p class="error-msg" id="error"></p>

      <p class="info" id="info">press GENERATE</p>
      <canvas class="roll" id="roll"></canvas>
      <canvas class="scope" id="scope"></canvas>
      <div class="progress"><div class="progress-fill" id="progress"></div></div>

      <div class="row transport">
        <button id="play" class="primary" disabled>▶ PLAY</button>
        <button id="stop" disabled>■ STOP</button>
        <button id="next" disabled title="next track in the seed chain">⏭ NEXT</button>
        <label class="loop-label"><input type="checkbox" id="loop" checked /> LOOP</label>
        <label class="loop-label" title="auto-advance to the next track"><input type="checkbox" id="radio" /> RADIO</label>
      </div>

      <div class="row transport">
        <button id="save-mid" disabled>SAVE .MID</button>
        <button id="save-wav" disabled>SAVE .WAV</button>
        <button id="save-mp3" disabled>SAVE .MP3</button>
        <button id="embed" disabled>EMBED</button>
      </div>
      <p class="code-hint" id="export-status"></p>

      <details class="history" id="history">
        <summary>HISTORY (0)</summary>
        <div class="history-list"></div>
      </details>

      <p class="footer">midi-gen v0.1</p>
    </div>
  `;

  const el = {
    genre: document.querySelector<HTMLSelectElement>('#genre')!,
    generate: document.querySelector<HTMLButtonElement>('#generate')!,
    code: document.querySelector<HTMLDivElement>('#code')!,
    title: document.querySelector<HTMLParagraphElement>('#title')!,
    codeHint: document.querySelector<HTMLParagraphElement>('#code-hint')!,
    codeInput: document.querySelector<HTMLInputElement>('#code-input')!,
    load: document.querySelector<HTMLButtonElement>('#load')!,
    error: document.querySelector<HTMLParagraphElement>('#error')!,
    info: document.querySelector<HTMLParagraphElement>('#info')!,
    progress: document.querySelector<HTMLDivElement>('#progress')!,
    play: document.querySelector<HTMLButtonElement>('#play')!,
    stop: document.querySelector<HTMLButtonElement>('#stop')!,
    next: document.querySelector<HTMLButtonElement>('#next')!,
    loop: document.querySelector<HTMLInputElement>('#loop')!,
    radio: document.querySelector<HTMLInputElement>('#radio')!,
    saveMid: document.querySelector<HTMLButtonElement>('#save-mid')!,
    saveWav: document.querySelector<HTMLButtonElement>('#save-wav')!,
    saveMp3: document.querySelector<HTMLButtonElement>('#save-mp3')!,
    exportStatus: document.querySelector<HTMLParagraphElement>('#export-status')!,
    embed: document.querySelector<HTMLButtonElement>('#embed')!,
    roll: document.querySelector<HTMLCanvasElement>('#roll')!,
    scope: document.querySelector<HTMLCanvasElement>('#scope')!,
    history: document.querySelector<HTMLDetailsElement>('#history')!,
  };

  const roll = createPianoRoll(el.roll);
  const scope = createScope(el.scope);
  scope.drawIdle();
  const history = createHistory(el.history, {
    onLoad(code) {
      try {
        setSong(generate({ code }));
        el.genre.value = song!.genre;
      } catch (e) {
        el.error.textContent = e instanceof CodeError ? `BAD CODE: ${e.reason}` : String(e);
      }
    },
  });

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
    el.title.textContent = next.title;
    el.info.textContent = `${next.bpm} BPM · ${NOTE_NAMES[next.key.tonic]} ${MODE_NAMES[next.key.mode] ?? next.key.mode} · ${Math.round((next.durationTicks / 480) * (60 / next.bpm))}s`;
    el.play.disabled = false;
    el.stop.disabled = true;
    el.next.disabled = false;
    el.saveMid.disabled = false;
    el.saveWav.disabled = false;
    el.saveMp3.disabled = false;
    el.embed.disabled = false;
    el.exportStatus.textContent = '';
    el.error.textContent = '';
    el.progress.style.width = '0%';
    roll.setSong(next);
    history.add(next);
    window.history.replaceState(null, '', `?code=${next.code}`);
  }

  function slug(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function download(blob: Blob, ext: string): void {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${slug(song!.title) || song!.genre}-${song!.code}.${ext}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    const kb = blob.size / 1024;
    el.exportStatus.textContent = `saved .${ext} · ${kb > 999 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`}`;
  }

  async function runExport(button: HTMLButtonElement, ext: string, make: () => Promise<Blob>): Promise<void> {
    if (!song) return;
    button.disabled = true;
    el.exportStatus.textContent = `rendering .${ext}…`;
    try {
      download(await make(), ext);
    } catch (err) {
      el.exportStatus.textContent = `export failed: ${String(err)}`;
    } finally {
      button.disabled = false;
    }
  }

  function tickProgress(): void {
    if (player?.isPlaying()) {
      el.progress.style.width = `${(player.positionSec() / player.durationSec) * 100}%`;
      roll.draw(player.positionSec());
      scope.draw();
      rafId = requestAnimationFrame(tickProgress);
    }
  }

  // Radio: chain the next deterministic seed and keep playing.
  function advance(): void {
    if (!song) return;
    setSong(generate({ genre: song.genre, seed: nextSeed(song.seed) }));
    el.play.click();
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
        // Defer out of Tone's event processing before dispose/transport.cancel.
        if (el.radio.checked) {
          queueMicrotask(advance);
          return;
        }
        el.stop.disabled = true;
        el.play.disabled = false;
        el.progress.style.width = '0%';
        scope.drawIdle();
      };
    }
    void player.play().then(() => {
      scope.arm();
      el.play.disabled = true;
      el.stop.disabled = false;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(tickProgress);
    });
  });

  el.loop.addEventListener('change', () => {
    if (el.loop.checked) el.radio.checked = false;
    player?.setLoop(el.loop.checked);
  });

  el.radio.addEventListener('change', () => {
    if (el.radio.checked) {
      el.loop.checked = false;
      player?.setLoop(false);
    }
  });

  el.next.addEventListener('click', () => {
    if (!song) return;
    const wasPlaying = player?.isPlaying() ?? false;
    setSong(generate({ genre: song.genre, seed: nextSeed(song.seed) }));
    if (wasPlaying) el.play.click();
  });

  el.stop.addEventListener('click', () => {
    player?.stop();
    cancelAnimationFrame(rafId);
    el.play.disabled = false;
    el.stop.disabled = true;
    el.progress.style.width = '0%';
    roll.draw(0);
    scope.drawIdle();
  });

  // Space toggles play/stop (unless typing a code).
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.target === el.codeInput) return;
    e.preventDefault();
    if (player?.isPlaying()) el.stop.click();
    else if (!el.play.disabled) el.play.click();
  });

  el.saveMid.addEventListener('click', () => {
    void runExport(el.saveMid, 'mid', () =>
      Promise.resolve(new Blob([songToMidi(song!).buffer as ArrayBuffer], { type: 'audio/midi' })),
    );
  });

  el.saveWav.addEventListener('click', () => {
    void runExport(el.saveWav, 'wav', () => renderToWav(song!));
  });

  el.embed.addEventListener('click', () => {
    if (!song) return;
    const url = `${location.origin}${location.pathname}?code=${song.code}&embed=1`;
    const snippet = `<iframe src="${url}" width="420" height="90" style="border:0;border-radius:8px" loading="lazy" title="midi-gen player"></iframe>`;
    void navigator.clipboard.writeText(snippet).then(() => {
      el.exportStatus.textContent = 'embed snippet copied — paste it into any HTML page';
      setTimeout(() => (el.exportStatus.textContent = ''), 3000);
    });
  });

  el.saveMp3.addEventListener('click', () => {
    void runExport(el.saveMp3, 'mp3', () =>
      renderToMp3(song!, {
        onProgress: (v) => {
          el.exportStatus.textContent = v < 0.4 ? 'rendering .mp3…' : `encoding .mp3… ${Math.round(v * 100)}%`;
        },
      }),
    );
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
}
