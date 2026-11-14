// Eating in 2226. Printed Petal: order, watch the bioprinter build the dish layer by layer,
// a serving drone carries it to your table, sit and eat. Also the NutriMat vending kiosk
// (reads your lens and suggests), and hand-folded dumplings from the cart.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { std, neon } from '../world/materials.js';
import { makeServer, makeDrone } from '../entities/rigs.js';
import { money } from '../ui/ui.js';
import { clamp, smooth } from '../core/util.js';

export const MENU = [
  { id: 'wagyu', name: 'Lattice Wagyu', desc: 'Cultivated beef. The marbling is printed strand by strand, then seared by laser.', price: 58, energy: 55 },
  { id: 'ramen', name: 'Kelp-Pearl Ramen', desc: 'Sea-farm noodles in broth pearls that burst at body temperature.', price: 26, energy: 40 },
  { id: 'katsu', name: 'Mycelium Katsu', desc: 'Grown in a day from fungal root. Crisp shell, fibrous bite.', price: 22, energy: 36 },
  { id: 'bento', name: 'Biometric Bento', desc: 'Six cells balanced to your lens readings right now. Never the same twice.', price: 34, energy: 60 },
  { id: 'garden', name: 'Wall Garden Plate', desc: 'Leaves cut from the hydroponic wall behind you, ninety seconds ago.', price: 18, energy: 28 },
  { id: 'cloud', name: 'Aerogel Meringue Cloud', desc: 'A dessert that weighs four grams and tastes of yuzu.', price: 14, energy: 12 },
];
const VEND = [
  { name: 'Kelp-oat bar', price: 6, energy: 14 }, { name: 'Citrus electrolyte gel', price: 5, energy: 9 }, { name: 'Protein mochi', price: 8, energy: 18 },
];

// Low-poly dish models. `food` is the part the printer builds up.
export function makeDish(id) {
  const g = new THREE.Group(), food = new THREE.Group(); g.add(food);
  const add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, parent = food) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; parent.add(m); return m; };
  const box = new THREE.BoxGeometry(1, 1, 1), sph = new THREE.SphereGeometry(1, 10, 8);
  add(new THREE.CylinderGeometry(0.15, 0.11, 0.02, 18), std('#f3f5f8', 0.3, 0.2), 0, 0.01, 0, 1, 1, 1, g);
  if (id === 'wagyu') { add(box, std('#7a2a22', 0.6, 0), 0, 0.045, 0, 0.17, 0.04, 0.1); for (let i = -2; i <= 2; i++) add(box, std('#f1d6c9', 0.6, 0), i * 0.03, 0.067, 0, 0.008, 0.004, 0.09); add(sph, std('#6fae5f', 0.8, 0), 0.09, 0.04, 0.06, 0.025, 0.02, 0.025); }
  else if (id === 'ramen') { add(new THREE.SphereGeometry(0.11, 14, 8, 0, 6.3, Math.PI / 2, Math.PI / 2), std('#20262f', 0.4, 0.3), 0, 0.12, 0); add(new THREE.TorusGeometry(0.06, 0.014, 6, 14), std('#e8cf7a', 0.7, 0), 0, 0.1, 0).rotation.x = Math.PI / 2; for (let i = 0; i < 5; i++) add(sph, neon('#7dffb0', 0.9), Math.cos(i * 1.3) * 0.045, 0.115, Math.sin(i * 1.3) * 0.045, 0.014, 0.014, 0.014); }
  else if (id === 'katsu') { add(box, std('#c98b3a', 0.8, 0), -0.01, 0.045, 0, 0.17, 0.035, 0.085); add(box, std('#f0e2c2', 0.8, 0), -0.01, 0.047, 0, 0.172, 0.02, 0.06); add(sph, std('#7fbf7a', 0.9, 0), 0.07, 0.045, 0.07, 0.04, 0.025, 0.035); }
  else if (id === 'bento') { add(box, std('#15171c', 0.4, 0.3), 0, 0.035, 0, 0.21, 0.04, 0.15); ['#e06b5a', '#f0d36a', '#7fbf7a', '#f3f1e6', '#8a5fc9', '#e89a4a'].forEach((c, i) => add(box, std(c, 0.8, 0), -0.066 + (i % 3) * 0.066, 0.06, i < 3 ? -0.035 : 0.035, 0.056, 0.02, 0.06)); }
  else if (id === 'garden') { for (let i = 0; i < 7; i++) add(new THREE.IcosahedronGeometry(0.035, 0), std(i % 3 ? '#4f9e5d' : '#a7d36b', 0.9, 0, { flatShading: true }), Math.cos(i * 0.9) * 0.06, 0.05 + (i % 2) * 0.02, Math.sin(i * 0.9) * 0.06); add(sph, std('#d94a4a', 0.6, 0), 0, 0.06, 0, 0.02, 0.02, 0.02); }
  else { for (let i = 0; i < 5; i++) add(sph, std('#fbfbf6', 0.95, 0), Math.cos(i * 1.26) * 0.04, 0.06 + (i % 2) * 0.03, Math.sin(i * 1.26) * 0.04, 0.045, 0.04, 0.045); add(sph, std('#f2d24a', 0.6, 0), 0, 0.12, 0, 0.012, 0.012, 0.012); }
  return { g, food };
}

export class Food {
  constructor() {
    const R = (this.R = G.city.places.restaurant), I = G.interact;
    this.order = null; this.ambient = null; this.delivery = null;
    this.courier = makeDrone('delivery'); this.courier.root.visible = false; G.scene.add(this.courier.root); this.roof = new THREE.Vector3(30, 23.4, -96);
    this.server = makeServer(); this.dock = new THREE.Vector3(24, 3.2, -96.2); this.server.root.position.copy(this.dock); G.scene.add(this.server.root);
    I.add({ pos: R.passPoint, r: 1.6, label: 'Order at the pass', enabled: () => !this.order, use: () => this.openMenu() });
    I.add({ pos: G.city.places.vending, r: 1.6, label: 'NutriMat vending', use: () => this.vending() });
    I.add({ mode: 'sit', pos: G.player.pos, r: 3, yTol: 3, label: () => `Eat: ${this.order.item.name}`, enabled: () => this.order && this.order.state === 'served' && G.player.seat === this.order.seat, use: () => this.bite() });
  }
  get open() { return this.R.door.isOpenHours; }

  openMenu() {
    if (!this.open) return G.ui.toast('The kitchen is closed: printers are in their sterilization cycle until 07:00.', 'info');
    if (this.order) return G.ui.toast('Your order is already on its way.', 'info');
    const e = G.player.energy, rec = e < 35 ? 'Biometric Bento' : e < 65 ? 'Kelp-Pearl Ramen' : 'Aerogel Meringue Cloud';
    G.ui.openMenu({
      title: 'Printed Petal', who: 'Bioprint kitchen · printed to order', wide: true,
      body: `Your lens reports energy at ${Math.round(e)}%. The kitchen suggests the ${rec}. Everything is assembled by the printers behind the pass and finished by hand.`,
      options: [...MENU.map((it) => ({ label: it.name, desc: `${it.desc}  (+${it.energy}% energy)`, price: it.price, onPick: () => this.place(it) })), { label: 'Not right now', onPick: () => {} }],
    });
  }
  place(item) {
    if (!G.economy.spend(item.price, item.name)) return;
    const pr = this.R.printers[1], d = makeDish(item.id);
    d.g.position.set(pr.x, pr.plateY, pr.z); d.food.scale.y = 0.01; G.scene.add(d.g);
    this.order = { item, state: 'printing', t: 0, dish: d, seat: null, bites: 0, wait: 0 };
    G.ui.setObjective({ title: 'Printed Petal', text: `${item.name} is printing`, sub: 'Take any seat. A serving drone will bring it over.' });
    const host = G.npcs.byId.get('host'); if (host && host.isNear) G.ui.say(host, 'Printing now. Please, sit anywhere.');
    if (G.audio) G.audio.blip(620, 0.08);
  }
  ambientPrint() { if (!this.ambient) this.ambient = { pr: this.R.printers[Math.random() < 0.5 ? 0 : 2], t: 0 }; }
  animPrinter(pr, k, t) { // k: 0..1 build progress
    pr.head.position.set(Math.sin(t * 9) * 0.3, 0.92 - 0.72 * (1 - k), Math.sin(t * 1.9) * 0.24); pr.rail.position.z = pr.head.position.z; pr.rail.position.y = pr.head.position.y + 0.09;
    pr.glow.visible = Math.sin(t * 40) > -0.5;
  }
  restPrinter(pr) { pr.head.position.set(0, 0.92, 0); pr.rail.position.set(0, 1.0, 0); pr.glow.visible = true; }

  update(dt, t) {
    const sv = this.server.root, p = G.player;
    if (this.delivery) this.updateDelivery(dt, t);
    if (this.ambient) { const a = this.ambient; a.t += dt; this.animPrinter(a.pr, clamp(a.t / 7, 0, 1), t); if (a.t > 7) { this.restPrinter(a.pr); this.ambient = null; } }
    const o = this.order;
    const fly = (tx, ty, tz, speed = 3.4) => { const dx = tx - sv.position.x, dy = ty - sv.position.y, dz = tz - sv.position.z, d = Math.hypot(dx, dy, dz), st = Math.min(d, speed * dt); if (d > 0.001) { sv.position.x += (dx / d) * st; sv.position.y += (dy / d) * st; sv.position.z += (dz / d) * st; } return d < 0.06; };
    sv.rotation.y += dt * 2;
    if (!o) { fly(this.dock.x, this.dock.y + Math.sin(t * 1.5) * 0.05, this.dock.z, 2.5); return; }
    o.t += dt;
    const pr = this.R.printers[1], dish = o.dish.g;
    if (o.state === 'printing') {
      const k = smooth(o.t / 9); o.dish.food.scale.y = Math.max(0.01, k); this.animPrinter(pr, k, t);
      if (o.t >= 9) { this.restPrinter(pr); o.state = 'pickup'; G.ui.setObjective({ title: 'Printed Petal', text: `${o.item.name} is ready`, sub: 'The serving drone is collecting it.' }); if (G.audio) G.audio.blip(880, 0.08); }
    } else if (o.state === 'pickup') {
      if (fly(pr.x, pr.plateY + 0.45, pr.z)) { o.state = 'carry'; o.wait = 0; }
    } else if (o.state === 'carry') {
      dish.position.set(sv.position.x, sv.position.y + 0.03, sv.position.z);
      const seat = p.state === 'sit' && p.seat && p.seat.table ? p.seat : null;
      if (seat) { if (fly(seat.table.x, seat.table.y + 0.3, seat.table.z)) { o.state = 'served'; o.seat = seat; dish.position.set(seat.table.x, seat.table.y, seat.table.z); o.t = 0; G.ui.setObjective({ title: 'Printed Petal', text: `${o.item.name} is served`, sub: 'Press E to eat.' }); } }
      else {
        // hover near the customer; if they never sit, pack it to go
        const inside = p.pos.x > 6 && p.pos.x < 42 && p.pos.z > -103 && p.pos.z < -77 && p.pos.y < 5;
        const hx = inside ? p.pos.x + Math.sin(p.yaw) * 0.9 : 24, hz = inside ? p.pos.z + Math.cos(p.yaw) * 0.9 : -90;
        fly(hx, 1.75 + Math.sin(t * 2) * 0.04, hz); o.wait += dt;
        if (o.wait > 22) { this.pocket({ name: `${o.item.name} (take-away pod)`, energy: Math.round(o.item.energy * 0.9) }); G.ui.toast('The drone sealed your order in a take-away pod. It is in your pocket.', 'info'); this.clear(); }
      }
    } else if (o.state === 'served') {
      fly(this.dock.x, this.dock.y, this.dock.z, 2.5);
      if (p.seat !== o.seat && o.t > 75) { G.ui.toast('Your unfinished plate was cleared.', 'info'); this.clear(); }
    }
  }
  bite() {
    const o = this.order, p = G.player; if (!o || o.state !== 'served') return;
    o.bites++; p.play('eat', 1.5); p.energy = clamp(p.energy + o.item.energy / 5, 0, 100);
    o.dish.food.scale.setScalar(1 - o.bites * 0.18);
    if (G.audio) G.audio.blip(300, 0.04);
    if (o.bites >= 5) {
      G.state.stats.meals++; G.ui.toast(`${o.item.name}: finished. Energy ${Math.round(p.energy)}%.`, 'good');
      const host = G.npcs.byId.get('host'); if (host && host.isNear) G.ui.say(host, 'I hope the print was to your taste.');
      this.clear();
    }
  }
  clear() { const o = this.order; if (o) { o.dish.g.removeFromParent(); this.order = null; } G.ui.setObjective(null); }

  // Returns false only when a keepsake cannot be carried (food is eaten on the spot instead).
  pocket(item) {
    const inv = G.state.inventory;
    if (inv.length >= 6) { if (item.gift) return false; G.ui.toast('Your pockets are full. You ate it on the spot.', 'info'); G.player.energy = clamp(G.player.energy + item.energy, 0, 100); return true; }
    inv.push(item); return true;
  }
  // ---- drone delivery: the kitchen flies your order to wherever you are standing ---------------
  deliveryMenu() {
    if (!this.open) return G.ui.toast('The kitchen is closed: no deliveries until 07:00.', 'info');
    if (this.delivery) return G.ui.toast('A delivery drone is already on its way to you.', 'info');
    if (G.env.indoor > 0.5 || G.player.state !== 'walk') return G.ui.toast('Stand outside under open sky: the drone needs a clear drop.', 'info');
    G.ui.openMenu({ title: 'Printed Petal delivery', who: 'Drone to your position · +◈8 flight fee', wide: true, body: 'The kitchen prints it, seals it in a pod and flies it to you. A few minutes of city time.',
      options: [...MENU.map((it) => ({ label: it.name, desc: `+${Math.round(it.energy * 0.9)}% energy`, price: it.price + 8, onPick: () => { if (!G.economy.spend(it.price + 8, `${it.name}, delivered`)) return; const c = this.courier.root; c.position.copy(this.roof); c.visible = true; this.delivery = { item: it, phase: 'up', alt: 40, warned: false }; this.ambientPrint(); G.ui.toast('Order sent. Stay outdoors: the drone homes on your lens.', 'good'); } })), { label: 'Never mind', onPick: () => {} }] });
  }
  updateDelivery(dt, t) {
    const d = this.delivery, q = this.courier.root.position, p = G.player.pos;
    // plan a leg: climb to an altitude that clears everything between here and the target
    if (d.phase === 'up' || d.phase === 'done') {
      const home = d.phase === 'done', tx = home ? this.roof.x : p.x, tz = home ? this.roof.z : p.z;
      d.alt = Math.max(G.colliders.clearAltitude(q.x, q.z, tx, tz, 2, 8), (home ? this.roof.y : p.y) + 6, q.y); d.phase = home ? 'back' : 'go';
      return;
    }
    const back = d.phase === 'back';
    const tx = back ? this.roof.x : p.x, tz = back ? this.roof.z : p.z, ty = back ? this.roof.y : p.y + 2.5, hd = Math.hypot(tx - q.x, tz - q.z);
    if (hd > 1.2) { if (q.y < d.alt - 0.5) q.y += 10 * dt; else { const st = Math.min(hd, 17 * dt); q.x += ((tx - q.x) / hd) * st; q.z += ((tz - q.z) / hd) * st; this.courier.root.rotation.y = Math.atan2(tx - q.x, tz - q.z); } }
    else if (!back && (G.env.indoor > 0.5 || G.player.state !== 'walk')) { if (!d.warned) { d.warned = true; G.ui.toast('Your delivery is circling overhead. Step outside to receive it.', 'info'); } }
    else if (Math.abs(q.y - ty) > 0.2) q.y += Math.sign(ty - q.y) * Math.min(Math.abs(ty - q.y), 7 * dt);
    else if (!back) { this.pocket({ name: `${d.item.name} (delivery pod)`, energy: Math.round(d.item.energy * 0.9) }); G.ui.toast(`Delivered: ${d.item.name}. It is in your pocket (Tab to eat).`, 'good'); if (G.audio) G.audio.blip(880, 0.08); d.phase = 'done'; }
    else { this.courier.root.visible = false; this.delivery = null; return; }
    this.courier.parcel.visible = d.phase === 'go';
    for (const r of this.courier.rotors) r.rotation.z += dt * 40;
  }
  eatPocket() {
    const inv = G.state.inventory, i = inv.findIndex((x) => x.energy > 0); if (i < 0) return;
    const it = inv.splice(i, 1)[0];
    const p = G.player; p.energy = clamp(p.energy + it.energy, 0, 100); if (p.state === 'walk') p.play('snack', 2.4);
    G.ui.toast(`Ate ${it.name}. Energy ${Math.round(p.energy)}%.`, 'good');
  }
  vending() {
    const e = G.player.energy, rec = e < 40 ? VEND[2] : e < 70 ? VEND[0] : VEND[1];
    G.ui.openMenu({ title: 'NutriMat', who: 'Intelligent vending', body: `Lens reading: energy ${Math.round(e)}%, ${G.env.rain > 0.3 ? 'raining' : G.env.hour > 20 || G.env.hour < 6 ? 'late hours' : 'active day'}. Suggested for you: ${rec.name}.`,
      options: [...VEND.map((v) => ({ label: v.name + (v === rec ? '  ★ suggested' : ''), desc: `+${v.energy}% energy. Dispensed in a compostable shell.`, price: v.price, onPick: () => { if (G.economy.spend(v.price, v.name)) { this.pocket({ name: v.name, energy: v.energy }); G.ui.toast(`${v.name} dispensed to your pocket. Eat it from the lens menu (Tab).`, 'info'); } } })), { label: 'Leave', onPick: () => {} }] });
  }
  buyStreet() { if (!G.economy.spend(9, 'hand-folded dumplings')) return false; this.pocket({ name: 'Hand-folded dumplings', energy: 26 }); return true; }
}
