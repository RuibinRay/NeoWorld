// Shootout at the Grand Arbor Park court: ten shots from five spots round the east hoop, with a
// real ball. Aim with the mouse, hold Space to charge, let go to shoot. The ball bounces off
// the rim, the backboard and the floor; it only counts when it drops through the hoop.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { clamp } from '../core/util.js';

const RIM = 0.415, BALL = 0.12, GRAV = 9.8, SPOTS = [[-1.2, 5.2], [-0.6, 5.2], [0, 4.6], [0.6, 5.2], [1.2, 5.2]];   // [angle from straight on, distance]
export class Court {
  constructor() {
    const P = G.metro.park, c = P.court;
    this.rim = new THREE.Vector3(c.x + 16.5 - 0.52, 3.05, c.z);              // the east hoop
    this.board = c.x + 16.5 - 0.1 - 0.06;                                     // the backboard's front face
    const m = new THREE.Mesh(new THREE.SphereGeometry(BALL, 14, 10), new THREE.MeshStandardMaterial({ color: '#d9692e', roughness: 0.7 }));
    m.visible = false; m.castShadow = true; G.scene.add(m);
    this.ball = { m, on: false, v: new THREE.Vector3(), scored: false, t: 0, bounces: 0, rimHit: false };
    this.game = null;
    G.interact.add({ pos: { x: c.x, y: c.y, z: c.z }, r: 6, yTol: 2, label: 'Shootout: ten shots from five spots', enabled: () => !G.minigame && !this.game, use: () => this.start() });
  }
  spot(k) { const [a, d] = SPOTS[Math.floor(k / 2)], r = this.rim; return { x: r.x - Math.cos(a) * d, z: r.z + Math.sin(a) * d }; }
  start() {
    const p = G.player; if (p.state !== 'walk') return;
    p.state = 'busy'; p.busyAnim = 'idle'; p.faceCam = true; p.board = false; p.crouch = false; p.vel.set(0, 0, 0);
    this.game = { k: 0, makes: 0, points: 0, c: 0, charging: false, wait: 0, streak: 0 };
    this.place();
    G.ui.toast('Shootout: aim with the mouse, hold Space to charge, let go to shoot. Look up for a higher arc. F or Esc to stop.', 'info');
  }
  place() {
    const p = G.player, s = this.spot(this.game.k), r = this.rim;
    p.pos.set(s.x, 0.06, s.z); p.yaw = p.camYaw = Math.atan2(r.x - s.x, r.z - s.z); p.camPitch = 0.2;
  }
  end(quit) {
    const g = this.game, p = G.player; this.game = null; this.ball.on = false; this.ball.m.visible = false;
    if (p.state === 'busy') p.state = 'walk'; p.faceCam = false; G.ui.setObjective(null); G.ui.cool = 0.3;
    if (quit && !g.k) return;
    const rec = G.games.best('court', g.points), pay = g.points * 3 + (g.makes === 10 ? 40 : 0);
    G.ui.toast(`Shootout: ${g.makes} of 10, ${g.points} points${rec ? ', a new personal best' : ''}.`, 'good');
    if (pay) G.economy.earn(pay, 'court side bet');
  }
  shoot(power) {
    const p = G.player, b = this.ball, yaw = p.camYaw, el = clamp(0.95 - p.camPitch * 0.9, 0.5, 1.35), v = 6.2 + power * 4.2;
    b.on = true; b.scored = false; b.rimHit = false; b.t = 0; b.bounces = 0; b.m.visible = true;
    b.m.position.set(p.pos.x + Math.sin(yaw) * 0.35, p.pos.y + 2.1, p.pos.z + Math.cos(yaw) * 0.35);
    b.v.set(Math.sin(yaw) * Math.cos(el) * v, Math.sin(el) * v, Math.cos(yaw) * Math.cos(el) * v);
    p.play('wave', 0.5); if (G.audio) G.audio.blip(260, 0.06);
  }
  step(dt) {
    const b = this.ball, q = b.m.position, r = this.rim, py = q.y;
    b.v.y -= GRAV * dt; q.addScaledVector(b.v, dt); b.t += dt;
    // through the hoop: crossing the rim's plane going down, well inside the ring
    if (!b.scored && py > r.y && q.y <= r.y && Math.hypot(q.x - r.x, q.z - r.z) < RIM - BALL * 0.5) { b.scored = true; return 'score'; }
    // the rim: the nearest point on the ring
    const dx = q.x - r.x, dz = q.z - r.z, dh = Math.hypot(dx, dz) || 1e-6, px = r.x + (dx / dh) * RIM, pz = r.z + (dz / dh) * RIM, nx = q.x - px, ny = q.y - r.y, nz = q.z - pz, d = Math.hypot(nx, ny, nz);
    if (d < BALL + 0.02) { const ux = nx / d, uy = ny / d, uz = nz / d, vn = b.v.x * ux + b.v.y * uy + b.v.z * uz; if (vn < 0) { b.v.x -= 1.6 * vn * ux; b.v.y -= 1.6 * vn * uy; b.v.z -= 1.6 * vn * uz; b.v.multiplyScalar(0.85); } q.set(px + ux * (BALL + 0.02), r.y + uy * (BALL + 0.02), pz + uz * (BALL + 0.02)); if (!b.rimHit && G.audio) G.audio.blip(520, 0.05); b.rimHit = true; }
    // the backboard
    if (q.x + BALL > this.board && b.v.x > 0 && Math.abs(q.z - r.z) < 0.9 && q.y > 2.95 && q.y < 4.05) { q.x = this.board - BALL; b.v.x *= -0.55; b.v.y *= 0.9; if (G.audio) G.audio.blip(180, 0.05); }
    // the court
    if (q.y < BALL + 0.06) { q.y = BALL + 0.06; b.v.y = -b.v.y * 0.62; b.v.x *= 0.8; b.v.z *= 0.8; b.bounces++; }
    return null;
  }
  update(dt) {
    const g = this.game; if (!g) return;
    const p = G.player, inp = G.input, b = this.ball;
    if (inp.pressed('KeyF') || inp.pressed('Escape') || p.state !== 'busy') return this.end(true);
    const power = 1 - Math.abs(1 - (g.c % 2));
    if (!b.on && g.wait <= 0) {
      if (inp.down('Space')) { g.charging = true; g.c += dt / 0.6; }
      else if (g.charging) { g.charging = false; this.shoot(power); g.c = 0; }
    }
    if (b.on) {
      for (let k = 0; k < 4; k++) if (this.step(dt / 4) === 'score') {
        g.makes++; g.streak++; const three = Math.floor(g.k / 2) !== 2; g.points += three ? 3 : 2;
        G.ui.flash(b.rimHit ? (three ? 'THREE!' : 'IN') : (three ? 'SWISH, THREE' : 'SWISH'), 0.9); if (G.audio) { G.audio.blip(880, 0.1); G.audio.blip(1320, 0.07); }
      }
      if (b.bounces > 3 || b.t > 5) { b.on = false; b.m.visible = false; if (!b.scored) g.streak = 0; g.k++; g.wait = 0.5; if (g.k >= 10) return this.end(false); if (g.k % 2 === 0) this.place(); }
    } else g.wait -= dt;
    G.ui.setObjective({ title: 'Shootout', text: `Shot ${Math.min(10, g.k + 1)} of 10 · ${g.makes} made · ${g.points} points`, sub: `Power ${'▮'.repeat(Math.round(power * 8))}${'▯'.repeat(8 - Math.round(power * 8))} · ${Math.floor(g.k / 2) === 2 ? 'free throw: 2 points' : 'from the arc: 3 points'}` });
  }
}
