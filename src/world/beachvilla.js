// A beach villa for sale at Solara Bay: a white two-storey house with a roof terrace and a pool,
// across Shoreline Drive from the sand. The ground floor is a home you can walk into, built the
// same way as the Arbor Heights townhouse.
import * as THREE from 'three';
import { room, lit } from './stores.js';
import { makeDecor } from './decor.js';
import { FY } from './metro/layout.js';

export function layoutBeachVilla(ctx) {
  const { GB, col, block, kit, group } = ctx, Y = FY;
  const solid = (hex, x0, x1, y0, y1, z0, z1, k = 'B', extra) => { GB.box(k, hex, x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); col.box(x0, x1, y0, y1, z0, z1, extra); };
  // the south-east lot of block (8, 9), facing the street and the beach
  const b = block(8, 9), hx = b.cx + 24, hz = b.cz + 18, x0 = hx - 10, x1 = hx + 10, z0 = hz - 7, z1 = hz + 7;
  b.bld = b.bld.filter((h) => !((h.L.x0 + h.L.x1) / 2 > b.cx && (h.L.z0 + h.L.z1) / 2 > b.cz));
  b.trees = b.trees.filter(([x, z]) => !(x > b.cx && z > b.cz - 4)); b.props = b.props.filter((p) => !(p[1] > b.cx + 2 && p[2] > b.cz + 2 && p[2] < b.cz + 46));
  const rm = room(kit, { id: 'beachvilla', name: 'Solara Bay beach villa', kind: 'home', x0, x1, z0, z1, y: Y, h: 3.8, door: 'S', dw: 2, wall: '#a8a294', floor: '#7d6a4f', lamp: '#ffd9a8', staffed: true });
  kit.solid(lit('#2b303a', 0.2), x0 + 0.5, x0 + 5.6, Y, Y + 0.95, z0 + 0.5, z0 + 1.3); kit.box(lit('#c9cdd4', 0.2), 5.2, 0.06, 0.9, x0 + 3.05, Y + 0.98, z0 + 0.9);                 // kitchen run
  kit.solid(lit('#c9cdd4', 0.2), x0 + 0.5, x0 + 1.4, Y, Y + 2.1, z0 + 2, z0 + 2.9);                                                                                              // fridge
  kit.solid(lit('#3a4656', 0.2), x1 - 4.6, x1 - 0.6, Y, Y + 0.5, z0 + 0.6, z0 + 3.0); kit.box(lit('#e9edf2', 0.3), 4, 0.25, 2.4, x1 - 2.6, Y + 0.62, z0 + 1.8); kit.box(lit('#2f6f8f', 0.3), 4, 0.26, 1, x1 - 2.6, Y + 0.64, z0 + 2.5);   // bed
  kit.solid(lit('#2b303a', 0.2), x1 - 0.9, x1 - 0.4, Y, Y + 2.2, z1 - 5, z1 - 2.6);                                                                                            // wardrobe
  kit.solid(lit('#232832', 0.2), x0 + 0.4, x0 + 0.7, Y + 0.9, Y + 1.7, z1 - 4.2, z1 - 2.8); kit.box(lit('#59e0ff', 0.9), 0.05, 0.6, 1.1, x0 + 0.73, Y + 1.3, z1 - 3.5);         // console
  kit.box(lit('#2f6f8f', 0.2), 3.6, 0.5, 1.2, hx - 1, Y + 0.3, hz + 1.6); kit.box(lit('#2f6f8f', 0.2), 3.6, 0.7, 0.25, hx - 1, Y + 0.75, hz + 2.2); kit.seat('bvSofa', hx - 1, Y, hz + 1.5, Math.PI);
  kit.cyl(lit('#8a6a48', 0.2), 0.7, 0.7, 0.06, hx + 3.5, Y + 0.45, hz + 1.2, 16); kit.cyl(lit('#8a6a48', 0.2), 0.08, 0.2, 0.42, hx + 3.5, Y + 0.21, hz + 1.2, 8);         // coffee table
  kit.finish(group, hx, hz, ctx.rooms);
  // upper floor set back, a roof terrace with a glass rail, big windows to the sea
  solid('#f2efe8', x0, x1, Y + 4.05, Y + 4.4, z0, z1); solid('#f2efe8', x0, x1 - 6, Y + 4.4, Y + 7.6, z0, z1 - 3); GB.box('S', '#e9e3d5', x1 - x0 + 0.3, 0.25, z1 - z0 + 0.3, hx, Y + 7.72, hz - 1.5);
  for (const dx of [-7.5, -3.5]) GB.box('L', '#ffe2b0', 2.6, 2, 0.06, hx + dx, Y + 6, z1 - 2.96);
  GB.box('S', '#9fd4ff', 6, 1, 0.05, hx + 7, Y + 4.95, z1 + 0.02); GB.box('S', '#9fd4ff', 0.05, 1, z1 - z0, x1 + 0.02, Y + 4.95, hz);
  for (let k = 0; k < 3; k++) GB.box('S', '#e9edf2', 1.9, 0.35, 0.7, hx + 5 + k * 0 + (k - 1) * 2.2, Y + 4.6, hz + 4);   // loungers on the terrace
  GB.box('L', '#ffe2b0', 6, 2.4, 0.06, hx - 3, Y + 1.8, z1 + 0.04);                                                             // the ground-floor windows glow at night
  // garden: a pool, a deck, palms, a hedge to the street with a gap for the path
  GB.box('S', '#e9edf2', 12, 0.3, 6, hx + 3, Y + 0.0, z1 + 6.5); GB.box('S', '#2a7f9f', 11, 0.05, 5, hx + 3, Y + 0.17, z1 + 6.5);
  col.box(hx - 3, hx + 9, Y, Y + 0.2, z1 + 3.5, z1 + 9.5, { noCam: true });
  GB.box('S', '#c9b68f', 7, 0.04, 9, hx - 6, Y + 0.03, z1 + 5.5); GB.box('S', '#c9c2b2', 1.8, 0.04, 6, hx - 6, Y + 0.03, z1 + 13);
  for (const s of [-1, 1]) { const ex = s < 0 ? hx - 14 : hx + 12; GB.box('S', '#2c6a44', s < 0 ? 6 : 6, 1, 0.7, ex, Y + 0.5, z1 + 16); }
  for (const [dx, dz] of [[-11, 8], [11, 12], [-12, 14]]) { const x = hx + dx, z = z1 + dz; GB.cyl('S', '#6a5a48', 0.14, 0.24, 7, x, Y + 3.5, z, 6); for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2 + x; GB.box('S', '#2f8f5a', 0.5, 0.08, 3, x + Math.sin(a) * 1.5, Y + 6.9, z + Math.cos(a) * 1.5, a); } col.box(x - 0.3, x + 0.3, Y, Y + 6, z - 0.3, z + 0.3, { noCam: true }); }
  const decor = {}, dg = new THREE.Group(); group.add(dg); ctx.rooms.push({ g: dg, x: hx, z: hz, r: 120 });
  const place = (key, x, z, ry = 0) => { const g = makeDecor(key); g.position.set(x, Y, z); g.rotation.y = ry; dg.add(g); decor[key] = g; };
  place('records', x0 + 1.2, hz + 3.6, Math.PI / 2); place('vinyl', x0 + 0.5, hz - 0.5, Math.PI / 2); place('tea', x0 + 6.6, z0 + 1.2); place('lamp', x1 - 5.6, z0 + 1); place('books', hx + 1.5, z0 + 0.7); place('print', hx - 3, z0 + 0.45); place('plant', x1 - 1.2, z1 - 1.2); place('aquarium', hx + 6, z1 - 0.9, Math.PI);
  const at = (x, z) => ({ x, y: Y, z });
  return { console: at(x0 + 1.5, z1 - 3.5), bed: at(x1 - 2.6, z0 + 3.8), kitchen: at(x0 + 3, z0 + 2.2), turntable: at(x0 + 2, hz + 3.6), wardrobe: at(x1 - 1.9, z1 - 3.8), music: at(hx, hz), decor, room: rm, door: at(hx - 6, z1 + 3) };
}
