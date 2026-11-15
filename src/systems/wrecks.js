// Road vehicles take damage. Any moving car, taxi, van or truck (entities/fleet.js) can be hit by a
// hero, caught in a villain's attack or a blast, or rammed hard with your own vehicle. A hit vehicle
// stops; badly hurt it smokes, then catches fire and blows up a few seconds later (or at once, if
// it is finished off), throwing out a blast that hurts what is close by and can set off the next
// car. The wreck stays where it stopped, charred and smoking, so the traffic behind it queues;
// the city tows it away once nobody is looking. Residents run from the fire, and a hero who blows
// up vehicles outside a fight with villains is reported (wanted stars).
import * as THREE from 'three';
import { G } from '../core/game.js';
import { clamp } from '../core/util.js';

const HP = { car: 100, taxi: 100, van: 140, truck: 220 };
const SMOKE = 0.55, FIRE = 0.25;            // smoking below 55% health, on fire below 25%
const FUSE = 4.5;                           // seconds on fire before it blows
const CHAR = '#1a1918';                     // a burnt-out shell
const STAY = 40, MAXSTAY = 100;             // a wreck is towed after 40 s once out of sight, after 100 s whatever happens
const V = () => new THREE.Vector3();

export class Wrecks {
  constructor() {
    this.hot = new Set();                   // vehicles that are damaged, burning or wrecked: the ones that need updating
    this.v = V(); this.c = V(); this.blown = 0; this.towed = 0;
  }
  init(s) { if (s.hp === undefined) { s.max = HP[s.type] || 100; s.hp = s.max; } }
  // every vehicle on the road now (placed this frame or recently)
  *live() { for (const s of G.fleet.all) if (s.on) yield s; }
  centre(s, out = this.c) { return out.set(s.x, (s.y || 0) + (s.type === 'truck' ? 1.6 : s.type === 'van' ? 1.2 : 0.8), s.z); }
  // is the point inside the vehicle's footprint (grown by m), and no higher than its roof?
  inside(s, p, m = 0.4) {
    const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw), dx = p.x - s.x, dz = p.z - s.z, top = (s.y || 0) + (s.type === 'truck' ? 3.6 : s.type === 'van' ? 2.6 : 1.8);
    return Math.abs(dx * fx + dz * fz) < s.l / 2 + m && Math.abs(dx * fz - dz * fx) < s.w / 2 + m && p.y > (s.y || 0) - 0.5 && p.y < top + m;
  }
  // a hero's or a villain's attack shape (combat.js): every vehicle inside it takes the hit
  strike(shape, o, inside) {
    const dmg = (o.dmg || 0) * (o.byHero && G.heroes && G.heroes.on ? G.heroes.dmgMul : 1); if (dmg <= 0) return 0;
    let n = 0;
    for (const s of this.live()) {
      if (s.dead) continue;
      const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw), c = this.centre(s, this.v), r = s.w / 2;
      // three points along the body, so a long truck can be hit at either end
      let hit = false;
      for (const k of [0, 0.3, -0.3]) { const p = this.c.set(c.x + fx * s.l * k, c.y, c.z + fz * s.l * k); if (inside(shape, p, r)) { hit = true; break; } }
      if (hit) { this.hurt(s, dmg, o); n++; }
    }
    return n;
  }
  // a ray (combat.ray): the distance to the nearest vehicle along it, or Infinity. Vehicles are solid to aim at.
  ray(o, dir, range) {
    let best = Infinity, who = null;
    for (const s of this.live()) {
      const dx = s.x - o.x, dz = s.z - o.z; if (dx * dx + dz * dz > (range + 6) ** 2) continue;
      // slab test against the vehicle's box, in its own frame
      const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw), y0 = s.y || 0, h = s.type === 'truck' ? 3.6 : s.type === 'van' ? 2.6 : 1.8;
      const ox = o.x - s.x, oz = o.z - s.z, la = ox * fx + oz * fz, ls = ox * fz - oz * fx, da = dir.x * fx + dir.z * fz, ds = dir.x * fz - dir.z * fx;
      let t0 = 0, t1 = range;
      const slab = (p, d, lo, hi) => { if (Math.abs(d) < 1e-6) return p >= lo && p <= hi; let a = (lo - p) / d, b = (hi - p) / d; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); return t0 <= t1; };
      if (!slab(la, da, -s.l / 2, s.l / 2) || !slab(ls, ds, -s.w / 2, s.w / 2) || !slab(o.y, dir.y, y0 + 0.2, y0 + h)) continue;
      if (t0 < best) { best = t0; who = s; }
    }
    return { t: best, s: who };
  }
  // something struck a surface at p (damage.js impact): if that surface is a vehicle, the vehicle takes it instead
  impact(p, power, kind, o) {
    for (const s of this.live()) {
      if (s.dead || !this.inside(s, p, 0.6)) continue;
      this.hurt(s, power * (kind === 'fire' ? 11 : 8), o);
      return true;
    }
    return false;
  }
  // an explosion (damage.js burst, or a vehicle blowing up): everything within radius, less further out
  blast(c, radius, power, o = {}, except = null) {
    const own = except ? except.l * 0.4 : 0;   // a vehicle's own blast starts at its bodywork, so a car parked bumper to bumper takes nearly all of it
    for (const s of this.live()) {
      if (s.dead || s === except) continue;
      const d = Math.max(0, Math.hypot(s.x - c.x, s.z - c.z) - s.l * 0.4 - own); if (d > radius) continue;
      this.hurt(s, power * 21 * clamp(1 - d / radius, 0.15, 1), o);
    }
  }
  // damage one vehicle
  hurt(s, dmg, o = {}) {
    if (s.dead || !(dmg > 0)) return;
    this.init(s); const was = s.hp / s.max;
    s.hp -= dmg; s.hold = Math.max(s.hold || 0, 3 + Math.random() * 2); s.byHero = s.byHero || !!o.byHero; this.hot.add(s);
    const c = this.centre(s, this.v), f = s.hp / s.max;
    if (G.fx) { G.fx.spark(c, '#ffd34d', 6 + Math.min(10, dmg / 4), 6, 0.35, 0.12); if (dmg >= 25) G.fx.dust(c, 4, 1); }
    if (G.audio && dmg >= 8) G.audio.thud(clamp(dmg / 40, 0.2, 0.8));
    if (G.fx && dmg >= 30 && Math.hypot(c.x - G.player.pos.x, c.z - G.player.pos.z) < 30) G.fx.shake(0.06);
    if (s.pod) s.pod.v = Math.min(s.pod.v || 0, 2);   // the driver stamps on the brakes
    if (s.hp <= 0) { s.fuse = Math.min(s.fuse ?? 0.25, 0.25); s.burning = true; }                 // finished off: it goes up almost at once
    else if (f <= FIRE && was > FIRE) { s.burning = true; s.fuse = FUSE; if (G.audio) G.audio.burst(0.3, 0.12, 900, 'bandpass'); this.scatter(c, 14); }
    else if (f <= SMOKE && was > SMOKE) s.smoking = true;
  }
  explode(s) {
    if (s.dead) return;
    const c = this.centre(s, V()).clone(), big = s.type === 'truck' ? 1.4 : s.type === 'van' ? 1.15 : 1;
    s.dead = true; s.burning = false; s.wreckT = 0; s.hp = 0; s.wx = s.x; s.wy = s.y || 0; s.wz = s.z; s.wyaw = s.yaw; this.blown++;
    G.fleet.recolor(s, CHAR); G.fleet.place(s, s.x, s.y || 0, s.z, s.yaw);
    if (s.pod) s.pod.v = 0;
    // the blast: fire, smoke, a flash, a scorch on the street and nearby walls
    if (G.fx) {
      G.fx.blast(c, '#ffb347', 0.6, 5.5 * big, 0.5); G.fx.blast(c, '#ff5a1f', 0.4, 3.5 * big, 0.7); G.fx.ring(c, '#ffd38a', 0.5, 9 * big, 0.45);
      G.fx.spark(c, '#ffd34d', 30, 12, 0.7, 0.16); G.fx.smoke(c, 10, '#1c1d22', 3 * big, 3); G.fx.fire(c, 12, 2.2);
      const d = Math.hypot(c.x - G.player.pos.x, c.z - G.player.pos.z); if (d < 60) G.fx.shake(clamp(0.6 - d / 100, 0.1, 0.6));
    }
    if (G.damage) G.damage.burst(c, 5 * big, 3.5 * big, 'fire', { fromWreck: true });   // (reported below, once)
    // what is close by: other vehicles (which can go up in turn), villains, the hero, your own car, residents
    const R = 8 * big;
    this.blast(c, R, 4.4 * big, { byHero: s.byHero }, s);
    if (G.combat) for (const t of G.combat.targets) { if (!t.alive || t.team !== 'villain' || !t.pos) continue; const d = Math.hypot(t.pos.x - c.x, t.pos.z - c.z); if (d < R) t.hit(70 * (1 - d / R) + 10, V().set(t.pos.x - c.x, 0, t.pos.z - c.z).normalize(), { knock: 12, up: 4, kind: 'fire', byHero: s.byHero }); }
    const H = G.heroes, P = G.player;
    if (H && H.on && H.alive) { const hc = H.centre(), d = hc.distanceTo(c); if (d < R * 0.85) H.hurt(Math.round(28 * big * (1 - d / (R * 0.85))) + 4, V().set(hc.x - c.x, 0, hc.z - c.z).normalize(), { knock: 9, up: 4, kind: 'fire' }); }
    else if (P.state === 'walk' && Math.hypot(P.pos.x - c.x, P.pos.z - c.z) < 5) { P.vel.x += (P.pos.x - c.x) * 2; P.vel.z += (P.pos.z - c.z) * 2; }
    const car = G.car; if (car && car.mode !== 'parked' && car.pos.distanceTo(c) < R) car.damage(25 * (1 - car.pos.distanceTo(c) / R) + 5, 'Explosion');
    if (G.combat && G.npcs) for (const n of G.npcs.list) {
      if (n.inside || n.body !== 'humanoid' || n.hold || n.converse || n.dead) continue;
      const dx = n.pos.x - c.x, dz = n.pos.z - c.z, d = Math.hypot(dx, dz);
      if (d < R * 0.8) G.combat.knockResident(n, V().set(dx, 0, dz).normalize(), { knock: 9 * (1 - d / R) + 3, up: 3, byVillain: true });   // knocked flat, never hurt
    }
    this.scatter(c, 30);
    if (G.audio) { G.audio.burst(1, 0.4, 140); G.audio.thud(1); }
    if (G.sfx) G.sfx.play('boom', c, 1.2);
    // a hero blowing up traffic outside a fight is reported like other property damage
    if (s.byHero && !(G.villains && G.villains.busy()) && G.events) G.events.report('damage', 2.5);
  }
  // everyone near the fire runs from it (they are not hurt and do not come at you)
  scatter(c, R) {
    if (!G.npcs) return; let shouted = 0;
    for (const n of G.npcs.near) {
      if (n.inside || n.body !== 'humanoid' || n.hold || n.converse || n.dead || (n.react && (n.react.fall || n.react.fight))) continue;
      const dx = n.pos.x - c.x, dz = n.pos.z - c.z, d = Math.hypot(dx, dz); if (d > R || (n.react && n.react.flee && n.react.t > 2)) continue;
      if (n.doing || n.path || n.direct || n.seat || n.chat) { if (n.chat) n.chat.t = 99; n.interrupt(); }
      const l = d || 1; n.react = { anim: 'run', t: 4 + Math.random() * 3, flee: [dx / l, dz / l] }; if (n.cool) n.cool.flee = 10; if (n.feel) n.feel(n.android ? 'alarm' : 'surprised', 8);
      if (n.isNear && shouted < 1 && Math.random() < 0.5) { shouted++; G.ui.say(n, n.android ? 'Vehicle fire. Keep clear.' : n.child ? 'Fire!' : ['Get back, it\'s going to blow!', 'Fire! Move!', 'Somebody call it in!'][Math.floor(Math.random() * 3)]); }
    }
  }
  // a stopped vehicle: the traffic systems ask this before they move one
  stopped(s) { return !!(s && (s.dead || s.burning || s.hold > 0)); }
  update(dt) {
    if (!this.hot.size) return;
    const cam = G.camera.matrixWorld.elements, cx = cam[12], cz = cam[14], fx = -cam[8], fz = -cam[10], fl = Math.hypot(fx, fz) || 1;
    for (const s of this.hot) {
      s.hold = Math.max(0, (s.hold || 0) - dt);
      const c = this.centre(s, this.v), near = (c.x - G.player.pos.x) ** 2 + (c.z - G.player.pos.z) ** 2 < 300 * 300;
      if (s.dead) {
        s.wreckT += dt;
        if (near && G.fx) { if (s.wreckT < 14 && Math.random() < dt * 14) G.fx.fire(c, 2, 1.4); if (s.wreckT < STAY && Math.random() < dt * 5) G.fx.smoke(c, 1, '#1c1d22', 2.2, 2.4); }
        // towed away once nobody is looking (or it has been there a long time)
        const dx = s.x - cx, dz = s.z - cz, d = Math.hypot(dx, dz), seen = d < 160 && (dx * fx + dz * fz) / (d * fl || 1) > 0.2;
        if (s.wreckT > MAXSTAY || (s.wreckT > STAY && (!seen || !s.on))) this.tow(s);
        continue;
      }
      if (s.burning) {
        s.fuse -= dt;
        if (near && G.fx && Math.random() < dt * 18) G.fx.fire(V().set(c.x, c.y + 0.5, c.z), 2, s.w * 0.6);
        if (near && G.fx && Math.random() < dt * 8) G.fx.smoke(c, 1, '#26282e', 1.8, 2.2);
        if (s.fuse <= 0) this.explode(s);
        continue;
      }
      if (s.smoking && near && G.fx && Math.random() < dt * 5) G.fx.smoke(c, 1, '#5a5d66', 1.2, 1.6);
      if (!s.smoking && s.hold <= 0) this.hot.delete(s);   // a dent: it drives on
    }
  }
  // the city clears a wreck: the vehicle is back to new and its traffic system puts it on another street
  tow(s) {
    this.hot.delete(s); this.towed++;
    s.dead = false; s.burning = false; s.smoking = false; s.byHero = false; s.hold = 0; s.hp = s.max;
    G.fleet.recolor(s, s.color);
    if (s.pod && 'on' in s.pod) { s.pod.on = false; G.fleet.hide(s); }   // the avenue traffic re-places it out of sight
  }
  // for tests and the pause menu: put everything back
  clear() { for (const s of [...this.hot]) { if (s.dead) this.tow(s); else { s.hp = s.max; s.burning = s.smoking = false; s.hold = 0; this.hot.delete(s); } } }
}
