// Transformations (Hero Mode, key T). Fighting fills a transform meter (it fills about twice as slowly
// as the ultimate); full, T turns the hero into their form for 30 s: a bigger body (or a new one, like
// Forge's war robot and Sable's wolf), 150 armour that soaks damage first, no knock-back, and a whole
// moveset of its own on the same keys (light, heavy, 1, 2, 3, R). T again turns back early. The change
// takes 1.4 s: the hero rises in a spiral of light, the new body grows in, and a shockwave throws
// villains back. Being knocked out in a form drops you straight back to normal.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { clamp } from '../core/util.js';
import { std, neon } from '../world/materials.js';
import { makeDog, animateDog } from '../entities/rigs.js';
import { artUrl } from '../world/art.js';

const V = () => new THREE.Vector3();
const DUR = 30, ARMOUR = 150, IN = 1.4, OUT = 0.8;
const backOut = (u) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (u - 1) ** 3 + c1 * (u - 1) ** 2; };   // overshoots a little, then settles

// ---- Forge's Siegeframe: a 6 m war robot, built from boxes and cylinders ------------------------------
function makeMech(col) {
  const root = new THREE.Group(), armour = std('#3a4048', 0.45, 0.75), plate = std(col, 0.4, 0.6), dark = std('#1c1f26', 0.5, 0.7), glow = neon('#59e0ff', 2), hot = neon('#ffb347', 2);
  const box = (m, parent, w, h, d, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
  const cyl = (m, parent, r, h, x, y, z, rx = 0, rz = 0) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 12), m); o.position.set(x, y, z); o.rotation.set(rx, 0, rz); o.castShadow = true; parent.add(o); return o; };
  const grp = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const hips = grp(root, 0, 2.7, 0); box(dark, hips, 1.7, 0.6, 1.1, 0, 0, 0);
  const torso = grp(hips, 0, 0.3, 0);
  box(armour, torso, 2.5, 1.7, 1.6, 0, 1.0, 0); box(plate, torso, 2.7, 0.7, 1.75, 0, 1.6, 0.02); box(plate, torso, 1.4, 0.9, 0.2, 0, 0.95, 0.82);
  const core = cyl(glow, torso, 0.32, 0.12, 0, 1.05, 0.93, Math.PI / 2);
  const head = grp(torso, 0, 2.1, 0.15); box(armour, head, 0.8, 0.6, 0.8, 0, 0.2, 0); box(glow, head, 0.62, 0.12, 0.05, 0, 0.25, 0.42);
  for (const s of [-1, 1]) { const back = cyl(dark, torso, 0.28, 1.4, s * 0.6, 1.1, -0.95); const fl = cyl(hot, torso, 0.2, 0.1, s * 0.6, 0.38, -0.95); void back; void fl; }   // back thrusters
  const pods = []; for (const s of [-1, 1]) { const pod = box(dark, torso, 0.7, 0.55, 0.9, s * 1.55, 2.15, -0.1); for (let k = 0; k < 6; k++) box(hot, pod, 0.1, 0.1, 0.05, ((k % 3) - 1) * 0.2, (k < 3 ? 0.1 : -0.1), 0.46); pods.push(pod); }
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = grp(torso, s * 1.6, 1.5, 0); box(plate, sh, 0.9, 0.8, 1.0, s * 0.15, 0.1, 0);
    box(armour, sh, 0.6, 1.3, 0.6, s * 0.1, -0.8, 0);
    const el = grp(sh, s * 0.1, -1.5, 0); box(armour, el, 0.65, 1.3, 0.65, 0, -0.6, 0);
    const fist = box(plate, el, 0.85, 0.75, 0.85, 0, -1.4, 0.05);
    let barrels = null;
    if (s > 0) { barrels = grp(el, 0, -1.55, 0.35); for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; cyl(dark, barrels, 0.07, 1.1, Math.cos(a) * 0.18, 0, Math.sin(a) * 0.18, Math.PI / 2); } barrels.rotation.x = 0; }
    arms.push({ sh, el, fist, barrels, s });
  }
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = grp(hips, s * 0.62, -0.2, 0); box(armour, hip, 0.75, 1.35, 0.8, 0, -0.65, 0);
    const kn = grp(hip, 0, -1.3, 0); box(plate, kn, 0.7, 1.3, 0.75, 0, -0.6, 0.05); box(dark, kn, 0.95, 0.3, 1.3, 0, -1.2, 0.18);
    legs.push({ hip, kn });
  }
  return { root, hips, torso, head, core, pods, arms, legs, phase: 0, punch: null, stomp: 0, spin: 0 };
}
function animateMech(m, dt, t, speed, aimPitch) {
  const P = m.punch; if (P) { P.t -= dt; if (P.t <= 0) m.punch = null; }
  m.phase += dt * speed * 0.55; const s = Math.sin(m.phase), c = Math.cos(m.phase), walk = Math.min(1, speed / 3);
  m.hips.position.y = 2.7 + Math.abs(c) * 0.12 * walk; m.torso.rotation.y = s * 0.08 * walk; m.torso.rotation.x = 0.06 * walk;
  m.legs.forEach((l, i) => { const ph = i ? -s : s; l.hip.rotation.x = ph * 0.55 * walk; l.kn.rotation.x = Math.max(0, (i ? c : -c)) * 0.7 * walk + 0.05; });
  if (m.stomp > 0) { m.stomp -= dt; const u = m.stomp; m.legs[0].hip.rotation.x = u > 0.25 ? -1.1 : -1.1 * (u / 0.25); m.legs[0].kn.rotation.x = u > 0.25 ? 1.2 : 1.2 * (u / 0.25); }
  m.arms.forEach((a, i) => {
    let ax = -s * 0.35 * walk * (i ? 1 : -1), ex = -0.25;
    if (a.s > 0 && m.firing) { ax = -1.55 - aimPitch; ex = 0; }
    if (P && P.side === a.s) { const u = P.t / P.T; ax = u > 0.6 ? 0.5 : -1.65; ex = u > 0.6 ? -1.6 : 0; }
    if (m.beaming) { ax = -1.4 - aimPitch; ex = -0.1; }
    a.sh.rotation.x += (ax - a.sh.rotation.x) * Math.min(1, dt * 18); a.el.rotation.x += (ex - a.el.rotation.x) * Math.min(1, dt * 18);
    if (a.barrels) { m.spin = m.firing ? m.spin + dt * 30 : m.spin * Math.exp(-3 * dt); a.barrels.rotation.y += m.spin * dt; }
  });
  m.core.scale.setScalar(1 + Math.sin(t * 6) * 0.08 + (m.beaming ? 0.5 : 0));
}

// ---- the forms -----------------------------------------------------------------------------------------
// scale: the hero body (hidden under a model); speed, jump, cam: movement and camera; model: what is drawn
export const FORMS = {
  forge: {
    name: 'Siegeframe', blurb: 'a 6 m war robot assembled around the armour', color: '#ffb347', scale: 2.6, speed: 0.85, jump: 9, cam: 2.3, model: 'mech',
    moves: [['Light', 'Rocket fists, left and right'], ['Heavy', 'Stomp: a shockwave round the robot'], ['1 Barrage', '24 mini-missiles from the shoulder pods'], ['2 Gatling', 'The right arm spins up and fires (2.4 s)'], ['3 Thruster ram', 'Charge 20 m through everything'], ['R Core cannon', 'A giant beam from the chest for 2 s']],
  },
  bulwark: {
    name: 'Colossus', blurb: 'three and a half times his size, and slower', color: '#7dff9c', scale: 3.5, speed: 0.8, jump: 11, cam: 2.6,
    moves: [['Light', 'Punches that shake the street'], ['Heavy', 'A two-fist smash that throws cars'], ['1 Car throw', 'Grab the nearest vehicle (16 m) and throw it'], ['2 Thunder clap', 'A shockwave 28 m long'], ['3 Mega leap', 'A jump of up to 150 m that lands in a quake'], ['R Earthsplitter', 'A fissure tears open along the street ahead']],
  },
  rook: {
    name: 'Titan Gear', blurb: 'a rubber giant wreathed in steam', color: '#f08a24', scale: 2.8, speed: 1.15, jump: 13, cam: 2.3,
    moves: [['Light', 'Stretch punches that reach 10 m'], ['Heavy', 'Bounce slam: up high, then down hard'], ['1 Gatling flurry', 'A storm of stretching punches (1.6 s)'], ['2 Car whip', 'Grab a vehicle, whip it round and fling it'], ['3 Steam overdrive', '8 s much faster'], ['R Titan fist', 'A giant fist falls from the sky where you aim']],
  },
  raiko: {
    name: 'Stormbound', blurb: 'his body turned to lightning', color: '#c9b8ff', scale: 1.25, speed: 1.7, jump: 12, cam: 1.25,
    moves: [['Light', 'Lightning blade waves that fly ahead'], ['Heavy', 'Blink chain: through up to five villains in turn'], ['1 Plasma typhoon', 'A storm of fire and lightning for 1.8 s'], ['2 Five bolts', 'Lightning on the five nearest villains'], ['3 Thunder step', 'Flash 20 m through everything'], ['R Heaven\'s Edge', 'A giant blade of light falls where you aim']],
    setup(H) { return { tick: (dt, t, k) => { if (k < 0.3) return; const c = H.centre(), p = G.player; if (Math.random() < dt * 14) G.fx.bolt(V().set(c.x + (Math.random() - 0.5) * 1.6, c.y + (Math.random() - 0.5) * 2, c.z + (Math.random() - 0.5) * 1.6), V().set(c.x + (Math.random() - 0.5) * 1.6, c.y + (Math.random() - 0.5) * 2, c.z + (Math.random() - 0.5) * 1.6), '#c9b8ff', 0.04, 0.1, 0.5); if ((p.speed || 0) > 3 && Math.random() < dt * 30) G.fx.glow.emit(c.x, c.y, c.z, 0, 0, 0, '#a78bff', 0.4, 0.5, 0.1, 0, 0, 0.5); } }; },
  },
  brann: {
    name: 'Storm Herald', blurb: 'a storm god in lightning armour, light as a cloud', color: '#8fd3ff', scale: 1.45, speed: 1.35, jump: 15, cam: 1.4, grav: 0.35,
    moves: [['Light', 'Hammer blows that call lightning on whoever they hit'], ['Heavy', 'Hammer meteor: up, then down in a crash of lightning'], ['1 Chain lightning', 'Jumps through six villains'], ['2 Thunder dome', '4 s of a dome that shocks everyone inside'], ['3 Storm call', 'Eight bolts round you'], ['R Skyfall Strike', 'Up into the sky, then down onto where you aim']],
    setup(H) { const orbs = [G.fx.orb('#8fd3ff', 0.35), G.fx.orb('#ffffff', 0.22)]; return { tick: (dt, t, k) => { const c = H.centre(); orbs.forEach((o, i) => { const a = t * 3 + i * Math.PI; o.p.set(c.x + Math.cos(a) * 1.6 * k, c.y + 0.4 + Math.sin(t * 2 + i) * 0.3, c.z + Math.sin(a) * 1.6 * k); }); if (k > 0.3 && Math.random() < dt * 8) G.fx.bolt(orbs[0].p.clone(), c.clone(), '#8fd3ff', 0.03, 0.08, 0.4); }, dispose: () => orbs.forEach((o) => { o.life = 0; }) }; },
  },
  ember: {
    name: 'Phoenix', blurb: 'wings of fire, and real flight', color: '#ff7a1a', scale: 1.3, speed: 1.4, jump: 12, cam: 1.4, fly: true,
    moves: [['Light', 'Fire bolts (they bend onto an enemy near the crosshair)'], ['Heavy', 'Dive bomb (in the air) or a burst of fire'], ['1 Meteor rain', 'Eight small meteors round where you aim'], ['2 Wing sweep', 'A wave of fire 10 m wide that sets villains alight'], ['3 Blaze trail', '6 s of fire left wherever you go'], ['R Rebirth Nova', 'Half your health back, and a blast 14 m wide'], ['Space in the air', 'Fly (as Forge does)']],
    setup(H) {
      const r = G.player.rig, mat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff7a1a').multiplyScalar(1.5), transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
      const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(1.6, 0.5); shape.lineTo(1.3, -0.1); shape.lineTo(1.0, -0.6); shape.lineTo(0, -0.3); const geo = new THREE.ShapeGeometry(shape);
      const wings = [1, -1].map((s) => { const w = new THREE.Mesh(geo, mat); w.scale.set(s, 1, 1); w.position.set(0, 0.3, -0.12); r.chest.add(w); return w; });
      return { tick: (dt, t, k) => { const fl = Math.sin(t * (G.player.grounded ? 3 : 9)) * 0.45; wings.forEach((w, i) => { w.rotation.y = (i ? -1 : 1) * (0.5 + fl); w.scale.y = k; w.scale.x = (i ? -1 : 1) * k; }); if (k > 0.3 && Math.random() < dt * 20) { const q = wings[Math.random() < 0.5 ? 0 : 1].getWorldPosition(V()); G.fx.fire(q, 2, 1.2); } }, dispose: () => { wings.forEach((w) => w.removeFromParent()); geo.dispose(); mat.dispose(); } };
    },
  },
  kitsu: {
    name: 'Nine-Tail Spirit', blurb: 'a fox spirit 8 m tall around her, with nine tails', color: '#ffb347', scale: 1, speed: 1.45, jump: 14, cam: 2.2,
    moves: [['Light', 'Tail sweeps'], ['Heavy', 'Spirit bomb: a huge sphere thrown where you aim'], ['1 Fox fire', 'Six orbs that hunt the nearest villains'], ['2 Fox clones', 'Six clones join the fight for 10 s'], ['3 Spirit dash', 'A 20 m dash with the fox around you'], ['R Tail Storm', 'All nine tails strike round you in turn']],
    setup(H) {
      const fox = makeDog({ scale: 6.5 }), mat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff9a2a').multiplyScalar(1.1), transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending });
      fox.root.traverse((m) => { if (m.isMesh) { m.material = mat; m.castShadow = false; } });
      const tails = []; for (let i = 0; i < 9; i++) { const tm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.5), mat); tm.position.set(0, 0.1, -0.22); tm.rotation.set(0.5 + (i % 3) * 0.25, 0, (i - 4) * 0.22); fox.tail.add(tm); tails.push(tm); }
      G.scene.add(fox.root);
      return { fox, tick: (dt, t, k) => { const p = G.player; fox.root.position.set(p.pos.x, p.pos.y, p.pos.z); fox.root.rotation.y = p.yaw; fox.root.scale.setScalar(Math.max(0.01, k)); animateDog(fox, dt, (p.speed || 0) > 0.4 ? 'run' : 'idle', (p.speed || 0) / 6.5); tails.forEach((tm, i) => { tm.rotation.y = Math.sin(t * 2.5 + i) * 0.35; }); }, dispose: () => { fox.root.removeFromParent(); fox.root.traverse((m) => { if (m.geometry) m.geometry.dispose(); }); mat.dispose(); } };
    },
  },
  sable: {
    name: 'Alpha Wolf', blurb: 'a giant spectral wolf', color: '#ff5a6e', scale: 1.7, speed: 1.9, jump: 13, cam: 1.9, model: 'wolf',
    moves: [['Light', 'Claw swipes'], ['Heavy', 'Pounce on the nearest villain (20 m)'], ['1 Howl', 'Stuns everyone within 15 m'], ['2 The pack', 'Eight hounds run down the villains'], ['3 Shadow dash', 'Tear through 18 m of them'], ['R Moonfang', 'Five bites on the nearest villain, then a throw']],
  },
};

export class Forms {
  constructor(H) { this.H = H; this.meter = 0; this.on = null; this.t = 0; this.armour = 0; this.seq = null; this.model = null; this.k = 0; }
  get active() { return !!(this.on || this.seq); }
  def(id = this.H.id) { return FORMS[id] || null; }
  gain(k) { if (!this.on && !this.seq && this.def()) this.meter = Math.min(100, this.meter + k); }
  // damage taken while transformed (or changing): the armour takes it first; returns what is left over
  soak(dmg) { if (this.seq) return 0; const a = Math.min(this.armour, dmg); this.armour -= a; return dmg - a; }
  toggle() {
    const H = this.H, p = G.player, F = this.def();
    if (this.seq) return;
    if (this.on) return this.end();
    if (!F) { if (!(H.cd.formMsg > 0)) { G.ui.toast(`${H.H.name} has no transformation yet.`, 'info'); H.cd.formMsg = 3; } return; }
    if (this.meter < 100) { if (!(H.cd.formMsg > 0)) { G.ui.toast(`Transform not ready: ${Math.floor(this.meter)}%. Fight to fill the meter.`, 'info'); H.cd.formMsg = 3; } return; }
    if (p.state !== 'walk' || H.ult > 0) return;
    this.start();
  }
  start() {
    const H = this.H, F = this.def(), p = G.player;
    this.meter = 0; this.seq = { dir: 1, t: 0, burst: false }; this.on = null; this.armour = ARMOUR; this.t = DUR; this.k = 0; this.form = F; this.id = H.id;
    p.play('transform', IN); p.vel.set(0, 6, 0); p.grounded = false; H.kick(5); G.ui.flash(F.name.toUpperCase(), 1.6);
    if (G.audio) { G.audio.tone(60, 1.4, 0.14, 'sawtooth', null, 0.1, 0.8); G.audio.tone(240, 1.2, 0.05, 'triangle', null, 0.3, 0.6); }
    if (G.sfx) G.sfx.play('power', null, 1);
    if (F.setup) this.extra = F.setup.call(this, H);
    if (F.model === 'mech') { this.model = makeMech(H.H.color || F.color); G.scene.add(this.model.root); this.model.root.scale.setScalar(0.01); }
    // the wolf: dark, with glowing red markings and eyes
    if (F.model === 'wolf') { const w = makeDog({ robot: true, color: '#2a1820', accent: F.color, scale: 5.2 }); this.model = { dog: w, root: w.root }; G.scene.add(w.root); w.root.scale.setScalar(0.01); }
  }
  end(quiet) {
    if (!this.on && !this.seq) return;
    if (quiet) { this.finish(); return; }
    this.on = null; this.seq = { dir: -1, t: 0 };
    const c = this.H.centre(); G.fx.smoke(c, 14, '#d8dde4', 3, 2.5); G.fx.ring(c, this.form.color, 0.5, 6, 0.5);
    if (G.audio) G.audio.tone(320, 0.6, 0.05, 'triangle', null, 0, 0.4);
  }
  finish() {
    if (this.dome) { this.dome.m.removeFromParent(); this.dome = null; } this.blaze = 0;
    this.on = null; this.seq = null; this.armour = 0; this.k = 0;
    if (this.extra && this.extra.dispose) this.extra.dispose(); this.extra = null;
    if (this.model) { this.model.root.removeFromParent(); this.model.root.traverse((m) => { if (m.geometry) m.geometry.dispose(); }); this.model = null; }
    const r = G.player.rig; if (r) r.root.visible = true;
    this.H.applyStats();
  }
  // how big the hero body is right now (1 normal, the form's scale when transformed, between while changing)
  scale() { const F = this.form; if (!F) return 1; return 1 + (F.scale - 1) * this.k; }
  update(dt, t) {
    const H = this.H, p = G.player;
    if (!H.on || (this.id && this.id !== H.id)) { if (this.active) this.finish(); this.id = null; return; }
    if (this.seq) {
      const S = this.seq; S.t += dt;
      if (S.dir > 0) {
        const u = clamp((S.t - 0.45) / 0.8, 0, 1); this.k = backOut(u);
        // a spiral of light rising round the hero
        const c = H.centre(), col = this.form.color; for (let i = 0; i < 3; i++) { const a = t * 9 + i * 2.1, r = 1.4 + this.k * 2, y = c.y - 1 + ((S.t * 3 + i * 0.33) % 1) * (2 + this.k * 6); G.fx.glow.emit(c.x + Math.cos(a) * r, y, c.z + Math.sin(a) * r, 0, 1.5, 0, col, 0.5, 0.28, 0.05, 0, 0); }
        if (p.vel.y < 0 && S.t < 0.8) p.vel.y = 0.5;
        if (S.t >= 1.2 && !S.burst) {
          S.burst = true; const cc = H.centre(), F = this.form;
          H.ball(cc, 10, { dmg: 20, knock: 20, up: 7, kind: 'shock', color: F.color, civ: false });
          G.fx.ring(cc, F.color, 1, 14, 0.6); G.fx.ring(cc, '#ffffff', 0.5, 9, 0.4); G.fx.blast(cc, F.color, 1, 6, 0.4); G.fx.shake(0.6); G.fx.dust(V().set(p.pos.x, p.pos.y, p.pos.z), 30, 4);
          if (G.audio) G.audio.burst(0.9, 0.35, 180);
          H.showCard(artUrl(`hero-${H.id}.jpg`), F.name, `${H.H.name} transforms · ${F.blurb}`, F.color, 2.2, false, null);
        }
        if (S.t >= IN) { this.seq = null; this.on = this.form; this.k = 1; G.ui.toast(`${this.form.name}: ${DUR} s. T turns back early. Your moves have changed (Hero Hall ▸ moves).`, 'good'); }
      } else {
        const u = clamp(S.t / OUT, 0, 1); this.k = 1 - u * u;
        if (Math.random() < dt * 20) G.fx.smoke(H.centre(), 2, '#d8dde4', 2, 2);
        if (S.t >= OUT) this.finish();
      }
      H.applyStats();
    } else if (this.on) {
      this.t -= dt; if (this.t <= 0) { this.end(); G.ui.toast(`${this.form.name} wears off.`, 'info'); }
      // footsteps of a giant shake the ground a little
      if (this.form.scale >= 2.5 && p.grounded && p.speed > 1 && Math.floor((t - dt) * 1.6) !== Math.floor(t * 1.6)) { G.fx.shake(0.06); G.fx.dust(V().set(p.pos.x, p.pos.y, p.pos.z), 4, 1.5); }
      this.landings();
    }
    // the drawn body: a model in place of the hero (who is hidden), or the hero grown
    if (this.model) {
      const r = p.rig; if (r && this.k > 0.55) r.root.visible = false;
      this.model.root.position.set(p.pos.x, p.pos.y, p.pos.z); this.model.root.rotation.y = p.yaw; this.model.root.scale.setScalar(Math.max(0.01, this.k));
      // the wolf: a spectral glow drifting off it, its legs by speed, a lunge or a howl
      if (this.model.dog) { const sp = p.speed || 0; if (this.k > 0.5 && Math.random() < dt * 30) G.fx.glow.emit(p.pos.x + (Math.random() - 0.5) * 3, p.pos.y + 0.5 + Math.random() * 3, p.pos.z + (Math.random() - 0.5) * 3, 0, 0.8, 0, this.form.color, 0.6, 0.35, 0.05, 0, 0, 0.6); animateDog(this.model.dog, dt, sp > 5 ? 'run' : sp > 0.4 ? 'walk' : 'idle', sp / 5.2); if (this.lunge > 0) { this.lunge -= dt; this.model.dog.body.rotation.x = -0.35 * Math.sin((this.lunge / 0.3) * Math.PI); this.model.dog.head.rotation.x = 0.4 * Math.sin((this.lunge / 0.3) * Math.PI); } if (this.howlT > 0) { this.howlT -= dt; this.model.dog.head.rotation.x = -0.9; } }
      else animateMech(this.model, dt, t, p.speed || 0, p.camPitch || 0);
    }
    if (this.form && this.form.id !== undefined) void 0;
    if (this.on && H.id === 'rook' && Math.random() < dt * 8) G.fx.smoke(V().set(p.pos.x + (Math.random() - 0.5) * 3, p.pos.y + 2 + Math.random() * 4, p.pos.z + (Math.random() - 0.5) * 3), 1, '#e8eef4', 1.6, 1.4);
    if (this.boost > 0) { this.boost -= dt; if (this.boost <= 0) H.applyStats(); }
    if (this.extra && this.extra.tick) this.extra.tick(dt, t, this.k);
    if (this.dome) { const D = this.dome; D.t -= dt; D.tick -= dt; D.m.position.set(p.pos.x, p.pos.y, p.pos.z); D.m.material.opacity = 0.12 + Math.sin(t * 9) * 0.04; if (D.tick <= 0) { D.tick = 0.3; H.ball(H.centre(), 8, { dmg: 9, stun: 0.5, knock: 3, kind: 'shock', color: '#8fd3ff', civ: false }); for (let i = 0; i < 2; i++) { const a = Math.random() * 6.28, b = Math.random() * 1.4; G.fx.bolt(H.centre(), V().set(p.pos.x + Math.cos(a) * 8 * Math.cos(b), p.pos.y + 8 * Math.sin(b), p.pos.z + Math.sin(a) * 8 * Math.cos(b)), '#8fd3ff', 0.05, 0.12); } } if (D.t <= 0) { D.m.removeFromParent(); D.m.geometry.dispose(); this.dome = null; } }
    if (this.blaze > 0) { this.blaze -= dt; if (Math.random() < dt * 10) { H.patches = H.patches || []; H.patches.push({ p: V().set(p.pos.x, G.colliders.groundAt(p.pos.x, p.pos.z, p.pos.y + 1, 30, 0.3), p.pos.z), t: 4, k: 0.3, r: 1.6 }); } }
  }
  // landings that do something: Bulwark's mega leap, Rook's bounce slam, Sable's pounce
  landings() {
    const H = this.H, p = G.player; if (!this.landing || !p.grounded) return;
    const L = this.landing; this.landing = null; const c = V().set(p.pos.x, p.pos.y + 0.3, p.pos.z), col = this.form.color;
    H.ball(c, L.r, { dmg: L.dmg, up: L.up || 8, knock: L.knock || 14, stun: L.stun || 0, kind: 'blunt', color: col });
    G.fx.ring(c, col, 0.8, L.r + 3, 0.5); G.fx.dust(c, 40, L.r * 0.5); G.fx.shake(0.7); H.kick(6);
    G.damage.burst(c, L.r, L.power || 4, 'blunt', { byHero: true });
  }
  // a stat block for applyStats(): body scale, speed, jump, camera distance
  stats() { const F = this.form, k = this.k; if (!F || k <= 0) return null; const boost = this.boost > 0 ? 1.6 : 1; return { sc: this.scale(), sp: (1 + (F.speed - 1) * k) * boost, jv: 8 + (F.jump - 8) * k, ck: 1 + (F.cam - 1) * k, gk: 1 + ((F.grav || 1) - 1) * k }; }
  // the form's own moves (true: handled)
  use(slot) {
    if (!this.on) return false;
    const H = this.H, fn = MOVES[this.id] && MOVES[this.id][slot]; if (!fn) return slot === 'sig' || slot === 'p5';
    if (slot !== 'ult' && !H.ready('f' + slot)) return true;
    const cd = fn.call(this, H, G.player); if (cd) H.cool('f' + slot, cd);
    if (G.sfx && SND[this.id] && SND[this.id][slot]) for (const [n, d = 0] of SND[this.id][slot]) setTimeout(() => G.sfx && G.sfx.play(n, null, 1), d * 1000);
    H.kick(slot === 'ult' ? 8 : slot === 'heavy' ? 3 : 1);
    return true;
  }
}

// ---- the form moves: called with this = Forms, (H = the hero system, p = the player); return the cooldown
const SND = {
  raiko: { light: [['shing']], heavy: [['blink'], ['zap', 0.1]], p1: [['roar'], ['zap', 0.2]], p2: [['bolt'], ['bolt', 0.3]], p3: [['blink']], ult: [['charge'], ['bolt', 0.7]] },
  brann: { light: [['clang']], heavy: [['whoosh'], ['bolt', 0.6]], p1: [['zap']], p2: [['ring']], p3: [['bolt'], ['bolt', 0.4]], ult: [['whoosh'], ['bolt', 1.1]] },
  ember: { light: [['fireball']], heavy: [['fire']], p1: [['fireball'], ['fireball', 0.5]], p2: [['fire']], p3: [['fire']], ult: [['power'], ['boom', 0.5]] },
  kitsu: { light: [['swish']], heavy: [['charge'], ['whoosh', 0.65]], p1: [['poof']], p2: [['poof']], p3: [['whoosh']], ult: [['whirl'], ['boom', 0.5]] },
  forge: { light: [['punch']], heavy: [['slam']], p1: [['missile'], ['missile', 0.3], ['missile', 0.6]], p2: [['repulsor']], p3: [['whoosh']], ult: [['charge'], ['beam', 0.3]] },
  bulwark: { light: [['heavy']], heavy: [['slam']], p1: [['whoosh', 0.4]], p2: [['clap']], p3: [['whoosh']], ult: [['slam'], ['boom', 0.3]] },
  rook: { light: [['stretch']], heavy: [['boing']], p1: [['stretch'], ['stretch', 0.3], ['stretch', 0.6]], p2: [['whoosh']], p3: [['steam']], ult: [['whistle'], ['boom', 1.1]] },
  sable: { light: [['cut']], heavy: [['growl']], p1: [['growl']], p2: [['growl']], p3: [['whoosh']], ult: [['growl'], ['cut', 0.3]] },
};
const fwdOf = (p) => V().set(Math.sin(p.yaw), 0, Math.cos(p.yaw));
// a giant's blows land low in front of it (from its chest they would pass over the robots on the street)
const front = (H, p, d, r, o) => { const f = fwdOf(p); return H.ball(V().set(p.pos.x + f.x * d, p.pos.y + 1.3, p.pos.z + f.z * d), r, o); };
const waist = (p) => V().set(p.pos.x, p.pos.y + 1.5, p.pos.z);
const groundAhead = (p, d) => { const f = fwdOf(p), x = p.pos.x + f.x * d, z = p.pos.z + f.z * d; return V().set(x, G.colliders.groundAt(x, z, p.pos.y + 3, 6, 0.3) + 0.3, z); };
// grab the nearest road vehicle within range and throw it at where you aim
function throwCar(H, p, range, speed, from) {
  const W = G.wrecks; let car = null, bd = range;
  if (W) for (const s of W.live()) { if (s.dead || s.burning) continue; const d = Math.hypot(s.x - p.pos.x, s.z - p.pos.z); if (d < bd) { bd = d; car = s; } }
  const a = H.aim(120), dir = V().subVectors(a.point, from).normalize();
  if (car && W.throwVehicle(car, from.clone(), V().set(dir.x * speed, Math.max(5, dir.y * speed + 6), dir.z * speed), { byHero: true })) return true;
  H.shoot({ from: from.clone(), dir: V().set(dir.x, dir.y + 0.12, dir.z).normalize(), speed: speed + 4, r: 1.1, color: '#9a958b', dmg: 50, knock: 16, up: 6, blast: 5, power: 3.5, kind: 'blunt', grav: 9, life: 3.5 });
  return false;
}
const MOVES = {
  raiko: {
    light(H, p) { const k = (this.combo = ((this.combo || 0) + 1) % 2); p.play(k ? 'slash' : 'slash2', 0.26); H.faceAim(0.4); H.later(0.08, () => { const a = H.aim(40), from = H.chest(); H.wave(V().subVectors(a.point, from).normalize(), from, 26, '#c9b8ff'); H.cone(3.5, 90, { dmg: 18, knock: 5, kind: 'shock', color: '#c9b8ff' }); H.trail('B', '#c9b8ff', 0.2, 0.09); }); return 0.3; },
    heavy(H, p) { const list = H.nearest(5, 25).filter((q) => !q.flying); if (!list.length) return 0; G.ui.flash('BLINK CHAIN', 0.6); let prev = H.centre();
      list.forEach((t, i) => H.later(i * 0.16, () => { if (!t.alive) return; const c = G.combat.centre(t, V()), back = V().subVectors(c, prev).setY(0).normalize(); G.fx.bolt(prev.clone(), c.clone(), '#ffffff', 0.12, 0.25); p.pos.set(t.pos.x - back.x * 1.4, t.pos.y + 0.1, t.pos.z - back.z * 1.4); p.yaw = Math.atan2(back.x, back.z); p.play('dashstab', 0.16); G.combat.hitTarget(t, back, { dmg: 42, stun: 0.8, knock: 6, up: 2, kind: 'shock', color: '#c9b8ff', byHero: true }); prev = c; }));
      return 1.6; },
    p1(H, p) { p.play('breathe', 1.8); H.faceAim(1.9); H.startChannel(1.8, 0.1, () => { const c = H.chest(), f = H.fwd(V(), 0.3); H.cone(12, 30, { dmg: 9, knock: 2, kind: 'fire', color: '#ff7a1a' }, c, f); G.fx.spray(c, f, '#ff7a1a', 10, 18, 0.35, 0.5, 0.4, 1.2); for (let i = 0; i < 2; i++) G.fx.bolt(c.clone(), c.clone().addScaledVector(f, 6 + Math.random() * 6).add(V().set((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 4)), '#c9b8ff', 0.05, 0.12); }, { slow: 0.4 }); return 7; },
    p2(H, p) { const list = H.nearest(5, 45); p.play('raise', 0.5); list.forEach((t, i) => H.later(0.15 + i * 0.12, () => { if (!t.alive) return; const c = G.combat.centre(t, V()); G.fx.bolt(c.clone().setY(c.y + 40), c, '#ffffff', 0.18, 0.25, 2); H.ball(c, 3, { dmg: 50, stun: 1, knock: 4, kind: 'shock', color: '#c9b8ff' }); G.fx.ring(c, '#c9b8ff', 0.5, 4, 0.3); })); return 8; },
    p3(H, p) { const a = H.aim(30), dir = V().subVectors(a.point, p.pos).setY(0).normalize(); H.startMove('dash', { dir, speed: 70, T: 0.29, done: new Set(), anim: 'dash', hit: { dmg: 40, knock: 8, kind: 'shock', color: '#c9b8ff' }, r: 2, trail: (x, y) => { G.fx.glow.emit(y.x, y.y + 1, y.z, 0, 0, 0, '#a78bff', 0.5, 0.8, 0.2, 0, 0); } }); return 3; },
    ult(H, p) { const at = H.aim(80).point.clone(); G.ui.flash("HEAVEN'S EDGE", 1.2); p.play('raise', 1); const top = at.clone().setY(at.y + 50);
      for (let i = 0; i <= 12; i++) H.later(i * 0.05, () => { const y = top.y - (top.y - at.y) * (i / 12); G.fx.beam(V().set(at.x, y + 10, at.z), V().set(at.x, y, at.z), '#c9b8ff', 1.3, 0.12); G.fx.beam(V().set(at.x, y + 10, at.z), V().set(at.x, y, at.z), '#ffffff', 0.5, 0.12); });
      H.later(0.7, () => { H.ball(at, 9, { dmg: 140, knock: 18, up: 10, kind: 'shock', color: '#c9b8ff', from: at }); G.damage.burst(at, 9, 5, 'energy', { byHero: true }); G.fx.blast(at, '#c9b8ff', 1, 10, 0.6); G.fx.ring(at, '#ffffff', 1, 15, 0.6); G.fx.shake(0.8); }); return 0; },
  },
  brann: {
    light(H, p) { const k = (this.combo = ((this.combo || 0) + 1) % 3); p.play(['slash', 'slash2', 'smash'][k], 0.3); H.faceAim(0.4); H.later(0.1, () => { const n = H.cone(4.8, 90, { dmg: [24, 24, 36][k], knock: [6, 6, 12][k], up: k === 2 ? 5 : 1, kind: 'shock', color: '#8fd3ff' }); H.trail('R', '#8fd3ff', 0.22, 0.12); if (n) { const t = G.combat.lastHit; if (t && t.alive) { const c = G.combat.centre(t, V()); G.fx.bolt(c.clone().setY(c.y + 30), c, '#ffffff', 0.1, 0.18); G.combat.hitTarget(t, V().set(0, 0, 1), { dmg: 10, kind: 'shock', color: '#8fd3ff', byHero: true }); } } }); return 0.34; },
    heavy(H, p) { if (!p.grounded) return 0; p.vel.y = 17; p.grounded = false; p.play('raise', 0.8); this.landing = { r: 8, dmg: 65, up: 9, knock: 14, stun: 1, power: 4 }; H.later(0.6, () => { if (!p.grounded) p.vel.y = -28; }); return 1.8; },
    p1(H, p) { const list = H.nearest(6, 35); if (!list.length) return 0; p.play('castR', 0.4); H.chain(list, 40, '#8fd3ff', 0.12); return 3; },
    p2(H, p) { if (this.dome) return 0; const m = new THREE.Mesh(new THREE.SphereGeometry(8, 24, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color('#8fd3ff').multiplyScalar(1.1), transparent: true, opacity: 0.14, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); G.scene.add(m); this.dome = { m, t: 4, tick: 0 }; p.play('raise', 0.4); return 10; },
    p3(H, p) { p.play('raise', 0.6); for (let i = 0; i < 8; i++) H.later(0.1 + i * 0.12, () => { const t = H.nearest(8, 22)[i % 8], at = t && t.alive ? G.combat.centre(t, V()) : V().set(p.pos.x + (Math.random() - 0.5) * 30, p.pos.y, p.pos.z + (Math.random() - 0.5) * 30); G.fx.bolt(at.clone().setY(at.y + 35), at, '#ffffff', 0.16, 0.22, 2); H.ball(at, 3.2, { dmg: 34, stun: 0.8, knock: 5, kind: 'shock', color: '#8fd3ff' }); }); return 7; },
    ult(H, p) { const at = H.aim(90).point.clone(); G.ui.flash('SKYFALL STRIKE', 1.2); p.vel.set(0, 26, 0); p.grounded = false; p.play('raise', 1.2);
      H.later(1.0, () => { const dx = at.x - p.pos.x, dz = at.z - p.pos.z, dy = at.y - p.pos.y, T = 0.45; p.vel.set(dx / T, dy / T, dz / T); p.fling = 'leap'; p.play('dropkick', 0.5); this.landing = { r: 12, dmg: 130, up: 12, knock: 20, stun: 1.5, power: 6 }; G.fx.bolt(V().set(at.x, at.y + 60, at.z), at, '#ffffff', 0.3, 0.4, 3); });
      return 0; },
  },
  ember: {
    light(H, p) { H.faceAim(0.3); p.play('castR', 0.2); const a = H.aim(70), from = H.hand(), tg = H.airTarget ? H.airTarget(70, 0.94) : null; const d = V().subVectors(tg ? G.combat.centre(tg, V()) : a.point, from).normalize(); H.shoot({ from, dir: d, speed: 50, r: 0.3, color: '#ff7a1a', dmg: 22, knock: 4, blast: 1.6, power: 0.8, kind: 'fire', life: 2, trail: '#ffc23d' }); return 0.22; },
    heavy(H, p) {
      if (!p.grounded) { const at = H.aim(60).point.clone(), dx = at.x - p.pos.x, dz = at.z - p.pos.z, dy = at.y - p.pos.y, T = 0.4; if (H.mv) H.endMove(); p.vel.set(dx / T, dy / T, dz / T); p.fling = 'leap'; p.play('dropkick', 0.5); this.landing = { r: 7, dmg: 60, up: 6, knock: 12, power: 3.5 }; G.ui.flash('DIVE BOMB', 0.6); return 1.4; }
      p.play('roar', 0.4); H.later(0.1, () => { const c = H.centre(); H.ball(c, 6, { dmg: 38, knock: 12, up: 4, kind: 'fire', color: '#ff7a1a' }); G.fx.blast(c, '#ff7a1a', 0.5, 6, 0.4); G.fx.fire(c, 20, 4); }); return 1.2;
    },
    p1(H, p) { const at = H.aim(70).point.clone(); p.play('raise', 0.6); for (let i = 0; i < 8; i++) H.later(0.2 + i * 0.18, () => { const q = at.clone().add(V().set((Math.random() - 0.5) * 12, 0, (Math.random() - 0.5) * 12)); const top = q.clone().add(V().set(-6, 40, -4)); const orb = G.fx.orb('#ff6a1a', 1); for (let j = 0; j <= 8; j++) H.later(j * 0.04, () => { orb.p.copy(top).lerp(q, j / 8); G.fx.fire(orb.p, 2, 0.8); }); H.later(0.34, () => { orb.life = 0; H.ball(q, 4, { dmg: 40, knock: 8, up: 4, kind: 'fire', color: '#ff7a1a', from: q }); G.fx.blast(q, '#ff8a3c', 0.5, 4, 0.4); G.damage.impact(q.clone(), V().set(0, 1, 0), 2, 'fire', { byHero: true, quiet: true }); }); }); return 9; },
    p2(H, p) { p.play('roar', 0.45); H.later(0.12, () => { const c = H.chest(), f = H.fwd(V(), 0.2); H.cone(10, 120, { dmg: 35, knock: 14, up: 3, kind: 'fire', color: '#ff7a1a' }, c, f); for (let i = -6; i <= 6; i++) { const a = p.yaw + i * 0.17, q = V().set(c.x + Math.sin(a) * 6, c.y - 0.5, c.z + Math.cos(a) * 6); G.fx.fire(q, 4, 1.2); } }); return 5; },
    p3(H, p) { this.blaze = 6; G.ui.flash('BLAZE TRAIL', 0.7); return 12; },
    ult(H, p) { G.ui.flash('REBIRTH NOVA', 1.2); p.play('transform', 0.8); H.hp = Math.min(H.max, H.hp + H.max * 0.5); H.later(0.5, () => { const c = H.centre(); H.ball(c, 14, { dmg: 110, knock: 20, up: 8, kind: 'fire', color: '#ff7a1a' }); G.damage.burst(c, 12, 5, 'fire', { byHero: true }); G.fx.blast(c, '#ffc23d', 1, 14, 0.7); G.fx.ring(c, '#ff7a1a', 1, 18, 0.7); G.fx.shake(0.7); }); return 0; },
  },
  kitsu: {
    light(H, p) { const k = (this.combo = ((this.combo || 0) + 1) % 3); p.play(['punchR', 'punchL', 'spinkick'][k], 0.24); H.faceAim(0.3); H.later(0.08, () => { const c = V().set(p.pos.x + Math.sin(p.yaw) * 4, p.pos.y + 1.3, p.pos.z + Math.cos(p.yaw) * 4); H.ball(c, 5, { dmg: [26, 26, 38][k], knock: [8, 8, 16][k], up: k === 2 ? 5 : 1, kind: 'blunt', color: '#ffb347' }); for (let j = -2; j <= 2; j++) G.fx.beam(V().set(c.x + Math.cos(p.yaw) * j, c.y + 3, c.z - Math.sin(p.yaw) * j), V().set(c.x - Math.cos(p.yaw) * j, c.y - 1, c.z + Math.sin(p.yaw) * j), '#ffb347', 0.18, 0.18); }); return 0.26; },
    heavy(H, p) { p.play('raise', 0.7); const orb = G.fx.orb('#ffb347', 0.4); for (let i = 0; i <= 12; i++) H.later(i * 0.05, () => { orb.p.copy(H.hand()).add(V().set(0, 1.8, 0)); orb.r0 = orb.r1 = 0.4 + i * 0.12; });
      H.later(0.65, () => { orb.life = 0; const a = H.aim(70), from = H.hand().add(V().set(0, 1.8, 0)); p.play('throw', 0.4); H.shoot({ from, dir: V().subVectors(a.point, from).normalize(), speed: 36, r: 1.8, color: '#ffb347', dmg: 90, knock: 20, up: 8, blast: 8, power: 5, kind: 'shock', life: 2.5, trail: '#ffd34d' }); }); return 1.6; },
    p1(H, p) { const list = H.nearest(6, 45); p.play('cast', 0.4); for (let i = 0; i < 6; i++) H.later(i * 0.08, () => { const t = list[i % Math.max(1, list.length)]; const from = H.chest().add(V().set((Math.random() - 0.5) * 3, 1 + Math.random(), (Math.random() - 0.5) * 3)); H.shoot({ from, dir: V().set(0, 1, 0), speed: 24, r: 0.35, color: '#5fd0ff', dmg: 28, knock: 5, blast: 2, power: 1, kind: 'fire', homing: t && t.alive ? t : null, turn: 6, life: 3, trail: '#9fe8ff' }); }); return 6; },
    p2(H, p) { H.kitsuP2(); H.later(0.2, () => H.kitsuP2()); return 16; },
    p3(H, p) { const a = H.aim(30), dir = V().subVectors(a.point, p.pos).setY(0).normalize(); H.startMove('dash', { dir, speed: 55, T: 0.36, done: new Set(), anim: 'dash', hit: { dmg: 40, knock: 12, up: 3, kind: 'blunt', color: '#ffb347' }, r: 3.5, trail: (x, y) => G.fx.fire(y, 3, 1.5) }); return 4; },
    ult(H, p) { G.ui.flash('TAIL STORM', 1.2); for (let i = 0; i < 9; i++) H.later(0.1 + i * 0.12, () => { const a = p.yaw + (i / 9) * Math.PI * 2, c = V().set(p.pos.x + Math.sin(a) * 7, p.pos.y + 0.5, p.pos.z + Math.cos(a) * 7); G.fx.beam(V().set(c.x, c.y + 14, c.z), c, '#ffb347', 1.2, 0.25); H.ball(c, 5, { dmg: 60, knock: 14, up: 8, kind: 'blunt', color: '#ffb347', from: c }); G.fx.ring(c, '#ffb347', 0.5, 6, 0.4); G.fx.shake(0.15); }); return 0; },
  },
  forge: {
    light(H, p) { const m = this.model, side = (this.side = -(this.side || 1)); if (m) m.punch = { side, t: 0.3, T: 0.3 }; H.faceAim(0.4); H.later(0.1, () => { front(H, p, 3.4, 3.3, { dmg: 40, knock: 12, up: 3, kind: 'blunt', color: '#ffb347' }); H.trail(side > 0 ? 'R' : 'L', '#ffb347', 0.2, 0.2); }); return 0.32; },
    heavy(H, p) { if (this.model) this.model.stomp = 0.5; H.later(0.3, () => { const c = groundAhead(p, 2); H.ball(c, 7.5, { dmg: 48, up: 9, knock: 12, kind: 'blunt', color: '#ffb347' }); G.fx.ring(c, '#ffb347', 0.5, 9, 0.5); G.fx.dust(c, 30, 3); G.fx.shake(0.5); G.damage.burst(c, 7, 4, 'blunt', { byHero: true }); }); return 1.3; },
    p1(H, p) {
      const list = H.nearest(8, 70); H.faceAim(0.6);
      for (let i = 0; i < 24; i++) H.later(i * 0.05, () => { const pod = this.model ? this.model.pods[i % 2] : null, from = pod ? pod.getWorldPosition(V()).add(V().set(0, 0.3, 0)) : H.chest(); const t = list[i % Math.max(1, list.length)]; const up = V().set((Math.random() - 0.5) * 0.6, 1, (Math.random() - 0.5) * 0.6).normalize();
        H.shoot({ from, dir: up, speed: 30, r: 0.14, color: '#ffb347', dmg: 18, knock: 4, blast: 2.2, power: 1.2, kind: 'fire', homing: t && t.alive ? t : null, turn: 7, life: 3, trail: '#ff8a3c' }); if (!t) H.proj[H.proj.length - 1].target = H.aim(70).point; });
      return 9;
    },
    p2(H, p) {
      const m = this.model; if (m) m.firing = true; H.faceAim(2.6);
      // the rounds bend onto an enemy near the crosshair, like Forge's palm shots
      H.startChannel(2.4, 0.06, () => { const a = H.aim(90), arm = m ? m.arms[1].barrels.getWorldPosition(V()) : H.hand(), tg = H.airTarget ? H.airTarget(60, 0.94) : null; const d = V().subVectors(tg ? G.combat.centre(tg, V()) : a.point, arm).normalize(); d.x += (Math.random() - 0.5) * 0.05; d.y += (Math.random() - 0.5) * 0.05; d.z += (Math.random() - 0.5) * 0.05;
        H.shoot({ from: arm, dir: d.normalize(), speed: 95, r: 0.08, color: '#ffd34d', dmg: 9, knock: 0.8, kind: 'energy', life: 1.1 }); G.fx.spark(arm, '#ffd34d', 2, 3, 0.1, 0.08); }, { slow: 0.4, end: () => { if (m) m.firing = false; } });
      H.later(2.45, () => { if (m) m.firing = false; });
      return 7;
    },
    p3(H, p) { const a = H.aim(30), dir = V().subVectors(a.point, p.pos).setY(0).normalize(); H.startMove('dash', { dir, speed: 40, T: 0.5, done: new Set(), anim: 'dash', hit: { dmg: 45, knock: 20, up: 6, kind: 'blunt', color: '#ffb347' }, r: 3.2, trail: (x, y) => G.fx.spray(y, V().set(-dir.x, 0.2, -dir.z), '#ffb347', 3, 6, 0.4, 0.3, 0.5, 0.1) }); return 5; },
    ult(H, p) {
      const m = this.model; if (m) m.beaming = true; G.ui.flash('CORE CANNON', 1.2); H.faceAim(2.4);
      H.later(0.35, () => H.startChannel(2, 0.08, () => { const a = H.aim(90), from = m ? m.core.getWorldPosition(V()) : H.chest(); G.fx.beam(from, a.point.clone(), '#ffb347', 1.1, 0.1); G.fx.beam(from, a.point.clone(), '#ffffff', 0.4, 0.1); H.strike({ kind: 'capsule', a: from, b: a.point.clone(), r: 1.8 }, { dmg: 22, knock: 6, kind: 'energy', color: '#ffb347' }); if (Math.random() < 0.5) G.damage.impact(a.point.clone(), V().set(0, 1, 0), 3, 'energy', { byHero: true, quiet: true, color: '#ffb347' }); G.fx.shake(0.08); }, { slow: 0.2 }));
      H.later(2.4, () => { if (m) m.beaming = false; });
      return 0;
    },
  },
  bulwark: {
    light(H, p) { const k = (this.combo = ((this.combo || 0) + 1) % 3), an = ['punchR', 'punchL', 'smash'][k]; p.play(an, 0.36); H.faceAim(0.45); H.later(0.13, () => { front(H, p, 4.4, 4.6, { dmg: [36, 36, 55][k], knock: [14, 14, 22][k], up: [2, 2, 8][k], kind: 'blunt', color: '#7dff9c' }); H.trail(an === 'punchL' ? 'L' : 'R', '#7dff9c', 0.25, 0.25); G.fx.shake(0.12); }); return 0.4; },
    heavy(H, p) { p.play('smash', 0.55); H.faceAim(0.6); H.later(0.25, () => { const c = groundAhead(p, 5); H.ball(c, 8, { dmg: 75, up: 11, knock: 16, kind: 'blunt', color: '#7dff9c' }); G.damage.burst(c, 9, 5, 'blunt', { byHero: true }); G.fx.ring(c, '#7dff9c', 0.6, 11, 0.5); G.fx.dust(c, 40, 4); G.fx.shake(0.7); }); return 1.6; },
    p1(H, p) { p.play('raise', 0.5); H.faceAim(1); H.later(0.45, () => { p.play('throw', 0.4); if (throwCar(H, p, 16, 34, V().set(p.pos.x, p.pos.y + 7, p.pos.z))) G.ui.flash('CAR THROW', 0.7); }); return 4; },
    p2(H, p) { p.play('beam', 0.5); H.faceAim(0.6); H.later(0.15, () => { const c = waist(p), f = fwdOf(p); H.cone(28, 40, { dmg: 40, knock: 26, up: 5, stun: 2, kind: 'shock', color: '#ffffff' }, c, f); for (let i = 1; i <= 5; i++) H.later(i * 0.05, () => G.fx.ring(c.clone().addScaledVector(f, i * 5), '#ffffff', 1, 4 + i, 0.35, f)); G.fx.shake(0.4); }); return 6; },
    p3(H, p) {
      if (!p.grounded) return 0;
      const a = H.aim(150), to = a.point.clone(), g = 22 * (p.gravK || 1), dx = to.x - p.pos.x, dz = to.z - p.pos.z, dy = to.y - p.pos.y, T = clamp(Math.hypot(dx, dz) / 45, 1, 2.6);
      p.vel.set(dx / T, (dy + 0.5 * g * T * T) / T, dz / T); p.grounded = false; p.fling = 'leap'; p.play('air', T); this.landing = { r: 13, dmg: 65, up: 12, knock: 18, power: 6 };
      const c = V().set(p.pos.x, p.pos.y, p.pos.z); G.fx.dust(c, 30, 3); G.fx.ring(c, '#7dff9c', 0.5, 7, 0.4); G.fx.shake(0.4); return 5;
    },
    ult(H, p) {
      p.play('groundpound', 0.7); G.ui.flash('EARTHSPLITTER', 1.2); const f = fwdOf(p);
      for (let i = 0; i < 16; i++) H.later(0.3 + i * 0.05, () => { const q = groundAhead(p, 3 + i * 2.4); void f; H.ball(q, 3.6, { dmg: 55, up: 12, knock: 6, kind: 'blunt', color: '#7dff9c' }); G.damage.impact(q.clone(), V().set(0, 1, 0), 4, 'blunt', { byHero: true, quiet: i % 3 }); G.fx.dust(q, 12, 2); G.fx.spray(q, V().set(0, 1, 0), '#9a958b', 6, 9, 0.6, 0.8, 0.5, 0.3, 14); if (i % 4 === 0) G.fx.shake(0.25); });
      return 0;
    },
  },
  rook: {
    light(H, p) { const side = (this.side = -(this.side || 1)); p.play(side > 0 ? 'punchR' : 'punchL', 0.3); H.faceAim(0.4); H.later(0.08, () => { const from = side > 0 ? H.hand() : H.handL(), a = H.aim(11), to = from.clone().add(V().subVectors(a.point, from).setLength(Math.min(10, a.point.distanceTo(from)))); G.fx.beam(from, to, '#e0ac7e', 0.55, 0.16, false); G.fx.blast(to, '#f08a24', 0.3, 1.6, 0.2); H.strike({ kind: 'capsule', a: from, b: to, r: 1.2 }, { dmg: 30, knock: 14, up: 2, kind: 'blunt', color: '#f08a24' }); }); return 0.34; },
    heavy(H, p) { if (!p.grounded) return 0; p.vel.y = 16; p.grounded = false; p.play('backflip', 0.8); this.landing = { r: 9, dmg: 60, up: 10, knock: 16, power: 4.5 }; return 1.6; },
    p1(H, p) { H.faceAim(1.8); p.play('punchR', 1.6); H.startChannel(1.6, 0.07, () => { const c = H.chest(), f = H.fwd(V(), 0.2), side = V().set(f.z, 0, -f.x), to = c.clone().addScaledVector(f, 6 + Math.random() * 4).addScaledVector(side, (Math.random() - 0.5) * 4); to.y += (Math.random() - 0.5) * 2; G.fx.beam(c.clone().addScaledVector(side, Math.random() < 0.5 ? 1 : -1), to, '#e0ac7e', 0.4, 0.08, false); H.cone(10, 28, { dmg: 7, knock: 3, kind: 'blunt', color: '#f08a24' }, waist(p), fwdOf(p)); }, { slow: 0.3 }); return 6; },
    p2(H, p) { p.play('spin', 0.7); H.later(0.25, () => { const c = H.centre(); H.ball(c, 9, { dmg: 40, knock: 22, up: 6, kind: 'blunt', color: '#f08a24' }); G.fx.ring(c, '#f08a24', 1, 10, 0.4); throwCar(H, p, 14, 32, V().set(p.pos.x, p.pos.y + 5, p.pos.z)); }); return 5; },
    p3(H, p) { this.boost = 8; H.applyStats(); G.ui.flash('OVERDRIVE', 0.8); G.fx.smoke(H.centre(), 20, '#e8eef4', 2.5, 2.5); return 14; },
    ult(H, p) {
      const a = H.aim(90), at = a.point.clone(); G.ui.flash('TITAN FIST', 1.2); p.play('raise', 1.1);
      const orb = G.fx.orb('#f08a24', 4), top = at.clone().add(V().set(0, 60, 0));
      for (let i = 0; i <= 20; i++) H.later(i * 0.05, () => { orb.p.copy(top).lerp(at, (i / 20) ** 2); G.fx.spray(orb.p, V().set(0, 1, 0), '#ffd34d', 4, 6, 0.6, 0.4, 1.5, 0.3); });
      H.later(1.05, () => { orb.life = 0; H.ball(at, 11, { dmg: 120, knock: 22, up: 10, kind: 'blunt', color: '#f08a24', from: at }); G.damage.burst(at, 11, 6, 'blunt', { byHero: true }); G.fx.blast(at, '#f08a24', 1, 11, 0.6); G.fx.ring(at, '#ffd34d', 1, 16, 0.7); G.fx.dust(at, 50, 5); G.fx.shake(0.9); });
      return 0;
    },
  },
  sable: {
    light(H, p) { const k = (this.combo = ((this.combo || 0) + 1) % 3); this.lunge = 0.3; H.faceAim(0.4); H.later(0.1, () => { const c = H.chest(), f = H.fwd(V(), 0.1), side = V().set(f.z, 0, -f.x); front(H, p, 2.8, 3.2, { dmg: [24, 24, 36][k], knock: [6, 6, 14][k], up: k === 2 ? 5 : 1, kind: 'cut', color: '#ff5a6e' }); for (let j = -1; j <= 1; j++) { const a = c.clone().addScaledVector(f, 2).addScaledVector(side, -2 + j * 0.4); a.y += 1; const b = c.clone().addScaledVector(f, 3).addScaledVector(side, 2 + j * 0.4); b.y -= 1; G.fx.beam(a, b, '#ff5a6e', 0.12, 0.25); } }); return 0.3; },
    heavy(H, p) {
      const t = H.nearest(1, 20).find((q) => !q.flying); if (!p.grounded) return 0;
      const to = t ? t.pos.clone() : H.aim(20).point.clone(), dx = to.x - p.pos.x, dz = to.z - p.pos.z, T = 0.6, g = 22 * (p.gravK || 1);
      p.vel.set(dx / T, (to.y - p.pos.y + 0.5 * g * T * T) / T, dz / T); p.grounded = false; p.fling = 'leap'; this.lunge = 0.6; this.landing = { r: 4.5, dmg: 55, up: 4, knock: 10, stun: 1.2, power: 2 }; return 1.4;
    },
    p1(H, p) { this.howlT = 1; H.later(0.2, () => { const c = H.centre(); H.ball(c, 15, { dmg: 15, stun: 2.5, knock: 4, kind: 'shock', color: '#ff5a6e', civ: false }); for (let i = 0; i < 3; i++) H.later(i * 0.12, () => G.fx.ring(c, '#ff5a6e', 1, 15 + i * 3, 0.5)); G.fx.shake(0.3); }); return 8; },
    p2(H, p) { H.sableP2(); H.later(0.3, () => H.sableP2()); G.ui.flash('THE PACK', 0.8); return 16; },
    p3(H, p) { const a = H.aim(30), dir = V().subVectors(a.point, p.pos).setY(0).normalize(); this.lunge = 0.5; H.startMove('dash', { dir, speed: 45, T: 0.4, done: new Set(), anim: 'dash', hit: { dmg: 35, knock: 10, up: 2, kind: 'cut', color: '#ff5a6e' }, r: 2.6, trail: (x, y) => G.fx.smoke(y, 1, '#2a1018', 1.5, 0.6) }); return 4; },
    ult(H, p) {
      const t = H.nearest(1, 25)[0]; G.ui.flash('MOONFANG', 1.1); if (!t) return 0;
      for (let i = 0; i < 5; i++) H.later(i * 0.24, () => { if (!t.alive) return; const dx = t.pos.x - p.pos.x, dz = t.pos.z - p.pos.z, d = Math.hypot(dx, dz) || 1; if (d > 3) { p.pos.x += dx / d * (d - 2.5); p.pos.z += dz / d * (d - 2.5); } p.yaw = Math.atan2(dx, dz); this.lunge = 0.3; G.combat.hitTarget(t, V().set(dx / d, 0, dz / d), { dmg: 45, stun: 0.8, knock: i === 4 ? 25 : 2, up: i === 4 ? 10 : 0, kind: 'cut', color: '#ff5a6e', byHero: true }); G.fx.spark(G.combat.centre(t, V()), '#ff5a6e', 14, 6, 0.35, 0.14); });
      return 0;
    },
  },
};
