import { generate } from '../core';
import { createPlayer, type Player } from '../audio/player';

/**
 * Embed mode (?embed=1&code=XXXX-…): a compact player for <iframe> use on
 * third-party pages. The play click is the user gesture browsers require
 * before allowing sound.
 */
export function renderEmbed(app: HTMLElement, code: string | null): void {
  document.body.classList.add('embed-body');

  let song;
  try {
    song = generate(code ? { code } : { genre: 'keygen' });
  } catch {
    app.innerHTML = `<div class="embed-panel"><span class="embed-error">BAD CODE</span></div>`;
    return;
  }

  app.innerHTML = `
    <div class="embed-panel">
      <button id="e-play" class="primary embed-play" title="play / stop">▶</button>
      <div class="embed-mid">
        <div class="embed-code">${song.title} · ${song.code}</div>
        <div class="progress"><div class="progress-fill" id="e-progress"></div></div>
      </div>
      <a class="embed-brand" href="${location.pathname}?code=${song.code}" target="_blank" rel="noopener">midi&#8209;gen</a>
    </div>`;

  const playBtn = document.querySelector<HTMLButtonElement>('#e-play')!;
  const progress = document.querySelector<HTMLDivElement>('#e-progress')!;
  let player: Player | null = null;
  let rafId = 0;

  const tick = () => {
    if (player?.isPlaying()) {
      progress.style.width = `${(player.positionSec() / player.durationSec) * 100}%`;
      rafId = requestAnimationFrame(tick);
    }
  };

  playBtn.addEventListener('click', () => {
    if (player?.isPlaying()) {
      player.stop();
      cancelAnimationFrame(rafId);
      playBtn.textContent = '▶';
      progress.style.width = '0%';
      return;
    }
    player ??= createPlayer(song, { loop: true });
    void player.play().then(() => {
      playBtn.textContent = '■';
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(tick);
    });
  });
}
