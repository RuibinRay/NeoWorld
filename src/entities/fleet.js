// Road vehicles: a city car, a taxi, a van and a box truck, each modelled once and drawn as
// instances, so every car on every road in the city costs nine draw calls in all. The same
// models are written into the street tiles for parked vehicles (see world/metro/furniture.js).
// Models face +z with the ground at y = 0. They hover: each has four lift pods with a glowing
// underside where wheels would be, and a light strip under the floor (parked ones are powered down).
import * as THREE from 'three';
import { Builder } from '../world/metro/builder.js';
import { G } from '../core/game.js';

const GLASS = '#18202c', TYRE = '#0d0f13', TRIM = '#1c2028', HUB = '#7c8696', CAB = '#2b3a4f';
const glow = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
const HEAD = glow('#fff4dc', 1.5), TAIL = glow('#ff2a2a', 1.5), SIDE = glow('#59e0ff', 0.9), SIGN = glow('#ffe9a0', 1.4), AMBER = glow('#ffb347', 1.3), LIFT = glow('#7fe9ff', 1.8), UNDER = glow('#3fb8ff', 1.1);
// part makers. ch: P paint (takes the vehicle's colour), D dark trim and glass, F fixed colour, L lights
const H = (ch, col, hwB, z0B, z1B, yB, hwT, z0T, z1T, yT) => ({ k: 'hull', ch, col, hwB, z0B, z1B, yB, hwT, z0T, z1T, yT });
const Bx = (ch, col, w, h, d, x, y, z) => ({ k: 'box', ch, col, w, h, d, x, y, z });
// a lift pod where a wheel would be: a dark housing with a glowing underside
const Wh = (r, w, x, y, z) => [Bx('D', TYRE, w + 0.04, r * 0.8, r * 2.0, x, y + r * 0.05, z), Bx('D', HUB, w + 0.06, 0.05, r * 1.7, x, y + r * 0.45, z), Bx('L', LIFT, w * 0.85, 0.03, r * 1.6, x, y - r * 0.38, z)];
const pairs = (f) => [f(-1), f(1)].flat();

const CAR = [
  H('P', null, 0.95, -2.15, 2.15, 0.3, 0.92, -2.02, 2.05, 0.9),
  H('D', GLASS, 0.86, -1.2, 1.05, 0.9, 0.73, -0.78, 0.5, 1.42),
  Bx('P', null, 1.5, 0.06, 1.34, 0, 1.45, -0.14), Bx('P', null, 1.76, 0.44, 0.12, 0, 1.15, -0.12),
  Bx('D', TRIM, 1.94, 0.16, 0.14, 0, 0.42, 2.15), Bx('D', TRIM, 1.94, 0.16, 0.14, 0, 0.42, -2.15),
  ...pairs((s) => [...Wh(0.34, 0.26, s * 0.84, 0.34, 1.35), ...Wh(0.34, 0.26, s * 0.84, 0.34, -1.35)]),
  ...pairs((s) => [Bx('L', HEAD, 0.46, 0.08, 0.04, s * 0.6, 0.8, 2.09), Bx('L', SIDE, 0.02, 0.04, 3.2, s * 0.955, 0.38, 0)]),
  Bx('L', TAIL, 1.5, 0.07, 0.04, 0, 0.84, -2.05), Bx('L', UNDER, 1.3, 0.02, 3.2, 0, 0.26, 0),
];
const VAN = [
  H('P', null, 1.03, -2.6, 2.6, 0.32, 1.03, -2.6, 2.58, 1.6),
  Bx('P', null, 2.06, 0.62, 3.9, 0, 1.91, -0.65),
  H('D', GLASS, 1.0, 1.3, 2.5, 1.6, 0.97, 1.3, 1.85, 2.18),
  Bx('P', null, 2.0, 0.06, 4.45, 0, 2.22, -0.37),
  Bx('D', TRIM, 2.1, 0.16, 0.14, 0, 0.44, 2.62), Bx('D', TRIM, 2.1, 0.16, 0.14, 0, 0.44, -2.62), Bx('D', TRIM, 0.03, 1.6, 0.02, 0, 1.25, -2.61),
  ...pairs((s) => [...Wh(0.38, 0.28, s * 0.92, 0.38, 1.72), ...Wh(0.38, 0.28, s * 0.92, 0.38, -1.72)]),
  ...pairs((s) => [Bx('L', HEAD, 0.4, 0.09, 0.04, s * 0.7, 0.98, 2.61), Bx('L', TAIL, 0.12, 0.55, 0.04, s * 0.9, 1.25, -2.62), Bx('L', SIDE, 0.02, 0.04, 4, s * 1.035, 0.4, 0)]),
  Bx('L', UNDER, 1.5, 0.02, 4.0, 0, 0.28, 0),
];
const TRUCK = [
  H('F', CAB, 1.18, 2.0, 3.8, 0.45, 1.18, 2.0, 3.78, 1.65),
  H('D', GLASS, 1.12, 2.1, 3.75, 1.65, 1.1, 2.1, 3.45, 2.5),
  Bx('F', CAB, 2.26, 0.12, 1.45, 0, 2.56, 2.78),
  Bx('P', null, 2.5, 2.9, 5.6, 0, 2.05, -0.95),
  Bx('D', TRIM, 2.0, 0.3, 7.4, 0, 0.55, 0), Bx('D', TRIM, 2.4, 0.18, 0.14, 0, 0.5, 3.82),
  ...pairs((s) => [...Wh(0.48, 0.34, s * 1.02, 0.48, 3.0), ...Wh(0.48, 0.34, s * 1.02, 0.48, -1.6), ...Wh(0.48, 0.34, s * 1.02, 0.48, -2.7)]),
  ...pairs((s) => [Bx('L', HEAD, 0.42, 0.12, 0.04, s * 0.75, 1.0, 3.81), Bx('L', TAIL, 0.12, 0.5, 0.04, s * 0.95, 0.95, -3.77), Bx('L', AMBER, 0.08, 0.08, 0.08, s * 1.26, 3.42, -3.6), Bx('L', AMBER, 0.08, 0.08, 0.08, s * 1.26, 3.42, 1.7)]),
  Bx('L', UNDER, 1.6, 0.02, 6.4, 0, 0.38, 0),
];
export const MODELS = {
  car: { w: 1.9, l: 4.3, parts: CAR },
  taxi: { w: 1.9, l: 4.3, parts: [...CAR, Bx('L', SIGN, 0.6, 0.18, 0.26, 0, 1.57, -0.1)] },
  van: { w: 2.1, l: 5.2, parts: VAN },
  truck: { w: 2.5, l: 7.6, parts: TRUCK },
};
export const PAINTS = ['#e9edf2', '#3a4250', '#b23a48', '#2f6f8f', '#d9b23a', '#6b4fa0', '#2f8f5a', '#1b2233', '#c9cdd4', '#8f1d2c'];
export const TAXI = '#f2c230';
export const BOXES = ['#e9edf2', '#f4f1ea', '#c0483f', '#2f6f8f', '#d9b23a', '#2f8f5a'];

// Write a vehicle into a Builder at (x, y, z) facing yaw a. ch maps part channels to Builder buffers;
// lights: false leaves the lamps out (parked vehicles keep only their side strips).
// parked: simpler wheels (six sides, no hubs) and no lamps except the side strips.
export function drawVehicle(B, type, x, y, z, a, paint, ch = { P: 'B', D: 'S', F: 'B', L: 'G' }, parked = false) {
  const cs = Math.cos(a), sn = Math.sin(a), W = (lx, ly, lz) => [x + lx * cs + lz * sn, y + ly, z - lx * sn + lz * cs];
  for (const p of MODELS[type].parts) {
    if (parked && p.ch === 'L' && p.col !== SIDE) continue;
    const col = p.ch === 'P' ? paint : p.col, k = ch[p.ch];
    if (p.k === 'box') { const [wx, wy, wz] = W(p.x, p.y, p.z); B.box(k, col, p.w, p.h, p.d, wx, wy, wz, a); }
    else if (p.k === 'wheel') { const [wx, wy, wz] = W(p.x, p.y, p.z); B.wheel(k, col, p.r, p.w, wx, wy, wz, a, parked ? 6 : 8); }
    else B.hull(k, col, [W(-p.hwB, p.yB, p.z0B), W(p.hwB, p.yB, p.z0B), W(p.hwB, p.yB, p.z1B), W(-p.hwB, p.yB, p.z1B), W(-p.hwT, p.yT, p.z0T), W(p.hwT, p.yT, p.z0T), W(p.hwT, p.yT, p.z1T), W(-p.hwT, p.yT, p.z1T)]);
  }
}

// All moving road vehicles. A system asks for a slot (type and colour) once, then places it every frame.
const CAP = { car: 120, taxi: 40, van: 50, truck: 30 };
export class Fleet {
  constructor(scene) {
    const paintMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.55 });
    const fixedMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.35 });
    const lightMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.types = {}; this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.v = new THREE.Vector3(); this.up = new THREE.Vector3(0, 1, 0); this.one = new THREE.Vector3(1, 1, 1); this.zero = new THREE.Vector3(0, 0, 0); this.c = new THREE.Color();
    const B = new Builder();
    for (const type in MODELS) {
      // paint and dark parts share one mesh (the dark ones are dark enough that the paint tint does not show)
      drawVehicle(B, type, 0, 0, 0, 0, '#ffffff', { P: 'S', D: 'S', F: 'B', L: 'G' });
      const mk = (buf, mat, cast) => { const m = buf.mesh(mat, cast); if (!m) return null; const im = new THREE.InstancedMesh(m.geometry, mat, CAP[type]); im.count = 0; im.frustumCulled = false; im.castShadow = cast; im.receiveShadow = !mat.isMeshBasicMaterial; scene.add(im); return im; };
      const paint = mk(B.b.S, paintMat, true), fixed = mk(B.b.B, fixedMat, true), lights = mk(B.b.G, lightMat, false);
      for (const k in B.b) B.b[k].reset();
      this.types[type] = { type, n: 0, paint, meshes: [paint, fixed, lights].filter(Boolean), ...MODELS[type] };
    }
  }
  // a new vehicle: returns its slot, with its size
  slot(type, color) {
    const t = this.types[type]; if (t.n >= CAP[type]) throw new Error('fleet full: ' + type);
    const i = t.n++; t.paint.setColorAt(i, this.c.set(color)); t.paint.instanceColor.needsUpdate = true;
    for (const m of t.meshes) m.count = t.n;
    const s = { t, i, type, w: t.w, l: t.l }; this.hide(s); return s;
  }
  place(s, x, y, z, yaw) {
    this.q.setFromAxisAngle(this.up, yaw); this.m4.compose(this.v.set(x, y, z), this.q, this.one);
    for (const m of s.t.meshes) { m.setMatrixAt(s.i, this.m4); m.instanceMatrix.needsUpdate = true; }
  }
  hide(s) { this.m4.compose(this.zero, this.q.identity(), this.zero); for (const m of s.t.meshes) { m.setMatrixAt(s.i, this.m4); m.instanceMatrix.needsUpdate = true; } }
  // keep someone on foot out of a vehicle's footprint (an oriented box)
  static pushOut(p, x, z, yaw, w, l) {
    const fx = Math.sin(yaw), fz = Math.cos(yaw), dx = p.x - x, dz = p.z - z, along = dx * fx + dz * fz, side = dx * fz - dz * fx, hl = l / 2 + 0.35, hw = w / 2 + 0.35;
    if (Math.abs(along) >= hl || Math.abs(side) >= hw) return false;
    if (hw - Math.abs(side) < hl - Math.abs(along)) { const m = (hw - Math.abs(side)) * Math.sign(side || 1); p.x += fz * m; p.z -= fx * m; } else { const m = (hl - Math.abs(along)) * Math.sign(along || 1); p.x += fx * m; p.z += fz * m; }
    return true;
  }
  // Free road (metres) between the front of a vehicle at (x, z) heading yaw and another vehicle o
  // ({ x, z, yaw, w, l }); Infinity when o is not in its path. sameDir: only vehicles heading the same way count.
  static gap(x, z, yaw, w, l, o, sameDir) {
    const fx = Math.sin(yaw), fz = Math.cos(yaw), dx = o.x - x, dz = o.z - z, along = dx * fx + dz * fz;
    if (along <= 0 || along > 50) return Infinity;
    const c = Math.abs(Math.cos(o.yaw - yaw)), s = Math.abs(Math.sin(o.yaw - yaw));
    if (sameDir && Math.cos(o.yaw - yaw) < 0.5) return Infinity;
    if (Math.abs(dx * fz - dz * fx) > w / 2 + (o.w / 2) * c + (o.l / 2) * s + 0.3) return Infinity;
    return along - l / 2 - ((o.l / 2) * c + (o.w / 2) * s);
  }
  // Your vehicle, driven on the ground, against another vehicle o ({ x, z, yaw, w, l }): push it out of
  // the footprint, bounce, and dent it if the knock was hard. Returns the impact speed (0 when apart).
  static knock(o) {
    const car = G.car; if (!car.occupied || car.mode === 'parked' || car.pos.y - car.ride > 1.6) return 0;
    const R = car.spec.R * 0.85, fx = Math.sin(o.yaw), fz = Math.cos(o.yaw), dx = car.pos.x - o.x, dz = car.pos.z - o.z;
    if (dx * dx + dz * dz > (R + o.l) * (R + o.l)) return 0;
    const al = Math.max(-o.l / 2, Math.min(o.l / 2, dx * fx + dz * fz)), sd = Math.max(-o.w / 2, Math.min(o.w / 2, dx * fz - dz * fx));
    let nx = car.pos.x - (o.x + fx * al + fz * sd), nz = car.pos.z - (o.z + fz * al - fx * sd); const d = Math.hypot(nx, nz);
    if (d >= R) return 0;
    if (d < 1e-3) { nx = fz * Math.sign(dx * fz - dz * fx || 1); nz = -fx * Math.sign(dx * fz - dz * fx || 1); } else { nx /= d; nz /= d; }
    car.pos.x += nx * (R - d); car.pos.z += nz * (R - d);
    const vn = car.vel.x * nx + car.vel.z * nz;
    if (vn < 0) { car.vel.x -= 1.4 * vn * nx; car.vel.z -= 1.4 * vn * nz; car.vel.x *= 0.7; car.vel.z *= 0.7; }
    const hit = Math.max(0, -vn);
    if (hit > 4) { car.damage((hit - 4) * 1.2, 'Collision'); car.knocks = (car.knocks || 0) + 1; if (G.audio) G.audio.blip(300, 0.1); }
    return hit;
  }
  recolor(s, color) { s.t.paint.setColorAt(s.i, this.c.set(color)); s.t.paint.instanceColor.needsUpdate = true; }
}
