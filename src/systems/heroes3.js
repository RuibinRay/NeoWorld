// Hero Mode, the third wave: Tempo, Zenith, Ginro, Orbit, Lapse and Prism (data/heroes.js).
// Their powers, gear and ways of moving live here and are added to the Heroes class
// (systems/heroes.js), which calls the hooks: dress3, endPowers3, moves3, passives3, visuals3, form3,
// and the movement steps rushStep, circleStep and slideStep.
//   Tempo   Shift + W is a rush on foot to 46 m/s: up walls, over water, through villains
//   Zenith  flies (the same flight as Forge, without the thrusters) and carries villains into the sky
//   Ginro   a wolf of lightning, a wall of stone, a decoy, a dragon of water
//   Orbit   gravity: floats, lifts, crushes, hurls rocks, opens a black hole
//   Lapse   time: rewind, stasis, haste, and a stop for every villain (Villains.update reads timeK)
//   Prism   rides a rail of hard light through the air; beams, a cage, a mirror
import * as THREE from 'three';
import { G } from '../core/game.js';
import { clamp, damp, dampAngle, angDelta, lerp } from '../core/util.js';
import { std, neon } from '../world/materials.js';
import { makeDog, animateDog, makeHumanoid, animateRig } from '../entities/rigs.js';
import { DEFAULT_LOOK } from '../entities/player.js';

const V = () => new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), _c = new THREE.Color();
const TEMPO = '#d4ff3a', SUN = '#ffc93a', SILVER = '#cfe0ff', GRAV = '#7d8bff', TIME = '#4be38f';
const rnd = (k = 1) => (Math.random() - 0.5) * k;
const rainbow = (x) => '#' + _c.setHSL(((x % 1) + 1) % 1, 1, 0.62).getHexString();
const glowMat = (hex, op = 0.6) => new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const clothMat = (hex) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.8, metalness: 0.02, side: THREE.DoubleSide });

export const WAVE3 = {
  // ---- effects that run for a while: fn(k 0..1, dt, run) every frame, end() when the time is up, kill()
  // whenever it stops (also when the hero changes or is knocked out), for anything it put in the scene
  run(secs, fn, end, kill) { const r = { t: 0, T: secs, fn, end, kill }; this.runs.push(r); return r; },
  stepRuns(dt) {
    for (let i = this.runs.length - 1; i >= 0; i--) {
      const r = this.runs[i]; if (!r) continue;
      r.t += dt; r.fn(Math.min(1, r.t / r.T), dt, r);
      if (r.t >= r.T) { const j = this.runs.indexOf(r); if (j < 0) continue; this.runs.splice(j, 1); if (r.end) r.end(); if (r.kill) r.kill(); }
    }
  },
  stopRuns() { for (const r of this.runs.splice(0)) if (r.kill) r.kill(); this.timeK = 1; },
  endPowers3() { this.stopRuns(); this.haste = 0; this.repel = 0; this.phaseT = 0; this.hist = []; },
  // a glow in the hand that grows for `secs`, crackling, then fn()
  charge3(secs, hex, r0, fn) {
    const orb = G.fx.orb(hex, r0);
    this.run(secs, (k) => { orb.p.copy(this.hand()); orb.r0 = orb.r1 = r0 * (1 + k); if (Math.random() < 0.6) G.fx.bolt(orb.p, orb.p.clone().add(V().set(rnd(), rnd(), rnd())), hex, 0.025, 0.08, 0.4, 2); }, fn, () => { orb.life = 0; });
  },
  eyes3() { const h = G.player.rig.head; G.player.rig.root.updateMatrixWorld(true); return [h.localToWorld(V().set(0.043, 0.018, 0.13)), h.localToWorld(V().set(-0.043, 0.018, 0.13))]; },

  // ---- gear -------------------------------------------------------------------------------------------
  dress3(r, add, B, S) {
    const id = this.id, g = (this.g3 = {});
    if (id === 'tempo') {
      add(r.head, B(0.2, 0.036, 0.03), neon(TEMPO, 1.8), 0, 0.02, 0.114);                                                  // a visor across the eyes
      for (const k of [0, 1]) for (const s of [-1, 1]) add(r.chest, B(0.014, 0.085, 0.01), neon(TEMPO, 1.6), -0.04 + k * 0.075, 0.42 + s * 0.028, 0.14, 0, 0, s * 0.8);   // two chevrons on the chest: fast forward
      for (const [kn, s] of [[r.kneeL, 1], [r.kneeR, -1]]) { add(kn, B(0.012, 0.3, 0.012), neon(TEMPO, 1.4), s * 0.058, -0.24, 0); add(kn, B(0.09, 0.012, 0.24), neon(TEMPO, 1.3), 0, -0.486, 0.046); }   // a stripe down each shin, glowing soles
      for (const [e, s] of [[r.elbL, 1], [r.elbR, -1]]) add(e, B(0.01, 0.2, 0.01), neon(TEMPO, 1.4), s * 0.045, -0.16, 0);
    } else if (id === 'zenith') {
      // the cape: narrow at the shoulders and wrapped a little round them, wider at the hem, with folds down its length
      const gold = std('#e0b23a', 0.35, 0.85), cg = new THREE.PlaneGeometry(0.6, 1.14, 8, 6); cg.translate(0, -0.57, 0);
      { const P = cg.attributes.position; for (let i = 0; i < P.count; i++) { const u = P.getX(i) / 0.3, v = -P.getY(i) / 1.14; P.setX(i, P.getX(i) * lerp(0.8, 1.14, v)); P.setZ(i, u * u * lerp(0.075, 0.01, v) + Math.sin(u * 7) * 0.022 * v); } cg.computeVertexNormals(); }
      const cape = (g.cape = new THREE.Mesh(cg, clothMat(this.costume === 1 ? '#b8322a' : '#e3a92c'))); cape.position.set(0, 0.6, -0.155); cape.castShadow = true; r.chest.add(cape); this.gear.push(cape);
      for (const sx of [-1, 1]) add(r.chest, S(0.036), gold, sx * 0.21, 0.585, -0.08);                                      // the clasps that hold it
      add(r.chest, new THREE.TorusGeometry(0.078, 0.012, 6, 28), neon('#ffd34d', 1.7), 0, 0.42, 0.152);                     // a sun on the chest: a ring, a disc, eight rays
      add(r.chest, new THREE.CylinderGeometry(0.042, 0.042, 0.012, 18), neon('#fff1b8', 2.1), 0, 0.42, 0.152, Math.PI / 2);
      for (let k = 0; k < 8; k++) { const a = (k / 8) * 6.283; add(r.chest, B(0.01, 0.034, 0.008), neon('#ffd34d', 1.5), Math.sin(a) * 0.112, 0.42 + Math.cos(a) * 0.112, 0.146, 0, 0, -a); }
      add(r.hips, new THREE.TorusGeometry(0.228, 0.022, 6, 24), gold, 0, 0.05, 0, Math.PI / 2, 0, 0, 1, 0.74, 1);            // belt
      for (const e of [r.elbL, r.elbR]) add(e, new THREE.CylinderGeometry(0.053, 0.048, 0.13, 10), gold, 0, -0.2, 0);        // bracers
    } else if (id === 'ginro') {
      add(r.head, S(0.118), std('#1b2230', 0.85, 0), 0, -0.052, 0.012, 0, 0, 0, 1.0, 0.64, 1.22);                            // a cloth mask over nose, mouth and jaw
      add(r.elbR, B(0.022, 0.36, 0.01), std('#d8dde8', 0.2, 0.9), 0, -0.56, 0.035); add(r.elbR, B(0.03, 0.1, 0.03), std('#20232c', 0.6, 0.2), 0, -0.38, 0.035);   // a short blade
      for (const e of [r.elbL, r.elbR]) add(e, new THREE.CylinderGeometry(0.047, 0.043, 0.16, 8), std('#8f9bb0', 0.4, 0.7), 0, -0.19, 0);   // arm guards
      const col = this.costume === 1 ? '#2f5d8a' : this.costume === 2 ? '#ffd34d' : '#7a1f2c';
      const tail = (x, len, rz) => { const tg = new THREE.PlaneGeometry(0.085, len, 1, 4); tg.translate(0, -len / 2, 0); const m = new THREE.Mesh(tg, clothMat(col)); m.position.set(x, 0.6, -0.11); m.rotation.z = rz; m.castShadow = true; r.chest.add(m); this.gear.push(m); return m; };
      g.tails = [tail(-0.045, 0.66, 0.1), tail(0.05, 0.5, -0.12)];                                                           // the ends of the scarf, trailing behind
    } else if (id === 'orbit') {
      g.ring = add(r.root, new THREE.TorusGeometry(0.62, 0.011, 6, 56), neon(GRAV, 1.6), 0, 1.15, 0); g.ring.castShadow = false; g.ring.rotation.order = 'YXZ';   // a ring that turns round her, and three stones that circle
      g.moons = [0, 1, 2].map((i) => add(r.root, new THREE.IcosahedronGeometry(0.06 + i * 0.022, 0), std('#6e6a78', 0.95, 0), 0, 1.2, 0));
    } else if (id === 'lapse') {
      const d = new THREE.Group(); d.position.set(0, 0.42, -0.3); r.chest.add(d); this.gear.push(d);                          // a clock face that floats behind her back
      add(d, new THREE.TorusGeometry(0.34, 0.011, 6, 44), neon(TIME, 1.5), 0, 0, 0).castShadow = false;
      for (let k = 0; k < 12; k++) { const a = (k / 12) * 6.283; add(d, B(0.011, k % 3 ? 0.035 : 0.07, 0.008), neon(TIME, 1.2), Math.sin(a) * 0.3, Math.cos(a) * 0.3, 0, 0, 0, -a).castShadow = false; }
      const hand = (len, w) => { const hg = new THREE.BoxGeometry(w, len, 0.008); hg.translate(0, len / 2 - 0.02, 0); const m = add(d, hg, neon('#d8ffe9', 1.6), 0, 0, 0.004); m.castShadow = false; return m; };
      g.hands = [hand(0.27, 0.014), hand(0.17, 0.02)];
      add(r.elbR, B(0.03, 0.1, 0.03), std('#20232c', 0.6, 0.2), 0, -0.38, 0.035);                                           // her blade is a clock hand: a long bar of light with an arrow tip
      add(r.elbR, B(0.02, 0.78, 0.008), neon('#bff5d6', 1.3), 0, -0.8, 0.035).castShadow = false;
      add(r.elbR, new THREE.ConeGeometry(0.05, 0.13, 4), neon(TIME, 1.7), 0, -1.24, 0.035, Math.PI, 0, 0, 1, 1, 0.25).castShadow = false;
    } else if (id === 'prism') {
      g.mats = [];
      const lit = (op) => { const m = glowMat('#ffffff', op); g.mats.push(m); return m; };
      for (const e of [r.elbL, r.elbR]) add(e, B(0.008, 0.5, 0.07), lit(0.8), 0, -0.5, 0.03).castShadow = false;            // a blade of light along each forearm
      g.crystal = add(r.root, new THREE.OctahedronGeometry(0.1, 0), lit(0.85), -0.42, 1.72, -0.1, 0, 0, 0, 1, 1.5, 1); g.crystal.castShadow = false;   // the prism, floating at her shoulder
      const bd = (g.board = new THREE.Group()); bd.visible = false; r.root.add(bd); this.gear.push(bd);                      // the board of light she rides (shown while riding)
      add(bd, B(0.32, 0.03, 1.15), lit(0.75), 0, -0.02, 0).castShadow = false;
    }
  },

  // ---- per-frame hooks --------------------------------------------------------------------------------
  // movement powers that start from walking (called while the player has the controls)
  moves3(inp, dt) {
    const p = G.player, id = this.id, shift = inp.down('ShiftLeft') || inp.down('ShiftRight'), air = p.state === 'walk' && !p.grounded && !p.swim;
    if (id === 'tempo' && p.state === 'walk' && p.grounded && !p.swim && shift && inp.down('KeyW') && !this.channel && !(this.cd.rush > 0)) this.startMove('rush', { v: Math.max(10, p.speed), head: Math.atan2(p.vel.x, p.vel.z) || p.camYaw, done: new Set(), doneT: 0 });
    else if (id === 'zenith' && air && inp.pressed('Space')) this.startMove('fly', {});
    else if (id === 'prism' && air && inp.pressed('Space') && (this.airT || 0) > 0.08) { const hs = Math.hypot(p.vel.x, p.vel.z); this.startMove('slide', { v: Math.max(16, hs), head: hs > 3 ? Math.atan2(p.vel.x, p.vel.z) : p.camYaw, pitch: 0.2, done: new Set(), doneT: 0 }); G.fx.ring(this.centre(V()), '#ffffff', 0.3, 2.5, 0.3); this.sound('swish'); }
    else if (id === 'orbit' && air && inp.down('Space') && p.vel.y < -1.2) {   // floating down
      p.vel.y = damp(p.vel.y, -1.0, 8, dt); p.play('hover', 0.12);
      if (Math.random() < dt * 16) G.fx.glow.emit(p.pos.x + rnd(0.8), p.pos.y + 0.1, p.pos.z + rnd(0.8), 0, -1.2, 0, GRAV, 0.5, 0.12, 0.02, 0, 0);
    }
  },
  passives3(dt, t) {
    const p = G.player, id = this.id, fx = G.fx;
    this.haste = Math.max(0, (this.haste || 0) - dt); this.repel = Math.max(0, (this.repel || 0) - dt); this.phaseT = Math.max(0, (this.phaseT || 0) - dt);
    if (this.haste > 0) for (const k in this.cd) this.cd[k] -= dt;                       // Lapse's haste: every cooldown runs twice as fast
    if (id === 'lapse') {   // where she was and how she was, every 0.1 s for the last 4 s (Rewind goes back to the oldest)
      this.histT = (this.histT || 0) - dt;
      if (this.histT <= 0 && this.alive) { this.histT = 0.1; (this.hist = this.hist || []).push({ p: p.pos.clone(), hp: this.hp }); if (this.hist.length > 40) this.hist.shift(); }
    }
    if (id === 'orbit' && this.repel > 0) {   // the repel field: shots near her are thrown aside, anyone close is pushed out
      this.repelT = (this.repelT || 0) - dt;
      if (this.repelT <= 0) { this.repelT = 0.25; const c = this.centre(V()); if (G.villains) G.villains.eraseNear(c, 4.5, 0.3); this.ball(c, 4, { dmg: 4, knock: 11, up: 1, color: GRAV, civ: false }); fx.ring(c, GRAV, 0.6, 4.4, 0.3); }
    }
  },
  visuals3(dt, t) {
    const p = G.player, fx = G.fx, id = this.id, g = this.g3 || {}, v = p.vel.length();
    if (g.cape) {   // the cape lies along the back in flight, hangs at rest and streams out behind a run
      const fly = this.mv && (this.mv.kind === 'fly' || this.mv.kind === 'dash' || this.mv.kind === 'zip');
      g.capeA = damp(g.capeA ?? 0.14, fly ? 0.07 : 0.14 + clamp(v / 12, 0, 1) * 0.55, 6, dt); g.cape.rotation.x = g.capeA + Math.sin(t * (5 + v * 0.3)) * 0.02 * (1 + Math.min(v, 30) * 0.1);
    }
    if (g.tails) g.tails.forEach((m, i) => { m.rotation.x = 0.22 + clamp(v / 9, 0, 1) * 0.95 + Math.sin(t * (6 + i * 1.7) + i) * (0.06 + clamp(v / 20, 0, 1) * 0.12); });
    if (g.ring) {
      const fast = this.repel > 0 ? 3 : 1; g.spin = (g.spin || 0) + dt * fast;
      g.ring.rotation.y = g.spin * 0.9; g.ring.rotation.x = Math.PI / 2 - 0.32;
      g.moons.forEach((m, i) => { const a = g.spin * 1.7 + i * 2.094, rr = 0.72 + (this.repel > 0 ? 0.5 : 0); m.position.set(Math.cos(a) * rr, 1.15 + Math.sin(g.spin * 2 + i * 1.3) * 0.22, Math.sin(a) * rr); m.rotation.x += dt * 2; m.rotation.z += dt * 1.3; });
    }
    if (g.hands) { g.clock = (g.clock || 0) + dt * ((this.timeK ?? 1) < 1 ? 0 : this.haste > 0 ? 7 : 1); g.hands[0].rotation.z = -g.clock * 1.5; g.hands[1].rotation.z = -g.clock * 0.125; }
    if (g.mats) {
      g.mats.forEach((m, i) => m.color.set(rainbow(t * 0.22 + i * 0.21)));
      g.crystal.position.y = 1.72 + Math.sin(t * 2.1) * 0.05; g.crystal.rotation.y = t * 1.6;
      g.board.visible = !!(this.mv && this.mv.kind === 'slide');
      if (this.block > 0 && Math.random() < dt * 14) fx.ring(this.centre(V()).add(V().set(rnd(1.4), rnd(1.2), rnd(1.4))), rainbow(Math.random()), 0.1, 0.7, 0.3, V().set(rnd(), rnd(), rnd()).normalize());   // the mirror: glints of every colour round her
    }
    if (id === 'tempo') {
      if (Math.random() < dt * (this.phaseT > 0 ? 30 : 2.5)) { const a = V().set(p.pos.x + rnd(0.7), p.pos.y + 0.3 + Math.random() * 1.4, p.pos.z + rnd(0.7)); fx.bolt(a, a.clone().add(V().set(rnd(0.9), rnd(0.9), rnd(0.9))), this.phaseT > 0 ? '#ffffff' : TEMPO, 0.02, 0.1, 0.4, 2); }
    }
    if (id === 'orbit' && this.repel > 0 && Math.random() < dt * 18) fx.glow.emit(p.pos.x + rnd(5), p.pos.y + Math.random() * 2.4, p.pos.z + rnd(5), 0, 1.6, 0, GRAV, 0.5, 0.12, 0.02, 0, 0);
    if (id === 'lapse' && this.haste > 0 && Math.random() < dt * 22) fx.glow.emit(p.pos.x + rnd(0.6), p.pos.y + Math.random() * 1.7, p.pos.z + rnd(0.6), -p.vel.x * 0.2, 0.3, -p.vel.z * 0.2, TIME, 0.45, 0.14, 0.02, 0, 0);
  },
  // the line under the hero's name on the HUD, when this wave has something to say
  form3() {
    const mv = this.mv, id = this.id;
    if (mv && mv.kind === 'rush') return mv.wall ? 'running up the wall · Space leaps off' : `${Math.round(mv.v * 3.6)} km/h`;
    if (mv && mv.kind === 'slide') return `riding the light · ${Math.round(mv.v * 3.6)} km/h · C to land`;
    if (id === 'lapse' && (this.timeK ?? 1) < 1) return 'time is stopped';
    if (id === 'lapse' && this.haste > 0) return `haste ${Math.ceil(this.haste)} s`;
    if (id === 'tempo' && this.phaseT > 0) return `phasing ${Math.ceil(this.phaseT)} s`;
    if (id === 'orbit' && this.repel > 0) return `repel field ${Math.ceil(this.repel)} s`;
    if (id === 'prism' && this.block > 0) return `mirror ${Math.ceil(this.block)} s`;
    return null;
  },

  // ---- TEMPO ------------------------------------------------------------------------------------------
  // The rush (Shift + W): a run that builds to 46 m/s. The heading swings toward where the camera looks,
  // in wider arcs the faster he goes. He sticks to the ground over kerbs and steps, runs off edges with
  // his speed, across water as if it were street, and straight up any tall wall he meets head-on (feet
  // on the wall, to the top and over). Villains in the way are bowled over; residents he weaves round.
  rushStep(dt, inp, col) {
    const p = G.player, mv = this.mv, hold = inp.down('ShiftLeft') || inp.down('ShiftRight');
    mv.doneT -= dt; if (mv.doneT <= 0) { mv.doneT = 0.5; mv.done.clear(); }
    if (mv.wall) {
      const n = mv.wall;
      if (inp.pressed('Space') || !hold) { this.endMove(); p.vel.set(n.x * 11, hold ? 9 : 3, n.z * 11); p.yaw = Math.atan2(n.x, n.z); p.fling = true; p.play('spin', 0.35); this.sound('swish'); return; }
      mv.v = Math.max(18, mv.v - 5 * dt); const y0 = p.pos.y; p.pos.y += mv.v * dt;
      const d = col.raycast(p.pos.x, p.pos.y + 0.1, p.pos.z, -n.x, 0, -n.z, 3.2);
      if (d >= 3.2 || col.ceilingAt(p.pos.x, p.pos.z, p.pos.y + 0.5, 0.3) < p.pos.y + 2.2) {   // the top: over the edge and onto the roof
        this.endMove(); p.vel.set(-n.x * 7, Math.min(20, mv.v * 0.5), -n.z * 7); p.fling = true; p.play('spin', 0.4); this.sound('swish'); return;
      }
      p.pos.x -= n.x * (d - 1.55); p.pos.z -= n.z * (d - 1.55);   // the body lies out from the wall, so the feet are on it
      p.yaw = Math.atan2(-n.x, -n.z); p.vel.set(0, mv.v, 0); p.anim = 'run'; p.tiltT = { x: -1.5, z: 0 };
      const foot = V().set(p.pos.x - n.x * 1.5, y0 + 1.4, p.pos.z - n.z * 1.5);
      G.fx.bolt(foot, foot.clone().setY(p.pos.y + 1.4), TEMPO, 0.05, 0.4, 0.4, 2);
      return;
    }
    const mz = (inp.down('KeyW') ? 1 : 0) - (inp.down('KeyS') ? 1 : 0);
    if (!hold || mz <= 0 || (G.car && G.car.occupied)) return this.rushEnd();
    const turn = lerp(4.4, 1.9, clamp(mv.v / 46, 0, 1)) * dt;
    mv.head += clamp(angDelta(mv.head, this.intent(inp)), -turn, turn);
    mv.v = Math.min(46, mv.v + (mv.v < 22 ? 20 : 11) * dt);
    const hx = Math.sin(mv.head), hz = Math.cos(mv.head);
    if (inp.pressed('Space')) { this.endMove(); p.vel.set(hx * mv.v, 9.5 + mv.v * 0.08, hz * mv.v); p.fling = true; p.play('air', 0.3); this.sound('swish'); return; }   // a leap that keeps the speed
    const n = Math.max(1, Math.ceil((mv.v * dt) / 0.4)), h = dt / n, prev = p.pos.clone();
    for (let i = 0; i < n; i++) {
      const x0 = p.pos.x, z0 = p.pos.z;
      p.pos.x += hx * mv.v * h; p.pos.z += hz * mv.v * h;
      const hit = col.resolveCircle(p.pos, 0.34, p.pos.y + 0.7, p.pos.y + 1.75);
      if (hit && hit.nx * hx + hit.nz * hz < -0.55) {
        // head-on into something: a tall wall he runs straight up, a low one he hops
        if (mv.v > 14 && col.raycast(x0, p.pos.y + 3.4, z0, hx, 0, hz, 2.5) < 2.5) { mv.wall = V().set(hit.nx, 0, hit.nz); G.fx.ring(V().set(p.pos.x, p.pos.y + 0.6, p.pos.z), TEMPO, 0.3, 2.4, 0.3, mv.wall); return; }
        this.endMove(); p.vel.set(hx * Math.min(mv.v, 16), 9, hz * Math.min(mv.v, 16)); p.fling = true; p.play('air', 0.3); return;
      }
      if (hit) mv.v *= 0.985;                                                              // a glancing touch: he slides along it
      const g = col.groundAt(p.pos.x, p.pos.z, p.pos.y + 0.3, 0.6, 0.26);
      if (p.pos.y - g > 1.3) { this.endMove(); p.vel.set(hx * mv.v, 1.5, hz * mv.v); p.fling = true; return; }   // off an edge: the speed carries
      p.pos.y = g;
    }
    if (G.traffic) G.traffic.pushOut(p.pos, 0.34);
    p.vel.set(hx * mv.v, 0, hz * mv.v); p.yaw = mv.head; p.anim = 'run'; p.rig.accLean = 0.16 + mv.v * 0.006;
    if (mv.v > 16) this.strike({ kind: 'capsule', a: prev.clone().setY(prev.y + 1), b: p.pos.clone().setY(p.pos.y + 1), r: 1.2 }, { dmg: mv.v * 0.5, knock: mv.v * 0.42, up: 3, kind: 'shock', color: TEMPO, except: mv.done, dir: V().set(hx, 0, hz), civ: false });
    // lightning along the path (a piece every 1.5 m), sparks off the body, spray off the water
    mv.last = mv.last || prev.clone();
    if (mv.v > 14 && mv.last.distanceTo(p.pos) > 1.5) { G.fx.bolt(mv.last.clone().setY(mv.last.y + 1), p.pos.clone().setY(p.pos.y + 1), TEMPO, 0.06, 0.45, 0.6, 2); G.fx.beam(mv.last.clone().setY(mv.last.y + 0.3), p.pos.clone().setY(p.pos.y + 0.3), '#f4ffd0', 0.03, 0.55); mv.last.copy(p.pos); }
    if (Math.random() < dt * 30) G.fx.glow.emit(p.pos.x + rnd(0.5), p.pos.y + 0.3 + Math.random() * 1.3, p.pos.z + rnd(0.5), 0, 0.6, 0, TEMPO, 0.35, 0.1, 0.02, 0, 0);
    if (G.districts && G.districts.waterAt(p.pos.x, p.pos.z, p.pos.y)) G.fx.spray(V().set(p.pos.x, p.pos.y + 0.25, p.pos.z), UP, '#e6f6ff', 4, 5, 1.4, 0.5, 0.22, 0.4, 9);
    else if (Math.random() < dt * 10) G.fx.dust(p.pos, 1, 0.4);
    if (!mv.top && mv.v >= 45.5) { mv.top = true; const c = this.centre(V()), d = V().set(hx, 0, hz); G.fx.ring(c, '#ffffff', 0.5, 9, 0.45, d); G.fx.ring(c.clone().addScaledVector(d, -2), TEMPO, 0.5, 6, 0.4, d); G.fx.shake(0.3); if (G.sfx) G.sfx.play('boom', null, 0.7); G.ui.flash('TOP SPEED', 0.6); }
    if (G.audio && Math.random() < dt * 9) G.audio.burst(0.12, 0.012 + mv.v * 0.0006, 500 + mv.v * 18, 'bandpass');
  },
  // out of the rush on his feet, skidding down to a run
  rushEnd() {
    const p = G.player, mv = this.mv, v = mv.v, hx = Math.sin(mv.head), hz = Math.cos(mv.head), k = Math.min(v, 10.5);
    this.endMove(false); p.grounded = true; p.vel.set(hx * k, 0, hz * k); this.cd.rush = 0.25;
    if (v > 22) { G.fx.dust(p.pos, 10, 1.2); p.play('land', 0.22); this.sound('swish'); }
  },
  tempoLight() { this.combo3({ anims: ['punchR', 'punchL', 'punchR', 'kick'], dmg: [9, 9, 9, 17], knock: [2, 2, 2, 9], range: 2.5, deg: 60, kind: 'shock', color: TEMPO, wall: 0.5 }); },
  // Whirlwind: laps round the spot he aims at; the wind lifts whoever is inside and throws them up at the end
  tempoHeavy() {
    const p = G.player, a = this.aim(16), c = a.target ? a.target.pos.clone() : a.point.clone();
    c.y = G.colliders.groundAt(c.x, c.z, p.pos.y + 1.5, 2, 0.3);
    if (Math.abs(c.y - p.pos.y) > 3 || c.distanceTo(p.pos) > 18) c.copy(p.pos).add(V().set(Math.sin(p.camYaw) * 4, 0, Math.cos(p.camYaw) * 4));
    this.startMove('circle', { c, a: Math.atan2(p.pos.x - c.x, p.pos.z - c.z), T: 0.85, r: 3.4, k: 0 });
  },
  circleStep(dt, col) {
    const p = G.player, mv = this.mv, c = mv.c, prev = p.pos.clone();
    mv.a += dt * 17;                                                                          // a little over two laps
    p.pos.set(c.x + Math.sin(mv.a) * mv.r, p.pos.y, c.z + Math.cos(mv.a) * mv.r);
    col.resolveCircle(p.pos, 0.34, p.pos.y + 0.7, p.pos.y + 1.75); p.pos.y = col.groundAt(p.pos.x, p.pos.z, p.pos.y + 0.3, 0.6, 0.26);
    p.yaw = mv.a + Math.PI / 2; p.vel.set(Math.cos(mv.a) * 24, 0, -Math.sin(mv.a) * 24); p.anim = 'run'; p.rig.accLean = 0.3;
    G.fx.bolt(prev.setY(prev.y + 1), p.pos.clone().setY(p.pos.y + 1), TEMPO, 0.05, 0.3, 0.4, 2);
    if (Math.random() < dt * 14) G.fx.ring(V().set(c.x, c.y + 0.3 + Math.random() * 3, c.z), Math.random() < 0.5 ? TEMPO : '#ffffff', mv.r, mv.r * 0.5, 0.35);
    if (Math.random() < dt * 20) G.fx.dust(V().set(c.x + rnd(4), c.y, c.z + rnd(4)), 1, 0.5);
    mv.k -= dt; if (mv.k <= 0) { mv.k = 0.2; this.ball(V().set(c.x, c.y + 1, c.z), mv.r + 0.8, { dmg: 6, knock: 0, up: 4.5, stun: 0.5, kind: 'shock', color: TEMPO, civ: false }); }
    if (mv.t >= mv.T) {
      this.endMove(false); p.grounded = true; p.vel.set(0, 0, 0);
      const cc = V().set(c.x, c.y + 1, c.z); this.ball(cc, mv.r + 1.2, { dmg: 16, knock: 4, up: 11, stun: 1.2, kind: 'shock', color: TEMPO, from: V().set(c.x, c.y - 2, c.z) });
      for (let i = 0; i < 3; i++) G.fx.ring(V().set(c.x, c.y + 0.4 + i * 1.3, c.z), '#ffffff', 0.6, mv.r + 1.5, 0.35 + i * 0.08); G.fx.shake(0.25); this.sound('whoosh');
    }
  },
  tempoP1() {
    const p = G.player, a = this.aim(42); this.faceAim(0.3);
    const dir = V().subVectors(a.point, this.chest()), L = clamp(dir.length() - 0.8, 4, 40); if (dir.lengthSq() < 0.01) dir.set(Math.sin(p.yaw), 0, Math.cos(p.yaw));
    dir.normalize(); if (p.grounded && dir.y < 0) dir.setY(0).normalize();
    this.startMove('dash', { dir, speed: 120, T: L / 120, done: new Set(), anim: 'dash', hit: { dmg: 32, knock: 9, up: 3, stun: 0.5, kind: 'shock', color: TEMPO }, r: 1.5,
      trail: (x, y) => { G.fx.bolt(x.clone().setY(x.y + 1.1), y.clone().setY(y.y + 1.1), TEMPO, 0.09, 0.4, 0.8); G.fx.beam(x.clone().setY(x.y + 0.5), y.clone().setY(y.y + 0.5), '#ffffff', 0.04, 0.5); },
      onEnd: () => { p.vel.multiplyScalar(0.5); G.fx.ring(this.centre(V()), TEMPO, 0.4, 3.5, 0.3); G.damage.wallHit(this.chest(), dir, 2, 1.5, 'shock', { byHero: true }); } });
    G.fx.shake(0.15);
  },
  tempoP2() {
    const p = G.player; this.faceAim(0.7); p.play('charge', 0.32);
    this.charge3(0.3, '#f4ffd0', 0.12, () => {
      const h = this.hand(), a = this.aim(80); p.play('castR', 0.3); this.sound('zap');
      this.shoot({ from: h, dir: this.dirFrom(h, a), speed: 95, r: 0.3, color: '#f4ffd0', dmg: 50, knock: 10, up: 3, stun: 1.2, kind: 'shock', life: 1.2, power: 2, trail: TEMPO,
        onHit: (q) => {   // the bolt jumps on to the three nearest
          const more = this.nearest(4, 10, q).filter((x) => G.combat.centre(x, V()).distanceTo(q) > 1.5).slice(0, 3);
          for (const x of more) { const c = G.combat.centre(x, V()).clone(); G.fx.bolt(q.clone(), c, TEMPO, 0.06, 0.3, 0.9); x.hit(22 * this.dmgMul, V().subVectors(c, q).setY(0).normalize(), { knock: 4, stun: 1, kind: 'shock', byHero: true }); G.fx.spark(c, TEMPO, 8, 5, 0.3, 0.12); this.charge(7); }
          G.fx.blast(q, TEMPO, 0.2, 2, 0.3);
        } });
    });
  },
  tempoP3() { this.dodge = 5; this.phaseT = 5; G.ui.flash('PHASE', 0.9); G.fx.ring(this.centre(V()), '#ffffff', 0.5, 3.5, 0.5); G.fx.ring(this.centre(V()), TEMPO, 0.3, 2.5, 0.4); },
  tempoUlt() {
    const p = G.player, list = this.nearest(8, 32); if (!list.length) { G.ui.toast('No villains within 32 m.', 'info'); return false; }
    G.ui.flash('THUNDER LAP', 1.2); if (this.mv) this.endMove();
    const home = p.pos.clone(), laps = Math.max(3, Math.ceil(9 / list.length)), seq = []; for (let k = 0; k < laps; k++) seq.push(...list);
    this.dodge = Math.max(this.dodge, seq.length * 0.09 + 0.8);
    let prev = this.centre(V()).clone();
    seq.forEach((tg, i) => this.later(0.09 * (i + 1), () => {
      if (!tg.alive) return; const q = G.combat.centre(tg, V()).clone(), sx = Math.sin(i * 2.4), sz = Math.cos(i * 2.4);
      p.pos.set(tg.pos.x + sx * 1.3, tg.flying ? tg.pos.y - 1 : tg.pos.y, tg.pos.z + sz * 1.3); p.vel.set(0, 0, 0); p.yaw = Math.atan2(-sx, -sz); p.play(i % 2 ? 'punchL' : 'punchR', 0.12);
      G.fx.bolt(prev, q, TEMPO, 0.1, 0.5, 1.2); G.fx.beam(prev.clone(), q.clone(), '#ffffff', 0.04, 0.5); prev = q;
      tg.hit(24 * this.dmgMul, V().set(-sx, 0, -sz), { knock: 3, up: 2, stun: 0.8, kind: 'shock', byHero: true }); G.combat.lastHit = tg; G.combat.lastHitT = 4; G.fx.spark(q, TEMPO, 8, 6, 0.3, 0.12);
      if (G.audio) G.audio.tone(700 + (i % 8) * 70, 0.06, 0.04, 'square');
    }));
    this.later(0.09 * (seq.length + 1), () => {   // home again, and lightning falls on everyone he passed
      p.pos.copy(home); p.vel.set(0, 0, 0); const cc = this.centre(V()).clone(); G.fx.bolt(prev, cc, TEMPO, 0.1, 0.5, 1.2);
      for (const tg of list) if (tg.alive) { const q = G.combat.centre(tg, V()).clone(); G.fx.bolt(q.clone().setY(q.y + 35), q, '#ffffff', 0.16, 0.3, 3); G.fx.bolt(q.clone().setY(q.y + 35), q, TEMPO, 0.09, 0.3, 4); tg.hit(30 * this.dmgMul, V().subVectors(tg.pos, home).setY(0).normalize(), { knock: 14, up: 6, kind: 'shock', byHero: true }); }
      G.fx.ring(cc, TEMPO, 0.5, 16, 0.5); G.fx.shake(0.6); this.sound('boom'); G.env.flash = Math.max(G.env.flash || 0, 0.5);
    });
  },

  // ---- ZENITH -----------------------------------------------------------------------------------------
  // light and trail in flight (Forge has thrusters; Zenith only the sun on him)
  flyFx3(mv, v, dt) {
    const c = this.centre(V()).clone();
    if (v > 24 && mv.zt) G.fx.beam(mv.zt.clone(), c.clone(), '#ffd97a', 0.1, 0.5);
    mv.zt = c;
    if (Math.random() < dt * (5 + v * 0.5)) G.fx.glow.emit(c.x + rnd(0.7), c.y + rnd(0.9), c.z + rnd(0.7), 0, 0, 0, '#ffe9a8', 0.4, 0.1, 0.02, 0, 0);
  },
  // a flying punch: straight at an enemy (or 10 m the way you aim), a blow that launches them, then back into flight
  zenithRam(t, dmg, flying) {
    const p = G.player, from = p.pos.clone();
    let dir, L;
    if (t) { const to = G.combat.centre(t, V()).clone(); to.y -= 1.0; dir = V().subVectors(to, from); L = Math.max(1, dir.length() - 1.4); dir.normalize(); }
    else { dir = this.dirFrom(this.chest(), this.aim(14)); if (p.grounded && dir.y < 0) dir.setY(0).normalize(); L = 10; }
    this.startMove('dash', { dir, speed: 70, T: L / 70, anim: 'soar', tilt: clamp(Math.PI / 2 - Math.asin(clamp(dir.y, -1, 1)) - 0.12, 0, 1.95),
      trail: (x, y) => G.fx.beam(x.clone().setY(x.y + 1), y.clone().setY(y.y + 1), '#ffd97a', 0.1, 0.35),
      onEnd: () => {
        p.play('punchR', 0.25); p.vel.multiplyScalar(0.4); const c = this.chest().addScaledVector(dir, 1.2);
        const n = this.ball(c, 2.1, { dmg, knock: 22, up: 5, color: SUN, dir: dir.clone(), max: 2 });
        G.fx.ring(c, '#ffe9a8', 0.3, 3.6, 0.3, dir); G.fx.spark(c, '#ffffff', 12, 7, 0.35, 0.12); G.fx.shake(n ? 0.3 : 0.1); this.sound(n ? 'boom' : 'swish');
        if (!n) G.damage.wallHit(this.chest(), dir, 2.5, 3, 'blunt', { byHero: true });
        if (flying && this.id === 'zenith' && !p.grounded) this.startMove('fly', { lift: true });
      } });
    this.sound('swish');
  },
  zenithLight() {
    const p = G.player, flying = !!(this.mv && this.mv.kind === 'fly');
    if (p.grounded && !this.mv) return this.combo3({ anims: ['punchR', 'punchL', 'heavy'], dmg: [17, 17, 27], knock: [8, 8, 17], range: 2.8, deg: 60, color: SUN, wall: 1.6 });
    const t = this.airTarget(45, 0.86); if (t) return this.zenithRam(t, 30, flying);
    // nobody to punch: a flick of the sun beams
    const a = this.aim(80), E = this.eyes3(), to = a.point.clone(), d = V().subVectors(to, E[0]).normalize(); this.faceAim(0.3);
    for (const e of E) { G.fx.beam(e, to, '#ff7a3c', 0.06, 0.12); G.fx.beam(e, to, '#fff1c9', 0.025, 0.12); }
    this.strike({ kind: 'capsule', a: E[0], b: to, r: 0.5 }, { dmg: 11, knock: 2, kind: 'fire', color: '#ff8a3c', dir: d, max: 1 }); G.fx.spark(to, '#ffb347', 5, 4, 0.25, 0.1); this.sound('zap');
  },
  zenithHeavy() { const flying = !!(this.mv && this.mv.kind === 'fly'); this.faceAim(0.4); this.zenithRam(this.airTarget(16, 0.8), 36, flying); },
  zenithP1() {
    this.faceAim(1.9); G.ui.flash('SUN BEAMS', 0.8); let wallT = 0;
    this.startChannel(1.8, 0.08, () => {
      this.faceAim(0.3); const a = this.aim(75), to = a.point.clone(), E = this.eyes3(), d = V().subVectors(to, E[0]).normalize();
      for (const e of E) { G.fx.beam(e, to, '#ff7a3c', 0.1, 0.1); G.fx.beam(e, to, '#fff1c9', 0.04, 0.1); }
      G.fx.spark(to, '#ffb347', 4, 5, 0.3, 0.12); if (Math.random() < 0.5) G.fx.fire(to, 2, 0.5);
      this.strike({ kind: 'capsule', a: E[0], b: to, r: 0.8 }, { dmg: 7, knock: 1.5, kind: 'fire', color: '#ff8a3c', dir: d });
      wallT -= 0.08; if (a.wall && wallT <= 0) { wallT = 0.24; G.damage.impact(to, G.damage.normalAt(to, d), 1.3, 'fire', { byHero: true, quiet: true }); }
      if (G.audio && Math.random() < 0.5) G.audio.burst(0.1, 0.04, 1800, 'bandpass');
    }, { slow: 0.3 });
  },
  zenithP2() {
    const p = G.player; p.play('breathe', 1.3); G.ui.flash('GALE BREATH', 0.8);
    this.startChannel(1.2, 0.1, () => {
      this.faceAim(0.3); const from = this.chest().add(V().set(0, 0.35, 0)), d = this.dirFrom(from, this.aim(16)); from.addScaledVector(d, 0.35);
      G.fx.spray(from, d, '#eaf6ff', 8, 28, 0.32, 0.5, 0.18, 1.2); G.fx.spray(from, d, '#cfd8e2', 2, 20, 0.36, 0.7, 0.5, 2.2, 0, true);
      this.strike({ kind: 'cone', o: from, dir: d, range: 14, cos: Math.cos(0.42) }, { dmg: 2.5, knock: 9, up: 1.5, stun: 0.4, color: '#eaf6ff', civ: false });
      if (G.villains) G.villains.eraseNear(from.clone().addScaledVector(d, 4), 4, 0.15);
      if (G.audio && Math.random() < 0.6) G.audio.burst(0.2, 0.05, 700, 'bandpass');
    }, { slow: 0.4 });
  },
  // up into the sky and down on the crosshair
  zenithP3() {
    const p = G.player, col = G.colliders, a = this.aim(60), at = a.point.clone(); at.y = Math.max(at.y, col.groundAt(at.x, at.z, at.y + 1, 2, 0.3));
    const top = V().set(lerp(p.pos.x, at.x, 0.35), Math.max(p.pos.y, at.y) + 20, lerp(p.pos.z, at.z, 0.35)), ceil = col.ceilingAt(p.pos.x, p.pos.z, p.pos.y + 1, 0.3);
    if (ceil < top.y + 2) top.y = Math.max(p.pos.y + 1, ceil - 2.4);
    G.ui.flash('SKYFALL', 0.8); G.fx.ring(at, SUN, 7, 0.6, 0.8); G.fx.ring(V().set(p.pos.x, p.pos.y + 0.1, p.pos.z), '#ffe9a8', 0.3, 4, 0.4); G.fx.dust(p.pos, 10, 1.2); this.sound('whoosh');
    this.startMove('zip', { to: top, speed: 60, T: 0.7, anim: 'soar', onEnd: () => {
      const d = V().subVectors(at, p.pos).normalize();
      this.startMove('zip', { to: at.clone(), speed: 90, T: 1.4, anim: 'soarBoost', tilt: clamp(Math.PI / 2 - Math.asin(clamp(d.y, -1, 1)) - 0.12, 0, 1.95), onEnd: () => {
        const c = V().set(p.pos.x, p.pos.y + 0.3, p.pos.z); p.vel.set(0, 0, 0); p.play('slam', 0.5);
        this.ball(c, 7, { dmg: 55, knock: 15, up: 7, color: SUN }); G.damage.impact(V().set(c.x, p.pos.y, c.z), UP.clone(), 4.5, 'blunt', { byHero: true });
        G.fx.ring(c, SUN, 0.5, 9, 0.5); G.fx.ring(c, '#ffffff', 0.3, 5, 0.35); G.fx.dust(c, 30, 3); G.fx.shake(0.7); this.sound('boom');
      } });
    } });
  },
  // Sunfall: one villain is carried straight up 30 m and driven into the street. Bosses are too big to carry:
  // he goes up alone and comes down on them.
  zenithUlt() {
    const p = G.player, a = this.aim(40), tg = a.target && a.target.alive ? a.target : this.nearest(1, 24)[0];
    if (!tg) { G.ui.toast('No villain within reach.', 'info'); return false; }
    G.ui.flash('SUNFALL', 1.3); const carry = !tg.big && !!tg.vel;
    const hold = () => {
      if (!tg.alive) return; tg.stun = Math.max(tg.stun || 0, 0.4); if (!carry) return;
      const f = V().set(Math.sin(p.yaw), 0, Math.cos(p.yaw)); tg.vel.set(0, 0, 0);
      if (tg.flying) tg.pos.set(p.pos.x + f.x * 0.9, p.pos.y + 1.2, p.pos.z + f.z * 0.9);
      else { tg.pos.x = p.pos.x + f.x * 0.9; tg.pos.z = p.pos.z + f.z * 0.9; tg.air = Math.max(0, p.pos.y + 0.2 - tg.pos.y); tg.vy = 0.37; }
    };
    const slam = () => {
      const c = V().set(p.pos.x, p.pos.y + 0.4, p.pos.z), f = V().set(Math.sin(p.yaw), 0, Math.cos(p.yaw)); p.vel.set(0, 0, 0); p.play('slam', 0.6);
      if (tg.alive && (carry || G.combat.centre(tg, V()).distanceTo(c) < 7)) {
        if (carry && !tg.flying) { tg.air = 0; tg.vy = 0; } else if (carry) tg.pos.y = p.pos.y + 1.0;
        tg.hit(160 * this.dmgMul, f, { knock: 6, up: 5, stun: 2, byHero: true }); G.combat.lastHit = tg; G.combat.lastHitT = 4;
      }
      this.ball(c, 9, { dmg: 55, knock: 17, up: 8, color: SUN, except: new Set([tg]) }); G.damage.burst(c, 9, 5, 'blunt', { byHero: true }); G.damage.impact(V().set(c.x, p.pos.y, c.z), UP.clone(), 4.5, 'blunt', { byHero: true });
      G.fx.blast(c, '#ffe9a8', 0.5, 7, 0.5); G.fx.ring(c, SUN, 0.5, 14, 0.6); G.fx.ring(c, '#ffffff', 0.3, 8, 0.4); G.fx.dust(c, 36, 4); G.fx.shake(1); this.sound('boom'); G.env.flash = Math.max(G.env.flash || 0, 0.4);
    };
    const trail = (x, y) => { G.fx.beam(x.clone().setY(x.y + 1), y.clone().setY(y.y + 1), '#ffd97a', 0.16, 0.6); if (Math.random() < 0.5) G.fx.glow.emit(y.x + rnd(), y.y + 1, y.z + rnd(), 0, 0, 0, '#ffe9a8', 0.5, 0.14, 0.02, 0, 0); };
    const down = () => {
      const d = carry ? V().set(0, -1, 0) : V().subVectors(G.combat.centre(tg, V()), p.pos).setY(Math.min(-8, tg.pos.y - p.pos.y)).normalize();
      this.startMove('dash', { dir: d, speed: 90, T: 2.5, anim: 'soarBoost', tilt: carry ? 1.95 : clamp(Math.PI / 2 - Math.asin(clamp(d.y, -1, 1)) - 0.12, 0, 1.95), spin: hold, trail, onEnd: slam });
    };
    const rise = () => { G.fx.ring(V().set(p.pos.x, p.pos.y + 0.1, p.pos.z), '#ffe9a8', 0.3, 5, 0.4); G.fx.dust(p.pos, 12, 1.4); this.sound('whoosh'); this.startMove('dash', { dir: V().set(0, 1, 0), speed: 42, T: 0.72, anim: 'soar', spin: hold, trail, onEnd: down }); };
    const to = V().copy(tg.pos); if (tg.flying) to.y -= 1.2; const dir = V().subVectors(to, p.pos), L = dir.length();
    if (L > 2.2 && carry) this.startMove('dash', { dir: dir.normalize(), speed: 70, T: (L - 1.2) / 70, anim: 'soar', tilt: clamp(Math.PI / 2 - Math.asin(clamp(dir.y, -1, 1)) - 0.12, 0, 1.95), trail, onEnd: rise });
    else rise();
  },

  // ---- GINRO ------------------------------------------------------------------------------------------
  // a wolf made of lightning: the dog rig, in light
  wolf3(scale) {
    const rig = makeDog({ robot: true, scale }), m = glowMat('#9fbcff', 0.6);
    rig.root.traverse((o) => { if (o.isMesh) { o.material = m; o.castShadow = false; } });
    return rig;
  },
  ginroLight() {
    const p = G.player, a = this.aim(45), far = a.target && G.combat.centre(a.target, V()).distanceTo(this.chest()) > 4.2;
    if (far || (!p.grounded && !this.mv)) {   // a thrown knife
      const h = this.hand(); this.faceAim(0.3); p.play('castR', 0.16); this.sound('swish');
      this.shoot({ from: h, dir: this.dirFrom(h, a), speed: 70, r: 0.1, color: '#e8eefc', dmg: 11, knock: 2, kind: 'cut', life: 0.9, power: 0.4, trail: '#9fb0d8' }); return;
    }
    this.combo3({ anims: ['slash', 'slash2', 'kick'], dmg: [12, 12, 19], knock: [3, 3, 9], range: 2.6, deg: 65, kind: 'cut', color: '#dfe6f8', arc: true, wall: 0.6 });
  },
  // the lightning wolf runs down the enemy you aim at on a leash of lightning; its bite shocks them and two more
  ginroHeavy() {
    const p = G.player, a = this.aim(34), tg = a.target || this.airTarget(34, 0.8); this.faceAim(0.5); p.play('castR', 0.4);
    const rig = this.wolf3(1.25), pos = V().copy(p.pos).add(V().set(Math.sin(p.yaw), 0, Math.cos(p.yaw))), goal = a.point.clone(); let done = false; G.scene.add(rig.root);
    this.run(1.5, (k, dt, r) => {
      const to = tg && tg.alive ? tg.pos : goal, dx = to.x - pos.x, dz = to.z - pos.z, d = Math.hypot(dx, dz) || 1, st = Math.min(d, 30 * dt);
      pos.x += (dx / d) * st; pos.z += (dz / d) * st; pos.y = G.colliders.groundAt(pos.x, pos.z, pos.y + 1.2, 1, 0.2);
      rig.root.position.copy(pos); rig.root.rotation.y = Math.atan2(dx, dz); animateDog(rig, dt, 'run', 9);
      const back = V().set(pos.x, pos.y + 0.6, pos.z); if (Math.random() < 0.5) G.fx.bolt(this.hand(), back, SILVER, 0.03, 0.08, 0.5); G.fx.glow.emit(back.x, back.y, back.z, 0, 0.5, 0, '#9fbcff', 0.3, 0.2, 0.03, 0, 0);
      if (d < 1.5 && !done) {
        done = true; r.t = r.T;
        const c = tg && tg.alive ? G.combat.centre(tg, V()).clone() : back.clone(); G.fx.bolt(back, c, '#ffffff', 0.06, 0.2, 0.6);
        this.ball(c, 1.6, { dmg: 34, knock: 5, up: 3, stun: 1.6, kind: 'shock', color: SILVER, max: 1 });
        for (const m of this.nearest(3, 9, V().set(c.x, pos.y, c.z)).filter((x) => x !== tg).slice(0, 2)) { const q = G.combat.centre(m, V()).clone(); G.fx.bolt(c, q, SILVER, 0.05, 0.25, 0.8); m.hit(18 * this.dmgMul, V().subVectors(q, c).setY(0).normalize(), { knock: 3, stun: 1, kind: 'shock', byHero: true }); G.fx.spark(q, SILVER, 8, 5, 0.3, 0.12); this.charge(6); }
        G.fx.blast(c, SILVER, 0.2, 1.8, 0.25); this.sound('zap');
      }
    }, null, () => { G.fx.spark(V().set(pos.x, pos.y + 0.6, pos.z), SILVER, 14, 6, 0.4, 0.12); rig.root.removeFromParent(); });
  },
  // a wall of stone out of the street, across the way he faces (walls here are square to the street grid).
  // It is solid while it stands: cover from shots, and something to stand on.
  ginroP1() {
    const p = G.player, col = G.colliders, a = this.aim(14); this.faceAim(0.4); p.play('slam', 0.4);
    const f = V().set(Math.sin(p.camYaw), 0, Math.cos(p.camYaw)), d = clamp(V().subVectors(a.point, p.pos).setY(0).length(), 3.5, 12);
    const at = V().copy(p.pos).addScaledVector(f, d); at.y = col.groundAt(at.x, at.z, p.pos.y + 1.5, 2, 0.3);
    const alongX = Math.abs(f.z) > Math.abs(f.x), W = 6.4, Hh = 3.2, T = 0.9, hx = alongX ? W / 2 : T / 2, hz = alongX ? T / 2 : W / 2;
    const mesh = new THREE.Group(), rock = std('#6d665c', 0.95, 0), slab = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, Hh, hz * 2), rock); slab.position.y = Hh / 2; slab.castShadow = slab.receiveShadow = true; mesh.add(slab);
    for (let i = 0; i < 5; i++) { const u = (i - 2) / 2.4, b = new THREE.Mesh(new THREE.BoxGeometry(alongX ? 1.1 : T * 1.15, 0.3 + Math.random() * 0.5, alongX ? T * 1.15 : 1.1), rock); b.position.set(alongX ? u * W / 2 : 0, Hh + 0.1, alongX ? 0 : u * W / 2); b.rotation.y = rnd(0.3); b.castShadow = true; mesh.add(b); }   // a broken top edge
    mesh.position.set(at.x, at.y - Hh, at.z); G.scene.add(mesh);
    const ea = V().set(at.x - (alongX ? W / 2 : 0), at.y + 1, at.z - (alongX ? 0 : W / 2)), eb = V().set(at.x + (alongX ? W / 2 : 0), at.y + 1, at.z + (alongX ? 0 : W / 2));
    this.later(0.1, () => { this.strike({ kind: 'capsule', a: ea, b: eb, r: 1.3 }, { dmg: 26, knock: 5, up: 11, stun: 1.2, color: '#b8ad9c', dir: f.clone() }); G.fx.dust(at, 22, 3); G.fx.shake(0.35); G.damage.impact(at.clone(), UP.clone(), 2, 'blunt', { byHero: true, quiet: true }); this.sound('boom'); });
    let box = null;
    this.run(6.5, (k, dt, r) => {
      mesh.position.y = at.y - Hh * (1 - Math.min(clamp(r.t / 0.25, 0, 1), clamp((r.T - r.t) / 0.5, 0, 1)));   // up in a quarter of a second, back down at the end
      if (!box && r.t > 0.25) box = col.box(at.x - hx, at.x + hx, at.y - 0.5, at.y + Hh, at.z - hz, at.z + hz);
      if (box && r.T - r.t < 0.5) box.enabled = false;
    }, () => G.fx.dust(at, 10, 2), () => { if (box) box.enabled = false; mesh.removeFromParent(); });
  },
  // gone in a flicker, 7 m back; the copy left behind bursts into lightning (sooner if a villain comes for it)
  ginroP2() {
    const p = G.player, col = G.colliders, here = p.pos.clone(), yaw = p.yaw, bx = -Math.sin(yaw), bz = -Math.cos(yaw);
    const rig = makeHumanoid({ ...DEFAULT_LOOK, ...this.H.look }); rig.root.position.copy(here); rig.root.rotation.y = yaw; G.scene.add(rig.root);
    G.fx.smoke(this.centre(V()), 3, '#dfe6f8', 1.2, 1);
    const d = Math.max(0, Math.min(7, col.raycast(here.x, here.y + 1, here.z, bx, 0, bz, 7.5) - 0.6));
    if (this.mv) this.endMove(); p.pos.x += bx * d; p.pos.z += bz * d; p.pos.y = col.groundAt(p.pos.x, p.pos.z, p.pos.y + 1, 1.5, 0.3); p.vel.set(0, 0, 0);
    this.dodge = Math.max(this.dodge, 2.2); G.fx.smoke(this.centre(V()), 3, '#dfe6f8', 1, 1);
    const c = V().set(here.x, here.y + 1, here.z);
    this.run(1.8, (k, dt, r) => {
      animateRig(rig, dt, 'guard', 0);
      if (Math.random() < dt * 16) { const q = c.clone().add(V().set(rnd(0.7), rnd(1.4), rnd(0.7))); G.fx.bolt(q, q.clone().add(V().set(rnd(0.8), rnd(0.8), rnd(0.8))), SILVER, 0.025, 0.1, 0.5, 2); }
      if (r.t > 0.35 && this.nearest(1, 2.4, here)[0]) r.t = r.T;
    }, () => {
      this.ball(c, 6, { dmg: 45, knock: 12, up: 5, stun: 2.5, kind: 'shock', color: SILVER });
      for (let i = 0; i < 8; i++) { const an = (i / 8) * 6.283; G.fx.bolt(c, V().set(c.x + Math.cos(an) * 5.5, c.y + rnd(2), c.z + Math.sin(an) * 5.5), SILVER, 0.06, 0.3, 1); }
      G.fx.blast(c, '#dfe9ff', 0.4, 4, 0.35); G.fx.ring(c, SILVER, 0.5, 7, 0.4); G.fx.shake(0.4); this.sound('boom');
    }, () => rig.root.removeFromParent());
  },
  // a dragon of water: a head and a body of drops that winds from villain to villain (up to five)
  ginroP3() {
    const p = G.player, a = this.aim(40), blue = '#5fb8ff'; this.faceAim(0.5); p.play('cast', 0.5); G.ui.flash('WATER DRAGON', 0.8);
    const list = []; let nx = a.target && a.target.alive ? a.target : this.nearest(1, 30)[0];
    while (nx && list.length < 5) { list.push(nx); const last = nx; nx = [...G.combat.targets].filter((x) => x.alive && !list.includes(x) && x.pos.distanceTo(last.pos) < 16).sort((m, n) => m.pos.distanceTo(last.pos) - n.pos.distanceTo(last.pos))[0]; }
    const head = this.hand().clone(), far = a.point.clone(), path = [head.clone()], orbs = [];
    for (let i = 0; i < 9; i++) orbs.push(G.fx.orb(i ? blue : '#d8f1ff', 0.5 - i * 0.04));
    let idx = 0, tail = 0, w = 0;
    this.run(5, (k, dt, r) => {
      w += dt;
      if (tail > 0) { tail -= dt; if (tail <= 0) r.t = r.T; }
      else {
        const tg = list[idx], to = tg ? (tg.alive ? G.combat.centre(tg, V()).clone() : null) : far;
        if (!to) idx++;
        else {
          const d = V().subVectors(to, head), L = d.length() || 1; d.divideScalar(L);
          const side = V().crossVectors(d, UP); if (side.lengthSq() > 1e-4) side.normalize();
          head.addScaledVector(d, Math.min(L, 30 * dt)); head.addScaledVector(side, Math.cos(w * 9) * 5 * dt); head.y += Math.sin(w * 7) * 2.5 * dt;
          if (L < 1.3) {
            this.ball(to, tg ? 1.7 : 3, { dmg: tg ? 30 : 22, knock: 6, up: 6, color: blue, max: tg ? 1 : 99, dir: d.clone() });
            G.fx.spray(to, UP, '#cfeaff', 14, 6, 1.6, 0.5, 0.2, 0.4, 9); G.fx.ring(to, blue, 0.3, 2.4, 0.3); this.sound('splat');
            idx++; if (!tg || idx >= list.length) tail = 0.3;
          }
        }
      }
      path.unshift(head.clone()); if (path.length > 30) path.pop();
      orbs.forEach((o, i) => o.p.copy(path[Math.min(path.length - 1, i * 2)]));
      if (Math.random() < 0.7) G.fx.glow.emit(head.x + rnd(0.4), head.y + rnd(0.4), head.z + rnd(0.4), 0, -1, 0, blue, 0.4, 0.3, 0.05, 2, 0);
    }, null, () => { for (const o of orbs) o.life = 0; });
  },
  // a giant wolf of lightning charges 45 m along the street, through everything
  ginroUlt() {
    const p = G.player, col = G.colliders, a = this.aim(60); this.faceAim(0.8); p.play('cast', 0.8); G.ui.flash('STORM WOLF', 1.3); G.env.flash = Math.max(G.env.flash || 0, 0.6);
    const dir = V().subVectors(a.point, p.pos).setY(0); if (dir.lengthSq() < 0.01) dir.set(Math.sin(p.yaw), 0, Math.cos(p.yaw)); dir.normalize();
    const rig = this.wolf3(5.5), pos = V().copy(p.pos).addScaledVector(dir, 2.5), done = new Set(), yaw = Math.atan2(dir.x, dir.z); G.scene.add(rig.root);
    this.run(1.2, (k, dt, r) => {
      const prev = pos.clone(), step = 38 * dt;
      if (col.raycast(pos.x, pos.y + 1.6, pos.z, dir.x, 0, dir.z, step + 2.5) < step + 2.5) { r.t = r.T; return; }   // a building stops it
      pos.addScaledVector(dir, step); pos.y = col.groundAt(pos.x, pos.z, pos.y + 2, 2.5, 0.3);
      rig.root.position.copy(pos); rig.root.rotation.y = yaw; animateDog(rig, dt, 'run', 7);
      this.strike({ kind: 'capsule', a: prev.setY(prev.y + 1.6), b: pos.clone().setY(pos.y + 1.6), r: 3.6 }, { dmg: 95, knock: 16, up: 7, stun: 2, kind: 'shock', color: SILVER, except: done, dir: dir.clone() });
      for (let i = 0; i < 2; i++) G.fx.bolt(V().set(pos.x + rnd(2), pos.y + 2 + Math.random() * 2, pos.z + rnd(2)), V().set(pos.x + rnd(7), pos.y, pos.z + rnd(7)), i ? '#ffffff' : SILVER, 0.06, 0.18, 1);
      G.fx.glow.emit(pos.x + rnd(2), pos.y + 1 + Math.random() * 3, pos.z + rnd(2), 0, 1, 0, '#9fbcff', 0.5, 0.4, 0.05, 0, 0);
      if (Math.random() < dt * 8) G.damage.impact(V().copy(pos), UP.clone(), 1.5, 'shock', { byHero: true, quiet: true });
    }, () => {
      const c = V().set(pos.x, pos.y + 1.5, pos.z); this.ball(c, 7, { dmg: 30, knock: 14, up: 6, kind: 'shock', color: SILVER, except: done });
      G.fx.blast(c, '#dfe9ff', 1, 7, 0.5); G.fx.ring(c, SILVER, 1, 12, 0.6); G.damage.burst(c, 7, 4, 'shock', { byHero: true }); G.fx.shake(0.8); this.sound('boom');
    }, () => rig.root.removeFromParent());
  },

  // ---- ORBIT ------------------------------------------------------------------------------------------
  orbitLight() {
    const p = G.player, a = this.aim(70), n = this.combo++, h = n % 2 ? this.handL() : this.hand(), big = n % 3 === 2;
    this.comboT = 1.2; this.faceAim(0.3); p.play('castR', 0.16); this.sound('swish'); G.fx.blast(h, GRAV, 0.05, 0.3, 0.1);
    this.shoot({ from: h, dir: this.dirFrom(h, a), speed: 58, r: big ? 0.3 : 0.17, color: '#aab2ff', dmg: big ? 21 : 13, knock: big ? 9 : 4, life: 1.3, power: big ? 1.4 : 0.6, blast: big ? 1.6 : 0, trail: GRAV });
  },
  // Crush: the enemy you aim at is lifted and slammed into the street (a drone is pulled down out of the air)
  orbitHeavy() {
    const p = G.player, a = this.aim(32), tg = a.target && a.target.alive ? a.target : this.airTarget(32, 0.8);
    this.faceAim(0.5); p.play('raise', 0.35);
    if (!tg) {   // nothing to grab: the street where you aim is slammed
      const at = a.point.clone(); G.fx.ring(at, GRAV, 3.5, 0.4, 0.3);
      this.later(0.25, () => { p.play('slam', 0.3); this.ball(at, 3, { dmg: 22, knock: 8, up: 5, color: GRAV }); G.damage.impact(at.clone(), UP.clone(), 2.5, 'blunt', { byHero: true }); G.fx.dust(at, 12, 1.5); G.fx.shake(0.2); this.sound('boom'); });
      return;
    }
    G.fx.ring(G.combat.centre(tg, V()), GRAV, 2.4, 0.3, 0.3);
    if (!tg.big && tg.vel) { if (tg.flying) tg.stun = Math.max(tg.stun || 0, 1.2); else tg.hit(0, V().set(0, 0, 1), { up: 10, stun: 1.2, byHero: true }); }
    this.later(0.34, () => {
      if (!tg.alive) return; p.play('slam', 0.3);
      if (!tg.big && tg.vel) { if (tg.flying) { const top = tg.pos.clone(); tg.pos.y = G.colliders.groundAt(tg.pos.x, tg.pos.z, tg.pos.y, 0.5, 0.3) + 0.7; G.fx.beam(top, tg.pos.clone(), GRAV, 0.12, 0.3); } else tg.vy = -40; }
      const c = V().set(tg.pos.x, tg.pos.y + 0.4, tg.pos.z);
      tg.hit(40 * this.dmgMul, V().set(Math.sin(p.yaw), 0, Math.cos(p.yaw)), { stun: 1.2, byHero: true }); G.combat.lastHit = tg; G.combat.lastHitT = 4; this.charge(14);
      this.ball(c, 3.2, { dmg: 15, knock: 9, up: 4, color: GRAV, except: new Set([tg]) }); G.damage.impact(V().set(c.x, c.y - 0.4, c.z), UP.clone(), 2.5, 'blunt', { byHero: true });
      G.fx.ring(c, GRAV, 0.4, 4.5, 0.35); G.fx.dust(c, 14, 1.6); G.fx.shake(0.35); this.sound('boom');
    });
  },
  // Zero-g: everyone within 7 m of the crosshair floats, helpless, for 4 s, then drops.
  // (Their hit spheres are raised with them, so what you see is what you can hit.)
  orbitP1() {
    const p = G.player, a = this.aim(42), at = a.point.clone(); this.faceAim(0.4); p.play('raise', 0.5); G.ui.flash('ZERO-G', 0.8);
    const list = [...G.combat.targets].filter((x) => x.alive && !x.big && x.vel && x.stun !== undefined && Math.hypot(x.pos.x - at.x, x.pos.z - at.z) < 7.5 && Math.abs(x.pos.y - at.y) < 14);
    for (const x of list) x.h0 = x.h0 ?? x.h;
    G.fx.ring(at, GRAV, 0.5, 7.5, 0.5); for (let i = 1; i < 4; i++) this.later(i * 0.15, () => G.fx.ring(V().set(at.x, at.y + i * 1.1, at.z), GRAV, 7.5, 6.5, 0.6));
    const drop = () => { for (const x of list) { x.h = x.h0; } };
    this.run(4, (k, dt, r) => {
      for (const x of list) {
        if (!x.alive) continue; x.stun = Math.max(x.stun, 0.3); x.vel.multiplyScalar(Math.exp(-3 * dt));
        if (!x.flying) { x.air = damp(x.air, 3.2 + Math.sin(r.t * 2 + x.strafe * 2) * 0.3, 2.5, dt); x.vy = 0.37; x.h = x.h0 + x.air; }
        if (Math.random() < dt * 5) G.fx.glow.emit(x.pos.x + rnd(0.8), x.pos.y + 0.2, x.pos.z + rnd(0.8), 0, 2.2, 0, GRAV, 0.7, 0.14, 0.02, 0, 0);
      }
    }, () => {
      for (const x of list) if (x.alive) { if (!x.flying) x.vy = -16; x.hit(16 * this.dmgMul, V().set(0, 0, 1), { stun: 0.8, byHero: true }); this.charge(5); }
      G.fx.ring(at, GRAV, 7.5, 0.5, 0.4); this.sound('boom');
    }, drop);
  },
  // Hurl: five rocks come up out of the street beside her, then fly at the crosshair one after another
  orbitP2() {
    const p = G.player; this.faceAim(1.1); p.play('raise', 0.45); G.fx.dust(p.pos, 14, 2); G.damage.impact(V().copy(p.pos), UP.clone(), 1.5, 'blunt', { byHero: true, quiet: true });
    const rock = std('#6e6a78', 0.95, 0), rocks = [0, 1, 2, 3, 4].map(() => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26 + Math.random() * 0.14, 0), rock); m.castShadow = true; G.scene.add(m); return m; }), prs = [];
    this.run(3.2, (k, dt, r) => {
      let live = false;
      rocks.forEach((m, i) => {
        const pr = prs[i];
        if (pr) { if (this.proj.includes(pr)) { m.position.copy(pr.pos); m.rotation.x += dt * 9; m.rotation.z += dt * 5; live = true; } else m.visible = false; return; }
        live = true;
        const u = clamp(r.t / 0.4, 0, 1), sx = Math.cos(p.yaw), sz = -Math.sin(p.yaw), e = 1 - (1 - u) * (1 - u);
        m.position.set(p.pos.x + sx * (i - 2) * 0.75, p.pos.y - 0.3 + (2.6 - Math.abs(i - 2) * 0.3) * e + Math.sin(r.t * 5 + i) * 0.06, p.pos.z + sz * (i - 2) * 0.75); m.rotation.y += dt * 2;
        if (r.t >= 0.45 + i * 0.11) {
          const from = m.position.clone(); this.faceAim(0.3); p.play('castR', 0.14); this.sound('swish');
          prs[i] = this.shoot({ from, dir: this.dirFrom(from, this.aim(80)), speed: 52, r: 0.32, color: '#5a5f8a', dmg: 20, knock: 8, up: 2, blast: 2.2, power: 1.6, life: 2, trail: GRAV }); prs[i].orb.hidden = true;
        }
      });
      if (!live) r.t = r.T;
    }, null, () => { for (const m of rocks) m.removeFromParent(); });
  },
  orbitP3() { this.repel = 6; this.shield = 6; this.repelT = 0; G.ui.flash('REPEL FIELD', 0.9); G.player.play('raise', 0.4); G.fx.ring(this.centre(V()), GRAV, 0.5, 6, 0.5); },
  // Singularity: a black hole over the spot you aim at. For 5 s it drags in every villain within 18 m and
  // grinds the ones at its edge, swallows shots, then collapses in a blast.
  orbitUlt() {
    const p = G.player, a = this.aim(48), at = a.point.clone(); at.y = Math.max(at.y, G.colliders.groundAt(at.x, at.z, at.y + 1, 2, 0.3)) + 2.4;
    this.faceAim(0.8); p.play('raise', 0.9); G.ui.flash('SINGULARITY', 1.4);
    const g = new THREE.Group(); g.position.copy(at);
    const core = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: '#040308' }));
    const d1 = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.09, 6, 48), glowMat('#9aa6ff', 0.9)), d2 = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.04, 6, 48), glowMat('#e0c8ff', 0.7)); d1.rotation.x = d2.rotation.x = 1.25;
    g.add(core, d1, d2); g.scale.setScalar(0.05); G.scene.add(g);
    let tick = 0;
    this.run(5, (k, dt, r) => {
      g.scale.setScalar(Math.min(1, r.t / 0.4) * (1 + Math.sin(r.t * 9) * 0.05)); d1.rotation.z += dt * 5; d2.rotation.z -= dt * 3;
      for (let i = 0; i < 3; i++) { const an = Math.random() * 6.283, el = rnd(1.6), R = 6 + Math.random() * 8, q = V().set(at.x + Math.cos(an) * Math.cos(el) * R, at.y + Math.sin(el) * R, at.z + Math.sin(an) * Math.cos(el) * R); G.fx.glow.emit(q.x, q.y, q.z, (at.x - q.x) * 1.6, (at.y - q.y) * 1.6, (at.z - q.z) * 1.6, Math.random() < 0.5 ? GRAV : '#e0c8ff', 0.6, 0.16, 0.03, 0, 0); }   // dust and light falling in
      tick -= dt; if (tick > 0) return; tick = 0.25;
      for (const x of G.combat.targets) {
        if (!x.alive) continue; const d = V().subVectors(at, G.combat.centre(x, V())), L = d.length(); if (L > 18) continue;
        d.setY(0); const hl = d.length() || 1; d.divideScalar(hl);
        x.hit(L < 5 ? 4 * this.dmgMul : 0, d, { knock: x.big ? 0 : Math.min(9, 2 + hl * 0.8), pull: true, stun: x.big ? 0 : 0.5, kind: 'shock', byHero: true });
        if (L < 5) { this.charge(3); G.combat.lastHit = x; G.combat.lastHitT = 4; }
        if (x.flying && !x.big) x.pos.y = damp(x.pos.y, at.y, 2, 0.25);
      }
      if (G.villains) G.villains.eraseNear(at, 7, 0.3);
      G.fx.ring(at, GRAV, 9, 1, 0.3);
    }, () => {
      this.ball(at, 9.5, { dmg: 70, knock: 18, up: 9, kind: 'shock', color: '#aab2ff', from: at }); G.damage.burst(at, 8, 5, 'energy', { byHero: true });
      G.fx.blast(at, '#ffffff', 0.5, 9, 0.5); G.fx.ring(at, GRAV, 0.5, 16, 0.6); G.fx.ring(at, '#ffffff', 0.5, 10, 0.4, V().set(0, 0, 1)); G.fx.shake(1); this.sound('boom'); G.env.flash = Math.max(G.env.flash || 0, 0.5);
    }, () => g.removeFromParent());
  },

  // ---- LAPSE ------------------------------------------------------------------------------------------
  lapseLight() { this.combo3({ anims: ['slash', 'slash2', 'slash'], dmg: [14, 14, 21], knock: [3, 3, 8], range: 3.1, deg: 70, kind: 'cut', color: TIME, arc: true, wall: 0.7 }); },
  lapseHeavy() {
    const p = G.player, a = this.aim(70), h = this.hand(); this.faceAim(0.4); p.play('castR', 0.3);
    this.shoot({ from: h, dir: this.dirFrom(h, a), speed: 46, r: 0.3, color: '#b8ffd9', dmg: 24, knock: 2, stun: 2.2, kind: 'shock', life: 1.6, trail: TIME, onHit: (q) => { G.fx.ring(q, TIME, 1.8, 0.2, 0.5); G.fx.ring(q, '#ffffff', 0.2, 1.5, 0.3); } });
  },
  // Rewind: back to where she stood 4 s ago, with the health she had then (never less than now)
  lapseP1() {
    const p = G.player, hist = this.hist || []; if (hist.length < 6) { G.ui.toast('Nothing to rewind to yet.', 'info'); return false; }
    const old = hist[0]; if (this.mv) this.endMove();
    for (let i = hist.length - 1; i > 0; i -= 2) { const b = hist[Math.max(0, i - 2)].p; G.fx.beam(hist[i].p.clone().setY(hist[i].p.y + 1), b.clone().setY(b.y + 1), TIME, 0.05, 0.6); }   // the way back, as a fading line
    G.fx.ring(this.centre(V()), TIME, 2.5, 0.2, 0.35); p.pos.copy(old.p); p.vel.set(0, 0, 0);
    const got = Math.max(0, Math.min(this.max, old.hp) - this.hp); this.hp += got; this.dodge = Math.max(this.dodge, 0.6); this.hist = [];
    G.fx.ring(this.centre(V()), TIME, 0.2, 2.5, 0.4); G.fx.spark(this.centre(V()), '#b8ffd9', 16, 4, 0.5, 0.12, 0); G.ui.flash('REWIND', 0.7);
    if (got > 1) G.ui.toast(`Rewind: ${Math.round(got)} health back.`, 'good');
  },
  // Stasis: a bubble at the crosshair; villains inside cannot move and shots inside vanish
  lapseP2() {
    const p = G.player, a = this.aim(38), at = a.point.clone(), R = 6; this.faceAim(0.4); p.play('cast', 0.4); G.ui.flash('STASIS', 0.8);
    const orb = G.fx.orb(TIME, 0.1); orb.p.copy(at); orb.c.multiplyScalar(0.14);
    if (G.villains) G.villains.eraseNear(at, R, 4.5);
    let tick = 0;
    this.run(4.5, (k, dt, r) => {
      orb.r0 = orb.r1 = R * Math.min(1, r.t / 0.2) * Math.min(1, (r.T - r.t) / 0.3);
      tick -= dt; if (tick > 0) return; tick = 0.2;
      for (const x of G.combat.targets) if (x.alive && !x.big && x.vel && x.stun !== undefined && G.combat.centre(x, V()).distanceTo(at) < R + 0.5) { x.stun = Math.max(x.stun, 0.45); x.vel.multiplyScalar(0.2); }
      G.fx.ring(V().set(at.x, at.y + 0.15, at.z), TIME, R, R, 0.3);
    }, null, () => { orb.life = 0; });
  },
  lapseP3() { this.haste = 6; this.applyStats(); G.ui.flash('HASTE', 0.9); G.fx.ring(this.centre(V()), TIME, 0.4, 4, 0.4); G.fx.ring(this.centre(V()), '#ffffff', 0.3, 2.5, 0.3); },
  // Time stop: for 5 s every villain and every shot of theirs all but stands still. Blows still land, and
  // the knockback is paid out when time starts again.
  lapseUlt() {
    const p = G.player, c = this.centre(V()).clone(); this.timeK = 0.03; G.ui.flash('TIME STOP', 1.5); p.play('raise', 0.6);
    G.fx.ring(c, '#ffffff', 0.5, 40, 0.8); G.fx.ring(c, TIME, 0.5, 26, 0.7); G.env.flash = Math.max(G.env.flash || 0, 0.4);
    let tick = 0, n = 0;
    this.run(5, (k, dt) => {
      this.timeK = 0.03; tick -= dt; if (tick > 0) return; tick = 0.5; n++;
      if (G.audio) G.audio.blip(n % 2 ? 1400 : 1000, 0.05);                                // tick, tock
      for (const x of G.combat.targets) if (x.alive) G.fx.ring(G.combat.centre(x, V()), TIME, 1.3, 1.3, 0.5, V().set(0, 0, 1));
    }, () => { this.timeK = 1; G.ui.flash('TIME RESUMES', 0.8); G.fx.ring(this.centre(V()), TIME, 30, 0.5, 0.5); }, () => { this.timeK = 1; });
  },

  // ---- PRISM ------------------------------------------------------------------------------------------
  // Riding the light (Space in the air): a board on a rail of hard light that is laid down as she goes.
  // It always runs on, where the camera looks: W faster, S slower, Shift fastest, A / D bend it, Space
  // climbs, C dives; coming down onto the street lands. Villains in the way are knocked aside.
  slideStep(dt, inp, col) {
    const p = G.player, mv = this.mv;
    const mz = (inp.down('KeyW') ? 1 : 0) - (inp.down('KeyS') ? 1 : 0), mx = (inp.down('KeyD') ? 1 : 0) - (inp.down('KeyA') ? 1 : 0), up = (inp.down('Space') ? 1 : 0) - (inp.down('KeyC') ? 1 : 0), fast = inp.down('ShiftLeft') || inp.down('ShiftRight');
    mv.v = damp(mv.v, mz < 0 ? 9 : fast ? 40 : mz > 0 ? 27 : 18, 1.6, dt);
    const h0 = mv.head; mv.head = dampAngle(mv.head, p.camYaw - mx * 0.6, 3.2, dt);
    mv.pitch = damp(mv.pitch, clamp(-p.camPitch * 0.9 + up * 0.5, -0.75, 0.75), 3, dt);
    if (p.pos.y > 600) mv.pitch = Math.min(mv.pitch, 0);
    const ce = Math.cos(mv.pitch), d = V().set(Math.sin(mv.head) * ce, Math.sin(mv.pitch), Math.cos(mv.head) * ce);
    p.vel.copy(d).multiplyScalar(mv.v);
    const n = Math.max(1, Math.ceil((mv.v * dt) / 0.5)), h = dt / n, before = p.pos.clone(); let ground = false;
    for (let i = 0; i < n; i++) { p.pos.addScaledVector(p.vel, h); if (this.collide(col)) { ground = true; break; } }
    if (ground && mv.t > 0.25 && (inp.down('KeyC') || mv.pitch < -0.2)) { this.endMove(false); p.grounded = true; p.vel.multiplyScalar(0.3); p.vel.y = 0; p.play('land', 0.2); G.fx.ring(V().set(p.pos.x, p.pos.y + 0.1, p.pos.z), '#ffffff', 0.3, 2.5, 0.3); return; }
    if (ground) { mv.pitch = Math.max(mv.pitch, 0.1); p.pos.y += 0.06; }                      // skimming the street
    if (before.distanceTo(p.pos) < mv.v * dt * 0.3 && mv.t > 0.2) { this.endMove(); p.vel.set(-d.x * 5, 5, -d.z * 5); p.fling = true; p.play('spin', 0.3); G.fx.spark(this.centre(V()), '#ffffff', 12, 5, 0.3, 0.1); return; }   // into a wall: thrown off
    p.yaw = mv.head; p.anim = 'board';
    p.tiltT = { x: clamp(mv.pitch * -0.35, -0.3, 0.3), z: clamp(-(angDelta(h0, mv.head) / Math.max(dt, 1e-3)) * 0.22, -0.35, 0.35) };
    // the rail: a piece every 1.5 m, each a step further round the colours, fading over a second
    const q = V().set(p.pos.x, p.pos.y - 0.08, p.pos.z); mv.last = mv.last || before.clone().setY(before.y - 0.08);
    if (q.distanceTo(mv.last) > 1.5) { mv.hue = (mv.hue || 0) + 0.04; G.fx.beam(mv.last.clone(), q.clone(), rainbow(mv.hue), 0.24, 1.0); G.fx.beam(mv.last.clone(), q.clone(), '#ffffff', 0.07, 1.0); mv.last.copy(q); }
    if (Math.random() < dt * 22) G.fx.glow.emit(q.x + rnd(0.3), q.y, q.z + rnd(0.3), rnd(), -0.6, rnd(), rainbow(Math.random()), 0.5, 0.12, 0.02, 2, 0);
    mv.doneT -= dt; if (mv.doneT <= 0) { mv.doneT = 0.6; mv.done.clear(); }
    this.strike({ kind: 'capsule', a: before.setY(before.y + 0.8), b: p.pos.clone().setY(p.pos.y + 0.8), r: 1.1 }, { dmg: 12, knock: 10, up: 3, kind: 'cut', color: rainbow(mv.hue || 0), except: mv.done, civ: false, dir: V().set(d.x, 0, d.z).normalize() });
    if (G.audio && Math.random() < dt * 6) G.audio.tone(660 + Math.random() * 660, 0.12, 0.012, 'sine');
  },
  prismLight() {
    const p = G.player, hue = G.elapsed * 0.3;
    if (this.mv && this.mv.kind === 'slide') {   // riding: a shard of light at the crosshair
      const a = this.aim(80), h = this.combo++ % 2 ? this.handL() : this.hand(); this.comboT = 1.2; this.sound('swish');
      this.shoot({ from: h, dir: this.dirFrom(h, a), speed: 80, r: 0.13, color: rainbow(hue), dmg: 12, knock: 3, kind: 'cut', life: 1.1, power: 0.5, trail: rainbow(hue + 0.3) }); return;
    }
    this.combo3({ anims: ['slash', 'slash2', 'kick'], dmg: [13, 13, 19], knock: [3, 3, 8], range: 2.8, deg: 70, kind: 'cut', color: rainbow(hue), arc: true, wall: 0.6 });
  },
  // Refract: a beam to the crosshair; where it lands it splits into a ray of each colour to the five nearest
  prismHeavy() {
    const p = G.player, a = this.aim(70), g = this.g3 || {}, h = g.crystal ? g.crystal.getWorldPosition(V()) : this.hand(), to = a.point.clone(), d = V().subVectors(to, h).normalize();
    this.faceAim(0.4); p.play('castR', 0.3);
    G.fx.beam(h, to, rainbow(G.elapsed), 0.28, 0.2); G.fx.beam(h, to, '#ffffff', 0.1, 0.2);
    this.strike({ kind: 'capsule', a: h, b: to, r: 0.6 }, { dmg: 24, knock: 6, kind: 'energy', color: '#ffffff', dir: d });
    if (a.wall) G.damage.impact(to, G.damage.normalAt(to, d), 1.2, 'energy', { byHero: true, quiet: true });
    this.nearest(6, 11, to).filter((x) => x !== a.target).slice(0, 5).forEach((x, i) => this.later(0.06 + i * 0.03, () => {
      if (!x.alive) return; const q = G.combat.centre(x, V()).clone(), hex = rainbow(i / 5);
      G.fx.beam(to.clone(), q, hex, 0.1, 0.25); x.hit(15 * this.dmgMul, V().subVectors(q, to).setY(0).normalize(), { knock: 4, kind: 'energy', byHero: true }); G.fx.spark(q, hex, 8, 5, 0.3, 0.12); this.charge(5);
    }));
    G.fx.blast(to, '#ffffff', 0.2, 1.4, 0.2);
  },
  // Light cage: bars round the crosshair; everyone inside is held 4 s, and anyone at the bars is pushed back in
  prismP1() {
    const p = G.player, a = this.aim(40), at = a.point.clone(), R = 4.2, T = 4, bars = 14; at.y = G.colliders.groundAt(at.x, at.z, at.y + 1, 2, 0.3);
    this.faceAim(0.4); p.play('cast', 0.4); G.ui.flash('LIGHT CAGE', 0.8);
    for (let i = 0; i < bars; i++) { const an = (i / bars) * 6.283, b = V().set(at.x + Math.cos(an) * R, at.y, at.z + Math.sin(an) * R); G.fx.beam(b, b.clone().setY(at.y + 3.6), rainbow(i / bars), 0.09, T, false); }
    G.fx.ring(V().set(at.x, at.y + 3.6, at.z), '#ffffff', R, R, T); G.fx.ring(V().set(at.x, at.y + 0.1, at.z), '#ffffff', 0.5, R, 0.4);
    this.ball(V().set(at.x, at.y + 1, at.z), R, { dmg: 14, stun: T, knock: 0, kind: 'energy', color: '#ffffff', civ: false });
    let tick = 0;
    this.run(T, (k, dt) => {
      tick -= dt; if (tick > 0) return; tick = 0.3;
      for (const x of G.combat.targets) { if (!x.alive || x.big || !x.vel) continue; const dx = x.pos.x - at.x, dz = x.pos.z - at.z, d = Math.hypot(dx, dz); if (d > R - 0.8 && d < R + 1.5 && Math.abs(x.pos.y - at.y) < 4) x.hit(3 * this.dmgMul, V().set(-dx / d, 0, -dz / d), { knock: 7, stun: 0.4, kind: 'energy', byHero: true }); }
    });
  },
  prismP2() {
    const p = G.player; this.faceAim(0.4); p.play('cast', 0.35); G.ui.flash('DAZZLE', 0.7); G.env.flash = Math.max(G.env.flash || 0, 0.8);
    const c = this.chest(), f = this.fwd(V(), 0.3);
    this.cone(15, 38, { dmg: 14, stun: 3.2, knock: 3, kind: 'energy', color: '#ffffff', civ: false }, c, f);
    for (let i = 0; i < 9; i++) { const an = (i - 4) * 0.15, d = V().set(f.x * Math.cos(an) - f.z * Math.sin(an), f.y, f.x * Math.sin(an) + f.z * Math.cos(an)); G.fx.beam(c.clone(), c.clone().addScaledVector(d, 15), rainbow(i / 9), 0.14, 0.35); }
    G.fx.blast(c.clone().addScaledVector(f, 1), '#ffffff', 0.3, 3, 0.25);
  },
  prismP3() { this.block = 5; G.player.play('guard', 0.5); G.ui.flash('MIRROR', 0.8); for (let i = 0; i < 4; i++) G.fx.ring(this.centre(V()), rainbow(i / 4), 0.3, 1.6 + i * 0.5, 0.4); },
  // Spectrum: seven beams from the prism, one of each colour, at up to seven villains; then all of them at once
  prismUlt() {
    const p = G.player, list = this.nearest(7, 42), g = this.g3 || {}; this.faceAim(1.3); p.play('raise', 1.2); G.ui.flash('SPECTRUM', 1.3);
    const src = () => (g.crystal && g.crystal.parent ? g.crystal.getWorldPosition(V()) : this.chest());
    for (let i = 0; i < 7; i++) this.later(0.15 + i * 0.12, () => {
      const hex = rainbow(i / 7), tg = list.length ? list[i % list.length] : null, from = src();
      const to = tg && tg.alive ? G.combat.centre(tg, V()).clone() : this.aim(60).point.clone().add(V().set(rnd(5), 0, rnd(5)));
      G.fx.beam(from, to, hex, 0.3, 0.3); G.fx.beam(from, to, '#ffffff', 0.09, 0.3);
      this.ball(to, 2.2, { dmg: 32, knock: 6, up: 3, kind: 'energy', color: hex }); G.fx.blast(to, hex, 0.3, 2.4, 0.3); if (G.audio) G.audio.tone(520 + i * 90, 0.18, 0.05, 'triangle');
    });
    this.later(0.15 + 7 * 0.12 + 0.2, () => {
      const tg = list.find((x) => x.alive), to = tg ? G.combat.centre(tg, V()).clone() : this.aim(60).point.clone(), from = src();
      for (let i = 0; i < 7; i++) G.fx.beam(from.clone().add(V().set(Math.cos(i) * 0.4, Math.sin(i) * 0.4, 0)), to, rainbow(i / 7), 0.16, 0.45);
      G.fx.beam(from, to, '#ffffff', 0.5, 0.45); this.ball(to, 7, { dmg: 60, knock: 16, up: 7, kind: 'energy', color: '#ffffff', from: to }); G.damage.burst(to, 7, 4, 'energy', { byHero: true });
      G.fx.blast(to, '#ffffff', 0.5, 8, 0.5); G.fx.ring(to, '#ffffff', 0.5, 12, 0.5); G.fx.shake(0.8); this.sound('boom'); G.env.flash = Math.max(G.env.flash || 0, 0.7);
    });
  },
};
