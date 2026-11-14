// Maglev line 9, to the coast: an elevated line from Meridian Gate (just outside the line 7 loop,
// south-east of Meridian) east along the street, then south between Old Earth and Grand Arbor Park,
// over the canal, to Solara Bay. Three stations with lifts; a three-car train shuttles end to end
// and stops at each. Board on a platform (E), get off at any stop (E).
import * as THREE from 'three';
import { G } from '../core/game.js';
import { PathLine, clamp, damp } from '../core/util.js';
import { std, neon, labelTexture } from '../world/materials.js';
import { mergeMeshes } from '../world/batch.js';

const Y = 16, VMAX = 28;
// the stations: where along the line, which side the platform is on, and the street spot the lift comes down to
const STATIONS = [
  { name: 'Meridian Gate', at: [262, 300], side: [0, 1], street: [262, 0.15, 311.5] },
  { name: 'Arbor Park', at: [420, 700], side: [1, 0], street: [433, 0, 700] },
  { name: 'Solara Bay', at: [420, 1085], side: [1, 0], street: [432.5, 0.15, 1085] },
];

export class CoastLine {
  constructor() {
    const col = G.colliders, group = (this.group = new THREE.Group()); G.scene.add(group);
    // the route: east along z = 300, a curve, south along x = 420
    const pts = [], R = 30;
    for (let x = 232; x <= 420 - R; x += 6) pts.push([x, Y, 300]);
    for (let k = 1; k < 10; k++) { const a = (k / 10) * (Math.PI / 2); pts.push([420 - R + Math.sin(a) * R, Y, 300 + R - Math.cos(a) * R]); }
    for (let z = 300 + R; z <= 1100; z += 6) pts.push([420, Y, z]);
    const path = (this.path = new PathLine(pts, false));
    const steel = std('#c9d2de', 0.35, 0.7), conc = std('#8d939c', 0.8, 0.1), dark = std('#2b303a', 0.5, 0.6), glass = std('#9fd4ff', 0.05, 0.5, { transparent: true, opacity: 0.3 }), cyan = neon('#7fe9ff', 1.4);
    // the guideway: a beam in segments, with a light strip along each side
    const parts = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], len = Math.hypot(b[0] - a[0], b[2] - a[2]), yaw = Math.atan2(b[0] - a[0], b[2] - a[2]), mx = (a[0] + b[0]) / 2, mz = (a[2] + b[2]) / 2;
      const beam = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, len + 0.05), steel); beam.position.set(mx, Y - 0.55, mz); beam.rotation.y = yaw; parts.push(beam);
      for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, len + 0.05), cyan); l.position.set(mx + Math.cos(yaw) * s * 1.12, Y - 0.2, mz - Math.sin(yaw) * s * 1.12); l.rotation.y = yaw; parts.push(l); }
    }
    for (const m of parts) group.add(m);
    mergeMeshes(group, parts);
    // pillars down the middle of the street, kept out of the junctions
    const pil = [], o = {};
    for (let s = 6; s < path.total; s += 30) {
      path.sample(s, o); const along = Math.abs(o.z - 300) < 1 ? o.x : o.z, jn = Math.abs((((along - 60) % 120) + 120) % 120 - 60);
      if (jn < 40 && !(o.z > 640 && o.z < 680)) pil.push([o.x, o.z]);      // mid-block only: at least 20 m from a junction's centre, and not in the canal
    }
    const pm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.55, 0.75, Y - 1, 10), conc, pil.length), m4 = new THREE.Matrix4();
    pil.forEach(([x, z], i) => { m4.makeTranslation(x, (Y - 1) / 2, z); pm.setMatrixAt(i, m4); col.box(x - 0.6, x + 0.6, 0, Y - 1, z - 0.6, z + 0.6, { noCam: true }); });
    pm.computeBoundingSphere(); group.add(pm);
    // stations: a platform beside the track, glass screens all round, a canopy, a sign, a lift down to the street
    this.stations = STATIONS.map((st, k) => {
      let best = 0, bd = 1e9; for (let s = 0; s < path.total; s += 1) { path.sample(s, o); const d = Math.hypot(o.x - st.at[0], o.z - st.at[1]); if (d < bd) { bd = d; best = s; } }
      const [sx, sz] = st.side, ns = sx !== 0, px = st.at[0] + sx * 3.6, pz = st.at[1] + sz * 3.6, hw = ns ? 2.3 : 16, hd = ns ? 16 : 2.3, sp = [];
      const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); group.add(m); sp.push(m); return m; };
      add(new THREE.BoxGeometry(hw * 2, 0.6, hd * 2), conc, px, Y - 0.3, pz); col.box(px - hw, px + hw, Y - 0.6, Y, pz - hd, pz + hd);
      add(new THREE.BoxGeometry(hw * 2 + 1.5, 0.25, hd * 2 + 1.5), dark, px - sx * 0.6, Y + 4.4, pz - sz * 0.6);
      for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(new THREE.BoxGeometry(0.25, 4.4, 0.25), dark, px + cx * (hw - 0.3), Y + 2.2, pz + cz * (hd - 0.3));
      const t = 0.12, h = 1.4;
      for (const [x0, x1, z0, z1] of [[px - hw, px + hw, pz - hd, pz - hd + t], [px - hw, px + hw, pz + hd - t, pz + hd], [px - hw, px - hw + t, pz - hd, pz + hd], [px + hw - t, px + hw, pz - hd, pz + hd]]) { add(new THREE.BoxGeometry(x1 - x0, h, z1 - z0), glass, (x0 + x1) / 2, Y + h / 2, (z0 + z1) / 2); col.box(x0, x1, Y, Y + h, z0, z1, { noCam: true }); }
      add(new THREE.BoxGeometry(ns ? 0.08 : hw * 2, 0.08, ns ? hd * 2 : 0.08), cyan, px + sx * (hw - 0.05), Y + 0.04, pz + sz * (hd - 0.05));     // the platform edge strip, track side
      // the lift: a glass shaft from the street up to the outer edge of the platform
      const [bx, by, bz] = st.street, tx = px + sx * (hw - 1.2), tz = pz + sz * (hd - 1.2);
      add(new THREE.BoxGeometry(2, Y - by, 2), glass, bx, (Y + by) / 2, bz); col.box(bx - 1, bx + 1, by, Y, bz - 1, bz + 1, { noCam: true });
      for (const e of [-1, 1]) add(new THREE.BoxGeometry(0.1, Y - by, 0.1), cyan, bx + (ns ? 0 : e), (Y + by) / 2, bz + (ns ? e : 0));
      mergeMeshes(group, sp);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.8), new THREE.MeshBasicMaterial({ map: labelTexture(st.name.toUpperCase(), { size: 60, color: '#9fefff', sub: 'maglev · line 9 · to the coast' }), transparent: true, side: THREE.DoubleSide }));
      sign.position.set(px, Y + 5.6, pz); sign.rotation.y = ns ? Math.PI / 2 : 0; group.add(sign);
      const out = { k, name: st.name, s: best, x: px, y: Y, z: pz, top: { x: tx, y: Y, z: tz }, bottom: { x: bx + sx * 1.6, y: by, z: bz + sz * 1.6 }, yaw: Math.atan2(-sx, -sz) };
      return out;
    });
    // the train: three cars
    this.cars = [0, 1, 2].map(() => {
      const c = new THREE.Group(), p = [];
      const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); c.add(m); p.push(m); };
      add(new THREE.BoxGeometry(3, 2.9, 13.4), std('#e9eef5', 0.3, 0.6), 0, 1.7, 0); add(new THREE.BoxGeometry(3.06, 0.9, 12, 1, 1, 1), std('#0c1118', 0.1, 0.9), 0, 2.1, 0); add(new THREE.BoxGeometry(3.08, 0.12, 13.4), neon('#ffb347', 1.4), 0, 0.6, 0);
      mergeMeshes(c, p); group.add(c); return c;
    });
    this.train = { s: this.stations[0].s, v: 0, dir: 1, dwell: 8, at: 0, next: 1 };
    // interactions: lifts, boarding, getting off
    const I = G.interact;
    for (const st of this.stations) {
      I.add({ pos: st.bottom, r: 2.4, yTol: 2, label: `Lift up to the ${st.name} platform (line 9)`, use: () => this.lift(st.top) });
      I.add({ pos: st.top, r: 2.2, yTol: 2, label: 'Lift down to the street', use: () => this.lift(st.bottom) });
      I.add({ pos: st, r: 14, yTol: 2, prio: -0.3, label: () => `Board line 9 toward ${this.stations[this.train.next].name}`, enabled: () => this.train.at === st.k && !this.riding, use: () => this.board() });
    }
    I.add({ mode: 'ride', pos: G.player.pos, r: 6, yTol: 12, label: () => `Get off at ${this.stations[this.train.at].name}`, enabled: () => this.riding && this.train.at >= 0, use: () => this.alight() });
    this.riding = false; this.o = {};
  }
  lift(to) {
    G.ui.fade(() => { const p = G.player; p.pos.set(to.x, to.y, to.z); p.vel.set(0, 0, 0); p.grounded = true; });
    if (G.audio) G.audio.blip(440, 0.1);
  }
  board() { const p = G.player; p.state = 'ride'; p.board = false; p.firstPerson = false; p.vel.set(0, 0, 0); p.crouch = false; this.riding = true; G.ui.toast('Line 9 to the coast: doors closing.', 'info'); if (G.audio) G.audio.blip(520, 0.1); }
  alight() {
    const st = this.stations[this.train.at], p = G.player;
    p.pos.set(st.x, st.y, st.z); p.vel.set(0, 0, 0); p.state = 'walk'; p.grounded = true; this.riding = false; G.ui.setObjective(null); G.state.done.line9 = true;
  }
  safeSpot() { if (!this.riding) return null; const st = this.stations[this.train.at >= 0 ? this.train.at : this.train.next]; return { x: st.x, y: st.y, z: st.z }; }
  update(dt) {
    const tr = this.train, S = this.stations;
    if (tr.dwell > 0) { tr.dwell -= dt; tr.v = 0; if (tr.dwell <= 0) { tr.at = -1; } }
    else {
      const target = S[tr.next].s, dist = (target - tr.s) * tr.dir;
      tr.v = Math.min(VMAX, tr.v + 2.6 * dt, Math.sqrt(Math.max(0, 2 * 1.8 * dist)) + 0.4);
      tr.s += tr.v * tr.dir * dt;
      if (dist <= 0.3) {
        tr.s = target; tr.at = tr.next; tr.dwell = 12;
        if (tr.next === S.length - 1) tr.dir = -1; else if (tr.next === 0) tr.dir = 1;
        tr.next += tr.dir; if (G.audio && this.riding) G.audio.blip(660, 0.08);
      }
    }
    // the cars follow along the line, nose first
    this.cars.forEach((c, i) => { const s = clamp(tr.s + (1 - i) * 14 * tr.dir, 6, this.path.total - 6), yaw = this.path.sample(s, c.position); c.position.y = Y + 0.15; c.rotation.y = yaw; });
    const near = (G.camera.position.x - 330) ** 2 + (G.camera.position.z - 700) ** 2 < 1600 * 1600; this.group.visible = near;
    if (this.riding) {
      const c = this.cars[1].position, p = G.player; p.pos.set(c.x, c.y + 0.9, c.z);
      G.ui.setObjective({ title: 'Maglev line 9', text: tr.at >= 0 ? `At ${S[tr.at].name}` : `Next stop: ${S[tr.next].name}`, sub: tr.at >= 0 ? 'E to get off, or stay on' : `${Math.round(tr.v * 3.6)} km/h` });
    }
  }
}
