// Streets between the blocks: which segments exist, where the junctions and their signals are,
// and the close-up marks (lane lines, parking bays, crosswalks, stop lines, canal railings).
// Each block owns the street on its east side, the street on its south side and the junction
// at its south-east corner, so every piece of street is drawn exactly once.
import * as THREE from 'three';
import { P, useAt, streetBetween } from './landuse.js';
import { draw } from './furniture.js';
import { plateUV } from './buildings.js';

const LINE = new THREE.Color('#b9d9ff').multiplyScalar(0.8), WHITE = new THREE.Color('#dfe6f0').multiplyScalar(0.75);
// Street segments that a highway runs along (it takes their place): filled by crossings.js at start.
export const ABSORBED = new Set();
// The street along the east side of block (i, j): 'street', 'canal', 'meridian' (Meridian's own roads), 'highway' (a highway runs along it) or null.
export function eSeg(i, j) { if (i === -1 && j >= 6 && j <= 9) return 'canal'; if (ABSORBED.has('v' + i + ':' + j)) return 'highway'; const a = useAt(i, j), b = useAt(i + 1, j); if (a === 'meridian' || b === 'meridian') return 'meridian'; return streetBetween(a, b) ? 'street' : null; }
// The street along the south side of block (i, j).
export function sSeg(i, j) { if (j === 5 && i >= 0 && i <= 3) return 'canal'; if (ABSORBED.has('h' + i + ':' + j)) return 'highway'; const a = useAt(i, j), b = useAt(i, j + 1); if (a === 'meridian' || b === 'meridian') return 'meridian'; return streetBetween(a, b) ? 'street' : null; }
// The junction at the south-east corner of block (i, j): which arms are streets, and whether it has signals.
const memo = new Map();
export function corner(i, j) {
  const key = i * 100 + j; let c = memo.get(key);
  if (!c) {
    const n = eSeg(i, j) === 'street', s = eSeg(i, j + 1) === 'street', w = sSeg(i, j) === 'street', e = sSeg(i + 1, j) === 'street';
    const water = [eSeg(i, j), eSeg(i, j + 1), sSeg(i, j), sSeg(i + 1, j)].includes('canal');
    const near = [useAt(i, j), useAt(i + 1, j), useAt(i, j + 1), useAt(i + 1, j + 1)];
    const arms = n + s + w + e;
    c = { x: i * P + 60, z: j * P + 60, n, s, w, e, arms, water, signal: arms >= 3 && !water && !near.includes('meridian') && !near.includes('suburb') && (n || s) && (w || e) };
    memo.set(key, c);
  }
  return c;
}
// Signals: a 24 s cycle, offset per junction. Returns 0 green, 1 amber, 2 red for each axis.
// A junction that a highway runs through has a third phase for the highway (39 s in all, with two seconds of all-red between phases).
export function signalState(i, j, t) {
  const c = memo.get(i * 100 + j);
  if (c && c.hw) { const ph = (((t + ((i * 5 + j * 7) % 39 + 39)) % 39) + 39) % 39; return { ns: ph < 9 ? 0 : ph < 11 ? 1 : 2, ew: ph >= 13 && ph < 22 ? 0 : ph >= 22 && ph < 24 ? 1 : 2, hw: ph >= 26 && ph < 35 ? 0 : ph >= 35 && ph < 37 ? 1 : 2 }; }
  const ph = (((t + ((i * 5 + j * 7) % 24 + 24)) % 24) + 24) % 24;
  return { ns: ph < 10 ? 0 : ph < 12 ? 1 : 2, ew: ph < 12 ? 2 : ph < 22 ? 0 : 1 };
}
// Did a vehicle moving from (ax, az) to (bx, bz) just drive into a signalled junction on red?
export function ranRed(ax, az, bx, bz, t) {
  const X = Math.round((bx - 60) / P) * P + 60, Z = Math.round((bz - 60) / P) * P + 60, inB = (x, z) => Math.abs(x - X) < 10.5 && Math.abs(z - Z) < 10.5;
  if (!inB(bx, bz) || inB(ax, az)) return false;
  const i = (X - 60) / P, j = (Z - 60) / P; if (!corner(i, j).signal) return false;
  return signalState(i, j, t)[Math.abs(bx - ax) > Math.abs(bz - az) ? 'ew' : 'ns'] === 2;
}
// The two signal poles of a junction: [x, z, yaw of the mast arm].
export const signalPoles = (c) => c.poles || [[c.x - 10.9, c.z + 10.9, Math.PI / 2], [c.x + 10.9, c.z - 10.9, -Math.PI / 2]];

// Marks for the streets owned by block b. yAt(x, z) gives the pavement height for a pole. sigs collects the lamps.
export function drawStreets(B, b, yAt, sigs, open) {
  const { i, j, cx, cz } = b, X = cx + 60, Z = cz + 60, y = 0.015;
  const es = eSeg(i, j), ss = sSeg(i, j);
  if (es === 'street') {
    for (let t = -46; t <= 46; t += 8) B.quad('G', LINE, 0.28, 3.2, X, y, cz + t);
    for (const s of [-1, 1]) B.quad('S', '#5a6270', 0.12, 100, X + s * 7.2, y, cz);
    if ((i * 3 + j) % 4 === 0) B.cyl('S', '#0f1217', 0.45, 0.45, 0.02, X + 3.2, 0.012, cz + 17, 10);
  }
  if (ss === 'street') {
    for (let t = -46; t <= 46; t += 8) B.quad('G', LINE, 3.2, 0.28, cx + t, y, Z);
    for (const s of [-1, 1]) B.quad('S', '#5a6270', 100, 0.12, cx, y, Z + s * 7.2);
    if ((i + j * 3) % 4 === 0) B.cyl('S', '#0f1217', 0.45, 0.45, 0.02, cx - 21, 0.012, Z - 3.2, 10);
  }
  for (const [ax, az, bx, bz] of canalRails(b)) { const y0 = yAt((ax + bx) / 2 + (ax === bx ? Math.sign(ax - X) * 2 : 0), (az + bz) / 2 + (az === bz ? Math.sign(az - Z) * 2 : 0)); for (const [x, z, alongX] of railPieces(ax, az, bx, bz, open)) {
    B.box('S', '#aeb6c2', alongX ? 4 : 0.07, 0.07, alongX ? 0.07 : 4, x, y0 + 1.02, z); B.box('S', '#6a7280', alongX ? 4 : 0.05, 0.05, alongX ? 0.05 : 4, x, y0 + 0.55, z);
    B.box('S', '#39404c', 0.09, 1.05, 0.09, alongX ? x - 2 : x, y0 + 0.52, alongX ? z : z - 2);
  } }
  const c = corner(i, j);
  if (c.arms < 2 || c.water) return;
  // crosswalks and stop lines on every arm
  const zebra = (ax, az, alongX) => { for (let t = -8.4; t <= 8.4; t += 1.4) B.quad('G', WHITE, alongX ? 0.7 : 3, alongX ? 3 : 0.7, X + (alongX ? t : ax), y, Z + (alongX ? az : t)); };
  if (c.n) { zebra(0, -12.5, true); B.quad('G', WHITE, 9, 0.4, X - 5, y, Z - 15.2); }
  if (c.s) { zebra(0, 12.5, true); B.quad('G', WHITE, 9, 0.4, X + 5, y, Z + 15.2); }
  if (c.w) { zebra(-12.5, 0, false); B.quad('G', WHITE, 0.4, 9, X - 15.2, y, Z + 5); }
  if (c.e) { zebra(12.5, 0, false); B.quad('G', WHITE, 0.4, 9, X + 15.2, y, Z - 5); }
  if (c.signal) for (const [px, pz, a] of signalPoles(c)) {
    const py = yAt(px, pz); draw.signal(B, px, py, pz, a);
    const ua = plateUV(true, i), us = plateUV(false, j);                                // name plates: the avenue's runs along z, the street's along x
    for (const s of [1, -1]) { B.sign(...ua, 1.7, 0.4, px + s * 0.02, py + 4.45, pz, s * Math.PI / 2); B.sign(...us, 1.7, 0.4, px, py + 4.0, pz + s * 0.02, s > 0 ? 0 : Math.PI); }
    const ax = Math.sin(a), az = Math.cos(a), fx = az, fz = -ax;                       // arm direction, and the way the arm head faces
    for (let k = 0; k < 3; k++) {
      sigs.push({ i, j, axis: 'ns', k, x: px + ax * 4.2 + fx * 0.22, y: py + 5.6 - k * 0.4, z: pz + az * 4.2 + fz * 0.22 });
      sigs.push({ i, j, axis: 'ew', k, x: px + ax * 0.22, y: py + 3.6 - k * 0.4, z: pz + az * 0.22 });
    }
  }
}
// The railings along the canal banks that block b owns: [ax, az, bx, bz] each.
export function canalRails(b) {
  const { i, j, cx, cz } = b, X = cx + 60, Z = cz + 60, out = [];
  if (eSeg(i, j) === 'canal') out.push([X - 10, cz - 60, X - 10, cz + 60], [X + 10, cz - 60, X + 10, cz + 60]);
  if (sSeg(i, j) === 'canal') out.push([cx - 60, Z - 10, cx + 60, Z - 10], [cx - 60, Z + 10, cx + 60, Z + 10]);
  if (i === -1 && j === 5) out.push([X - 10, Z - 10, X, Z - 10], [X - 10, Z - 10, X - 10, Z]);   // the outside of the bend
  return out;
}
// A railing in 4 m pieces: [x, z, alongX] for every piece that is not over water, a bridge or a highway.
export function railPieces(ax, az, bx, bz, open) {
  const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 4)), alongX = Math.abs(bx - ax) > Math.abs(bz - az), out = [];
  for (let k = 0; k < n; k++) { const t = (k + 0.5) / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t; if (!open(x, z)) out.push([x, z, alongX]); }
  return out;
}
