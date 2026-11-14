// Two Midtown towers you can go into: a glass lobby on the street (walk in through the door), a lift,
// and a bar on the roof with a glass parapet, a counter, stools, sofas and strings of lights. Built into
// a cleared block each, like the Skyline Run. The lifts and the bar menu are in systems/skybars.js.
import * as THREE from 'three';
import { room, counter, lit } from './stores.js';
import { M, towerGeometry, neon, std } from './materials.js';
import { FY } from './metro/layout.js';

export const TOWERS = [
  { id: 'halcyon', name: 'Halcyon Tower', bar: 'Halcyon Sky Bar', i: 3, j: -1, h: 150, facade: 'corp', glow: '#59e0ff', door: 'W' },
  { id: 'spire', name: 'Northbank Spire', bar: 'Cloud Nine', i: 1, j: -3, h: 176, facade: 'magenta', glow: '#ff7ad9', door: 'S' },
];

export function layoutTowers(ctx) {
  const { GB, col, block, kit, group, rooms } = ctx, out = [];
  for (const T of TOWERS) {
    const b = block(T.i, T.j), cx = b.cx, cz = b.cz, Y = FY, top = Y + T.h;
    const inside = (x, z) => Math.abs(x - cx) < 44.5 && Math.abs(z - cz) < 44.5;
    b.bld = []; b.trees = b.trees.filter(([x, z]) => !inside(x, z)); b.props = b.props.filter((p) => !inside(p[1], p[2])); b.solids = b.solids.filter((s) => !inside((s[0] + s[1]) / 2, (s[4] + s[5]) / 2));
    // the lobby: a glass podium 34 m square, the door facing the street toward Meridian
    const L = 17, rm = room(kit, { id: T.id, name: `${T.name} lobby`, kind: 'lobby', x0: cx - L, x1: cx + L, z0: cz - L, z1: cz + L, y: Y, h: 6, door: T.door, dw: 4, dh: 3.4, wall: '#4a5568', floor: '#aab2bd', lamp: '#f4fbff', staffed: false });
    const dx = T.door === 'W' ? -1 : T.door === 'E' ? 1 : 0, dz = T.door === 'N' ? -1 : T.door === 'S' ? 1 : 0, ax = -dz, az = dx;     // door direction, and along the door wall
    // reception desk facing the door, sofas, plants, and the lift doors on the back wall
    const rx = cx + dx * 6, rz = cz + dz * 6; counter(kit, rx - (dz ? 3 : 0.5), rx + (dz ? 3 : 0.5), rz - (dx ? 3 : 0.5), rz + (dx ? 3 : 0.5), Y, '#e9eef5');
    for (const s of [-1, 1]) { const sx = cx + dx * 10 + ax * s * 9, sz = cz + dz * 10 + az * s * 9; kit.box(lit('#2f6f8f', 0.15), dz ? 3 : 1, 0.5, dx ? 3 : 1, sx, Y + 0.3, sz); kit.seat(`lobby-${T.id}-${s}`, sx, Y, sz, Math.atan2(-ax * s, -az * s)); }
    for (const [px, pz] of [[-13, -13], [13, -13], [-13, 13], [13, 13]]) { kit.cyl(lit('#3a3f48', 0.1), 0.5, 0.45, 0.8, cx + px, Y + 0.4, cz + pz, 10); kit.ball(lit('#3f8f5a', 0.12), 0.9, cx + px, Y + 1.5, cz + pz); }
    const lx = cx - dx * (L - 0.6), lz = cz - dz * (L - 0.6);                                                    // the back wall, opposite the door
    for (const s of [-1, 1]) { kit.box(std('#aeb6c2', 0.3, 0.8), dz ? 2.2 : 0.1, 3, dx ? 2.2 : 0.1, lx + ax * s * 2.2, Y + 1.5, lz + az * s * 2.2); kit.box(neon(T.glow, 1.4), dz ? 2.2 : 0.06, 0.08, dx ? 2.2 : 0.06, lx + ax * s * 2.2 + dx * 0.05, Y + 3.15, lz + az * s * 2.2 + dz * 0.05); }
    kit.finish(group, cx, cz, rooms);
    // the tower above the lobby: a facade shell, a crown of light
    const W = 28, body = new THREE.Mesh(towerGeometry(W, T.h - 6.25, W, M.facades[T.facade].userData.tile), M.facades[T.facade]);
    body.position.set(cx, Y + 6.25 + (T.h - 6.25) / 2, cz); body.castShadow = true; body.receiveShadow = true; group.add(body);
    col.box(cx - W / 2, cx + W / 2, Y + 6.25, top, cz - W / 2, cz + W / 2, { tag: 'tower' });
    for (const [ex, ez, ew, ed] of [[0, -W / 2, W, 0.3], [0, W / 2, W, 0.3], [-W / 2, 0, 0.3, W], [W / 2, 0, 0.3, W]]) { GB.box('G', T.glow, ew + 0.3, 0.35, ed + 0.3, cx + ex, top - 0.6, cz + ez); GB.box('G', T.glow, ew + 0.3, 0.2, ed + 0.3, cx + ex, Y + 6.4, cz + ez); }
    // the roof bar: deck, glass parapet (too high to vault), the lift house, counter, stools, sofas, lights, planters
    GB.box('S', '#3a3226', W - 0.6, 0.06, W - 0.6, cx, top + 0.03, cz);
    const G2 = 1.6;
    for (const [x0, x1, z0, z1] of [[-W / 2, W / 2, -W / 2, -W / 2 + 0.12], [-W / 2, W / 2, W / 2 - 0.12, W / 2], [-W / 2, -W / 2 + 0.12, -W / 2, W / 2], [W / 2 - 0.12, W / 2, -W / 2, W / 2]]) {
      GB.box('S', '#9fd4ff', x1 - x0, G2, z1 - z0, cx + (x0 + x1) / 2, top + G2 / 2, cz + (z0 + z1) / 2); col.box(cx + x0, cx + x1, top, top + G2, cz + z0, cz + z1, { noCam: true });
      GB.box('S', '#d7dde6', Math.max(0.16, x1 - x0), 0.08, Math.max(0.16, z1 - z0), cx + (x0 + x1) / 2, top + G2, cz + (z0 + z1) / 2);
    }
    const hx = cx - dx * 9, hz = cz - dz * 9;                                                                    // the lift house, over the lifts
    GB.box('B', '#2b303a', dz ? 7 : 4, 3.4, dx ? 7 : 4, hx, top + 1.7, hz); col.box(hx - (dz ? 3.5 : 2), hx + (dz ? 3.5 : 2), top, top + 3.4, hz - (dx ? 3.5 : 2), hz + (dx ? 3.5 : 2));
    GB.box('G', T.glow, dz ? 2.4 : 0.06, 2.6, dx ? 2.4 : 0.06, hx + dx * (dz ? 0 : 2.05), top + 1.3, hz + dz * (dx ? 0 : 2.05));
    const bx = cx + dx * 4, bz = cz + dz * 4;                                                                   // the bar counter, across the deck
    GB.box('B', '#1c2028', dz ? 10 : 1.2, 1.05, dx ? 10 : 1.2, bx, top + 0.53, bz); GB.box('S', '#e9e3d5', dz ? 10.2 : 1.4, 0.06, dx ? 10.2 : 1.4, bx, top + 1.08, bz); GB.box('G', T.glow, dz ? 10 : 0.05, 0.06, dx ? 10 : 0.05, bx + dx * 0.62, top + 0.4, bz + dz * 0.62);
    col.box(bx - (dz ? 5 : 0.6), bx + (dz ? 5 : 0.6), top, top + 1.05, bz - (dx ? 5 : 0.6), bz + (dx ? 5 : 0.6), { noCam: true });
    GB.box('B', '#2b303a', dz ? 10 : 0.6, 2.4, dx ? 10 : 0.6, bx - dx * 2.2, top + 1.2, bz - dz * 2.2);         // the back bar, with bottles glowing
    for (let k = -4; k <= 4; k++) GB.box('G', ['#ffd34d', '#59e0ff', '#ff7ad9', '#7dff9c'][(k + 4) % 4], 0.12, 0.3, 0.12, bx - dx * 1.8 + ax * k * 1.1, top + 1.7, bz - dz * 1.8 + az * k * 1.1);
    const seats = [];
    for (let k = -3; k <= 3; k++) { const sx = bx + dx * 1.3 + ax * k * 1.35, sz = bz + dz * 1.3 + az * k * 1.35; GB.cyl('S', '#c9a227', 0.2, 0.2, 0.08, sx, top + 0.78, sz, 8); GB.cyl('S', '#2b303a', 0.04, 0.04, 0.74, sx, top + 0.38, sz, 6); seats.push({ id: `bar-${T.id}-s${k}`, x: sx, y: top + 0.5 + 0.32, z: sz, yaw: Math.atan2(-dx, -dz) }); }
    for (const [ox, oz, yaw] of [[-8, -10, 0], [8, -10, 0], [-10, 8, Math.PI / 2], [10, 8, -Math.PI / 2]]) {
      const sx = cx + ox, sz = cz + oz; GB.box('S', '#3a4656', 2.6, 0.45, 0.9, sx, top + 0.25, sz, yaw); GB.box('S', '#3a4656', 2.6, 0.5, 0.25, sx - Math.sin(yaw) * 0.4, top + 0.65, sz - Math.cos(yaw) * 0.4, yaw);
      col.box(sx - 0.7, sx + 0.7, top, top + 0.45, sz - 0.7, sz + 0.7, { noCam: true }); seats.push({ id: `bar-${T.id}-sofa${ox}${oz}`, x: sx, y: top + 0.5, z: sz, yaw });
    }
    for (const [px, pz] of [[-12.5, -12.5], [12.5, -12.5], [-12.5, 12.5], [12.5, 12.5]]) { GB.box('S', '#4a3a2e', 1.4, 0.8, 1.4, cx + px, top + 0.4, cz + pz); GB.blob('S', '#2f8f5a', 1.1, 1.2, 1.1, cx + px, top + 1.5, cz + pz, px); GB.box('S', '#2b303a', 0.08, 3.4, 0.08, cx + px, top + 1.7, cz + pz); col.box(cx + px - 0.7, cx + px + 0.7, top, top + 0.8, cz + pz - 0.7, cz + pz + 0.7, { noCam: true }); }
    // strings of lights between the corner poles
    for (const [a, c] of [[[-12.5, -12.5], [12.5, -12.5]], [[12.5, -12.5], [12.5, 12.5]], [[12.5, 12.5], [-12.5, 12.5]], [[-12.5, 12.5], [-12.5, -12.5]], [[-12.5, -12.5], [12.5, 12.5]]]) for (let k = 1; k < 12; k++) { const u = k / 12; GB.box('L', '#ffe2b0', 0.14, 0.14, 0.14, cx + a[0] + (c[0] - a[0]) * u, top + 3.3 - Math.sin(Math.PI * u) * 0.7, cz + a[1] + (c[1] - a[1]) * u); }
    for (const s of seats) kit.city.seats.push({ id: s.id, kind: 'stool', x: s.x, y: s.y, z: s.z, yaw: s.yaw, taken: null, table: null, service: null });
    out.push({ ...T, cx, cz, top, lobby: rm, lobbyLift: { x: lx + dx * 1.4, y: Y, z: lz + dz * 1.4 }, roofLift: { x: hx + dx * (dz ? 0 : 3.2) + (dz ? 0 : 0), y: top, z: hz + dz * (dx ? 0 : 3.2) }, bar: { x: bx + dx * 1.4, y: top, z: bz + dz * 1.4 }, sign: { x: hx, y: top + 5, z: hz, yaw: Math.atan2(dx, dz) }, name: T.name, barName: T.bar });
  }
  return out;
}
