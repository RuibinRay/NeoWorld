// Remote drone piloting. You stand still and fly a small racing/courier drone from a chase
// view: the Commons Drone Slalom (time trial through rings in the park) and drone delivery
// shifts (three parcels to rooftops around the district).
import * as THREE from 'three';
import { G } from '../core/game.js';
import { makeDrone } from '../entities/rigs.js';
import { Career } from './career.js';
import { money } from '../ui/ui.js';
import { clamp, dampAngle, RNG } from '../core/util.js';

const SLALOM = [[0, 3, -30], [8, 4, -18], [16, 6, -4], [12, 5, 10], [13, 5.5, 27], [6, 4, 40], [-12, 3.4, 36.3], [-20, 4, 24], [-26, 6, 6], [-14, 3, -6], [0, 6.2, 0], [14, 5, -10], [22, 4, -26], [6, 3, -36]];
const MEDALS = [[20, 'GOLD', 300], [27, 'SILVER', 180], [38, 'BRONZE', 90]];
const DROPS = [['the Printed Petal roof garden', 12, 23.8, -84], ['the Old Quarter rooftops', 0, 16.4, 86], ['the Garden Terrace', 86, 45.4, 36], ['the Kinetic tower roof', 100, 121.2, -12], ['the Halcyon deck', -30, 151.4, -58]];
const RING_R = 2.7;

export class DroneOps {
  constructor() {
    this.rig = makeDrone('delivery'); this.rig.root.scale.setScalar(0.9); this.rig.root.rotation.order = 'YXZ'; this.rig.root.visible = false; G.scene.add(this.rig.root);
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.prev = new THREE.Vector3(); this.yaw = 0; this.camYaw = 0; this.run = null; this.rng = new RNG(31);
    const geo = new THREE.TorusGeometry(RING_R, 0.12, 8, 32), z = new THREE.Vector3(0, 0, 1);
    this.rings = SLALOM.map((p, i) => {
      const a = SLALOM[Math.max(0, i - 1)], b = SLALOM[Math.min(SLALOM.length - 1, i + 1)], n = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x59e0ff, transparent: true, opacity: 0.4 }));
      m.position.set(p[0], p[1], p[2]); m.quaternion.setFromUnitVectors(z, n); m.visible = false; G.scene.add(m);
      return { m, c: m.position, n };
    });
    this.target = new THREE.Mesh(new THREE.TorusGeometry(3, 0.16, 8, 36), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd34d).multiplyScalar(1.6) }));
    this.target.rotation.x = Math.PI / 2; this.target.visible = false; G.scene.add(this.target);
  }
  begin(x, y, z, yaw) {
    const p = G.player;
    if (p.state !== 'walk' || this.run || G.minigame || (G.racing && G.racing.gp)) { G.ui.toast('Finish what you are doing first.', 'info'); return false; }
    if (G.jobs.courier) { G.ui.toast('Hand over your courier parcel first: you need both hands for the controller.', 'info'); return false; }
    p.state = 'busy'; p.busyAnim = 'idle'; p.faceCam = false; p.board = false; p.crouch = false; p.rig.carry = true; p.vel.set(0, 0, 0);
    this.pos.set(x, y, z); this.vel.set(0, 0, 0); this.yaw = this.camYaw = yaw; this.prev.copy(this.pos); this.rig.root.visible = true;
    return true;
  }
  paint() { const i = this.run.idx; this.rings.forEach((r, k) => { r.m.visible = k >= i && k <= i + 2; r.m.material.color.set(k === i ? (i === 0 ? '#7dff9c' : '#ffd34d') : '#59e0ff').multiplyScalar(k === i ? 1.7 : 1); r.m.material.opacity = k === i ? 0.95 : 0.3; }); }
  startSlalom() {
    if (!this.begin(-5, 1.8, -35.5, Math.atan2(5, 5.5))) return;
    this.run = { kind: 'race', idx: 0, t: 0, running: false }; this.paint();
    G.ui.toast('Commons Drone Slalom: W/S thrust, A/D turn, Space up, C down. F or Esc recalls the drone.', 'info');
  }
  startDeliveries() {
    const p = G.player;
    if (!this.begin(p.pos.x + Math.sin(p.yaw) * 1.5, p.pos.y + 1.7, p.pos.z + Math.cos(p.yaw) * 1.5, p.yaw)) return;
    const pool = DROPS.slice(), list = []; while (list.length < 3) list.push(pool.splice(Math.floor(this.rng.next() * pool.length), 1)[0]);
    this.run = { kind: 'deliver', list, i: 0, t: 0, earned: 0 }; this.aim();
    G.ui.toast('Drone delivery: three parcels. Fly into each gold ring. F or Esc recalls the drone.', 'info');
  }
  aim() { const d = this.run.list[this.run.i]; this.target.position.set(d[1], d[2] + 1.6, d[3]); this.target.visible = true; }
  stop(msg) {
    const p = G.player; this.run = null; this.rig.root.visible = false; this.target.visible = false; for (const r of this.rings) r.m.visible = false;
    if (p.state === 'busy') p.state = 'walk'; p.rig.carry = !!(G.jobs && G.jobs.courier); G.ui.setObjective(null); G.ui.cool = 0.3;
    if (msg) G.ui.toast(msg, 'info');
  }
  markers() { const r = this.run; if (!r) return []; if (r.kind === 'race') { const c = this.rings[r.idx].c; return [{ x: c.x, z: c.z, color: '#7dff9c' }]; } const d = r.list[r.i]; return [{ x: d[1], z: d[3] }]; }

  update(dt, t) {
    const r = this.run; if (!r) return;
    const inp = G.input, col = G.colliders, q = this.pos, v = this.vel, p = G.player;
    if (inp.pressed('KeyF') || inp.pressed('Escape') || p.state !== 'busy') return this.stop('Drone recalled.');
    // flight
    const f = (inp.down('KeyW') ? 1 : 0) - (inp.down('KeyS') ? 1 : 0), yw = (inp.down('KeyA') ? 1 : 0) - (inp.down('KeyD') ? 1 : 0), u = (inp.down('Space') ? 1 : 0) - (inp.down('KeyC') || inp.down('ControlLeft') ? 1 : 0);
    this.yaw += yw * 2.5 * dt;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    v.x += fx * f * 34 * dt; v.z += fz * f * 34 * dt; v.y += u * 26 * dt;
    const fwd = v.x * fx + v.z * fz, lx = v.x - fx * fwd, lz = v.z - fz * fwd, lk = Math.min(1, 4.5 * dt);
    v.x -= lx * lk + v.x * 0.9 * dt; v.z -= lz * lk + v.z * 0.9 * dt; v.y -= v.y * 2.6 * dt;
    const sp = v.length(); if (sp > 30) v.multiplyScalar(30 / sp);
    this.prev.copy(q); q.addScaledVector(v, dt);
    const gy = col.groundAt(q.x, q.z, q.y + 0.3, 0.5, 0.3); if (q.y < gy + 0.4) { q.y = gy + 0.4; if (v.y < 0) v.y = 0; }
    const hit = col.resolveCircle(q, 0.45, q.y - 0.25, q.y + 0.25);
    if (hit) { const vn = v.x * hit.nx + v.z * hit.nz; if (vn < 0) { v.x -= 1.4 * vn * hit.nx; v.z -= 1.4 * vn * hit.nz; if (-vn > 12) { if (G.audio) G.audio.thud(0.4); if (r.kind === 'race' && r.running) { r.t += 2; G.ui.flash('+2 s', 0.8); } } } }
    const dx = q.x - p.pos.x, dy = q.y - p.pos.y, dz = q.z - p.pos.z, dist = Math.hypot(dx, dy, dz);
    if (dist > 330) { v.x -= (dx / dist) * 60 * dt; v.z -= (dz / dist) * 60 * dt; if (!r.warned) { r.warned = true; G.ui.toast('Signal is weak: the drone will not go further from you.', 'warn'); } }
    r.t += r.kind === 'race' && !r.running ? 0 : dt;
    // objectives
    if (r.kind === 'race') {
      const g = this.rings[r.idx];
      const d0 = (this.prev.x - g.c.x) * g.n.x + (this.prev.y - g.c.y) * g.n.y + (this.prev.z - g.c.z) * g.n.z, d1 = (q.x - g.c.x) * g.n.x + (q.y - g.c.y) * g.n.y + (q.z - g.c.z) * g.n.z;
      if (d0 < 0 && d1 >= 0) {
        const px = q.x - g.n.x * d1 - g.c.x, py = q.y - g.n.y * d1 - g.c.y, pz = q.z - g.n.z * d1 - g.c.z;
        if (px * px + py * py + pz * pz < (RING_R + 0.35) ** 2) {
          if (r.idx === 0) { r.running = true; r.t = 0; }
          r.idx++; if (G.audio) G.audio.blip(700 + r.idx * 40, 0.08);
          if (r.idx >= this.rings.length) return this.finishSlalom();
          this.paint();
        }
      }
      G.ui.setObjective({ title: 'Commons Drone Slalom', text: r.running ? `${r.t.toFixed(1)} s · ring ${r.idx} / ${this.rings.length}` : 'Fly through the green ring to start', sub: 'W/S thrust · A/D turn · Space/C height · F recall' });
    } else {
      const d = r.list[r.i], c = this.target.position;
      this.target.rotation.z += dt;
      if (Math.abs(q.y - c.y) < 1.7 && Math.hypot(q.x - c.x, q.z - c.z) < 3) {
        const pay = Math.round((45 + Math.hypot(d[1] - p.pos.x, d[3] - p.pos.z) * 0.2) * Career.mult('courier'));
        G.economy.earn(pay, `parcel to ${d[0]}`); Career.add('courier', 'droneDrops'); r.earned += pay; r.i++;
        if (G.audio) G.audio.blip(880, 0.1);
        if (r.i >= r.list.length) { const fast = r.t < 150; if (fast) G.economy.earn(50, 'fast shift bonus'); G.state.standing = clamp(G.state.standing + 1, -100, 100); return this.stop(`Three parcels delivered in ${Math.round(r.t)} s. Shift earned ${money(r.earned + (fast ? 50 : 0))}.`); }
        this.aim();
      }
      G.ui.setObjective({ title: 'Drone delivery', text: `Parcel ${r.i + 1} of 3: ${d[0]}`, sub: `${Math.round(Math.hypot(q.x - c.x, q.z - c.z))} m away · ring at ${Math.round(c.y)} m · drone at ${Math.round(q.y)} m` });
    }
    // drone + chase camera
    const root = this.rig.root, cam = G.camera;
    root.position.copy(q); root.rotation.set(f * 0.32, this.yaw, -yw * 0.35);
    for (const o of this.rig.rotors) o.rotation.z += dt * 50;
    this.rig.parcel.visible = r.kind === 'deliver';
    this.camYaw = dampAngle(this.camYaw, this.yaw, 9, dt);
    const cx = Math.sin(this.camYaw), cz = Math.cos(this.camYaw);
    cam.up.set(0, 1, 0); cam.position.set(q.x - cx * 2.9, Math.max(0.4, q.y + 1.0), q.z - cz * 2.9); cam.lookAt(q.x + cx * 5, q.y + 0.1, q.z + cz * 5);
    p.yaw = dampAngle(p.yaw, Math.atan2(dx, dz), 5, dt);
  }
  finishSlalom() {
    const t = this.run.t, s = G.state, medal = MEDALS.find((m) => t <= m[0]), best = !s.best.slalom || t < s.best.slalom;
    if (best) s.best.slalom = t;
    G.ui.flash(`${medal ? medal[1] : 'FINISHED'} · ${t.toFixed(1)} s`, 3.2);
    G.economy.earn(medal ? medal[2] : 30, medal ? `slalom ${medal[1].toLowerCase()}` : 'slalom finisher'); Career.add('racer', 'slalom');
    this.stop(best ? 'New personal best on the slalom.' : null);
  }
}
