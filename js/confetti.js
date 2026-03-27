// DOM-based confetti using inline SVG gender signs
(function () {
  const DEFAULT_DURATION = 5000; // ms
  const DEFAULT_TOTAL = 200; // количество частиц (по половине для каждой стороны)
  const GRAVITY = 1200; // px/s^2
  const BURST_TIME = 900; // ms — время спауна/выстрела
  const containerId = 'confettiContainer';

  // вставляем inline SVG templates (используем currentColor для stroke, чтобы можно было окрашивать через CSS)
  const venusSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="confetti-svg"><path d="M12 15v7"/><path d="M9 19h6"/><circle cx="12" cy="9" r="6"/></svg>`;
  const marsSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="confetti-svg"><path d="M16 3h5v5"/><path d="m21 3-6.75 6.75"/><circle cx="10" cy="14" r="6"/></svg>`;

  const femaleColors = ['#ff6f9e', '#ff9ac9', '#ffb3d9', '#ff7fbf', '#ffd7ec'];
  const maleColors = ['#2b7cff', '#4da3ff', '#6fc1ff', '#1fa3ff', '#9fdcff'];

  // простая функция для генерации случайного числа в диапазоне (используется для вариации частиц)
  function rand(min, max) { return Math.random() * (max - min) + min; }

  // создаёт контейнер для конфетти, если его нет в DOM, и возвращает его
  function createContainer() {
    const existing = document.getElementById(containerId);
    if (existing) return existing;
    // если контейнера нет в DOM — создаём, но логируем это (обычно в index.html он уже есть)
    console.warn('Confetti: placeholder #' + containerId + ' not found — creating fallback container');
    const c = document.createElement('div');
    c.id = containerId;
    c.className = 'confetti-container';
    c.setAttribute('aria-hidden', 'true');
    document.body.appendChild(c);
    return c;
  }

  // класс для представления одной частицы конфетти
  class Particle {
    constructor(side, svgHTML) {
      this.el = document.createElement('span');
      this.el.className = `confetti-item confetti--${side}`;
      this.el.innerHTML = svgHTML;
      // начальная позиция будет установлена вызывающим кодом
      this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; this.rot = rand(-180, 180); this.vr = rand(-360, 360);
      this.scale = rand(0.6, 1.4); // начальный масштаб, может быть увеличен в первые моменты полёта
      this.life = 0; // время жизни в секундах
      this.ttl = rand(3.6, 5.0); // время жизни до полного исчезновения (в секундах), может быть увеличено для медленного падения
      this.side = side; // для возможной дополнительной логики или стилей в зависимости от стороны
    }

    // методы для управления частицей
    attach(parent) { parent.appendChild(this.el); }
    remove() { try { this.el.remove(); } catch (e) { } }
    update(dt) {
      this.vy += GRAVITY * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.rot += this.vr * dt;
      this.life += dt;
      const op = Math.max(0, 1 - (this.life / this.ttl));
      this.el.style.opacity = String(op);
      this.el.style.transform = `translate(${Math.round(this.x)}px, ${Math.round(this.y)}px) rotate(${this.rot}deg) scale(${this.scale})`;
    }
  }

  // класс для управления всей анимацией конфетти
  class Confetti {
    constructor() {
      this.container = createContainer();
      this.raf = null;
      this.particles = [];
      this.running = false;
      this._emitterInterval = null; // для управления спаунингом частиц
      this._safetyTimeout = null;
      // слушаем событие celebrate от dropper — сохраняем ссылку на обработчик, чтобы можно было его убрать при необходимости
      this._onCelebrate = (e) => this.start();
      window.addEventListener('dropper:celebrate', this._onCelebrate);
      console.debug('Confetti: initialized, container=', this.container ? '#' + this.container.id : 'none');
    }

    // start(options) — options: { duration(ms), total, slow }
    start(opts = {}) {
      if (this.running) return;
      const duration = Number(opts.duration) || DEFAULT_DURATION; // общее время от начала до конца анимации (включая падение), используем для планирования спауна и общей продолжительности
      const total = Number(opts.total) || DEFAULT_TOTAL; /// общее количество частиц для спауна (по половине для каждой стороны), используем для планирования спауна
      const slow = !!opts.slow;
      console.debug('Confetti: start()', { duration, total, slow });
      this.running = true;
      const btn = document.getElementById('startButton');
      if (btn) { try { btn.disabled = true; } catch (e) { } }

      const vw = Math.max(320, window.innerWidth || 1024);
      const vh = Math.max(200, window.innerHeight || 600);

      const half = Math.floor(total / 2);
      const burstTime = Math.max(200, Math.min(BURST_TIME, duration * 0.5));
      let emittedLeft = 0, emittedRight = 0;

      // функции для спауна частиц с левой и правой стороны, с вариациями скорости, угла и цвета для естественного вида
      const emitLeft = () => {
        if (emittedLeft >= half) return;
        const peak = vh * 0.9;
        const baseVy = -Math.sqrt(2 * GRAVITY * peak) * rand(0.85, 1.05);
        const angleJitter = (Math.PI / 180) * rand(-18, 18);
        const vx = Math.abs(baseVy) * Math.cos(Math.PI / 4 + angleJitter) * rand(0.9, 1.25);
        const vy = baseVy * rand(0.85, 1.05);
        const p = new Particle('female', venusSVG);
        const startLeft = rand(0.5, 6) / 100 * vw; // стартовая позиция с небольшой вариацией от левого края
        p.x = startLeft;
        p.y = vh - rand(6, 28);
        p.vx = vx * (slow ? 0.5 : 1);
        p.vy = vy * (slow ? 0.5 : 1);
        p._expand = 0.002 + rand(0, 0.003);
        p.scale = rand(0.7, 1.6);
        p.ttl = rand(4.4, 6.2) * (slow ? 1.4 : 1);
        const c = femaleColors[Math.floor(rand(0, femaleColors.length))];
        p.el.style.color = c;
        p.attach(this.container);
        this.particles.push(p);
        emittedLeft++;
      };

      const emitRight = () => {
        if (emittedRight >= half) return;
        const peak = vh * 0.9;
        const baseVy = -Math.sqrt(2 * GRAVITY * peak) * rand(0.85, 1.05);
        const angleJitter = (Math.PI / 180) * rand(-18, 18);
        const vx = -Math.abs(baseVy) * Math.cos(Math.PI / 4 + angleJitter) * rand(0.9, 1.25);
        const vy = baseVy * rand(0.85, 1.05);
        const p = new Particle('male', marsSVG);
        const startRight = rand(94, 99.2) / 100 * vw;
        p.x = startRight;
        p.y = vh - rand(6, 28);
        p.vx = vx * (slow ? 0.5 : 1);
        p.vy = vy * (slow ? 0.5 : 1);
        p._expand = 0.002 + rand(0, 0.003);
        p.scale = rand(0.7, 1.6);
        p.ttl = rand(4.4, 6.2) * (slow ? 1.4 : 1);
        const c = maleColors[Math.floor(rand(0, maleColors.length))];
        p.el.style.color = c;
        p.attach(this.container);
        this.particles.push(p);
        emittedRight++;
      };

      const leftInterval = Math.max(8, Math.round(burstTime / Math.max(1, half)));
      const rightInterval = Math.max(8, Math.round(burstTime / Math.max(1, half)));
      this._emitterInterval = setInterval(() => {
        emitLeft(); emitRight();
        if (emittedLeft >= half && emittedRight >= half) {
          clearInterval(this._emitterInterval); this._emitterInterval = null;
        }
      }, Math.max(10, Math.min(60, Math.round((leftInterval + rightInterval) / 2))));

      this._last = performance.now();
      const loop = (now) => {
        const dt = Math.min(0.04, (now - this._last) / 1000);
        this._last = now;
        const wind = (Math.sin(now / 1000) * 40) * (slow ? 0.35 : 1); // синусоидальное колебание ветра для более естественного движения
        for (let i = this.particles.length - 1; i >= 0; i--) {
          const par = this.particles[i];
          if (par.vy < 0 && par._expand) {
            par.vx += (par.x < vw / 2 ? -1 : 1) * par._expand * 1400 * dt; // более сильное внешнее воздействие
          }
          // небольшие случайные боковые колебания при падении для рассеивания и более естественного вида
          if (par.vy >= 0) par.vx += (Math.random() - 0.5) * 30 * dt;
          par.vx += wind * 0.02 * dt;
          par.vx *= 1 - (0.03 * dt);
          par.vy *= 1 - (0.015 * dt);
          par.update(dt);
          // удалить, если за пределами экрана и прозрачность равна нулю
          if (par.life > par.ttl + 0.2) {
            par.remove();
            this.particles.splice(i, 1);
          }
        }
        if (this.particles.length || this._emitterInterval) this.raf = requestAnimationFrame(loop);
        else this._finish();
      };
      this.raf = requestAnimationFrame(loop);

      // безопасность: обеспечить завершение работы после истечения установленного времени + буфер, чтобы избежать зависания в случае ошибок
      if (this._safetyTimeout) { try { clearTimeout(this._safetyTimeout); } catch (e) { } }
      this._safetyTimeout = setTimeout(() => {
        if (this._emitterInterval) { clearInterval(this._emitterInterval); this._emitterInterval = null; }
        // дополнительная небольшая задержка на завершение анимаций
        this._safetyTimeout = setTimeout(() => { if (!this.particles.length) this._finish(); else this._finish(); }, 1200);
      }, duration);
    }

    // осторожно: этот метод может быть вызван из разных мест, убедитесь, что он идемпотентный и безопасный для повторного вызова
    _finish() {
      if (!this.running) return;
      this.running = false;
      if (this.raf) { try { cancelAnimationFrame(this.raf); } catch (e) { } this.raf = null; }
      if (this._emitterInterval) { try { clearInterval(this._emitterInterval); } catch (e) { } this._emitterInterval = null; }
      if (this._safetyTimeout) { try { clearTimeout(this._safetyTimeout); } catch (e) { } this._safetyTimeout = null; }
      this.particles.forEach(p => p.remove());
      this.particles = [];
      const btn = document.getElementById('startButton');
      if (btn) { try { btn.disabled = false; } catch (e) { } }
    }

    // Полная очистка слушателей и таймеров — вызывается извне при необходимости.
    destroy() {
      try {
        if (this._onCelebrate) { window.removeEventListener('dropper:celebrate', this._onCelebrate); this._onCelebrate = null; }
      } catch (e) { }
      this._finish();
      try { if (this.container && this.container.parentNode) this.container.parentNode.removeChild(this.container); } catch (e) { }
    }
  }

  // экспортируем синглтон внутри IIFE
  const conf = new Confetti();
  window.Confetti = conf;

})();
