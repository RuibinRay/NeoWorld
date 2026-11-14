// Skyhaven Green, under the floating deck: Skyhaven Stadium (a bowl of twelve rows round a
// skyball pitch, a roof ring, floodlights and two scoreboards) and the Expo grounds (a glass
// dome, a spiral tower, a flag plaza and the Expo Hall, which you can walk into).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { M, std, labelTexture, makeCanvas, canvasTex } from './materials.js';
import { room, counter, lit } from './stores.js';
import { blockOf } from './metro/landuse.js';
import { MATS } from './metro/builder.js';

export const STADIUM = { x: 760, z: -760, a: 58, b: 40, rows: 12, tread: 0.9, rise: 0.5, base: 1.2 };
export const EXPO = { x: 560, z: -780 };
const SE = 4;   // the bowl's shape: a superellipse, between an oval and a rounded rectangle
// a point on the bowl's ring at angle t, d metres out from the edge of the pitch area
export function ring(t, d) { const c = Math.cos(t), s = Math.sin(t), S = STADIUM; return [S.x + (S.a + d) * Math.sign(c) * Math.abs(c) ** (2 / SE), S.z + (S.b + d) * Math.sign(s) * Math.abs(s) ** (2 / SE)]; }
export const rowY = (r) => STADIUM.base + r * STADIUM.rise;

export function layoutExpo(ctx) {
  const { GB, col, block, kit, group } = ctx, S = STADIUM, E = EXPO;
  // clear the lawn's trees and benches where the stadium and the expo stand
  const clear = (x0, x1, z0, z1) => { for (let j = blockOf(z0); j <= blockOf(z1); j++) for (let i = blockOf(x0); i <= blockOf(x1); i++) { const b = block(i, j); if (!b) continue; b.trees = b.trees.filter(([x, z]) => x < x0 || x > x1 || z < z0 || z > z1); b.props = b.props.filter((p) => p[1] < x0 || p[1] > x1 || p[2] < z0 || p[2] > z1); } };
  clear(S.x - S.a - 22, S.x + S.a + 22, S.z - S.b - 22, S.z + S.b + 26); clear(E.x - 70, E.x + 52, E.z - 70, E.z + 66);

  // ---- the stadium -----------------------------------------------------------------------------
  const N = 72, pos = [], colr = [], idx = [], C = new THREE.Color();
  const quad = (a, b, c, d, hex, k = 1) => { const i0 = pos.length / 3; for (const p of [a, b, c, d]) pos.push(...p); C.set(hex).multiplyScalar(k); for (let n = 0; n < 4; n++) colr.push(C.r, C.g, C.b); idx.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3); };
  for (let k = 0; k < N; k++) {
    const t0 = (k / N) * Math.PI * 2, t1 = ((k + 1) / N) * Math.PI * 2, mid = (t0 + t1) / 2, home = Math.cos(mid) > 0, hex = home ? '#2f6f8f' : '#a8343f';
    for (let r = 0; r < S.rows; r++) {
      const d0 = r * S.tread, d1 = d0 + S.tread, y0 = r === 0 ? 0.2 : rowY(r - 1), y1 = rowY(r);
      const [ax, az] = ring(t0, d0), [bx, bz] = ring(t1, d0), [cx, cz] = ring(t1, d1), [dx, dz] = ring(t0, d1);
      quad([ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], '#8d9199', 0.9);                                  // riser
      quad([ax, y1, az], [bx, y1, bz], [cx, y1, cz], [dx, y1, dz], hex, r % 2 ? 0.8 : 1);                            // the row of seats
    }
    // back wall, facing out, with a lit band; roof ring overhead
    const dw = S.rows * S.tread, top = rowY(S.rows - 1), [ax, az] = ring(t0, dw), [bx, bz] = ring(t1, dw), [cx, cz] = ring(t1, dw + 0.6), [dx, dz] = ring(t0, dw + 0.6);
    quad([ax, top, az], [bx, top, bz], [bx, top + 2.4, bz], [ax, top + 2.4, az], '#dfe5ee', 0.9);
    quad([dx, 0, dz], [cx, 0, cz], [cx, top + 2.4, cz], [dx, top + 2.4, dz], '#e9edf2', 1);
    quad([ax, top + 2.4, az], [bx, top + 2.4, bz], [cx, top + 2.4, cz], [dx, top + 2.4, dz], '#dfe5ee', 1);
    const [ex, ez] = ring(t0, 4), [fx, fz] = ring(t1, 4), [gx, gz] = ring(t1, dw + 2.5), [hx, hz] = ring(t0, dw + 2.5), ry = top + 6.5;
    quad([ex, ry, ez], [fx, ry, fz], [gx, ry, gz], [hx, ry, hz], '#c9d2de', 0.9); quad([hx, ry - 0.3, hz], [gx, ry - 0.3, gz], [fx, ry - 0.3, fz], [ex, ry - 0.3, ez], '#59606c', 1);
    col.box(Math.min(dx, cx) - 0.6, Math.max(dx, cx) + 0.6, 0, top + 2.4, Math.min(dz, cz) - 0.6, Math.max(dz, cz) + 0.6);
    if (k % 6 === 0) { const [px, pz] = ring(t0, dw + 1.6); GB.box('B', '#c9d2de', 0.6, ry - top - 2.4, 0.6, px, top + 2.4 + (ry - top - 2.4) / 2, pz); }   // roof struts
  }
  { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.1, side: THREE.DoubleSide })); m.castShadow = true; m.receiveShadow = true; m.matrixAutoUpdate = false; group.add(m); }
  // glow band under the roof, the pitch with its markings, two goals
  for (let k = 0; k < N; k += 1) { const t = ((k + 0.5) / N) * Math.PI * 2, [x, z] = ring(t, S.rows * S.tread + 0.62); GB.box('G', Math.cos(t) > 0 ? '#59e0ff' : '#ff7ad9', 0.3, 0.4, 0.3, x, rowY(S.rows - 1) + 1.2, z); }
  GB.quad('S', '#2f7a3c', S.a * 2, S.b * 2, S.x, 0.02, S.z);
  for (let k = -5; k <= 4; k++) GB.quad('S', k % 2 ? '#357f42' : '#2a6f37', 10, 64, S.x + k * 10 + 5, 0.025, S.z);
  for (const [w, d, x, z] of [[100, 0.25, S.x, S.z - 32], [100, 0.25, S.x, S.z + 32], [0.25, 64, S.x - 50, S.z], [0.25, 64, S.x + 50, S.z], [0.25, 64, S.x, S.z]]) GB.quad('G', '#e9edf2', w, d, x, 0.035, z);
  GB.ring('G', '#e9edf2', 8.9, 9.15, S.x, 0.035, S.z, 40);
  for (const s of [-1, 1]) { const gx = S.x + s * 50; GB.box('S', '#e9edf2', 0.2, 2.4, 0.2, gx, 1.2, S.z - 4); GB.box('S', '#e9edf2', 0.2, 2.4, 0.2, gx, 1.2, S.z + 4); GB.box('S', '#e9edf2', 0.2, 0.2, 8.2, gx, 2.4, S.z); GB.ring('G', s > 0 ? '#59e0ff' : '#ff7ad9', 1.6, 1.9, gx - s * 6, 0.04, S.z, 24); }
  // floodlight masts at the four corners, outside the bowl
  for (const t of [0.6, Math.PI - 0.6, Math.PI + 0.6, -0.6]) { const [x, z] = ring(t, S.rows * S.tread + 9); GB.box('B', '#8a94a6', 1, 36, 1, x, 18, z); GB.box('S', '#2b303a', 6, 3, 0.6, x, 36, z); GB.box('L', '#fff4dc', 5.6, 2.6, 0.1, x - Math.cos(t) * 0.35, 36, z - Math.sin(t) * 0.35); col.box(x - 0.5, x + 0.5, 0, 36, z - 0.5, z + 0.5); }
  // the way in: a lit portal on the city side, with the ticket desk outside it
  const [gx, gz] = ring(Math.PI / 2, S.rows * S.tread + 0.7), gate = { x: gx, y: 0.15, z: gz + 9 };
  GB.box('B', '#2b303a', 22, 9, 1.2, gx, 4.5, gz + 0.4); GB.box('G', '#ffd34d', 18, 0.5, 0.2, gx, 8.4, gz + 1.05); GB.box('S', '#0d1016', 10, 6, 0.2, gx, 3, gz + 1.05);
  GB.box('B', '#20262f', 2.4, 2.4, 1.2, gx + 7, 1.2, gz + 6); GB.box('G', '#ffd34d', 2, 0.9, 0.05, gx + 7, 1.7, gz + 6.62); col.box(gx + 5.8, gx + 8.2, 0, 2.4, gz + 5.4, gz + 6.6);
  const title = new THREE.Mesh(new THREE.PlaneGeometry(16, 3), new THREE.MeshBasicMaterial({ map: labelTexture('SKYHAVEN STADIUM', { color: '#ffffff', size: 70, sub: 'skyball · tickets at the desk' }), transparent: true, depthWrite: false })); title.position.set(gx, 10.6, gz + 1.1); group.add(title);
  // scoreboards: one canvas, shown at both ends of the bowl; the stadium system redraws it
  const sc = makeCanvas(512, 256), scTex = canvasTex(sc, false), boards = [];
  for (const s of [-1, 1]) { const [bx, bz] = ring(s > 0 ? 0 : Math.PI, S.rows * S.tread + 1); GB.box('B', '#20262f', 1, 9, 17, bx + s * 0.6, rowY(S.rows - 1) + 6, bz); const m = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshBasicMaterial({ map: scTex })); m.position.set(bx, rowY(S.rows - 1) + 6, bz); m.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2; group.add(m); boards.push(m); }

  // ---- the Expo grounds ------------------------------------------------------------------------
  // a glass dome on a ring of light
  const dome = new THREE.Mesh(new THREE.SphereGeometry(22, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#9fd4ff', roughness: 0.08, metalness: 0.9, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
  dome.position.set(E.x - 40, 0, E.z - 40); dome.matrixAutoUpdate = false; dome.updateMatrix(); group.add(dome);
  GB.ring('G', '#59e0ff', 21.6, 22.4, E.x - 40, 0.06, E.z - 40, 48); for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; GB.box('S', '#c9d2de', 0.3, 0.3, 0.3, E.x - 40 + Math.cos(a) * 21.8, 0.3, E.z - 40 + Math.sin(a) * 21.8); }
  GB.blob('B', '#2f8f5a', 9, 6, 9, E.x - 40, 4, E.z - 40, 1); GB.blob('B', '#3a9a52', 5, 7, 5, E.x - 34, 6, E.z - 44, 2);                    // a garden inside it
  col.box(E.x - 56, E.x - 24, 0, 10, E.z - 56, E.z - 24);
  // the spiral tower: plates turning as they rise
  const tx = E.x + 30, tz = E.z - 50; for (let k = 0; k < 26; k++) GB.box('B', k % 2 ? '#e9edf2' : '#c9d2de', 9, 1.6, 9, tx, 1 + k * 2.2, tz, k * 0.22); GB.box('G', '#ffd34d', 1, 4, 1, tx, 60, tz); col.box(tx - 6, tx + 6, 0, 60, tz - 6, tz + 6);
  // the flag plaza
  GB.quad('S', '#8d9199', 40, 30, E.x, -0.01, E.z + 8); GB.cyl('B', '#6a7280', 3, 3.3, 0.6, E.x, 0.3, E.z + 8, 16); GB.cyl('G', '#9fe9ff', 0.3, 0.3, 4, E.x, 2.6, E.z + 8, 8); col.box(E.x - 2.4, E.x + 2.4, 0, 0.6, E.z - 2.4 + 8, E.z + 2.4 + 8, { noCam: true });
  ['#c0483f', '#2f6f8f', '#d9b23a', '#2f8f5a', '#6b4fa0', '#e9edf2', '#ff7ad9', '#59e0ff'].forEach((c, k) => { const x = E.x - 17.5 + k * 5, z = E.z - 6; GB.cyl('S', '#c9d2de', 0.08, 0.1, 9, x, 4.5, z, 6); GB.box('S', c, 0.05, 1.4, 2.2, x, 8, z + 1.15); col.box(x - 0.12, x + 0.12, 0, 9, z - 0.12, z + 0.12, { noCam: true }); });
  // the Expo Hall: a wave roof over a hall you can walk into
  const H = { x0: E.x - 18, x1: E.x + 18, z0: E.z + 26, z1: E.z + 46 };
  const st = room(kit, { id: 'expo', name: 'Expo Hall', x0: H.x0, x1: H.x1, z0: H.z0, z1: H.z1, h: 6, door: 'N', dw: 4, wall: '#3a3f4a', floor: '#6f7480', lamp: '#eaf6ff', staffed: true });
  counter(kit, H.x1 - 8, H.x1 - 2, H.z1 - 4.4, H.z1 - 3.6, 0, '#dfe5ee'); st.counter = { x: H.x1 - 5, y: 0, z: H.z1 - 5.4 }; st.keeper = { x: H.x1 - 5, y: 0, z: H.z1 - 2.4, yaw: Math.PI };
  const exhibits = [];
  [['The first Skyhaven deck', 'In 2181 the first deck rose on twelve repulsor columns and stayed up for nine minutes. The twelfth try held for good.', '#59e0ff'],
   ['Sea farms', 'Kelp, oysters and pearl broth: a third of the city\'s food comes from the bay. The farms sit four metres down, under the jet-skis.', '#7dff9c'],
   ['The maglev ring', 'Line 7 has carried two billion people without one minute of delay. That is the official figure. Locals disagree.', '#ffd34d'],
   ['Printed food', 'Every dish in Printed Petal starts as a cartridge. The chef still salts it by hand.', '#ff7ad9'],
   ['The canal', 'Dug in 2203 to drain the park lake, sunk in 2219 so boats could pass under the new bridges.', '#9fe9ff'],
   ['Robots at home', 'The first household androids could fold a towel in eleven minutes. Aster does it in four seconds, and complains.', '#c9a8ff']].forEach(([name, text, c], k) => {
    const x = H.x0 + 5 + (k % 3) * 9, z = H.z0 + 6 + Math.floor(k / 3) * 8;
    kit.cyl(lit('#20262f', 0.2), 1.1, 1.3, 0.9, x, 0.45, z, 16); kit.box(lit(c, 0.9), 0.06, 0.06, 0.06, x, 0.95, z);
    col.box(x - 1.2, x + 1.2, 0, 0.9, z - 1.2, z + 1.2, { noCam: true });
    exhibits.push({ name, text, c, x, z, pos: { x, y: 0, z: z + 1.8 } });
  });
  kit.finish(group, E.x, E.z + 36, ctx.rooms);
  for (let k = 0; k < 9; k++) { const x = H.x0 - 1 + k * 4.75, y = 7 + Math.sin(k * 0.8) * 1.6; GB.box('B', '#e9edf2', 4.9, 0.5, H.z1 - H.z0 + 4, x, y, (H.z0 + H.z1) / 2); }   // the wave roof
  GB.box('G', '#59e0ff', 36, 0.3, 0.3, E.x, 6.2, H.z0 - 0.2);
  const hallSign = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.6), new THREE.MeshBasicMaterial({ map: labelTexture('EXPO HALL', { color: '#cfefff', size: 70, sub: 'the city, how it was made' }), transparent: true, depthWrite: false }));
  hallSign.position.set(E.x, 4.6, H.z0 - 0.35); hallSign.rotation.y = Math.PI; group.add(hallSign);
  // spinning holograms over the exhibits (moved by the stadium system)
  const holos = exhibits.map((e) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(e.c).multiplyScalar(1.4), wireframe: true })); m.position.set(e.x, 1.9, e.z); group.add(m); return m; });
  // a landing pad by the plaza
  { const px = E.x + 32, pz = E.z + 14, r = 6.5; GB.cyl('S', '#1a1f29', r, r, 0.1, px, 0.05, pz, 32); GB.ring('G', '#4de1ff', r - 0.45, r, px, 0.13, pz, 40); GB.ring('G', '#4de1ff', r * 0.42, r * 0.42 + 0.2, px, 0.13, pz, 28); ctx.city.pads.push({ id: 'expoPad', name: 'Expo grounds', x: px, y: 0.1, z: pz, r, charger: false, priv: false, taxi: true }); }
  void M; void std; void mergeGeometries; void MATS;
  return { gate, exhibits, holos, boards, scCanvas: sc, scTex, hall: st, plaza: { x: E.x, y: 0, z: E.z + 14 } };
}
