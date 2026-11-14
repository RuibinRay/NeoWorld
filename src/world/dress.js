// Architectural detail for towers: a plinth and lit lobby line at street level, belts and
// vertical fins up the faces, and a roof with a parapet, plant room, units and sometimes a
// garden or a mast. All of it is plain boxes handed to the caller's box(), so it is merged with
// the rest of the static city and costs no extra draw calls.
import { M, std, neon } from './materials.js';
import { RNG } from '../core/util.js';

const LOBBY = ['#ffd9a0', '#bfe9ff', '#ffe9cf'];
// box(mat, w, h, d, x, y, z) · o: { neon } accent color
export function dressTower(box, x0, x1, z0, z1, y0, y1, o = {}) {
  const w = x1 - x0, d = z1 - z0, h = y1 - y0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  if (h < 16 || w < 9 || d < 9) return;
  const r = new RNG((Math.round(x0 * 7 + z0 * 13 + y0 * 3 + w * 31) >>> 0) + 5), dark = M.metalDark, trim = std('#2a3140', 0.5, 0.6), acc = neon(o.neon || '#9fe9ff', 0.9);
  // street level: a plinth, and a warm line of light above the lobby
  if (y0 < 1) { box(trim, w + 0.7, 1.0, d + 0.7, cx, y0 + 0.5, cz); const l = neon(r.pick(LOBBY), 0.9); for (const s of [-1, 1]) { box(l, w + 0.3, 0.22, 0.12, cx, y0 + 5.4, cz + s * (d / 2 + 0.08)); box(l, 0.12, 0.22, d + 0.3, cx + s * (w / 2 + 0.08), y0 + 5.4, cz); } }
  // belts: a dark band every few dozen floors, with a thin accent line on some
  for (let y = y0 + r.range(34, 52); y < y1 - 14; y += r.range(38, 62)) { box(dark, w + 0.6, 1.1, d + 0.6, cx, y, cz); if (r.chance(0.5)) { box(acc, w + 0.7, 0.14, 0.1, cx, y + 0.7, cz + d / 2 + 0.36); box(acc, w + 0.7, 0.14, 0.1, cx, y + 0.7, cz - d / 2 - 0.36); } }
  // fins: slim vertical ribs that give tall faces some depth
  if (h > 60 && r.chance(0.8)) {
    const nx = Math.max(2, Math.round(w / 11)), nz = Math.max(2, Math.round(d / 11)), fh = h * 0.94, fy = y0 + h * 0.5;
    for (let i = 1; i < nx; i++) for (const s of [-1, 1]) box(trim, 0.4, fh, 0.55, x0 + (i * w) / nx, fy, cz + s * (d / 2 + 0.22));
    for (let i = 1; i < nz; i++) for (const s of [-1, 1]) box(trim, 0.55, fh, 0.4, cx + s * (w / 2 + 0.22), fy, z0 + (i * d) / nz);
  }
  // roof: parapet, plant room, a few units, then either a garden or a mast with a dish
  const ry = y1 + 0.03;
  for (const s of [-1, 1]) { box(trim, w, 0.9, 0.35, cx, ry + 0.45, cz + s * (d / 2 - 0.18)); box(trim, 0.35, 0.9, d, cx + s * (w / 2 - 0.18), ry + 0.45, cz); }
  if (w * d > 260) {
    const pw = w * r.range(0.25, 0.4), pd = d * r.range(0.22, 0.36), px = cx + r.range(-0.2, 0.2) * w, pz = cz + r.range(-0.2, 0.2) * d;
    box(trim, pw, 3.4, pd, px, ry + 1.7, pz); box(dark, pw + 0.3, 0.25, pd + 0.3, px, ry + 3.5, pz);
    for (let i = 0; i < 4; i++) box(std('#8a94a6', 0.5, 0.5), 1.6, 1.1, 1.6, cx + r.range(-0.38, 0.38) * w, ry + 0.55, cz + r.range(-0.38, 0.38) * d);
    if (r.chance(0.4)) { for (let i = 0; i < 5; i++) { const gx = cx + r.range(-0.4, 0.4) * w, gz = cz + r.range(-0.4, 0.4) * d; box(M.trunk, 0.3, 1.6, 0.3, gx, ry + 0.8, gz); box(M.leaf, 2.2, 1.8, 2.2, gx, ry + 2.3, gz); } box(std('#3a5a3f', 0.95, 0), w * 0.8, 0.12, d * 0.8, cx, ry + 0.06, cz); }
    else if (r.chance(0.5)) { box(dark, 0.3, 9, 0.3, px, ry + 8, pz); box(acc, 0.5, 0.5, 0.5, px, ry + 12.6, pz); box(std('#d7dbe2', 0.4, 0.4), 2.2, 2.2, 0.3, px + pw * 0.3, ry + 4.8, pz); }
  }
}
