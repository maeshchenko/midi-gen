# Live Performance Layer — design spec

Date: 2026-06-17
Status: IMPLEMENTED (phases 1–3). Live record of the shipped system + lessons:
`docs/REAL_AUDIO.md`. Genres done: nightcorerun, noir, darkacademia.

## Context / problem

Real-instrument mode (galочка `REAL`, default ON) подменяет синт-голоса сэмплами,
но звучит «механически генеративно». Причины (по исследованию):

1. **Machine-gun**: `Tone.Sampler`/`Tone.Players` играют ОДИН и тот же буфер каждый
   удар → идентичная волна 800× подряд. Нет round-robin, нет velocity-слоёв.
2. **Плоский микс**: голоса моно/по центру/сухие → «демо»-звук без ширины и глубины.
3. **Исполнение**: тайминг строго на сетке, динамика ровная, повторы идентичны.

## Жёсткий принцип (constraint)

Всё ниже — **трансформация ТОЛЬКО аудио-слоя, ТОЛЬКО при `real === true`**, на
этапе воспроизведения и offline-рендера. `Song` IR, `songToMidi`, экспорт в игру по
API — **не трогаем**, остаются строго на сетке. «Живой звук» — только для прослушивания
и скачивания .wav/.mp3. Игра получает MIDI как раньше.

Никаких правок в `src/core/**`.

## Архитектура

```
Song IR (сетка, без изменений)
        │  events[] {pitch,start,dur,vel,slide}
        ▼  ── real mode only ──
 ② PERFORMANCE PASS   perform(track, song) → events'      (новый src/audio/perform.ts, чистая фн)
        │  events'  (сдвинутый тайминг, форма динамики, длины)
        ▼
 ① SAMPLE ENGINE   round-robin + velocity-слои + микро-вариация  (голоса в instruments.ts)
        │  audio
        ▼
 ③ MIX / SPACE   per-voice pan + reverb-sends + EQ-carve   (buildEnsemble)
        ▼  существующий master bus → out / Tone.Offline
```

Три независимых подсистемы, каждая поставляется отдельно. Порядок по impact:
**① engine → ③ mix → ② performance**. Первая реализация — `nightcorerun` (есть сэмплы);
perform-pass и mix жанро-независимы и работают для real-режима любого жанра.

Бюджет сэмплов: rich, ~40MB на всю библиотеку, lazy-загрузка по жанру (грузится только
подмножество текущего жанра). mono 128k mp3.

---

## ① Sample engine — round-robin + velocity layers

### Модель данных (`src/audio/samples.ts`)

Заменяем «note→file» на слоистую структуру.

```ts
// один round-robin вариант = имя файла
type RrFiles = string[];                  // ['kick_v2_rr1.mp3','kick_v2_rr2.mp3',...]
interface VelLayer { vMax: number; rr: RrFiles; } // vMax — верхняя граница velocity 0..1
interface DrumLaneDef { layers: VelLayer[]; }      // отсортированы по vMax
interface DrumKitDefV2 { baseUrl: string; lanes: Record<string, DrumLaneDef>; }
```

Питч-инструменты: тот же принцип, но zone-файлы per нота. tonejs-instruments даёт 1
сэмпл/ноту (нет настоящих rr/vel) → для питча velocity-слой ОДИН, rr эмулируется.

### Голоса (`src/audio/instruments.ts`)

**Барабаны — `makeRealDrumKit` v2 (пул `Tone.Players`)**
- Регистрируем ВСЕ файлы лейна (все vel×rr) в один `Tone.Players`, имена-ключи
  `lane__v{i}__rr{j}`.
- trigger(pitch,t,d,v):
  1. лейн = NOTE_TO_LANE[pitch];
  2. слой = первый `layer.vMax >= v` (велосити выбирает ТЕМБР, не только громкость);
  3. rr = следующий индекс по кругу для (лейн,слой), **никогда не повторяем предыдущий**
     (cycle с памятью last-rr на лейн);
  4. микро-вариация: `player.playbackRate = 1 ± detune(≤±10 центов)`,
     `player.volume = gainToDb(v)±0.5dB`, старт `t ± 2..4ms`;
  5. try/catch вокруг `.start()` (throw в offline callback вешает рендер — критично,
     уже выученный урок).

**Питч (гитара/бас/скрипка) — `makeSampler` v2**
- Массив из R `Tone.Sampler`'ов на один и тот же мультисэмпл (R=2..3 «псевдо-rr»),
  каждый со своим фикс-микро-detune/старт-смещением, чтобы повторные ноты били РАЗНЫМИ
  семплерами → волна отличается.
- trigger: cycle псевдо-rr (не повторять предыдущий); velocity→тембр через
  per-voice `Tone.Filter` cutoff и (для гитары/баса) `Tone.Distortion` drive,
  модулируемые велосити (жёстче удар = ярче/грязнее); + микро-detune на ноту.
- `cutoff` по-прежнему экспонируется для filter-automation (как сейчас).

### Источники сэмплов
- Барабаны: **VCSL (CC0)** — скачать velocity (`v2..v9`) и round-robin (`rr1/rr2`)
  варианты, которые в прошлый раз отбросили. Сгруппировать в 2–3 vel-слоя × 2–4 rr на
  лейн (kick/snare/hat/hatopen/crash/toms/clap).
- Гитара/бас/скрипка: **tonejs-instruments (CC-BY)** — как сейчас; rr/vel эмулируются.
- Атрибуция: `public/samples/CREDITS.md`.

---

## ③ Mix / space (`buildEnsemble`)

- **Пер-голос панорама**: гитара — настоящий double-track (два пути с разным
  псевдо-rr/микро-задержкой, hard L/R ±0.7); бас — центр; кик/снейр — центр; хэты/томы —
  спред по стерео-полю; крэш — широкий; струнные — широкий разворот.
- **Общая reverb-шина**: один `Tone.Reverb` как aux, пер-голос send-уровни → глубина
  (барабаны почти сухие, струнные влажные, лид средне). Шина параллельна сухому сигналу.
- **Пер-голос EQ-carve**: HP на гитарах (освободить низ под бас), presence на снейре,
  лёгкий LP на дальних слоях. Цель — разделение, не «эффекты».
- Существующий master chain (subCut→masterFx→comp→limiter) без изменений.

Реализация: голоса получают не общий `bus`, а свой `Tone.Panner`→(dry + send)→bus.
Фабрики голосов принимают опц. `{ pan, reverbSend, eq }`.

---

## ② Performance pass (`src/audio/perform.ts`)

Чистая функция `perform(track, song, ctx) → events'`. Вызывается в `player.ts` и
`offline.ts` ТОЛЬКО при real; иначе события идут как есть. Детерминирована от `song.seed`
(свой PRNG-поток на роль), чтобы рендер и плеер совпадали.

- **Groove (тайминг)**: пер-жанровый шаблон (swing на слабых долях, лёгкий push на
  сильных, laid-back снейр) + пер-инструментальный микро-джиттер (барабаны ±5мс,
  лид ±15мс), запекается в `event.time`. Клампим у петли (не уходить < 0, держать seam).
- **Velocity-форма**: метрические акценты (сильная доля +), смягчение ghost-нот,
  внутри-фразовые крещендо (особ. заход в `drop`). Поверх существующего
  `arrange.sectionVelocity`.
- **Длина↔велосити**: громче = длиннее; legato-перекрытие для sustained-ролей
  (струнные/лид), короче/стаккато для ритм-гитары.
- **Per-loop вариация** — опционально (Phase 2.5). Round-robin уже убирает соседние
  повторы внутри прохода; межпроходную вариацию (разный джиттер на каждый цикл) добавим,
  если нужно. По умолчанию баним повтор-в-повтор через rr, а не через re-jitter.

Интеграция: `player.build()` и `offline.renderSong()` строят `events` из
`real ? perform(track, song) : track.notes`.

---

## Фазы (каждая — свой план реализации)

1. **Phase 1 — Sample engine**: модель данных, `makeRealDrumKit` v2 + `makeSampler` v2,
   докачать VCSL vel/rr, обновить `nightcorerun` маппинг. Verify: нет machine-gun на слух,
   .wav рендерится, тесты/сборка зелёные.
2. **Phase 2 — Mix/space**: пер-голос pan/reverb-send/EQ в `buildEnsemble`. Verify: стерео-ширина и глубина на слух, моно-совместимость.
3. **Phase 3 — Performance pass**: `perform.ts`, интеграция в player/offline. Verify:
   живой грув в прослушивании, MIDI/игровой экспорт БЕЗ изменений (snapshot core-тестов
   не меняется).
4. **Phase 2.5 (опц.)** — per-loop вариация.

## Риски / инварианты
- **Throw в trigger вешает offline-рендер** — все trigger-пути в try/catch (уже есть,
  держать для новых голосов).
- **Не трогать `src/core/**`** — perform/mix/engine только в `src/audio/**` + `public/`.
- **Семплерная нагрузка**: пул семплеров/плееров × голоса — следить за числом нод;
  диспозить аккуратно. Lazy-загрузка по жанру удерживает память.
- Питч-инструменты: настоящих vel-слоёв нет (источник CC ограничен) — честно эмулируем
  тембр фильтром/драйвом; не выдавать за мультисэмпл.
- Стерео: проверить mono-fold (сумма L/R не должна выедать центр/фазить).
