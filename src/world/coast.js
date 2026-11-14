// The south coast: Solara Bay (beach, boardwalk, pier with the big wheel, surf shop and beach
// bar), the Old Earth seafront, Tidewater Port (container yard, gantry cranes, ships, fish
// market, ferry jetty), and what lies offshore (Beacon Isle with its lighthouse, a wind farm,
// a sea platform with a landing pad, a freighter on the horizon).
// Fixed parts are written into the metro's static mesh; beach furniture goes into the block
// layout so it is streamed and solid like street furniture. Moving parts are updated here.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RNG, TAU } from '../core/util.js';
import { M, std } from './materials.js';
import { room, counter, lit } from './stores.js';
import { coastZ, blockOf } from './metro/landuse.js';
import { Builder, MATS } from './metro/builder.js';
import { draw } from './metro/furniture.js';

export const ISLAND = { x: 300, z: 1800, r: 46, top: 30, h: 2 };
export const isleY = (x, z) => { const d = Math.hypot(x - ISLAND.x, z - ISLAND.z); return d < ISLAND.top ? ISLAND.h : d < ISLAND.r ? (ISLAND.h * (ISLAND.r - d)) / (ISLAND.r - ISLAND.top) : 0; };
export const onIsle = (x, z) => (x - ISLAND.x) ** 2 + (z - ISLAND.z) ** 2 < (ISLAND.r - 3) ** 2;
const WOOD = '#8a6a48', DECK = '#9a7a56', WHITE = '#e9edf2', STEEL = '#aeb6c2', BOXES = ['#a8343f', '#2f6f8f', '#c98a2e', '#2f8f5a', '#d9dde4', '#5b4a8f', '#3a4250'];

export function layoutCoast(ctx) {
  const { GB, col, city, block, kit, group } = ctx, rng = new RNG(9107);
  const put = (t, x, z, a = 0, extra, up) => { const b = block(blockOf(x), blockOf(z)); if (b) b.props.push([t, x, z, a, extra, up]); };
  const plant = (x, z, s, kind) => { const b = block(blockOf(x), blockOf(z)); if (b) b.trees.push([x, z, s, kind]); };
  const solid = (hex, x0, x1, y0, y1, z0, z1, k = 'B', extra) => { GB.box(k, hex, x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); col.box(x0, x1, y0, y1, z0, z1, extra); };
  const seat = (id, x, y, z, yaw) => city.seats.push({ id, kind: 'chair', x, y: y + 0.5, z, yaw, taken: null, table: null, service: null });
  const beams = [], up = new THREE.Vector3(0, 1, 0), va = new THREE.Vector3(), vb = new THREE.Vector3(), q = new THREE.Quaternion();
  const beam = (ax, ay, az, bx, by, bz, r = 0.25, list = beams) => { va.set(ax, ay, az); vb.set(bx, by, bz); const g = new THREE.CylinderGeometry(r, r, va.distanceTo(vb), 6); q.setFromUnitVectors(up, vb.clone().sub(va).normalize()); g.applyQuaternion(q); g.translate((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2); list.push(g); };
  const pad = (id, name, x, y, z, r = 7) => { GB.cyl('S', '#1a1f29', r, r, 0.1, x, y + 0.05, z, 32); GB.ring('G', '#4de1ff', r - 0.45, r, x, y + 0.13, z, 40); GB.ring('G', '#4de1ff', r * 0.42, r * 0.42 + 0.2, x, y + 0.13, z, 28); const p = { id, name, x, y: y + 0.1, z, r, charger: false, priv: false, taxi: true }; city.pads.push(p); return p; };

  // ================= Solara Bay ====================================================================
  solid(DECK, 305, 1315, -0.2, 0.2, 1150, 1158, 'B', { noCam: true });                                  // the boardwalk
  for (let x = 320; x <= 1300; x += 35) { put('lamp', x, 1151.3, 0, 0, 0.2); if ((x / 35 | 0) % 2) put('bench', x + 12, 1156.4, 0, 0, 0.2); if ((x / 35 | 0) % 4 === 1) put('bin', x + 5, 1151.2, 0, 0, 0.2); }
  for (let x = 312; x <= 1310; x += 14) if (Math.abs(x - 810) > 9) plant(x, 1160.6, rng.range(0.9, 1.2), 2);
  // umbrellas and loungers on the sand, lifeguard towers, changing huts, a rack of boards
  const free = (x, z) => !(x > 796 && x < 824) && !(x > 684 && x < 714 && z > 1170) && !(x > 758 && x < 786 && z < 1176) && !(x > 832 && x < 864 && z < 1184) && !(x > 552 && x < 606 && z < 1170);
  for (const z of [1170, 1182]) for (let x = 326; x <= 1296; x += 11) { if (z > coastZ(x) - 9 || !free(x, z) || rng.chance(0.3)) continue; put('umbrella', x, z, 0, rng.int(0, 4)); put('lounger', x - 1.3, z + 0.5, 0); if (rng.chance(0.7)) put('lounger', x + 1.3, z + 0.5, 0); }
  for (const x of [470, 990, 1180]) put('guard', x, 1188);
  for (let k = 0; k < 5; k++) put('hut', 562 + k * 9, 1163.5, 0, k);
  put('boards', 752, 1162.5, 0); put('boards', 1100, 1162.5, 0); put('vend', 600, 1151.5, 0, 0, 0.2); put('vend', 1040, 1151.5, 0, 0, 0.2);
  // beach volleyball court
  for (const z of [1178, 1186]) GB.quad('G', WHITE, 16, 0.12, 699, 0.0, z); for (const x of [691, 707]) GB.quad('G', WHITE, 0.12, 8, x, 0.0, 1182);
  for (const z of [1177.4, 1186.6]) { GB.cyl('S', '#232832', 0.07, 0.07, 2.5, 699, 1.25, z, 6); col.box(698.9, 699.1, 0, 2.5, z - 0.1, z + 0.1, { noCam: true }); } GB.box('S', WHITE, 0.04, 0.9, 9.2, 699, 1.95, 1182); GB.box('G', '#ffd34d', 0.06, 0.08, 9.2, 699, 2.42, 1182);
  // the pier: stairs up from the boardwalk, a long deck on piles, a wide head with the wheel
  for (let n = 0; n < 10; n++) solid(DECK, 805, 815, 0, 0.5 + n * 0.3, 1158 + n, 1159 + n, 'S', { noCam: true });
  solid(DECK, 805, 815, 2.8, 3.2, 1168, 1380, 'B', { noCam: true }); solid(DECK, 790, 830, 2.8, 3.2, 1380, 1424, 'B', { noCam: true });
  for (let z = 1180; z <= 1420; z += 20) for (const x of z >= 1380 ? [792, 810, 828] : [806.2, 813.8]) GB.cyl('S', '#4a3626', 0.35, 0.4, 3.6, x, 1.0, z, 8);
  const rail = (x0, z0, x1, z1) => { const ax = Math.abs(x1 - x0) > Math.abs(z1 - z0), len = ax ? x1 - x0 : z1 - z0, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2; GB.box('S', STEEL, ax ? len : 0.08, 0.08, ax ? 0.08 : len, mx, 4.3, mz); GB.box('S', '#6a7280', ax ? len : 0.06, 0.06, ax ? 0.06 : len, mx, 3.8, mz); for (let t = 0; t <= len; t += 4) GB.box('S', '#39404c', 0.1, 1.1, 0.1, ax ? x0 + t : x0, 3.75, ax ? z0 : z0 + t); col.box(Math.min(x0, x1) - 0.08, Math.max(x0, x1) + 0.08, 3.2, 4.3, Math.min(z0, z1) - 0.08, Math.max(z0, z1) + 0.08, { noCam: true }); };
  rail(805.1, 1168, 805.1, 1380); rail(814.9, 1168, 814.9, 1380); rail(790.1, 1380, 805, 1380); rail(815, 1380, 829.9, 1380); rail(790.1, 1380, 790.1, 1424); rail(790.1, 1423.9, 829.9, 1423.9); rail(829.9, 1380, 829.9, 1393.6); rail(829.9, 1398.4, 829.9, 1424);
  for (let z = 1190; z <= 1370; z += 30) { draw.lamp(GB, (z / 30 | 0) % 2 ? 806 : 814, 3.2, z, (z / 30 | 0) % 2 ? Math.PI / 2 : -Math.PI / 2); if ((z / 30 | 0) % 2) { draw.bench(GB, 813.6, 3.2, z + 12, -Math.PI / 2); seat('pier' + z, 813.6, 3.2, z + 12, -Math.PI / 2); col.box(813.3, 813.9, 3.2, 4.1, z + 11.1, z + 12.9, { noCam: true }); } }
  draw.truck(GB, 797, 3.2, 1388, 0); col.box(795.8, 798.2, 3.2, 5.8, 1385.3, 1390.7, { noCam: true }); draw.vend(GB, 824, 3.2, 1384, Math.PI); col.box(823.4, 824.6, 3.2, 5.2, 1383.5, 1384.5, { noCam: true });
  // the big wheel: fixed legs here; the turning rim and the gondolas are made below
  const W = { x: 810, y: 26.8, z: 1404, r: 22 };
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) { beam(W.x + sx * 13, 3.2, W.z + sz * 3.2, W.x, W.y, W.z + sz * 1.4, 0.45); col.box(W.x + sx * 13 - 0.6, W.x + sx * 13 + 0.6, 3.2, 6, W.z + sz * 3.2 - 0.6, W.z + sz * 3.2 + 0.6, { noCam: true }); }
  beam(W.x, W.y, W.z - 2, W.x, W.y, W.z + 2, 0.8); solid('#232832', 806, 814, 3.2, 3.6, 1401, 1407, 'S', { noCam: true }); GB.box('G', '#ffd34d', 3, 0.5, 0.08, 810, 5.6, 1400.6);
  // down to the ferry pontoon on the east side of the pier head
  for (let n = 0; n < 7; n++) solid(DECK, 830 + n, 831 + n, 0, 2.8 - n * 0.4, 1394, 1398, 'S', { noCam: true });
  solid('#59606c', 837, 851, -0.3, 0.4, 1390, 1402, 'B', { noCam: true }); for (const z of [1390.3, 1401.7]) GB.box('S', '#ffb347', 14, 0.12, 0.12, 844, 0.5, z);
  // jet-ski jetty and hire hut, buoys for the bay run, a line of swim-zone floats
  solid(DECK, 770.5, 773.5, 0, 0.45, 1230, 1256, 'B', { noCam: true }); draw.hut(GB, 766, 0, 1224, 0, 1); col.box(764.9, 767.1, 0, 2.6, 1222.9, 1225.1); GB.box('G', '#59e0ff', 1.6, 0.4, 0.05, 766, 2.0, 1222.85);
  const buoys = [[700, 1310], [560, 1345], [470, 1290], [600, 1430], [770, 1470], [900, 1350]];
  for (const [x, z] of buoys) { GB.cyl('S', '#ff7a45', 0.25, 0.6, 1.1, x, 0.5, z, 8); GB.cyl('G', '#ffd34d', 0.12, 0.12, 0.5, x, 1.3, z, 6); }
  for (let x = 330; x <= 1290; x += 24) if (Math.abs(x - 810) > 30) GB.cyl('S', x % 48 ? '#e9edf2' : '#c0483f', 0.22, 0.22, 0.3, x, 0.15, coastZ(x) + 24, 6);
  // surf shop and beach bar, either side of the pier stairs
  { const st = room(kit, { id: 'surf', name: 'Longboard Surf Shop', x0: 764, x1: 782, z0: 1160, z1: 1171, h: 3.6, door: 'N', wall: '#2f6f8f', floor: '#c9b68f', lamp: '#eaf6ff', staffed: true });
    counter(kit, 776.5, 780.5, 1166, 1166.8, 0, '#e9edf2'); st.counter = { x: 778.5, y: 0, z: 1165 }; st.keeper = { x: 778.5, y: 0, z: 1168.6, yaw: Math.PI };
    for (let k = 0; k < 6; k++) kit.box(lit(['#ff7a45', '#59e0ff', '#ffd34d', '#e9edf2', '#7dff9c', '#c9709f'][k], 0.3), 0.5, 2.3, 0.1, 765.5 + k * 1.2, 1.25, 1170.4);
    kit.box(lit('#2b303a', 0.2), 0.8, 1.1, 4, 765.2, 0.55, 1164); kit.box(lit('#e9edf2', 0.3), 0.7, 0.3, 3.6, 765.2, 1.3, 1164); kit.finish(group, 773, 1165, ctx.rooms); }
  { const st = room(kit, { id: 'beachbar', name: 'Driftwood Bar', x0: 838, x1: 858, z0: 1160, z1: 1171, h: 3.4, door: 'N', dw: 3, wall: '#7a5a3f', floor: '#b9a887', lamp: '#ffe2b0', staffed: true });
    counter(kit, 841, 855, 1166.6, 1167.4, 0, '#c9a24a'); st.counter = { x: 848, y: 0, z: 1165.4 }; st.keeper = { x: 848, y: 0, z: 1169, yaw: Math.PI };
    for (let k = 0; k < 5; k++) { const x = 842.5 + k * 2.7; kit.cyl(lit('#c9b68f', 0.2), 0.2, 0.17, 0.5, x, 0.25, 1165.6, 10); kit.seat('bar' + k, x, 0, 1165.6, 0); }
    for (let k = 0; k < 8; k++) kit.box(lit(['#7dff9c', '#ffd34d', '#ff7ad9', '#59e0ff'][k % 4], 0.5), 0.14, 0.4, 0.14, 842 + k * 1.7, 1.7, 1170.4);
    kit.box(lit('#3b2f26', 0.2), 14, 0.08, 0.4, 848, 1.45, 1170.4); kit.finish(group, 848, 1165, ctx.rooms);
    for (let k = 0; k < 3; k++) kit.table('terrace' + k, 842 + k * 6, 0, 1176, lit('#e9edf2', 0.1), lit(WOOD, 0.1)); kit.finish(group, 848, 1176, ctx.rooms); }
  pad('solaraPad', 'Solara Bay', 1288, -0.04, 1176, 6.5);

  // ================= Old Earth seafront ============================================================
  for (const [x0, x1] of [[-300, -73], [-47, 300]]) { GB.box('S', STEEL, x1 - x0, 0.08, 0.08, (x0 + x1) / 2, 1.05, 1204.6); GB.box('S', '#7c8089', x1 - x0, 0.7, 0.35, (x0 + x1) / 2, 0.33, 1204.6); col.box(x0, x1, 0, 1.05, 1204.4, 1204.8, { noCam: true }); }
  for (let x = -290; x <= 290; x += 36) { if (Math.abs(x + 60) < 20) continue; put('lamp', x, 1202, 0); put('bench', x + 14, 1200.6, 0); plant(x + 6, 1163, rng.range(0.9, 1.3), rng.chance(0.25) ? 1 : 0); }
  { const x = 150, z = 1180; GB.cyl('B', '#8d9199', 6, 6.3, 0.6, x, 0.28, z, 8); col.box(x - 4.4, x + 4.4, 0, 0.6, z - 4.4, z + 4.4, { noCam: true }); for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; GB.cyl('S', WHITE, 0.14, 0.14, 3.2, x + Math.cos(a) * 5.4, 2.2, z + Math.sin(a) * 5.4, 6); } GB.cyl('B', '#2f6f4f', 0.5, 6.6, 1.9, x, 4.75, z, 8); GB.cyl('G', '#ffd34d', 0.2, 0.2, 0.6, x, 6, z, 6); }

  // ================= Tidewater Port ================================================================
  { const st = room(kit, { id: 'fishmarket', name: 'Tidewater Fish Market', x0: -374, x1: -350, z0: 1160, z1: 1178, h: 4.2, door: 'N', dw: 3, wall: '#34495e', floor: '#9aa3ad', lamp: '#eaf6ff', staffed: true });
    counter(kit, -370, -356, 1171.6, 1172.4, 0, '#dfe5ee'); st.counter = { x: -363, y: 0, z: 1170.4 }; st.keeper = { x: -363, y: 0, z: 1174.6, yaw: Math.PI };
    for (let k = 0; k < 4; k++) { const x = -371 + k * 5.6; kit.box(lit('#cfd8e3', 0.3), 3.6, 0.9, 1.6, x + 1, 0.45, 1164.5); kit.box(lit(['#c9709f', '#9fb3c8', '#ff9a5a', '#7f8fa3'][k], 0.35), 3.2, 0.12, 1.2, x + 1, 0.96, 1164.5); }
    kit.finish(group, -362, 1169, ctx.rooms); }
  solid('#59606c', -331, -325, -0.3, 0.45, 1205, 1234, 'B', { noCam: true }); draw.shelter(GB, -328, 0, 1197, 0); col.box(-331, -325, 0, 2.6, 1196, 1196.6, { noCam: true }); GB.box('G', '#59e0ff', 2.4, 0.6, 0.08, -328, 3.1, 1196.3);
  // container yard: rows of stacks between the streets, clear lanes at every street end
  for (let x = -1560; x <= -440; x += 6.8) {
    const lane = Math.abs(((x - 60) % 120 + 120) % 120 - 0) < 11 || Math.abs(((x - 60) % 120 + 120) % 120 - 120) < 11;
    if (lane) continue;
    for (const z of [1159.4, 1162, 1171.4, 1174]) { const n = rng.int(0, 4); if (!n) continue; for (let k = 0; k < n; k++) GB.box('B', rng.pick(BOXES), 6.1, 2.55, 2.4, x, 1.28 + k * 2.6, z); col.box(x - 3.05, x + 3.05, 0, n * 2.6, z - 1.2, z + 1.2); }
  }
  // gantry cranes on the quay edge; their trolleys run out over the ships
  const cranes = [-1320, -1020, -720, -470];
  for (const x of cranes) {
    for (const sx of [-1, 1]) for (const z of [1189, 1203]) solid('#d9a52e', x + sx * 9 - 0.6, x + sx * 9 + 0.6, 0, 36, z - 0.6, z + 0.6);
    for (const sx of [-1, 1]) GB.box('B', '#d9a52e', 1, 1.2, 15, x + sx * 9, 35.6, 1196); for (const z of [1189, 1203]) GB.box('B', '#d9a52e', 19, 1.2, 1, x, 35.6, z);
    GB.box('B', '#d9a52e', 2.6, 2.2, 78, x, 38, 1213); GB.box('S', '#2b3340', 3.4, 2.6, 4, x, 34.6, 1184); GB.box('L', '#bfe4ff', 3.45, 1, 2, x, 34.9, 1185);
    beam(x, 47, 1196, x, 39, 1250, 0.2); beam(x, 47, 1196, x, 39, 1176, 0.2); beam(x, 39, 1196, x, 47, 1196, 0.5); GB.box('G', '#ff3b30', 0.5, 0.5, 0.5, x, 47.6, 1196);
  }
  // two ships alongside
  for (const [x, len, hull] of [[-1170, 150, '#7a2f2f'], [-640, 118, '#22303f']]) {
    solid(hull, x - len / 2, x + len / 2, -1.2, 7.4, 1213, 1233); GB.box('S', '#1c2028', len + 0.2, 0.5, 20.2, x, 7.5, 1223); GB.box('S', '#b84a4a', len + 0.1, 1.2, 20.1, x, 0.2, 1223);
    solid(WHITE, x + len / 2 - 20, x + len / 2 - 8, 7.4, 23, 1215, 1231); GB.box('L', '#ffe2b0', 12.2, 1.4, 16.2, x + len / 2 - 14, 20.4, 1223); GB.box('S', '#d9a52e', 3, 6, 3, x + len / 2 - 12, 26, 1223);
    let top = 0; for (let cx = x - len / 2 + 8; cx < x + len / 2 - 26; cx += 6.6) for (const z of [1215.6, 1218.4, 1221.2, 1224, 1226.8, 1229.6]) { const n = rng.int(1, 3); top = Math.max(top, n); for (let k = 0; k < n; k++) GB.box('S', rng.pick(BOXES), 6.1, 2.55, 2.4, cx, 9 + k * 2.6, z); }
    col.box(x - len / 2 + 5, x + len / 2 - 26, 7.4, 7.7 + top * 2.6, 1214.4, 1230.8);
  }
  for (const x of [-1480, -1170, -870, -590]) { GB.cyl('S', '#39404c', 0.25, 0.4, 20, x, 10, 1184, 8); col.box(x - 0.4, x + 0.4, 0, 20, 1183.6, 1184.4, { noCam: true }); GB.box('L', '#fff0d2', 3, 0.5, 1.2, x, 20.2, 1184.8); }
  pad('portPad', 'Tidewater Port', -590, -0.04, 1195, 6.5);

  // ================= offshore ======================================================================
  // Beacon Isle: a low green island with a lighthouse, a cottage, a jetty on the north side
  { const I = ISLAND, N = 36, RINGS = 8, pos = [I.x, I.h, I.z], colr = [], idx = [], c0 = new THREE.Color('#b9a477'), c1 = new THREE.Color('#3a7048');
    colr.push(c1.r, c1.g, c1.b);
    for (let r = 1; r <= RINGS; r++) for (let k = 0; k < N; k++) { const d = (r / RINGS) * (I.r + 3), a = (k / N) * TAU, x = I.x + Math.cos(a) * d, z = I.z + Math.sin(a) * d, c = d > I.top + 4 ? c0 : c1; pos.push(x, d > I.r ? -0.5 : isleY(x, z), z); colr.push(c.r, c.g, c.b); }
    for (let k = 0; k < N; k++) idx.push(0, 1 + ((k + 1) % N), 1 + k);
    for (let r = 1; r < RINGS; r++) for (let k = 0; k < N; k++) { const a = 1 + (r - 1) * N + k, b = 1 + (r - 1) * N + ((k + 1) % N), c = a + N, d = b + N; idx.push(a, b, d, a, d, c); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, MATS.S); m.receiveShadow = true; m.matrixAutoUpdate = false; group.add(m);
    const y = I.h; GB.cyl('B', WHITE, 2.6, 4, 30, I.x, y + 15, I.z, 16); for (const b of [7, 17]) GB.cyl('S', '#c0483f', 4.04 - 0.0467 * (b + 2), 4.04 - 0.0467 * (b - 2), 4, I.x, y + b, I.z, 16);
    GB.cyl('S', '#232832', 3.6, 3.6, 0.3, I.x, y + 30.1, I.z, 16); GB.cyl('L', '#fff0d2', 1.7, 1.7, 2.6, I.x, y + 31.6, I.z, 10); GB.cyl('B', '#c0483f', 0.3, 2.4, 1.6, I.x, y + 33.7, I.z, 10); col.box(I.x - 3, I.x + 3, y, y + 34, I.z - 3, I.z + 3);
    solid('#d6cfbf', I.x + 12, I.x + 20, y, y + 3.2, I.z + 6, I.z + 12); GB.gable('B', '#8a4a3a', 8.6, 6.6, 1.8, I.x + 16, y + 3.2, I.z + 9); GB.box('L', '#ffe2b0', 1.2, 1, 0.06, I.x + 14.5, y + 1.7, I.z + 5.96);
    solid('#59606c', I.x - 3, I.x + 3, -0.3, 0.6, I.z - 62, I.z - 42, 'B', { noCam: true });
    for (const [dx, dz, a] of [[-10, 14, 0.6], [8, -14, 3.5]]) { draw.bench(GB, I.x + dx, y, I.z + dz, a); seat('isle' + dx, I.x + dx, y, I.z + dz, a); }
    for (const [dx, dz, s] of [[-18, -6, 1.1], [-14, 10, 0.9], [20, -8, 1.0], [6, 22, 1.2], [-4, -22, 0.9]]) { GB.cyl('S', '#3b2f2a', 0.15 * s, 0.25 * s, 3.6 * s, I.x + dx, y + 1.8 * s, I.z + dz, 6); GB.blob('B', '#2f8f5a', 2.4 * s, 2 * s, 2.4 * s, I.x + dx, y + 4.6 * s, I.z + dz, dx); col.box(I.x + dx - 0.3, I.x + dx + 0.3, y, y + 3, I.z + dz - 0.3, I.z + dz + 0.3, { noCam: true }); }
    ctx.cache(I.x - 6, y, I.z + 5); }
  // wind farm east of the bay
  const turbines = []; for (let k = 0; k < 8; k++) { const x = 1560 + (k % 4) * 210, z = 1720 + (k >> 2) * 260 + (k % 2) * 60; turbines.push([x, z]); GB.cyl('B', WHITE, 1.3, 2.3, 82, x, 40, z, 12); GB.box('S', WHITE, 3, 3, 8, x, 82, z + 1); col.box(x - 2, x + 2, 0, 84, z - 2, z + 2); }
  // sea platform with a landing pad
  { const x = -900, z = 1900; for (const sx of [-1, 1]) for (const sz of [-1, 1]) { GB.cyl('B', '#d9a52e', 1.8, 1.8, 17, x + sx * 13, 8, z + sz * 13, 10); col.box(x + sx * 13 - 1.8, x + sx * 13 + 1.8, 0, 16, z + sz * 13 - 1.8, z + sz * 13 + 1.8); }
    solid('#59606c', x - 18, x + 18, 16, 17, z - 18, z + 18); solid('#3a414d', x - 16, x - 6, 17, 22, z - 16, z - 4); GB.box('L', '#bfe4ff', 10.1, 1.2, 8, x - 11, 20, z - 10); beam(x + 15, 17, z - 15, x + 26, 34, z - 26, 0.3); GB.box('G', '#ff7a45', 1.2, 2.4, 1.2, x + 26.5, 35.4, z - 26.5);
    for (const sx of [-1, 1]) { GB.box('S', STEEL, 0.1, 0.1, 36, x + sx * 17.9, 18.1, z); GB.box('S', STEEL, 36, 0.1, 0.1, x, 18.1, z + sx * 17.9); }
    pad('seaPad', 'Sea platform', x + 6, 17, z + 6, 7); ctx.cache(x - 11, 22, z - 10); }
  // sailboats at anchor in the bay
  for (const [x, z, a] of [[980, 1330, 0.4], [1090, 1420, 2.1], [420, 1400, 1.2], [200, 1330, 3.0], [-180, 1420, 0.2]]) { GB.box('B', WHITE, 2.4, 1, 7, x, 0.4, z, a); GB.cyl('S', STEEL, 0.07, 0.07, 9, x, 5, z, 5); GB.box('S', '#f4f6f9', 0.06, 6.4, 3, x - Math.cos(a) * 0.0 + Math.sin(a) * 1.4, 4.6, z + Math.cos(a) * 1.4, a); col.box(x - 2.5, x + 2.5, 0, 1, z - 2.5, z + 2.5, { noCam: true }); }
  { const m = new THREE.Mesh(mergeGeometries(beams), std('#c9d2de', 0.4, 0.7)); m.castShadow = true; m.matrixAutoUpdate = false; group.add(m); for (const g of beams) g.dispose(); }

  // ================= moving parts ==================================================================
  // the wheel: rim, spokes and lights turn about the hub; twelve gondolas stay upright
  const steel = std('#dfe5ee', 0.4, 0.6), wheel = new THREE.Group(); wheel.position.set(W.x, W.y, W.z); group.add(wheel);
  { const parts = [new THREE.TorusGeometry(W.r, 0.3, 6, 60), new THREE.TorusGeometry(W.r - 2.2, 0.16, 5, 48)], sp = [];
    for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; beam(0, 0, 0, Math.cos(a) * W.r, Math.sin(a) * W.r, 0, 0.12, sp); }
    const m = new THREE.Mesh(mergeGeometries([...parts.map((g) => g.toNonIndexed()), ...sp.map((g) => g.toNonIndexed())]), steel); wheel.add(m);
    const LB = new Builder(); for (let k = 0; k < 48; k++) { const a = (k / 48) * TAU; LB.box('L', ['#ff7ad9', '#59e0ff', '#ffd34d'][k % 3], 0.5, 0.5, 0.2, Math.cos(a) * (W.r - 1.1), Math.sin(a) * (W.r - 1.1), 0.4); }
    const lm = LB.b.L.mesh(MATS.L, false); lm.updateMatrix(); wheel.add(lm); }
  const gond = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 2.1, 1.9), new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.3 }), 12), gc = new THREE.Color(), m4 = new THREE.Matrix4();
  for (let k = 0; k < 12; k++) gond.setColorAt(k, gc.set(['#c0483f', '#2f6f8f', '#d9b84a', '#e9edf2'][k % 4])); gond.boundingSphere = new THREE.Sphere(new THREE.Vector3(W.x, W.y, W.z), W.r + 4); group.add(gond);
  // crane trolleys with a container on the hook, turbine blades, the lighthouse beam, a freighter far out
  const troll = new THREE.InstancedMesh(new THREE.BoxGeometry(3.4, 1.4, 3), std('#2b3340', 0.5, 0.5), cranes.length), load = new THREE.InstancedMesh(new THREE.BoxGeometry(6.1, 2.55, 2.4), new THREE.MeshStandardMaterial({ roughness: 0.7 }), cranes.length);
  cranes.forEach((x, k) => load.setColorAt(k, gc.set(BOXES[k]))); troll.boundingSphere = load.boundingSphere = new THREE.Sphere(new THREE.Vector3(-895, 25, 1215), 470); group.add(troll, load);
  const bladeG = new THREE.BoxGeometry(1.6, 36, 0.4); bladeG.translate(0, 19, 0);
  const blades = new THREE.InstancedMesh(bladeG, std(WHITE, 0.5, 0.2), turbines.length * 3), qz = new THREE.Quaternion(), zAxis = new THREE.Vector3(0, 0, 1), one = new THREE.Vector3(1, 1, 1), v3 = new THREE.Vector3(); blades.boundingSphere = new THREE.Sphere(new THREE.Vector3(1875, 82, 1880), 460); group.add(blades);
  const beamG = new THREE.CylinderGeometry(7, 0.4, 150, 12, 1, true); beamG.rotateX(Math.PI / 2); beamG.translate(0, 0, 75);
  const light = new THREE.Mesh(beamG, new THREE.MeshBasicMaterial({ color: 0xfff0d2, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); light.position.set(ISLAND.x, ISLAND.h + 31.6, ISLAND.z); group.add(light);
  // gulls gliding over the beach and the pier
  const gullG = new THREE.BoxGeometry(1.7, 0.05, 0.34), gulls = new THREE.InstancedMesh(gullG, new THREE.MeshBasicMaterial({ color: 0xf2f4f7 }), 16), qg = new THREE.Quaternion(), eg = new THREE.Euler(); gulls.boundingSphere = new THREE.Sphere(new THREE.Vector3(810, 15, 1280), 560); group.add(gulls);
  const FB = new Builder(); FB.box('B', '#1f2c3a', 16, 9, 150, 0, 3, 0); FB.box('S', WHITE, 14, 16, 12, 0, 15, -62); for (let z = -50; z < 60; z += 6.6) for (const x of [-5.4, -2.7, 0, 2.7, 5.4]) FB.box('S', BOXES[Math.abs(Math.round(z * 7 + x * 3)) % 7], 2.4, 5.2, 6.1, x, 10.1, z);
  const freighter = FB.finish(new THREE.Group()); group.add(freighter);

  return {
    wheel: { ...W, a: 0, board: { x: 810, y: 3.6, z: 1404 }, gondola(k, out) { const a = this.a + (k / 12) * TAU - Math.PI / 2; return out.set(W.x + Math.cos(a) * W.r, W.y + Math.sin(a) * W.r - 1.5, W.z); } },
    fish: { x: 792.5, y: 3.2, z: 1421 }, jetski: { x: 772, y: 0.45, z: 1250, yaw: 0 }, volley: { x: 695, y: 0, z: 1182 }, buoys,
    ferry: [{ x: -328, y: 0.45, z: 1228, name: 'Tidewater Port' }, { x: ISLAND.x, y: 0.6, z: ISLAND.z - 56, name: 'Beacon Isle' }, { x: 844, y: 0.4, z: 1396, name: 'Solara pier' }],   // in the order the ferry calls
    update(dt, t, night) {
      const w = this.wheel; w.a += dt * 0.07; wheel.rotation.z = w.a;
      for (let k = 0; k < 12; k++) { w.gondola(k, v3); m4.makeTranslation(v3.x, v3.y, v3.z); gond.setMatrixAt(k, m4); } gond.instanceMatrix.needsUpdate = true;
      cranes.forEach((x, k) => { const ph = t * 0.05 + k * 1.7, z = 1219 + Math.sin(ph) * 27, drop = 6 + (0.5 + 0.5 * Math.sin(ph * 2.3 + k)) * 16; m4.makeTranslation(x, 36.1, z); troll.setMatrixAt(k, m4); m4.makeTranslation(x, 36.1 - drop, z); load.setMatrixAt(k, m4); });
      troll.instanceMatrix.needsUpdate = true; load.instanceMatrix.needsUpdate = true;
      turbines.forEach(([x, z], k) => { for (let b = 0; b < 3; b++) { qz.setFromAxisAngle(zAxis, t * (0.5 + (k % 3) * 0.07) + k + (b / 3) * TAU); m4.compose(v3.set(x, 82, z - 3.4), qz, one); blades.setMatrixAt(k * 3 + b, m4); } }); blades.instanceMatrix.needsUpdate = true;
      for (let k = 0; k < 16; k++) { const cx = k < 10 ? 520 + (k % 5) * 150 : 810, cz = k < 10 ? 1215 + (k % 3) * 22 : 1300 + (k % 3) * 50, R = 22 + (k % 4) * 11, a = t * (0.22 + (k % 3) * 0.05) * (k % 2 ? 1 : -1) + k * 1.9; eg.set(0, -a + (k % 2 ? 0 : Math.PI), (k % 2 ? 1 : -1) * 0.35 + Math.sin(t * 3 + k) * 0.25, 'YXZ'); qg.setFromEuler(eg); m4.compose(v3.set(cx + Math.cos(a) * R, 9 + (k % 5) * 3.5 + Math.sin(t * 0.7 + k) * 1.5, cz + Math.sin(a) * R), qg, one); gulls.setMatrixAt(k, m4); } gulls.instanceMatrix.needsUpdate = true; gulls.visible = night < 0.6;
      light.rotation.y = t * 0.35; light.material.opacity = night * 0.16; light.visible = night > 0.05;
      const fa = t * 0.0035; freighter.position.set(Math.cos(fa) * 2300, 0, 2650 + Math.sin(fa) * 320); freighter.rotation.y = Math.atan2(-Math.sin(fa) * 2300, Math.cos(fa) * 320);
    },
  };
}
