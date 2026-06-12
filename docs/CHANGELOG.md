# CHANGELOG

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
