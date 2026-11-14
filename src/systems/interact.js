// Context interactions: finds the nearest usable thing and shows the prompt for it.
// Items: { pos, r, label (string | fn), use(), enabled?(), mode?: 'walk' | 'sit' | 'drive', key? }
import { G } from '../core/game.js';

export class Interact {
  constructor() { this.items = []; }
  add(it) { it.mode = it.mode || 'walk'; this.items.push(it); return it; }
  remove(it) { const i = this.items.indexOf(it); if (i >= 0) this.items.splice(i, 1); }

  best(mode, p, reachScale = 1) {
    let best = null, bs = 1;
    for (const it of this.items) {
      if (it.mode !== mode) continue;
      const q = it.pos, dy = Math.abs(q.y - p.y);
      if (dy > (it.yTol || 2.2)) continue;
      const r = it.r * reachScale, d2 = (q.x - p.x) ** 2 + (q.z - p.z) ** 2;
      if (d2 > r * r) continue;
      if (it.enabled && !it.enabled()) continue;
      const s = Math.sqrt(d2) / r - (it.prio || 0);
      if (s < bs) { bs = s; best = it; }
    }
    return best;
  }

  update() {
    const ui = G.ui, p = G.player, inp = G.input, car = G.car;
    if (ui.menu || ui.titleOpen || ui.cool > 0 || G.minigame || p.state === 'busy') { ui.setPrompt(null); return; }
    if (p.state === 'climb') { ui.setPrompt(null); return; }
    if (p.state === 'ladder') { ui.setPrompt('W S', 'Climb · Space lets go'); return; }
    if (p.state === 'drive') {
      const it = this.best('drive', car.pos);
      if (it) { ui.setPrompt('E', typeof it.label === 'function' ? it.label() : it.label); if (inp.pressed('KeyE')) it.use(); }
      else if (car.mode !== 'fly' && car.speed < 2.5) ui.setPrompt('F', 'Step out'); else ui.setPrompt(null);
      if (inp.pressed('KeyF')) { if (car.alight(p)) ui.setHelp(); }
      if (inp.pressed('KeyT') && G.economy) G.economy.autopilotMenu();
      return;
    }
    if (p.state === 'ride') {
      const it = this.best('ride', p.pos);
      if (it) { ui.setPrompt('E', typeof it.label === 'function' ? it.label() : it.label); if (inp.pressed('KeyE')) it.use(); } else ui.setPrompt(null);
      return;
    }
    if (p.state === 'sit') {
      const it = this.best('sit', p.pos);
      if (it) { ui.setPrompt('E', typeof it.label === 'function' ? it.label() : it.label); if (inp.pressed('KeyE')) it.use(); }
      else { ui.setPrompt('Space', 'Stand up'); if (inp.pressed('KeyE')) p.stand(); }
      return;
    }
    const it = this.best('walk', p.pos);
    const nearCar = Math.abs(p.pos.y - (car.pos.y - car.ride)) < 2.5 && (p.pos.x - car.pos.x) ** 2 + (p.pos.z - car.pos.z) ** 2 < 4.4 * 4.4;
    if (it) { ui.setPrompt(it.key || 'E', typeof it.label === 'function' ? it.label() : it.label); if (inp.pressed('KeyE')) { it.use(); return; } }
    else if (nearCar) ui.setPrompt('F', car.mode === 'parked' ? 'Board your aerocar' : 'Board');
    else ui.setPrompt(null);
    if (nearCar && inp.pressed('KeyF')) { car.board(p); ui.setHelp(); }
  }
}
