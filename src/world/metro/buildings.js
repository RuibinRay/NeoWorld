// Close-up detail for the buildings of a block: shopfronts, awnings, signs, roofs, terraces,
// house roofs and gardens. The building bodies themselves are in the always-visible shells
// (shells.js); this is only what you can make out from the street.
import * as THREE from 'three';
import { RNG } from '../../core/util.js';
import { makeCanvas, canvasTex } from '../materials.js';
import { dressTower } from '../dress.js';

const SHOPS = ['NOODLE BAR', 'KAFE 88', 'VOLT MART', 'PIXEL PRINT', 'ORBIT GYM', 'LUMA OPTICS', 'TEA & BYTE', 'GREENGROCER', 'DRONE DEPOT', 'HOLO NAILS', 'BAO HOUSE', 'SYNTH RECORDS', 'CLINIC', 'PHARMA+', 'BOOK NOOK', 'CYCLE LAB', 'RAMEN YA', 'CHARGE & GO', 'PET POD', 'TAILOR', 'BAKERY', 'FLORIST', 'ARCADE', 'LAUNDRY'];
const SIGN_COL = ['#ff7ad9', '#59e0ff', '#ffd34d', '#7dff9c', '#ff9a5a', '#c9a8ff'];
const AWN = ['#a8343f', '#2f6f8f', '#2f8f5a', '#c98a2e', '#5b4a8f', '#d9dde4'];
const ROOF = ['#8a4a3a', '#4a5260', '#6a4438', '#3a4450'];
const WIN = '#8d7c5e';   // shop windows: dark glass by day, a warm glow at night

// One sheet with every shop name, so all signs in the city share a single material.
let sheet = null;
export function signMaterial() {
  if (sheet) return sheet;
  const c = makeCanvas(1024, 1536), g = c.getContext('2d');
  g.fillStyle = '#0b0e14'; g.fillRect(0, 0, 1024, 1536); g.textAlign = 'center'; g.textBaseline = 'middle';
  SHOPS.forEach((t, n) => { const x = (n % 4) * 256, y = Math.floor(n / 4) * 128, col = SIGN_COL[n % 6]; g.strokeStyle = col; g.lineWidth = 4; g.strokeRect(x + 8, y + 10, 240, 108); g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 14; g.font = '700 38px system-ui, sans-serif'; g.fillText(t, x + 128, y + 66, 216); g.shadowBlur = 0; });
  // street-name plates: 28 avenues (north-south) then 24 lettered streets (east-west)
  for (let n = 0; n < 52; n++) { const x = (n % 4) * 256, y = 768 + Math.floor(n / 4) * 59; g.fillStyle = n < 28 ? '#123a5c' : '#1d4a3a'; g.fillRect(x + 3, y + 3, 250, 53); g.fillStyle = '#eaf4ff'; g.font = '700 34px system-ui, sans-serif'; g.fillText(n < 28 ? `AVENUE ${n + 1}` : `${String.fromCharCode(65 + n - 28)} STREET`, x + 128, y + 31, 236); }
  sheet = new THREE.MeshBasicMaterial({ map: canvasTex(c, false) });
  return sheet;
}
const shopIndex = (name) => Math.max(0, SHOPS.indexOf(name));
// uv rectangle of a street-name plate: avenue i (the street east of block column i) or lettered street j
export function plateUV(avenue, n) { const k = avenue ? Math.max(0, Math.min(27, n + 14)) : 28 + Math.max(0, Math.min(23, n + 14)), y = 768 + Math.floor(k / 4) * 59; return [(k % 4) / 4, 1 - (y + 59) / 1536, (k % 4) / 4 + 0.25, 1 - y / 1536]; }
export const streetName = (avenue, n) => (avenue ? `Avenue ${Math.max(0, Math.min(27, n + 14)) + 1}` : `${String.fromCharCode(65 + Math.max(0, Math.min(23, n + 14)))} Street`);

export function dressBuilding(B, b, blk) {
  const r = new RNG(b.seed), [x0, x1, z0, z1, y0, y1] = b.boxes[0], w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, kind = b.kind;
  const dress = (mat, bw, bh, bd, px, py, pz) => B.box(mat.isMeshBasicMaterial ? 'G' : 'S', mat.color, bw, bh, bd, px, py, pz);
  if (kind === 'house') return house(B, b, blk, r);
  if (kind === 'shed') return shed(B, b, r);
  if (kind === 'hub') return hub(B, b, r);
  if (kind === 'site') return site(B, b, r);
  if (kind === 'villa') return villa(B, b, blk, r);
  if (kind === 'school') { const [a0, a1, c0, c1, , b1] = b.boxes[0]; for (const s of [-1, 1]) { B.box('S', '#2a3140', a1 - a0, 0.6, 0.3, (a0 + a1) / 2, b1 + 0.3, (c0 + c1) / 2 + s * ((c1 - c0) / 2 - 0.15)); B.box('S', '#2a3140', 0.3, 0.6, c1 - c0, (a0 + a1) / 2 + s * ((a1 - a0) / 2 - 0.15), b1 + 0.3, (c0 + c1) / 2); } B.box('S', '#7a3f35', 2.4, 2.6, 0.1, (a0 + a1) / 2 - 6, b.boxes[0][4] + 1.3, c1 + 0.06); return; }
  // ---- street level: windows, fascia, awnings, a sign over the door, on the sides that face a street ----
  const sides = [[0, -1, z0, blk.cz - 44, 'n'], [0, 1, z1, blk.cz + 44, 's'], [-1, 0, x0, blk.cx - 44, 'w'], [1, 0, x1, blk.cx + 44, 'e']];
  let signs = 0;
  for (const [nx, nz, edge, rim, key] of sides) {
    if (Math.abs(edge - rim) > 7) continue;                         // faces an alley, not the street
    const len = nx ? d : w, along = nx ? cz : cx, yaw = Math.atan2(nx, nz), px = (t, out) => (nx ? edge + nx * out : along + t), pz = (t, out) => (nz ? edge + nz * out : along + t);
    const bw = (l) => (nx ? 0.1 : l), bd = (l) => (nx ? l : 0.1);
    B.box('S', '#161c26', bw(len - 1), 3.3, bd(len - 1), px(0, 0.06), y0 + 1.85, pz(0, 0.06));                                  // glazing band
    const n = Math.max(2, Math.round(len / 9)), pw = (len - 3) / n;
    for (let k = 0; k < n; k++) { const t = -len / 2 + 1.5 + pw * (k + 0.5); if (k === (n >> 1)) { B.box('S', '#0d1016', bw(2.2), 2.6, bd(2.2), px(t, 0.1), y0 + 1.3, pz(t, 0.1)); continue; } B.box('L', WIN, bw(pw - 0.9), 2.1, bd(pw - 0.9), px(t, 0.13), y0 + 1.75, pz(t, 0.13)); B.box('S', '#0d1016', bw(0.14), 2.1, bd(0.14), px(t, 0.17), y0 + 1.75, pz(t, 0.17)); }
    B.box('G', b.acc, bw(len - 0.6), 0.2, bd(len - 0.6), px(0, 0.12), y0 + 3.75, pz(0, 0.12));                                   // fascia light
    if (blk.streets[key] && r.chance(0.55)) { const al = len * r.range(0.3, 0.6), t = r.range(-0.15, 0.15) * len; B.box('S', r.pick(AWN), nx ? 1.5 : al, 0.1, nx ? al : 1.5, px(t, 0.85), y0 + 3.25, pz(t, 0.85)); }
    if (blk.streets[key] && signs < 2 && len > 14) { const n2 = shopIndex(b.shop) + signs * 5, i = n2 % 24, t = (n >> 1) * pw + 1.5 + pw / 2 - len / 2, u = (i % 4) / 4, v = 1 - Math.floor(i / 4) / 12; B.sign(u, v - 1 / 12, u + 0.25, v, 4.4, 1.1, px(t, 0.2), y0 + 4.5, pz(t, 0.2), yaw); signs++; }
  }
  // ---- every volume: belts, fins and roof plant on tall ones; a parapet and units on low ones ----
  for (const [a0, a1, c0, c1, b0, b1] of b.boxes) {
    const bw = a1 - a0, bd = c1 - c0, mx = (a0 + a1) / 2, mz = (c0 + c1) / 2;
    if (b1 - b0 >= 16 && bw >= 9 && bd >= 9) dressTower(dress, a0, a1, c0, c1, b0, b1 + 0.03, { neon: b.acc });
    else {
      for (const s of [-1, 1]) { B.box('S', '#2a3140', bw, 0.6, 0.3, mx, b1 + 0.3, mz + s * (bd / 2 - 0.15)); B.box('S', '#2a3140', 0.3, 0.6, bd, mx + s * (bw / 2 - 0.15), b1 + 0.3, mz); }
      for (let k = 0; k < 3; k++) B.box('S', '#8a94a6', 1.5, 1, 1.5, mx + r.range(-0.35, 0.35) * bw, b1 + 0.5, mz + r.range(-0.35, 0.35) * bd);
      if (kind === 'row' && r.chance(0.35)) { const ry = r.chance(0.5) ? 0 : Math.PI / 2; B.box('S', '#1c2028', 0.2, 2.2, 0.2, mx - 2.6 * Math.cos(ry), b1 + 1.1, mz + 2.6 * Math.sin(ry)); B.box('S', '#1c2028', 0.2, 2.2, 0.2, mx + 2.6 * Math.cos(ry), b1 + 1.1, mz - 2.6 * Math.sin(ry)); B.box('G', r.pick(SIGN_COL), 7, 2.6, 0.15, mx, b1 + 3.4, mz, ry); }
    }
  }
  const top = b.boxes[b.boxes.length - 1];
  if (kind === 'tower' || kind === 'twin') { const [a0, a1, c0, c1, , b1] = top, mx = (a0 + a1) / 2, mz = (c0 + c1) / 2; for (const s of [-1, 1]) { B.box('G', b.acc, a1 - a0 + 0.5, 0.35, 0.2, mx, b1 - 0.6, mz + s * ((c1 - c0) / 2 + 0.12)); B.box('G', b.acc, 0.2, 0.35, c1 - c0 + 0.5, mx + s * ((a1 - a0) / 2 + 0.12), b1 - 0.6, mz); } }
  if (kind === 'twin' && b.boxes.length > 2) { const A = b.boxes[1], C = b.boxes[2], y = A[4] + (C[5] - A[4]) * 0.6; if (w >= d) B.box('B', '#3a4656', C[0] - A[1], 3, 6, (A[1] + C[0]) / 2, y, cz); else B.box('B', '#3a4656', 6, 3, C[2] - A[3], cx, y, (A[3] + C[2]) / 2); }
  if (kind === 'step') for (let k = 1; k < b.boxes.length; k++) { const [a0, a1, c0, c1, b0] = b.boxes[k], o = b.boxes[k - 1], mx = (a0 + a1) / 2, mz = (c0 + c1) / 2, ow = o[1] - o[0], od = o[3] - o[2]; for (const s of [-1, 1]) { B.box('S', '#2f7a4c', ow - 2, 0.7, 1.1, mx, b0 + 0.38, mz + s * (od / 2 - 1.1)); B.box('S', '#2f7a4c', 1.1, 0.7, od - 4, mx + s * (ow / 2 - 1.1), b0 + 0.38, mz); } }
  if (kind === 'civic') {                                           // steps, a row of columns on the street side, a lit drum
    const s = cz > blk.cz ? 1 : -1, fz = s > 0 ? z1 : z0;
    for (let k = 0; k < 3; k++) B.box('S', '#b9b2a2', w * 0.6 - k * 1.2, 0.3, 1.2, cx, y0 + 0.15 + k * 0.3, fz + s * (3.2 - k * 1.1));
    for (let t = -w * 0.28; t <= w * 0.281; t += w * 0.08) B.cyl('B', '#e2dccd', 0.5, 0.56, 10.5, cx + t, y0 + 6.2, fz + s * 1.4, 10);
    B.box('B', '#cfc8b8', w * 0.66, 1.4, 3.6, cx, y0 + 12, fz + s * 1.0); B.gable('B', '#b9b2a2', w * 0.66, 3.8, 2.4, cx, y0 + 12.7, fz + s * 1.0);
    const t = b.boxes[1]; B.cyl('G', b.acc, 0.3, 0.3, 5, (t[0] + t[1]) / 2, t[5] + 2.5, (t[2] + t[3]) / 2, 6); B.box('L', '#ffe2b0', (t[1] - t[0]) + 0.2, 1.2, (t[3] - t[2]) + 0.2, (t[0] + t[1]) / 2, t[5] - 2.2, (t[2] + t[3]) / 2);
  }
  if (kind === 'mall') {                                            // a lit atrium on the roof and a big sign over each street door
    const t = b.boxes[1], tw = t[1] - t[0], td = t[3] - t[2], mx = (t[0] + t[1]) / 2, mz = (t[2] + t[3]) / 2;
    B.box('L', '#bfe4ff', tw * 0.8, 0.25, td * 0.8, mx, t[5] + 0.16, mz);
    for (const s of [-1, 1]) { B.box('G', b.acc, w * 0.34, 2.2, 0.25, cx, y0 + 10.5, cz + s * (d / 2 + 0.2)); B.box('S', '#0d1016', w * 0.36, 2.6, 0.2, cx, y0 + 10.5, cz + s * (d / 2 + 0.08)); }
  }
  if (kind === 'hotel') { const s = cz > blk.cz ? 1 : -1; B.box('B', '#d9dde4', 12, 0.3, 5, cx, y0 + 4.2, cz + s * (d / 2 + 2.2)); for (const e of [-5, 5]) B.cyl('S', '#aeb6c2', 0.16, 0.16, 4.2, cx + e, y0 + 2.1, cz + s * (d / 2 + 4.2), 8); const t = b.boxes[b.boxes.length - 1]; B.box('G', b.acc, 0.3, (t[5] - t[4]) * 0.5, 1.6, t[1] + 0.1, t[4] + (t[5] - t[4]) * 0.6, (t[2] + t[3]) / 2); }
}

function house(B, b, blk, r) {
  const [x0, x1, z0, z1, y0, y1] = b.boxes[0], w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, front = cz > blk.cz ? 1 : -1, roof = r.pick(ROOF);
  B.gable('B', roof, w + 0.8, d + 0.8, 2.6, cx, y1, cz);                                                         // pitched roof, ridge along x
  B.box('S', '#6a4a3a', 0.9, 2.2, 0.9, cx + w * 0.28, y1 + 1.7, cz - front * d * 0.15);                           // chimney
  const fz = cz + front * (d / 2 + 0.05);
  B.box('S', r.pick(['#7a3f35', '#2f4f6f', '#3f6f4f', '#e6e0d0']), 1.1, 2.1, 0.08, cx - w * 0.2, y0 + 1.05, fz);  // door
  for (const [ox, oy] of [[0.18, 1.5], [-0.2, 4.4], [0.2, 4.4]]) B.box('L', WIN, 1.5, 1.2, 0.06, cx + w * ox * 1.2, y0 + oy, fz);
  B.box('L', WIN, 0.06, 1.2, 1.5, cx + (w / 2 + 0.05), y0 + 4.4, cz); B.box('L', WIN, 0.06, 1.2, 1.5, cx - (w / 2 + 0.05), y0 + 1.5, cz);
  B.box('S', '#c9c2b2', 1.4, 0.04, 6, cx - w * 0.2, y0 + 0.03, fz + front * 3.1);                                 // path to the pavement
  B.box('B', '#cfd4dc', 5, 2.8, 5.6, cx + w / 2 + 2.9, y0 + 1.4, cz + front * 1.2); B.box('S', '#3a4250', 3.6, 2.1, 0.08, cx + w / 2 + 2.9, y0 + 1.05, cz + front * 4.05);   // garage
  // hedge round the plot
  const gx0 = cx - w / 2 - 3.5, gx1 = cx + w / 2 + 6.5, gz = cz - front * (d / 2 + 6);
  B.box('S', '#2c6a44', gx1 - gx0, 1, 0.7, (gx0 + gx1) / 2, y0 + 0.5, gz); B.box('S', '#2c6a44', 0.7, 1, d + 9, gx0, y0 + 0.5, cz - front * 1.5); B.box('S', '#2c6a44', 0.7, 1, d + 9, gx1, y0 + 0.5, cz - front * 1.5);
}
// charging hub: a wide canopy on four columns over a row of charge posts, with a lit edge
function hub(B, b, r) {
  const L = b.L, w = L.x1 - L.x0, d = L.z1 - L.z0, cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2, y0 = b.boxes[0][4];
  B.box('B', '#dfe5ee', w * 0.92, 0.5, d * 0.92, cx, y0 + 6.2, cz);
  for (const s of [-1, 1]) { B.box('G', b.acc, w * 0.92, 0.18, 0.12, cx, y0 + 5.95, cz + s * d * 0.46); B.box('G', b.acc, 0.12, 0.18, d * 0.92, cx + s * w * 0.46, y0 + 5.95, cz); B.box('L', '#fff0d2', w * 0.6, 0.06, 0.5, cx, y0 + 5.92, cz + s * d * 0.22); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.cyl('B', '#8a94a6', 0.3, 0.34, 6, cx + sx * w * 0.42, y0 + 3, cz + sz * d * 0.42, 8);
  for (let k = -2; k <= 2; k++) for (const s of [-1, 1]) { const px = cx + k * w * 0.13, pz = cz + s * d * 0.3; B.box('S', '#232832', 0.4, 1.5, 0.4, px, y0 + 0.75, pz); B.box('G', '#7dff9c', 0.42, 0.3, 0.42, px, y0 + 1.3, pz); B.quad('S', '#5a6270', 0.1, 6, px + w * 0.065, y0 + 0.02, pz); }
  const k = b.boxes[0]; B.box('G', '#59e0ff', k[1] - k[0] + 0.1, 0.5, k[3] - k[2] + 0.1, (k[0] + k[1]) / 2, y0 + 3.6, (k[2] + k[3]) / 2);
}
// construction site: bare frame above the finished floors, hoarding, a tower crane
function site(B, b, r) {
  const [x0, x1, z0, z1, y0, y1] = b.boxes[0], w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, L = b.L;
  for (let f = 0; f < 3; f++) { const y = y1 + 1.7 + f * 3.6; B.box('S', '#8a94a6', w, 0.3, d, cx, y + 1.8, cz); for (const sx of [-1, -0.33, 0.33, 1]) for (const sz of [-1, 1]) B.box('S', '#6a7280', 0.4, 3.6, 0.4, cx + sx * (w / 2 - 0.3), y, cz + sz * (d / 2 - 0.3)); }
  for (const s of [-1, 1]) { B.box('S', '#c98a2e', L.x1 - L.x0, 2.2, 0.12, (L.x0 + L.x1) / 2, y0 + 1.1, s > 0 ? L.z1 : L.z0); B.box('S', '#c98a2e', 0.12, 2.2, L.z1 - L.z0, s > 0 ? L.x1 : L.x0, y0 + 1.1, (L.z0 + L.z1) / 2); }
  const mx = L.x0 + 2, mz = L.z0 + 2, top = y1 + 22;
  B.box('B', '#d9a52e', 1.6, top - y0, 1.6, mx, (y0 + top) / 2, mz); B.box('B', '#d9a52e', 34, 1.2, 1.2, mx + 11, top, mz); B.box('S', '#39404c', 4, 2.4, 2, mx - 5, top - 0.6, mz); B.box('S', '#1c2028', 0.12, 9, 0.12, mx + 22, top - 5, mz); B.box('S', '#8a94a6', 2.4, 0.5, 2.4, mx + 22, top - 9.6, mz);
  B.box('G', '#ff3b30', 0.5, 0.5, 0.5, mx, top + 1, mz);
}
// beach villa: white volumes, a roof terrace with a rail, a pool on the sea side
function villa(B, b, blk, r) {
  const [x0, x1, z0, z1, y0, y1] = b.boxes[0], w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, L = b.L;
  for (const s of [-1, 1]) { B.box('S', '#aeb6c2', w, 0.08, 0.08, cx, y1 + 1, cz + s * (d / 2 - 0.1)); B.box('S', '#aeb6c2', 0.08, 0.08, d, cx + s * (w / 2 - 0.1), y1 + 1, cz); }
  B.box('L', '#ffe2b0', w * 0.5, 2.4, 0.08, cx, y0 + 1.8, z1 + 0.06); B.box('S', '#2a7f9f', w * 0.5, 0.06, 5, cx, y0 + 0.05, z1 + 5.5); B.box('S', '#e9edf2', w * 0.5 + 1, 0.3, 6, cx, y0 - 0.1, z1 + 5.5);
  for (const sx of [-1, 1]) { B.box('S', '#e9edf2', 1.9, 0.3, 0.7, cx + sx * (w * 0.25 + 2), y0 + 0.3, z1 + 5.5); B.cyl('S', '#8a6a48', 0.05, 0.05, 2.2, cx + sx * (w * 0.25 + 2), y0 + 1.1, z1 + 4.4, 6); B.cyl('S', sx > 0 ? '#c0483f' : '#2f6f8f', 1.3, 0.1, 0.4, cx + sx * (w * 0.25 + 2), y0 + 2.3, z1 + 4.4, 8); }
  B.box('S', '#2c6a44', L.x1 - L.x0, 0.9, 0.6, (L.x0 + L.x1) / 2, y0 + 0.45, L.z0 + 0.3);
}
function shed(B, b, r) {
  const [x0, x1, z0, z1, y0, y1] = b.boxes[0], w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, lx = w >= d;
  B.gable('B', '#4a5260', (lx ? w : d) + 0.6, (lx ? d : w) + 0.6, 3, cx, y1, cz, !lx);
  for (const s of [-1, 1]) {                                                                                       // roller doors with a hazard stripe over them
    const px = lx ? cx + s * w * 0.25 : x1 + 0.06, pz = lx ? z1 + 0.06 : cz + s * d * 0.25;
    B.box('S', '#2a303b', lx ? 9 : 0.1, 6, lx ? 0.1 : 9, px, y0 + 3, pz); B.box('G', '#ffb347', lx ? 9.4 : 0.1, 0.3, lx ? 0.1 : 9.4, px, y0 + 6.3, pz);
  }
}
