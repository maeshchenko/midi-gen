# midi-gen

Процедурный генератор зацикленной музыки в стиле keygen-эпохи. Выбираешь жанр — получаешь уникальный трек, его название в духе жанра (`NEON_OVERRIDE.EXE`, `Smoke over Room 9`, `Waltz for a Winter Ballerina`) и серийный код вида `2001-4D2P-F2DB-SQJM`. Код полностью заменяет файл: любой, у кого он есть, восстанавливает трек нота-в-ноту — вместе с названием, без базы данных и без сети. Все треки — бесшовные лупы.

**16 жанров:** Classic Keygen · Grime · Drift Phonk · Noir (dark jazz) · Anime Opening · Blues · Military Parade · Dark Academia · Nightcore · Music Box · Eurobeat · Outrun · Grime Run · Doomerwave · Doomer Run · Nightcore Run.

Звук — в браузере (Tone.js). Галочка **REAL** (справа от RADIO, по умолчанию выкл.) включает «живой» режим: реальные сэмплы инструментов + грув/динамика/микс поверх грид-IR — только для прослушивания и экспорта; MIDI и игровой API остаются на сетке. Без REAL — чистый синтез. Реализовано для nightcorerun, noir, dark academia (остальные — синт-fallback). Подробности: [docs/REAL_AUDIO.md](docs/REAL_AUDIO.md). Экспорт: `.mid`, `.wav`, `.mp3`.

## Запустить

```bash
npm install
npm run dev     # → http://localhost:5173
```

GENERATE — новый трек · клик по коду — копировать · ввод кода + LOAD — восстановить · Space — play/stop · NEXT — следующий трек цепочки · RADIO — бесконечный поток (треки сменяются сами) · SAVE — экспорт. HISTORY внизу помнит последние 20 кодов (★ — оставить навсегда).

## Встроить плеер на свою страницу

Кнопка **EMBED** в приложении копирует готовый сниппет:

```html
<iframe src="https://<хост>/midi-gen/?code=2001-4D2P-F2DB-SQJM&embed=1"
        width="420" height="90" style="border:0;border-radius:8px"
        loading="lazy" title="midi-gen player"></iframe>
```

Вставь в любой HTML — появится компактный плеер; звук стартует по клику (политика автоплея браузеров соблюдена).

## Использовать в коде (игры, приложения)

Ядро не зависит от Tone.js и DOM — работает в Node, воркерах, любом бандлере.

Для ритм-игр есть отдельный гайд — [docs/GAME.md](docs/GAME.md): жанры с «битмап-контрактом» (`outrun`, `eurobeat`, `grimerun`, `doomerrun`, `nightcorerun` — онсеты строго на сетке 1/32, арка громкости под рельеф), длина трека через `minutes`, блоки/рельеф/скорость прямо из Song IR без аудио-анализа.

```bash
npm run build:lib   # → dist/core.js, dist/audio.js (ESM + типы)
```

```ts
import { generate, songToMidi, nextSeed } from 'midi-gen/core';
import { createPlayer } from 'midi-gen/audio'; // браузер; peer: tone

// музыка уровня — в сейв кладём только код
const song = generate({ genre: 'phonk' });
save.musicCode = song.code;

// после загрузки — тот же трек, нота в ноту
const player = createPlayer(generate({ code: save.musicCode })); // loop по умолчанию
await player.play();   // вызывать из обработчика клика (autoplay policy)
player.stop();

// бесконечный плейлист: детерминированная цепочка сидов
const next = generate({ genre: 'phonk', seed: nextSeed(song.seed) });

// или отдать ноты собственному движку
const smf: Uint8Array = songToMidi(song); // стандартный MIDI-файл
```

### API ядра (`midi-gen/core`)

| функция | описание |
|---|---|
| `generate({ genre? \| seed? \| code? \| minutes? })` | трек (Song IR): треки → ноты `{pitch, start, dur, vel}` в тиках, PPQ 480; `minutes` 1–7 — целевая длина (±15%), хранится в коде |
| `decodeCode(code)` / `encodeCode(genre, seed)` | разбор/сборка серийника (CRC-8 ловит опечатки) |
| `listGenres()` | реализованные жанры |
| `songToMidi(song)` | `Uint8Array` со стандартным MIDI-файлом |
| `nextSeed(seed)` | следующий сид цепочки |

### `midi-gen/audio` (браузер)

`createPlayer(song, {loop})` — live-плеер на Tone.js; `renderToWav(song)` — офлайн-рендер в WAV. MP3-экспорт есть только в приложении (его энкодер-воркер привязан к сборке Vite).

### Пакетная генерация ассетов

```bash
node demo/generate-mid.mjs noir 10                # 10 .mid в demo/out/
node demo/generate-mid.mjs 2001-4D2P-F2DB-SQJM    # восстановить по коду
```

## Как устроены коды

Код — это упакованный сид детерминированного PRNG: 80 бит (версия 4 + жанр 5 + флаги 3 (длина в минутах) + сид 60 + CRC-8) в Crockford Base32. Генерация — чистая функция `f(seed, genre) → Song`, одинаковая на любой платформе, поэтому код *является* треком.

---

Внутренняя документация (архитектура, инварианты, история решений) — [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).
