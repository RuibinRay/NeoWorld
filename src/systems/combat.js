// The combat core shared by heroes and villains: who can be hit, hit shapes (a sphere, a cone in
// front of you, a sweep along a line, a ray), knockback, the hero's health, and what a hit does to
// the street: residents are knocked down (no injuries shown: they tumble, get up and run), and
// the Aegis-12 patrol takes note when it is a resident you hit.
//
// A target: { pos (feet), h (height of its middle above pos), r (radius), team: 'villain',
//             alive, name, hit(dmg, dir, o), flying? }
import * as THREE from 'three';
import { G } from '../core/game.js';
import { clamp } from '../core/util.js';

const _d = new THREE.Vector3(), _c = new THREE.Vector3(), _e = new THREE.Vector3(), _n = new THREE.Vector3();

export class Combat {
  constructor() {
    this.targets = new Set();
    this.lastHit = null; this.lastHitT = 0;          // the enemy you hit last: its health shows on the HUD
    this.civHits = 0;
  }
  add(t) { this.targets.add(t); return t; }
  remove(t) { this.targets.delete(t); }
  centre(t, out = _c) { return out.set(t.pos.x, t.pos.y + t.h, t.pos.z); }

  // What a hero's attack does to everything inside a shape. o: { dmg, knock (m/s), up (m/s), stun (s),
  // kind ('blunt' | 'cut' | 'fire' | 'shock' | 'web'), color, civ (residents too, default true), max (cap on targets),
  // dir (push direction when the shape has none), from (a point to push away from) }. Returns the number hit.
  strike(shape, o = {}) {
    let n = 0; const max = o.max || 99, hits = [];
    const ex = o.except || null;
    for (const t of this.targets) { if (!t.alive || n >= max || (ex && ex.has(t))) continue; if (this.inside(shape, this.centre(t), t.r)) { hits.push(t); n++; if (ex) ex.add(t); } }
    for (const t of hits) this.hitTarget(t, this.pushDir(shape, this.centre(t), o), o);
    if (o.civ !== false && G.npcs && !(G.heroes && G.heroes.training && o.byHero)) for (const npc of G.npcs.list) {
      if (n >= max) break;
      if (npc.inside || npc.body !== 'humanoid' || npc.hold || npc.converse || (ex && ex.has(npc))) continue;
      _n.set(npc.pos.x, npc.pos.y + 0.95, npc.pos.z);
      if (!this.inside(shape, _n, 0.35)) continue;
      this.knockResident(npc, this.pushDir(shape, _n, o), o); n++; if (ex) ex.add(npc);
    }
    return n;
  }
  inside(s, p, r) {
    if (s.kind === 'sphere') return p.distanceToSquared(s.c) < (s.r + r) * (s.r + r);
    if (s.kind === 'cone') {
      _d.subVectors(p, s.o); const L = _d.length(); if (L > s.range + r) return false; if (L < r + 0.6) return true;
      return _d.dot(s.dir) / L > s.cos - r / L;
    }
    if (s.kind === 'capsule') { // distance from p to the segment a–b
      _d.subVectors(s.b, s.a); const L2 = _d.lengthSq(), u = L2 > 0 ? clamp(_e.subVectors(p, s.a).dot(_d) / L2, 0, 1) : 0;
      return _e.copy(s.a).addScaledVector(_d, u).distanceToSquared(p) < (s.r + r) * (s.r + r);
    }
    return false;
  }
  pushDir(s, p, o) {
    const from = o.from || (s.kind === 'sphere' ? s.c : s.kind === 'cone' ? s.o : null);
    if (o.dir) return _d.copy(o.dir).setY(0).normalize();
    if (from) { _d.subVectors(p, from).setY(0); if (_d.lengthSq() > 1e-6) return _d.normalize(); }
    if (s.kind === 'capsule') return _d.subVectors(s.b, s.a).setY(0).normalize();
    return _d.set(0, 0, 1);
  }
  hitTarget(t, dir, o) {
    const dmg = (o.dmg || 0) * (o.byHero && G.heroes && G.heroes.on ? G.heroes.dmgMul : 1);
    t.hit(dmg, dir, o);
    if (o.byHero && dmg >= 30) G.hitStop = Math.max(G.hitStop || 0, Math.min(0.09, 0.03 + dmg / 1200));
    if (o.byHero && G.heroes && G.heroes.id === 'bulwark') G.heroes.rage = Math.min(100, (G.heroes.rage || 0) + dmg * 0.25);
    this.lastHit = t; this.lastHitT = 4;
    if (G.heroes && G.heroes.on && o.byHero !== false) G.heroes.charge((o.dmg || 0) * 0.35);
    const c = this.centre(t, _e);
    if (G.fx) { G.fx.spark(c, o.color || '#ffd34d', o.kind === 'web' ? 4 : 10, 6, 0.35, 0.12); if ((o.dmg || 0) >= 30) G.fx.shake(0.12); }
    if (G.sfx) G.sfx.hit(o.kind || 'blunt', dmg, c, t);
  }
  // A resident caught in a fight: knocked over, then up and away. If the hero did it, it costs
  // standing with them and their friends, and the patrol hears about it.
  knockResident(npc, dir, o) {
    const p = (o.knock || 4) * 0.8;
    npc.knock(dir.x * p, dir.z * p, Math.max(2.5, (o.up || 0) + p * 0.35), o.kind === 'web' ? 2.5 : 0);
    if (o.byVillain) return;
    this.civHits++;
    const m = npc.mem; m.rep = clamp(m.rep - 12, -100, 100); G.state.standing = clamp(G.state.standing - 2, -100, 100);
    G.npcs.gossip(npc, -10, 'hit them in the street');
    if (npc.isNear) G.ui.say(npc, npc.android ? 'Impact logged. Reporting to Civic Patrol.' : ['Ow! What was that for?', 'Hey! I live here!', 'Somebody call the patrol!'][Math.floor(Math.random() * 3)], 2.6);
    if (G.events) G.events.report('assault', 1.6);
    if (this.civHits === 1) G.ui.toast('That was a resident, not a villain. Hitting people costs you standing and brings the Aegis-12 patrol.', 'warn');
  }
  // A villain's attack: the hero (if inside the shape) and any residents in the way. Returns true if the hero was hit.
  villainStrike(shape, o = {}) {
    let hit = false; const H = G.heroes;
    if (H && H.alive) { const c = H.centre(); if (this.inside(shape, c, 0.45)) { H.hurt(o.dmg || 0, this.pushDir(shape, c, o).clone(), o); hit = true; } }
    if (o.civ !== false && G.npcs) for (const npc of G.npcs.list) {
      if (npc.inside || npc.body !== 'humanoid' || npc.hold || npc.converse) continue;
      _n.set(npc.pos.x, npc.pos.y + 0.95, npc.pos.z);
      if (this.inside(shape, _n, 0.35)) this.knockResident(npc, this.pushDir(shape, _n, o).clone(), { ...o, byVillain: true });
    }
    return hit;
  }
  // a ray from o along dir: the nearest target, resident or wall within range
  ray(o, dir, range, { civ = true, walls = true, r = 0.4 } = {}) {
    let best = range, hit = null, npc = null;
    const test = (cx, cy, cz, rad) => { // ray–sphere
      const ox = cx - o.x, oy = cy - o.y, oz = cz - o.z, b = ox * dir.x + oy * dir.y + oz * dir.z; if (b < 0) return -1;
      const d2 = ox * ox + oy * oy + oz * oz - b * b, R = rad + r; if (d2 > R * R) return -1; return b - Math.sqrt(R * R - d2);
    };
    for (const t of this.targets) { if (!t.alive) continue; const c = this.centre(t); const d = test(c.x, c.y, c.z, t.r); if (d >= 0 && d < best) { best = d; hit = t; } }
    if (civ && G.npcs) for (const n of G.npcs.near) { if (n.inside || n.body !== 'humanoid') continue; const d = test(n.pos.x, n.pos.y + 0.95, n.pos.z, 0.35); if (d >= 0 && d < best) { best = d; hit = null; npc = n; } }
    let wall = false;
    if (walls) { const w = G.colliders.raycast(o.x, o.y, o.z, dir.x, dir.y, dir.z, best); if (w < best - 1e-3) { best = w; hit = null; npc = null; wall = true; } }
    // The open ground is not a box, so the ray above would pass under the street: walk down it in 2 m
    // steps to where it meets the ground (or a deck), then narrow that down, so aiming at the street lands on it.
    let ground = false;
    if (!hit && !npc && dir.y < -0.01) {
      const col = G.colliders, under = (s) => { const y = o.y + dir.y * s; return y < col.groundAt(o.x + dir.x * s, o.z + dir.z * s, y + 1, 2, 0.2); };
      for (let s = 2, prev = 0; s < best + 2; prev = s, s += 2) {
        const at = Math.min(s, best); if (!under(at)) continue;
        let lo = prev, hi = at; for (let k = 0; k < 7; k++) { const m = (lo + hi) / 2; if (under(m)) hi = m; else lo = m; }
        if (hi < best - 1e-3) { best = hi; wall = true; ground = true; }
        break;
      }
    }
    const point = new THREE.Vector3().copy(o).addScaledVector(dir, best);
    if (!wall && !hit && !npc && point.y < G.colliders.groundAt(point.x, point.z, point.y + 1, 2, 0.2) + 0.05) { wall = true; ground = true; }   // into the ground
    return { t: best, target: hit, npc, wall: wall || (best < range && !hit && !npc), ground, point, missed: !hit && !npc && !wall && best >= range };
  }
  // the hero is hit by a villain (or a villain's blast)
  hitHero(dmg, dir, o = {}) {
    const H = G.heroes; if (!H || !H.on) return;
    H.hurt(dmg, dir, o);
  }
  update(dt) {
    this.lastHitT -= dt; if (this.lastHit && (!this.lastHit.alive || this.lastHitT <= 0)) this.lastHit = this.lastHitT > 0 ? this.lastHit : null;
  }
}
