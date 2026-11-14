// The body of every building in the grid, merged into one mesh per facade style (plus one for
// the roofs), so the whole skyline is always visible for about a dozen draw calls. Close-up detail is streamed
// separately (stream.js). Also registers each volume as a collider.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { M, towerGeometry } from '../materials.js';

export function buildShells(group, col, blocks) {
  const buckets = new Map(), roofs = [];
  let count = 0;
  for (const b of blocks) for (const bl of b.bld) {
    const mat = M.facades[bl.f] || M.facades.glass, key = bl.f;
    let bk = buckets.get(key); if (!bk) buckets.set(key, (bk = { mat, geos: [] }));
    for (const [x0, x1, z0, z1, y0, y1] of bl.boxes) {
      const w = x1 - x0, d = z1 - z0, h = y1 - y0, g = towerGeometry(w, h, d, mat.userData.tile);
      // no top or bottom face: the roof is its own flat mesh, so nothing flickers from above
      const idx = g.index.array, keep = new Uint16Array(24); keep.set(idx.subarray(0, 12)); keep.set(idx.subarray(24, 36), 12); g.setIndex(new THREE.BufferAttribute(keep, 1));
      g.translate((x0 + x1) / 2, y0 + h / 2, (z0 + z1) / 2); bk.geos.push(g);
      const rg = new THREE.PlaneGeometry(w, d); rg.rotateX(-Math.PI / 2); rg.translate((x0 + x1) / 2, y1, (z0 + z1) / 2); roofs.push(rg);
      col.box(x0, x1, y0, y1, z0, z1, { tag: 'tower' }); count++;
    }
  }
  for (const bk of buckets.values()) { const m = new THREE.Mesh(mergeGeometries(bk.geos), bk.mat); for (const g of bk.geos) g.dispose(); m.castShadow = true; m.receiveShadow = true; m.matrixAutoUpdate = false; group.add(m); }
  { const m = new THREE.Mesh(mergeGeometries(roofs), M.roof); for (const g of roofs) g.dispose(); m.receiveShadow = true; m.matrixAutoUpdate = false; group.add(m); }
  return count;
}
