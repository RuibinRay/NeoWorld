// Vehicle exchange at the Skyport: buy other vehicle classes, switch between the ones you
// own, and tune them. The models you can buy stand on the apron as a showroom.
// Several vehicles can be out at once: the one you drive is G.car; the others stand parked where
// you left them (state.garage.out) and any of them can be taken from there.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { MODELS, ORDER, buildVehicle, statLine } from '../data/vehicles.js';
import { labelTexture } from '../world/materials.js';

const TUNES = [['thr', 'Thrusters', 'More acceleration and top speed'], ['bat', 'Cells', 'Longer range per charge'], ['hull', 'Hull plating', 'Takes less damage']];

export class Garage {
  constructor() {
    ORDER.slice(1).forEach((id, k) => {
      const m = MODELS[id], b = buildVehicle(id, m.paint), x = -136, z = -33 + k * 22;
      b.g.position.set(x, 0.15 + m.ride, z); b.g.rotation.y = Math.PI / 2; G.scene.add(b.g);
      G.colliders.box(x - 2.7, x + 2.7, 0.15, 1.9, z - m.R * 0.75, z + m.R * 0.75);
      const lab = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), new THREE.MeshBasicMaterial({ map: labelTexture(m.name.toUpperCase(), { size: 58, color: '#cfefff', sub: `${m.kind} · ◈${m.price.toLocaleString('en-US')}` }), transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      lab.position.set(x, 3.4 + m.ride, z); lab.rotation.y = Math.PI / 2; G.scene.add(lab);
      G.interact.add({ pos: { x: x + 4.2, y: 0.15, z }, r: 2.4, label: `Vehicle exchange: the ${m.name}`, use: () => this.menu() });
    });
  }
  get st() { return G.state.garage; }
  // ---- vehicles parked out ------------------------------------------------------------------
  park(id, x, y, z, yaw) {
    const g = this.st, m = MODELS[id], b = buildVehicle(id, g.paint[id] || m.paint), r = m.R * 0.72;
    b.g.position.set(x, y, z); b.g.rotation.y = yaw; G.scene.add(b.g);
    const e = { id, x, y, z, yaw, g: b.g };
    e.box = G.colliders.box(x - r, x + r, y - m.ride, y - m.ride + 1.5, z - r, z + r, { noCam: true });
    e.it = G.interact.add({ pos: { x, y: y - m.ride, z }, r: m.R + 1.6, yTol: 2, prio: -0.1, label: `Take the ${m.name}`, enabled: () => !G.minigame, use: () => this.take(e) });
    (this.parked = this.parked || []).push(e); this.keep(); return e;
  }
  unpark(e) { e.g.removeFromParent(); e.box.enabled = false; G.interact.remove(e.it); this.parked.splice(this.parked.indexOf(e), 1); this.keep(); }
  keep() { this.st.out = (this.parked || []).map(({ id, x, y, z, yaw }) => ({ id, x, y, z, yaw })); }
  // the vehicle you have out stays where it is, and the one you chose becomes the one you drive
  take(e) {
    const g = this.st, car = G.car; if (car.occupied || G.player.state !== 'walk') return;
    this.leave(); this.unpark(e);
    g.active = e.id; car.setModel(e.id); car.setPaint(g.paint[e.id] || MODELS[e.id].paint);
    const c = g.cond[e.id] || { b: 100, h: 100 }; car.battery = c.b; car.hull = c.h;
    car.pos.set(e.x, e.y, e.z); car.yaw = e.yaw; car.vel.set(0, 0, 0); car.mode = 'parked';
    car.board(G.player); G.ui.setHelp(); G.save.write(true);
  }
  // put the vehicle you have out down as a parked one, where it stands
  leave() {
    const g = this.st, car = G.car;
    car.auto = null; car.mode = 'parked'; car.vel.set(0, 0, 0); g.cond[g.active] = { b: car.battery, h: car.hull };
    const y = G.colliders.groundAt(car.pos.x, car.pos.z, car.pos.y + 1, 0.6, 1.3) + car.ride;
    this.park(g.active, car.pos.x, y, car.pos.z, car.yaw);
  }
  // a free place next to the vehicle you have out, for another to be rolled out to
  spotBeside(id) {
    const car = G.car, col = G.colliders, m = MODELS[id], gy = G.colliders.groundAt(car.pos.x, car.pos.z, car.pos.y + 1, 0.6, 1.3), q = { x: 0, z: 0 };
    const rx = Math.cos(car.yaw), rz = -Math.sin(car.yaw), fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
    for (const [s, f] of [[1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [-2, 0]]) {
      const d = car.R + m.R + 1.2, x = car.pos.x + rx * s * d + fx * f * 7, z = car.pos.z + rz * s * d + fz * f * 7, y = col.groundAt(x, z, gy + 0.6, 0.6, m.R * 0.7);
      if (Math.abs(y - gy) > 0.4 || (G.districts && G.districts.waterAt(x, z, y))) continue;
      q.x = x; q.z = z; if (col.resolveCircle(q, m.R * 0.75, y + 0.3, y + 2)) continue;
      if ((this.parked || []).some((e) => Math.hypot(e.x - x, e.z - z) < MODELS[e.id].R + m.R + 0.5)) continue;
      return { x, y: y + m.ride, z };
    }
    return null;
  }
  // after a save is loaded: the parked vehicles stand where they were left
  syncParked() {
    for (const e of [...(this.parked || [])]) this.unpark(e);
    const g = this.st, seen = new Set([g.active]), list = Array.isArray(g.out) ? g.out : [];
    for (const o of list) if (o && MODELS[o.id] && g.owned.includes(o.id) && !seen.has(o.id) && [o.x, o.y, o.z, o.yaw].every(Number.isFinite)) { seen.add(o.id); this.park(o.id, o.x, o.y, o.z, o.yaw); }
    this.keep();
  }
  // parked at the Meridian Skyport or on the Aeroport apron
  atPort() { const c = G.car, A = G.districts.byId.aeroport; return c.mode === 'parked' && G.player.state !== 'drive' && c.pos.y < 4 && ((c.pos.x > -172 && c.pos.x < -68 && Math.abs(c.pos.z) < 52) || (Math.abs(c.pos.x - A.x) < 186 && Math.abs(c.pos.z - A.z) < 186)); }
  // after a save is loaded
  sync() { const g = this.st, car = G.car; if (car.model !== g.active) car.setModel(g.active); if (g.paint[g.active]) car.setPaint(g.paint[g.active]); this.syncParked(); }
  // Switching rolls the other vehicle out beside the one you have, which stays parked where it is
  // (if there is no room, it goes back to the depot as before). One parked elsewhere is brought here.
  switchTo(id) {
    const g = this.st, car = G.car, was = car.spec.name, away = (this.parked || []).find((e) => e.id === id);
    if (away) this.unpark(away);
    const spot = this.spotBeside(id);
    if (spot) this.leave(); else g.cond[g.active] = { b: car.battery, h: car.hull };
    g.active = id; car.setModel(id); if (g.paint[id]) car.setPaint(g.paint[id]);
    const c = g.cond[id] || { b: 100, h: 100 }; car.battery = c.b; car.hull = c.h; car.vel.set(0, 0, 0); car.mode = 'parked';
    if (spot) car.pos.set(spot.x, spot.y, spot.z);
    else car.pos.y = G.colliders.groundAt(car.pos.x, car.pos.z, car.pos.y + 1, 0.6, 1.3) + car.ride;
    G.ui.toast(spot ? `The ${car.spec.name} is rolled out next to the ${was}, which stays parked here. Walk up to either to take it.` : `The ${car.spec.name} is rolled out and waiting.`, 'good'); G.save.write(true);
  }
  menu() {
    const g = this.st, car = G.car, port = this.atPort();
    const opts = ORDER.map((id) => {
      const m = MODELS[id], own = g.owned.includes(id), act = g.active === id;
      const out = (this.parked || []).some((e) => e.id === id);
      if (own) return { label: act ? `${m.name} · in use` : out ? `Bring the ${m.name} here` : `Switch to the ${m.name}`, desc: `${m.kind}. ${out ? 'It is parked where you left it; this brings it back here. ' : ''}${statLine(m)}`, disabled: act || !port, why: act ? 'That is the vehicle you have out.' : 'Park your current vehicle at the Skyport or the Aeroport and step out first. The valet (Tab) can bring it.', onPick: () => this.switchTo(id) };
      return { label: `Buy the ${m.name}`, desc: `${m.kind}. ${m.desc} ${statLine(m)}`, price: m.price, onPick: () => {
        if (!G.economy.spend(m.price, m.name)) return;
        g.owned.push(id); G.ui.flash(`${m.name.toUpperCase()} DELIVERED`, 2.5);
        if (port) this.switchTo(id); else { G.ui.toast(`The ${m.name} is in your garage. Switch to it here once your current vehicle is parked at the Skyport.`, 'good'); G.save.write(true); }
      } };
    });
    opts.push({ label: `Tune the ${car.spec.name}`, desc: 'Thrusters, cells, hull plating', onPick: () => this.tuneMenu() });
    if ((this.parked || []).length) opts.push({ label: `Return the parked vehicles to the depot (${this.parked.length})`, desc: 'They keep their charge and condition', onPick: () => { for (const e of [...this.parked]) this.unpark(e); G.ui.toast('Parked vehicles returned to the depot.', 'info'); G.save.write(true); } });
    opts.push({ label: 'Close', onPick: () => {} });
    G.ui.openMenu({ title: 'Vehicle exchange', who: 'Meridian Skyport · your garage', wide: true, options: opts,
      body: `You have the ${car.spec.name} out${(this.parked || []).length ? `, and ${this.parked.length} more parked round the city` : ''}. You own ${g.owned.length} of ${ORDER.length} models. Switching is free: the one you have stays parked where it is, and each keeps its charge and condition.` });
  }
  tuneMenu() {
    const g = this.st, car = G.car, t = (g.tune[car.model] = g.tune[car.model] || { thr: 0, bat: 0, hull: 0 });
    G.ui.openMenu({ title: `Tuning: ${car.spec.name}`, who: 'Three stages per system', body: 'Each stage is fitted on the spot. Thrusters add about 6% speed, cells 12% range, plating 18% less damage.', options: [
      ...TUNES.map(([k, name, desc]) => ({ label: `${name}: stage ${t[k]} of 3`, desc, price: t[k] < 3 ? 600 * (t[k] + 1) : undefined, disabled: t[k] >= 3, why: 'Fully tuned.', onPick: () => { if (G.economy.spend(600 * (t[k] + 1), `${name.toLowerCase()} stage ${t[k] + 1}`)) { t[k]++; G.save.write(true); } this.tuneMenu(); } })),
      { label: 'Done', onPick: () => {} }] });
  }
}
