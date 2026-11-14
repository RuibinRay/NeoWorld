// Street-level detail on demand. The map is cut into 240 m tiles of 2 x 2 blocks; tiles near
// the player are built one block per frame from the layout data and freed again when far
// away, so memory and draw calls follow what is around you, not the size of the map.
import * as THREE from 'three';
import { Builder, disposeGroup } from './builder.js';
import { draw, tree } from './furniture.js';
import { dressBuilding, signMaterial } from './buildings.js';
import { drawStreets, signalState } from './streets.js';
import { P, NB } from './landuse.js';

const T = 240, SIG = [new THREE.Color(0.1, 2.2, 0.5), new THREE.Color(2.4, 1.5, 0.1), new THREE.Color(2.6, 0.15, 0.1)], OFF = new THREE.Color(0.03, 0.03, 0.035);
const sigGeo = new THREE.BoxGeometry(0.24, 0.24, 0.24), sigMat = new THREE.MeshBasicMaterial();

export class Stream {
  constructor(scene, metro, poolMat) {
    this.scene = scene; this.metro = metro; this.poolMat = poolMat; this.tiles = new Map(); this.job = null; this.radius = 400; this.B = new Builder(); this.sigT = 0; this.built = 0; this.worst = 0; this.total = 0; this.steps = 0;
  }
  key(I, J) { return I * 1000 + J; }
  // focus: where the player (or their vehicle) is. One block of one tile is built per call at most.
  update(focus, dt, t, night = 1) {
    const R = this.radius * (focus.y > 260 ? 0.55 : 1), I0 = Math.floor((focus.x + 60 - R) / T), I1 = Math.floor((focus.x + 60 + R) / T), J0 = Math.floor((focus.z + 60 - R) / T), J1 = Math.floor((focus.z + 60 + R) / T);
    let best = null, bd = Infinity;
    for (let I = I0; I <= I1; I++) for (let J = J0; J <= J1; J++) {
      if (I * 2 > NB || I * 2 + 1 < -NB || J * 2 > 10 || J * 2 + 1 < -NB) continue;
      const d = Math.hypot(I * T + 60 - focus.x, J * T + 60 - focus.z);
      if (d > R + 10 || this.tiles.has(this.key(I, J))) continue;
      if (d < bd) { bd = d; best = [I, J]; }
    }
    if (!this.job && best) this.job = { I: best[0], J: best[1], n: 0, sigs: [] };
    if (this.job) {
      // four frames for the four blocks, then one to turn the buffers into meshes
      const j = this.job, t0 = performance.now();
      if (j.n < 4) { this.block(j.I * 2 + (j.n & 1), j.J * 2 + (j.n >> 1), j.sigs); j.n++; } else this.finish(j);
      const ms = performance.now() - t0; if (ms > this.worst) this.worst = ms; this.total += ms; this.steps++;
    }
    // free tiles that are well out of range
    for (const [k, tile] of this.tiles) if (Math.hypot(tile.x - focus.x, tile.z - focus.z) > R + 150) { disposeGroup(tile.group); if (tile.sig) tile.sig.dispose(); this.tiles.delete(k); }
    this.sigT -= dt; if (this.sigT <= 0) { this.sigT = 0.25; for (const tile of this.tiles.values()) { if (tile.sig) this.signals(tile, t); if (tile.pool) tile.pool.visible = night > 0.02; } }
  }
  block(i, j, sigs) {
    const m = this.metro, b = m.block(i, j), B = this.B;
    if (!b) return;
    for (const p of b.props) draw[p[0]](B, p[1], (p[0] === 'pod' ? 0 : b.y0) + (p[5] || 0), p[2], p[3], p[4]);
    for (const [x, z, s, kind, up] of b.trees) tree(B, x, b.y0 + (up || 0), z, s, kind);
    for (const bl of b.bld) dressBuilding(B, bl, b);
    drawStreets(B, b, m.yAt, sigs, m.railOpen);
    const extra = m.detailers[b.use]; if (extra) extra(B, b);
  }
  finish(j) {
    const group = this.B.finish(new THREE.Group(), this.poolMat, signMaterial()), tile = { group, x: j.I * T + 60, z: j.J * T + 60, sigs: j.sigs, sig: null, state: '', pool: group.children.find((o) => o.material === this.poolMat) || null };
    if (j.sigs.length) {
      const im = new THREE.InstancedMesh(sigGeo, sigMat, j.sigs.length), mt = new THREE.Matrix4();
      j.sigs.forEach((s, n) => { mt.makeTranslation(s.x, s.y, s.z); im.setMatrixAt(n, mt); im.setColorAt(n, OFF); });
      im.computeBoundingSphere(); group.add(im); tile.sig = im;
    }
    this.scene.add(group); this.tiles.set(this.key(j.I, j.J), tile); this.job = null; this.built++;
  }
  signals(tile, t) {
    let key = ''; const st = new Map();
    for (const s of tile.sigs) { const k = s.i * 100 + s.j; if (!st.has(k)) { const v = signalState(s.i, s.j, t); st.set(k, v); key += v.ns + '' + v.ew; } }
    if (key === tile.state) return; tile.state = key;
    tile.sigs.forEach((s, n) => { const v = st.get(s.i * 100 + s.j)[s.axis]; tile.sig.setColorAt(n, (v === 0 && s.k === 2) || (v === 1 && s.k === 1) || (v === 2 && s.k === 0) ? SIG[v] : OFF); });
    tile.sig.instanceColor.needsUpdate = true;
  }
  clear() { for (const tile of this.tiles.values()) { disposeGroup(tile.group); if (tile.sig) tile.sig.dispose(); } this.tiles.clear(); this.job = null; }
}
