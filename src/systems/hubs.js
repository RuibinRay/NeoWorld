// The four Midtown squares (data/hubs.js, world/hubs.js): their name signs, the food kiosk, a
// welcome the first time you walk in, and the hot food runs. A kiosk keeper hands you an order
// for the keeper of another square; it pays on delivery, with a tip if it arrives before it
// goes cold. Walk it, ride it, fly it as a hero: the faster it gets there the bigger the tip.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { labelTexture } from '../world/materials.js';

const fmt = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);
const open = () => { const h = G.env.hour; return h >= 7 && h < 22; };

export class Hubs {
  constructor() {
    this.list = (G.metro && G.metro.hubs) || []; this.run = null; this.inside = null; this.objShown = false;
    this.signs = [];
    for (const h of this.list) {
      const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ map: labelTexture(h.name.toUpperCase(), { size: 58, color: h.color, sub: `${h.quarter} · food · food runs` }), transparent: true, depthWrite: false });
      for (let k = 0; k < 4; k++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.6), mat), a = (k * Math.PI) / 2; m.position.set(Math.sin(a) * 3.2, 0, Math.cos(a) * 3.2); m.rotation.y = a; g.add(m); }   // a square crown of four signs round the column
      g.position.set(h.sign.x, h.sign.y, h.sign.z); G.scene.add(g); this.signs.push({ g, h });
      const at = new THREE.Vector3(h.counter.x, h.counter.y, h.counter.z);
      G.interact.add({ pos: at, r: 2.4, yTol: 2, prio: 0.3, label: () => this.label(h), use: () => this.use(h) });
    }
  }
  get state() { const s = G.state; return s.hubs || (s.hubs = { runs: 0, best: 0, seen: {} }); }
  byId(id) { return this.list.find((h) => h.id === id); }
  label(h) {
    const r = this.run;
    if (r && r.to === h.id) return `Hand over the ${r.dish} to ${h.keeper.name.split(' ')[0]}`;
    return `${h.name} kiosk: food and food runs`;
  }
  use(h) {
    const r = this.run;
    if (r && r.to === h.id) return this.deliver(h);
    if (!open()) return G.ui.openMenu({ title: `${h.name} kiosk`, who: `${h.keeper.name} · ${h.quarter}`, body: 'The shutters are down. The kiosk opens at 07:00 and closes at 22:00.', options: [...(r ? [{ label: 'Drop the food run you are carrying', onPick: () => this.drop() }] : []), { label: 'Close', onPick: () => {} }] });
    const p = G.player, E = G.economy, opts = [];
    for (const it of h.menu) opts.push({ label: it.name, desc: `+${it.energy}% energy`, price: it.price, onPick: () => { if (E.spend(it.price, it.name)) { p.energy = Math.min(100, p.energy + it.energy); G.ui.toast(`${it.name}. ${it.say}`, 'good'); if (p.play) p.play('snack', 2.4); } } });
    if (!r) for (const o of this.list) {
      if (o === h) continue;
      const len = this.lenTo(o), base = this.base(len), limit = this.limit(len);
      opts.push({ label: `Food run to ${o.name}`, desc: `${h.dish} for ${o.keeper.name} in ${o.quarter}, ${fmt(len)} away. ◈${base}, plus a tip if it is still hot (${limit} s).`, onPick: () => this.start(h, o) });
    } else opts.push({ label: 'Drop the food run you are carrying', desc: `The ${r.dish} for ${this.byId(r.to).name}. Nobody pays for it.`, onPick: () => this.drop() });
    opts.push({ label: 'Close', onPick: () => {} });
    G.ui.openMenu({ title: `${h.name} kiosk`, who: `${h.keeper.name} · ${h.quarter}`, wide: true, body: `Your energy is at ${Math.round(p.energy)}%. ${this.state.runs ? `You have run ${this.state.runs} order${this.state.runs === 1 ? '' : 's'} between the squares.` : 'The keepers send food to each other\'s squares all day and pay whoever carries it.'}`, options: opts });
  }
  // distance along the streets from the player to a square's counter (straight line if there is no route)
  lenTo(o) { const p = G.player.pos; return Math.hypot(o.counter.x - p.x, o.counter.z - p.z) * 1.25; }   // about the walk along the streets
  base(len) { return Math.round(14 + len * 0.035); }
  limit(len) { return Math.round(30 + len / 5); }
  start(from, to) {
    const len = this.lenTo(to); G.metro.setRoute(to.counter.x, to.counter.z, G.player.pos);   // pay and time as quoted on the menu; the route is a guide
    this.run = { from: from.id, to: to.id, dish: from.dish, len, base: this.base(len), limit: this.limit(len), left: this.limit(len), cold: false, take: true };
    G.ui.toast(`${from.keeper.name.split(' ')[0]} hands you a hot bag of ${from.dish}. Take it to ${to.keeper.name} at ${to.name}, ${fmt(len)} away. The route is on your map.`, 'good');
    if (G.audio) G.audio.blip(620, 0.08);
  }
  drop() { this.run = null; G.metro.route = null; this.objective(null); G.ui.toast('You hand the bag back. No harm done.', 'info'); }
  deliver(h) {
    const r = this.run, S = this.state, took = r.limit - r.left;
    const tip = r.left > 0 ? Math.round(r.base * (0.4 + 0.8 * (r.left / r.limit))) : 0;
    this.run = null; G.metro.route = null; this.objective(null);
    S.runs++; if (r.left > 0 && (!S.best || took < S.best)) S.best = Math.round(took);
    G.economy.earn(r.base + tip, tip ? `food run, with a ◈${tip} tip` : 'food run');
    const line = tip ? (r.left > r.limit * 0.5 ? 'Still steaming. You flew, didn\'t you?' : 'Still warm. Thank you!') : 'Cold, but it is the thought that counts. Here.';
    const k = G.npcs && G.npcs.list.find((n) => n.id === `${h.id}:keeper`);
    if (k && !k.inside) G.ui.say(k, line, 3.2); else G.ui.toast(`${h.keeper.name}: "${line}"`, 'info');
    if (G.audio) G.audio.ui('pay');
  }
  // the objective panel: a run takes it from the story's standing objective when it starts (the story
  // waits while another activity shows something), and gives way to minigames that set it themselves
  objective(o, take = false) {
    const el = document.getElementById('objective'), ours = el && el.style.display === 'block' && document.getElementById('obj-h').textContent === 'Hot food run';
    if (!o) { if (ours || this.objShown) G.ui.setObjective(null); this.objShown = false; return; }
    if (!take && el && el.style.display === 'block' && !ours) return;     // another activity is using the panel
    G.ui.setObjective(o); this.objShown = true;
  }
  markers() { const r = this.run; if (!r) return []; const to = this.byId(r.to); return [{ x: to.counter.x, z: to.counter.z, color: to.color }]; }
  update(dt) {
    const p = G.player.pos, cam = G.camera.position;
    for (const s of this.signs) s.g.visible = (cam.x - s.h.cx) ** 2 + (cam.z - s.h.cz) ** 2 < 420 * 420;
    // walking into a square
    const here = this.list.find((h) => Math.abs(p.x - h.cx) < 46 && Math.abs(p.z - h.cz) < 46 && p.y < h.y + 30) || null;
    if (here !== this.inside) {
      this.inside = here;
      if (here && G.started && !G.minigame) {
        const S = this.state;
        if (!S.seen[here.id]) { S.seen[here.id] = true; G.ui.flash(here.name.toUpperCase(), 2.2); G.ui.toast(`${here.name}, ${here.quarter}. Food at the kiosk on the east side, and food runs to the other Midtown squares.`, 'info'); }
      }
    }
    // the run: the clock, the panel, a warning when it goes cold
    const r = this.run; if (!r) return;
    r.left -= dt;
    if (r.left <= 0 && !r.cold) { r.cold = true; G.ui.toast(`The ${r.dish} has gone cold. ${this.byId(r.to).keeper.name.split(' ')[0]} will still pay, without a tip.`, 'warn'); }
    if (G.minigame || G.ui.menu) return;
    this.objective(this.panel(), r.take); r.take = false;
  }
  panel() {
    const r = this.run, to = this.byId(r.to), p = G.player.pos, d = Math.hypot(to.counter.x - p.x, to.counter.z - p.z);
    return { title: 'Hot food run', text: `${r.dish[0].toUpperCase() + r.dish.slice(1)} for ${to.keeper.name} at ${to.name} · ${fmt(d)}`, sub: r.left > 0 ? `${Math.ceil(r.left)} s before it goes cold` : 'Gone cold: no tip now' };
  }
}
