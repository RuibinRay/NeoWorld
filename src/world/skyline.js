// The Skyline Run: a block of low rooftops just south-east of Meridian (block 2, 2) built for
// parkour. Planks, gaps, a ledge to pull up onto, two ladders, stepping pillars and a zip line,
// with eleven rings to run through in order. The run itself is in systems/parkour.js.
import { FY } from './metro/layout.js';
import { drawLadder } from '../systems/climb.js';

// [x0, x1, z0, z1, height, wall] in the block's own coordinates (centre 0, 0)
const ROOFS = [
  [-43, -27, -43, -29, 8, '#6d5a4d'],     // A: the start, ladder on the north face
  [-15, -1, -43, -29, 8, '#59606b'],      // B: across the plank
  [2, 14, -43, -31, 6.4, '#7a6656'],      // C: a drop across a gap
  [14, 26, -43, -29, 8.4, '#4f5866'],     // D: pull up onto it from C
  [16, 28, -26, -12, 8.4, '#6b5f58'],     // E: across a running jump
  [16, 30, -12, 4, 15, '#535c69'],        // F: up the second ladder
  [-2, 8, -9, 3, 15, '#76675a'],          // G: across the high plank
  [-4, 10, 14.6, 30, 18.2, '#4b5562'],    // H: the top, where the zip line starts
  [-43, -27, 14, 42, 6, '#6e6152'],       // I: the finish, a ladder down the west face
];
const PILLARS = [[3, 5.6, 15.8], [3, 8.8, 16.6], [3, 12.0, 17.4]];
// ring centres (x, height above the pavement, z)
const RINGS = [[-30, 9.2, -36], [-21, 9.2, -36], [0.5, 8.6, -36], [20, 9.6, -36], [22, 9.6, -27.5], [23, 16.2, -8], [12, 16.2, -4], [3, 17.8, 8.8], [3, 19.4, 24], [-16.5, 13.15, 25], [-38, 7.2, 34]];

export function layoutSkyline(ctx) {
  const { GB, col, block } = ctx, b = block(2, 2), cx = b.cx, cz = b.cz, Y = FY;
  // clear the block's own buildings, trees and props (the pavement edge keeps its lamps and the bus stop)
  const inside = (x, z) => Math.abs(x - cx) < 44.5 && Math.abs(z - cz) < 44.5;
  b.bld = []; b.trees = b.trees.filter(([x, z]) => !inside(x, z)); b.props = b.props.filter((p) => !inside(p[1], p[2])); b.solids = b.solids.filter((s) => !inside((s[0] + s[1]) / 2, (s[4] + s[5]) / 2));
  const solid = (k, hex, x0, x1, y0, y1, z0, z1, extra) => { GB.box(k, hex, x1 - x0, y1 - y0, z1 - z0, cx + (x0 + x1) / 2, (y0 + y1) / 2, cz + (z0 + z1) / 2); col.box(cx + x0, cx + x1, y0, y1, cz + z0, cz + z1, extra); };
  const NEON = ['#59e0ff', '#ff7ad9', '#ffd34d', '#7dff9c'];
  ROOFS.forEach(([x0, x1, z0, z1, h, wall], n) => {
    const top = Y + h, w = x1 - x0, d = z1 - z0;
    solid('B', wall, x0, x1, Y, top, z0, z1);
    GB.box('S', '#2f343d', w + 0.3, 0.3, d + 0.3, cx + (x0 + x1) / 2, top - 0.14, cz + (z0 + z1) / 2);                       // the roof edge
    GB.box('S', '#3c424c', w - 0.6, 0.02, d - 0.6, cx + (x0 + x1) / 2, top + 0.01, cz + (z0 + z1) / 2);                        // the roof membrane
    const glow = NEON[n % 4];                                                                                                     // a neon strip under the edge, so the line reads at night
    for (const [ex, ez, ew, ed] of [[(x0 + x1) / 2, z0 - 0.17, w, 0.06], [(x0 + x1) / 2, z1 + 0.17, w, 0.06], [x0 - 0.17, (z0 + z1) / 2, 0.06, d], [x1 + 0.17, (z0 + z1) / 2, 0.06, d]]) GB.box('G', glow, ew, 0.12, ed, cx + ex, top - 0.4, cz + ez);
    // windows: lit at night, one row per floor
    for (let fy = Y + 2.2; fy < top - 1.5; fy += 3.3) {
      // about half the windows lit, in a few warm and cool tones; the rest dark glass
      const win = (x, z, w, d) => { const hsh = Math.abs(Math.sin(x * 12.99 + z * 78.23 + fy * 3.1)) * 1000 % 1, lit = hsh < 0.5; GB.box(lit ? 'L' : 'S', lit ? ['#8a6a48', '#9a7a52', '#5f7f96', '#7a6a8a'][Math.floor(hsh * 8)] : '#1d232c', w, 1.5, d, x, fy, z); };
      for (let x = x0 + 1.6; x < x1 - 1; x += 2.6) for (const z of [z0 - 0.04, z1 + 0.04]) win(cx + x, cz + z, 1.3, 0.06);
      for (let z = z0 + 1.6; z < z1 - 1; z += 2.6) for (const x of [x0 - 0.04, x1 + 0.04]) win(cx + x, cz + z, 0.06, 1.3);
    }
  });
  // planks: A to B (8 m up) and F to G (15 m up)
  solid('S', '#8a6a48', -27, -15, Y + 7.85, Y + 8, -36.3, -35.7); for (const x of [-27.2, -14.8]) GB.box('S', '#5a4632', 0.5, 0.2, 1, cx + x, Y + 7.9, cz - 36);
  solid('S', '#8a6a48', 8, 16, Y + 14.85, Y + 15, -4.3, -3.7);
  // stepping pillars from G up to H
  for (const [x, z, h] of PILLARS) { solid('B', '#59606b', x - 0.7, x + 0.7, Y, Y + h, z - 0.7, z + 0.7); GB.box('G', '#ffd34d', 1.5, 0.08, 1.5, cx + x, Y + h - 0.2, cz + z); }
  // roof clutter: air handlers, a water tank, vents, an antenna (kept off the line you run)
  for (const [x, z, w, d, h] of [[-40, -31.5, 2.2, 1.6, 1.4], [-6, -41, 1.8, 1.4, 1.2], [24, -41, 1.6, 2.4, 1.3], [27, 0, 2, 2, 1.6], [7, 27, 1.6, 1.6, 1.2], [-41, 40, 2, 1.6, 1.4]]) {
    const y0 = Y + ROOFS.find((r) => x > r[0] && x < r[1] && z > r[2] && z < r[3])[4];
    solid('S', '#9aa3ae', x - w / 2, x + w / 2, y0, y0 + h, z - d / 2, z + d / 2); GB.box('S', '#3a414c', w * 0.7, 0.08, d * 0.7, cx + x, y0 + h + 0.04, cz + z);
  }
  { const x = -12, z = -32, y0 = Y + 8; for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) GB.box('S', '#3a414c', 0.15, 1.6, 0.15, cx + x + lx, y0 + 0.8, cz + z + lz); GB.cyl('S', '#7a6a5a', 1.4, 1.4, 2.4, cx + x, y0 + 2.8, cz + z, 12); col.box(cx + x - 1.4, cx + x + 1.4, y0, y0 + 4, cz + z - 1.4, cz + z + 1.4); }
  GB.box('S', '#aeb6c2', 0.12, 9, 0.12, cx + 8, Y + 22.7, cz + 16); GB.box('G', '#ff3030', 0.3, 0.3, 0.3, cx + 8, Y + 27.3, cz + 16);
  // graffiti panels on the street faces
  for (const [x, z, hex, yaw] of [[-35, -43.05, '#ff7ad9', 0], [8, -43.05, '#59e0ff', 0], [-43.05, 28, '#ffd34d', Math.PI / 2], [30.05, -4, '#7dff9c', Math.PI / 2]]) GB.box('S', hex, 5, 2.2, 0.04, cx + x, Y + 3.2, cz + z, yaw);
  // a practice yard in the open corner: walls of every height you can vault or pull yourself onto
  for (const [x0, x1, z0, z1, h] of [[15, 20, 15, 17, 0.9], [24, 30, 15.5, 16.3, 1.2], [34, 38, 14, 18, 1.9], [15, 17.5, 23, 30, 2.3], [22, 28, 24, 28, 1.5], [32, 40, 26, 27, 1.0], [35, 40, 33, 38, 2.2], [20, 27, 35, 36.2, 1.1], [14, 18, 37, 41, 1.7]]) {
    solid('S', '#8d939c', x0, x1, Y, Y + h, z0, z1); GB.box('S', '#ffd34d', x1 - x0 + 0.04, 0.06, z1 - z0 + 0.04, cx + (x0 + x1) / 2, Y + h - 0.03, cz + (z0 + z1) / 2);
  }
  for (const [x, z] of [[30, 41], [41, 20], [-20, 10], [-14, 38], [40, 4]]) { GB.cyl('S', '#59606b', 1.1, 1.2, 0.7, cx + x, Y + 0.35, cz + z, 10); GB.cyl('S', '#5a4632', 0.12, 0.18, 2.6, cx + x, Y + 1.6, cz + z, 6); GB.blob('S', '#3f8f5a', 1.9, 1.7, 1.9, cx + x, Y + 3.6, cz + z, x); col.box(cx + x - 1.1, cx + x + 1.1, Y, Y + 0.7, cz + z - 1.1, cz + z + 1.1, { noCam: true }); }
  // ladders: up A from the street, up F from E's roof, down I's west face
  drawLadder(GB, cx - 35, cz - 43, Y, Y + 8, 0);
  drawLadder(GB, cx + 22, cz - 12, Y + 8.4, Y + 15, 0);
  drawLadder(GB, cx - 43, cz + 30, Y, Y + 6, Math.PI / 2);
  // zip line masts (the cable is drawn by the run)
  const zipA = { x: cx - 3, y: Y + 18.2 + 2.4, z: cz + 22 }, zipB = { x: cx - 30, y: Y + 6 + 2.4, z: cz + 28 };
  for (const [m, base] of [[zipA, Y + 18.2], [zipB, Y + 6]]) { GB.box('S', '#2b303a', 0.25, m.y - base + 0.4, 0.25, m.x, (m.y + base + 0.4) / 2, m.z); col.box(m.x - 0.15, m.x + 0.15, base, m.y + 0.4, m.z - 0.15, m.z + 0.15, { noCam: true }); }
  return {
    cx, cz, y: Y,
    rings: RINGS.map(([x, h, z]) => ({ x: cx + x, y: Y + h, z: cz + z })),
    zip: { a: zipA, b: zipB },
    board: { x: cx - 39, y: Y, z: cz - 45.3 },
    inside: (x, z, m = 0) => Math.abs(x - cx) < 44 + m && Math.abs(z - cz) < 44 + m,
  };
}
