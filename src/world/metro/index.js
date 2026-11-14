// Greater Neo Central: everything between and around Meridian and the districts. Builds the
// ground (asphalt, lawns, sand, quays), the raised pavements, the sea and the canal, the
// always-visible building shells, every collider, the bridges, and the tile streamer that
// adds street-level detail near the player.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { M, std, neon } from '../materials.js';
import { layoutPark, PARK_HOLES } from '../park.js';
import { layoutCoast, isleY, onIsle } from '../coast.js';
import { layoutSuburb } from '../suburb.js';
import { layoutBeachVilla } from '../beachvilla.js';
import { layoutExpo } from '../expo.js';
import { layoutSkyline } from '../skyline.js';
import { layoutTowers } from '../towers.js';
import { layoutCampus } from '../campus.js';
import { waterMaterial, shoreFoam } from '../water.js';
import { buildMountains, mountY, inReservoir } from '../mountains.js';
import { makeRoomKit } from './kit.js';
import { SITE_LIST } from '../../data/sites.js';
import { P, NB, EDGE, CANAL, CANAL_Y, waterLevel, coastZ, inSea, inCanal, inLake, hillY, useAt, URBAN, blockRect, cellRect, siteRect, subtract, blockOf, areaAt } from './landuse.js';
import { makeLayout, SOLID, FY } from './layout.js';
import { Builder, MATS } from './builder.js';
import { buildShells } from './shells.js';
import { Stream } from './stream.js';
import { signMaterial } from './buildings.js';
import { posterMaterial } from '../art.js';
import { AvenueTraffic } from './traffic.js';
import { planCrossings, buildCrossingSignals, buildBarriers } from './crossings.js';
import { buildBuses } from './bus.js';
import { draw } from './furniture.js';
import { findRoute } from './route.js';
import { eSeg, sSeg, corner, signalPoles, signalState, canalRails, railPieces } from './streets.js';

const COL = { park: '#234430', green: '#27482f', district: '#1f2c27', beach: '#cdbb8e', quay: '#4a515c', front: '#565b66' };

export function buildMetro(scene, col, city, districts, roads) {
  const group = new THREE.Group(); scene.add(group);
  // first: which streets the highways take over, and where they cross the others (everything below depends on it)
  const xing = planCrossings(roads);
  const layout = makeLayout(col, roads), blocks = new Map(), list = [];
  for (let j = -NB; j <= 10; j++) for (let i = -NB; i <= NB; i++) { const b = layout.block(i, j); blocks.set(i * 100 + j, b); list.push(b); }
  const block = (i, j) => blocks.get(i * 100 + j);
  // no parked vehicles where a highway runs past the kerb
  for (const b of list) b.props = b.props.filter((p) => !((p[0] === 'pod' || p[0] === 'lorry') && xing.near(p[1], p[2], 10.5)));
  const yAt = (x, z) => { const b = block(blockOf(x), blockOf(z)); return b && b.y0 && x >= b.R.x0 && x <= b.R.x1 && z >= b.R.z0 && z <= b.R.z1 ? FY : 0; };

  // ---- bus lines: built first, so the pavement at each stop can be cleared of other furniture -------
  const bus = buildBuses(scene, yAt, xing), busStops = bus.lines.flatMap((l) => l.stops);
  for (const st of busStops) { const b = block(blockOf(st.x), blockOf(st.z)); if (b) { b.props = b.props.filter((p) => Math.hypot(p[1] - st.x, p[2] - st.z) > 6.5); b.trees = b.trees.filter((q) => Math.hypot(q[0] - st.x, q[1] - st.z) > 5); } }

  // shared by the area builders (park, coast, port, suburb): bridge gaps, walk-in rooms, data caches
  const gaps = [], stairGaps = [], bridges = [], rooms = [], kit = makeRoomKit(col, city);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false });
  const cache = (x, y, z) => { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.45), neon('#ffd34d', 1.8)); m.position.set(x, y + 1.1, z); scene.add(m); const beam = new THREE.Mesh(new THREE.BoxGeometry(0.12, 14, 0.12), beamMat); beam.position.set(x, y + 7, z); scene.add(beam); city.caches.push({ id: city.caches.length, x, y, z, m, beam, found: false }); };
  col.base = (x, z) => (inCanal(x, z) ? CANAL_Y : z < -1640 ? mountY(x, z) : hillY(x, z) || isleY(x, z));
  const north = buildMountains(scene, col, city);
  cache(north.viewpoint.x - 8, north.viewpoint.y, north.viewpoint.z - 4);

  // ---- ground ------------------------------------------------------------------------------------
  const GB = new Builder(), asph = [], Y = -0.04;
  const sites = SITE_LIST.filter((s) => s.y < 100).map((s) => siteRect(s));
  const clip = (r, holes) => { let rs = [r]; for (const h of holes) rs = rs.flatMap((q) => subtract(q, h)); return rs.filter((q) => q.x1 - q.x0 > 0.01 && q.z1 - q.z0 > 0.01); };
  const tint = (q, hex) => GB.quad('S', hex, q.x1 - q.x0, q.z1 - q.z0, (q.x0 + q.x1) / 2, Y, (q.z0 + q.z1) / 2);
  for (let j = -NB; j <= 9; j++) for (let i = -NB; i <= NB; i++) {
    const use = useAt(i, j), c = cellRect(i, j), b = blockRect(i, j);
    if (URBAN[use] || use === 'meridian') { asph.push(...clip(c, CANAL)); continue; }
    const holes = use === 'district' ? [...CANAL, ...sites] : use === 'park' ? [...CANAL, ...PARK_HOLES] : CANAL, hex = COL[use];
    for (const q of clip(b, holes)) tint(q, hex);
    const strips = [[{ x0: b.x0, x1: b.x1, z0: c.z0, z1: b.z0 }, sSeg(i, j - 1)], [{ x0: b.x0, x1: b.x1, z0: b.z1, z1: c.z1 }, sSeg(i, j)], [{ x0: c.x0, x1: b.x0, z0: b.z0, z1: b.z1 }, eSeg(i - 1, j)], [{ x0: b.x1, x1: c.x1, z0: b.z0, z1: b.z1 }, eSeg(i, j)]];
    for (const [r, seg] of strips) for (const q of clip(r, holes)) { if (seg && seg !== 'canal') asph.push(q); else tint(q, hex); }
    const corners = [[c.x0, b.x0, c.z0, b.z0, corner(i - 1, j - 1)], [b.x1, c.x1, c.z0, b.z0, corner(i, j - 1)], [c.x0, b.x0, b.z1, c.z1, corner(i - 1, j)], [b.x1, c.x1, b.z1, c.z1, corner(i, j)]];
    for (const [x0, x1, z0, z1, cn] of corners) for (const q of clip({ x0, x1, z0, z1 }, holes)) { if (cn.arms > 0) asph.push(q); else tint(q, hex); }
  }
  asph.push(...clip({ x0: -EDGE, x1: EDGE, z0: 1140, z1: 1150 }, CANAL));                          // the sea side of Shoreline Drive
  // far land beyond the grid, the waterfront row, and the sea
  tint({ x0: -9000, x1: -EDGE, z0: -9000, z1: 1205 }, '#07090d'); tint({ x0: EDGE, x1: 9000, z0: -9000, z1: 1196 }, '#07090d'); tint({ x0: -EDGE, x1: EDGE, z0: -9000, z1: -EDGE }, '#07090d');   // out past the far plane, so no edge shows from Skyline Station
  const xs = new Set([-9000, 9000, -70, -50, 300, 1320, 1500]); for (let x = -EDGE; x <= EDGE; x += 30) xs.add(x);
  const X = [...xs].sort((a, b) => a - b), SB = new Builder();
  for (let k = 0; k < X.length - 1; k++) {
    const xa = X[k], xb = X[k + 1], za = coastZ(xa + 0.01), zb = coastZ(xb - 0.01);
    if (xa >= -EDGE && xb <= EDGE && (za > 1150.5 || zb > 1150.5)) GB.patch('S', COL[useAt(blockOf((xa + xb) / 2), 10)] || COL.front, xa, za, xb, zb, xb, 1150, xa, 1150, Y);
    SB.patch('S', '#1f7f96', xa, za + 46, xb, zb + 46, xb, zb, xa, za, 0.02, '#3fb3b8');            // shallows
    SB.patch('S', '#12506e', xa, 9000, xb, 9000, xb, zb + 46, xa, za + 46, 0.02, '#1f7f96');        // deep water
  }
  for (const c of CANAL) SB.quad('S', '#2f9ab2', c.x1 - c.x0, c.z1 - c.z0, (c.x0 + c.x1) / 2, CANAL_Y + 0.02, (c.z0 + c.z1) / 2);
  { // the canal's stone walls, and a weir at each end (the park lake and the sea are 2.4 m higher)
    const WALL = '#5a606b', H = -CANAL_Y + 0.5, wy = (CANAL_Y - 0.5) / 2;
    GB.box('S', WALL, 500, H, 0.6, 180, wy, 649.7); GB.box('S', WALL, 480, H, 0.6, 190, wy, 670.3);
    GB.box('S', WALL, 0.6, H, 500, -70.3, wy, 900); GB.box('S', WALL, 0.6, H, 480, -49.7, wy, 910);
    for (const [x, z, alongX] of [[430, 660, false], [-60, 1150, true]]) {
      GB.box('S', '#2a8a9c', alongX ? 20 : 0.1, -CANAL_Y, alongX ? 0.1 : 20, alongX ? x : x - 0.15, CANAL_Y / 2, alongX ? z - 0.15 : z);          // the water sheet coming over
      GB.box('G', '#dff4ff', alongX ? 20 : 0.6, 0.12, alongX ? 0.6 : 20, alongX ? x : x - 0.4, CANAL_Y + 0.08, alongX ? z - 0.4 : z);            // foam where it lands
      col.box(alongX ? x - 10 : x - 0.3, alongX ? x + 10 : x + 0.3, CANAL_Y - 0.6, 0.3, alongX ? z - 0.3 : z - 10, alongX ? z + 0.3 : z + 10);
    }
  }
  const seaMat = waterMaterial(); seaMat.side = THREE.DoubleSide;   // seen from below by divers
  { // asphalt: one mesh, uvs in world space so the texture has the same grain everywhere
    const n = asph.length, p = new Float32Array(n * 12), u = new Float32Array(n * 8), nr = new Float32Array(n * 12), idx = new Uint32Array(n * 6);
    asph.forEach((q, k) => { p.set([q.x0, Y, q.z1, q.x1, Y, q.z1, q.x1, Y, q.z0, q.x0, Y, q.z0], k * 12); u.set([q.x0 / 404, q.z1 / 404, q.x1 / 404, q.z1 / 404, q.x1 / 404, q.z0 / 404, q.x0 / 404, q.z0 / 404], k * 8); for (let v = 0; v < 4; v++) nr[k * 12 + v * 3 + 1] = 1; idx.set([k * 4, k * 4 + 1, k * 4 + 2, k * 4, k * 4 + 2, k * 4 + 3], k * 6); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nr, 3)); g.setAttribute('uv', new THREE.BufferAttribute(u, 2)); g.setIndex(new THREE.BufferAttribute(idx, 1));
    const m = new THREE.Mesh(g, M.road); m.receiveShadow = true; m.matrixAutoUpdate = false; group.add(m);
  }
  // ---- raised pavements --------------------------------------------------------------------------
  const slabs = [];
  const slab = (w, d, x, z) => { const g = new THREE.BoxGeometry(w, FY + 1, d); g.translate(x, (FY - 1) / 2, z); slabs.push(g); };
  for (const b of list) {
    if (!URBAN[b.use] || b.cut) continue;
    if (b.use === 'suburb') { GB.box('S', '#2b5a3a', 93, FY + 1, 93, b.cx, (FY - 1) / 2, b.cz); for (const s of [-1, 1]) { GB.box('S', '#414855', 100, FY + 1, 3.5, b.cx, (FY - 1) / 2, b.cz + s * 48.25); GB.box('S', '#414855', 3.5, FY + 1, 93, b.cx + s * 48.25, (FY - 1) / 2, b.cz); } }
    else slab(100, 100, b.cx, b.cz);
    col.box(b.R.x0, b.R.x1, -1, FY, b.R.z0, b.R.z1, { noCam: true });
  }
  { const m = new THREE.Mesh(mergeGeometries(slabs), M.sidewalk); for (const g of slabs) g.dispose(); m.receiveShadow = true; m.matrixAutoUpdate = false; group.add(m); }

  // ---- the hand-built areas: they add furniture and trees to the block layout, and fixed parts to the ground mesh ----
  const ctx = { GB, SB, col, city, block, kit, group, rooms, cache, gaps, scene, yAt };
  const park = layoutPark(ctx), coast = layoutCoast(ctx), suburb = layoutSuburb(ctx), beachVilla = layoutBeachVilla(ctx), expo = layoutExpo(ctx), skyline = layoutSkyline(ctx), towers = layoutTowers(ctx), campus = layoutCampus(ctx);
  const sea = SB.b.S.mesh(seaMat, false); sea.updateMatrix(); group.add(sea);
  const foam = shoreFoam(group, { x: 300, z: 1800, r: 46 });
  // more data caches in out-of-the-way places
  for (const [x, y, z] of [[-60, 38.1, 1140], [826, 3.2, 1420], [-1020, 39.1, 1248], [-1113, 23, 1219], [1310, 0.2, 1154], [-60, 0.1, 900], [150, 0.6, 1180], [-846, 9.15, -750], [1560, 83.5, 1721], [528, 0, 516], [870, 5.45, 828], [640, 0, -640], [303.2, 32.3, 1800], [470, 4.3, 1188]]) cache(x, y, z);

  // ---- buildings, and colliders for everything that stands on the pavements -------------------------
  const shells = buildShells(group, col, list);
  let solids = 0; const stops = [];
  for (const b of list) {
    for (const p of b.props) {
      const s = SOLID[p[0]]; if (!s) continue;
      const turned = Math.abs(Math.sin(p[3])) > 0.7, hw = turned ? s[1] : s[0], hd = turned ? s[0] : s[1], y0 = (p[0] === 'pod' ? 0 : b.y0) + (p[5] || 0);
      col.box(p[1] - hw, p[1] + hw, y0, y0 + s[2], p[2] - hd, p[2] + hd, { noCam: true }); solids++;
    }
    for (const s of b.solids) col.box(s[0], s[1], s[2], s[3], s[4], s[5]);
    for (const [x, z, s, , up] of b.trees) { const y = b.y0 + (up || 0); col.box(x - 0.3, x + 0.3, y, y + 3 * s, z - 0.3, z + 0.3, { noCam: true }); solids++; }
    if (b.stop) stops.push({ ...b.stop, i: b.i, j: b.j });
  }
  for (let j = -NB; j <= 9; j++) for (let i = -NB; i <= NB; i++) { const c = corner(i, j); if (c.signal) for (const [x, z] of signalPoles(c)) { const y = yAt(x, z); col.box(x - 0.14, x + 0.14, y, y + 6, z - 0.14, z + 0.14, { noCam: true }); } }

  // ---- bridges ---------------------------------------------------------------------------------------
  const deck = (x, z, w, d, name, yaw = 0) => {
    GB.box('B', '#3a414d', w, 0.3, d, x, -0.05, z, yaw);
    const cs = Math.abs(Math.cos(yaw)), sn = Math.abs(Math.sin(yaw)), hx = (w * cs + d * sn) / 2, hz = (w * sn + d * cs) / 2;
    col.box(x - hx, x + hx, -0.3, 0.1, z - hz, z + hz, { noCam: true }); gaps.push({ x0: x - hx - 1, x1: x + hx + 1, z0: z - hz - 1, z1: z + hz + 1 }); bridges.push({ x, z, w, d, name, yaw, hx, hz });
  };
  const sideRails = (x, z, len, half, alongX) => { for (const s of [-1, 1]) { const rx = alongX ? x : x + s * half, rz = alongX ? z + s * half : z; GB.box('S', '#aeb6c2', alongX ? len : 0.1, 0.1, alongX ? 0.1 : len, rx, 1.1, rz); GB.box('S', '#39404c', alongX ? len : 0.16, 0.9, alongX ? 0.16 : len, rx, 0.55, rz); col.box(rx - (alongX ? len / 2 : 0.1), rx + (alongX ? len / 2 : 0.1), 0, 1.1, rz - (alongX ? 0.1 : len / 2), rz + (alongX ? 0.1 : len / 2), { noCam: true }); } };
  deck(420, 660, 20, 24, 'Park Avenue bridge'); sideRails(420, 660, 22, 10.2, false);
  deck(180, 660, 4, 24, 'Old Earth footbridge'); sideRails(180, 660, 22, 2.1, false);
  deck(-60, 900, 24, 4, 'Canal footbridge'); sideRails(-60, 900, 22, 2.1, true);
  deck(-60, 1140, 26, 20, 'Tidewater Gate bridge'); sideRails(-60, 1140, 24, 10.2, true);
  { // the highway to Old Earth crosses the canal on its own deck
    const s = roads.radials.find((r) => (r.az - 660) * (r.bz - 660) < 0 && r.ax > -70 && r.ax < 430);
    if (s) { const t = (660 - s.az) / (s.bz - s.az); deck(s.ax + (s.bx - s.ax) * t, 660, 18, 30, 'Old Earth highway bridge', Math.atan2(s.ux, s.uz)); }
  }
  { // Tidewater Gate: a portal tower over the road with cable stays down to the deck
    const cab = [], steel = std('#c9d2de', 0.4, 0.7), up = new THREE.Vector3(0, 1, 0), a = new THREE.Vector3(), b = new THREE.Vector3(), q = new THREE.Quaternion();
    for (const sz of [-1, 1]) {
      const z = 1140 + sz * 10.6, yb = CANAL_Y - 0.5; GB.box('B', '#d7dde6', 1.6, 38 - yb, 1.6, -60, (38 + yb) / 2, z); GB.box('G', '#59e0ff', 0.2, 36, 0.2, -60, 19, z + sz * 0.85); col.box(-60.8, -59.2, yb, 38, z - 0.8, z + 0.8);
      for (const sx of [-1, 1]) for (let k = 1; k <= 4; k++) {
        a.set(-60, 36 - k * 2.2, z); b.set(-60 + sx * (6 + k * 9), 1.1, z); const len = a.distanceTo(b), g = new THREE.CylinderGeometry(0.07, 0.07, len, 5);
        q.setFromUnitVectors(up, b.clone().sub(a).normalize()); g.applyQuaternion(q); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); cab.push(g);
      }
    }
    GB.box('B', '#d7dde6', 1.2, 2.2, 22.8, -60, 37, 1140); GB.box('G', '#ffd34d', 0.5, 0.5, 0.5, -60, 39.2, 1140);
    const m = new THREE.Mesh(mergeGeometries(cab), steel); m.matrixAutoUpdate = false; group.add(m);
    for (const sx of [-1, 1]) sideRails(-60 + sx * 30, 1140, 34, 10.2, true);
  }
  // steps down to a pontoon at four places along the canal, so you can get in and out of the water
  const landings = [];
  for (const [sx, sz, ux, uz, nx, nz] of [[370, 650, 1, 0, 0, 1], [130, 670, -1, 0, 0, -1], [-50, 840, 0, 1, -1, 0], [-70, 1080, 0, 1, 1, 0]]) {
    for (let k = 0; k < 7; k++) {
      const top = -0.3 * (k + 1), cx = sx + ux * (0.35 + 0.7 * k) + nx * 0.9, cz = sz + uz * (0.35 + 0.7 * k) + nz * 0.9, w = ux ? 0.7 : 1.8, d = ux ? 1.8 : 0.7;
      GB.box('S', '#7c8089', w, top - CANAL_Y + 0.5, d, cx, (top + CANAL_Y - 0.5) / 2, cz); col.box(cx - w / 2, cx + w / 2, CANAL_Y - 0.5, top, cz - d / 2, cz + d / 2, { noCam: true });
    }
    const px = sx + ux * 12.4 + nx * 2.5, pz = sz + uz * 12.4 + nz * 2.5, pw = ux ? 15 : 5, pd = ux ? 5 : 15, py = CANAL_Y + 0.3;
    GB.box('B', '#8a6a48', pw, 0.3, pd, px, py - 0.15, pz); col.box(px - pw / 2, px + pw / 2, CANAL_Y - 0.5, py, pz - pd / 2, pz + pd / 2, { noCam: true });
    for (const s of [-1, 1]) GB.cyl('S', '#4a3626', 0.14, 0.14, 1.4, px + (ux ? s * 7 : (nx > 0 ? 2.3 : -2.3)), py - 0.3, pz + (uz ? s * 7 : (nz > 0 ? 2.3 : -2.3)), 6);
    // no railing along the top of the steps; and the steps are not water
    const g = { x0: Math.min(sx - ux * 2.5, sx + ux * 5.4) - (ux ? 0 : 2.5), x1: Math.max(sx - ux * 2.5, sx + ux * 5.4) + (ux ? 0 : 2.5), z0: Math.min(sz - uz * 2.5, sz + uz * 5.4) - (uz ? 0 : 2.5), z1: Math.max(sz - uz * 2.5, sz + uz * 5.4) + (uz ? 0 : 2.5) };
    gaps.push(g); stairGaps.push(g);
    landings.push({ x: px, y: py, z: pz, top: { x: sx - ux * 1.2 - nx * 1.5, y: 0, z: sz - uz * 1.2 - nz * 1.5 } });
  }
  const railOpen = (x, z) => inCanal(x, z) || gaps.some((g) => x > g.x0 && x < g.x1 && z > g.z0 && z < g.z1) || layout.roadNear({ x0: x - 2, x1: x + 2, z0: z - 2, z1: z + 2 }, 2);
  for (const b of list) for (const [ax, az, bx, bz] of canalRails(b)) for (const [x, z, alongX] of railPieces(ax, az, bx, bz, railOpen)) col.box(x - (alongX ? 2 : 0.08), x + (alongX ? 2 : 0.08), 0, 1.2, z - (alongX ? 0.08 : 2), z + (alongX ? 0.08 : 2), { noCam: true });

  // a shelter and a line totem at every bus stop
  for (const l of bus.lines) for (const st of l.stops) {
    const a = st.yaw + Math.PI / 2, sx = st.x - Math.cos(st.yaw) * 1.7, sz = st.z + Math.sin(st.yaw) * 1.7;
    draw.shelter(GB, sx, st.y, sz, a); GB.cyl('S', '#232832', 0.09, 0.09, 3.4, st.x + Math.sin(st.yaw) * 4, st.y + 1.7, st.z + Math.cos(st.yaw) * 4, 6); GB.box('G', l.color, 0.9, 0.9, 0.12, st.x + Math.sin(st.yaw) * 4, st.y + 3.2, st.z + Math.cos(st.yaw) * 4, a);
    const turned = Math.abs(Math.sin(a)) > 0.7; col.box(sx - (turned ? 0.3 : 3), sx + (turned ? 0.3 : 3), st.y, st.y + 2.6, sz - (turned ? 3 : 0.3), sz + (turned ? 3 : 0.3), { noCam: true });
  }
  const signals = buildCrossingSignals(xing, GB, col, yAt); group.add(signals.mesh);
  const barriers = buildBarriers(xing, GB, col);
  const ground = GB.finish(new THREE.Group(), city.lamps.poolMat); group.add(ground);
  // one hidden triangle per streamed material, so their shaders are compiled at the title screen
  { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3)); g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(9), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(9), 3)); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(6), 2));
    for (const mat of [MATS.S, MATS.B, MATS.G, MATS.L, signMaterial(), posterMaterial()]) { const m = new THREE.Mesh(g, mat); m.position.y = -80; m.frustumCulled = false; group.add(m); } }

  const metro = {
    group, blocks, list, block, yAt, bus, xing, signals, barriers, extraCars: [], roadNear: layout.roadNear, railOpen, detailers: {}, stops, bridges, sea, stats: { blocks: list.length, shells, solids },
    signal: signalState, corner, eSeg, sSeg, areaAt,
    park, coast, suburb, beachVilla, expo, skyline, towers, campus, rooms, landings, level: waterLevel,
    // the canal lies below its bridges, so only its steps are dry; elsewhere a bridge or jetty over the water is dry
    north,
    waterAt: (x, z) => z < -2290 ? inReservoir(x, z) : inCanal(x, z) ? !stairGaps.some((g) => x > g.x0 && x < g.x1 && z > g.z0 && z < g.z1) : (inSea(x, z) || inLake(x, z)) && !onIsle(x, z) && !gaps.some((g) => x > g.x0 + 1 && x < g.x1 - 1 && z > g.z0 + 1 && z < g.z1 - 1),
    // "navigate to": a destination picked on the map, and the way there along the streets
    route: null, routeT: 0,
    setRoute(x, z, from) { const r = findRoute(from.x, from.z, x, z); this.route = r ? { x, z, pts: r.pts, len: r.len } : null; return this.route; },
    update(dt, t, focus, night = 0) {
      MATS.L.color.copy(city.lamps.headMat.color); this.stream.update(focus, dt, t, night); this.traffic.update(dt, t, focus); bus.update(dt, t); coast.update(dt, t, night); signals.update(dt, t); foam.update(t); north.update(dt, t);
      for (const r of rooms) r.g.visible = (r.x - focus.x) ** 2 + (r.z - focus.z) ** 2 < (r.r || 210) ** 2;
      if (this.route) {
        this.routeT -= dt;
        if (Math.hypot(this.route.x - focus.x, this.route.z - focus.z) < 28) { this.route = null; if (this.onArrive) this.onArrive(); }
        else if (this.routeT <= 0) { this.routeT = 1.5; this.setRoute(this.route.x, this.route.z, focus); }
      }
    },
  };
  metro.traffic = new AvenueTraffic();
  metro.stream = new Stream(scene, metro, city.lamps.poolMat);
  // run the detail builders once for a block of every kind now, at the title screen, so the code is compiled before it is needed
  for (let pass = 0; pass < 2; pass++) { for (const use of ['core', 'mid', 'edge', 'suburb', 'port', 'resort', 'park', 'beach', 'green', 'quay', 'front']) { const b = list.find((q) => q.use === use && (q.bld.length > 1 || q.props.length > 8)); if (b) metro.stream.block(b.i, b.j, []); } const g = metro.stream.B.finish(new THREE.Group(), city.lamps.poolMat, signMaterial()); g.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  return metro;
}
