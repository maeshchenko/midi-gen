# Игровая интеграция: музыка для ритм-гонки

Гайд по использованию midi-gen как музыкального движка игры «космолёт ночью по трассе»: блоки появляются в ритм, рельеф (холмы/ямы) следует громкости, скорость — темпу. Всё, что нужно игре, лежит в `Song` IR — **аудио-анализ не нужен**.

## Жанры под игру

Три жанра спроектированы под общий «битмап-контракт» (AGENTS.md §12):

| id | звук | BPM |
|---|---|---|
| `outrun` | spacesynth / ночной synthwave: секвенсорный 16-й бас, кристальный арп, пады | 118–132 |
| `eurobeat` | гоночная аркада (Initial D): октавный бас-«мотор», брасс-стабы, saw-лид | 150–162 |
| `grimerun` | тёмный grime: half-time trap, глайдящий 808-саб, ковбелл-остинато | 132–148 |

Контракт у всех трёх:

1. **Сетка.** `humanize.timingTicks: 0` — каждый онсет ровно на 1/32 (60 тиков). Ноты = битмап.
2. **Арка динамики.** Форма `intro → build → drop → break → drop`: тихая «долина» (break) между двумя пиками (drop). Громкость секций (`sectionVelocity` 0.8…1.05) + прореженные слои в тихих секциях = готовый профиль рельефа.
3. **Фильтр.** Master-lowpass: приглушённый break, свип вверх на intro/build — слышимая «яма» совпадает с расчётной.

Тесты `beatmap grid` и `dynamics arc` (tests/genres.test.ts) сторожат контракт.

## Получить трек

```ts
import { generate } from 'midi-gen/core';

const song = generate({ genre: 'grimerun', minutes: 5 }); // ~5 минут (±15%)
save.levelCode = song.code; // 19 символов — весь уровень
// позже / у другого игрока:
const same = generate({ code: save.levelCode }); // тот же трек нота-в-ноту, та же длина
```

- `minutes: 1–7` — целевая длина, хранится в 3 flags-битах кода. Без `minutes` — естественная форма жанра (~30–60 сек).
- Точность ±15% (квант повтора — тело формы, 32 такта). Нужно точнее — перебор сидов:

```ts
let best;
for (let i = 0; i < 200; i++) {
  const s = generate({ genre: 'grimerun', minutes: 5 });
  const sec = (s.durationTicks / s.ppq) * (60 / s.bpm);
  if (!best || Math.abs(sec - 300) < Math.abs(best.sec - 300)) best = { s, sec };
}
```

- Длинные треки не луп: форма A B A B — нечётные проходы тела (`section.variant === 1`) несут другую прогрессию, паттерн ударных и мелодию; чётные — точные репризы.

## Блоки из онсетов

```ts
const secPerTick = 60 / (song.ppq * song.bpm);

// какой трек = какая дорожка блоков — на вкус; арп даёт ровную 16-ю сетку,
// лид — мелодический ритм, драмы — удары
const lead = song.tracks.find((t) => t.role === 'lead')!;
const blocks = lead.notes.map((n) => ({
  time: n.start * secPerTick,   // когда блок должен быть подобран
  lane: n.pitch % 4,            // дорожка из питча
  weight: n.vel / 127,          // размер/ценность из velocity
}));
```

Сетка гарантирована: `n.start % 60 === 0` всегда, спавн можно квантовать заранее.

## Рельеф из громкости

```ts
const barTicks = song.ppq * 4 * song.timeSig[0] / song.timeSig[1];
const bars = song.durationTicks / barTicks;
const height = new Array(Math.ceil(bars)).fill(0);
for (const t of song.tracks)
  for (const n of t.notes) height[Math.floor(n.start / barTicks)] += n.vel;
// height[] нормализовать → профиль трассы: drop = холмы, break = яма
```

Грубее, но проще — по секциям: `song.sections` + знание, что drop громче break ≥30% (закреплено тестом).

## Скорость

`song.bpm` — базовая скорость уровня; множитель по текущей секции (`drop` 1.0, `break` 0.6, …) — из той же `height[]` или по `section.name`.

## Звук

- **Браузер:** `createPlayer(song)` из `midi-gen/audio` (Tone.js) — живой синтез, включая master-фильтр долин; `renderToWav(song)` — офлайн-рендер в Blob.
- **Свой движок:** `songToMidi(song)` → стандартный .mid, либо сырые `song.tracks[].notes` (тики, питчи, velocity) — без Tone.js и лишних зависимостей (импортируется только `midi-gen/core`).
- **Pre-bake:** `node demo/generate-mid.mjs grimerun 10` — ассеты на этапе сборки.

Синхронизация: игра и плеер считают время от одного `song.bpm` — расхождений нет, источник тика один.

## Что под капотом (история — docs/CHANGELOG.md за 2026-06-12)

1. Жанры `eurobeat`, `outrun`, `grimerun` (append в `GENRE_IDS`, старые коды целы).
2. Битмап-контракт: нулевой тайминг-джиттер + арка динамики + master-фильтр (инвариант §12).
3. `minutes` в flags-битах кода: код = уровень нужной длины, формат кода не менялся (инвариант §4).
4. Вариация повторов через `Section.variant` и `sectionKey` (инвариант §13).
