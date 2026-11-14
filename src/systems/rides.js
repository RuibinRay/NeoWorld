// Being a passenger: the Meridian robo-bus, the Old Earth tram, and sky cabs that fly you
// between landing pads in real time. (The maglev has its own system in transit.js.)
import * as THREE from 'three';
import { G } from '../core/game.js';
import { clamp, damp, dampAngle } from '../core/util.js';
import { buildVehicle } from '../data/vehicles.js';
import { planRoute } from '../entities/aerocar.js';
import { money } from '../ui/ui.js';

export class Rides {
  constructor() {
    const I = G.interact, bus = G.traffic.bus, tram = G.districts.byId.oldearth.things.tram, v = new THREE.Vector3();
    // scheduled lines: where the vehicle is, which stop it is standing at (or -1), and the stops
    this.lines = [
      { name: 'robo-bus', title: 'Commons robo-bus', pos: bus.p, at: () => (bus.dwell > 0 ? bus.lastStop : -1), up: 1.2, stops: bus.stops.map((s, i) => { bus.path.sample(s, v); return { x: v.x, y: 0.15, z: v.z, name: ['Commons North', 'Commons South'][i] }; }) },
      { name: 'tram', title: 'Old Earth tram', pos: tram.g.position, at: () => tram.at, up: 1.0, stops: tram.spots.map((p, i) => ({ ...p, name: ['Hearth side', 'Museum side'][i] })) },
    ];
    // the avenue buses: every bus is boarded at the stops of its own loop
    for (const b of G.metro.bus.buses) this.lines.push({ name: 'bus', title: b.line.title, pos: b.p, at: () => b.at, up: 1.3, stops: b.line.stops, bus: b, sub: `Stops: ${b.line.stops.map((s) => s.area).filter((a, i, l) => l.indexOf(a) === i).join(' · ')}` });
    this.line = null;
    // the ground lift between the highway and the Skyhaven deck
    const lf = G.roads.lift;
    I.add({ pos: lf.ground, r: 7, yTol: 3, label: 'Sky lift up to Skyhaven', use: () => G.transit.lift(lf.deck, 0) });
    I.add({ pos: lf.deck, r: 2.4, yTol: 2, label: 'Sky lift down to the highway', use: () => G.transit.lift(lf.ground, 0) });
    for (const l of this.lines) l.stops.forEach((st, k) => {
      I.add({ pos: st, r: 7, yTol: 2.5, prio: -0.2, label: `Board the ${l.name}`, enabled: () => l.at() === k && !this.line, use: () => this.board(l) });
    });
    I.add({ mode: 'ride', pos: G.player.pos, r: 6, yTol: 12, label: () => `Get off at ${this.line.stops[this.line.at()].name}`, enabled: () => this.line && this.line.at() >= 0, use: () => this.alight() });
    // sky cab: one autonomous pod, hailed from any public pad
    const b = buildVehicle('halo', '#ffd34d'); b.g.visible = false; G.scene.add(b.g);
    this.cab = { g: b.g, pod: b.podMat, pos: b.g.position, phase: 'off', yaw: 0, v: 0, from: null, to: null, route: null, t: 0 };
    for (const pad of G.city.pads) {
      if (pad.priv && pad.id !== 'home' && pad.owner !== 'villa') continue;
      I.add({ pos: pad, r: Math.max(3, pad.r - 1.5), yTol: 2, prio: -0.4, label: 'Call a sky cab', enabled: () => this.cab.phase === 'off' && (!pad.priv || G.state.owns[pad.owner || 'apartment']) && Math.hypot(G.car.pos.x - pad.x, G.car.pos.z - pad.z) > pad.r + 2, use: () => this.cabMenu(pad) });
    }
  }
  // ---- bus and tram -------------------------------------------------------------------------
  board(l) {
    const p = G.player; p.state = 'ride'; p.board = false; p.jet = false; p.firstPerson = false; p.crouch = false; p.vel.set(0, 0, 0); this.line = l;
    G.ui.toast(`${l.title}: doors closing. It is free to ride.`, 'info'); if (G.audio) G.audio.blip(520, 0.1);
  }
  alight() {
    const l = this.line, st = l.stops[l.at()], p = G.player; this.line = null;
    p.pos.set(st.x, st.y, st.z); G.colliders.resolveCircle(p.pos, 0.4, st.y + 0.5, st.y + 1.7); p.vel.set(0, 0, 0); p.state = 'walk'; p.grounded = true;
    if (G.dog.active) G.dog.pos.set(st.x + 0.8, st.y, st.z + 0.6);
    G.ui.setObjective(null);
  }
  // ---- sky cab ------------------------------------------------------------------------------
  fare(a, b) { return Math.round(16 + Math.hypot(a.x - b.x, a.z - b.z) * 0.045 + Math.abs(a.y - b.y) * 0.03); }
  cabMenu(from) {
    const pads = G.city.pads.filter((q) => q !== from && q.id !== 'sky4' && (!q.priv || G.state.owns[q.owner || 'apartment'])).map((q) => ({ q, d: Math.hypot(q.x - from.x, q.z - from.z) })).sort((a, b) => a.d - b.d);
    G.ui.openMenu({ title: 'Sky cab', who: 'Autonomous pod · pay on boarding', body: 'A cab lands here, takes you aboard and flies you to the pad you choose. Sit back and look out.',
      options: [...pads.slice(0, 8).map(({ q, d }) => ({ label: q.name, desc: `${Math.round(d)} m · pad at ${Math.round(q.y)} m`, price: this.fare(from, q), onPick: () => this.hail(from, q) })), ...(pads.length > 8 ? [{ label: 'More destinations', onPick: () => G.ui.openMenu({ title: 'Sky cab', who: 'Further away', options: [...pads.slice(8).map(({ q, d }) => ({ label: q.name, desc: `${Math.round(d)} m · pad at ${Math.round(q.y)} m`, price: this.fare(from, q), onPick: () => this.hail(from, q) })), { label: 'Never mind', onPick: () => {} }] }) }] : []), { label: 'Never mind', onPick: () => {} }] });
  }
  hail(from, to) {
    if (!G.economy.spend(this.fare(from, to), `sky cab to ${to.name}`)) return;
    const c = this.cab; c.from = from; c.to = to; c.phase = 'arrive'; c.t = 0; c.v = 0; c.yaw = 0;
    c.pos.set(from.x, from.y + 46, from.z); c.g.visible = true; c.g.rotation.set(0, 0, 0);
    G.ui.toast('A cab is on its way down. Stay on the pad.', 'info');
  }
  updateCab(dt) {
    const c = this.cab, p = G.player, pos = c.pos; if (c.phase === 'off') return;
    c.t += dt; c.pod.color.setRGB(0.5, 1.2, 1.4);
    const land = (pad, rate) => { const floor = pad.y + 0.9, alt = pos.y - floor; pos.y = Math.max(floor, pos.y - Math.min(rate, 1.2 + alt * 1.4) * dt); return pos.y <= floor + 0.01; };
    if (c.phase === 'arrive') {
      if (land(c.from, 12)) {
        const near = p.state === 'walk' && Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z) < c.from.r + 4 && Math.abs(p.pos.y - c.from.y) < 3;
        if (near) {
          p.state = 'ride'; p.board = false; p.jet = false; p.firstPerson = false; p.crouch = false; p.vel.set(0, 0, 0);
          c.route = planRoute(pos.x, pos.y, pos.z, c.to, 40, 9); c.phase = 'climb'; if (G.audio) G.audio.blip(660, 0.08);
        } else if (c.t > 25) { c.phase = 'leave'; G.ui.toast('The cab left without you. Fares are not refunded.', 'warn'); }
      }
    } else if (c.phase === 'climb') {
      pos.y = Math.min(c.route.y, pos.y + 9.5 * dt); const tg = c.route.via || c.to; c.yaw = dampAngle(c.yaw, Math.atan2(tg.x - pos.x, tg.z - pos.z), 2.5, dt);
      if (pos.y >= c.route.y - 0.05) c.phase = 'cruise';
    } else if (c.phase === 'cruise') {
      const tg = c.route.via || c.to, dx = tg.x - pos.x, dz = tg.z - pos.z, d = Math.hypot(dx, dz);
      c.yaw = dampAngle(c.yaw, Math.atan2(dx, dz), 2.2, dt); c.v = damp(c.v, c.route.via ? 42 : clamp(d * 0.6, 2.5, 42), 1.2, dt);
      pos.x += Math.sin(c.yaw) * c.v * dt; pos.z += Math.cos(c.yaw) * c.v * dt;
      if (c.route.via) { if (d < 45) c.route.via = null; } else if (d < 1.2) { pos.x = tg.x; pos.z = tg.z; c.phase = 'descend'; }
    } else if (c.phase === 'descend') {
      if (land(c.to, 11)) {
        const t = c.to; p.pos.set(t.x + t.r - 1.2, t.y + 0.05, t.z + 1.2); p.vel.set(0, 0, 0); p.state = 'walk'; p.grounded = true; p.yaw = p.camYaw = Math.PI / 2;
        if (G.dog.active) G.dog.pos.set(p.pos.x + 0.7, t.y, p.pos.z + 0.6);
        G.ui.setObjective(null); G.ui.toast(`Arrived: ${t.name}.`, 'good'); c.phase = 'leave'; c.t = 0;
      }
    } else if (c.phase === 'leave') { if (c.t > 1.5) pos.y += 14 * dt; if (c.t > 6) { c.phase = 'off'; c.g.visible = false; } }
    c.g.rotation.y = c.yaw;
    if (c.phase === 'climb' || c.phase === 'cruise' || c.phase === 'descend') {
      p.pos.set(pos.x, pos.y - 0.5, pos.z);
      const d = Math.hypot(c.to.x - pos.x, c.to.z - pos.z);
      G.ui.setObjective({ title: 'Sky cab', text: `To ${c.to.name}`, sub: `${Math.round(d)} m to go · ${Math.round(c.v * 3.6)} km/h · ${Math.round(pos.y)} m up` });
    }
  }
  get riding() { return !!this.line || ['climb', 'cruise', 'descend'].includes(this.cab.phase); }
  // where to put the player if the game is saved mid-ride (null when not riding with us)
  safeSpot() {
    if (this.line) { const k = Math.max(0, this.line.at()); return this.line.stops[k]; }
    if (this.riding) return { x: this.cab.to.x + this.cab.to.r - 1.2, y: this.cab.to.y + 0.05, z: this.cab.to.z + 1.2 };
    return null;
  }
  update(dt) {
    const l = this.line;
    if (l) {
      G.player.pos.set(l.pos.x, l.pos.y + l.up, l.pos.z);
      const k = l.at(); G.ui.setObjective({ title: l.title, text: k >= 0 ? `At ${l.stops[k].name}` : 'Moving', sub: k >= 0 ? 'Press E to get off, or stay on.' : l.sub || 'It stops twice on its loop.' });
    }
    this.updateCab(dt);
  }
}
