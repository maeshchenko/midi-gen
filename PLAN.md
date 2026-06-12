# midi-gen — генератор мелодий в стиле keygen-музыки

JS/TS, браузер + headless-ядро, экспорт MIDI и MP3, восстановление мелодии по коду без базы данных.

---

## 1. Ключевая идея: «хэш» = сид, а не хэш

Восстановление без БД возможно только в одну сторону: **код → музыка**. Код — упакованный сид детерминированного PRNG + метаданные. Генерация — чистая функция `f(seed, genre) → Song`. Один код всегда даёт байт-в-байт ту же мелодию.

### 1.1 Формат кода (keygen-style serial)

Crockford Base32 (`0123456789ABCDEFGHJKMNPQRSTVWXYZ`, без I/L/O/U; на вводе `O→0`, `I/L→1`). Payload 80 бит через BigInt:

| поле     | бит | назначение                                   |
|----------|-----|----------------------------------------------|
| version  | 4   | версия алгоритма генерации                   |
| genre    | 5   | id жанра (до 32)                             |
| flags    | 3   | резерв                                       |
| seed     | 60  | сид PRNG                                     |
| crc8     | 8   | CRC первых 72 бит (poly 0x07) — ловит опечатки |

80 бит = 16 символов Base32 → `XXXX-XXXX-XXXX-XXXX`. Жанр зашит в код. UI может переопределить жанр поверх кода (тот же сид, другой стиль).

### 1.2 Детерминированный PRNG

`Math.random()` в ядре запрещён. **splitmix64** (BigInt) разворачивает сид → **sfc32** (32-битные ops через `Math.imul`/`>>>0`, детерминированы на всех движках). **Именованные под-потоки**: `streamFor(seed, 'melody'|'drums'|…)` — сид потока = f(seed ⊕ fnv1a(name)); правка одного генератора не сдвигает случайность других. Утилиты: `int`, `pick`, `weighted`, `chance`, `shuffle`. Никаких `Date`, нестабильных сортировок.

### 1.3 Версионирование

Правки музыкальных алгоритмов после релиза ломают старые коды → bump поля `version`. Snapshot-тесты-канарейки в CI сторожат случайный слом.

---

## 2. Архитектура: три слоя, ядро без аудио

```
core (чистый TS, без DOM/Tone) → Song IR → midi (SMF bytes)
                                    └────→ audio (Tone.js): live-плеер, Tone.Offline → WAV/MP3
ui — тонкая обёртка
```

Headless для игр: `midi-gen/core` работает в Node/Worker/браузере без Tone.

### 2.1 Song IR

Время в тиках, PPQ = 480 (1:1 c MIDI; в секунды конвертит аудио-слой). См. `src/core/types.ts`: `Song { code, version, genre, seed, ppq, bpm, timeSig, key, swing, sections, tracks, durationTicks }`, `Track { name, channel, program, role, notes }`, ударные — канал 9.

### 2.2 Публичный API

```ts
// midi-gen/core
generate({ genre?, seed?, code? }): Song
encodeCode(genre, seed): string
decodeCode(code): { version, genre, flags, seed }   // CodeError на плохой CRC
listGenres(): GenreInfo[]
songToMidi(song): Uint8Array
nextSeed(seed): bigint          // бесконечный плейлист

// midi-gen/audio (браузер)
createPlayer(song): { play, stop, pause, seek, onProgress, dispose }
renderToWav(song): Promise<Blob>
renderToMp3(song, { bitrate?, onProgress? }): Promise<Blob>
```

Игра: `const song = generate({ code: save.musicCode }); createPlayer(song).play();`

### 2.3 Структура

```
src/core/   prng.ts, code.ts, types.ts
            theory/  scales.ts, chords.ts, progressions.ts
            gen/     song.ts(оркестратор), form.ts, harmony.ts, melody.ts,
                     bass.ts, drums.ts, comping.ts, arrange.ts, humanize.ts
            genres/  types.ts + keygen, noir, anime, phonk, blues, military, darkacademia
            midi.ts, index.ts
src/audio/  instruments.ts, fx.ts, player.ts, offline.ts, encode/{wav.ts, mp3.worker.ts}
src/ui/     main.ts, pianoroll.ts, styles.css
tests/
```

---

## 3. Музыкальный движок

### 3.1 Пайплайн `generate`

1. decode кода / новый сид → жанровый конфиг
2. глобальные: BPM, тональность (weighted), лад, swing
3. форма: шаблон секций (`intro A A B A outro`); блюз — жёсткий 12-тактовый квадрат
4. гармония: weighted-прогрессии + вероятностные подстановки → chord timeline
5. партии (мелодия последняя — знает гармонию): drums → bass → comping → melody → extras
6. аранжировка: слои по секциям, динамика, филлы на границах, финальная каденция
7. humanize: jitter тайминга/velocity — **из сид-потока**
8. Song IR

### 3.2 Мелодия — мотивный движок

Ритм мотива по сетке с весами onset'ов; высоты: старт с аккордового тона, шаги ±1 ступень (часто) / скачок на аккордовый тон / пауза; сильные доли — аккордовые тоны; leap recovery после скачка > кварты; жёсткий регистр. Развитие фразы 8 тактов: `A → A'(секвенция) → B(контраст) → A''(каденция)`. Каденция: последняя нота → 1/3/5 аккорда, удлинённая. Блюз — call-response + turnaround.

### 3.3 Ударные

Банки степ-паттернов (16 шагов: kick/snare/hat/perc), weighted на секцию + вариации шагов, филлы каждые 4/8 тактов, ghost notes, акценты хэтов. Phonk — хэт-роллы 1/32.

### 3.4 Жанры

`GenreConfig` (BPM, лады, прогрессии, структуры, инструменты, fx, humanize) + hooks-переопределения генераторов партий.

| жанр | BPM | гармония/лад | фишки | GM |
|---|---|---|---|---|
| noir | 70–95 swing | минор, i7–iv7–ii°7–V7, tritone sub, 9-ки | walking bass, brushes, vibes | muted trumpet 59, vibes 11, ac.bass 32 |
| anime | 128–160 | мажор, royal road IV△7–V7–iii7–vi; модуляция +1 в финале | скачковая мелодия, струнные | piano 0, strings 48, lead 80 |
| phonk | 130–145 half-time | вамп i–VI / i–iv | cowbell-мелодия, 808-глайды, хэт-роллы | ch10 cowbell 56, synth bass 38 |
| blues | 80–120 shuffle | жёсткий 12-bar, dom7 | call-response, turnaround, boogie-бас | overdrive gtr 29, harmonica 22 |
| military | 110–120, 2/4 | мажор I–IV–V | снейр-остинато, фанфары, piccolo, пунктир | trumpet 56, tuba 58, piccolo 72 |
| dark academia | 70–100 | гарм. минор, квинтовые секвенции | Alberti-арпеджио, трели, второй голос в терцию | harpsichord 6, cello 42, violin 40 |
| keygen | 140–180 | vi–IV–I–V, i–VI–III–VII | tracker-арпеджио 1/32, лид с вибрато+эхо, 4-on-floor | square 80, saw 81, synth bass 38 |

---

## 4. Аудио (Tone.js)

Причина выбора: транспорт с PPQ, синты, эффекты, `Tone.Offline()` — рендер тем же кодом, что live.

**Синтез без сэмплов**: piano → PolySynth(FMSynth); lead → MonoSynth + vibrato-LFO; 808 → MembraneSynth + portamento; cowbell → два square ~540+800 Гц через bandpass; snare → NoiseSynth; hats → MetalSynth; brass → AMSynth + filter env; strings → saw + slow attack; harpsichord → PluckSynth. FX: noir — vinyl crackle + reverb + wow; phonk — distortion + lowpass; keygen — bitcrusher + delay 1/8. Master — компрессор + limiter. Позже опция: Tone.Sampler + GM-сэмплы.

**Критично**: граф — фабрика `buildEnsemble(genre, context)` (Tone.Offline = отдельный context). Swing печётся в тики IR (MIDI и аудио совпадают). `Tone.start()` по жесту (iOS).

**Экспорт**: MIDI — `@tonejs/midi` (тики 1:1, маркеры секций); WAV — Tone.Offline + Int16 + 44-байтный заголовок; MP3 — Web Worker + `@breezystack/lamejs` (у оригинального lamejs баг с бандлерами), Mp3Encoder(2, 44100, 192), блоки 1152, progress.

---

## 5. UI

Эстетика кейгена: pixel-шрифт, бевелы, ASCII-лого. Жанровые табы, GENERATE, код click-to-copy, инпут + LOAD (CRC-валидация), play/stop + прогресс, piano-roll canvas, экспорт .mid/.wav/.mp3, deep-link `?code=…`. Vite + vanilla TS.

---

## 6. Тесты (vitest)

1. **Детерминизм** — snapshot: код → Song JSON стабилен (главный тест)
2. roundtrip кода 10k; CRC ловит порчу символа
3. инварианты: pitch 0–127, dur>0, регистр, лад, drums на ch9
4. SMF: songToMidi → parse → совпадение
5. жанровые: блюз 12-bar, phonk cowbell, military снейр-остинато

## 7. Риски

| риск | митигация |
|---|---|
| музыкальное качество — риск №1 | мотивный движок + констрейнты + каденции; фаза 6 длинная |
| недетерминизм | sfc32 int-ops, запрет Math.random/Date, snapshot-канарейки |
| слом старых кодов | version в коде |
| lamejs + бандлеры | maintained-форк, воркер |
| Tone.Offline ≠ live | единая buildEnsemble(context) |
| MP3 блокирует UI | Web Worker + progress |

## 8. Фазы

| # | что | приёмка | статус |
|---|---|---|---|
| 0 | Vite + TS strict + vitest | dev/test зелёные | ✅ |
| 1 | prng, code (Base32+CRC), types, theory | roundtrip-тесты | ✅ |
| 2 | пайплайн gen/* + жанр keygen до Song IR | snapshot-тест | — |
| 3 | MIDI-экспорт + мин. UI | .mid играет в DAW | — |
| 4 | Tone-инструменты + live-плеер | play/stop = MIDI | — |
| 5 | offline + WAV + MP3-воркер | оба экспорта | — |
| 6 | остальные 6 жанров | жанр узнаваем вслепую | — |
| 7 | piano-roll, keygen-эстетика, ?code= | UX-чеклист | — |
| 8 | exports map, README, node-демо | core в Node без Tone | — |

Зависимости: `tone`, `@tonejs/midi`, `@breezystack/lamejs`; dev: vite, typescript, vitest.
