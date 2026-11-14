// Keyboard + mouse. Gameplay reads go through down()/pressed(), which return false while a
// menu is open (blocked). UI code uses the *Raw variants.
const PREVENT = new Set(['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyF']);
const typing = (e) => e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set(); this.hit = new Set();
    this.mx = 0; this.my = 0; this.locked = false; this.blocked = false; this.dragging = false;
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
      if (!this.locked) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch { /* unsupported */ } }
    });
    addEventListener('mouseup', (e) => { this.dragging = false; this.keys.delete('Mouse' + e.button); });
    addEventListener('mousemove', (e) => {
      if (this.blocked) return;
      if (this.locked || this.dragging) { this.mx += e.movementX || 0; this.my += e.movementY || 0; }
    });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; });
  }
  down(c) { return !this.blocked && this.keys.has(c); }
  pressed(c) { return !this.blocked && this.hit.has(c); }
  downRaw(c) { return this.keys.has(c); }
  pressedRaw(c) { return this.hit.has(c); }
  releasePointer() { if (document.pointerLockElement) document.exitPointerLock(); }
  endFrame() { this.hit.clear(); this.mx = 0; this.my = 0; }
}
