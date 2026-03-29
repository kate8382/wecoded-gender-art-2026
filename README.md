# WeCoded — Gender Equity (Frontend Art)

Participation: WeCoded 2026 challenge
--------------------------------------
This project is an entry for the [WeCoded 2026 Frontend Art challenge](https://dev.to/devteam/join-the-2026-wecoded-challenge-and-celebrate-underrepresented-voices-in-tech-through-writing--4828)

Project summary
---------------
A small, dependency-free frontend installation (HTML/CSS/JS) that visualizes gender equity through a musical scene. The central motif is a pair of scales: while the paid, public work of women and men is shown as equal, the piece represents the often invisible unpaid domestic labor that falls on women in parallel to paid work. Visual effects include pulsing gender symbols, subtle gradient dimming, scaling/zoom, falling items into scale pans, and a celebratory finale.

Vision
------
- The scales remain visually balanced to indicate formal equality.
- The additional unpaid workload is expressed by repeated falling items into the pans and a pulsing/darkening visual metaphor on the female side.
- The piece aims to show how continual unpaid labor and concurrent multitasking affect women's well-being.

Video presentation
------------------
<video src="video/presentation.mp4" controls width="720">
	Your browser does not support the video tag. Download the video: [video/presentation.mp4](video/presentation.mp4)
</video>

Technical overview
------------------
This project is organized into small, focused modules and plain CSS files so it can run without a build step.

Important files
- `index.html` — demo page that loads assets and `js/main.js` (module).
- `css/vars.css` — design tokens and breakpoint variables.
- `css/scales.css` — scene layout, SVG scales, pan positioning.
- `css/style.css` — global styles (start overlay, footer, page layout).
- `js/config.js` — drop sequence and icon list.
- `js/layout.js` — small layout utilities.
- `js/dropper.js` — `Dropper` class: handles dropping, landing, spiral motion, ghost items.
- `js/audioDirector.js` — scheduler that uses `audio.currentTime` for robust timing.
- `js/main.js` — `MainApp` orchestrates audio, start overlay, zoom and sequence scheduling.
- `js/confetti.js` — final confetti animation triggered by `dropper:celebrate`.

Public API (high level)
- `new Dropper(opts)` — creates a Dropper instance.
- `dropper.drop(src, opts)` — drop a single item (returns Promise).
- `dropper.runSequence(seq)` — run a sequence of drops (returns Promise).
- `dropper.reset()` — clear current scene and ghosts.
- `dropper.setBodyScale(scale)` — set page scale via CSS variable.
- `dropper.celebrate()` — trigger finale and confetti.

How to run locally
------------------
1. Open `index.html` in a modern browser (or use VS Code Live Server).
2. Browsers block autoplay of audio. For demo purposes you can:
   - Launch Chrome with `--autoplay-policy=no-user-gesture-required` on your demo machine, or
   - Rely on the start-overlay UX: the user clicks the start button to enable audio and begin the scene.

Design notes
------------
- Transform and scale are applied to a dedicated `.page__zoom` container to avoid layout and positioning conflicts with absolutely positioned children.
- Audio timing is handled by `AudioDirector` (simple scheduler), which keeps `Dropper` focused on visual behavior.

License & author
-----------------
This project is shared under the [MIT license](LICENSE). Author: [Ecaterina Sevciuc](https://github.com/kate8382/kate8382.git).


Заметки для статьи
--
- Проблема: конфликт фона при повторном запуске — `body` и `.start-overlay` оба задавали `background: var(--text-color)`, из‑за чего градиент у `.page.scene-active` скрывался.
	- Решение: фон документа сделан прозрачным по умолчанию; добавлен класс `body.zooming` для временного фонового режима; сцена вынесена в контейнер `.page__zoom`, а фон сцены управляется через CSS внутри этого контейнера. Это даёт предсказуемость и убирает пересекающиеся фоновые правила.

- Проблема: трансформы конфликтовали с абсолютно позиционированными детьми (из‑за масштабирования `body`).
	- Решение: добавлен отдельный трансформируемый контейнер `.page__zoom`. `Dropper.setBodyScale` теперь пишет только CSS‑переменную `--body-scale`, а визуальная трансформация применяется к `.page__zoom`.

- Проблема: синхронизация анимаций с аудио была ненадёжной.
	- Решение: введён `AudioDirector` — простой планировщик, который опирается на `audio.currentTime` и вызывает колбэки в запланированные моменты; также добавлен RAF‑режим для плавного/ступенчатого зума. Это сохраняет ответственность: `MainApp`/`AudioDirector` планируют, `Dropper` выполняет визуальные изменения.

- Проблема: дискретный зум казался «мягким» и запаздывал относительно музыки.
	- Решение: добавлен snap‑режим (ступенчатый зум) на RAF, а также параметры `frontloadFactor`, `leadSeconds` и `leadFirstSeconds` в `zoomTimeline`, чтобы ускорять начальную фазу и опережать шаги зума. Практическая настройка, добавленная 24.03.2026 в `js/config.js`:

	  - `frontloadFactor: 0.65` — усиливает прогресс в начале фазы (значения ~0.7 дают более быстрый старт).
	  - `leadSeconds: 0.08` — сколько секунд до начала фазы зума начинать прогрессировать (может быть 0 или отрицательным).
	  - `leadFirstSeconds: 0.35` — увеличенный lead для первого шага, чтобы первый зум ощущался более предвосхищающе.

	  Эти параметры помогли уменьшить ощущение запаздывания и сделали первые шаги зума более выразительными; их значения можно допиливать в `js/config.js` в зависимости от темпа трека.

- Проблема: падения элементов мешали сцене во время зума.
	- Решение: падения при планировании, которые попадают внутрь фазы зума, теперь пропускаются; последовательность `runSequence` откладывается до завершения зума, чтобы избежать визуального конфликта.

- Проблема: исчезновение/непоказ `THE END` при повторном прогоне и сложности с оверлеем.
	- Решение: унифицирована логика классов/стилей оверлея (`transparent`, `hidden`, `removed`, `final-visible`) — теперь показываем/скрываем `THE END` через классы и inline‑fallbacks только при необходимости.

- Проблема: отладочная информация мешала оценке времени событий.
	- Решение: временно добавлены логи (`console.log`) в `main.js`, `dropper.js`, `audioDirector.js` для трассировки; план — убрать/уменьшить их после стабилизации.

- Дата 24.03.2026 — итеративная отладка спирального падения и связанные трудности:
	- Трудности: попытки реализовать спираль через CSS/классы приводили к неверной трансформации (вращение спрайта), дублированию падений и преждевременному «финализированию» элемента (прыжок в панель). Также ряд промежуточных правок сломал структуру `dropper.js`, вызвав синтаксические ошибки.
	- Решение: заменили эксперимент с CSS‑спиралью на JS‑реализацию через `requestAnimationFrame` и полярную траекторию (r = a + b·θ). Чтобы убрать «прыжок», добавили огибающую функцию `envelope = sin(p*π)`, которая обнуляет смещение в начале и в конце анимации; уменьшили радиус/число витков (вдвое) для компактности; в `finalize()` отменяем RAF, чтобы остановить анимацию и избежать конфликтов с land/transition; удалили лишние `animationend/transitionend`‑хендлеры для спиралей и восстановили повреждённые вспомогательные методы (`_ensureGhost` и др.).
	- Влияние: спираль теперь рисуется JS-ом, ноутбук не поворачивается вокруг своей оси, дублирование падений предотвращено, и финализация проходит без визуальных «прыжков». Предлагается при необходимости вынести параметры `coils`, `startRadius`, `growth` в `drop()` опции для быстрого тюнинга.

*** End of preserved notes ***
