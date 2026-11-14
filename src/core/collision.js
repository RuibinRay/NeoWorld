// World collision: axis-aligned boxes in a spatial hash. Everything solid in the city
// (towers, walls, furniture, decks) is one of these, so walking, flying, landing and the
// camera all query the same data.
import { clamp } from './util.js';

export class Colliders {
  constructor(cell = 24) { this.cell = cell; this.map = new Map(); this.stamp = 0; this.all = []; this._out = []; }
  _key(i, j) { return (i + 2048) * 4096 + (j + 2048); }

  add(b) {
    if (b.enabled === undefined) b.enabled = true;
    b._s = 0;
    const c = this.cell;
    for (let i = Math.floor(b.minX / c); i <= Math.floor(b.maxX / c); i++) {
      for (let j = Math.floor(b.minZ / c); j <= Math.floor(b.maxZ / c); j++) {
        const k = this._key(i, j);
        let l = this.map.get(k);
        if (!l) this.map.set(k, (l = []));
        l.push(b);
      }
    }
    this.all.push(b);
    return b;
  }
  box(minX, maxX, minY, maxY, minZ, maxZ, extra) { return this.add({ minX, maxX, minY, maxY, minZ, maxZ, ...extra }); }

  near(x, z, r, out = this._out) {
    out.length = 0;
    const c = this.cell, s = ++this.stamp;
    for (let i = Math.floor((x - r) / c); i <= Math.floor((x + r) / c); i++) {
      for (let j = Math.floor((z - r) / c); j <= Math.floor((z + r) / c); j++) {
        const l = this.map.get(this._key(i, j));
        if (!l) continue;
        for (let n = 0; n < l.length; n++) { const b = l[n]; if (b._s !== s && b.enabled) { b._s = s; out.push(b); } }
      }
    }
    return out;
  }

  // Height of the highest surface the feet can rest on (or step up to) at this spot.
  groundAt(x, z, feetY, step = 0.5, r = 0.25, floor) {
    let g = floor !== undefined ? floor : this.base ? this.base(x, z) : 0;   // floor: a diver's seabed instead of the open ground   // open ground: flat, except where the world gives it a shape (the park hill)
    const l = this.near(x, z, r + 0.1);
    for (let n = 0; n < l.length; n++) {
      const b = l[n];
      if (b.noStand) continue;
      if (x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ && b.maxY <= feetY + step && b.maxY > g) g = b.maxY;
    }
    return g;
  }

  // Lowest underside above headY within the footprint (ceilings, skybridges). Infinity if open sky.
  ceilingAt(x, z, headY, r = 0.25) {
    let c = Infinity;
    const l = this.near(x, z, r + 0.1);
    for (let n = 0; n < l.length; n++) {
      const b = l[n];
      if (x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ && b.minY >= headY - 0.3 && b.minY < c) c = b.minY;
    }
    return c;
  }

  // Tallest thing at this spot regardless of where you are (autopilot clearance).
  maxTopAt(x, z, r = 1) {
    let g = this.base ? this.base(x, z) : 0;   // the shape of the ground counts too (the hills, the mountains)
    const l = this.near(x, z, r + 0.1);
    for (let n = 0; n < l.length; n++) {
      const b = l[n];
      if (x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ && b.maxY > g) g = b.maxY;
    }
    return g;
  }

  // Altitude that clears everything along a straight line (autopilot, drones).
  clearAltitude(ax, az, bx, bz, r = 6, margin = 14) {
    const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(len / 6));
    let top = 0;
    for (let i = 0; i <= n; i++) { const t = i / n; top = Math.max(top, this.maxTopAt(ax + (bx - ax) * t, az + (bz - az) * t, r)); }
    return top + margin;
  }

  // Push a vertical cylinder (radius r, spanning y0..y1) out of any boxes. Returns the last hit.
  resolveCircle(p, r, y0, y1) {
    let hit = null;
    for (let iter = 0; iter < 2; iter++) {
      const l = this.near(p.x, p.z, r + 0.2);
      for (let n = 0; n < l.length; n++) {
        const b = l[n];
        if (b.maxY <= y0 || b.minY >= y1) continue;
        const cx = clamp(p.x, b.minX, b.maxX), cz = clamp(p.z, b.minZ, b.maxZ);
        const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2), push = r - d;
          p.x += (dx / d) * push; p.z += (dz / d) * push;
          hit = { nx: dx / d, nz: dz / d, box: b };
        } else {
          const l0 = p.x - b.minX, l1 = b.maxX - p.x, l2 = p.z - b.minZ, l3 = b.maxZ - p.z;
          const m = Math.min(l0, l1, l2, l3);
          if (m === l0) { p.x = b.minX - r; hit = { nx: -1, nz: 0, box: b }; }
          else if (m === l1) { p.x = b.maxX + r; hit = { nx: 1, nz: 0, box: b }; }
          else if (m === l2) { p.z = b.minZ - r; hit = { nx: 0, nz: -1, box: b }; }
          else { p.z = b.maxZ + r; hit = { nx: 0, nz: 1, box: b }; }
        }
      }
    }
    return hit;
  }

  // Distance along a ray to the first box hit, or maxDist.
  raycast(ox, oy, oz, dx, dy, dz, maxDist) {
    let best = maxDist;
    const l = this.near(ox + dx * maxDist * 0.5, oz + dz * maxDist * 0.5, maxDist * 0.5 + 1);
    for (let n = 0; n < l.length; n++) {
      const b = l[n];
      if (b.noCam) continue;
      let t0 = 0, t1 = best, ok = true;
      const axes = [[ox, dx, b.minX, b.maxX], [oy, dy, b.minY, b.maxY], [oz, dz, b.minZ, b.maxZ]];
      for (let a = 0; a < 3 && ok; a++) {
        const [o, d, mn, mx] = axes[a];
        if (Math.abs(d) < 1e-9) { if (o < mn || o > mx) ok = false; }
        else {
          let ta = (mn - o) / d, tb = (mx - o) / d;
          if (ta > tb) { const s = ta; ta = tb; tb = s; }
          if (ta > t0) t0 = ta;
          if (tb < t1) t1 = tb;
          if (t0 > t1) ok = false;
        }
      }
      if (ok && t0 < best) best = t0;
    }
    return best;
  }
}
