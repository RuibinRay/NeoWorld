// Adapter that lets the shop-room builder (world/stores.js) work in the street grid: boxes are
// collected and merged per material, colliders and seats go to the shared city data.
import * as THREE from 'three';
import { mergeItems } from '../batch.js';

export function makeRoomKit(col, city) {
  const items = [];
  const push = (mat, geo) => items.push({ geo, mat, cast: false, receive: !mat.isMeshBasicMaterial });
  const k = {
    city, items,
    solid(mat, x0, x1, y0, y1, z0, z1, extra) { col.box(x0, x1, y0, y1, z0, z1, extra); if (mat) k.box(mat, x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); },
    box(mat, w, h, d, x, y, z) { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); push(mat, g); },
    flat(mat, w, d, x, y, z) { k.box(mat, w, 0.03, d, x, y, z); },
    cyl(mat, rt, rb, h, x, y, z, seg = 12) { const g = new THREE.CylinderGeometry(rt, rb, h, seg); g.translate(x, y, z); push(mat, g); },
    ball(mat, r, x, y, z, sy = 1) { const g = new THREE.IcosahedronGeometry(r, 1); g.scale(1, sy, 1); g.translate(x, y, z); push(mat, g); },
    seat(id, x, y, z, yaw, table) { city.seats.push({ id, kind: 'chair', x, y: y + 0.5, z, yaw, taken: null, table: table ? { x: table[0], y: y + 0.79, z: table[1] } : null, service: null }); },
    // a round table with two chairs facing each other across it (along x)
    table(id, x, y, z, mat, chair) { k.cyl(mat, 0.6, 0.6, 0.06, x, y + 0.75, z, 16); k.cyl(mat, 0.07, 0.2, 0.72, x, y + 0.37, z, 8); col.box(x - 0.45, x + 0.45, y, y + 0.78, z - 0.45, z + 0.45); for (const s of [-1, 1]) { k.box(chair, 0.5, 0.08, 0.5, x + s * 1.1, y + 0.46, z); k.box(chair, 0.08, 0.5, 0.5, x + s * 1.36, y + 0.72, z); k.seat(`${id}${s > 0 ? 'b' : 'a'}`, x + s * 1.1, y, z, s < 0 ? Math.PI / 2 : -Math.PI / 2, [x + s * 0.28, z]); } },
    abs: (x, y, z) => ({ x, y, z }),
    // merge what has been built into a group at (x, z) that the metro hides when it is far away
    finish(parent, x, z, list) { const g = new THREE.Group(); for (const m of mergeItems(items.splice(0))) { m.matrixAutoUpdate = false; g.add(m); } parent.add(g); list.push({ g, x, z }); return g; },
  };
  return k;
}
