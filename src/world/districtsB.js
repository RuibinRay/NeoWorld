// Neon District (two levels), Old Earth and the Industrial Nexus.
import * as THREE from 'three';
import { M, std, neon } from './materials.js';
import { RNG, PathLine, roundedRectLoop, TAU } from '../core/util.js';
import { room, counter, shelf, lit } from './stores.js';

// ---- Neon District: neon avenues on raised plates, the Undercity beneath them ----------------------
// kU builds at deck level (14 m), kL at ground level. A cross-shaped canyon 30 m wide separates four plates.
export function neonDistrict(kU, kL) {
  const F = M.facades, plate = std('#1a1d26', 0.5, 0.5), dark = std('#1b1e27', 0.45, 0.4), mag = neon('#ff7ad9', 1.4), cy = neon('#59e0ff', 1.4), T = {};
  kL.flat(dark, 380, 380, 0, 0.03, 0);
  // the Undercity never sees the sun: pools of coloured light along the canyon and under the plates
  for (let v = -150; v <= 150; v += 30) { kL.glow(v % 60 ? '#ff7ad9' : '#59e0ff', 12, 0, v); if (v) kL.glow(v % 60 ? '#59e0ff' : '#ff7ad9', 12, v, 0); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const [x, z] of [[60, 60], [120, 60], [60, 120], [120, 120], [36, 36]]) kL.glow('#ffb060', 16, sx * x, sz * z);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x0 = sx < 0 ? -168 : 15, x1 = sx < 0 ? -15 : 168, z0 = sz < 0 ? -168 : 15, z1 = sz < 0 ? -15 : 168, ix = sx < 0 ? x1 : x0, iz = sz < 0 ? z1 : z0;
    kU.solid(plate, x0, x1, -0.8, 0, z0, z1);
    kL.box(sx * sz > 0 ? mag : cy, 0.3, 0.3, 153, ix - sx * 0.3, 13, (z0 + z1) / 2); kL.box(sx * sz > 0 ? cy : mag, 153, 0.3, 0.3, (x0 + x1) / 2, 13, iz - sz * 0.3);
    for (const [px, pz] of [[x0 + 10, z0 + 10], [x1 - 10, z0 + 10], [x0 + 10, z1 - 10], [x1 - 10, z1 - 10]]) { kL.cyl(M.concrete, 2, 2.4, 13.2, px, 6.6, pz, 10); kL.solid(null, px - 2, px + 2, 0, 13.2, pz - 2, pz + 2); }
    // rails on the canyon edges (gaps where the bridges land) and the outer edges
    const a = sz * 80, b = sz * 90; kU.rail(ix, iz, ix, a, M.glassDark); kU.rail(ix, b, ix, sz * 168, M.glassDark);
    const c = sx * 80, d = sx * 90; kU.rail(ix, iz, c, iz, M.glassDark); kU.rail(d, iz, sx * 168, iz, M.glassDark);
    kU.rail(sx * 168, iz, sx * 168, sz * 168, M.glassDark); kU.rail(ix, sz * 168, sx * 168, sz * 168, M.glassDark);
  }
  for (const s of [-1, 1]) { // four bridges with rails
    const lo = Math.min(s * 80, s * 90), hi = Math.max(s * 80, s * 90);
    kU.solid(M.glassDark, -15, 15, -0.6, 0, lo, hi); kU.rail(-15, lo, 15, lo, M.glassDark, 1.1); kU.rail(-15, hi, 15, hi, M.glassDark, 1.1);
    kU.solid(M.glassDark, lo, hi, -0.6, 0, -15, 15); kU.rail(lo, -15, lo, 15, M.glassDark, 1.1); kU.rail(hi, -15, hi, 15, M.glassDark, 1.1);
  }
  // towers stand on the plates; their cores come down into the Undercity
  const towers = [[-150, -110, -150, -110, 180, F.magenta, '#ff7ad9'], [-92, -42, -150, -104, 240, F.corp, '#59e0ff'], [-150, -104, -84, -40, 120, F.glass, '#b98cff'],
    [40, 92, -150, -104, 210, F.corp, '#ff7ad9'], [112, 156, -150, -112, 150, F.magenta, '#7dff9c'], [110, 152, -84, -40, 260, F.glass, '#ff7ad9'],
    [-150, -104, 40, 92, 140, F.corp, '#ffd34d'], [-150, -112, 112, 156, 200, F.magenta, '#59e0ff'], [40, 84, 112, 152, 170, F.glass, '#ff7ad9'], [112, 156, 104, 152, 230, F.corp, '#b98cff']];
  for (const [x0, x1, z0, z1, h, f, n] of towers) { kU.tower(f, x0, x1, z0, z1, 0, h, { neon: n, crown: n }); kL.solid(dark, (x0 + x1) / 2 - 6, (x0 + x1) / 2 + 6, 0, 13.2, (z0 + z1) / 2 - 6, (z0 + z1) / 2 + 6); }
  kU.sign('PULSE', 30, 12, 91.5, 60, -127, -Math.PI / 2 + Math.PI, { color: '#ff7ad9', sub: 'down in the undercity · every night' });
  kU.sign('SIM ARENA', 26, 7, 125, 16, 34.4, Math.PI, { color: '#7dff9c', sub: 'full-dive target range' });
  kU.sign('TIN LANTERN', 24, 8, -41.4, 70, -127, Math.PI / 2, { color: '#ffd34d', sub: 'robot bar · no closing time' });
  kU.sign('NEON DISTRICT', 40, 9, 0, 58, -166, 0, { color: '#59e0ff' });
  // Sim Arena (upper level)
  kU.tower(F.magenta, 100, 150, 35, 70, 4.65, 10, { crown: '#7dff9c' });
  room(kU, { id: 'simarena', name: 'Sim Arena', x0: 100, x1: 150, z0: 35, z1: 70, h: 4.4, door: 'W', at: 52.5, dw: 3.4, front: false, wall: '#1c2630', floor: '#14181e', lamp: '#bfffe0', staffed: true });
  T.vr = kU.abs(110, 0, 41);
  for (let i = 0; i < 3; i++) { kU.cyl(std('#20262f', 0.4, 0.7), 1.1, 1.2, 0.2, 106 + i * 4, 0.1, 38, 20); kU.cyl(neon('#7dff9c', 1.1), 1.0, 1.0, 0.04, 106 + i * 4, 0.22, 38, 20); }
  counter(kU, 105.2, 106, 56, 60, 0, '#bfffe0');
  T.lanes = [58.5, 62, 65.5].map((z) => {                                    // bowling: three lanes running east from the foul line
    kU.box(lit('#c9a063', 0.25), 22, 0.06, 1.1, 129, 0.05, z); for (const e of [-0.7, 0.7]) kU.box(std('#15171c', 0.5, 0.4), 22, 0.05, 0.25, 129, 0.04, z + e);
    kU.box(neon('#ff7ad9', 1.2), 0.08, 0.07, 1.6, 118, 0.06, z); kU.box(lit('#2b303a', 0.2), 1.2, 1.4, 1.6, 141, 0.7, z);
    return kU.abs(118, 0, z);
  });
  T.bowl = kU.abs(116.4, 0, 62); T.pinX = kU.cx + 138.4;
  T.cabinets = [41, 44.5].map((z, i) => { kU.solid(lit('#20262f', 0.2), 102.2, 103.1, 0, 1.9, z - 0.5, z + 0.5); kU.box(neon(i ? '#ff7ad9' : '#59e0ff', 1.3), 0.06, 0.7, 0.8, 103.14, 1.35, z); return kU.abs(104.1, 0, z); });
  // lifts between the levels
  T.lifts = [[-22, 96], [96, -22]].map(([x, z]) => { kL.box(M.glassDark, 2.2, 13.2, 2.2, x, 6.6, z); for (const e of [-1.1, 1.1]) kL.box(cy, 0.1, 13.2, 0.1, x + e, 6.6, z + e); kL.solid(null, x - 1.1, x + 1.1, 0, 13.2, z - 1.1, z + 1.1); kU.box(cy, 2.4, 0.1, 2.4, x, 0.06, z); kU.box(M.glassDark, 2.2, 2.6, 2.2, x, 1.3, z); return { low: kL.abs(x, 0, z - 2), up: kU.abs(x, 0, z - 2.2) }; });
  // Undercity: night market in the open canyon, club under the north-east plate, bar under the north-west
  for (let i = 0; i < 8; i++) { const x = i % 2 ? 10.5 : -10.5, z = [-120, -96, -56, -32, 30, 54, 96, 120][i], hex = ['#ff7ad9', '#59e0ff', '#ffd34d', '#7dff9c'][i % 4];
    kL.solid(M.wood, x - 2.2, x + 2.2, 0, 1, z - 0.9, z + 0.9); kL.box(std(hex, 0.8, 0), 5, 0.12, 2.6, x, 2.7, z); for (const e of [-2.2, 2.2]) kL.box(M.metalDark, 0.08, 2.7, 0.08, x + e, 1.35, z); for (const e of [-1.2, 0, 1.2]) kL.ball(neon(hex, 1.8), 0.17, x + e, 2.35, z + 0.9); }
  const floorMat = new THREE.MeshBasicMaterial({ color: 0xff7ad9 }), floor = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), floorMat); floor.rotation.x = -Math.PI / 2; kL.mesh(floor, 60, 0.06, -60);
  kL.solid(M.metalDark, 92, 104, 0, 1.2, -66, -62); for (const z of [-74, -54]) kL.solid(std('#15171c', 0.5, 0.4), 96, 100, 0, 5, z - 1.5, z + 1.5);
  const beams = [0, 1, 2].map((i) => { const g = new THREE.ConeGeometry(2.2, 12, 12, 1, true); g.translate(0, -6, 0); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: i % 2 ? 0x59e0ff : 0xff7ad9, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); return kL.mesh(m, 50 + i * 10, 12.6, -60); });
  kL.updates.push((dt, t) => { const h = (t * 0.25) % 1; floorMat.color.setHSL(h, 0.9, 0.32 + Math.abs(Math.sin(t * 7.8)) * 0.14); beams.forEach((b, i) => { b.rotation.x = Math.sin(t * 1.1 + i * 2) * 0.5; b.rotation.z = Math.cos(t * 0.8 + i) * 0.5; }); });
  T.club = kL.abs(60, 0, -60);
  room(kL, { id: 'tinlantern', name: 'Tin Lantern', x0: -74, x1: -46, z0: -69.5, z1: -53, h: 4.6, door: 'S', dw: 3.2, front: false, wall: '#2b2533', floor: '#231d24', lamp: '#ffcf8a', staffed: true });
  for (let i = 0; i < 5; i++) kL.stool('bar' + i, -68 + i * 4, -61.3, Math.PI);
  kL.box(lit('#e9e3d5', 0.4), 0.05, 0.9, 0.9, -46.36, 1.7, -58); kL.box(neon('#ff4d4d', 1.3), 0.06, 0.2, 0.2, -46.4, 1.7, -58); T.darts = kL.abs(-49.4, 0, -58);
  kL.solid(M.wood, -72, -48, 0, 1.1, -63, -62.2); for (let i = 0; i < 9; i++) kL.ball(neon(['#ffd34d', '#ff7ad9', '#59e0ff'][i % 3], 1.6), 0.18, -70 + i * 2.5, 1.5, -66); kL.box(M.metalDark, 24, 3, 0.4, -60, 1.5, -67);
  for (const x of [-68, -60, -52]) kL.ball(neon('#ffb060', 1.7), 0.3, x, 4.2, -58);
  kL.cache(-60, 0, -74);
  T.pad = kU.pad('neonPad', 'Neon District deck', -60, 62, 7); T.kiosk = kU.kiosk(-44, 74);
  kL.fence(186);
  // upper walkways: a loop over the four bridges
  for (const [id, sx, sz] of [['nw', -1, -1], ['ne', 1, -1], ['sw', -1, 1], ['se', 1, 1]]) {
    kU.node(id + 'A', sx * 24, sz * 85); kU.node(id + 'B', sx * 85, sz * 24); kU.node(id + 'C', sx * 62, sz * (id === 'sw' ? 46 : 62)); kU.link(id + 'A', id + 'C', id + 'B', id + 'A');
    kU.node('door' + id, sx * 98, sz * 96, { door: true }); kU.link('door' + id, id + 'C');
  }
  kU.link('nwA', 'neA'); kU.link('swA', 'seA'); kU.link('nwB', 'swB'); kU.link('neB', 'seB');
  // undercity walkways: the canyon cross, with spurs to the club and the bar
  for (const [id, x, z] of [['l0', 0, -130], ['l1', 0, -60], ['l2', 0, 0], ['l3', 0, 60], ['l4', 0, 130], ['l5', -60, 0], ['l6', -130, 0], ['l7', 60, 0], ['l8', 130, 0], ['club', 60, -50], ['bar', -60, -50.5]]) kL.node(id, x, z);
  kL.link('l0', 'l1', 'l2', 'l3', 'l4'); kL.link('l6', 'l5', 'l2', 'l7', 'l8'); kL.link('l1', 'club', 'l7'); kL.link('l1', 'bar', 'l5');
  kL.node('door0', -130, 8, { door: true }); kL.link('door0', 'l6'); kL.node('door1', 130, 8, { door: true }); kL.link('door1', 'l8');
  kL.post('dj', 90, -64, -Math.PI / 2, 'club'); kL.post('bar', -60, -63.7, 0, 'bar'); kL.post('stall1', -7.4, -120, Math.PI / 2, 'l0'); kL.post('stall2', 7.4, 54, -Math.PI / 2, 'l3');
  kU.post('arcade', 106.8, 58, -Math.PI / 2, 'seC');
  kU.finish(); kL.finish();
  return T;
}

// ---- Old Earth: a preserved old town under a solar canopy ----------------------------------------------
export function oldEarth(k) {
  const F = M.facades, cobble = std('#4a4038', 0.95, 0), tile = std('#8a3b2a', 0.9, 0), stone = std('#8d8a80', 0.9, 0), rng = new RNG(1890), T = { exhibits: [] };
  const plaster = ['#d9c9a8', '#c9a58a', '#b8c2b0', '#d8b8a0', '#a8b4c4'].map((c) => std(c, 0.9, 0)), win = neon('#ffcf8a', 0.7);
  k.flat(cobble, 380, 380, 0, 0.03, 0);
  for (const gx of [-1, 0, 1]) for (const gz of [-1, 0, 1]) {
    if (!gx && !gz) continue;
    for (const hx of [-16, 16]) for (const hz of [-16, 16]) {
      const x = gx * 90 + hx, z = gz * 90 + hz, w = rng.range(24, 29), d = rng.range(24, 29), h = rng.pick([7, 10.5, 10.5, 14]), x0 = x - w / 2, z0 = z - d / 2;
      if (rng.chance(0.55)) k.tower(F.brick, x0, x0 + w, z0, z0 + d, 0, h);
      else {
        k.solid(rng.pick(plaster), x0, x0 + w, 0, h, z0, z0 + d);
        for (let y = 3.5; y < h + 0.1; y += 3.5) { k.box(M.wood, w + 0.2, 0.3, d + 0.2, x, y, z); for (const s of [-1, 1]) for (const e of [-0.28, 0.28]) { k.box(win, 1.3, 1.5, 0.12, x + e * w, y - 1.8, z + s * (d / 2 + 0.02)); k.box(win, 0.12, 1.5, 1.3, x + s * (w / 2 + 0.02), y - 1.8, z + e * d); } }
      }
      k.gable(tile, w + 1.2, d + 1.2, rng.range(3.5, 5.5), x, h, z, true);
    }
  }
  // the square: fountain, clock tower, benches, trees, warm lamps
  k.cyl(stone, 6, 6.4, 0.8, 0, 0.4, 0, 24); k.disc(new THREE.MeshStandardMaterial({ color: '#2a7f9a', roughness: 0.1, metalness: 0.6 }), 5.4, 0, 0.82, 0); k.cyl(stone, 0.8, 1.2, 3, 0, 1.5, 0, 10); k.solid(null, -5.6, 5.6, 0, 0.8, -5.6, 5.6);
  k.solid(stone, -30, -22, 0, 40, -30, -22); k.cone(tile, 6.6, 9, -26, 44.5, -26); for (const [ox, oz, w, d] of [[0, 4.1, 3.2, 0.2], [4.1, 0, 0.2, 3.2]]) k.box(neon('#fff3d0', 0.9), w, 3.2, d, -26 + ox, 33, -26 + oz);
  [[-16, 16, 0.8], [16, 16, -0.8], [16, -16, -2.3], [-16, -16 + 44, 2.3]].forEach(([x, z, yaw], i) => { k.box(M.wood, 2.2, 0.1, 0.6, x, 0.46, z, yaw); k.seat('bench' + i, x, z, yaw + Math.PI, null, null); });
  for (const [x, z] of [[-22, 22], [22, 22], [22, -22], [-12, 30], [30, 8], [-30, 6]]) k.tree(x, z, 0.85, false);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const t of [45, 100]) { for (const [x, z] of [[sx * 33, sz * t], [sx * t, sz * 33]]) { k.cyl(M.metalDark, 0.07, 0.1, 4.2, x, 2.1, z, 6); k.ball(neon('#ffb060', 1.8), 0.28, x, 4.3, z); } }
  // Hearth: a tavern terrace on the north side of the square
  k.box(M.wood, 30, 0.25, 10, 0, 3.6, -53); for (const [x, z] of [[-14.5, -48.5], [14.5, -48.5], [-14.5, -57.5], [14.5, -57.5]]) k.box(M.wood, 0.3, 3.6, 0.3, x, 1.8, z);
  k.solid(M.brick, -4, 4, 0, 2.6, -59.4, -57.4); k.box(neon('#ff7a2a', 1.6), 2.4, 1, 0.3, 0, 1.1, -57.3); k.cyl(M.brick, 0.6, 0.8, 5, 0, 5, -58.4, 8);
  [[-10, -52], [-4, -52], [4, -52], [10, -52]].forEach(([x, z], i) => k.table('h' + i, x, z, 'hearth'));
  k.sign('HEARTH', 8, 1.8, 0, 4.9, -47.8, 0, { color: '#ffd9a0', sub: 'wood fire · cooked by hand' });
  // House of Old Things: exhibits under an arcade on the east side
  k.box(tile, 10, 0.3, 54, 52, 4.2, 0); for (let z = -26; z <= 26; z += 13) k.box(stone, 0.5, 4.2, 0.5, 47.5, 2.1, z);
  [['#3a3f4a', 'box'], ['#b23a48', 'ball'], ['#c9a063', 'box'], ['#2f6b55', 'ball'], ['#d7dbe2', 'box'], ['#4a3f6e', 'ball']].forEach(([hex, shape], i) => {
    const z = -20 + i * 8; k.solid(stone, 52, 54, 0, 1.1, z - 0.8, z + 0.8);
    if (shape === 'box') k.box(std(hex, 0.5, 0.4), 0.9, 0.6, 0.5, 53, 1.42, z); else k.ball(std(hex, 0.5, 0.3), 0.36, 53, 1.48, z);
    T.exhibits.push(k.abs(50.8, 0, z));
  });
  k.sign('HOUSE OF OLD THINGS', 18, 2, 47, 5.6, 0, -Math.PI / 2, { color: '#ffe2b8', sub: 'objects from before the towers' });
  // bakery stall, tram, megastructure overhead
  room(k, { id: 'bakery', name: 'Old Earth Bakery', x0: 15, x1: 26, z0: 50, z1: 59, door: 'N', wall: '#b8a07a', floor: '#8a6a4a', lamp: '#ffe0b0', staffed: true }); k.gable(tile, 12, 10, 3, 20.5, 4.05, 54.5);
  counter(k, 17.5, 23.5, 55.2, 56); shelf(k, 16.5, 24.5, 58.2, 58.7, 0, ['#c9a063', '#e8c46a', '#8a5a2e', '#f1ede6'], -1); k.sign('BAKERY', 5, 1.1, 20.5, 4.6, 49.8, Math.PI, { color: '#ffe2b8', sub: 'sourdough · honey cake' });
  const tram = new THREE.Group(), tb = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.8, 9), std('#e8dcc0', 0.6, 0.1)), tr = new THREE.Mesh(new THREE.BoxGeometry(2.66, 0.9, 9.04), std('#8a2f2a', 0.6, 0.1)), tw = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.9, 7.6), neon('#ffcf8a', 0.9));
  tb.position.y = 1.9; tr.position.y = 0.95; tw.position.y = 2.3; tb.castShadow = true; tram.add(tb, tr, tw); k.mesh(tram, 0, 0, 0);
  const loop = new PathLine(roundedRectLoop(-36, 36, -36, 36, 0, 9, 5), true), tp = new THREE.Vector3();
  const tl = { g: tram, s: 0, at: -1, wait: 0, stops: [0.12, 0.62].map((f) => f * loop.total) };
  tl.spots = tl.stops.map((st) => { loop.sample(st, tp); return k.abs(tp.x * 1.12, 0, tp.z * 1.12); });      // waiting spots just outside the rails
  k.updates.push((dt) => {
    if (tl.wait > 0) { tl.wait -= dt; if (tl.wait <= 0) tl.at = -1; }
    else { const s0 = tl.s; tl.s += 4.2 * dt; for (let i = 0; i < 2; i++) if (s0 < tl.stops[i] && tl.s >= tl.stops[i]) { tl.s = tl.stops[i]; tl.at = i; tl.wait = 8; } if (tl.s >= loop.total) tl.s -= loop.total; }
    const yaw = loop.sample(tl.s, tp); tram.position.set(k.cx + tp.x, 0, k.cz + tp.z); tram.rotation.y = yaw;
  });
  T.tram = tl;
  const canopy = new THREE.MeshStandardMaterial({ color: '#1c2a3a', roughness: 0.2, metalness: 0.7, transparent: true, opacity: 0.34, side: THREE.DoubleSide, depthWrite: false });
  k.solid(canopy, -160, 160, 100, 102, -160, 160);
  for (let v = -120; v <= 120; v += 40) { k.box(neon('#59d8ff', 0.8), 320, 0.2, 0.4, 0, 99.8, v); k.box(neon('#59d8ff', 0.8), 0.4, 0.2, 320, v, 99.8, 0); }
  for (const [x, z] of [[-150, -150], [150, -150], [-150, 150], [150, 150], [0, -150], [0, 150], [-150, 0], [150, 0]]) { k.cyl(M.concrete, 8, 10, 100, x, 50, z, 16); k.solid(null, x - 8, x + 8, 0, 100, z - 8, z + 8); }
  [[-105, -55, -105, -55, 150, F.corp, '#59e0ff'], [55, 105, -105, -55, 200, F.glass, '#ff7ad9'], [-105, -55, 55, 105, 120, F.magenta, '#7dff9c'], [55, 105, 55, 105, 170, F.corp, '#ffd34d']].forEach(([x0, x1, z0, z1, h, f, n]) => k.tower(f, x0, x1, z0, z1, 102, 102 + h, { neon: n, crown: n }));
  T.pad = k.pad('oldPad', 'Old Earth gate', -170, -170, 7); T.kiosk = k.kiosk(-158, -176); k.cache(-26, 0, -19); k.fence(186);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { k.node(`c${sx}${sz}`, sx * 45, sz * 45); k.node(`e${sx}${sz}`, sx * 45, sz * 132); k.node(`f${sx}${sz}`, sx * 132, sz * 45); k.node(`g${sx}${sz}`, sx * 132, sz * 132); k.link(`c${sx}${sz}`, `e${sx}${sz}`, `g${sx}${sz}`, `f${sx}${sz}`, `c${sx}${sz}`); }
  k.node('hearth', 0, -45); k.link('c-1-1', 'hearth', 'c1-1', 'c11', 'c-11', 'c-1-1'); k.link('e-1-1', 'e1-1'); k.link('e-11', 'e11'); k.link('f-1-1', 'f-11'); k.link('f1-1', 'f11');
  k.node('pad', -160, -160); k.link('pad', 'g-1-1'); k.node('mus', 46, 0); k.link('mus', 'c1-1'); k.link('mus', 'c11');
  [[-51, -90, 'c-1-1'], [51, 90, 'c11'], [-90, 51, 'c-11'], [90, -51, 'c1-1'], [-51, 90, 'c-11'], [51, -90, 'c1-1']].forEach(([x, z, to], i) => { k.node('door' + i, x, z, { door: true }); k.link('door' + i, to); });
  k.post('cook', -2, -56, 0, 'hearth'); k.post('baker', 20.5, 56.8, Math.PI, 'c11'); k.post('guide', 46.5, -24, -Math.PI / 2, 'mus');
  k.finish();
  return T;
}

// ---- Industrial Nexus: automated halls, conveyors, cooling towers, a container yard ----------------------
export function nexus(k) {
  const ground = std('#1b1e24', 0.85, 0.2), amber = neon('#ffb347', 1.1), green = neon('#7dff9c', 1.3), rng = new RNG(4040), T = {};
  k.flat(ground, 380, 380, 0, 0.03, 0);
  for (const v of [-176, 176]) { k.box(amber, 352, 0.04, 0.5, 0, 0.06, v); k.box(amber, 0.5, 0.04, 352, v, 0.06, 0); }
  const hall = (x0, x1, z0, z1, h, n, open) => {
    if (open) { k.solid(M.metalDark, x0, x1, 0, h, z1 - 1, z1); k.solid(M.metalDark, x0, x0 + 1, 0, h, z0, z1); k.solid(M.metalDark, x1 - 1, x1, 0, h, z0, z1); k.solid(M.metalDark, x0, x1, h - 1, h, z0, z1); for (let x = x0 + 15; x < x1 - 5; x += 20) k.solid(M.metal, x - 0.6, x + 0.6, 0, h - 1, z0, z0 + 1.2); }
    else k.solid(M.metalDark, x0, x1, 0, h, z0, z1);
    for (let x = x0; x < x1 - 1; x += 14) k.gable(M.metal, z1 - z0, Math.min(14, x1 - x), 5, x + Math.min(14, x1 - x) / 2, h, (z0 + z1) / 2, false);
    k.box(green, x1 - x0, 0.5, 0.3, (x0 + x1) / 2, h - 2, z0 - 0.2);
    k.sign('HALL ' + n, 16, 5, (x0 + x1) / 2, h - 8, z0 - 0.5, Math.PI, { color: '#cfefff', size: 80 });
  };
  hall(-150, -30, -160, -90, 36, 1); hall(20, 150, -160, -95, 40, 2); hall(-150, -60, 40, 110, 34, 3, true); hall(40, 150, 60, 150, 30, 4);
  // open assembly bay in hall 3: conveyor, robot arms, the foundry glow, the QA station
  k.solid(M.metal, -144, -68, 0, 1, 70, 73); k.box(neon('#ff7a2a', 1.6), 14, 0.3, 8, -84, 0.3, 96); k.box(amber, 76, 0.06, 0.3, -106, 1.04, 70.1);
  const arms = [-134, -116, -98, -80].map((x) => {
    const base = new THREE.Group(), sh = new THREE.Group(), el = new THREE.Group(), white = std('#eef1f5', 0.4, 0.5);
    const b = (g, w, h, d, y, mat = white) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.y = y; m.castShadow = true; g.add(m); };
    b(base, 1, 1.4, 1, 0.7, M.metalDark); sh.position.y = 1.4; base.add(sh); b(sh, 0.4, 3, 0.4, 1.5); el.position.y = 3; sh.add(el); b(el, 0.32, 2.6, 0.32, 1.3); b(el, 0.5, 0.2, 0.5, 2.7, neon('#ffb347', 1.4));
    k.mesh(base, x, 0, 76.5); return { base, sh, el, ph: x };
  });
  k.updates.push((dt, t) => { for (const a of arms) { a.base.rotation.y = Math.sin(t * 0.6 + a.ph) * 0.9; a.sh.rotation.x = -1.0 + Math.sin(t * 0.9 + a.ph) * 0.3; a.el.rotation.x = -1.3 + Math.sin(t * 1.3 + a.ph) * 0.4; } });
  k.solid(std('#20262f', 0.4, 0.7), -63.6, -62.4, 0, 2.2, 49, 51); k.box(neon('#7dff9c', 0.8), 0.06, 1.2, 1.4, -63.65, 1.4, 50); T.qa = k.abs(-65, 0, 50);
  // conveyor bridge between hall 1 and hall 3, with crates riding it
  k.box(M.metal, 5, 1.2, 130, -90, 22, -25); for (const z of [-60, -25, 10]) k.box(M.metalDark, 1, 21.4, 1, -90, 10.7, z);
  const crates = k.mesh(new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 1.6, 2.2), std('#b98a5a', 0.9, 0), 14), 0, 0, 0); crates.position.set(0, 0, 0); crates.frustumCulled = false; const cm = new THREE.Matrix4();
  k.updates.push((dt, t) => { for (let i = 0; i < 14; i++) { cm.makeTranslation(k.cx - 90, 23.4, k.cz - 88 + ((t * 3.5 + i * 9.2) % 126)); crates.setMatrixAt(i, cm); } crates.instanceMatrix.needsUpdate = true; });
  // cooling towers, stacks
  for (const x of [56, 96, 136]) { k.cyl(M.concrete, 10, 15, 56, x, 28, 10, 20); k.cyl(neon('#59e0ff', 1), 9.6, 9.6, 0.5, x, 56.3, 10, 20); k.solid(null, x - 11, x + 11, 0, 56, -1, 21); }
  const steam = [56, 96, 136].map((x) => k.mesh(new THREE.Mesh(new THREE.SphereGeometry(7, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, depthWrite: false })), x, 64, 10));
  k.updates.push((dt, t) => steam.forEach((s, i) => { s.position.y = 62 + ((t * 2 + i * 5) % 14); s.scale.setScalar(0.8 + ((t * 2 + i * 5) % 14) * 0.08); }));
  for (const [x, z] of [[-10, -130], [0, -110], [170, -40], [170, 30]]) { k.cyl(M.metalDark, 1.4, 2, 80, x, 40, z, 10); k.ball(neon('#ff3030', 2), 0.8, x, 81, z); k.solid(null, x - 2, x + 2, 0, 80, z - 2, z + 2); }
  // container yard with a gantry crane
  const cols = ['#b23a48', '#2f6f8f', '#d9b23a', '#3f8f6a', '#6b4fa0'].map((c) => std(c, 0.7, 0.3));
  for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) { const x = -150 + c * 17, z = 128 + r * 14, n = rng.int(1, 4); for (let i = 0; i < n; i++) k.box(rng.pick(cols), 12, 2.8, 2.6, x + 6, 1.4 + i * 2.9, z + 1.3); k.solid(null, x, x + 12, 0, n * 2.9, z, z + 2.6); }
  const gantry = new THREE.Group(), gm = M.metal;
  for (const z of [-24, 24]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(1.2, 20, 1.2), gm); leg.position.set(0, 10, z); gantry.add(leg); }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2, 1.6, 50), gm); beam.position.y = 20.4; const box = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.8, 12), cols[2]); box.position.y = 13; const cable = new THREE.Mesh(new THREE.BoxGeometry(0.15, 6, 0.15), M.metalDark); cable.position.y = 17;
  gantry.add(beam, box, cable); k.mesh(gantry, -80, 0, 147);
  k.updates.push((dt, t) => { gantry.position.x = k.cx - 80 + Math.sin(t * 0.12) * 62; box.position.z = cable.position.z = Math.sin(t * 0.3) * 14; });
  // autonomous haulers on the perimeter road, cargo drones overhead
  const road = new PathLine(roundedRectLoop(-170, 170, -170, 170, 0, 14, 5), true), hp = new THREE.Vector3();
  const haulers = [0, 1, 2].map((i) => { const g = new THREE.Group(), b = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 7), std(['#e9edf2', '#d9b23a', '#3a4250'][i], 0.4, 0.5)); b.position.y = 1.6; b.castShadow = true; const l = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 0.1), neon('#f4fbff', 2)); l.position.set(0, 0.8, 3.52); g.add(b, l); return k.mesh(g, 0, 0, 0); });
  k.updates.push((dt, t) => haulers.forEach((h, i) => { const yaw = road.sample(t * 7 + i * 440, hp); h.position.set(k.cx + hp.x, 0, k.cz + hp.z); h.rotation.y = yaw; }));
  const drones = k.mesh(new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 0.5, 1.4), neon('#eaf6ff', 1.1), 10), 0, 0, 0); drones.position.set(0, 0, 0); drones.frustumCulled = false; const dm = new THREE.Matrix4();
  k.updates.push((dt, t) => { for (let i = 0; i < 10; i++) { const a = t * 0.22 + i * 0.63; dm.makeTranslation(k.cx + Math.cos(a) * 120, 50 + (i % 3) * 6 + Math.sin(t + i) * 1.5, k.cz + Math.sin(a * 2) * 70 + 20); drones.setMatrixAt(i, dm); } drones.instanceMatrix.needsUpdate = true; });
  k.sign('INDUSTRIAL NEXUS', 44, 7, 0, 30, -178, 0, { color: '#ffd9a0', sub: 'nine people · eleven thousand machines' });
  T.pad = k.pad('nexusPad', 'Nexus yard', 0, 10, 8); T.kiosk = k.kiosk(14, 24); k.cache(96, 56, 10); k.fence(186);
  k.node('n0', -20, -70); k.node('n1', 12, -70); k.node('n2', 12, 34); k.node('n3', -30, 34); k.node('n4', -100, 34); k.node('n5', -100, 56); k.node('n6', 30, 52); k.node('n7', -40, 116);
  k.link('n0', 'n1', 'n2', 'n3', 'n0'); k.link('n3', 'n4', 'n5'); k.link('n2', 'n6'); k.link('n3', 'n7');
  [[-90, -84, 'n0'], [85, -89, 'n1'], [34, 100, 'n6']].forEach(([x, z, to], i) => { k.node('door' + i, x, z, { door: true }); k.link('door' + i, to); });
  [-136, -118, -100, -82].forEach((x, i) => k.post('w' + i, x, 68.4, 0, 'n5')); k.post('sup', -70, 55, Math.PI / 2, 'n5'); k.post('yard', -44, 119, 0, 'n7');
  k.finish();
  return T;
}
