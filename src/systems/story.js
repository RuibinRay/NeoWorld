// Runs the story campaign (data/story.js): who stands where, which step you are on, the marker
// and route to it, dialogue scenes (the camera turns to whoever is speaking), phone calls and
// radio messages, the drone chase, the blackout, and after the end the Grid Warden job.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { clamp, damp, dampAngle } from '../core/util.js';
import { makeHumanoid, animateRig } from '../entities/rigs.js';
import { DEFAULT_LOOK } from '../entities/player.js';
import { std, neon, setBlackout } from '../world/materials.js';
import { mergeMeshes } from '../world/batch.js';
import { money } from '../ui/ui.js';
import { CAST, MISSIONS, CIVIC_TIPS } from '../data/story.js';

const PINK = '#ff4fd8', WARDEN = ['relayRoof', 'relayN', 'relayE', 'relayW', 'pylon1', 'pylon2', 'breaker2'];
const now = () => G.env.day * 1440 + G.env.mins;

export class Story {
  constructor() {
    const S = G.metro.skyline, O = G.orbital, B = G.bots, col = G.colliders, dam = G.city.pads.find((q) => q.id === 'damPad');
    const gy = (x, z, top = 200) => col.groundAt(x, z, top, 0, 0.3);
    const at = (x, z, name, top) => ({ x, y: gy(x, z, top), z, name });
    // places
    this.P = {
      relayRoof: { x: S.cx + 6, y: S.y + 18.2, z: S.cz + 20, name: 'the Skyline Run roof' },
      relayN: at(167, -407, 'Northbank'), relayE: at(647, 193, 'Eastline'), relayW: at(-553, 287, 'Westworks'),
      deck: { x: O.tx, y: 1500, z: O.tz + 4.6, name: 'Skyline Station' }, liftGate: { x: O.tx, y: 0, z: O.tz + 28.6, name: 'the orbital lift gate' },
      yard: { x: -772, y: 0, z: 1166.7, name: 'the port yard' }, container: { x: -777.4, y: 0, z: 1166.7, name: 'the container' },
      dam: { x: dam.x, y: dam.y, z: dam.z, name: 'Northgate Dam' },
      breaker1: at(-60, -2296, 'the west breaker', 160), breaker2: at(40, -2296, 'the middle breaker', 160), breaker3: at(100, -2288, 'the east breaker', 160),
      plaza: { x: 0, y: 0.15, z: 20, name: 'the Meridian plaza' },
      pylon1: { x: 30, y: 0.15, z: -10, name: 'the east pylon' }, pylon2: { x: -30, y: 0.15, z: -10, name: 'the west pylon' }, pylon3: { x: 0, y: 0.15, z: 48, name: 'the south pylon' },
      booth: { x: B.booth.x, y: 0.06, z: B.booth.z, name: 'the driver\'s booth' },
    };
    this.spots = { juno: { x: 8, y: 0.15, z: 22, yaw: -2.6 }, sprocket: { x: B.booth.x + 3.5, y: 0.06, z: B.booth.z + 1, yaw: -1.6 }, okafor: { x: O.tx - 6, y: 1500, z: O.tz - 5, yaw: 0.6 }, civic: { x: -1.5, y: 0.15, z: -35.5, yaw: 0 } };
    this.buildProps(); this.buildCast(); this.buildDrone();
    // interactions: talking, using places, the exhibition match
    const I = G.interact;
    for (const who of Object.keys(this.spots)) I.add({ pos: this.spots[who], r: 2.8, yTol: 2, prio: 0.5, label: () => `Talk to ${CAST[who].name}`, enabled: () => this.wantsTalk(who), use: () => this.talk(who) });
    const keys = new Set(WARDEN); for (const m of MISSIONS) for (const s of m.steps) if (s.k === 'use') keys.add(s.at); else if (s.k === 'multi') s.at.forEach((k) => keys.add(k));
    for (const k of keys) I.add({ pos: this.P[k], r: 2.2, yTol: 2.2, prio: 0.6, label: () => this.spotLabel(k), enabled: () => this.spotWanted(k), use: () => this.useSpot(k) });
    I.add({ pos: this.P.booth, r: 2.6, prio: 0.7, label: () => `Exhibition match against ${this.step().bot}`, enabled: () => { const s = this.step(); return !!s && s.k === 'arena' && !G.minigame; }, use: () => {
      const s = this.step(); if (!G.bots.exhibition(s.bot, (won) => { if (won) this.next(); else G.ui.toast(`${s.bot} wins this one. Try again at the booth: come at him from the side.`, 'warn'); })) G.ui.toast('Stand at the booth on foot first.', 'info');
    } });
    this.scene = null; this.radio = []; this.radioT = 0; this.timer = null; this.seen = 0; this.ch = null; this.objTitle = null; this.tipAt = 0;
    const beam = (this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 80, 12, 1, true), new THREE.MeshBasicMaterial({ color: PINK, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
    beam.visible = false; G.scene.add(beam);
    G.blackout = 0;
  }
  get st() { const s = G.state; if (!s.story) s.story = { m: 0, step: -1, choice: null, warden: 0, fault: -1, faultAt: 0, heard: false }; return s.story; }
  mission() { return MISSIONS[this.st.m] || null; }
  step() { const m = this.mission(), i = this.st.step; return m && i >= 0 ? m.steps[i] : null; }
  get finished() { return this.st.m >= MISSIONS.length; }

  // ---- world pieces ----------------------------------------------------------------------------------------------
  buildProps() {
    const col = G.colliders, dark = std('#232832', 0.5, 0.6), steel = std('#8d96a3', 0.4, 0.7), cyan = neon('#7fe9ff', 1.6), amber = neon('#ffb347', 1.4), pink = neon(PINK, 1.6);
    const site = (x, y, z, parts, box) => {
      const g = new THREE.Group(); g.position.set(x, y, z); G.scene.add(g);
      const ms = parts.map(([geo, mat, px, py, pz]) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.castShadow = true; g.add(m); return m; });
      mergeMeshes(g, ms); if (box) col.box(x - box[0], x + box[0], y, y + box[1], z - box[2], z + box[2], { noCam: true }); return g;
    };
    const cabinet = (p) => site(p.x + 0.9, p.y, p.z, [[new THREE.BoxGeometry(0.7, 1.4, 0.5), dark, 0, 0.7, 0], [new THREE.BoxGeometry(0.5, 0.3, 0.02), cyan, 0, 1.05, 0.26], [new THREE.BoxGeometry(0.05, 1.2, 0.05), steel, 0.25, 2.0, 0], [new THREE.SphereGeometry(0.07, 8, 6), pink, 0.25, 2.65, 0]], [0.35, 1.4, 0.25]);
    for (const k of ['relayRoof', 'relayN', 'relayE', 'relayW']) cabinet(this.P[k]);
    for (const k of ['breaker1', 'breaker2', 'breaker3']) { const p = this.P[k]; site(p.x, p.y, p.z + 1.4, [[new THREE.BoxGeometry(0.9, 1.6, 0.5), std('#3a3f48', 0.5, 0.5), 0, 0.8, 0], [new THREE.BoxGeometry(0.9, 0.12, 0.52), amber, 0, 1.45, 0], [new THREE.BoxGeometry(0.2, 0.35, 0.1), steel, 0, 0.95, -0.3]], [0.45, 1.6, 0.25]); }
    for (const k of ['pylon1', 'pylon2', 'pylon3']) { const p = this.P[k]; site(p.x, p.y, p.z + 1.2, [[new THREE.CylinderGeometry(0.32, 0.42, 3.2, 12), std('#d7dde6', 0.35, 0.6), 0, 1.6, 0], [new THREE.TorusGeometry(0.42, 0.05, 6, 20).rotateX(Math.PI / 2), cyan, 0, 1.0, 0], [new THREE.TorusGeometry(0.4, 0.05, 6, 20).rotateX(Math.PI / 2), cyan, 0, 2.2, 0], [new THREE.SphereGeometry(0.22, 12, 8), cyan, 0, 3.35, 0]], [0.4, 3.2, 0.4]); }
    // the container in the port yard, and a red beacon over it that Skyline Station can see
    site(-780, 0, 1166.7, [[new THREE.BoxGeometry(2.4, 2.6, 6.1), std('#c4572e', 0.7, 0.3), 0, 1.3, 0], [new THREE.BoxGeometry(0.06, 2.3, 2.2), std('#8a3a1e', 0.6, 0.4), 1.22, 1.3, 0], [new THREE.BoxGeometry(0.08, 0.1, 1.2), neon('#ff3030', 1.8), 1.24, 2.1, 0]], [1.2, 2.6, 3.05]);
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const cx = cv.getContext('2d'), gr = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,80,60,1)'); gr.addColorStop(0.5, 'rgba(255,20,20,0.35)'); gr.addColorStop(1, 'rgba(255,0,0,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, 64, 64);
    const bm = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.beacon = new THREE.Sprite(bm); this.beacon.scale.setScalar(22); this.beacon.position.set(-780, 8, 1166.7); this.beacon.visible = false; G.scene.add(this.beacon);
  }
  buildCast() {
    this.rigs = {};
    for (const who of Object.keys(CAST)) {
      const c = CAST[who], rig = makeHumanoid(c.look.kind === 'android' ? c.look : { ...DEFAULT_LOOK, ...c.look }), s = this.spots[who];
      rig.root.position.set(s.x, s.y, s.z); rig.root.rotation.y = s.yaw; rig.root.visible = false; G.scene.add(rig.root); this.rigs[who] = rig;
      if (who === 'civic') {   // a hologram: see-through, with a ring of light at its feet
        rig.root.traverse((m) => { if (m.material) { m.material = m.material.clone(); m.material.transparent = true; m.material.opacity = 0.62; m.material.depthWrite = false; m.castShadow = false; } });
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 32), new THREE.MeshBasicMaterial({ color: '#7fe9ff', transparent: true, opacity: 0.8, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; rig.root.add(ring);
      }
    }
  }
  buildDrone() {
    const g = new THREE.Group(), dark = std('#1c2028', 0.4, 0.8), red = neon('#ff3030', 2.2), body = [];
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); body.push(m); return m; };
    add(new THREE.BoxGeometry(1.4, 0.45, 1.9), dark, 0, 0, 0); add(new THREE.BoxGeometry(0.9, 0.2, 0.9), std('#3a4250', 0.4, 0.6), 0, 0.3, -0.1);
    this.rotors = [];
    for (const [x, z] of [[-1.1, 1.1], [1.1, 1.1], [-1.1, -1.1], [1.1, -1.1]]) { add(new THREE.BoxGeometry(0.9, 0.08, 0.12), dark, x * 0.55, 0.05, z * 0.55); const r = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.03, 16), new THREE.MeshBasicMaterial({ color: '#9fb3c8', transparent: true, opacity: 0.35 })); r.position.set(x, 0.12, z); g.add(r); this.rotors.push(r); }
    this.droneEye = add(new THREE.BoxGeometry(0.6, 0.08, 0.04), red, 0, 0, 0.96);
    g.scale.setScalar(1.6); g.visible = false; G.scene.add(g); this.drone = g;
    this.droneGlow = new THREE.Sprite(this.beacon.material.clone()); this.droneGlow.scale.setScalar(5); g.add(this.droneGlow);   // a red glow you can follow at night
    // the route it flees along: the port, up past the Nexus and the Aeroport, over Arbor Heights, up the valley to the dam
    const pts = [[-780, 1166.7], [-760, 900], [-700, 640], [-720, 200], [-600, -400], [-500, -1000], [-250, -1600], [-60, -2050], [12, -2262]];
    const col = G.colliders, alt = pts.map(() => 60);
    for (let i = 0; i < pts.length - 1; i++) { const a = col.clearAltitude(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 10, 28); alt[i] = Math.max(alt[i], a); alt[i + 1] = Math.max(alt[i + 1], a); }
    alt[0] = 30; alt[pts.length - 1] = this.P.dam.y + 4;
    this.path = pts.map(([x, z], i) => new THREE.Vector3(x, alt[i], z)); this.cum = [0];
    for (let i = 1; i < this.path.length; i++) this.cum.push(this.cum[i - 1] + this.path[i].distanceTo(this.path[i - 1]));
  }
  sample(s, out) {
    const P = this.path, C = this.cum; let i = 1; while (i < C.length - 1 && C[i] < s) i++;
    const t = clamp((s - C[i - 1]) / (C[i] - C[i - 1]), 0, 1); out.lerpVectors(P[i - 1], P[i], t); return Math.atan2(P[i].x - P[i - 1].x, P[i].z - P[i - 1].z);
  }

  // ---- flow ----------------------------------------------------------------------------------------------------
  begin() {
    const m = this.mission(); if (!m) return;
    const go = () => { this.st.step = 0; this.st.prog = []; this.enter(); };
    if (m.radioIntro) { this.radio.push(...m.intro); go(); }
    else this.play(m.intro, { face: m.begin.who || null, then: go });
  }
  enter() {
    const s = this.step(); if (!s) return;
    this.timer = null; this.seen = 0; this.ch = null; if (s.k !== 'multi') this.st.prog = [];
    if (s.k === 'call') return this.play(s.lines, { then: () => this.next() });
    if (s.k === 'radio') { this.radio.push(...s.lines); return this.next(); }
    if (s.k === 'blackout') { this.radio.push(...s.lines); if (G.audio) G.audio.thud && G.audio.thud(0.4); return this.next(); }
    if (s.k === 'chase') { this.ch = { s: 0, lost: 0 }; G.ui.flash('FOLLOW THE DRONE', 1.6); }
    this.route();
    G.save.write(true);
  }
  next() { this.st.step++; if (this.st.step >= this.mission().steps.length) return this.complete(); this.enter(); }
  complete() {
    const m = this.mission(), st = this.st;
    G.economy.earn(m.pay, `story: ${m.title}`); G.ui.flash('MISSION COMPLETE', 2.6); if (G.audio) { G.audio.blip(660, 0.12); G.audio.blip(990, 0.12); }
    st.m++; st.step = -1; st.prog = []; G.ui.setObjective(null); this.objTitle = null; G.metro.route = null;
    const n = this.mission();
    if (!n) { st.faultAt = now() + 120; G.ui.toast(`The Quiet Signal: finished. ${money(m.pay)}. You are now a Grid Warden: relay faults will show on your map.`, 'good'); G.save.write(true); return; }
    G.ui.toast(`${m.title}: done, ${money(m.pay)}.${n.begin.who ? ` Next: talk to ${CAST[n.begin.who].name} (✦ on your map).` : ''}`, 'good');
    this.autoT = 1.4;   // the next mission's call comes a moment later (see update)
    G.save.write(true);
  }
  restart() { const st = this.st; st.step = -1; st.prog = []; this.ch = null; this.timer = null; G.blackout = 0; if (this.mission() && this.mission().begin.auto) this.begin(); }
  wantsTalk(who) {
    if (this.scene || G.minigame) return false;
    const m = this.mission(), s = this.step();
    return (!!m && this.st.step === -1 && m.begin.who === who) || (!!s && s.k === 'talk' && s.who === who);
  }
  talk(who) {
    const m = this.mission(), s = this.step();
    if (this.st.step === -1) return this.begin();
    if (s && s.k === 'talk' && s.who === who) {
      if (s.choice) return this.play(s.lines, { face: who, choices: [{ label: 'Reset CIVIC to how it was built', desc: 'Quiet, simple, safe', id: 'reset' }, { label: 'Let CIVIC keep learning', desc: 'It grows with the city', id: 'trust' }], then: (ch) => this.finale(ch.id) });
      this.play(s.lines, { face: who, then: () => this.next() });
    }
    return m;
  }
  finale(choice) {
    this.st.choice = choice; G.blackout = 0; G.ui.flash(choice === 'trust' ? 'THE CITY WAKES' : 'LIGHTS ON', 2.4);
    this.play(this.mission().endings[choice], { then: () => this.next() });
  }
  spotWanted(k) {
    if (this.scene) return false;
    if (this.finished) return this.st.fault >= 0 && WARDEN[this.st.fault] === k;
    const s = this.step(); if (!s) return false;
    return (s.k === 'use' && s.at === k) || (s.k === 'multi' && s.at.includes(k) && !(this.st.prog || []).includes(k));
  }
  spotLabel(k) { if (this.finished) return `Fix the fault at ${this.P[k].name}`; const s = this.step(); return s ? s.label : 'Use'; }
  useSpot(k) {
    const p = G.player; p.play('work', 1.1); if (G.audio) G.audio.blip(820, 0.08);
    if (this.finished) { const pay = 150; G.economy.earn(pay, 'grid warden'); this.st.warden++; this.st.fault = -1; this.st.faultAt = now() + 240; G.ui.toast(`Fault cleared at ${this.P[k].name}: ${money(pay)}. The next one will ping your phone.`, 'good'); return; }
    const s = this.step();
    if (s.k === 'use') return this.next();
    const prog = (this.st.prog = this.st.prog || []); prog.push(k);
    if (s.timed && this.timer === null) this.timer = s.timed;
    if (prog.length >= s.at.length) { this.timer = null; return this.next(); }
    G.ui.toast(`${this.P[k].name}: done. ${s.at.length - prog.length} to go.`, 'info'); this.route();
  }
  // a route along the streets to the nearest open target, if it is far
  route() {
    const t = this.targets()[0], p = G.player.state === 'drive' ? G.car.pos : G.player.pos;
    if (t && t.y < 100 && p.y < 100 && Math.hypot(t.x - p.x, t.z - p.z) > 160) G.metro.setRoute(t.x, t.z, p);
  }
  // where the player should go now (nearest first)
  targets() {
    const st = this.st, P = this.P, p = G.player.pos;
    if (this.finished) return st.fault >= 0 ? [P[WARDEN[st.fault]]] : [];
    const m = this.mission(); if (!m) return [];
    if (st.step === -1) return m.begin.who ? [this.spots[m.begin.who]] : [];
    const s = this.step(); let out = [];
    if (s.k === 'go') out = [s.via && p.y < 100 ? P[s.via] : P[s.at]];
    else if (s.k === 'use') out = [P[s.at]];
    else if (s.k === 'multi') out = s.at.filter((k) => !(st.prog || []).includes(k)).map((k) => P[k]);
    else if (s.k === 'talk') out = [this.spots[s.who]];
    else if (s.k === 'arena') out = [P.booth];
    else if (s.k === 'scope') out = [G.orbital.scopes[2]];
    else if (s.k === 'chase') out = [this.drone.position];
    else if (s.k === 'drive' || s.k === 'night') out = st.m === 4 ? [P.yard] : [];
    return out.slice().sort((a, b) => (a.x - p.x) ** 2 + (a.z - p.z) ** 2 - ((b.x - p.x) ** 2 + (b.z - p.z) ** 2));
  }
  markers() { return this.targets().map((t) => ({ x: t.x, z: t.z, color: PINK, story: true })); }

  // ---- scenes: face to face (the camera turns to the speaker) or on the phone -------------------------------------
  play(lines, o = {}) {
    this.scene = { lines, i: 0, face: o.face || null, then: o.then, choices: o.choices };
    const p = G.player;
    if (o.face) { if (p.state === 'sit') p.stand(); if (p.state === 'walk') { p.state = 'busy'; p.busyAnim = 'idle'; p.faceCam = false; p.vel.set(0, 0, 0); this.held = true; } }
    this.line();
  }
  line() {
    const sc = this.scene, [who, text] = sc.lines[sc.i], last = sc.i === sc.lines.length - 1, c = CAST[who];
    const opts = last && sc.choices ? sc.choices.map((ch) => ({ label: ch.label, desc: ch.desc, onPick: () => this.endScene(ch) }))
      : [{ label: last ? 'Done' : 'Continue', onPick: () => { if (last) this.endScene(); else { sc.i++; this.line(); } } }];
    G.ui.openMenu({ title: c ? c.name : G.state.name, who: c ? (sc.face ? c.role : `${c.role} · on your phone`) : 'you', body: text, noClose: true, options: opts });
    this.speaking = who;
  }
  endScene(choice) {
    const sc = this.scene; this.scene = null; this.speaking = null;
    if (this.held) { this.held = false; if (G.player.state === 'busy') G.player.state = 'walk'; }
    if (sc && sc.then) sc.then(choice);
  }

  // ---- every frame --------------------------------------------------------------------------------------------------
  update(dt) {
    const st = this.st, p = G.player, s = this.step(), t = G.elapsed;
    if (!st.heard && G.started) { st.heard = true; if (st.m === 0 && st.step === -1) setTimeout(() => G.ui.toast('Juno Reyes is waiting on the Meridian plaza with a job. Look for ✦ on your map.', 'info'), 2500); }
    // a mission that begins by itself (with a call) starts once you are free to take it
    const m0 = this.mission(); this.autoT = (this.autoT || 0) - dt;
    if (m0 && st.step === -1 && m0.begin.auto && this.autoT <= 0 && G.started && !this.scene && !G.ui.menu && !G.minigame && !G.ui.titleOpen && (p.state === 'walk' || m0.radioIntro)) this.begin();
    // radio messages, one every few seconds
    this.radioT -= dt; if (this.radio.length && this.radioT <= 0) { const [who, text] = this.radio.shift(); G.ui.toast(`${CAST[who] ? CAST[who].name : who}: ${text}`, 'info'); this.radioT = 3.4; if (G.audio) G.audio.blip(740, 0.05); }
    // step checks
    if (s && !this.scene) {
      const P = this.P, me = p.state === 'drive' ? G.car.pos : p.pos;
      if (s.k === 'go') { const q = P[s.at]; if (Math.hypot(me.x - q.x, me.z - q.z) < (s.r || 6) && Math.abs(me.y - q.y) < (s.yTol || 5) && (!s.onFoot || p.state === 'walk')) this.next(); }
      else if (s.k === 'night') { const h = G.env.hour; if (h >= 20 || h < 5) { G.ui.toast('It is dark now.', 'info'); this.next(); } }
      else if (s.k === 'drive') { if (p.state === 'drive') this.next(); }
      else if (s.k === 'scope') this.scope(dt);
      else if (s.k === 'chase' && this.ch) this.chase(dt);
      if (this.timer !== null) { this.timer -= dt; if (this.timer <= 0) { this.timer = null; st.prog = []; G.ui.flash('TOO SLOW', 1.6); G.ui.toast('Out of time. Start again at any of them: the clock starts at the first.', 'warn'); } }
    }
    // the warden job and CIVIC's tips, after the story
    if (this.finished) {
      if (st.fault < 0 && now() >= st.faultAt) { st.fault = Math.floor(Math.random() * WARDEN.length); G.ui.toast(`Grid fault at ${this.P[WARDEN[st.fault]].name}. ◈150 to fix it (✦ on your map).`, 'info'); }
      if (st.choice === 'trust' && now() >= this.tipAt) { if (this.tipAt) G.ui.toast(`CIVIC: ${CIVIC_TIPS[Math.floor(Math.random() * CIVIC_TIPS.length)]}`, 'info'); this.tipAt = now() + 300; }
    }
    // the blackout lasts from the plaza until CIVIC is answered
    G.blackout = damp(G.blackout || 0, st.m === 6 && st.step >= 3 && st.step <= 4 && !st.choice ? 1 : 0, 1.6, dt); setBlackout(G.blackout * 0.92);
    this.updateWorld(dt, t);
    this.objective();
    if (this.scene && this.scene.face) this.sceneCamera(dt);
  }
  scope(dt) {
    const O = G.orbital, sc = O.scope;
    if (!sc || sc.s !== O.scopes[2]) { this.seen = 0; return; }
    const cam = G.camera, d = cam.getWorldDirection(this._d || (this._d = new THREE.Vector3())), b = this.beacon.position, v = (this._v || (this._v = new THREE.Vector3())).copy(b).sub(cam.position).normalize();
    this.seen = d.dot(v) > 0.9985 ? this.seen + dt : Math.max(0, this.seen - dt);
    if (this.seen > 1.0) { O.scope = null; G.player.state = 'walk'; G.player.faceCam = false; G.ui.setObjective(null); G.ui.toast('There it is: a red beacon in the port yard.', 'good'); this.next(); }
  }
  chase(dt) {
    const c = this.ch, p = G.player, me = p.state === 'drive' ? G.car.pos : p.pos, q = this.drone.position, d = q.distanceTo(me);
    const v = 40 * clamp(1.35 - d / 380, 0.3, 1.2); c.s += v * dt;
    const yaw = this.sample(c.s, q); this.drone.rotation.y = dampAngle(this.drone.rotation.y, yaw, 4, dt); this.drone.rotation.x = 0.15;
    c.d = d; c.lost = d > 450 ? c.lost + dt : Math.max(0, c.lost - dt * 0.5);
    if (c.lost > 8) { this.ch = null; const i = this.mission().steps.findIndex((x) => x.cp); this.st.step = i; G.ui.flash('LOST IT', 1.8); G.ui.toast('The drone got away. It went back to ground at the port: go back and try again.', 'warn'); this.enter(); return; }
    if (c.s >= this.cum[this.cum.length - 1]) { this.ch = null; G.ui.toast('The drone has landed on Northgate Dam.', 'good'); this.next(); }
  }
  updateWorld(dt, t) {
    const st = this.st, p = G.player, s = this.step();
    // cast: shown near the player, facing them when close, talking when it is their line
    for (const who of Object.keys(this.rigs)) {
      const rig = this.rigs[who], sp = this.spots[who];
      let show = (p.pos.x - sp.x) ** 2 + (p.pos.z - sp.z) ** 2 < 140 * 140 && Math.abs(p.pos.y - sp.y) < 60;
      if (who === 'civic') show = show && ((st.m === 6 && st.step >= 4) || (this.finished && st.choice === 'trust'));
      rig.root.visible = show; if (!show) continue;
      const d2 = (p.pos.x - sp.x) ** 2 + (p.pos.z - sp.z) ** 2;
      rig.root.rotation.y = dampAngle(rig.root.rotation.y, d2 < 64 ? Math.atan2(p.pos.x - sp.x, p.pos.z - sp.z) : sp.yaw, 4, dt);
      if (who === 'civic') rig.root.position.y = sp.y + 0.08 + Math.sin(t * 1.6) * 0.04;
      animateRig(rig, dt, this.speaking === who ? 'talk' : 'idle', 0);
    }
    // the beacon (seen from Skyline Station, and marking the container)
    this.beacon.visible = (st.m === 3 && st.step >= 2) || (st.m === 4 && st.step <= 2);
    if (this.beacon.visible) this.beacon.material.opacity = Math.sin(t * 5) > -0.2 ? 1 : 0.15;
    // the drone: hovers over the container once it is open, then runs
    const dv = st.m === 4 && st.step >= 3; this.drone.visible = dv;
    if (dv) { for (const r of this.rotors) r.rotation.y += dt * 40; this.droneEye.material.color.setScalar(Math.sin(t * 8) > 0 ? 2 : 0.4); this.droneGlow.material.opacity = 0.55 + 0.45 * Math.sin(t * 8); if (!(s && s.k === 'chase' && this.ch)) { this.drone.position.set(-780, 14 + Math.sin(t * 1.5) * 0.6, 1166.7); this.drone.rotation.set(0, t * 0.4, 0); } }
    // a beam of light over the nearest target
    const tg = this.targets()[0];
    this.beam.visible = !!tg && !this.scene && !(s && s.k === 'chase');
    if (this.beam.visible) { this.beam.position.set(tg.x, (tg.y || 0) + 40, tg.z); this.beam.material.opacity = 0.14 + Math.sin(t * 3) * 0.05; }
  }
  objective() {
    const st = this.st, el = G.ui.$('objective'), shown = el.style.display === 'block', mine = shown && G.ui.$('obj-h').textContent === this.objTitle;
    if (shown && !mine) return;   // another activity is using the panel
    let o = null;
    const m = this.mission(), s = this.step();
    if (this.scene || G.minigame) o = null;
    else if (this.finished) o = st.fault >= 0 ? { title: '✦ Grid Warden', text: `Fix the fault at ${this.P[WARDEN[st.fault]].name}`, sub: `◈150 · ${st.warden} fixed so far` } : null;
    else if (m && st.step === -1 && m.begin.who) o = { title: `✦ ${m.title}`, text: `Talk to ${CAST[m.begin.who].name}`, sub: CAST[m.begin.who].role };
    else if (s && s.text) {
      let text = s.text, sub = s.sub || '';
      if (s.k === 'multi') { const n = (st.prog || []).length; text += ` (${n} of ${s.at.length})`; if (this.timer !== null) sub = `${Math.ceil(this.timer)} s left`; }
      if (s.k === 'chase' && this.ch) sub = `${Math.round(this.ch.d || 0)} m away${this.ch.lost > 0 ? ` · losing it: ${Math.ceil(8 - this.ch.lost)} s` : ''}`;
      if (s.k === 'night') sub = `It is ${String(Math.floor(G.env.hour)).padStart(2, '0')}:${String(Math.floor((G.env.hour % 1) * 60)).padStart(2, '0')} · Phone ▸ Story can wait for you`;
      o = { title: `✦ ${m.title}`, text, sub };
    }
    if (o) { G.ui.setObjective(o); this.objTitle = o.title; } else if (mine) { G.ui.setObjective(null); this.objTitle = null; }
  }
  sceneCamera(dt) {
    const who = this.speaking === 'you' || !this.speaking ? this.scene.face : this.speaking, sp = this.spots[who] || this.spots[this.scene.face], p = G.player.pos, cam = G.camera;
    const dx = sp.x - p.x, dz = sp.z - p.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
    G.player.yaw = dampAngle(G.player.yaw, Math.atan2(dx, dz), 8, dt);
    cam.up.set(0, 1, 0); cam.position.set(p.x - ux * 1.7 + uz * 0.75, p.y + 1.72, p.z - uz * 1.7 - ux * 0.75); cam.lookAt(sp.x, sp.y + 1.42, sp.z);
  }
  // ---- the phone app ----------------------------------------------------------------------------------------------
  phoneHtml() {
    const st = this.st, rows = MISSIONS.map((m, i) => {
      const done = i < st.m, cur = i === st.m, s = cur && st.step >= 0 ? m.steps[st.step] : null;
      return `<div class="ph-row" style="opacity:${i > st.m ? 0.45 : 1}"><b>${done ? '✓' : cur ? '✦' : '○'} ${i + 1}. ${i > st.m ? '???' : m.title}</b><small>${done ? `done · ${money(m.pay)}` : cur ? (s ? s.text || '…' : m.begin.who ? `Talk to ${CAST[m.begin.who].name}` : 'Starting…') : 'locked'}</small></div>`;
    }).join('');
    const s = this.step(), btn = (k, label) => `<button class="ph-row" data-story="${k}"><b>${label}</b></button>`;
    return `<h3>The Quiet Signal</h3><p>${this.finished ? `Finished. You are a Grid Warden: ${st.warden} ${st.warden === 1 ? 'fault' : 'faults'} fixed.` : 'The story so far, and where to go next.'}</p>${rows}${this.targets().length ? btn('route', 'Set a route to the objective') : ''}${s && s.k === 'night' ? btn('wait', 'Wait until 20:00') : ''}${!this.finished && st.step >= 0 ? btn('restart', 'Restart this mission') : ''}`;
  }
  phone(action) {
    if (action === 'route') { const t = this.targets()[0], p = G.player.state === 'drive' ? G.car.pos : G.player.pos; if (t && t.y < 100) G.metro.setRoute(t.x, t.z, p); G.ui.toast(t && t.y > 100 ? 'It is up high: take the orbital lift.' : 'Route set.', 'good'); }
    else if (action === 'wait') { const h = G.env.hour, mins = Math.round(((20 - h + 24) % 24) * 60); G.skip(mins, -4); }
    else if (action === 'restart') { this.restart(); G.ui.toast('Mission restarted.', 'info'); }
  }
  // after a save is loaded
  sync() { this.scene = null; this.radio.length = 0; this.timer = null; this.ch = null; G.blackout = 0; const s = this.step(); if (s && s.k === 'chase') { this.st.step = this.mission().steps.findIndex((x) => x.cp); } }
}
