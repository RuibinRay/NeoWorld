// Ring Road GP: a two-lap hoverbike race around the district ring road against three rival
// riders. Entering lends you a Kestrel if you do not have yours out.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { buildVehicle } from '../data/vehicles.js';
import { makeHumanoid, animateRig } from '../entities/rigs.js';
import { neon } from '../world/materials.js';
import { Career } from './career.js';
import { PathLine, roundedRectLoop, angDelta, clamp, damp, dampAngle } from '../core/util.js';

const LAPS = 2, NG = 16, PRIZE = [700, 400, 200, 60], ORD = ['1st', '2nd', '3rd', '4th'];

export class Racing {
  constructor() {
    this.path = new PathLine(roundedRectLoop(-182, 182, -182, 182, 0, 16, 6), true);
    const T = this.path.total; this.s0 = T - 264; this.gap = T / NG; this.gp = null; this.o = new THREE.Vector3();
    // gates: holographic arches, only the next two are shown
    const post = new THREE.BoxGeometry(0.4, 7, 0.4), bar = new THREE.BoxGeometry(11.4, 0.4, 0.4);
    this.gates = [];
    for (let k = 0; k < NG; k++) {
      const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: 0x59e0ff, transparent: true, opacity: 0.5 });
      for (const sx of [-5.5, 5.5]) { const p = new THREE.Mesh(post, mat); p.position.set(sx, 3.5, 0); g.add(p); }
      const b = new THREE.Mesh(bar, mat); b.position.y = 7; g.add(b);
      const yaw = this.path.sample(this.s0 + (k + 1) * this.gap, g.position); g.rotation.y = yaw; g.visible = false; G.scene.add(g);
      this.gates.push({ g, mat, c: g.position, nx: Math.sin(yaw), nz: Math.cos(yaw) });
    }
    this.rivals = ['#ff7ad9', '#7dff9c', '#ffffff'].map((hex, i) => {
      const b = buildVehicle('kestrel', hex), rider = makeHumanoid({ kind: 'android', shell: '#20262f', top: hex, bottom: '#20262f', accent: hex, height: 1.75 });
      rider.root.position.copy(b.seat); b.g.add(rider.root); b.g.visible = false; b.g.rotation.order = 'YXZ'; G.scene.add(b.g);
      return { g: b.g, rider, pod: b.podMat, s: 0, v: 0, lane: [-3, 3, -1][i], vmax: [32, 33.5, 35][i], vcorner: [22, 23, 24][i], yaw: 0, done: false, name: ['Rook', 'Vex', 'Halcyon-9'][i] };
    });
    this.prev = new THREE.Vector3();
  }
  showGates() { const n = this.gp.gate; this.gates.forEach((g, k) => { const d = (k - (n % NG) + NG) % NG; g.g.visible = d < 2 && n + d < NG * LAPS; g.mat.color.set(d === 0 ? '#ffd34d' : '#59e0ff'); g.mat.opacity = d === 0 ? 0.9 : 0.35; }); }
  start() {
    const car = G.car, p = G.player;
    if (p.state !== 'walk' || this.gp || G.minigame) return G.ui.toast('Finish what you are doing first.', 'info');
    if (G.jobs) { G.jobs.endTaxi(); G.jobs.endRace(); if (G.jobs.cargo) G.jobs.cargo = null; }
    G.ui.fade(() => {
      const loan = car.model !== 'kestrel';
      this.gp = { phase: 'count', t: 3.6, n: 4, gate: 0, time: 0, place: 1, ahead: 0, back: { x: car.pos.x, y: car.pos.y, z: car.pos.z, yaw: car.yaw, model: car.model, paint: car.paint, bat: car.battery, hull: car.hull, loan }, foot: { x: p.pos.x, y: p.pos.y, z: p.pos.z } };
      if (loan) car.setModel('kestrel');
      car.battery = 100; car.hull = 100;
      const yaw = this.path.sample(this.s0 - 5, this.o);
      car.pos.set(this.o.x + Math.cos(yaw) * 1.2, car.ride + 0.45, this.o.z - Math.sin(yaw) * 1.2); car.yaw = yaw; car.vel.set(0, 0, 0); car.mode = 'drive'; car.locked = true; car.board(p);
      this.rivals.forEach((r, i) => { r.s = this.s0 + 3 + i * 5; r.v = 0; r.done = false; r.g.visible = true; });
      this.prev.copy(car.pos); this.showGates();
      G.ui.toast(loan ? 'Ring Road GP: you are on a loaner Kestrel. Two laps. Stay low and hit every gate.' : 'Ring Road GP: two laps. Stay low and hit every gate.', 'info');
    });
  }
  // Put everything back where it was and pay out.
  end(result) {
    const gp = this.gp; if (!gp) return;
    const car = G.car, p = G.player, b = gp.back; this.gp = null;
    for (const g of this.gates) g.g.visible = false; for (const r of this.rivals) r.g.visible = false;
    G.ui.setObjective(null);
    G.ui.fade(() => {
      if (p.state === 'drive') car.eject(p, gp.foot.x, gp.foot.y, gp.foot.z); else p.pos.set(gp.foot.x, gp.foot.y, gp.foot.z);
      car.locked = false; if (b.loan) { car.setModel(b.model, true); car.setPaint(b.paint); }
      car.battery = b.bat; car.hull = b.hull; car.pos.set(b.x, b.y, b.z); car.yaw = b.yaw; car.vel.set(0, 0, 0); car.mode = 'parked';
      if (result) G.ui.toast(result, 'info');
    });
  }
  update(dt, t) {
    const gp = this.gp; if (!gp) return;
    const car = G.car, T = this.path.total;
    if (gp.phase === 'count') {
      gp.t -= dt; const n = Math.ceil(gp.t - 0.6);
      if (n !== gp.n) { gp.n = n; G.ui.flash(n > 0 ? String(n) : 'GO', 0.8); if (G.audio) G.audio.blip(n > 0 ? 440 : 880, 0.12); }
      if (gp.t <= 0.6) { gp.phase = 'run'; car.locked = false; }
    } else if (gp.phase === 'run') {
      gp.time += dt;
      if (G.player.state !== 'drive') return this.end('You left the bike: race abandoned.');
      if (gp.time > 260) return this.end('Race timed out.');
      const g = this.gates[gp.gate % NG];
      const d0 = (this.prev.x - g.c.x) * g.nx + (this.prev.z - g.c.z) * g.nz, d1 = (car.pos.x - g.c.x) * g.nx + (car.pos.z - g.c.z) * g.nz;
      if (d0 < 0 && d1 >= 0 && Math.abs((car.pos.x - g.c.x) * g.nz - (car.pos.z - g.c.z) * g.nx) < 7.5 && car.pos.y < 12) {
        gp.gate++; if (G.audio) G.audio.blip(700, 0.08);
        if (gp.gate === NG * LAPS) return this.finish();
        if (gp.gate % NG === 0) G.ui.flash('FINAL LAP', 1.5);
        this.showGates();
      }
      this.prev.copy(car.pos);
    } else { gp.t -= dt; if (gp.t <= 0) return this.end(); }
    // rivals: follow the line, slow for corners, a little rubber-banding to keep it a race
    const g = this.gates[gp.gate % NG], toGate = Math.hypot(car.pos.x - g.c.x, car.pos.z - g.c.z);
    const mine = gp.gate * this.gap + clamp(this.gap - toGate, 0, this.gap);
    let ahead = 0;
    for (const r of this.rivals) {
      if (gp.phase !== 'count' && !r.done) {
        const h0 = this.path.sample(r.s, this.o), h1 = this.path.sample(r.s + 26, this.o), prog = r.s - this.s0, diff = prog - mine;
        let target = Math.abs(angDelta(h0, h1)) > 0.2 ? r.vcorner : r.vmax;
        if (diff > 70) target *= 0.88; else if (diff < -70) target *= 1.1;
        r.v = damp(r.v, target, 1.1, dt); r.s += r.v * dt;
        if (prog >= LAPS * T) { r.done = true; if (gp.phase === 'run') gp.ahead++; }
      }
      if (r.s - this.s0 > mine) ahead++;
      const yaw = this.path.sample(r.s, this.o), turn = angDelta(r.yaw, yaw);
      r.yaw += turn * Math.min(1, 6 * dt);
      r.g.position.set(this.o.x - Math.cos(yaw) * r.lane, 1.07 + Math.sin(t * 2.2 + r.lane) * 0.03, this.o.z + Math.sin(yaw) * r.lane);
      r.g.rotation.set(r.v > 1 ? 0.06 : 0, r.yaw, clamp(-turn * 5, -0.5, 0.5));
      r.pod.color.setRGB(0.35 + r.v * 0.02, 0.9 + r.v * 0.02, 1.2 + r.v * 0.02);
      animateRig(r.rider, dt, 'drive', 0);
    }
    gp.place = 1 + (gp.phase === 'run' ? ahead : gp.ahead);
    if (gp.phase !== 'done') G.ui.setObjective({ title: 'Ring Road GP', text: gp.phase === 'count' ? 'Get ready' : `${ORD[gp.place - 1]} of 4 · lap ${Math.min(LAPS, Math.floor(gp.gate / NG) + 1)} / ${LAPS} · ${gp.time.toFixed(1)} s`, sub: 'Shift boosts. Gates only count below 12 m.' });
  }
  finish() {
    const gp = this.gp, s = G.state, place = 1 + gp.ahead; gp.phase = 'done'; gp.t = 3.5; gp.place = place;
    const best = !s.best.gp || gp.time < s.best.gp; if (best) s.best.gp = gp.time;
    G.ui.flash(`${ORD[place - 1].toUpperCase()} PLACE · ${gp.time.toFixed(1)} s`, 3.4);
    G.economy.earn(PRIZE[place - 1], `Ring Road GP, ${ORD[place - 1]} place`); Career.add('racer', 'gp'); G.addNews('race');
    if (best) G.ui.toast('New personal best on the ring road.', 'good');
    G.ui.setObjective({ title: 'Ring Road GP', text: `Finished ${ORD[place - 1]}`, sub: `${gp.time.toFixed(1)} s` });
  }
}
