// The resident you play: third/first-person controller, camera, energy.
import * as THREE from 'three';
import { std, neon } from '../world/materials.js';
import { G } from '../core/game.js';
import { makeHumanoid, animateRig, addCanopy } from './rigs.js';
import { clamp, damp, dampAngle, angDelta } from '../core/util.js';
import { waveHeight } from '../world/water.js';

export const DEFAULT_LOOK = { kind: 'human', skin: '#c68d6b', hair: '#16171c', hairStyle: 0, top: '#2c3e63', bottom: '#1c1f27', accent: '#59e0ff', height: 1.78, build: 1, coat: false,
  shape: 0.35, eye: '#3b2a1e', outfit: 'jacket', shirt: '#d7dbe2', sleeves: 'long', legs: 'trousers', hat: null, glasses: false, beard: false, streak: null };

export class Player {
  constructor(look) {
    this.pos = new THREE.Vector3(0, 0.15, 30);
    this.vel = new THREE.Vector3();
    this.yaw = Math.PI; this.camYaw = Math.PI; this.camPitch = 0.2; this.camDist = 4.4; this._cd = 4.4;
    this.firstPerson = false; this.grounded = true; this.crouch = false; this.board = false; this.boardMesh = null;
    this.state = 'walk';            // walk | sit | drive | ride | busy | climb (pulling up onto a ledge) | ladder
    this.climb = null; this.ladder = null;
    this.seat = null; this.energy = 78; this.speed = 0; this.anim = 'idle';
    this.emote = null;              // { anim, t } temporary animation override
    this.fallWarned = false; this.lowWarned = false; this.landed = 0; this.swim = false; this.jet = false; this.fuel = 100; this.thrust = false; this.jetMesh = null;
    this.look = { ...DEFAULT_LOOK, ...look };
    this.rig = null; this.buildRig();
  }
  buildRig() {
    const parent = this.rig ? this.rig.root.parent : G.scene;
    if (this.rig) this.rig.root.removeFromParent();
    this.rig = makeHumanoid(this.look); addCanopy(this.rig);
    (parent || G.scene).add(this.rig.root);
  }
  setLook(patch) { Object.assign(this.look, patch); this.buildRig(); }
  // the jet harness: a pack on the back with two nozzles that light when thrusting
  showJet() {
    if (!this.jetMesh) {
      const g = (this.jetMesh = new THREE.Group()), dark = std('#20262f', 0.35, 0.8), mk = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
      mk(new THREE.BoxGeometry(0.3, 0.4, 0.13), dark, 0, 0.32, -0.21); for (const sx of [-1, 1]) mk(new THREE.CylinderGeometry(0.05, 0.065, 0.3, 10), dark, sx * 0.2, 0.26, -0.21);
      this.flames = [-1, 1].map((sx) => { const f = mk(new THREE.ConeGeometry(0.07, 0.5, 10), neon('#9fe9ff', 2.2), sx * 0.2, -0.14, -0.21); f.rotation.x = Math.PI; return f; });
    }
    if (this.jetMesh.parent !== this.rig.chest) this.rig.chest.add(this.jetMesh);
    this.jetMesh.visible = this.jet && this.state === 'walk';
    for (const f of this.flames) { f.visible = this.thrust; f.scale.y = 0.7 + Math.random() * 0.7; }
  }
  get eyeY() { return (this.crouch ? 1.05 : this.state === 'sit' ? 1.18 : 1.6) * this.rig.scale; }
  play(anim, secs) { this.emote = { anim, t: secs }; }

  sit(seat) {
    this.state = 'sit'; this.board = false; this.seat = seat; seat.taken = 'player'; this.vel.set(0, 0, 0); this.crouch = false;
    this.pos.set(seat.x, seat.y - 0.5, seat.z); this.yaw = seat.yaw;
  }
  stand() {
    if (this.state !== 'sit') return;
    const s = this.seat; s.taken = null; this.seat = null; this.state = 'walk';
    const back = s.kind === 'stool' ? 0 : s.kind === 'chair' ? -0.9 : 0.7; // chairs: step back from the table // stools: step off sideways toward the lane
    if (s.lane) { this.pos.x = s.x; this.pos.z = s.z + Math.sign(s.lane.z - s.z) * 0.75; } else { this.pos.x = s.x + Math.sin(s.yaw) * back; this.pos.z = s.z + Math.cos(s.yaw) * back; }
    this.pos.y = G.colliders.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.6);
  }

  update(dt) {
    const inp = G.input, col = G.colliders;
    // look
    const sens = G.settings ? G.settings.sens : 1, inv = G.settings && G.settings.invertY ? -1 : 1;
    this.camYaw -= inp.mx * 0.0026 * sens; this.camPitch += inp.my * 0.0022 * sens * inv;
    if (inp.down('ArrowLeft')) this.camYaw += 1.9 * dt;
    if (inp.down('ArrowRight')) this.camYaw -= 1.9 * dt;
    if (inp.down('ArrowUp')) this.camPitch -= 1.2 * dt;
    if (inp.down('ArrowDown')) this.camPitch += 1.2 * dt;
    this.camPitch = clamp(this.camPitch, -1.25, 1.35);
    if (inp.pressed('KeyV') && this.state !== 'drive') this.firstPerson = !this.firstPerson;
    if (this.emote) { this.emote.t -= dt; if (this.emote.t <= 0) this.emote = null; }

    if (this.state === 'walk') this.walk(dt, inp, col);
    else if (this.state === 'climb') this.mantleStep(dt);
    else if (this.state === 'ladder') this.ladderStep(dt, inp);
    else if (this.state === 'sit') {
      this.anim = this.emote ? this.emote.anim : 'sit'; this.speed = 0;
      if (inp.pressed('Space') || inp.pressed('KeyW') || inp.pressed('KeyS')) this.stand();
    } else if (this.state === 'ride') { this.anim = 'sit'; this.speed = 0; }
    else if (this.state === 'hero') { if (G.heroes) G.heroes.move(dt, inp, col); else this.state = 'walk'; }    // Hero Mode: swinging, wall running, flight, dashes
    else if (this.state === 'busy') { this.anim = this.emote ? this.emote.anim : this.busyAnim || 'idle'; this.speed = 0; if (this.faceCam) this.yaw = this.camYaw; } // minigames hold you in place
    if (this.state !== 'drive') {
      this.rig.root.position.copy(this.pos); this.rig.root.rotation.y = this.yaw;
      const riding = this.board && this.state === 'walk';
      if (riding && !this.boardMesh) { // hoverboard: built the first time it is used
        const g = (this.boardMesh = new THREE.Group()), d = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 1.05), std('#20262f', 0.3, 0.8)), u = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.02, 0.9), neon('#59e0ff', 1.6));
        d.castShadow = true; u.position.y = -0.035; g.add(d, u); G.scene.add(g);
      }
      if (this.boardMesh) { this.boardMesh.visible = riding && !this.firstPerson; this.boardMesh.position.set(this.pos.x, this.pos.y + 0.14 + Math.sin(G.elapsed * 3) * 0.02, this.pos.z); this.boardMesh.rotation.y = this.yaw; }
      if (riding) this.rig.root.position.y += 0.19 + Math.sin(G.elapsed * 3) * 0.02;
      if (this.swim && !this.dive && this.state === 'walk') this.rig.root.position.y -= 1.12 - Math.sin(G.elapsed * 2) * 0.04 - (G.diving && G.diving.sea(this.pos.x, this.pos.z) ? waveHeight(this.pos.x, this.pos.z) : 0); // shoulders at the surface, riding the swell
      this.rig.root.rotation.x = this.dive ? clamp(Math.min(1.15, this.speed * 0.45) - this.vel.y * 0.18, -0.7, 1.35) : this.state === 'busy' && this.busyAnim === 'faint' ? -1.35 : 0; this.rig.root.rotation.order = 'YXZ';   // a diver tips head-down to sink, head-up to rise; a knocked-out hero lies flat
      this.rig.root.visible = !this.firstPerson && this.state !== 'ride';
      this.rig.canopy.visible = G.env.rain > 0.3 && G.env.indoor < 0.5 && this.state === 'walk';
      if (this.jet || this.jetMesh) this.showJet();
      animateRig(this.rig, dt, this.anim, this.turnStep > 0 && this.speed < 0.3 ? 0.9 : this.speed);
      this.updateCamera(dt);
      G.city.pokeDoors(this.pos.x, this.pos.y, this.pos.z);
    } else animateRig(this.rig, dt, 'drive', 0);
    // energy: slow baseline burn, faster when sprinting
    this.energy = clamp(this.energy - dt * (0.03 * G.env.timeScale + (this.anim === 'run' ? 0.22 : this.anim === 'jog' ? 0.03 : 0)), 0, 100);
    if (this.energy < 15 && !this.lowWarned) { this.lowWarned = true; G.ui.toast('You are running on empty. Find something to eat.', 'warn'); }
    if (this.energy > 30) this.lowWarned = false;
  }

  walk(dt, inp, col) {
    const cy = this.camYaw, fx = Math.sin(cy), fz = Math.cos(cy), rx = -fz, rz = fx;
    let mx = (inp.down('KeyD') ? 1 : 0) - (inp.down('KeyA') ? 1 : 0), mz = (inp.down('KeyW') ? 1 : 0) - (inp.down('KeyS') ? 1 : 0);
    // a gamepad's left stick: any direction, and how far it is pushed sets the pace (a light tilt walks)
    const tilt = inp.blocked ? 0 : Math.min(1, Math.hypot(inp.padX || 0, inp.padY || 0));
    if (tilt > 0.05) { mx = inp.padX; mz = -inp.padY; }
    let wx = fx * mz + rx * mx, wz = fz * mz + rz * mx;
    const len = Math.hypot(wx, wz);
    if (len > 0) { wx /= len; wz /= len; }
    const swim = (this.swim = !!(G.districts && G.districts.waterAt(this.pos.x, this.pos.z, this.pos.y)));
    if (swim) { this.board = false; this.crouch = false; this.jet = false; }
    // diving: C in deep sea water goes under; while under, C sinks, Space rises, and nothing pulls you down
    const sea = swim && G.diving && G.diving.sea(this.pos.x, this.pos.z);
    if (!sea) this.dive = false;
    else if (!this.dive && inp.pressed('KeyC') && 0.02 - G.diving.bedAt(this.pos.x, this.pos.z) > 2.5) { this.dive = true; this.pos.y = -1.15; this.vel.y = -1.6; this.grounded = false; }
    if (this.dive) {
      const out = (this.breath ?? 30) <= 0;
      this.vel.y = damp(this.vel.y, out ? 3.2 : inp.down('KeyC') ? -2.6 : inp.down('Space') ? 2.8 : 0.35, 3, dt);
      if (this.pos.y >= -1.12 && this.vel.y > 0) { this.dive = false; this.pos.y = 0; this.vel.y = 0; }   // back at the surface
    }
    else if (inp.pressed('KeyC') && !this.jet && !(G.heroes && G.heroes.on)) { this.crouch = !this.crouch; this.board = false; }
    if (inp.pressed('KeyJ') && G.state.owns.jetpack && !swim) { this.jet = !this.jet; this.board = false; this.crouch = false; G.ui.toast(this.jet ? 'Jet harness armed: hold Space to climb, C to drop faster.' : 'Jet harness off.', 'info'); if (G.audio) G.audio.blip(this.jet ? 700 : 400, 0.06); }
    const aloft = this.jet && !this.grounded, tune = G.state.owns.boardTune ? 1.2 : 1;
    if (inp.pressed('KeyB') && G.state.owns.board) { this.board = !this.board; this.crouch = false; if (G.audio) G.audio.blip(this.board ? 620 : 420, 0.06); }
    const sprint = (inp.down('ShiftLeft') || inp.down('ShiftRight')) && this.energy > 6 && !this.crouch;
    const slow = inp.down('AltLeft');
    const max = (swim ? (this.dive && sprint ? 3.6 : 2.3) : aloft ? (sprint ? 20 : 12.5) : this.board ? (sprint ? 12 : 8.5) * tune : (this.crouch ? 1.6 : sprint ? 7.2 : slow ? 1.6 : 3.4) * (this.speedMul || 1)) * (tilt > 0.05 ? Math.min(1, Math.max(0.35, tilt * 1.15)) : 1);
    const k = aloft ? 2.2 : this.board ? (this.grounded ? 3.2 : 1.5) : this.grounded ? 11 : 2.5; // a board glides: slow to start, slow to stop
    const sp0 = Math.hypot(this.vel.x, this.vel.z);
    if (this.grounded && !this.board && !swim && !aloft) {
      // On foot there is momentum: quick to get going, slower to build a sprint, quick to stop. At speed the
      // direction swings round (a sprint makes a wider turn than a jog), and turning right round brakes first.
      let dx = sp0 > 0.3 ? this.vel.x / sp0 : wx, dz = sp0 > 0.3 ? this.vel.z / sp0 : wz, target = len > 0 ? max : 0;
      if (len > 0 && sp0 > 0.3) {
        const diff = angDelta(Math.atan2(dx, dz), Math.atan2(wx, wz));
        if (Math.abs(diff) > 2.2 && sp0 > 2.5) target = 0;                            // reversing: stop first
        else { const turn = clamp(diff, -(15 - sp0 * 1.3) * dt, (15 - sp0 * 1.3) * dt), a = Math.atan2(dx, dz) + turn; dx = Math.sin(a); dz = Math.cos(a); if (Math.abs(diff) > 0.9) target *= 0.85; }
      }
      const acc = target > sp0 ? (sp0 < 3.6 ? 17 : 8) : sp0 > 5 ? 15 : 22, sp = target > sp0 ? Math.min(target, sp0 + acc * dt) : Math.max(target, sp0 - acc * dt);
      this.vel.x = dx * sp; this.vel.z = dz * sp;
    } else { this.vel.x = damp(this.vel.x, wx * max, k, dt); this.vel.z = damp(this.vel.z, wz * max, k, dt); }
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    // lean into a start, rock back on a hard stop
    this.rig.accLean = damp(this.rig.accLean || 0, this.grounded && !this.board ? clamp(((this.speed - sp0) / Math.max(dt, 1e-3)) * 0.012, -0.2, 0.18) : 0, 7, dt);
    const yaw0 = this.yaw;
    if (this.aimT > 0) { this.aimT -= dt; this.yaw = dampAngle(this.yaw, this.camYaw, 22, dt); }      // a hero attacking faces where the camera looks
    else if (this.firstPerson) this.yaw = cy;
    else if (this.speed > 0.6 && !this.board && this.grounded) this.yaw = dampAngle(this.yaw, Math.atan2(this.vel.x, this.vel.z), 11, dt);   // face the way you are going
    else if (len > 0) this.yaw = dampAngle(this.yaw, Math.atan2(wx, wz), 12, dt);
    // lean into turns when moving fast
    this.rig.bank = damp(this.rig.bank, this.grounded && this.speed > 4 && !this.firstPerson ? clamp(Math.atan2(Math.sin(this.yaw - yaw0), Math.cos(this.yaw - yaw0)) / Math.max(dt, 1e-3) * -0.035, -0.22, 0.22) : 0, 8, dt);
    // climbing: Space in front of a ledge pulls you up onto it (or over a low wall); jumping at a ledge you can reach grabs it
    if (!swim && !this.board && !(this.jet && !this.grounded)) {
      if (inp.pressed('Space') && this.tryMantle(col)) return;
      if (!this.grounded && mz > 0 && this.vel.y < 1.5 && this.tryMantle(col, true)) return;
    }
    if (inp.pressed('Space') && this.grounded && !swim) { this.vel.y = this.board ? 8.8 : this.jumpV || 7.4; this.grounded = false; this.crouch = false; }
    // jet harness: Space climbs while there is charge, C drops, otherwise it settles gently; it recharges on the ground
    this.thrust = false;
    if (this.jet) {
      if (inp.down('Space') && this.fuel > 0 && !this.grounded) { this.thrust = true; this.vel.y = damp(this.vel.y, this.pos.y > 1100 ? 0 : 9.5, 3.5, dt); this.fuel = Math.max(0, this.fuel - dt * 3); }
      else if (!this.grounded) this.vel.y = damp(this.vel.y, inp.down('KeyC') ? -12 : -2.6, 2.4, dt);
    }
    if (this.grounded || !this.jet) this.fuel = Math.min(100, this.fuel + dt * 14);
    // Move in short sub-steps, so a fast board or a long frame can never carry you through a thin wall or deck.
    const n = Math.min(8, Math.max(1, Math.ceil(Math.max(this.speed * dt / 0.2, Math.abs(this.vel.y) * dt / 0.3)))), h = dt / n;
    for (let i = 0; i < n; i++) this.move(h, col);
    if (this.pos.y < -20) { this.pos.set(0, 0.15, 30); this.vel.set(0, 0, 0); }

    const sp = this.speed;
    // turning on the spot (first person, or swinging round from a standstill): a few small steps
    const turn = Math.abs(angDelta(yaw0, this.yaw)) / Math.max(dt, 1e-3);
    this.turnStep = sp <= 0.25 && this.grounded && !swim && !this.board && !this.crouch && turn > 1.4 ? 0.25 : Math.max(0, (this.turnStep || 0) - dt);
    this.anim = this.emote ? this.emote.anim : swim ? 'swim' : this.board ? 'board' : !this.grounded ? 'air' : this.crouch ? (sp > 0.3 ? 'crouchwalk' : 'crouch') : sp > 5 ? 'run' : sp > 2.2 ? 'jog' : sp > 0.25 || this.turnStep > 0 ? 'walk' : 'idle';
    // where each foot would rest, when standing (stairs, kerbs, the hill)
    if (this.anim === 'idle' && this.grounded) {
      const s = this.rig.scale || 1, w = 0.092 * s, cx = Math.cos(this.yaw), sx = -Math.sin(this.yaw), fx = Math.sin(this.yaw) * 0.04, fz = Math.cos(this.yaw) * 0.04, y = this.pos.y;
      const gl = col.groundAt(this.pos.x + cx * w + fx, this.pos.z + sx * w + fz, y + 0.35, 0.6, 0.05), gr = col.groundAt(this.pos.x - cx * w + fx, this.pos.z - sx * w + fz, y + 0.35, 0.6, 0.05);
      const drop = clamp(y - Math.min(gl, gr), 0, 0.38), base = y - drop;
      this.rig.feet = { drop, l: clamp(gl - base, 0, 0.42), r: clamp(gr - base, 0, 0.42) };
    } else this.rig.feet = null;
  }
  // ---- climbing ------------------------------------------------------------------------------
  // A ledge in front of you between knee and arm's reach: pull up onto it if there is room to stand,
  // or vault over it if it is a low wall with open ground behind. Returns true if a climb started.
  tryMantle(col, auto = false) {
    if (this.crouch || this.state !== 'walk') return false;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), y = this.pos.y, reach = y + (this.grounded ? 2.35 : 2.1), low = y + (this.grounded ? 0.95 : 0.4), q = this._q || (this._q = { x: 0, z: 0 });
    for (const d of [0.5, 0.75]) {
      const ax = this.pos.x + fx * d, az = this.pos.z + fz * d, top = col.groundAt(ax, az, reach, 0, 0.2);
      if (top < low || top > reach) continue;
      if (col.ceilingAt(this.pos.x, this.pos.z, y + 1.0, 0.26) < top + 1.0) return false;            // no room to reach up
      // standing room on top?
      const lx = this.pos.x + fx * (d + 0.45), lz = this.pos.z + fz * (d + 0.45);
      q.x = lx; q.z = lz;
      if (col.groundAt(lx, lz, top + 0.05, 0, 0.26) >= top - 0.05 && col.ceilingAt(lx, lz, top + 0.3, 0.26) > top + 1.8 && !col.resolveCircle(q, 0.3, top + 0.3, top + 1.7)) {
        this.startClimb(lx, top, lz, top - y > 1.5 ? 0.55 : 0.4, false); return true;
      }
      // a thin wall: vault it if it is low and the far side is clear (you land wherever the ground is)
      if (auto || top - y > 1.45) return false;
      const vx = this.pos.x + fx * (d + 1.0), vz = this.pos.z + fz * (d + 1.0); q.x = vx; q.z = vz;
      if (col.ceilingAt(vx, vz, top + 0.3, 0.26) > top + 1.8 && !col.resolveCircle(q, 0.3, top + 0.2, top + 1.7)) { this.startClimb(vx, top + 0.1, vz, 0.42, true); return true; }
      return false;
    }
    return false;
  }
  startClimb(x, y, z, T, vault) {
    this.climb = { t: 0, T, vault, x0: this.pos.x, y0: this.pos.y, z0: this.pos.z, x, y, z };
    this.state = 'climb'; this.vel.set(0, 0, 0); this.board = false; this.crouch = false; this.grounded = false;
    if (G.audio) G.audio.blip(vault ? 330 : 260, 0.05);
  }
  mantleStep(dt) {
    const c = this.climb; c.t += dt; const u = Math.min(1, c.t / c.T), up = Math.min(1, u / 0.6), across = Math.max(0, (u - 0.45) / 0.55);
    const e = 1 - (1 - up) * (1 - up);                       // ease out: a quick pull, then a roll over the edge
    this.pos.y = c.y0 + (c.y - c.y0) * e + (c.vault ? Math.sin(Math.PI * across) * 0.15 : 0);
    this.pos.x = c.x0 + (c.x - c.x0) * (u < 0.45 ? u * 0.25 : 0.11 + across * 0.89); this.pos.z = c.z0 + (c.z - c.z0) * (u < 0.45 ? u * 0.25 : 0.11 + across * 0.89);
    this.anim = u < 0.6 ? 'mantle' : 'land'; this.speed = 0;
    if (u >= 1) {
      this.climb = null; this.state = 'walk';
      const g = G.colliders.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.3, 0.5, 0.26);
      this.grounded = this.pos.y - g < 0.2; if (this.grounded) this.pos.y = g;
      if (c.vault) { this.vel.x = Math.sin(this.yaw) * 2.6; this.vel.z = Math.cos(this.yaw) * 2.6; }
      if (G.climbing) G.climbing.count();
    }
  }
  // Ladders (G.climbing keeps the list): W/S climb, Space lets go, and you step off at either end.
  grabLadder(L, fromTop) {
    this.ladder = L; this.state = 'ladder'; this.board = false; this.crouch = false; this.jet = false; this.vel.set(0, 0, 0); this.yaw = L.yaw; this.firstPerson = false;
    this.pos.set(L.x - Math.sin(L.yaw) * 0.42, fromTop ? L.y1 - 1.6 : L.y0 + 0.1, L.z - Math.cos(L.yaw) * 0.42); this.rig.climbPh = 0;
  }
  ladderStep(dt, inp) {
    const L = this.ladder, mz = (inp.down('KeyW') ? 1 : 0) - (inp.down('KeyS') ? 1 : 0), v = mz * ((inp.down('ShiftLeft') || inp.down('ShiftRight')) ? 3.4 : 2.3);
    this.pos.y += v * dt; this.rig.climbPh = (this.rig.climbPh || 0) + v * dt * 2.4; this.yaw = L.yaw; this.speed = 0; this.anim = 'climb';
    const fx = Math.sin(L.yaw), fz = Math.cos(L.yaw);
    if (this.pos.y >= L.y1 - 1.0) { this.ladder = null; this.state = 'walk'; this.climb = null; this.startClimb(L.x + fx * 0.55, L.y1, L.z + fz * 0.55, 0.45, false); return; }   // over the top
    if (this.pos.y <= L.y0 && mz < 0) { this.pos.y = L.y0; this.ladder = null; this.state = 'walk'; this.grounded = true; return; }
    if (inp.pressed('Space')) { this.ladder = null; this.state = 'walk'; this.grounded = false; this.vel.set(-fx * 3.2, 3.5, -fz * 3.2); this.yaw += Math.PI; }
  }
  move(dt, col) {
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    col.resolveCircle(this.pos, 0.34, this.pos.y + 0.55, this.pos.y + (this.crouch ? 1.1 : 1.75));
    if (G.traffic) G.traffic.pushOut(this.pos, 0.34);
    if (G.car && !G.car.occupied) G.car.pushOut(this.pos, 0.34);
    const g = col.groundAt(this.pos.x, this.pos.z, this.pos.y, 0.5, 0.26, this.dive ? G.diving.bedAt(this.pos.x, this.pos.z) : undefined);   // a diver's floor is the seabed
    if (!(this.jet && !this.grounded) && !this.dive) this.vel.y -= 22 * (this.gravK || 1) * dt;     // the harness carries your weight while you are off the ground; water carries a diver
    // personal fall-dampener: nobody in 2226 dies from stepping off a ledge
    if (this.vel.y < -19 && this.pos.y - g < 14) {
      this.vel.y = damp(this.vel.y, -4, 7, dt);
      if (!this.fallWarned) { this.fallWarned = true; G.ui.toast('Fall-dampener engaged.', 'info'); }
    }
    this.pos.y += this.vel.y * dt;
    if (this.pos.y <= g) {
      if (!this.grounded) { this.landed = -this.vel.y; if (this.landed > 6.5 && !this.board) this.play('land', 0.16); } // how hard we came down
      this.pos.y = this.vel.y < -1 || g - this.pos.y < 0.02 ? g : damp(this.pos.y, g, 26, dt);
      this.vel.y = 0; this.grounded = true; this.fallWarned = false;
    } else if (this.grounded && this.pos.y - g < 0.55 && this.vel.y <= 0) { this.pos.y = damp(this.pos.y, g, 22, dt); this.vel.y = 0; }
    else this.grounded = false;
    const c = col.ceilingAt(this.pos.x, this.pos.z, this.pos.y + 1.0, 0.26);
    if (this.pos.y + 1.8 > c) { this.pos.y = Math.max(g, c - 1.8); this.vel.y = Math.min(this.vel.y, 0); }
  }

  updateCamera(dt) {
    const cam = G.camera, cy = this.camYaw, p = this.camPitch, cp = Math.cos(p), sp = Math.sin(p);
    const fx = Math.sin(cy), fz = Math.cos(cy);
    cam.up.set(0, 1, 0);
    // the camera follows a point that trails you a little (softer on stairs, starts and landings)
    const ct = this.camT || (this.camT = this.pos.clone());
    if (ct.distanceToSquared(this.pos) > 36 || !(this.state === 'walk' || this.state === 'climb' || this.state === 'ladder')) ct.copy(this.pos);
    else { ct.x = damp(ct.x, this.pos.x, 24, dt); ct.z = damp(ct.z, this.pos.z, 24, dt); ct.y = damp(ct.y, this.pos.y, 13, dt); }
    if (this.firstPerson) {
      const bob = this.state === 'walk' && this.grounded && this.speed > 0.5 ? Math.sin((this.rig.gp || 0) * Math.PI * 4) * Math.min(1, this.speed / 7) * 0.035 : 0;
      cam.position.set(this.pos.x + fx * 0.12, this.pos.y + this.eyeY + bob, this.pos.z + fz * 0.12);
      cam.lookAt(cam.position.x + fx * cp, cam.position.y - sp, cam.position.z + fz * cp);
      return;
    }
    const tx = ct.x, ty = ct.y + this.eyeY + 0.05, tz = ct.z;
    const dx = -fx * cp, dy = sp, dz = -fz * cp;
    const dist = (this.state === 'ride' ? 15 : ({ near: 3.2, normal: this.camDist, far: 6.4 })[(G.settings && G.settings.cam) || 'normal'] || this.camDist) * (this.camK || 1);   // the camera distance setting (further back for a giant hero)
    const free = Math.max(0.5, G.colliders.raycast(tx, ty, tz, dx, dy, dz, dist + 0.35) - 0.35);
    this._cd = free < this._cd ? free : damp(this._cd, free, 5, dt);
    cam.position.set(tx + dx * this._cd, this.dive ? Math.min(ty + dy * this._cd, -0.35) : Math.max(ty + dy * this._cd, 0.25), tz + dz * this._cd);   // a diver's camera stays under the surface
    cam.lookAt(tx, ty, tz);
    const sh = G.fx ? G.fx.shakeK : 0;   // a hard hit or a blast shakes the view
    if (sh > 0.01) { const a = sh * sh * 0.35; cam.position.x += (Math.random() - 0.5) * a; cam.position.y += (Math.random() - 0.5) * a; cam.position.z += (Math.random() - 0.5) * a; }
  }
}
