// The centre of Arbor Heights: a village green with a playground and a landing pad, a school,
// a parade of shops with a corner shop you can enter, and a townhouse that is for sale.
// The rest of the suburb (streets of houses with gardens) comes from the block layout.
import * as THREE from 'three';
import { RNG } from '../core/util.js';
import { M, labelTexture } from './materials.js';
import { room, counter, lit } from './stores.js';
import { makeDecor } from './decor.js';
import { FY } from './metro/layout.js';

export function layoutSuburb(ctx) {
  const { GB, col, city, block, kit, group } = ctx, rng = new RNG(5521), Y = FY;
  const solid = (hex, x0, x1, y0, y1, z0, z1, k = 'B', extra) => { GB.box(k, hex, x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); col.box(x0, x1, y0, y1, z0, z1, extra); };
  const clear = (b, keep) => { b.bld = b.bld.filter(keep); b.trees = b.trees.filter(([x, z]) => Math.abs(x - b.cx) > 44 || Math.abs(z - b.cz) > 44); };
  const pad = (id, name, x, y, z, r) => { GB.cyl('S', '#1a1f29', r, r, 0.1, x, y + 0.05, z, 32); GB.ring('G', '#4de1ff', r - 0.45, r, x, y + 0.13, z, 40); GB.ring('G', '#4de1ff', r * 0.42, r * 0.42 + 0.2, x, y + 0.13, z, 28); city.pads.push({ id, name, x, y: y + 0.1, z, r, charger: false, priv: false, taxi: true }); };
  const sign = (text, w, h, x, y, z, ry, o) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: labelTexture(text, o) })); m.position.set(x, y, z); m.rotation.y = ry; m.matrixAutoUpdate = false; m.updateMatrix(); return m; };
  const extras = new THREE.Group(); group.add(extras); ctx.rooms.push({ g: extras, x: -720, z: -740, r: 330 });

  // ---- the green: block (-6, -6) ----
  { const b = block(-6, -6), cx = b.cx, cz = b.cz; clear(b, () => false);
    pad('heightsPad', 'Arbor Heights green', cx + 26, Y, cz - 24, 6.5);
    // playground: swings, a slide, a climbing dome, a sandpit
    const px = cx - 22, pz = cz + 18; GB.box('S', '#c9b68f', 20, 0.08, 14, px, Y + 0.02, pz);
    for (const s of [-1, 1]) { GB.box('S', '#c0483f', 0.14, 2.8, 0.14, px - 6 + s * 2.4, Y + 1.4, pz - 3); col.box(px - 6 + s * 2.4 - 0.1, px - 6 + s * 2.4 + 0.1, Y, Y + 2.8, pz - 3.1, pz - 2.9, { noCam: true }); } GB.box('S', '#c0483f', 5, 0.14, 0.14, px - 6, Y + 2.8, pz - 3);
    for (const s of [-1, 1]) { GB.box('S', '#232832', 0.03, 1.9, 0.03, px - 6 + s * 0.9, Y + 1.85, pz - 3); GB.box('S', '#2f6f8f', 0.5, 0.06, 0.3, px - 6 + s * 0.9, Y + 0.9, pz - 3); }
    solid('#d9b84a', px + 2, px + 3.4, Y, Y + 2, pz - 4, pz - 2.6, 'B', { noCam: true }); GB.box('S', '#2f8f5a', 1.1, 0.1, 3.6, px + 2.7, Y + 1.1, pz - 0.6); for (let k = 0; k < 4; k++) GB.box('S', '#8a6a48', 0.9, 0.08, 0.2, px + 4, Y + 0.4 + k * 0.45, pz - 3.3);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; GB.box('S', '#5b4a8f', 0.1, 1.6, 0.1, px + 6 + Math.cos(a) * 1.6, Y + 0.8, pz + 3 + Math.sin(a) * 1.6); } GB.cyl('S', '#5b4a8f', 0.3, 1.7, 0.12, px + 6, Y + 1.66, pz + 3, 8);
    GB.box('S', '#d9c79a', 4, 0.1, 4, px - 5, Y + 0.05, pz + 3.5);
    for (const [x, z, a] of [[cx - 8, cz + 6, -1.2], [cx - 34, cz + 6, 1.2], [cx - 22, cz + 28, Math.PI], [cx + 8, cz - 30, 0], [cx + 30, cz + 10, -Math.PI / 2]]) b.props.push(['bench', x, z, a]);
    b.props.push(['fountain', cx + 6, cz + 14, 0], ['bin', cx - 8, cz + 10, 0], ['bin', cx + 30, cz + 16, 0], ['vend', cx + 38, cz + 30, Math.PI], ['locker', cx - 36, cz - 38, Math.PI]);
    for (let k = 0; k < 12; k++) { const x = cx + rng.range(-40, 40), z = cz + rng.range(-40, 40); if (Math.hypot(x - cx - 26, z - cz + 24) > 11 && !(Math.abs(x - px) < 12 && Math.abs(z - pz) < 9) && Math.hypot(x - cx - 6, z - cz - 14) > 6) b.trees.push([x, z, rng.range(1, 1.6), k % 3 === 0 ? 1 : 0]); }
    ctx.cache(cx + 6, Y, cz + 20); }

  // ---- the school: block (-7, -6) ----
  { const b = block(-7, -6), cx = b.cx, cz = b.cz, add = (x0, x1, z0, z1, h, f) => b.bld.push({ kind: 'school', f, boxes: [[x0, x1, z0, z1, Y, Y + h]], acc: '#ffd34d', shop: 'CLINIC', seed: 7, L: { x0, x1, z0, z1 } });
    clear(b, () => false); add(cx - 36, cx + 24, cz - 38, cz - 22, 9, 'stucco'); add(cx + 14, cx + 38, cz - 20, cz + 2, 8, 'concrete'); add(cx - 36, cx - 22, cz - 22, cz + 6, 5, 'stucco');
    GB.box('S', '#3f6f8f', 34, 0.08, 22, cx - 2, Y + 0.02, cz + 24); GB.quad('G', '#e9edf2', 0.15, 22, cx - 2, Y + 0.07, cz + 24); GB.ring('G', '#e9edf2', 2.9, 3.05, cx - 2, Y + 0.07, cz + 24, 24);
    for (const s of [-1, 1]) { GB.cyl('S', '#232832', 0.1, 0.12, 3.4, cx - 2 + s * 16.5, Y + 1.7, cz + 24, 6); GB.box('S', '#e9edf2', 0.08, 1, 1.6, cx - 2 + s * 15.9, Y + 3.2, cz + 24); col.box(cx - 2 + s * 16.5 - 0.12, cx - 2 + s * 16.5 + 0.12, Y, Y + 3.4, cz + 23.88, cz + 24.12, { noCam: true }); }
    GB.cyl('S', '#aeb6c2', 0.06, 0.08, 9, cx + 30, Y + 4.5, cz + 30, 6); GB.box('S', '#2f6f8f', 1.6, 1, 0.04, cx + 30.9, Y + 8.3, cz + 30); col.box(cx + 29.9, cx + 30.1, Y, Y + 9, cz + 29.9, cz + 30.1, { noCam: true });
    b.props.push(['rack', cx - 30, cz + 12, 0], ['rack', cx - 26, cz + 12, 0], ['bench', cx + 22, cz + 12, Math.PI], ['bench', cx - 16, cz - 18, 0], ['bin', cx - 14, cz + 10, 0]);
    extras.add(sign('ARBOR HEIGHTS SCHOOL', 14, 1.8, cx - 6, Y + 7.4, cz - 21.9, 0, { color: '#1c2a3a', bg: '#e6eaee', size: 40 })); }

  // ---- the parade: block (-6, -7), four units along its south side; the corner shop is the east one ----
  { const b = block(-6, -7), cx = b.cx, cz = b.cz;
    clear(b, (h) => (h.L.z0 + h.L.z1) / 2 < cz);                                            // the three houses on the north side stay
    for (let k = 0; k < 3; k++) { const x0 = cx - 40 + k * 20, L = { x0, x1: x0 + 19, z0: cz + 26, z1: cz + 42 }; b.bld.push({ kind: 'row', f: 'brick', boxes: [[L.x0, L.x1, L.z0, L.z1, Y, Y + 8.5]], acc: ['#ff7ad9', '#59e0ff', '#7dff9c'][k], shop: ['BAKERY', 'FLORIST', 'LAUNDRY'][k], seed: 30 + k, L }); }
    const g = { x0: cx + 20, x1: cx + 40, z0: cz + 26, z1: cz + 42 }, st = room(kit, { id: 'corner', name: 'Heights Corner Shop', x0: g.x0, x1: g.x1, z0: g.z0, z1: g.z1, y: Y, h: 3.8, door: 'S', dw: 2.4, wall: '#6a4135', floor: '#b9b2a2', lamp: '#fff1d6', staffed: true });
    counter(kit, g.x1 - 6, g.x1 - 1.4, g.z0 + 5, g.z0 + 5.8, Y, '#e9e3d5'); st.counter = { x: g.x1 - 3.7, y: Y, z: g.z0 + 7 }; st.keeper = { x: g.x1 - 3.7, y: Y, z: g.z0 + 3.4, yaw: 0 };
    for (let k = 0; k < 3; k++) { const x = g.x0 + 3 + k * 4.2; kit.solid(lit('#3b2f26', 0.2), x - 0.4, x + 0.4, Y, Y + 2, g.z0 + 2.5, g.z0 + 9); for (let l = 0; l < 3; l++) kit.box(lit(['#c0483f', '#d9b84a', '#2f8f5a', '#2f6f8f'][(k + l) % 4], 0.3), 0.9, 0.35, 6, x, Y + 0.5 + l * 0.6, g.z0 + 5.75); }
    kit.finish(group, cx + 30, cz + 34, ctx.rooms);
    solid('#6a4135', g.x0, g.x1, Y + 4.05, Y + 8.5, g.z0, g.z1); GB.box('S', '#161a22', 20.2, 0.3, 16.2, cx + 30, Y + 8.6, cz + 34); GB.box('L', '#ffe2b0', 3, 1.4, 0.06, cx + 26, Y + 6.3, g.z1 + 0.04); GB.box('L', '#ffe2b0', 3, 1.4, 0.06, cx + 34, Y + 6.3, g.z1 + 0.04); GB.box('S', '#2f6f4f', 8, 0.1, 1.5, cx + 30, Y + 3.5, g.z1 + 0.8);
    extras.add(sign('CORNER SHOP', 6, 0.9, cx + 30, Y + 4.5, g.z1 + 0.08, 0, { color: '#ffe9a8', bg: '#2a1c18', size: 50 })); }

  // ---- the townhouse: in block (-5, -6), in place of the south-west house ----
  const b = block(-5, -6), hx = b.cx - 30, hz = b.cz + 25, x0 = hx - 8, x1 = hx + 8, z0 = hz - 6, z1 = hz + 6;
  b.bld = b.bld.filter((h) => Math.hypot((h.L.x0 + h.L.x1) / 2 - hx, (h.L.z0 + h.L.z1) / 2 - hz) > 12); b.trees = b.trees.filter(([x, z]) => Math.hypot(x - hx, z - hz) > 15);
  const rm = room(kit, { id: 'townhouse', name: 'Arbor Heights townhouse', kind: 'home', x0, x1, z0, z1, y: Y, h: 3.6, door: 'S', dw: 1.6, wall: '#d6cfbf', floor: '#9a7a56', lamp: '#ffcf9a', staffed: true });
  kit.solid(lit('#2b303a', 0.2), x0 + 0.5, x0 + 4.6, Y, Y + 0.95, z0 + 0.5, z0 + 1.3); kit.box(lit('#e9e3d5', 0.25), 4.2, 0.06, 0.9, x0 + 2.55, Y + 0.98, z0 + 0.9);                 // kitchen run
  kit.solid(lit('#3a4656', 0.2), x1 - 4.4, x1 - 0.6, Y, Y + 0.5, z0 + 0.6, z0 + 2.8); kit.box(lit('#e9edf2', 0.3), 3.8, 0.25, 2.2, x1 - 2.5, Y + 0.62, z0 + 1.7); kit.box(lit('#c0483f', 0.3), 3.8, 0.26, 0.9, x1 - 2.5, Y + 0.64, z0 + 2.3);   // bed
  kit.solid(lit('#2b303a', 0.2), x1 - 0.9, x1 - 0.4, Y, Y + 2.2, z1 - 4.6, z1 - 2.2);                                                                                          // wardrobe
  kit.solid(lit('#232832', 0.2), x0 + 0.4, x0 + 0.7, Y + 0.9, Y + 1.7, z1 - 4, z1 - 2.6); kit.box(lit('#59e0ff', 0.9), 0.05, 0.6, 1.1, x0 + 0.73, Y + 1.3, z1 - 3.3);          // console
  kit.box(lit('#5b4a8f', 0.25), 3.2, 0.5, 1.1, hx - 0.5, Y + 0.3, hz + 2.6); kit.box(lit('#5b4a8f', 0.25), 3.2, 0.7, 0.25, hx - 0.5, Y + 0.75, hz + 3.1); kit.seat('thSofa', hx - 0.5, Y, hz + 2.5, Math.PI);
  kit.finish(group, hx, hz, ctx.rooms);
  // upper floor, roof and front garden
  solid('#d6cfbf', x0, x1, Y + 3.85, Y + 7, z0, z1); GB.gable('B', '#8a4a3a', 17, 13, 3, hx, Y + 7, hz); for (const dx of [-5, 0, 5]) GB.box('L', '#ffe2b0', 1.8, 1.4, 0.06, hx + dx, Y + 5.5, z1 + 0.04); GB.box('S', '#6a4a3a', 1, 2.4, 1, hx + 5, Y + 9.4, hz - 2);
  GB.box('S', '#c9c2b2', 1.6, 0.04, 18, hx, Y + 0.03, z1 + 9); for (const s of [-1, 1]) GB.box('S', '#2c6a44', 0.7, 1, 16, hx + s * 10, Y + 0.5, z1 + 8);
  const decor = {}, dg = new THREE.Group(); group.add(dg); ctx.rooms.push({ g: dg, x: hx, z: hz, r: 120 });
  const place = (key, x, z, ry = 0) => { const g = makeDecor(key); g.position.set(x, Y, z); g.rotation.y = ry; dg.add(g); decor[key] = g; };
  place('records', x0 + 1.2, hz + 4.6, Math.PI / 2); place('vinyl', x0 + 0.5, hz, Math.PI / 2); place('tea', x0 + 5.6, z0 + 1.2); place('lamp', x1 - 5.4, z0 + 1); place('books', hx + 2.5, z0 + 0.7); place('print', hx - 2.5, z0 + 0.45); place('plant', x1 - 1.2, z1 - 1.2); place('aquarium', hx + 5.2, z1 - 0.9, Math.PI);
  const at = (x, z) => ({ x, y: Y, z });
  const home = { console: at(x0 + 1.5, z1 - 3.3), bed: at(x1 - 2.5, z0 + 3.6), kitchen: at(x0 + 2.5, z0 + 2.2), turntable: at(x0 + 2, hz + 4.6), wardrobe: at(x1 - 1.9, z1 - 3.4), music: at(hx, hz), decor, room: rm, door: at(hx, z1 + 2.5) };
  return { home, green: { x: -720, y: Y, z: -720 }, school: { x: -842, y: Y, z: -696 } };
}
