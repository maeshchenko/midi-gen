# midi-gen

Генератор MIDI-мелодий по жанрам в эстетике keygen-музыки. Каждая мелодия получает серийный код `XXXX-XXXX-XXXX-XXXX`, по которому она восстанавливается байт-в-байт — без базы данных. Экспорт в MIDI и MP3, headless-ядро для встраивания в игры.

Жанры: keygen, noir, anime, phonk, blues, military, dark academia.

## Как это работает

Код — упакованный сид детерминированного PRNG (Crockford Base32, 80 бит: версия + жанр + сид + CRC-8). Генерация — чистая функция `f(seed, genre) → Song`, поэтому код полностью заменяет хранение мелодии.

```ts
import { generate } from './src/core'; // headless, без Tone/DOM
const song = generate({ genre: 'phonk' });     // новая мелодия
const same = generate({ code: song.code });    // та же — из кода
```

## Команды

| команда | что |
|---|---|
| `npm run dev` | dev-сервер (Vite) |
| `npm test` | тесты (vitest) |
| `npm run typecheck` | tsc --noEmit |
| `npm run build` | сборка |

## Статус

Фазы 0–1 готовы (PRNG, кодек серийника, музыкальная теория, тесты). План и архитектура — [PLAN.md](PLAN.md), правила для агентов — [AGENTS.md](AGENTS.md), история — [docs/CHANGELOG.md](docs/CHANGELOG.md).
