// Effects for fights. Each kind is one draw call however much is on screen:
//   glow   sparks, embers, energy motes (additive points)
//   soft   smoke and dust (blended points that grow as they fade)
//   beams  stretched boxes between two points: web lines, lightning, lasers, stretched arms
//   rings  expanding shockwaves
//   orbs   glowing balls: projectiles (held by their owner) and blasts (expand and fade)
// G.fx.shake(k) shakes the camera a little.
import * as THREE from 'three';
import { G } from '../core/game.js';

const col = new THREE.Color();

class Cloud {
  constructor(n, additive) {
    this.n = n; this.count = 0; this.additive = additive;
    this.p = new Float32Array(n * 3); this.v = new Float32Array(n * 3); this.c = new Float32Array(n * 4); this.base = new Float32Array(n * 4); this.s = new Float32Array(n);
    this.life = new Float32Array(n); this.max = new Float32Array(n); this.s0 = new Float32Array(n); this.s1 = new Float32Array(n); this.grav = new Float32Array(n); this.drag = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', (this.pa = new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage)));
    g.setAttribute('rgba', (this.ca = new THREE.BufferAttribute(this.c, 4).setUsage(THREE.DynamicDrawUsage)));
    g.setAttribute('size', (this.sa = new THREE.BufferAttribute(this.s, 1).setUsage(THREE.DynamicDrawUsage)));
    g.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { scale: { value: 600 } },
      vertexShader: 'attribute float size; attribute vec4 rgba; varying vec4 vC; uniform float scale; void main(){ vC = rgba; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = min(256.0, size * scale / max(0.1, -mv.z)); gl_Position = projectionMatrix * mv; }',
      fragmentShader: additive
        ? 'varying vec4 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d, d); if (r > 0.25) discard; gl_FragColor = vec4(vC.rgb * vC.a * smoothstep(0.25, 0.0, r) * 1.6, 1.0); }'
        : 'varying vec4 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d, d); if (r > 0.25) discard; gl_FragColor = vec4(vC.rgb, vC.a * smoothstep(0.25, 0.02, r)); }',
    });
    this.mesh = new THREE.Points(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = additive ? 3 : 2;
  }
  emit(x, y, z, vx, vy, vz, hex, life, s0, s1, grav, drag, a = 1) {
    let i = this.count;
    if (i >= this.n) i = Math.floor(Math.random() * this.n); else this.count++;
    const p = i * 3, c = i * 4; col.set(hex);
    this.p[p] = x; this.p[p + 1] = y; this.p[p + 2] = z; this.v[p] = vx; this.v[p + 1] = vy; this.v[p + 2] = vz;
    this.base[c] = col.r; this.base[c + 1] = col.g; this.base[c + 2] = col.b; this.base[c + 3] = a;
    this.life[i] = this.max[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.grav[i] = grav; this.drag[i] = drag;
  }
  update(dt) {
    let n = this.count;
    for (let i = 0; i < n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { // swap the last live one into this slot
        n--; const j = n;
        if (i !== j) {
          for (let k = 0; k < 3; k++) { this.p[i * 3 + k] = this.p[j * 3 + k]; this.v[i * 3 + k] = this.v[j * 3 + k]; }
          for (let k = 0; k < 4; k++) this.base[i * 4 + k] = this.base[j * 4 + k];
          this.life[i] = this.life[j]; this.max[i] = this.max[j]; this.s0[i] = this.s0[j]; this.s1[i] = this.s1[j]; this.grav[i] = this.grav[j]; this.drag[i] = this.drag[j];
        }
        i--; continue;
      }
      const p = i * 3, c = i * 4, u = 1 - this.life[i] / this.max[i], dk = Math.exp(-this.drag[i] * dt);
      this.v[p] *= dk; this.v[p + 1] = this.v[p + 1] * dk - this.grav[i] * dt; this.v[p + 2] *= dk;
      this.p[p] += this.v[p] * dt; this.p[p + 1] += this.v[p + 1] * dt; this.p[p + 2] += this.v[p + 2] * dt;
      const a = this.base[c + 3] * (this.additive ? 1 - u * u : (1 - u) * Math.min(1, u * 8));
      this.c[c] = this.base[c]; this.c[c + 1] = this.base[c + 1]; this.c[c + 2] = this.base[c + 2]; this.c[c + 3] = a;
      this.s[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * u;
    }
    this.count = n;
    this.mesh.geometry.setDrawRange(0, n);
    if (n) { this.pa.needsUpdate = true; this.ca.needsUpdate = true; this.sa.needsUpdate = true; }
  }
}

// a pool of instanced shapes with a fade: beams, rings, orbs
class Pool {
  constructor(geo, n, mat) {
    this.mesh = new THREE.InstancedMesh(geo, mat, n); this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.renderOrder = 3;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.setColorAt(0, col.set('#000')); this.list = []; this.n = n;
  }
  add(e) { if (this.list.length >= this.n) this.list.shift(); this.list.push(e); return e; }
}

const Z = new THREE.Vector3(0, 0, 1), Y = new THREE.Vector3(0, 1, 0);
export class Fx {
  constructor() {
    this.glow = new Cloud(3000, true); this.soft = new Cloud(900, false);
    const add = () => new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
    const bg = new THREE.BoxGeometry(1, 1, 1); bg.translate(0, 0, 0.5);                    // a unit box from z 0 to 1: scaled to a beam's length
    this.beams = new Pool(bg, 220, add());
    const rg = new THREE.RingGeometry(0.86, 1, 48); rg.rotateX(-Math.PI / 2); this.rings = new Pool(rg, 48, Object.assign(add(), { side: THREE.DoubleSide }));
    this.orbs = new Pool(new THREE.SphereGeometry(1, 14, 10), 120, add());
    for (const o of [this.glow.mesh, this.soft.mesh, this.beams.mesh, this.rings.mesh, this.orbs.mesh]) G.scene.add(o);
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.v = new THREE.Vector3(); this.w = new THREE.Vector3(); this.sc = new THREE.Vector3();
    this.shakeK = 0;
  }
  // ---- particles ----------------------------------------------------------------------------------
  spark(p, hex = '#ffd34d', n = 12, speed = 7, life = 0.45, size = 0.14, grav = 9) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, b = Math.acos(Math.random() * 2 - 1), s = speed * (0.35 + Math.random() * 0.65); this.glow.emit(p.x, p.y, p.z, Math.sin(b) * Math.cos(a) * s, Math.cos(b) * s, Math.sin(b) * Math.sin(a) * s, hex, life * (0.6 + Math.random() * 0.6), size, size * 0.3, grav, 2.5); }
  }
  // a cone of particles (fire breath, thrusters, sprays)
  spray(p, dir, hex, n, speed, spread, life, s0, s1, grav = 0, soft = false) {
    for (let i = 0; i < n; i++) {
      const vx = dir.x + (Math.random() - 0.5) * spread, vy = dir.y + (Math.random() - 0.5) * spread, vz = dir.z + (Math.random() - 0.5) * spread, s = speed * (0.6 + Math.random() * 0.5);
      (soft ? this.soft : this.glow).emit(p.x, p.y, p.z, vx * s, vy * s, vz * s, hex, life * (0.7 + Math.random() * 0.5), s0, s1, grav, 1.2, soft ? 0.7 : 1);
    }
  }
  fire(p, n = 4, r = 0.4) { for (let i = 0; i < n; i++) this.glow.emit(p.x + (Math.random() - 0.5) * r, p.y, p.z + (Math.random() - 0.5) * r, (Math.random() - 0.5) * 0.6, 2 + Math.random() * 2.2, (Math.random() - 0.5) * 0.6, Math.random() < 0.5 ? '#ff7a1a' : '#ffc23d', 0.5 + Math.random() * 0.4, 0.55, 0.1, -1.5, 1); }
  smoke(p, n = 3, hex = '#3a3d44', size = 1.6, rise = 1.6) { for (let i = 0; i < n; i++) this.soft.emit(p.x + (Math.random() - 0.5) * 0.8, p.y, p.z + (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8 + (G.env ? G.env.windX || 0 : 0) * 0.3, rise * (0.6 + Math.random() * 0.6), (Math.random() - 0.5) * 0.8, hex, 2.2 + Math.random() * 1.6, size * 0.5, size * 1.8, -0.1, 0.4, 0.55); }
  dust(p, n = 10, r = 1.5, hex = '#8d8a82') { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = 2 + Math.random() * 4; this.soft.emit(p.x + Math.cos(a) * r * 0.3, p.y + 0.2, p.z + Math.sin(a) * r * 0.3, Math.cos(a) * s, 0.6 + Math.random() * 1.4, Math.sin(a) * s, hex, 1.0 + Math.random() * 0.8, 0.8, 2.4, 0.4, 2.2, 0.6); } }
  // ---- beams ---------------------------------------------------------------------------------------
  // a: start, b: end (vectors, or functions that return the current end, for lines that follow something)
  beam(a, b, hex = '#ffffff', width = 0.05, life = 0.2, fade = true) { return this.beams.add({ a, b, c: new THREE.Color(hex), w: width, life, max: life, fade, A: new THREE.Vector3(), B: new THREE.Vector3() }); }
  // a jagged bolt of lightning between two points, as a chain of short beams
  bolt(a, b, hex = '#b9a2ff', width = 0.07, life = 0.18, jag = 0.6, segs = 0) {
    const d = this.v.subVectors(b, a), L = d.length(), n = segs || Math.max(3, Math.min(12, Math.round(L / 1.6))); let prev = a.clone();
    for (let i = 1; i <= n; i++) {
      const u = i / n, q = new THREE.Vector3().copy(a).addScaledVector(d, u);
      if (i < n) q.add(this.w.set((Math.random() - 0.5) * jag, (Math.random() - 0.5) * jag, (Math.random() - 0.5) * jag).multiplyScalar(Math.min(1, L / 4)));
      this.beam(prev, q, hex, width * (1 - u * 0.4), life); prev = q;
    }
  }
  // ---- rings and orbs -------------------------------------------------------------------------------
  ring(p, hex = '#ffffff', r0 = 0.5, r1 = 6, life = 0.45, normal = null, steady = false) { return this.rings.add({ p: p.clone(), c: new THREE.Color(hex), r0, r1, life, max: life, n: normal ? normal.clone() : null, steady }); }
  // a red warning on the ground where a heavy attack will land: the outline stays, the inside fills in
  zone(p, r, life, hex = '#ff3b30') { const q = p.clone(); q.y += 0.08; this.ring(q, hex, r, r, life, null, true); this.ring(q, hex, 0.2, r, life, null, true); this.ring(q, hex, r * 0.96, r * 0.96, life, null, true); }
  blast(p, hex = '#ffb347', r0 = 0.3, r1 = 3, life = 0.35) { return this.orbs.add({ p: p.clone(), c: new THREE.Color(hex), r0, r1, life, max: life }); }
  // a glow that stays until released: projectiles, charging hands, cores (set .p, .r; .life = 0 removes it)
  orb(hex = '#ffffff', r = 0.25) { return this.orbs.add({ p: new THREE.Vector3(), c: new THREE.Color(hex), r0: r, r1: r, life: 1e9, max: 1e9, hold: true }); }
  shake(k) { this.shakeK = Math.min(1.2, this.shakeK + k); }

  update(dt) {
    const cam = G.camera, h = G.renderer.domElement.height, s = h / (2 * Math.tan((cam.fov * Math.PI) / 360));
    this.glow.mat.uniforms.scale.value = s; this.soft.mat.uniforms.scale.value = s;
    this.glow.update(dt); this.soft.update(dt);
    this.shakeK = Math.max(0, this.shakeK - dt * 2.5);
    const { m, q, sc } = this;
    // beams
    const B = this.beams; let n = 0;
    B.list = B.list.filter((e) => (e.life -= dt) > 0);
    for (const e of B.list) {
      const a = typeof e.a === 'function' ? e.a(e.A) : e.a, b = typeof e.b === 'function' ? e.b(e.B) : e.b;
      if (!a || !b) { e.life = 0; continue; }
      const d = this.v.subVectors(b, a), L = d.length(); if (L < 1e-4) continue;
      q.setFromUnitVectors(Z, d.multiplyScalar(1 / L)); m.compose(a, q, sc.set(e.w, e.w, L)); B.mesh.setMatrixAt(n, m);
      const k = e.fade ? Math.min(1, (e.life / e.max) * 1.6) : 1; B.mesh.setColorAt(n, col.copy(e.c).multiplyScalar(k)); n++;
    }
    B.mesh.count = n; B.mesh.instanceMatrix.needsUpdate = true; if (B.mesh.instanceColor) B.mesh.instanceColor.needsUpdate = true;
    // rings
    const R = this.rings; n = 0;
    R.list = R.list.filter((e) => (e.life -= dt) > 0);
    for (const e of R.list) {
      const u = 1 - e.life / e.max, r = e.r0 + (e.r1 - e.r0) * (1 - (1 - u) * (1 - u));
      if (e.n) q.setFromUnitVectors(Y, e.n); else q.identity();
      const rr = e.steady ? e.r0 + (e.r1 - e.r0) * u : r; m.compose(e.p, q, sc.set(rr, rr, rr)); R.mesh.setMatrixAt(n, m); R.mesh.setColorAt(n, col.copy(e.c).multiplyScalar(e.steady ? 0.55 + 0.35 * Math.sin(u * 30) ** 2 : 1 - u)); n++;
    }
    R.mesh.count = n; R.mesh.instanceMatrix.needsUpdate = true; if (R.mesh.instanceColor) R.mesh.instanceColor.needsUpdate = true;
    // orbs
    const O = this.orbs; n = 0;
    O.list = O.list.filter((e) => (e.life -= dt) > 0);
    for (const e of O.list) {
      if (e.hidden) continue;
      const u = e.hold ? 0 : 1 - e.life / e.max, r = e.hold ? e.r0 : e.r0 + (e.r1 - e.r0) * (1 - (1 - u) * (1 - u));
      m.compose(e.p, q.identity(), sc.set(r, r, r)); O.mesh.setMatrixAt(n, m); O.mesh.setColorAt(n, col.copy(e.c).multiplyScalar(e.hold ? 1 : 1 - u)); n++;
    }
    O.mesh.count = n; O.mesh.instanceMatrix.needsUpdate = true; if (O.mesh.instanceColor) O.mesh.instanceColor.needsUpdate = true;
  }
}
