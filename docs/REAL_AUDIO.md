# Real audio / live-performance layer

Полная запись того, что сделано в режиме **REAL** (реальные инструменты + «живое»
звучание), как и зачем. Для будущего себя.

## TL;DR — принцип

`REAL` — галочка справа от RADIO, **по умолчанию выключена** (дефолт
`opts.real ?? false` в player/offline/buildEnsemble; синтез — базовый режим).
Это **чисто аудио-слой**: применяется ТОЛЬКО при прослушивании и экспорте .wav/.mp3.
`Song` IR, `songToMidi`, экспорт в игру по API — **не трогаются никогда**.
Игра получает тот же грид-MIDI, что и раньше. «Живой звук» = только для ушей.

Правило: **никаких правок в `src/core/**`.** Весь real-код в `src/audio/**` + `public/samples/`.

Три подсистемы (downstream от IR):

```
Song IR (грид, без изменений)
   │ notes[]
   ▼  ── real only ──
② perform.ts        events → events'   (грув, динамика, длина — humanize)
   ▼
① sample engine     round-robin + velocity-слои + cab/палм-мьют/вибрато/детюн
   ▼
③ mix (buildEnsemble) пер-голос pan + reverb-send + кабинет/EQ
   ▼ master bus (как был) → out / Tone.Offline
```

Спека: `docs/superpowers/specs/2026-06-17-live-performance-layer-design.md`.

---

## Файлы: что и зачем

### `src/audio/samples.ts` — реестры сэмплов
- `SampleSetDef` — описание питч-инструмента: `urls` (нота→файл), `volumeDb`,
  `release`, `attack`, `distortion`, `monophonic`, `cab {hp,lp}`, `doubleTrack`,
  `palmMute`, `vibrato {rate,depth}`.
- `SAMPLE_SETS` — конкретные наборы (electricGuitar, electricBass, strings,
  violin, contrabass, cello, mutedTrumpet, vibraphone).
- `REAL_PROGRAM_MAP` — **GM program → набор**. Ключ глобальный по program-номеру
  (GM-семантика одинакова в жанрах): 30 гитара, 34 метал-бас, 48 струнные,
  40 скрипка, 32 контрабас, 42 виолончель, 59 муте-труба, 11 виброфон. Программы
  без записи → синт-fallback (поэтому default ON безопасен).
- `REAL_DRUM_KITS` — genre → kit. Kit = lanes, lane = velocity-слои (`vMax`),
  слой = round-robin файлы. Сейчас только `nightcorerun`.

### `src/audio/instruments.ts` — голоса
- **`makeSampler(def, out, exposeCutoff, stereo?)`** — питч-голос. Цепь:
  `Sampler → [Vibrato] → [Distortion 2x] → [cab HP] → bright LP → out`.
  - `bright` LP модулируется **по велосити** (мягко=тускло, сильно=ярко) — тембр,
    не только громкость. Если голос — цель filter-automation (`exposeCutoff`),
    LP отдаётся автоматизации, велосити-яркость выключается.
  - `palmMute`: LP считается по **длине ноты** (короткая=тёмный чаг, длинная=звон).
  - `doubleTrack` + `stereo`: ДВА семплера hard L/R, правый на +12мс (Haas) → ширина.
  - `cutoff` экспонируется для automation (кроме doubleTrack).
- **`makeRealDrumKit(out, def, {onKick, reverb, send})`** — индивидуальные
  `Tone.Player` на файл → пер-лейн `Panner` (DRUM_LANE_PAN, «оверхеды») →
  `kitGain` → out (+ reverb send). Триггер: велосити→слой (тембр) + гистерезис,
  round-robin (никогда не повторять предыдущий), ±0.5дБ и ±10 центов детюн на хит.
- **`voiceForTrack(track, bpm, out, real, autoTarget?, stereoCtx?)`** — в real
  сначала `REAL_PROGRAM_MAP`, иначе старый синт-switch.
- **`buildEnsemble(song, {real})`** — общий `Tone.Reverb` (send-шина, real only),
  `spatialOut(role)` строит пер-голос `Panner`+send. `VOICE_PAN`/`VOICE_SEND` по роли.

### `src/audio/perform.ts` — «живой исполнитель» (чистая функция)
`perform(track, song) → events'` в секундах. Детерминирована от `song.seed`
(свой поток на роль), поэтому offline-рендер == превью.
- **Тайминг**: пер-роль jitter + push (FEEL). Барабаны жёстко тугие
  (1.5мс) — иначе быстрые роллы разваливаются.
- **Velocity**: метрические акценты (сильная доля +), смягчение слабых, humanize.
- **Длина**: громче=длиннее; legato у sustained-ролей (струнные/лид).

### Прочее
- `player.ts` / `offline.ts` — в real строят события через `perform(...)`, иначе
  сырой грид. **Каждый `voice.trigger` обёрнут в try/catch** (см. грабли).
- `export.ts` / `index.ts` — прокидывают `real` в `renderToWav/Mp3`.
- `ui/main.ts` — `#real` (checked) + dispose-rebuild при переключении
  (граф фиксируется на build; play-кнопку надо re-enable перед `.click()`).
- `ui/embed.ts` — embed всегда `real:true`.

---

## Техники и ЗАЧЕМ

| Техника | Зачем (какой «фейк» убирает) |
|---|---|
| **Cab-симуляция** (HP+LP после дисторшна) | Сырой `Tone.Distortion` = жужжащий DI. Кабинет → миканый ампель. #1 фикс гитары/баса. |
| **Палм-мьют по длине ноты** | Метал-ритм = приглушённые чаги. Короткие ноты тёмные/тугие, длинные звенят. |
| **Double-tracking L/R + Haas 12мс** | Метал = две дорожки. Было моно по центру → тонко. |
| **Vibrato** на струнных | Главный признак «живого» струнного/соло. |
| **Плотная сэмпловка низов** | Широкий репитч низкой струны = резиновый/расстроенный звук (виолончель). |
| **Round-robin** (не повторять предыдущий) | Идентичный буфер каждый удар = «пулемёт». |
| **Velocity-слои** | Разный ТЕМБР на сила удара, не только громкость. |
| **Гистерезис слоёв** | Крещендо у порога флипало слои туда-сюда = «барабан сбивается». |
| **Velocity→яркость LP** | Динамика тембра у питч-инструментов (нет detune у Tone.Sampler). |
| **Стерео reverb-шина + пер-голос send** | Сухой моно-центр = плоский «демо». Глубина/клей. |
| **Грув/акценты/длина** (perform) | Грид-ровность = механика; человек дышит динамикой. |

---

## Грабли (выученные уроки — не наступать снова)

1. **Throw внутри Tone.Offline-колбэка ВЕШАЕТ весь рендер namertво** (не реджектит).
   → ВСЕ `voice.trigger` в player.ts/offline.ts/`makeRealDrumKit` обёрнуты в try/catch.
   Симптом был: экспорт .wav вечно «rendering…».
2. **`Tone.Player.start(t)` кидает "Start time must be strictly greater than
   previous start time"** при рестарте ≤ предыдущего старта. → монотонный guard
   per-file (±2мс) + try/catch.
3. **`Tone.Sampler` НЕ имеет `detune`** (есть только у `Tone.Player.playbackRate`).
   → у питча детюна нет; вариация через velocity→яркость + double-track. У барабанов
   детюн через `playbackRate`.
4. **disabled `<button>` игнорирует `.click()`** — toggle REAL во время игры не
   возобновлял. → re-enable play перед кликом.
5. **`Tone.loaded()` гейтит буферы для offline** — гнать только через
   `await ensemble.ready`, не через `sampler.loaded` boolean.
6. **Разреженная сэмпловка низа** (мажор-терции) → большой репитч → резиновый
   «расстроенный» бас. → плотная сэмпловка (≈целый тон) в низком регистре.
7. **Velocity-джиттер у порога слоёв** → флип тембра на крещендо. → гистерезис.
8. **Тайминг-джиттер на быстрых роллах** → ролл звучит криво. → барабаны держать тугими.
9. **Tone.Panner схлопывает стерео в моно** — нельзя гонять стерео-дорожку (драм-кит,
   double-track) через внешний моно-Panner. → они роутят стерео в `bus` сами.

---

## Tuning-ручки (где крутить)

- Гитара: `SAMPLE_SETS.electricGuitar` — `distortion`, `cab.lp` (фузз/тёмность),
  `doubleTrack` spread (в `voiceForTrack`, 0.75), Haas (в `makeSampler`, 0.012с),
  `palmMute` порог (в `brightHzFor`, 0.22с).
- Бас: `electricBass.cab`, `distortion`.
- Струнные/скрипка/виолончель: `vibrato {rate,depth}`, `attack`, плотность `urls`.
- Барабаны: `DRUM_LANE_PAN` (ширина), velocity-слои/`vMax` в `REAL_DRUM_KITS`,
  гистерезис-запас (0.06), детюн (0.012).
- Микс: `VOICE_PAN`/`VOICE_SEND`, `reverb` decay (1.8с).
- Грув/динамика: `FEEL` в perform.ts (jitterMs/pushMs/velSpread/legato по ролям).

---

## Статус по жанрам

| Жанр | Real-инструменты |
|---|---|
| **nightcorerun** | гитара(30) cab+double+палм-мьют, метал-бас(34) cab, струнные(48), скрипка-лид(40); барабаны metal-кит RR+vel-слои. lead 49/1 → синт. |
| **noir** | контрабас(32), виброфон(11), муте-труба(59 — trumpet+mute-фильтр); барабаны-щётки синт. |
| **darkacademia** | виолончель(42, плотный низ), скрипка(40); клавесин(6) синт — нет CC-сэмплов. |
| остальные | синт-fallback (сэмплов нет). |

См. `docs/STYLES.md`.

---

## Источники сэмплов + как добавить

- **tonejs-instruments** (CC-BY 3.0): guitar-electric, bass-electric, violin,
  contrabass, cello, trumpet. https://github.com/nbrosowsky/tonejs-instruments
- **VCSL** (CC0): барабаны metal-кит, vibraphone. https://github.com/sgossner/VCSL
- Атрибуция: `public/samples/CREDITS.md`. Всё перекодировано в **mono 128k mp3**.

Рецепт добавления инструмента:
```bash
# скачать ноты с raw.githubusercontent + конверт
curl -s -o /tmp/s.mp3 "<raw-url>/<Note>.mp3"
ffmpeg -y -i /tmp/s.mp3 -ac 1 -ar 44100 -b:a 128k public/samples/<inst>/<Note>.mp3
```
Затем: добавить набор в `SAMPLE_SETS`, запись в `REAL_PROGRAM_MAP` (по GM program),
панораму/send при необходимости. Lazy-загрузка бесплатна — грузится только
текущий жанр. Файлы лежат в `public/` (root-absolute `/samples/...`, работает и в embed).

Барабан-кит: файлы `lane_l{слой}_r{rr}.mp3`, описать в `REAL_DRUM_KITS`.
