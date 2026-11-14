// Things to do with street furniture in the new parts of the city: sit on benches, buy from
// vending machines and food trucks, read the bus displays, toss a coin in a fountain, run
// parcels between lockers, and clean up litter for the city.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { RNG } from '../core/util.js';
import { blockOf } from '../world/metro/landuse.js';

const KINDS = { bench: 1, vend: 1, truck: 1, fountain: 1, locker: 1, bin: 1, shelter: 1, lounger: 1 };
const TRUCK = [{ name: 'Bao box', price: 12, energy: 30 }, { name: 'Noodle cup', price: 9, energy: 22 }, { name: 'Iced yuzu tea', price: 4, energy: 8 }];
const WISHES = ['You wish for clear skies. The forecast does not answer.', 'The coin flashes once and is gone.', 'Somewhere a pump hums a little louder.', 'A child nearby asks what you wished for. You keep it to yourself.'];
const fmt = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

export class Street {
  constructor() {
    this.area = null; this.areaT = 0; this.told = null; this.toldT = 0;
    this.near = null; this.t = 0; this.pos = new THREE.Vector3(); this.rng = new RNG(606); this.clean = null; this.parcel = null; this.wishT = 0;
    G.interact.add({ pos: this.pos, r: 2.7, prio: -0.3, label: () => this.label(), enabled: () => !!this.near && !!this.label(), use: () => this.use() });
    this.litter = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.1, 0.22), new THREE.MeshBasicMaterial({ color: new THREE.Color('#7dff9c').multiplyScalar(1.2) }), 10);
    this.litter.frustumCulled = false; this.litter.visible = false; G.scene.add(this.litter); this.m4 = new THREE.Matrix4();
  }
  // nearest usable prop within reach, from the layout of the block the player stands in
  scan() {
    const p = G.player.pos, b = G.metro.block(blockOf(p.x), blockOf(p.z)); let best = null, bd = 2.7 * 2.7;
    if (b && p.y < b.y0 + 2) for (const q of b.props) { if (!KINDS[q[0]]) continue; const d = (q[1] - p.x) ** 2 + (q[2] - p.z) ** 2, r = q[0] === 'fountain' ? 20 : q[0] === 'shelter' || q[0] === 'locker' || q[0] === 'truck' ? 12 : bd; if (d < r && (!best || d < bd)) { best = q; bd = d; } }
    // the shelters at the bus stops are not block furniture: look them up separately
    if (!best) for (const l of G.metro.bus.lines) for (const st of l.stops) if ((st.x - p.x) ** 2 + (st.z - p.z) ** 2 < 14) best = ['shelter', st.x, st.z, 0];
    this.near = best ? { type: best[0], x: best[1], z: best[2], yaw: best[3], y: (b ? b.y0 : 0) + (best[5] || 0) } : null;
    if (best) this.pos.set(best[1], this.near.y, best[2]);
  }
  label() {
    const n = this.near; if (!n) return null;
    if (n.type === 'bench') return 'Sit on the bench';
    if (n.type === 'lounger') return 'Sit on the lounger';
    if (n.type === 'vend') return 'Vending machine';
    if (n.type === 'truck') return 'Order at the food truck';
    if (n.type === 'fountain') return this.wishT > 0 ? null : 'Toss a coin in the fountain';
    if (n.type === 'shelter') return 'Bus information';
    if (n.type === 'locker') return this.parcel ? (this.atTarget() ? 'Deliver the parcel' : null) : 'Parcel locker: take a delivery';
    if (n.type === 'bin') return this.clean ? (this.clean.bag > 0 ? `Empty your litter bag (${this.clean.bag})` : null) : 'Start a street clean-up';
    return null;
  }
  atTarget() { const n = this.near, q = this.parcel; return q && Math.hypot(n.x - q.x, n.z - q.z) < 3; }
  use() {
    const n = this.near, p = G.player, E = G.economy;
    if (n.type === 'lounger') p.sit({ kind: 'bench', x: n.x, y: n.y + 0.4, z: n.z, yaw: n.yaw, taken: null });
    else if (n.type === 'bench') { p.sit({ kind: 'bench', x: n.x, y: n.y + 0.5, z: n.z, yaw: n.yaw, taken: null }); if (!G.state.street.sat) { G.state.street.sat = true; G.ui.toast('A good place to watch the street go by. Space to stand up.', 'info'); } }
    else if (n.type === 'vend') G.food.vending();
    else if (n.type === 'truck') G.ui.openMenu({ title: 'Food truck', who: 'Hot food, cash on the lens', body: `Your energy is at ${Math.round(p.energy)}%.`, options: [...TRUCK.map((it) => ({ label: it.name, desc: `+${it.energy} energy`, price: it.price, onPick: () => { if (E.spend(it.price, it.name)) { p.energy = Math.min(100, p.energy + it.energy); G.ui.toast(`${it.name}: eaten standing up, as intended.`, 'good'); } } })), { label: 'Nothing today', onPick: () => {} }] });
    else if (n.type === 'fountain') { if (E.spend(1, 'a wish')) { this.wishT = 60; G.ui.toast(this.rng.pick(WISHES), 'info'); if (G.audio) G.audio.blip(980, 0.08); } }
    else if (n.type === 'shelter') this.busInfo();
    else if (n.type === 'locker') { if (this.parcel) this.deliver(); else this.takeParcel(); }
    else if (n.type === 'bin') { if (this.clean) this.empty(); else this.startClean(); }
  }
  // ---- buses ----------------------------------------------------------------------------------
  busInfo() {
    const p = G.player.pos, M = G.metro;
    const options = M.bus.lines.map((l) => {
      const k = l.stops.map((s, i) => [Math.hypot(s.x - p.x, s.z - p.z), i]).sort((a, b) => a[0] - b[0])[0], st = l.stops[k[1]], eta = M.bus.eta(l, k[1]);
      return { label: l.title, desc: `Nearest stop: ${st.name} (${st.area}), ${fmt(k[0])} away. Next bus in about ${eta < 20 ? 'a moment' : Math.ceil(eta / 60) + ' min'}. Free to ride.`, onPick: () => { if (k[0] < 30) G.ui.toast('This is the stop. The bus pulls in beside the shelter.', 'info'); else { M.setRoute(st.x, st.z, p); G.ui.toast(`Route to the ${l.id} stop set: ${fmt(M.route ? M.route.len : k[0])}.`, 'good'); } } };
    });
    G.ui.openMenu({ title: 'Avenue buses', who: 'Neo Central Transit', body: 'Three loop lines run day and night. Wait at a stop and press E when the bus is standing there.', options: [...options, { label: 'Close', onPick: () => {} }] });
  }
  // ---- parcels ----------------------------------------------------------------------------------
  takeParcel() {
    const p = G.player.pos, all = [];
    for (const b of G.metro.list) for (const q of b.props) if (q[0] === 'locker') { const d = Math.hypot(q[1] - p.x, q[2] - p.z); if (d > 280 && d < 1100) all.push({ x: q[1], z: q[2], y: b.y0, d }); }
    if (!all.length) return G.ui.toast('No deliveries waiting at this locker.', 'info');
    const to = this.rng.pick(all), rt = G.metro.setRoute(to.x, to.z, p), len = rt ? rt.len : to.d;
    this.parcel = { ...to, pay: Math.round(18 + len * 0.055) };
    G.ui.toast(`Parcel taken. Deliver it to the locker ${fmt(len)} away for ◈${this.parcel.pay}. The route is on your map.`, 'good'); if (G.audio) G.audio.blip(620, 0.08);
  }
  deliver() { const q = this.parcel; this.parcel = null; G.metro.route = null; G.state.street.parcels++; G.economy.earn(q.pay, 'parcel delivered'); if (G.audio) G.audio.ui('pay'); }
  // ---- litter -----------------------------------------------------------------------------------
  startClean() {
    const p = G.player.pos, spots = [], i0 = blockOf(p.x), j0 = blockOf(p.z);
    for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = i0 - 1; i <= i0 + 1; i++) { const b = G.metro.block(i, j); if (b && b.y0) for (const q of b.props) if (q[0] === 'lamp' || q[0] === 'bench' || q[0] === 'planter') spots.push({ x: q[1] + this.rng.range(-1.6, 1.6), y: b.y0, z: q[2] + this.rng.range(-1.6, 1.6), got: false }); }
    if (spots.length < 10) return G.ui.toast('These pavements are already clean.', 'info');
    const items = []; while (items.length < 10) { const k = this.rng.int(0, spots.length - 1); items.push(spots.splice(k, 1)[0]); }
    this.clean = { items, bag: 0, got: 0, paid: 0 }; this.showLitter();
    G.ui.toast('Street clean-up: ten pieces of litter are marked green on your map. Walk over them, then empty the bag into any bin.', 'good');
  }
  showLitter() {
    const c = this.clean; this.litter.visible = !!c; if (!c) return;
    c.items.forEach((it, k) => { if (it.got) this.m4.makeScale(0, 0, 0); else { this.m4.makeRotationY(k * 1.7); this.m4.setPosition(it.x, it.y + 0.06, it.z); } this.litter.setMatrixAt(k, this.m4); });
    this.litter.instanceMatrix.needsUpdate = true;
  }
  empty() {
    const c = this.clean, pay = c.bag * 5 + (c.got === 10 && c.paid + c.bag === 10 ? 15 : 0); c.paid += c.bag; G.state.street.litter += c.bag; c.bag = 0;
    G.economy.earn(pay, c.paid === 10 ? 'street clean-up finished, with a bonus' : 'litter binned');
    if (c.paid === 10) { this.clean = null; this.showLitter(); }
  }
  markers() {
    const out = [];
    if (this.clean) for (const it of this.clean.items) if (!it.got) out.push({ x: it.x, z: it.z, color: '#7dff9c' });
    if (this.parcel) out.push({ x: this.parcel.x, z: this.parcel.z, color: '#ffd34d' });
    return out;
  }
  update(dt) {
    const p = G.player; this.wishT -= dt;
    // say where you are when you come into a new part of the city (not more than once in a while)
    this.toldT -= dt; this.areaT -= dt;
    if (this.areaT <= 0 && G.started) {
      this.areaT = 1.5; const pos = p.state === 'drive' ? G.car.pos : p.pos, a = pos.y < 40 && !G.districts.at(pos) && Math.hypot(pos.x, pos.z) > 215 ? G.metro.areaAt(pos.x, pos.z) : null;
      if (a === this.area && a && a !== 'sea' && a !== this.told && this.toldT <= 0) { this.told = a; this.toldT = 12; G.ui.toast(a, 'info'); }
      this.area = a;
    }
    this.t -= dt; if (this.t <= 0) { this.t = 0.15; if (p.state === 'walk') this.scan(); else this.near = null; }
    const c = this.clean;
    if (c && p.state === 'walk') for (const it of c.items) if (!it.got && (it.x - p.pos.x) ** 2 + (it.z - p.pos.z) ** 2 < 2 && Math.abs(it.y - p.pos.y) < 1.5) { it.got = true; c.bag++; c.got++; this.showLitter(); if (G.audio) G.audio.blip(880, 0.05); G.ui.toast(c.got === 10 ? 'That is all ten. Find a bin.' : `Litter picked up: ${c.got} of 10.`, 'info'); }
  }
}
