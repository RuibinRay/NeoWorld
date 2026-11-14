// Pedestrian navigation graph: pavement rings around every block, crosswalks, park paths,
// and the walk-in interiors. Residents plan routes over this with A*.
import * as THREE from 'three';
import { BLOCKS, FY } from './city.js';
import { neon } from './materials.js';

export function buildNav(city) {
  const nodes = [], byId = new Map(), crossings = [], doors = [];
  const add = (id, x, z, o = {}) => { const n = { id, x, z, y: FY, links: [], ...o }; nodes.push(n); byId.set(id, n); return n; };
  const get = (a) => (typeof a === 'string' ? byId.get(a) : a);
  const link = (a, b) => { a = get(a); b = get(b); if (!a || !b) { console.warn('nav: missing node', a, b); return; } if (!a.links.includes(b)) { a.links.push(b); b.links.push(a); } };
  const chain = (...ids) => { for (let i = 0; i < ids.length - 1; i++) link(ids[i], ids[i + 1]); };

  // pavement rings
  const rings = BLOCKS.map(() => ({ N: [], S: [], W: [], E: [] }));
  const ringNode = (i, edge, t, id, o) => {
    const b = BLOCKS[i];
    o = { street: true, ...o };
    const n = edge === 'N' ? add(id, b.cx + t, b.z0 + 4, o) : edge === 'S' ? add(id, b.cx + t, b.z1 - 4, o) : edge === 'W' ? add(id, b.x0 + 4, b.cz + t, o) : add(id, b.x1 - 4, b.cz + t, o);
    rings[i][edge].push(n); return n;
  };
  BLOCKS.forEach((b, i) => {
    const st = { street: true };
    const nw = add(`b${i}NW`, b.x0 + 4, b.z0 + 4, st), ne = add(`b${i}NE`, b.x1 - 4, b.z0 + 4, st), sw = add(`b${i}SW`, b.x0 + 4, b.z1 - 4, st), se = add(`b${i}SE`, b.x1 - 4, b.z1 - 4, st);
    rings[i].N.push(nw, ne); rings[i].S.push(sw, se); rings[i].W.push(nw, sw); rings[i].E.push(ne, se);
    for (const e of ['N', 'S', 'W', 'E']) ringNode(i, e, 0, `b${i}m${e}`);
    if (i === 4 || i === 3) return; // park + skyport have no building doors
    for (const e of ['N', 'S', 'W', 'E']) {
      if (i === 1 && e === 'S') continue;
      if (i === 7 && e === 'N') continue;
      for (const t of [-24, 24]) { const n = ringNode(i, e, t, `d${i}${e}${t > 0 ? 'b' : 'a'}`, { door: true }); doors.push(n.id); }
    }
  });
  ringNode(1, 'S', 24, 'restDoor'); ringNode(1, 'S', -25, 'liftDoor', { door: true }); doors.push('liftDoor');
  [-35, -18, 18, 35].forEach((t, k) => { ringNode(7, 'N', t, `old${k}`, { door: true }); doors.push(`old${k}`); });
  rings.forEach((r) => {
    for (const e of ['N', 'S']) { r[e].sort((a, b) => a.x - b.x); for (let k = 0; k < r[e].length - 1; k++) link(r[e][k], r[e][k + 1]); }
    for (const e of ['W', 'E']) { r[e].sort((a, b) => a.z - b.z); for (let k = 0; k < r[e].length - 1; k++) link(r[e][k], r[e][k + 1]); }
  });
  // crosswalks
  const cross = (a, b) => { link(a, b); const A = get(a), B = get(b); crossings.push([A.x, A.z, B.x, B.z]); };
  for (let row = 0; row < 3; row++) for (let c = 0; c < 3; c++) {
    const i = row * 3 + c;
    if (c < 2) { cross(`b${i}NE`, `b${i + 1}NW`); cross(`b${i}SE`, `b${i + 1}SW`); cross(`b${i}mE`, `b${i + 1}mW`); }
    if (row < 2) { cross(`b${i}SW`, `b${i + 3}NW`); cross(`b${i}SE`, `b${i + 3}NE`); cross(`b${i}mS`, `b${i + 3}mN`); }
  }
  // maglev station forecourts, across the ring road from each side's mid-block node
  ['b1mN', 'b5mE', 'b7mS', 'b3mW'].forEach((ring, k) => { const st = city.stations[k]; add('mag' + k, st.bottom.x, st.bottom.z, { street: true }); cross(ring, 'mag' + k); });

  // park (block 4)
  add('fN', 0, -9); add('fE', 9, 0); add('fS', 0, 9); add('fW', -9, 0);
  add('oN', 0, -20); add('oE', 20, 0); add('oS', 0, 20); add('oW', -20, 0);
  add('nMid', 0, -37); add('sMid', 0, 27);
  chain('b4mN', 'nMid', 'oN', 'fN'); chain('b4mS', 'sMid', 'oS', 'fS'); chain('b4mW', 'oW', 'fW'); chain('b4mE', 'oE', 'fE');
  chain('fN', 'fE', 'fS', 'fW', 'fN');
  for (const [id, sx, sz, corner, a, b] of [['gNE', 1, -1, 'b4NE', 'oN', 'oE'], ['gSE', 1, 1, 'b4SE', 'oS', 'oE'], ['gSW', -1, 1, 'b4SW', 'oS', 'oW'], ['gNW', -1, -1, 'b4NW', 'oN', 'oW']]) {
    add(id, sx * 24, sz * 24, { park: true }); link(id, corner); link(id, a); link(id, b);
  }
  add('aud', -12, 26); link('aud', 'sMid'); link('aud', 'gSW');
  [[-16, 24], [-13, 23], [-10, 24.5], [-8, 27], [-15, 27.5], [-11, 28], [-17, 29.5], [-13.5, 29.8]].forEach(([x, z], k) => { add(`aud${k}`, x, z, { aud: true }); link(`aud${k}`, 'aud'); });
  add('vend', 5, -38.4); link('vend', 'nMid'); link('vend', 'fN');
  add('jobs', -5, -38.6); link('jobs', 'nMid');
  add('cartF', -40, -4.2); link('cartF', 'b4mW'); link('cartF', 'fW');
  add('cartB', -43.4, -7.4); add('cartV', -40, -7.4); chain('b4mW', 'cartB', 'cartV');
  city.places.planters.forEach((p, k) => { const id = `plant${k}`; add(id, p.x, p.z); link(id, p.x > 0 ? (p.z > 0 ? 'gSE' : 'gNE') : p.z > 0 ? 'gSW' : 'gNW'); });
  add('play', 13, 26.5); link('play', 'sMid'); link('play', 'gSE');
  for (let k = 0; k < 4; k++) { add(`play${k}`, 13 + Math.cos(k * 1.57 + 0.4) * 3, 30 + Math.sin(k * 1.57 + 0.4) * 3); link(`play${k}`, 'play'); }
  add('dock', 40, 6); link('dock', 'b4mE'); link('dock', 'fE');
  // evening market stalls (customer side and vendor side) and the morning exercise leader
  add('stallBack', 24.5, -6.8); link('stallBack', 'oE');
  city.places.market.stalls.forEach((st, k) => { add('stallF' + k, st.x, -3); add('stallV' + k, st.x, -6.8); link('stallF' + k, k ? 'stallF' + (k - 1) : 'oE'); link('stallV' + k, k ? 'stallV' + (k - 1) : 'stallBack'); });
  link('stallF2', 'b4mE');
  add('audLead', -12, 21.6); link('audLead', 'aud');
  const fRing = ['fN', 'fE', 'fS', 'fW'].map(get);
  // seats: benches hang off the fountain ring, stools off the restaurant lane
  add('restIn', 24, -79.6); link('restIn', 'restDoor');
  add('restAisle', 24, -86.5); link('restAisle', 'restIn');
  add('restCounter', 24, -93.6); link('restCounter', 'restAisle');
  add('restHost', 27.2, -81.4); link('restHost', 'restIn');
  add('restKitGate', 40.2, -93); add('restKit', 40.2, -98); add('restChef', 33, -98); chain('restKitGate', 'restKit', 'restChef');
  const lanes = [get('restAisle')];
  for (const s of city.seats) {
    if (s.kind === 'chair') continue; // shop and terrace chairs need no route: residents do not use them
    if (s.kind === 'bench') {
      const fid = 'bf:' + s.id.slice(0, -1);
      if (!byId.has(fid)) { const f = add(fid, s.front.x, s.front.z); [...fRing].sort((a, b) => (a.x - f.x) ** 2 + (a.z - f.z) ** 2 - (b.x - f.x) ** 2 - (b.z - f.z) ** 2).slice(0, 2).forEach((n) => link(f, n)); }
      const n = add('seat:' + s.id, s.x, s.z, { seat: s }); link(n, fid); s.node = n.id;
    } else {
      const ln = add('lane:' + s.id, s.lane.x, s.lane.z); lanes.push(ln);
      const n = add('seat:' + s.id, s.x, s.z, { seat: s }); link(n, ln); s.node = n.id;
    }
  }
  const laneSet = [...new Map(lanes.map((n) => [n.x.toFixed(2), n])).values()].sort((a, b) => a.x - b.x);
  for (const n of lanes) { const rep = laneSet.find((m) => m.x.toFixed(2) === n.x.toFixed(2)); if (rep !== n) link(n, rep); }
  for (let k = 0; k < laneSet.length - 1; k++) link(laneSet[k], laneSet[k + 1]);
  link(laneSet[laneSet.length - 1], 'restKitGate');
  // shop
  add('shopIn', 79.6, 0); link('shopIn', 'b5mW');
  add('shopA', 84, -6.5); add('shopB', 84, 6.5); add('shopC', 90, -11.5); add('shopD', 90, 11.5); add('shopCounter', 95.6, 0);
  add('shopK1', 95.6, -6.6); add('shopK2', 99.6, -6.6); add('shopClerk', 99.6, 0);
  link('shopIn', 'shopA'); link('shopIn', 'shopB'); link('shopA', 'shopB'); link('shopA', 'shopC'); link('shopB', 'shopD');
  link('shopC', 'shopCounter'); link('shopD', 'shopCounter'); link('shopIn', 'shopCounter'); chain('shopCounter', 'shopK1', 'shopK2', 'shopClerk');
  // skyport
  add('skyHub', -84, 0); add('skyHub2', -106, 0); add('skyOps', -80, 3.4);
  add('pw1', -92, 15.6); add('pw2', -92, -15.6); add('pw3', -120, 15.6); add('pw4', -120, -15.2);
  chain('b3mE', 'skyHub', 'skyHub2'); link('skyHub', 'skyOps'); link('skyHub', 'pw1'); link('skyHub', 'pw2'); link('skyHub2', 'pw3'); link('skyHub2', 'pw4');

  // A* over the graph (it is small: a few hundred nodes), with a route cache
  const cache = new Map();
  const path = (from, to) => {
    from = get(from); to = get(to);
    if (!from || !to) return null;
    if (from === to) return [from];
    const key = from.id + '>' + to.id;
    if (cache.has(key)) return cache.get(key);
    const open = [from], came = new Map(), g = new Map([[from, 0]]), f = new Map([[from, 0]]), closed = new Set();
    let found = null;
    while (open.length) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (f.get(open[i]) < f.get(open[bi])) bi = i;
      const cur = open.splice(bi, 1)[0];
      if (cur === to) { found = cur; break; }
      closed.add(cur);
      for (const nb of cur.links) {
        if (closed.has(nb)) continue;
        const ng = g.get(cur) + Math.hypot(nb.x - cur.x, nb.z - cur.z);
        if (ng < (g.get(nb) ?? Infinity)) { came.set(nb, cur); g.set(nb, ng); f.set(nb, ng + Math.hypot(to.x - nb.x, to.z - nb.z)); if (!open.includes(nb)) open.push(nb); }
      }
    }
    let out = null;
    if (found) { out = [found]; while (came.has(out[0])) out.unshift(came.get(out[0])); }
    cache.set(key, out);
    return out;
  };
  const nearest = (x, z, filter) => {
    let best = null, bd = Infinity;
    for (const n of nodes) { if (filter && !filter(n)) continue; const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; best = n; } }
    return best;
  };

  // paint the crosswalks
  {
    const list = [];
    for (const [ax, az, bx, bz] of crossings) {
      const len = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / len, dz = (bz - az) / len;
      for (let s = 5; s <= len - 5; s += 1.3) list.push([ax + dx * s, az + dz * s, Math.abs(dx) > 0.5]);
    }
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), neon('#cfe6ff', 0.7), list.length), m = new THREE.Matrix4();
    list.forEach(([x, z, alongX], i) => { m.makeScale(alongX ? 0.55 : 3.4, 0.02, alongX ? 3.4 : 0.55); m.setPosition(x, 0.025, z); im.setMatrixAt(i, m); });
    city.group.add(im);
  }
  // the Old Quarter shops: a node at each door and three inside, so residents can go in and browse
  const shopNodes = [], payNodes = {};
  for (const st of city.stores) if (st.keeper) {
    const cx = st.counter.x, d = add('oq:' + st.id, cx, 75.6), c = add('oqC:' + st.id, cx, 79.6), a = add('oqA:' + st.id, cx - 3.6, 86.6), b = add('oqB:' + st.id, cx + 3.2, 88.6);
    link(d, c); link(c, a); link(c, b); link(d, nearest(cx, 73.5, (q) => q.street)); shopNodes.push(a.id, b.id);
    const pay = add('oqP:' + st.id, cx - 0.4, 88.7); link(a, pay); link(b, pay); link(c, pay);       // in front of the counter, to pay
    payNodes[a.id] = payNodes[b.id] = { id: pay.id, keeper: st.keeper, name: st.name };
  }
  return { nodes, byId, get, path, nearest, doors, crossings, add, link, shopNodes, payNodes };
}
