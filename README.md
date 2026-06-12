# midi-gen

Процедурный генератор зацикленной музыки в стиле keygen-эпохи. Выбираешь жанр — получаешь уникальный трек и серийный код вида `2001-4D2P-F2DB-SQJM`. Код полностью заменяет файл: любой, у кого он есть, восстанавливает трек нота-в-ноту — без базы данных и без сети. Все треки — бесшовные лупы.

**9 жанров:** Classic Keygen · Grime · Drift Phonk · Noir (dark jazz) · Anime Opening · Blues · Military Parade · Dark Academia · Nightcore.

Звук синтезируется в браузере (Tone.js), сэмплы не используются. Экспорт: `.mid`, `.wav`, `.mp3`.

## Запустить

```bash
npm install
npm run dev     # → http://localhost:5173
```

GENERATE — новый трек · клик по коду — копировать · ввод кода + LOAD — восстановить · Space — play/stop · SAVE — экспорт.

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
| `generate({ genre? \| seed? \| code? })` | трек (Song IR): треки → ноты `{pitch, start, dur, vel}` в тиках, PPQ 480 |
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

Код — это упакованный сид детерминированного PRNG: 80 бит (версия 4 + жанр 5 + сид 60 + CRC-8) в Crockford Base32. Генерация — чистая функция `f(seed, genre) → Song`, одинаковая на любой платформе, поэтому код *является* треком.

---

Внутренняя документация (архитектура, инварианты, история решений) — [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).
