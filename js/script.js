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
      this.ghost = null;
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
        { src: 'img/laptop.svg', side: 'female', size: 40, darken: 0, delay: 400 },
        { src: 'img/laptop.svg', side: 'male', size: 40, darken: 0, delay: 600 },
        { src: 'img/house.svg', side: 'female', size: 40, darken: 1, delay: 700 },
        { src: 'img/baby-carriage.svg', side: 'female', size: 40, darken: 1, delay: 700 },
        { src: 'img/shopping-cart.svg', side: 'female', size: 40, darken: 1, delay: 700 },
        { src: 'img/cooking-pot.svg', side: 'female', size: 40, darken: 1, delay: 700 },
        { src: 'img/wash-machine.svg', side: 'female', size: 40, darken: 1, delay: 700 },
        { src: 'img/ironing-2.svg', side: 'female', size: 40, darken: 1, delay: 700 }
      ];
    }

    // Метод, создающий плавающий элемент для анимации падения
    _ensureGhost() {
      if (this.ghost) return;
      this.ghost = document.createElement('img');
      this.ghost.className = 'falling-ghost';
      this.ghost.alt = '';
      this.ghost.setAttribute('aria-hidden', 'true');
      document.body.appendChild(this.ghost);
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

    // Выполнить одно падение: assetSrc = путь к svg/png, options: { side, size }
    drop(assetSrc, { side = 'female', size = null, offsetX = 0, offsetY = 0 } = {}) {
      return new Promise((resolve, reject) => {
        try {
          const pan = this._findPan(side);
          const target = this._computeTargetPosition(pan, { offsetX, offsetY });

          // Установим ghost
          this.ghost.src = assetSrc;
          const ghostSize = size || Number(pan.dataset.size) || 40;
          this.ghost.style.width = `${ghostSize}px`;
          this.ghost.style.height = `${ghostSize}px`;
          // make sure ghost is visible and reset any previous hiding
          this.ghost.style.display = '';

          // Начальная позиция: прямо над целевой панелью (чтобы падение было вертикальным)
          const startX = target.x; // центр по горизонтали
          const startY = -Math.max(80, ghostSize + 20); // над верхом окна

          // Вычисляем смещение в пикселях для translate относительно left/top
          const startLeft = startX - ghostSize / 2;
          const startTop = startY - ghostSize / 2;
          const targetLeft = target.x - ghostSize / 2;
          const targetTop = target.y - ghostSize / 2;
          const tx = Math.round(targetLeft - startLeft);
          const ty = Math.round(targetTop - startTop);

          // Размещаем ghost в стартовой позиции (left/top) и устанавливаем нулевые переменные
          this.ghost.style.left = startLeft + 'px';
          this.ghost.style.top = startTop + 'px';
          this.ghost.style.setProperty('--tx', `0px`);
          this.ghost.style.setProperty('--ty', `0px`);
          // Force reflow
          void this.ghost.offsetWidth;

          // Затем задаём целевой сдвиг — CSS transition выполнит анимацию
          requestAnimationFrame(() => {
            this.ghost.style.setProperty('--tx', `${tx}px`);
            this.ghost.style.setProperty('--ty', `${ty}px`);
            this.ghost.classList.add('land');
          });

          // По окончании transition — создаём финальный элемент в пане
          let finished = false;
          const onEnd = (e) => {
            // guard: только на transform окончания
            if (e.propertyName && e.propertyName.indexOf('transform') === -1) return;
            if (finished) return;
            finished = true;
            clearTimeout(timeoutId);
            this.ghost.removeEventListener('transitionend', onEnd);

            // Создать li и вставить в пан-target__items
            const li = document.createElement('li');
            li.className = 'pan-target__item pan-target__item--landed';
            const img = document.createElement('img');
            img.src = assetSrc;
            img.alt = '';
            li.appendChild(img);
            const list = pan.querySelector('.pan-target__items');
            if (list) list.appendChild(li);

            // Очистка ghost — скрываем сразу, чтобы не проиграть обратную анимацию
            this.ghost.classList.remove('land');
            this.ghost.style.setProperty('--tx', `0px`);
            this.ghost.style.setProperty('--ty', `0px`);
            this.ghost.style.display = 'none';
            resolve({ pan, li });
          };

          // Наложим слушатель с таймаутом резервным
          this.ghost.addEventListener('transitionend', onEnd);
          const timeoutId = setTimeout(() => {
            if (finished) return;
            finished = true;
            this.ghost.removeEventListener('transitionend', onEnd);
            const li = document.createElement('li');
            li.className = 'pan-target__item pan-target__item--landed';
            const img = document.createElement('img');
            img.src = assetSrc;
            img.alt = '';
            li.appendChild(img);
            const list = pan.querySelector('.pan-target__items');
            if (list) list.appendChild(li);
            this.ghost.classList.remove('land');
            // сброс переменных и скрыть ghost
            this.ghost.style.setProperty('--tx', `0px`);
            this.ghost.style.setProperty('--ty', `0px`);
            this.ghost.style.display = 'none';
            resolve({ pan, li, fallback: true });
          }, 1200);
        } catch (err) {
          reject(err);
        }
      });
    }

    // Простейшая последовательность: принимает массив шагов и выполняет по очереди
    // step: { src, side, delay = 600, size = 40, offsetX, offsetY, darken = 0 }
    async runSequence(steps = []) {
      for (const step of steps) {
        await this.drop(step.src, {
          side: step.side,
          size: step.size,
          offsetX: step.offsetX,
          offsetY: step.offsetY,
        });
        // применим затемнение при необходимости — надёжно определяем текущий уровень через classList
        if (step.darken) {
          const page = document.querySelector('.page');
          if (page) {
            let current = 0;
            if (page.classList.contains('page--female-dark-1')) current = 1;
            if (page.classList.contains('page--female-dark-2')) current = 2;
            if (page.classList.contains('page--female-dark-3')) current = 3;
            const delta = typeof step.darken === 'number' ? step.darken : 1;
            const next = Math.min(3, current + delta);
            page.classList.remove('page--female-dark-1', 'page--female-dark-2', 'page--female-dark-3');
            if (next > 0) page.classList.add(`page--female-dark-${next}`);
          }
        }
        await new Promise(r => setTimeout(r, step.delay ?? 600));
      }
    }
  }

  // Экспорт в глобальную область для упрощённого доступа
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
