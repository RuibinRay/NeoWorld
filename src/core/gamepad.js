// Gamepad support (the standard layout of Xbox and PlayStation pads). Buttons send the same key
// presses as the keyboard, so every part of the game hears them. The left stick also gives the
// walking controller an analog direction and speed (a light tilt walks, a full tilt runs); the
// right stick looks. On the title screen, in menus and on the phone, the D-pad or the left stick
// moves a highlight, A confirms and B goes back.
import { G } from './game.js';

// button index → key: A jump/climb, B crouch/descend, X use, Y board, LB phone, RB view, LT sprint/boost,
// RT forward/throttle, View map, Menu pause, L3 hoverboard, R3 jet harness, D-pad the arrow keys
// in Hero Mode: RB light attack, LB heavy, the d-pad powers 1 2 3 and ultimate
// RB light, LB heavy, d-pad up/right/down powers 1 2 3, d-pad left ultimate, Y signature (4), right stick click partner swap (G),
// B dodge roll (C), View/Select the phone (Q)
const HERO_BTN = { 5: 'Mouse0', 4: 'Mouse2', 12: 'Digit1', 15: 'Digit2', 13: 'Digit3', 14: 'KeyR', 3: 'Digit4', 11: 'KeyG', 8: 'KeyQ' };
const code = (i) => (G.heroes && G.heroes.on && HERO_BTN[i]) || BTN[i];
const BTN = { 0: 'Space', 1: 'KeyC', 2: 'KeyE', 3: 'KeyF', 4: 'KeyQ', 5: 'KeyV', 6: 'ShiftLeft', 7: 'KeyW', 8: 'KeyM', 9: 'KeyP', 10: 'KeyB', 11: 'KeyJ', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight' };
const STICK = [['KeyA', 0, -1], ['KeyD', 0, 1], ['KeyW', 1, -1], ['KeyS', 1, 1]];
const DEAD = 0.18;
export const PAD_HELP = 'Left stick move (tilt lightly to walk) · right stick look · A jump / climb · B crouch · X use · Y board or step out · LT sprint · RT throttle · LB phone · RB view · View map · Menu pause · L3 hoverboard · R3 jet harness';

export class Pad {
  constructor() {
    this.prev = []; this.stick = new Set(); this.navT = 0; this.sel = 0; this.ctx = null; this.on = false;
    addEventListener('gamepadconnected', (e) => { if (G.ui) G.ui.toast(`Gamepad connected (${e.gamepad.id.split('(')[0].trim().slice(0, 40)}). ${PAD_HELP}.`, 'good'); });
    addEventListener('gamepaddisconnected', () => { this.release(); if (G.ui) G.ui.toast('Gamepad disconnected.', 'info'); });
  }
  key(code, down) { dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true })); }
  // let go of everything the pad is holding (when it disconnects, or a menu opens)
  release() {
    for (const i in BTN) if (this.prev[i]) this.key(code(i), false);
    const inp = G.input; for (const c of this.stick) inp.keys.delete(c); this.stick.clear();
    this.prev = []; inp.padX = inp.padY = 0;
  }
  pad() {
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    let any = null; for (const p of list) if (p && p.connected) { if (p.mapping === 'standard') return p; any = any || p; }
    return any;
  }
  poll(dt) {
    const gp = this.pad(), inp = G.input;
    if (!gp) { if (this.on) { this.release(); this.on = false; } return; }
    this.on = true;
    const ax = (i) => { const v = gp.axes[i] || 0; return Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD); };
    const btn = (i) => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5));
    const lx = ax(0), ly = ax(1), rx = ax(2), ry = ax(3), now = gp.buttons.map((b, i) => btn(i));
    const ui = G.ui, title = ui && ui.titleOpen, phone = G.phone && G.phone.open && !ui.menu;
    if (title || (ui && ui.menu) || phone) {           // menus: highlight and pick
      if (this.prev.some(Boolean) || this.stick.size) { const keep = now; this.release(); this.prev = keep; }
      this.navigate(dt, ly, now, title ? 'title' : phone ? 'phone' : 'menu');
      this.prev = now; return;
    }
    this.ctx = null;
    for (const i in BTN) if (now[i] !== !!this.prev[i]) this.key(code(i), now[i]);
    // the left stick holds the movement keys (vehicles, minigames) and gives walking an analog direction
    for (const [code, a, sgn] of STICK) {
      const on = (a ? ly : lx) * sgn > 0.35;
      if (on && !this.stick.has(code)) { this.stick.add(code); inp.keys.add(code); inp.hit.add(code); }
      else if (!on && this.stick.has(code)) { this.stick.delete(code); if (!(code === 'KeyW' && now[7])) inp.keys.delete(code); }
    }
    inp.padX = lx; inp.padY = ly;
    inp.mx += rx * 1000 * dt; inp.my += ry * 700 * dt;   // about 2.6 rad/s across and 1.5 rad/s up and down at full tilt
    this.prev = now;
  }
  navigate(dt, ly, now, ctx) {
    const list = ctx === 'title' ? [...document.querySelectorAll('#title button')] : ctx === 'phone' ? [...G.phone.el.querySelectorAll('button')] : [...document.querySelectorAll('#menu .opts button')];
    const id = ctx === 'menu' ? G.ui.menu : ctx === 'phone' ? G.phone.screen : document.querySelector('#title button') && document.querySelector('#title button').id;
    if (this.ctx !== ctx || this.ctxId !== id) { this.ctx = ctx; this.ctxId = id; this.sel = Math.max(0, list.findIndex((b) => ['t-cont', 'c-go'].includes(b.id))); }   // start on the main button
    if (!list.length) return;
    const up = now[12] || ly < -0.55, down = now[13] || ly > 0.55;
    this.navT -= dt;
    if (up || down) { if (this.navT <= 0) { this.sel = (this.sel + (down ? 1 : -1) + list.length) % list.length; this.navT = 0.22; } } else this.navT = 0;
    if (this.sel >= list.length) this.sel = 0;
    list.forEach((b, i) => b.classList.toggle('padsel', i === this.sel));
    if (now[0] && !this.prev[0]) { const b = list[this.sel]; this.sel = 0; b.click(); }
    else if (now[1] && !this.prev[1]) { this.key('Escape', true); this.key('Escape', false); }
  }
}
