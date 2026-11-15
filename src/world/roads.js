// The road network outside Meridian: highways out to the districts, a ring road that ties them
// together at 560 m, street lamps, light traffic, and the ground lift up to Skyhaven.
// Everything fixed is merged into a few meshes; lamps and traffic are instanced.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { M, std, neon, labelTexture } from './materials.js';
import { mergeItems } from './batch.js';
import { Fleet, PAINTS, TAXI, BOXES } from '../entities/fleet.js';
import { RNG, TAU, damp } from '../core/util.js';

export const RING = 560;
const W = 16, LANE = 3.6;

export function buildRoads(scene, col, city, districts) {
  const items = [], asphalt = std('#15181d', 0.92, 0.05), dash = neon('#cfd8e6', 0.5), edge = neon('#ffb347', 0.7), rng = new RNG(77);
  const add = (mat, w, h, d, x, y, z, ry = 0) => { const g = new THREE.BoxGeometry(w, h, d); g.rotateY(ry); g.translate(x, y, z); items.push({ geo: g, mat, cast: false, receive: mat === asphalt }); };
  // true where a street of the grid runs (they are 120 m apart): nothing may stand in those lanes
  const off = (v) => { const m = (((v - 60) % 120) + 120) % 120; return Math.min(m, 120 - m); }, onStreet = (x, z) => Math.hypot(x, z) > 200 && (off(x) < 11.5 || off(z) < 11.5);
  const lamps = [], segs = [], signs = [], shoulder = neon('#aeb9c9', 0.45), post = std('#2a303b', 0.5, 0.6), stud = neon('#ffb347', 1.3);
  const road = (ax, az, bx, bz, name) => {
    const len = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bx - ax, bz - az), mx = (ax + bx) / 2, mz = (az + bz) / 2, ux = (bx - ax) / len, uz = (bz - az) / len, rx = uz, rz = -ux;
    add(asphalt, W, 0.05, len, mx, 0.03, mz, yaw);
    for (const s of [-1, 1]) add(edge, 0.22, 0.03, len, mx + rx * s * (W / 2 - 0.4), 0.065, mz + rz * s * (W / 2 - 0.4), yaw);
    for (let t = 8; t < len - 4; t += 15) add(dash, 0.24, 0.03, 5.5, ax + ux * t, 0.065, az + uz * t, yaw);
    for (let t = 20, i = 0; t < len - 10; t += 46, i++) { const s = i % 2 ? 1 : -1, lx = ax + ux * t + rx * s * (W / 2 + 1.2), lz = az + uz * t + rz * s * (W / 2 + 1.2); if (!onStreet(lx, lz)) lamps.push([lx, lz, -rx * s, -rz * s]); }
    // shoulder lines
    for (const s of [-1, 1]) add(shoulder, 0.14, 0.03, len, mx + rx * s * (W / 2 - 1.7), 0.066, mz + rz * s * (W / 2 - 1.7), yaw);
    // (the reflector posts that stood here are now part of the guard rails: see metro/crossings.js)
    // named highways get an overhead sign at each end: where you are heading, and how far
    if (name && len > 240) for (const [t0, text, back] of [[70, name.toUpperCase(), true], [len - 70, 'MERIDIAN QUARTER', false]]) {
      let t = t0; const clear = (q) => [-1, 1].every((s) => !onStreet(ax + ux * q + rx * s * (W / 2 + 1.5), az + uz * q + rz * s * (W / 2 + 1.5)));
      for (let n = 0; n < 6 && !clear(t); n++) t += back ? 14 : -14;                       // keep the legs out of the cross streets
      const gx = ax + ux * t, gz = az + uz * t;
      for (const s of [-1, 1]) add(post, 0.4, 7.6, 0.4, gx + rx * s * (W / 2 + 1.5), 3.8, gz + rz * s * (W / 2 + 1.5), yaw);
      add(post, W + 3.4, 0.5, 0.5, gx, 7.5, gz, yaw);
      for (const s of [-1, 1]) col.box(gx + rx * s * (W / 2 + 1.5) - 0.25, gx + rx * s * (W / 2 + 1.5) + 0.25, 0, 7.6, gz + rz * s * (W / 2 + 1.5) - 0.25, gz + rz * s * (W / 2 + 1.5) + 0.25);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.1), new THREE.MeshBasicMaterial({ map: labelTexture(text, { color: '#eaf6ff', bg: '#0f3a2c', border: '#cfe9dc', sub: `${Math.round((back ? len - t : t) / 10) * 10} m`, size: 54 }) }));
      m.position.set(gx - (back ? ux : -ux) * 0.3, 6.1, gz - (back ? uz : -uz) * 0.3); m.rotation.y = Math.atan2(back ? -ux : ux, back ? -uz : uz); scene.add(m); signs.push(m);
    }
    segs.push({ ax, az, bx, bz, len, ux, uz, name });
  };
  // highways: straight from the edge of Meridian (or from the ring, where a megatower stands in the way) to each district's gate
  const ends = {};
  for (const d of districts.list) {
    const L = Math.hypot(d.x, d.z), ux = d.x / L, uz = d.z / L, direct = !['skyhaven', 'nexus'].includes(d.id), r0 = direct ? 203 : RING;
    const end = d.gate || { x: ux * (L - 150), z: uz * (L - 150) };
    road(ux * r0, uz * r0, end.x, end.z, d.name); ends[d.id] = end;
    add(asphalt, 30, 0.05, 30, ux * RING, 0.028, uz * RING, Math.atan2(ux, uz));                       // junction with the ring
  }
  // the ring road
  const N = 96;
  for (let i = 0; i < N; i++) { const a0 = (i / N) * TAU, a1 = ((i + 1) / N) * TAU; road(Math.cos(a0) * RING, Math.sin(a0) * RING, Math.cos(a1) * RING, Math.sin(a1) * RING, null); }
  // Skyhaven ground lift: a pad under the deck edge with a light column up to it
  const se = ends.skyhaven, sky = districts.byId.skyhaven;
  { const g = new THREE.CylinderGeometry(11, 12, 0.5, 36); g.translate(se.x, 0.25, se.z); items.push({ geo: g, mat: std('#20262f', 0.5, 0.6), cast: false, receive: true });
    const r = new THREE.TorusGeometry(9.4, 0.18, 6, 48); r.rotateX(Math.PI / 2); r.translate(se.x, 0.56, se.z); items.push({ geo: r, mat: neon('#9fe9ff', 1.4), cast: false, receive: false }); }
  col.box(se.x - 11, se.x + 11, 0, 0.5, se.z - 11, se.z + 11);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, sky.y, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x59e0ff, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.set(se.x, sky.y / 2, se.z); scene.add(beam);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 3), new THREE.MeshBasicMaterial({ map: labelTexture('SKYHAVEN LIFT', { color: '#cfefff', sub: '450 m up · free', size: 60 }), transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  sign.position.set(se.x, 9, se.z); sign.rotation.y = Math.atan2(-se.x, -se.z); scene.add(sign);
  for (const m of mergeItems(items)) scene.add(m);
  // street lamps (the heads share the city's lamp material, so they light up at night with the rest)
  const poleG = new THREE.CylinderGeometry(0.09, 0.13, 7.4, 6); poleG.translate(0, 3.7, 0);
  const headG = new THREE.BoxGeometry(0.5, 0.14, 2.4); headG.translate(0, 7.4, 1.1);
  const poles = new THREE.InstancedMesh(poleG, M.metalDark, lamps.length), heads = new THREE.InstancedMesh(headG, city.lamps.headMat, lamps.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
  lamps.forEach(([x, z, nx, nz], i) => { q.setFromAxisAngle(up, Math.atan2(nx, nz)); m4.compose(v.set(x, 0, z), q, one); poles.setMatrixAt(i, m4); heads.setMatrixAt(i, m4); col.box(x - 0.15, x + 0.15, 0, 7.4, z - 0.15, z + 0.15); });
  poles.frustumCulled = heads.frustumCulled = false; scene.add(poles, heads);

  // ---- traffic: pods that keep to the right, slow for you, and loop ------------------------------
  const radials = segs.filter((s) => s.name), n = 46, mod = (a, m) => ((a % m) + m) % m;
  const TYPES = ['car', 'car', 'van', 'car', 'truck', 'taxi', 'car', 'van', 'car', 'truck', 'car', 'taxi'];
  const pods = [];
  for (let i = 0; i < n; i++) {
    const onRing = i >= 30, seg = onRing ? null : radials[i % radials.length], type = TYPES[i % TYPES.length];
    const slot = G.fleet.slot(type, type === 'taxi' ? TAXI : type === 'truck' ? BOXES[i % BOXES.length] : PAINTS[i % PAINTS.length]);
    pods.push(slot.pod = { seg, ti: onRing ? radials.length : radials.indexOf(seg), slot, l: slot.l, w: slot.w, dir: i % 2 ? 1 : -1, s: onRing ? rng.range(0, TAU) : rng.range(0, seg.len), v: 0, vmax: rng.range(20, 30) * (type === 'truck' ? 0.75 : 1), x: 0, z: 0, yaw: 0 });
  }
  const roads = {
    segs, radials, ends, ring: RING, pods,
    lift: { ground: { x: se.x + 4, y: 0.5, z: se.z }, deck: { x: sky.kiosk.x - 5, y: sky.y, z: sky.kiosk.z + 2 } },
    update(dt) {
      const p = G.player, car = G.car, who = p.state === 'drive' ? car.pos : p.pos, low = who.y < 6, t = G.elapsed, X = G.metro && G.metro.xing;
      for (const m of signs) m.visible = (m.position.x - who.x) ** 2 + (m.position.z - who.z) ** 2 < 420 * 420;
      for (let i = 0; i < n; i++) {
        const o = pods[i];
        let fx, fz;
        if (o.seg) { const s = o.seg; fx = s.ux * o.dir; fz = s.uz * o.dir; const rx = -fz, rz = fx; o.x = s.ax + s.ux * o.s + rx * LANE; o.z = s.az + s.uz * o.s + rz * LANE; }
        else { const a = o.s, r = RING - o.dir * LANE; o.x = Math.cos(a) * r; o.z = Math.sin(a) * r; fx = -Math.sin(a) * o.dir; fz = Math.cos(a) * o.dir; }
        // slow down for anyone on the road ahead, queue behind the vehicle in front, stop at red where the road crosses a street
        let target = o.vmax;
        if (G.wrecks && G.wrecks.stopped(o.slot)) target = 0;   // hit, burning or a wreck
        const dx = who.x - o.x, dz = who.z - o.z, ahead = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
        if (low && ahead > -2 && ahead < o.l / 2 + 22 && side < o.w / 2 + 2.4) target = 0;
        for (let k = 0; k < n; k++) {
          const q = pods[k]; if (q === o || q.seg !== o.seg || q.dir !== o.dir) continue;
          const gap = o.seg ? (q.s - o.s) * o.dir : mod((q.s - o.s) * o.dir, TAU) * RING;
          if (gap <= 0 || gap > 45) continue;
          target = Math.min(target, Math.max(0, (gap - (o.l + q.l) / 2 - 3) * 1.6));
        }
        if (X) {
          target = Math.min(target, X.highwayLimit(o.ti, o.s, o.dir, o.l, t));
          // and never into a car or bus from the street grid that is still crossing
          const yaw = Math.atan2(fx, fz);
          for (const q of G.metro.traffic.pods) if (q.on && Math.abs(q.x - o.x) < 50 && Math.abs(q.z - o.z) < 50) { const g = Fleet.gap(o.x, o.z, yaw, o.w, o.l, q, false); if (g < 40) target = Math.min(target, Math.max(0, (g - 2.5) * 1.6)); }
          for (const b of G.metro.bus.buses) if (Math.abs(b.p.x - o.x) < 50 && Math.abs(b.p.z - o.z) < 50) { const g = Fleet.gap(o.x, o.z, yaw, o.w, o.l, { x: b.p.x, z: b.p.z, yaw: b.yaw, w: 2.5, l: 9.6 }, false); if (g < 40) target = Math.min(target, Math.max(0, (g - 2.5) * 1.6)); }
        }
        o.v = damp(o.v, target, target < o.v ? 3.5 : 0.8, dt);
        if (o.seg) { o.s += o.v * o.dir * dt; if (o.s > o.seg.len - 6) { o.s = o.seg.len - 6; o.dir = -1; o.v = 0; } else if (o.s < 6) { o.s = 6; o.dir = 1; o.v = 0; } }
        else o.s = (o.s + (o.v / RING) * o.dir * dt + TAU) % TAU;
        o.yaw = Math.atan2(fx, fz);
        G.fleet.place(o.slot, o.x, 0, o.z, o.yaw);
        // do not let someone on foot stand inside a vehicle
        if (p.state === 'walk' && low && Math.abs(dx) < 5 && Math.abs(dz) < 5) Fleet.pushOut(p.pos, o.x, o.z, o.yaw, o.w, o.l);
        if (p.state === 'drive' && Math.abs(dx) < 9 && Math.abs(dz) < 9) Fleet.knock(o);
      }
    },
  };
  return roads;
}
