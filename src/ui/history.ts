import { getGenre } from '../core';
import type { GenreId, Song } from '../core/types';

interface HistoryEntry {
  code: string;
  /** Absent in entries saved before titles existed. */
  title?: string;
  genre: GenreId;
  bpm: number;
  ts: number;
  fav: boolean;
}

const KEY = 'midigen.history';
const MAX_RECENT = 20;

export interface History {
  add(song: Song): void;
}

/**
 * Recent-codes list in localStorage — without it a great track whose code was
 * never copied is gone forever. Newest first; positions are stable: re-loading
 * a known code never reorders the list. Favorites (★) are never evicted,
 * non-favorites are capped at MAX_RECENT.
 */
export function createHistory(
  details: HTMLDetailsElement,
  opts: { onLoad: (code: string) => void },
): History {
  const summary = details.querySelector('summary')!;
  const list = details.querySelector<HTMLElement>('.history-list')!;

  const load = (): HistoryEntry[] => {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
      return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
    } catch {
      return [];
    }
  };

  const save = (entries: HistoryEntry[]): void => {
    try {
      localStorage.setItem(KEY, JSON.stringify(entries));
    } catch {
      // Private mode / quota — history is a convenience, not critical.
    }
  };

  const genreName = (id: GenreId): string => {
    try {
      return getGenre(id).name;
    } catch {
      return id;
    }
  };

  const render = (entries: HistoryEntry[]): void => {
    summary.textContent = `HISTORY (${entries.length})`;
    list.innerHTML = '';
    for (const e of entries) {
      const row = document.createElement('div');
      row.className = 'history-row';

      const star = document.createElement('button');
      star.className = e.fav ? 'history-star fav' : 'history-star';
      star.textContent = e.fav ? '★' : '☆';
      star.title = e.fav ? 'remove from favorites' : 'keep forever';
      star.addEventListener('click', () => {
        const all = load();
        const hit = all.find((x) => x.code === e.code);
        if (hit) hit.fav = !hit.fav;
        save(all);
        render(all);
      });

      const code = document.createElement('span');
      code.className = 'history-code';
      code.textContent = e.title ? `${e.title} · ${e.code}` : e.code;
      code.title = 'load this track';
      code.addEventListener('click', () => opts.onLoad(e.code));

      const meta = document.createElement('span');
      meta.className = 'history-meta';
      meta.textContent = `${genreName(e.genre)} · ${e.bpm} BPM`;

      row.append(star, code, meta);
      list.appendChild(row);
    }
  };

  render(load());

  return {
    add(song) {
      const entries = load();
      if (entries.some((e) => e.code === song.code)) return; // known code keeps its place
      entries.unshift({
        code: song.code,
        title: song.title,
        genre: song.genre,
        bpm: song.bpm,
        ts: Date.now(),
        fav: false,
      });
      let recent = 0;
      const kept = entries.filter((e) => e.fav || ++recent <= MAX_RECENT);
      save(kept);
      render(kept);
    },
  };
}
