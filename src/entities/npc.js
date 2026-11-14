// Residents and service machines. Each one has an identity, a daily plan, friends, a mood and
// a memory of the player, and walks the nav graph to do things: commute (air shuttle or maglev),
// work, eat, sit in the park, exercise, visit the market, walk a dog, tend planters, repair
// lamps, deliver parcels. Three tiers of simulation keep a full district affordable:
//   close (within ~25 m): full animated rig, steering, reactions, conversations
//   mid   (within ~125 m): instanced impostor, same schedule and movement
//   far   (everyone else): schedule + path following only, nothing drawn
import * as THREE from 'three';
import { G } from '../core/game.js';
import { terrainY } from '../world/city.js';
import { std } from '../world/materials.js';
import { makeHumanoid, varyLook, animateRig, setMood, makeDog, animateDog, makeRover, makeCleaner, makeParcel, addCanopy } from './rigs.js';
import { buildCast, buildLocals, ambientPair } from '../data/people.js';
import { Crowd } from './crowd.js';
import { RNG, dampAngle, damp, clamp, angDelta, TAU } from '../core/util.js';

const OUTDOOR = new Set(['park', 'stroll', 'walkdog', 'play', 'jog', 'tour', 'concert', 'market', 'exercise']);
const LEISURE = new Set(['park', 'stroll', 'tour', 'walkdog', 'shop', 'concert', 'market']);
const PARK_NODES = ['fN', 'fE', 'fS', 'fW', 'oN', 'oE', 'oS', 'oW', 'gNE', 'gSE', 'gSW', 'gNW', 'nMid', 'sMid', 'vend', 'jobs', 'cartF', 'play', 'aud'];
const TOUR_NODES = ['fN', 'fS', 'fE', 'fW', 'aud', 'vend', 'cartF', 'restDoor', 'b7mN', 'old0', 'old2', 'b4mW', 'gNE', 'gSW', 'b3mE', 'b5mW', 'mag2'];
const LOOP = ['b4NW', 'b4NE', 'b4SE', 'b4SW'];
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const POST_ANIM = { vendor: 'tend', chef: 'tend', wellness: 'taichi', worker: 'work', gardener: 'tend', dj: 'dance', cook: 'tend' };

class NPC {
  constructor(def, sys) {
    this.def = def; this.sys = sys; this.id = def.id; this.name = def.name; this.job = def.job; this.lines = def.lines || [];
    this.android = !!def.android; this.child = !!def.child; this.body = def.body || 'humanoid'; this.role = def.role || null; this.talk = !!def.talk;
    // in a fight (Hero Mode): about a quarter of adults fight back; androids and children never do
    this.fighter = !this.child && !this.android && hash(def.id + ':fight') % 100 < 27;
    this.hp = null; this.dead = null; this.outUntil = null; this.provoked = -99;
    this.friends = def.friends || []; this.partner = def.partner || null; this.zone = def.zone || null; // zone: lives in an outer district
    this.rng = new RNG(hash(def.id));
    this.plan = def.plan.map((e) => ({ t: e[0], act: e[1], at: e[2], face: e[3] })).sort((a, b) => a.t - b.t);
    this.home = def.home; this.work = def.work || def.home;
    this.transit = def.transit || 'shuttle'; this.transitNode = this.transit === 'shuttle' ? 'pw4' : this.transit; this.magK = this.transit === 'shuttle' ? -1 : +this.transit.slice(3);
    this.pos = new THREE.Vector3(); this.yaw = 0; this.faceYaw = null;
    // outfit details, body shape and gait are derived from the id, so everyone is distinct but stable
    if (this.body === 'humanoid' && def.look) def.look = varyLook(def.look, hash(def.id + ':look'), { child: this.child, elder: /^retired/.test(def.job || ''), generic: !def.role && (/^p\d+$/.test(def.id) || (!!def.zone && !def.id.includes(':'))) });
    const look = def.look || {}, C = (h) => new THREE.Color(h), skin = this.android ? look.shell || '#dfe5ee' : look.skin || '#c68d6b', cover = look.hat && look.hat !== 'phones';
    this.scale = (look.height || 1.75) / 1.75; this.build = look.build || 1; this.h = this.body === 'humanoid' ? (look.height || 1.75) + 0.28 : 1.25;
    this.col = { top: C((look.outfit === 'vest' && look.vest) || look.top || '#eef2f6'), bottom: C(look.legs === 'skirt' ? skin : look.bottom || '#3b4250'), skin: C(skin), arm: C(look.sleeves === 'none' ? skin : look.top || '#eef2f6'),
      hair: this.android ? null : cover ? C(look.hat === 'hood' ? look.top : look.hatColor || look.top) : look.hairStyle === 4 ? null : C(look.hair || '#16171c') };
    this.baseSpeed = def.speed || this.rng.range(1.25, 1.55); this.lane = this.rng.range(0.7, 1.3); this.speedMul = 1; this.speedNow = 0; this.phase = this.rng.range(0, 6);
    this.inside = true; this.away = false; this.node = G.nav.get(this.home); this.path = null; this.pi = 0; this.onArrive = null; this.direct = null;
    this.doing = null; this.entry = null; this.act = null; this.seat = null; this.converse = false; this.chat = null; this.react = null; this.hold = null;
    this.cool = { bump: 0, flee: 0, chat: this.rng.range(5, 40), wave: 0, bark: this.rng.range(8, 50) };
    this.tier = 2; this.isNear = false; this.carrying = false; this.loopI = this.rng.int(0, 3); this.lamp = -1; this.moodT = 0; this.mood = 0; this.moodBoost = 0; this.k = 0; this.d2 = 1e9;
    this.rig = null;
    if (this.body === 'rover') { this.rig = makeRover(); this.parcel = makeParcel(); this.parcel.position.set(0, 0.86, 0); this.rig.root.add(this.parcel); }
    else if (this.body === 'cleaner') this.rig = makeCleaner();
    if (this.rig) { this.rig.root.visible = false; G.scene.add(this.rig.root); }
    if (def.pet) this.pet = { rig: null, pos: new THREE.Vector3(), yaw: 0, name: def.pet.name, speed: 0 };
    if (def.companion) this.buddy = { rig: null, pos: new THREE.Vector3(), yaw: 0, name: def.companion.name, speed: 0, porter: !!def.companion.porter, h: def.companion.porter ? 1.8 : 1.3 };
    if (this.talk) G.interact.add({ pos: this.pos, r: 2.3, yTol: 1.6, label: () => `Talk to ${this.name}`, enabled: () => this.tier === 0 && !this.inside && !this.react && !this.hold && G.dialogue, use: () => G.dialogue.start(this) });
  }
  get mem() { const p = G.state.people; return p[this.id] || (p[this.id] = { rep: 0, met: false, talks: 0, lastDay: 0, bumped: 0, gifts: 0, today: 0, asked: false }); }

  // ---- drawing tiers: rigs are built the first time someone is seen up close ----------------
  ensureRig() {
    if (this.rig) return;
    this.rig = makeHumanoid(this.def.look);
    if (!this.android) addCanopy(this.rig);
  }
  ensureExtras() {
    if (this.pet && !this.pet.rig) {
      this.pet.rig = makeDog(this.def.pet); G.scene.add(this.pet.rig.root); this.pet.pos.copy(this.pos);
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      this.leash = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: this.def.pet.robot ? 0x59e0ff : 0x7a5536 })); this.leash.frustumCulled = false; G.scene.add(this.leash);
    }
    if (this.buddy && !this.buddy.rig) {
      const b = this.buddy, porter = b.porter;
      b.rig = makeHumanoid({ kind: 'android', shell: porter ? '#c9d2de' : '#ffe08a', top: porter ? '#8a94a6' : '#ffd34d', bottom: '#3b4250', accent: porter ? '#59e0ff' : '#ff7ad9', height: porter ? 1.55 : 1.02, antenna: !porter, child: !porter });
      if (porter) { const p = makeParcel(); p.position.set(0, 0.42, 0.26); b.rig.chest.add(p); b.rig.carry = true; }
      G.scene.add(b.rig.root); b.pos.copy(this.pos);
    }
  }
  setTier(t) {
    const was = this.tier; this.tier = t;
    if (this.body !== 'humanoid') this.rig.root.visible = t <= 1;
    else if (t === 0) { this.ensureRig(); G.scene.add(this.rig.root); }
    else if (was === 0 && this.rig) this.rig.root.removeFromParent();
    const ex = t <= 1;
    if (ex) this.ensureExtras();
    if (this.pet && this.pet.rig) { this.pet.rig.root.visible = ex; this.leash.visible = ex; }
    if (this.buddy && this.buddy.rig) this.buddy.rig.root.visible = ex;
  }

  // ---- schedule ------------------------------------------------------------------------------
  entryAt(mins) { let e = this.plan[this.plan.length - 1]; for (const p of this.plan) { if (p.t <= mins) e = p; else break; } return e; }
  effective(e) {
    let a = e.act; const env = G.env, h = env.hour;
    if (this.zone) { if (a === 'club' && !(h >= 20 || h < 4)) a = 'stroll'; if (env.rain > 0.45 && a === 'stroll' && this.zone !== 'neonlow') a = 'home'; return a; }
    if (a === 'return' && !this.away) a = 'park';
    if (a === 'concert' && !(h >= 20 || h < 1.2)) a = 'park';
    if (a === 'shop' && !(h >= 9 && h < 20.8)) a = 'park';
    if (a === 'market' && !(h >= 17 && h < 21.4)) a = 'park';
    if (a === 'exercise' && !(h >= 6.15 && h < 7.8)) a = 'park';
    if (env.rain > 0.45 && OUTDOOR.has(a)) a = this.body === 'humanoid' && !this.child && h > 7.2 && h < 22 ? 'eat' : 'home';
    return a;
  }
  transitReady() { return this.magK < 0 ? G.traffic.shuttle.landed : G.city.train.at === this.magK; }
  think(dt, mins) {
    const c = this.cool; c.bump -= dt; c.flee -= dt; c.chat -= dt; c.wave -= dt; c.bark -= dt;
    this.moodBoost *= Math.exp(-dt / 150);
    const env = G.env;
    this.mood = clamp((env.rain > 0.4 && !this.android && !this.inside ? -0.3 : 0.1) + (env.hour > 23 || env.hour < 5 ? -0.15 : 0) + this.moodBoost, -1, 1);
    if (this.moodT > 0) this.moodT -= dt;
    // taken away by the medics: home until the next day comes round
    if (this.outUntil !== null) { if (G.env.day >= this.outUntil) this.outUntil = null; else { this.inside = true; return; } }
    const e = this.entryAt(mins), act = this.effective(e);
    if (e !== this.entry || act !== this.act) { this.entry = e; this.act = act; this.interrupt(); }
    if (this.hold) { if (this.hold.until()) this.hold = null; return; }
    if (this.converse || this.chat) return;
    if (this.react) { this.react.t -= dt; if (this.react.t <= 0) { this.react = null; if (!this.doing) this.faceYaw = null; } return; }
    if (this.inside) {
      // away commuters come home on the next shuttle or train
      if (this.away && e.act !== 'commute') { if (this.magK < 0) G.traffic.shuttle.wanted = true; if (this.transitReady()) { this.node = G.nav.get(this.transitNode); this.emerge(); } }
      return;
    }
    if (this.doing) { const d = this.doing; d.t -= dt; if (d.until ? d.until() : d.t <= 0) this.finishDoing(); return; }
    if (!this.path && !this.direct) this.next();
  }
  interrupt() {
    if (this.doing) this.finishDoing(true);
    if (this.seat) { this.seat.taken = null; this.seat = null; }
    if (this.path) { const a = this.path[Math.max(0, this.pi - 1)], b = this.path[Math.min(this.pi, this.path.length - 1)]; this.node = (a.x - this.pos.x) ** 2 + (a.z - this.pos.z) ** 2 < (b.x - this.pos.x) ** 2 + (b.z - this.pos.z) ** 2 ? a : b; }
    this.path = null; this.direct = null; this.onArrive = null; this.speedMul = 1; this.releaseLamp();
    if (this.inside && !this.away) {
      const stay = (this.act === 'home' && this.node.id === this.home) || (this.act === 'work' && this.node.id === this.work);
      if (!stay) this.emerge();
    }
  }
  // paid at a counter: a bag to carry for a while, a word with the keeper, the till
  bought(pay) {
    this.bagT = 150; this.sys.sales = (this.sys.sales || 0) + 1;
    if (this.isNear) { G.ui.say(this, this.rng.pick(['This one, please.', 'I\'ll take it.', 'Perfect, thank you.', 'Just this today.']), 2.6); if (G.audio && (G.player.pos.x - this.pos.x) ** 2 + (G.player.pos.z - this.pos.z) ** 2 < 15 * 15) G.audio.ui('pay'); }
  }
  releaseLamp() { if (this.lamp >= 0) { this.sys.claimed.delete(this.lamp); this.lamp = -1; } }
  emerge() { this.inside = false; this.away = false; this.pos.set(this.node.x, this.node.y, this.node.z); }
  goTo(id, onArrive, speedMul = 1) {
    const p = G.nav.path(this.node, id);
    if (!p) { this.doFor(3, 'idle'); return; }
    this.path = p; this.pi = 0; this.onArrive = onArrive || null; this.speedMul = speedMul; this.spotId = null;
  }
  arrive() { this.path = null; const f = this.onArrive; this.onArrive = null; this.speedMul = 1; if (f) f(); }
  doFor(t, anim, o) { this.doing = { t, anim, ...o }; this.faceYaw = o && o.face !== undefined ? o.face : null; }
  finishDoing(force) {
    const d = this.doing; this.doing = null; this.faceYaw = null;
    const keep = d.done && !force ? d.done() === true : false;
    if (d.plate) d.plate.visible = false;
    if (d.seat && !keep) { d.seat.taken = null; this.seat = null; }
  }
  sitAt(seat, t, anim, eat) {
    seat.taken = this.id; this.seat = seat;
    this.goTo(seat.node, () => {
      this.pos.set(seat.x, seat.y - 0.5, seat.z); this.yaw = seat.yaw;
      if (!eat) { this.doFor(t, anim, { seat }); return; }
      // order, wait for the kitchen, then eat
      this.doFor(this.rng.range(6, 11), 'sit', { seat, done: () => { const plate = this.sys.plate(seat); plate.visible = true; this.doFor(t, 'eat', { seat, plate }); if (G.food) G.food.ambientPrint(); return true; } });
    });
  }
  // Couples sit together: take the seat next to a partner who is already seated.
  pickSeat(kind) {
    const mate = this.partner && this.sys.byId.get(this.partner);
    if (mate && mate.seat && mate.seat.kind === kind) { const adj = this.sys.adjacent(mate.seat); if (adj && !adj.taken) return adj; }
    const free = G.city.seats.filter((s) => s.kind === kind && !s.taken);
    return free.length ? this.rng.pick(free) : null;
  }
  faceTo(x, z) { return Math.atan2(x - this.pos.x, z - this.pos.z); }
  // After reaching a shared gathering node, take a few steps to a spot of your own.
  spread(rx, rz, cb) { const r = this.rng; this.spotId = this.node.id; this.direct = { x: this.node.x + r.range(-rx, rx), z: this.node.z + r.range(-rz, rz), cb }; }
  // Already standing on a chosen spot at this gathering node? Then stay put.
  settled(id) { return this.spotId === id && this.node.id === id; }

  // Decide the next small thing to do within the current activity.
  next() {
    const r = this.rng, h = G.env.hour, e = this.entry;
    switch (this.act) {
      case 'home': return this.goTo(this.home, () => { this.inside = true; });
      case 'work': return this.goTo(this.work, () => { this.inside = true; });
      case 'post': return this.goTo(e.at, () => this.doFor(99999, POST_ANIM[this.role] || 'idle', { face: e.face, look: !POST_ANIM[this.role] }));
      case 'eat': {
        const seat = h >= 7 && h < 22.6 ? this.pickSeat('stool') : null;
        if (seat) return this.sitAt(seat, r.range(60, 110), 'eat', true);
        return this.parkAct();
      }
      case 'park': return this.parkAct();
      case 'stroll': case 'patrol': {
        const zs = this.zone && G.districts.zoneShops[this.zone];                 // locals drop into their district's shops
        if (zs && this.act === 'stroll' && r.chance(0.28)) return this.goTo(r.pick(zs), () => this.doFor(r.range(6, 14), 'idle', { look: true }));
        const n = r.pick(this.zone ? this.sys.zones[this.zone] : this.sys.street);
        return this.goTo(n.id, () => this.doFor(this.act === 'patrol' ? r.range(3, 7) : r.range(1, 3), 'idle', { look: true }));
      }
      case 'shop': {
        // browse; then, more often than not, take something to the counter and pay for it
        const id = r.pick(r.chance(0.7) && G.nav.shopNodes.length ? G.nav.shopNodes : ['shopA', 'shopB', 'shopC', 'shopD', 'shopCounter']), pay = G.nav.payNodes && G.nav.payNodes[id];
        const buy = pay && r.chance(0.6) ? () => { this.goTo(pay.id, () => this.doFor(3.4, 'talk', { face: this.faceTo(pay.keeper.x, pay.keeper.z), done: () => { this.bought(pay); return false; } })); return true; } : undefined;
        return this.goTo(id, () => this.doFor(r.range(5, 11), 'idle', { look: true, done: buy }));
      }
      case 'market': { const k = r.int(0, 2), st = G.city.places.market.stalls[k]; return this.goTo('stallF' + k, () => this.spread(1.7, 0.9, () => this.doFor(r.range(5, 10), r.chance(0.5) ? 'talk' : 'idle', { face: this.faceTo(st.x, st.z), look: true }))); }
      case 'exercise': { const id = 'aud' + (this.k % 8), go = () => this.doFor(r.range(14, 22), 'taichi', { face: this.faceTo(-12, 21.6) }); return this.settled(id) ? go() : this.goTo(id, () => this.spread(1.3, 1.3, go)); }
      case 'club': { const id = this.def.club, go = () => this.doFor(r.range(8, 14), 'dance', { face: this.faceTo(this.node.x + 34, this.node.z - 14) }); return this.settled(id) ? go() : this.goTo(id, () => this.spread(9, 8, go)); }
      case 'concert': {
        const st = G.city.places.stage;
        const id = 'aud' + (this.k % 8), go = () => this.doFor(r.range(8, 14), st.on ? 'dance' : 'idle', { face: this.faceTo(st.x, st.z) });
        return this.settled(id) ? go() : this.goTo(id, () => this.spread(1.4, 1.4, go));
      }
      case 'walkdog': return this.goTo(r.chance(0.25) ? r.pick(['fN', 'fS', 'gNE', 'gSW', 'oW']) : LOOP[this.loopI++ % 4], () => this.doFor(r.range(2, 5), 'idle', { look: true }));
      case 'play': return this.goTo('play' + r.int(0, 3), () => this.doFor(r.range(0.4, 1.5), 'idle'), 2.1);
      case 'jog': return this.goTo(LOOP[this.loopI++ % 4], null, 2.4);
      case 'tend': { const k = this.loopI++ % 4, p = G.city.places.planters[k]; return this.goTo('plant' + k, () => this.doFor(r.range(12, 20), 'tend', { face: this.faceTo(p.x, p.z + (p.z > 0 ? 2 : -2)) })); }
      case 'repair': {
        const lamps = G.city.lamps;
        if (this.lamp < 0) for (const i of lamps.broken) if (!this.sys.claimed.has(i)) { this.lamp = i; this.sys.claimed.add(i); break; }
        if (this.lamp >= 0) {
          const i = this.lamp, [lx, lz, ox, oz] = lamps.pos[i], n = G.nav.nearest(lx, lz, (q) => q.street);
          return this.goTo(n.id, () => { this.direct = { x: lx - ox * 0.9, z: lz - oz * 0.9, cb: () => this.doFor(12, 'work', { face: this.faceTo(lx, lz), spark: [lx + ox * 0.7, 6.7, lz + oz * 0.7], done: () => { lamps.set(i, true); this.releaseLamp(); if (this.isNear) G.ui.say(this, 'Lamp restored. Logging repair.'); if (G.events) G.events.lampFixed(); } }) }; }, 1.5);
        }
        return this.goTo(r.pick(this.sys.street).id, () => this.doFor(r.range(3, 6), 'idle', { look: true }));
      }
      case 'deliver':
        if (!this.carrying) return this.goTo('skyHub2', () => this.doFor(5, 'idle', { done: () => { this.carrying = true; } }));
        return this.goTo(r.pick(G.nav.doors), () => this.doFor(4, 'idle', { done: () => { this.carrying = false; if (this.isNear) G.ui.say(this, 'Parcel delivered. Have a pleasant day.'); } }));
      case 'clean': return this.goTo(r.pick(PARK_NODES), () => this.doFor(1.5, 'idle'));
      case 'tour': return this.goTo(r.pick(TOUR_NODES), () => this.doFor(r.range(6, 12), r.chance(0.3) ? 'wave' : 'idle', { look: true }));
      case 'commute': return this.goTo(this.transitNode, () => {
        if (this.magK < 0) G.traffic.shuttle.wanted = true;
        const tgt = this.magK < 0 ? [-120, -24] : [G.city.stations[this.magK].x, G.city.stations[this.magK].z];
        this.doFor(99999, 'idle', { face: this.faceTo(tgt[0], tgt[1]), look: true, until: () => this.transitReady(), done: () => { this.inside = true; this.away = true; } });
      });
      default: return this.doFor(5, 'idle');
    }
  }
  parkAct() {
    const r = this.rng, h = G.env.hour, x = r.next();
    if (x < 0.4) { const seat = this.pickSeat('bench'); if (seat) return this.sitAt(seat, r.range(25, 60), 'sit'); }
    if (x < 0.52 && h > 10.6 && h < 21.3) return this.goTo('cartF', () => this.spread(1.6, 0.8, () => this.doFor(r.range(5, 9), 'talk', { face: this.faceTo(-40, -6) })));
    if (x < 0.6) return this.goTo('vend', () => this.doFor(r.range(3, 6), 'idle', { face: Math.PI }));
    return this.goTo(r.pick(PARK_NODES), () => this.doFor(r.range(3, 9), 'idle', { look: true }));
  }
  // Put this resident where they would be at this time of day (boot, load, after sleeping).
  warp(mins) {
    if (this.doing) this.finishDoing(true);
    if (this.seat) { this.seat.taken = null; this.seat = null; }
    this.path = null; this.direct = null; this.onArrive = null; this.react = null; this.chat = null; this.converse = false; this.hold = null; this.releaseLamp();
    const e = this.entryAt(mins), since = (mins - e.t + 1440) % 1440, nav = G.nav, r = this.rng;
    this.away = e.act === 'return' || (e.act === 'commute' && since > 12);
    const act = this.effective(e); this.entry = e; this.act = act; this.inside = false;
    if (this.away) { this.inside = true; this.node = nav.get(this.transitNode); return; }
    if (act === 'home') { this.node = nav.get(this.home); this.inside = true; }
    else if (act === 'work') { if (since < 8 && this.home !== this.work) { const p = nav.path(this.home, this.work); this.node = p ? p[Math.floor(r.next() * p.length)] : nav.get(this.work); this.emerge(); } else { this.node = nav.get(this.work); this.inside = true; } }
    else if (act === 'post') { this.node = nav.get(e.at); this.emerge(); }
    else {
      const id = this.zone ? (act === 'club' ? this.def.club : r.pick(this.sys.zones[this.zone]).id) : act === 'eat' ? 'restIn' : act === 'shop' ? (r.chance(0.7) && nav.shopNodes.length ? r.pick(nav.shopNodes) : 'shopIn') : act === 'commute' ? (this.magK < 0 ? 'skyHub' : this.transitNode) : act === 'deliver' ? 'skyHub2' : act === 'play' ? 'play' : act === 'market' ? 'stallF' + r.int(0, 2) : act === 'exercise' || act === 'concert' ? 'aud' : ['stroll', 'patrol', 'jog', 'walkdog', 'repair'].includes(act) ? r.pick(this.sys.street).id : r.pick(PARK_NODES);
      this.node = nav.get(id); this.emerge();
    }
    if (this.pet) this.pet.pos.copy(this.pos); if (this.buddy) this.buddy.pos.copy(this.pos);
  }

  move(dt) {
    this.speedNow = 0;
    if (this.inside || this.converse || this.chat || this.doing || this.hold) return;
    if (this.react) { if (this.react.fall) { this.fallStep(dt, this.react.fall); return; } if (this.react.fight) { this.fightStep(dt); return; } if (this.react.flee) { this.pos.x += this.react.flee[0] * 4.4 * dt; this.pos.z += this.react.flee[1] * 4.4 * dt; this.yaw = dampAngle(this.yaw, Math.atan2(this.react.flee[0], this.react.flee[1]), 12, dt); this.speedNow = 4.4; G.colliders.resolveCircle(this.pos, 0.3, this.pos.y + 0.55, this.pos.y + 1.6); if (!this.zone) this.pos.y = terrainY(this.pos.x, this.pos.z); } return; }
    let tx, tz;
    if (this.direct) { tx = this.direct.x; tz = this.direct.z; }
    else if (this.path) {
      const n = this.path[this.pi], prev = this.pi > 0 ? this.path[this.pi - 1] : null; tx = n.x; tz = n.z;
      if (prev && prev.street && n.street) { const dx = n.x - prev.x, dz = n.z - prev.z, l = Math.hypot(dx, dz) || 1; tx += (-dz / l) * this.lane; tz += (dx / l) * this.lane; }
    } else return;
    const dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz);
    const sp = this.baseSpeed * this.speedMul * (G.env.rain > 0.45 && this.body === 'humanoid' ? 1.6 : 1);
    if (d < Math.max(0.3, sp * dt * 1.5)) {
      if (this.direct) { const cb = this.direct.cb; this.direct = null; if (cb) cb(); }
      else { this.node = this.path[this.pi]; this.pi++; if (this.pi >= this.path.length) this.arrive(); }
      return;
    }
    this.pos.x += (dx / d) * sp * dt; this.pos.z += (dz / d) * sp * dt;
    this.yaw = dampAngle(this.yaw, Math.atan2(dx, dz), 9, dt); this.speedNow = sp;
    this.pos.y = this.zone ? this.node.y : terrainY(this.pos.x, this.pos.z);
  }

  // Caught in a fight (Hero Mode): knocked off their feet, over backwards, a moment on the ground, then
  // up and away from where the hit came from. vx/vz/vy: the push in m/s; wrapped: extra seconds held down.
  knock(vx, vz, vy, wrapped = 0) {
    if (this.inside || this.hold || this.converse) return;
    if (this.chat) this.chat.t = 99;                                 // the conversation ends
    if (this.doing || this.path || this.direct || this.seat) this.interrupt();
    const f = this.react && this.react.fall;
    if (f) { f.vx += vx; f.vz += vz; f.vy = Math.max(f.vy, vy); f.lie = 0; f.up = 0; if (this.dead) f.dead = true; return; }
    this.yaw = Math.atan2(-vx, -vz);                                  // facing whoever hit them, so they go over backwards
    this.react = { anim: 'air', t: 99, fall: { vx, vz, vy, y: 0.05, ang: 0, lie: 0, up: 0, wrapped, dead: !!this.dead } };
    this.feel(this.android ? 'alarm' : 'surprised', 9); this.speedNow = 0;
  }
  // A hero's hit hurts: adults have 60 health (androids 80), and at none they go down for good. Children
  // are never hurt this way: they are only knocked over. Returns true if this hit was the last.
  harm(dmg) {
    if (this.child || this.dead || !(dmg > 0)) return false;
    if (this.hp === null) this.hp = this.android ? 80 : 60;
    this.hp -= dmg;
    if (this.hp > 0) return false;
    this.dead = { at: G.elapsed }; if (this.chat) this.chat.t = 99;
    return true;
  }
  // after a while the city's medics take them away; they are home again the next day
  carryOff() {
    if (this.isNear && G.fx) { G.fx.ring(this.pos.clone().setY(this.pos.y + 0.1), '#7dff9c', 0.3, 1.6, 0.6); G.fx.spark(this.pos.clone().setY(this.pos.y + 0.4), '#e8fbff', 8, 2, 0.5, 0.08, -1); }
    this.react = null; this.dead = null; this.hp = null; this.provoked = -99; this.faceYaw = null;
    this.path = null; this.direct = null; this.doing = null; this.node = G.nav.get(this.home); this.inside = true; this.away = false;
    this.outUntil = G.env.day + 1;
  }
  fallStep(dt, f) {
    const air = f.y > 0 || f.vy > 0;
    if (air) { f.vy -= 20 * dt; f.y = Math.max(0, f.y + f.vy * dt); }
    const k = air ? 0.3 : 6; f.vx *= Math.exp(-k * dt); f.vz *= Math.exp(-k * dt);
    this.pos.x += f.vx * dt; this.pos.z += f.vz * dt;
    G.colliders.resolveCircle(this.pos, 0.3, this.pos.y + 0.3, this.pos.y + 1.2);
    this.pos.y = this.zone ? this.node.y : terrainY(this.pos.x, this.pos.z);
    f.ang = Math.min(1.45, f.ang + dt * 5);
    if (f.dead) { if (!air) f.lie += dt; this.react.anim = 'down'; this.react.t = 99; if (f.lie > 20) this.carryOff(); return; }   // down for good: still, until the medics come
    if (!air) { f.lie += dt; if (f.lie > 1.2 + f.wrapped) f.up += dt; }
    this.react.anim = f.up > 0 ? 'land' : 'air';
    if (f.up > 0.6) {
      // a fighter the hero just hit gets up and comes at them; everyone else runs
      if (this.fighter && G.elapsed - this.provoked < 20 && G.heroes && G.heroes.alive) { this.startFight(); return; }
      const l = Math.hypot(f.vx, f.vz) > 0.01 ? Math.hypot(f.vx, f.vz) : 1, ux = f.vx / l || -Math.sin(this.yaw), uz = f.vz / l || -Math.cos(this.yaw);
      this.react = { anim: 'run', t: 4.5, flee: [ux, uz] }; this.cool.flee = 10; this.feel('annoyed', 10);
    }
  }
  // fighting back: run at the hero and throw punches, for up to 15 s or until they get away
  startFight() {
    if (this.doing || this.path || this.direct || this.seat) this.interrupt();
    this.react = { anim: 'run', t: 15, fight: { cd: 0.4, swing: 0, alt: false } }; this.feel('annoyed', 15);
    if (this.isNear) G.ui.say(this, this.rng.pick(['You want a fight? Come on!', 'Hero or not, that was out of line!', 'Get over here!', 'I\'m not running from you!']), 2.4);
  }
  fightStep(dt) {
    const f = this.react.fight, p = G.player, H = G.heroes;
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z, d = Math.hypot(dx, dz) || 0.01;
    if (!H || !H.alive || p.state === 'drive' || p.state === 'ride' || d > 35 || Math.abs(p.pos.y - this.pos.y) > 4) {   // the hero got away: walk it off
      this.react = { anim: 'run', t: 2, flee: [-dx / d, -dz / d] }; return;
    }
    this.yaw = dampAngle(this.yaw, Math.atan2(dx, dz), 12, dt);
    f.cd -= dt; f.swing = Math.max(0, f.swing - dt);
    if (d > 1.25) {
      const sp = 5.2; this.pos.x += (dx / d) * sp * dt; this.pos.z += (dz / d) * sp * dt; this.speedNow = sp;
      G.colliders.resolveCircle(this.pos, 0.3, this.pos.y + 0.55, this.pos.y + 1.6); this.pos.y = this.zone ? this.node.y : terrainY(this.pos.x, this.pos.z);
      this.react.anim = f.swing > 0 ? (f.alt ? 'punchL' : 'punchR') : 'run';
      return;
    }
    this.speedNow = 0; this.react.anim = f.swing > 0 ? (f.alt ? 'punchL' : 'punchR') : 'guard';
    if (f.cd <= 0) {   // a punch: a little damage and a shove, nothing a hero cannot take
      f.cd = 0.9 + this.rng.next() * 0.6; f.swing = 0.28; f.alt = !f.alt;
      H.hurt(5, new THREE.Vector3(dx / d, 0, dz / d), { knock: 3, kind: 'blunt' });
      if (this.isNear && this.rng.chance(0.3)) G.ui.say(this, this.rng.pick(['Take that!', 'Had enough?', 'Come on!']), 1.6);
    }
  }
  animName() {
    const d = this.doing, sp = this.speedNow;
    return this.hold ? this.hold.anim : this.converse ? 'talk' : this.react ? this.react.anim : this.chat ? (d && d.seat ? d.anim : this.chat.speaker === this ? 'talk' : 'idle') : d ? d.anim : sp > 4 ? 'run' : sp > 2.3 ? 'jog' : sp > 0.1 ? 'walk' : 'idle';
  }
  // mid tier: one set of instanced boxes
  impostor(dt, t, crowd) {
    if (this.faceYaw !== null) this.yaw = dampAngle(this.yaw, this.faceYaw, 6, dt);
    if (this.body !== 'humanoid') return this.machine(dt, t);
    const anim = this.animName();
    this.phase += anim === 'dance' || anim === 'taichi' ? dt * 3 : dt * (this.speedNow / 1.5) * TAU;
    const fall = this.react && this.react.fall, tip = fall ? fall.ang * (fall.up > 0 ? Math.max(0, 1 - fall.up / 0.6) : 1) : 0;   // knocked over: drawn tipped back, as up close
    crowd.add(this.pos, this.yaw, this.scale, this.col, tip > 1 ? 'down' : anim, this.phase, this.build, tip);
    this.extras(dt, t);
  }
  machine(dt, t) {
    const root = this.rig.root; root.position.copy(this.pos); root.rotation.y = this.yaw;
    if (this.body === 'rover') { for (const w of this.rig.wheels) w.rotation.x += this.speedNow * dt * 7; this.parcel.visible = this.carrying; }
    else root.rotation.y = t * 1.5;
  }
  // close tier: the full rig
  visual(dt, t) {
    if (this.faceYaw !== null) this.yaw = dampAngle(this.yaw, this.faceYaw, 6, dt);
    if (this.body !== 'humanoid') return this.machine(dt, t);
    const root = this.rig.root, pl = G.player.pos, d = this.doing;
    root.position.copy(this.pos); root.rotation.y = this.yaw;
    const fall = this.react && this.react.fall; root.rotation.order = 'YXZ';   // knocked over: tipped back, lifted while in the air
    root.rotation.x = fall ? -fall.ang * (fall.up > 0 ? Math.max(0, 1 - fall.up / 0.6) : 1) : 0; if (fall) root.position.y += fall.y;
    const dx = pl.x - this.pos.x, dz = pl.z - this.pos.z, dd = dx * dx + dz * dz;
    let look = 0;
    if (dd < 30 && Math.abs(pl.y - this.pos.y) < 2 && !this.chat && !this.hold) look = clamp(angDelta(this.yaw, Math.atan2(dx, dz)), -1.1, 1.1);
    else if (d && d.look) look = Math.sin(t * 0.45 + this.lane * 9) * 0.75;
    this.rig.lookYaw = damp(this.rig.lookYaw, look, 5, dt);
    if (this.moodT <= 0) setMood(this.rig, this.mood > 0.4 ? 'happy' : this.mood < -0.4 ? 'annoyed' : 'neutral');
    if (this.rig.canopy) this.rig.canopy.visible = G.env.rain > 0.3 && this.pos.y < 1 && !this.sys.indoors(this.pos);
    // a shopping bag in hand after paying somewhere
    if (this.bagT > 0) {
      this.bagT -= dt;
      if (!this.bag) { this.bag = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.09), std(this.rng.pick(['#d9b23a', '#c0483f', '#2f6f8f', '#f2efe8', '#6b4fa0']), 0.8, 0)); this.bag.position.set(0, -0.42, 0.02); this.bag.castShadow = true; this.rig.elbR.add(this.bag); }
      this.bag.visible = this.bagT > 0;
    } else if (this.bag && this.bag.visible) this.bag.visible = false;
    animateRig(this.rig, dt, this.animName(), this.speedNow);
    if (d && d.spark) this.sys.spark(d.spark, t);
    this.extras(dt, t);
  }
  // dog on a leash / companion robot keeping station next to its person
  follower(f, dt, ox, oz, isDog) {
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), rx = -fz, rz = fx;
    const tx = this.pos.x + fx * oz + rx * ox, tz = this.pos.z + fz * oz + rz * ox;
    const dx = tx - f.pos.x, dz = tz - f.pos.z, d = Math.hypot(dx, dz);
    f.speed = d > 0.25 ? Math.min(d * 3, isDog ? 6 : 5) : 0;
    if (d > 8) { f.pos.set(tx, this.pos.y, tz); f.speed = 0; }
    else if (f.speed > 0) { f.pos.x += (dx / d) * f.speed * dt; f.pos.z += (dz / d) * f.speed * dt; f.yaw = dampAngle(f.yaw, Math.atan2(dx, dz), 8, dt); }
    else f.yaw = dampAngle(f.yaw, this.yaw, 3, dt);
    f.pos.y = terrainY(f.pos.x, f.pos.z);
    f.rig.root.position.copy(f.pos); f.rig.root.rotation.y = f.yaw;
  }
  extras(dt, t) {
    if (this.pet && this.pet.rig) {
      const p = this.pet; this.follower(p, dt, 0.85, 0.5, true);
      animateDog(p.rig, dt, p.speed > 2.8 ? 'run' : p.speed > 0.2 ? 'walk' : this.doing ? 'sit' : 'idle', p.speed);
      const a = this.leash.geometry.attributes.position, fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
      a.setXYZ(0, this.pos.x - fz * 0.3, this.pos.y + 0.86, this.pos.z + fx * 0.3); a.setXYZ(1, p.pos.x + Math.sin(p.yaw) * 0.25, p.pos.y + 0.56, p.pos.z + Math.cos(p.yaw) * 0.25); a.needsUpdate = true;
    }
    if (this.buddy && this.buddy.rig) {
      const b = this.buddy, playing = this.act === 'play';
      this.follower(b, dt, playing ? Math.cos(t * 0.9) * 1.8 : -0.9, playing ? Math.sin(t * 0.9) * 1.8 : -0.8, false);
      animateRig(b.rig, dt, b.speed > 2.4 ? 'jog' : b.speed > 0.15 ? 'walk' : 'idle', b.speed);
    }
  }
  // Show a feeling on the face (or visor) for a while; it also shifts the underlying mood.
  feel(mood, secs) {
    this.moodBoost = clamp(this.moodBoost + (mood === 'happy' ? 0.4 : mood === 'annoyed' ? -0.6 : -0.1), -1, 1);
    this.moodT = secs; if (this.rig && this.body === 'humanoid') setMood(this.rig, mood);
  }
}

export class NPCSystem {
  constructor() {
    this.rng = new RNG(99); this.list = []; this.near = []; this.close = []; this.byId = new Map(); this.claimed = new Set(); this.plates = new Map(); this.chatT = 2; this.chats = []; this.pending = [];
    this.street = G.nav.nodes.filter((n) => n.street && !n.zone); this.zones = {};
    for (const n of G.nav.nodes) if (n.zone && n.street) (this.zones[n.zone] = this.zones[n.zone] || []).push(n);
    this.crowd = new Crowd();
    const cast = [...buildCast(G.nav.doors), ...buildLocals(G.districts)];
    cast.forEach((def, i) => { const n = new NPC(def, this); n.k = i; this.list.push(n); this.byId.set(n.id, n); });
    // staff behind counters can be addressed from the customer side
    const pl = G.city.places, service = { clerk: pl.shop.counterPoint, chef: pl.restaurant.chefPoint, host: pl.restaurant.hostPoint, vendor: pl.cart };
    pl.market.stalls.forEach((s, k) => { service['stall' + k] = s.front; });
    for (const [id, pos] of Object.entries(service)) {
      const n = this.byId.get(id);
      G.interact.add({ pos, r: 1.7, prio: 0.1, label: () => `Talk to ${n.name}`, enabled: () => !n.inside && n.act === 'post' && !!n.doing && G.dialogue, use: () => G.dialogue.start(n) });
    }
    this.sparkMesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.4, 1.2) }));
    this.sparkMesh.visible = false; G.scene.add(this.sparkMesh); this.sparkOn = 0;
    this.resync();
  }
  resync() { for (const n of this.list) n.warp(G.env.mins); }
  indoors(p) { const r = G.city.places.restaurant.bounds, s = G.city.places.shop.bounds; return (p.x > r[0] && p.x < r[1] && p.z > r[2] && p.z < r[3]) || (p.x > s[0] && p.x < s[1] && p.z > s[2] && p.z < s[3]); }
  adjacent(seat) {
    const id = seat.kind === 'stool' ? 'rs' + (+seat.id.slice(2) ^ 1) : seat.id.slice(0, -1) + (seat.id.endsWith('a') ? 'b' : 'a');
    return G.city.seats.find((s) => s.id === id);
  }
  plate(seat) {
    let p = this.plates.get(seat.id);
    if (!p) {
      p = new THREE.Group();
      const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.02, 14), std('#f3f5f8', 0.3, 0.2)), food = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), std(this.rng.pick(['#c96f4a', '#e8c46a', '#7fbf7a', '#d98aa8']), 0.7, 0));
      food.position.y = 0.04; food.scale.y = 0.6; p.add(dish, food); p.position.set(seat.table.x, seat.table.y, seat.table.z); G.scene.add(p); this.plates.set(seat.id, p);
    }
    return p;
  }
  spark(pos, t) { this.sparkOn = 0.12; const m = this.sparkMesh; m.visible = Math.sin(t * 47) > -0.2; m.position.set(pos[0] + Math.sin(t * 31) * 0.15, pos[1] + Math.cos(t * 23) * 0.1, pos[2]); m.scale.setScalar(0.6 + Math.abs(Math.sin(t * 61)) * 1.2); }
  // The street reacts to the hero hurting someone at `at`: fighters close by come at the hero, everyone
  // else runs from them (further when someone went down for good). Children always run.
  panic(at, victim, killed) {
    const p = G.player.pos, R = killed ? 32 : 18; let shouted = 0;
    for (const n of this.near) {
      if (n === victim || n.inside || n.body !== 'humanoid' || n.hold || n.converse || n.dead || (n.react && (n.react.fall || n.react.fight))) continue;
      const d = Math.hypot(n.pos.x - at.x, n.pos.z - at.z); if (d > R || Math.abs(n.pos.y - at.y) > 4) continue;
      if (n.fighter && d < 12 && G.heroes && G.heroes.alive && (killed || n.rng.chance(0.55))) { n.provoked = G.elapsed; n.startFight(); continue; }
      if (n.react && n.react.flee && n.react.t > 2) continue;
      if (n.doing || n.path || n.direct || n.seat || n.chat) { if (n.chat) n.chat.t = 99; n.interrupt(); }
      const dx = n.pos.x - p.x, dz = n.pos.z - p.z, l = Math.hypot(dx, dz) || 1;
      n.react = { anim: 'run', t: killed ? 7 + n.rng.next() * 3 : 4 + n.rng.next() * 2, flee: [dx / l, dz / l] }; n.cool.flee = 12; n.feel(n.android ? 'alarm' : 'surprised', 10);
      if (n.isNear && shouted < 2 && n.rng.chance(0.5)) { shouted++; G.ui.say(n, n.android ? 'Emergency logged. Clear the area.' : n.child ? 'Mum!' : n.rng.pick(killed ? ['Somebody call the medics!', 'Run!', 'Oh no, no, no!'] : ['Hey, stop that!', 'Run!', 'Get away from them!']), 2.2); }
    }
  }
  // Word gets around: a resident's friends hear how you treated them, a little later.
  gossip(npc, delta, what) {
    for (const id of npc.friends) this.pending.push({ to: id, from: npc.name, delta: delta * 0.35, what, at: G.elapsed + 40 + this.rng.next() * 90 });
  }

  update(dt, t) {
    const mins = G.env.mins, pl = G.player, pp = pl.pos, car = G.car, near = this.near, close = this.close;
    near.length = 0; close.length = 0;
    const lod = G.lodClose || 1, soft = G.softShadows; let budget = 1;
    this.sparkOn -= dt; if (this.sparkOn <= 0) this.sparkMesh.visible = false;
    this.crowd.begin();
    for (const n of this.list) {
      n.think(dt, mins); n.move(dt);
      const dx = n.pos.x - pp.x, dy = n.pos.y - pp.y, dz = n.pos.z - pp.z;
      n.d2 = dx * dx + dz * dz;
      let tier = 2;
      if (!n.inside) { const d3 = n.d2 + dy * dy; tier = d3 < (n.tier === 0 ? 900 : 600) * lod ? 0 : d3 < 125 * 125 ? 1 : 2; }
      // building a detailed rig takes a few milliseconds: at most one new one per frame, the rest wait a frame as crowd figures
      if (tier === 0 && !n.rig && n.body === 'humanoid') { if (budget > 0) budget--; else tier = 1; }
      if (tier !== n.tier) n.setTier(tier);
      n.isNear = tier === 0;
      if (tier === 0) { near.push(n); close.push(n); if (soft && n.body === 'humanoid') this.crowd.shade(n.pos, n.scale); } else if (tier === 1) { near.push(n); n.impostor(dt, t, this.crowd); }
    }
    if (soft && pl.state !== 'drive' && pl.state !== 'ride') this.crowd.shade(pp, 1);
    if (G.ambient) G.ambient.draw(this.crowd, dt, t);
    this.crowd.end();
    // close tier: separation, reactions to the player and their vehicle
    const carLow = car.mode !== 'parked' && car.speed + Math.abs(car.vel.y) > 2.5;
    for (let i = 0; i < close.length; i++) {
      const a = close[i], seated = a.doing && a.doing.seat;
      if (!seated && !a.converse && !a.hold) {
        for (let j = i + 1; j < close.length; j++) {
          const b = close[j]; if ((b.doing && b.doing.seat) || b.hold) continue;
          const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz);
          if (d < 0.7 && d > 0.001) { const k = (0.7 - d) * 0.5; a.pos.x -= (dx / d) * k; a.pos.z -= (dz / d) * k; b.pos.x += (dx / d) * k; b.pos.z += (dz / d) * k; }
        }
        if (pl.state === 'walk' && Math.abs(pp.y - a.pos.y) < 1.5 && a.d2 < 0.62 * 0.62) {
          const d = Math.sqrt(a.d2) || 0.01, ux = (a.pos.x - pp.x) / d, uz = (a.pos.z - pp.z) / d;
          a.pos.x += ux * (0.62 - d); a.pos.z += uz * (0.62 - d);
          G.colliders.resolveCircle(a.pos, 0.3, a.pos.y + 0.55, a.pos.y + 1.6); // being nudged never pushes anyone through a wall
          if (pl.speed > 3 && a.cool.bump <= 0 && a.body === 'humanoid') {
            a.cool.bump = 4; a.react = { anim: 'stumble', t: 1.1 }; a.feel('annoyed', 7);
            const m = a.mem; m.bumped++; m.rep = clamp(m.rep - 4, -100, 100); G.state.standing = clamp(G.state.standing - 1.5, -100, 100);
            this.gossip(a, -4, 'knocked into them in the street');
            G.ui.say(a, a.android ? 'Collision logged.' : a.child ? 'Hey!' : this.rng.pick(['Hey! Watch it.', 'Excuse you.', 'Slow down!']));
          }
        }
        if (carLow && a.cool.flee <= 0 && a.body === 'humanoid') {
          const dx = a.pos.x - car.pos.x, dz = a.pos.z - car.pos.z, d = Math.hypot(dx, dz);
          if (d < 8 && car.pos.y - a.pos.y < 7) {
            a.cool.flee = 8; a.react = { anim: 'run', t: 1.5, flee: [dx / (d || 1), dz / (d || 1)] }; a.feel(a.android ? 'alarm' : 'surprised', 6);
            G.ui.say(a, a.android ? 'Unsafe vehicle proximity. Reporting.' : this.rng.pick(['Whoa!', 'Use a pad!', 'Are you flying that yourself?!']));
            if (G.events && pl.state === 'drive') G.events.report('lowfly', 1, car.pos);
          }
        }
        if (a.talk && !a.react && !a.chat && a.d2 < 36 && a.cool.wave <= 0 && a.mem.rep >= 30 && Math.abs(pp.y - a.pos.y) < 1.5 && pl.state === 'walk') {
          a.cool.wave = 120; a.react = { anim: 'wave', t: 1.7 }; a.faceYaw = a.faceTo(pp.x, pp.z); a.feel('happy', 5); G.ui.say(a, `Hi, ${G.state.name}!`);
        }
      }
      // short barks from people at work when you come close
      if (a.cool.bark <= 0 && a.d2 < 64 && !a.converse && !a.hold && pl.state !== 'drive') {
        a.cool.bark = 45 + this.rng.next() * 40;
        const line = a.role === 'vendor' ? 'Dumplings, folded this morning!' : a.role === 'host' ? 'Welcome to Printed Petal. A table for one?' : a.role === 'clerk' ? 'Welcome to Kinetic. The K9 units are by the window.' : a.role === 'wellness' && a.doing ? 'Breathe out. Slowly. The city can wait.' : a.role && a.role.startsWith('stall') && a.doing ? 'Fresh tonight. Come and look.' : a.body === 'rover' ? 'Delivery in progress. Passing on your left.' : a.def.tourist && a.doing ? 'Look how tall that one is...' : a.act === 'tend' && a.doing ? 'Root health nominal.' : null;
        if (line) G.ui.say(a, line, 3);
      }
      a.visual(dt, t);
    }
    // ambient conversations between residents who cross paths; friends seek each other out
    this.chatT -= dt;
    if (this.chatT <= 0 && close.length > 1) {
      this.chatT = 1.5;
      const a = close[Math.floor(this.rng.next() * close.length)];
      const ok = (n) => n.talk && n.body === 'humanoid' && !n.child && !n.role && !n.chat && !n.converse && !n.react && !n.hold && n.cool.chat <= 0 && LEISURE.has(n.act) && !(n.doing && n.doing.until);
      if (ok(a)) {
        const fits = (q) => q !== a && ok(q) && (q.pos.x - a.pos.x) ** 2 + (q.pos.z - a.pos.z) ** 2 < 12 && !!(q.doing && q.doing.seat) === !!(a.doing && a.doing.seat);
        const b = close.find((q) => fits(q) && a.friends.includes(q.id)) || close.find(fits);
        if (b) {
          const friends = a.friends.includes(b.id) || a.partner === b.id, pair = ambientPair(this.rng);
          const c = { a, b, t: 0, lines: friends ? [`${b.name.split(' ')[0]}! ${pair[0]}`, pair[1]] : pair, said: 0, friends };
          a.chat = c; b.chat = c; this.chats.push(c);
          if (!(a.doing && a.doing.seat)) { a.faceYaw = a.faceTo(b.pos.x, b.pos.z); b.faceYaw = b.faceTo(a.pos.x, a.pos.z); }
        }
      }
    }
    for (let i = this.chats.length - 1; i >= 0; i--) {
      const c = this.chats[i]; c.t += dt;
      if (c.said === 0 && c.t > 0.6) { c.said = 1; c.speaker = c.a; G.ui.say(c.a, c.lines[0], 3.2); }
      if (c.said === 1 && c.t > 4) { c.said = 2; c.speaker = c.b; G.ui.say(c.b, c.lines[1], 3.2); }
      if (c.t > 7.6) { for (const n of [c.a, c.b]) { n.chat = null; n.cool.chat = 50 + this.rng.next() * 60; if (!n.doing) n.faceYaw = null; if (c.friends) n.feel('happy', 5); } this.chats.splice(i, 1); }
    }
    // gossip arriving
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const g = this.pending[i]; if (g.at > G.elapsed) continue;
      const n = this.byId.get(g.to); this.pending.splice(i, 1);
      if (n) { const m = n.mem; m.rep = clamp(m.rep + g.delta, -100, 100); m.heard = { from: g.from, what: g.what, good: g.delta > 0 }; }
    }
  }
}
