// Shared math + helpers.
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export const angDelta = (from, to) => {
  let d = (to - from) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};
export const dampAngle = (a, b, k, dt) => a + angDelta(a, b) * (1 - Math.exp(-k * dt));
export const dist2 = (ax, az, bx, bz) => { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; };
export const fmtClock = (mins) => {
  const h = Math.floor(mins / 60) % 24, m = Math.floor(mins % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

// Deterministic RNG (mulberry32) so the city and its residents are the same every launch.
export class RNG {
  constructor(seed = 1) { this.s = (seed >>> 0) || 1; }
  next() {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
}

// Closed or open polyline with arc-length sampling (traffic lanes, maglev, patrols).
export class PathLine {
  constructor(points, closed = true) {
    this.pts = points; this.closed = closed; this.len = [0];
    const n = points.length, m = closed ? n : n - 1;
    for (let i = 0; i < m; i++) {
      const a = points[i], b = points[(i + 1) % n];
      this.len.push(this.len[i] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
    }
    this.total = this.len[this.len.length - 1];
  }
  // Writes position into out {x,y,z} and returns the heading (yaw) of the segment.
  sample(s, out) {
    const T = this.total;
    s = this.closed ? ((s % T) + T) % T : clamp(s, 0, T);
    let lo = 0, hi = this.len.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (this.len[mid] <= s) lo = mid; else hi = mid; }
    const a = this.pts[lo], b = this.pts[(lo + 1) % this.pts.length];
    const seg = this.len[lo + 1] - this.len[lo] || 1, t = (s - this.len[lo]) / seg;
    out.x = a[0] + (b[0] - a[0]) * t; out.y = a[1] + (b[1] - a[1]) * t; out.z = a[2] + (b[2] - a[2]) * t;
    return Math.atan2(b[0] - a[0], b[2] - a[2]);
  }
}

// Rounded rectangle loop in the XZ plane, clockwise when seen from above (north = -z).
export function roundedRectLoop(x0, x1, z0, z1, y, r = 8, seg = 5) {
  const pts = [];
  const corner = (cx, cz, a0) => {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, y, cz + Math.sin(a) * r]);
    }
  };
  corner(x1 - r, z0 + r, -Math.PI / 2); // NE: heading east -> south
  corner(x1 - r, z1 - r, 0);            // SE
  corner(x0 + r, z1 - r, Math.PI / 2);  // SW
  corner(x0 + r, z0 + r, Math.PI);      // NW
  return pts;
}
