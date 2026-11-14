// The wanted level: 0 to 5 stars, raised by offences and kept while the patrol can see you.
//   1-2 stars  the Aegis-12 drone comes for you (systems/events.js): hold still under its scan and you
//              pay a fine, times your stars, which clears them
//   3-5 stars  armed enforcer drones join it (2, 4, then 6): they circle you and fire stun shots; a hero
//              can shoot them down, which only raises the stars further. No stopping for a scan now:
//              lose them, or go down (a knocked-out hero; three stuns on foot is a citation)
// Every drone needs a clear line of sight within 90 m. Out of sight, the stars flash while they search
// the last place you were seen; stay hidden long enough and you lose them. Traffic offences alone never
// go past 2 stars. Not saved: a reload starts clean.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { makeDrone } from '../entities/rigs.js';
import { clamp, dampAngle } from '../core/util.js';

const STAR_AT = [3, 8, 16, 28, 45];          // points for 1..5 stars
const TRAFFIC_CAP = 15.9;                    // just under 3 stars
const SIGHT = 90;
const V = () => new THREE.Vector3();

export class Wanted {
  constructor() {
    this.points = 0; this.stars = 0; this.unseen = 0; this.last = V(); this.why = ''; this.enf = []; this.respawn = 0; this.stuns = 0; this.lostT = 0;
    this.v = V(); this.w = V();
    const tr = document.getElementById('hud-tr');
    this.el = document.createElement('div'); this.el.id = 'wanted';
    this.el.style.cssText = 'font-size:22px;letter-spacing:3px;margin-top:4px;display:none;text-shadow:0 0 6px rgba(0,0,0,0.6)';
    if (tr) tr.appendChild(this.el);
    this.shown = '';
  }
  starsFor(p) { let s = 0; for (const t of STAR_AT) if (p >= t) s++; return s; }
  get searching() { return this.stars > 0 && this.unseen > 0.8; }
  searchTime() { return 6 + 3 * this.stars; }
  // an offence: kind as Events.report names it (traffic kinds stay under 3 stars)
  add(pts, kind, why) {
    if (!(pts > 0) || !G.started) return;
    const traffic = !['assault', 'damage', 'police', 'evade'].includes(kind);
    this.points = traffic ? Math.max(this.points, Math.min(TRAFFIC_CAP, this.points + pts)) : this.points + pts;
    if (why) this.why = why;
    const s = this.starsFor(this.points), p = G.player;
    this.unseen = 0; this.last.copy(p.state === 'drive' ? G.car.pos : p.pos);
    if (s > this.stars) {
      const was = this.stars; this.stars = s;
      if (s >= 3 && was < 3) G.ui.toast('Aegis enforcers dispatched. Break their line of sight and stay hidden to lose them.', 'warn');
      if (G.audio) { G.audio.tone(520 + s * 60, 0.18, 0.05, 'square'); setTimeout(() => G.audio && G.audio.tone(660 + s * 60, 0.22, 0.05, 'square'), 180); }
      G.ui.flash(`${'★'.repeat(s)} WANTED`, 1.2);
    }
    this.draw(true);
  }
  // fined or gone: everything stands down
  clear() {
    this.points = 0; this.stars = 0; this.unseen = 0; this.stuns = 0; this.why = '';
    for (const e of this.enf) this.removeEnforcer(e, false); this.enf.length = 0;
    this.draw(true);
  }
  // ---- enforcer drones (3+ stars) -------------------------------------------------------------------------
  spawnEnforcer() {
    const p = this.target(), a = Math.random() * Math.PI * 2, rig = makeDrone('police'); rig.root.scale.setScalar(1.25); G.scene.add(rig.root);
    const e = { pos: new THREE.Vector3(p.x + Math.cos(a) * 110, p.y + 45, p.z + Math.sin(a) * 110), h: 0, r: 0.75, team: 'villain', alive: true, flying: true, name: 'Aegis enforcer', hp: 45, max: 45,
      rig, cd: 1.5 + Math.random() * 1.5, orbit: a, kind: 'drone',
      hit: (dmg) => { if (!e.alive) return; e.hp -= dmg; if (e.hp <= 0) this.downEnforcer(e); } };
    G.combat.add(e); this.enf.push(e);
  }
  downEnforcer(e) {
    e.alive = false; G.fx.blast(e.pos, '#ff8a3c', 0.3, 2.4, 0.35); G.fx.spark(e.pos, '#ffd34d', 18, 7, 0.5, 0.14); G.fx.smoke(e.pos, 3, '#3a3d44', 1.4, 1);
    if (G.sfx) G.sfx.play('boom', null, 0.6);
    this.removeEnforcer(e, true); this.enf.splice(this.enf.indexOf(e), 1); this.respawn = 9;
    this.add(6, 'police', 'destroying Civic Patrol drones');
  }
  removeEnforcer(e) { e.alive = false; G.combat.remove(e); e.rig.root.removeFromParent(); }
  target() { const p = G.player; return p.state === 'drive' ? G.car.pos : p.pos; }
  // can anything on patrol see you? (the Aegis drone and every enforcer)
  sees() {
    const c = this.target(), col = G.colliders, cy = c.y + 1.2;
    const look = (q) => { const dx = c.x - q.x, dy = cy - q.y, dz = c.z - q.z, d = Math.hypot(dx, dy, dz); if (d > SIGHT) return false; if (d < 4) return true; return col.raycast(q.x, q.y, q.z, dx / d, dy / d, dz / d, d) >= d - 0.6; };
    if (G.events && G.events.mode === 'respond' && look(G.events.dpos)) return true;
    for (const e of this.enf) if (e.alive && look(e.pos)) return true;
    return false;
  }
  stepEnforcer(e, i, dt, seen, t) {
    const c = seen ? this.target() : this.last, n = this.enf.length;
    e.orbit += dt * (0.5 + 0.1 * this.stars);
    const ring = seen ? 12 : 22, ang = e.orbit + (i / Math.max(1, n)) * Math.PI * 2;
    const tx = c.x + Math.cos(ang) * ring, tz = c.z + Math.sin(ang) * ring;
    let ty = c.y + 6 + (i % 3) * 1.5; const far = Math.hypot(tx - e.pos.x, tz - e.pos.z);
    if (far > 30) ty = Math.max(ty, G.colliders.maxTopAt(e.pos.x, e.pos.z, 2) + 4);          // over the roofs on the way in
    const dx = tx - e.pos.x, dy = ty - e.pos.y, dz = tz - e.pos.z, d = Math.hypot(dx, dy, dz), sp = 20 + 5 * this.stars, st = Math.min(d, sp * dt);
    if (d > 0.01) { e.pos.x += (dx / d) * st; e.pos.y += (dy / d) * st; e.pos.z += (dz / d) * st; }
    const r = e.rig; r.root.position.copy(e.pos); r.root.position.y += Math.sin(t * 3 + i) * 0.08;
    const ft = this.target(); r.root.rotation.y = dampAngle(r.root.rotation.y, Math.atan2(ft.x - e.pos.x, ft.z - e.pos.z), 5, dt);
    for (const q of r.rotors) q.rotation.z += dt * 50;
    const fl = Math.sin(t * 16 + i) > 0; r.red.color.setRGB(fl ? 3 : 0.3, 0.05, 0.05); r.blue.color.setRGB(0.05, 0.1, fl ? 0.3 : 3);
    // fire: stun shots while it can see you, faster at more stars
    e.cd -= dt;
    if (e.cd <= 0 && seen && Math.hypot(ft.x - e.pos.x, ft.y - e.pos.y, ft.z - e.pos.z) < 45) { e.cd = Math.max(0.9, 2.8 - 0.35 * this.stars) + Math.random() * 0.8; this.fire(e); }
  }
  fire(e) {
    const p = G.player, c = this.target(), aim = this.v.set(c.x, c.y + 1.1, c.z);
    const moving = p.state === 'drive' ? G.car.speed : p.vel.length(), hit = Math.random() < clamp(0.55 + 0.06 * this.stars - moving * 0.012, 0.15, 0.9);   // moving fast makes you harder to hit
    if (!hit) aim.add(this.w.set((Math.random() - 0.5) * 4, -1 + Math.random(), (Math.random() - 0.5) * 4));
    G.fx.beam(e.pos.clone(), aim.clone(), '#ff4a3a', 0.06, 0.14); G.fx.spark(aim, hit ? '#ff8a6a' : '#ffd34d', 6, 4, 0.25, 0.1);
    if (G.audio) G.audio.blip(1200, 0.03);
    if (!hit) return;
    const dir = this.w.set(c.x - e.pos.x, 0, c.z - e.pos.z).normalize();
    if (G.heroes && G.heroes.alive) G.heroes.hurt(3 + this.stars, dir.clone(), { knock: 2, kind: 'shock' });
    else if (p.state === 'drive') { G.car.hull = Math.max(0, (G.car.hull || 100) - (3 + this.stars)); }
    else {   // on foot, not a hero: each shot staggers you; the third and you are taken in
      p.play('hurt', 0.35); p.energy = Math.max(0, p.energy - 4); this.stuns++;
      if (this.stuns >= 3 && G.events) G.events.citation(Math.max(1, this.stars), ', stunned by enforcers');
    }
  }
  // ---- the frame ------------------------------------------------------------------------------------------
  update(dt, t) {
    if (!this.stars) { if (this.enf.length) { for (const e of this.enf) this.removeEnforcer(e); this.enf.length = 0; } this.draw(false); return; }
    const seen = this.sees();
    if (seen) { this.unseen = 0; this.last.copy(this.target()); } else this.unseen += dt;
    if (this.unseen > this.searchTime()) {
      const s = this.stars; this.clear(); if (G.events) G.events.lost();
      G.ui.flash('LOST THEM', 1.4); G.ui.toast(`You lost the patrol (${s} star${s > 1 ? 's' : ''}).`, 'good'); return;
    }
    // enforcers: 2 at three stars, 4 at four, 6 at five
    const want = this.stars >= 3 ? (this.stars - 2) * 2 : 0;
    this.respawn -= dt;
    if (this.enf.length < want && this.respawn <= 0) { this.spawnEnforcer(); this.respawn = 1.2; }
    while (this.enf.length > want) this.removeEnforcer(this.enf.pop());
    this.enf.forEach((e, i) => this.stepEnforcer(e, i, dt, seen, t));
    this.draw(false, t);
  }
  draw(force, t = G.elapsed) {
    if (!this.el) return;
    if (!this.stars) { if (this.shown !== '') { this.el.style.display = 'none'; this.shown = ''; } return; }
    const blink = this.searching && Math.sin(t * 10) > 0, key = `${this.stars}:${blink}`;
    if (key === this.shown && !force) return; this.shown = key;
    this.el.style.display = 'block';
    this.el.innerHTML = `<span style="color:${blink ? '#8a8f99' : '#ffd34d'}">${'★'.repeat(this.stars)}</span><span style="color:rgba(255,255,255,0.22)">${'★'.repeat(5 - this.stars)}</span>`;
  }
}
