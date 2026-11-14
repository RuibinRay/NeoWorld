// Diving off the coast. In deep water, C dives and holds you down, Space rises; you have about
// thirty seconds of breath. Below the surface: a seabed that shelves down to 16 m, reefs, seaweed,
// schools of fish, a sunken freighter with a sealed crate inside, and six lost data pods on the reefs. When the camera is under
// the surface, the water turns blue and murky and the sky goes dark. The seabed is only drawn
// then; for everything else (boats, the aerocar, walking on the beach) the sea keeps its old flat floor.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { clamp, RNG } from '../core/util.js';
import { coastZ, inCanal } from '../world/metro/landuse.js';
import { std, neon } from '../world/materials.js';
import { mergeMeshes } from '../world/batch.js';
import { money } from '../ui/ui.js';

export const BREATH = 30;
export const seabedY = (x, z) => { const d = z - coastZ(x); if (d <= 0) return 0; return -(Math.min(1, d / 10) * 1.6 + Math.min(1, Math.max(0, d - 10) / 150) * 14.4); };
const WRECK = { x: 900, z: 1470 };

export class Diving {
  constructor() {
    const rng = new RNG(5150), group = (this.group = new THREE.Group()); group.visible = false; G.scene.add(group);
    // the seabed: a strip along the whole coast, sand near the shore going to dark silt
    {
      const xs = [], rows = [0, 4, 10, 20, 35, 55, 80, 110, 150, 200, 260, 340, 440];
      for (let x = -1600; x <= 1600; x += 40) xs.push(x);
      const pos = [], col = [], idx = [], c = new THREE.Color(), sand = new THREE.Color('#c9b68f'), mid = new THREE.Color('#6f8a82'), deep = new THREE.Color('#2f4a55');
      for (const x of xs) for (const d of rows) { const z = coastZ(x) + d, y = seabedY(x, z) - 0.05; pos.push(x, y, z); const k = clamp(-y / 16, 0, 1); c.copy(sand).lerp(mid, Math.min(1, k * 2)).lerp(deep, Math.max(0, k * 2 - 1)); const n = 0.92 + rng.next() * 0.12; col.push(c.r * n, c.g * n, c.b * n); }
      const R = rows.length;
      for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < R - 1; j++) { const a = i * R + j, b = (i + 1) * R + j; idx.push(a, a + 1, b, b, a + 1, b + 1); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide })); m.receiveShadow = false; group.add(m);
    }
    // reefs: clusters of coral and rock; seaweed; all instanced
    const blobs = [], weed = [], CORAL = ['#ff7a8a', '#ffb347', '#d96ad9', '#7dd6c4', '#e9d36a', '#8a7a6a', '#6a7a8a'];
    this.reefs = [];
    for (let k = 0; k < 46; k++) {
      const x = -300 + rng.next() * 1700, z = coastZ(x) + 30 + rng.next() * 260, y = seabedY(x, z); this.reefs.push({ x, y, z });
      for (let n = 0; n < 7; n++) blobs.push([x + (rng.next() - 0.5) * 7, y, z + (rng.next() - 0.5) * 7, 0.4 + rng.next() * 1.3, CORAL[rng.int(0, CORAL.length - 1)]]);
      for (let n = 0; n < 9; n++) weed.push([x + (rng.next() - 0.5) * 12, y, z + (rng.next() - 0.5) * 12, 1 + rng.next() * 2.2]);
    }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
    const bm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), blobs.length);
    blobs.forEach(([x, y, z, r, hex], i) => { e.set(rng.next() * 3, rng.next() * 3, 0); q.setFromEuler(e); m4.compose(v.set(x, y + r * 0.4, z), q, s.set(r, r * (0.6 + rng.next() * 0.8), r)); bm.setMatrixAt(i, m4); bm.setColorAt(i, c.set(hex)); });
    bm.computeBoundingSphere(); group.add(bm);
    const wm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 1, 0.05), new THREE.MeshStandardMaterial({ color: '#3f8f5a', roughness: 0.8 }), weed.length);
    weed.forEach(([x, y, z, h], i) => { e.set((rng.next() - 0.5) * 0.4, rng.next() * 3, (rng.next() - 0.5) * 0.4); q.setFromEuler(e); m4.compose(v.set(x, y + h / 2, z), q, s.set(1, h, 1)); wm.setMatrixAt(i, m4); });
    wm.computeBoundingSphere(); group.add(wm);
    // fish: schools circling over the reefs
    const fg = new THREE.ConeGeometry(0.12, 0.5, 5); fg.rotateX(Math.PI / 2);
    this.fish = new THREE.InstancedMesh(fg, new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.4 }), 160); this.fish.frustumCulled = false;
    this.schools = [];
    for (let k = 0; k < 8; k++) { const r = this.reefs[(k * 5) % this.reefs.length]; this.schools.push({ x: r.x, y: Math.min(-3, r.y + 3 + rng.next() * 3), z: r.z, rad: 5 + rng.next() * 7, sp: (0.3 + rng.next() * 0.3) * (k % 2 ? 1 : -1), col: ['#ffd34d', '#59e0ff', '#ff7a8a', '#e9eef5'][k % 4] }); }
    for (let i = 0; i < 160; i++) this.fish.setColorAt(i, c.set(this.schools[i % 8].col));
    group.add(this.fish);
    // the wreck: a freighter broken in two on its side, containers spilled round it
    {
      const wy = seabedY(WRECK.x, WRECK.z), hull = std('#5a3a2e', 0.9, 0.3), rust = std('#7a4a32', 0.95, 0.2), dark = std('#2a2f38', 0.8, 0.3), parts = [], col = G.colliders;
      const box = (mat, w, h, d, x, y, z, rx = 0, rz = 0, solid = true) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(WRECK.x + x, wy + y, WRECK.z + z); m.rotation.set(rx, 0, rz); group.add(m); parts.push(m); if (solid) col.box(WRECK.x + x - w / 2, WRECK.x + x + w / 2, wy + y - h / 2, wy + y + h / 2, WRECK.z + z - d / 2, WRECK.z + z + d / 2, { noCam: true }); };
      box(hull, 9, 7, 26, 0, 3, -17, 0, 0.28); box(hull, 9, 6, 22, 1, 2.6, 12, 0.12, -0.32); box(rust, 6, 5, 7, -1, 7.5, -24, 0, 0.28); box(dark, 1, 6, 1, -2, 12, -24, 0, 0.3, false);
      for (let k = 0; k < 7; k++) box([std('#c0483f', 0.8, 0.3), std('#2f6f8f', 0.8, 0.3), std('#d9b23a', 0.8, 0.3)][k % 3], 2.4, 2.6, 6, -10 + k * 3.5 + rng.next(), 1.3, -2 + (rng.next() - 0.5) * 8, 0, (rng.next() - 0.5) * 0.6);
      mergeMeshes(group, parts);
      // the sealed crate, in the gap between the two halves
      this.crate = new THREE.Group(); this.crate.position.set(WRECK.x + 1, wy, WRECK.z - 2.5); group.add(this.crate);
      const cb = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.9), std('#3a4250', 0.6, 0.5)); cb.position.y = 0.45; this.crate.add(cb);
      this.seal = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.08, 0.94), neon('#7fe9ff', 2)); this.seal.position.y = 0.6; this.crate.add(this.seal);
      G.interact.add({ pos: { x: WRECK.x + 1, y: wy, z: WRECK.z - 1.3 }, r: 2.4, yTol: 3, label: 'Open the sealed crate', enabled: () => !G.state.done.wreck, use: () => this.openCrate() });
      this.wreckY = wy;
    }
    // six data pods lost off the coast, each lying by a reef and glowing so you can find it in the murk
    this.pods = [];
    const podGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.7, 10), ringGeo = new THREE.TorusGeometry(0.42, 0.05, 6, 20), podMat = std('#e9eef5', 0.3, 0.6), glowMat = neon('#7fe9ff', 2.2);
    const picks = [...this.reefs].sort((a, b) => a.x - b.x).filter((_, i, l) => i % Math.max(1, Math.floor(l.length / 6)) === 0).slice(0, 6);
    picks.forEach((r, k) => {
      const x = r.x + 3, z = r.z + 2, y = seabedY(x, z), g = new THREE.Group(); g.position.set(x, y + 0.35, z); g.rotation.z = 1.2;
      const body = new THREE.Mesh(podGeo, podMat), ring = new THREE.Mesh(ringGeo, glowMat); ring.rotation.x = Math.PI / 2; g.add(body, ring); group.add(g);
      const pod = { k, x, y, z, g };
      G.interact.add({ pos: { x, y, z }, r: 2.2, yTol: 3, label: 'Recover the data pod', enabled: () => !G.state.done['pod:' + k] && G.player.dive, use: () => this.recover(pod) });
      this.pods.push(pod);
    });
    // bubbles from you while you dive
    const bmat = new THREE.MeshBasicMaterial({ color: '#dff6ff', transparent: true, opacity: 0.55, depthWrite: false });
    this.bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 4), bmat, 24); this.bubbles.frustumCulled = false; group.add(this.bubbles); this.bub = Array.from({ length: 24 }, (_, i) => ({ x: 0, y: -100, z: 0, t: i / 24 }));
    // the tint over the screen when your eyes are under the water
    const ov = (this.overlay = document.createElement('div'));
    ov.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5;opacity:0;transition:opacity .25s;background:radial-gradient(ellipse at 50% 30%, rgba(40,140,170,0.10), rgba(4,40,60,0.55))';
    document.body.appendChild(ov);
    this.m4 = m4; this.q = q; this.e = e; this.v = v; this.s = s; this.under = 0; this.tipped = false;
  }
  bedAt(x, z) { return seabedY(x, z); }
  // is this open sea (not the canal, not the park lake)?
  sea(x, z) { return z > coastZ(x) && !inCanal(x, z); }
  recover(pod) {
    const d = G.state.done; d['pod:' + pod.k] = true; pod.g.visible = false; G.economy.earn(60, 'a recovered data pod');
    const n = this.pods.filter((q) => d['pod:' + q.k]).length;
    if (n === this.pods.length) { G.economy.earn(200, 'all six data pods'); d.pods = true; G.ui.flash('ALL PODS RECOVERED', 2.2); G.ui.toast(`That is all six data pods. The port pays a finder\'s fee: ${money(260)}.`, 'good'); }
    else G.ui.toast(`Data pod recovered (${n} of ${this.pods.length}). ${money(60)}.`, 'good');
    if (G.audio) G.audio.ui('pay'); G.save.write(true);
  }
  openCrate() {
    G.state.done.wreck = true; this.seal.visible = false; G.economy.earn(300, 'salvage from the wreck');
    G.ui.flash('SALVAGE', 2); G.ui.toast(`The crate holds an old navigation core, still sealed. The port pays salvage: ${money(300)}.`, 'good');
  }
  // after the sky has set the fog for the frame: when the camera is under the surface, the sea closes in
  apply(cam, dt, t) {
    const p = G.player, inSea = this.sea(cam.x, cam.z), lvl = 0.02 + (inSea ? 0 : 0), eyes = inSea && cam.y < lvl - 0.05;
    this.under = eyes ? 1 : 0;
    this.overlay.style.opacity = eyes ? 1 : 0;
    if (G.env.skyMat) G.env.skyMat.uniforms.under.value = this.under;
    this.group.visible = eyes || (p.dive && inSea);
    if (eyes) {
      const depth = clamp(-cam.y / 16, 0, 1), f = G.scene.fog;
      f.color.setRGB(0.03 + 0.02 * (1 - depth), 0.17 - 0.08 * depth, 0.23 - 0.08 * depth).multiplyScalar(1 - G.env.night * 0.75);
      f.density = 0.03 + depth * 0.02;
    }
    if (!this.group.visible) return;
    // fish
    const { m4, q, e, v, s } = this;
    for (let i = 0; i < 160; i++) {
      const sc = this.schools[i % 8], k = Math.floor(i / 8), a = t * sc.sp + k * 0.33, r = sc.rad + Math.sin(k * 1.7) * 2;
      v.set(sc.x + Math.cos(a) * r, sc.y + Math.sin(k * 2.3 + t * 0.6) * 1.2, sc.z + Math.sin(a) * r);
      e.set(0, a + (sc.sp > 0 ? 0 : Math.PI) + Math.sin(t * 6 + k) * 0.15, 0); q.setFromEuler(e); m4.compose(v, q, s.set(1, 1, 1)); this.fish.setMatrixAt(i, m4);
    }
    this.fish.instanceMatrix.needsUpdate = true;
    // bubbles
    for (let i = 0; i < this.bub.length; i++) {
      const b = this.bub[i]; b.t += dt * 0.6;
      if (b.t > 1) { b.t = 0; if (p.dive) { b.x = p.pos.x + (Math.random() - 0.5) * 0.3; b.y = p.pos.y + 1.5; b.z = p.pos.z + (Math.random() - 0.5) * 0.3; } else b.y = -100; }
      const y = b.y + b.t * 4; m4.makeTranslation(b.x + Math.sin(t * 4 + i) * 0.05, y < lvl ? y : -100, b.z); this.bubbles.setMatrixAt(i, m4);
    }
    this.bubbles.instanceMatrix.needsUpdate = true;
    this.seal.material.color.setScalar(Math.sin(t * 3) > 0 ? 2 : 1);
    for (const q of this.pods) { q.g.visible = !G.state.done['pod:' + q.k]; q.g.rotation.y = t * 0.6 + q.k; }
  }
  // breath and the panel while you are under
  update(dt) {
    const p = G.player;
    if (!p.dive) { if (this.shown) { this.shown = false; G.ui.setObjective(null); } p.breath = Math.min(BREATH, (p.breath ?? BREATH) + dt * 6); return; }
    if (!this.tipped) { this.tipped = true; G.ui.toast('Diving: hold C to go down, Space to rise, Shift to swim faster. Watch your breath. There is a wreck out past the pier.', 'info'); }
    const depth = Math.max(0, 0.02 - (p.pos.y + 1.5)), under = depth > 0.1;
    p.breath = clamp((p.breath ?? BREATH) - (under ? dt : -dt * 6), 0, BREATH);
    if (p.breath <= 0 && !this.gasp) { this.gasp = true; G.ui.toast('Out of breath: back up to the surface.', 'warn'); }
    if (p.breath > 5) this.gasp = false;
    const k = Math.round((p.breath / BREATH) * 10);
    const left = this.pods.filter((q) => !G.state.done['pod:' + q.k]), near = left.reduce((m, q) => Math.min(m, Math.hypot(q.x - p.pos.x, q.y - p.pos.y, q.z - p.pos.z)), 1e9);
    const sonar = left.length ? ` · pods ${this.pods.length - left.length} of ${this.pods.length}, nearest about ${near < 15 ? 'here' : Math.round(near / 10) * 10 + ' m'}` : ' · all pods found';
    G.ui.setObjective({ title: 'Diving', text: `Breath ${'▮'.repeat(k)}${'▯'.repeat(10 - k)} · ${depth.toFixed(1)} m down`, sub: `C down · Space up · Shift faster${sonar}` }); this.shown = true;
  }
}
