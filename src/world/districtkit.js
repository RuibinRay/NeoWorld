// Construction kit for the outer districts. Coordinates are local to the district centre.
// Static geometry is collected per material and merged, so a whole district draws in a
// handful of calls; colliders, nav nodes, pads, seats and caches go into the shared city data.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { M, std, neon, towerGeometry, labelTexture } from './materials.js';
import { mergeItems } from './batch.js';
import { dressTower } from './dress.js';

export function makeKit(scene, col, city, nav, site, group) {
  const cx = site.x, cz = site.z, by = site.y || 0;
  group = group || new THREE.Group(); if (!group.parent) scene.add(group);
  const buckets = new Map(), nodes = { street: [], doors: [], posts: {} }, updates = [];
  const push = (mat, g) => { let a = buckets.get(mat); if (!a) buckets.set(mat, (a = [])); a.push(g); };
  const at = (g, x, y, z) => { g.translate(cx + x, by + y, cz + z); return g; };
  const k = {
    cx, cz, by, group, nodes, updates, site, col, city,
    box(mat, w, h, d, x, y, z, ry) { const g = new THREE.BoxGeometry(w, h, d); if (ry) g.rotateY(ry); push(mat, at(g, x, y, z)); },
    solid(mat, x0, x1, y0, y1, z0, z1, extra) { if (mat) k.box(mat, x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return col.box(cx + x0, cx + x1, by + y0, by + y1, cz + z0, cz + z1, extra); },
    tower(mat, x0, x1, z0, z1, y0, y1, o = {}) {
      const w = x1 - x0, d = z1 - z0, h = y1 - y0;
      push(mat, at(towerGeometry(w, h, d, mat.userData.tile), (x0 + x1) / 2, y0 + h / 2, (z0 + z1) / 2));
      if (!o.noCol) col.box(cx + x0, cx + x1, by + y0, by + y1, cz + z0, cz + z1);
      k.box(M.roof, w, 0.3, d, (x0 + x1) / 2, y1 + 0.15, (z0 + z1) / 2);
      dressTower(k.box, x0, x1, z0, z1, y0, y1 + 0.3, o);
      if (o.neon) for (const [ax, az] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) k.box(neon(o.neon, 1.3), 0.7, h, 0.7, ax, y0 + h / 2, az);
      if (o.crown) { const c = neon(o.crown, 1.5), my = y1 + 0.5; k.box(c, w + 0.6, 0.7, 0.5, (x0 + x1) / 2, my, z0); k.box(c, w + 0.6, 0.7, 0.5, (x0 + x1) / 2, my, z1); k.box(c, 0.5, 0.7, d + 0.6, x0, my, (z0 + z1) / 2); k.box(c, 0.5, 0.7, d + 0.6, x1, my, (z0 + z1) / 2); }
    },
    cyl(mat, rt, rb, h, x, y, z, seg = 16) { push(mat, at(new THREE.CylinderGeometry(rt, rb, h, seg), x, y, z)); },
    tube(mat, r, len, x, y, z, alongX) { const g = new THREE.CylinderGeometry(r, r, len, 14); g.rotateX(Math.PI / 2); if (alongX) g.rotateY(Math.PI / 2); push(mat, at(g, x, y, z)); },
    cone(mat, r, h, x, y, z, seg = 4, ry = Math.PI / 4) { const g = new THREE.CylinderGeometry(0, r, h, seg); g.rotateY(ry); push(mat, at(g, x, y, z)); },
    ball(mat, r, x, y, z, sx = 1, sy = 1, sz = 1) { const g = new THREE.SphereGeometry(r, 10, 7); g.scale(sx, sy, sz); push(mat, at(g, x, y, z)); },
    flat(mat, w, d, x, y, z) { const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); push(mat, at(g, x, y, z)); },
    disc(mat, r, x, y, z, seg = 28) { const g = new THREE.CircleGeometry(r, seg); g.rotateX(-Math.PI / 2); push(mat, at(g, x, y, z)); },
    // soft pool of light on the ground (additive), for places the sun does not reach
    glow(hex, r, x, z, y = 0.09) { const key = '_glow' + hex, mat = k[key] || (k[key] = new THREE.MeshBasicMaterial({ map: M.glow, color: hex, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })); k.disc(mat, r, x, y, z, 20); },
    ring(mat, r0, r1, x, y, z) { const g = new THREE.RingGeometry(r0, r1, 40); g.rotateX(-Math.PI / 2); push(mat, at(g, x, y, z)); },
    // pitched roof: a triangular prism, ridge along x (or z)
    gable(mat, len, span, rise, x, y, z, alongX = true) { const g = new THREE.CylinderGeometry(1, 1, len, 3, 1, false, Math.PI / 2); g.rotateZ(Math.PI / 2); g.scale(1, rise / 1.5, span / 1.732); g.translate(0, rise / 3, 0); if (!alongX) g.rotateY(Math.PI / 2); push(mat, at(g, x, y, z)); },
    // barrel roof: half cylinder, axis along z
    arch(mat, r, len, rise, x, y, z) { const g = new THREE.CylinderGeometry(r, r, len, 18, 1, false, Math.PI / 2, Math.PI); g.rotateX(Math.PI / 2); g.scale(1, rise / r, 1); push(mat, at(g, x, y, z)); },
    tree(x, z, s = 1, pink = false, y = 0) { k.cyl(M.trunk, 0.16 * s, 0.26 * s, 3.6 * s, x, y + 1.8 * s, z, 6); k.ball(pink ? M.leafPink : M.leaf, 1, x, y + 4.6 * s, z, 2.5 * s, 2.1 * s, 2.5 * s); col.box(cx + x - 0.3, cx + x + 0.3, by + y, by + y + 3 * s, cz + z - 0.3, cz + z + 0.3); },
    sign(text, w, h, x, y, z, ry = 0, o = {}) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: labelTexture(text, { color: o.color || '#9ff', sub: o.sub, size: o.size || 64 }), transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.position.set(cx + x, by + y, cz + z); m.rotation.y = ry; group.add(m); return m;
    },
    mesh(m, x, y, z) { m.position.set(cx + x, by + y, cz + z); group.add(m); return m; },   // an individual (animated) object
    pad(id, name, x, z, r = 7, o = {}) {
      k.disc(std('#1a1f29', 0.6, 0.5), r, x, 0.05, z, 36); k.ring(neon(o.color || '#4de1ff', 1.3), r - 0.5, r, x, 0.07, z); k.ring(neon(o.color || '#4de1ff', 0.9), r * 0.42, r * 0.42 + 0.2, x, 0.07, z);
      const px = x - r - 1.7, p = { id, name, x: cx + x, y: by, z: cz + z, r, charger: true, priv: !!o.priv, owner: o.owner, taxi: !o.priv, chargerPos: { x: cx + px, y: by, z: cz + z } };
      k.solid(M.metalDark, px - 0.3, px + 0.3, 0, 2.4, z - 0.3, z + 0.3); k.box(neon('#7dff9c', 1.4), 0.64, 0.5, 0.64, px, 2.1, z);
      city.pads.push(p); return p;
    },
    cache(x, y, z) {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.45), neon('#ffd34d', 1.8)); m.position.set(cx + x, by + y + 1.1, cz + z); group.add(m);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.12, 14, 0.12), new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false })); beam.position.set(cx + x, by + y + 7, cz + z); group.add(beam);
      city.caches.push({ id: city.caches.length, x: cx + x, y: by + y, z: cz + z, m, beam, found: false });
    },
    kiosk(x, z) { k.solid(std('#20262f', 0.4, 0.7), x - 0.7, x + 0.7, 0, 2.4, z - 0.25, z + 0.25); k.box(neon('#ffd34d', 0.8), 1.1, 1.3, 0.06, x, 1.5, z + 0.27); k.sign('DISTRICT SHUTTLE', 1.3, 0.34, x, 2.15, z + 0.3, 0, { color: '#ffe9a8', size: 44 }); return { x: cx + x, y: by, z: cz + z + 1.2 }; },
    // amber boundary fence around a rectangular district
    fence(hx, hz = hx, h = 1.8) {
      const fm = k._fm || (k._fm = new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide })), top = neon('#ffb347', 1.2);
      // the highway from Meridian comes in through a gap on the side that faces the city centre
      const L = Math.hypot(cx, cz) || 1, dx = -cx / L, dz = -cz / L, t = Math.min(hx / Math.max(1e-6, Math.abs(dx)), hz / Math.max(1e-6, Math.abs(dz))), gx = dx * t, gz = dz * t, onX = Math.abs(Math.abs(gx) - hx) < 0.01, GAP = 10;
      k.gate = by === 0 ? { x: cx + gx, z: cz + gz } : null;
      const wx = (z, a0, a1) => { if (a1 - a0 < 0.3) return; k.solid(fm, a0, a1, 0, h, z - 0.1, z + 0.1, { noCam: true }); k.box(top, a1 - a0, 0.08, 0.3, (a0 + a1) / 2, h, z); };
      const wz = (x, a0, a1) => { if (a1 - a0 < 0.3) return; k.solid(fm, x - 0.1, x + 0.1, 0, h, a0, a1, { noCam: true }); k.box(top, 0.3, 0.08, a1 - a0, x, h, (a0 + a1) / 2); };
      for (const s of [-1, 1]) {
        if (k.gate && !onX && Math.sign(gz) === s) { wx(s * hz, -hx, gx - GAP); wx(s * hz, gx + GAP, hx); } else wx(s * hz, -hx, hx);
        if (k.gate && onX && Math.sign(gx) === s) { wz(s * hx, -hz, gz - GAP); wz(s * hx, gz + GAP, hz); } else wz(s * hx, -hz, hz);
      }
      if (k.gate) for (const e of [-GAP, GAP]) { const px = onX ? gx : gx + e, pz = onX ? gz + e : gz; k.solid(M.metalDark, px - 0.4, px + 0.4, 0, 6, pz - 0.4, pz + 0.4); k.box(top, 0.9, 0.3, 0.9, px, 6.1, pz); }
    },
    rail(x0, z0, x1, z1, mat = M.glass, h = 1.3) { k.solid(mat, Math.min(x0, x1) - 0.08, Math.max(x0, x1) + 0.08, 0, h, Math.min(z0, z1) - 0.08, Math.max(z0, z1) + 0.08); },
    // nav: street nodes are where locals stroll; doors are where they live; posts are where staff stand
    node(id, x, z, o = {}) { const full = site.id + ':' + id; nav.add(full, cx + x, cz + z, { y: by + (o.y || 0), zone: site.id, street: !o.quiet }); if (o.door) nodes.doors.push(full); else if (!o.quiet) nodes.street.push(full); return full; },
    link(...ids) { for (let i = 0; i < ids.length - 1; i++) nav.link(site.id + ':' + ids[i], site.id + ':' + ids[i + 1]); },
    post(key, x, z, face, to) { const full = k.node('post:' + key, x, z, { quiet: true }); nodes.posts[key] = { id: full, face }; if (to) nav.link(full, site.id + ':' + to); return full; },
    stool(id, x, z, yaw) { k.cyl(std('#c9b68f', 0.8, 0), 0.2, 0.17, 0.46, x, 0.23, z, 10); k.seat(id, x, z, yaw, null, null); },
    seat(id, x, z, yaw, table, service) { city.seats.push({ id: site.id + ':' + id, kind: 'chair', x: cx + x, y: by + 0.5, z: cz + z, yaw, taken: null, table: table ? { x: cx + table[0], y: by + 0.79, z: cz + table[1] } : null, service: service || null }); },
    table(id, x, z, service, chairMat) { // a round table with two chairs facing each other across it
      k.cyl(M.white, 0.6, 0.6, 0.06, x, 0.75, z, 18); k.cyl(M.metalDark, 0.07, 0.2, 0.72, x, 0.37, z, 8); col.box(cx + x - 0.45, cx + x + 0.45, by, by + 0.78, cz + z - 0.45, cz + z + 0.45);
      for (const s of [-1, 1]) { k.box(chairMat || M.wood, 0.5, 0.08, 0.5, x + s * 1.1, 0.46, z); k.box(chairMat || M.wood, 0.08, 0.5, 0.5, x + s * 1.36, 0.72, z); k.seat(`${id}${s > 0 ? 'b' : 'a'}`, x + s * 1.1, z, s < 0 ? Math.PI / 2 : -Math.PI / 2, [x + s * 0.28, z], service); }
    },
    abs(x, y, z) { return { x: cx + x, y: by + y, z: cz + z }; },
    finish() {
      const items = [];
      for (const [mat, list] of buckets) { const basic = mat.isMeshBasicMaterial; for (const geo of list) items.push({ geo, mat, cast: !basic && !mat.transparent, receive: !basic }); }
      for (const m of mergeItems(items)) group.add(m);
      buckets.clear();
    },
  };
  return k;
}
