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
    this.on = null; this.seq = null; this.armour = 0; this.k = 0;
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
  stats() { const F = this.form, k = this.k; if (!F || k <= 0) return null; const boost = this.boost > 0 ? 1.6 : 1; return { sc: this.scale(), sp: (1 + (F.speed - 1) * k) * boost, jv: 8 + (F.jump - 8) * k, ck: 1 + (F.cam - 1) * k }; }
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
