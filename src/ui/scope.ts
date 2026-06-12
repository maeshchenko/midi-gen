import * as Tone from 'tone';

export interface Scope {
  /** Tap the master output. Call after the first PLAY (AudioContext running). */
  arm(): void;
  /** Stroke the current waveform frame (call from the playback rAF loop). */
  draw(): void;
  /** Flat phosphor line for the stopped state. */
  drawIdle(): void;
}

/**
 * Keygen-style oscilloscope. The analyser is fanned out from the master
 * destination — a parallel tap, audio routing untouched — so it hears every
 * genre's full FX chain and survives player dispose/rebuild cycles.
 */
export function createScope(canvas: HTMLCanvasElement): Scope {
  const ctx = canvas.getContext('2d')!;
  let analyser: Tone.Analyser | null = null;

  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
  };

  const drawWave = (values: Float32Array | null) => {
    if (canvas.width === 0) resize();
    const W = canvas.width;
    const H = canvas.height;
    ctx.fillStyle = '#060610';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#5dfc70';
    ctx.lineWidth = Math.max(1.5, window.devicePixelRatio || 1);
    ctx.shadowColor = 'rgba(93, 252, 112, 0.7)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    if (!values || values.length < 2) {
      ctx.moveTo(0, H / 2);
      ctx.lineTo(W, H / 2);
    } else {
      for (let i = 0; i < values.length; i++) {
        const x = (i / (values.length - 1)) * W;
        const y = H / 2 - (values[i] ?? 0) * H * 0.45;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  };

  window.addEventListener('resize', () => {
    resize();
    drawWave(analyser ? (analyser.getValue() as Float32Array) : null);
  });

  resize();

  return {
    arm() {
      if (analyser) return;
      analyser = new Tone.Analyser('waveform', 1024);
      Tone.getDestination().connect(analyser);
    },
    draw() {
      drawWave(analyser ? (analyser.getValue() as Float32Array) : null);
    },
    drawIdle() {
      drawWave(null);
    },
  };
}
