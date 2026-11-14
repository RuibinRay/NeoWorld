// The player's personal vehicle. One flight model covers every class (aerocar, pod, hoverbike,
// hauler, supercar): hover-drive on the street, repulsor flight above it, takeoff, landing
// assist, boost, wind, collisions, battery, autopilot. Handling comes from data/vehicles.js.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { MODELS, buildVehicle } from '../data/vehicles.js';
import { clamp, damp, angDelta } from '../core/util.js';

const HOVER = 0.45;  // extra clearance in ground-effect drive mode
const NO_TUNE = { thr: 0, bat: 0, hull: 0 };

// Plan a flight from a point to a landing pad: the cruise altitude, an optional dog-leg waypoint
// around whatever is tall, and the estimated time. vC: cruise speed, vV: climb speed (climbing is slow).
export function planRoute(x0, y0, z0, pad, vC, vV) {
  const col = G.colliders, alt = (ax, az, bx, bz) => col.clearAltitude(ax, az, bx, bz, 7, 16), floor = Math.max(y0, pad.y + 26, 46);
  const time = (y, len) => { const h = Math.max(y, floor); return len / vC + (h - y0 + h - pad.y) / vV; };
  const dx = pad.x - x0, dz = pad.z - z0, l = Math.hypot(dx, dz) || 1;
  let best = { y: alt(x0, z0, pad.x, pad.z), via: null };
  best.t = time(best.y, l);
  if (best.y > Math.max(pad.y, y0) + 150) {
    for (const o of [-260, 260, -520, 520, -820, 820]) {
      const vx = (x0 + pad.x) / 2 - (dz / l) * o, vz = (z0 + pad.z) / 2 + (dx / l) * o;
      const y = Math.max(alt(x0, z0, vx, vz), alt(vx, vz, pad.x, pad.z)), t = time(y, 2 * Math.hypot(l / 2, o)) + 5;
      if (t < best.t) best = { y, via: { x: vx, z: vz }, t };
    }
  }
  return { y: Math.max(best.y, floor), via: best.via, t: best.t };
}

export class AeroCar {
  constructor() {
    this.pos = new THREE.Vector3(-92, 0.15 + 0.72, 24);
    this.vel = new THREE.Vector3();
    this.yaw = Math.PI / 2; this.pitch = 0; this.roll = 0;
    this.mode = 'parked';            // parked | drive | fly
    this.battery = 82; this.hull = 100; this.occupied = false; this.gear = 1;
    this.auto = null; this.cockpit = false; this.lookYaw = 0; this.lookPitch = 0.16; this.lookIdle = 0;
    this.shake = 0; this.comfort = 100; this.lastHit = 0; this.paint = '#d9413a';
    this.boost = false; this.assist = false; this.locked = false; this.cargoHits = 0;
    this.ctrl = { throttle: 0, steer: 0, lift: 0 };
    this.group = new THREE.Group(); this.group.rotation.order = 'YXZ'; G.scene.add(this.group);
    this.setModel('wisp');
  }
  // Swap the vehicle class: new mesh, new handling. The player rig (if seated) stays attached.
  setModel(id, keepPaint) {
    const m = MODELS[id] || MODELS.wisp;
    if (this.body) this.body.removeFromParent();
    this.model = MODELS[id] ? id : 'wisp'; this.spec = m; this.R = m.R; this.ride = m.ride;
    if (!keepPaint) this.paint = m.paint;
    const b = buildVehicle(this.model, this.paint);
    this.body = b.g; this.paintMat = b.paintMat; this.podMat = b.podMat; this.canopy = b.canopy; this.skids = b.skids; this.seatPos = b.seat; this.eye = b.eye;
    this.group.add(this.body);
    if (this.occupied && G.player) G.player.rig.root.position.copy(this.seatPos);
  }
  setPaint(hex) { this.paint = hex; this.paintMat.color.set(hex); }
  get tune() { const g = G.state && G.state.garage; return (g && g.tune[this.model]) || NO_TUNE; }
  get speed() { return Math.hypot(this.vel.x, this.vel.z); }
  get powered() { return this.battery > 0 && this.hull > 0; }
  altitude() { return this.pos.y - this.ride - G.colliders.groundAt(this.pos.x, this.pos.z, this.pos.y - this.ride + 0.6, 0.6, 1.3); }

  board(player) {
    this.occupied = true; player.state = 'drive'; player.firstPerson = false; player.board = false;
    this.group.add(player.rig.root); player.rig.root.position.copy(this.seatPos); player.rig.root.rotation.y = 0; player.rig.root.visible = true;
    this.lookYaw = 0; this.lookPitch = 0.16; this._cd = undefined;
  }
  // Returns false (and says why) if there is nowhere safe to step out.
  alight(player) {
    if (this.locked) return false;
    if (this.mode === 'fly' || this.speed > 2.5) { G.ui.toast('Land and stop before stepping out.', 'warn'); return false; }
    const col = G.colliders, side = this.R + 0.7;
    for (const s of [1, -1]) {
      const x = this.pos.x + Math.cos(this.yaw) * side * s, z = this.pos.z - Math.sin(this.yaw) * side * s;
      const gy = col.groundAt(x, z, this.pos.y + 0.5, 1.0, 0.3), p = { x, z };
      if (this.pos.y - this.ride - gy > 1.6) continue;
      if (col.resolveCircle(p, 0.34, gy + 0.55, gy + 1.7)) continue;
      this.mode = 'parked'; this.occupied = false; this.auto = null; this.cockpit = false; if (this.canopy) this.canopy.visible = true; player.rig.root.visible = true;
      G.scene.add(player.rig.root); player.pos.set(x, gy, z); player.vel.set(0, 0, 0); player.yaw = this.yaw; player.camYaw = this.yaw; player.state = 'walk'; player.grounded = true;
      return true;
    }
    G.ui.toast('No safe place to step out here.', 'warn');
    return false;
  }
  // Put the rider on their feet at a given spot (used when an organised event ends).
  eject(player, x, y, z) {
    this.mode = 'parked'; this.occupied = false; this.auto = null; this.cockpit = false; this.locked = false; this.vel.set(0, 0, 0);
    if (this.canopy) this.canopy.visible = true;
    G.scene.add(player.rig.root); player.rig.root.visible = true; player.pos.set(x, y, z); player.vel.set(0, 0, 0); player.state = 'walk'; player.grounded = true;
  }
  pushOut(p, r) {
    if (Math.abs(p.y - (this.pos.y - this.ride)) > 2) return;
    const dx = p.x - this.pos.x, dz = p.z - this.pos.z, d = Math.hypot(dx, dz), m = this.R * 0.78 + r;
    if (d < m && d > 0.001) { p.x += (dx / d) * (m - d); p.z += (dz / d) * (m - d); }
  }

  engageAutopilot(pad) {
    const r = planRoute(this.pos.x, this.pos.y, this.pos.z, pad, Math.min(46, this.spec.vFly * 0.7) * 0.9, this.spec.lift / 2.2);
    this.auto = { pad, phase: 'climb', y: r.y, via: r.via, eta: r.t };
    G.ui.toast(`Autopilot: ${pad.name}`, 'info');
  }
  autopilot(dt) {
    const a = this.auto, c = this.ctrl, p = a.pad, tg = a.via || p, dx = tg.x - this.pos.x, dz = tg.z - this.pos.z, dist = Math.hypot(dx, dz);
    const fwd = this.vel.x * Math.sin(this.yaw) + this.vel.z * Math.cos(this.yaw);
    c.throttle = 0; c.steer = 0; c.lift = 0;
    if (a.phase === 'climb') {
      c.lift = clamp((a.y - this.pos.y) / 6, -1, 1);
      c.steer = clamp(angDelta(this.yaw, Math.atan2(dx, dz)) * 2, -1, 1);
      if (Math.abs(a.y - this.pos.y) < 2.5) a.phase = 'cruise';
    } else if (a.phase === 'cruise') {
      const err = angDelta(this.yaw, Math.atan2(dx, dz));
      c.steer = clamp(err * 2.2, -1, 1);
      const want = clamp(a.via ? 99 : dist * 0.45, 3, Math.min(46, this.spec.vFly * 0.7)) * (Math.abs(err) > 0.5 ? 0.35 : 1);
      c.throttle = clamp((want - fwd) / 6, -1, 1);
      c.lift = clamp((a.y - this.pos.y) / 6, -1, 1);
      if (a.via) { if (dist < 50) a.via = null; } else if (dist < 3 && this.speed < 5) a.phase = 'descend';
    } else {
      this.vel.x = damp(this.vel.x, clamp(dx * 1.2, -4, 4), 4, dt); this.vel.z = damp(this.vel.z, clamp(dz * 1.2, -4, 4), 4, dt);
      const alt = this.pos.y - this.ride - p.y;
      c.lift = alt > 10 ? -1 : alt > 2 ? -0.5 : -0.3;
      if (this.mode !== 'fly') { this.mode = 'parked'; this.auto = null; G.ui.toast(`Arrived: ${p.name}`, 'good'); }
    }
  }

  update(dt) {
    const inp = G.input, c = this.ctrl;
    this.boost = false;
    if (this.occupied && !this.locked) {
      const manual = (inp.down('KeyW') ? 1 : 0) + (inp.down('KeyS') ? 1 : 0) + (inp.down('KeyA') ? 1 : 0) + (inp.down('KeyD') ? 1 : 0) + (inp.down('Space') ? 1 : 0);
      if (this.auto && manual) { this.auto = null; G.ui.toast('Autopilot off: manual control.', 'info'); }
      if (this.auto) this.autopilot(dt);
      else {
        c.throttle = (inp.down('KeyW') ? 1 : 0) - (inp.down('KeyS') ? 1 : 0);
        c.steer = (inp.down('KeyA') ? 1 : 0) - (inp.down('KeyD') ? 1 : 0);
        c.lift = (inp.down('Space') ? 1 : 0) - (inp.down('ControlLeft') || inp.down('KeyC') ? 1 : 0);
        this.boost = c.throttle > 0 && (inp.down('ShiftLeft') || inp.down('ShiftRight')) && this.battery > 4 && this.mode !== 'parked';
      }
      if (inp.pressed('KeyV')) this.cockpit = !this.cockpit;
    } else if (this.occupied) { c.throttle = 0; c.steer = 0; c.lift = 0; }
    else { c.throttle = 0; c.steer = 0; c.lift = this.mode === 'parked' ? 0 : -1; }
    this.step(dt);
    if (this.occupied) { G.player.pos.copy(this.pos); G.player.pos.y -= this.ride; this.updateCamera(dt); }
  }

  step(dt) {
    const col = G.colliders, c = this.ctrl, powered = this.powered, m = this.spec, tune = this.tune, RIDE = this.ride;
    const gY = col.groundAt(this.pos.x, this.pos.z, this.pos.y - RIDE + 0.6, 0.6, Math.min(1.3, this.R));
    this.assist = false;
    if (this.mode === 'parked') {
      this.vel.set(0, 0, 0); this.pos.y = damp(this.pos.y, gY + RIDE, 9, dt); this.gear = damp(this.gear, 1, 6, dt);
      if (powered && this.occupied && (c.throttle !== 0 || c.lift > 0)) { this.mode = 'drive'; if (G.audio) G.audio.blip(330, 0.12); }
    } else {
      const flying = this.mode === 'fly', bst = this.boost && powered;
      let fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
      const fwd0 = this.vel.x * fx + this.vel.z * fz, sp0 = this.speed;
      const turn = flying ? m.turnFly : clamp(sp0 / 6, 0.3, 1) * m.turnDrive * (fwd0 < -0.5 ? -1 : 1);
      this.yaw += c.steer * turn * dt;
      fx = Math.sin(this.yaw); fz = Math.cos(this.yaw);
      const fwd = this.vel.x * fx + this.vel.z * fz;
      const vmax = (flying ? m.vFly : m.vDrive) * (1 + 0.06 * tune.thr) * (bst ? 1.22 : 1), acc = (flying ? m.acc : m.accDrive) * (1 + 0.08 * tune.thr) * (bst ? 1.7 : 1);
      if (powered && c.throttle) {
        const eff = c.throttle > 0 ? clamp(1 - fwd / vmax, 0, 1) : clamp(1 + fwd / (vmax * 0.35), 0, 1) * (fwd > 1 ? 1.5 : 1);
        this.vel.x += fx * c.throttle * acc * eff * dt; this.vel.z += fz * c.throttle * acc * eff * dt;
      }
      const latX = this.vel.x - fx * fwd, latZ = this.vel.z - fz * fwd, lk = Math.min(1, (flying ? 1.7 : 7) * dt);
      const drag = (flying ? 0.2 : c.throttle ? 0.35 : 1.3) * dt;
      this.vel.x -= latX * lk + this.vel.x * drag; this.vel.z -= latZ * lk + this.vel.z * drag;
      if (flying) {
        const lift = powered ? c.lift : -0.55, env = G.env;
        this.vel.y += lift * m.lift * dt; this.vel.y -= this.vel.y * 2.2 * dt;
        this.vel.y = clamp(this.vel.y, -30, 22);
        // landing assist: the last few meters of a powered descent are flared automatically
        const alt = this.pos.y - RIDE - gY;
        if (powered && c.lift < 0 && alt < 7) { const sink = Math.max(1.3, alt * 1.5); if (this.vel.y < -sink) this.vel.y = damp(this.vel.y, -sink, 10, dt); this.assist = true; }
        // steady wind drift, plus gusts in a storm
        this.vel.x += env.windX * 0.25 * dt; this.vel.z += env.windZ * 0.25 * dt;
        const storm = env.storm;
        if (storm > 0.3) {
          const tt = G.elapsed, k = storm * 4.5 * dt;
          this.vel.x += (Math.sin(tt * 1.3) + Math.sin(tt * 3.1 + 1)) * k; this.vel.z += (Math.cos(tt * 1.7) + Math.sin(tt * 2.6 + 2)) * k; this.vel.y += Math.sin(tt * 2.2 + 0.5) * k * 1.2;
          if (this.occupied && !this._gust) { this._gust = true; G.ui.toast('Storm cell: expect turbulence. Half the lane traffic is grounded.', 'warn'); }
        } else this._gust = false;
        this.pos.y += this.vel.y * dt;
        const floor = gY + RIDE + HOVER;
        if (this.pos.y <= floor && this.vel.y <= 0.5) {
          const impact = -this.vel.y;
          if (impact > 8.5) this.damage((impact - 8.5) * 4, 'Hard landing');
          this.pos.y = floor; this.vel.y = 0;
          if (c.lift <= 0) this.mode = 'drive';
        }
      } else {
        this.pos.y = damp(this.pos.y, gY + RIDE + HOVER, 8, dt); this.vel.y = 0;
        if (c.lift > 0 && powered) { this.mode = 'fly'; this.vel.y = 3; }
        else if (this.pos.y - RIDE - gY > 2.6) this.mode = 'fly';
        else if ((c.lift < 0 || !this.occupied || !powered) && this.speed < 2.5 && !this.locked) { this.mode = 'parked'; if (G.audio) G.audio.blip(220, 0.12); }
      }
      // sub-stepped so that even at full boost the hull cannot pass through a railing or a skybridge
      const sub = Math.min(10, Math.max(1, Math.ceil(Math.hypot(this.vel.x, this.vel.z) * dt / (this.R * 0.55)))), h = dt / sub;
      for (let i = 0; i < sub; i++) {
        this.pos.x += this.vel.x * h; this.pos.z += this.vel.z * h;
        const hit = col.resolveCircle(this.pos, this.R, this.pos.y - 0.55, this.pos.y + 0.75);
        if (!hit) continue;
        const vn = this.vel.x * hit.nx + this.vel.z * hit.nz;
        if (vn < 0) {
          this.vel.x -= 1.25 * vn * hit.nx; this.vel.z -= 1.25 * vn * hit.nz;
          if (-vn > 5) this.damage((-vn - 5) * 1.7, 'Collision');
        }
      }
      const ceil = col.ceilingAt(this.pos.x, this.pos.z, this.pos.y + 0.3, Math.min(1.2, this.R));
      if (this.pos.y + 0.85 > ceil) { this.pos.y = ceil - 0.85; this.vel.y = Math.min(this.vel.y, 0); }
      // leaving the district: the airspace beyond is not built yet
      const far = Math.hypot(this.pos.x, this.pos.z);
      if (far > 2600) { this.vel.x -= (this.pos.x / far) * 30 * dt; this.vel.z -= (this.pos.z / far) * 30 * dt; if (this.occupied && !this._edge) { this._edge = true; G.ui.toast('Leaving Neo Central airspace. Nothing is built beyond the six districts.', 'warn'); } } else this._edge = false;
      this.gear = damp(this.gear, flying && this.pos.y - RIDE - gY > 4 ? 0 : 1, 4, dt);
      // battery: thrust and lift cost power; so does simply staying up. Boost triples the draw.
      const use = (flying ? 0.035 + Math.abs(c.throttle) * 0.05 + Math.max(0, c.lift) * 0.07 + this.speed * 0.0007 : 0.012 + Math.abs(c.throttle) * 0.02) * m.use * (1 - 0.12 * tune.bat) * (bst ? 3 : 1);
      if (powered) { this.battery = Math.max(0, this.battery - use * dt); if (this.battery === 0 && this.occupied) G.ui.toast('Battery empty: reserve glide. Charge at a pad.', 'warn'); }
      // comfort (used by taxi fares): rough inputs and speed changes upset passengers
      const jerk = Math.abs(this.vel.y) * 0.02 + Math.abs(c.steer) * this.speed * 0.004 + (bst ? 0.4 : 0);
      this.comfort = clamp(this.comfort - jerk * dt * 3, 0, 100);
    }
    // visuals
    const sp = this.speed, open = this.spec.open;
    this.pitch = damp(this.pitch, this.mode === 'parked' ? 0 : c.throttle * (open ? 0.12 : 0.07) - this.vel.y * 0.012, 4, dt);
    this.roll = damp(this.roll, this.mode === 'parked' ? 0 : -c.steer * clamp(sp / 30, 0.15, 1) * (this.mode === 'fly' ? 0.5 : open ? 0.45 : 0.12), 4, dt);
    this.shake = Math.max(0, this.shake - dt * 2.5);
    this.group.position.copy(this.pos); this.group.rotation.set(this.pitch, this.yaw, this.roll);
    if (this.mode !== 'parked') this.group.position.y += Math.sin(G.elapsed * 2.2) * 0.03;
    const glow = this.mode === 'parked' ? 0.25 : 0.9 + Math.abs(c.throttle) * 0.8 + Math.max(0, c.lift) * 1.2 + (this.boost ? 1.6 : 0);
    this.podMat.color.setRGB((this.boost ? 1.2 : 0.35) * glow, 0.88 * glow, 1.0 * glow);
    for (const s of this.skids) { s.m.scale.y = s.h * (0.1 + 0.9 * this.gear); s.m.position.y = s.y + (1 - this.gear) * s.h * 0.45; }
  }

  damage(amount, why) {
    amount *= (1 / this.spec.tough) * (1 - 0.18 * this.tune.hull);
    this.hull = Math.max(0, this.hull - amount); this.shake = Math.min(1, 0.3 + amount / 20); this.comfort = Math.max(0, this.comfort - amount * 1.5); this.cargoHits += amount;
    if (G.audio) G.audio.thud(Math.min(1, amount / 15));
    if (this.occupied && G.elapsed - this.lastHit > 1.5) {
      this.lastHit = G.elapsed;
      G.ui.toast(`${why}: hull ${Math.round(this.hull)}%`, 'warn');
      if (G.events && !this.locked && !(G.racing && G.racing.gp)) G.events.report('crash', amount, this.pos);
    }
    if (this.hull === 0 && this.occupied) G.ui.toast('Hull failure: repulsors offline. Call a tow from your lens menu (Tab).', 'warn');
  }

  updateCamera(dt) {
    const cam = G.camera, inp = G.input, p = G.player;
    if (inp.mx || inp.my) { const sens = G.settings ? G.settings.sens : 1, inv = G.settings && G.settings.invertY ? -1 : 1; this.lookYaw -= inp.mx * 0.0026 * sens; this.lookPitch = clamp(this.lookPitch + inp.my * 0.0022 * sens * inv, -0.9, 1.2); this.lookIdle = 0; }
    if (inp.down('ArrowLeft')) { this.lookYaw += 1.6 * dt; this.lookIdle = 0; }
    if (inp.down('ArrowRight')) { this.lookYaw -= 1.6 * dt; this.lookIdle = 0; }
    this.lookIdle += dt;
    if (this.lookIdle > 2.5 && this.speed > 3) { this.lookYaw = damp(this.lookYaw, 0, 2, dt); this.lookPitch = damp(this.lookPitch, 0.16, 2, dt); }
    this.lookYaw = angDelta(0, this.lookYaw);
    const sh = this.shake * 0.25, jx = (Math.random() - 0.5) * sh, jy = (Math.random() - 0.5) * sh;
    cam.fov = damp(cam.fov, 60 + clamp(this.speed / 72, 0, 1.2) * 16 + (this.boost ? 7 : 0), 3, dt); cam.updateProjectionMatrix();
    p.rig.root.visible = !this.cockpit; if (this.canopy) this.canopy.visible = !this.cockpit;
    if (this.cockpit) {
      const eye = this._eye || (this._eye = new THREE.Vector3()), d = this._dir || (this._dir = new THREE.Vector3());
      eye.copy(this.eye).applyQuaternion(this.group.quaternion).add(this.group.position);
      d.set(Math.sin(this.lookYaw) * Math.cos(this.lookPitch - 0.16), -Math.sin(this.lookPitch - 0.16), Math.cos(this.lookYaw) * Math.cos(this.lookPitch - 0.16)).applyQuaternion(this.group.quaternion);
      cam.up.set(0, 1, 0).applyQuaternion(this.group.quaternion);
      cam.position.copy(eye); cam.position.x += jx; cam.position.y += jy;
      cam.lookAt(eye.x + d.x, eye.y + d.y, eye.z + d.z);
      p.camYaw = this.yaw;
      return;
    }
    cam.up.set(0, 1, 0);
    const cy = this.yaw + this.lookYaw, cp = Math.cos(this.lookPitch), sp = Math.sin(this.lookPitch);
    const tx = this.pos.x, ty = this.pos.y + 1.1, tz = this.pos.z, dist = this.spec.cam + this.speed * 0.05;
    const dx = -Math.sin(cy) * cp, dy = sp, dz = -Math.cos(cy) * cp;
    const free = Math.max(2.5, G.colliders.raycast(tx, ty, tz, dx, dy, dz, dist + 0.4) - 0.4);
    this._cd = this._cd === undefined ? free : free < this._cd ? free : damp(this._cd, free, 4, dt);
    cam.position.set(tx + dx * this._cd + jx, Math.max(ty + dy * this._cd + jy, 0.3), tz + dz * this._cd);
    cam.lookAt(tx + Math.sin(this.yaw) * 2, ty, tz + Math.cos(this.yaw) * 2);
    p.camYaw = cy;
  }
}
