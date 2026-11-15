// Meridian Quarter: the Phase 1 neighborhood of Neo Central.
// 3x3 blocks of 100 m, 20 m streets. North is -z, east is +x. Units are meters.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mergeMeshes } from './batch.js';
import { oldQuarterShop } from './stores.js';
import { dressTower } from './dress.js';
import { M, std, neon, towerGeometry, labelTexture, registerNight, makeCanvas, canvasTex } from './materials.js';
import { RNG, PathLine, roundedRectLoop, TAU, damp } from '../core/util.js';
import { buildInteriors } from './interiors.js';
import { SITE_LIST } from '../data/sites.js';

export const FY = 0.15; // pavement / floor height inside a block
export const BLOCKS = [];
for (const cz of [-120, 0, 120]) for (const cx of [-120, 0, 120]) BLOCKS.push({ cx, cz, x0: cx - 50, x1: cx + 50, z0: cz - 50, z1: cz + 50 });
export function terrainY(x, z) {
  for (const b of BLOCKS) if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) return FY;
  return 0;
}
const ROADS = [-180, -60, 60, 180];

export function buildCity(scene, col) {
  const group = new THREE.Group(); scene.add(group);
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const city = {
    group, pads: [], seats: [], doors: [], caches: [], stores: [], lamps: null, places: {}, holos: [], spinners: [], lights: [],
    treeSpots: [], updates: [], FY,
  };
  const rng = new RNG(2226);

  // ---- helpers -----------------------------------------------------------------------
  const bx = (w, h, d, mat, x, y, z, o) => {
    const m = new THREE.Mesh(unitBox, mat);
    m.scale.set(w, h, d); m.position.set(x, y, z);
    m.castShadow = !(o && o.noCast); m.receiveShadow = true;
    ((o && o.parent) || group).add(m);
    if (!(o && (o.parent || o.dyn))) m.userData.batch = true; // static: merged with its neighbors by city.batch()
    return m;
  };
  const solid = (x0, x1, y0, y1, z0, z1, mat, o) => {
    col.box(x0, x1, y0, y1, z0, z1, o && o.col);
    return mat ? bx(x1 - x0, y1 - y0, z1 - z0, mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, o) : null;
  };
  const cyl = (rt, rb, h, mat, x, y, z, seg = 16, o) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
    m.position.set(x, y, z); m.castShadow = !(o && o.noCast); m.receiveShadow = true; ((o && o.parent) || group).add(m);
    if (!(o && (o.parent || o.dyn))) m.userData.batch = true;
    return m;
  };
  const flat = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); group.add(m); return m; };
  const holo = (text, w, h, x, y, z, ry, o = {}) => {
    const t = labelTexture(text, { color: o.color || '#9ff', sub: o.sub, w: o.tw || 512, h: o.th || 128, size: o.size || 64, bg: o.bg, border: o.border });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({
      map: t, transparent: true, opacity: o.opacity ?? 0.95, side: THREE.DoubleSide, depthWrite: false,
      blending: o.solid ? THREE.NormalBlending : THREE.AdditiveBlending,
    }));
    m.position.set(x, y, z); m.rotation.y = ry; (o.parent || group).add(m);
    if (!o.steady) city.holos.push({ m, base: o.opacity ?? 0.95, ph: rng.range(0, 10) });
    return m;
  };
  const light = (color, intensity, dist, x, y, z) => {
    const l = new THREE.PointLight(color, intensity, dist, 1.4); l.position.set(x, y, z); group.add(l); city.lights.push(l); return l;
  };
  const roofGeos = [];
  const blinkMat = new THREE.MeshBasicMaterial({ color: 0xff3030 });
  const tower = (x0, x1, z0, z1, y0, y1, mat, o = {}) => {
    const w = x1 - x0, d = z1 - z0, h = y1 - y0;
    const m = new THREE.Mesh(towerGeometry(w, h, d, mat.userData.tile), mat);
    m.position.set((x0 + x1) / 2, y0 + h / 2, (z0 + z1) / 2); m.castShadow = true; m.receiveShadow = true; m.userData.batch = true; group.add(m);
    if (!o.noCol) col.box(x0, x1, y0, y1, z0, z1, { tag: 'tower' });
    const rg = new THREE.PlaneGeometry(w, d); rg.rotateX(-Math.PI / 2); rg.translate((x0 + x1) / 2, y1 + 0.03, (z0 + z1) / 2); roofGeos.push(rg);
    dressTower((dm, bw, bh, bd, px, py, pz) => bx(bw, bh, bd, dm, px, py, pz, { noCast: dm.isMeshBasicMaterial }), x0, x1, z0, z1, y0, y1, o);
    if (o.neon) for (const [cx, cz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) bx(0.6, h, 0.6, neon(o.neon, 1.3), cx, y0 + h / 2, cz, { noCast: true });
    if (o.crown) {
      const c = neon(o.crown, 1.5), my = y1 + 0.3;
      bx(w + 0.6, 0.6, 0.4, c, (x0 + x1) / 2, my, z0, { noCast: true }); bx(w + 0.6, 0.6, 0.4, c, (x0 + x1) / 2, my, z1, { noCast: true });
      bx(0.4, 0.6, d + 0.6, c, x0, my, (z0 + z1) / 2, { noCast: true }); bx(0.4, 0.6, d + 0.6, c, x1, my, (z0 + z1) / 2, { noCast: true });
    }
    if (o.beacon) {
      const mh = o.mast || 14, mx = x0 + w * 0.8, mz = z0 + d * 0.2;
      bx(0.35, mh, 0.35, M.metalDark, mx, y1 + mh / 2, mz);
      bx(0.9, 0.9, 0.9, blinkMat, mx, y1 + mh + 0.4, mz, { noCast: true });
    }
    return m;
  };
  const stack = (x0, x1, z0, z1, h, mat, o = {}) => {
    const lv = o.levels || [[0, 0.6, 0], [0.6, 0.86, 0.14], [0.86, 1, 0.3]];
    for (const [a, b, inset] of lv) {
      const ix = ((x1 - x0) * inset) / 2, iz = ((z1 - z0) * inset) / 2;
      tower(x0 + ix, x1 - ix, z0 + iz, z1 - iz, h * a, h * b, mat, b === 1 ? o : { neon: o.neon });
    }
  };
  const pad = (id, name, x, y, z, r = 6.5, o = {}) => {
    const disc = flat(new THREE.CircleGeometry(r, 40), std('#1a1f29', 0.6, 0.5), x, y + 0.02, z); disc.receiveShadow = true; disc.userData.batch = true;
    flat(new THREE.RingGeometry(r - 0.45, r, 48), neon(o.color || '#4de1ff', 1.3), x, y + 0.04, z).userData.batch = true;
    flat(new THREE.RingGeometry(r * 0.42, r * 0.42 + 0.2, 40), neon(o.color || '#4de1ff', 0.9), x, y + 0.04, z).userData.batch = true;
    const lab = flat(new THREE.PlaneGeometry(5, 1.25), new THREE.MeshBasicMaterial({ map: labelTexture(name.toUpperCase(), { size: 46, color: '#cfefff' }), transparent: true, depthWrite: false }), x, y + 0.05, z + r * 0.68);
    lab.renderOrder = 2;
    const p = { id, name, x, y, z, r, charger: !!o.charger, priv: !!o.priv, taxi: !o.noTaxi };
    if (o.charger) {
      const px = x + (o.cx ?? -r - 1.6), pz = z + (o.cz ?? 0);
      solid(px - 0.3, px + 0.3, y, y + 2.4, pz - 0.3, pz + 0.3, M.metalDark);
      bx(0.64, 0.5, 0.64, neon('#7dff9c', 1.4), px, y + 2.1, pz, { noCast: true });
      p.chargerPos = { x: px, y, z: pz };
    }
    city.pads.push(p);
    return p;
  };
  const cache = (x, y, z) => {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.45), neon('#ffd34d', 1.8)); m.position.set(x, y + 1.1, z); group.add(m);
    const beam = bx(0.12, 14, 0.12, new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }), x, y + 7, z, { noCast: true, dyn: true });
    city.caches.push({ id: city.caches.length, x, y, z, m, beam, found: false });
  };
  const ctx = { THREE, group, col, city, rng, bx, solid, cyl, flat, holo, light, tower, stack, pad, cache, unitBox };

  // ---- ground ------------------------------------------------------------------------
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), M.outer); outer.rotation.x = -Math.PI / 2; outer.position.y = -3.5; group.add(outer);   // a dark underlay; the ground itself (asphalt, lawns, sand, sea) is built by world/metro
  for (const b of BLOCKS) {
    bx(100, FY + 1, 100, M.sidewalk, b.cx, (FY - 1) / 2, b.cz, { noCast: true });
    col.box(b.x0, b.x1, -1, FY, b.z0, b.z1, { noCam: true });
  }
  { // lane dashes
    const list = [];
    const nearX = (v) => ROADS.some((c) => Math.abs(v - c) < 13);
    for (const r of ROADS) for (let t = -186; t <= 186; t += 8) { if (nearX(t)) continue; list.push([r, t, 0]); list.push([t, r, 1]); }
    const im = new THREE.InstancedMesh(unitBox, neon('#b9d9ff', 0.8), list.length); const mtx = new THREE.Matrix4();
    list.forEach(([x, z, rot], i) => { mtx.makeScale(rot ? 3.2 : 0.28, 0.02, rot ? 0.28 : 3.2); mtx.setPosition(x, 0.02, z); im.setMatrixAt(i, mtx); });
    group.add(im);
  }

  // ---- block N: Halcyon Tower + Printed Petal + Lumen Exchange --------------------------
  const F = M.facades;
  stack(-42, -8, -114, -80, 280, F.glass, { neon: '#59d8ff', crown: '#59d8ff', beacon: true });
  tower(-42, -4, -163, -122, 0, 150, F.warm, { crown: '#ffb86b' });
  stack(4, 42, -163, -110, 210, F.corp, { neon: '#7fe9ff', crown: '#7fe9ff', beacon: true, levels: [[0, 0.72, 0], [0.72, 1, 0.2]] });
  solid(-4, 4, 100, 104, -140, -134, M.glassDark, { noCast: true }); // skybridge
  bx(8.4, 0.3, 6.4, neon('#59d8ff', 1.1), 0, 99.9, -137, { noCast: true });
  holo('LUMEN EXCHANGE', 30, 5, 23, 150, -109.6, 0, { color: '#7fe9ff', size: 58 });
  holo('HALCYON', 26, 6, -25, 200, -79.6, 0, { color: '#bfe9ff', sub: 'SKY RESIDENCES · EST. 2198' });

  // ---- block E: Kinetic Robotics + towers -------------------------------------------------
  tower(113, 163, -43, -3, 0, 170, F.magenta, { neon: '#ff7ad9', crown: '#ff7ad9', beacon: true });
  tower(113, 163, 3, 43, 0, 95, F.glass, { crown: '#59d8ff' });
  tower(77, 107, -43, -26, 0, 60, F.warm, {});
  tower(77, 107, 26, 43, 0, 44, F.corp, { crown: '#7dff9c' });
  for (const [tx, tz] of [[82, 30], [90, 38], [100, 31], [102, 39]]) city.treeSpots.push([tx, tz, 0.8, 44, false]);
  holo('MYCO·COLA', 22, 7, 138, 120, -2.6, 0, { color: '#ff7ad9', sub: 'grown, not brewed' });

  // ---- block S: Old Quarter row + the Spire ---------------------------------------------------
  const oldUnits = [[-43, -27, 12, '#c2543d', 'ANALOG RECORDS'], [-27, -9, 15, '#3d8f7a', 'BAO & BROTH'], [-9, 9, 10, '#b88a2e', 'TEA HOUSE'], [9, 27, 14, '#5a6fb8', 'REPAIR CAFE'], [27, 43, 11, '#8a4f9e', 'PAPER BOOKS']];
  for (const [x0, x1, h, awn, name] of oldUnits) {
    tower(x0, x1, 77, 95, FY + 4.25, h, F.brick, {});   // the shop occupies the ground floor
    oldQuarterShop(ctx, x0, x1, name, FY);
    bx(x1 - x0 - 2, 0.25, 2.4, std(awn, 0.8, 0), (x0 + x1) / 2, FY + 3.3, 75.9);
    holo(name, Math.min(11, x1 - x0 - 3), 1.5, (x0 + x1) / 2, FY + 4.6, 76.85, Math.PI, { color: '#ffd9a0', size: 60, steady: true });
    for (let lx = x0 + 2; lx < x1 - 1; lx += 2.6) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), neon('#ffb060', 1.6)); s.position.set(lx, FY + 3.0, 74.9); s.userData.batch = true; group.add(s); }
  }
  stack(-30, 30, 103, 163, 340, F.corp, { neon: '#ff7ad9', crown: '#ff7ad9', beacon: true, mast: 30 });
  holo('OLD QUARTER', 20, 4, 0, 26, 76.5, Math.PI, { color: '#ffcf8a', sub: 'preserved streets · est. 2019' });

  // ---- block W: Meridian Skyport -------------------------------------------------------------
  tower(-163, -143, -43, 43, 0, 26, F.corp, { crown: '#4de1ff' });
  tower(-158, -148, -5, 5, 26, 60, F.glass, { neon: '#4de1ff', beacon: true, mast: 8 });
  holo('MERIDIAN SKYPORT', 34, 5, -142.6, 20, 0, Math.PI / 2, { color: '#9fefff', sub: 'charging · repair · flight ops' });
  pad('sky1', 'Skyport 1', -92, FY, 24, 6.5, { charger: true });
  pad('sky2', 'Skyport 2', -92, FY, -24, 6.5, { charger: true });
  pad('sky3', 'Skyport 3', -120, FY, 24, 6.5, { charger: true });
  pad('sky4', 'Taxi rank', -120, FY, -24, 6.5, { color: '#ffd34d', noTaxi: true });

  // ---- corner blocks: procedural towers --------------------------------------------------------
  const corners = [[-120, -120, 'NW'], [120, -120, 'NE'], [-120, 120, 'SW'], [120, 120, 'SE']];
  const fac = [F.glass, F.corp, F.magenta, F.warm, F.glass];
  const neons = ['#59d8ff', '#ff7ad9', '#7dff9c', '#ffb86b', '#b98cff'];
  for (const [cx, cz, tag] of corners) {
    let best = null;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x0 = sx < 0 ? cx - 43 : cx + 3, x1 = sx < 0 ? cx - 3 : cx + 43, z0 = sz < 0 ? cz - 43 : cz + 3, z1 = sz < 0 ? cz - 3 : cz + 43;
      const h = Math.round(rng.range(70, 420)), ins = rng.range(0, 5), nc = rng.pick(neons), f = rng.pick(fac);
      const o = { neon: rng.chance(0.6) ? nc : null, crown: nc, beacon: h > 200 };
      if (h > 220 && rng.chance(0.6)) stack(x0 + ins, x1 - ins, z0 + ins, z1 - ins, h, f, o); else tower(x0 + ins, x1 - ins, z0 + ins, z1 - ins, 0, h, f, o);
      if (!best || h > best.h) best = { h, x: (x0 + x1) / 2, z: (z0 + z1) / 2 };
    }
    pad('vant' + tag, 'Vantage ' + tag, best.x, best.h, best.z, 5.5, {});
    if (tag === 'SE') cache(best.x + 4, best.h, best.z + 3);
  }

  // ---- outer ring of mid-rises, megatowers, far skyline --------------------------------------------
  for (const side of [0, 1, 2, 3]) {
    let t = -238;
    while (t < 238) {
      const w = rng.range(34, 58), h = rng.range(45, 150), f = rng.pick(fac), a = t, b = Math.min(238, t + w);
      const o = { crown: rng.chance(0.4) ? rng.pick(neons) : null };
      // leave the highway corridors to the districts open
      const mid = (a + b) / 2, px = side < 2 ? mid : side === 2 ? -223 : 223, pz = side === 0 ? -223 : side === 1 ? 223 : mid;
      const open = SITE_LIST.some((s) => { const tt = Math.max(0, (px * s.x + pz * s.z) / (s.x * s.x + s.z * s.z)); return Math.hypot(px - s.x * tt, pz - s.z * tt) < 13 + (b - a) / 2 + 12; });
      // ...and the avenues that run out of Meridian
      const street = [-180, -60, 60, 180].some((c) => a < c + 12 && b > c - 12);
      if (open || street) { /* road */ } else if (side === 0) tower(a, b, -241, -205, 0, h, f, o); else if (side === 1) tower(a, b, 205, 241, 0, h, f, o);
      else if (side === 2) { if (a > -200 && b < 200) tower(-241, -205, a, b, 0, h, f, o); } else if (a > -200 && b < 200) tower(205, 241, a, b, 0, h, f, o);
      t += w + rng.range(3, 8);
    }
  }
  // megatowers: each fills one block of the street grid
  const megas = [[360, -360, 49, 1040, 'Aurelia Needle'], [-360, -360, 49, 820], [360, 360, 49, 900], [-360, 360, 48, 760], [120, -480, 46, 1180], [-120, 480, 45, 980], [480, -120, 44, 1300], [-480, 120, 44, 860]];
  for (const [x, z, hw, h, name] of megas) {
    stack(x - hw, x + hw, z - hw, z + hw, h, F.mega, { neon: rng.pick(neons), crown: rng.pick(neons), beacon: true, mast: 40, levels: [[0, 0.5, 0], [0.5, 0.8, 0.18], [0.8, 1, 0.4]] });
    if (name) { pad('needle', name, x, h, z, 6, {}); cache(x + 5, h, z - 4); }
  }
  {
    const geos = [];
    for (let i = 0; i < 620; i++) {
      const a = rng.range(0, TAU), r = rng.range(1700, 3400), w = rng.range(60, 190), d = rng.range(60, 190);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      // keep the district sites clear, and leave an open sky avenue from Meridian to each of them
      if (SITE_LIST.some((s) => { const t = Math.max(0, Math.min(1, (x * s.x + z * s.z) / (s.x * s.x + s.z * s.z))); return Math.hypot(x - s.x, z - s.z) < 330 || Math.hypot(x - s.x * t, z - s.z * t) < 110 + Math.max(w, d) / 2; }) || (Math.abs(x) < 1700 + w / 2 && z > -1700 - d / 2) || z > 1060 - d / 2 || z < -1500) continue;   // ...and the mountains in the north // ...and the whole street grid, and the sea
      let h = rng.range(120, 700) + (rng.chance(0.25) ? rng.range(300, 1100) : 0);
      // towers inside the flyable area are real obstacles, and stay below Skyhaven
      if (r < 1600) h = Math.min(h, 380);
      if (r < 2600) col.box(x - w / 2, x + w / 2, 0, h, z - d / 2, z + d / 2);
      const g = towerGeometry(w, h, d, F.far.userData.tile); g.translate(x, h / 2, z); geos.push(g);
    }
    const sky = new THREE.Mesh(mergeGeometries(geos), F.far); group.add(sky);
  }

  // ---- data caches & misc landmarks ---------------------------------------------------------------
  cache(0, 104, -137);        // skybridge
  cache(0, 340, 133);         // the Spire
  cache(36, FY, 99);          // alley behind the Old Quarter
  cache(-153, 60, 0);         // skyport control tower
  cache(-25, 280, -97);       // Halcyon roof
  pad('lumen', 'Lumen Roof', 23, 210, -136.5, 6, {});
  pad('spire', 'The Spire', 0, 340, 133, 6, {});
  pad('kinetic', 'Kinetic Roof', 92, 120, 0, 6, {});
  pad('terrace', 'Garden Terrace', 94, 44, 35, 5, {});

  // ---- park, storefronts, apartment ----------------------------------------------------------------
  buildPark(ctx);
  buildInteriors(ctx);

  // ---- street lamps ----------------------------------------------------------------------------------
  {
    const pos = [];
    for (const b of BLOCKS) for (const o of [-36, -12, 12, 36]) {
      pos.push([b.cx + o, b.z0 + 1.5, 0, -1], [b.cx + o, b.z1 - 1.5, 0, 1], [b.x0 + 1.5, b.cz + o, -1, 0], [b.x1 - 1.5, b.cz + o, 1, 0]);
    }
    const n = pos.length, mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.1, 6.6, 6), M.metalDark, n);
    const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const heads = new THREE.InstancedMesh(unitBox, headMat, n);
    const poolMat = new THREE.MeshBasicMaterial({ map: M.glow, color: 0xffe2b8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const pg = new THREE.CircleGeometry(9, 24); pg.rotateX(-Math.PI / 2);
    const pools = new THREE.InstancedMesh(pg, poolMat, n);
    const white = new THREE.Color(1, 1, 1);
    pos.forEach(([x, z, ox, oz], i) => {
      mtx.makeTranslation(x, FY + 3.3, z); poles.setMatrixAt(i, mtx);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(ox, oz)); p.set(x + ox * 0.7, FY + 6.6, z + oz * 0.7); s.set(0.4, 0.12, 1.7);
      mtx.compose(p, q, s); heads.setMatrixAt(i, mtx);
      mtx.makeTranslation(x + ox * 1.8, FY + 0.03, z + oz * 1.8); pools.setMatrixAt(i, mtx);
      heads.setColorAt(i, white); pools.setColorAt(i, white);
    });
    poles.castShadow = true; pools.renderOrder = 1;
    group.add(poles, heads, pools);
    city.lamps = {
      pos, headMat, poolMat, broken: new Set(),
      set(i, on) { const c = on ? white : new THREE.Color(0, 0, 0); heads.setColorAt(i, c); pools.setColorAt(i, c); heads.instanceColor.needsUpdate = true; pools.instanceColor.needsUpdate = true; if (on) this.broken.delete(i); else this.broken.add(i); },
    };
  }

  // ---- trees (instanced) ---------------------------------------------------------------------------------
  {
    const n = city.treeSpots.length, mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.26, 3.6, 6), M.trunk, n);
    const ico = new THREE.IcosahedronGeometry(1, 1);
    // Main canopy is green or pink (engineered blossom); every tree also gets a smaller green blob.
    const gMain = new THREE.InstancedMesh(ico, M.leaf, n), pMain = new THREE.InstancedMesh(ico, M.leafPink, n), gTop = new THREE.InstancedMesh(ico, M.leaf, n);
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    city.treeSpots.forEach(([x, z, sc, y0, pink], i) => {
      mtx.makeScale(sc, sc, sc); mtx.setPosition(x, y0 + 1.8 * sc, z); trunks.setMatrixAt(i, mtx);
      q.setFromEuler(new THREE.Euler(0, rng.range(0, 6), 0));
      p.set(x, y0 + 4.6 * sc, z); s.set(2.5 * sc, 2.1 * sc, 2.5 * sc); mtx.compose(p, q, s);
      (pink ? pMain : gMain).setMatrixAt(i, mtx); (pink ? gMain : pMain).setMatrixAt(i, zero);
      p.set(x + 0.9 * sc, y0 + 5.8 * sc, z - 0.5 * sc); s.set(1.5 * sc, 1.3 * sc, 1.5 * sc); mtx.compose(p, q, s); gTop.setMatrixAt(i, mtx);
      col.box(x - 0.3, x + 0.3, y0, y0 + 3.2 * sc, z - 0.3, z + 0.3);
    });
    for (const im of [trunks, gMain, pMain, gTop]) { im.castShadow = true; im.receiveShadow = true; group.add(im); }
  }

  // ---- roofs (one merged mesh) -----------------------------------------------------------------------------
  { const m = new THREE.Mesh(mergeGeometries(roofGeos), M.roof); m.receiveShadow = true; group.add(m); }

  // ---- maglev line 7: elevated loop, four stations with lifts and platform screens -----------
  {
    const pts = roundedRectLoop(-198, 198, -198, 198, 12, 26, 8), path = new PathLine(pts, true);
    const segM = new THREE.InstancedMesh(unitBox, M.metal, pts.length), mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    pts.forEach((a, i) => {
      const b = pts[(i + 1) % pts.length], len = Math.hypot(b[0] - a[0], b[2] - a[2]);
      q.setFromAxisAngle(up, Math.atan2(b[0] - a[0], b[2] - a[2])); p.set((a[0] + b[0]) / 2, 11.4, (a[2] + b[2]) / 2); s.set(1.6, 0.7, len + 0.3);
      mtx.compose(p, q, s); segM.setMatrixAt(i, mtx);
    });
    segM.castShadow = true; group.add(segM);
    const pyl = [], o = {};
    for (let sI = 0; sI < path.total; sI += 32) { path.sample(sI, o); pyl.push([o.x, o.z]); }
    const pm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.55, 0.8, 11.2, 8), M.concrete, pyl.length);
    pyl.forEach(([x, z], i) => { mtx.makeTranslation(x, 5.6, z); pm.setMatrixAt(i, mtx); });
    pm.castShadow = true; group.add(pm);
    const names = ['Meridian North', 'Meridian East', 'Meridian South', 'Meridian West'], nc = { noCast: true };
    city.stations = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([sx, sz], k) => {
      const ns = sx === 0, cx = sx * 192, cz = sz * 192, hx = ns ? 14 : 4.2, hz = ns ? 4.2 : 14, Y = 11.6, g = M.glassDark, t = 0.15, h = 1.5;
      solid(cx - hx, cx + hx, Y - 0.8, Y, cz - hz, cz + hz, M.concrete);
      bx(hx * 2 + 2, 0.3, hz * 2 + 2, g, cx, Y + 4.6, cz, nc);
      for (const ax of [-1, 1]) for (const az of [-1, 1]) bx(0.3, 4.6, 0.3, M.metalDark, cx + ax * (hx - 0.4), Y + 2.3, cz + az * (hz - 0.4));
      // glass screens all round: nobody falls onto the track
      solid(cx - hx, cx + hx, Y, Y + h, cz - hz, cz - hz + t, g, nc); solid(cx - hx, cx + hx, Y, Y + h, cz + hz - t, cz + hz, g, nc);
      solid(cx - hx, cx - hx + t, Y, Y + h, cz - hz, cz + hz, g, nc); solid(cx + hx - t, cx + hx, Y, Y + h, cz - hz, cz + hz, g, nc);
      // lift shaft down to a forecourt inside the district
      const lx = sx * 186.6, lz = sz * 186.6;
      solid(lx - 1.1, lx + 1.1, 0, Y - 0.8, lz - 1.1, lz + 1.1, g, nc);
      for (const e of [-1.1, 1.1]) bx(0.12, Y - 0.8, 0.12, neon('#4de1ff', 1.2), lx + (ns ? e : 0), (Y - 0.8) / 2, lz + (ns ? 0 : e), nc);
      const fx = sx * 183.4, fz = sz * 183.4, fw = ns ? 5 : 2.2, fd = ns ? 2.2 : 5;
      bx(fw * 2, FY + 1, fd * 2, M.sidewalk, fx, (FY - 1) / 2, fz, nc); col.box(fx - fw, fx + fw, -1, FY, fz - fd, fz + fd, { noCam: true });
      holo(names[k].toUpperCase(), 9, 1.5, sx * 185.2, 6.4, sz * 185.2, Math.atan2(-sx, -sz), { color: '#9fefff', sub: 'maglev · line 7 · lift', steady: true });
      let st = 0, best = 1e9;
      for (let sI = 0; sI < path.total; sI += 2) { path.sample(sI, o); const d = Math.hypot(o.x - sx * 198, o.z - sz * 198); if (d < best) { best = d; st = sI; } }
      return { k, name: names[k], x: cx, y: Y, z: cz, s: st, bottom: { x: fx, y: FY, z: fz }, top: { x: sx * 190.4, y: Y, z: sz * 190.4 }, yaw: Math.atan2(sx, sz) };
    });
    cache(10, 11.6, 192);
    const cars = [];
    const body = std('#e9eef5', 0.3, 0.6), strip = neon('#7fe9ff', 1.3);
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Group();
      bx(3, 2.9, 13.4, body, 0, 1.7, 0, { parent: c }); bx(3.06, 0.9, 12, std('#0c1118', 0.1, 0.9), 0, 2.1, 0, { parent: c, noCast: true });
      bx(3.08, 0.12, 13.4, strip, 0, 0.6, 0, { parent: c, noCast: true });
      c.userData.wide = true; group.add(c); cars.push(c);
    }
    const train = { s: city.stations[2].s - 300, v: 30, dwell: 0, path, cars, at: -1, next: 2 };
    city.train = train;
    city.updates.push((dt) => {
      const T = path.total; let ahead = Infinity, nk = 0;
      for (const st of city.stations) { const a = (((st.s - train.s) % T) + T) % T; if (a < ahead) { ahead = a; nk = st.k; } }
      if (train.dwell > 0) { train.dwell -= dt; train.v = 0; if (train.dwell <= 0) { train.s += 3; train.at = -1; } }
      else {
        train.next = nk;
        const vmax = 34, lim = ahead < 260 ? Math.sqrt(2 * 2.4 * Math.max(0, ahead - 0.3)) : vmax;
        train.v = Math.min(train.v + 3 * dt, vmax, lim + 0.5);
        train.s += train.v * dt;
        if (ahead < 0.6) { train.dwell = 10; train.at = nk; train.s = city.stations[nk].s; }
      }
      cars.forEach((c, i) => { const yaw = path.sample(train.s + 21 - i * 14, c.position); c.position.y = 11.8; c.rotation.y = yaw; });
    });
  }

  // ---- per-frame visual updates -------------------------------------------------------------------------------
  city.update = (dt, t, night) => {
    blinkMat.color.setRGB((Math.sin(t * 3) > 0.2 ? 2.4 : 0.15), 0.05, 0.05);
    for (const h of city.holos) h.m.material.opacity = h.base * (0.82 + 0.18 * Math.sin(t * 2.3 + h.ph) + (Math.sin(t * 31 + h.ph * 7) > 0.985 ? -0.5 : 0));
    for (const s of city.spinners) { s.m.rotation.y += s.v * dt; if (s.bob) s.m.position.y = s.y + Math.sin(t * s.bob + s.ph) * s.amp; }
    for (const c of city.caches) if (!c.found) { c.m.rotation.y += dt * 1.5; c.m.position.y = c.y + 1.1 + Math.sin(t * 2 + c.id) * 0.15; }
    const k = 0.15 + night * 1.9;
    city.lamps.headMat.color.setRGB(k, k * 0.92, k * 0.78);
    city.lamps.poolMat.opacity = night * 0.5;
    for (const u of city.updates) u(dt, t, night);
  };

  // Doors slide open for anyone close by, during opening hours.
  city.pokeDoors = (x, y, z) => { for (const d of city.doors) if (Math.abs(y - d.y) < 3 && (x - d.x) ** 2 + (z - d.z) ** 2 < 12) d.want = true; };
  city.updateDoors = (dt, hour) => {
    for (const d of city.doors) {
      d.isOpenHours = !d.hours || (hour >= d.hours[0] && hour < d.hours[1]);
      d.open = damp(d.open, d.want && d.isOpenHours ? 1 : 0, 7, dt);
      d.want = false;
      const off = d.open * d.slide;
      if (d.axis === 'x') { d.panels[0].position.x = d.base[0] - off; d.panels[1].position.x = d.base[1] + off; }
      else { d.panels[0].position.z = d.base[0] - off; d.panels[1].position.z = d.base[1] + off; }
      d.collider.enabled = d.open < 0.55;
    }
  };
  // Static batching: the hundreds of small fixed boxes, trims and light strips are merged (see
  // batch.js), so the quarter costs a few dozen draw calls instead of a thousand. What is left
  // (signs, doors, stalls, pads) is sorted into cells that are hidden when the camera is far away.
  city.batch = () => {
    group.updateMatrixWorld(true);
    const list = [];
    for (const o of group.children) {
      if (!o.userData.batch) continue;
      if (o.isMesh) { if (!o.isInstancedMesh && !o.children.length && !Array.isArray(o.material) && !o.material.transparent) list.push(o); }
      else o.traverse((m) => { if (m.isMesh && !m.material.transparent) list.push(m); });
    }
    const made = mergeMeshes(group, list);
    for (const o of [...group.children]) if (o.isGroup && o.userData.batch && !o.children.length) group.remove(o);
    const cells = new Map(), box = new THREE.Box3(), c = new THREE.Vector3(), size = new THREE.Vector3();
    for (const o of [...group.children]) {
      if (o.isLight || o.isInstancedMesh || o.userData.wide) continue;
      box.setFromObject(o); if (box.isEmpty()) continue;
      box.getSize(size); if (Math.max(size.x, size.y, size.z) > 60) continue;      // big things stay visible from anywhere
      box.getCenter(c);
      // three size classes: small things (stall parts, door panels, labels, furnishings) go into 60 m cells that
      // are shown from about 130 m; mid-sized ones into 140 m cells shown from 300 m; the rest as far as the quarter is drawn
      const big = Math.max(size.x, size.y, size.z), S = big < 3.2 ? 60 : 140, r = big < 3.2 ? 130 : big < 20 ? 300 : 0;
      const key = `${S}|${r}|${Math.floor(c.x / S)}|${Math.floor(c.y / S)}|${Math.floor(c.z / S)}`;
      let cell = cells.get(key);
      if (!cell) { cell = new THREE.Group(); cell.userData.center = new THREE.Vector3((Math.floor(c.x / S) + 0.5) * S, (Math.floor(c.y / S) + 0.5) * S, (Math.floor(c.z / S) + 0.5) * S); cell.userData.r = r; cells.set(key, cell); }
      cell.add(o);
      // small props and anything under a roof do not need a place in the shadow map
      const pl = city.places, inB = (b) => b && c.x > b[0] && c.x < b[1] && c.z > b[2] && c.z < b[3] && c.y < 12;
      const indoor = inB(pl.restaurant && pl.restaurant.bounds) || inB(pl.shop && pl.shop.bounds);
      o.traverse((m) => {
        if (!m.isMesh || !m.castShadow) return;
        if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
        if (indoor || m.geometry.boundingSphere.radius * Math.max(m.scale.x, m.scale.y, m.scale.z) < 0.8) m.castShadow = false;
      });
    }
    city.cells = [...cells.values()];
    for (const cell of city.cells) group.add(cell);
    return { merged: list.length, made, cells: city.cells.length };
  };
  // Hide the small stuff in cells that are too far away to make out.
  // (from outside the quarter the small parts are dropped sooner: you are looking at it across a street grid)
  city.cull = (cam) => { const far = Math.abs(cam.x) < 200 && Math.abs(cam.z) < 200 ? 370 : 300; for (const cell of city.cells || []) { const r = cell.userData.r || far; cell.visible = cell.userData.center.distanceToSquared(cam) < r * r; } };
  return city;
}

// Meridian Commons: fountain, benches, stage, playground, kiosks, planters.
function buildPark(c) {
  const { THREE, group, col, city, bx, solid, cyl, flat, holo } = c;
  { // lawn (tiled grass) with paved paths laid on top
    // Soft, low-contrast grass: a few broad patches of lighter and darker green, then thin blades in close
    // shades, lightly blurred. (Bright and dark specks on a small tile used to read as speckled noise.)
    // The tile wraps, so patches and blades drawn over an edge are drawn again on the far side.
    const S = 512, cv = makeCanvas(S, S), g = cv.getContext('2d'), r = new RNG(9);
    const wrap = (fn) => { for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) fn(ox, oy); };
    g.fillStyle = '#2a5a44'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 26; i++) {   // broad patches: lighter and darker ground
      const x = r.next() * S, y = r.next() * S, rad = 40 + r.next() * 110, light = r.next() < 0.5;
      wrap((ox, oy) => { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad); gr.addColorStop(0, light ? 'rgba(78,128,84,0.30)' : 'rgba(24,60,44,0.30)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2); });
    }
    g.filter = 'blur(0.6px)'; g.lineCap = 'round';
    for (let i = 0; i < 9000; i++) {   // blades, short and thin, in shades close to the ground colour
      const x = r.next() * S, y = r.next() * S, h = 3 + r.next() * 6, lean = (r.next() - 0.5) * 3, v = r.next();
      g.strokeStyle = v < 0.45 ? 'rgba(62,118,78,0.45)' : v < 0.85 ? 'rgba(30,72,52,0.45)' : 'rgba(96,146,92,0.35)'; g.lineWidth = 1 + r.next() * 0.6;
      wrap((ox, oy) => { if (x + ox < -8 || x + ox > S + 8 || y + oy < -8 || y + oy > S + 8) return; g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + lean, y + oy - h); g.stroke(); });
    }
    g.filter = 'none';
    const tex = canvasTex(cv); tex.repeat.set(12, 12); tex.anisotropy = 8;
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(92, 92), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
    lawn.rotation.x = -Math.PI / 2; lawn.position.y = FY + 0.012; lawn.receiveShadow = true; group.add(lawn);
    const pave = std('#5f6877', 0.8, 0.1), geos = [];
    const strip = (ax, az, bx2, bz2, w = 3) => { const len = Math.hypot(bx2 - ax, bz2 - az), pg = new THREE.PlaneGeometry(w, len + w * 0.5); pg.rotateX(-Math.PI / 2); pg.rotateY(Math.atan2(bx2 - ax, bz2 - az)); pg.translate((ax + bx2) / 2, FY + 0.022, (az + bz2) / 2); geos.push(pg); };
    strip(0, -46, 0, 46); strip(-46, 0, 46, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { strip(sx * 46, sz * 46, sx * 24, sz * 24, 2.6); strip(sx * 24, sz * 24, sx * 20, 0, 2.4); strip(sx * 24, sz * 24, 0, sz * 20, 2.4); }
    const disc = new THREE.CircleGeometry(12.5, 40); disc.rotateX(-Math.PI / 2); disc.translate(0, FY + 0.024, 0); geos.push(disc);
    const floor = new THREE.PlaneGeometry(14, 10); floor.rotateX(-Math.PI / 2); floor.translate(-12, FY + 0.024, 26); geos.push(floor);
    const pm = new THREE.Mesh(mergeGeometries(geos), pave); pm.receiveShadow = true; group.add(pm);
  }
  // fountain with a slow-turning holographic globe
  cyl(5, 5.2, 0.6, M.white, 0, FY + 0.3, 0, 32); col.box(-4.3, 4.3, FY, FY + 0.75, -4.3, 4.3);
  flat(new THREE.CircleGeometry(4.6, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color('#2fd4ff').multiplyScalar(0.7), transparent: true, opacity: 0.6 }), 0, FY + 0.62, 0);
  const globe = new THREE.Mesh(new THREE.IcosahedronGeometry(3, 2), new THREE.MeshBasicMaterial({ color: new THREE.Color('#59e0ff').multiplyScalar(1.3), wireframe: true, transparent: true, opacity: 0.7 }));
  globe.position.set(0, 6.2, 0); group.add(globe); city.spinners.push({ m: globe, v: 0.25, y: 6.2, bob: 0.6, amp: 0.3, ph: 0 });
  const core = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 12), new THREE.MeshBasicMaterial({ color: 0x9ff3ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  core.position.set(0, 6.2, 0); group.add(core);
  // benches (two seats each) facing the fountain, trees behind them
  for (let k = 0; k < 8; k++) {
    const a = ((22.5 + 45 * k) * Math.PI) / 180, px = Math.cos(a) * 15, pz = Math.sin(a) * 15, yaw = Math.atan2(-px, -pz);
    const b = new THREE.Group(); b.position.set(px, FY, pz); b.rotation.y = yaw; b.userData.batch = true; group.add(b);
    bx(2.2, 0.1, 0.6, M.wood, 0, 0.46, 0, { parent: b }); bx(2.2, 0.55, 0.08, M.wood, 0, 0.8, -0.3, { parent: b });
    bx(0.1, 0.46, 0.5, M.metalDark, -0.95, 0.23, 0, { parent: b }); bx(0.1, 0.46, 0.5, M.metalDark, 0.95, 0.23, 0, { parent: b });
    bx(2.2, 0.03, 0.04, neon('#59e0ff', 1), 0, 0.41, 0.3, { parent: b, noCast: true });
    col.box(px - 0.75, px + 0.75, FY, FY + 0.5, pz - 0.75, pz + 0.75);
    const rx = -Math.cos(yaw), rz = Math.sin(yaw);
    for (const s of [-0.55, 0.55]) city.seats.push({ id: `bench${k}${s > 0 ? 'b' : 'a'}`, kind: 'bench', x: px + rx * s, y: FY + 0.5, z: pz + rz * s, yaw, taken: null, front: { x: px + Math.sin(yaw) * 1.2, z: pz + Math.cos(yaw) * 1.2 } });
    for (const [r, drop] of [[31, k === 2 || k === 1], [41, k === 2]]) if (!drop) city.treeSpots.push([Math.cos(a) * r, Math.sin(a) * r, 0.9 + ((k * 7 + r) % 5) * 0.06, FY, (k + r) % 3 === 0]);
  }
  // stage (holo-concerts at night)
  solid(-18, -6, FY, 0.65, 31.5, 36.5, M.metalDark);
  bx(12, 0.1, 0.15, neon('#ff7ad9', 1.4), -12, 0.66, 31.5, { noCast: true });
  for (const sx of [-18, -6]) bx(0.3, 6, 0.3, M.metalDark, sx, 3.6, 36.3);
  bx(12.3, 0.3, 0.3, M.metalDark, -12, 6.6, 36.3);
  const perf = new THREE.Group(); perf.position.set(-12, 0.65, 34.4); perf.visible = false; group.add(perf);
  const hm = (hex) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(1.2), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  const pBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1.6, 4, 10), hm('#ff7ad9')); pBody.position.y = 2.3; perf.add(pBody);
  const pHead = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), hm('#9ff3ff')); pHead.position.y = 4; perf.add(pHead);
  const pArmL = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 1.4, 4, 8), hm('#9ff3ff')), pArmR = pArmL.clone();
  pArmL.position.set(-0.9, 3, 0); pArmR.position.set(0.9, 3, 0); perf.add(pArmL, pArmR);
  const beams = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.ConeGeometry(1.6, 16, 12, 1, true); g.translate(0, -8, 0);
    const b = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff7ad9 : 0x59e0ff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    b.position.set(-16.5 + i * 3, 6.5, 36.2); b.visible = false; group.add(b); beams.push(b);
  }
  city.places.stage = { x: -12, z: 34, perf, beams, on: false };
  city.updates.push((dt, t) => {
    const s = city.places.stage; perf.visible = s.on; for (const b of beams) b.visible = s.on;
    if (!s.on) return;
    perf.rotation.y = Math.sin(t * 1.3) * 0.6; pBody.scale.y = 1 + Math.sin(t * 7.3) * 0.05; pHead.position.y = 4 + Math.abs(Math.sin(t * 3.65)) * 0.2;
    pArmL.rotation.z = -0.6 - Math.sin(t * 3.65) * 0.9; pArmR.rotation.z = 0.6 + Math.sin(t * 3.65 + 1) * 0.9;
    beams.forEach((b, i) => { b.rotation.x = Math.PI + 0.5 + Math.sin(t * 0.9 + i) * 0.35; b.rotation.z = Math.sin(t * 0.7 + i * 2) * 0.5; });
  });
  // holo playground
  flat(new THREE.CircleGeometry(5, 32), std('#27304a', 0.5, 0.3), 13, FY + 0.02, 30);
  flat(new THREE.RingGeometry(4.7, 5, 40), neon('#ffd34d', 1.2), 13, FY + 0.04, 30);
  ['#ff7ad9', '#59e0ff', '#7dff9c'].forEach((hex, i) => {
    const m = new THREE.Mesh(i === 1 ? new THREE.TorusGeometry(0.5, 0.16, 8, 16) : new THREE.IcosahedronGeometry(0.5, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(1.3), wireframe: i !== 1 }));
    m.position.set(13 + Math.cos(i * 2.1) * 2.6, 2.2, 30 + Math.sin(i * 2.1) * 2.6); group.add(m);
    city.spinners.push({ m, v: 0.8 + i * 0.4, y: 2.2, bob: 1.4, amp: 0.4, ph: i * 2 });
  });
  city.places.playground = { x: 13, z: 30 };
  // kiosks by the north gate
  solid(4.3, 5.7, FY, FY + 2.3, -40.5, -39.5, std('#20262f', 0.4, 0.7));
  holo('NUTRIMAT', 1.3, 0.5, 5, FY + 2.0, -39.47, 0, { color: '#7dff9c', size: 80, steady: true });
  bx(1.1, 1.1, 0.05, neon('#7dff9c', 0.7), 5, FY + 1.1, -39.48, { noCast: true });
  city.places.vending = { x: 5, y: FY, z: -38.6 };
  solid(-5.8, -4.2, FY, FY + 2.5, -40.3, -39.9, std('#20262f', 0.4, 0.7));
  holo('CIVICLINK', 1.5, 1.9, -5, FY + 1.45, -39.86, 0, { color: '#59e0ff', size: 70, sub: 'jobs · notices · transit', th: 256, tw: 256, steady: true });
  city.places.jobBoard = { x: -5, y: FY, z: -38.9 };
  // dumpling cart (handmade food, preserved the old way)
  solid(-41.1, -38.9, FY, FY + 1.1, -6.6, -5.4, M.wood);
  bx(2.6, 0.12, 1.8, std('#b3382f', 0.8, 0), -40, FY + 2.5, -6); for (const [ax, az] of [[-41.1, -6.7], [-38.9, -6.7], [-41.1, -5.3], [-38.9, -5.3]]) bx(0.08, 1.4, 0.08, M.metalDark, ax, FY + 1.8, az);
  for (const lx of [-41, -40, -39]) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), neon('#ffa64d', 1.8)); s.position.set(lx, FY + 2.25, -5.1); group.add(s); }
  holo('HAND-FOLDED DUMPLINGS', 2.4, 0.4, -40, FY + 2.85, -5.08, 0, { color: '#ffd9a0', size: 44, steady: true });
  const steam = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false }));
  steam.position.set(-40.4, FY + 1.5, -6); group.add(steam); city.spinners.push({ m: steam, v: 0.5, y: FY + 1.6, bob: 1.1, amp: 0.25, ph: 1 });
  city.places.cart = { x: -40, y: FY, z: -4.4, vendor: { x: -40, z: -7.3 } };
  // hydroponic planters tended by the gardener bot
  city.places.planters = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const px = sx * 32, pz = sz * 40;
    solid(px - 3, px + 3, FY, FY + 0.6, pz - 0.8, pz + 0.8, M.white);
    for (let i = -2; i <= 2; i++) { const p = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 6), M.leaf); p.position.set(px + i * 1.1, FY + 1, pz); p.castShadow = true; p.userData.batch = true; group.add(p); }
    bx(6, 0.06, 0.1, neon('#ff6ad5', 1.2), px, FY + 1.9, pz, { noCast: true }); for (const e of [-2.9, 2.9]) bx(0.06, 1.3, 0.06, M.metalDark, px + e, FY + 1.25, pz);
    city.places.planters.push({ x: px, z: pz - sz * 2 });
  }
  // evening market: three stalls by the east path (set up at 17:00, packed away at 21:30)
  const mk = (city.places.market = { stalls: [], open: false });
  [['PRINTED FRUIT', '#7dff9c'], ['NIGHT SKEWERS', '#ff9a52'], ['GLOW BLOOMS', '#ff7ad9']].forEach(([label, hex], k) => {
    const sx = 28 + k * 6, g = new THREE.Group(); group.add(g);
    bx(3, 0.9, 1.1, M.wood, sx, FY + 0.45, -5, { parent: g }); bx(3.4, 0.1, 2, std(hex, 0.8, 0), sx, FY + 2.6, -5, { parent: g });
    for (const [ax, az] of [[-1.5, -5.8], [1.5, -5.8], [-1.5, -4.2], [1.5, -4.2]]) bx(0.07, 2.6, 0.07, M.metalDark, sx + ax, FY + 1.3, az, { parent: g });
    for (let i = -1; i <= 1; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), neon(hex, 1.6)); m.position.set(sx + i * 0.8, FY + 1.05, -4.9); g.add(m); }
    holo(label, 2.8, 0.42, sx, FY + 2.95, -3.98, 0, { color: '#fff2d6', size: 46, steady: true, parent: g });
    const c = col.box(sx - 1.5, sx + 1.5, FY, FY + 0.95, -5.55, -4.45);
    g.visible = false; c.enabled = false;
    mk.stalls.push({ x: sx, z: -5, g, c, front: { x: sx, y: FY, z: -3.2 }, name: label });
  });
  solid(39.4, 40.6, FY, FY + 0.12, 5.4, 6.6, neon('#59e0ff', 0.6), { noCast: true }); // cleaner dock
  city.places.dock = { x: 40, z: 6 };
}
