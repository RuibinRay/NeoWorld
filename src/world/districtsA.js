// Aeroport, Bio-Eden and Skyhaven.
import * as THREE from 'three';
import { M, std, neon } from './materials.js';
import { buildVehicle, MODELS } from '../data/vehicles.js';
import { RNG, TAU } from '../core/util.js';
import { room, counter, shelf } from './stores.js';
import { makeDecor } from './decor.js';

const WATER = () => new THREE.MeshStandardMaterial({ color: '#1d6f8f', roughness: 0.08, metalness: 0.7, transparent: true, opacity: 0.86 });

// ---- Aeroport: terminal, control tower, hangars, parked aircraft, the orbital lift -----------------
export function aeroport(k) {
  const F = M.facades, apron = std('#252a32', 0.8, 0.2), line = neon('#cfe6ff', 0.9), amber = neon('#ffb347', 1.3), T = {};
  k.flat(apron, 380, 380, 0, 0.03, 0);
  for (const z of [-92, 62]) { for (const o of [-9, 9]) k.box(line, 300, 0.04, 0.6, 0, 0.06, z + o); for (let x = -140; x <= 140; x += 20) k.box(amber, 6, 0.04, 0.5, x, 0.06, z); }
  // terminal + control tower
  k.tower(F.glass, -140, 140, -172, -132, 0, 28, { crown: '#4de1ff' });
  k.box(M.glassDark, 290, 0.5, 12, 0, 9, -126); for (let x = -140; x <= 140; x += 40) k.box(M.metalDark, 0.5, 9, 0.5, x, 4.5, -121);
  k.sign('NEO CENTRAL AEROPORT', 70, 8, 0, 20, -131.4, 0, { color: '#bfefff', sub: 'orbital lift · long-haul · vehicle exchange' });
  k.cyl(M.concrete, 5, 6.5, 110, 150, 55, -95, 14); k.cyl(M.glassDark, 12, 8, 9, 150, 114.5, -95, 16); k.cyl(M.roof, 13, 13, 1, 150, 119.5, -95, 16); k.ball(neon('#ff3030', 2), 0.9, 150, 122, -95);
  k.solid(null, 143, 157, 0, 120, -102, -88);
  // airliners at the stands, a cargo lifter on the south apron
  const liner = (x, z, len, r, hex) => {
    k.tube(M.white, r, len, x, r + 2.4, z, false); k.ball(M.white, r, x, r + 2.4, z - len / 2, 1, 1, 2.4); k.ball(M.white, r, x, r + 2.4, z + len / 2, 1, 1, 1.4);
    k.box(M.white, len * 0.95, 0.5, len * 0.2, x, r + 1.9, z + len * 0.06); k.box(std(hex, 0.4, 0.4), 0.6, r * 2.2, len * 0.16, x, r * 2 + 3.4, z + len * 0.4);
    k.box(neon(hex, 1.2), r * 2.02, 0.5, len * 0.8, x, r + 2.9, z); for (const s of [-1, 1]) k.box(neon('#59e0ff', 1.6), r * 1.1, r * 0.7, 0.5, x + s * len * 0.22, r + 1.5, z + len * 0.18);
    for (const [gx, gz] of [[0, -len * 0.3], [-3, len * 0.1], [3, len * 0.1]]) k.box(M.metalDark, 0.6, 2.4, 0.6, x + gx, 1.2, z + gz);
    k.solid(null, x - r, x + r, 0, r * 2 + 2.6, z - len / 2, z + len / 2);
  };
  liner(-88, -104, 44, 3.4, '#4de1ff'); liner(18, -104, 44, 3.4, '#ff7ad9'); liner(120, 40, 56, 5, '#ffb347');
  // orbital lift: a tether to geostationary orbit with a climber car
  k.cyl(M.concrete, 26, 28, 12, 60, 6, -20, 28); k.cyl(M.glassDark, 20, 20, 5, 60, 14.5, -20, 24); k.solid(null, 36, 84, 0, 12, -44, 4);
  k.box(new THREE.MeshBasicMaterial({ color: 0xdfeaff }), 2.2, 5200, 2.2, 60, 2617, -20); k.solid(null, 58.5, 61.5, 12, 700, -21.5, -18.5);
  k.sign('ORBITAL LIFT', 30, 5, 60, 24, 8.5, 0, { color: '#cfe9ff', sub: 'cargo climbs for 36 hours' });
  const climber = k.mesh(new THREE.Mesh(new THREE.BoxGeometry(7, 9, 7), std('#e9eef5', 0.3, 0.6)), 60, 40, -20); const glow = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.5, 7.4), neon('#7fe9ff', 1.6)); climber.add(glow);
  k.updates.push((dt, t) => { climber.position.y = k.by + 1530 + ((t * 42) % 2600); });   // cargo climbs on past Skyline Station (systems/orbital.js)
  // hangars (the first is the vehicle exchange), drone rack
  [-110, -30, 50].forEach((hx, i) => {
    if (i) { k.solid(M.metal, hx - 32, hx + 32, 0, 20, 112, 168); k.box(M.metalDark, 40, 15, 0.6, hx, 7.5, 111.6); }
    else room(k, { id: 'aerowisp', name: 'AeroWisp Exchange', x0: hx - 32, x1: hx + 32, z0: 112, z1: 168, h: 20, door: 'N', dw: 14, dh: 6.5, t: 0.8, front: false, wallMat: M.metal, floor: '#3a4150', roofMat: M.metalDark, lamp: '#dff3ff', staffed: true });
    k.arch(M.metalDark, 32, 56, 10, hx, 20.25, 140); k.box(neon(i ? '#ffb347' : '#7dff9c', 1.3), 44, 0.4, 0.3, hx, 16.4, 111.5);
  });
  k.sign('AEROWISP EXCHANGE', 40, 5, -110, 23.5, 111, Math.PI, { color: '#b9ffcf', sub: 'every class · buy · switch · tune' });
  const show = buildVehicle('vanta', MODELS.vanta.paint).g; k.mesh(show, -96, MODELS.vanta.ride, 100); show.rotation.y = -2.2; k.solid(null, -99, -93, 0, 1.8, 97.5, 102.5);
  T.dealer = k.abs(-110, 0, 120.6); counter(k, -113.5, -106.5, 121.6, 122.4, 0, '#cfe9ff');
  [['kestrel', -128, 136, 0.7], ['halo', -110, 148, 3.1], ['atlas', -90, 136, -0.9]].forEach(([id, x, z, yaw]) => { k.cyl(std('#20262f', 0.4, 0.7), 4.6, 4.9, 0.4, x, 0.2, z, 28); k.ring(neon('#7dff9c', 1.2), 4.3, 4.6, x, 0.42, z); const v = buildVehicle(id, MODELS[id].paint).g; k.mesh(v, x, MODELS[id].ride + 0.4, z); v.rotation.y = yaw; k.solid(null, x - 2.6, x + 2.6, 0, 2, z - 2.6, z + 2.6); });
  k.solid(M.metalDark, 144, 156, 0, 30, 114, 126); for (let y = 4; y < 30; y += 5) k.box(neon('#59e0ff', 1), 12.4, 0.2, 12.4, 150, y, 120);
  const drones = k.mesh(new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 0.35, 1.1), neon('#eaf6ff', 1.2), 9), 0, 0, 0); drones.position.set(0, 0, 0); drones.frustumCulled = false;
  const dm = new THREE.Matrix4();
  k.updates.push((dt, t) => { for (let i = 0; i < 9; i++) { const a = t * 0.35 + i * 0.7, r = 26 + (i % 3) * 14; dm.makeTranslation(k.cx + 150 + Math.cos(a) * r, 34 + (i % 4) * 7 + Math.sin(t + i) * 2, k.cz + 120 + Math.sin(a) * r * 0.7); drones.setMatrixAt(i, dm); } drones.instanceMatrix.needsUpdate = true; });
  // pad, shuttle, cache, boundary
  T.pad = k.pad('aeroPad', 'Aeroport apron', -60, 10, 8); T.kiosk = k.kiosk(-44, 2); k.cache(150, 120, -95); k.fence(186);
  // walkways
  k.node('n0', -120, -122); k.node('n1', -40, -122); k.node('n2', 40, -122); k.node('n3', 120, -122); k.node('n4', 120, -40); k.node('n5', 10, 20); k.node('n6', -48, 22); k.node('n7', -110, 100); k.node('n8', 40, 100); k.node('n9', 136, 104);
  k.link('n0', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9', 'n4'); k.link('n1', 'n6'); k.link('n5', 'n8');
  [[-80, 'n1'], [0, 'n1'], [80, 'n2']].forEach(([x, to], i) => { k.node('door' + i, x, -129, { door: true }); k.link('door' + i, to); });
  k.post('crew1', -84, -78, Math.PI, 'n1'); k.post('crew2', 24, -78, Math.PI, 'n2'); k.post('dealer', -110, 123.2, Math.PI, 'n7'); k.post('gate', 52, 12, Math.PI, 'n5');
  k.finish();
  return T;
}

// ---- Bio-Eden: climate dome with a lake, vertical forests, orchard, farms ----------------------------
export function bioeden(k) {
  const F = M.facades, lawn = std('#2a5a40', 0.95, 0), path = std('#8a917f', 0.9, 0), soil = std('#3b2f26', 0.95, 0), water = WATER(), rng = new RNG(808), T = { orchard: [] };
  k.flat(lawn, 380, 380, 0, 0.03, 0);
  // dome: an air-curtain membrane you can walk through anywhere
  const dome = new THREE.Mesh(new THREE.SphereGeometry(72, 40, 14, 0, TAU, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#bfe9ff', roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }));
  k.mesh(dome, 0, 0, 0);
  for (const [r, y] of [[72, 0.4], [62.4, 36], [36, 62.4]]) { const g = new THREE.Mesh(new THREE.TorusGeometry(r, 0.45, 6, 56), M.white); g.rotation.x = Math.PI / 2; k.mesh(g, 0, y, 0); }
  // lake with an island (swim out to it)
  k.disc(water, 26, -14, 0.08, 10, 40); T.lake = { x: k.cx - 14, z: k.cz + 10, r: 25.2 };
  k.cyl(lawn, 3.8, 4.4, 0.4, -14, 0.2, 10, 14); k.solid(null, -17, -11, 0, 0.4, 7, 13); k.tree(-14, 10, 0.8, true, 0.4); k.cache(-12.2, 0.4, 11.8); // low enough to wade onto
  // giant engineered flowers and trees inside the dome
  for (let i = 0; i < 10; i++) { const a = i * 0.63 + 0.3, r = 42 + (i % 3) * 9, x = Math.cos(a) * r, z = Math.sin(a) * r, h = 7 + (i % 4) * 2; k.cyl(M.leaf, 0.3, 0.5, h, x, h / 2, z, 6); k.ball(M.leafPink, 2.8, x, h + 0.6, z, 1, 0.42, 1); k.ball(neon('#ffd34d', 1.4), 0.8, x, h + 1, z); }
  for (let i = 0; i < 16; i++) { const a = rng.range(0, TAU), r = rng.range(30, 66), x = Math.cos(a) * r, z = Math.sin(a) * r; if (Math.hypot(x + 14, z - 10) < 31) continue; k.tree(x, z, rng.range(0.8, 1.2), rng.chance(0.3)); }
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU, b = ((i + 1) / 12) * TAU; k.box(path, 3, 0.06, 49, (Math.cos(a) + Math.cos(b)) * 46, 0.06, (Math.sin(a) + Math.sin(b)) * 46, -(a + b) / 2); }
  for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) k.box(path, 3, 0.06, 90, Math.cos(a) * 135, 0.06, Math.sin(a) * 135, Math.PI / 2 - a);
  // orchard: sun-apples anyone may pick
  for (let i = 0; i < 6; i++) { const x = 104 + (i % 3) * 14, z = -40 + Math.floor(i / 3) * 16; k.tree(x, z, 0.9, false); for (const [ox, oy, oz] of [[1.6, 3.4, 0.6], [-1.2, 3.9, 1.4], [0.4, 3.1, -1.8]]) k.ball(neon('#ffb347', 1.5), 0.22, x + ox, oy, z + oz); T.orchard.push(k.abs(x, 0, z + 1.6)); }
  k.solid(M.wood, 5.5, 13.6, 0, 0.36, 9, 11); for (const x of [6, 9.5, 13]) for (const z of [9.1, 10.9]) k.box(M.wood, 0.14, 1.0, 0.14, x, 0.5, z); T.fish = k.abs(6.8, 0.36, 10);   // fishing jetty
  k.sign('PUBLIC ORCHARD', 14, 2.4, 118, 9, -52, 0, { color: '#ffe2a8', sub: 'pick one a day from each tree' });
  // cafe
  room(k, { id: 'rootleaf', name: 'Root & Leaf', x0: 25, x1: 39, z0: 90, z1: 101, door: 'S', wall: '#35604a', floor: '#cdbf9e', staffed: true });
  counter(k, 28.5, 35.5, 93.3, 94.1); shelf(k, 25.3, 25.8, 91, 96, 0, ['#7dff9c', '#2f8f5a', '#f1ede6', '#c9b68f'], +1); k.table('rl0', 28.6, 97.7); k.table('rl1', 35.4, 97.7);
  k.sign('ROOT & LEAF', 7, 1.3, 32, 4.6, 101.2, 0, { color: '#c9ffd9', sub: 'living salad · eden tea' });
  // vertical forests
  [[-124, -122, 200], [124, -126, 160], [-128, 118, 180], [132, 150, 140], [0, -152, 120]].forEach(([x, z, h], i) => {
    k.tower(F.warm, x - 20, x + 20, z - 20, z + 20, 0, h, { crown: '#7dff9c' });
    for (let y = 22; y < h - 4; y += 22) { k.box(M.leaf, 47, 1.4, 47, x, y, z); for (const [ax, az] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.ball((y / 22 + ax + az + i) % 3 === 0 ? M.leafPink : M.leaf, 2.3, x + ax * 21.5, y + 2.6, z + az * 21.5, 1, 1.1, 1); }
  });
  // farm beds under grow lights, a stacked farm tower, solar petals
  for (let i = 0; i < 7; i++) { const z0 = -172 + i * 11; k.solid(soil, 60, 172, 0, 0.5, z0, z0 + 6); k.box(M.leaf, 108, 0.7, 4.4, 116, 0.85, z0 + 3); k.box(neon('#ff6ad5', 1.2), 110, 0.1, 0.2, 116, 3, z0 + 3); for (const x of [62, 170]) k.box(M.metalDark, 0.12, 3, 0.12, x, 1.5, z0 + 3); }
  for (let j = 0; j < 8; j++) { k.cyl(M.glass, 14, 14, 3.2, 150, 4.4 + j * 6, 40, 20); k.cyl(M.leaf, 12.6, 12.6, 1.2, 150, 2.2 + j * 6, 40, 20); } k.cyl(M.metalDark, 1.2, 1.2, 50, 150, 25, 40, 8); k.solid(null, 137, 163, 0, 50, 27, 53);
  for (const [x, z] of [[-70, 150], [-20, 162], [30, 150]]) { k.cyl(M.metalDark, 0.5, 0.8, 16, x, 8, z, 8); k.ball(std('#16324a', 0.2, 0.9), 8, x, 17, z, 1, 0.07, 1); k.ball(neon('#59e0ff', 1), 1, x, 17.2, z, 1, 0.3, 1); k.solid(null, x - 1, x + 1, 0, 16, z - 1, z + 1); }
  T.pad = k.pad('edenPad', 'Bio-Eden green', 130, 100, 7); T.kiosk = k.kiosk(118, 112); k.cache(0, 120, -152); k.fence(186);
  for (let i = 0; i < 8; i++) k.node('r' + i, Math.cos((i / 8) * TAU) * 92, Math.sin((i / 8) * TAU) * 92);
  for (let i = 0; i < 8; i++) k.link('r' + i, 'r' + ((i + 1) % 8));
  for (let i = 0; i < 4; i++) { k.node('d' + i, Math.cos((i / 4) * TAU + 0.6) * 50, Math.sin((i / 4) * TAU + 0.6) * 50); k.link('d' + i, 'r' + i * 2); }
  k.link('d0', 'd1', 'd2', 'd3', 'd0');
  k.node('pad', 120, 96); k.link('pad', 'r1'); k.node('cafe', 32, 102); k.link('cafe', 'r1'); k.link('cafe', 'r2'); k.node('orch', 112, -20); k.link('orch', 'r0'); k.link('orch', 'r7');
  [[-124, -98, 'r5'], [124, -102, 'r7'], [-128, 94, 'r3']].forEach(([x, z, to], i) => { k.node('door' + i, x, z, { door: true }); k.link('door' + i, to); });
  k.post('cafe', 32, 92.7, 0, 'cafe'); k.post('farm1', 90, -110, Math.PI / 2 * 0, 'r7'); k.post('farm2', 116, -64, Math.PI, 'orch');
  k.finish();
  return T;
}

// ---- Skyhaven: floating decks at 450 m -----------------------------------------------------------------
export function skyhaven(k) {
  const deck = std('#a9afb8', 0.65, 0.15), gold = std('#c9a24a', 0.25, 0.9), water = WATER(), glowU = neon('#59e0ff', 1.4), T = {};
  const slab = (x0, x1, z0, z1) => { k.solid(deck, x0, x1, -5, 0, z0, z1); k.box(glowU, (x1 - x0) * 0.72, 0.5, (z1 - z0) * 0.72, (x0 + x1) / 2, -5.4, (z0 + z1) / 2); k.box(gold, x1 - x0 + 0.6, 0.5, z1 - z0 + 0.6, (x0 + x1) / 2, -2.5, (z0 + z1) / 2); };
  slab(-110, 110, -90, 90); slab(-45, 45, -175, -110); slab(-195, -130, -35, 35);
  k.solid(M.glassDark, -5, 5, -1, 0, -110, -90); k.solid(M.glassDark, -130, -110, -1, 0, -5, 5);   // glass bridges
  // glass rails everywhere except where the bridges meet the decks
  k.rail(-110, -90, -5, -90); k.rail(5, -90, 110, -90); k.rail(-110, 90, 110, 90); k.rail(110, -90, 110, 90); k.rail(-110, -90, -110, -5); k.rail(-110, 5, -110, 90);
  k.rail(-45, -110, -5, -110); k.rail(5, -110, 45, -110); k.rail(-45, -175, 45, -175); k.rail(-45, -175, -45, -110); k.rail(45, -175, 45, -110);
  k.rail(-130, -35, -130, -5); k.rail(-130, 5, -130, 35); k.rail(-195, -35, -195, 35); k.rail(-195, -35, -130, -35); k.rail(-195, 35, -130, 35);
  k.rail(-5, -110, -5, -90); k.rail(5, -110, 5, -90); k.rail(-130, -5, -110, -5); k.rail(-130, 5, -110, 5);
  // mansions with roof pools
  const mansion = (x, z, front) => {
    k.solid(deck, x - 16, x + 16, 0, 9, z - 11, z + 11); k.box(M.glassDark, 30, 6, 0.3, x, 4.5, z + front * 11.2); k.box(gold, 32.6, 0.5, 22.6, x, 9.25, z); k.flat(water, 14, 8, x, 9.56, z);
    k.solid(deck, x - 9, x + 9, 9.5, 14, z - 7 * front - 3.5, z - 7 * front + 3.5); k.box(neon('#ffe9a8', 1.1), 26, 0.12, 0.12, x, 6.9, z + front * 11.4);
  };
  mansion(-70, -55, 1); mansion(70, -55, 1); mansion(-70, 55, -1);
  // gardens
  k.flat(water, 40, 14, 0, 0.07, -8); k.box(gold, 41, 0.3, 15, 0, 0.0, -8);
  for (const [x, z, p] of [[-38, -24, 1], [38, -24, 0], [-38, 10, 0], [38, 10, 1], [-100, -20, 1], [-100, 22, 0], [100, -20, 0], [36, 78, 1], [-36, 78, 0], [-160, -24, 1], [-160, 24, 0], [-30, -160, 1], [30, -160, 0]]) k.tree(x, z, 0.9, !!p);
  for (const [x0, x1, z0, z1] of [[-52, -42, -30, -28.6], [42, 52, -30, -28.6], [-52, -42, 14, 15.4], [42, 52, 14, 15.4], [-188, -138, -28, -26.6], [-188, -138, 26.6, 28]]) k.solid(M.leaf, x0, x1, 0, 1.1, z0, z1);
  // Aurum Table: open pavilion with table service
  k.box(M.glassDark, 44, 0.4, 34, 74, 5.2, 46); for (const [x, z] of [[53, 30], [95, 30], [53, 62], [95, 62]]) k.box(gold, 0.4, 5.2, 0.4, x, 2.6, z);
  k.flat(std('#2a2622', 0.4, 0.3), 44, 34, 74, 0.05, 46);
  [[62, 38], [74, 38], [86, 38], [62, 54], [74, 54], [86, 54]].forEach(([x, z], i) => k.table('t' + i, x, z, 'aurum', gold));
  k.sign('AURUM TABLE', 16, 2.6, 74, 6.9, 29, Math.PI, { color: '#ffe2a0', sub: 'nine courses above the weather' });
  // the villa (for sale) on the north deck: glass walls, open to the south
  k.solid(M.glass, -22, 22, 0, 6, -170.3, -170); k.solid(M.glass, -22.3, -22, 0, 6, -170, -138); k.solid(M.glass, 22, 22.3, 0, 6, -170, -138); k.solid(deck, -23, 23, 6, 6.5, -171, -136);
  k.solid(M.glass, -22, -4, 0, 6, -138.3, -138); k.solid(M.glass, 4, 22, 0, 6, -138.3, -138); k.box(gold, 46.6, 0.4, 35.6, 0, 6.7, -153.5);
  k.solid(std('#f1ede6', 0.9, 0), 10, 18, 0, 0.55, -168, -161); k.box(neon('#59e0ff', 0.6), 1.7, 1, 0.06, -12, 1.6, -169.8); k.sign('VILLA', 1.4, 0.5, -12, 1.6, -169.7, 0, { color: '#e8fbff', size: 80 });
  k.solid(std('#3a4660', 0.9, 0), -20, -14, 0, 0.5, -150, -144); k.flat(std('#6b5d8a', 0.95, 0), 12, 8, 0, 0.03, -154);
  k.solid(std('#e9e3d5', 0.6, 0.1), 0, 6, 0, 0.95, -169.6, -168.8); k.box(M.metalDark, 1.2, 0.5, 0.5, 3, 1.25, -169.4); k.box(neon('#ffb3d1', 1.3), 0.9, 0.06, 0.3, 3, 1.02, -169.2);
  k.table('villaT', 0, -146); k.stool('villaSofaA', -17, -148.5, Math.PI / 2); k.stool('villaSofaB', -17, -145.5, Math.PI / 2);
  // a pool on the deck in front of the house
  const pool = [-20, -6, -134, -124]; k.solid(M.white, pool[0] - 0.4, pool[1] + 0.4, 0, 0.3, pool[2] - 0.4, pool[2]); k.solid(M.white, pool[0] - 0.4, pool[1] + 0.4, 0, 0.3, pool[3], pool[3] + 0.4);
  k.solid(M.white, pool[0] - 0.4, pool[0], 0, 0.3, pool[2], pool[3]); k.solid(M.white, pool[1], pool[1] + 0.4, 0, 0.3, pool[2], pool[3]);
  k.flat(new THREE.MeshStandardMaterial({ color: '#2fb8d9', roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.82, emissive: '#126a86', emissiveIntensity: 0.5 }), 14, 10, -13, 0.27, -129); k.flat(std('#bfe9f2', 0.4, 0.1), 14, 10, -13, 0.04, -129);
  T.pool = { x0: k.cx + pool[0], x1: k.cx + pool[1], z0: k.cz + pool[2], z1: k.cz + pool[3], y: k.by };
  const decor = {}, put = (key, x, y, z, ry = 0) => { const g = makeDecor(key); k.mesh(g, x, y, z); g.rotation.y = ry; decor[key] = g; };
  put('records', -21.5, 0, -158.5, Math.PI / 2); put('vinyl', -6.5, 0.3, -169.9); put('tea', 0, 0.78, -146); put('lamp', 8.9, 0, -165.5); put('books', 21.6, 0, -156, -Math.PI / 2); put('print', 9, 0.6, -169.9); put('plant', -18.5, 0, -140.5); put('aquarium', -21.6, 0, -152, Math.PI / 2);
  T.villa = { console: k.abs(-12, 0, -168.4), bed: k.abs(14, 0, -159.6), kitchen: k.abs(3, 0, -167.9), turntable: k.abs(-20.6, 0, -158.5), wardrobe: k.abs(19.5, 0, -165), music: k.abs(0, 0, -154), decor };
  T.villa.room = { id: 'villa', name: 'Skyhaven villa', kind: 'home', staffed: true, lamp: '#ffcf9a', h: 6, lo: k.abs(-22, 0, -170), hi: k.abs(22, 6, -138), center: k.abs(0, 5.2, -154), doorOut: k.abs(0, 0, -135) };
  k.city.stores.push(T.villa.room);
  T.villaPad = k.pad('villaPad', 'Skyhaven villa', 30, -124, 6, { priv: true, owner: 'villa' });
  T.pad = k.pad('havenPad', 'Skyhaven deck', 0, 60, 7); T.kiosk = k.kiosk(16, 74); k.cache(-188, 0, 0);
  k.node('n0', -30, -36); k.node('n1', 30, -36); k.node('n2', 30, 22); k.node('n3', -30, 22); k.link('n0', 'n1', 'n2', 'n3', 'n0');
  k.node('n4', 0, -84); k.node('n5', 0, -116); k.node('n6', 0, -132); k.link('n0', 'n4', 'n5', 'n6'); k.link('n1', 'n4');
  k.node('n7', -100, 0); k.node('n8', -136, 0); k.node('n9', -166, 0); k.link('n3', 'n7', 'n8', 'n9'); k.link('n0', 'n7');
  k.node('n10', 0, 46); k.link('n2', 'n10'); k.link('n3', 'n10'); k.node('n11', 50, 46); k.link('n2', 'n11'); k.link('n10', 'n11');
  [[-70, -40, 'n0'], [70, -40, 'n1'], [-70, 40, 'n3']].forEach(([x, z, to], i) => { k.node('door' + i, x, z, { door: true }); k.link('door' + i, to); });
  k.post('host', 56, 34, Math.PI, 'n11'); k.post('butler', -50, -40, 0, 'n0');
  k.finish();
  return T;
}
