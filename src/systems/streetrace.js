// Midtown Night Run: two laps of a street circuit through Eastline in live traffic, against three
// rivals. Everyone drives a loaned Vanta GT. Every red light run costs two seconds (rivals brake for red
// lights, and pay the same if they get caught on one); the order at the end is by time with penalties.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { buildVehicle, MODELS } from '../data/vehicles.js';
import { PathLine, angDelta, clamp, damp } from '../core/util.js';
import { findRoute } from '../world/metro/route.js';
import { ranRed, signalState, corner } from '../world/metro/streets.js';
import { labelTexture } from '../world/materials.js';
import { Fleet } from '../entities/fleet.js';

const LAPS = 2, PRIZE = [800, 450, 200, 60], ORD = ['1st', '2nd', '3rd', '4th'], LANE = 4.2, P = 120;
// four straight streets round a 3 x 3 square of Eastline blocks, clear of the highways and the ring road
const WAY = [[5, -1], [8, -1], [8, -4], [5, -4]];
export class StreetRace {
  constructor() {
    // the circuit: junction to junction along the streets, then moved into the right-hand lane
    const pts = [];
    WAY.forEach(([i, j], n) => { const [i2, j2] = WAY[(n + 1) % WAY.length], r = findRoute(i * P + 60, j * P + 60, i2 * P + 60, j2 * P + 60); for (const q of (r ? r.pts.slice(1, -1) : [[i * P + 60, j * P + 60]])) { const last = pts[pts.length - 1]; if (!last || Math.hypot(last[0] - q[0], last[1] - q[1]) > 1) pts.push(q); } });
    if (Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1) pts.pop();
    const n = pts.length, lane = pts.map((q, k) => { const a = pts[(k + n - 1) % n], b = pts[(k + 1) % n], d1 = [Math.sign(q[0] - a[0]), Math.sign(q[1] - a[1])], d2 = [Math.sign(b[0] - q[0]), Math.sign(b[1] - q[1])], straight = d1[0] === d2[0] && d1[1] === d2[1] ? 0.5 : 1; return [q[0] + (-d1[1] - d2[1]) * LANE * straight, 0, q[1] + (d1[0] + d2[0]) * LANE * straight]; });
    this.path = new PathLine(lane, true); this.nodes = pts.map((q, k) => ({ s: this.path.len[k], x: q[0], z: q[1], i: Math.round((q[0] - 60) / P), j: Math.round((q[1] - 60) / P) })); this.junctions = pts;
    const T = this.path.total, v = (this.v = new THREE.Vector3());
    // gates: one at every corner, more along the straights, about every 90 m
    this.gates = []; for (let s = 40; s < T; s += T / Math.round(T / 90)) { const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: 0x59e0ff, transparent: true, opacity: 0.5 }); for (const sx of [-10.5, 10.5]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7, 0.4), mat); p.position.set(sx, 3.5, 0); g.add(p); } const b = new THREE.Mesh(new THREE.BoxGeometry(21.4, 0.4, 0.4), mat); b.position.y = 7; g.add(b); const yaw = this.path.sample(s, g.position); g.position.x -= Math.cos(yaw) * -LANE; g.position.z -= -Math.sin(yaw) * -LANE; g.rotation.y = yaw; g.visible = false; G.scene.add(g); this.gates.push({ g, mat, s, c: g.position, nx: Math.sin(yaw), nz: Math.cos(yaw) }); }
    this.rivals = [['#ff7ad9', 'Nightjar'], ['#7dff9c', 'Static'], ['#ffd34d', 'Lumen Lou']].map(([col, name], i) => { const b = buildVehicle('vanta', col); b.g.visible = false; G.scene.add(b.g); return { g: b.g, pod: b.podMat, name, lane: [1.6, -1.6, 0][i], vmax: [31, 32.5, 34][i], vc: [11, 11.8, 12.6][i], s: 0, v: 0, yaw: 0, pen: 0, at: 0, done: null, x: 0, z: 0, w: 2.1, l: 4.8 }; });
    // the start: a sign on the corner
    const [sx, sz] = pts[0]; this.kiosk = { x: sx - 14, y: 0.15, z: sz - 14 };
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.2), new THREE.MeshBasicMaterial({ map: labelTexture('NIGHT RUN', { color: '#ff7ad9', sub: 'two laps of Eastline · ◈30', bg: '#10131a', size: 58 }), side: THREE.DoubleSide }));
    sign.position.set(this.kiosk.x, 3.1, this.kiosk.z); sign.rotation.y = Math.PI / 4; G.scene.add(sign);
    G.interact.add({ pos: this.kiosk, r: 3.4, yTol: 2, label: () => `Midtown Night Run: two laps against three drivers (◈30)${G.state.best.street ? ` · best ${G.state.best.street.toFixed(1)} s` : ''}`, enabled: () => !this.race && G.player.state === 'walk' && !G.minigame && !(G.racing && G.racing.gp), use: () => { if (G.economy.spend(30, 'Night Run entry')) this.start(); } });
    this.race = null;
  }
  start() {
    const car = G.car, p = G.player;
    if (G.jobs) { G.jobs.endTaxi(); G.jobs.endRace(); }
    G.ui.fade(() => {
      const loan = car.model !== 'vanta';
      this.race = { phase: 'count', t: 3.6, n: 4, gate: 0, time: 0, pen: 0, back: { x: car.pos.x, y: car.pos.y, z: car.pos.z, yaw: car.yaw, model: car.model, paint: car.paint, bat: car.battery, hull: car.hull, loan }, foot: { x: p.pos.x, y: p.pos.y, z: p.pos.z }, prev: new THREE.Vector3(), knocks: 0 };
      if (loan) car.setModel('vanta');
      car.battery = 100; car.hull = 100; car.knocks = 0;
      const yaw = this.path.sample(-10, this.v);
      car.pos.set(this.v.x + Math.cos(yaw) * 1.6, car.ride + 0.2, this.v.z - Math.sin(yaw) * 1.6); car.yaw = yaw; car.vel.set(0, 0, 0); car.mode = 'drive'; car.locked = true; car.board(p);
      this.rivals.forEach((r, i) => { r.s = -2 - i * 7; r.v = 0; r.pen = 0; r.done = null; r.g.visible = true; });
      G.metro.extraCars = this.rivals; this.race.prev.copy(car.pos); this.showGates();
      G.ui.toast(loan ? 'Night Run: a loaner Vanta GT. Two laps, every gate. Each red light you run costs 2 s; the same goes for them.' : 'Night Run: two laps, every gate. Each red light you run costs 2 s; the same goes for them.', 'info');
    });
  }
  showGates() { const n = this.race.gate, N = this.gates.length; this.gates.forEach((g, k) => { const d = (k - (n % N) + N) % N; g.g.visible = d < 2 && n + d < N * LAPS; g.mat.color.set(d === 0 ? '#ffd34d' : '#59e0ff'); g.mat.opacity = d === 0 ? 0.9 : 0.35; }); }
  end(msg) {
    const r = this.race; if (!r) return;
    const car = G.car, p = G.player, b = r.back; this.race = null; G.metro.extraCars = [];
    for (const g of this.gates) g.g.visible = false; for (const q of this.rivals) q.g.visible = false;
    G.ui.setObjective(null);
    G.ui.fade(() => {
      if (p.state === 'drive') car.eject(p, this.kiosk.x + 1.5, this.kiosk.y, this.kiosk.z + 1.5); else p.pos.set(this.kiosk.x + 1.5, this.kiosk.y, this.kiosk.z + 1.5);
      car.locked = false; if (b.loan) { car.setModel(b.model, true); car.setPaint(b.paint); }
      car.battery = b.bat; car.hull = b.hull; car.pos.set(b.x, b.y, b.z); car.yaw = b.yaw; car.vel.set(0, 0, 0); car.mode = 'parked';
      if (msg) G.ui.toast(msg, 'info');
    });
  }
  finish() {
    const r = this.race, s = G.state, total = r.time + r.pen, T = this.path.total;
    // a rival still on the track is given the time it would take to finish at its own pace
    const others = this.rivals.map((q) => (q.done !== null ? q.done : r.time + Math.max(0, LAPS * T - q.s) / q.vmax + q.pen));
    const place = 1 + others.filter((x) => x < total).length;
    r.phase = 'done'; r.t = 3.5;
    const best = !s.best.street || total < s.best.street; if (best) s.best.street = +total.toFixed(1);
    G.ui.flash(`${ORD[place - 1].toUpperCase()} · ${total.toFixed(1)} s${r.pen ? ` (+${r.pen} s)` : ''}`, 3.4);
    if (PRIZE[place - 1]) G.economy.earn(PRIZE[place - 1], `Night Run, ${ORD[place - 1]} place`);
    if (best) G.ui.toast('A new personal best on the Night Run.', 'good');
    G.state.done.streetRace = true; if (place === 1) G.state.done.streetWin = true;
  }
  update(dt, t) {
    const r = this.race; if (!r) return;
    const car = G.car, T = this.path.total, N = this.gates.length;
    if (r.phase === 'count') {
      r.t -= dt; const n = Math.ceil(r.t - 0.6);
      if (n !== r.n) { r.n = n; G.ui.flash(n > 0 ? String(n) : 'GO', 0.8); if (G.audio) G.audio.blip(n > 0 ? 440 : 880, 0.12); }
      if (r.t <= 0.6) { r.phase = 'run'; car.locked = false; }
    } else if (r.phase === 'run') {
      r.time += dt;
      if (G.player.state !== 'drive') return this.end('You left the car: race abandoned.');
      if (r.time > 300) return this.end('Race timed out.');
      if (car.hull <= 0) return this.end('Your car is wrecked: race over. The loaner goes back to the garage.');
      if (ranRed(r.prev.x, r.prev.z, car.pos.x, car.pos.z, t)) { r.pen += 2; G.ui.flash('RED LIGHT +2 s', 1); if (G.audio) G.audio.blip(200, 0.12); }
      const g = this.gates[r.gate % N], d0 = (r.prev.x - g.c.x) * g.nx + (r.prev.z - g.c.z) * g.nz, d1 = (car.pos.x - g.c.x) * g.nx + (car.pos.z - g.c.z) * g.nz;
      if (d0 < 0 && d1 >= 0 && Math.abs((car.pos.x - g.c.x) * g.nz - (car.pos.z - g.c.z) * g.nx) < 11.5 && car.pos.y < 8) {
        r.gate++; if (G.audio) G.audio.blip(700, 0.08);
        if (r.gate === N * LAPS) this.finish(); else { if (r.gate % N === 0) G.ui.flash('FINAL LAP', 1.5); this.showGates(); }
      }
      r.prev.copy(car.pos);
    } else { r.t -= dt; if (r.t <= 0) return this.end(); }
    // rivals: their lane of the circuit, braking for corners, for traffic ahead, and a little rubber-banding
    const g = this.gates[r.gate % N], mine = Math.floor(r.gate / N) * T + g.s - Math.hypot(car.pos.x - g.c.x, car.pos.z - g.c.z);
    let ahead = 0;
    for (const q of this.rivals) {
      if (r.phase !== 'count' && q.done === null) {
        const h0 = this.path.sample(q.s, this.v), h1 = this.path.sample(q.s + 32, this.v);
        let target = Math.abs(angDelta(h0, h1)) > 0.3 ? q.vc : q.vmax; const diff = q.s - mine;
        if (diff > 90) target *= 0.88; else if (diff < -90) target *= 1.08;
        // red lights ahead: brake to the stop line (they used to run them and take the penalty)
        for (const nd of this.nodes) { const a = ((nd.s - 12) % T + T) % T, ahead = ((a - q.s) % T + T) % T; if (ahead < 45 && corner(nd.i, nd.j).signal) { const head = this.path.sample(a, this.v), sv = signalState(nd.i, nd.j, t)[Math.abs(Math.sin(head)) > 0.7 ? 'ew' : 'ns']; if (sv === 2 || (sv === 1 && ahead > 12)) target = Math.min(target, Math.max(0, (ahead - 2) * 0.9)); } }
        for (const o of G.metro.traffic.pods) if (o.on && Math.abs(o.x - q.x) < 50 && Math.abs(o.z - q.z) < 50) { const gp = Fleet.gap(q.x, q.z, q.yaw, q.w, q.l, o, true); if (gp < 40) target = Math.min(target, Math.max(0, (gp - 3) * 1.8)); }
        q.v = damp(q.v, target, target < q.v ? 2.6 : 1.1, dt);
        const s0 = q.s; q.s += q.v * dt;
        // the signals: it does not stop, but it pays for it like you do
        for (const nd of this.nodes) { const a = ((nd.s - 12) % T + T) % T, k0 = Math.floor((s0 - a) / T), k1 = Math.floor((q.s - a) / T); if (k1 > k0 && corner(nd.i, nd.j).signal) { const sv = signalState(nd.i, nd.j, t), [px, pz] = [nd.x, nd.z], back = this.path.sample(q.s, this.v); if (sv[Math.abs(Math.sin(back)) > 0.7 ? 'ew' : 'ns'] === 2) q.pen += 2; void px; void pz; } }
        if (q.s >= LAPS * T - 6) { q.done = r.time + q.pen; }
      }
      if (q.s > mine) ahead++;
      const yaw = this.path.sample(q.s, this.v), turn = angDelta(q.yaw, yaw); q.yaw += turn * Math.min(1, 6 * dt);
      q.x = this.v.x + Math.cos(yaw) * q.lane; q.z = this.v.z - Math.sin(yaw) * q.lane;
      q.g.position.set(q.x, MODELS.vanta.ride + Math.sin(t * 2 + q.lane) * 0.02, q.z); q.g.rotation.set(0, q.yaw, clamp(-turn * 3, -0.25, 0.25));
      q.pod.color.setRGB(0.35 + q.v * 0.02, 0.9 + q.v * 0.02, 1.2 + q.v * 0.02);
      if (r.phase === 'run') Fleet.knock(q);
    }
    if (r.phase !== 'done') G.ui.setObjective({ title: 'Midtown Night Run', text: r.phase === 'count' ? 'Get ready' : `${ORD[Math.min(3, ahead)]} on the road · lap ${Math.min(LAPS, Math.floor(r.gate / N) + 1)} / ${LAPS} · ${r.time.toFixed(1)} s${r.pen ? ` +${r.pen} s` : ''}`, sub: 'Live traffic. Red lights cost 2 s. Shift boosts.' });
  }
}
