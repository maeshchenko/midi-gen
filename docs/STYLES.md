# Описание стилей

Свод музыкальных стилей всех жанров генератора. Источник истины — doc-комменты в
шапках `src/core/genres/<id>.ts`. Документ нужен в т.ч. для маппинга **real**-режима
(реальные сэмплы инструментов): колонка «Real» показывает, что заменяется на сэмплы.

Real-режим (галочка `REAL`, по умолчанию выкл.) подменяет синт-голоса реальными
мультисэмплами (`Tone.Sampler`) и one-shot барабанами (`Tone.Players`). Программы без
сэмпла падают на синтез — поэтому режим безопасно держать включённым. Карта:
`src/audio/samples.ts` (`REAL_PROGRAM_MAP`, `REAL_DRUM_KITS`).

| Жанр | Стиль | Инструментовка | Real |
|------|-------|----------------|------|
| **Classic Keygen** | Чиптюн крэктро (Razor 1911), быстрый | square-lead, 32nd трекер-арп, синт-бас, 4-on-floor | — (электроника) |
| **Grime** | Memphis phonk / grime, half-time, 130–145 BPM | глайд-808, cowbell-лид, тёмные 1–2 аккорда | — |
| **Drift Phonk** | Drift phonk, half-time Memphis, 120–135 BPM | стаккато-cowbell, 808 в замке с кик, sidechain, bitcrush | — |
| **Noir (Dark Jazz)** | Кинематографичный нуар/дарк-джаз, 60–80 BPM, свинг | блюз-солист, drop-2 джаз-аккорды, щётки+райд, контрабас | **✅** (контрабас, виброфон, муте-труба; барабаны-щётки синт) |
| **Anime Opening** | J-pop опенинг, мажор, royal-road, 128–160 BPM | прыгучее пиано, струнные пэды, pop-rock барабаны | планируется |
| **Blues** | 12-bar блюз, шаффл | гармоника-лид, boogie-бас, dom7 | планируется |
| **Military Parade** | Военный марш 2/4 ~120 | малый-остинато, туба oom-pah, брасс-стэбы, труба | планируется |
| **Dark Academia** | Камерная музыка, 72–96 BPM, без барабанов | клавесин (Alberti), смычковая виолончель, скрипка | **✅** (виолончель, скрипка; клавесин синт — нет CC-сэмплов) |
| **Nightcore** | Power / melodic metal (по автору), 160–180 BPM¹ | лид высоко, гитарная энергия, драйв-барабаны | планируется |
| **Tune** | Наивный Y2K-чиптюн луп (в духе mizhgan.com) | один арп-мотив, sustained-бас, offbeat-хэт | — |
| **Music Box** | Музыкальная шкатулка, 3/4, высокий регистр | стальная гребёнка (GM 10), без демпфера | — (синт-FM ок) |
| **Eurobeat** | Initial D / аркадный евробит, 150–162 BPM | октавный бас, синт-брасс стэбы, sawtooth-рифф | — |
| **Outrun** | Spacesynth/outrun, 118–132 BPM, beatmap-арка | 16th-бас, glassy-арпы, gated-snare | — |
| **Grime Run** | Grime для ритм-игры, beatmap-арка | глайд-808, cowbell-остинато, half-time кит | — |
| **Doomerwave** | Русский дарквейв/пост-панк («ВАЗ ночью») | галоп-бас, chorused чистая гитара, холодные пэды | планируется |
| **Doomer Run** | Doomerwave для ритм-игры, beatmap-арка | пикованный бас, chorused-арпы, gated-snare драм-машина | планируется |
| **Nightcore Run** | **Symphonic Rock / Power-Metal** (Nightwish, action-anime опенинги), 165–190 BPM | стена дисторшн-гитар (power chords), double-kick бласты, оркестровые струнные, symphonic/shred-лид | **✅ реализовано** |
| **Medieval** | Спокойный эмбиент-underscore для Tower Defence (Kingdom Rush), ~2–2.5 мин, 88–104 BPM, 4/4, dorian/mixolydian/minor. Сквозная форма intro/A/B/C/bridge/outro (distinctProgressions — у каждой секции своя тема+гармония) | флейта-вистл лид, тёплый струнный пэд, дрон-виолончель; перкуссия **только мембрана** — табор+рамочный барабан+бубен (`hooks.drums`, без краша/снейра/хэта; intro/outro без барабанов) | **✅ частично** (струнный пэд 48, виолончель 42 — сэмплы; флейта/перкуссия синт) |

¹ Doc-коммент в `nightcore.ts` исторически описывает eurodance-найткор (supersaw/trance-arp,
GM 90/81/38). Автор уточнил, что семейство ближе к power/melodic metal — конфиг ещё электронный,
требует сверки (см. ниже).

## Real-режим: что уже есть

**Nightcore Run** (`nightcorerun`) — первый жанр с реальными инструментами:

| Роль | GM program | Real-сэмпл | Источник |
|------|-----------|------------|----------|
| arp (rhythm) | 30 Power Guitar | electric guitar + `Tone.Distortion` | tonejs-instruments (CC-BY) |
| bass | 34 Metal Bass | electric bass + лёгкий overdrive | tonejs-instruments (CC-BY) |
| chords | 48 Strings | струнная секция (скрипка, медленная атака) | tonejs-instruments (CC-BY) |
| lead | 48/40 (per-seed) | струнные / соло-скрипка; **49 symphonic и 1 piano остаются синтом** | tonejs-instruments (CC-BY) |
| drums | 0 Metal Kit | живой акустический кит (кик/снейр/хэт/крэш/томы/клэп) | VCSL (CC0) |

Атрибуция сэмплов: `public/samples/CREDITS.md`.

## TODO
- Сверить намерение по `nightcore` (eurodance в коде vs power-metal по автору).
- Раскатать real-маппинг на «планируется»-жанры (acoustic-heavy: blues, anime, dark academia, doomerwave).
