// The city's own agenda: lamp failures and repairs, the nightly holo-concert, shop hours,
// weather notices, and the Aegis security drone that patrols, scans and writes citations
// for reckless flying, running red lights, speeding on the streets or parking an aerocar in the
// park. It answers anywhere in the city: it asks you to pull over, and running from it costs more.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { makeDrone } from '../entities/rigs.js';
import { PathLine, roundedRectLoop, RNG, damp, dampAngle, clamp } from '../core/util.js';
import { money } from '../ui/ui.js';
import { ranRed } from '../world/metro/streets.js';

export class Events {
  constructor() {
    this.rng = new RNG(555); this.lampT = 70; this.heat = 0; this.parkT = 0; this.cool = 0; this.scanT = 25;
    // medical response: a med-drone based at the Skyport
    this.medT = 240; this.med = null; this.marketOpen = false;
    this.medic = makeDrone('police'); this.medic.cone.material.color.set(0x7dff9c); this.medic.root.visible = false; G.scene.add(this.medic.root);
    this.medHome = new THREE.Vector3(-153, 30, 25); this.mpos = this.medHome.clone(); this.medName = { name: 'MedLink-3', pos: this.mpos, h: 0.9 };
    this.helpItem = G.interact.add({ pos: new THREE.Vector3(), r: 2.6, prio: 0.3, label: () => `Check on ${this.med.npc.name}`, enabled: () => !!this.med && this.med.phase !== 'leave' && !this.med.helped, use: () => this.helpPatient() });
    this.drone = makeDrone('police'); G.scene.add(this.drone.root);
    this.dpos = new THREE.Vector3(60, 9, -60); this.name = 'Aegis-12'; this.pos = this.dpos; this.h = 0.9;
    this.patrol = new PathLine(roundedRectLoop(-62, 62, -62, 62, 9, 10, 4), true); this.ps = 0; this.mode = 'patrol'; this.scan = 0; this.target = null;
    this.wasOpen = {}; this.stageOn = false;
    G.env.onWeather = (w) => { if (w === 'storm') G.addNews('storm'); if (G.started) G.ui.toast(`Weather change: ${G.env.label}.`, 'info'); };
    G.env.onThunder = (d) => { if (G.audio) G.audio.thunder(d); };
  }
  lampFixed() { G.addNews('lamp'); }
  helpPatient() {
    const m = this.med, n = m.npc, p = G.player; m.helped = true;
    p.yaw = Math.atan2(n.pos.x - p.pos.x, n.pos.z - p.pos.z); p.play('pet', 2.5);
    G.dialogue.rep(n, 12, 'stayed with them when they collapsed'); G.state.standing = clamp(G.state.standing + 2, -100, 100);
    G.ui.say(n, n.android ? 'Assistance acknowledged.' : 'Thank you... just dizzy.', 3.5); G.ui.toast(`You stay with ${n.name} until the med-drone arrives.`, 'good');
  }
  // Now and then someone is taken ill in the street. A med-drone flies out; bystanders stop and look.
  updateMedical(dt, t) {
    const d = this.medic, q = this.mpos;
    if (!this.med) {
      this.medT -= dt;
      if (this.medT <= 0 && G.started && G.npcs) {
        this.medT = 380 + this.rng.next() * 260;
        const c = G.npcs.near.filter((n) => n.body === 'humanoid' && !n.android && !n.child && !n.role && !n.inside && !n.doing && !n.chat && !n.converse && !n.hold && n.pos.y < 1 && !G.npcs.indoors(n.pos));
        if (!c.length) { this.medT = 40; return; }
        const n = this.rng.pick(c);
        this.med = { npc: n, phase: 'fly', t: 0, helped: false, cruise: Math.max(30, G.colliders.clearAltitude(q.x, q.z, n.pos.x, n.pos.z, 2, 8)) };
        n.hold = { anim: 'faint', until: () => !this.med || this.med.npc !== n || this.med.phase === 'leave' };
        n.feel('surprised', 40); if (n.isNear) G.ui.say(n, 'I... need to sit down.', 3.5);
        this.helpItem.pos.copy(n.pos); d.root.visible = true; q.copy(this.medHome);
        if (n.d2 < 70 * 70) G.ui.toast('A resident has collapsed nearby. A med-drone is on its way.', 'warn');
      }
      return;
    }
    const m = this.med, n = m.npc; m.t += dt;
    if (!n.hold && m.phase !== 'leave') m.phase = 'leave'; // the day moved on (sleep / time skip)
    const speed = m.helped ? 30 : 18, home = m.phase === 'leave';
    const tx = home ? this.medHome.x : n.pos.x, tz = home ? this.medHome.z : n.pos.z, ty = home ? this.medHome.y : n.pos.y + 2.4;
    const hd = Math.hypot(tx - q.x, tz - q.z);
    if (hd > 1) { if (q.y < m.cruise - 1) q.y += 12 * dt; else { const st = Math.min(hd, speed * dt); q.x += ((tx - q.x) / hd) * st; q.z += ((tz - q.z) / hd) * st; d.root.rotation.y = Math.atan2(tx - q.x, tz - q.z); } }
    else if (Math.abs(q.y - ty) > 0.15) q.y += Math.sign(ty - q.y) * Math.min(Math.abs(ty - q.y), 9 * dt);
    else if (m.phase === 'fly') {
      m.phase = 'treat'; m.t = 0; G.ui.say(this.medName, 'Vitals stable. Administering fluids.', 4);
      // bystanders stop and watch
      let said = 0;
      for (const o of G.npcs.close) if (o !== n && o.body === 'humanoid' && !o.doing && !o.hold && !o.chat && (o.pos.x - n.pos.x) ** 2 + (o.pos.z - n.pos.z) ** 2 < 90) { o.react = { anim: 'idle', t: 6 }; o.faceYaw = o.faceTo(n.pos.x, n.pos.z); if (said++ < 2) G.ui.say(o, said === 1 ? 'Are they all right?' : 'Give them some air.', 3); }
    } else if (m.phase === 'treat' && m.t > 7) {
      m.phase = 'leave'; n.feel('happy', 8); if (n.isNear) G.ui.say(n, 'I am all right. Thank you.', 3.5); G.addNews('medical');
    } else if (home) { d.root.visible = false; this.med = null; }
    d.root.position.set(q.x, q.y + Math.sin(t * 3) * 0.05, q.z); d.cone.visible = m.phase === 'treat';
    const fl = Math.sin(t * 10) > 0; d.red.color.setRGB(0.2, fl ? 3 : 0.4, 0.5); d.blue.color.setRGB(fl ? 0.6 : 2.5, 2.5, 2.5);
    for (const r of d.rotors) r.rotation.z += dt * 45;
  }
  // Something worth the drone's attention happened.
  report(kind, amount) {
    if (this.cool > 0 || (G.racing && G.racing.gp) || (G.nightRun && G.nightRun.race) || G.minigame) return; // organised races are sanctioned
    this.heat += kind === 'crash' ? clamp(amount / 6, 0.5, 2.5) : kind === 'lowfly' ? 1.2 : amount;
    if (this.heat >= 3 && this.mode === 'patrol') {
      this.mode = 'respond'; this.chase = 0; this.evaded = false;
      this.why = { park: 'parking an aerocar in the Commons', lane: 'manual flight inside a sky lane', red: 'running a red light', speed: 'speeding on city streets', assault: 'attacking residents', damage: 'damaging city property' }[kind] || (kind === 'crash' ? 'reckless driving' : 'reckless flying');
      this.fine = { park: 40, lane: 80, red: 70, speed: 60, assault: 120, damage: 90 }[kind] || 60;
      // it comes to you, wherever you are: in from above if it is far away
      const c = G.player.state === 'drive' ? G.car.pos : G.player.pos, q = this.dpos;
      if (Math.hypot(c.x - q.x, c.z - q.z) > 260) q.set(c.x - Math.sin(G.car.yaw) * 160, c.y + 60, c.z - Math.cos(G.car.yaw) * 160);
      G.ui.toast(`Aegis-12, Civic Patrol: ${this.why}. ${G.player.state === 'drive' ? 'Pull over and stop.' : 'Stay where you are.'}`, 'warn'); if (G.audio) { G.audio.tone(880, 0.25, 0.05, 'square'); setTimeout(() => G.audio && G.audio.tone(660, 0.3, 0.05, 'square'), 260); }
    }
  }
  // what the patrol watches on the ground: red lights and speed on the city's streets
  watchStreets(dt, t) {
    const p = G.player, car = G.car, prev = this.prevCar || (this.prevCar = car.pos.clone());
    if (p.state === 'drive' && car.mode === 'drive' && Math.abs(car.pos.x) < 1600 && car.pos.z > -1600 && car.pos.z < 1150 && !(G.districts.at(car.pos))) {
      if (ranRed(prev.x, prev.z, car.pos.x, car.pos.z, t)) { G.ui.flash('RED LIGHT', 1); this.report('red', 2.2); }
      const highway = G.metro.roadNear({ x0: car.pos.x - 6, x1: car.pos.x + 6, z0: car.pos.z - 6, z1: car.pos.z + 6 }, 4);   // no speed limit on the highways and the ring road
      this.fastT = car.speed > 34 && !highway ? (this.fastT || 0) + dt : 0;
      if (this.fastT > 3) { this.fastT = -6; G.ui.toast('Speeding: the limit on city streets is 120 km/h.', 'warn'); this.report('speed', 1.8); }
    } else this.fastT = 0;
    prev.copy(car.pos);
  }
  update(dt, t) {
    const env = G.env, city = G.city, p = G.player, car = G.car, near = (x, z, r) => (p.pos.x - x) ** 2 + (p.pos.z - z) ** 2 < r * r;
    this.updateMedical(dt, t);
    // evening market: stalls are set up at 17:00 and packed away at 21:30
    const mOpen = env.hour >= 17 && env.hour < 21.5;
    if (mOpen !== this.marketOpen) { this.marketOpen = mOpen; city.places.market.open = mOpen; for (const s of city.places.market.stalls) { s.g.visible = mOpen; s.c.enabled = mOpen; } if (mOpen) { G.addNews('market'); if (G.started) G.ui.toast('The evening market is setting up by the east path of the Commons.', 'info'); } }
    // street lamps fail now and then; the maintenance units go and fix them
    this.lampT -= dt;
    if (this.lampT <= 0) {
      this.lampT = 90 + this.rng.next() * 120;
      if (city.lamps.broken.size < 3) { const i = this.rng.int(0, city.lamps.pos.length - 1); if (!city.lamps.broken.has(i)) { city.lamps.set(i, false); const [x, z] = city.lamps.pos[i]; if (G.started && near(x, z, 70)) G.ui.toast('A street lamp nearby just failed. A maintenance unit has been dispatched.', 'info'); } }
    }
    // nightly concert
    const on = env.hour >= 20 || env.hour < 1;
    if (on !== this.stageOn) { this.stageOn = on; city.places.stage.on = on; if (on) G.addNews('concert'); if (G.started && on) G.ui.toast('The holo-concert is starting on the Commons stage.', 'info'); }
    // opening / closing notices when you are close enough to care
    for (const d of city.doors) if (d.hours) {
      const was = this.wasOpen[d.id]; this.wasOpen[d.id] = d.isOpenHours;
      if (was !== undefined && was !== d.isOpenHours && G.started && near(d.x, d.z, 60)) G.ui.toast(d.id === 'restaurant' ? (d.isOpenHours ? 'Printed Petal is open: sterilization cycle complete.' : 'Printed Petal has closed for its sterilization cycle.') : d.isOpenHours ? 'Kinetic Robotics is open.' : 'Kinetic Robotics has closed for the night.', 'info');
    }
    // parking in the park is not allowed
    const inPark = car.mode !== 'fly' && Math.abs(car.pos.x) < 48 && Math.abs(car.pos.z) < 48 && car.pos.y < 4;
    this.parkT = inPark ? this.parkT + dt : 0;
    if (this.parkT > 8) { this.parkT = -20; this.report('park', 3); }
    this.heat = Math.max(0, this.heat - dt * 0.03); this.cool -= dt;
    this.watchStreets(dt, t);

    // Aegis drone
    const d = this.drone, q = this.dpos;
    let tx, ty, tz, speed = 5;
    if (this.mode === 'patrol') {
      this.ps += 5 * dt; const o = {}; this.patrol.sample(this.ps, o); tx = o.x; ty = 9 + Math.sin(t * 0.7) * 0.6; tz = o.z;
      this.scanT -= dt;
      if (this.scanT <= 0 && G.npcs) { this.scanT = 35 + this.rng.next() * 30; const c = G.npcs.near.filter((n) => n.body === 'humanoid' && !n.inside && (n.pos.x - q.x) ** 2 + (n.pos.z - q.z) ** 2 < 30 * 30); if (c.length) { this.mode = 'idscan'; this.target = this.rng.pick(c); this.scan = 0; } }
    } else if (this.mode === 'idscan') {
      const n = this.target; tx = n.pos.x; ty = n.pos.y + 5.5; tz = n.pos.z; speed = 9;
      if (Math.hypot(tx - q.x, tz - q.z) < 1.5) { this.scan += dt; if (this.scan > 2.6 || n.inside) { if (n.isNear && !n.inside) G.ui.say(this, `ID verified: ${n.name}. Thank you.`, 2.6); this.mode = 'patrol'; } }
    } else { // respond to the player: pull over (stop) and be scanned, or pay double for running
      const c = p.state === 'drive' ? car.pos : p.pos, moving = p.state === 'drive' && car.speed > 2;
      tx = c.x; ty = c.y + 5; tz = c.z; speed = Math.max(24, (p.state === 'drive' ? car.speed : 0) + 8);
      this.chase += dt;
      const ticket = (mult, extra) => {
        const s = G.state, fine = Math.min(s.wallet, this.fine * mult); s.wallet -= fine; s.stats.fines++; s.standing = clamp(s.standing - 5 * mult, -100, 100);
        G.ui.say(this, `Citation issued: ${this.why}${extra}.`, 4); G.ui.toast(`Aegis-12: citation for ${this.why}${extra}. −${money(fine)}`, 'warn');
        this.mode = 'patrol'; this.heat = 0; this.cool = 30; this.scan = 0; G.addNews('citation'); G.ui.setObjective(null);
      };
      if (!G.minigame) G.ui.setObjective({ title: 'Civic Patrol', text: moving ? `Pull over and stop: ${Math.max(0, Math.ceil(18 - this.chase))} s` : 'Hold still for the scan', sub: `Aegis-12 · ${this.why}` });
      if (Math.hypot(tx - q.x, tz - q.z) < 3 && Math.abs(ty - q.y) < 3.5 && !moving) {
        this.scan += dt;
        if (this.scan > 2.2) ticket(1, '');
      } else this.scan = 0;
      if (this.mode === 'respond' && this.chase > 18 && moving) ticket(2, ', and failing to stop');
    }
    const dx = tx - q.x, dy = ty - q.y, dz = tz - q.z, dist = Math.hypot(dx, dy, dz), st = Math.min(dist, speed * dt);
    if (dist > 0.01) { q.x += (dx / dist) * st; q.y += (dy / dist) * st; q.z += (dz / dist) * st; d.root.rotation.y = dampAngle(d.root.rotation.y, Math.atan2(dx, dz), 4, dt); }
    d.root.position.copy(q);
    const scanning = this.mode !== 'patrol' && this.scan > 0; d.cone.visible = scanning;
    const fl = this.mode === 'respond' ? Math.sin(t * 16) > 0 : Math.sin(t * 3) > 0;
    d.red.color.setRGB(fl ? 3 : 0.3, 0.05, 0.05); d.blue.color.setRGB(0.05, 0.1, fl ? 0.3 : 3);
    for (const r of d.rotors) r.rotation.z += dt * 45;
  }
}
