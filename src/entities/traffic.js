// Everything that moves without the player: autonomous ground pods and the robo-bus,
// sky-lane traffic between the towers, delivery drones, and the air-taxi shuttle that
// carries commuters in and out of the district.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G } from '../core/game.js';
import { BLOCKS } from '../world/city.js';
import { std, neon } from '../world/materials.js';
import { PAINTS, TAXI } from './fleet.js';
import { PathLine, roundedRectLoop, RNG, damp, dampAngle, clamp, angDelta, smooth } from '../core/util.js';
import { makeDrone } from './rigs.js';
import { flatten } from '../world/batch.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
function groundMesh(kind, color) {
  const g = new THREE.Group(), body = std(color, 0.3, 0.6), dark = std('#11141a', 0.25, 0.85);
  const [w, h, l] = kind === 'bus' ? [2.5, 2.7, 9.5] : kind === 'van' ? [2.1, 2.1, 5.2] : [1.8, 1.45, 3.6];
  const b = (mat, sx, sy, sz, x, y, z, cast = true) => { const m = new THREE.Mesh(BOX, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = cast; g.add(m); return m; };
  b(body, w, h, l, 0, h / 2 + 0.35, 0); b(dark, w + 0.03, h * 0.36, l * 0.86, 0, h * 0.64 + 0.35, 0, false);
  b(neon('#f4fbff', 2), w * 0.8, 0.08, 0.06, 0, 0.7, l / 2, false); b(neon('#ff2a2a', 1.6), w * 0.8, 0.08, 0.06, 0, 0.7, -l / 2, false);
  b(neon(kind === 'bus' ? '#ffd34d' : '#59e0ff', 0.9), w * 0.9, 0.04, l * 0.9, 0, 0.33, 0, false);
  flatten(g);
  return { g, w, l };
}
function colored(geo, r, g, b) {
  const n = geo.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = r; c[i * 3 + 1] = g; c[i * 3 + 2] = b; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); return geo;
}

export class Traffic {
  constructor() {
    this.rng = new RNG(88); this.ground = []; this.air = []; this.drones = []; this.nearMiss = 0; this.laneT = 0; this.inLane = false;
    this.buildGround(); this.buildAir(); this.buildDrones(); this.buildShuttle();
  }

  buildGround() {
    const loops = BLOCKS.map((b) => new PathLine(roundedRectLoop(b.x0 - 5, b.x1 + 5, b.z0 - 5, b.z1 + 5, 0, 7, 5), true));
    const perimeter = new PathLine(roundedRectLoop(-175, 175, -175, 175, 0, 7, 5), true);
    const row = new PathLine(roundedRectLoop(-175, 175, -55, 55, 0, 7, 5), true);
    const colL = new PathLine(roundedRectLoop(-55, 55, -175, 175, 0, 7, 5), true);
    const colors = ['#e9edf2', '#3a4250', '#b23a48', '#2f6f8f', '#d9b23a', '#6b4fa0'];
    const add = (path, s, kind, vmax) => {
      // the robo-bus has its own model; cars, taxis and vans are drawn by the shared fleet
      let mesh = null, slot = null, w, l;
      if (kind === 'bus') { const m = groundMesh(kind, '#f0f3f7'); G.scene.add(m.g); mesh = m.g; w = m.w; l = m.l; }
      else { const type = kind === 'van' ? 'van' : this.rng.chance(0.25) ? 'taxi' : 'car'; slot = G.fleet.slot(type, type === 'taxi' ? TAXI : this.rng.pick(PAINTS)); w = slot.w; l = slot.l; }
      const v = { path, s, v: vmax * 0.6, vmax, kind, mesh, slot, w, l, p: new THREE.Vector3(), yaw: 0, blocked: 0, ghost: 0, dwell: 0, lastStop: -1, look: kind === 'bus' ? 13 : 9 };
      v.yaw = path.sample(s, v.p); this.ground.push(v); return v;
    };
    loops.forEach((p, i) => { if (i !== 4) add(p, this.rng.range(0, p.total), this.rng.chance(0.3) ? 'van' : 'pod', this.rng.range(8, 11)); });
    const bus = add(loops[4], 30, 'bus', 8.5); bus.stops = [loops[4].total * 0.11, loops[4].total * 0.61]; this.bus = bus;
    add(loops[4], 250, 'pod', 9);
    for (let i = 0; i < 3; i++) add(perimeter, i * 440 + 50, i === 1 ? 'van' : 'pod', 12);
    add(row, 120, 'pod', 11); add(row, 560, 'van', 10); add(colL, 300, 'pod', 11); add(colL, 700, 'pod', 10);
  }

  buildAir() {
    // corridor rectangles, for the rule that manual flight stays out of the lanes
    this.lanes = [{ x0: -60, x1: 60, z0: -60, z1: 60, y: 72 }, { x0: -180, x1: 180, z0: -180, z1: 180, y: 128 }, { x0: -60, x1: 60, z0: -540, z1: 540, y: 190 }, { x0: -540, x1: 540, z0: -60, z1: 60, y: 238 }];
    const lanes = [
      { pts: roundedRectLoop(-60, 60, -60, 60, 72, 22, 6), n: 10, v: 26 },
      { pts: roundedRectLoop(-180, 180, -180, 180, 128, 40, 6).reverse(), n: 14, v: 36 },
      { pts: roundedRectLoop(-60, 60, -540, 540, 190, 55, 6), n: 16, v: 46 },
      { pts: roundedRectLoop(-540, 540, -60, 60, 238, 55, 6), n: 14, v: 50 },
    ];
    const variants = [
      { len: 4.4, wid: 1.9, hei: 1.2, colors: ['#d8dde6', '#8f1d2c', '#1f4f7a', '#3d4450'] },
      { len: 5.4, wid: 2.2, hei: 1.5, colors: ['#f2c230'] },
      { len: 8.5, wid: 2.9, hei: 2.5, colors: ['#5a6b82', '#7a6a55'] },
      { len: 5.2, wid: 2.0, hei: 1.05, colors: ['#14161b', '#e8e2d0'] },
    ];
    const counts = [0, 0, 0, 0], list = [];
    for (const lane of lanes) {
      const path = new PathLine(lane.pts, true);
      for (let i = 0; i < lane.n; i++) {
        const vi = this.rng.pick([0, 0, 0, 1, 1, 2, 3]);
        list.push({ path, s: (i / lane.n) * path.total + this.rng.range(-12, 12), v: lane.v, vi, idx: counts[vi]++, yaw: 0, bank: 0, p: new THREE.Vector3(), color: this.rng.pick(variants[vi].colors) });
      }
    }
    this.airMeshes = variants.map((v, i) => {
      const a = new THREE.SphereGeometry(1, 10, 8); a.scale(v.wid / 2, v.hei / 2, v.len / 2);
      const b = new THREE.BoxGeometry(v.wid * 0.9, v.hei * 0.3, v.len * 0.8); b.translate(0, -v.hei * 0.3, 0);
      const body = new THREE.InstancedMesh(mergeGeometries([a, b]), new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.7 }), Math.max(1, counts[i]));
      const hl = colored(new THREE.BoxGeometry(v.wid * 0.7, 0.1, 0.1), 2.2, 2.2, 2.4); hl.translate(0, 0, v.len / 2);
      const tl = colored(new THREE.BoxGeometry(v.wid * 0.7, 0.1, 0.1), 2.2, 0.2, 0.2); tl.translate(0, 0, -v.len / 2);
      const pods = [];
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const p = colored(new THREE.BoxGeometry(0.5, 0.06, 0.5), 0.5, 1.5, 1.9); p.translate(sx * v.wid * 0.5, -v.hei * 0.5, sz * v.len * 0.3); pods.push(p); }
      const glow = new THREE.InstancedMesh(mergeGeometries([hl, tl, ...pods]), new THREE.MeshBasicMaterial({ vertexColors: true }), Math.max(1, counts[i]));
      body.frustumCulled = false; glow.frustumCulled = false; body.castShadow = false;
      G.scene.add(body, glow);
      return { body, glow };
    });
    const c = new THREE.Color();
    for (const a of list) this.airMeshes[a.vi].body.setColorAt(a.idx, c.set(a.color));
    this.air = list; this._d = new THREE.Object3D(); this._d.rotation.order = 'YXZ';
  }

  buildDrones() {
    const hub = [-153, 27, 25];
    const stops = [[12, 23, -84], [100, 121, -12], [86, 45, 36], [0, 16, 86], [30, 211, -150], [-30, 151.2, -58], [-40, 3.6, -9], [130, 96, 20], [-20, 151, -140]];
    for (let i = 0; i < 6; i++) {
      const d = makeDrone('delivery'); G.scene.add(d.root);
      const st = { rig: d, p: new THREE.Vector3(hub[0] + i, hub[1] + 2, hub[2]), from: hub, to: this.rng.pick(stops), phase: 'wait', t: i * 3, alt: 60, laden: true, hub, stops };
      d.root.position.copy(st.p); this.drones.push(st);
    }
  }

  buildShuttle() {
    const m = new THREE.Group(), body = std('#f2c230', 0.3, 0.6), dark = std('#12151b', 0.2, 0.85);
    const b = (mat, sx, sy, sz, x, y, z) => { const o = new THREE.Mesh(BOX, mat); o.scale.set(sx, sy, sz); o.position.set(x, y, z); o.castShadow = true; m.add(o); return o; };
    const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), body); hull.scale.set(1.5, 1.0, 3.6); hull.castShadow = true; m.add(hull);
    b(dark, 2.9, 0.7, 5, 0, 0.25, 0.3); b(dark, 2.6, 0.3, 5.6, 0, -0.75, 0);
    b(neon('#f4fbff', 2), 1.8, 0.1, 0.1, 0, -0.1, 3.55); b(neon('#ffd34d', 1.6), 1.2, 0.22, 0.5, 0, 1.05, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b(neon('#59e0ff', 1.5), 0.7, 0.06, 0.7, sx * 1.5, -0.92, sz * 2.2);
    flatten(m); m.visible = false; G.scene.add(m);
    const pad = G.city.pads.find((p) => p.id === 'sky4');
    const hover = [pad.x, 36, pad.z], land = [pad.x, pad.y + 1.0, pad.z];
    this.shuttle = {
      mesh: m, state: 'away', t: 25, wanted: false, pad, landed: false,
      legs: {
        approach: { a: [-340, 210, -24], b: [-195, 185, -24], c: hover, dur: 11 },
        descend: { a: hover, c: land, dur: 6 }, ascend: { a: land, c: hover, dur: 5 },
        depart: { a: hover, b: [-195, 190, 30], c: [-360, 230, 110], dur: 11 },
      },
    };
  }

  // Keep people on foot from walking through vehicles.
  pushOut(p, r) {
    if (p.y > 2.2) return;
    for (const v of this.ground) {
      const dx = p.x - v.p.x, dz = p.z - v.p.z, d = Math.hypot(dx, dz), m = (v.kind === 'bus' ? 3.0 : v.kind === 'van' ? 1.9 : 1.5) + r;
      if (d < m && d > 0.001) { p.x += (dx / d) * (m - d); p.z += (dz / d) * (m - d); }
    }
  }

  update(dt, t) {
    const player = G.player, car = G.car, near = G.npcs ? G.npcs.near : [];
    // ---- ground: follow the lane, brake for anything ahead ----
    for (const v of this.ground) {
      const hx = Math.sin(v.yaw), hz = Math.cos(v.yaw);
      let block = false;
      const chk = (x, z, rad) => {
        const dx = x - v.p.x, dz = z - v.p.z, along = dx * hx + dz * hz;
        if (along < v.l * 0.3 || along > v.l * 0.5 + v.look) return;
        if (Math.abs(dx * hz - dz * hx) < v.w / 2 + rad) block = true;
      };
      if (v.ghost <= 0) {
        if (player.state !== 'drive' && player.pos.y < 2) chk(player.pos.x, player.pos.z, 0.6);
        if (car.pos.y < 4) chk(car.pos.x, car.pos.z, 1.9);
        for (const n of near) if (!n.inside && n.pos.y < 2) chk(n.pos.x, n.pos.z, 0.5);
        for (const o of this.ground) if (o !== v) chk(o.p.x, o.p.z, o.l * 0.4);
      } else v.ghost -= dt;
      if (v.stops && v.dwell <= 0) {
        for (let k = 0; k < v.stops.length; k++) {
          const ahead = (((v.stops[k] - v.s) % v.path.total) + v.path.total) % v.path.total;
          if (ahead < 1.2 && v.lastStop !== k) { v.dwell = 8; v.lastStop = k; }
          else if (ahead > 40 && v.lastStop === k) v.lastStop = -1;
        }
      }
      if (v.dwell > 0) v.dwell -= dt;
      const stop = block || v.dwell > 0;
      v.blocked = block ? v.blocked + dt : 0;
      if (v.blocked > 7) { v.ghost = 3; v.blocked = 0; }
      v.v = damp(v.v, stop ? 0 : v.vmax, stop ? 5 : 1.1, dt);
      v.s += v.v * dt;
      const yaw = v.path.sample(v.s, v.p);
      v.yaw = dampAngle(v.yaw, yaw, 7, dt);
      if (v.slot) G.fleet.place(v.slot, v.p.x, 0, v.p.z, v.yaw);
      else { v.mesh.position.set(v.p.x, Math.sin(t * 2 + v.s) * 0.02, v.p.z); v.mesh.rotation.y = v.yaw; v.mesh.visible = G.camera.position.x ** 2 + G.camera.position.z ** 2 < 640 * 640; }
    }
    // ---- sky lanes ----
    const d = this._d, storm = G.env.storm > 0.5; let miss = 1e9;
    for (const a of this.air) {
      a.s += a.v * dt;
      const yaw = a.path.sample(a.s, a.p);
      const turn = angDelta(a.yaw, yaw); a.yaw += turn * Math.min(1, 5 * dt);
      a.bank = damp(a.bank, clamp(turn * 6, -0.6, 0.6), 3, dt);
      d.scale.setScalar(storm && (a.idx & 1) ? 0.0001 : 1); // small pods are grounded in storms
      d.position.copy(a.p); d.rotation.set(0, a.yaw, -a.bank); d.updateMatrix();
      const m = this.airMeshes[a.vi]; m.body.setMatrixAt(a.idx, d.matrix); m.glow.setMatrixAt(a.idx, d.matrix);
      if (car.mode === 'fly') { const dd = a.p.distanceToSquared(car.pos); if (dd < miss) miss = dd; }
    }
    for (const m of this.airMeshes) { m.body.instanceMatrix.needsUpdate = true; m.glow.instanceMatrix.needsUpdate = true; if (m.body.instanceColor) m.body.instanceColor.needsUpdate = true; }
    this.nearMiss = miss < 15 * 15 ? Math.sqrt(miss) : 0;
    // manual flight inside a sky lane is not allowed (autopilot is cleared through)
    let inLane = false;
    if (car.mode === 'fly' && car.occupied && !car.auto) for (const L of this.lanes) {
      if (Math.abs(car.pos.y - L.y) > 7) continue;
      const x = car.pos.x, z = car.pos.z, inX = x > L.x0 && x < L.x1, inZ = z > L.z0 && z < L.z1;
      const dd = inX && inZ ? Math.min(x - L.x0, L.x1 - x, z - L.z0, L.z1 - z) : Math.hypot(inX ? 0 : Math.min(Math.abs(x - L.x0), Math.abs(x - L.x1)), inZ ? 0 : Math.min(Math.abs(z - L.z0), Math.abs(z - L.z1)));
      if (dd < 8) inLane = true;
    }
    this.inLane = inLane; this.laneT = inLane ? this.laneT + dt : Math.max(0, this.laneT - dt * 2);
    if (this.laneT > 4) { this.laneT = -8; if (G.events) G.events.report('lane', 3.2); }
    // ---- delivery drones: up, across at a clear altitude, down, hover, repeat ----
    for (const q of this.drones) {
      const p = q.p;
      if (q.phase === 'wait') {
        q.t -= dt;
        if (q.t <= 0) { q.alt = Math.max(G.colliders.clearAltitude(p.x, p.z, q.to[0], q.to[2], 2, 7), q.to[1] + 6, p.y + 4); q.phase = 'up'; }
      } else if (q.phase === 'up') { p.y += 8 * dt; if (p.y >= q.alt) q.phase = 'cross'; }
      else if (q.phase === 'cross') {
        const dx = q.to[0] - p.x, dz = q.to[2] - p.z, dist = Math.hypot(dx, dz), st = Math.min(dist, 15 * dt);
        if (dist > 0.01) { p.x += (dx / dist) * st; p.z += (dz / dist) * st; q.rig.root.rotation.y = dampAngle(q.rig.root.rotation.y, Math.atan2(dx, dz), 5, dt); }
        if (dist < 0.3) q.phase = 'down';
      } else {
        p.y -= 6 * dt;
        if (p.y <= q.to[1] + 1) { q.phase = 'wait'; q.t = 2 + this.rng.next() * 3; q.from = q.to; q.laden = q.to === q.hub ? true : false; q.to = q.laden ? this.rng.pick(q.stops) : q.hub; }
      }
      q.rig.parcel.visible = q.laden;
      q.rig.root.position.set(p.x, p.y + Math.sin(t * 3 + p.x) * 0.06, p.z); q.rig.root.visible = q.rig.root.position.distanceToSquared(G.camera.position) < 280 * 280;   // a metre-wide drone is not worth eight draw calls from further off
      for (const r of q.rig.rotors) r.rotation.z += dt * 40;
    }
    // ---- commuter shuttle ----
    const s = this.shuttle, L = s.legs;
    s.t -= dt;
    const fly = (leg) => {
      const k = smooth(1 - Math.max(0, s.t) / leg.dur), a = leg.a, b = leg.b, c = leg.c, m = s.mesh.position;
      if (b) { const u = 1 - k; m.set(u * u * a[0] + 2 * u * k * b[0] + k * k * c[0], u * u * a[1] + 2 * u * k * b[1] + k * k * c[1], u * u * a[2] + 2 * u * k * b[2] + k * k * c[2]); const tx = 2 * u * (b[0] - a[0]) + 2 * k * (c[0] - b[0]), tz = 2 * u * (b[2] - a[2]) + 2 * k * (c[2] - b[2]); if (Math.abs(tx) + Math.abs(tz) > 0.01) s.mesh.rotation.y = dampAngle(s.mesh.rotation.y, Math.atan2(tx, tz), 3, dt); }
      else m.set(a[0] + (c[0] - a[0]) * k, a[1] + (c[1] - a[1]) * k, a[2] + (c[2] - a[2]) * k);
    };
    const padBusy = Math.hypot(car.pos.x - s.pad.x, car.pos.z - s.pad.z) < 9 && car.pos.y < 30;
    if (s.state === 'away') { if (s.t <= 0 || (s.wanted && s.t < 60)) { if (padBusy) s.t = 6; else { s.state = 'approach'; s.t = L.approach.dur; s.mesh.visible = true; s.mesh.rotation.y = Math.PI / 2; s.wanted = false; } } }
    else if (s.state === 'approach') { fly(L.approach); if (s.t <= 0) { s.state = 'descend'; s.t = L.descend.dur; } }
    else if (s.state === 'descend') { fly(L.descend); if (s.t <= 0) { s.state = 'landed'; s.t = 11; s.landed = true; } }
    else if (s.state === 'landed') { if (s.t <= 0) { s.state = 'ascend'; s.t = L.ascend.dur; s.landed = false; } }
    else if (s.state === 'ascend') { fly(L.ascend); if (s.t <= 0) { s.state = 'depart'; s.t = L.depart.dur; } }
    else if (s.state === 'depart') { fly(L.depart); if (s.t <= 0) { s.state = 'away'; s.t = 75 + this.rng.next() * 50; s.mesh.visible = false; } }
  }
}
