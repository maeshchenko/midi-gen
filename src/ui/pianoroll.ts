import { PPQ, type Song, type TrackRole } from '../core/types';

const ROLE_COLORS: Record<TrackRole, string> = {
  lead: '#5dfc70',
  arp: '#38b6ff',
  bass: '#ff9f43',
  chords: '#b465ff',
  drums: '#ff5d7a',
  counter: '#ffd75d',
  fx: '#8888aa',
};

export interface PianoRoll {
  setSong(song: Song | null): void;
  /** Redraw with the playhead at this transport position. */
  draw(positionSec: number): void;
}

/**
 * Static note layer rendered once per song into an offscreen canvas; the
 * rAF loop only blits it and strokes the playhead — cheap at 60fps.
 */
export function createPianoRoll(canvas: HTMLCanvasElement): PianoRoll {
  const ctx = canvas.getContext('2d')!;
  const staticLayer = document.createElement('canvas');
  let song: Song | null = null;
  let durationSec = 1;

  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    staticLayer.width = canvas.width;
    staticLayer.height = canvas.height;
  };

  const renderStatic = () => {
    const c = staticLayer.getContext('2d')!;
    const W = staticLayer.width;
    const H = staticLayer.height;
    c.fillStyle = '#060610';
    c.fillRect(0, 0, W, H);
    if (!song) return;

    const beatTicks = (PPQ * 4) / song.timeSig[1];
    const barTicks = beatTicks * song.timeSig[0];
    const total = song.durationTicks;

    // Pitch window: fit the song, keep at least two octaves of context.
    let lo = 127;
    let hi = 0;
    for (const track of song.tracks) {
      for (const n of track.notes) {
        if (n.pitch < lo) lo = n.pitch;
        if (n.pitch > hi) hi = n.pitch;
      }
    }
    lo -= 2;
    hi += 2;
    if (hi - lo < 24) {
      const mid = (hi + lo) / 2;
      lo = Math.floor(mid - 12);
      hi = Math.ceil(mid + 12);
    }
    const yOf = (pitch: number) => H - ((pitch - lo) / (hi - lo)) * H;
    const noteH = Math.max(2, H / (hi - lo) - 1);

    // Bar grid; section boundaries dashed and labeled.
    c.strokeStyle = '#16162c';
    c.lineWidth = 1;
    for (let bar = 1; bar * barTicks < total; bar++) {
      const x = ((bar * barTicks) / total) * W;
      c.globalAlpha = bar % 4 === 0 ? 1 : 0.45;
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, H);
      c.stroke();
    }
    c.globalAlpha = 1;
    c.strokeStyle = '#3a3a5c';
    c.fillStyle = '#5c5c8a';
    c.font = `${Math.round(10 * (window.devicePixelRatio || 1))}px monospace`;
    c.setLineDash([4, 4]);
    for (const s of song.sections) {
      const x = ((s.startBar * barTicks) / total) * W;
      if (s.startBar > 0) {
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x, H);
        c.stroke();
      }
      c.fillText(s.name.toUpperCase(), x + 4, 12 * (window.devicePixelRatio || 1));
    }
    c.setLineDash([]);

    for (const track of song.tracks) {
      c.fillStyle = ROLE_COLORS[track.role] ?? '#8888aa';
      c.globalAlpha = track.role === 'drums' ? 0.45 : 0.85;
      for (const n of track.notes) {
        const x = (n.start / total) * W;
        const w = Math.max(1.5, (n.dur / total) * W);
        c.fillRect(x, yOf(n.pitch) - noteH / 2, w, noteH);
      }
    }
    c.globalAlpha = 1;
  };

  const draw = (positionSec: number) => {
    if (canvas.width === 0) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(staticLayer, 0, 0);
    if (!song) return;
    const x = Math.min(1, positionSec / durationSec) * canvas.width;
    ctx.strokeStyle = '#e8fff0';
    ctx.lineWidth = Math.max(1, (window.devicePixelRatio || 1));
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  window.addEventListener('resize', () => {
    resize();
    renderStatic();
    draw(0);
  });

  return {
    setSong(next) {
      song = next;
      durationSec = next ? (next.durationTicks / PPQ) * (60 / next.bpm) : 1;
      resize();
      renderStatic();
      draw(0);
    },
    draw,
  };
}
