// Street incidents: every few minutes something happens on the streets near you that you can
// help with. A hover car broken down at the kerb, a fire in a street kiosk, a lost dog. Each one
// is marked on the map (orange). Helping pays a little and lifts your standing; ignored, the city
// sorts it out by itself after a few minutes.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { clamp, damp, dampAngle, RNG } from '../core/util.js';
import { blockOf, URBAN } from '../world/metro/landuse.js';
import { buildVehicle, MODELS } from '../data/vehicles.js';
import { makeDog, animateDog } from '../entities/rigs.js';
import { std, neon } from '../world/materials.js';
import { money } from '../ui/ui.js';

const ORANGE = '#ff9a3c', KINDS = ['breakdown', 'fire', 'dog'];
const glowTex = (() => { let t = null; return () => { if (t) return t; const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return (t = new THREE.CanvasTexture(c)); }; })();

export class Incidents {
  constructor() {
    this.rng = new RNG(9191); this.t = 90; this.cur = null; this.helped = 0;
    this.group = new THREE.Group(); G.scene.add(this.group);
    // one interaction that does whatever the current incident needs
    this.it = G.interact.add({ pos: new THREE.Vector3(), r: 2.6, yTol: 2, prio: 0.4, label: () => this.label(), enabled: () => !!this.cur && !!this.action() && !G.minigame, use: () => this.use() });
    const beam = (this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 60, 10, 1, true), new THREE.MeshBasicMaterial({ color: ORANGE, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
    beam.visible = false; G.scene.add(beam);
    if (G.figureHooks) G.figureHooks.push((A, focus) => this.figures(A, focus));
  }
  // a free spot on a pavement 120 to 330 m away, with the direction to the road
  spot(min = 120, max = 330, around = null) {
    const p = around || (G.player.state === 'drive' ? G.car.pos : G.player.pos), r = this.rng, col = G.colliders, q = { x: 0, z: 0 };
    for (let k = 0; k < 30; k++) {
      const a = r.range(0, Math.PI * 2), d = r.range(min, max), i = blockOf(p.x + Math.cos(a) * d), j = blockOf(p.z + Math.sin(a) * d), b = G.metro.block(i, j);
      if (!b || !URBAN[b.use] || b.use === 'suburb' || b.cut || !(b.y0 > 0)) continue;
      const side = r.int(0, 3), along = r.range(-36, 36), nx = [0, 0, -1, 1][side], nz = [-1, 1, 0, 0][side];
      const x = b.cx + (nx ? nx * 47.4 : along), z = b.cz + (nz ? nz * 47.4 : along), y = b.y0;
      q.x = x; q.z = z; if (col.resolveCircle(q, 1.8, y + 0.3, y + 2.2)) continue;
      if (Math.abs(col.groundAt(x, z, y + 1, 0.5, 0.3) - y) > 0.2) continue;
      return { x, y, z, nx, nz, area: G.metro.areaAt(x, z) || 'the city' };
    }
    return null;
  }
  start(kind) {
    if (this.cur) this.clear();
    const s = this.spot(); if (!s) return false;
    const c = (this.cur = { kind, s, age: 0, phase: 'new', parts: new THREE.Group(), sprites: [], who: this.rng.int(0, 17) });
    this.group.add(c.parts);
    if (kind === 'breakdown') {
      const id = this.rng.pick(['wisp', 'halo', 'kestrel']), b = buildVehicle(id, this.rng.pick(['#e9edf2', '#2f6f8f', '#b23a48', '#6b4fa0']));
      c.car = b.g; c.yaw = s.nx ? (this.rng.chance(0.5) ? 0 : Math.PI) : (this.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);   // parallel to the kerb, in the road beside it
      c.car.position.set(s.x + s.nx * 4.4, 0.15 + MODELS[id].ride * 0.4, s.z + s.nz * 4.4); c.car.rotation.set(0, c.yaw, 0.06); c.parts.add(c.car);
      c.hazard = []; for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.1), neon('#ffb347', 2.4)); m.position.set(sx * 0.9, 0.55, sz * 1.9); c.car.add(m); c.hazard.push(m); }
      c.at = { x: s.x + s.nx * 1.6, y: s.y, z: s.z + s.nz * 1.6 }; c.fig = { x: s.x - s.nz * 2.2, z: s.z + s.nx * 2.2 };
      G.ui.toast(`Nearby: a hover car has broken down in ${s.area}. The driver could use a hand (marked orange).`, 'info');
    } else if (kind === 'fire') {
      const k = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 1.2), std('#2a2f38', 0.7, 0.3)); k.position.set(s.x, s.y + 1.1, s.z); c.parts.add(k);
      G.colliders.box(s.x - 0.8, s.x + 0.8, s.y, s.y + 2.2, s.z - 0.6, s.z + 0.6, { noCam: true }); c.box = G.colliders.all[G.colliders.all.length - 1];
      c.flames = [0, 1, 2, 3].map((n) => { const f = new THREE.Mesh(new THREE.ConeGeometry(0.42 - n * 0.06, 1.6 + n * 0.3, 7), new THREE.MeshBasicMaterial({ color: n % 2 ? '#ffb347' : '#ff5a1f', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })); f.position.set(s.x + (n - 1.5) * 0.3, s.y + 2.6, s.z + ((n % 2) - 0.5) * 0.3); c.parts.add(f); return f; });
      for (let n = 0; n < 7; n++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#3a3a40', transparent: true, opacity: 0.5, depthWrite: false })); sp.userData.k = n / 7; c.parts.add(sp); c.sprites.push(sp); }
      c.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#ff7a2a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); c.glow.scale.setScalar(7); c.glow.position.set(s.x, s.y + 2.6, s.z); c.parts.add(c.glow);
      c.at = { x: s.x - s.nx * 2.4, y: s.y, z: s.z - s.nz * 2.4 }; c.heat = 1; c.fig = { x: s.x - s.nz * 6, z: s.z + s.nx * 6 };
      G.ui.toast(`Nearby: a street kiosk is on fire in ${s.area} (marked orange). There is an extinguisher on it.`, 'warn');
    } else {
      const far = this.spot(50, 110, s); if (!far) { this.clear(); return false; }   // it wandered off a block or two from its owner
      c.owner = { x: s.x, y: s.y, z: s.z }; c.at = { x: s.x, y: s.y, z: s.z };
      c.dog = { rig: makeDog({ robot: this.rng.chance(0.3), color: this.rng.pick(['#c98a4f', '#e6ebf2', '#3a281c', '#d9b23a']), accent: '#ffb347', scale: 0.9 }), pos: new THREE.Vector3(far.x + (this.rng.next() - 0.5) * 8, far.y, far.z + (this.rng.next() - 0.5) * 8), yaw: 0, home: new THREE.Vector3(far.x, far.y, far.z), wT: 0, tgt: new THREE.Vector3() };
      c.dog.tgt.copy(c.dog.pos); c.parts.add(c.dog.rig.root); c.hint = { x: far.x + (this.rng.next() - 0.5) * 30, z: far.z + (this.rng.next() - 0.5) * 30 };
      c.name = this.rng.pick(['Biscuit', 'Comet', 'Pixel', 'Juniper', 'Rivet', 'Mango']);
      G.ui.toast(`Nearby: someone in ${s.area} has lost their dog (marked orange).`, 'info');
    }
    return true;
  }
  clear() { const c = this.cur; if (!c) return; if (c.box) c.box.enabled = false; c.parts.traverse((m) => { if (m.geometry) m.geometry.dispose(); }); c.parts.removeFromParent(); this.cur = null; this.t = 150 + this.rng.next() * 140; }
  action() {
    const c = this.cur; if (!c || c.phase === 'done' || c.phase === 'work') return null;
    if (c.kind === 'breakdown') return 'Help the driver: reset its lift pods';
    if (c.kind === 'fire') return 'Put out the fire with the kiosk\'s extinguisher';
    if (c.phase === 'new') return `Ask the owner about ${c.name}`;
    if (c.phase === 'search' && G.player.pos.distanceTo(c.dog.pos) < 3) return `Take ${c.name}'s lead`;
    return null;
  }
  label() { return this.action() || ''; }
  use() {
    const c = this.cur, p = G.player; if (!c) return;
    if (c.kind === 'dog') {
      if (c.phase === 'new') { c.phase = 'search'; G.ui.say({ name: 'Owner', pos: new THREE.Vector3(c.owner.x, c.owner.y, c.owner.z), h: 1.75 }, `${c.name} slipped the lead! Last seen that way. Please find them.`, 4); G.ui.toast(`Look for ${c.name} around the marked area.`, 'info'); return; }
      if (c.phase === 'search') { c.phase = 'lead'; G.ui.toast(`${c.name} is following you. Take them back to their owner.`, 'good'); if (G.audio) G.audio.blip(880, 0.08); return; }
      return;
    }
    // the hands-on ones: a few seconds' work
    c.phase = 'work'; c.work = 0; p.state = 'busy'; p.busyAnim = c.kind === 'fire' ? 'work' : 'tend'; p.faceCam = false; p.vel.set(0, 0, 0);
    p.yaw = Math.atan2((c.kind === 'fire' ? c.s.x : c.car.position.x) - p.pos.x, (c.kind === 'fire' ? c.s.z : c.car.position.z) - p.pos.z);
  }
  done(pay, msg) {
    const c = this.cur; c.phase = 'done'; c.age = 0; this.helped++; G.economy.earn(pay, 'helped out'); G.state.standing = clamp(G.state.standing + 3, -100, 100);
    G.state.done.helped = (G.state.done.helped || 0) + 1; G.ui.toast(`${msg} ${money(pay)} and your standing in the city goes up.`, 'good'); if (G.audio) G.audio.ui('pay');
  }
  // where to look now
  markers() {
    const c = this.cur; if (!c || c.phase === 'done') return [];
    if (c.kind === 'dog') return c.phase === 'search' ? [{ x: c.hint.x, z: c.hint.z, color: ORANGE }] : [{ x: c.owner.x, z: c.owner.z, color: ORANGE }];
    return [{ x: c.at.x, z: c.at.z, color: ORANGE }];
  }
  update(dt, t) {
    const p = G.player, busy = G.minigame || (G.story && G.story.scene) || G.ui.menu;
    if (!this.cur) {
      if (!G.started || busy || (p.state !== 'walk' && p.state !== 'drive')) return;
      this.t -= dt; if (this.t <= 0) { if (!this.start(KINDS[this.rng.int(0, KINDS.length - 1)])) this.t = 30; }
      return;
    }
    const c = this.cur; c.age += dt;
    const me = p.state === 'drive' ? G.car.pos : p.pos, far = Math.hypot(me.x - c.s.x, me.z - c.s.z);
    // ignored for too long, or left far behind: the city deals with it
    if (c.phase !== 'done' && c.phase !== 'work' && (c.age > 260 || far > 900) && c.phase !== 'lead') { if (far < 200) G.ui.toast(c.kind === 'fire' ? 'A fire drone has put the kiosk fire out.' : c.kind === 'dog' ? `${c.name} found their own way home.` : 'A recovery drone has taken the broken-down car away.', 'info'); this.clear(); return; }
    if (c.phase === 'done' && c.age > 14) { this.clear(); return; }
    this.it.pos.set(c.kind === 'dog' && c.phase === 'search' ? c.dog.pos.x : c.at.x, c.kind === 'dog' && c.phase === 'search' ? c.dog.pos.y : c.at.y, c.kind === 'dog' && c.phase === 'search' ? c.dog.pos.z : c.at.z);
    // the work in hand
    if (c.phase === 'work') {
      c.work += dt; const need = c.kind === 'fire' ? 4.5 : 3.5;
      G.ui.setObjective({ title: c.kind === 'fire' ? 'Kiosk fire' : 'Breakdown', text: `${c.kind === 'fire' ? 'Spraying' : 'Resetting the lift pods'}: ${Math.round((c.work / need) * 100)}%`, sub: 'Hold steady' });
      if (c.kind === 'fire') { c.heat = Math.max(0, 1 - c.work / need); this.spray(dt, t); }
      if (p.state !== 'busy') { c.phase = 'new'; G.ui.setObjective(null); }
      else if (c.work >= need) {
        p.state = 'walk'; p.busyAnim = null; G.ui.setObjective(null);
        if (c.kind === 'fire') { c.heat = 0; this.done(80, 'The fire is out.'); }
        else { this.done(60, 'The lift pods come back to life. "You\'re a lifesaver!"'); c.leaving = 0; }
      }
    }
    // visuals
    if (c.kind === 'breakdown') {
      const on = c.phase !== 'done' && Math.sin(t * 6) > 0; for (const h of c.hazard) h.visible = on;
      if (c.phase === 'done') { c.leaving += dt; const car = c.car; car.position.y = damp(car.position.y, 0.9, 2, dt); car.rotation.z = damp(car.rotation.z, 0, 3, dt); if (c.leaving > 2.5) { const f = Math.min(14, (c.leaving - 2.5) * 6); car.position.x += Math.sin(c.yaw) * f * dt; car.position.z += Math.cos(c.yaw) * f * dt; } }   // it floats up and drives off
    } else if (c.kind === 'fire') {
      const h = c.phase === 'done' ? Math.max(0, (c.heat || 0)) : c.heat;
      c.flames.forEach((f, n) => { const k = h * (0.8 + 0.3 * Math.sin(t * (9 + n) + n)); f.scale.set(Math.max(0.01, h), Math.max(0.01, k), Math.max(0.01, h)); f.visible = h > 0.02; });
      c.glow.material.opacity = h * (0.6 + 0.2 * Math.sin(t * 13)); c.glow.visible = h > 0.02;
      c.sprites.forEach((sp) => { const u = (t * 0.25 + sp.userData.k) % 1; sp.position.set(c.s.x + Math.sin(u * 7 + sp.userData.k * 9) * 0.8 * u, c.s.y + 3 + u * 9, c.s.z + Math.cos(u * 5) * 0.6 * u); sp.scale.setScalar(1.5 + u * 5); sp.material.opacity = (1 - u) * 0.55 * Math.max(h, c.phase === 'done' ? (1 - c.age / 10) * 0.5 : 0); });
    } else this.dogStep(dt, t);
    // a beam over it until you get there
    const mk = this.markers()[0]; this.beam.visible = !!mk && far > 25;
    if (this.beam.visible) { this.beam.position.set(mk.x, c.s.y + 30, mk.z); this.beam.material.opacity = 0.13 + Math.sin(t * 3) * 0.05; }
  }
  spray(dt, t) {
    const c = this.cur, p = G.player;
    if (!c.puffs) { c.puffs = []; for (let n = 0; n < 10; n++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#eef4ff', transparent: true, opacity: 0.6, depthWrite: false })); c.parts.add(sp); c.puffs.push(sp); } }
    c.puffs.forEach((sp, n) => { const u = (t * 1.8 + n / 10) % 1; sp.position.set(p.pos.x + (c.s.x - p.pos.x) * u, p.pos.y + 1.2 + u * 1.1, p.pos.z + (c.s.z - p.pos.z) * u); sp.scale.setScalar(0.3 + u * 1.6); sp.material.opacity = 0.55 * (1 - u); });
  }
  dogStep(dt, t) {
    const c = this.cur, d = c.dog, p = G.player; let speed = 0;
    if (c.phase === 'lead') {
      const tx = p.pos.x - Math.sin(p.yaw) * 1.4, tz = p.pos.z - Math.cos(p.yaw) * 1.4, dx = tx - d.pos.x, dz = tz - d.pos.z, dd = Math.hypot(dx, dz);
      if (dd > 0.4) { speed = Math.min(dd * 2.4, 7.5); d.pos.x += (dx / dd) * speed * dt; d.pos.z += (dz / dd) * speed * dt; d.yaw = dampAngle(d.yaw, Math.atan2(dx, dz), 8, dt); }
      d.pos.y = G.colliders.groundAt(d.pos.x, d.pos.z, d.pos.y + 0.5, 0.5, 0.2);
      if (Math.hypot(d.pos.x - c.owner.x, d.pos.z - c.owner.z) < 4.5) { c.phase = 'done'; c.age = 0; this.done(100, `${c.name} is home. The owner can't stop thanking you.`); }
    } else if (c.phase === 'done') {
      const dx = c.owner.x - d.pos.x, dz = c.owner.z - d.pos.z, dd = Math.hypot(dx, dz);
      if (dd > 0.9) { speed = 3; d.pos.x += (dx / dd) * speed * dt; d.pos.z += (dz / dd) * speed * dt; d.yaw = Math.atan2(dx, dz); }
    } else {           // nosing about where it got lost
      d.wT -= dt;
      if (d.wT <= 0) { d.wT = 2 + Math.random() * 4; d.tgt.set(d.home.x + (Math.random() - 0.5) * 10, d.home.y, d.home.z + (Math.random() - 0.5) * 10); }
      const dx = d.tgt.x - d.pos.x, dz = d.tgt.z - d.pos.z, dd = Math.hypot(dx, dz);
      if (dd > 0.3) { speed = 1.2; d.pos.x += (dx / dd) * speed * dt; d.pos.z += (dz / dd) * speed * dt; d.yaw = dampAngle(d.yaw, Math.atan2(dx, dz), 5, dt); }
      d.pos.y = G.colliders.groundAt(d.pos.x, d.pos.z, d.pos.y + 0.5, 0.5, 0.2);
    }
    d.rig.root.position.copy(d.pos); d.rig.root.rotation.y = d.yaw;
    animateDog(d.rig, dt, speed > 3.4 ? 'run' : speed > 0.1 ? 'walk' : 'idle', speed);
  }
  // the people involved: the driver, the bystanders at a fire, the dog's owner
  figures(A, focus) {
    const c = this.cur; if (!c || (focus.x - c.s.x) ** 2 + (focus.z - c.s.z) ** 2 > 160 * 160) return;
    const face = (x, z) => Math.atan2(x - (c.fig ? c.fig.x : c.s.x), z - (c.fig ? c.fig.z : c.s.z));
    if (c.kind === 'breakdown') A.put('inc-driver', c.fig.x, c.s.y, c.fig.z, face(c.car.position.x, c.car.position.z), c.who, c.phase === 'done' ? 'wave' : 'phone', 0, focus);
    else if (c.kind === 'fire') for (let k = 0; k < 3; k++) { const x = c.fig.x + (k - 1) * 1.6, z = c.fig.z + (k - 1) * 0.8; A.put('inc-by' + k, x, c.s.y, z, Math.atan2(c.s.x - x, c.s.z - z), c.who + k * 3, k === 1 && c.phase !== 'done' ? 'phone' : 'idle', k, focus); }
    else A.put('inc-owner', c.owner.x, c.owner.y, c.owner.z, c.phase === 'lead' || c.phase === 'done' ? Math.atan2(c.dog.pos.x - c.owner.x, c.dog.pos.z - c.owner.z) : 0, c.who, c.phase === 'done' ? 'pet' : 'wave', 0, focus);
  }
}
