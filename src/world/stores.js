// Enterable shops. room() builds a walk-in room (walls with a real doorway and a shop window,
// floor, ceiling, light panels) through either construction kit: the district kit, or cityKit()
// for Meridian. Each room is recorded in city.stores so the shop system can light it and staff it.
import { M, std, neon } from './materials.js';

export const lit = (hex, k = 0.3) => std(hex, 0.85, 0, { emissive: hex, emissiveIntensity: k });   // surfaces that read as lit indoors, day or night
const DARK = '#2b303a';

// Adapter: lets room() and the furniture below build straight into Meridian (absolute coordinates).
export const cityKit = (c) => ({
  city: c.city,
  solid: (mat, x0, x1, y0, y1, z0, z1, extra) => { c.col.box(x0, x1, y0, y1, z0, z1, extra); if (mat) c.bx(x1 - x0, y1 - y0, z1 - z0, mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, { noCast: mat.transparent }); },
  box: (mat, w, h, d, x, y, z) => c.bx(w, h, d, mat, x, y, z, { noCast: true }),
  flat: (mat, w, d, x, y, z) => c.bx(w, 0.03, d, mat, x, y, z, { noCast: true }),
  cyl: (mat, rt, rb, h, x, y, z, seg = 12) => c.cyl(rt, rb, h, mat, x, y, z, seg, { noCast: true }),
  seat: (id, x, y, z, yaw) => c.city.seats.push({ id, kind: 'chair', x, y: y + 0.5, z, yaw, taken: null, table: null, service: null }),
  abs: (x, y, z) => ({ x, y, z }),
});

// o: { id, name, x0, x1, z0, z1, y, h, door: 'N'|'S'|'W'|'E' (north is -z), at, dw, dh, wall, floor, front, t, staffed }
export function room(S, o) {
  const { x0, x1, z0, z1, y = 0, h = 3.8, door = 'N', dw = 2.2, dh = 2.7, t = 0.3 } = o;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, alongX = door === 'N' || door === 'S', at = o.at ?? (alongX ? cx : cz);
  const wall = o.wallMat || lit(o.wall || '#3a3f4a'), floor = lit(o.floor || '#8f8a80', 0.22);
  const seg = (side, a0, a1, y0, y1, mat) => {
    if (a1 - a0 < 0.05 || y1 - y0 < 0.05) return;
    if (side === 'N') S.solid(mat, a0, a1, y + y0, y + y1, z0, z0 + t); else if (side === 'S') S.solid(mat, a0, a1, y + y0, y + y1, z1 - t, z1);
    else if (side === 'W') S.solid(mat, x0, x0 + t, y + y0, y + y1, a0, a1); else S.solid(mat, x1 - t, x1, y + y0, y + y1, a0, a1);
  };
  for (const side of ['N', 'S', 'W', 'E']) {
    const ax = side === 'N' || side === 'S', lo = ax ? x0 : z0, hi = ax ? x1 : z1;
    if (side !== door) { seg(side, lo, hi, 0, h, wall); continue; }
    const d0 = at - dw / 2, d1 = at + dw / 2, sill = 0.7, head = Math.min(h - 0.5, 2.7);
    for (const [p0, p1] of [[lo, d0], [d1, hi]]) {
      if (o.front === false || p1 - p0 < 1.2) { seg(side, p0, p1, 0, h, wall); continue; }
      seg(side, p0, p1, 0, sill, wall); seg(side, p0, p1, head, h, wall); seg(side, p0, p0 + 0.3, sill, head, wall); seg(side, p1 - 0.3, p1, sill, head, wall);
      seg(side, p0 + 0.3, p1 - 0.3, sill, head, M.glass);                                   // the shop window
    }
    seg(side, d0, d1, dh, h, wall);                                                         // lintel over the doorway
  }
  S.flat(floor, x1 - x0 - 2 * t, z1 - z0 - 2 * t, cx, y + 0.03, cz);
  S.solid(o.roofMat || M.roof, x0, x1, y + h, y + h + 0.25, z0, z1);
  const nx = Math.max(1, Math.round((x1 - x0) / 7)), nz = Math.max(1, Math.round((z1 - z0) / 7));
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) S.box(neon(o.lamp || '#fff1d6', 1.25), 2.2, 0.05, 0.45, x0 + ((i + 0.5) * (x1 - x0)) / nx, y + h - 0.03, z0 + ((j + 0.5) * (z1 - z0)) / nz);
  const out = { N: [at, z0 - 1.4], S: [at, z1 + 1.4], W: [x0 - 1.4, at], E: [x1 + 1.4, at] }[door];
  const st = { id: o.id, name: o.name, kind: o.kind || o.id, staffed: !!o.staffed, lamp: o.lamp || '#fff1d6', h,
    lo: S.abs(x0, y, z0), hi: S.abs(x1, y + h, z1), center: S.abs(cx, y + h - 0.5, cz), doorOut: S.abs(out[0], y, out[1]) };
  // in a district: a node outside the door and one inside, so locals can drop in (linked to the walkways once they exist)
  if (S.node) {
    const ins = { N: [at, z0 + 3], S: [at, z1 - 3], W: [x0 + 3, at], E: [x1 - 3, at] }[door];
    st.nav = { zone: S.site.id, door: S.node('shopdoor:' + o.id, out[0], out[1], { quiet: true }), inside: S.node('shopin:' + o.id, ins[0], ins[1], { quiet: true }), x: S.cx + out[0], z: S.cz + out[1] };
    S.link('shopdoor:' + o.id, 'shopin:' + o.id);
  }
  S.city.stores.push(st);
  return st;
}

export function counter(S, x0, x1, z0, z1, y = 0, top = '#d9c9a8') {
  S.solid(lit(DARK, 0.2), x0, x1, y, y + 1.0, z0, z1); S.box(lit(top), x1 - x0 + 0.12, 0.06, z1 - z0 + 0.12, (x0 + x1) / 2, y + 1.03, (z0 + z1) / 2);
}
// A shelf unit along one axis with rows of goods on the side that faces the room (face = +1 or -1).
export function shelf(S, x0, x1, z0, z1, y, colors, face, hgt = 2.1) {
  S.solid(lit('#262a33', 0.2), x0, x1, y, y + hgt, z0, z1);
  const alongX = x1 - x0 > z1 - z0, len = alongX ? x1 - x0 : z1 - z0, n = Math.floor(len / 0.42);
  for (let r = 0; r < 3; r++) for (let i = 0; i < n; i++) {
    const a = (alongX ? x0 : z0) + 0.25 + i * 0.42, hy = y + 0.45 + r * 0.62, col = lit(colors[(i * 7 + r * 3) % colors.length], 0.35), s = 0.2 + ((i * 13 + r * 5) % 4) * 0.035;
    if (alongX) S.box(col, 0.3, s + 0.12, 0.08, a, hy, face > 0 ? z1 + 0.04 : z0 - 0.04); else S.box(col, 0.08, s + 0.12, 0.3, face > 0 ? x1 + 0.04 : x0 - 0.04, hy, a);
  }
}
// low display table with a few objects on it
export function display(S, x, z, y, w, d, colors) {
  S.solid(lit('#3a3f4a', 0.2), x - w / 2, x + w / 2, y, y + 0.85, z - d / 2, z + d / 2);
  for (let i = 0; i < 4; i++) S.box(lit(colors[i % colors.length], 0.35), 0.34, 0.2 + (i % 2) * 0.14, 0.34, x - w / 2 + 0.4 + (i * (w - 0.8)) / 3, y + 0.98 + (i % 2) * 0.07, z);
}
function stool(S, id, x, y, z, yaw) { S.cyl(lit('#c9b68f'), 0.2, 0.17, 0.46, x, y + 0.23, z, 10); S.seat(id, x, y - 0.04, z, yaw); }

// Meridian's Old Quarter: five small shops in the brick row south of the park, each with a doorway
// on the street side (north). Returns nothing; the rooms are recorded in city.stores.
const OLD = {
  'ANALOG RECORDS': { id: 'records', wall: '#40303f', floor: '#3a2f33', goods: ['#e2543d', '#f2c14e', '#59b8d9', '#e9e3d5', '#7a5cd6'], lamp: '#ffd9c0' },
  'BAO & BROTH': { id: 'bao', wall: '#3d5a50', floor: '#d7d2c4', goods: ['#f1ede6', '#c9a063', '#b3382f'], lamp: '#fff1d6' },
  'TEA HOUSE': { id: 'tea', wall: '#5e4b2c', floor: '#7a5a3a', goods: ['#2f6b55', '#c9b68f', '#8a4f2e', '#f1ede6'], lamp: '#ffe0b0' },
  'REPAIR CAFE': { id: 'repair', wall: '#2e3a52', floor: '#5c6068', goods: ['#8a94a6', '#ffb347', '#59e0ff', '#d7dbe2'], lamp: '#e8f4ff' },
  'PAPER BOOKS': { id: 'books', wall: '#4a3a5a', floor: '#6b5236', goods: ['#b23a48', '#2c3e63', '#c9a063', '#2f6b55', '#d7dbe2', '#4a3f6e'], lamp: '#ffe9cf' },
};
export function oldQuarterShop(c, x0, x1, name, FY) {
  const S = cityKit(c), d = OLD[name], z0 = 77, z1 = 95, cx = (x0 + x1) / 2;
  const st = room(S, { id: d.id, name: name.replace(/\b(\w)(\w*)/g, (m, a, b) => a + b.toLowerCase()), x0, x1, z0, z1, y: FY, h: 4, door: 'N', wall: d.wall, floor: d.floor, lamp: d.lamp });
  counter(S, cx - 2.6, cx + 2.6, 90.6, 91.4, FY);
  st.counter = { x: cx, y: FY, z: 89.9 }; st.keeper = { x: cx, y: FY, z: 92.2, yaw: Math.PI };
  shelf(S, x0 + 0.3, x0 + 0.8, 80, 89.5, FY, d.goods, +1); shelf(S, x1 - 0.8, x1 - 0.3, 80, 89.5, FY, d.goods, -1);
  shelf(S, x0 + 1.5, cx - 3.2, 94.2, 94.7, FY, d.goods, -1); shelf(S, cx + 3.2, x1 - 1.5, 94.2, 94.7, FY, d.goods, -1);
  if (d.id === 'bao' || d.id === 'tea') {                                   // somewhere to sit and eat
    for (const sx of [-1, 1]) { const tx = cx + sx * 3.4; S.cyl(lit('#e9e3d5'), 0.55, 0.55, 0.06, tx, FY + 0.74, 83.5, 16); S.cyl(lit(DARK, 0.2), 0.07, 0.2, 0.72, tx, FY + 0.36, 83.5, 8); c.col.box(tx - 0.4, tx + 0.4, FY, FY + 0.76, 83.1, 83.9);
      stool(S, `${d.id}s${sx}a`, tx - 1, FY, 83.5, Math.PI / 2); stool(S, `${d.id}s${sx}b`, tx + 1, FY, 83.5, -Math.PI / 2); }
  } else display(S, cx, 84.5, FY, 4.2, 1.3, d.goods);
  if (d.id === 'repair') { S.solid(lit('#4a505c', 0.2), x0 + 2, x0 + 6, FY, FY + 0.95, 85.5, 87); S.box(neon('#59e0ff', 1.2), 0.9, 0.05, 0.24, x0 + 4, FY + 1.02, 86.2); }
  return st;
}
