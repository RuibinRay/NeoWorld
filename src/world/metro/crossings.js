// Where the highways and the ring road meet the street grid. Street segments that a highway runs
// along are handed over to the highway; everywhere a highway crosses a street there is a crossing
// with signals. A crossing inside a junction gives that junction a third signal phase for the
// highway; one between junctions has its own two-phase signal. Highway pods, avenue pods and the
// buses all stop for these signals (see roads.js, metro/traffic.js, metro/bus.js).
import * as THREE from 'three';
import { RING } from '../roads.js';
import { P, NB } from './landuse.js';
import { ABSORBED, eSeg, sSeg, corner, signalState, signalPoles } from './streets.js';
import { draw } from './furniture.js';

const LANE = 3.6, HALF = 8, AV = 4.2, STOP = 2.5, TAU = Math.PI * 2;
const SIG = [new THREE.Color(0.1, 2.2, 0.5), new THREE.Color(2.4, 1.5, 0.1), new THREE.Color(2.6, 0.15, 0.1)], OFF = new THREE.Color(0.03, 0.03, 0.035);
const mod = (a, n) => ((a % n) + n) % n;

export function planCrossings(roads) {
  // ---- the highway tracks: each radial, and the ring (its parameter is an angle) ----
  const tracks = roads.radials.map((s) => ({ seg: s, ring: false, len: s.len, step: 1, k: 1,
    pt: (u, d, o = 0) => [s.ax + s.ux * u + (-s.uz * d) * (LANE + o), s.az + s.uz * u + s.ux * d * (LANE + o)], dir: () => [s.ux, s.uz],
    dist: (x, z) => { const t = Math.max(0, Math.min(s.len, (x - s.ax) * s.ux + (z - s.az) * s.uz)); return Math.hypot(x - s.ax - s.ux * t, z - s.az - s.uz * t); } }));
  tracks.push({ ring: true, len: TAU, step: 1 / RING, k: RING,
    pt: (u, d, o = 0) => { const r = RING - d * (LANE + o); return [Math.cos(u) * r, Math.sin(u) * r]; }, dir: (u) => [-Math.sin(u), Math.cos(u)],
    dist: (x, z) => Math.abs(Math.hypot(x, z) - RING) });
  const near = (x, z, lim) => { let best = null, bd = lim; for (const T of tracks) { const d = T.dist(x, z); if (d < bd) { bd = d; best = T; } } return best; };
  const tangent = (T, x, z) => (T.ring ? T.dir(Math.atan2(z, x)) : T.dir());

  // ---- 1. street segments that a highway runs along for 20 m or more are given to it ----
  for (let j = -NB; j <= 10; j++) for (let i = -NB - 1; i <= NB; i++) {
    for (const v of [true, false]) {
      if ((v ? eSeg(i, j) : sSeg(i, j)) !== 'street') continue;
      let n = 0;
      for (let w = -48; w <= 48; w += 2) {
        const x = v ? i * P + 60 : i * P + w, z = v ? j * P + w : j * P + 60, T = near(x, z, 13.5);
        if (T) { const [tx, tz] = tangent(T, x, z); if (Math.abs(v ? tx : tz) < 0.5) n++; }
      }
      if (n >= 10) ABSORBED.add((v ? 'v' : 'h') + i + ':' + j);
    }
  }

  // ---- 2. what part of the street grid a point is on (null when it is not on a street) ----
  const M = 10.5;
  const inStreet = (x, z) => {
    const X = Math.round((x - 60) / P) * P + 60, Z = Math.round((z - 60) / P) * P + 60, dx = Math.abs(x - X), dz = Math.abs(z - Z), i = (X - 60) / P, j = (Z - 60) / P;
    if (dx < M && dz < M) return corner(i, j).arms > 0 ? { kind: 'j', i, j, X, Z } : null;
    if (dx < M) return eSeg(i, Math.round(z / P)) === 'street' ? { kind: 'v', X } : null;
    if (dz < M) return sSeg(Math.round(x / P), j) === 'street' ? { kind: 'h', Z } : null;
    return null;
  };

  // ---- 3. crossings: stretches of each track that run over a street or a junction ----
  const list = [], lines = new Map();
  for (const T of tracks) {
    T.crossings = [];
    let run = null;
    const close = () => { if (run) { make(T, run); run = null; } };
    for (let u = 0; u <= T.len; u += T.step) {
      const [x, z] = T.pt(u, 0, -LANE), s = inStreet(x, z);
      if (s) { if (!run) run = { u0: u, u1: u, hits: [] }; run.u1 = u; run.hits.push(s); }
      else if (run && (u - run.u1) * T.k > 3) close();
    }
    close();
  }
  function make(T, run) {
    if ((run.u1 - run.u0) * T.k < 1) return;
    const c = { id: list.length, T, u0: run.u0, u1: run.u1, jn: null, off: (list.length * 7) % 30, entry: {}, heads: [] };
    // the junction it passes through, if any
    const js = new Map(); for (const h of run.hits) if (h.kind === 'j') { const k = h.i * 100 + h.j; js.set(k, (js.get(k) || 0) + 1); }
    if (js.size) { const k = [...js.entries()].sort((a, b) => b[1] - a[1])[0][0], h = run.hits.find((q) => q.kind === 'j' && q.i * 100 + q.j === k); c.jn = { i: h.i, j: h.j }; const cn = corner(h.i, h.j); cn.hw = true; cn.signal = true; }
    // where each direction's lane meets the street
    for (const d of [1, -1]) {
      let lo = null, hi = null;
      for (let u = run.u0 - 15 / T.k; u <= run.u1 + 15 / T.k; u += T.step) { const [x, z] = T.pt(u, d); if (inStreet(x, z)) { if (lo === null) lo = u; hi = u; } }
      c.entry[d] = d > 0 ? (lo ?? run.u0) : (hi ?? run.u1);
    }
    // the street lines it touches, and where each of their lanes meets the highway
    const um = (run.u0 + run.u1) / 2, [mx, mz] = T.pt(um, 0, -LANE), keys = new Set();
    for (const h of run.hits) { if (h.kind === 'v' || h.kind === 'j') keys.add('z:' + h.X); if (h.kind === 'h' || h.kind === 'j') keys.add('x:' + h.Z); }
    c.lines = [];
    for (const key of keys) {
      const ax = key[0], L = +key.slice(2), mid = ax === 'z' ? mz : mx, e = {};
      for (const d of [1, -1]) {
        let lo = null, hi = null;
        for (let w = mid - 60; w <= mid + 60; w += 0.5) { const x = ax === 'z' ? L - d * AV : w, z = ax === 'z' ? w : L + d * AV; if (T.dist(x, z) < HALF + 1.6) { if (lo === null) lo = w; hi = w; } }
        if (lo !== null) e[d] = d > 0 ? lo : hi;
      }
      if (e[1] === undefined && e[-1] === undefined) continue;
      const hz = { c, ax, L, e }; c.lines.push(hz);
      if (!lines.has(key)) lines.set(key, []); lines.get(key).push(hz);
    }
    // a crossing close enough to a junction that cars would queue for that junction inside it becomes part of the junction
    if (!c.jn) {
      let best = null, bd = 31;
      for (const h of c.lines) {
        const ws = [h.e[1], h.e[-1]].filter((w) => w !== undefined), lo = Math.min(...ws), hi = Math.max(...ws);
        for (let k = Math.floor((lo - 60) / P) - 1; k <= Math.ceil((hi - 60) / P) + 1; k++) {
          const jc = k * P + 60, d = jc < lo ? lo - jc : jc > hi ? jc - hi : 0;
          if (d >= bd) continue;
          const i = h.ax === 'z' ? (h.L - 60) / P : k, j = h.ax === 'z' ? k : (h.L - 60) / P;
          if (corner(i, j).arms > 0) { best = { i, j }; bd = d; }
        }
      }
      if (best) { c.jn = best; const cn = corner(best.i, best.j); cn.hw = true; cn.signal = true; }
    }
    T.crossings.push(c); list.push(c);
  }

  // signal state for one crossing: { hw, ns, ew } (0 green, 1 amber, 2 red)
  const state = (c, t) => {
    if (c.jn) return signalState(c.jn.i, c.jn.j, t);
    // 30 s: highway green 11 s, amber 2, then 3 s all-red; street green 9 s, amber 2, then 3 s all-red
    const ph = mod(t + c.off, 30), st = ph >= 18 && ph < 27 ? 0 : ph >= 27 && ph < 29 ? 1 : 2;
    return { hw: ph >= 2 && ph < 13 ? 0 : ph >= 13 && ph < 15 ? 1 : 2, ns: st, ew: st };
  };
  // how fast a vehicle may go given a red light at distance dist (metres to where its front must stop)
  const brake = (dist) => (dist < 0.6 ? 0 : 1.2 + dist * 0.6);

  // junction signal poles that would stand on a highway are left out
  for (let j = -NB - 1; j <= 10; j++) for (let i = -NB - 1; i <= NB; i++) { const cn = corner(i, j); if (!cn.signal) continue; const all = signalPoles({ x: cn.x, z: cn.z }), ok = all.filter(([x, z]) => !tracks.some((T) => T.dist(x, z) < HALF + 1.6)); if (ok.length < all.length) cn.poles = ok; }

  return {
    list, lines, tracks, state, inStreet,
    // a highway pod: track index (radials in order, then the ring), parameter u, direction d, its length, the time
    highwayLimit(ti, u, d, l, t) {
      const T = tracks[ti]; let lim = Infinity;
      for (const c of T.crossings) {
        const e = c.entry[d], raw = T.ring ? mod((e - u) * d, TAU) : (e - u) * d, dist = (T.ring && raw > Math.PI ? raw - TAU : raw) * T.k - l / 2 - STOP;
        if (dist < -1 || dist > 40) continue;
        const s = state(c, t).hw; if (s === 0 || (s === 1 && dist < 4)) continue;
        lim = Math.min(lim, brake(Math.max(0, dist)));
      }
      return lim;
    },
    // an avenue pod on line L of axis ax ('z': it moves along z on x = L), at s, direction d
    lineLimit(ax, L, s, d, l, t) {
      const hs = lines.get(ax + ':' + L); if (!hs) return Infinity;
      let lim = Infinity;
      for (const h of hs) {
        const e = h.e[d]; if (e === undefined) continue;
        const dist = (e - s) * d - l / 2 - STOP; if (dist < -1 || dist > 40) continue;
        const st = state(h.c, t)[ax === 'z' ? 'ns' : 'ew']; if (st === 0 || (st === 1 && dist < 4)) continue;
        lim = Math.min(lim, brake(Math.max(0, dist)));
      }
      return lim;
    },
    near: (x, z, lim) => near(x, z, lim),
  };
}

// Poles, heads and stop lines for every crossing, written into the static ground mesh; the lamps
// are one instanced mesh whose colours follow the signals.
export function buildCrossingSignals(X, GB, col, yAt) {
  const lamps = [], WHITE = new THREE.Color('#dfe6f0').multiplyScalar(0.75);
  const head = (c, kind, px, py, pz, a, arm) => {
    const ax = Math.sin(a), az = Math.cos(a), fx = az, fz = -ax;
    for (let k = 0; k < 3; k++) lamps.push(arm ? { c, kind, k, x: px + ax * 4.2 + fx * 0.22, y: py + 5.6 - k * 0.4, z: pz + az * 4.2 + fz * 0.22 } : { c, kind, k, x: px + ax * 0.22, y: py + 3.6 - k * 0.4, z: pz + az * 0.22 });
  };
  const pole = (c, kindArm, kindLow, x, z, a) => { const y = yAt(x, z); draw.signal(GB, x, y, z, a); col.box(x - 0.14, x + 0.14, y, y + 6, z - 0.14, z + 0.14, { noCam: true }); head(c, kindArm, x, y, z, a, true); head(c, kindLow, x, y, z, a, false); };
  for (const c of X.list) {
    const T = c.T;
    for (const d of [1, -1]) {
      // highway: a stop line across this direction's lanes, and a pole on its right-hand shoulder
      let u = c.entry[d] - (d * STOP) / T.k;
      const [tx, tz] = T.ring ? T.dir(u) : T.dir(), fx = tx * d, fz = tz * d, yaw = Math.atan2(fx, fz);
      const [lx, lz] = T.pt(u, d); GB.quad('G', WHITE, 6.6, 0.45, lx, 0.07, lz, yaw);
      for (let n = 0; n < 10; n++) { const [px, pz] = T.pt(u, d, HALF + 1.4 - LANE); if (!X.inStreet(px, pz) && !X.tracks.some((q) => q !== T && q.dist(px, pz) < HALF + 2)) { pole(c, 'hw', 'hw', px, pz, Math.atan2(fz, -fx)); break; } u -= (d * 2) / T.k; }
    }
    if (c.jn) continue;                                         // a junction crossing uses the junction's own poles
    for (const h of c.lines) for (const d of [1, -1]) {
      const e = h.e[d]; if (e === undefined) continue;
      // street: a stop line across the lane, and a pole on the kerb side, its arm out over the lane
      let w = e - d * (STOP + 1);
      const lx = h.ax === 'z' ? h.L - d * AV : w, lz = h.ax === 'z' ? w : h.L + d * AV;
      GB.quad('G', WHITE, h.ax === 'z' ? 8 : 0.45, h.ax === 'z' ? 0.45 : 8, lx, 0.02, lz);
      for (let n = 0; n < 10; n++) {
        const px = h.ax === 'z' ? h.L - d * 10.8 : w, pz = h.ax === 'z' ? w : h.L + d * 10.8;
        if (!X.tracks.some((q) => q.dist(px, pz) < HALF + 1.6)) { pole(c, h.ax === 'z' ? 'ns' : 'ew', h.ax === 'z' ? 'ns' : 'ew', px, pz, h.ax === 'z' ? (d > 0 ? Math.PI / 2 : -Math.PI / 2) : (d > 0 ? Math.PI : 0)); break; }
        w -= d * 2;
      }
    }
  }
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), new THREE.MeshBasicMaterial(), Math.max(1, lamps.length)), m4 = new THREE.Matrix4();
  lamps.forEach((q, n) => { m4.makeTranslation(q.x, q.y, q.z); im.setMatrixAt(n, m4); im.setColorAt(n, OFF); });
  im.count = lamps.length; im.frustumCulled = false;
  let tq = 0;
  return {
    mesh: im, lamps,
    update(dt, t) {
      tq -= dt; if (tq > 0) return; tq = 0.25;
      const st = new Map();
      lamps.forEach((q, n) => { let s = st.get(q.c); if (!s) st.set(q.c, (s = X.state(q.c, t))); const v = s[q.kind]; im.setColorAt(n, (v === 0 && q.k === 2) || (v === 1 && q.k === 1) || (v === 2 && q.k === 0) ? SIG[v] : OFF); });
      im.instanceColor.needsUpdate = true;
    },
  };
}

// A concrete median down the middle of every highway and the ring road, and steel guard rails
// along both edges, in 6 m pieces; open wherever the road meets a street (and at its ends and
// junctions), so traffic still crosses at the signals.
export function buildBarriers(X, GB, col) {
  const PIECE = 6, CON = '#9a9ea6', STEEL = '#aeb6c2', AMBER = new THREE.Color('#ffb347').multiplyScalar(1.2);
  let pieces = 0;
  for (const T of X.tracks) {
    const du = PIECE / T.k, margin = 9 / T.k, start = T.ring ? 0 : 14 / T.k, end = T.ring ? T.len : T.len - 14 / T.k;
    const nearCrossing = (u) => T.crossings.some((c) => u > Math.min(c.entry[1], c.u0) - margin && u < Math.max(c.entry[-1], c.u1) + margin);
    const nearOther = (x, z) => X.tracks.some((q) => q !== T && q.dist(x, z) < 22);
    for (let u = start; u + du <= end; u += du) {
      const um = u + du / 2; if (nearCrossing(um)) continue;
      const [tx, tz] = T.ring ? T.dir(um) : T.dir(), yaw = Math.atan2(tx, tz);
      for (const side of [0, 1, -1]) {
        const [x, z] = side === 0 ? T.pt(um, 0) : T.pt(um, side, HALF + 0.4 - LANE), [x0, z0] = side === 0 ? T.pt(u, 0) : T.pt(u, side, HALF + 0.4 - LANE), [x1, z1] = side === 0 ? T.pt(u + du, 0) : T.pt(u + du, side, HALF + 0.4 - LANE);
        if (X.inStreet(x0, z0) || X.inStreet(x1, z1) || X.inStreet(x, z) || nearOther(x, z)) continue;
        if (side === 0) { GB.box('S', CON, 0.6, 0.8, PIECE + 0.05, x, 0.42, z, yaw); GB.box('S', '#b9bcc2', 0.3, 0.12, PIECE + 0.05, x, 0.86, z, yaw); GB.box('G', AMBER, 0.62, 0.08, 0.2, x, 0.6, z, yaw); }
        else {
          GB.box('S', STEEL, 0.1, 0.32, PIECE + 0.05, x, 0.62, z, yaw);
          for (const e of [-PIECE / 2 + 0.3, 0.3]) GB.box('S', '#6a7280', 0.14, 0.75, 0.14, x + tx * e, 0.38, z + tz * e, yaw);
          GB.box('G', AMBER, 0.12, 0.1, 0.1, x - side * tz * 0.06, 0.66, z + side * tx * 0.06, yaw);
        }
        // solid in 2 m boxes, so a diagonal piece does not reach into the lanes
        for (let k = 0; k < 3; k++) { const f = (k + 0.5) / 3, cx = x0 + (x1 - x0) * f, cz = z0 + (z1 - z0) * f; col.box(cx - 0.5, cx + 0.5, 0, side === 0 ? 0.9 : 0.8, cz - 0.5, cz + 0.5, { noCam: true }); }
        pieces++;
      }
    }
  }
  return pieces;
}
