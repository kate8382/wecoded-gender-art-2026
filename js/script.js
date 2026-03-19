(function () {
  class Dropper {
    constructor(opts = {}) {
      const defaults = {
        containerSelector: '.page',
        panSelector: '.pan-target',
        // layout constants (used in multiple places)
        itemW: 36,
        itemH: 36,
        gap: 4,
        rowSpacing: 22,
        baseBottom: 12,
        // laptop sizing
        laptopInitialWidth: 84,
        laptopMinWidth: 72,
        laptopMaxCount: 6,
        // visual tuning
        overlap: 2,
        // default falling sequence (can be overridden via opts)
        defaultSequence: [
          { src: 'img/laptop.svg', side: 'female', darken: 0, delay: 400 },
          { src: 'img/laptop.svg', side: 'male', darken: 0, delay: 600 },
          { src: 'img/house.svg', side: 'female', darken: 1, delay: 700 },
          { src: 'img/baby-carriage.svg', side: 'female', darken: 1, delay: 700 },
          { src: 'img/cooking-pot.svg', side: 'female', darken: 1, delay: 700 },
          { src: 'img/shopping-cart.svg', side: 'female', darken: 1, delay: 700 },
          { src: 'img/wash-machine.svg', side: 'female', darken: 1, delay: 700 },
          { src: 'img/ironing-2.svg', side: 'female', darken: 1, delay: 700 }
        ],
        // whether to auto-run default sequence when created (can be controlled externally)
        autoRun: true
      };

      this.opts = Object.assign({}, defaults, opts);
      // Try to read overrides from CSS custom properties (defined on :root)
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
        // ignore if running in non-browser env
      }
      this.root = document.querySelector(this.opts.containerSelector) || document.body;
      this.pans = Array.from(document.querySelectorAll(this.opts.panSelector));
      this._ensureGhost();
    }

    // Метод, возвращающий список доступных иконок
    getIcons() {
      return [
        'img/laptop.svg',
        'img/house.svg',
        'img/baby-carriage.svg',
        'img/cooking-pot.svg',
        'img/shopping-cart.svg',
        'img/wash-machine.svg',
        'img/ironing-2.svg'
      ];
    }

    // Метод, возвращающий стандартную последовательность падений (можно переопределить через opts)
    getDefaultSequence() {
      return (this.opts.defaultSequence || []).slice();
    }

    // Вспомогательная функция: возвращает количество рядов для заданного числа элементов
    _getRowCount(total, containerWidth) {
      const itemW = this.opts.itemW;
      const gap = this.opts.gap;
      const maxCols = Math.max(1, Math.floor(containerWidth / (itemW + gap)));
      let remaining = total;
      let maxCap = maxCols;
      let rows = 0;
      while (remaining > 0) {
        const rowCount = Math.min(maxCap, remaining);
        remaining -= rowCount;
        maxCap = Math.max(1, maxCap - 1);
        rows++;
      }
      return rows;
    }

    // Метод, создающий плавающий элемент для анимации падения
    _ensureGhost() {
      // keep a lightweight template ghost in the DOM for preloading/measurement
      // mark it as a template and keep it visually hidden/offscreen.
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
      const panRect = pan.getBoundingClientRect();
      // Центр панели как базовая точка
      const cx = panRect.left + panRect.width / 2;
      const cy = panRect.top + panRect.height / 2;
      const offX = Number(offsets.offsetX ?? pan.dataset.offsetX ?? 0);
      const offY = Number(offsets.offsetY ?? pan.dataset.offsetY ?? 0);
      return { x: Math.round(cx + offX), y: Math.round(cy + offY) };
    }

    // Разметка (горка) для элементов внутри контейнера pan-target__items
    _layoutPanItems(list) {
      if (!list) return;
      const items = Array.from(list.querySelectorAll('.pan-target__item'));
      const total = items.length;
      if (!total) return;

      const itemW = this.opts.itemW; // ширина маленького изображения внутри чаши
      const gap = this.opts.gap; // горизонтальный промежуток
      const rowSpacing = this.opts.rowSpacing; // вертикальный шаг между рядами
      const baseBottom = this.opts.baseBottom; // базовый отступ от нижней кромки чаши
      // вычислим, сколько колонок реально помещается в ширину контейнера
      const containerWidth = list.clientWidth || list.getBoundingClientRect().width;
      const maxBottomCapacity = Math.max(1, Math.floor(containerWidth / (itemW + gap)));

      // строим ряды снизу вверх: сначала самая широкая нижняя строка (maxBottomCapacity),
      // затем немного уже (на 1) и т.д.
      let remaining = total;
      let maxCap = maxBottomCapacity;
      const rows = [];
      while (remaining > 0) {
        const rowCount = Math.min(maxCap, remaining);
        rows.push(rowCount);
        remaining -= rowCount;
        maxCap = Math.max(1, maxCap - 1);
      }

      // позиционируем каждый элемент по индексу, вычисляя его ряд и колонку
      for (let i = 0; i < total; i++) {
        let rowIndex = 0;
        let cum = 0;
        for (let r = 0; r < rows.length; r++) {
          if (i < cum + rows[r]) {
            rowIndex = r;
            break;
          }
          cum += rows[r];
        }
        const col = i - cum;
        const cols = rows[rowIndex];
        // compute horizontal offset from center
        const offsetX = (col - (cols - 1) / 2) * (itemW + gap);
        // small row offset for the bottom row to imitate cup curvature (center items sit slightly lower)
        let rowOffset = 0;
        if (rowIndex === 0) {
          const isCenter = col > 0 && col < cols - 1;
          if (isCenter) rowOffset = -6; // push center items slightly lower
        }
        // random rotation to make items lie chaotically (-20..20deg)
        const angle = Math.round((Math.random() * 40) - 20);

        const li = items[i];
        // set explicit left/bottom so layout doesn't drift (avoid diagonal stacking)
        li.style.left = `calc(50% + ${offsetX}px)`;
        const bottom = baseBottom + rowIndex * rowSpacing + rowOffset;
        li.style.bottom = `${bottom}px`;
        // use CSS variables for rotation and keep stack-index for CSS rules if needed
        li.style.setProperty('--item-rotation', `${angle}deg`);
        li.style.setProperty('--stack-index', String(i - cum));
      }
    }

    _updateLaptopScaleForPan(pan) {
      if (!pan) return;
      const mainImg = pan.querySelector('.pan-target__main img');
      if (!mainImg) return;
      // Only shrink the laptop on the left pan (female). Right pan stays at initial width.
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

    // Ensure the .pan-target__items container grows to accommodate stacked items
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

      // required height: bottom offset of topmost row + item height + small padding
      const required = baseBottom + (rows - 1) * rowSpacing + itemH + 6;

      // set explicit height on the items container and anchor it to the bottom of pan
      list.style.height = required + 'px';
      list.style.top = 'auto';
      list.style.bottom = baseBottom + 'px';
      // avoid changing pan size — allow items to overflow upward if necessary
      if (pan) {
        pan.style.minHeight = pan.style.minHeight || getComputedStyle(pan).minHeight;
      }
    }

    // Adjust main laptop vertical position so it visually rests on top of the pile
    _adjustMainForPile(pan) {
      if (!pan) return;
      const list = pan.querySelector('.pan-target__items');
      const mainWrap = pan.querySelector('.pan-target__main');
      if (!list || !mainWrap) return;

      // ensure the wrapper is positioned (it should already be by CSS)
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

      // compute number of rows using the same algorithm as _layoutPanItems
      const containerWidth = list.clientWidth || list.getBoundingClientRect().width;
      const rows = this._getRowCount(total, containerWidth);

      const topRowBottom = baseBottom + (rows - 1) * rowSpacing;
      // position wrapper so the main image visually rests on the pile; small negative overlap to look natural
      const overlap = this.opts.overlap; // сколько пикселей main должен перекрывать верхний ряд для лучшего визуального эффекта
      const targetBottom = topRowBottom + itemH - overlap;
      mainWrap.style.bottom = Math.max(baseBottom, targetBottom) + 'px';
    }

    // Основной метод для анимации падения элемента в чашу; возвращает Promise, который резолвится после завершения анимации и добавления элемента в чашу
    drop(assetSrc, { side = 'female', size = null, offsetX = 0, offsetY = 0 } = {}) {
      return new Promise((resolve, reject) => {

        try {
          const pan = this._findPan(side);
          const target = this._computeTargetPosition(pan, { offsetX, offsetY });
          const main = pan.querySelector('.pan-target__main');
          const list = pan.querySelector('.pan-target__items');
          const isLaptop = typeof assetSrc === 'string' && assetSrc.toLowerCase().includes('laptop');

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
          ghost.style.setProperty('--tx', `0px`);
          ghost.style.setProperty('--ty', `0px`);
          void ghost.offsetWidth;

          requestAnimationFrame(() => {
            ghost.style.setProperty('--tx', `${tx}px`);
            ghost.style.setProperty('--ty', `${ty}px`);
            ghost.classList.add('land');
          });

          // обработчик завершения анимации (или таймаут для надёжности), который создаёт финальный элемент в чаше и удаляет ghost
          let finished = false;
          let timeoutId = null;

          // finalize функция, которая выполняется при завершении анимации или по таймауту, чтобы гарантировать, что элемент будет добавлен в чашу даже если событие transitionend не сработает
          const finalize = (opts = {}) => {
            if (finished) return;
            finished = true;
            if (timeoutId) clearTimeout(timeoutId);
            ghost.removeEventListener('transitionend', onEnd);

            // we'll create the landed <li> only for non-main items (handled in the branch below)

            if (isLaptop && main) {
              // avoid creating a duplicate main image when one already exists
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
                // initial width comes from CSS variable; JS will adjust via _updateLaptopScaleForPan
                // keep transition/zIndex but avoid duplicating size here
                mImg.style.transition = 'width 0.3s ease';
                mImg.style.zIndex = 200;
                main.appendChild(mImg);
                // small per-side baseline tweak: left (female) slightly lower so it sits better on SVG curve
                if (pan && pan.dataset && pan.dataset.side === 'female') {
                  main.style.bottom = '8px';
                } else {
                  main.style.bottom = '12px';
                }
                pan.classList.add('has-main');
                // remove the falling ghost for laptop drops as we created the persistent main image
                requestAnimationFrame(() => {
                  try { ghost.classList.remove('land'); } catch (e) { }
                  try { ghost.remove(); } catch (e) { }
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
              try {
                // restore JS pyramid layout (горка) and then update laptop scale
                this._layoutPanItems(list);
                this._updateLaptopScaleForPan(pan);
                // ensure the items container grows so stacked items don't overflow visually
                this._updatePanItemsContainerHeight(list, pan);
                // adjust main laptop vertical position to rest on the pile
                this._adjustMainForPile(pan);
                // update only current pan after layout change
                try { this._updateLaptopScaleForPan(pan); } catch (e) { }
              } catch (e) {
                // ignore
              }
              // allow browser to paint new layout before removing ghost to avoid flicker
              requestAnimationFrame(() => {
                ghost.classList.remove('land');
                try { ghost.remove(); } catch (e) { }
              });
            } else {
              // shouldn't happen, but ensure ghost removed
              try { ghost.classList.remove('land'); } catch (e) { }
              try { ghost.remove(); } catch (e) { }
            }

            // Build result object: li may be undefined for laptop drops
            const result = { pan: pan };
            if (typeof li !== 'undefined') result.li = li;
            if (opts.fallback) result.fallback = true;
            resolve(result);
          };

          const onEnd = (e) => {
            if (e.propertyName && e.propertyName.indexOf('transform') === -1) return;
            finalize({ fallback: false });
          };

          ghost.addEventListener('transitionend', onEnd);
          timeoutId = setTimeout(() => finalize({ fallback: true }), 1400);
        } catch (err) {
          reject(err);
        }
      });
    }

    // Метод для запуска последовательности падений с поддержкой оптимизации соседних ноутбуков и затемнения
    async runSequence(steps = []) {
      // Progressive darkening: track fractional darkLevel from 0..1 and apply easing
      if (typeof this.darkLevelFloat === 'undefined') this.darkLevelFloat = 0;
      const maxSteps = Number(this.opts.laptopMaxCount) || 6;

      // parse CSS color: supports #rgb, #rrggbb, rgb(r,g,b)
      const parseColor = (str) => {
        if (!str) return null;
        str = str.trim();
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
      };

      // easing function: easeInOutCubic
      const easeInOutCubic = (t) => {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      };

      // read base left color from CSS var `--left` and set target accent
      const css = getComputedStyle(document.documentElement);
      const baseLeft = parseColor(css.getPropertyValue('--left') || '#ffe6f3') || [255, 230, 243];
      const target = [255, 111, 168]; // accent pink

      const applyDarken = (delta) => {
        const step = Number(delta) || 0;
        this.darkLevelFloat = Math.min(1, Math.max(0, this.darkLevelFloat + step / maxSteps));
        const eased = easeInOutCubic(this.darkLevelFloat);
        // mix baseLeft and target by eased factor
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
      // remove the falling ghost for laptop drops as we created the persistent main image
      // ensure we let the browser paint the final state before removing
      requestAnimationFrame(() => {
        try {
          ghost.classList.remove('land');
        } catch (e) { }
        try { ghost.remove(); } catch (e) { }
      });
    }
  }

  window.Dropper = Dropper;
})();

/* NOTE: Иконки и стандартная последовательность падений предоставляются как методы на экземплярах Dropper
   Автоматический запуск стандартной последовательности при DOMContentLoaded, чтобы иконки падали без ручного вызова. */

document.addEventListener('DOMContentLoaded', () => {
  try {
    const d = new Dropper();
    // overlay is implemented via CSS on `.page::after`; no dynamic element needed
    if (d.opts && d.opts.autoRun) {
      const seq = d.getDefaultSequence();
      // run in background (no await) — errors are caught
      d.runSequence(seq).catch(err => console.warn('Dropper sequence error', err));
    }
  } catch (err) {
    console.warn('Failed to auto-run Dropper sequence', err);
  }
});
