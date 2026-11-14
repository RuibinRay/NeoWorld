// Vehicle classes the player can own. Each model is a spec (handling, range, toughness,
// cargo) plus a procedural mesh. The flight model in entities/aerocar.js reads the spec.
import * as THREE from 'three';
import { std, neon } from '../world/materials.js';
import { flatten } from '../world/batch.js';

export const MODELS = {
  wisp: { name: 'Wisp', kind: 'Aerocar', price: 0, vFly: 72, vDrive: 30, acc: 26, accDrive: 17, turnFly: 1.45, turnDrive: 1.9, lift: 21, use: 1, tough: 1, cargo: 2, R: 2.0, ride: 0.72, cam: 9.5, paint: '#d9413a', desc: 'Your starter aerocar. Honest, forgiving, slightly underpowered.' },
  halo: { name: 'Halo', kind: 'Personal pod', price: 2400, vFly: 46, vDrive: 20, acc: 16, accDrive: 12, turnFly: 1.7, turnDrive: 2.2, lift: 17, use: 0.55, tough: 1.35, cargo: 1, R: 1.5, ride: 0.9, cam: 7.5, paint: '#e9edf2', desc: 'A glass bubble that sips power. Slow, calm, hard to crash badly.' },
  kestrel: { name: 'Kestrel', kind: 'Hoverbike', price: 5200, vFly: 80, vDrive: 48, acc: 34, accDrive: 30, turnFly: 2.1, turnDrive: 2.6, lift: 24, use: 1.25, tough: 0.6, cargo: 0, R: 1.2, ride: 0.62, cam: 6.5, open: true, paint: '#e2b93a', desc: 'Open saddle, violent acceleration, no patience for mistakes.' },
  atlas: { name: 'Atlas', kind: 'Cargo hauler', price: 7800, vFly: 50, vDrive: 24, acc: 15, accDrive: 11, turnFly: 0.95, turnDrive: 1.3, lift: 15, use: 1.35, tough: 1.8, cargo: 8, R: 2.9, ride: 1.05, cam: 13, paint: '#2a9d8f', desc: 'Eight crates a run. Handles like a building that learned to fly.' },
  vanta: { name: 'Vanta GT', kind: 'Electric supercar', price: 14500, vFly: 96, vDrive: 62, acc: 38, accDrive: 26, turnFly: 1.6, turnDrive: 1.7, lift: 23, use: 1.5, tough: 0.9, cargo: 1, R: 2.1, ride: 0.6, cam: 10, paint: '#1b2233', desc: 'The fastest thing a resident may legally own. It drinks battery.' },
};
export const ORDER = ['wisp', 'halo', 'kestrel', 'atlas', 'vanta'];
// one-line comparison for menus
// real cruising speed: where thrust balances drag (the same numbers the flight model uses)
const cruise = (acc, vmax, drag) => (acc / (acc / vmax + drag)) * 3.6;
export const statLine = (m) => `${Math.round(cruise(m.acc, m.vFly, 0.2))} km/h in flight · ${Math.round(cruise(m.accDrive, m.vDrive, 0.35))} km/h on the street · range ${m.use < 0.8 ? 'long' : m.use < 1.3 ? 'normal' : 'short'} · ${m.cargo} crate${m.cargo === 1 ? '' : 's'}`;

const SPH = new THREE.SphereGeometry(1, 24, 14), BOX = new THREE.BoxGeometry(1, 1, 1);
const POD = new THREE.CylinderGeometry(0.42, 0.46, 0.24, 18), RING = new THREE.CylinderGeometry(0.34, 0.34, 0.04, 18);

export function buildVehicle(id, paintHex) {
  const g = new THREE.Group();
  const paintMat = new THREE.MeshStandardMaterial({ color: paintHex, roughness: 0.22, metalness: 0.7 });
  const podMat = new THREE.MeshBasicMaterial({ color: 0x59e0ff });
  const dark = std('#14171d', 0.4, 0.8), white = neon('#f4fbff', 2.2), red = neon('#ff2a2a', 1.8), cyan = neon('#59e0ff', 1.2);
  const glass = () => new THREE.MeshStandardMaterial({ color: '#0d1420', roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.5 });
  const add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = cast; g.add(m); return m; };
  const pods = (list) => { for (const [x, y, z, r = 1] of list) { add(POD, dark, x, y, z, r, 1, r); add(RING, podMat, x, y - 0.13, z, r, 1, r, false); } };
  const skid = (x, y, z, w, h, l) => ({ m: add(BOX, dark, x, y, z, w, h, l), y, h });
  let canopy = null, skids = [], seat, eye;
  if (id === 'halo') {
    canopy = add(SPH, glass(), 0, 0.3, 0, 1.25, 1.2, 1.25, false); canopy.material.opacity = 0.32;
    add(new THREE.CylinderGeometry(1.3, 1.15, 0.36, 24), paintMat, 0, -0.55, 0);
    add(new THREE.CylinderGeometry(1.33, 1.33, 0.05, 28), cyan, 0, -0.4, 0, 1, 1, 1, false);
    pods([[0, -0.7, 0.95, 0.9], [-0.85, -0.7, -0.55, 0.9], [0.85, -0.7, -0.55, 0.9]]);
    add(BOX, white, 0, -0.5, 1.28, 0.6, 0.06, 0.06, false); add(BOX, red, 0, -0.5, -1.28, 0.6, 0.06, 0.06, false);
    add(BOX, dark, 0, -0.2, 0.75, 0.9, 0.14, 0.3);
    skids = [skid(-0.6, -0.84, 0, 0.1, 0.12, 1.4), skid(0.6, -0.84, 0, 0.1, 0.12, 1.4)];
    seat = [0, -0.66, -0.05]; eye = [0, 0.48, 0.2];
  } else if (id === 'kestrel') {
    add(BOX, paintMat, 0, 0, 0, 0.42, 0.3, 2.0); add(SPH, paintMat, 0, 0.02, 1.15, 0.3, 0.22, 0.62);
    add(BOX, dark, 0, 0.2, -0.3, 0.36, 0.1, 0.72); add(BOX, dark, 0, 0.42, 0.55, 0.9, 0.05, 0.06); add(BOX, dark, 0, 0.3, 0.55, 0.06, 0.26, 0.06);
    const ws = add(BOX, glass(), 0, 0.52, 0.78, 0.5, 0.32, 0.04, false); ws.rotation.x = -0.5;
    pods([[0, -0.2, 0.95, 0.85], [0, -0.2, -0.85, 0.95]]);
    add(BOX, white, 0, 0.05, 1.74, 0.3, 0.06, 0.06, false); add(BOX, red, 0, 0.12, -1.02, 0.34, 0.06, 0.06, false);
    for (const sx of [-1, 1]) add(BOX, cyan, sx * 0.22, 0, 0, 0.02, 0.05, 1.6, false);
    skids = [skid(0, -0.5, 0, 0.5, 0.2, 0.9)];
    seat = [0, -0.36, -0.28]; eye = [0, 1.0, 0.05];
  } else if (id === 'vanta') {
    add(SPH, paintMat, 0, 0, 0, 1.15, 0.34, 2.6); add(BOX, dark, 0, -0.26, -0.05, 2.0, 0.24, 3.9);
    canopy = add(SPH, glass(), 0, 0.2, -0.1, 0.8, 0.44, 1.05, false);
    pods([[-1.22, -0.24, 1.55, 1.05], [1.22, -0.24, 1.55, 1.05], [-1.22, -0.24, -1.55, 1.05], [1.22, -0.24, -1.55, 1.05]]);
    add(BOX, paintMat, 0, 0.52, -2.3, 2.3, 0.05, 0.36); for (const sx of [-1, 1]) add(BOX, dark, sx * 0.8, 0.36, -2.3, 0.05, 0.3, 0.2);
    add(BOX, white, 0, -0.14, 2.42, 1.5, 0.05, 0.06, false); add(BOX, red, 0, 0.0, -2.56, 1.8, 0.05, 0.06, false);
    for (const sx of [-1, 1]) add(BOX, neon('#ff7ad9', 1.3), sx * 1.12, -0.1, 0, 0.03, 0.04, 3.2, false);
    add(BOX, dark, 0, 0.0, 1.0, 1.2, 0.14, 0.36); add(BOX, cyan, 0, 0.09, 0.86, 0.9, 0.02, 0.04, false);
    skids = [skid(-0.8, -0.5, 0.1, 0.12, 0.2, 2.6), skid(0.8, -0.5, 0.1, 0.12, 0.2, 2.6)];
    seat = [0, -0.74, -0.05]; eye = [0, 0.3, 0.22];
  } else if (id === 'atlas') {
    add(BOX, paintMat, 0, 0.25, -0.4, 2.6, 1.5, 3.8); add(BOX, dark, 0, -0.42, 0, 2.7, 0.2, 5.0);
    canopy = add(BOX, glass(), 0, 0.5, 1.95, 2.3, 0.9, 1.1, false); add(BOX, paintMat, 0, -0.1, 2.0, 2.5, 0.5, 1.2);
    pods([[-1.6, -0.5, 1.7, 1.15], [1.6, -0.5, 1.7, 1.15], [-1.6, -0.5, 0, 1.15], [1.6, -0.5, 0, 1.15], [-1.6, -0.5, -1.7, 1.15], [1.6, -0.5, -1.7, 1.15]]);
    add(BOX, white, 0, 0.0, 2.62, 2.0, 0.08, 0.06, false); add(BOX, red, 0, 0.4, -2.32, 2.2, 0.08, 0.06, false);
    for (const sx of [-1, 1]) { add(BOX, neon('#ffb347', 1.5), sx * 1.31, 0.95, -0.4, 0.03, 0.06, 3.6, false); add(BOX, dark, sx * 1.31, 0.2, -0.4, 0.02, 1.1, 0.04); }
    add(BOX, dark, 0, 0.3, 1.7, 1.6, 0.16, 0.34);
    skids = [skid(-1.1, -0.86, 0, 0.18, 0.3, 4), skid(1.1, -0.86, 0, 0.18, 0.3, 4)];
    seat = [0, -0.32, 1.72]; eye = [0, 0.78, 2.0];
  } else { // wisp
    add(SPH, paintMat, 0, 0, 0, 1.0, 0.44, 2.3); add(BOX, dark, 0, -0.3, -0.05, 1.7, 0.34, 3.5);
    canopy = add(SPH, glass(), 0, 0.3, 0.15, 0.76, 0.62, 1.25, false);
    pods([[-1.08, -0.26, 1.38], [1.08, -0.26, 1.38], [-1.08, -0.26, -1.38], [1.08, -0.26, -1.38]]);
    add(BOX, white, 0, -0.2, 2.12, 1.1, 0.06, 0.06, false); add(BOX, red, 0, 0.02, -2.26, 1.2, 0.06, 0.06, false);
    for (const sx of [-1, 1]) { add(BOX, cyan, sx * 0.98, -0.08, 0, 0.03, 0.04, 2.6, false); add(BOX, paintMat, sx * 0.62, 0.36, -1.75, 0.06, 0.42, 0.7); }
    add(BOX, dark, 0, 0.06, 1.12, 1.2, 0.18, 0.4); add(BOX, cyan, 0, 0.17, 0.95, 0.9, 0.02, 0.04, false); add(BOX, dark, 0, 0.02, 0.78, 0.34, 0.05, 0.08);
    skids = [skid(-0.7, -0.6, 0.2, 0.12, 0.24, 2.4), skid(0.7, -0.6, 0.2, 0.12, 0.24, 2.4)];
    seat = [0, -0.72, 0.12]; eye = [0, 0.42, 0.3];
  }
  flatten(g, [canopy, ...skids.map((s) => s.m)]); // fixed body parts become a handful of meshes; the canopy and landing skids still move
  return { g, paintMat, podMat, canopy, skids, seat: new THREE.Vector3(...seat), eye: new THREE.Vector3(...eye) };
}
