# AGENTS.md — правила для агентов

Проект: генератор MIDI-мелодий по жанрам в стиле keygen-музыки. Мелодия восстанавливается из серийного кода без БД. Архитектура и план фаз — `PLAN.md`, история решений — `docs/CHANGELOG.md`.

## Инварианты — НЕ ЛОМАТЬ

1. **Детерминизм ядра.** В `src/core/` запрещены `Math.random`, `Date`, любая платформозависимость. Вся случайность — только через именованные потоки `streamFor(seed, name)` из `prng.ts`. Сортировки — только с явным tiebreaker.
2. **Snapshot-канарейки.** Изменился snapshot → ранее выданные коды звучат иначе. **Политика (решение пользователя 2026-06-12): проекта ещё никто не использует — до релиза ломать коды ОК**, обновляй снапшоты (`vitest -u`) свободно, без bump'а версии; фиксируй осознанность в CHANGELOG. После релиза — bump `CODE_VERSION` в `src/core/code.ts`. Канарейка сторожит только СЛУЧАЙНЫЙ слом.
3. **Порядок `GENRE_IDS`** в `src/core/types.ts` = индексы в битах серийника. Новые жанры — только append в конец.
4. **Формат кода фиксирован:** 80 бит = version(4)|genre(5)|flags(3)|seed(60)|crc8(8), Crockford Base32, 16 символов `XXXX-XXXX-XXXX-XXXX`.
5. **Song IR:** время в тиках, PPQ 480, ударные — канал 9, velocity 1–127. Swing печётся в тики (MIDI и аудио обязаны совпадать).
6. **Слои не смешивать:** `src/core` не импортирует из `src/audio`/`src/ui` и не трогает DOM/Tone. Tone.js — только в `src/audio`.
7. **Аудио-граф** строить через фабрику с передачей context — `Tone.Offline` создаёт отдельный context, live-граф там не работает.
8. **Треки — бесшовные лупы.** Никаких жёстких концовок в arrange; последний аккорд прогрессии должен вести в первый; все onset'ы строго внутри `durationTicks`. Loop в плеере — режим по умолчанию.
9. **После каждой фазы — работающий MVP в браузере** (требование пользователя 2026-06-12).

## Команды

- `npm run dev` — Vite dev-сервер
- `npm test` / `npm run test:watch` — vitest
- `npm run typecheck` — tsc --noEmit
- `npm run build` — typecheck + vite build
- `npm run build:lib` — tsup → dist/ (библиотека: core + audio)
- `npm run demo` — headless-генерация .mid в Node (смоук headless-инварианта)

## Стек

tone ^15, @tonejs/midi ^2, @breezystack/lamejs (не оригинальный lamejs — баг с бандлерами), vite, vitest, TypeScript strict.
