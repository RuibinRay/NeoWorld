// Passers-by in the new parts of the city. Unlike the 260 residents they have no homes, jobs or
// schedules: they walk the pavements round a block, wait for the lights and cross, jog the park
// loop, stroll the boardwalk, sit on benches, loungers and at the bars and cafes, some with a
// child or a dog alongside. They exist only around the player: far ones are moved to a pavement
// nearer by. Drawn as crowd figures, with a pool of detailed rigs (one per look) for the few that
// are close enough to see properly. Events (systems/happenings.js) add their own crowds through put().
import * as THREE from 'three';
import { G } from '../core/game.js';
import { RNG, dampAngle } from '../core/util.js';
import { makeHumanoid, animateRig, varyLook, makeDog, animateDog, SKINS, HAIRS, CLOTHES, ACCENTS } from './rigs.js';
import { NB, blockOf } from '../world/metro/landuse.js';
import { eSeg, sSeg, corner, signalState } from '../world/metro/streets.js';

const N = 64, ADULTS = 18, KIDS = 3, ELDERS = 3, INS = 2.9, E = 50 - INS, WEIGHT = { core: 1, mid: 0.8, resort: 0.9, edge: 0.4, suburb: 0.45, port: 0.25 };
const HELLO = ['Morning.', 'Lovely day for it.', 'Sorry, in a rush.', 'Have you tried the bao on K Street?', 'The M1 is late again.', 'Mind the pods, they do not always stop.', 'Is it going to rain? My lens says no.', 'You look like you know where you are going.', 'Hello!', 'The wheel is worth the eight credits.', 'Nice out by the water today.', 'Evening.', 'She is friendly, you can say hello.', 'We are off to the park.'];
// corner k of a block's walking rectangle: 0 NW, 1 NE, 2 SE, 3 SW
const CX = [-1, 1, 1, -1], CZ = [-1, -1, 1, 1];
// seats at the venues, by id prefix: [opens, closes, share of seats taken]
const VENUES = [['bar', 17, 23.5, 0.8], ['terrace', 16, 23, 0.7], ['glass', 9, 18, 0.6], ['pier', 8, 20.5, 0.4], ['isle', 10, 18, 0.3]];
const DOGS = [['#c9a36b', '#59e0ff'], ['#3a3f4a', '#ffd34d'], ['#e9edf2', '#ff7ad9'], ['#8a5a3a', '#7dff9c']];

export class Ambient {
  constructor() {
    const r = (this.rng = new RNG(7711)), C = (h) => new THREE.Color(h);
    this.looks = [];
    const add = (k, o) => {
      const base = { kind: 'human', skin: SKINS[k % SKINS.length], hair: HAIRS[(k * 3) % HAIRS.length], hairStyle: (k * 5) % 14, top: CLOTHES[(k * 2 + 1) % CLOTHES.length], bottom: ['#2b303a', '#3b4250', '#4a3f35', '#20242c', '#5a4a6a', '#2f4f6f'][k % 6], accent: ACCENTS[k % ACCENTS.length], height: o.child ? 1.18 + (k % 3) * 0.08 : 1.56 + (k % 7) * 0.04, build: 0.9 + (k % 5) * 0.045, coat: !o.child && k % 4 === 0, visor: false, child: !!o.child };
      const look = varyLook(base, 9000 + k * 77, o);
      this.looks.push({ look, rig: null, user: null, col: { top: C(look.top), bottom: C(look.legs === 'skirt' ? look.skin : look.bottom), skin: C(look.skin), arm: C(look.sleeves === 'none' ? look.skin : look.top), hair: C(look.hair) }, scale: look.height / 1.72, build: look.build, child: !!o.child });
    };
    for (let k = 0; k < ADULTS; k++) add(k, {});
    for (let k = 0; k < KIDS; k++) add(40 + k, { child: true });
    for (let k = 0; k < ELDERS; k++) add(60 + k, { elder: true });
    this.adult = (n) => this.looks[n % ADULTS < ADULTS - ELDERS ? n % ADULTS : ADULTS + KIDS + (n % ELDERS)];
    this.kid = (n) => this.looks[ADULTS + (n % KIDS)];
    this.w = [];
    for (let k = 0; k < N; k++) {
      const w = { on: false, pos: new THREE.Vector3(), yaw: 0, phase: r.range(0, 6), look: this.adult(k), speed: r.range(1.15, 1.6), i: 0, j: 0, k: 0, dir: 1, tx: 0, tz: 0, wait: 0, cross: false, stop: 0, rig: false };
      if (w.look.look.style && w.look.look.style.posture) w.speed *= 0.75;                         // elders take their time
      if (k % 7 === 3) { w.kid = { pos: new THREE.Vector3(), yaw: 0, phase: 0, look: this.kid(k), rig: false }; w.speed = Math.min(w.speed, 1.2); }   // a child alongside
      if (k % 9 === 5) w.dog = { pos: new THREE.Vector3(), yaw: 0, col: DOGS[k % DOGS.length], rig: null };                                         // a dog on a lead
      this.w.push(w);
    }
    // fixed routes: joggers on the park loop, strollers on the boardwalk and the pier
    const loop = [[485, 485], [955, 485], [955, 955], [485, 955]], walk = [[330, 1154.5], [1290, 1154.5]], pier = [[810, 1172], [810, 1376]];
    this.route = [];
    for (let k = 0; k < 12; k++) this.route.push({ pts: loop, closed: true, s: k / 12, dir: k % 3 ? 1 : -1, speed: k % 2 ? 3.1 : 1.3, y: 0, look: this.adult(k * 5), phase: k, pos: new THREE.Vector3(), yaw: 0 });
    for (let k = 0; k < 12; k++) this.route.push({ pts: walk, closed: false, s: (k + 0.5) / 12, dir: k % 2 ? 1 : -1, speed: 1.1 + (k % 3) * 0.15, y: 0.2, look: this.adult(k * 7 + 2), phase: k * 2, pos: new THREE.Vector3(), yaw: 0, kid: k % 4 === 1 ? { pos: new THREE.Vector3(), yaw: 0, phase: 0, look: this.kid(k), rig: false } : null });
    for (let k = 0; k < 5; k++) this.route.push({ pts: pier, closed: false, s: (k + 0.5) / 5, dir: k % 2 ? 1 : -1, speed: 1.1, y: 3.2, look: this.adult(k * 4 + 1), phase: k * 3, pos: new THREE.Vector3(), yaw: 0 });
    this.sit = []; this.sitT = 0; this.near = null; this.v = new THREE.Vector3(); this.dogRigs = []; this.tick = 0; this.ents = new Map();
    G.interact.add({ pos: this.v, r: 2.3, prio: -0.4, label: () => (this.near && this.near.dog ? 'Say hello (and pat the dog)' : 'Say hello'), enabled: () => !!this.near && this.near.rig, use: () => { const w = this.near; w.stop = 4; G.ui.say({ pos: w.pos, h: 1.95 }, w.dog ? this.rng.pick(['She is friendly, you can say hello.', 'He has had his walk, he is only pretending.', 'Good dog. Mostly.']) : this.rng.pick(HELLO), 3); if (w.dog) G.player.play('pet', 1.6); } });
  }
  slab(i, j) { const b = G.metro.block(i, j); return b && b.y0 > 0 && !b.cut ? b : null; }
  // the shop doors on a block's street sides (where world/metro/buildings.js draws them): the door, and a
  // point on the pavement in front of it
  doors(b) {
    if (b._doors) return b._doors;
    const out = (b._doors = []);
    for (const bl of b.bld) {
      if (!bl.boxes || ['house', 'shed', 'hub', 'site', 'villa', 'school'].includes(bl.kind)) continue;
      const [x0, x1, z0, z1] = bl.boxes[0], w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      for (const [nx, nz, edge, rim] of [[0, -1, z0, b.cz - 44], [0, 1, z1, b.cz + 44], [-1, 0, x0, b.cx - 44], [1, 0, x1, b.cx + 44]]) {
        if (Math.abs(edge - rim) > 7) continue;
        const len = nx ? d : w, n = Math.max(2, Math.round(len / 9)), pw = (len - 3) / n, t = -len / 2 + 1.5 + pw * ((n >> 1) + 0.5);
        const x = nx ? edge : cx + t, z = nz ? edge : cz + t;
        out.push({ x, z, nx, nz, ax: nx ? b.cx + nx * E : x, az: nz ? b.cz + nz * E : z });   // the approach point is on the line people walk
      }
    }
    return out;
  }
  place(w, focus) {
    const r = this.rng;
    for (let t = 0; t < 10; t++) {
      const a = r.range(0, 6.283), d = r.range(55, 215), i = blockOf(focus.x + Math.cos(a) * d), j = blockOf(focus.z + Math.sin(a) * d), b = this.slab(i, j);
      if (!b || Math.abs(i) > NB || !r.chance(WEIGHT[b.use] || 0)) continue;
      w.i = i; w.j = j; w.dir = r.chance(0.5) ? 1 : -1; w.k = r.int(0, 3); const k0 = (w.k + (w.dir > 0 ? 3 : 1)) % 4, f = r.next();
      const ax = b.cx + CX[k0] * E, az = b.cz + CZ[k0] * E; w.tx = b.cx + CX[w.k] * E; w.tz = b.cz + CZ[w.k] * E;
      w.pos.set(ax + (w.tx - ax) * f, 0.15, az + (w.tz - az) * f); w.yaw = Math.atan2(w.tx - w.pos.x, w.tz - w.pos.z); w.on = true; w.cross = false; w.wait = 0; w.door = null;
      // some come out of a shop door instead
      const ds = this.doors(b); if (ds.length && r.chance(0.3)) { const dr = r.pick(ds); w.pos.set(dr.x - dr.nx * 0.3, b.y0, dr.z - dr.nz * 0.3); w.yaw = Math.atan2(dr.nx, dr.nz); w.door = { stage: 2, x: dr.ax, z: dr.az }; }
      return;
    }
    w.on = false;
  }
  // at a corner: carry on round the block, or cross to the block over the road when the lights allow
  next(w, t) {
    const { i, j, k } = w, jx = k === 1 || k === 2 ? i : i - 1, jz = k >= 2 ? j : j - 1, c = corner(jx, jz), r = this.rng;
    if (r.chance(0.55)) {
      const ew = r.chance(0.5), ni = ew ? i + CX[k] : i, nj = ew ? j : j + CZ[k], nb = this.slab(ni, nj);
      const seg = ew ? eSeg(k === 1 || k === 2 ? i : i - 1, j) : sSeg(i, k >= 2 ? j : j - 1);
      if (nb && seg === 'street') {
        const st = c.signal ? signalState(jx, jz, t) : null;
        if (st && ((ew ? st.ns : st.ew) !== 2 || (st.hw !== undefined && st.hw !== 2))) { w.wait = 0.6; return; }             // wait for the traffic (and any highway through the junction) to be held at red
        const nk = ew ? [1, 0, 3, 2][k] : [3, 2, 1, 0][k];
        w.i = ni; w.j = nj; w.k = nk; w.tx = nb.cx + CX[nk] * E; w.tz = nb.cz + CZ[nk] * E; w.cross = true; return;
      }
    }
    w.k = (k + w.dir + 4) % 4; const b = this.slab(i, j); w.tx = b.cx + CX[w.k] * E; w.tz = b.cz + CZ[w.k] * E; w.cross = false;
  }
  // a companion (child or dog) walks beside its adult, on the inside of the pavement
  besides(w, c, side, back) { const s = Math.sin(w.yaw), co = Math.cos(w.yaw); c.pos.set(w.pos.x + co * side - s * back, w.pos.y, w.pos.z - s * side - co * back); c.yaw = w.yaw; }
  // called by the resident system between crowd.begin() and crowd.end()
  draw(crowd, dt, t) {
    const pl = G.player, focus = pl.state === 'drive' ? G.car.pos : pl.pos, hour = G.env.hour, awake = hour > 6 && hour < 23 ? 1 : 0.3, yAt = G.metro.yAt, rain = G.env.rain > 0.5;
    this.crowd = crowd; this.dt = dt;
    let best = null, bd = 9;
    const dogsNear = [];
    this.w.forEach((w, n) => {
      const d2 = (w.pos.x - focus.x) ** 2 + (w.pos.z - focus.z) ** 2;
      if (!w.on || d2 > 250 * 250) { if (n < N * awake * (rain ? 0.6 : 1)) this.place(w, focus); else w.on = false; if (!w.on) return; }
      let anim = 'idle', sp = 0;
      if (w.stop > 0) { w.stop -= dt; w.yaw = dampAngle(w.yaw, Math.atan2(pl.pos.x - w.pos.x, pl.pos.z - w.pos.z), 6, dt); }
      else if (w.wait > 0) w.wait -= dt;
      else {
        // now and then, step into a shop door along the way (and that is the last we see of them)
        if (!w.door && !w.cross && !w.kid && !w.dog && this.rng.next() < dt * 0.025) {
          const b = this.slab(w.i, w.j), lx = w.tx - w.pos.x, lz = w.tz - w.pos.z, ll = Math.hypot(lx, lz) || 1;
          if (b) for (const dr of this.doors(b)) { const px = dr.ax - w.pos.x, pz = dr.az - w.pos.z, along = (px * lx + pz * lz) / ll, off = Math.abs(px * lz - pz * lx) / ll; if (along > 2 && along < Math.min(ll, 30) && off < 2.5) { w.door = { stage: 0, x: dr.ax, z: dr.az, ix: dr.x - dr.nx * 0.4, iz: dr.z - dr.nz * 0.4 }; break; } }
        }
        const gx = w.door ? (w.door.stage === 1 ? w.door.ix : w.door.x) : w.tx, gz = w.door ? (w.door.stage === 1 ? w.door.iz : w.door.z) : w.tz;
        const dx = gx - w.pos.x, dz = gz - w.pos.z, d = Math.hypot(dx, dz); sp = w.cross ? 1.9 : w.door && w.door.stage === 1 ? w.speed * 0.8 : w.speed;
        if (d < 0.4) { if (!w.door) this.next(w, t); else if (w.door.stage === 0) w.door.stage = 1; else if (w.door.stage === 1) { w.on = false; w.door = null; this.entered = (this.entered || 0) + 1; return; } else w.door = null; }
        else { w.pos.x += (dx / d) * sp * dt; w.pos.z += (dz / d) * sp * dt; w.yaw = dampAngle(w.yaw, Math.atan2(dx, dz), 8, dt); w.phase += sp * dt * 4.2; anim = 'walk'; }
        w.pos.y = yAt(w.pos.x, w.pos.z);
      }
      this.figure(w, anim, d2, sp);
      if (w.kid) { this.besides(w, w.kid, -0.75, 0.15); w.kid.phase = w.phase * 1.3; this.figure(w.kid, anim, d2, sp); }
      if (w.dog && d2 < 35 * 35) dogsNear.push([d2, w, anim]);
      if (w.rig && d2 < bd && pl.state === 'walk') { bd = d2; best = w; }
    });
    // dogs: four rigs, given to the nearest dog walkers
    dogsNear.sort((a, b) => a[0] - b[0]);
    for (let k = 0; k < 4; k++) {
      let d = this.dogRigs[k]; const e = dogsNear[k];
      if (!e) { if (d) d.rig.root.visible = false; continue; }
      const w = e[1];
      if (!d) { const rig = makeDog({ robot: k === 1, color: DOGS[k][0], accent: DOGS[k][1], scale: 0.8 + k * 0.08 }); G.scene.add(rig.root); d = this.dogRigs[k] = { rig }; }
      this.besides(w, w.dog, 0.85, -0.4); d.rig.root.visible = true; d.rig.root.position.copy(w.dog.pos); d.rig.root.rotation.y = w.yaw;
      animateDog(d.rig, dt, e[2] === 'walk' ? 'walk' : 'sit', e[2] === 'walk' ? w.speed : 0);
    }
    for (const q of this.route) {
      const a = q.pts, n = a.length, segs = q.closed ? n : n - 1; let len = 0; const L = []; for (let k = 0; k < segs; k++) { const b = a[(k + 1) % n]; L.push(Math.hypot(b[0] - a[k][0], b[1] - a[k][1])); len += L[k]; }
      q.s += (q.dir * q.speed * dt) / len; if (q.closed) q.s = (q.s + 1) % 1; else if (q.s > 1) { q.s = 1; q.dir = -1; } else if (q.s < 0) { q.s = 0; q.dir = 1; }
      let u = q.s * len, k = 0; while (k < segs - 1 && u > L[k]) u -= L[k++];
      const p0 = a[k], p1 = a[(k + 1) % n], f = Math.min(1, u / L[k]); q.pos.set(p0[0] + (p1[0] - p0[0]) * f, q.y, p0[1] + (p1[1] - p0[1]) * f); q.yaw = Math.atan2((p1[0] - p0[0]) * q.dir, (p1[1] - p0[1]) * q.dir); q.phase += q.speed * dt * (q.speed > 2 ? 3.2 : 4.2);
      const d2 = (q.pos.x - focus.x) ** 2 + (q.pos.z - focus.z) ** 2; if (d2 > 280 * 280 || awake < 1 || (rain && q.y === 0.2)) continue;
      crowd.add(q.pos, q.yaw, q.look.scale, q.look.col, q.speed > 2 ? 'jog' : 'walk', q.phase, q.look.build);
      if (q.kid) { this.besides(q, q.kid, -0.75, 0.15); crowd.add(q.kid.pos, q.yaw, q.kid.look.scale, q.kid.look.col, 'walk', q.phase * 1.3, q.kid.look.build); }
    }
    // people sitting: every third bench and lounger near you, and the seats at the bars and cafes in their hours
    this.sitT -= dt;
    if (this.sitT <= 0) {
      this.sitT = 1.2; const old = new Map(this.sit.map((s) => [s.key, s])); this.sit.length = 0; const i0 = blockOf(focus.x), j0 = blockOf(focus.z);
      const keep = (s) => { const o = old.get(s.key); if (o) { o.pos.copy(s.pos); o.yaw = s.yaw; this.sit.push(o); } else this.sit.push(s); };
      if (awake === 1 && !rain) for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = i0 - 1; i <= i0 + 1; i++) { const b = G.metro.block(i, j); if (b) b.props.forEach((q, n) => { if ((q[0] === 'bench' || q[0] === 'lounger') && (n * 7 + i * 3 + j) % 3 === 0 && this.sit.length < 40) keep({ key: i * 1000 + j * 100000 + n, pos: new THREE.Vector3(q[1], b.y0 + (q[5] || 0) + (q[0] === 'lounger' ? -0.18 : -0.08), q[2]), yaw: q[3], look: this.looks[(n + i * 5 + j * 3 + 600) % ADULTS], phase: n }); }); }
      for (const s of G.city.seats) {
        const v = VENUES.find(([p]) => s.id.startsWith(p)); if (!v || hour < v[1] || hour > v[2] || (s.x - focus.x) ** 2 + (s.z - focus.z) ** 2 > 160 * 160) continue;
        let h = 0; for (let k = 0; k < s.id.length; k++) h = (h * 31 + s.id.charCodeAt(k)) >>> 0;
        if ((h % 100) / 100 < v[3] && !s.taken) keep({ key: s.id, pos: new THREE.Vector3(s.x, s.y - 0.5, s.z), yaw: s.yaw, look: this.looks[h % ADULTS], phase: h % 7, seat: s });
      }
    }
    const seat = pl.state === 'sit' && pl.seat;
    for (const s of this.sit) if (!(seat && Math.abs(seat.x - s.pos.x) < 0.5 && Math.abs(seat.z - s.pos.z) < 0.5)) this.figure(s, 'sit', (s.pos.x - focus.x) ** 2 + (s.pos.z - focus.z) ** 2, 0);
    // event crowds (concerts, the market, the fireworks)
    if (G.happen) G.happen.figures(this, focus);
    for (const f of G.figureHooks) f(this, focus);
    this.near = best; if (best) this.v.copy(best.pos);
    // rigs that nobody close is using any more are put away
    for (const l of this.looks) { if (l.rig && (!l.user || l.user.rigT < this.tick)) { l.rig.root.visible = false; l.user = null; } }
    this.tick++;
  }
  // draw one figure: a detailed rig within 16 m (if its look's rig is free), otherwise a crowd figure
  figure(e, anim, d2, speed = 0) {
    const l = e.look;
    if (d2 < 16 * 16 && (!l.user || l.user === e || l.user.rigT < this.tick - 1)) {
      if (!l.rig) { l.rig = makeHumanoid(l.look); G.scene.add(l.rig.root); }
      l.user = e; e.rig = true; e.rigT = this.tick; l.rig.root.visible = true; l.rig.root.position.copy(e.pos); l.rig.root.rotation.y = e.yaw;
      animateRig(l.rig, this.dt, anim, speed);
      if (G.softShadows) this.crowd.shade(e.pos, l.scale);
      return;
    }
    e.rig = false;
    this.crowd.add(e.pos, e.yaw, l.scale, l.col, anim, e.phase || 0, l.build);
  }
  // for event crowds: one figure, known by a key so a close one can keep its detailed rig from frame to frame
  put(key, x, y, z, yaw, n, anim, phase, focus) {
    let e = this.ents.get(key); if (!e) this.ents.set(key, (e = { pos: new THREE.Vector3(), rig: false, rigT: -9 }));
    e.pos.set(x, y, z); e.yaw = yaw; e.look = this.looks[n % ADULTS]; e.phase = phase;
    this.figure(e, anim, (x - focus.x) ** 2 + (z - focus.z) ** 2, 0);
  }
}
