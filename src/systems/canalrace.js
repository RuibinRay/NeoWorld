// Canal Dash: a boat race down the Meridian Canal, from the pontoon by Park Avenue to the sea
// lock at Tidewater, under five bridges and round the bend, against three rivals.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { PathLine, angDelta, clamp, damp } from '../core/util.js';
import { Builder } from '../world/metro/builder.js';
import { CANAL_Y } from '../world/metro/landuse.js';
import { labelTexture } from '../world/materials.js';

const PRIZE = [400, 200, 80, 0], ORD = ['1st', '2nd', '3rd', '4th'], W = CANAL_Y;
export class CanalRace {
  constructor() {
    // the centre line: west along the canal, round the bend, south to the lock
    const pts = [[395, 0, 660], [-48, 0, 660]];
    for (let k = 1; k <= 6; k++) { const a = -Math.PI / 2 - (k / 6) * (Math.PI / 2); pts.push([-50 + Math.cos(a) * 10, 0, 670 + Math.sin(a) * 10]); }
    pts.push([-60, 0, 1118]);
    this.path = new PathLine(pts, false); this.v = new THREE.Vector3(); this.race = null;
    const T = this.path.total;
    // gates: arches over the water, about every 80 m; the last is the finish
    const post = new THREE.BoxGeometry(0.4, 5.2, 0.4), bar = new THREE.BoxGeometry(17.6, 0.4, 0.4);
    this.gates = [];
    for (let s = 70; s < T; s += 80) this.gates.push(Math.min(s, T - 4));
    if (T - 4 - this.gates[this.gates.length - 1] > 30) this.gates.push(T - 4);
    this.gates = this.gates.map((s) => {
      const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: 0x59e0ff, transparent: true, opacity: 0.5 });
      for (const sx of [-8.8, 8.8]) { const p = new THREE.Mesh(post, mat); p.position.set(sx, 2.6, 0); g.add(p); }
      const b = new THREE.Mesh(bar, mat); b.position.y = 5.2; g.add(b);
      const yaw = this.path.sample(s, g.position); g.position.y = W; g.rotation.y = yaw; g.visible = false; G.scene.add(g);
      return { g, mat, s, c: g.position, nx: Math.sin(yaw), nz: Math.cos(yaw) };
    });
    // rivals
    this.rivals = [['#ff7ad9', 'Marlin'], ['#7dff9c', 'Skerry'], ['#ffd34d', 'Tidewater Kid']].map(([col, name], i) => {
      const B = new Builder(); B.box('B', '#e9edf2', 1.1, 0.6, 3, 0, 0.3, 0); B.box('S', col, 0.9, 0.3, 1.4, 0, 0.7, -0.3); B.box('S', '#232832', 0.7, 0.5, 0.2, 0, 1.0, 0.7); B.box('G', col, 1.12, 0.1, 3.02, 0, 0.12, 0);
      B.box('S', col, 0.5, 0.6, 0.3, 0, 1.25, -0.3); B.box('S', '#c9a58a', 0.26, 0.26, 0.26, 0, 1.72, -0.3); B.box('S', '#1c1f27', 0.46, 0.2, 0.6, 0, 0.92, 0);
      const g = B.finish(new THREE.Group()); g.visible = false; G.scene.add(g);
      return { g, name, lane: [-4.5, 0, 4.5][i], vmax: [22.5, 23.4, 24.2][i], vc: [12, 12.8, 13.5][i], s: 0, v: 0, yaw: 0, done: false, x: 0, z: 0 };
    });
    // the start: a sign and a desk at the top of the steps by Park Avenue
    const L = G.metro.landings[0], top = L.top;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.1), new THREE.MeshBasicMaterial({ map: labelTexture('CANAL DASH', { color: '#ffd34d', sub: 'race to the sea lock · ◈20', bg: '#10131a', size: 58 }) }));
    sign.position.set(top.x - 3, 2.6, top.z - 0.4); G.scene.add(sign);
    const sb = new Builder(); sb.box('B', '#2b303a', 0.2, 2.6, 0.2, top.x - 4.6, 1.3, top.z - 0.45); sb.box('B', '#2b303a', 0.2, 2.6, 0.2, top.x - 1.4, 1.3, top.z - 0.45); G.scene.add(sb.finish(new THREE.Group()));
    G.interact.add({ pos: { x: top.x - 1, y: 0, z: top.z }, r: 3, yTol: 2, label: () => `Canal Dash: race three rivals to the sea lock (◈20)${G.state.best.canal ? ` · best ${G.state.best.canal.toFixed(1)} s` : ''}`, enabled: () => !this.race && !G.coast.craft && !G.minigame, use: () => { if (G.economy.spend(20, 'Canal Dash entry')) this.start(); } });
  }
  start() {
    const p = G.player; if (p.state !== 'walk') return;
    G.ui.fade(() => {
      const C = G.coast, b = C.boats.canal, yaw = this.path.sample(10, this.v), nx = Math.cos(yaw), nz = -Math.sin(yaw);
      b.pos.set(this.v.x + nx * -7.5, 0, this.v.z + nz * -7.5); b.yaw = yaw; C.embark('canal');
      this.rivals.forEach((r) => { r.s = 10; r.v = 0; r.done = false; r.g.visible = true; });
      this.race = { phase: 'count', t: 3.6, n: 4, gate: 0, time: 0, place: 1, done: 0, prev: b.pos.clone(), start: b.pos.clone() };
      this.showGates();
      G.ui.toast('Canal Dash: W for throttle, A and D to steer. Pass every gate; the last one is at the sea lock.', 'info');
    });
  }
  showGates() { const n = this.race.gate; this.gates.forEach((g, k) => { g.g.visible = k >= n && k < n + 2; g.mat.color.set(k === n ? (k === this.gates.length - 1 ? '#7dff9c' : '#ffd34d') : '#59e0ff'); g.mat.opacity = k === n ? 0.9 : 0.35; }); }
  end(msg) {
    const r = this.race; if (!r) return; this.race = null;
    for (const g of this.gates) g.g.visible = false; for (const q of this.rivals) q.g.visible = false;
    G.ui.setObjective(null);
    const C = G.coast;
    G.ui.fade(() => { if (C.craft === C.boats.canal) { C.boats.canal.dock = G.metro.landings[3]; C.disembark(); C.boats.canal.dock = G.metro.landings[0]; } if (msg) G.ui.toast(msg, 'info'); });
  }
  finish() {
    const r = this.race, place = 1 + r.done, s = G.state; r.phase = 'done'; r.t = 3; r.place = place;
    const best = !s.best.canal || r.time < s.best.canal; if (best) s.best.canal = +r.time.toFixed(1);
    G.ui.flash(`${ORD[place - 1].toUpperCase()} · ${r.time.toFixed(1)} s`, 3);
    if (PRIZE[place - 1]) G.economy.earn(PRIZE[place - 1], `Canal Dash, ${ORD[place - 1]} place`);
    if (best) G.ui.toast('A new personal best on the canal.', 'good');
    G.state.done.canalRace = true; if (place === 1) G.state.done.canalWin = true;
  }
  update(dt, t) {
    const r = this.race; if (!r) return;
    const C = G.coast, b = C.boats.canal, T = this.path.total;
    if (C.craft !== b) return this.end('You left the boat: race abandoned.');
    if (r.phase === 'count') {
      r.t -= dt; const n = Math.ceil(r.t - 0.6); b.pos.copy(r.start); b.v = 0;
      if (n !== r.n) { r.n = n; G.ui.flash(n > 0 ? String(n) : 'GO', 0.8); if (G.audio) G.audio.blip(n > 0 ? 440 : 880, 0.12); }
      if (r.t <= 0.6) r.phase = 'run';
    } else if (r.phase === 'run') {
      r.time += dt;
      if (r.time > 150) return this.end('Race timed out.');
      const g = this.gates[r.gate], d0 = (r.prev.x - g.c.x) * g.nx + (r.prev.z - g.c.z) * g.nz, d1 = (b.pos.x - g.c.x) * g.nx + (b.pos.z - g.c.z) * g.nz;
      if (d0 < 0 && d1 >= 0 && Math.abs((b.pos.x - g.c.x) * g.nz - (b.pos.z - g.c.z) * g.nx) < 10.5) {
        r.gate++; if (G.audio) G.audio.blip(700 + r.gate * 20, 0.08);
        if (r.gate === this.gates.length) this.finish(); else this.showGates();
      }
      r.prev.copy(b.pos);
    } else { r.t -= dt; if (r.t <= 0) return this.end(); }
    // rivals: follow their lane, ease off for the bend, a little rubber-banding
    const g = this.gates[Math.min(r.gate, this.gates.length - 1)], mine = Math.max(0, g.s - Math.hypot(b.pos.x - g.c.x, b.pos.z - g.c.z));
    let ahead = 0;
    for (const q of this.rivals) {
      if (r.phase !== 'count' && !q.done) {
        const h0 = this.path.sample(q.s, this.v), h1 = this.path.sample(Math.min(T, q.s + 22), this.v);
        let target = Math.abs(angDelta(h0, h1)) > 0.25 ? q.vc : q.vmax; const diff = q.s - mine;
        if (diff > 60) target *= 0.9; else if (diff < -60) target *= 1.08;
        q.v = damp(q.v, target, 1.2, dt); q.s += q.v * dt;
        if (q.s >= T - 4) { q.done = true; q.s = T - 4; if (r.phase === 'run') r.done++; }
      }
      if (q.s > mine) ahead++;
      const yaw = this.path.sample(q.s, this.v), turn = angDelta(q.yaw, yaw); q.yaw += turn * Math.min(1, 5 * dt);
      q.x = this.v.x + Math.cos(yaw) * q.lane; q.z = this.v.z - Math.sin(yaw) * q.lane;
      q.g.position.set(q.x, W + 0.02 + Math.sin(t * 3 + q.lane) * 0.04 + Math.min(0.25, q.v * 0.01), q.z); q.g.rotation.set(-Math.min(0.12, q.v * 0.006), q.yaw, clamp(-turn * 4, -0.4, 0.4));
      // a knock if you run into one
      const dx = b.pos.x - q.x, dz = b.pos.z - q.z, d = Math.hypot(dx, dz);
      if (d < 2.4 && d > 0.01) { b.pos.x += (dx / d) * (2.4 - d); b.pos.z += (dz / d) * (2.4 - d); b.v *= 0.9; }
    }
    r.place = 1 + (r.phase === 'run' ? ahead : r.done);
    if (r.phase !== 'done') G.ui.setObjective({ title: 'Canal Dash', text: r.phase === 'count' ? 'Get ready' : `${ORD[Math.min(3, r.place - 1)]} of 4 · gate ${Math.min(r.gate + 1, this.gates.length)} of ${this.gates.length} · ${r.time.toFixed(1)} s`, sub: `${Math.round(Math.abs(b.v) * 3.6)} km/h · mind the bend after the long straight` });
  }
}
