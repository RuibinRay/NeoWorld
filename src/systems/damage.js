// Damage to the city in a fight. Buildings do not fall down (at this size that would cost far too
// much), but they show it: scorched, cracked holes on walls and craters in the street, chunks of
// facade that fall and settle on the pavement, fires with smoke. After a while a city repair drone
// comes down, welds for a few seconds, and the damage and debris are gone.
// Marks are one instanced mesh, debris another; fires and sparks go through G.fx.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { clamp } from '../core/util.js';
import { makeCanvas, canvasTex } from '../world/materials.js';
import { makeDrone } from '../entities/rigs.js';

const MAX_MARKS = 240, MAX_DEBRIS = 320, REPAIR_AFTER = 45;
const DEBRIS_COL = ['#5b616b', '#7a8088', '#3a3f47', '#9aa3ad', '#2a3340', '#6b625a', '#4a5568'];
const Zf = new THREE.Vector3(0, 0, 1);

function scorch() {
  const S = 256, c = makeCanvas(S, S), g = c.getContext('2d'), h = S / 2;
  const r = g.createRadialGradient(h, h, 6, h, h, h - 4);
  r.addColorStop(0, 'rgba(6,6,8,1)'); r.addColorStop(0.3, 'rgba(18,16,16,0.9)'); r.addColorStop(0.62, 'rgba(34,30,28,0.5)'); r.addColorStop(1, 'rgba(34,30,28,0)');
  g.fillStyle = r; g.fillRect(0, 0, S, S);
  g.strokeStyle = 'rgba(4,4,5,0.95)'; g.lineCap = 'round';
  for (let k = 0; k < 11; k++) {           // cracks running out from the middle
    let x = h, y = h, a = (k / 11) * Math.PI * 2 + Math.random() * 0.4; g.lineWidth = 4;
    g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < 7; s++) { a += (Math.random() - 0.5) * 0.9; x += Math.cos(a) * 15; y += Math.sin(a) * 15; g.lineTo(x, y); }
    g.stroke(); g.lineWidth = 1.5;
  }
  g.fillStyle = 'rgba(0,0,0,1)'; g.beginPath();                                        // the hole itself
  for (let k = 0; k <= 12; k++) { const a = (k / 12) * Math.PI * 2, rr = 26 + Math.random() * 16; g[k ? 'lineTo' : 'moveTo'](h + Math.cos(a) * rr, h + Math.sin(a) * rr); }
  g.fill();
  return canvasTex(c, false);
}

export class Damage {
  constructor() {
    const mm = new THREE.MeshBasicMaterial({ map: scorch(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    this.marks = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mm, MAX_MARKS); this.marks.count = 0; this.marks.frustumCulled = false; this.marks.renderOrder = 1;
    this.marks.setColorAt(0, new THREE.Color(1, 1, 1));
    this.debrisMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0.05 }), MAX_DEBRIS); this.debrisMesh.count = 0; this.debrisMesh.frustumCulled = false;
    this.debrisMesh.setColorAt(0, new THREE.Color(1, 1, 1));
    G.scene.add(this.marks, this.debrisMesh);
    this.markList = []; this.debris = []; this.fires = []; this.scars = []; this.drones = [];
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.s = new THREE.Vector3(); this.v = new THREE.Vector3(); this.c = new THREE.Color();
    this.reported = 0;
  }
  // which way the surface at p faces (the box it lies on), or back along the ray if none is found
  normalAt(p, dir) {
    const n = new THREE.Vector3(), boxes = G.colliders.near(p.x, p.z, 2); let best = 0.12;
    for (const b of boxes) {
      if (p.x < b.minX - 0.12 || p.x > b.maxX + 0.12 || p.y < b.minY - 0.12 || p.y > b.maxY + 0.12 || p.z < b.minZ - 0.12 || p.z > b.maxZ + 0.12) continue;
      for (const [d, nx, ny, nz] of [[Math.abs(p.x - b.minX), -1, 0, 0], [Math.abs(p.x - b.maxX), 1, 0, 0], [Math.abs(p.y - b.maxY), 0, 1, 0], [Math.abs(p.y - b.minY), 0, -1, 0], [Math.abs(p.z - b.minZ), 0, 0, -1], [Math.abs(p.z - b.maxZ), 0, 0, 1]]) if (d < best) { best = d; n.set(nx, ny, nz); }
    }
    if (best < 0.12) return n;
    if (dir) return n.copy(dir).negate().normalize();
    return n.set(0, 1, 0);
  }
  // A blow lands on a surface at p. power: about 1 for a punch, 3 for a blast, 6 for a boss's club.
  impact(p, n, power = 1, kind = 'blunt', o = {}) {
    power = clamp(power, 0.3, 8);
    if (!o.fromWreck && G.wrecks && G.wrecks.impact(p, power, kind, o)) return;   // it hit a road vehicle: the vehicle takes it (no scorch hanging in the air)
    const scar = this.scarAt(p, n);
    if (power >= 0.8) this.mark(p, n, clamp(0.6 + power * 0.75, 0.7, 7) * (0.8 + Math.random() * 0.4), kind === 'fire' ? 0.55 : kind === 'web' ? 0 : 0.95, scar);
    const k = Math.round(clamp(power * 2.6, 1, 16));
    if (kind !== 'web') for (let i = 0; i < k; i++) this.chunk(p, n, power, scar);
    const fx = G.fx;
    if (fx) {
      const q = this.v.copy(p).addScaledVector(n, 0.3);
      fx.dust(q, Math.round(4 + power * 3), 0.5 + power * 0.3, n.y > 0.5 ? '#8d8a82' : '#7d8188');
      if (kind === 'shock' || kind === 'energy') fx.spark(q, o.color || '#b9a2ff', 8 + power * 3, 8, 0.4, 0.14);
      if (kind === 'fire' || power >= 2.5) fx.smoke(q, 2 + Math.round(power), '#30333a', 1.2 + power * 0.3);
    }
    if ((kind === 'fire' && Math.random() < 0.6) || (power >= 3.5 && Math.random() < 0.45)) { if (this.fires.length > 14) this.fires.shift(); this.fires.push({ p: p.clone().addScaledVector(n, 0.25), t: 10 + Math.random() * 12, scar }); }
    if (G.audio && !o.quiet) { G.audio.thud(clamp(power / 4, 0.2, 1)); if (power > 2.5) G.audio.burst(0.6, 0.12, 300); if (power >= 1.5 && kind !== 'web' && G.sfx) G.sfx.crack(p, power); }
    if (power > 2) G.fx && G.fx.shake(Math.min(0.5, power * 0.05));
    // property damage by a hero outside a fight with villains: the patrol keeps count
    if (o.byHero && !(G.villains && G.villains.busy()) && G.events) { this.reported += power; if (this.reported > 6) { this.reported = 0; G.events.report('damage', 1.6); } }
  }
  // cast along a ray; damage the first wall (or the street) within range. Returns the hit point or null.
  wallHit(o, dir, range, power, kind = 'blunt', opts = {}) {
    const d = G.colliders.raycast(o.x, o.y, o.z, dir.x, dir.y, dir.z, range);
    let p = null;
    if (d < range) p = this.v.copy(o).addScaledVector(dir, d).clone();
    else { const e = this.v.copy(o).addScaledVector(dir, range), g = G.colliders.groundAt(e.x, e.z, e.y + 0.5, 1, 0.2); if (e.y <= g + 0.3) p = new THREE.Vector3(e.x, g, e.z); }
    if (!p) return null;
    this.impact(p, this.normalAt(p, dir), power, kind, opts);
    return p;
  }
  // an explosion at c: a crater if it is near the ground, and every wall within reach takes some of it
  burst(c, radius, power, kind = 'blunt', opts = {}) {
    if (G.wrecks && !opts.fromWreck) G.wrecks.blast(c, radius, power * 0.6, opts);   // road vehicles: a power's blast dents and sets them smoking, it takes a car's own explosion to set off the next
    const g = G.colliders.groundAt(c.x, c.z, c.y + 0.5, 3, 0.3);
    if (c.y - g < radius * 0.7) this.impact(new THREE.Vector3(c.x, g, c.z), new THREE.Vector3(0, 1, 0), power * (1 - (c.y - g) / radius), kind, { ...opts, quiet: true });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2, dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), d = G.colliders.raycast(c.x, c.y, c.z, dir.x, 0, dir.z, radius);
      if (d < radius) { const p = c.clone().addScaledVector(dir, d); this.impact(p, this.normalAt(p, dir), power * (1 - d / radius) * 0.8, kind, { ...opts, quiet: true }); }
    }
    if (G.audio) G.audio.burst(0.9, clamp(power / 10, 0.1, 0.5), 160);
    if (G.sfx) { G.sfx.play('boom', c, clamp(power / 6, 0.4, 1.3)); G.sfx.crack(c, power); }
  }
  scarAt(p, n) {
    for (const s of this.scars) if (!s.fixing && s.p.distanceToSquared(p) < 64) { s.t = Math.min(s.t, 10); return s; }
    const s = { p: p.clone(), n: n.clone(), t: 0, marks: [], debris: [], fixing: null };
    this.scars.push(s); return s;
  }
  mark(p, n, size, dark, scar) {
    if (dark <= 0) return;
    if (this.markList.length >= MAX_MARKS) this.dropMark(this.markList[0]);
    const e = { p: p.clone().addScaledVector(n, 0.04), n: n.clone(), size, spin: Math.random() * 6.28, dark, k: 1, scar };
    this.markList.push(e); scar.marks.push(e);
  }
  dropMark(e) { const i = this.markList.indexOf(e); if (i >= 0) this.markList.splice(i, 1); if (e.scar) { const j = e.scar.marks.indexOf(e); if (j >= 0) e.scar.marks.splice(j, 1); } }
  chunk(p, n, power, scar) {
    if (this.debris.length >= MAX_DEBRIS) this.dropChunk(this.debris[0]);
    const s = 0.12 + Math.random() * (0.18 + power * 0.06), sp = 2 + Math.random() * (2 + power);
    const v = new THREE.Vector3(n.x * sp + (Math.random() - 0.5) * 3, n.y * sp + 1.5 + Math.random() * 3, n.z * sp + (Math.random() - 0.5) * 3);
    const e = { p: p.clone().addScaledVector(n, 0.3), v, s: new THREE.Vector3(s * (0.7 + Math.random() * 0.8), s * (0.5 + Math.random() * 0.6), s * (0.7 + Math.random() * 0.8)), q: new THREE.Quaternion().random(), w: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), ws: 4 + Math.random() * 8,
      col: new THREE.Color(DEBRIS_COL[Math.floor(Math.random() * DEBRIS_COL.length)]), rest: false, k: 1, scar };
    this.debris.push(e); scar.debris.push(e);
  }
  dropChunk(e) { const i = this.debris.indexOf(e); if (i >= 0) this.debris.splice(i, 1); if (e.scar) { const j = e.scar.debris.indexOf(e); if (j >= 0) e.scar.debris.splice(j, 1); } }

  update(dt, t) {
    const { m, q, s, c } = this, col = G.colliders, dq = new THREE.Quaternion();
    // debris falls, bounces and settles
    for (const e of this.debris) {
      if (!e.rest) {
        e.v.y -= 22 * dt; e.p.addScaledVector(e.v, dt);
        dq.setFromAxisAngle(e.w, e.ws * dt); e.q.premultiply(dq);
        const g = col.groundAt(e.p.x, e.p.z, e.p.y + 0.6, 0.8, 0.1), lo = e.p.y - e.s.y * 0.5;
        if (lo <= g) { e.p.y = g + e.s.y * 0.5; e.v.y = Math.abs(e.v.y) > 2 ? -e.v.y * 0.3 : 0; e.v.x *= 0.55; e.v.z *= 0.55; e.ws *= 0.5; if (Math.abs(e.v.y) + Math.hypot(e.v.x, e.v.z) < 0.7) { e.rest = true; e.q.setFromAxisAngle(Zf.set(0, 1, 0), Math.random() * 6.28); } }
        if (e.p.y < -30) e.rest = true;
      }
    }
    // fires burn down
    for (let i = this.fires.length - 1; i >= 0; i--) { const f = this.fires[i]; f.t -= dt; if (f.t <= 0) { this.fires.splice(i, 1); continue; } if (G.fx && (G.player.pos.distanceToSquared(f.p) < 260 * 260)) { G.fx.fire(f.p, f.t < 3 ? 1 : 2, 0.7); if (Math.random() < dt * 4) G.fx.smoke(f.p, 1, '#2a2c31', 1.8, 2.4); } }
    // repairs: after a while a drone comes to each damaged spot
    for (const sc of this.scars) {
      sc.t += dt;
      if (!sc.fixing && sc.t > REPAIR_AFTER && this.drones.filter((d) => d.busy).length < 2 && !(G.villains && G.villains.busyNear(sc.p))) this.startRepair(sc);
    }
    for (const d of this.drones) if (d.busy) this.droneStep(d, dt, t);
    this.scars = this.scars.filter((sc) => !(sc.done) && (sc.marks.length || sc.debris.length || sc.fixing));
    // draw
    let n = 0;
    for (const e of this.markList) {
      q.setFromUnitVectors(Zf.set(0, 0, 1), e.n); dq.setFromAxisAngle(Zf, e.spin); q.multiply(dq);
      m.compose(e.p, q, s.setScalar(e.size * e.k)); this.marks.setMatrixAt(n, m); this.marks.setColorAt(n, c.setScalar(e.dark)); n++;
    }
    this.marks.count = n; this.marks.instanceMatrix.needsUpdate = true; if (this.marks.instanceColor) this.marks.instanceColor.needsUpdate = true;
    n = 0;
    for (const e of this.debris) { m.compose(e.p, e.q, s.copy(e.s).multiplyScalar(e.k)); this.debrisMesh.setMatrixAt(n, m); this.debrisMesh.setColorAt(n, e.col); n++; }
    this.debrisMesh.count = n; this.debrisMesh.instanceMatrix.needsUpdate = true; if (this.debrisMesh.instanceColor) this.debrisMesh.instanceColor.needsUpdate = true;
  }
  startRepair(sc) {
    let d = this.drones.find((x) => !x.busy);
    if (!d) {
      const r = makeDrone('repair'); if (r.parcel) r.parcel.visible = false; r.root.scale.setScalar(1.4); G.scene.add(r.root);
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.2, 0.4) })); light.position.y = 0.25; r.root.add(light);
      d = { rig: r, pos: new THREE.Vector3(), busy: false }; this.drones.push(d);
    }
    d.busy = true; d.sc = sc; d.phase = 'in'; d.t = 0; sc.fixing = d;
    d.pos.set(sc.p.x + 20, sc.p.y + 45, sc.p.z + 20); d.rig.root.visible = true;
    d.at = sc.p.clone().addScaledVector(sc.n, sc.n.y > 0.5 ? 0 : 1.8).add(this.v.set(0, sc.n.y > 0.5 ? 1.6 : 0.4, 0));
  }
  droneStep(d, dt, t) {
    const sc = d.sc, root = d.rig.root;
    if (d.phase === 'in' || d.phase === 'out') {
      const to = d.phase === 'in' ? d.at : this.v.set(d.at.x - 20, d.at.y + 50, d.at.z + 10), dx = to.x - d.pos.x, dy = to.y - d.pos.y, dz = to.z - d.pos.z, L = Math.hypot(dx, dy, dz), st = Math.min(L, 16 * dt);
      if (L > 0.05) d.pos.add(this.v.set(dx, dy, dz).multiplyScalar(st / L));
      if (L < 0.3) { if (d.phase === 'in') { d.phase = 'weld'; d.t = 0; } else { d.busy = false; root.visible = false; sc.done = true; } }
    } else if (d.phase === 'weld') {
      d.t += dt;
      if (G.fx && Math.random() < dt * 30) G.fx.spark(this.v.copy(sc.p).addScaledVector(sc.n, 0.1), '#ffe08a', 3, 3.5, 0.3, 0.08, 6);
      const k = clamp(1 - (d.t - 2.5) / 1.2, 0, 1);
      for (const e of sc.marks) e.k = k; for (const e of sc.debris) e.k = k;
      for (const f of this.fires) if (f.scar === sc) f.t = Math.min(f.t, 0.5);
      if (d.t > 3.8) { for (const e of [...sc.marks]) this.dropMark(e); for (const e of [...sc.debris]) this.dropChunk(e); d.phase = 'out'; }
    }
    root.position.set(d.pos.x, d.pos.y + Math.sin(t * 3) * 0.08, d.pos.z);
    for (const r of d.rig.rotors) r.rotation.z += dt * 40;
  }
  // everything mended at once (leaving Hero Mode for a long time, a new day)
  clear() { this.markList.length = 0; this.debris.length = 0; this.fires.length = 0; for (const sc of this.scars) if (sc.fixing) { sc.fixing.busy = false; sc.fixing.rig.root.visible = false; } this.scars.length = 0; }
}
