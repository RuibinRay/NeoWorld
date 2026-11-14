// Paid work and activities. All optional, all repeatable:
//   Air taxi shifts (fares between landing pads, tips for a smooth ride)
//   Canyon Sprint (flying time trial through rings between the towers, medals, best time)
//   Courier runs on foot (find a resident somewhere in the district before time runs out)
//   Print-line shift at Printed Petal (timing minigame scored on accuracy)
//   Data caches hidden on rooftops and in back alleys
import * as THREE from 'three';
import { G } from '../core/game.js';
import { neon } from '../world/materials.js';
import { makeHumanoid, animateRig, makeParcel, SKINS, HAIRS, CLOTHES, ACCENTS } from '../entities/rigs.js';
import { money } from '../ui/ui.js';
import { RNG, clamp } from '../core/util.js';
import { Career } from './career.js';

const RACE = [[-60, 28, 10], [-60, 45, -60], [-60, 80, -120], [-60, 95, -180], [0, 100, -180], [60, 95, -180], [60, 80, -120], [60, 50, -60], [30, 30, -30], [0, 26, 0], [-30, 28, 30], [-60, 36, 60], [-120, 50, 60], [-180, 44, 60], [-180, 42, 28], [-112, 34, 28]];
const MEDALS = [[40, 'GOLD', 400], [52, 'SILVER', 250], [70, 'BRONZE', 120]];
const RIDERS = ['Dr. Anwar', 'Ms. Okoye', 'Mr. Halvorsen', 'Captain Reyes', 'Prof. Ito', 'Mx. Duarte', 'Ms. Balasubramanian', 'Mr. Achterberg'];
const RING_R = 8;

export class Jobs {
  constructor() {
    this.rng = new RNG(1234); this.taxi = null; this.race = null; this.courier = null; this.shift = null; this.cargo = null; this.revealed = new Set(); this.lastThanks = '';
    // objective beacon
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 60, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.beam.visible = false; G.scene.add(this.beam);
    // race rings
    const geo = new THREE.TorusGeometry(RING_R, 0.32, 8, 40), up = new THREE.Vector3(0, 0, 1);
    this.rings = RACE.map((p, i) => {
      const a = RACE[Math.max(0, i - 1)], b = RACE[Math.min(RACE.length - 1, i + 1)];
      const n = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x59e0ff, transparent: true, opacity: 0.4 }));
      m.position.set(p[0], p[1], p[2]); m.quaternion.setFromUnitVectors(up, n); m.visible = false; G.scene.add(m);
      return { m, c: m.position, n };
    });
    this.prev = new THREE.Vector3();
    // taxi passenger stand-in
    this.rider = makeHumanoid({ kind: 'human', skin: SKINS[1], hair: HAIRS[0], top: CLOTHES[4], bottom: CLOTHES[1], accent: ACCENTS[3], height: 1.74, coat: true, pack: true });
    this.rider.root.visible = false; G.scene.add(this.rider.root);
    this.parcel = makeParcel(); this.parcel.position.set(0, 0.42, 0.26); this.parcel.visible = false;
    G.interact.add({ pos: G.city.places.jobBoard, r: 1.7, label: 'CivicLink: jobs and notices', use: () => this.board() });
    addEventListener('keydown', (e) => { if (this.shift && (e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); this.shiftLock(); } if (this.shift && e.code === 'Escape') this.shiftEnd(true); });
    for (const c of G.city.caches) if (G.state.caches.includes(c.id)) this.hideCache(c);
  }
  // after loading a save
  sync() { for (const c of G.city.caches) { const f = G.state.caches.includes(c.id); c.found = f; c.m.visible = !f; c.beam.visible = !f; } }
  hideCache(c) { c.found = true; c.m.visible = false; c.beam.visible = false; }
  reveal(i) { this.revealed.add(i); }
  markers() {
    const out = [];
    if (this.taxi) { const p = this.taxi.phase === 'pickup' ? this.taxi.from : this.taxi.to; out.push({ x: p.x, z: p.z }); }
    if (this.race) { const r = this.rings[this.race.idx]; out.push({ x: r.c.x, z: r.c.z, color: '#7dff9c' }); }
    if (this.cargo && this.cargo.phase === 'haul') out.push({ x: this.cargo.to.x, z: this.cargo.to.z });
    if (this.courier) { const n = this.courier.to; const q = n.inside ? n.node : n.pos; out.push({ x: q.x, z: q.z, color: '#ff9a52' }); }
    for (const i of this.revealed) { const c = G.city.caches[i]; if (!c.found) out.push({ x: c.x, z: c.z, color: '#ffd34d' }); }
    return out;
  }

  // ---- menus ---------------------------------------------------------------------------------
  board() {
    const s = G.state, env = G.env, opts = [];
    if (this.courier) opts.push({ label: 'Cancel courier run', onPick: () => this.endCourier('Courier run cancelled. The parcel goes back to the depot.') });
    else opts.push({ label: 'Courier run', desc: 'Carry a parcel to a resident somewhere in the district. On foot or by air. Pays more the faster you are.', onPick: () => this.startCourier() });
    opts.push(G.streetTaxi.shift ? { label: 'End the street taxi shift', onPick: () => G.streetTaxi.end() } : { label: 'Street taxi shift', desc: 'Drive your own vehicle: pick fares up at the kerb anywhere in the city and take them across it by road. Careful drivers get tips.', onPick: () => G.streetTaxi.start() });
    opts.push({ label: 'Commons Drone Slalom', desc: `Fly a racing drone through fourteen rings in the park. Gold under 20 s. Your best: ${s.best.slalom ? s.best.slalom.toFixed(1) + ' s' : 'none yet'}.`, onPick: () => G.drone.startSlalom() });
    opts.push({ label: 'Investments', desc: 'Buy a share in local businesses for a daily dividend', onPick: () => G.economy.investMenu() });
    opts.push({ label: 'Close', onPick: () => {} });
    G.ui.openMenu({ title: 'CivicLink', who: 'Meridian Quarter public terminal', wide: true, options: opts,
      html: `<p><b>Work</b> · Air-taxi shifts and the Canyon Sprint time trial run from Flight Ops at the Skyport: ask Vesper. Printed Petal takes help on the print line: ask the chef. Courier runs start here.</p>
        <p><b>Notices</b> · Weather: ${env.label}. Forecast: ${env.forecast}. Evening market by the east path 17:00 to 21:30. Morning movement session on the dance floor from 06:10. Holo-concert on the Commons stage nightly from 20:00. Printed Petal 07:00 to 23:00. Kinetic Robotics 09:00 to 21:00. Maglev line 7 runs the ring continuously.</p>
        <p><b>Career</b> · ${Career.summary()}. Each rank adds 10% pay in that line of work.</p>
        <p><b>You</b> · ${s.stats.fares} fares, ${s.stats.deliveries} deliveries, ${s.stats.shifts} kitchen shifts. Data caches recovered: ${s.caches.length} of ${G.city.caches.length}. Ask residents what is worth seeing: some of them know where caches are.</p>` });
  }
  flightOps() {
    const car = G.car, s = G.state, eco = G.economy, opts = [];
    if (this.taxi) opts.push({ label: 'End air-taxi shift', onPick: () => this.endTaxi('Shift ended. Thank you for flying safely.') });
    else opts.push({ label: 'Start an air-taxi shift', desc: 'Pick up passengers at pads and fly them where they want to go. Smooth flying earns tips.', onPick: () => this.startTaxi() });
    opts.push({ label: this.race ? 'Abandon Canyon Sprint' : 'Canyon Sprint time trial', desc: `Sixteen rings through the tower canyons. Gold under ${MEDALS[0][0]} s. Your best: ${s.best.race ? s.best.race.toFixed(1) + ' s' : 'none yet'}.`, onPick: () => (this.race ? this.endRace('Sprint abandoned.') : this.armRace()) });
    opts.push({ label: 'Ring Road GP', desc: `Two laps of the ring road on hoverbikes against three riders. A loaner Kestrel is provided. Your best: ${s.best.gp ? s.best.gp.toFixed(1) + ' s' : 'none yet'}.`, onPick: () => G.racing.start() });
    opts.push(this.cargo ? { label: 'Cancel cargo run', onPick: () => { this.cargo = null; G.ui.setObjective(null); } } : { label: 'Cargo run', desc: `Haul crates to a rooftop pad. Your ${car.spec.name} carries ${car.spec.cargo}. Bumps break cargo.`, onPick: () => this.startCargo() });
    opts.push({ label: 'Drone delivery shift', desc: 'Pilot a courier drone from here: three parcels to rooftops', onPick: () => G.drone.startDeliveries() });
    opts.push({ label: 'Vehicle exchange and tuning', desc: 'Buy, switch and tune vehicles', onPick: () => G.garage.menu() });
    opts.push({ label: 'Repair hull', price: eco.repairCost(), disabled: car.hull >= 100, why: 'Hull is at 100%.', onPick: () => eco.repair() });
    opts.push({ label: 'Respray', price: 150, onPick: () => eco.paintMenu() });
    opts.push({ label: 'Close', onPick: () => {} });
    G.ui.openMenu({ title: 'Flight Ops', who: 'Vesper · Meridian Skyport', body: `Your aerocar: battery ${Math.round(car.battery)}%, hull ${Math.round(car.hull)}%. Pads 1 to 3 charge by induction when you park on them.`, options: opts });
  }

  // ---- air taxi ---------------------------------------------------------------------------------
  pads() { return G.city.pads.filter((p) => p.taxi && !p.priv && p.id !== 'needle'); }
  startTaxi() { this.endRace(); this.cargo = null; this.taxi = { phase: 'pickup', from: null, to: null, name: '', n: 0 }; this.nextFare(null); G.ui.toast('Shift started. Board your aerocar.', 'good'); }
  nextFare(last) {
    // fares stay within the part of the city you are in; out in a district with one pad, the pickup is the nearest pad
    const t = this.taxi, c = G.car.pos, far = (p) => Math.hypot(p.x - c.x, p.z - c.z), all = this.pads().filter((p) => p !== last).sort((p, q) => far(p) - far(q));
    const local = all.filter((p) => far(p) < 700), few = local.length < 2, pads = few ? all.slice(0, 4) : local;
    t.from = few ? pads[0] : this.rng.pick(pads); t.to = this.rng.pick(pads.filter((p) => p !== t.from)); t.phase = 'pickup'; t.name = this.rng.pick(RIDERS);
    const r = this.rider.root; r.visible = true; r.position.set(t.from.x + t.from.r - 1, t.from.y, t.from.z + 1.5); r.rotation.y = -Math.PI / 2;
    G.ui.setObjective({ title: 'Air taxi', text: `Pick up ${t.name} at ${t.from.name}`, sub: `Land on the pad. Pad level: ${Math.round(t.from.y)} m.` });
  }
  onPad(p) { const c = G.car; return c.mode === 'parked' && Math.hypot(c.pos.x - p.x, c.pos.z - p.z) < p.r + 1.2 && Math.abs(c.pos.y - c.ride - p.y) < 1.6; }
  updateTaxi(dt) {
    const t = this.taxi, car = G.car;
    if (t.phase === 'between') { t.wait -= dt; if (t.wait <= 0) this.nextFare(t.last); return; }
    if (t.phase === 'pickup' && G.player.state === 'drive' && this.onPad(t.from)) {
      t.phase = 'dropoff'; this.rider.root.visible = false; car.comfort = 100; t.dist = Math.hypot(t.to.x - t.from.x, t.to.z - t.from.z) + Math.abs(t.to.y - t.from.y);
      G.ui.setObjective({ title: 'Air taxi', text: `Fly ${t.name} to ${t.to.name}`, sub: `Pad level: ${Math.round(t.to.y)} m. Smooth flying earns a tip.` });
      G.ui.toast(`${t.name}: "${t.to.name}, please."`, 'info'); if (G.audio) G.audio.blip(700, 0.08);
    } else if (t.phase === 'dropoff' && this.onPad(t.to)) {
      const fare = Math.round((35 + t.dist * 0.25) * Career.mult('pilot')), c = car.comfort, tip = Math.round(c > 80 ? fare * 0.35 : c > 50 ? fare * 0.12 : 0);
      G.economy.earn(fare + tip, tip ? `fare + ${money(tip)} tip` : 'fare');
      G.ui.toast(`${t.name}: "${c > 80 ? 'Smoothest ride I have had this year.' : c > 50 ? 'A little lively, but we made it.' : 'I am walking next time.'}"`, c > 50 ? 'good' : 'warn');
      Career.add('pilot', 'fares'); G.state.standing = clamp(G.state.standing + (c > 50 ? 1 : -0.5), -100, 100); t.n++;
      const r = this.rider.root; r.visible = true; r.position.set(t.to.x + t.to.r - 1, t.to.y, t.to.z + 1.5); this.riderWave = 3;
      t.last = t.to; t.wait = 3.2; t.phase = 'between'; G.ui.setObjective({ title: 'Air taxi', text: 'Fare complete', sub: 'Next request incoming…' });
    }
  }
  endTaxi(msg) { if (!this.taxi) return; this.taxi = null; this.rider.root.visible = false; G.ui.setObjective(null); if (msg) G.ui.toast(msg, 'info'); }

  // ---- Canyon Sprint -------------------------------------------------------------------------------
  // ---- cargo runs: capacity depends on the vehicle, and rough flying breaks crates --------------
  startCargo() {
    const car = G.car, cap = car.spec.cargo;
    if (!cap) return G.ui.toast(`The ${car.spec.name} has nowhere to put a crate. Bring a vehicle with a hold.`, 'info');
    this.endTaxi(); this.endRace();
    this.cargo = { phase: 'load', crates: cap, to: this.rng.pick(this.pads().filter((p) => p.y > 5 || Math.hypot(p.x, p.z) > 500)) }; // rooftops, or a long haul to another district
    G.ui.toast(`Cargo run: ${cap} crate${cap === 1 ? '' : 's'} for ${this.cargo.to.name}. Park on a Skyport pad to load.`, 'good');
  }
  updateCargo() {
    const c = this.cargo, car = G.car;
    if (c.phase === 'load') {
      G.ui.setObjective({ title: 'Cargo run', text: `Park on a Skyport pad to load ${c.crates} crate${c.crates === 1 ? '' : 's'}`, sub: `Destination: ${c.to.name}, pad at ${Math.round(c.to.y)} m` });
      if (G.player.state === 'drive' && G.city.pads.some((p) => /^sky[123]$/.test(p.id) && this.onPad(p))) { c.phase = 'haul'; car.cargoHits = 0; c.dist = Math.hypot(c.to.x - car.pos.x, c.to.z - car.pos.z) + c.to.y; G.ui.toast('Loaded. Fly gently.', 'info'); if (G.audio) G.audio.blip(520, 0.08); }
    } else {
      const intact = clamp(1 - car.cargoHits / 60, 0.3, 1);
      G.ui.setObjective({ title: 'Cargo run', text: `Haul ${c.crates} crate${c.crates === 1 ? '' : 's'} to ${c.to.name}`, sub: `Pad at ${Math.round(c.to.y)} m · cargo intact ${Math.round(intact * 100)}%` });
      if (this.onPad(c.to)) {
        G.economy.earn(Math.round((30 + c.crates * (30 + c.dist * 0.07)) * intact * Career.mult('pilot')), `cargo delivered · ${Math.round(intact * 100)}% intact`);
        Career.add('pilot', 'cargo'); this.cargo = null; G.ui.setObjective(null);
      }
    }
  }
  armRace() {
    this.endTaxi(); this.race = { idx: 0, t: 0, running: false };
    this.rings.forEach((r) => { r.m.visible = true; }); this.paintRings();
    G.ui.setObjective({ title: 'Canyon Sprint', text: 'Fly through the green start ring', sub: 'East of the Skyport, over the road. The clock starts when you pass it.' });
    G.ui.toast('Sprint armed. Board your aerocar and take off.', 'good'); this.prev.copy(G.car.pos);
  }
  paintRings() {
    const i = this.race.idx;
    this.rings.forEach((r, k) => { const m = r.m.material; r.m.visible = k >= i && k <= i + 2; m.color.set(k === i ? (i === 0 ? '#7dff9c' : '#ffd34d') : '#59e0ff').multiplyScalar(k === i ? 1.8 : 1); m.opacity = k === i ? 0.95 : 0.3; });
  }
  updateRace(dt) {
    const rc = this.race, car = G.car, r = this.rings[rc.idx];
    if (rc.running) { rc.t += dt; if (rc.t > 240) return this.endRace('Sprint timed out.'); }
    const d0 = (this.prev.x - r.c.x) * r.n.x + (this.prev.y - r.c.y) * r.n.y + (this.prev.z - r.c.z) * r.n.z;
    const d1 = (car.pos.x - r.c.x) * r.n.x + (car.pos.y - r.c.y) * r.n.y + (car.pos.z - r.c.z) * r.n.z;
    if (d0 < 0 && d1 >= 0 && G.player.state === 'drive') {
      const px = car.pos.x - r.n.x * d1 - r.c.x, py = car.pos.y - r.n.y * d1 - r.c.y, pz = car.pos.z - r.n.z * d1 - r.c.z;
      if (px * px + py * py + pz * pz < (RING_R + 0.8) ** 2) {
        if (rc.idx === 0) { rc.running = true; rc.t = 0; }
        rc.idx++; if (G.audio) G.audio.blip(660 + rc.idx * 40, 0.1);
        if (rc.idx >= this.rings.length) return this.finishRace();
        this.paintRings();
      }
    }
    this.prev.copy(car.pos);
    G.ui.setObjective({ title: 'Canyon Sprint', text: rc.running ? `${rc.t.toFixed(1)} s · ring ${rc.idx} / ${this.rings.length}` : 'Fly through the green start ring', sub: rc.running ? 'Next ring is gold.' : 'East of the Skyport, over the road.' });
  }
  finishRace() {
    const t = this.race.t, s = G.state, medal = MEDALS.find((m) => t <= m[0]);
    const best = !s.best.race || t < s.best.race; if (best) s.best.race = t;
    Career.add('racer', 'races'); G.addNews('race');
    G.ui.flash(`${medal ? medal[1] : 'FINISHED'} · ${t.toFixed(1)} s`, 3.5);
    G.economy.earn(medal ? medal[2] : 40, medal ? `${medal[1].toLowerCase()} medal` : 'finisher purse');
    if (best) G.ui.toast('New personal best.', 'good');
    this.endRace();
  }
  endRace(msg) { if (!this.race) return; this.race = null; this.rings.forEach((r) => { r.m.visible = false; }); G.ui.setObjective(null); if (msg) G.ui.toast(msg, 'info'); }

  // ---- courier ----------------------------------------------------------------------------------------
  startCourier() {
    const ok = new Set(['park', 'stroll', 'tour', 'post', 'walkdog', 'tend', 'patrol', 'eat', 'shop', 'concert', 'play']);
    const pool = G.npcs.list.filter((n) => n.talk && !n.inside && ok.has(n.act) && n.d2 > 30 * 30);
    if (!pool.length) return G.ui.toast('No deliveries waiting right now. Try again in a little while.', 'info');
    const to = this.rng.pick(pool), dist = Math.sqrt(to.d2), what = this.rng.pick(['parcel', 'spare lens case', 'box of seedlings', 'repaired wrist terminal', 'sealed document tube']);
    this.courier = { to, what, t: 150 + dist * 0.9, pay: Math.round((55 + dist * 0.45) * Career.mult('courier')), total: 150 + dist * 0.9 };
    const rig = G.player.rig; rig.carry = true; rig.chest.add(this.parcel); this.parcel.visible = true;
    G.ui.toast(`Courier run: take the ${what} to ${to.name}.`, 'good');
  }
  deliverParcel() {
    const c = this.courier; if (!c) return;
    const bonus = Math.round(c.pay * 0.5 * clamp(c.t / c.total, 0, 1));
    G.economy.earn(c.pay + bonus, bonus ? 'delivery + speed bonus' : 'delivery'); Career.add('courier', 'deliveries'); G.state.standing = clamp(G.state.standing + 1, -100, 100);
    this.lastThanks = c.to.android ? 'Receipt confirmed. Your punctuality has been noted favorably.' : `Oh, my ${c.what}! Thank you for bringing it all the way over.`;
    this.endCourier();
  }
  endCourier(msg) { if (!this.courier) return; this.courier = null; G.player.rig.carry = false; this.parcel.visible = false; this.parcel.removeFromParent(); G.ui.setObjective(null); if (msg) G.ui.toast(msg, 'info'); }
  updateCourier(dt) {
    const c = this.courier, n = c.to, p = G.player.pos; c.t -= dt;
    if (c.t <= 0) { G.state.standing = clamp(G.state.standing - 1, -100, 100); return this.endCourier(`Too slow: the ${c.what} was recalled to the depot.`); }
    if (this.parcel.parent !== G.player.rig.chest) { G.player.rig.chest.add(this.parcel); G.player.rig.carry = true; } // rig was rebuilt
    const q = n.inside ? n.node : n.pos, d = Math.hypot(q.x - p.x, q.z - p.z);
    G.ui.setObjective({ title: 'Courier run', text: `Take the ${c.what} to ${n.name}`, sub: `${Math.round(d)} m · ${Math.ceil(c.t)} s left · ${n.inside ? 'they went indoors: leave it at the door' : 'talk to them to hand it over'}` });
    if (n.inside && d < 3 && G.player.state === 'walk') { G.economy.earn(Math.round(c.pay * 0.7), 'left at the door'); Career.add('courier', 'deliveries'); this.endCourier(); }
  }

  // ---- print-line shift (minigame) ------------------------------------------------------------------------
  startShift() {
    if (!G.food.open) return G.ui.toast('The kitchen is closed.', 'info');
    G.minigame = true; G.input.blocked = true; G.input.releasePointer();
    this.shift = { ticket: 0, layer: 0, scores: [], pos: 0, dir: 1, speed: 0.75, zone: [0.4, 0.6], flash: 0, dish: '' };
    document.getElementById('mini').style.display = 'flex'; this.shiftSetup();
  }
  shiftSetup() {
    const s = this.shift, w = Math.max(0.07, 0.2 - s.ticket * 0.025 - s.layer * 0.015), a = 0.08 + this.rng.next() * (0.84 - w);
    s.zone = [a, a + w]; s.speed = 0.7 + s.ticket * 0.16 + s.layer * 0.1; s.pos = this.rng.next() < 0.5 ? 0 : 1; s.dir = s.pos ? -1 : 1;
    s.dish = ['Lattice Wagyu', 'Kelp-Pearl Ramen', 'Mycelium Katsu', 'Biometric Bento', 'Wall Garden Plate'][s.ticket];
    const done = s.scores.length;
    document.getElementById('mini-box').innerHTML = `<h2>Print line · ticket ${s.ticket + 1} of 5: ${s.dish}</h2><div style="color:var(--dim)">Layer ${s.layer + 1} of 3. Press <kbd>Space</kbd> when the nozzle is inside the green band. Esc to walk off the line.</div>
      <div class="track"><div class="zone" style="left:${s.zone[0] * 100}%;width:${(s.zone[1] - s.zone[0]) * 100}%"></div><div class="needle" id="needle"></div></div>
      <div class="layers">${Array.from({ length: 15 }, (_, i) => `<i style="background:${i < done ? (s.scores[i] > 70 ? 'var(--ok)' : s.scores[i] > 30 ? 'var(--warn)' : '#ff5a5a') : ''}"></i>`).join('')}</div>
      <div style="margin-top:10px;color:var(--dim)" id="mini-msg">${done ? `Last layer: ${Math.round(s.scores[done - 1])}%` : 'The chef is watching.'}</div>`;
  }
  shiftLock() {
    const s = this.shift, mid = (s.zone[0] + s.zone[1]) / 2, half = (s.zone[1] - s.zone[0]) / 2, off = Math.abs(s.pos - mid);
    const score = off <= half ? 70 + 30 * (1 - off / half) : Math.max(0, 45 - (off - half) * 400);
    s.scores.push(score); if (G.audio) G.audio.blip(score > 70 ? 880 : 240, 0.08);
    s.layer++; if (s.layer >= 3) { s.layer = 0; s.ticket++; G.food.ambientPrint(); }
    if (s.ticket >= 5) return this.shiftEnd(false);
    this.shiftSetup();
  }
  shiftEnd(quit) {
    const s = this.shift; this.shift = null; G.minigame = false; G.input.blocked = false; G.input.hit.clear(); G.ui.cool = 0.3;
    document.getElementById('mini').style.display = 'none';
    if (!s.scores.length) return G.ui.toast('You left the line before printing anything.', 'info');
    const q = s.scores.reduce((a, b) => a + b, 0) / 15, pay = Math.round(30 + q * 2.3) * (quit ? 0.5 : 1) * Career.mult('kitchen');
    G.economy.earn(Math.round(pay), `print-line shift · quality ${Math.round(q)}%`);
    Career.add('kitchen', 'shifts'); if (q > G.state.best.shift) { G.state.best.shift = Math.round(q); if (!quit) G.ui.toast(`New best print quality: ${Math.round(q)}%.`, 'good'); }
    const chef = G.npcs.byId.get('chef'); if (chef) { chef.mem.rep = clamp(chef.mem.rep + (q > 75 ? 6 : q > 45 ? 2 : -2), -100, 100); if (chef.isNear) G.ui.say(chef, q > 75 ? 'Clean layers. You can come back any time.' : q > 45 ? 'Edible. Watch the band, not the nozzle.' : 'We will be recycling most of that.'); }
    G.skip(40, -6, true);
  }

  update(dt, t) {
    const p = G.player, car = G.car;
    if (this.shift) { const s = this.shift; s.pos += s.dir * s.speed * dt; if (s.pos > 1) { s.pos = 1; s.dir = -1; } if (s.pos < 0) { s.pos = 0; s.dir = 1; } const n = document.getElementById('needle'); if (n) n.style.left = `calc(${s.pos * 100}% - 2px)`; }
    if (this.taxi) this.updateTaxi(dt);
    if (this.race) this.updateRace(dt);
    if (this.courier) this.updateCourier(dt);
    if (this.cargo) this.updateCargo();
    if (this.rider.root.visible) { this.riderWave = (this.riderWave || 0) - dt; animateRig(this.rider, dt, this.riderWave > 0 ? 'wave' : 'idle', 0); }
    // data caches: walk into them
    if (p.state === 'walk') for (const c of G.city.caches) {
      if (c.found || Math.abs(c.y - p.pos.y) > 2.5 || (c.x - p.pos.x) ** 2 + (c.z - p.pos.z) ** 2 > 2.6) continue;
      this.hideCache(c); G.state.caches.push(c.id); this.revealed.delete(c.id);
      const all = G.state.caches.length === G.city.caches.length;
      G.economy.earn(all ? 600 : 100, all ? 'final data cache: full set bonus' : `data cache ${G.state.caches.length}/${G.city.caches.length}`);
      G.ui.flash('DATA CACHE RECOVERED', 2); if (G.audio) { G.audio.blip(880, 0.1); setTimeout(() => G.audio.blip(1320, 0.1), 140); }
    }
    // beacon over the current objective
    let tgt = null;
    if (this.taxi && this.taxi.phase !== 'between') tgt = this.taxi.phase === 'pickup' ? this.taxi.from : this.taxi.to;
    else if (this.courier) { const n = this.courier.to; tgt = n.inside ? n.node : n.pos; }
    else if (this.cargo && this.cargo.phase === 'haul') tgt = this.cargo.to;
    this.beam.visible = !!tgt;
    if (tgt) { this.beam.position.set(tgt.x, (tgt.y || 0) + 30, tgt.z); this.beam.material.opacity = 0.16 + Math.sin(t * 3) * 0.06; }
  }
  onAutopilotArrive() {}
}
