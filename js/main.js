import Dropper from './dropper.js';

class MainApp {
  constructor(opts = {}) {
    this.opts = Object.assign({ audioSrc: 'audio/james-brown-2.mp3' }, opts);
    this.dropper = new Dropper({ autoRun: false });
    window.dropper = this.dropper;

    this.audio = new Audio(this.opts.audioSrc);
    this.audio.preload = 'auto';
    window.__appAudio = this.audio;

    this._started = false;
    this._setupHandlers();
    console.log('MainApp initialized — attempting autoplay (muted)');
    this._attemptAutoplayMuted();
  }

  _setupHandlers() {
    this.audio.addEventListener('play', () => this._onAudioPlay());
    this.audio.addEventListener('ended', () => console.log('audio ended'));
  }

  async _attemptAutoplayMuted() {
    try {
      // try muted autoplay so visuals can begin without user interaction
      this.audio.muted = true;
      await this.audio.play();
      console.log('autoplay (muted) succeeded');
      // start visuals when audio actually begins
      // note: audio is muted — user can later unmute via UI button
      // run sequence but don't block
      this._onAudioPlay();
      // also create an unobtrusive play button so user may replay with sound
      this._createPlayButton();
    } catch (err) {
      console.warn('autoplay failed, will wait for user to start', err && err.name, err && err.message);
      // If autoplay fails due to background throttling (power saving) or because
      // the document is not visible, try again when visibility/focus returns.
      this._setupAutoplayRetry(err);
      // fallback: create play button so user can start with sound manually
      this._createPlayButton(true);
    }
  }

  _setupAutoplayRetry(err) {
    // If page was backgrounded or autoplay was blocked, attempt a muted play
    // again when the page becomes visible or gains focus. Remove listeners
    // after first attempt.
    const tryPlayMuted = async () => {
      try {
        if (!document || document.visibilityState !== 'visible') return;
        this.audio.muted = true;
        await this.audio.play();
        console.log('autoplay retry (muted) succeeded after visibility/focus change');
        this._onAudioPlay();
        // keep the play button for user-initiated unmuted replay
        this._createPlayButton();
        cleanup();
      } catch (e) {
        console.warn('autoplay retry failed', e && e.name, e && e.message);
        // if still failing, leave handlers active until user interacts or tab stays visible
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') tryPlayMuted();
    };
    const onFocus = () => tryPlayMuted();
    const onPointer = () => tryPlayMuted();

    const cleanup = () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pointerdown', onPointer);
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pointerdown', onPointer, { once: true });
  }

  _onAudioPlay() {
    if (this._started) return;
    this._started = true;
    console.log('audio.play event fired — starting dropper sequence');
    const seq = this.dropper.getDefaultSequence();
    this.dropper.runSequence(seq).catch(err => console.warn('Dropper sequence error', err));
  }

  _createPlayButton(showHint = false) {
    if (this._playButton) return;
    const btn = document.createElement('button');
    btn.className = 'app-play-button';
    btn.textContent = 'Play';
    Object.assign(btn.style, {
      position: 'fixed',
      right: '18px',
      bottom: '18px',
      padding: '10px 14px',
      borderRadius: '8px',
      border: 'none',
      background: 'rgba(0,0,0,0.6)',
      color: 'white',
      zIndex: 9999,
      cursor: 'pointer',
      fontSize: '14px'
    });
    btn.title = 'Play with sound';
    btn.addEventListener('click', async () => {
      try {
        // unmute and restart from beginning so user hears sound from start
        this.audio.muted = false;
        this.audio.currentTime = 0;
        await this.audio.play();
        console.log('user-initiated play succeeded');
        // reset scene so items don't accumulate from previous run
        try { this.dropper.reset(); } catch (e) { console.warn('reset failed', e); }
        // restart visuals sequence as a replay
        try { this.dropper.runSequence(this.dropper.getDefaultSequence()); } catch (e) { console.warn('runSequence failed', e); }
      } catch (err) {
        console.warn('user play failed', err);
      }
    });

    if (showHint) {
      const hint = document.createElement('div');
      hint.textContent = 'Click to play with sound';
      Object.assign(hint.style, {
        position: 'fixed',
        right: '18px',
        bottom: '62px',
        zIndex: 9999,
        color: '#fff',
        background: 'rgba(0,0,0,0.4)',
        padding: '6px 8px',
        borderRadius: '6px',
        fontSize: '12px'
      });
      document.body.appendChild(hint);
      setTimeout(() => hint.remove(), 4000);
    }

    document.body.appendChild(btn);
    this._playButton = btn;
  }

  // public API helpers
  get dropperInstance() { return this.dropper; }
  get audioElement() { return this.audio; }
}

const app = new MainApp();
export { MainApp };
export default app;
