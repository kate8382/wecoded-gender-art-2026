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
    this._initStartOverlayHandlers();
    console.log('MainApp initialized — waiting for user Start');
  }

  _setupHandlers() {
    // use 'playing' to ensure audio has actually started (data is flowing)
    this.audio.addEventListener('playing', () => { console.log('MAIN: audio playing event'); return this._onAudioPlay(); });
    this.audio.addEventListener('play', () => { console.log('MAIN: audio play event, paused=', this.audio.paused); });
    this.audio.addEventListener('pause', () => { console.log('MAIN: audio pause event'); });
    this.audio.addEventListener('ended', () => {
      console.log('audio ended');
      // allow replay: mark not-started so _onAudioPlay will run sequence on next play
      this._started = false;
      // no autoplay flags — simple user-driven flow
      // show THE END and restore overlay for replay
      const theEnd = document.getElementById('theEnd');
      const overlay = document.getElementById('startOverlay');
      const page = document.querySelector('.page');
      if (theEnd) { /* visibility controlled by _showOverlay(opts) */ }
      if (overlay) {
        // remove transparent state and show overlay with THE END
        overlay.classList.remove('transparent');
        this._showOverlay(overlay, { showEnd: true });
      }
      console.log('MAIN: onended - overlay.className=', overlay && overlay.className, 'page.className=', page && page.className);
      if (page) { page.classList.remove('scene-active'); page.style.background = 'transparent'; }
      // clear scene visuals so next start behaves like fresh run
      try { this.dropper.reset(); } catch (e) { console.warn('dropper.reset failed on ended', e); }
      // ensure document body returns to initial background variable
      try { document.body.style.background = getComputedStyle(document.documentElement).getPropertyValue('--text-color') || 'var(--text-color)'; } catch (e) { }
      try { this.dropper.celebrate(); } catch (e) { }
    });
  }

  _initStartOverlayHandlers() {
    const overlay = document.getElementById('startOverlay');
    const btn = document.getElementById('startButton');
    const theEnd = document.getElementById('theEnd');
    const page = document.querySelector('.page');
    if (theEnd) { theEnd.hidden = true; theEnd.setAttribute('aria-hidden', 'true'); theEnd.classList.remove('visible'); }
    if (overlay) { this._showOverlay(overlay); }
    if (!btn) return;
    btn.addEventListener('click', async () => {
      console.log('MAIN: start button clicked — before actions overlay.className=', overlay && overlay.className, 'page.className=', page && page.className);
      try {
        // prepare fresh scene before playback; reset first so _onAudioPlay can start sequence
        try { this.dropper.reset(); } catch (e) { console.warn('reset failed', e); }
        this.audio.muted = false;
        this.audio.currentTime = 0;
        // user-initiated start (no special flags required)
        // hide THE END if present and show scene overlay immediately (UX like first-run)
        try { if (theEnd) { theEnd.hidden = true; theEnd.setAttribute('aria-hidden', 'true'); theEnd.classList.remove('visible'); } } catch (e) { }
        try { if (overlay) { this._hideOverlay(overlay); } } catch (e) { }
        try { if (page) page.classList.add('scene-active'); } catch (e) { }
        console.log('MAIN: after UI changes overlay.className=', overlay && overlay.className, 'page.className=', page && page.className);
        // clear any inline body background set at end-screen so .page.scene-active is visible
        try { document.body.style.background = ''; } catch (e) { }
        await this.audio.play();
        console.log('user-initiated start succeeded');
        // If audio still paused after play (browser blocked unmute), show fallback play button
        if (this.audio.paused) {
          console.warn('audio.play() returned but audio is still paused — showing fallback play control');
          this._createPlayButton(true, true);
        }
        // do not hide overlay here — wait until audio actually starts (handled in _onAudioPlay)
        // NOTE: do not call runSequence() here — _onAudioPlay will run the sequence on 'play' event
      } catch (err) {
        console.warn('start button play failed', err);
      }
    });
  }

  // Helper: hide overlay with transition then set display:none as fallback
  _hideOverlay(overlay) {
    if (!overlay) return;
    try {
      overlay.classList.add('hidden');
      // ensure 'removed' class after transition to fully remove from hit-testing
      const done = () => {
        try { overlay.classList.add('removed'); } catch (e) { }
      };
      // if transitionend doesn't fire (no transition), fallback after 250ms
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

  // Helper: show overlay (restore display then remove hidden/behind)
  _showOverlay(overlay, opts = {}) {
    // opts.showEnd: whether to reveal THE END when showing overlay (default false)
    if (!overlay) return;
    try {
      // remove 'removed' so overlay participates in layout, then force reflow
      overlay.classList.remove('removed');
      void overlay.offsetWidth;
      overlay.classList.remove('hidden');
      // ensure overlay children visibility according to options
      try {
        const theEnd = document.getElementById('theEnd');
        if (theEnd) {
          if (opts.showEnd) {
            theEnd.hidden = false;
            theEnd.removeAttribute('aria-hidden');
            theEnd.classList.add('visible');
            // force reflow and check computed opacity; if still 0 use inline fallback
            void theEnd.offsetWidth;
            const co = getComputedStyle(theEnd).opacity;
            console.log('MAIN: _showOverlay theEnd post-toggle', { className: theEnd.className, hidden: theEnd.hidden, opacity: co });
            if (co === '0') {
              console.warn('MAIN: theEnd opacity remained 0 after adding .visible — applying inline fallback');
              theEnd.style.opacity = '1';
            }
          } else {
            theEnd.hidden = true;
            theEnd.setAttribute('aria-hidden', 'true');
            theEnd.classList.remove('visible');
            theEnd.style.opacity = '';
          }
        }
        const startBtn = document.getElementById('startButton');
        if (startBtn) startBtn.style.display = '';
      } catch (e) { }
      // diagnostic
      try {
        const theEndEl = document.getElementById('theEnd');
        const startBtn = document.getElementById('startButton');
        const overlayStyles = getComputedStyle(overlay);
        const theEndStyles = theEndEl ? getComputedStyle(theEndEl) : null;
        const startBtnStyles = startBtn ? getComputedStyle(startBtn) : null;
        const rect = overlay.getBoundingClientRect();
        console.log('MAIN: _showOverlay computed', {
          overlay: { display: overlayStyles.display, opacity: overlayStyles.opacity, visibility: overlayStyles.visibility, transform: overlayStyles.transform, rect },
          theEnd: theEndEl ? { className: theEndEl.className, hidden: theEndEl.hidden, opacity: theEndStyles.opacity, display: theEndStyles.display, visibility: theEndStyles.visibility, transform: theEndStyles.transform, rect: theEndEl.getBoundingClientRect(), offsetHeight: theEndEl.offsetHeight } : '(no theEnd)',
          startBtn: startBtn ? { display: startBtnStyles.display, opacity: startBtnStyles.opacity, visibility: startBtnStyles.visibility, rect: startBtn.getBoundingClientRect(), offsetHeight: startBtn.offsetHeight } : '(no startBtn)'
        });
      } catch (e) { console.warn('MAIN: _showOverlay computed failed', e); }
    } catch (e) { console.warn('showOverlay failed', e); }
  }

  // Autoplay logic removed — playback is always started by explicit user action (Start button)

  _onAudioPlay() {
    if (this._started) return;
    this._started = true;
    console.log('MAIN: audio.play event fired — starting dropper sequence', { _started: this._started });
    // hide overlay and activate scene as soon as audio actually plays
    try {
      const overlay = document.getElementById('startOverlay');
      const page = document.querySelector('.page');
      const theEnd = document.getElementById('theEnd');
      if (theEnd) { theEnd.hidden = true; theEnd.setAttribute('aria-hidden', 'true'); theEnd.classList.remove('visible'); }
      // ensure backgrounds are transparent while scene runs
      try { document.body.style.background = 'transparent'; } catch (e) { }
      if (overlay) { overlay.classList.add('transparent'); this._hideOverlay(overlay); }
      if (page) page.classList.add('scene-active');
      console.log('MAIN: in _onAudioPlay overlay.className=', overlay && overlay.className, 'page.className=', page && page.className);
    } catch (e) { }
    const seq = this.dropper.getDefaultSequence();
    this.dropper.runSequence(seq).catch(err => console.warn('Dropper sequence error', err)).then(() => console.log('DROPPER: runSequence finished'));
    // no special user-interaction flags to clear
  }

  _createPlayButton() {
    // Floating play button intentionally disabled — central Start overlay is primary UI.
    return null;
  }

  // public API helpers
  get dropperInstance() { return this.dropper; }
  get audioElement() { return this.audio; }
}

const app = new MainApp();
export { MainApp };
export default app;
