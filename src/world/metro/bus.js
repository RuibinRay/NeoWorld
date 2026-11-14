// Avenue buses: three loop lines through the new parts of the city, two buses on each. A bus
// follows the streets in the right-hand lane, stops for red lights and for anyone in the road,
// and waits at each stop. The ride system (systems/rides.js) lets the player board at a stop.
import * as THREE from 'three';
import { G } from '../../core/game.js';
import { PathLine, damp, dampAngle } from '../../core/util.js';
import { P, areaAt } from './landuse.js';
import { corner, signalState } from './streets.js';
import { findRoute } from './route.js';
import { Fleet } from '../../entities/fleet.js';
import { streetName } from './buildings.js';

// way: junctions (i, j) the loop passes through, in order; each is a stop
const LINES = [
  { id: 'M1', title: 'M1 Park and Beach loop', color: '#59e0ff', way: [[2, 2], [3, 9], [8, 9], [8, 3], [3, 3]] },
  { id: 'M2', title: 'M2 Harbor loop', color: '#ffd34d', way: [[-2, 2], [-2, 9], [-8, 9], [-8, 2]] },
  { id: 'M3', title: 'M3 Heights loop', color: '#7dff9c', way: [[-2, -3], [-5, -5], [-10, -5], [-10, -10], [-5, -10]] },
];
const LANE = 4.2, PER = 2;

export function buildBuses(scene, yAt, xing) {
  const lines = [], buses = [];
  for (const L of LINES) {
    // chain the waypoints along the streets into one closed loop of junctions
    const pts = [];
    L.way.forEach(([i, j], n) => { const [i2, j2] = L.way[(n + 1) % L.way.length], r = findRoute(i * P + 60, j * P + 60, i2 * P + 60, j2 * P + 60); const leg = r ? r.pts.slice(1, -1) : [[i * P + 60, j * P + 60]]; for (const q of leg) { const last = pts[pts.length - 1]; if (!last || Math.hypot(last[0] - q[0], last[1] - q[1]) > 1) pts.push(q); } });
    if (pts.length > 2 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1) pts.pop();
    // shift every corner into the right-hand lane
    const n = pts.length, lane = pts.map((q, k) => {
      const a = pts[(k + n - 1) % n], b = pts[(k + 1) % n], d1 = [Math.sign(q[0] - a[0]), Math.sign(q[1] - a[1])], d2 = [Math.sign(b[0] - q[0]), Math.sign(b[1] - q[1])];
      return [q[0] + (-d1[1] - d2[1]) * LANE * (d1[0] === d2[0] && d1[1] === d2[1] ? 0.5 : 1), 0, q[1] + (d1[0] + d2[0]) * LANE * (d1[0] === d2[0] && d1[1] === d2[1] ? 0.5 : 1)];
    });
    const path = new PathLine(lane, true), v = new THREE.Vector3();
    // junction data along the path: distance, grid index, which signal axis the bus arrives on
    const nodes = pts.map((q, k) => { const a = pts[(k + n - 1) % n]; return { s: path.len[k], i: Math.round((q[0] - 60) / P), j: Math.round((q[1] - 60) / P), axis: Math.abs(q[0] - a[0]) > Math.abs(q[1] - a[1]) ? 'ew' : 'ns' }; });
    const stops = L.way.map(([i, j]) => { const k = nodes.findIndex((q) => q.i === i && q.j === j), s = ((k >= 0 ? nodes[k].s : 0) + 30.5) % path.total; path.sample(s, v); const yaw = path.sample(s, v), x = v.x - Math.cos(yaw) * 7.3, z = v.z + Math.sin(yaw) * 7.3; return { s, x, y: yAt(x, z), z, yaw, name: `${streetName(true, i)} & ${streetName(false, j)}`, area: areaAt(i * P + 60, j * P + 60) || 'Midtown' }; });
    // where the loop crosses a highway or the ring road: stop there when the signal says so
    const hazards = []; let run = null;
    for (let s = 0; s <= path.total; s += 1) {
      const yaw = path.sample(s, v), T = xing.near(v.x, v.z, 8 + 2.2);
      if (T) { if (!run) run = { s0: s, T, x: v.x, z: v.z, axis: Math.abs(Math.cos(yaw)) > 0.7 ? 'ns' : 'ew' }; }
      else if (run) { const c = T0(run); if (c) hazards.push({ s0: run.s0, c, axis: run.axis }); run = null; }
    }
    function T0(r) { let best = null, bd = 60; for (const c of r.T.crossings) { const [cx, cz] = r.T.pt((c.u0 + c.u1) / 2, 0); const d = Math.hypot(cx - r.x, cz - r.z); if (d < bd) { bd = d; best = c; } } return best; }
    const line = { ...L, path, nodes, stops, pts, hazards }; lines.push(line);
    for (let b = 0; b < PER; b++) buses.push({ line, s: (b / PER) * path.total, v: 0, dwell: 0, at: -1, next: 0, p: new THREE.Vector3(), yaw: 0 });
  }
  const bodyG = new THREE.BoxGeometry(2.5, 2.6, 9.6); bodyG.translate(0, 1.75, 0);
  const winG = new THREE.BoxGeometry(2.54, 0.9, 8.6); winG.translate(0, 2.2, 0);
  const stripeG = new THREE.BoxGeometry(2.56, 0.22, 9.64); stripeG.translate(0, 1.0, 0);
  const body = new THREE.InstancedMesh(bodyG, new THREE.MeshStandardMaterial({ color: '#eef1f5', roughness: 0.35, metalness: 0.5 }), buses.length);
  const win = new THREE.InstancedMesh(winG, new THREE.MeshStandardMaterial({ color: '#141b26', roughness: 0.1, metalness: 0.9 }), buses.length);
  const stripe = new THREE.InstancedMesh(stripeG, new THREE.MeshBasicMaterial(), buses.length), c = new THREE.Color();
  buses.forEach((b, k) => stripe.setColorAt(k, c.set(b.line.color).multiplyScalar(1.3)));
  for (const m of [body, win, stripe]) { m.frustumCulled = false; scene.add(m); } body.castShadow = true;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  for (const b of buses) { b.yaw = b.line.path.sample(b.s, b.p); b.next = b.line.stops.findIndex((st) => st.s > b.s); if (b.next < 0) b.next = 0; }

  return {
    lines, buses,
    update(dt, t) {
      const p = G.player, who = p.state === 'drive' ? G.car.pos : p.pos, low = who.y < 5;
      buses.forEach((b, k) => {
        const L = b.line, T = L.path.total;
        let target = 11.5;
        if (b.dwell > 0) { b.dwell -= dt; target = 0; if (b.dwell <= 0) { b.at = -1; b.next = (b.next + 1) % L.stops.length; } }
        else {
          const st = L.stops[b.next], ds = (st.s - b.s + T) % T;
          if (ds < 40) target = Math.min(target, 1.2 + ds * 0.45);
          if (ds < 0.8 || ds > T - 3) { b.dwell = 9; b.at = b.next; target = 0; }
          // red light ahead?
          for (const nd of L.nodes) { const dn = (nd.s - b.s + T) % T - 17; if (dn > -1 && dn < 30) { const cn = corner(nd.i, nd.j); if (cn.signal && signalState(nd.i, nd.j, t)[nd.axis] !== 0) target = dn < 1.2 ? 0 : Math.min(target, 2 + dn * 0.6); break; } }
          for (const q of G.metro.traffic.pods) if (q.on && Math.abs(q.x - b.p.x) < 40 && Math.abs(q.z - b.p.z) < 40) { const g = Fleet.gap(b.p.x, b.p.z, b.yaw, 2.5, 9.6, q, true); if (g < 30) target = Math.min(target, Math.max(0, (g - 2.5) * 1.5)); }
          for (const q of buses) if (q !== b) { const g = Fleet.gap(b.p.x, b.p.z, b.yaw, 2.5, 9.6, { x: q.p.x, z: q.p.z, yaw: q.yaw, w: 2.5, l: 9.6 }, true); if (g < 30) target = Math.min(target, Math.max(0, (g - 2.5) * 1.5)); }
          for (const hz of L.hazards) { const dn = ((hz.s0 - b.s + T) % T) - 4.8 - 2; if (dn > -1 && dn < 30) { const sv = xing.state(hz.c, t)[hz.axis]; if (sv === 2 || (sv === 1 && dn > 4)) target = dn < 1.2 ? 0 : Math.min(target, 2 + dn * 0.6); } }
          const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), dx = who.x - b.p.x, dz = who.z - b.p.z, ahead = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
          if (low && ahead > 0 && ahead < 22 && side < 2.8 && !(G.rides && G.rides.line && G.rides.line.bus === b)) target = 0;
        }
        b.v = damp(b.v, target, target < b.v ? 3 : 0.9, dt); b.s = (b.s + b.v * dt) % T;
        const yaw = L.path.sample(b.s, b.p); b.yaw = dampAngle(b.yaw, yaw, 5, dt);
        q.setFromAxisAngle(up, b.yaw); m4.compose(b.p, q, one); body.setMatrixAt(k, m4); win.setMatrixAt(k, m4); stripe.setMatrixAt(k, m4);
        if (p.state === 'walk' && low) { const dx = p.pos.x - b.p.x, dz = p.pos.z - b.p.z, d = Math.hypot(dx, dz) || 0.01; if (d < 3.2) { p.pos.x += (dx / d) * (3.2 - d); p.pos.z += (dz / d) * (3.2 - d); } }
      });
      body.instanceMatrix.needsUpdate = true; win.instanceMatrix.needsUpdate = true; stripe.instanceMatrix.needsUpdate = true;
    },
    // seconds until a bus of this line reaches stop k (rough: distance over cruising speed, plus stops on the way)
    eta(line, k) { let best = Infinity; for (const b of buses) if (b.line === line) { const ds = (line.stops[k].s - b.s + line.path.total) % line.path.total; best = Math.min(best, b.at === k ? 0 : ds / 9.5 + 9); } return best; },
  };
}
