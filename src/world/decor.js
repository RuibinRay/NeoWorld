// Furnishings you buy in the shops. Each is a small group built at the origin (standing on the
// floor, facing +z); a home places one of each and shows the ones you own.
import * as THREE from 'three';
import { M, std, neon } from './materials.js';
import { artUrl } from './art.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const lit = (hex, k = 0.25) => std(hex, 0.8, 0, { emissive: hex, emissiveIntensity: k });
// the framed city print: a Higgsfield picture of the city in 2190 (or the title picture)
let printMat = null;
function printMaterial() {
  const url = artUrl('print-meridian.jpg') || artUrl('title.jpg'); if (!url) return null;
  if (!printMat) { const t = new THREE.TextureLoader().load(url); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; printMat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.18 }); }
  return printMat;
}
export const DECOR_KEYS = ['records', 'vinyl', 'tea', 'lamp', 'books', 'print', 'plant', 'aquarium'];

export function makeDecor(key) {
  const g = new THREE.Group();
  const b = (mat, w, h, d, x, y, z) => { const m = new THREE.Mesh(BOX, mat); m.scale.set(w, h, d); m.position.set(x, y, z); g.add(m); return m; };
  const c = (mat, r0, r1, h, x, y, z, seg = 14) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat); m.position.set(x, y, z); g.add(m); return m; };
  const cols = ['#e2543d', '#f2c14e', '#59b8d9', '#e9e3d5', '#7a5cd6', '#2f8f5a', '#b23a48', '#2c3e63'];
  if (key === 'records') {
    b(lit('#5a3a26'), 1.7, 0.7, 0.5, 0, 0.35, 0); b(lit('#20262f'), 0.5, 0.08, 0.4, -0.45, 0.74, 0); c(lit('#101216'), 0.17, 0.17, 0.02, -0.45, 0.79, 0, 20); c(neon('#ffd34d', 1.2), 0.05, 0.05, 0.025, -0.45, 0.8, 0, 10);
    for (let i = 0; i < 8; i++) b(lit(cols[i % 8], 0.35), 0.04, 0.32, 0.32, 0.15 + i * 0.07, 0.87, 0);
  } else if (key === 'vinyl') {
    for (let i = 0; i < 12; i++) b(lit(cols[(i * 3) % 8], 0.4), 0.36, 0.36, 0.03, -0.66 + (i % 4) * 0.44, 1.25 + Math.floor(i / 4) * 0.44, 0);
  } else if (key === 'tea') {
    c(lit('#3a2f2a'), 0.26, 0.26, 0.02, 0, 0.01, 0, 18); c(lit('#2f6b55'), 0.07, 0.09, 0.12, -0.05, 0.08, 0); for (const x of [0.1, 0.17]) c(lit('#f1ede6'), 0.035, 0.028, 0.05, x, 0.045, x === 0.1 ? 0.08 : -0.06, 10);
  } else if (key === 'lamp') {
    c(lit('#20262f'), 0.09, 0.11, 0.03, 0, 0.015, 0); c(lit('#8a94a6'), 0.012, 0.012, 0.42, 0, 0.23, 0, 6); c(neon('#ffd9a0', 1.6), 0.07, 0.12, 0.14, 0, 0.48, 0, 12);
  } else if (key === 'books') {
    b(lit('#3a2a1e'), 2.0, 1.9, 0.34, 0, 0.95, 0);
    for (let r = 0; r < 4; r++) for (let i = 0; i < 16; i++) b(lit(cols[(i * 5 + r * 3) % 8], 0.35), 0.085, 0.3 + ((i * 7 + r) % 3) * 0.035, 0.05, -0.86 + i * 0.115, 0.3 + r * 0.44, 0.17);
  } else if (key === 'print') {
    b(lit('#15171c'), 1.7, 1.1, 0.04, 0, 1.9, 0);
    const pm = printMaterial(); if (pm) b(pm, 1.56, 0.88, 0.02, 0, 1.9, 0.025);
    else { b(lit('#28405c', 0.5), 1.56, 0.96, 0.02, 0, 1.9, 0.025); for (let i = 0; i < 9; i++) b(neon(['#59e0ff', '#ff7ad9', '#ffd34d'][i % 3], 0.9), 0.1, 0.2 + ((i * 5) % 6) * 0.1, 0.02, -0.64 + i * 0.16, 1.5 + (0.2 + ((i * 5) % 6) * 0.1) / 2, 0.04); }
  } else if (key === 'plant') {
    c(lit('#c9b68f'), 0.28, 0.2, 0.45, 0, 0.225, 0); for (const [x, y, z, s] of [[0, 0.85, 0, 0.5], [0.22, 0.7, 0.1, 0.32], [-0.2, 0.72, -0.12, 0.34]]) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), M.leaf); m.position.set(x, y, z); g.add(m); }
  } else if (key === 'aquarium') {
    b(lit('#20262f'), 1.6, 0.7, 0.5, 0, 0.35, 0);
    const water = b(new THREE.MeshStandardMaterial({ color: '#2f9ab8', roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.55, emissive: '#1d6f8a', emissiveIntensity: 0.6 }), 1.5, 0.6, 0.42, 0, 1.02, 0);
    water.renderOrder = 2; g.userData.fish = [0, 1, 2, 3].map((i) => b(neon(['#ffb347', '#ff7ad9', '#ffd34d', '#eaf6ff'][i], 1.1), 0.14, 0.06, 0.04, -0.5 + i * 0.3, 0.9 + (i % 2) * 0.2, 0));
  }
  g.traverse((m) => { if (m.isMesh) m.castShadow = false; });
  g.visible = false;
  return g;
}
