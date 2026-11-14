// Static batching. Fixed geometry that shares a material is merged into one mesh; plain
// single-color materials (from std() and neon()) are merged even across colors, with the
// color moved into the vertices. A street of several hundred small parts becomes a few draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const plainStd = new Map();
const PLAIN_NEON = new THREE.MeshBasicMaterial({ vertexColors: true });
function plainClass(mat) {
  if (!mat.userData.plain) return null;
  if (mat.isMeshBasicMaterial) return { key: 'N', mat: PLAIN_NEON };
  const r = Math.round(mat.roughness * 4) / 4, m = Math.round(mat.metalness * 4) / 4, key = `S${r}:${m}`;
  let pm = plainStd.get(key);
  if (!pm) plainStd.set(key, (pm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: r, metalness: m })));
  return { key, mat: pm };
}

// items: [{ geo, mat, cast, receive }] with geo already in the parent's space (it is consumed).
// Returns the merged meshes; anything that cannot be merged comes back as a mesh of its own.
export function mergeItems(items) {
  const buckets = new Map();
  for (const it of items) {
    const cls = plainClass(it.mat);
    let g = it.geo, key;
    if (cls) {
      if (g.index) { const n = g.toNonIndexed(); g.dispose(); g = n; }
      for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
      const n = g.attributes.position.count, col = new Float32Array(n * 3), c = it.mat.color;
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      key = cls.key;
    } else key = `${it.mat.uuid}|${Object.keys(g.attributes).sort().join()}|${g.index ? 'i' : 'n'}`;
    key += `|${it.cast ? 1 : 0}${it.receive ? 1 : 0}`;
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { mat: cls ? cls.mat : it.mat, cast: it.cast, receive: it.receive, geos: [] }));
    b.geos.push(g);
  }
  const out = [];
  for (const b of buckets.values()) {
    const geo = b.geos.length > 1 ? mergeGeometries(b.geos) : b.geos[0];
    if (b.geos.length > 1) for (const g of b.geos) g.dispose();
    const m = new THREE.Mesh(geo, b.mat); m.castShadow = b.cast; m.receiveShadow = b.receive; out.push(m);
  }
  return out;
}

const _inv = new THREE.Matrix4(), _rel = new THREE.Matrix4();
// Merge the given meshes (descendants of parent) into parent, replacing them. Meshes with
// transparent or per-object materials are fine: they simply merge with their own kind.
export function mergeMeshes(parent, meshes) {
  if (meshes.length < 2) return 0;
  parent.updateMatrixWorld(true); _inv.copy(parent.matrixWorld).invert();
  const items = meshes.map((m) => ({ geo: m.geometry.clone().applyMatrix4(_rel.multiplyMatrices(_inv, m.matrixWorld)), mat: m.material, cast: m.castShadow, receive: m.receiveShadow }));
  for (const m of meshes) m.removeFromParent();
  const made = mergeItems(items);
  for (const m of made) parent.add(m);
  return made.length;
}
// Merge every plain mesh directly inside a group, except the ones listed (moving parts).
export function flatten(group, keep = []) {
  const skip = new Set(keep.filter(Boolean));
  return mergeMeshes(group, group.children.filter((m) => m.isMesh && !m.isInstancedMesh && !m.isSkinnedMesh && !skip.has(m) && !m.children.length && !Array.isArray(m.material) && !m.material.transparent));
}
