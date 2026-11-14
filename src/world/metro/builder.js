// Fast geometry writer for streamed street detail. Boxes, prisms, quads and blobs are written
// straight into typed arrays with the colour in the vertices, so a 240 m tile of several
// thousand parts becomes four meshes in about a millisecond, with no intermediate objects.
import * as THREE from 'three';
import { posterMaterial } from '../art.js';

const colors = new Map(), tmp = new THREE.Color();
function rgb(hex) { if (hex.isColor) return [hex.r, hex.g, hex.b]; let c = colors.get(hex); if (!c) { tmp.set(hex); colors.set(hex, (c = [tmp.r, tmp.g, tmp.b])); } return c; }

class Buf {
  constructor(cap = 6000) { this.p = new Float32Array(cap * 3); this.n = new Float32Array(cap * 3); this.c = new Float32Array(cap * 3); this.i = new Uint32Array(cap * 2); this.v = 0; this.k = 0; }
  room(v, k) {
    if ((this.v + v) * 3 > this.p.length) { const cap = Math.max(this.p.length * 2, (this.v + v) * 3); for (const a of ['p', 'n', 'c']) { const b = new Float32Array(cap); b.set(this[a]); this[a] = b; } }
    if (this.k + k > this.i.length) { const b = new Uint32Array(Math.max(this.i.length * 2, this.k + k)); b.set(this.i); this.i = b; }
  }
  vert(x, y, z, nx, ny, nz, c) { const o = this.v * 3; this.p[o] = x; this.p[o + 1] = y; this.p[o + 2] = z; this.n[o] = nx; this.n[o + 1] = ny; this.n[o + 2] = nz; this.c[o] = c[0]; this.c[o + 1] = c[1]; this.c[o + 2] = c[2]; return this.v++; }
  tri(a, b, c) { this.i[this.k++] = a; this.i[this.k++] = b; this.i[this.k++] = c; }
  mesh(mat, cast) {
    if (!this.v) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p.slice(0, this.v * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.n.slice(0, this.v * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.c.slice(0, this.v * 3), 3));
    g.setIndex(new THREE.BufferAttribute(this.v > 65535 ? this.i.slice(0, this.k) : new Uint16Array(this.i.subarray(0, this.k)), 1));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = !mat.isMeshBasicMaterial; m.matrixAutoUpdate = false;
    return m;
  }
  reset() { this.v = 0; this.k = 0; }
}

// Textured quads (light pools on the ground, shop signs): positions and uvs only.
class UVBuf {
  constructor(cap = 400) { this.p = new Float32Array(cap * 3); this.u = new Float32Array(cap * 2); this.v = 0; }
  quad(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, u0, v0, u1, v1) {
    if ((this.v + 4) * 3 > this.p.length) { const p = new Float32Array(this.p.length * 2), u = new Float32Array(this.u.length * 2); p.set(this.p); u.set(this.u); this.p = p; this.u = u; }
    this.p.set([ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz], this.v * 3); this.u.set([u0, v0, u1, v0, u1, v1, u0, v1], this.v * 2); this.v += 4;
  }
  mesh(mat) {
    if (!this.v) return null;
    const g = new THREE.BufferGeometry(), n = this.v / 4, idx = new Uint16Array(n * 6);
    for (let q = 0; q < n; q++) idx.set([q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3], q * 6);
    g.setAttribute('position', new THREE.BufferAttribute(this.p.slice(0, this.v * 3), 3)); g.setAttribute('uv', new THREE.BufferAttribute(this.u.slice(0, this.v * 2), 2)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat); m.matrixAutoUpdate = false; m.updateMatrix(); this.v = 0; return m;
  }
}

// Shared materials: S small matt parts, B big parts that cast shadows, G always-lit glow, L lamps (lit at night).
export const MATS = {
  S: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.12 }),
  B: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.25 }),
  G: new THREE.MeshBasicMaterial({ vertexColors: true }),
  L: new THREE.MeshBasicMaterial({ vertexColors: true }),
};
const ICO = new THREE.IcosahedronGeometry(1, 1).toNonIndexed(), ICO_P = ICO.attributes.position.array;

export class Builder {
  constructor() { this.b = { S: new Buf(120000), B: new Buf(40000), G: new Buf(30000), L: new Buf(12000) }; this.pools = new UVBuf(); this.signs = new UVBuf(); this.posters = new UVBuf(); }
  // a soft pool of light on the ground under a lamp
  pool(x, y, z, r) { this.pools.quad(x - r, y, z + r, x + r, y, z + r, x + r, y, z - r, x - r, y, z - r, 0, 0, 1, 1); }
  // an upright textured panel facing yaw a (uv rectangle into the sign sheet)
  sign(u0, v0, u1, v1, w, h, x, y, z, a, buf = this.signs) { const cs = Math.cos(a), sn = Math.sin(a), hx = (w / 2) * cs, hz = (-w / 2) * sn; buf.quad(x - hx, y - h / 2, z - hz, x + hx, y - h / 2, z + hz, x + hx, y + h / 2, z + hz, x - hx, y + h / 2, z - hz, u0, v0, u1, v1); }
  // the same, into the advert sheet (art.js): street posters
  poster(uv, w, h, x, y, z, a) { this.sign(uv[0], uv[1], uv[2], uv[3], w, h, x, y, z, a, this.posters); }
  // an upright box, optionally turned about y (written without temporary objects: this is the hot path)
  box(k, hex, w, h, d, x, y, z, ry = 0) {
    const b = this.b[k], c = rgb(hex), hw = w / 2, hd = d / 2, y0 = y - h / 2, y1 = y + h / 2, cs = ry ? Math.cos(ry) : 1, sn = ry ? Math.sin(ry) : 0;
    b.room(20, 30);
    // corners in the ground plane: 0 (-x,-z) 1 (+x,-z) 2 (+x,+z) 3 (-x,+z)
    const x0 = x - hw * cs - hd * sn, z0 = z + hw * sn - hd * cs, x1 = x + hw * cs - hd * sn, z1 = z - hw * sn - hd * cs, x2 = x + hw * cs + hd * sn, z2 = z - hw * sn + hd * cs, x3 = x - hw * cs + hd * sn, z3 = z + hw * sn + hd * cs;
    let i0;
    i0 = b.vert(x2, y0, z2, cs, 0, -sn, c); b.vert(x1, y0, z1, cs, 0, -sn, c); b.vert(x1, y1, z1, cs, 0, -sn, c); b.vert(x2, y1, z2, cs, 0, -sn, c); b.tri(i0, i0 + 1, i0 + 2); b.tri(i0, i0 + 2, i0 + 3);            // +x
    i0 = b.vert(x0, y0, z0, -cs, 0, sn, c); b.vert(x3, y0, z3, -cs, 0, sn, c); b.vert(x3, y1, z3, -cs, 0, sn, c); b.vert(x0, y1, z0, -cs, 0, sn, c); b.tri(i0, i0 + 1, i0 + 2); b.tri(i0, i0 + 2, i0 + 3);        // -x
    i0 = b.vert(x3, y1, z3, 0, 1, 0, c); b.vert(x2, y1, z2, 0, 1, 0, c); b.vert(x1, y1, z1, 0, 1, 0, c); b.vert(x0, y1, z0, 0, 1, 0, c); b.tri(i0, i0 + 1, i0 + 2); b.tri(i0, i0 + 2, i0 + 3);                    // top
    i0 = b.vert(x3, y0, z3, sn, 0, cs, c); b.vert(x2, y0, z2, sn, 0, cs, c); b.vert(x2, y1, z2, sn, 0, cs, c); b.vert(x3, y1, z3, sn, 0, cs, c); b.tri(i0, i0 + 1, i0 + 2); b.tri(i0, i0 + 2, i0 + 3);            // +z
    i0 = b.vert(x1, y0, z1, -sn, 0, -cs, c); b.vert(x0, y0, z0, -sn, 0, -cs, c); b.vert(x0, y1, z0, -sn, 0, -cs, c); b.vert(x1, y1, z1, -sn, 0, -cs, c); b.tri(i0, i0 + 1, i0 + 2); b.tri(i0, i0 + 2, i0 + 3);    // -z
  }
  // an upright prism (pole, bin, trunk): radius top and bottom, n sides, with a top cap
  cyl(k, hex, rt, rb, h, x, y, z, n = 8) {
    const b = this.b[k], c = rgb(hex), y0 = y - h / 2, y1 = y + h / 2; b.room(n * 3 + 3, n * 9);
    const base = b.v;
    for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2, cs = Math.cos(a), sn = Math.sin(a); b.vert(x + cs * rb, y0, z + sn * rb, cs, 0, sn, c); b.vert(x + cs * rt, y1, z + sn * rt, cs, 0, sn, c); }
    for (let i = 0; i < n; i++) { const a = base + i * 2; b.tri(a, a + 1, a + 3); b.tri(a, a + 3, a + 2); }
    const top = b.vert(x, y1, z, 0, 1, 0, c), ring = b.v;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; b.vert(x + Math.cos(a) * rt, y1, z + Math.sin(a) * rt, 0, 1, 0, c); }
    for (let i = 0; i < n; i++) b.tri(top, ring + ((i + 1) % n), ring + i);
  }
  // a flat mark on the ground (lane line, crosswalk stripe, manhole)
  quad(k, hex, w, d, x, y, z, ry = 0) {
    const b = this.b[k], c = rgb(hex), hw = w / 2, hd = d / 2, cs = ry ? Math.cos(ry) : 1, sn = ry ? Math.sin(ry) : 0; b.room(4, 6);
    const P = (lx, lz) => b.vert(x + lx * cs + lz * sn, y, z - lx * sn + lz * cs, 0, 1, 0, c);
    const i0 = P(-hw, hd); P(hw, hd); P(hw, -hd); P(-hw, -hd); b.tri(i0, i0 + 1, i0 + 2); b.tri(i0, i0 + 2, i0 + 3);
  }
  // a flat four-sided patch on the ground with any corners (a, b, c, d given anticlockwise seen from above)
  patch(k, hex, ax, az, bx, bz, cx, cz, dx, dz, y, hex2) {
    const b = this.b[k], c = rgb(hex), c2 = hex2 ? rgb(hex2) : c; b.room(4, 6);
    const i0 = b.vert(ax, y, az, 0, 1, 0, c); b.vert(bx, y, bz, 0, 1, 0, c); b.vert(cx, y, cz, 0, 1, 0, c2); b.vert(dx, y, dz, 0, 1, 0, c2); b.tri(i0, i0 + 1, i0 + 2); b.tri(i0, i0 + 2, i0 + 3);
  }
  // one flat face (3 or 4 corners) with its normal n; the winding is chosen so the face looks along n
  face(k, hex, ps, n) {
    const b = this.b[k], c = rgb(hex), [p0, p1, p2] = ps; b.room(4, 6);
    const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2], vx = p2[0] - p0[0], vy = p2[1] - p0[1], vz = p2[2] - p0[2];
    const flip = (uy * vz - uz * vy) * n[0] + (uz * vx - ux * vz) * n[1] + (ux * vy - uy * vx) * n[2] < 0;
    const i0 = b.v; for (const p of ps) b.vert(p[0], p[1], p[2], n[0], n[1], n[2], c);
    if (flip) { b.tri(i0, i0 + 2, i0 + 1); if (ps.length === 4) b.tri(i0, i0 + 3, i0 + 2); } else { b.tri(i0, i0 + 1, i0 + 2); if (ps.length === 4) b.tri(i0, i0 + 2, i0 + 3); }
  }
  // a closed solid from eight corners: the bottom four, then the top four, each in order round the shape.
  // Good for tapered shapes (a car's cabin, a sloped windscreen). Faces point away from the middle.
  hull(k, hex, P, bottom = false) {
    let cx = 0, cy = 0, cz = 0; for (const p of P) { cx += p[0] / 8; cy += p[1] / 8; cz += p[2] / 8; }
    const F = bottom ? [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]] : [[4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
    for (const f of F) {
      const a = P[f[0]], b = P[f[1]], c = P[f[2]], d = P[f[3]], ux = c[0] - a[0], uy = c[1] - a[1], uz = c[2] - a[2], vx = d[0] - b[0], vy = d[1] - b[1], vz = d[2] - b[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const mx = (a[0] + b[0] + c[0] + d[0]) / 4 - cx, my = (a[1] + b[1] + c[1] + d[1]) / 4 - cy, mz = (a[2] + b[2] + c[2] + d[2]) / 4 - cz;
      if (nx * mx + ny * my + nz * mz < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const l = Math.hypot(nx, ny, nz) || 1; this.face(k, hex, [a, b, c, d], [nx / l, ny / l, nz / l]);
    }
  }
  // a wheel: a short prism on its side, its axle across the yaw direction
  wheel(k, hex, r, w, x, y, z, ry = 0, n = 10) {
    const cs = Math.cos(ry), sn = Math.sin(ry), W = (lx, ly, lz) => [x + lx * cs + lz * sn, y + ly, z - lx * sn + lz * cs], N = (nx, ny, nz) => [nx * cs + nz * sn, ny, -nx * sn + nz * cs];
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, am = (a0 + a1) / 2, c0 = Math.cos(a0) * r, s0 = Math.sin(a0) * r, c1 = Math.cos(a1) * r, s1 = Math.sin(a1) * r;
      this.face(k, hex, [W(-w / 2, c0, s0), W(w / 2, c0, s0), W(w / 2, c1, s1), W(-w / 2, c1, s1)], N(0, Math.cos(am), Math.sin(am)));
      for (const s of [-1, 1]) this.face(k, hex, [W((s * w) / 2, 0, 0), W((s * w) / 2, c0, s0), W((s * w) / 2, c1, s1)], N(s, 0, 0));
    }
  }
  // a flat ring on the ground (landing pad markings)
  ring(k, hex, r0, r1, x, y, z, n = 32) {
    const b = this.b[k], c = rgb(hex); b.room(n * 2 + 2, n * 6); const base = b.v;
    for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2, cs = Math.cos(a), sn = Math.sin(a); b.vert(x + cs * r0, y, z + sn * r0, 0, 1, 0, c); b.vert(x + cs * r1, y, z + sn * r1, 0, 1, 0, c); }
    for (let i = 0; i < n; i++) { const a = base + i * 2; b.tri(a, a + 2, a + 3); b.tri(a, a + 3, a + 1); }
  }
  // a faceted blob (tree crown, shrub, rock)
  blob(k, hex, sx, sy, sz, x, y, z, turn = 0) {
    const b = this.b[k], c = rgb(hex), n = ICO_P.length / 3, cs = Math.cos(turn), sn = Math.sin(turn), P = ICO_P; b.room(n, n);
    for (let t = 0; t < n; t += 3) {
      const o = t * 3;
      const ax = (P[o] * cs + P[o + 2] * sn) * sx, ay = P[o + 1] * sy, az = (-P[o] * sn + P[o + 2] * cs) * sz;
      const bx = (P[o + 3] * cs + P[o + 5] * sn) * sx, by = P[o + 4] * sy, bz = (-P[o + 3] * sn + P[o + 5] * cs) * sz;
      const qx = (P[o + 6] * cs + P[o + 8] * sn) * sx, qy = P[o + 7] * sy, qz = (-P[o + 6] * sn + P[o + 8] * cs) * sz;
      let nx = (by - ay) * (qz - az) - (bz - az) * (qy - ay), ny = (bz - az) * (qx - ax) - (bx - ax) * (qz - az), nz = (bx - ax) * (qy - ay) - (by - ay) * (qx - ax);
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      const i0 = b.vert(x + ax, y + ay, z + az, nx, ny, nz, c); b.vert(x + bx, y + by, z + bz, nx, ny, nz, c); b.vert(x + qx, y + qy, z + qz, nx, ny, nz, c); b.tri(i0, i0 + 1, i0 + 2);
    }
  }
  // a pitched roof: triangular prism, ridge along x (or along z when turned)
  gable(k, hex, len, span, rise, x, y, z, alongZ = false) {
    const b = this.b[k], c = rgb(hex), hl = len / 2, hs = span / 2; b.room(18, 24);
    const P = (lx, ly, lz, nx, ny, nz) => (alongZ ? b.vert(x + lz, y + ly, z + lx, nz, ny, nx, c) : b.vert(x + lx, y + ly, z + lz, nx, ny, nz, c));
    const sl = Math.hypot(rise, hs), ny = hs / sl, nz = rise / sl;
    for (const s of [1, -1]) { const i0 = P(-hl, 0, s * hs, 0, ny, s * nz); P(hl, 0, s * hs, 0, ny, s * nz); P(hl, rise, 0, 0, ny, s * nz); P(-hl, rise, 0, 0, ny, s * nz); if ((s > 0) !== alongZ) { b.tri(i0, i0 + 1, i0 + 2); b.tri(i0, i0 + 2, i0 + 3); } else { b.tri(i0, i0 + 2, i0 + 1); b.tri(i0, i0 + 3, i0 + 2); } }
    for (const s of [1, -1]) { const i0 = P(s * hl, 0, -hs, s, 0, 0); P(s * hl, 0, hs, s, 0, 0); P(s * hl, rise, 0, s, 0, 0); if ((s > 0) !== alongZ) b.tri(i0, i0 + 2, i0 + 1); else b.tri(i0, i0 + 1, i0 + 2); }
  }
  // Turn what has been written into meshes inside a group, and start again.
  finish(group = new THREE.Group(), poolMat, signMat) {
    for (const k of ['S', 'B', 'G', 'L']) { const m = this.b[k].mesh(MATS[k], k === 'B'); if (m) { m.updateMatrix(); group.add(m); } this.b[k].reset(); }
    const pm = poolMat && this.pools.mesh(poolMat), sm = signMat && this.signs.mesh(signMat), am = this.posters.mesh(posterMaterial());
    if (pm) { pm.renderOrder = 1; group.add(pm); } if (sm) group.add(sm); if (am) group.add(am);
    this.pools.v = 0; this.signs.v = 0; this.posters.v = 0;
    return group;
  }
}
export function disposeGroup(g) { g.traverse((m) => { if (m.geometry && !m.isInstancedMesh) m.geometry.dispose(); }); g.removeFromParent(); }
