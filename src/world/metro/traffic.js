// Traffic on the avenues: a pool of cars, taxis, vans and trucks that lives around the player.
// They keep to the right, stop for red lights (at junctions and where a highway crosses), queue
// behind each other, brake (and honk) for anyone in the road, turn at junctions, and are moved
// to a street nearer the player when they fall too far behind.
import { G } from '../../core/game.js';
import { RNG, damp, dampAngle } from '../../core/util.js';
import { Fleet, PAINTS, TAXI, BOXES } from '../../entities/fleet.js';
import { P, NB, blockOf } from './landuse.js';
import { eSeg, sSeg, corner, signalState } from './streets.js';

const LANE = 4.2, N = 72, TYPES = ['car', 'car', 'taxi', 'car', 'van', 'car', 'car', 'van', 'taxi', 'car', 'truck', 'car', 'van'];
// how far two vehicles' footprints (rotated rectangles) overlap; 0 if they do not touch
export function overlap(a, b) {
  const af = [Math.sin(a.yaw), Math.cos(a.yaw)], bf = [Math.sin(b.yaw), Math.cos(b.yaw)], dx = b.x - a.x, dz = b.z - a.z;
  let min = 1e9;
  for (const [ux, uz] of [af, [af[1], -af[0]], bf, [bf[1], -bf[0]]]) {
    const ra = Math.abs(ux * af[0] + uz * af[1]) * a.l / 2 + Math.abs(ux * af[1] - uz * af[0]) * a.w / 2;
    const rb = Math.abs(ux * bf[0] + uz * bf[1]) * b.l / 2 + Math.abs(ux * bf[1] - uz * bf[0]) * b.w / 2;
    const pen = ra + rb - Math.abs(dx * ux + dz * uz); if (pen <= 0) return 0; if (pen < min) min = pen;
  }
  return min;
}

export class AvenueTraffic {
  constructor() {
    this.rng = new RNG(4242); this.pods = [];
    for (let k = 0; k < N; k++) {
      const type = TYPES[k % TYPES.length], slot = G.fleet.slot(type, type === 'taxi' ? TAXI : type === 'truck' ? BOXES[k % BOXES.length] : PAINTS[(k * 3) % PAINTS.length]);
      this.pods.push({ on: false, slot, l: slot.l, w: slot.w, axis: 'z', line: 0, s: 0, dir: 1, v: 0, vmax: this.rng.range(10, 15) * (type === 'truck' ? 0.8 : 1), x: 0, z: 0, yaw: 0, turn: null, wait: 0, honk: 0 });
    }
  }
  // put a pod on a random street segment 70 to 420 m from the focus. Closer than 200 m only where the
  // camera is not looking (more than about 70 degrees off its view), so the streets round you are busy
  // but no vehicle ever pops into sight
  place(o, focus) {
    const r = this.rng, e = G.camera.matrixWorld.elements, fx = -e[8], fz = -e[10], fl = Math.hypot(fx, fz) || 1;
    for (let tries = 0; tries < 20; tries++) {
      const u = r.next(), a = r.range(0, Math.PI * 2), d = 70 + 350 * u * u;   // weighted toward the near streets
      const i = blockOf(focus.x + Math.cos(a) * d), j = blockOf(focus.z + Math.sin(a) * d);
      if (Math.abs(i) > NB || j < -NB || j > 9) continue;
      if (r.chance(0.5) && eSeg(i, j) === 'street') { o.axis = 'z'; o.line = i * P + 60; o.s = j * P + r.range(-40, 40); }
      else if (sSeg(i, j) === 'street') { o.axis = 'x'; o.line = j * P + 60; o.s = i * P + r.range(-40, 40); }
      else continue;
      o.dir = r.chance(0.5) ? 1 : -1;
      // not on top of another vehicle in the same lane, and not where a highway crosses
      if (this.pods.some((q) => q !== o && q.on && q.axis === o.axis && q.line === o.line && q.dir === o.dir && Math.abs(q.s - o.s) < 14)) continue;
      const hz = G.metro.xing.lines.get(o.axis + ':' + o.line);
      if (hz && hz.some((h) => { const ws = [h.e[1], h.e[-1]].filter((w) => w !== undefined); return o.s > Math.min(...ws) - 12 && o.s < Math.max(...ws) + 12; })) continue;
      this.locate(o);
      const dx = o.tx - focus.x, dz = o.tz - focus.z, dd = Math.hypot(dx, dz);
      if (dd < 60 || (dd < 200 && (dx * fx + dz * fz) / (dd * fl) > 0.34)) continue;   // too close, or close and in view
      o.v = o.vmax * 0.7; o.turn = null; o.on = true; o.x = o.tx; o.z = o.tz; o.yaw = o.tyaw; return;
    }
    o.on = false;
  }
  // where the pod should be: in the right-hand lane of its street
  locate(o) {
    if (o.axis === 'z') { o.tx = o.line - o.dir * LANE; o.tz = o.s; o.tyaw = o.dir > 0 ? 0 : Math.PI; }
    else { o.tx = o.s; o.tz = o.line + o.dir * LANE; o.tyaw = o.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
  }
  update(dt, t, focus) {
    const p = G.player, who = p.state === 'drive' ? G.car.pos : p.pos, low = who.y < 5, pods = this.pods, X = G.metro.xing;
    for (let k = 0; k < N; k++) {
      const o = pods[k];
      if (!o.on || (o.x - focus.x) ** 2 + (o.z - focus.z) ** 2 > 560 * 560) { this.place(o, focus); if (!o.on) { G.fleet.hide(o.slot); continue; } }
      // the junction ahead
      const nc = o.dir > 0 ? Math.ceil((o.s - 60) / P) : Math.floor((o.s - 60) / P), zc = nc * P + 60, dist = (zc - o.s) * o.dir;      // metres to its centre
      const li = Math.round((o.line - 60) / P), ci = o.axis === 'z' ? li : nc, cj = o.axis === 'z' ? nc : li, c = corner(ci, cj);
      let target = o.vmax;
      if (dist < 46 && dist > 0) {
        // way out: straight on if the street continues, else a turn, else back the way it came
        if (!o.turn || o.turn.c !== c) {
          const ahead = o.axis === 'z' ? (o.dir > 0 ? c.s : c.n) : (o.dir > 0 ? c.e : c.w), opts = [];
          if (ahead) opts.push('s', 's', 's');
          if (!c.water) { if (o.axis === 'z') { if (c.e) opts.push('e'); if (c.w) opts.push('w'); } else { if (c.s) opts.push('S'); if (c.n) opts.push('N'); } }
          o.turn = { c, go: opts.length ? this.rng.pick(opts) : 'u' };
        }
        const stop = dist - 15.5 - (o.l - 4.3) / 2;                                              // metres from its front to the stop line
        if (c.signal && stop > -1 && stop < 30) { const sv = signalState(ci, cj, t)[o.axis === 'z' ? 'ns' : 'ew']; if (sv === 2 || (sv === 1 && stop > 4)) target = stop < 1.2 ? 0 : Math.min(target, 2 + stop * 0.7); }
        if (o.turn.go !== 's') target = Math.min(target, 4 + dist * 0.25);
        else if (!c.signal) target = Math.min(target, 9);
        // before entering the junction box: wait while a car from the cross street is still in it, and at a junction
        // without signals, cars on north-south streets give way to cars coming along the east-west street
        const front = dist - o.l / 2 - 10.5;
        if (front > -0.5 && front < 14) {
          let wait = false;
          for (const q of pods) {
            if (q === o || !q.on || q.axis === o.axis) continue;
            if (Math.abs(q.x - c.x) < 10.8 && Math.abs(q.z - c.z) < 10.8) { wait = true; break; }
            if (!c.signal && o.axis === 'z' && q.line === c.z && Math.abs(q.x - c.x) < 26 && (c.x - q.x) * q.dir > -10.5) { wait = true; break; }
          }
          if (wait) target = Math.min(target, Math.max(0, front - 0.8) * 1.5);
        }
      }
      // where a highway crosses this street
      target = Math.min(target, X.lineLimit(o.axis, o.line, o.s, o.dir, o.l, t));
      // anyone in the way: the player, or the vehicle in front
      const fx = o.axis === 'z' ? 0 : o.dir, fz = o.axis === 'z' ? o.dir : 0, dx = who.x - o.x, dz = who.z - o.z, ahead = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
      const blocked = low && ahead > -1.5 && ahead < o.l / 2 + 12 && side < o.w / 2 + 1.6;
      if (blocked) { target = 0; o.wait += dt; if (o.wait > 1.6 && o.honk <= 0 && G.audio && G.audio.blip) { G.audio.blip(o.l > 6 ? 220 : 360, 0.14); o.honk = 3.5; } } else o.wait = 0;
      o.honk -= dt;
      // the vehicle in front (by where it really is, so one that has just turned in still counts)
      for (let m = 0; m < N; m++) { const q = pods[m]; if (q === o || !q.on || Math.abs(q.x - o.x) > 30 || Math.abs(q.z - o.z) > 30) continue; const g = Fleet.gap(o.x, o.z, o.yaw, o.w, o.l, q, true); if (g < 25) target = Math.min(target, Math.max(0, (g - 2.2) * 2)); }
      // race cars and the like (they do not stop for us, so we stop for them)
      for (const q of G.metro.extraCars) if (Math.abs(q.x - o.x) < 40 && Math.abs(q.z - o.z) < 40) { const g = Fleet.gap(o.x, o.z, o.yaw, o.w, o.l, q, false); if (g < 30) target = Math.min(target, Math.max(0, (g - 2.5) * 2)); }
      for (const b of G.metro.bus.buses) if (Math.abs(b.p.x - o.x) < 40 && Math.abs(b.p.z - o.z) < 40) { const g = Fleet.gap(o.x, o.z, o.yaw, o.w, o.l, { x: b.p.x, z: b.p.z, yaw: b.yaw, w: 2.5, l: 9.6 }, false); if (g < 30) target = Math.min(target, Math.max(0, (g - 2.2) * 2)); }
      o.v = damp(o.v, target, target < o.v ? 4 : 1.1, dt);
      o.s += o.v * o.dir * dt;
      // at the centre of the junction: carry out the turn
      if (o.turn && (zc - o.s) * o.dir <= 0.5 && o.turn.c === c) {
        let g = o.turn.go;
        // the lane it is turning into must have room; if not, carry straight on when it can, or wait
        if (g !== 's' && g !== 'u') {
          const ax = g === 'e' || g === 'w' ? 'x' : 'z', line = ax === 'x' ? zc : c.x, d = g === 'e' || g === 'S' ? 1 : -1, at = (ax === 'x' ? c.x : c.z) + d * 6;
          if (pods.some((q) => q !== o && q.on && q.axis === ax && q.line === line && q.dir === d && Math.abs(q.s - at) < (q.l + o.l) / 2 + 2)) {
            const straight = o.axis === 'z' ? (o.dir > 0 ? c.s : c.n) : (o.dir > 0 ? c.e : c.w);
            if (straight) g = 's'; else { o.s = zc - o.dir * 0.5; o.v = 0; g = null; }
          }
        }
        if (g !== null) o.turn = null;
        if (g === 'u') { o.dir = -o.dir; o.s = zc - o.dir * -2; }
        else if (g === 'e' || g === 'w') { o.axis = 'x'; o.line = zc; o.s = c.x + (g === 'e' ? 6 : -6); o.dir = g === 'e' ? 1 : -1; }
        else if (g === 'S' || g === 'N') { o.axis = 'z'; o.line = c.x; o.s = c.z + (g === 'S' ? 6 : -6); o.dir = g === 'S' ? 1 : -1; }
      }
      this.locate(o);
      o.x = damp(o.x, o.tx, 7, dt); o.z = damp(o.z, o.tz, 7, dt); o.yaw = dampAngle(o.yaw, o.tyaw, 6, dt);
      G.fleet.place(o.slot, o.x, 0, o.z, o.yaw);
      if (p.state === 'walk' && low && Math.abs(dx) < 5 && Math.abs(dz) < 5) Fleet.pushOut(p.pos, o.x, o.z, o.yaw, o.w, o.l);
      if (p.state === 'drive' && Math.abs(dx) < 9 && Math.abs(dz) < 9 && Fleet.knock(o) > 4) { o.v = 0; o.wait = 2; }
    }
    // a last check: two vehicles must never end up inside each other (it could happen on a turn at a junction).
    // The one whose nose is into the other stops and drops back along its lane.
    for (let pass = 0; pass < 2; pass++) for (let a = 0; a < N; a++) {
      const o = pods[a]; if (!o.on) continue;
      for (let b = a + 1; b < N; b++) {
        const q = pods[b]; if (!q.on || Math.abs(q.x - o.x) > 9 || Math.abs(q.z - o.z) > 9) continue;
        const pen = overlap(o, q); if (pen <= 0.05) continue;
        const dx = q.x - o.x, dz = q.z - o.z, fo = Math.sin(o.yaw) * dx + Math.cos(o.yaw) * dz, fq = -(Math.sin(q.yaw) * dx + Math.cos(q.yaw) * dz), y = fo >= fq ? o : q, back = Math.min(pen + 0.1, 0.8);
        y.v = 0; y.wait = Math.max(y.wait, 0.6); y.s -= y.dir * back;
        if (y.axis === 'z') y.z -= y.dir * back; else y.x -= y.dir * back;
        G.fleet.place(y.slot, y.x, 0, y.z, y.yaw); this.overlaps = (this.overlaps || 0) + 1;
      }
    }
  }
}
