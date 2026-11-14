// Grand Arbor Park: 580 m square between Neon, Old Earth and the beach. A boating lake with
// an island, a lookout hill, a jogging loop and promenades, woods and lawns, a plaza with a
// fountain, an amphitheatre, a glasshouse cafe, a ball court, a dog park and a boat jetty.
// Trees, benches and lamps go into the block layout (so they are streamed and solid like street
// furniture); the fixed structures are written into the metro's static ground mesh.
import * as THREE from 'three';
import { RNG } from '../core/util.js';
import { M, std, neon, labelTexture } from './materials.js';
import { room, counter, lit } from './stores.js';
import { PARK, LAKE, INLET, ISLE, HILL, hillY, blockOf } from './metro/landuse.js';
import { MATS } from './metro/builder.js';

const R = (x0, x1, z0, z1) => ({ x0, x1, z0, z1 });
// Paths and paved areas: axis-aligned, and cut out of the lawn so nothing overlaps.
export const PATHS = [
  R(485, 955, 482.5, 487.5), R(485, 955, 952.5, 957.5), R(482.5, 487.5, 487.5, 650), R(482.5, 487.5, 670, 952.5), R(952.5, 957.5, 487.5, 952.5),      // the loop
  R(717.5, 722.5, 430, 500), R(717.5, 722.5, 957.5, 1010), R(430, 482.5, 537.5, 542.5), R(957.5, 1010, 717.5, 722.5),                              // four gates
  R(797.5, 802.5, 487.5, 952.5),                                                                                                                  // the spine
  R(503, 777, 563, 568), R(503, 777, 742, 747), R(503, 508, 568, 650), R(503, 508, 670, 742), R(772, 777, 568, 742),                              // lake promenade
  R(777, 797.5, 652.5, 657.5), R(487.5, 503, 600, 605), R(637.5, 642.5, 747, 952.5),
];
export const PLAZA = R(690, 750, 500, 550), COURT = R(872, 908, 888, 912), DOGS = R(506, 550, 500, 532), STAGE = { x: 560, z: 868 }, GLASS = R(853, 887, 818, 838);
export const PARK_HOLES = [LAKE, INLET, ...PATHS, PLAZA];
const inR = (r, x, z, m = 0) => x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m;

// ctx: { GB, SB, col, city, block, kit, group, rooms, cache }
export function layoutPark(ctx) {
  const { GB, SB, col, block, kit } = ctx, rng = new RNG(4401), PATH = '#b3a587', STONE = '#8d9199', Y = -0.04;
  const put = (t, x, z, a = 0) => { const b = block(blockOf(x), blockOf(z)); if (b) b.props.push([t, x, z, a]); };
  const plant = (x, z, s, kind) => { const b = block(blockOf(x), blockOf(z)); if (b) b.trees.push([x, z, s, kind, hillY(x, z)]); };
  // ---- ground: paths, plaza, water ----
  for (const p of PATHS) GB.quad('S', PATH, p.x1 - p.x0, p.z1 - p.z0, (p.x0 + p.x1) / 2, Y, (p.z0 + p.z1) / 2);
  GB.quad('S', '#6f7480', PLAZA.x1 - PLAZA.x0, PLAZA.z1 - PLAZA.z0, 720, Y, 525);
  SB.quad('S', '#2a8a9c', LAKE.x1 - LAKE.x0, LAKE.z1 - LAKE.z0, (LAKE.x0 + LAKE.x1) / 2, 0.02, (LAKE.z0 + LAKE.z1) / 2); SB.quad('S', '#2a8a9c', INLET.x1 - INLET.x0, 20, (INLET.x0 + INLET.x1) / 2, 0.02, 660);
  // stone edge round the lake and along the inlet (open where the inlet joins)
  const kerb = (x0, x1, z0, z1) => { GB.box('S', STONE, x1 - x0, 0.45, z1 - z0, (x0 + x1) / 2, 0.1, (z0 + z1) / 2); };
  kerb(LAKE.x0 - 0.6, LAKE.x1 + 0.6, LAKE.z0 - 0.6, LAKE.z0); kerb(LAKE.x0 - 0.6, LAKE.x1 + 0.6, LAKE.z1, LAKE.z1 + 0.6); kerb(LAKE.x1, LAKE.x1 + 0.6, LAKE.z0, LAKE.z1);
  kerb(LAKE.x0 - 0.6, LAKE.x0, LAKE.z0, 650); kerb(LAKE.x0 - 0.6, LAKE.x0, 670, LAKE.z1); kerb(430, LAKE.x0, 649.4, 650); kerb(430, LAKE.x0, 670, 670.6);
  // footbridges over the inlet: the loop and the promenade
  for (const x of [485, 505.5]) { GB.box('B', '#8a6a48', 5.4, 0.35, 23, x, 0.2, 660); for (const s of [-1, 1]) { GB.box('S', '#6a4f36', 0.12, 0.9, 23, x + s * 2.6, 0.8, 660); col.box(x + s * 2.6 - 0.1, x + s * 2.6 + 0.1, 0, 1.3, 648.5, 671.5, { noCam: true }); } col.box(x - 2.7, x + 2.7, 0, 0.38, 648.5, 671.5, { noCam: true }); ctx.gaps.push({ x0: x - 3.4, x1: x + 3.4, z0: 647.5, z1: 672.5 }); }
  // the island: a mound with a pavilion
  GB.cyl('B', '#2d5a3c', ISLE.r - 1, ISLE.r, 0.5, ISLE.x, 0.25, ISLE.z, 24); col.box(ISLE.x - ISLE.r * 0.72, ISLE.x + ISLE.r * 0.72, 0, 0.5, ISLE.z - ISLE.r * 0.72, ISLE.z + ISLE.r * 0.72, { noCam: true });
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2, x = ISLE.x + Math.cos(a) * 4, z = ISLE.z + Math.sin(a) * 4; GB.cyl('S', '#e2dccd', 0.22, 0.26, 3.4, x, 2.2, z, 8); col.box(x - 0.25, x + 0.25, 0.5, 3.9, z - 0.25, z + 0.25, { noCam: true }); }
  GB.cyl('B', '#7a3f35', 0.4, 5.4, 1.8, ISLE.x, 4.8, ISLE.z, 12); GB.cyl('S', '#b9b2a2', 4.6, 4.6, 0.12, ISLE.x, 0.56, ISLE.z, 16); ctx.cache(ISLE.x, 0.6, ISLE.z);
  for (const [dx, dz, s] of [[-8, 3, 1.1], [7, -5, 0.9], [2, 9, 1.0]]) plant(ISLE.x + dx, ISLE.z + dz, s, dx > 0 ? 1 : 0);
  // ---- plaza: fountain, food truck, flower beds ----
  put('fountain', 720, 525); put('truck', 742, 512, Math.PI / 2); put('vend', 698, 503, 0); put('bin', 706, 548, 0); put('bin', 734, 548, 0);
  for (const [x, z, a] of [[708, 536, Math.PI / 4 * 3], [732, 536, -Math.PI / 4 * 3], [708, 514, Math.PI / 4], [732, 514, -Math.PI / 4]]) put('bench', x, z, a);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const x = 720 + sx * 27, z = 525 + sz * 22; GB.box('S', '#59606c', 4, 0.5, 4, x, 0.2, z); col.box(x - 2, x + 2, 0, 0.5, z - 2, z + 2, { noCam: true }); for (let k = 0; k < 5; k++) GB.blob('S', ['#c05a8f', '#d9b84a', '#e9edf2', '#b84a4a'][k % 4], 0.7, 0.5, 0.7, x + rng.range(-1.2, 1.2), 0.75, z + rng.range(-1.2, 1.2), k); }
  // ---- gates: an arch with the park's name at each entrance ----
  const sign = labelTexture('GRAND ARBOR PARK', { color: '#d9f2df', bg: '#1d3a2a', border: '#9fd4ae', size: 46 }), gates = new THREE.Group();
  for (const [x, z, alongX] of [[720, 432, true], [720, 1008, true], [432, 540, false], [1008, 720, false]]) {
    for (const s of [-1, 1]) { const px = alongX ? x + s * 4 : x, pz = alongX ? z : z + s * 4; GB.box('B', '#3a4a40', 0.9, 5.4, 0.9, px, 2.7, pz); col.box(px - 0.45, px + 0.45, 0, 5.4, pz - 0.45, pz + 0.45); }
    GB.box('B', '#3a4a40', alongX ? 9.6 : 0.9, 0.9, alongX ? 0.9 : 9.6, x, 5.6, z);
    for (const s of [1, -1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 1.5), new THREE.MeshBasicMaterial({ map: sign })); m.position.set(x + (alongX ? 0 : s * 0.47), 5.6, z + (alongX ? s * 0.47 : 0)); m.rotation.y = alongX ? (s > 0 ? 0 : Math.PI) : s * Math.PI / 2; m.matrixAutoUpdate = false; m.updateMatrix(); gates.add(m); }
  }
  ctx.group.add(gates); ctx.rooms.push({ g: gates, x: 720, z: 720, r: 520 });
  // ---- amphitheatre: stage with a shell roof, five tiers of seating in an arc to the north ----
  { const { x, z } = STAGE; GB.cyl('B', '#5a606b', 9, 9.4, 0.8, x, 0.36, z + 6, 24); col.box(x - 7, x + 7, 0, 0.8, z, z + 12, { noCam: true });
    for (const s of [-1, 1]) { GB.box('B', '#3a414d', 0.8, 7, 0.8, x + s * 8, 3.5, z + 9); col.box(x + s * 8 - 0.4, x + s * 8 + 0.4, 0, 7, z + 8.6, z + 9.4); } GB.box('B', '#d7dde6', 18, 0.5, 8, x, 7.2, z + 8); GB.box('L', '#fff0d2', 14, 0.1, 0.4, x, 6.9, z + 5);
    for (let t = 0; t < 5; t++) { const r = 14 + t * 2.4, h = 0.45 + t * 0.45; for (let k = -5; k <= 5; k++) { const a = -Math.PI / 2 + k * 0.2, bx = x + Math.cos(a) * r, bz = z + 2 + Math.sin(a) * r; GB.box('S', t % 2 ? '#8d9199' : '#7c8089', r * 0.2, h, 2.3, bx, h / 2 - 0.04, bz, -a + Math.PI / 2); col.box(bx - 1.5, bx + 1.5, 0, h, bz - 1.5, bz + 1.5, { noCam: true }); } }
    ctx.cache(x, 0.8, z + 6); }
  // ---- ball court ----
  { const c = COURT, cx = (c.x0 + c.x1) / 2, cz = (c.z0 + c.z1) / 2; GB.box('S', '#3f6f8f', c.x1 - c.x0, 0.12, c.z1 - c.z0, cx, 0, cz); GB.quad('G', '#e9edf2', 0.15, c.z1 - c.z0, cx, 0.075, cz); for (const s of [-1, 1]) { GB.quad('G', '#e9edf2', c.x1 - c.x0, 0.15, cx, 0.075, cz + s * (c.z1 - c.z0) / 2 * 0.98); const hx = cx + s * 16.5; GB.cyl('B', '#232832', 0.12, 0.14, 3.6, hx + s * 1.2, 1.8, cz, 8); GB.box('S', '#e9edf2', 0.1, 1.1, 1.8, hx + s * 0.4, 3.5, cz); GB.ring('G', '#ff7a45', 0.38, 0.45, hx - s * 0.52, 3.05, cz, 20); for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; GB.box('S', '#e9edf2', 0.02, 0.42, 0.02, hx - s * 0.52 + Math.cos(a) * 0.36, 2.84, cz + Math.sin(a) * 0.36); } col.box(hx + s * 1.2 - 0.15, hx + s * 1.2 + 0.15, 0, 3.6, cz - 0.15, cz + 0.15, { noCam: true }); } }
  // ---- dog park: a low fence with a gate on the east side ----
  { const d = DOGS; const fence = (x0, x1, z0, z1) => { GB.box('S', '#6a4f36', Math.max(0.1, x1 - x0), 0.08, Math.max(0.1, z1 - z0), (x0 + x1) / 2, 0.95, (z0 + z1) / 2); GB.box('S', '#6a4f36', Math.max(0.1, x1 - x0), 0.08, Math.max(0.1, z1 - z0), (x0 + x1) / 2, 0.5, (z0 + z1) / 2); col.box(x0 - 0.05, x1 + 0.05, 0, 1, z0 - 0.05, z1 + 0.05, { noCam: true }); };
    fence(d.x0, d.x1, d.z0, d.z0); fence(d.x0, d.x1, d.z1, d.z1); fence(d.x0, d.x0, d.z0, d.z1); fence(d.x1, d.x1, d.z0, 512); fence(d.x1, d.x1, 516, d.z1);
    for (let x = d.x0; x <= d.x1; x += 4) for (const z of [d.z0, d.z1]) GB.box('S', '#4a3626', 0.12, 1.05, 0.12, x, 0.5, z);
    GB.box('S', '#c98a2e', 3, 0.5, 0.5, 520, 0.25, 510); GB.box('S', '#2f6f8f', 0.4, 0.9, 3, 536, 0.45, 522); GB.cyl('S', '#a8343f', 0.9, 0.9, 0.5, 527, 0.5, 524, 12); }
  // ---- boat jetty and boathouse on the south shore ----
  GB.box('B', '#8a6a48', 3, 0.3, 12, 640, 0.22, 729); col.box(638.5, 641.5, 0, 0.37, 723, 735.6, { noCam: true }); for (const z of [724, 729, 734]) for (const s of [-1, 1]) GB.cyl('S', '#4a3626', 0.14, 0.14, 1.2, 640 + s * 1.5, 0.3, z, 6);
  GB.box('B', '#7a5a3f', 9, 3, 5, 652, 1.5, 752); GB.gable('B', '#4a5260', 9.6, 5.6, 1.6, 652, 3, 752); col.box(647.5, 656.5, 0, 3, 749.5, 754.5); GB.box('G', '#ffd34d', 3, 0.5, 0.06, 652, 2.4, 749.45);
  // ---- lookout hill: a smooth mound with a railed deck on top ----
  { const N = 32, RINGS = 12, pos = [], colr = [], idx = [], c0 = new THREE.Color('#2a5a3c'), c1 = new THREE.Color('#3f7a4c');
    pos.push(HILL.x, HILL.h + 0.01, HILL.z); colr.push(c1.r, c1.g, c1.b);
    for (let r = 1; r <= RINGS; r++) for (let k = 0; k < N; k++) { const d = (r / RINGS) * HILL.r, a = (k / N) * Math.PI * 2, x = HILL.x + Math.cos(a) * d, z = HILL.z + Math.sin(a) * d, t = 1 - r / RINGS; pos.push(x, hillY(x, z) + (r === RINGS ? -0.06 : 0.01), z); colr.push(c0.r + (c1.r - c0.r) * t, c0.g + (c1.g - c0.g) * t, c0.b + (c1.b - c0.b) * t); }
    for (let k = 0; k < N; k++) idx.push(0, 1 + ((k + 1) % N), 1 + k);
    for (let r = 1; r < RINGS; r++) for (let k = 0; k < N; k++) { const a = 1 + (r - 1) * N + k, b = 1 + (r - 1) * N + ((k + 1) % N), c = a + N, d = b + N; idx.push(a, b, d, a, d, c); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, MATS.S); m.receiveShadow = true; m.matrixAutoUpdate = false; ctx.group.add(m);
    const ty = HILL.h; GB.cyl('B', '#8d9199', 6, 6.4, 0.5, HILL.x, ty - 0.1, HILL.z, 20); col.box(HILL.x - 4.4, HILL.x + 4.4, ty - 0.4, ty + 0.15, HILL.z - 4.4, HILL.z + 4.4, { noCam: true });
    for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; if (Math.abs(a - Math.PI) < 0.5) continue; GB.box('S', '#aeb6c2', 0.08, 1, 0.08, HILL.x + Math.cos(a) * 5.7, ty + 0.65, HILL.z + Math.sin(a) * 5.7); GB.box('S', '#aeb6c2', 2.7, 0.07, 0.07, HILL.x + Math.cos(a) * 5.7, ty + 1.15, HILL.z + Math.sin(a) * 5.7, -a + Math.PI / 2); }
    GB.cyl('S', '#232832', 0.08, 0.1, 1.3, HILL.x + 3.6, ty + 0.8, HILL.z - 2, 6); GB.box('S', '#8a94a6', 0.25, 0.25, 0.7, HILL.x + 3.6, ty + 1.5, HILL.z - 2, 0.6); ctx.cache(HILL.x - 2, ty + 0.15, HILL.z + 2); }
  // ---- glasshouse cafe ----
  { const g = GLASS, st = room(kit, { id: 'glasshouse', name: 'The Glasshouse', x0: g.x0, x1: g.x1, z0: g.z0, z1: g.z1, h: 5.2, door: 'N', dw: 2.6, wallMat: M.glassDark, roofMat: M.glass, floor: '#7d8a78', lamp: '#eaffd9', front: false, staffed: true });
    counter(kit, g.x1 - 9, g.x1 - 3, g.z1 - 4.2, g.z1 - 3.4, 0, '#cfe3c8'); st.counter = { x: g.x1 - 6, y: 0, z: g.z1 - 5.2 }; st.keeper = { x: g.x1 - 6, y: 0, z: g.z1 - 2.2, yaw: Math.PI };
    for (const [x, z] of [[g.x0 + 5, g.z0 + 5], [g.x0 + 5, g.z0 + 12], [g.x0 + 13, g.z0 + 12]]) kit.table('glass' + x + z, x, 0, z, lit('#e9edf2', 0.2), lit('#8a6a48', 0.15));
    for (let k = 0; k < 7; k++) { const x = g.x0 + 2.2 + k * 4.4, z = g.z1 - 1.3; kit.box(lit('#59606c', 0.15), 1.6, 0.6, 1.2, x, 0.3, z); kit.ball(lit(k % 3 ? '#2f8f5a' : '#c05a8f', 0.25), 0.9, x, 1.4, z, 1.3); }
    for (let x = g.x0; x <= g.x1; x += 8.5) kit.box(std('#e9edf2', 0.5, 0.3), 0.25, 5.4, 0.25, x, 2.7, g.z0 + 0.15);
    kit.finish(ctx.group, 870, 828, ctx.rooms); }
  // ---- lamps, benches and bins along the paths ----
  for (let x = 500; x <= 940; x += 32) { put('lamp', x, 489.3, Math.PI); put('lamp', x + 16, 950.7, 0); if ((x / 32 | 0) % 2) { put('bench', x + 8, 490.5, 0); put('bench', x + 8, 949.5, Math.PI); } }
  for (let z = 505; z <= 940; z += 32) { if (z > 640 && z < 680) continue; put('lamp', 489.3, z, -Math.PI / 2); put('lamp', 950.7, z + 16, Math.PI / 2); put('lamp', 804.3, z + 8, -Math.PI / 2); if ((z / 32 | 0) % 2) { put('bench', 490.5, z + 8, Math.PI / 2); put('bench', 949.5, z + 8, -Math.PI / 2); } }
  for (let x = 520; x <= 760; x += 30) { put('lamp', x, 561.2, 0); put('lamp', x + 15, 748.8, Math.PI); put('bench', x + 8, 569.4, 0); put('bench', x + 8, 740.6, Math.PI); }
  for (const [x, z] of [[489, 600], [489, 800], [951, 600], [951, 860], [640, 490], [860, 490], [640, 950], [860, 950], [770, 655]]) put('bin', x, z, 0);
  // ---- trees: woods in the south-west and along the east edge, loose groups elsewhere ----
  const blocked = (x, z) => inR(LAKE, x, z, 14) || inR(INLET, x, z, 6) || inR(PLAZA, x, z, 4) || inR(COURT, x, z, 5) || inR(DOGS, x, z, 3) || inR(GLASS, x, z, 5) || PATHS.some((p) => inR(p, x, z, 3.2)) || Math.hypot(x - HILL.x, z - HILL.z) < 16 || Math.hypot(x - STAGE.x, z - STAGE.z - 2) < 30 || (x > 630 && x < 662 && z > 745 && z < 760);
  let n = 0;
  for (let k = 0; k < 1500 && n < 330; k++) {
    const x = rng.range(PARK.x0 + 6, PARK.x1 - 6), z = rng.range(PARK.z0 + 6, PARK.z1 - 6), woods = (x < 640 && z > 770) || x > 962 || z > 962 || (x < 480) || (z < 480);
    if (blocked(x, z) || (!woods && rng.chance(0.72))) continue;
    plant(x, z, rng.range(0.9, 1.7), rng.chance(woods ? 0.08 : 0.3) ? 1 : 0); n++;
  }
  // picnic blankets on the open lawn
  for (let k = 0; k < 9; k++) { const x = rng.range(560, 780), z = rng.range(770, 930); if (!blocked(x, z)) GB.box('S', ['#c0483f', '#2f6f8f', '#d9b84a'][k % 3], 2.4, 0.03, 1.8, x, -0.01, z, rng.range(0, 3)); }
  return { jetty: { x: 640, y: 0.37, z: 726 }, court: { x: 890, y: 0.06, z: 900 }, dogs: DOGS, stage: STAGE };
}
