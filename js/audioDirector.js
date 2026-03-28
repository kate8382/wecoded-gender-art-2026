// Небольшой AudioDirector — планировщик вызовов по времени воспроизведения
// Предназначен для простого тестирования синхронизации анимаций с audio.currentTime
const DEBUG = false; // включить отладочные логи для AudioDirector (может быть полезно при настройке синхронизации)

export default class AudioDirector {
  constructor(audioEl, opts = {}) {
    this.audio = audioEl;
    this.schedules = []; // {t, id, fn, fired}
    this._tick = this._tick.bind(this);
    this._onPlay = this._onPlay.bind(this);
    this._onPause = this._onPause.bind(this);
    this._interval = opts.interval || 120; // ms polling when playing
    this._running = false;
    if (this.audio) {
      this.audio.addEventListener('play', this._onPlay);
      this.audio.addEventListener('playing', this._onPlay);
      this.audio.addEventListener('pause', this._onPause);
      this.audio.addEventListener('ended', this._onPause);
    }
  }

  // производит планирование вызова функции через t секунд (с плавающей точкой). Возвращает id для отмены.
  schedule(tSeconds, fn) {
    const id = Math.random().toString(36).slice(2, 9);
    const entry = { t: Number(tSeconds) || 0, id, fn, fired: false };
    this.schedules.push(entry);
    // сортируем расписание по времени для эффективности
    this.schedules.sort((a, b) => a.t - b.t);
    try { if (DEBUG) console.debug('AudioDirector: scheduled', id, 'at', entry.t); } catch (e) { }
    return id;
  }

  cancel(id) {
    this.schedules = this.schedules.filter(s => s.id !== id);
  }

  clear() {
    this.schedules.length = 0;
  }

  _onPlay() {
    if (!this._running) {
      this._running = true;
      this._tick();
    }
  }

  _onPause() {
    this._running = false;
  }

  // poller: вызывает запланированные задачи, как только audio.currentTime >= t
  _tick() {
    if (!this._running) return;
    try {
      const ct = this.audio && this.audio.currentTime ? this.audio.currentTime : 0;
      // небольшая поправка, чтобы не пропускать моменты из-за нерегулярного тайминга
      const epsilon = 0.06; // 60ms
      for (const s of this.schedules) {
        if (!s.fired && ct + epsilon >= s.t) {
          try { s.fn(); } catch (e) { if (DEBUG) console.warn('AudioDirector scheduled fn error', e); }
          try { if (DEBUG) console.debug('AudioDirector: firing', s.id, 'scheduledAt', s.t, 'currentTime', ct); } catch (e) { }
          s.fired = true;
        }
      }
    } catch (e) {
      if (DEBUG) console.warn('AudioDirector tick error', e);
    }
    //  продолжаем опрос
    if (this._running) this._timer = setTimeout(this._tick, this._interval);
  }

  // утилита: планирует массив задач вида {t, fn}
  scheduleAll(list) {
    if (!Array.isArray(list)) return [];
    return list.map(item => this.schedule(item.t, item.fn));
  }

  // Dispose: останавливает опрос и удаляет обработчики событий аудио, чтобы предотвратить утечки памяти при удалении AudioDirector
  dispose() {
    this._running = false;
    try { if (this._timer) { clearTimeout(this._timer); this._timer = null; } } catch (e) { }
    try {
      if (this.audio) {
        this.audio.removeEventListener('play', this._onPlay);
        this.audio.removeEventListener('playing', this._onPlay);
        this.audio.removeEventListener('pause', this._onPause);
        this.audio.removeEventListener('ended', this._onPause);
      }
    } catch (e) { }
  }
}
