// The Neo Central Institute: a small campus on block (-2, 2), south-west of Meridian. A lawn quad
// with paths and trees, a library you can walk into (shelves, reading tables, the city archive
// terminal), a lecture hall with columns, an observatory dome and a clock tower.
import { room, counter, lit } from './stores.js';
import { neon, std } from './materials.js';
import { FY } from './metro/layout.js';

export function layoutCampus(ctx) {
  const { GB, col, block, kit, group, rooms } = ctx, b = block(-2, 2), cx = b.cx, cz = b.cz, Y = FY;
  const inside = (x, z) => Math.abs(x - cx) < 44.5 && Math.abs(z - cz) < 44.5;
  b.bld = []; b.trees = b.trees.filter(([x, z]) => !inside(x, z)); b.props = b.props.filter((p) => !inside(p[1], p[2])); b.solids = b.solids.filter((s) => !inside((s[0] + s[1]) / 2, (s[4] + s[5]) / 2));
  const solid = (k, hex, x0, x1, y0, y1, z0, z1) => { GB.box(k, hex, x1 - x0, y1 - y0, z1 - z0, cx + (x0 + x1) / 2, (y0 + y1) / 2, cz + (z0 + z1) / 2); col.box(cx + x0, cx + x1, y0, y1, cz + z0, cz + z1); };
  // the quad: lawn, paths in a cross and round the edge
  GB.box('S', '#2f6a44', 52, 0.04, 52, cx + 6, Y + 0.02, cz + 6);
  GB.box('S', '#c9c2b2', 52, 0.05, 3, cx + 6, Y + 0.03, cz + 6); GB.box('S', '#c9c2b2', 3, 0.05, 52, cx + 6, Y + 0.03, cz + 6);
  for (const [x, z] of [[-14, -14], [26, -14], [-14, 26], [26, 26], [-2, 16], [16, -4], [-6, -4], [16, 18]]) { GB.cyl('S', '#5a4632', 0.16, 0.24, 3, cx + x, Y + 1.5, cz + z, 6); GB.blob('S', x % 4 ? '#3f8f5a' : '#b65a8d', 2.2, 1.9, 2.2, cx + x, Y + 4, cz + z, x + z); col.box(cx + x - 0.3, cx + x + 0.3, Y, Y + 3, cz + z - 0.3, cz + z + 0.3, { noCam: true }); }
  const benches = [];
  for (const [x, z, yaw] of [[2, 9, 0], [10, 3, Math.PI / 2], [10, 9, Math.PI], [2, 3, -Math.PI / 2]]) { GB.box('S', '#8a6a48', 1.8, 0.1, 0.5, cx + x, Y + 0.45, cz + z, yaw); GB.box('S', '#2b303a', 1.6, 0.4, 0.3, cx + x, Y + 0.2, cz + z, yaw); col.box(cx + x - 0.5, cx + x + 0.5, Y, Y + 0.45, cz + z - 0.5, cz + z + 0.5, { noCam: true }); benches.push({ x: cx + x, z: cz + z, yaw }); }
  // the library: a walk-in room on the north-west corner, door to the quad
  const lib = room(kit, { id: 'library', name: 'Institute Library', kind: 'library', x0: cx - 42, x1: cx - 18, z0: cz - 42, z1: cz - 22, y: Y, h: 7, door: 'S', at: cx - 30, dw: 3, dh: 3.2, wall: '#6a5a48', floor: '#7d6a4f', lamp: '#ffe2b0', staffed: true });
  for (let r = 0; r < 3; r++) for (const s of [-1, 1]) { const z = cz - 39 + r * 3.2, x = cx - 30 + s * 6.5; kit.solid(lit('#4a3a2e', 0.15), x - 3.5, x + 3.5, Y, Y + 2.6, z - 0.35, z + 0.35); for (let k = 0; k < 4; k++) kit.box(lit(['#b23a48', '#2f6f8f', '#d9b23a', '#3f8f5a'][(r + k) % 4], 0.2), 6.6, 0.42, 0.78, x, Y + 0.45 + k * 0.6, z); }   // book spines stand proud of the shelf on both faces
  for (const [k, x, z] of [[0, -36.5, -29], [1, -22.5, -29], [2, -36.5, -25.5]]) kit.table(`lib-${k}`, cx + x, Y, cz + z, lit('#8a6a48', 0.15), lit('#2b303a', 0.1));   // reading tables
  counter(kit, cx - 33, cx - 27, cz - 26.6, cz - 25.8, Y, '#e9e3d5');
  kit.solid(lit('#232832', 0.2), cx - 41.6, cx - 40.8, Y, Y + 1.6, cz - 30, cz - 29); kit.box(neon('#7fe9ff', 1.2), 0.05, 0.7, 0.8, cx - 40.75, Y + 1.25, cz - 29.5);   // the archive terminal on the west wall
  kit.finish(group, cx - 30, cz - 32, rooms);
  // the lecture hall: a stone hall with a row of columns facing the quad
  solid('B', '#d6cfbf', 16, 42, Y, Y + 11, -42, -18); GB.box('S', '#b3ab9a', 27, 1.2, 25, cx + 29, Y + 11.6, cz - 30);
  for (let k = 0; k < 6; k++) { const x = 17.5 + k * 4.6; GB.cyl('S', '#e9e3d5', 0.55, 0.6, 9, cx + x, Y + 4.5, cz - 16.2, 10); col.box(cx + x - 0.6, cx + x + 0.6, Y, Y + 9, cz - 16.8, cz - 15.6, { noCam: true }); }
  GB.box('S', '#e9e3d5', 27, 1.2, 3.5, cx + 29, Y + 9.6, cz - 16.2); GB.box('S', '#2b303a', 3.5, 4, 0.1, cx + 29, Y + 2, cz - 17.95);
  // the observatory: a drum with a dome and a slit of light; the clock tower
  GB.cyl('B', '#d7dde6', 7, 7.5, 12, cx + 30, Y + 6, cz + 30, 24); col.box(cx + 23.5, cx + 36.5, Y, Y + 12, cz + 23.5, cz + 36.5);
  GB.blob('B', '#e9eef5', 7.2, 5.5, 7.2, cx + 30, Y + 12.5, cz + 30, 0); GB.box('G', '#7fe9ff', 1.2, 7, 0.4, cx + 30, Y + 14.5, cz + 23.5);
  solid('B', '#8a6a5a', -33, -27, Y, Y + 26, 27, 33); GB.box('S', '#5a4a3e', 7, 3, 7, cx - 30, Y + 27.5, cz + 30);
  for (const [ox, oz, w, d] of [[0, -3.55, 3.4, 0.1], [0, 3.55, 3.4, 0.1], [-3.55, 0, 0.1, 3.4], [3.55, 0, 0.1, 3.4]]) GB.box('G', '#ffe2b0', w, 3.4, d, cx - 30 + ox, Y + 22, cz + 30 + oz);      // clock faces
  return { lib, terminal: { x: cx - 39.8, y: Y, z: cz - 29.5 }, benches, quad: { x: cx + 6, z: cz + 6 }, sign: { x: cx + 6, y: Y + 5, z: cz + 44, yaw: Math.PI }, cx, cz };
}
