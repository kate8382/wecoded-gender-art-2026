# WeCoded — Gender Equity (Frontend Art)

📖 Read the story behind this project on [dev.to](https://dev.to/kate8382/the-invisible-scales-a-frontend-art-performance-on-gender-equity-1n0o)

📺 [Watch the performance on YouTube](https://youtu.be/eMlrY8YFxos)

## Participation: WeCoded 2026 challenge

This project is an entry for the [WeCoded 2026 Frontend Art challenge](https://dev.to/devteam/join-the-2026-wecoded-challenge-and-celebrate-underrepresented-voices-in-tech-through-writing--4828)

## Project summary

A small, dependency-free frontend installation (HTML/CSS/JS) that visualizes gender equity through a musical scene. The central motif is a pair of scales: while the paid, public work of women and men is shown as equal, the piece represents the often invisible unpaid domestic labor that falls on women in parallel to paid work. Visual effects include pulsing gender symbols, subtle gradient dimming, scaling/zoom, falling items into scale pans, and a celebratory finale.

## Vision & Artistic Intent

The central motif of this installation is a pair of scales that remain visually balanced by design. This represents formal, legal equality in the workplace. However, the true story is told through the falling items:

- **The "Second Shift":** While both sides show equal professional standing (the laptops), the female side is gradually overwhelmed by the "invisible" weight of unpaid domestic labor.

- **The Invisible Burden:** Falling household items (strollers, pans, appliances) represent the mental load and multitasking that often fall disproportionately on women.

- **Pressure & Stress:** The pulsing gender symbols and the darkening gradient are visual metaphors for the mounting systemic pressure that grows as responsibilities multiply.

- **The Finale:** A theatrical ending serves as a reminder: we all see the imbalance, we all acknowledge it, yet the cycle continues. This piece is a call to look closer at the "hidden" side of the scales.

## Video presentation
**Responsive Note:** Optimized for desktop and tablets (down to 768px).



https://github.com/user-attachments/assets/deb7ac12-7865-4ac5-af44-22f3767447b8



## Technical overview

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

## How to run locally

1. Open `index.html` in a modern browser (or use VS Code Live Server).
2. Browsers block autoplay of audio. For demo purposes you can:
   - Launch Chrome with `--autoplay-policy=no-user-gesture-required` on your demo machine, or
   - Rely on the start-overlay UX: the user clicks the start button to enable audio and begin the scene.

## Design notes

- Transform and scale are applied to a dedicated `.page__zoom` container to avoid layout and positioning conflicts with absolutely positioned children.
- Audio timing is handled by `AudioDirector` (simple scheduler), which keeps `Dropper` focused on visual behavior.

## License & Author

This project is shared under the [MIT LICENSE](LICENSE). 
Author: [Ecaterina Sevciuc](https://github.com/kate8382/kate8382.git).
