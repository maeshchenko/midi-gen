# CHANGELOG

## 2026-06-12 — Бесшовная зацикливаемость (требование пользователя)

- **Требование:** все мелодии — бесконечные лупы, конец подходит под начало.
- **Сделано:**
  - `arrange.ts` — жёсткая концовка (финальный такт = тоника + crash) удалена полностью: последний такт играет в полную силу, последний аккорд прогрессий (VII/VI в миноре) гармонически ведёт в первый. Drum-филл и так ложится на последний такт секции = на шов лупа.
  - `humanize.ts` — onset'ы зажимаются строго внутрь лупа (`total - 10`): событие на/после loop point молча не сыграло бы.
  - `player.ts` — loop по умолчанию: `transport.loop`, точка = ровно `durationTicks`; хвосты release/delay звенят через шов — это и делает луп бесшовным. `setLoop(on)` на лету; onEnded только в non-loop.
  - UI — чекбокс LOOP (включён по умолчанию).
  - Тест: во всех треках onset < durationTicks, в последнем такте есть материал (нет «затухания в конец»).
- **Snapshot-канарейка обновлена осознанно** (fingerprint e7a42b23 → 5390e5a0): арранж изменился, кодов наружу ещё не выдавалось, CODE_VERSION остаётся 1.
- **Verification:** tsc чисто, vitest 43/43, в браузере: loop checked, прогресс идёт, консоль чистая.

## 2026-06-12 — Фаза 4 (вне очереди): браузерный синтезатор + играющий UI

- **Решение пользователя:** браузерное воспроизведение первично, MIDI/MP3-экспорт вторичен; после каждой фазы — работающий MVP в браузере. Фаза 4 выполнена раньше фазы 3.
- **Сделано:**
  - `src/audio/instruments.ts` — Tone.js-голоса без сэмплов: square-лид с vibrato + dotted-8th FeedbackDelay (фирменное keygen-эхо, время синхронизировано с BPM), saw-арп (PolySynth + lowpass), MonoSynth-бас с filter envelope, драм-кит (MembraneSynth kick/томы, NoiseSynth+bandpass снейр, MetalSynth хэты/crash), generic triangle fallback для будущих жанров. Мастер: Compressor → Limiter. Всё строится фабрикой `buildEnsemble(song)` против ТЕКУЩЕГО Tone-контекста — переиспользуется в `Tone.Offline` (фаза 5).
  - `src/audio/player.ts` — `createPlayer(song)`: тики → секунды напрямую (Transport BPM/PPQ не используется — звучит ровно то, что уйдёт в MIDI), Tone.Part на трек, `play/stop/positionSec/onEnded/dispose`, `Tone.start()` внутри play (autoplay-политика).
  - `src/ui/` — keygen-эстетика (тёмная панель, неоновый зелёный, моноширинный): селектор жанра, GENERATE, код click-to-copy, инпут + LOAD с CRC-валидацией и красной рамкой, play/stop, прогресс-бар (rAF), deep-link `?code=…` через history.replaceState.
- **Verification:** tsc чисто, vitest 42/42; вживую через chrome-devtools MCP: generate → код `2065-JMVD-1XS2-K45G` (180 BPM, C minor, 40s), play — прогресс идёт, консоль чистая (только favicon 404), LOAD lowercase-кода восстанавливает тот же трек, порченый код → «BAD CODE: checksum».
- **Известное ограничение:** баланс/тембры синтов не отслушаны человеком — итерации по слуху впереди.

## 2026-06-12 — Фаза 2: движок генерации + жанр keygen

- **Сделано:**
  - `src/core/gen/` — полный пайплайн: `song.ts` (оркестратор `generate()`), `form.ts` (секции из weighted-шаблонов), `harmony.ts` (chord timeline; прогрессия мемоизируется по ИМЕНИ секции — повторы «A» несут ту же гармонию), `drums.ts` (степ-паттерны 16 шагов, вариации, ghost notes, филлы snare-run/tom-descent, crash на старте секций), `bass.ts` (стиль synth8: качающие 8-е по руту, октавные подскоки, хроматический заход в следующий аккорд), `comping.ts` (tracker-арп 1/32 — фейк аккорда одним голосом, фирменный keygen-звук; + генерик sustained pads), `melody.ts` (мотивный движок: ритм A A B A по 2-тактовым юнитам, аккордовые тоны на сильных долях, leap recovery, каденция на руту/квинте), `arrange.ts` (слои по секциям, velocity-кривая, чистая концовка: финальный такт = тоника + kick/crash), `humanize.ts` (swing в тики + сидированный jitter).
  - `src/core/genres/` — `types.ts` (GenreConfig + hooks), `keygen.ts` (140–180 BPM, минор, i–VI–III–VII и родня, регистры, паттерны four-on-floor/driving-8s), реестр `getGenre`/`listGenres`.
  - `src/core/index.ts` — публичный headless-API.
  - `tests/generate.test.ts` — 11 тестов: байт-идентичность по коду, разные сиды → разные треки, snapshot-канарейка (fingerprint fnv1a32 от JSON), MIDI-инварианты, мелодия в ладу и регистре, сортировка нот, слои intro, 100 случайных сидов.
- **Решения:**
  - Под-потоки PRNG неймспейсятся жанром (`keygen/melody`) — один сид в разных жанрах даёт независимую случайность.
  - Мелодия кэшируется по имени секции: повторная «A» — та же мелодия (узнаваемость формы), потоки расходуются только при первом построении.
  - Порядок генераторов фиксирован (drums→bass→chords→arp→melody) — humanize потребляет RNG последовательно, перестановка сломает воспроизводимость.
  - Жанровый override поверх кода: `generate({ code, genre })` — тот же сид, другой стиль.
- **Verification:** tsc чисто, vitest 42/42. Snapshot: A-minor 177 BPM, 4 трека (арп 928 нот / лид 101 / бас 201 / ударные 428).

## 2026-06-12 — Старт проекта: scaffold + детерминированный фундамент (фазы 0–1)

- **Сделано:**
  - Scaffold: Vite + TypeScript strict + vitest (`package.json`, `tsconfig.json`, `vite.config.ts`), placeholder UI.
  - `src/core/prng.ts` — splitmix64 (BigInt) + sfc32 (32-битные int-ops), именованные под-потоки `streamFor(seed, name)` с утилитами `int/pick/weighted/chance/shuffle`.
  - `src/core/code.ts` — кодек серийника `XXXX-XXXX-XXXX-XXXX`: Crockford Base32, payload 80 бит = version(4)|genre(5)|flags(3)|seed(60)|crc8(8), нормализация confusables (O→0, I/L→1), `CodeError` с reason, `randomSeed()`, `nextSeed()`.
  - `src/core/types.ts` — Song IR (тики, PPQ 480, ударные ch 9), реестр `GENRE_IDS` (порядок = биты в коде, НЕ переставлять).
  - `src/core/theory/` — scales (9 ладов), chords (диатоника + форсированные качества, voicing), progressions (12-bar blues, expand).
  - Тесты: 31 шт — детерминизм PRNG, roundtrip кода 10k, CRC ловит порчу любого символа, теория, snapshot-канарейки.
- **Решения / архитектурный компромисс:**
  - «Хэш» мелодии — на самом деле сид: восстановление без БД работает только направлением код → музыка. Генерация — чистая функция `f(seed, genre) → Song`.
  - sfc32 поверх `Math.imul`/`>>>0` вместо float-PRNG — битовая воспроизводимость на всех JS-движках.
  - Под-потоки случайности по именам частей (melody/drums/…) — правка одного генератора не сдвигает случайность остальных.
  - Ядро (`src/core`) без зависимостей от DOM/Tone — headless для игр (Node/Worker).
  - MP3 — `@breezystack/lamejs` (у оригинального lamejs баг с современными бандлерами).
  - Swing будет печься в тики IR, а не через Tone-свинг — чтобы MIDI-экспорт и аудио совпадали.
- **Verification:** `tsc --noEmit` чисто, `vitest run` 31/31, 2 snapshot-канарейки записаны.
- **Урок (для будущих агентов):** snapshot-канарейки в `tests/prng.test.ts` и `tests/code.test.ts` сторожат воспроизводимость кодов. Изменился snapshot → все выданные коды сломаны → либо откат, либо bump `CODE_VERSION` в `src/core/code.ts`.

Полный план фаз — `PLAN.md` (фазы 0–1 ✅, дальше: движок генерации + жанр keygen).
