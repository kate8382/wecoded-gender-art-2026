import Dropper from './dropper.js';
import AudioDirector from './audioDirector.js';
import { zoomTimeline } from './config.js';

class MainApp {
  constructor(opts = {}) {
    this.opts = Object.assign({ audioSrc: 'audio/james-brown-3.mp3' }, opts);
    this.dropper = new Dropper({ autoRun: false });
    window.dropper = this.dropper;

    this.audio = new Audio(this.opts.audioSrc);
    this.audio.preload = 'auto';
    window.__appAudio = this.audio;
    // AudioDirector — отвечает за планирование вызовов по времени трека
    this.audioDirector = new AudioDirector(this.audio);
    window.__audioDirector = this.audioDirector;

    // Кешируем часто используемые DOM-узлы на инстансе, чтобы избежать повторных querySelector
    this.overlay = document.getElementById('startOverlay');
    this.theEnd = document.getElementById('theEnd');
    this.page = document.querySelector('.page');
    this.startButton = document.getElementById('startButton');

    this._started = false;
    this._setupHandlers();
    this._initStartOverlayHandlers();
    // Установим начальный scale из конфигурации zoomTimeline, чтобы сцена не показывалась сразу в полном масштабе
    try {
      if (zoomTimeline && Array.isArray(zoomTimeline.scales) && zoomTimeline.scales.length) {
        const initial = Number(zoomTimeline.scales[0]) || 1;

        this.dropper.setBodyScale(initial);
      }
    } catch (e) { }
  }

  _setupHandlers() {
    // используем 'playing', чтобы убедиться, что аудио действительно началось (данные поступают)
    this.audio.addEventListener('playing', () => { return this._onAudioPlay(); });
    this.audio.addEventListener('play', () => { /* audio play event */ });
    this.audio.addEventListener('pause', () => { /* audio pause event */ });
    this.audio.addEventListener('ended', () => {
      // Разрешить повторное воспроизведение: пометить как не начатое, чтобы _onAudioPlay запустил последовательность при следующем воспроизведении.
      this._started = false;
      // Отсутствие флагов автовоспроизведения — простой пользовательский интерфейс.
      // показать THE END и восстановить оверлей для повторного воспроизведения
      const theEnd = this.theEnd;
      const overlay = this.overlay;
      const page = this.page;
      if (theEnd) { /* visibility контролируется _showOverlay(opts) */ }
      if (overlay) {
        // Переключаем предсказуемый CSS-класс для финального экрана.
        // Класс `final-visible` задаст все необходимые правила в CSS
        // и имеет приоритет над обычными состояниями оверлея.
        overlay.classList.remove('transparent');
        overlay.classList.remove('hidden');
        overlay.classList.remove('removed');
        overlay.classList.add('final-visible');
        // показать THE END явно (через класс .visible)
        try {
          if (theEnd) {
            theEnd.hidden = false;
            theEnd.removeAttribute('aria-hidden');
            theEnd.classList.add('visible');
          }
        } catch (e) { }
      }
      // onended: overlay and page updated
      if (page) { page.classList.remove('scene-active'); }
      try { document.body.classList.remove('zooming'); } catch (e) { }
      // очистить визуальные элементы сцены, чтобы следующий запуск вел себя как свежий
      try { this.dropper.reset(); } catch (e) { console.warn('dropper.reset failed on ended', e); }
      try { this.dropper.celebrate(); } catch (e) { }
    });
  }

  // Инициализация обработчиков для стартового оверлея и кнопки, включая логи для диагностики и улучшенную обработку ошибок.
  _initStartOverlayHandlers() {
    const overlay = this.overlay;
    const btn = this.startButton;
    const theEnd = this.theEnd;
    const page = this.page;
    if (theEnd) { theEnd.hidden = true; theEnd.setAttribute('aria-hidden', 'true'); theEnd.classList.remove('visible'); }
    if (overlay) { this._showOverlay(overlay); }
    if (!btn) return;
    btn.addEventListener('click', async () => {
      // start button clicked — before actions
      try {
        // подготовка свежей сцены перед воспроизведением; сначала сброс, чтобы _onAudioPlay мог запустить последовательность
        try { this.dropper.reset(); } catch (e) { console.warn('reset failed', e); }
        this.audio.muted = false;
        this.audio.currentTime = 0;
        // пользовательский запуск (специальные флаги не требуются)
        // скрыть THE END, если присутствует, и сразу показать оверлей сцены (UX как при первом запуске)
        try { if (theEnd) { theEnd.hidden = true; theEnd.setAttribute('aria-hidden', 'true'); theEnd.classList.remove('visible'); } } catch (e) { }
        try { if (overlay) { this._hideOverlay(overlay); } } catch (e) { }
        try { if (page) page.classList.add('scene-active'); } catch (e) { }
        // после изменений UI overlay/page
        await this.audio.play();
        // user-initiated start succeeded
        // если аудио всё ещё на паузе после play (браузер заблокировал unmute), показать fallback кнопку воспроизведения
        if (this.audio.paused) {
          console.warn('audio.play() returned but audio is still paused — showing fallback play control');
          this._createPlayButton(true, true);
        }
        // не скрывать overlay здесь — ждать, пока аудио действительно не начнётся (обрабатывается в _onAudioPlay)
        // ПРИМЕЧАНИЕ: не вызывать runSequence() здесь — _onAudioPlay запустит последовательность на событии 'play'
      } catch (err) {
        console.warn('start button play failed', err);
      }
    });
  }

  // Helper: скрыть overlay с переходом, затем установить display:none как запасной вариант
  _hideOverlay(overlay) {
    if (!overlay) return;
    try {
      overlay.classList.add('hidden');
      // hideOverlay: added hidden
      // убедиться, что класс 'removed' добавлен после завершения перехода, чтобы полностью удалить из hit-testing
      const done = () => {
        try {
          overlay.classList.add('removed');
          // убрать утилитный класс final-visible и очистить возможные inline-стили
          overlay.classList.remove('final-visible');
          overlay.style.opacity = '';
          overlay.style.visibility = '';
          overlay.style.display = '';
          const theEnd = this.theEnd;
          if (theEnd) {
            theEnd.style.opacity = '';
            theEnd.classList.remove('visible');
            theEnd.hidden = true;
            theEnd.setAttribute('aria-hidden', 'true');
          }
        } catch (e) { }
      };
      // если событие transitionend не сработает (нет перехода), использовать запасной вариант через 250ms
      let fired = false;
      const onEnd = (e) => {
        if (e && e.propertyName && e.propertyName.indexOf('opacity') === -1) return;
        fired = true;
        overlay.removeEventListener('transitionend', onEnd);
        done();
      };
      overlay.addEventListener('transitionend', onEnd);
      setTimeout(() => { if (!fired) done(); }, 260);
    } catch (e) { console.warn('hideOverlay failed', e); }
  }

  // Helper: показать overlay (восстановить display, затем удалить hidden/behind)
  _showOverlay(overlay, opts = {}) {
    // opts.showEnd:  показывать ли THE END при отображении overlay (по умолчанию false)
    if (!overlay) return;
    try {
      // удалить 'removed', чтобы overlay участвовал в layout, затем принудительно вызвать reflow
      overlay.classList.remove('removed');
      void overlay.offsetWidth;
      overlay.classList.remove('hidden');

      // убедиться, что дочерние элементы overlay видимы в соответствии с опциями
      try {
        const theEnd = this.theEnd;
        if (theEnd) {
          if (opts.showEnd) {
            theEnd.hidden = false;
            theEnd.removeAttribute('aria-hidden');
            theEnd.classList.add('visible');
            // принудительно вызвать reflow и проверить вычисленную непрозрачность; если всё ещё 0, использовать inline fallback
            void theEnd.offsetWidth;
            const co = getComputedStyle(theEnd).opacity;
            if (co === '0') {
              console.warn('MAIN: theEnd opacity remained 0 after adding .visible — applying final-visible class fallback');
              theEnd.style.opacity = '';
              try { overlay.classList.add('final-visible'); } catch (e) { }
            }
          } else {
            theEnd.hidden = true;
            theEnd.setAttribute('aria-hidden', 'true');
            theEnd.classList.remove('visible');
            theEnd.style.opacity = '';
          }
        }
        const startBtn = this.startButton;
        if (startBtn) startBtn.style.display = '';
      } catch (e) { }

      // Если overlay остался невидимым по computed стилям — применим запасной класс
      try {
        const overlayStyles = getComputedStyle(overlay);
        if (overlayStyles.display === 'none' || overlayStyles.visibility !== 'visible' || overlayStyles.opacity === '0') {
          try { overlay.classList.add('final-visible'); } catch (e) { }
        }
      } catch (e) { }
    } catch (e) { console.warn('MAIN: _showOverlay computed failed', e); }
  }

  // аудиоплейбек всегда запускается явным действием пользователя (кнопка Start) — логика автозапуска удалена, так что нет необходимости в специальных флагах взаимодействия. Просто реагируем на событие 'playing' для запуска последовательности Dropper, гарантируя синхронизацию с фактическим началом воспроизведения аудио.
  _onAudioPlay() {
    if (this._started) return;
    this._started = true;

    // очистим старые задачи директора перед планированием новых
    try { this.audioDirector.clear(); } catch (e) { }
    // пометить body как в режиме зума (фон будет применён через CSS .zooming)
    try { document.body.classList.add('zooming'); } catch (e) { }
    // audio.play event fired — starting dropper sequence
    //  скрыть overlay и активировать сцену, как только аудио действительно начнет воспроизводиться
    try {
      const overlay = this.overlay;
      const page = this.page;
      const theEnd = this.theEnd;
      if (theEnd) { theEnd.hidden = true; theEnd.setAttribute('aria-hidden', 'true'); theEnd.classList.remove('visible'); }
      if (overlay) { overlay.classList.add('transparent'); this._hideOverlay(overlay); }
      if (page) page.classList.add('scene-active');
      // в _onAudioPlay: состояние overlay/page обновлено
    } catch (e) { }
    const seq = this.dropper.getDefaultSequence();
    const zoomDuration = (zoomTimeline && typeof zoomTimeline.duration !== 'undefined') ? Number(zoomTimeline.duration) : 0;
    /* Если в seq присутствуют элементы с полем `atTime` — используем AudioDirector для планирования точных вызовов. Иначе — fallback к существующему runSequence(delay-based). */
    const hasAtTime = seq.some(s => typeof s.atTime === 'number');
    let zoomStarted = false;
    if (hasAtTime) {
      // очистим старые задачи и запланируем новые

      seq.forEach(step => {
        const t = Number(step.atTime);
        if (!isNaN(t)) {
          // если шаг попадает внутрь фазы зума — пропускаем его, чтобы падения не происходили во время зума
          if (zoomDuration && t < zoomDuration) {
            return;
          }
          this.audioDirector.schedule(t, () => {
            try { this.dropper.drop(step); } catch (e) { console.warn('dropper.drop failed from AudioDirector', e); }
          });
        }
      });
      // последовательность запланирована через AudioDirector
    } else {
      // Если включён зум, отложим запуск runSequence до окончания фазы зума, чтобы падения не происходили во время неё
      if (zoomTimeline && zoomTimeline.continuous) {

        let runSeqStarted = false;
        const startSeq = () => {
          if (runSeqStarted) return; runSeqStarted = true;
          try { this.dropper.runSequence(seq).catch(err => console.warn('Dropper sequence error', err)); } catch (e) { }
        };
        const p = this._startContinuousZoom(zoomTimeline);
        zoomStarted = true;
        p.then(() => { try { startSeq(); } catch (e) { } }).catch((e) => { console.warn('continuous zoom promise rejected', e); startSeq(); });
        // безопасный fallback: убедиться, что последовательность запускается после zoomDuration + 800ms, даже если промис никогда не разрешается
        try { setTimeout(() => { try { startSeq(); } catch (e) { } }, Math.max(1000, (zoomDuration * 1000) + 800)); } catch (e) { }
      } else if (zoomTimeline && Array.isArray(zoomTimeline.scales) && zoomTimeline.scales.length) {
        //  дискретный zoom: расписать runSequence на запуск после окончания фазы зума
        this.audioDirector.schedule(zoomDuration, () => {
          try { this.dropper.runSequence(seq).catch(err => console.warn('Dropper sequence error', err)); } catch (e) { }
        });
      } else {
        this.dropper.runSequence(seq).catch(err => console.warn('Dropper sequence error', err));
      }
    }
    // если включен непрерывный зум в конфигурации, запускаем интерполяцию через RAF
    try {
      if (zoomTimeline && zoomTimeline.continuous && !zoomStarted) {
        const total = (typeof zoomTimeline.duration !== 'undefined') ? Number(zoomTimeline.duration) : 0; // общая продолжительность фазы увеличения в секундах
        this._startContinuousZoom(zoomTimeline);
      } else if (zoomTimeline && Array.isArray(zoomTimeline.scales) && zoomTimeline.scales.length) {

        const scales = zoomTimeline.scales.slice(); // создать копию массива, чтобы избежать внешних мутаций
        const total = (typeof zoomTimeline.duration !== 'undefined') ? Number(zoomTimeline.duration) : 0; // общая продолжительность фазы увеличения в секундах
        const count = Math.max(1, scales.length); // количество дискретных шагов масштаба
        // расписать каждый шаг масштаба на равные интервалы в течение общей продолжительности, с небольшим смещением для первого шага, если есть несколько шагов
        scales.forEach((scale, idx) => {
          const t = count === 1 ? 0 : (idx / (count - 1)) * total;
          const isLast = idx === (scales.length - 1);
          this.audioDirector.schedule(t, () => {
            try { this.dropper.setBodyScale(scale); } catch (e) { console.warn('setBodyScale failed', e); }
            // на финальном шаге снимаем режим zooming, чтобы сцена могла развернуться на весь экран
            if (isLast) {
              try { document.body.classList.remove('zooming'); } catch (e) { }
            }
          });
        });
      }
    } catch (e) { console.warn('zoom timeline scheduling failed', e); }
    // нет специальных флагов взаимодействия с пользователем для очистки
  }

  // public API helpers
  get dropperInstance() { return this.dropper; }
  get audioElement() { return this.audio; }

  //  Непрерывный зум: RAF loop, который интерполирует масштабы в соответствии с audio.currentTime
  _startContinuousZoom(timeline) {
    if (!timeline || !Array.isArray(timeline.scales) || !timeline.scales.length) return Promise.resolve();
    this._stopContinuousZoom();
    const scales = timeline.scales.slice();
    const duration = (typeof timeline.duration !== 'undefined') ? Number(timeline.duration) : 0;
    const n = Math.max(1, scales.length);
    //  Пошаговый (snap) зум: прыжки между дискретными масштабами в timeline.scales
    return new Promise((resolve, reject) => {
      let lastIndex = -1;
      // небольшое опережение (в секундах), чтобы прыжки происходили чуть раньше аудио
      const lead = Number(timeline.leadSeconds || timeline.lead) || 0;
      // дополнительное опережение только для первого шага (по запросу)
      const leadFirst = Number(timeline.leadFirstSeconds || timeline.leadFirst) || 0;

      const step = () => {
        try {
          const ct = (this.audio && typeof this.audio.currentTime === 'number') ? this.audio.currentTime : 0;
          // применить дополнительное опережение только когда все еще в первом бакете, чтобы сделать первый прыжок раньше
          const firstBucketThreshold = duration / n;
          // учитывать уже добавленный lead при решении, нужен ли дополнительный leadFirst
          const willBeInFirst = (ct + lead) < firstBucketThreshold;
          const extraLead = willBeInFirst ? leadFirst : 0;
          const adjusted = Math.min(duration, Math.max(0, ct + lead + extraLead));
          const pRaw = Math.max(0, Math.min(1, adjusted / duration));
          // разделить диапазон 0..1 на `n` бакетов и привязать к индексу бакета
          let idx = Math.min(n - 1, Math.floor(pRaw * n));
          if (pRaw >= 1) idx = n - 1;
          if (idx !== lastIndex) {
            lastIndex = idx;
            const s = scales[idx];
            try { this.dropper.setBodyScale(s); } catch (e) { }
          }
          if (ct >= duration) {
            try { document.body.classList.remove('zooming'); } catch (e) { }
            this._stopContinuousZoom();
            resolve();
            return;
          }
        } catch (e) { console.warn('continuous snap zoom step error', e); reject(e); return; }
        this._zoomRafId = requestAnimationFrame(step);
      };

      // применить начальный прыжок сразу
      try {
        const initScale = scales[0];
        try { this.dropper.setBodyScale(initScale); } catch (e) { }
        lastIndex = 0;
      } catch (e) { }
      this._zoomRafId = requestAnimationFrame(step);
    });
  }

  _stopContinuousZoom() {
    if (this._zoomRafId) {
      try { cancelAnimationFrame(this._zoomRafId); } catch (e) { }
      this._zoomRafId = null;
    }
  }
}

const app = new MainApp();
export { MainApp };
export default app;
