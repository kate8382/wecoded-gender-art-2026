/* Dropper — черновой OOP-класс для падения элементов в чаши весов.
   Подход: hybrid animation — JS вычисляет координаты целевой .pan-target,
   создаёт плавающий .falling-ghost, задаёт CSS-переменные для смещения
   и размера, добавляет класс .land для запуска перехода, затем по завершении
   создаёт окончательный элемент в .pan-target__items и удаляет ghost.

   Простая публичная API:
   - new Dropper(opts)
   - drop(assetSrc, options) -> Promise resolves когда элемент приземлён

   Пока черновик — позже добавим очередь, retry и семантику затемнения.
*/

(function () {
  class Dropper {
    constructor({ containerSelector = '.page', panSelector = '.pan-target' } = {}) {
      this.root = document.querySelector(containerSelector) || document.body;
      this.pans = Array.from(document.querySelectorAll(panSelector));
      this._ensureGhost();
    }

    // Метод, возвращающий список доступных иконок
    getIcons() {
      return [
        'img/laptop.svg',
        'img/house.svg',
        'img/baby-carriage.svg',
        'img/shopping-cart.svg',
        'img/cooking-pot.svg',
        'img/wash-machine.svg',
        'img/ironing-2.svg'
      ];
    }

    // Метод, возвращающий стандартную последовательность падений
    getDefaultSequence() {
      return [
        { src: 'img/laptop.svg', side: 'female', size: 84, darken: 0, delay: 400 },
        { src: 'img/laptop.svg', side: 'male', size: 84, darken: 0, delay: 600 },
        { src: 'img/house.svg', side: 'female', size: 36, darken: 1, delay: 700 },
        { src: 'img/baby-carriage.svg', side: 'female', size: 36, darken: 1, delay: 700 },
        { src: 'img/shopping-cart.svg', side: 'female', size: 36, darken: 1, delay: 700 },
        { src: 'img/cooking-pot.svg', side: 'female', size: 36, darken: 1, delay: 700 },
        { src: 'img/wash-machine.svg', side: 'female', size: 36, darken: 1, delay: 700 },
        { src: 'img/ironing-2.svg', side: 'female', size: 36, darken: 1, delay: 700 }
      ];
    }

    // Метод, создающий плавающий элемент для анимации падения
    _ensureGhost() {
      // keep a lightweight template ghost if needed; not used directly for concurrent drops
      if (!this.ghost) {
        this.ghost = document.createElement('img');
        this.ghost.className = 'falling-ghost';
        this.ghost.alt = '';
        this.ghost.setAttribute('aria-hidden', 'true');
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

      const itemW = 36; // ширина маленького изображения внутри чаши
      const gap = 6; // горизонтальный промежуток
      const rowSpacing = 22; // вертикальный шаг между рядами (увеличен чтобы не накладываться на ноутбук)
      const baseBottom = 12; // базовый отступ от нижней кромки чаши
      // вычислим, сколько колонок реально помещается в ширину контейнера
      const containerWidth = list.clientWidth || list.getBoundingClientRect().width || 180;
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
        const offsetX = (col - (cols - 1) / 2) * (itemW + gap);
        const bottom = baseBottom + rowIndex * rowSpacing;
        const li = items[i];
        li.style.position = 'absolute';
        li.style.left = `calc(50% + ${offsetX}px)`;
        li.style.transform = 'translateX(-50%)';
        li.style.bottom = `${bottom}px`;
      }
    }

    _updateLaptopScaleForPan(pan) {
      if (!pan) return;
      const mainImg = pan.querySelector('.pan-target__main img');
      if (!mainImg) return;
      const list = pan.querySelector('.pan-target__items');
      const count = list ? list.querySelectorAll('.pan-target__item').length : 0;
      const initial = 84;
      const min = 72;
      const maxCount = 6;
      const diff = initial - min;
      const perItem = diff / maxCount;
      const newWidth = Math.max(min, Math.round(initial - count * perItem));
      mainImg.style.width = newWidth + 'px';
      mainImg.style.zIndex = 200;
    }

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

          const ghostSize = size || Number(pan.dataset.size) || (isLaptop ? 84 : 36);
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

            const li = document.createElement('li');
            li.className = 'pan-target__item pan-target__item--landed';
            const img = document.createElement('img');
            img.src = assetSrc;
            img.alt = '';
            img.style.width = isLaptop ? '84px' : '36px';
            img.style.height = isLaptop ? 'auto' : '36px';
            img.style.position = 'relative';
            li.appendChild(img);
            li.style.zIndex = '100';

            if (isLaptop && main) {
              main.innerHTML = '';
              const mImg = document.createElement('img');
              mImg.src = assetSrc;
              mImg.alt = '';
              mImg.className = 'pan-target__main-img';
              mImg.style.width = '84px';
              mImg.style.transition = 'width 260ms ease';
              mImg.style.zIndex = 200;
              main.appendChild(mImg);
              pan.classList.add('has-main');
            } else if (list) {
              const idx = list.querySelectorAll('.pan-target__item').length;
              li.style.setProperty('--stack-index', String(idx));
              list.appendChild(li);
              try {
                // restore JS pyramid layout (горка) and then update laptop scale
                this._layoutPanItems(list);
                this._updateLaptopScaleForPan(pan);
              } catch (e) {
                // ignore
              }
            }

            ghost.classList.remove('land');
            ghost.remove();
            const result = { pan, li };
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
      const applyDarken = (delta) => {
        const page = document.querySelector('.page');
        if (!page || !delta) return;
        let current = 0;
        if (page.classList.contains('page--female-dark-1')) current = 1;
        if (page.classList.contains('page--female-dark-2')) current = 2;
        if (page.classList.contains('page--female-dark-3')) current = 3;
        const next = Math.min(3, current + delta);
        page.classList.remove('page--female-dark-1', 'page--female-dark-2', 'page--female-dark-3');
        if (next > 0) page.classList.add(`page--female-dark-${next}`);
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
  }

  window.Dropper = Dropper;
})();

/* NOTE: Иконки и стандартная последовательность падений предоставляются как методы на экземплярах Dropper
   Автоматический запуск стандартной последовательности при DOMContentLoaded, чтобы иконки падали без ручного вызова. */

document.addEventListener('DOMContentLoaded', () => {
  try {
    const d = new Dropper();
    const seq = d.getDefaultSequence();
    // run in background (no await) — errors are caught
    d.runSequence(seq).catch(err => console.warn('Dropper sequence error', err));
  } catch (err) {
    console.warn('Failed to auto-run Dropper sequence', err);
  }
});
