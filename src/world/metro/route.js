// "Navigate to": the shortest way along the streets from where you are to a point you picked
// on the map. Junctions of the grid are the nodes; every street segment between two junctions
// is an edge (the canal is not, the bridges are).
import { P, NB } from './landuse.js';
import { eSeg, sSeg } from './streets.js';

const ok = (s) => s === 'street' || s === 'meridian';
const key = (i, j) => (i + 20) * 64 + (j + 20);
// neighbours of junction (i, j): [i, j] pairs reachable by one street segment
function next(i, j) {
  const out = [];
  if (j < 10 && ok(eSeg(i, j + 1))) out.push([i, j + 1]);
  if (j > -NB - 1 && ok(eSeg(i, j))) out.push([i, j - 1]);
  if (i < NB && ok(sSeg(i + 1, j))) out.push([i + 1, j]);
  if (i > -NB - 1 && ok(sSeg(i, j))) out.push([i - 1, j]);
  return out;
}
const nodeAt = (x, z) => [Math.max(-NB - 1, Math.min(NB, Math.round((x - 60) / P))), Math.max(-NB - 1, Math.min(9, Math.round((z - 60) / P)))];
// Returns { pts: [[x, z], ...], len } or null when there is no way through.
export function findRoute(x0, z0, x1, z1) {
  const a = nodeAt(x0, z0), prev = new Map([[key(a[0], a[1]), null]]), q = [a];
  // flood out from the start; the route ends at the reachable junction nearest the destination
  let best = a, bd = Infinity;
  for (let h = 0; h < q.length; h++) {
    const [i, j] = q[h], d = Math.hypot(i * P + 60 - x1, j * P + 60 - z1);
    if (d < bd) { bd = d; best = q[h]; }
    for (const n of next(i, j)) { const k = key(n[0], n[1]); if (!prev.has(k)) { prev.set(k, [i, j]); q.push(n); } }
  }
  if (q.length < 2) return null;
  const pts = [[x1, z1]];
  for (let n = best; n; n = prev.get(key(n[0], n[1]))) pts.push([n[0] * P + 60, n[1] * P + 60]);
  pts.push([x0, z0]); pts.reverse();
  // leave out a first junction that would mean doubling back
  if (pts.length > 3) { const [p0, p1, p2] = pts; if ((p1[0] - p0[0]) * (p2[0] - p1[0]) + (p1[1] - p0[1]) * (p2[1] - p1[1]) < 0) pts.splice(1, 1); }
  let len = 0; for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
  return { pts, len };
}
