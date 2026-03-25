import { getRowCount, layoutPanItems, computeTargetPosition } from './layout.js';
import { icons, defaultSequence } from './config.js';

(function () {
  class Dropper {
    constructor(opts = {}) {
      const defaults = {
        containerSelector: '.page',
        panSelector: '.pan-target',
        // гибкие константы, используемые в нескольких местах
        itemW: 36,
        itemH: 36,
        gap: 4,
        rowSpacing: 22,
        baseBottom: 12,
        // laptop sizing
        laptopInitialWidth: 84,
        laptopMinWidth: 72,
        laptopMaxCount: 6,
        // визуальная настройка
        overlap: 2,
        // стандартная последовательность падений (может быть переопределена через opts)
        defaultSequence: defaultSequence,
        // автоматически запускать стандартную последовательность при создании (может контролироваться извне)
        autoRun: true
      };

      this.opts = Object.assign({}, defaults, opts);
      // Попытка прочитать переопределения из CSS-переменных (определены в :root)
      try {
        const css = getComputedStyle(document.documentElement);
        const readPx = (name) => {
          const v = css.getPropertyValue(name);
          if (!v) return undefined;
          const n = parseFloat(v.replace('px', '').trim());
          return Number.isFinite(n) ? n : undefined;
        };

        const cssOverrides = {
          itemW: readPx('--pan-item-w'),
          itemH: readPx('--pan-item-h'),
          gap: readPx('--pan-gap'),
          rowSpacing: readPx('--pan-row-spacing'),
          baseBottom: readPx('--pan-base-bottom'),
          overlap: readPx('--pan-overlap'),
          laptopInitialWidth: readPx('--laptop-initial-width'),
          laptopMinWidth: readPx('--laptop-min-width'),
          laptopMaxCount: readPx('--laptop-max-count')
        };

        Object.keys(cssOverrides).forEach(k => {
          if (typeof cssOverrides[k] !== 'undefined') this.opts[k] = cssOverrides[k];
        });
      } catch (e) {
        // игнорировать, если выполняется в среде без браузера
      }

      this.root = document.querySelector(this.opts.containerSelector) || document.body;
      this.pans = Array.from(document.querySelectorAll(this.opts.panSelector));
      // карта планировщика для внешне запланированных падений (id -> timeout)
      this._schedules = new Map();
      // разрешить временно приостанавливать падения, не связанные с ноутбуком (используется во время фокусированных тестов)
      this._suspended = false;
      this._ensureGhost();
    }

    // Метод, возвращающий список доступных иконок
    getIcons() {
      return (this.opts.icons || icons || []).slice();
    }

    // Метод, возвращающий стандартную последовательность падений (можно переопределить через opts)
    getDefaultSequence() {
      return (this.opts.defaultSequence || defaultSequence || []).slice();
    }

    // Вспомогательная функция: возвращает количество рядов для заданного числа элементов
    _getRowCount(total, containerWidth) {
      return getRowCount(total, containerWidth, this.opts);
    }

    // Метод, создающий плавающий элемент для анимации падения
    _ensureGhost() {
      // создать легковесный шаблонный элемент-призрак в DOM для предварительной загрузки/измерения
      // отметить его как шаблон и держать визуально скрытым/вне экрана.
      if (!this.ghost) {
        this.ghost = document.createElement('img');
        this.ghost.className = 'falling-ghost template';
        this.ghost.alt = '';
        this.ghost.setAttribute('aria-hidden', 'true');
        this.ghost.setAttribute('data-template', 'true');
        document.body.appendChild(this.ghost);
      }
    }
    // Метод, находящий pan-target по data-side (female/male) или возвращающий первый
    _findPan(side) {
      if (!side) return this.pans[0];
      return this.pans.find(p => p.dataset.side === side) || this.pans[0];
    }

    // Метод, преобразующий координаты целевой панели в координаты для fixed ghost
    _computeTargetPosition(pan, offsets = {}) {
      return computeTargetPosition(pan, offsets);
    }

    // Разметка (горка) для элементов внутри контейнера pan-target__items
    _layoutPanItems(list) {
      return layoutPanItems(list, this.opts);
    }

    // Специальная логика масштабирования для ноутбуков: уменьшать ширину основного изображения на левой панели (женской) по мере добавления элементов, чтобы создать иллюзию глубины и предотвратить слишком быстрое переполнение панели, в то время как правая панель (мужская) сохраняет постоянную ширину для более чистого вида
    _updateLaptopScaleForPan(pan) {
      if (!pan) return;
      const mainImg = pan.querySelector('.pan-target__main img');
      if (!mainImg) return;
      // только уменьшать ноутбук на левой панели (female). Правая панель остается с начальной шириной.
      const side = pan.dataset && pan.dataset.side;
      const initial = this.opts.laptopInitialWidth;
      if (side !== 'female') {
        mainImg.style.width = initial + 'px';
        return;
      }
      const list = pan.querySelector('.pan-target__items');
      const count = list ? list.querySelectorAll('.pan-target__item').length : 0;
      const min = this.opts.laptopMinWidth;
      const maxCount = this.opts.laptopMaxCount;
      const diff = initial - min;
      const perItem = diff / maxCount;
      const newWidth = Math.max(min, Math.round(initial - count * perItem));
      mainImg.style.width = newWidth + 'px';
    }

    // Убедиться, что контейнер .pan-target__items растет, чтобы вместить сложенные элементы
    _updatePanItemsContainerHeight(list, pan) {
      if (!list) return;
      const items = Array.from(list.querySelectorAll('.pan-target__item'));
      const total = items.length;
      if (!total) {
        list.style.height = '';
        list.style.top = '';
        list.style.bottom = '';
        return;
      }

      const rowSpacing = this.opts.rowSpacing;
      const baseBottom = this.opts.baseBottom;
      const itemH = this.opts.itemH;

      const containerWidth = list.clientWidth || list.getBoundingClientRect().width;
      const rows = this._getRowCount(total, containerWidth);

      // требуемая высота: смещение снизу верхнего ряда + высота элемента + небольшой отступ
      const required = baseBottom + (rows - 1) * rowSpacing + itemH + 6;

      // установить явную высоту для контейнера элементов и закрепить его внизу панели
      list.style.height = required + 'px';
      list.style.top = 'auto';
      list.style.bottom = baseBottom + 'px';
      // избежать изменения размера панели — позволить элементам выходить за пределы вверх при необходимости
      if (pan) {
        pan.style.minHeight = pan.style.minHeight || getComputedStyle(pan).minHeight;
      }
    }

    // Настроить вертикальное положение основного ноутбука, чтобы он визуально располагался на вершине стопки
    _adjustMainForPile(pan) {
      if (!pan) return;
      const list = pan.querySelector('.pan-target__items');
      const mainWrap = pan.querySelector('.pan-target__main');
      if (!list || !mainWrap) return;

      // убедиться, что обертка позиционирована (она уже должна быть по CSS)
      mainWrap.style.position = mainWrap.style.position;

      const items = Array.from(list.querySelectorAll('.pan-target__item'));
      const total = items.length;
      const baseBottom = this.opts.baseBottom;
      const rowSpacing = this.opts.rowSpacing;
      const itemH = this.opts.itemH;

      if (!total) {
        mainWrap.style.bottom = baseBottom + 'px';
        return;
      }

      // вычислить количество рядов, используя тот же алгоритм, что и в _layoutPanItems
      const containerWidth = list.clientWidth || list.getBoundingClientRect().width;
      const rows = this._getRowCount(total, containerWidth);

      const topRowBottom = baseBottom + (rows - 1) * rowSpacing;
      // позиционировать обертку так, чтобы основной элемент визуально располагался на стопке; небольшой отрицательный перекрытие для естественного вида
      const overlap = this.opts.overlap; // сколько пикселей main должен перекрывать верхний ряд для лучшего визуального эффекта
      const targetBottom = topRowBottom + itemH - overlap;
      mainWrap.style.bottom = Math.max(baseBottom, targetBottom) + 'px';
    }

    // Основной метод для анимации падения элемента в чашу; возвращает Promise, который резолвится после завершения анимации и добавления элемента в чашу
    drop(assetSrc, { side = 'female', size = null, offsetX = 0, offsetY = 0, fallStyle = null, spiralDuration = null } = {}) {
      return new Promise((resolve, reject) => {

        try {
          const pan = this._findPan(side);
          const target = this._computeTargetPosition(pan, { offsetX, offsetY });
          const main = pan.querySelector('.pan-target__main');
          const list = pan.querySelector('.pan-target__items');
          const isLaptop = typeof assetSrc === 'string' && assetSrc.toLowerCase().includes('laptop');
          const isSpiral = isLaptop || fallStyle === 'spiral';

          // Если падения приостановлены, пропустить не-спиральные/не-ноутбучные падения
          if (this._suspended && !(isLaptop && (fallStyle === 'spiral' || fallStyle === 'force'))) {
            resolve({ skipped: true });
            return;
          }

          // Создаём ghost для текущего падения
          const ghost = document.createElement('img');
          ghost.className = 'falling-ghost';
          ghost.alt = '';
          ghost.setAttribute('aria-hidden', 'true');
          document.body.appendChild(ghost);

          const ghostSize = size || Number(pan.dataset.size) || (isLaptop ? this.opts.laptopInitialWidth : this.opts.itemW);
          ghost.src = assetSrc;
          ghost.style.width = `${ghostSize}px`;
          ghost.style.height = `${ghostSize}px`;

          // стартовая позиция (над верхом окна)
          const startX = target.x;
          const startY = -Math.max(80, ghostSize + 20);
          const startLeft = startX - ghostSize / 2;
          const startTop = startY - ghostSize / 2;
          const targetLeft = target.x - ghostSize / 2;
          const targetTop = target.y - ghostSize / 2;
          const tx = Math.round(targetLeft - startLeft);
          const ty = Math.round(targetTop - startTop);

          ghost.style.left = startLeft + 'px';
          ghost.style.top = startTop + 'px';
          // initialize CSS vars
          ghost.style.setProperty('--tx', `0px`);
          ghost.style.setProperty('--ty', `0px`);
          void ghost.offsetWidth;

          let rafId = null;
          if (isSpiral) {
            // JS-driven спиральная анимация с использованием requestAnimationFrame
            let durationMs = 4000;
            if (typeof spiralDuration !== 'undefined' && spiralDuration !== null) {
              if (typeof spiralDuration === 'number') durationMs = Number(spiralDuration) || durationMs;
              else if (typeof spiralDuration === 'string') {
                const s = spiralDuration.trim();
                if (s.endsWith('ms')) durationMs = Number(s.replace('ms', '')) || durationMs;
                else if (s.endsWith('s')) durationMs = (Number(s.replace('s', '')) || 4) * 1000;
                else durationMs = Number(s) || durationMs;
              }
            }

            // убедимся, что ghost видим
            try { ghost.style.opacity = '1'; } catch (e) { }

            const startLeftPx = startLeft;
            const startTopPx = startTop;
            const targetLeftPx = targetLeft;
            const targetTopPx = targetTop;

            const coils = 4.0; // меньше витков — компактнее
            const thetaMax = Math.PI * 2 * coils; // макс. угол в радианах для заданного количества витков
            // уменьшенные радиусы/рост для более плотной спирали
            const startRadius = Math.max(4, Math.min(16, Math.round(ghostSize * 0.04)));
            const growth = Math.max(4, Math.round(ghostSize * 0.09));

            // анимация спирали с помощью requestAnimationFrame, которая обновляет позицию ghost на каждом кадре, комбинируя линейное движение к цели с круговым движением для создания спирального эффекта
            const t0 = performance.now();
            const step = (now) => {
              const elapsed = now - t0;
              const p = Math.min(1, elapsed / durationMs);
              const theta = p * thetaMax;
              const r = startRadius + growth * theta;
              // envelope: смещение стремится к 0 при p=0 и p=1 — предотвращает превышение цели и прыжки
              const envelope = Math.sin(p * Math.PI);
              const sx = envelope * r * Math.cos(theta);
              const sy = envelope * r * Math.sin(theta);
              const lx = (targetLeftPx - startLeftPx) * p;
              const ly = (targetTopPx - startTopPx) * p;
              const x = Math.round(lx + sx);
              const y = Math.round(ly + sy);
              ghost.style.transform = `translate(${x}px, ${y}px)`;
              if (p < 1) rafId = requestAnimationFrame(step);
              else finalize();
            };
            rafId = requestAnimationFrame(step);
          } else {
            requestAnimationFrame(() => {
              ghost.style.setProperty('--tx', `${tx}px`);
              ghost.style.setProperty('--ty', `${ty}px`);
              ghost.classList.add('land');
            });
          }

          // обработчик завершения анимации (или таймаут для надёжности), который создаёт финальный элемент в чаше и удаляет ghost
          let finished = false;
          let timeoutId = null;

          // finalize функция, которая выполняется при завершении анимации или по таймауту, чтобы гарантировать, что элемент будет добавлен в чашу даже если событие transitionend не сработает
          const finalize = (opts = {}) => {
            if (finished) return;
            finished = true;
            if (timeoutId) clearTimeout(timeoutId);
            // cancel any RAF-driven spiral
            try { if (typeof rafId !== 'undefined' && rafId) cancelAnimationFrame(rafId); } catch (e) { }
            ghost.removeEventListener('transitionend', onEnd);
            ghost.removeEventListener('animationend', onEnd);

            // создадим элемент <li> только для неосновных элементов (обрабатывается в ветке ниже)

            if (isLaptop && main) {
              // избежать создания дублирующего основного изображения, когда оно уже существует
              const existing = main.querySelector('img');
              if (existing && existing.src && existing.src.indexOf(assetSrc) !== -1) {
                console.debug('Dropper: main image already present for', pan && pan.dataset && pan.dataset.side);
              } else {
                console.debug('Dropper: creating main image for', pan && pan.dataset && pan.dataset.side);
                main.innerHTML = '';
                const mImg = document.createElement('img');
                mImg.src = assetSrc;
                mImg.alt = '';
                mImg.className = 'pan-target__main-img';
                // инициальная ширина берется из CSS-переменной; JS будет корректировать через _updateLaptopScaleForPan
                // сохранить переход/zIndex, но избежать дублирования размера здесь
                mImg.style.transition = 'width 0.3s ease-out';
                mImg.style.zIndex = 200;
                main.appendChild(mImg);
                // небольшая корректировка базовой линии для каждой стороны: левая (женская) немного ниже, чтобы лучше сидела на кривой SVG
                if (pan && pan.dataset && pan.dataset.side === 'female') {
                  main.style.bottom = '8px';
                } else {
                  main.style.bottom = '12px';
                }
                pan.classList.add('has-main');
                // удалить падающий ghost для ноутбучных падений, так как мы создали постоянное основное изображение
                requestAnimationFrame(() => {
                  try { ghost.classList.remove('land'); } catch (e) { }
                  requestAnimationFrame(() => { try { ghost.remove(); } catch (e) { } });
                });
              }
            } else if (list) {
              const li = document.createElement('li');
              li.className = 'pan-target__item pan-target__item--landed';
              const img = document.createElement('img');
              img.src = assetSrc;
              img.alt = '';
              img.width = this.opts.itemW;
              img.height = this.opts.itemH;
              li.appendChild(img);

              const idx = list.querySelectorAll('.pan-target__item').length;
              li.style.setProperty('--stack-index', String(idx));
              // случайная ротация задаётся до добавления, чтобы CSS мог её применить сразу
              const randomRotate = (Math.random() * 40 - 20); // -20..20deg
              li.style.setProperty('--item-rotation', `${randomRotate}deg`);
              list.appendChild(li);
              // триггер пульсации на левом акценте, когда элементы приземляются в левую чашу
              try {
                const side = pan && pan.dataset && pan.dataset.side;
                if (side === 'female') {
                  // сила увеличивается с индексом стека (больше элементов -> сильнее пульсация)
                  const max = Number(this.opts.laptopMaxCount) || 6;
                  const normalized = Math.min(1, (idx + 1) / Math.max(1, max)); // 0..1
                  // базовая + нормализованная шкала: обеспечивает, что первые элементы мягкие, а последующие сильнее
                  const strength = Math.min(1, 0.2 + normalized * 0.9);
                  // ритм пульсации: более высокий индекс -> более медленная, но более заметная пульсация
                  try {
                    const increment = (idx === 0) ? Math.max(0, strength * 0.6) : Math.max(0, strength * 0.15);
                    this.increaseAccentBy(increment);
                    // Если это одно из последних трёх падений (по отношению к max), небольшим шагом
                    // увеличим визуальный "буст" размера, чтобы быстрая пульсация выглядела менее дергающейся.
                    try {
                      const threshold = Math.max(0, max - 3);
                      if (idx >= threshold) {
                        const pos = idx - threshold; // 0..2
                        const add = 0.01 * (1 + pos); // 0.01, 0.02, 0.03
                        const css = getComputedStyle(document.documentElement);
                        const cur = parseFloat(css.getPropertyValue('--accent-boost')) || 0;
                        const next = Math.min(0.06, cur + add);
                        document.documentElement.style.setProperty('--accent-boost', String(next));
                      }
                    } catch (e) { }
                  } catch (e) { }
                }
              } catch (e) { }
              try {
                // восстановить JS-пирамидальную раскладку (горка), а затем обновить масштаб ноутбука
                this._layoutPanItems(list);
                this._updateLaptopScaleForPan(pan);
                // обеспечить рост контейнера элементов, чтобы сложенные элементы не выходили за пределы визуально
                this._updatePanItemsContainerHeight(list, pan);
                // скорректировать вертикальное положение основного ноутбука, чтобы он опирался на стопку
                this._adjustMainForPile(pan);
                // обновить только текущий пан после изменения раскладки
                try { this._updateLaptopScaleForPan(pan); } catch (e) { }
              } catch (e) {
                // ignore
              }
              // позволить браузеру отрисовать новую раскладку перед удалением ghost, чтобы избежать мерцания
              // сделать так, чтобы приземлившийся элемент плавно появлялся, затем удалить ghost на следующем кадре
              try { li.style.opacity = '0'; } catch (e) { }
              requestAnimationFrame(() => {
                try { li.style.transition = 'opacity 160ms ease'; li.style.opacity = '1'; } catch (e) { }
                ghost.classList.remove('land');
                requestAnimationFrame(() => { try { ghost.remove(); } catch (e) { } });
              });
            } else {
              // не должно происходить, но убедимся, что ghost удален
              try { ghost.classList.remove('land'); } catch (e) { }
              try { ghost.remove(); } catch (e) { }
            }

            // построить объект результата: li может быть неопределён для падений ноутбуков
            const result = { pan: pan };
            if (typeof li !== 'undefined') result.li = li;
            if (opts.fallback) result.fallback = true;
            resolve(result);
          };

          const onEnd = (e) => {
            // Срабатываем только для нашего ghost: это защищает от посторонних transitionend
            if (e && e.target !== ghost) return;
            // finalize будет защищён флагом finished, поэтому можно вызвать без проверки propertyName
            finalize({ fallback: false });
          };

          if (!isSpiral) {
            ghost.addEventListener('transitionend', onEnd);
            ghost.addEventListener('animationend', onEnd);
          }
          //  безопасный таймаут: разрешить полную продолжительность спирали (плюс небольшой буфер), когда используется анимация спирали
          // Timeout резервного значения по умолчанию (мс) — должно быть >= длительности CSS transition/animation, чтобы избежать преждевременного завершения
          const defaultFallback = 2200;
          let safeTimeout = defaultFallback;
          if (isSpiral) {
            // вычисляем значение ms из аргумента spiralDuration, если он присутствует, иначе используем значение по умолчанию 4000ms
            let ms = 4000;
            if (typeof spiralDuration !== 'undefined' && spiralDuration !== null) {
              if (typeof spiralDuration === 'number') ms = Number(spiralDuration) || ms;
              else if (typeof spiralDuration === 'string') {
                const s = spiralDuration.trim();
                if (s.endsWith('ms')) ms = Number(s.replace('ms', '')) || ms;
                else if (s.endsWith('s')) ms = (Number(s.replace('s', '')) || 4) * 1000;
                else ms = Number(s) || ms;
              }
            }
            safeTimeout = Math.max(defaultFallback, ms + 300);
          }
          timeoutId = setTimeout(() => finalize({ fallback: true }), safeTimeout);
        } catch (err) {
          reject(err);
        }
      });
    }

    // Планирование падения: delaySeconds (от текущего момента) и step-объект {src, side, size, offsetX, offsetY}
    scheduleDrop(delaySeconds, step = {}) {
      const id = Math.random().toString(36).slice(2, 9);
      const ms = Math.max(0, Math.round(Number(delaySeconds) * 1000));
      const to = setTimeout(() => {
        try {
          this.drop(step.src, { side: step.side, size: step.size, offsetX: step.offsetX, offsetY: step.offsetY }).catch(e => console.warn('scheduled drop failed', e));
        } catch (e) { console.warn('scheduled drop invocation failed', e); }
        this._schedules.delete(id);
      }, ms);
      this._schedules.set(id, to);
      return id;
    }

    cancelSchedule(id) {
      if (!this._schedules.has(id)) return false;
      try { clearTimeout(this._schedules.get(id)); } catch (e) { }
      this._schedules.delete(id);
      return true;
    }

    clearSchedules() {
      for (const [id, to] of this._schedules.entries()) {
        try { clearTimeout(to); } catch (e) { }
      }
      this._schedules.clear();
    }

    // событие по установке паузы падения элементов и таймированные падения с использованием экземпляра AudioDirector.
    // audioDirector должен реализовывать метод `.schedule(timeInSeconds, callback)`.
    scheduleLeftBowlSequence(audioDirector) {
      if (!audioDirector || typeof audioDirector.schedule !== 'function') {
        console.warn('Dropper.scheduleLeftBowlSequence requires an AudioDirector with schedule(t, fn)');
        return;
      }
      try {
        // пауза падений между 9s и 11s
        audioDirector.schedule(9, () => { try { this.suspendDrops(); } catch (e) { console.warn('suspendDrops failed', e); } });
        audioDirector.schedule(11, () => { try { this.resumeDrops(); } catch (e) { console.warn('resumeDrops failed', e); } });

        // левая чаша: элементы для падения в указанные моменты времени
        // предпочтительно использовать элементы из defaultSequence, чтобы избежать дублирования путей; в качестве резервного варианта использовать `icons`
        const seq = (this.opts.defaultSequence || defaultSequence || []);
        // собираем шаги с src + darken
        let scheduledSteps = seq
          .filter(s => s && s.side === 'female' && typeof s.src === 'string' && !s.src.toLowerCase().includes('laptop'))
          .map(s => ({ src: s.src, darken: Number(s.darken) || 0 }))
          .slice(0, 6);

        if (scheduledSteps.length < 6) {
          const more = (this.opts.icons || icons || []).filter(s => typeof s === 'string' && !s.toLowerCase().includes('laptop'));
          scheduledSteps = scheduledSteps.concat(more.map(src => ({ src, darken: 0 }))).slice(0, 6);
        }

        // запоминаем, какие источники мы запланировали, чтобы внешние вызовы могли избежать повторного планирования
        this._leftBowlSequenceItems = scheduledSteps.map(s => s.src);

        const times = [11, 16, 23, 25, 28, 30];
        const count = Math.min(times.length, scheduledSteps.length);
        for (let i = 0; i < count; i++) {
          const t = times[i];
          const step = scheduledSteps[i];
          audioDirector.schedule(t, () => {
            try {
              this.drop(step.src, { side: 'female' }).then(() => {
                try { if (step.darken) this.adjustDarken(step.darken); } catch (e) { }
              }).catch(e => console.warn('scheduled left-bowl drop failed', e));
            } catch (e) { console.warn('scheduled left-bowl drop failed', e); }
          });
        }
      } catch (e) { console.warn('scheduling left bowl drops failed', e); }
    }

    // Метод для запуска последовательности падений с поддержкой оптимизации соседних ноутбуков и затемнения
    async runSequence(steps = []) {
      // постепенное затемнение: отслеживаем дробный уровень затемнения от 0 до 1 и применяем easing
      if (typeof this.darkLevelFloat === 'undefined') this.darkLevelFloat = 0;
      const maxSteps = Number(this.opts.laptopMaxCount) || 6;

      // читаем базовый левый цвет из CSS-переменной `--left` и устанавливаем целевой акцент
      const css = getComputedStyle(document.documentElement);
      const baseLeft = this.parseColor(css.getPropertyValue('--left') || '#ffe6f3') || [255, 230, 243];
      const target = [255, 111, 168]; // accent pink

      const applyDarken = (delta) => {
        const step = Number(delta) || 0;
        this.darkLevelFloat = Math.min(1, Math.max(0, this.darkLevelFloat + step / maxSteps));
        const eased = this._ease(this.darkLevelFloat);
        // смешиваем baseLeft и target по фактору eased
        const mix = (a, b, t) => Math.round(a * (1 - t) + b * t);
        const r = mix(baseLeft[0], target[0], eased);
        const g = mix(baseLeft[1], target[1], eased);
        const b = mix(baseLeft[2], target[2], eased);
        document.documentElement.style.setProperty('--left-bg', `rgb(${r}, ${g}, ${b})`);
      };

      // определяем, является ли шаг падением ноутбука, для оптимизации соседних падений ноутбуков в разные чаши
      const isLaptopSrc = (s) => typeof s.src === 'string' && s.src.toLowerCase().includes('laptop');

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];

        // если текущий шаг — падение ноутбука, и следующий шаг тоже падает ноутбук в другую чашу, то запускаем оба падения параллельно и ждём их вместе, а затем применяем максимальную задержку из двух для паузы перед следующим шагом
        if (isLaptopSrc(step) && i + 1 < steps.length && isLaptopSrc(steps[i + 1]) && step.side !== steps[i + 1].side) {
          const nextStep = steps[i + 1];
          const pA = this.drop(step.src, { side: step.side, size: step.size, offsetX: step.offsetX, offsetY: step.offsetY });
          const pB = this.drop(nextStep.src, { side: nextStep.side, size: nextStep.size, offsetX: nextStep.offsetX, offsetY: nextStep.offsetY });
          await Promise.all([pA, pB]);
          const totalDark = (Number(step.darken) || 0) + (Number(nextStep.darken) || 0);
          if (totalDark) applyDarken(totalDark);
          const delay = Math.max(step.delay ?? 600, nextStep.delay ?? 600);
          await new Promise(r => setTimeout(r, delay));
          i++;
          continue;
        }

        await this.drop(step.src, {
          side: step.side,
          size: step.size,
          offsetX: step.offsetX,
          offsetY: step.offsetY,
        });

        // применяем затемнение после каждого падения, если указано, и ждём указанную задержку перед следующим шагом
        if (step.darken) applyDarken(Number(step.darken) || 1);
        await new Promise(r => setTimeout(r, step.delay ?? 600));
      }

    }
    // Приостановка/возобновление падений не-ноутбуков (полезно для сфокусированного тестирования)
    suspendDrops() { this._suspended = true; }
    resumeDrops() { this._suspended = false; }
    // public helper: парсинг цветовых строк (#rgb, #rrggbb, rgb(r,g,b))
    parseColor(str) {
      if (!str) return null;
      str = String(str).trim();
      if (str[0] === '#') {
        const hex = str.slice(1);
        if (hex.length === 3) {
          return [
            parseInt(hex[0] + hex[0], 16),
            parseInt(hex[1] + hex[1], 16),
            parseInt(hex[2] + hex[2], 16)
          ];
        }
        if (hex.length === 6) {
          return [
            parseInt(hex.slice(0, 2), 16),
            parseInt(hex.slice(2, 4), 16),
            parseInt(hex.slice(4, 6), 16)
          ];
        }
      }
      const m = str.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
      if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
      return null;
    }

    // easing: easeInOutCubic
    _ease(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    // Public: setDarkLevel(0..1) —  установить прогрессивное затемнение (обновляет --left-bg)
    setDarkLevel(value) {
      const maxSteps = Number(this.opts.laptopMaxCount) || 6;
      this.darkLevelFloat = Math.min(1, Math.max(0, Number(value) || 0));
      const eased = this._ease(this.darkLevelFloat);
      const css = getComputedStyle(document.documentElement);
      const baseLeft = this.parseColor(css.getPropertyValue('--left') || '#ffe6f3') || [255, 230, 243];
      const target = [255, 111, 168];
      const mix = (a, b, t) => Math.round(a * (1 - t) + b * t);
      const r = mix(baseLeft[0], target[0], eased);
      const g = mix(baseLeft[1], target[1], eased);
      const b = mix(baseLeft[2], target[2], eased);
      document.documentElement.style.setProperty('--left-bg', `rgb(${r}, ${g}, ${b})`);
    }

    // Public: adjustDarken(delta) — incrementally increase/decrease dark level like runSequence's applyDarken
    adjustDarken(delta = 1) {
      const step = Number(delta) || 0;
      if (typeof this.darkLevelFloat === 'undefined') this.darkLevelFloat = 0;
      const maxSteps = Number(this.opts.laptopMaxCount) || 6;
      this.darkLevelFloat = Math.min(1, Math.max(0, this.darkLevelFloat + step / maxSteps));
      const eased = this._ease(this.darkLevelFloat);
      const css = getComputedStyle(document.documentElement);
      const baseLeft = this.parseColor(css.getPropertyValue('--left') || '#ffe6f3') || [255, 230, 243];
      const target = [255, 111, 168];
      const mix = (a, b, t) => Math.round(a * (1 - t) + b * t);
      const r = mix(baseLeft[0], target[0], eased);
      const g = mix(baseLeft[1], target[1], eased);
      const b = mix(baseLeft[2], target[2], eased);
      document.documentElement.style.setProperty('--left-bg', `rgb(${r}, ${g}, ${b})`);
    }

    // Persistent cumulative accent: поддерживает уровень пульсации, который накапливается
    // и не сбрасывается полностью между падениями. Вызов `increaseAccentBy(delta)`
    // увеличивает уровень (0..1) и автоматически запускает RAF-цикл, который
    // записывает в CSS-переменную `--accent-pulse` непрерывную пульсацию.
    setAccentLevel(level = 0) {
      const l = Math.max(0, Math.min(1, Number(level) || 0));
      this._accentLevel = l;
      if (l > 0) {
        this._startAccentLoop();
      } else {
        this._stopAccentLoop();
      }
    }

    increaseAccentBy(delta = 0.1) {
      const d = Number(delta) || 0;
      if (typeof this._accentLevel === 'undefined') this._accentLevel = 0;
      this.setAccentLevel(Math.min(1, this._accentLevel + d));
    }

    _startAccentLoop() {
      try { if (this._accentLoopRaf) return; } catch (e) { }
      this._accentLoopStart = performance.now();
      const loop = (now) => {
        if (typeof this._accentLevel === 'undefined' || this._accentLevel <= 0) {
          this._stopAccentLoop();
          return;
        }
        const t = (now - this._accentLoopStart) / 1000; // секунды
        // Частота и амплитуда растут с уровнем акцента
        const freq = 0.4 + this._accentLevel * 2.0; // 0.4..2.4 Hz
        const amp = 0.08 + this._accentLevel * 0.9; // 0.08..0.98
        // синусоидальная пульсация от 0..amp, плюс небольшой базовый вклад от уровня
        const value = Math.max(0, Math.min(1, ((Math.sin(2 * Math.PI * freq * t) * 0.5 + 0.5) * amp) + (this._accentLevel * 0.04)));
        document.documentElement.style.setProperty('--accent-pulse', String(value));
        this._accentLoopRaf = requestAnimationFrame(loop);
      };
      this._accentLoopRaf = requestAnimationFrame(loop);
    }

    _stopAccentLoop() {
      try { if (this._accentLoopRaf) cancelAnimationFrame(this._accentLoopRaf); } catch (e) { }
      this._accentLoopRaf = null;
      try { document.documentElement.style.removeProperty('--accent-pulse'); } catch (e) { }
    }

    // Public: setBodyScale(scale) — набор CSS var для масштабирования тела (zoom/scale)
    setBodyScale(scale = 1) {
      const s = Math.max(0.5, Math.min(2, Number(scale) || 1));
      // Set CSS variable only; visual transform is applied to .page__scale in CSS.
      document.documentElement.style.setProperty('--body-scale', String(s));
    }

    // Public: celebrate() — просто простой триггер конфетти (будет реализован позже)
    celebrate() {
      //  Пока что отправляем пользовательское событие, чтобы другие модули (конфетти) могли его слушать
      const ev = new CustomEvent('dropper:celebrate', { detail: { time: Date.now() } });
      window.dispatchEvent(ev);
    }

    // Public: сбросить панели и внутреннее состояние, чтобы сцена могла воспроизводиться чисто
    reset() {
      // очистить запланированные падения, если они есть
      try { this.clearSchedules(); } catch (e) { }
      // удалить не-шаблонные призраки
      const ghosts = Array.from(document.querySelectorAll('.falling-ghost')).filter(g => !g.hasAttribute('data-template'));
      ghosts.forEach(g => { try { g.remove(); } catch (e) { } });

      //  очистить элементы и основные блоки из каждой панели
      this.pans.forEach(pan => {
        const list = pan.querySelector('.pan-target__items');
        const main = pan.querySelector('.pan-target__main');
        if (list) {
          list.innerHTML = '';
          list.style.height = '';
          list.style.top = '';
          list.style.bottom = '';
        }
        if (main) {
          main.innerHTML = '';
          pan.classList.remove('has-main');
        }
        //  сбросить любые встроенные стили bottom/width
        const mainImg = pan.querySelector('.pan-target__main img');
        if (mainImg) mainImg.style.width = this.opts.laptopInitialWidth + 'px';
        pan.style.minHeight = '';
      });

      //  сбросить уровень затемнения и CSS-переменную
      this.darkLevelFloat = 0;
      const css = getComputedStyle(document.documentElement);
      const baseLeft = this.parseColor(css.getPropertyValue('--left') || '#ffe6f3') || [255, 230, 243];
      document.documentElement.style.setProperty('--left-bg', `rgb(${baseLeft[0]}, ${baseLeft[1]}, ${baseLeft[2]})`);
      // сбросить накопленную пульсацию акцента
      try { this.setAccentLevel(0); } catch (e) { }
      try { document.documentElement.style.removeProperty('--accent-boost'); } catch (e) { }
    }
  }

  window.Dropper = Dropper;

})();

//  экспортируем класс и избегаем автоматического запуска; main.js должен создавать экземпляр и управлять воспроизведением
export default Dropper;



