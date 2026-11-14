// The player's own robot dog (bought at Kinetic Robotics). Heels, sits when you stop,
// rides along when you fly, and likes being petted.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { makeDog, animateDog } from './rigs.js';
import { dampAngle } from '../core/util.js';

export class Dog {
  constructor() {
    this.pos = new THREE.Vector3(); this.yaw = 0; this.rig = null; this.active = false; this.still = 0; this.happy = 0; this.h = 0.9;
    this.item = G.interact.add({ pos: this.pos, r: 1.5, yTol: 1.5, prio: -0.1, label: () => `Pet ${G.state.dog.name}`, enabled: () => this.active && this.rig.root.visible, use: () => this.pet() });
  }
  get name() { return G.state.dog.name; }
  refresh() { // (re)build from saved state
    if (this.rig) this.rig.root.removeFromParent();
    this.active = G.state.owns.dog;
    if (!this.active) { this.rig = null; return; }
    const d = G.state.dog; this.rig = makeDog({ robot: true, color: d.color, accent: d.accent, scale: 1.05 }); G.scene.add(this.rig.root);
    const p = G.player.pos; this.pos.set(p.x + 1, p.y, p.z + 1);
  }
  pet() {
    const p = G.player; p.yaw = Math.atan2(this.pos.x - p.pos.x, this.pos.z - p.pos.z); p.play('pet', 1.8);
    this.happy = 3; G.ui.say(this, '♥ happy chirp', 2.5); if (G.audio) { G.audio.blip(900, 0.08); setTimeout(() => G.audio.blip(1200, 0.08), 120); }
  }
  update(dt) {
    if (!this.active) return;
    const p = G.player, root = this.rig.root;
    if (p.state === 'drive' || p.state === 'ride') { root.visible = false; this.pos.copy(p.state === 'ride' ? p.pos : G.car.pos); return; }
    root.visible = true;
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    const tx = p.pos.x - fx * 0.9 + fz * 1.0, tz = p.pos.z - fz * 0.9 - fx * 1.0;
    const dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz);
    let speed = 0;
    if (d > 25 || Math.abs(p.pos.y - this.pos.y) > 6) this.pos.set(tx, p.pos.y, tz);
    else if (d > 0.35) { speed = Math.min(d * 3.2, 8); this.pos.x += (dx / d) * speed * dt; this.pos.z += (dz / d) * speed * dt; this.yaw = dampAngle(this.yaw, Math.atan2(dx, dz), 9, dt); }
    G.colliders.resolveCircle(this.pos, 0.25, this.pos.y + 0.5, this.pos.y + 0.8);
    this.pos.y = G.colliders.groundAt(this.pos.x, this.pos.z, Math.max(this.pos.y, p.pos.y) + 0.3, 0.5, 0.2);
    this.still = speed < 0.1 ? this.still + dt : 0; this.happy -= dt;
    if (speed < 0.1) this.yaw = dampAngle(this.yaw, Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z), 3, dt);
    root.position.copy(this.pos); root.rotation.y = this.yaw;
    animateDog(this.rig, dt * (this.happy > 0 ? 2 : 1), speed > 3.4 ? 'run' : speed > 0.1 ? 'walk' : this.still > 2.5 || p.state === 'sit' ? 'sit' : 'idle', speed);
  }
}
