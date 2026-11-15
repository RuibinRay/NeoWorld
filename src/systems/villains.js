// Kurozan, the Storm Dragon, and his crew of war robots (the Stormbreakers). While you are a hero,
// every couple of minutes the crew raids a street somewhere near you: they smash shopfronts and
// scare people until you arrive, then fight. Stopping a raid pays, and after a couple of raids
// Kurozan himself waits at Skyhaven Stadium: a giant with an iron club who turns into a flying
// dragon halfway through the fight.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { CREW, KUROZAN, VILLAINS } from '../data/heroes.js';
import { clamp, damp, dampAngle } from '../core/util.js';
import { std, neon } from '../world/materials.js';
import { makeHumanoid, animateRig, makeDrone } from '../entities/rigs.js';
import { STADIUM } from '../world/expo.js';
import { money } from '../ui/ui.js';
import { artUrl } from '../world/art.js';
const say = (who, name, text) => { if (G.voice) G.voice.say(who, text, { name }); else G.ui.toast(`"${text}"`, 'warn'); };
const sting = (k) => { if (G.music) G.music.sting(k); };

const V = () => new THREE.Vector3();
const RED = '#ff3b30';
// the leaders who come with their own crews' raids
const LEADERS = { vcore: { name: VILLAINS.vektor.name, hp: VILLAINS.vektor.hp }, shade: { name: VILLAINS.shade.name, hp: VILLAINS.shade.hp, look: VILLAINS.shade.look } };

// ---- one of the crew --------------------------------------------------------------------------------
class Foe {
  constructor(sys, kind, pos) {
    this.sys = sys; this.kind = kind; const d = CREW[kind] || LEADERS[kind];
    this.name = d.name; this.hp = this.max = Math.round(d.hp * G.heroes.diff.hp); this.pos = pos.clone(); this.vel = V(); this.vy = 0; this.air = 0; this.yaw = Math.random() * 6.28;
    this.alive = true; this.team = 'villain'; this.flying = kind === 'drone' || kind === 'hdrone' || kind === 'vcore'; this.big = kind === 'vcore' || kind === 'shade'; this.leader = this.big;
    this.h = kind === 'brute' ? 1.35 : kind === 'gunner' || kind === 'ninja' || kind === 'shade' ? 1.0 : 0; this.r = kind === 'brute' ? 0.8 : kind === 'vcore' ? 1.7 : kind === 'gunner' || kind === 'ninja' || kind === 'shade' ? 0.5 : 0.6;
    this.stun = 0; this.burn = 0; this.cool = 1 + Math.random() * 2; this.slamT = 6 + Math.random() * 4; this.wind = null; this.state = 'smash'; this.dead = 0; this.flash = 0; this.anim = 'idle'; this.away = 0;
    this.smashT = 2 + Math.random() * 4; this.strafe = Math.random() < 0.5 ? 1 : -1; this.hover = 6 + Math.random() * 2;
    if (this.flying) {
      if (kind === 'vcore') {   // Vektor's core: a black sphere in spinning red rings
        const g = new THREE.Group(), rings = [];
        const core = new THREE.Mesh(new THREE.SphereGeometry(1.1, 20, 14), std('#14161c', 0.3, 0.9)); core.castShadow = true; g.add(core);
        for (let k = 0; k < 3; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(1.6 + k * 0.35, 0.06, 6, 40), neon('#ff2a4f', 1.6)); r.rotation.set(k * 0.9, k * 0.6, 0); g.add(r); rings.push(r); }
        this.eye = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.2, 0.3) })); this.eye.position.z = 1.0; g.add(this.eye);
        this.rig = { root: g, rotors: rings }; this.hover = 9; this.callT = 6;
      } else { this.rig = makeDrone('police'); this.rig.red.color.set('#ff2020'); this.rig.blue.color.set(kind === 'hdrone' ? '#ff2a4f' : '#ff6a00'); this.rig.root.scale.setScalar(kind === 'hdrone' ? 1.5 : 1.8); }
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.3, 0.2) })); eye.position.set(0, -0.05, 0.3); this.rig.root.add(eye);
      this.pos.y += this.hover;
    } else {
      this.rig = makeHumanoid(d.look);
      if (kind === 'gunner') { const gun = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.62), std('#20242c', 0.4, 0.8)); gun.position.set(0, -0.36, 0.24); this.rig.elbR.add(gun); const tip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), neon('#ff8a00', 2)); tip.position.set(0, -0.36, 0.56); this.rig.elbR.add(tip); }
      if (kind === 'ninja' || kind === 'shade') for (const e of kind === 'shade' ? [this.rig.elbL, this.rig.elbR] : [this.rig.elbR]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.4, 0.008), std('#c9ced8', 0.2, 0.9)); b.position.set(0, -0.58, 0.035); e.add(b); }
      if (kind === 'shade') { this.callT = 10; for (const sx of [-1, 1]) { const ey = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.01), neon('#b26bff', 2.4)); ey.position.set(sx * 0.043, 0.02, 0.122); this.rig.head.add(ey); } }
      if (kind === 'brute') for (const e of [this.rig.elbL, this.rig.elbR]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.18), std('#3a3d45', 0.5, 0.7)); f.position.set(0, -0.36, 0.02); f.castShadow = true; e.add(f); }
    }
    G.scene.add(this.rig.root);
    this.cocoon = null;
    G.combat.add(this);
    this.baseScale = this.rig.root.scale.x;
    if ((kind === 'vcore' || kind === 'shade') && !sys.bossSpawn) { const v = VILLAINS[kind === 'vcore' ? 'vektor' : 'shade']; G.heroes.showCard(artUrl(kind === 'vcore' ? 'villain-vektor.jpg' : 'villain-shade.jpg'), v.name, 'leads this raid', v.color, 3.6, false, kind === 'vcore' ? 'vektor' : 'shade'); sting('hit'); say(kind === 'vcore' ? 'vektor' : 'shade', v.short, kind === 'vcore' ? 'Drones. Take this street apart.' : 'Shadows. Leave no one watching.'); }
  }
  hit(dmg, dir, o = {}) {
    if (!this.alive) return;
    this.hp -= dmg; this.flash = 0.12;
    if (this.dummy) { this.sys.trainLog.push({ t: G.elapsed, d: dmg }); this.sys.trainTotal += dmg; if (this.hp < this.max * 0.3) this.hp = this.max; }
    const kn = (o.knock || 0) / (this.kind === 'brute' && !o.pull ? 1.7 : 1);   // a pull brings even a brute all the way in
    this.vel.x += dir.x * kn; this.vel.z += dir.z * kn;
    if (!this.flying && (o.up || kn > 7)) this.vy = Math.max(this.vy, (o.up || 0) + kn * 0.25);
    if (this.flying) this.vel.y = (this.vel.y || 0) + (o.up || 0) * 0.5;
    if (o.stun) { this.stun = Math.max(this.stun, o.stun); this.wind = null; if (o.kind === 'web') this.wrap(); }
    if (o.kind === 'fire') this.burn = Math.max(this.burn, 2.5);
    if (this.state !== 'fight') this.state = 'fight';
    if (this.hp <= 0) this.die(dir);
  }
  wrap() {
    if (!this.cocoon) {   // wrapped in lines: a pale shell with strands across it
      const g = (this.cocoon = new THREE.Group()), shell = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), new THREE.MeshStandardMaterial({ color: '#e8f0f4', roughness: 0.9, transparent: true, opacity: 0.78 }));
      const lines = new THREE.Mesh(new THREE.SphereGeometry(1.03, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true })); g.add(shell, lines); this.rig.root.add(g);
    }
    const w = this.flying ? 0.32 : this.kind === 'brute' ? 0.5 : 0.36, h = this.flying ? 0.32 : this.kind === 'brute' ? 1.1 : 0.9;
    this.cocoon.scale.set(w, h, w); this.cocoon.position.y = this.flying ? 0 : h * 0.98; this.cocoon.visible = true;
  }
  // Sable's warp: gone for a while, back stunned (or not at all if it finished them)
  warp(secs, dmg) {
    if (this.big) { this.hit(dmg, V().set(0, 0, 1), { kind: 'shock' }); return; } this.hp -= dmg; if (this.hp <= 0) { this.alive = false; this.rig.root.visible = false; G.combat.remove(this); this.sys.onKill(this); this.dead = 99; return; } this.away = secs; this.rig.root.visible = false; G.combat.remove(this); }
  die(dir) {
    this.alive = false; G.combat.remove(this); this.dead = 0.01; this.dieDir = dir ? dir.clone() : V().set(0, 0, 1);
    const c = V().set(this.pos.x, this.pos.y + (this.flying ? 0 : 1.1), this.pos.z);
    G.fx.spark(c, '#ffb347', 24, 8, 0.6, 0.16); G.fx.blast(c, '#ff8a3c', 0.3, 1.6, 0.3); G.fx.smoke(c, 4, '#2a2c31', 1.5, 2);
    if (G.audio) { G.audio.burst(0.5, 0.18, 500); G.audio.tone(160, 0.4, 0.05, 'sawtooth', null, 0, 0.4); }
    this.sys.onKill(this);
  }
  remove() { this.rig.root.removeFromParent(); G.combat.remove(this); this.alive = false; }
  update(dt, t) {
    const root = this.rig.root, col = G.colliders;
    if (this.away > 0) { this.away -= dt; if (this.away <= 0) { this.rig.root.visible = true; G.combat.add(this); this.stun = 1.5; G.fx.ring(V().set(this.pos.x, this.pos.y + 1, this.pos.z), '#ff5a6e', 2.5, 0.2, 0.4); } return; }
    if (this.dead > 0) { // falling over, sparking, sinking away
      this.dead += dt;
      if (this.flying) { this.vy -= 18 * dt; this.pos.y += this.vy * dt; const g = col.groundAt(this.pos.x, this.pos.z, this.pos.y + 1, 1, 0.2); if (this.pos.y <= g + 0.3) { this.pos.y = g + 0.3; if (!this.boomed) { this.boomed = true; G.fx.blast(this.pos, '#ff8a3c', 0.3, 2.2, 0.35); G.fx.dust(this.pos, 10, 1); G.audio && G.audio.burst(0.4, 0.15, 300); } } root.rotation.z += dt * 6; }
      else { root.rotation.order = 'YXZ'; root.rotation.x = -Math.min(1.5, this.dead * 3); if (this.dead > 2) root.position.y -= dt * 0.5; if (Math.random() < dt * 8) G.fx.spark(V().set(this.pos.x, this.pos.y + 0.3, this.pos.z), '#ffd34d', 2, 3, 0.3, 0.08); }
      root.position.set(this.pos.x, this.flying ? this.pos.y : root.position.y || this.pos.y, this.pos.z);
      if (this.dead > 3) { this.remove(); this.gone = true; }
      return;
    }
    const H = G.heroes, P = G.player.pos, dx = P.x - this.pos.x, dz = P.z - this.pos.z, dist = Math.hypot(dx, dz), toYaw = Math.atan2(dx, dz);
    if (this.dummy) return this.dummyStep(dt, t, toYaw);
    if (H && H.alive && dist < 46 && Math.abs(P.y - this.pos.y) < 30) this.state = 'fight'; else if (dist > 70) this.state = 'smash';
    // physics: knockback slides, knock-ups fall back, walls stop them
    const k = Math.exp(-(this.air > 0 ? 0.6 : 5) * dt); this.vel.x *= k; this.vel.z *= k;
    if (this.flying) { this.vel.y = (this.vel.y || 0) * Math.exp(-3 * dt); }
    let mx = 0, mz = 0, sp = 0; this.anim = 'idle';
    if (this.burn > 0) { this.burn -= dt; this.hp -= 7 * dt; if (Math.random() < dt * 14) G.fx.fire(V().set(this.pos.x, this.pos.y + 0.5 + Math.random() * 1.2, this.pos.z), 1, 0.6); if (this.hp <= 0) return this.die(null); }
    if (this.stun > 0) { this.stun -= dt; this.anim = 'hurt'; this.wind = null; if (this.stun <= 0 && this.cocoon) this.cocoon.visible = false; }
    else if (this.wind) { // a telegraphed attack: wind up, then hit
      const w = this.wind; w.t -= dt; this.anim = w.anim; this.yaw = dampAngle(this.yaw, toYaw, 6, dt);
      if (this.kind === 'vcore' && this.aimAt) G.fx.beam(this.pos.clone(), this.aimAt, '#ff2a4f', 0.03, 0.05);
      if (w.t <= 0) { this.wind = null; w.fn(); }
    } else if (this.sys.raid && this.sys.raid.core && this.sys.raid.core.hp > 0 && (!H || !H.alive || dist > 12)) {   // defend raids: they go for the uplink
      const c = this.sys.raid.core.pos, ddx = c.x - this.pos.x, ddz = c.z - this.pos.z, dd = Math.hypot(ddx, ddz); this.cool -= dt;
      if (this.flying) { this.pos.x = damp(this.pos.x, c.x + Math.cos(t + this.strafe * 3) * 6, 1, dt); this.pos.z = damp(this.pos.z, c.z + Math.sin(t + this.strafe * 3) * 6, 1, dt); this.pos.y = damp(this.pos.y, c.y + 7, 1, dt); }
      else if (dd > 2.8) { mx = ddx / dd; mz = ddz / dd; sp = this.kind === 'ninja' ? 6 : 3.6; this.yaw = dampAngle(this.yaw, Math.atan2(ddx, ddz), 6, dt); }
      if (this.cool <= 0 && dd < (this.flying ? 12 : 3.2)) { this.cool = 1.4 + Math.random() * 0.5; this.anim = 'heavy'; this.sys.raid.core.damage(this.kind === 'brute' ? 9 : 6); if (this.flying) G.fx.beam(this.pos.clone(), V().set(c.x, c.y + 2, c.z), '#ff2a4f', 0.06, 0.15); }
    } else if (this.state === 'fight' && H && H.alive) {
      this.cool -= dt; this.slamT -= dt;
      if (this.kind === 'brute') {
        if (dist > 2.1) { mx = dx / dist; mz = dz / dist; sp = dist > 8 ? 5 : 3.6; }
        if (this.slamT <= 0 && dist < 6) { this.slamT = 7 + Math.random() * 3; this.wind = { t: 0.8, anim: 'raise', fn: () => this.slam() }; G.fx.zone(V().set(this.pos.x, this.pos.y, this.pos.z), 4.5, 0.8); }
        else if (this.cool <= 0 && dist < 2.6) { this.cool = 1.3 + Math.random() * 0.4; this.wind = { t: 0.35, anim: 'guard', fn: () => this.punch() }; }
        this.yaw = dampAngle(this.yaw, toYaw, 8, dt);
      } else if (this.kind === 'gunner') {
        const want = dist < 9 ? -1 : dist > 19 ? 1 : 0, tx = dz / dist * this.strafe, tz = -dx / dist * this.strafe;
        mx = dx / dist * want + tx * 0.6; mz = dz / dist * want + tz * 0.6; sp = 3.2; if (Math.random() < dt * 0.3) this.strafe *= -1;
        if (this.cool <= 0 && dist < 34) { this.cool = 1.4 + Math.random() * 0.6; this.wind = { t: 0.3, anim: 'castR', fn: () => this.shoot() }; }
        this.yaw = dampAngle(this.yaw, toYaw, 8, dt);
      } else if (this.kind === 'ninja' || this.kind === 'shade') {   // fast blades; they blink behind you, throw stars from range
        const boss = this.kind === 'shade'; this.blinkT = (this.blinkT ?? 2 + Math.random() * 3) - dt;
        if (this.blinkT <= 0 && dist > 3 && dist < 40) {
          this.blinkT = boss ? 4.5 : 6 + Math.random() * 3; G.fx.smoke(this.centre(), 4, '#2a2236', 1.3, 1);
          const py = G.player.yaw, bx = P.x - Math.sin(py) * 1.8, bz = P.z - Math.cos(py) * 1.8; this.pos.set(bx, col.groundAt(bx, bz, P.y + 1.5, 2, 0.3), bz); col.resolveCircle(this.pos, 0.4, this.pos.y + 0.5, this.pos.y + 1.7);
          G.fx.smoke(this.centre(), 4, '#2a2236', 1.3, 1); this.cool = Math.min(this.cool, 0.3); if (G.audio) G.audio.burst(0.2, 0.05, 1500, 'bandpass');
        }
        if (dist > 2.0) { mx = dx / dist; mz = dz / dist; sp = boss ? 7.5 : 6.5; }
        if (this.cool <= 0 && dist < 2.5) { this.cool = boss ? 1.0 : 1.4; this.wind = { t: 0.25, anim: 'slash', fn: () => { const f = V().set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); this.anim = 'slash2'; G.combat.villainStrike({ kind: 'sphere', c: this.centre().addScaledVector(f, 1.2), r: 1.3 }, { dmg: boss ? 16 : 9, knock: 6, dir: f, src: this }); G.fx.beam(this.centre().add(V().set(-f.z, 0.3, f.x)), this.centre().add(V().set(f.z, -0.3, -f.x)).addScaledVector(f, 1.2), '#c9a6ff', 0.05, 0.15); } }; }
        else if (this.cool <= 0 && dist > 7 && dist < 32) { this.cool = boss ? 1.8 : 2.4; this.wind = { t: 0.3, anim: 'castR', fn: () => this.stars(boss ? 5 : 1) }; }
        if (boss) { this.callT -= dt; if (this.callT <= 0) { this.callT = 14; for (let k = 0; k < 2; k++) this.sys.spawnExtra('ninja', this.pos.clone().add(V().set((k - 0.5) * 3, 0, 1.5))); G.ui.toast('Shade calls shadow clones out of the dark.', 'warn'); } }
        this.yaw = dampAngle(this.yaw, toYaw, 10, dt);
      } else if (this.kind === 'vcore') {   // Vektor: hovers high, lasers, calls hijacked drones
        const a = t * 0.3 + this.strafe, tx = P.x + Math.cos(a) * 14, tz = P.z + Math.sin(a) * 14, ty = P.y + this.hover;
        this.pos.x = damp(this.pos.x, tx, 0.7, dt); this.pos.z = damp(this.pos.z, tz, 0.7, dt); this.pos.y = damp(this.pos.y, ty, 1, dt);
        if (this.cool <= 0) { this.cool = 2.8; this.aimAt = H.centre().clone(); this.wind = { t: 0.8, anim: 'idle', fn: () => this.laser() }; }
        this.callT -= dt; if (this.callT <= 0) { this.callT = 12; for (let k = 0; k < 2; k++) this.sys.spawnExtra('hdrone', this.pos.clone().add(V().set((k - 0.5) * 4, -1, 0))); G.ui.toast('Vektor hijacks two more drones.', 'warn'); }
        this.yaw = dampAngle(this.yaw, toYaw, 3, dt);
      } else { // drone: circle the hero overhead, shoot
        const a = t * 0.6 + this.strafe * 2, tx = P.x + Math.cos(a) * 10, tz = P.z + Math.sin(a) * 10, ty = P.y + this.hover;
        this.pos.x = damp(this.pos.x, tx, 1.2, dt); this.pos.z = damp(this.pos.z, tz, 1.2, dt); this.pos.y = damp(this.pos.y, ty, 1.5, dt);
        if (this.cool <= 0) { this.cool = 2 + Math.random() * 0.8; this.shoot(); }
        this.yaw = dampAngle(this.yaw, toYaw, 5, dt);
      }
    } else { // smashing up the street until a hero comes
      const s = this.sys.raid ? this.sys.raid.site : this.pos, ddx = s.x - this.pos.x, ddz = s.z - this.pos.z, dd = Math.hypot(ddx, ddz);
      if (!this.flying) {
        if (dd > 12) { mx = ddx / dd; mz = ddz / dd; sp = 2.5; this.yaw = dampAngle(this.yaw, Math.atan2(ddx, ddz), 5, dt); }
        this.smashT -= dt;
        if (this.smashT <= 0 && dist < 150 && G.damage.markList.length < 120) { this.smashT = 6 + Math.random() * 6; this.yaw += (Math.random() - 0.5) * 2.5; this.wind = { t: 0.4, anim: 'heavy', fn: () => { const c = V().set(this.pos.x, this.pos.y + 1.2, this.pos.z), f = V().set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); if (!G.damage.wallHit(c, f, 4, 1.1, 'blunt', { quiet: dist > 60 })) G.damage.impact(V().set(this.pos.x + f.x * 1.5, col.groundAt(this.pos.x + f.x * 1.5, this.pos.z + f.z * 1.5, this.pos.y + 1, 1, 0.2), this.pos.z + f.z * 1.5), V().set(0, 1, 0), 0.9, 'blunt', { quiet: dist > 60 }); this.scare(); } }; }
      } else { this.pos.y = damp(this.pos.y, col.groundAt(this.pos.x, this.pos.z, this.pos.y, 2, 0.3) + this.hover, 1, dt); if (this.kind === 'vcore' && Math.random() < dt * 0.4) { const g = V().set(this.pos.x + (Math.random() - 0.5) * 20, 0, this.pos.z + (Math.random() - 0.5) * 20); g.y = col.groundAt(g.x, g.z, this.pos.y, 30, 0.3); G.fx.beam(this.pos.clone(), g, '#ff2a4f', 0.08, 0.2); G.damage.impact(g, V().set(0, 1, 0), 1.2, 'energy', { quiet: dist > 60 }); } this.pos.x += Math.cos(t * 0.4 + this.strafe) * dt * 2; this.pos.z += Math.sin(t * 0.4 + this.strafe) * dt * 2; }
    }
    if (!this.flying) {
      this.pos.x += (mx * sp + this.vel.x) * dt; this.pos.z += (mz * sp + this.vel.z) * dt;
      col.resolveCircle(this.pos, this.r, this.pos.y + 0.5, this.pos.y + 1.8);
      const g = col.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.6, 0.6, 0.3);
      if (this.air > 0 || this.vy > 0) { this.vy -= 22 * dt; this.air = Math.max(0, this.air + this.vy * dt); if (this.air <= 0) { this.vy = 0; if (this.vel.lengthSq() > 30) G.fx.dust(V().set(this.pos.x, g, this.pos.z), 6, 0.8); } }
      this.pos.y = g;
      if (sp > 0 && !this.wind && this.stun <= 0) this.anim = sp > 4 ? 'run' : 'walk';
      if (this.air > 0.2) this.anim = 'air';
    } else { this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt; this.pos.y += this.vel.y * dt; col.resolveCircle(this.pos, 0.6, this.pos.y - 0.4, this.pos.y + 0.4); }
    root.position.set(this.pos.x, this.pos.y + this.air, this.pos.z); root.rotation.y = this.yaw; root.scale.setScalar(this.baseScale * (this.flash > 0 ? 1 + this.flash * 1.3 : 1));   // a quick pop when hit
    if (this.flying) { for (const r of this.rig.rotors) r.rotation.z += dt * 45; root.rotation.z = Math.sin(t * 2 + this.strafe) * 0.1 + (this.stun > 0 ? Math.sin(t * 20) * 0.4 : 0); }
    else animateRig(this.rig, dt, this.anim, sp);
    if (this.flash > 0) { this.flash -= dt; if (Math.random() < 0.5) G.fx.glow.emit(this.pos.x, this.pos.y + (this.flying ? 0 : 1.1), this.pos.z, 0, 0, 0, '#ffffff', 0.08, 1.2, 0.8, 0, 0, 0.5); }
  }
  centre() { return V().set(this.pos.x, this.pos.y + this.air + this.h, this.pos.z); }
  // a training robot: stands at its post facing you, takes everything, never hits back
  dummyStep(dt, t, toYaw) {
    const root = this.rig.root, k = Math.exp(-4 * dt); this.vel.x *= k; this.vel.z *= k;
    this.pos.x += (this.vel.x + (this.home.x - this.pos.x) * 1.5) * dt; this.pos.z += (this.vel.z + (this.home.z - this.pos.z) * 1.5) * dt;
    if (this.vy > 0 || this.air > 0) { this.vy -= 22 * dt; this.air = Math.max(0, this.air + this.vy * dt); if (this.air <= 0) this.vy = 0; }
    this.stun = 0; this.burn = Math.max(0, this.burn - dt); if (this.cocoon && this.cocoon.visible && Math.random() < dt) this.cocoon.visible = false;
    this.yaw = dampAngle(this.yaw, toYaw, 4, dt); this.flash = Math.max(0, this.flash - dt);
    root.position.set(this.pos.x, this.pos.y + this.air, this.pos.z); root.rotation.y = this.yaw; root.scale.setScalar(this.baseScale * (this.flash > 0 ? 1 + this.flash * 1.3 : 1));
    animateRig(this.rig, dt, this.flash > 0 ? 'hurt' : 'guard', 0);
  }
  punch() {
    const f = V().set(Math.sin(this.yaw), 0, Math.cos(this.yaw)), c = this.centre().addScaledVector(f, 1.3);
    this.anim = 'punchR'; if (G.audio) G.audio.burst(0.12, 0.08, 400);
    G.combat.villainStrike({ kind: 'sphere', c, r: 1.3 }, { dmg: 10, knock: 7, dir: f, src: this });
  }
  slam() {
    const c = V().set(this.pos.x, this.pos.y + 0.3, this.pos.z);
    G.combat.villainStrike({ kind: 'sphere', c, r: 4.5 }, { dmg: 18, knock: 10, up: 4, from: c, copy: 'quake', src: this });
    G.fx.ring(c, RED, 0.5, 6, 0.45); G.fx.dust(c, 18, 2); G.fx.shake(0.25); G.damage.impact(V().set(c.x, c.y - 0.3, c.z), V().set(0, 1, 0), 2.2, 'blunt', { quiet: true });
    if (G.audio) G.audio.thud(0.8);
    if (G.heroes) G.heroes.saw('quake', this.pos);
  }
  shoot() {
    const H = G.heroes; if (!H || !H.alive) return;
    const from = this.flying ? V().copy(this.pos).add(V().set(0, -0.2, 0)) : this.rig.elbR.localToWorld(V().set(0, -0.36, 0.56)), aim = H.centre().clone();
    aim.x += G.player.vel.x * 0.25 + (Math.random() - 0.5) * 1.4; aim.z += G.player.vel.z * 0.25 + (Math.random() - 0.5) * 1.4; aim.y += (Math.random() - 0.5) * 0.8;
    const dir = aim.sub(from).normalize();
    this.sys.shoot({ from, dir, speed: this.flying ? 24 : 30, r: this.flying ? 0.22 : 0.15, color: this.flying ? '#ff6a00' : '#ff8a00', dmg: this.flying ? 9 : 8, knock: 4, blast: this.flying ? 2 : 0, copy: this.flying ? 'rockets' : 'volley', src: this });
    if (G.heroes) G.heroes.saw(this.flying ? 'rockets' : 'volley', this.pos);
    if (G.audio && G.player.pos.distanceTo(this.pos) < 50) G.audio.tone(this.flying ? 500 : 760, 0.1, 0.03, 'square', null, 0, 0.5);
  }
  stars(n) {
    const H = G.heroes; if (!H || !H.alive) return;
    const from = this.rig.elbR.localToWorld(V().set(0, -0.36, 0.05)), to = H.centre();
    for (let k = 0; k < n; k++) { const d = V().subVectors(to, from).normalize(), a = (k - (n - 1) / 2) * 0.12; d.set(d.x * Math.cos(a) - d.z * Math.sin(a), d.y, d.x * Math.sin(a) + d.z * Math.cos(a)); this.sys.shoot({ from: from.clone(), dir: d, speed: 34, r: 0.12, color: '#c9a6ff', dmg: this.kind === 'shade' ? 8 : 6, knock: 2, copy: 'volley', src: this }); }
    if (G.heroes) G.heroes.saw('volley', this.pos);
  }
  laser() {
    const from = this.pos.clone(), to = this.aimAt || G.heroes.centre(), d = V().subVectors(to, from).normalize(), end = from.clone().addScaledVector(d, 60), hitD = G.colliders.raycast(from.x, from.y, from.z, d.x, d.y, d.z, 60); end.copy(from).addScaledVector(d, hitD);
    G.fx.beam(from, end, '#ff2a4f', 0.5, 0.25); G.fx.beam(from, end, '#ffffff', 0.15, 0.25);
    G.combat.villainStrike({ kind: 'capsule', a: from, b: end, r: 1.1 }, { dmg: 14, knock: 8, kind: 'fire', copy: 'storm', src: this });
    if (hitD < 60) G.damage.impact(end, G.damage.normalAt(end, d), 2, 'energy', { quiet: false, color: '#ff2a4f' });
    if (G.heroes) G.heroes.saw('storm', this.pos); if (G.audio) G.audio.tone(300, 0.4, 0.06, 'sawtooth', null, 0, 2.5);
  }
  scare() {
    if (!G.npcs) return;
    for (const n of G.npcs.near) if (!n.inside && n.body === 'humanoid' && !n.hold && !n.converse && !(n.react && n.react.fall) && (n.pos.x - this.pos.x) ** 2 + (n.pos.z - this.pos.z) ** 2 < 25 * 25) { const dx = n.pos.x - this.pos.x, dz = n.pos.z - this.pos.z, d = Math.hypot(dx, dz) || 1; if (n.doing || n.path) n.interrupt(); n.react = { anim: 'run', t: 5, flee: [dx / d, dz / d] }; n.feel('alarm', 6); }
  }
}

// ---- things raids are about: a trapped resident, an armoured truck, the orbital lift's uplink ---------------------
const PRISONER_TOPS = ['#2c3e63', '#7a2f3b', '#2f6b55', '#c9b68f', '#4a3f6e', '#b8552a'];
class Cage {   // an energy cage with a resident inside: break it (it takes hits like an enemy) to let them out
  constructor(sys, pos) {
    this.sys = sys; this.pos = pos.clone(); this.h = 1.0; this.r = 0.9; this.alive = true; this.team = 'cage'; this.name = 'Energy cage (someone inside)'; this.hp = this.max = 60; this.big = true;
    const g = (this.g = new THREE.Group()); g.position.copy(pos); G.scene.add(g);
    const bar = std('#20242c', 0.4, 0.8);
    for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283, m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 6), bar); m.position.set(Math.cos(a) * 0.85, 1.1, Math.sin(a) * 0.85); g.add(m); }
    for (const y of [0.05, 2.2]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.05, 6, 28), neon('#ff2a4f', 1.6)); r.rotation.x = Math.PI / 2; r.position.y = y; g.add(r); }
    this.rig = makeHumanoid({ kind: 'human', skin: ['#f1c9a5', '#c68d6b', '#7b4a2f'][Math.floor(Math.random() * 3)], top: PRISONER_TOPS[Math.floor(Math.random() * PRISONER_TOPS.length)], bottom: '#1c1f27', hairStyle: Math.floor(Math.random() * 13), height: 1.65 + Math.random() * 0.2 });
    this.rig.root.position.copy(pos); G.scene.add(this.rig.root); this.runT = 0; this.yaw = Math.random() * 6.28;
    G.combat.add(this);
  }
  hit(dmg) { if (!this.alive) return; this.hp -= dmg; G.fx.spark(V().set(this.pos.x, this.pos.y + 1.2, this.pos.z), '#ff2a4f', 6, 4, 0.3, 0.1); if (this.hp <= 0) this.free(); }
  free() {
    this.alive = false; G.combat.remove(this); this.g.removeFromParent(); this.runT = 4;
    G.fx.ring(V().set(this.pos.x, this.pos.y + 1, this.pos.z), '#7dff9c', 0.3, 3, 0.4); G.fx.spark(V().set(this.pos.x, this.pos.y + 1.2, this.pos.z), '#7dff9c', 16, 5, 0.5, 0.12);
    if (G.audio) G.audio.tone(880, 0.2, 0.05, 'triangle');
    this.sys.raid && (this.sys.raid.freed = (this.sys.raid.freed || 0) + 1);
  }
  update(dt) {
    if (this.alive) { animateRig(this.rig, dt, Math.floor(G.elapsed / 2) % 2 ? 'wave' : 'idle', 0); this.rig.root.rotation.y = this.yaw; return; }
    if (this.runT > 0) { this.runT -= dt; this.pos.x += Math.sin(this.yaw) * 5 * dt; this.pos.z += Math.cos(this.yaw) * 5 * dt; this.pos.y = G.colliders.groundAt(this.pos.x, this.pos.z, this.pos.y + 1, 1, 0.3); G.colliders.resolveCircle(this.pos, 0.3, this.pos.y + 0.5, this.pos.y + 1.6); this.rig.root.position.copy(this.pos); this.rig.root.rotation.y = this.yaw; animateRig(this.rig, dt, 'run', 5); if (this.runT <= 0) this.rig.root.removeFromParent(); }
  }
  remove() { this.alive = false; G.combat.remove(this); this.g.removeFromParent(); this.rig.root.removeFromParent(); }
}
class Truck {   // an armoured getaway truck: stop it before it is 450 m away
  constructor(sys, pos) {
    this.sys = sys; this.start = pos.clone(); this.pos = pos.clone(); this.h = 1.3; this.r = 2.0; this.alive = true; this.team = 'villain'; this.big = true; this.name = 'Armoured truck'; this.hp = this.max = 420; this.speed = 7;
    // head off along the longest open street from here
    let best = 0; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, d = G.colliders.raycast(pos.x, pos.y + 1, pos.z, Math.sin(a), 0, Math.cos(a), 200); if (d > best) { best = d; this.yaw = a; } }
    const g = (this.g = new THREE.Group()); G.scene.add(g); const dark = std('#2b2e36', 0.5, 0.7);
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 4.2), dark); body.position.set(0, 1.5, -0.6); body.castShadow = true; g.add(body);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.8, 1.6), std('#3a3f48', 0.4, 0.7)); cab.position.set(0, 1.3, 2.2); cab.castShadow = true; g.add(cab);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.6, 0.05), std('#1a2230', 0.1, 0.9)); glass.position.set(0, 1.7, 3.0); g.add(glass);
    for (const sx of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.05), neon('#ff2a2a', 2)); l.position.set(sx * 0.8, 2.66, -2.7); g.add(l); for (const z of [-1.8, 0.6, 2.2]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 12), std('#14151a', 0.8, 0.1)); w.rotation.z = Math.PI / 2; w.position.set(sx * 1.15, 0.5, z); g.add(w); } }
    G.combat.add(this);
  }
  hit(dmg) { if (!this.alive) return; this.hp -= dmg; G.fx.spark(V().set(this.pos.x, this.pos.y + 1.5, this.pos.z), '#ffd34d', 6, 5, 0.3, 0.1); if (this.hp <= 0) this.stop(true); }
  stop(wrecked) {
    this.alive = false; G.combat.remove(this); this.done = wrecked ? 'stopped' : 'escaped';
    if (wrecked) { const c = V().set(this.pos.x, this.pos.y + 1.5, this.pos.z); G.fx.blast(c, '#ff8a3c', 0.5, 4, 0.4); G.fx.smoke(c, 8, '#1c1d22', 3, 2.5); G.ui.toast('The truck is stopped. The stolen credit cores are safe.', 'good'); if (G.audio) G.audio.burst(0.8, 0.25, 200); }
    else { this.g.removeFromParent(); G.ui.toast('The armoured truck got away.', 'warn'); }
  }
  update(dt, t) {
    if (!this.alive) { if (this.done === 'stopped' && Math.random() < dt * 4) G.fx.smoke(V().set(this.pos.x, this.pos.y + 2.4, this.pos.z), 1, '#1c1d22', 2, 2); return; }
    const col = G.colliders, fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    if (col.raycast(this.pos.x, this.pos.y + 1, this.pos.z, fx, 0, fz, 7) < 6) { const l = col.raycast(this.pos.x, this.pos.y + 1, this.pos.z, fz, 0, -fx, 120), r = col.raycast(this.pos.x, this.pos.y + 1, this.pos.z, -fz, 0, fx, 120); this.yaw += l > r ? Math.PI / 2 : -Math.PI / 2; }
    const sp = this.speed * (this.hp < this.max * 0.4 ? 0.6 : 1);
    this.pos.x += Math.sin(this.yaw) * sp * dt; this.pos.z += Math.cos(this.yaw) * sp * dt; this.pos.y = col.groundAt(this.pos.x, this.pos.z, this.pos.y + 1, 1, 1);
    this.g.position.copy(this.pos); this.g.rotation.y = this.yaw;
    if (Math.random() < dt * 8) G.fx.smoke(V().set(this.pos.x - Math.sin(this.yaw) * 3, this.pos.y + 0.6, this.pos.z - Math.cos(this.yaw) * 3), 1, '#5a5f6a', 0.6, 0.6);
    if (this.pos.distanceTo(this.start) > 450) this.stop(false);
  }
  remove() { this.alive = false; G.combat.remove(this); this.g.removeFromParent(); }
}
class Uplink {   // the orbital lift's uplink: the crew try to break it; heroes hold them off for three waves
  constructor(pos) {
    this.pos = pos.clone(); this.hp = this.max = 600;
    const g = (this.g = new THREE.Group()); g.position.copy(pos); G.scene.add(g);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.0, 0.6, 20), std('#2b303a', 0.4, 0.8)); base.position.y = 0.3; g.add(base);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 4.5, 14), std('#cfd6e0', 0.3, 0.7)); mast.position.y = 2.8; mast.castShadow = true; g.add(mast);
    this.rings = [1.4, 2.6, 3.8].map((y) => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.06, 6, 30), neon('#59e0ff', 1.6)); r.rotation.x = Math.PI / 2; r.position.y = y; g.add(r); return r; });
  }
  damage(d) { if (this.hp <= 0) return; this.hp -= d; this.flash = 0.2; G.fx.spark(V().set(this.pos.x, this.pos.y + 2.5, this.pos.z), '#ff2a4f', 6, 4, 0.3, 0.1); }
  update(dt, t) { this.flash = Math.max(0, (this.flash || 0) - dt); this.rings.forEach((r, i) => { r.rotation.z = t * (1 + i); r.material.color.set(this.flash > 0 ? '#ff2a4f' : '#59e0ff').multiplyScalar(this.hp > 0 ? 1.6 : 0.2); }); }
  remove() { this.g.removeFromParent(); }
}

// ---- Vektor and Shade as bosses in their own arenas ------------------------------------------------------------
class Pylon {   // Vektor's shield pylons: break all four to drop his shield
  constructor(sys, pos) {
    this.pos = pos.clone(); this.h = 1.5; this.r = 1.1; this.alive = true; this.team = 'villain'; this.name = 'Shield pylon'; this.hp = this.max = 140; this.big = true;
    const g = (this.g = new THREE.Group()); g.position.copy(pos); G.scene.add(g);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.7, 3, 8), std('#1c1e24', 0.4, 0.8)); m.position.y = 1.5; m.castShadow = true; g.add(m);
    this.cap = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 8), neon('#ff2a4f', 2)); this.cap.position.y = 3.2; g.add(this.cap);
    G.combat.add(this);
  }
  hit(d) { if (!this.alive) return; this.hp -= d; G.fx.spark(V().set(this.pos.x, this.pos.y + 2, this.pos.z), '#ff2a4f', 6, 4, 0.3, 0.1); if (this.hp <= 0) { this.alive = false; G.combat.remove(this); G.fx.blast(V().set(this.pos.x, this.pos.y + 2, this.pos.z), '#ff2a4f', 0.3, 3, 0.35); this.cap.visible = false; if (G.audio) G.audio.burst(0.4, 0.15, 400); } }
  update(dt, t, link) { if (this.alive && link && Math.random() < dt * 20) G.fx.beam(V().set(this.pos.x, this.pos.y + 3.2, this.pos.z), link.pos.clone(), '#ff2a4f', 0.05, 0.06); }
  remove() { this.alive = false; G.combat.remove(this); this.g.removeFromParent(); }
}
class BossFoe extends Foe {
  constructor(sys, kind, pos, cfg) {
    sys.bossSpawn = true; super(sys, kind, pos); sys.bossSpawn = false;
    Object.assign(this, cfg); this.hp = Math.round(this.hp * G.heroes.diff.hp); this.max = this.hp; this.isBoss = true; this.state = 'fight'; this.callT = 8;
    if (kind === 'vcore') { this.rig.root.scale.setScalar(2.2); this.r = 3.4; this.hover = 10; this.sweepT = 7; }
    else { this.rig.root.scale.setScalar(1.15); this.decoyT = 6; }
    this.baseScale = this.rig.root.scale.x;
    this.pylons = [];
  }
  hit(dmg, dir, o = {}) {
    if (this.shield) { G.fx.ring(this.pos.clone(), '#ff2a4f', 3.5, 4.2, 0.25); return; }
    super.hit(dmg, dir, o);
    if (this.kind === 'vcore' && !this.shieldDone && this.alive && this.hp <= this.max * 0.5) this.raiseShield();
  }
  raiseShield() {
    this.shield = true; this.shieldDone = true; const A = this.sys.bossArena;
    this.pylons = [[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([sx, sz]) => { const x = A.x + sx * 17, z = A.z + sz * 17; return new Pylon(this.sys, V().set(x, G.colliders.groundAt(x, z, A.y + 3, 4, 0.5), z)); });
    G.ui.flash('SHIELD UP', 1.6); G.ui.toast('Vektor raises a shield. Break the four pylons at the corners of the roof.', 'warn'); say('vektor', 'Vektor', 'Shield online. You are a rounding error.');
    if (!this.dome) { this.dome = new THREE.Mesh(new THREE.SphereGeometry(4.2, 20, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2a4f').multiplyScalar(0.45), transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })); G.scene.add(this.dome); }
    this.dome.visible = true;
  }
  update(dt, t) {
    const H = G.heroes, A = this.sys.bossArena;
    if (this.kind === 'vcore' && this.alive) {
      for (const p of this.pylons) p.update(dt, t, this.shield ? this : null);
      if (this.shield && this.pylons.every((p) => !p.alive)) { this.shield = false; if (this.dome) this.dome.visible = false; G.ui.flash('SHIELD DOWN', 1.4); this.stun = 2.5; }
      if (this.dome) this.dome.position.copy(this.pos);
      // a sweeping laser across the roof
      this.sweepT -= dt;
      if (this.sweepT <= 0 && !this.sweep && H && H.alive) { this.sweepT = 11; this.sweep = { t: 0, a0: Math.atan2(G.player.pos.z - this.pos.z, G.player.pos.x - this.pos.x) - 1.2 }; G.ui.toast('Vektor sweeps the roof with a laser: jump it or get behind cover.', 'warn'); }
      if (this.sweep) {
        const s = this.sweep; s.t += dt; const a = s.a0 + s.t * 1.2, end = V().set(this.pos.x + Math.cos(a) * 34, A.y + 0.8, this.pos.z + Math.sin(a) * 34);
        G.fx.beam(this.pos.clone(), end, '#ff2a4f', 0.45, 0.06); G.fx.beam(this.pos.clone(), end, '#ffffff', 0.12, 0.06);
        s.k = (s.k || 0) - dt; if (s.k <= 0) { s.k = 0.12; G.combat.villainStrike({ kind: 'capsule', a: this.pos.clone(), b: end, r: 0.9 }, { dmg: 7, knock: 6, up: 3, kind: 'fire', copy: 'storm' }); }
        if (s.t > 2.4) this.sweep = null;
      }
    }
    if (this.kind === 'shade' && this.alive) {
      this.decoyT -= dt;
      if (this.decoyT <= 0) { this.decoyT = this.hp < this.max * 0.5 ? 8 : 11; for (let k = 0; k < 3; k++) { const a = k * 2.1, q = V().set(G.player.pos.x + Math.cos(a) * 6, 0, G.player.pos.z + Math.sin(a) * 6); const f = this.sys.spawnExtra('ninja', q); if (f) { f.hp = f.max = 1; f.name = 'Shadow copy'; G.fx.smoke(f.centre(), 4, '#2a2236', 1.3, 1); } } G.ui.toast('Shade splits into shadow copies. One hit pops a copy.', 'warn'); if (!this.saidDecoy) { this.saidDecoy = true; say('shade', 'Shade', 'Which one of us is real?'); } }
      if (this.hp < this.max * 0.5 && (this.blinkT ?? 0) > 2.6) this.blinkT = 2.6;
    }
    super.update(dt, t);
    if (this.kind === 'vcore' && this.alive) { const ox = this.pos.x - A.x, oz = this.pos.z - A.z, d = Math.hypot(ox, oz); if (d > 26) { this.pos.x = A.x + ox / d * 26; this.pos.z = A.z + oz / d * 26; } this.pos.y = Math.max(this.pos.y, A.y + 6); }
    this.sys.fightText = `${Math.ceil(Math.max(0, this.hp))} / ${this.max}${this.shield ? ' · shielded: break the pylons' : this.kind === 'shade' && this.hp < this.max * 0.5 ? ' · faster' : ''}`;
  }
  stars(n) { super.stars(this.hp < this.max * 0.5 ? 9 : 6); void n; }
  remove() { super.remove(); for (const p of this.pylons) p.remove(); if (this.dome) this.dome.removeFromParent(); }
}

// ---- Kurozan ----------------------------------------------------------------------------------------------
class Kurozan {
  constructor(sys, at) {
    this.sys = sys; this.name = KUROZAN.short; this.title = KUROZAN.name; this.hp = this.max = Math.round(KUROZAN.hp * G.heroes.diff.hp); this.boss = true; this.big = true;
    this.pos = at.clone(); this.vel = V(); this.yaw = Math.PI; this.alive = true; this.team = 'villain'; this.h = 3.6; this.r = 2.4;
    this.phase = 'giant'; this.cool = 2.5; this.roarT = 18; this.wind = null; this.stun = 0; this.anim = 'idle'; this.t = 0; this.burn = 0;
    const SC = 3.6;
    this.rig = makeHumanoid(KUROZAN.look); this.rig.root.scale.setScalar(SC); this.SC = SC; G.scene.add(this.rig.root);
    const club = new THREE.Group(); club.position.set(0, -0.36, 0.04); this.rig.elbR.add(club);
    const iron = std('#2a2c33', 0.5, 0.85), gold = std('#c9a227', 0.35, 0.9);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 1.25, 10), iron); shaft.position.y = -0.55; club.add(shaft);
    for (let k = 0; k < 8; k++) { const s = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 6), iron); const a = k * 0.785, y = -0.75 - (k % 3) * 0.14; s.position.set(Math.cos(a) * 0.085, y, Math.sin(a) * 0.085); s.rotation.set(Math.sin(a) * 1.57, 0, -Math.cos(a) * 1.57); club.add(s); }
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 10), gold); band.position.y = -0.2; club.add(band);
    const helm = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.22), gold); helm.position.set(0, 0.17, -0.01); this.rig.head.add(helm);
    for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.012, 0.01), neon(RED, 2.5)); e.position.set(sx * 0.043, 0.022, 0.12); this.rig.head.add(e); }
    for (const m of [shaft, band, helm]) m.castShadow = true;
    // the dragon (built now, shown in the second half)
    const dg = (this.dragon = new THREE.Group()); dg.visible = false; G.scene.add(dg);
    const scale = std('#7a1f1a', 0.55, 0.3), belly = std('#c9a227', 0.5, 0.4), glow = neon('#ff6a3c', 1.8);
    this.segs = [];
    for (let i = 0; i < 22; i++) {
      const s = new THREE.Group(), r = i === 0 ? 1.7 : 1.5 * (1 - i / 30);
      const body = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), scale); body.scale.set(1, 0.85, 1.35); body.castShadow = true; s.add(body);
      const b2 = new THREE.Mesh(new THREE.SphereGeometry(r * 0.75, 10, 8), belly); b2.position.y = -r * 0.35; b2.scale.set(1, 0.6, 1.3); s.add(b2);
      if (i > 0 && i % 2 === 0) { const fin = new THREE.Mesh(new THREE.ConeGeometry(r * 0.28, r * 1.1, 6), belly); fin.position.y = r * 0.9; s.add(fin); }
      if (i === 0) { // the head: jaw, glowing eyes, a mane of spines
        const jaw = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.55, 2.0), scale); jaw.position.set(0, -0.5, 1.4); jaw.castShadow = true; s.add(jaw); this.jaw = jaw;
        const snout = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.75, 2.0), scale); snout.position.set(0, 0.25, 1.5); s.add(snout);
        for (const sx of [-1, 1]) { const ey = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), glow); ey.position.set(sx * 0.6, 0.55, 1.1); s.add(ey); const sp = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.6, 6), belly); sp.position.set(sx * 0.7, 1.0, -0.4); sp.rotation.x = -0.9; sp.rotation.z = sx * 0.3; s.add(sp); }
      }
      dg.add(s); this.segs.push({ g: s, p: V(), r });
    }
    this.proxies = [];
    G.combat.add(this);
  }
  centre() { if (this.phase === 'dragon') return this.segs[0].p.clone(); return V().set(this.pos.x, this.pos.y + this.h, this.pos.z); }
  hit(dmg, dir, o = {}) {
    if (!this.alive || this.phase === 'turn') return;
    this.hp -= dmg * (this.phase === 'dragon' && this.diveT <= 0 ? 0.8 : 1);
    if (this.phase === 'giant') { this.vel.x += dir.x * (o.knock || 0) * 0.15; this.vel.z += dir.z * (o.knock || 0) * 0.15; if (o.stun) this.stun = Math.max(this.stun, Math.min(1.2, o.stun * 0.3)); }
    if (o.kind === 'fire') this.burn = Math.max(this.burn, 1.5);
    if (this.phase === 'giant' && this.hp <= this.max * 0.5) this.transform();
    if (this.hp <= 0) this.defeat();
  }
  transform() {
    this.phase = 'turn'; this.turnT = 0; this.wind = null;
    G.heroes.showCard(artUrl('villain-dragon.jpg'), 'The Storm Dragon', 'Kurozan shows his true form', '#ff6a3c', 4, true, 'dragon'); say('kurozan', 'Kurozan', 'You think this is my true strength? Look up, little hero.'); sting('rise');
    if (G.audio) { G.audio.thunder(); G.audio.tone(90, 2.2, 0.12, 'sawtooth', null, 0.3, 0.5); }
  }
  defeat() {
    this.alive = false; this.phase = 'down'; this.downT = 0; G.combat.remove(this); for (const p of this.proxies) G.combat.remove(p);
    G.ui.flash('KUROZAN DEFEATED', 3); if (G.audio) G.audio.thunder(); say('kurozan', 'Kurozan', 'The storm... will return.');
    this.sys.bossDown('kurozan');
  }
  remove() { this.rig.root.removeFromParent(); this.dragon.removeFromParent(); G.combat.remove(this); for (const p of this.proxies) G.combat.remove(p); this.alive = false; }
  update(dt, t) {
    this.t += dt; const H = G.heroes, P = G.player.pos, C = this.sys.arena;
    if (this.burn > 0) { this.burn -= dt; this.hp -= 5 * dt; if (Math.random() < dt * 12) G.fx.fire(this.centre().add(V().set((Math.random() - 0.5) * 2, -1, (Math.random() - 0.5) * 2)), 2, 1); }
    if (this.phase === 'giant') this.giant(dt, t, H, P);
    else if (this.phase === 'turn') {
      this.turnT += dt; const k = this.turnT;
      this.rig.root.position.y = this.pos.y + k * k * 6; this.rig.root.rotation.y += dt * k * 3;
      if (Math.random() < dt * 30) G.fx.bolt(V().set(this.pos.x + (Math.random() - 0.5) * 10, this.pos.y + 30, this.pos.z + (Math.random() - 0.5) * 10), this.centre().setY(this.rig.root.position.y + 3), '#ff9a6a', 0.12, 0.2, 2);
      if (Math.random() < dt * 10) G.fx.smoke(this.centre().setY(this.rig.root.position.y + 2), 3, '#1c1d22', 4, 3);
      if (k > 2.6 && !this.dragon.visible) {
        this.rig.root.visible = false; this.dragon.visible = true; G.fx.blast(this.centre().setY(this.rig.root.position.y + 3), '#ff6a3c', 1, 12, 0.7); G.fx.shake(1);
        const h = V().set(this.pos.x, this.rig.root.position.y + 3, this.pos.z); for (const s of this.segs) s.p.copy(h).add(V().set(0, -s.r, 0));
        this.ang = Math.atan2(this.pos.z - C.z, this.pos.x - C.x); this.diveT = 0; this.cool = 3; this.mode = 'orbit';
        for (let i = 2; i < this.segs.length; i += 3) { const s = this.segs[i], me = this; const px = { pos: s.p, h: 0, r: s.r * 1.1, team: 'villain', alive: true, name: this.name, big: true, boss: true, get hp() { return me.hp; }, get max() { return me.max; }, hit: (d, dir, o) => me.hit(d * 0.85, dir, o) }; this.proxies.push(px); G.combat.add(px); }
      }
      if (k > 3.4) { this.phase = 'dragon'; this.h = 0; this.r = 2.2; }
    } else if (this.phase === 'dragon') this.dragonStep(dt, t, H, P, C);
    else if (this.phase === 'down') this.downStep(dt, t);
    this.pos.y = this.phase === 'giant' ? G.colliders.groundAt(this.pos.x, this.pos.z, this.pos.y + 1, 1, 1) : this.pos.y;
  }
  giant(dt, t, H, P) {
    const root = this.rig.root, dx = P.x - this.pos.x, dz = P.z - this.pos.z, d = Math.hypot(dx, dz), toYaw = Math.atan2(dx, dz); let sp = 0;
    this.anim = 'guard';
    const k = Math.exp(-3 * dt); this.vel.x *= k; this.vel.z *= k;
    if (this.stun > 0) { this.stun -= dt; this.anim = 'hurt'; }
    else if (this.wind) { const w = this.wind; w.t -= dt; this.anim = w.anim; this.yaw = dampAngle(this.yaw, toYaw, w.track || 2, dt); if (w.move) { this.pos.x += Math.sin(this.yaw) * w.move * dt; this.pos.z += Math.cos(this.yaw) * w.move * dt; sp = w.move; if (w.contact && d < 4) { w.contact = false; G.combat.villainStrike({ kind: 'sphere', c: this.centre(), r: 4 }, { dmg: 22, knock: 18, up: 6, dir: V().set(Math.sin(this.yaw), 0, Math.cos(this.yaw)) }); } } if (w.t <= 0) { this.wind = null; if (w.fn) w.fn(); } }
    else if (H && H.alive) {
      this.cool -= dt; this.roarT -= dt; this.yaw = dampAngle(this.yaw, toYaw, 3, dt);
      if (d > 6) { sp = d > 20 ? 4.5 : 3.2; this.pos.x += (dx / d) * sp * dt; this.pos.z += (dz / d) * sp * dt; this.anim = 'walk'; }
      if (this.roarT <= 0) { this.roarT = 22; this.wind = { t: 1.1, anim: 'raise', fn: () => this.roar() }; }
      else if (this.cool <= 0) {
        const r = Math.random();
        if (d < 9) { if (r < 0.55) { this.wind = { t: 1.0, anim: 'raise', track: 1.5, fn: () => this.slam() }; G.fx.zone(this.clubPoint(), 8.5, 1.0); } else this.wind = { t: 0.6, anim: 'guard', track: 4, fn: () => this.sweep() }; this.cool = 2.4; }
        else if (r < 0.5) { this.wind = { t: 0.8, anim: 'castR', track: 4, fn: () => this.throwRock() }; this.cool = 2.6; }
        else { this.wind = { t: 1.3, anim: 'dash', track: 1, move: 17, contact: true, fn: null }; this.cool = 3.2; G.ui.toast('Kurozan charges!', 'warn'); }
      }
    }
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    const C = this.sys.arena, ox = this.pos.x - C.x, oz = this.pos.z - C.z, od = Math.hypot(ox, oz); if (od > 34) { this.pos.x = C.x + ox / od * 34; this.pos.z = C.z + oz / od * 34; }
    root.position.copy(this.pos); root.rotation.y = this.yaw; animateRig(this.rig, dt, this.anim, sp);
    if (Math.random() < dt * 3) G.fx.spark(this.rig.elbR.localToWorld(V().set(0, -1.2, 0.04)), '#ff9a6a', 2, 2, 0.4, 0.2, -1);
    this.sys.fightText = `${Math.ceil(this.hp)} / ${this.max} · giant`;
  }
  clubPoint() { return V().set(this.pos.x + Math.sin(this.yaw) * 6, this.pos.y + 0.2, this.pos.z + Math.cos(this.yaw) * 6); }
  slam() {
    const c = this.clubPoint();
    G.combat.villainStrike({ kind: 'sphere', c, r: 8.5 }, { dmg: 28, knock: 15, up: 7, from: c, copy: 'club' });
    G.fx.ring(c, RED, 0.5, 11, 0.6); G.fx.ring(c, '#ffb347', 0.5, 7, 0.4); G.fx.dust(c, 34, 3); G.fx.shake(0.9); G.damage.impact(c, V().set(0, 1, 0), 6, 'blunt');
    if (G.heroes) G.heroes.saw('club', this.pos);
  }
  sweep() { const f = V().set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); this.anim = 'slash'; G.combat.villainStrike({ kind: 'cone', o: this.centre(), dir: f, range: 9.5, cos: Math.cos(1.0) }, { dmg: 22, knock: 17, up: 4 }); G.fx.ring(V().set(this.pos.x, this.pos.y + 2.5, this.pos.z), '#ffb347', 2, 9, 0.35); if (G.audio) G.audio.burst(0.3, 0.12, 700, 'bandpass'); }
  throwRock() {
    const H = G.heroes; if (!H || !H.alive) return;
    const from = this.rig.elbR.localToWorld(V().set(0, -0.4, 0.04)), to = H.centre().clone(), dist = from.distanceTo(to), T = Math.max(0.7, dist / 26), dir = V().subVectors(to, from).divideScalar(T); dir.y += 0.5 * 16 * T;
    const sp = dir.length();
    this.sys.shoot({ from, dir: dir.normalize(), speed: sp, r: 0.9, color: '#5a4a40', dmg: 25, knock: 12, blast: 4, power: 4, grav: 16, rock: true });
    G.fx.zone(V().set(to.x, G.colliders.groundAt(to.x, to.z, to.y + 1, 3, 0.3), to.z), 4, T);
  }
  roar() { const c = this.centre(); G.fx.ring(c, RED, 1, 22, 0.8); G.fx.ring(c, RED, 1, 14, 0.6); G.fx.shake(0.6); if (G.audio) G.audio.tone(70, 1.6, 0.14, 'sawtooth', null, 0.1, 0.6); say('kurozan', 'Kurozan', 'Is this the best Neo Central has?'); if (G.player.pos.distanceTo(this.pos) < 20 && G.heroes) G.heroes.hurt(6, V().subVectors(G.player.pos, this.pos).setY(0).normalize(), { knock: 9, up: 3 }); }
  dragonStep(dt, t, H, P, C) {
    const head = this.segs[0]; this.cool -= dt; this.diveT = Math.max(0, (this.diveT || 0) - dt);
    let target;
    if (this.mode === 'orbit') {
      this.ang += dt * 0.45; target = V().set(C.x + Math.cos(this.ang) * 30, C.y + 20 + Math.sin(t * 0.7) * 5, C.z + Math.sin(this.ang) * 30);
      if (this.cool <= 0 && H && H.alive) { const r = Math.random(); this.cool = 4.5; if (r < 0.4) { this.mode = 'breath'; this.modeT = 2.4; G.ui.toast('The dragon breathes storm fire!', 'warn'); } else if (r < 0.7) { this.mode = 'balls'; this.modeT = 1.2; this.shots = 3; } else { this.mode = 'dive'; this.modeT = 4; this.diveAt = P.clone(); G.fx.zone(P.clone(), 3.5, 1.4); G.ui.toast('The dragon dives! Hit it while it is low.', 'warn'); } }
    } else if (this.mode === 'breath') {
      this.modeT -= dt; this.ang += dt * 0.15; target = V().set(C.x + Math.cos(this.ang) * 26, C.y + 16, C.z + Math.sin(this.ang) * 26);
      if (this.modeT < 2.0 && H && H.alive) { const to = H.centre().clone().add(V().set(Math.sin(t * 2) * 1.5, 0, Math.cos(t * 2) * 1.5)), from = head.p.clone(); this.breathTo = (this.breathTo || to.clone()).lerp(to, Math.min(1, dt * 1.8)); const end = this.breathTo; G.fx.beam(from, end, '#ff5a2a', 0.9, 0.1); G.fx.bolt(from, end, '#ffd0b0', 0.08, 0.1, 1.5); G.fx.spray(end, V().set(0, 1, 0), '#ff7a1a', 4, 4, 1.5, 0.5, 0.4, 0.1, -1);
        if (Math.random() < dt * 10) G.combat.villainStrike({ kind: 'capsule', a: from, b: end, r: 1.6 }, { dmg: 6, knock: 3, kind: 'fire', copy: 'storm' }); if (Math.random() < dt * 3) G.damage.impact(V().set(end.x, G.colliders.groundAt(end.x, end.z, end.y + 1, 2, 0.3), end.z), V().set(0, 1, 0), 1.5, 'fire', { quiet: true }); if (G.heroes) G.heroes.saw('storm', G.player.pos); }
      if (this.modeT <= 0) { this.mode = 'orbit'; this.breathTo = null; }
    } else if (this.mode === 'balls') {
      this.modeT -= dt; this.ang += dt * 0.3; target = V().set(C.x + Math.cos(this.ang) * 28, C.y + 18, C.z + Math.sin(this.ang) * 28);
      if (this.shots > 0 && this.modeT < this.shots * 0.35 && H && H.alive) { this.shots--; const from = head.p.clone(), to = H.centre().clone(); to.x += (Math.random() - 0.5) * 4; to.z += (Math.random() - 0.5) * 4; this.sys.shoot({ from, dir: V().subVectors(to, from).normalize(), speed: 26, r: 0.7, color: '#ff6a3c', dmg: 18, knock: 9, blast: 3.5, power: 2.5, copy: 'storm' }); if (G.audio) G.audio.burst(0.4, 0.1, 400); }
      if (this.modeT <= 0) this.mode = 'orbit';
    } else if (this.mode === 'dive') {
      this.modeT -= dt; const u = 1 - this.modeT / 4;
      if (u < 0.35) target = V().set(this.diveAt.x, this.diveAt.y + 3, this.diveAt.z);
      else if (u < 0.8) { this.diveT = 0.5; const a = Math.atan2(head.p.z - C.z, head.p.x - C.x) + dt; target = V().set(C.x + Math.cos(a) * 14, C.y + 2.5, C.z + Math.sin(a) * 14); }
      else target = V().set(C.x + Math.cos(this.ang) * 30, C.y + 18, C.z + Math.sin(this.ang) * 30);
      if (H && H.alive && head.p.distanceTo(H.centre()) < 3.2 && !(this.diveHit > 0)) { this.diveHit = 1.5; G.combat.villainStrike({ kind: 'sphere', c: head.p, r: 3.2 }, { dmg: 25, knock: 16, up: 6 }); }
      this.diveHit = Math.max(0, (this.diveHit || 0) - dt);
      if (this.modeT <= 0) { this.mode = 'orbit'; this.ang = Math.atan2(head.p.z - C.z, head.p.x - C.x); }
    }
    // the head flies to its target; each segment follows the one in front
    const sp = this.mode === 'dive' ? 24 : 15, d = V().subVectors(target, head.p), L = d.length(); if (L > 0.05) head.p.addScaledVector(d, Math.min(1, (sp * dt) / L));
    const look = V();
    for (let i = 0; i < this.segs.length; i++) {
      const s = this.segs[i];
      if (i > 0) { const pr = this.segs[i - 1], gap = (pr.r + s.r) * 0.75, dd = V().subVectors(s.p, pr.p), l = dd.length(); if (l > gap) s.p.copy(pr.p).addScaledVector(dd, gap / l); s.p.y += Math.sin(t * 3 + i * 0.6) * 0.02; }
      s.g.position.copy(s.p);
      if (i === 0) look.copy(target); else look.copy(this.segs[i - 1].p);
      s.g.lookAt(look);
    }
    if (this.jaw) this.jaw.rotation.x = this.mode === 'breath' ? 0.45 : Math.sin(t * 2) * 0.05;
    if (Math.random() < dt * 6) G.fx.spark(this.segs[Math.floor(Math.random() * this.segs.length)].p, '#ffb347', 2, 2, 0.5, 0.15, -1);
    if (Math.random() < dt * 0.6) G.fx.bolt(head.p.clone().add(V().set(0, 8, 0)), head.p, '#ff9a6a', 0.1, 0.15, 2);
    this.pos.copy(head.p);
    this.sys.fightText = `${Math.ceil(Math.max(0, this.hp))} / ${this.max} · dragon${this.mode === 'dive' && this.diveT > 0 ? ' · LOW: hit it!' : ''}`;
  }
  downStep(dt, t) {
    this.downT += dt;
    if (this.dragon.visible) {
      for (const s of this.segs) { s.v = s.v || V().set((Math.random() - 0.5) * 6, Math.random() * 4, (Math.random() - 0.5) * 6); s.v.y -= 18 * dt; s.p.addScaledVector(s.v, dt); const g = G.colliders.groundAt(s.p.x, s.p.z, s.p.y + 2, 2, 0.5) + s.r * 0.6; if (s.p.y < g) { s.p.y = g; s.v.multiplyScalar(0.3); } s.g.position.copy(s.p); s.g.rotation.z += dt * 0.5; }
      if (Math.random() < dt * 8) { const s = this.segs[Math.floor(Math.random() * this.segs.length)]; G.fx.blast(s.p, '#ff8a3c', 0.3, 2.5, 0.35); G.fx.smoke(s.p, 2, '#1c1d22', 2.5, 2); }
    }
    if (this.downT > 4) { this.remove(); this.gone = true; }
  }
}

// ---- raids, projectiles, the boss fight -----------------------------------------------------------------------
export class Villains {
  constructor() {
    this.foes = []; this.raid = null; this.boss = null; this.proj = []; this.nextRaid = 30; this.trainLog = []; this.trainTotal = 0; this.dummies = []; this.erase = []; this.fightText = '';
    this.arena = (() => { const y = G.colliders.groundAt(STADIUM.x, STADIUM.z, 2, 2, 0.5); return V().set(STADIUM.x, y, STADIUM.z); })();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 160, 16, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(RED).multiplyScalar(0.6), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.visible = false; beam.frustumCulled = false; G.scene.add(beam); this.beacon = beam;
  }
  get st() { return G.heroes.st; }
  // a fight is on (or only just ended: the last blow of a raid or boss fight is not property damage)
  busy() { return !!((this.raid && this.raid.spawned) || this.boss || G.elapsed < (this.calmUntil || 0)); }
  busyNear(p) { if (this.boss) return p.distanceTo(this.bossArena) < 90; return !!(this.raid && this.raid.spawned && p.distanceTo(this.raid.site) < 70); }
  heroOn() { this.nextRaid = Math.min(this.nextRaid, 30); }
  heroOff() { this.endTraining(); this.endRaid(true); this.endBoss(true); for (const pr of this.proj) pr.orb.life = 0; this.proj.length = 0; }
  heroDown() {
    if (this.boss) { const b = this.boss; say(b.isBoss ? b.bossKind : 'kurozan', b.isBoss ? b.short : 'Kurozan', 'Come back when you are stronger.'); G.ui.toast(`${b.isBoss ? b.short : 'Kurozan'} leaves. Try again from the Hero Hall.`, 'warn'); this.endBoss(true); }
  }
  // the training ground at the Hero Hall: three robots that take every hit and never hit back
  startTraining() {
    const H = G.heroes, h = H.hall; this.endTraining(); this.endRaid(true); this.trainLog = []; this.trainTotal = 0; H.training = true;
    for (let k = 0; k < 3; k++) { const x = h.x + 10 + k * 4, z = h.z - 4 + (k % 2) * 3; const f = this.spawnExtra(k === 1 ? 'brute' : 'gunner', V().set(x, h.y, z)); f.dummy = true; f.name = 'Training robot'; f.hp = f.max = 4000; f.home = f.pos.clone(); this.dummies.push(f); }
    G.ui.toast('Training ground: three robots that never hit back, and a damage readout. Residents are left alone. End it from the Hero Hall.', 'good');
  }
  endTraining() { for (const f of this.dummies) if (!f.gone) { f.remove(); f.gone = true; } this.foes = this.foes.filter((f) => !f.gone); this.dummies = []; if (G.heroes) G.heroes.training = false; }
  trainRate() { const now = G.elapsed; this.trainLog = this.trainLog.filter((e) => now - e.t < 5); return this.trainLog.reduce((s, e) => s + e.d, 0) / 5; }
  onKill(f) {
    const s = this.st; s.kos = (s.kos || 0) + 1; if (G.heroes) G.heroes.addXp(f && f.big ? 60 : 12);
    if (f && f.isBoss) { this.bossDown(f.bossKind); return; }
    if (f && f.kind === 'vcore') { s.vektor = (s.vektor || 0) + 1; G.ui.flash("VEKTOR'S CORE DOWN", 1.8); }
    if (f && f.kind === 'shade') { s.shade = (s.shade || 0) + 1; G.ui.flash('SHADE DEFEATED', 1.8); }
  }
  spawnExtra(kind, pos) { const R = this.raid; pos.y = G.colliders.groundAt(pos.x, pos.z, (pos.y || G.player.pos.y) + 2, 4, 0.3); const f = new Foe(this, kind, pos); f.state = 'fight'; this.foes.push(f); if (R) R.foes.push(f); return f; }
  markers() {
    if (this.raid) return [{ x: this.raid.site.x, z: this.raid.site.z, color: RED, story: true }];
    if (this.boss) return [{ x: this.bossArena.x, z: this.bossArena.z, color: RED, story: true }];
    return [];
  }
  // a villain projectile: hits the hero, residents and walls
  shoot(o) { const pr = { pos: o.from.clone(), vel: o.dir.clone().multiplyScalar(o.speed), life: 4, ...o, orb: G.fx.orb(o.color, o.r) }; pr.orb.p.copy(pr.pos); this.proj.push(pr); }
  eraseNear(p, r, secs) { this.erase.push({ p: p.clone(), r, t: secs }); }
  stepProjectiles(dt) {
    const H = G.heroes, col = G.colliders;
    for (const e of this.erase) e.t -= dt; this.erase = this.erase.filter((e) => e.t > 0);
    for (let i = this.proj.length - 1; i >= 0; i--) {
      const pr = this.proj[i]; pr.life -= dt;
      if (pr.grav) pr.vel.y -= pr.grav * dt;
      const sp = pr.vel.length(), step = sp * dt, d = V().copy(pr.vel).divideScalar(sp || 1);
      let hit = null, hero = false;
      if (H && H.alive) { const c = H.centre(), b = clamp(V().subVectors(c, pr.pos).dot(d), 0, step); if (c.distanceTo(V().copy(pr.pos).addScaledVector(d, b)) < pr.r + 0.55) { hit = V().copy(pr.pos).addScaledVector(d, b); hero = true; } }
      if (!hit) { const w = col.raycast(pr.pos.x, pr.pos.y, pr.pos.z, d.x, d.y, d.z, step); if (w < step) hit = V().copy(pr.pos).addScaledVector(d, w); }
      if (!hit) { pr.pos.addScaledVector(d, step); const g = col.groundAt(pr.pos.x, pr.pos.z, pr.pos.y + 0.5, 1, 0.1); if (pr.pos.y < g + 0.05) { hit = pr.pos.clone(); hit.y = g; } }
      for (const e of this.erase) if ((hit || pr.pos).distanceTo(e.p) < e.r) { G.fx.spark(pr.pos, '#ff5a6e', 6, 3, 0.3, 0.1); pr.life = 0; hit = null; break; }
      pr.orb.p.copy(hit || pr.pos);
      if (Math.random() < 0.7) G.fx.glow.emit(pr.pos.x, pr.pos.y, pr.pos.z, 0, 0, 0, pr.rock ? '#ff9a6a' : pr.color, 0.3, pr.r * 1.2, 0.05, 0, 0, pr.rock ? 0.4 : 1);
      if (hit) {
        if (pr.blast) { G.combat.villainStrike({ kind: 'sphere', c: hit, r: pr.blast }, { dmg: pr.dmg, knock: pr.knock, up: 3, from: hit, copy: pr.copy, src: pr.src }); G.fx.blast(hit, pr.color, 0.3, pr.blast, 0.35); G.fx.ring(hit, pr.color, 0.3, pr.blast * 1.3, 0.35); if (pr.power) G.damage.burst(hit, pr.blast, pr.power, 'blunt', { quiet: false }); else G.damage.impact(hit, G.damage.normalAt(hit, d), 0.9, 'blunt', { quiet: true }); }
        else if (hero) G.combat.hitHero(pr.dmg, d.clone().setY(0).normalize(), { knock: pr.knock, copy: pr.copy, src: pr.src });
        else { G.damage.impact(hit, G.damage.normalAt(hit, d), 0.7, 'energy', { quiet: true, color: pr.color }); G.combat.villainStrike({ kind: 'sphere', c: hit, r: 0.8 }, { dmg: 0, knock: 4, from: hit }); }
        G.fx.spark(hit, pr.color, 8, 5, 0.3, 0.12); pr.life = 0;
      }
      if (pr.life <= 0) { pr.orb.life = 0; this.proj.splice(i, 1); }
    }
  }
  update(dt, t) {
    this.stepProjectiles(dt);
    const H = G.heroes, P = G.player.pos;
    for (let i = this.foes.length - 1; i >= 0; i--) { const f = this.foes[i]; f.update(dt, t); if (f.gone) this.foes.splice(i, 1); }
    if (this.boss) { this.boss.update(dt, t); if (this.boss && this.boss.gone) { this.boss = null; this.calmUntil = G.elapsed + 5; } }
    if (!this.boss && this.stormFrom) { G.env.setWeather('rain'); this.stormFrom = null; }
    if (H && H.on) H.bossBar(this.boss && this.boss.alive ? { title: this.boss.title, hp: this.boss.hp, max: this.boss.max, phaseText: this.fightText, face: this.boss.face || (this.boss.phase === 'dragon' ? 'villain-dragon.jpg' : 'villain-kurozan.jpg') } : null);
    if (!H || !H.on) return;
    // raids
    if (!this.raid && !this.boss && !H.training) { this.nextRaid -= dt; if (this.nextRaid <= 0) this.startRaid(H.missionRaid ? H.missionRaid() || {} : {}); }
    const R = this.raid;
    if (R) {
      R.t += dt; const d = Math.hypot(P.x - R.site.x, P.z - R.site.z);
      this.beacon.visible = true; this.beacon.position.set(R.site.x, R.site.y + 80, R.site.z); this.beacon.material.opacity = 0.25 + Math.sin(t * 4) * 0.1;
      if (!R.spawned && d < 240) { R.spawned = true; if (R.owner !== 'vektor' && R.owner !== 'shade') say('crew', 'Kurozan\'s robots', ['Street secured. Resistance will be removed.', 'This district now belongs to Kurozan.', 'Citizens: stay still. Or do not. We prefer it when you run.'][Math.floor(Math.random() * 3)]); }
      if (R.spawned && !R.built) this.buildRaidThings(R);
      if (R.spawned && R.queue.length) { const q = R.queue.shift(); const f = new Foe(this, q.kind, q.pos); this.foes.push(f); R.foes.push(f); }
      for (const c of R.cages || []) c.update(dt); if (R.truck) R.truck.update(dt, t); if (R.core) R.core.update(dt, t);
      const left = R.foes.filter((f) => f.alive || f.away > 0).length + R.queue.length;
      // defend: the next wave once this one is down; lost if the uplink falls
      if (R.type === 'defend' && R.spawned) {
        if (R.core.hp <= 0) { G.ui.flash('UPLINK LOST', 2); G.ui.toast("The uplink is down: the orbital lift is cut off until the city repairs it. The crew pull back.", 'warn'); this.endRaid(true); return; }
        if (left === 0 && R.wave < 3) { R.wave++; this.queueWave(R, 4 + R.wave); G.ui.flash(`WAVE ${R.wave} OF 3`, 1.4); }
      }
      const cagesLeft = (R.cages || []).filter((c) => c.alive).length, truckLeft = R.truck && R.truck.alive;
      const what = R.type === 'rescue' ? ` · ${cagesLeft} cage${cagesLeft === 1 ? '' : 's'} to break` : R.type === 'heist' ? (R.truck ? (R.truck.alive ? ` · stop the truck (${Math.round(R.truck.pos.distanceTo(R.truck.start))} / 450 m)` : ` · truck ${R.truck.done}`) : ' · stop the truck') : R.type === 'defend' ? (R.core ? ` · wave ${R.wave} of 3 · uplink ${Math.max(0, Math.round(R.core.hp / R.core.max * 100))}%` : ' · get to the uplink') : '';   // the uplink is only built once you are close
      if (!G.minigame) G.ui.setObjective({ title: VILLAINS[R.owner].crew, text: R.spawned ? `${left} left at ${R.name}${what}` : `${R.label} at ${R.name}`, sub: `${R.area} · ${Math.round(d)} m` });
      if (R.spawned && R.built && left === 0 && !cagesLeft && !truckLeft && (R.type !== 'defend' || R.wave >= 3)) this.completeRaid();
      R.far = d > 900 ? (R.far || 0) + dt : 0; if (R.far > 60) { G.ui.toast(`The crew at ${R.name} got away with it. Another raid will come.`, 'info'); this.endRaid(true); }
    } else this.beacon.visible = false;
  }
  pickSite() {
    const P = G.player.pos, stops = (G.metro && G.metro.bus ? G.metro.bus.lines.flatMap((l) => l.stops) : []).filter((s) => { const d = Math.hypot(s.x - P.x, s.z - P.z); return d > 110 && d < 380 && !(G.districts.waterAt(s.x, s.z, (s.y || 0) + 0.1)); });
    if (stops.length) { const s = stops[Math.floor(Math.random() * stops.length)]; return { pos: V().set(s.x, s.y || G.colliders.groundAt(s.x, s.z, 5, 5, 0.3), s.z), name: s.name, area: s.area || 'Midtown' }; }
    const nodes = G.npcs ? G.npcs.street.filter((n) => { const d = Math.hypot(n.x - P.x, n.z - P.z); return d > 60 && d < 300; }) : [];
    const n = nodes.length ? nodes[Math.floor(Math.random() * nodes.length)] : { x: 30, y: 0.15, z: -60 };
    return { pos: V().set(n.x, n.y || 0.15, n.z), name: 'Meridian Quarter', area: 'Meridian' };
  }
  // Each raid has a crew (Kurozan's robots, Vektor's drones, the Shadow Clan) and a kind:
  //   smash (stop them), rescue (break the cages), heist (stop the truck), defend (the orbital lift's uplink, three waves)
  startRaid(force = {}) {
    const st = this.st, owner = force.owner || (st.raids < 1 ? 'kurozan' : ['kurozan', 'vektor', 'shade'][Math.floor(Math.random() * 3)]);
    const r = Math.random(), type = force.type || (st.raids < 1 ? 'smash' : r < 0.4 ? 'smash' : r < 0.65 ? 'rescue' : r < 0.85 ? 'heist' : 'defend');
    let s = this.pickSite();
    if (type === 'defend' && G.orbital) { const x = G.orbital.tx + 22, z = G.orbital.tz + 22; s = { pos: V().set(x, G.colliders.groundAt(x, z, 20, 30, 0.5), z), name: 'the orbital lift', area: 'Aeroport' }; }
    const n = type === 'defend' ? 5 : 5 + Math.floor(Math.random() * 3);
    this.raid = { owner, type, site: s.pos, name: s.name, area: s.area, n, queue: [], foes: [], spawned: false, t: 0, wave: 1, label: { smash: 'Smashing up the street', rescue: 'Holding people in cages', heist: 'Robbing an armoured truck', defend: 'Attacking the uplink' }[type] };
    this.queueWave(this.raid, n);
    if (owner === 'vektor' || owner === 'shade') this.raid.queue.push({ kind: owner === 'vektor' ? 'vcore' : 'shade', pos: s.pos.clone().add(V().set(0, 0, -6)) });
    const V2 = VILLAINS[owner], what = { smash: 'smashing up', rescue: 'holding people in energy cages at', heist: 'robbing an armoured truck at', defend: "attacking the orbital lift's uplink at" }[type];
    this.beacon.material.color.set(V2.color).multiplyScalar(0.6);
    G.ui.toast(`${V2.crew} ${type === 'smash' ? 'are smashing up' : 'are ' + what} ${s.name} (${s.area}). Follow the beam.`, 'warn'); G.ui.flash('RAID', 1.4);
    if (G.audio) { G.audio.tone(520, 0.3, 0.06, 'square'); setTimeout(() => G.audio && G.audio.tone(390, 0.4, 0.06, 'square'), 320); }
    if (G.metro && G.metro.setRoute) try { G.metro.setRoute(s.pos.x, s.pos.z, G.player.pos); } catch { /* no route */ }
  }
  queueWave(R, n) {
    const kinds = { kurozan: ['brute', 'gunner', 'gunner', 'brute', 'drone', 'gunner', 'brute', 'drone', 'gunner'], vektor: ['hdrone', 'hdrone', 'gunner', 'hdrone', 'hdrone', 'brute', 'hdrone', 'hdrone', 'gunner'], shade: ['ninja', 'ninja', 'ninja', 'gunner', 'ninja', 'ninja', 'brute', 'ninja', 'ninja'] }[R.owner];
    const c = R.site, r0 = R.type === 'defend' ? 22 : 4;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + R.wave, r = r0 + Math.random() * 7, x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r; R.queue.push({ kind: kinds[i % kinds.length], pos: V().set(x, G.colliders.groundAt(x, z, c.y + 3, 3, 0.3), z) }); }
  }
  buildRaidThings(R) {
    R.built = true; const c = R.site;
    if (R.type === 'rescue') R.cages = [0, 1, 2].map((k) => { const a = k * 2.1 + 0.5, x = c.x + Math.cos(a) * 6, z = c.z + Math.sin(a) * 6; return new Cage(this, V().set(x, G.colliders.groundAt(x, z, c.y + 2, 3, 0.3), z)); });
    if (R.type === 'heist') R.truck = new Truck(this, c.clone());
    if (R.type === 'defend') R.core = new Uplink(c.clone());
  }
  completeRaid() {
    const R = this.raid, bonus = (R.freed || 0) * 100 + (R.truck && R.truck.done === 'stopped' ? 300 : 0) + (R.type === 'defend' ? 400 : 0), pay = 250 + R.n * 50 + bonus; this.st.raids++; G.state.done.heroRaid = true;
    G.economy.earn(pay, `stopping the raid at ${R.name}`); if (G.heroes) { G.heroes.addXp(100); G.heroes.raidDone(R); } G.ui.flash('RAID STOPPED', 2); sting('win');
    this.endRaid(false); this.nextRaid = (80 + Math.random() * 60) * G.heroes.diff.raid;
    if (R.type === 'rescue' && R.freed) G.ui.toast(`${R.freed} resident${R.freed === 1 ? '' : 's'} freed.`, 'good');
    if (this.st.raids === 2) G.ui.toast('Kurozan has noticed you. He is waiting at Skyhaven Stadium: face him from the Hero Hall or the Heroes app.', 'good');
    if (G.metro) G.metro.route = null;
  }
  endRaid(abandon) {
    if (!this.raid) return;
    if (this.raid.spawned) this.calmUntil = G.elapsed + 5;
    for (const f of this.raid.foes) if (!f.gone) { f.remove(); f.gone = true; }
    for (const c of this.raid.cages || []) c.remove(); if (this.raid.truck) this.raid.truck.remove(); if (this.raid.core) this.raid.core.remove();
    this.foes = this.foes.filter((f) => !f.gone); this.raid = null; this.beacon.visible = false; G.ui.setObjective(null); if (G.metro) G.metro.route = null;
    if (abandon) this.nextRaid = 60 * G.heroes.diff.raid;
  }
  // where each boss waits: Kurozan in Skyhaven Stadium, Vektor on the Aurelia Needle's roof, Shade in the Undercity
  arenaOf(kind) {
    if (kind === 'vektor') { const x = 360, z = -360, y = G.colliders.maxTopAt(x + 14, z + 14, 0.5); return V().set(x, y, z); }
    if (kind === 'shade') { const x = 870, z = 220; return V().set(x, G.colliders.groundAt(x, z, 3, 3, 0.5), z); }
    return this.arena;
  }
  startBoss(kind = 'kurozan') {
    const H = G.heroes; if (!H || !H.on) { G.ui.toast('Become a hero at the Hero Hall first.', 'info'); return; }
    if (this.boss) { G.ui.toast('A boss fight is already waiting for you.', 'info'); return; }
    this.endRaid(true);
    if (kind !== 'kurozan') return this.startLeaderBoss(kind);
    const A = this.arena; this.bossArena = A;
    G.ui.fade(() => {
      const p = G.player; if (p.state === 'hero') H.endMove(); p.state = 'walk';
      p.pos.set(A.x, A.y + 0.2, A.z + 22); p.vel.set(0, 0, 0); p.yaw = p.camYaw = Math.PI; H.hp = H.max;
      this.boss = new Kurozan(this, V().set(A.x, A.y, A.z - 14));
      G.heroes.showCard(artUrl('villain-kurozan.jpg'), KUROZAN.name, 'Skyhaven Stadium · beat him to save the city', '#ff6a3c', 4, false, 'kurozan'); say('kurozan', 'Kurozan', 'So you are the one breaking my robots. Come, little hero.'); sting('hit'); this.stormFrom = G.env.weather; G.env.setWeather('storm');
      if (G.audio) { G.audio.thunder(); G.audio.tone(60, 2, 0.12, 'sawtooth', null, 0.2, 0.7); }
    });
  }
  startLeaderBoss(kind) {
    const H = G.heroes, A = this.arenaOf(kind), v = VILLAINS[kind]; this.bossArena = A;
    G.ui.fade(() => {
      const p = G.player; if (p.state === 'hero') H.endMove(); p.state = 'walk';
      const hx = A.x + (kind === 'vektor' ? 14 : 0), hz = A.z + (kind === 'vektor' ? 14 : 18);
      p.pos.set(hx, G.colliders.groundAt(hx, hz, A.y + 3, 4, 0.4) + 0.1, hz); p.vel.set(0, 0, 0); p.yaw = p.camYaw = Math.atan2(A.x - hx, A.z - hz); H.hp = H.max;
      const at = kind === 'vektor' ? V().set(A.x - 10, A.y + 10, A.z - 10) : V().set(A.x, A.y, A.z - 10);
      this.boss = new BossFoe(this, kind === 'vektor' ? 'vcore' : 'shade', at, { hp: kind === 'vektor' ? 1600 : 1300, title: v.name, short: v.short, face: kind === 'vektor' ? 'villain-vektor.jpg' : 'villain-shade.jpg', bossKind: kind });
      G.heroes.showCard(artUrl(kind === 'vektor' ? 'villain-vektor.jpg' : 'villain-shade.jpg'), v.name, kind === 'vektor' ? 'The roof of the Aurelia Needle, 1 km up' : 'The Undercity, under the Neon District', v.color, 4, false, kind);
      say(kind, v.short, kind === 'vektor' ? 'Every machine in this city answers to me. Soon, so will you.' : 'You never see the blade that finds you.'); sting('hit');
      if (G.audio) G.audio.tone(70, 1.6, 0.12, 'sawtooth', null, 0.2, 0.8);
    });
  }
  bossDown(kind = 'kurozan') {
    const st = this.st, pay = kind === 'kurozan' ? 2500 : 2000;
    if (kind === 'kurozan') { st.boss++; G.state.done.heroBoss = true; } else { st[kind === 'vektor' ? 'bossV' : 'bossS'] = (st[kind === 'vektor' ? 'bossV' : 'bossS'] || 0) + 1; G.state.done['heroBoss:' + kind] = true; G.ui.flash(`${VILLAINS[kind].short.toUpperCase()} DEFEATED`, 2.5); }
    const name = kind === 'kurozan' ? 'Kurozan' : VILLAINS[kind].short;
    sting('boss'); if (kind === 'vektor') say('vektor', 'Vektor', 'Signal... lost.'); else if (kind === 'shade') say('shade', 'Shade', 'The shadows... remember you.');
    setTimeout(() => { G.economy.earn(pay, `defeating ${name}`); G.ui.toast(`${name} is beaten. ${money(pay)}.`, 'good'); }, 2500);
    for (const f of this.foes) if (!f.isBoss && f.alive && !(this.raid && this.raid.foes.includes(f))) f.die(null);
    if (G.heroes) { G.heroes.addXp(400); G.heroes.bossDone(kind); }
    this.nextRaid = 150;
  }
  endBoss(quiet) {
    if (!this.boss) return; this.boss.remove(); this.boss = null; G.heroes.bossBar(null); void quiet; this.calmUntil = G.elapsed + 5;
    if (this.stormFrom) { G.env.setWeather('rain'); this.stormFrom = null; }   // the storm breaks up into rain
    for (const f of this.foes) if (!(this.raid && this.raid.foes.includes(f)) && !f.gone) { f.remove(); f.gone = true; } this.foes = this.foes.filter((f) => !f.gone);
  }
}
