// The north: a mountain range beyond the city's edge, with a valley down the middle closed by
// Northgate Dam, an arch of concrete 140 m high holding back a reservoir. Water spills over a
// spillway into a stream that runs down the valley toward the city. The terrain is solid (it is
// the ground height north of the grid), and lightly fogged so the peaks read from the city.
import * as THREE from 'three';
import { makeCanvas, canvasTex } from './materials.js';

const hash = (i, j) => { let h = (i * 374761393 + j * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function noise(x, z) { const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz), a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
function ridged(x, z) { let s = 0, amp = 1, f = 1, tot = 0; for (let o = 0; o < 5; o++) { const n = 1 - Math.abs(noise(x * f + o * 17.3, z * f) * 2 - 1); s += n * n * amp; tot += amp; amp *= 0.5; f *= 2.1; } return s / tot; }
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export const EDGE_N = -1640;                         // where the plain ends and the foothills begin
export const DAM = { z: -2300, R: 400, crest: 150, water: 140, floorUp: 138.5 };   // the arch bulges north; its centre is R south of the crest line
export const inReservoir = (x, z) => z < DAM.z - 6 && z > -3600 && Math.abs(x) < 900 && mountY(x, z) < DAM.water;
const floor = (z) => (z < DAM.z ? DAM.floorUp : Math.min(8, Math.max(0, (EDGE_N - z) / 660) * 8));
const halfW = (z) => (z < DAM.z ? 150 + Math.min(260, (DAM.z - z) * 0.35) : 120 + Math.min(110, (z - DAM.z) * 0.17));
export function mountY(x, z) {
  if (z > EDGE_N) return 0;
  const t = Math.min(1, (EDGE_N - z) / 900), ramp = t * t * (3 - 2 * t);
  const hills = ridged(x / 900, z / 900) * 1150 * ramp + ramp * 70;
  // the valley: a floor down the middle, its sides blending into the range
  const vx = 40 * Math.sin(z / 380), dx = Math.abs(x - vx), w = halfW(z), f = floor(z);
  return f + (Math.max(hills, f) - f) * sm(w * 0.55, w * 1.6, dx);
}

export function buildMountains(scene, col, city) {
  const group = new THREE.Group(); scene.add(group);
  // ---- the range: a height field, coloured by height and slope ----
  const X0 = -5200, X1 = 5200, Z0 = EDGE_N + 15, Z1 = -5600, DX = 80, DZ = 60, nx = Math.round((X1 - X0) / DX) + 1, nz = Math.round((Z0 - Z1) / DZ) + 1;
  const pos = new Float32Array(nx * nz * 3), colr = new Float32Array(nx * nz * 3), idx = [], c = new THREE.Color(), grass = new THREE.Color('#3d6b3f'), meadow = new THREE.Color('#5a7a45'), rock = new THREE.Color('#6b6660'), dark = new THREE.Color('#4a4642'), snow = new THREE.Color('#eef2f6');
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = X0 + i * DX, z = Z0 - j * DZ, y = mountY(x, z), k = (j * nx + i) * 3;
    pos[k] = x; pos[k + 1] = y + 0.02; pos[k + 2] = z;
    const slope = Math.abs(mountY(x + 20, z) - y) + Math.abs(mountY(x, z - 20) - y), sn = sm(620, 820, y + (hash(i, j) - 0.5) * 120);
    c.copy(y < 60 ? meadow : grass).lerp(slope > 14 ? dark : rock, sm(90, 420, y) * 0.9 + sm(10, 26, slope) * 0.3).lerp(snow, sn * (slope > 30 ? 0.4 : 1));
    colr[k] = c.r; colr[k + 1] = c.g; colr[k + 2] = c.b;
  }
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, d = a + nx, e = d + 1; idx.push(a, b, d, b, e, d); }   // wound so the faces look up
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(colr, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: true });
  // lighter fog on the range, so the peaks still show from the city
  mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <fog_fragment>', '#ifdef USE_FOG\n float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth * 0.16 );\n gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );\n#endif'); };
  const range = new THREE.Mesh(geo, mat); range.receiveShadow = true; range.matrixAutoUpdate = false; group.add(range);

  // ---- the reservoir ----
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1300), new THREE.MeshStandardMaterial({ color: '#2a6f86', roughness: 0.15, metalness: 0.4 }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, DAM.water, DAM.z - 650 - 4); group.add(water);

  // ---- the dam: an arch from flank to flank ----
  const D = [], Dc = [], Di = [], concrete = new THREE.Color('#b9b7b0'), stain = new THREE.Color('#9a988f');
  const N = 48, A = 0.42, cz = DAM.z + DAM.R;   // arch centre (south of the crest)
  const P = (a, r, y) => [Math.sin(a) * r, y, cz - Math.cos(a) * r];
  const quad = (p, q, r, s, col) => { const i0 = D.length / 3; for (const v of [p, q, r, s]) D.push(...v); for (let k = 0; k < 4; k++) Dc.push(col.r, col.g, col.b); Di.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3); };
  for (let k = 0; k < N; k++) {
    const a0 = -A + (2 * A * k) / N, a1 = -A + (2 * A * (k + 1)) / N, x0 = Math.sin(a0) * DAM.R, x1 = Math.sin(a1) * DAM.R, base = Math.max(0, Math.min(floor(DAM.z + 20), Math.min(mountY(x0, DAM.z + 10), mountY(x1, DAM.z + 10))) - 6), top = DAM.crest;
    const up0 = P(a0, DAM.R, top), up1 = P(a1, DAM.R, top), ub0 = P(a0, DAM.R, base), ub1 = P(a1, DAM.R, base);                 // the upstream face (north)
    const dt0 = P(a0, DAM.R - 9, top), dt1 = P(a1, DAM.R - 9, top), db0 = P(a0, DAM.R - 28, base), db1 = P(a1, DAM.R - 28, base);   // the downstream face, sloping out at the foot
    quad(ub0, ub1, up1, up0, concrete); quad(db1, db0, dt0, dt1, k % 4 === 0 ? stain : concrete); quad(up0, up1, dt1, dt0, new THREE.Color('#8d9199'));
    // solid for walking and flying: a box per segment from the foot to the crest
    const mx = (x0 + x1) / 2, mz = cz - Math.cos((a0 + a1) / 2) * (DAM.R - 4.5);
    col.box(mx - 5.5, mx + 5.5, base, top, mz - 5, mz + 5);
  }
  { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(D, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(Dc, 3)); g.setIndex(Di); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05, side: THREE.DoubleSide })); m.castShadow = true; m.receiveShadow = true; group.add(m); }
  // parapets, lamps and a viewing platform with a landing pad on the crest; a cache to find up there
  const parts = [], add = (w, h, d, x, y, z, ry, hex) => { const g = new THREE.BoxGeometry(w, h, d); g.rotateY(ry); g.translate(x, y, z); const n = g.attributes.position.count, cc = new Float32Array(n * 3), q = new THREE.Color(hex); for (let k = 0; k < n; k++) { cc[k * 3] = q.r; cc[k * 3 + 1] = q.g; cc[k * 3 + 2] = q.b; } g.setAttribute('color', new THREE.BufferAttribute(cc, 3)); parts.push(g.toNonIndexed()); };
  for (let k = 0; k < N; k++) {
    const am = -A + (2 * A * (k + 0.5)) / N, ry = -am;
    for (const r of [DAM.R - 0.3, DAM.R - 8.7]) { const [x, , z] = P(am, r, 0); add((2 * A * DAM.R) / N + 0.1, 1.1, 0.35, x, DAM.crest + 0.55, z, ry, '#d7dde6'); col.box(x - 3, x + 3, DAM.crest, DAM.crest + 1.1, z - 0.3, z + 0.3, { noCam: true }); }
    if (k % 4 === 0) { const [x, , z] = P(am, DAM.R - 8.4, 0); add(0.15, 6, 0.15, x, DAM.crest + 3, z, ry, '#2b303a'); add(0.6, 0.15, 1.6, x, DAM.crest + 6, z + 0.6, ry, '#fff0d2'); }
  }
  const vp = { x: 0, y: DAM.crest, z: DAM.z + 18 };
  add(24, 1, 16, vp.x, DAM.crest - 0.5, vp.z, 0, '#8d9199'); col.box(vp.x - 12, vp.x + 12, DAM.crest - 1, DAM.crest, vp.z - 8, vp.z + 8);
  for (const [w, d, x, z] of [[24, 0.3, 0, vp.z + 8], [0.3, 16, -12, vp.z], [0.3, 16, 12, vp.z]]) { add(w, 1.1, d, vp.x + x, DAM.crest + 0.55, z, 0, '#d7dde6'); col.box(vp.x + x - w / 2, vp.x + x + w / 2, DAM.crest, DAM.crest + 1.1, z - d / 2 - 0.1, z + d / 2 + 0.1, { noCam: true }); }
  { const g = mergeColored(parts); const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.2 })); m.castShadow = true; group.add(m); }
  const padR = 6.5, pad = { id: 'damPad', name: 'Northgate Dam', x: vp.x + 4, y: DAM.crest + 0.05, z: vp.z + 1.5, r: padR, charger: false, priv: false, taxi: true };
  { const g = new THREE.CircleGeometry(padR, 32); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#1a1f29', roughness: 0.6 })); m.position.set(pad.x, pad.y, pad.z); group.add(m);
    const r = new THREE.RingGeometry(padR - 0.45, padR, 40); r.rotateX(-Math.PI / 2); const rm = new THREE.Mesh(r, new THREE.MeshBasicMaterial({ color: new THREE.Color('#4de1ff').multiplyScalar(1.3) })); rm.position.set(pad.x, pad.y + 0.02, pad.z); group.add(rm); }
  city.pads.push(pad);

  // ---- the spillway: a sheet of water down the face, mist at the foot, a stream down the valley ----
  const sc = makeCanvas(64, 256), sg = sc.getContext('2d'); sg.fillStyle = '#6fb6c9'; sg.fillRect(0, 0, 64, 256); for (let k = 0; k < 140; k++) { sg.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.6})`; sg.fillRect(Math.random() * 64, Math.random() * 256, 1 + Math.random() * 3, 10 + Math.random() * 50); }
  const stex = canvasTex(sc); stex.repeat.set(2, 3);
  const sx = -70, sa = Math.asin(sx / DAM.R), [fx0, , fz0] = P(sa, DAM.R - 9, 0), footY = Math.max(0, floor(DAM.z + 20) - 2), [fx1, , fz1] = P(sa, DAM.R - 28, 0);
  const sheetGeo = new THREE.BufferGeometry(), hw = 11, tx = Math.cos(sa), tz = Math.sin(sa);
  sheetGeo.setAttribute('position', new THREE.Float32BufferAttribute([fx0 - tx * hw, DAM.crest + 0.4, fz0 - tz * hw, fx0 + tx * hw, DAM.crest + 0.4, fz0 + tz * hw, fx1 + tx * hw, footY, fz1 + tz * hw + 0.6, fx1 - tx * hw, footY, fz1 - tz * hw + 0.6], 3));
  sheetGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2)); sheetGeo.setIndex([0, 2, 1, 0, 3, 2]); sheetGeo.computeVertexNormals();
  const sheet = new THREE.Mesh(sheetGeo, new THREE.MeshBasicMaterial({ map: stex, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })); group.add(sheet);
  const mist = new THREE.Mesh(new THREE.SphereGeometry(14, 16, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false })); mist.position.set(fx1, footY + 4, fz1 + 8); mist.scale.set(1.3, 0.6, 1); group.add(mist);
  // the stream: a ribbon on the valley floor from the dam's foot to the plain
  const sp = [], si = []; let n = 0;
  for (let z = fz1 + 6; z < EDGE_N + 60; z += 20) { const vx = 40 * Math.sin(z / 380) + (sx - 40 * Math.sin(fz1 / 380)) * Math.max(0, 1 - (z - fz1) / 250), y = mountY(vx, z) + 0.25, w = 6 + (z - fz1) * 0.01; sp.push(vx - w, y, z, vx + w, y, z); if (n) si.push((n - 1) * 2, n * 2, (n - 1) * 2 + 1, (n - 1) * 2 + 1, n * 2, n * 2 + 1); n++; }
  const stg = new THREE.BufferGeometry(); stg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); stg.setIndex(si); stg.computeVertexNormals();
  group.add(new THREE.Mesh(stg, new THREE.MeshStandardMaterial({ color: '#2f8aa0', roughness: 0.2, metalness: 0.35, side: THREE.DoubleSide })));
  return {
    group, pad, viewpoint: vp,
    update(dt, t) { stex.offset.y = -t * 0.9; mist.scale.y = 0.6 + Math.sin(t * 1.3) * 0.05; },
  };
}
function mergeColored(list) {
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const p = new Float32Array(n * 3), no = new Float32Array(n * 3), co = new Float32Array(n * 3); let o = 0;
  for (const g of list) { g.computeVertexNormals(); p.set(g.attributes.position.array, o * 3); no.set(g.attributes.normal.array, o * 3); co.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; g.dispose(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('normal', new THREE.BufferAttribute(no, 3)); g.setAttribute('color', new THREE.BufferAttribute(co, 3)); return g;
}
