// Keyboard + mouse. Gameplay reads go through down()/pressed(), which return false while a
// menu is open (blocked). UI code uses the *Raw variants.
// Mouse lock (Settings ▸ Lock the mouse, on by default): in the world the cursor is hidden and the
// mouse turns the camera. It locks on entering the world and whenever a menu, the phone or a
// minigame closes; Esc frees it (the browser's own rule) and a click locks it again. Off: hold a
// mouse button and drag to look.
import { G } from './game.js';
const PREVENT = new Set(['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyF']);
const typing = (e) => e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set(); this.hit = new Set();
    this.mx = 0; this.my = 0; this.locked = false; this._blocked = false; this.dragging = false; this.hintOn = false;
    addEventListener('keydown', (e) => {
      if (typing(e)) return;
      if (PREVENT.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code); this.hit.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('mousedown', (e) => {
      if (this.blocked) return;
      const b = 'Mouse' + e.button; this.keys.add(b); this.hit.add(b);   // Mouse0 left, Mouse2 right (Hero Mode attacks)
      this.dragging = true;
      this.clicked = true; this.capture();
    });
    addEventListener('mouseup', (e) => { this.dragging = false; this.keys.delete('Mouse' + e.button); });
    addEventListener('mousemove', (e) => {
      if (this.blocked) return;
      if (this.locked || this.dragging) { this.mx += e.movementX || 0; this.my += e.movementY || 0; }
    });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; if (this.locked) this.refused = 0; });
    // some browser views (embedded ones, for example) never allow the lock: after a click is refused
    // three times, say so once and stop asking; dragging to look still works
    document.addEventListener('pointerlockerror', () => {
      if (!this.clicked) return; this.clicked = false; this.refused = (this.refused || 0) + 1;
      if (this.refused === 3 && G.ui) G.ui.toast('This browser view does not allow the mouse to be locked. Hold a mouse button and drag to look around.', 'info');
    });
  }
  get lockWanted() { return !G.settings || G.settings.mouseLock !== false; }
  // in the world, with nothing open on top of it
  get inWorld() { return !this._blocked && !(G.ui && G.ui.titleOpen) && !G.minigame && !(G.phone && G.phone.open) && !G.paused; }
  // lock the mouse to the game, if the setting is on. Browsers allow it only right after a click or
  // key press, so it is asked for when one of those ends a menu; otherwise the next click does it.
  capture() {
    if (this.locked || !this.lockWanted || !this.inWorld || document.pointerLockElement || this.refused >= 3) return;
    try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch { /* not allowed now, or unsupported */ }
  }
  get blocked() { return this._blocked; }
  // asked for once the click or key press that closed the menu has finished, so a menu that opens
  // another one (or un-pauses the game) has settled first
  set blocked(v) { const was = this._blocked; this._blocked = v; if (v) this.showHint(false); if (was && !v) setTimeout(() => this.capture(), 0); }
  down(c) { return !this.blocked && this.keys.has(c); }
  pressed(c) { return !this.blocked && this.hit.has(c); }
  downRaw(c) { return this.keys.has(c); }
  pressedRaw(c) { return this.hit.has(c); }
  releasePointer() { if (document.pointerLockElement) document.exitPointerLock(); }
  endFrame() {
    this.hit.clear(); this.mx = 0; this.my = 0;
    // a small note while the mouse is free in the world: click to steer the camera again
    const want = this.lockWanted && !this.locked && this.inWorld && !!G.started && !(G.pad && G.pad.on) && !(this.refused >= 3);
    this.showHint(want);
  }
  showHint(want) {
    if (want === this.hintOn) return; this.hintOn = want;
    if (!this.hint) { this.hint = document.createElement('div'); this.hint.id = 'lock-hint'; this.hint.textContent = 'Click to steer the camera with the mouse · Esc frees the mouse'; document.body.appendChild(this.hint); }
    this.hint.classList.toggle('on', want);
  }
}
