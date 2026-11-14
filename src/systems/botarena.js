// Bot Arena at the Industrial Nexus: a sumo ring for remote-driven robots. At the driver's booth
// you enter the Bot Arena Cup: a quarter-final, a semi-final and a final, each the best of three
// rounds. Shove the other bot off the platform. A bot that meets the other with its plough lifts
// it, and a lifted bot has little grip. Upgrades between matches at the same booth.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { clamp, dampAngle } from '../core/util.js';
import { std, neon, labelTexture } from '../world/materials.js';
import { mergeMeshes } from '../world/batch.js';
import { money } from '../ui/ui.js';

const RING = 7.5, BR = 0.95, TOP = 1.0, ROUND_T = 30;
const ROSTER = [
  { name: 'Rustbucket', hex: '#b8643a', tier: 0, power: 0.8, mass: 1.0, boost: 0.85, wedge: false, aim: 0.45 },
  { name: 'Pebble', hex: '#8fa3b8', tier: 0, power: 0.86, mass: 0.85, boost: 1.0, wedge: false, aim: 0.55 },
  { name: 'Clank', hex: '#d9b23a', tier: 0, power: 0.88, mass: 1.1, boost: 0.9, wedge: false, aim: 0.5 },
  { name: 'Ferrous Wheel', hex: '#3f8f6a', tier: 1, power: 1.0, mass: 1.1, boost: 1.0, wedge: true, aim: 0.72 },
  { name: 'Viper', hex: '#5ad16a', tier: 1, power: 1.05, mass: 0.95, boost: 1.15, wedge: true, aim: 0.78 },
  { name: 'Hammerhead', hex: '#6b4fa0', tier: 1, power: 0.98, mass: 1.3, boost: 1.0, wedge: false, aim: 0.72 },
  { name: 'Overclock', hex: '#ff3d5a', tier: 2, power: 1.12, mass: 1.2, boost: 1.15, wedge: true, aim: 0.9 },
];
const STAGES = ['Quarter-final', 'Semi-final', 'Final'], PRIZE = [150, 350, 900], ENTRY = 120;
const UPGRADES = [['motor', 'Motor', '+8% push and top speed per stage'], ['armor', 'Ballast plate', '+15% weight per stage: harder to shove'], ['boost', 'Ram capacitor', 'A harder ram that recharges sooner']];
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

function makeBot(spec) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const paint = std(spec.hex, 0.45, 0.5), dark = std('#20242b', 0.5, 0.7), steel = std('#aeb6c2', 0.35, 0.8);
  const add = (geo, mat, x, y, z, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); m.castShadow = true; body.add(m); return m; };
  add(new THREE.BoxGeometry(1.3, 0.42, 1.45), paint, 0, 0.45, -0.05);
  add(new THREE.BoxGeometry(0.62, 0.3, 0.5), dark, 0, 0.8, -0.25);
  if (spec.wedge) add(new THREE.BoxGeometry(1.4, 0.06, 0.85), steel, 0, 0.3, 0.95, 0.4);              // the plough, sloping down at the front
  else add(new THREE.BoxGeometry(1.42, 0.36, 0.14), steel, 0, 0.42, 0.74);                              // a flat ram
  if (spec.mass > 1.15) for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.08, 0.36, 1.2), steel, s * 0.7, 0.48, -0.05);   // side armour on the heavy ones
  const eye = add(new THREE.BoxGeometry(0.5, 0.07, 0.04), neon(spec.hex, 2.2), 0, 0.84, 0.0);
  const wheels = [];
  for (const [x, z] of [[-0.72, 0.42], [0.72, 0.42], [-0.72, -0.5], [0.72, -0.5]]) wheels.push(add(new THREE.CylinderGeometry(0.26, 0.26, 0.16, 12), dark, x, 0.26, z, 0, Math.PI / 2));
  return { spec, g, body, wheels, eye, x: 0, z: 0, y: TOP, vy: 0, yaw: 0, vx: 0, vz: 0, cd: 0, ramT: 0, wedged: 0, out: false, think: 0, cmd: { thr: 0, steer: 0, ram: false } };
}

export class BotArena {
  constructor() {
    const X = G.districts.byId.nexus, ax = (this.ax = X.x - 52), az = (this.az = X.z - 22), col = G.colliders;
    const grp = (this.group = new THREE.Group()); grp.position.set(ax, 0, az); G.scene.add(grp);
    const parts = [], put = (geo, mat, x, y, z, ry = 0, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = cast; m.receiveShadow = true; grp.add(m); parts.push(m); return m; };
    const floor = std('#1d2027', 0.85, 0.2), steel = std('#5a616c', 0.45, 0.7), dark = std('#2b303a', 0.6, 0.5), yellow = neon('#ffd34d', 1.2), glass = new THREE.MeshStandardMaterial({ color: '#9fd4ff', roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.25, depthWrite: false });
    put(new THREE.CylinderGeometry(18.5, 18.5, 0.08, 40), floor, 0, 0.04, 0, 0, false);
    put(new THREE.CylinderGeometry(RING, RING + 0.4, TOP, 40), steel, 0, TOP / 2, 0);
    const edge = put(new THREE.RingGeometry(RING - 0.45, RING, 48), yellow, 0, TOP + 0.01, 0, 0, false); edge.rotation.x = -Math.PI / 2;
    const mid = put(new THREE.RingGeometry(1.1, 1.25, 32), neon('#59e0ff', 1), 0, TOP + 0.01, 0, 0, false); mid.rotation.x = -Math.PI / 2;
    for (const s of [-1, 1]) put(new THREE.BoxGeometry(1.6, 0.02, 0.12), neon(s > 0 ? '#59e0ff' : '#ff3d5a', 1.2), 0, TOP + 0.015, s * 4.9, 0, false);
    for (const [w, d] of [[7.2, 3], [3, 7.2], [5.4, 5.4]]) col.box(ax - w, ax + w, 0, TOP, az - d, az + d);
    // a glass barrier round the ring
    for (let k = 0; k < 20; k++) {
      const a = (k / 20) * Math.PI * 2, x = Math.sin(a) * 11, z = Math.cos(a) * 11, len = 3.4;
      put(new THREE.BoxGeometry(len, 1.25, 0.06), glass, x, 0.7, z, a, false); put(new THREE.BoxGeometry(len, 0.08, 0.12), dark, x, 1.35, z, a, false);
      const hx = Math.abs(Math.cos(a)) * len / 2 + 0.1, hz = Math.abs(Math.sin(a)) * len / 2 + 0.1; col.box(ax + x - hx, ax + x + hx, 0, 1.35, az + z - hz, az + z + hz, { noCam: true });
    }
    // stands east and west
    this.seats = [];
    for (const s of [-1, 1]) for (let t = 0; t < 3; t++) {
      const x = s * (13.6 + t * 1.15), y = 0.45 + t * 0.5;
      put(new THREE.BoxGeometry(1.15, y, 16), t % 2 ? dark : steel, x, y / 2, 0); col.box(ax + x - 0.58, ax + x + 0.58, 0, y, az - 8, az + 8, { noCam: true });
      for (let z = -7; z <= 7; z += 1.4) this.seats.push({ x: ax + x, y, z: az + z, yaw: s > 0 ? -Math.PI / 2 : Math.PI / 2 });
    }
    // the driver's booth on the south side, light masts, the scoreboard to the north
    put(new THREE.BoxGeometry(2.4, 1.05, 0.9), dark, 0, 0.53, 13.4); put(new THREE.BoxGeometry(2.2, 0.06, 0.7), neon('#7dff9c', 0.9), 0, 1.08, 13.3, 0, false);
    col.box(ax - 1.2, ax + 1.2, 0, 1.05, az + 12.95, az + 13.85, { noCam: true });
    for (const [x, z] of [[-14, -14], [14, -14], [-14, 14], [14, 14]]) { put(new THREE.BoxGeometry(0.35, 12, 0.35), dark, x, 6, z); put(new THREE.BoxGeometry(1.6, 0.5, 0.9), neon('#eaf6ff', 2), x, 12, z, Math.atan2(-x, -z), false); col.box(ax + x - 0.2, ax + x + 0.2, 0, 12, az + z - 0.2, az + z + 0.2, { noCam: true }); }
    put(new THREE.BoxGeometry(9.2, 4.8, 0.4), dark, 0, 6.2, -15); for (const x of [-4, 4]) { put(new THREE.BoxGeometry(0.3, 4, 0.3), dark, x, 2, -15); col.box(ax + x - 0.2, ax + x + 0.2, 0, 8.6, az - 15.3, az - 14.7, { noCam: true }); }
    mergeMeshes(grp, parts);
    const cv = (this.cv = document.createElement('canvas')); cv.width = 512; cv.height = 256; this.tex = new THREE.CanvasTexture(cv); this.tex.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 4.3), new THREE.MeshBasicMaterial({ map: this.tex })); screen.position.set(0, 6.2, -14.78); grp.add(screen);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.2), new THREE.MeshBasicMaterial({ map: labelTexture('BOT ARENA', { size: 70, color: '#ffd9a0', sub: 'robot sumo · the Bot Arena Cup' }), transparent: true, side: THREE.DoubleSide }));
    sign.position.set(0, 9.9, -15); grp.add(sign);
    // two idle bots on the platform when nobody is fighting
    this.me = null; this.foe = null; this.idle = [makeBot(ROSTER[3]), makeBot(ROSTER[6])];
    this.idle.forEach((b, i) => { b.g.position.set(i ? 2.2 : -2.2, TOP, i ? -1 : 1.4); b.g.rotation.y = i ? -2.4 : 0.8; grp.add(b.g); });
    this.booth = { x: ax, y: 0, z: az + 14.6 };
    G.interact.add({ pos: this.booth, r: 2.6, label: 'Bot Arena Cup: enter or upgrade your bot', enabled: () => !G.minigame && !this.cup, use: () => this.menu() });
    this.cup = null; this.camYaw = Math.PI; this.drawBoard();
  }
  get st() { const s = G.state; if (!s.bot) s.bot = { motor: 0, armor: 0, boost: 0 }; return s.bot; }
  mySpec() { const u = this.st; return { name: `${G.state.name}'s bot`, hex: '#59e0ff', power: 1 + 0.08 * u.motor, mass: 1 + 0.15 * u.armor, boost: 1 + 0.1 * u.boost, wedge: true, aim: 1 }; }
  menu() {
    const u = this.st, won = G.state.best.botcup || 0;
    G.ui.openMenu({ title: 'Bot Arena Cup', who: 'Industrial Nexus · robot sumo', body: `Three matches, each the best of three rounds: push the other bot off the platform. W/S drive, A/D turn, Space rams (it recharges). Your plough lifts a bot you meet head on, and a lifted bot slides. Prize money ${money(PRIZE[0])}, ${money(PRIZE[1])} and ${money(PRIZE[2])} for the three wins.${won ? ` You have won the cup ${won} time${won > 1 ? 's' : ''}.` : ''}<br><br>Your bot: motor stage ${u.motor}, ballast ${u.armor}, capacitor ${u.boost}.`,
      options: [
        { label: 'Enter the cup', desc: 'Quarter-final first', price: ENTRY, onPick: () => { if (G.economy.spend(ENTRY, 'Bot Arena Cup entry')) this.startCup(); } },
        { label: 'Workshop', desc: 'Upgrade your bot', onPick: () => this.workshop() },
        { label: 'Close', onPick: () => {} },
      ] });
  }
  workshop(then) {
    const u = this.st;
    G.ui.openMenu({ title: 'Bot workshop', who: 'Three stages per part', options: [
      ...UPGRADES.map(([k, name, desc]) => ({ label: `${name}: stage ${u[k]} of 3`, desc, price: u[k] < 3 ? 250 * (u[k] + 1) : undefined, disabled: u[k] >= 3, why: 'Fully upgraded.', onPick: () => { if (G.economy.spend(250 * (u[k] + 1), `bot ${name.toLowerCase()}`)) { u[k]++; if (this.me) this.me.spec = { ...this.mySpec() }; G.save.write(true); } this.workshop(then); } })),
      { label: then ? 'Back' : 'Done', onPick: () => { if (then) then(); } }] });
  }
  // ---- the cup ---------------------------------------------------------------------------------------------------
  startCup() {
    const p = G.player; if (p.state !== 'walk') return;
    p.state = 'busy'; p.busyAnim = 'phone'; p.faceCam = false; p.board = false; p.jet = false; p.crouch = false; p.vel.set(0, 0, 0);
    p.pos.set(this.booth.x, 0.06, this.booth.z); p.yaw = Math.PI; G.minigame = 'bots';
    for (const b of this.idle) b.g.visible = false;
    const pick = (tier) => { const l = ROSTER.filter((r) => r.tier === tier); return l[Math.floor(Math.random() * l.length)]; };
    this.cup = { stage: 0, opps: [pick(0), pick(1), ROSTER[6]], wins: 0, losses: 0, phase: 'count', t: 3, rt: 0, beat: 0 };
    this.me = makeBot(this.mySpec()); this.group.add(this.me.g);
    this.startMatch();
  }
  // a single match outside the cup (the story uses it): free, no prizes; done(won) is called at the end
  exhibition(name, done) {
    const p = G.player; if (p.state !== 'walk' || this.cup || G.minigame) return false;
    p.state = 'busy'; p.busyAnim = 'phone'; p.faceCam = false; p.board = false; p.jet = false; p.crouch = false; p.vel.set(0, 0, 0);
    p.pos.set(this.booth.x, 0.06, this.booth.z); p.yaw = Math.PI; G.minigame = 'bots';
    for (const b of this.idle) b.g.visible = false;
    this.cup = { stage: 0, opps: [ROSTER.find((r) => r.name === name) || ROSTER[2]], wins: 0, losses: 0, phase: 'count', t: 3, rt: 0, beat: 0, exhibition: done };
    this.me = makeBot(this.mySpec()); this.group.add(this.me.g);
    this.startMatch(); return true;
  }
  startMatch() {
    const c = this.cup; c.wins = 0; c.losses = 0;
    if (this.foe) this.foe.g.removeFromParent();
    this.foe = makeBot(c.opps[c.stage]); this.group.add(this.foe.g);
    G.ui.toast(`${(c.exhibition ? 'Exhibition' : STAGES[c.stage])}: ${this.foe.spec.name}. W/S drive, A/D turn, Space rams. F forfeits.`, 'info');
    this.startRound();
  }
  startRound() {
    const c = this.cup;
    for (const [b, z, yaw] of [[this.me, 4.2, Math.PI], [this.foe, -4.2, 0]]) { b.x = 0; b.z = z; b.y = TOP; b.vy = 0; b.yaw = yaw; b.vx = b.vz = 0; b.cd = 0.8; b.ramT = 0; b.wedged = 0; b.out = false; b.body.rotation.set(0, 0, 0); }
    c.phase = 'count'; c.t = 3; c.rt = 0; c.beat = 2; this.camYaw = Math.PI; this.drawBoard(); G.ui.flash('3', 0.7); if (G.audio) G.audio.blip(520, 0.06);
  }
  endCup(msg) {
    const p = G.player, c = this.cup; this.cup = null; G.minigame = null;
    for (const b of [this.me, this.foe]) if (b) b.g.removeFromParent();
    this.me = this.foe = null; for (const b of this.idle) b.g.visible = true;
    if (p.state === 'busy') p.state = 'walk'; p.busyAnim = null; G.ui.setObjective(null); G.ui.cool = 0.3;
    if (msg) G.ui.toast(msg, c && c.champion ? 'good' : 'info'); this.drawBoard(); G.save.write(true);
  }
  matchOver(won) {
    const c = this.cup, s = G.state;
    if (c.exhibition) { const done = c.exhibition; G.ui.flash(won ? 'YOU WIN' : 'YOU LOSE', 2.2); this.endCup(null); return done(won); }
    if (!won) { G.ui.flash('KNOCKED OUT', 2.4); return this.endCup(`${this.foe.spec.name} knocks you out in the ${(c.exhibition ? 'Exhibition' : STAGES[c.stage]).toLowerCase()}. The workshop at the booth can make your bot heavier and stronger.`); }
    G.economy.earn(PRIZE[c.stage], `Bot Arena ${(c.exhibition ? 'Exhibition' : STAGES[c.stage]).toLowerCase()}`); if (G.audio) { G.audio.blip(880, 0.12); G.audio.blip(1320, 0.1); }
    if (c.stage === 2) { c.champion = true; s.best.botcup = (s.best.botcup || 0) + 1; s.done.botcup = true; G.ui.flash('CUP CHAMPION', 3.2); return this.endCup(`You beat ${this.foe.spec.name} and win the Bot Arena Cup.`); }
    G.ui.flash(`${(c.exhibition ? 'Exhibition' : STAGES[c.stage]).toUpperCase()} WON`, 2.2); c.stage++; c.phase = 'between';
    const next = () => G.ui.openMenu({ title: `Next: the ${(c.exhibition ? 'Exhibition' : STAGES[c.stage]).toLowerCase()}`, who: `Against ${c.opps[c.stage].name}`, noClose: true, body: `${c.opps[c.stage].name} is ${c.opps[c.stage].mass > 1.15 ? 'heavy' : c.opps[c.stage].power > 1.04 ? 'fast and strong' : 'quick'}${c.opps[c.stage].wedge ? ' and has a plough' : ''}. You can upgrade your bot before the match.`,
      options: [{ label: 'Start the match', onPick: () => this.startMatch() }, { label: 'Workshop', onPick: () => this.workshop(next) }, { label: 'Withdraw from the cup', onPick: () => this.endCup('You withdraw from the cup and keep your prize money.') }] });
    next();
  }
  // ---- driving -----------------------------------------------------------------------------------------------------
  drive(b, c, dt) {
    const s = b.spec, wed = b.wedged > 0;
    b.yaw += c.steer * (wed ? 1.3 : 2.7) * dt;
    const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), rx = fz, rz = -fx, acc = (c.thr * 9.5 * s.power) / Math.sqrt(s.mass);
    b.vx += fx * acc * dt; b.vz += fz * acc * dt;
    let vf = b.vx * fx + b.vz * fz, vl = b.vx * rx + b.vz * rz;
    vf *= Math.exp(-1.7 * dt); vl *= Math.exp(-(wed ? 1.1 : 7) * dt);
    b.vx = fx * vf + rx * vl; b.vz = fz * vf + rz * vl;
    b.cd -= dt; b.ramT -= dt; b.wedged -= dt;
    if (c.ram && b.cd <= 0) { const k = 4.6 * s.boost; b.vx += fx * k; b.vz += fz * k; b.cd = 2.6 / s.boost; b.ramT = 0.35; if (G.audio) G.audio.blip(160, 0.06); }
    b.x += b.vx * dt; b.z += b.vz * dt;
    for (const w of b.wheels) w.rotation.x += vf * dt * 3.8;
  }
  collide(A, B) {
    const dx = A.x - B.x, dz = A.z - B.z, d = Math.hypot(dx, dz), m = 2 * BR;
    if (d >= m || d < 1e-4 || A.out || B.out) return;
    const nx = dx / d, nz = dz / d, ma = A.spec.mass, mb = B.spec.mass, ov = m - d, sum = ma + mb;
    A.x += (nx * ov * mb) / sum; A.z += (nz * ov * mb) / sum; B.x -= (nx * ov * ma) / sum; B.z -= (nz * ov * ma) / sum;
    const vr = (A.vx - B.vx) * nx + (A.vz - B.vz) * nz;
    if (vr < 0) {
      const j = (-1.25 * vr) / (1 / ma + 1 / mb); A.vx += (j / ma) * nx; A.vz += (j / ma) * nz; B.vx -= (j / mb) * nx; B.vz -= (j / mb) * nz;
      if (vr < -2 && G.audio) G.audio.blip(90 + Math.random() * 40, Math.min(0.14, -vr * 0.02));
    }
    // the bot that meets the other more squarely gets its front under it and lifts it (a plough for longer);
    // nose to nose, neither is lifted and it is a straight shove: motor against weight
    const fa = Math.sin(A.yaw) * -nx + Math.cos(A.yaw) * -nz, fb = Math.sin(B.yaw) * nx + Math.cos(B.yaw) * nz;
    if (fa > 0.72 && fa > fb + 0.2) B.wedged = Math.max(B.wedged, A.spec.wedge ? 0.55 : 0.25);
    else if (fb > 0.72 && fb > fa + 0.2) A.wedged = Math.max(A.wedged, B.spec.wedge ? 0.55 : 0.25);
  }
  ai(b, o, dt) {
    const s = b.spec;
    b.think -= dt;
    if (b.think <= 0) {
      b.think = 0.1 + (1 - s.aim) * 0.35;
      const tx = o.x + o.vx * 0.35, tz = o.z + o.vz * 0.35, dist = Math.hypot(o.x - b.x, o.z - b.z), r = Math.hypot(b.x, b.z);
      let want = Math.atan2(tx - b.x, tz - b.z);
      // near the edge and heading out: turn back toward the middle
      if (r > RING - 2.3) { const toC = Math.atan2(-b.x, -b.z); if ((b.vx * b.x + b.vz * b.z) / r > 0.8 || Math.cos(want - toC) < -0.2) want = toC; }
      // a ram coming straight at it: the better bots sidestep
      if (o.ramT > 0 && Math.sin(o.yaw) * (b.x - o.x) + Math.cos(o.yaw) * (b.z - o.z) > dist * 0.9 && Math.random() < s.aim * 0.5) want = o.yaw + Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1);
      const err = wrap(want - b.yaw);
      b.cmd.steer = clamp(err * 2.4, -1, 1); b.cmd.thr = Math.cos(err) > 0.4 ? 1 : Math.cos(err) > -0.2 ? 0.45 : -0.3;
      b.cmd.ram = Math.abs(err) < 0.22 && dist < 4.2 && Math.random() < s.aim * 0.7;
    } else b.cmd.ram = false;
    return b.cmd;
  }
  place(b) {
    b.g.position.set(b.x, b.y, b.z); b.g.rotation.y = b.yaw;
    const lift = b.wedged > 0 && !b.out ? 0.12 : 0; b.body.position.y = lift; b.body.rotation.x = b.out ? Math.min(1.2, (TOP - b.y) * 0.8) : -lift * 1.2;
    b.eye.material.color.setScalar(b.cd > 0 ? 0.35 : 1);
  }
  update(dt) {
    const near = (G.camera.position.x - this.ax) ** 2 + (G.camera.position.z - this.az) ** 2 < 520 * 520; this.group.visible = near;
    const c = this.cup; if (!c) return;
    const inp = G.input, p = G.player, me = this.me, foe = this.foe;
    if (p.state !== 'busy') return this.endCup(null);
    if ((inp.pressed('KeyF') || inp.pressed('Escape')) && c.phase !== 'between' && !G.ui.menu) return this.endCup('You forfeit the cup.');
    if (c.phase === 'count') {
      c.t -= dt; if (c.beat > 0 && c.t <= c.beat) { G.ui.flash(String(c.beat), 0.7); c.beat--; if (G.audio) G.audio.blip(520, 0.06); }
      if (c.t <= 0) { c.phase = 'fight'; G.ui.flash('FIGHT', 0.8); if (G.audio) G.audio.blip(980, 0.1); }
    } else if (c.phase === 'fight' || c.phase === 'over') {
      const mine = c.phase === 'fight' && !me.out ? { thr: (inp.down('KeyW') ? 1 : 0) - (inp.down('KeyS') ? 1 : 0), steer: (inp.down('KeyA') ? 1 : 0) - (inp.down('KeyD') ? 1 : 0), ram: inp.pressed('Space') } : { thr: 0, steer: 0, ram: false };
      const theirs = c.phase === 'fight' && !foe.out ? this.ai(foe, me, dt) : { thr: 0, steer: 0, ram: false };
      for (let k = 0; k < 3; k++) { this.drive(me, mine, dt / 3); this.drive(foe, theirs, dt / 3); this.collide(me, foe); }
      for (const b of [me, foe]) {
        if (!b.out && Math.hypot(b.x, b.z) > RING + 0.15) { b.out = true; b.vy = 0; if (G.audio) G.audio.blip(120, 0.12); }
        if (b.out) { b.vy -= 18 * dt; b.y = Math.max(0.06, b.y + b.vy * dt); b.vx *= Math.exp(-2 * dt); b.vz *= Math.exp(-2 * dt); }
      }
      if (c.phase === 'fight') {
        c.rt += dt;
        let win = me.out ? 'foe' : foe.out ? 'me' : null;
        if (!win && c.rt > ROUND_T) win = Math.hypot(me.x, me.z) <= Math.hypot(foe.x, foe.z) ? 'me' : 'foe';
        if (win) { c.phase = 'over'; c.t = 1.8; c.win = win; if (win === 'me') c.wins++; else c.losses++; G.ui.flash(win === 'me' ? 'ROUND WON' : 'ROUND LOST', 1.4); this.cheer = 2.5; this.drawBoard(); }
      } else {
        c.t -= dt;
        if (c.t <= 0) { if (c.wins >= 2) return this.matchOver(true); if (c.losses >= 2) return this.matchOver(false); this.startRound(); }
      }
    }
    if (this.cheer > 0) this.cheer -= dt;
    this.place(me); this.place(foe);
    // a chase camera behind your bot
    const cam = G.camera; this.camYaw = dampAngle(this.camYaw, me.out ? this.camYaw : me.yaw, 4, dt);
    const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw), bx = this.ax + me.x, bz = this.az + me.z;
    cam.up.set(0, 1, 0); cam.position.set(bx - fx * 6.4, TOP + 4.4, bz - fz * 6.4); cam.lookAt(bx + fx * 2.5, TOP + 0.4, bz + fz * 2.5);
    this.boardT = (this.boardT || 0) - dt; if (this.boardT <= 0) { this.boardT = 0.25; this.drawBoard(); }
    const left = c.phase === 'fight' ? Math.max(0, ROUND_T - c.rt) : ROUND_T;
    if (c.phase !== 'between') G.ui.setObjective({ title: `Bot Arena Cup · ${(c.exhibition ? 'Exhibition' : STAGES[c.stage])}`, text: `You ${c.wins} – ${c.losses} ${foe.spec.name} · ${Math.ceil(left)} s`, sub: `W/S drive · A/D turn · Space ram ${me.cd > 0 ? '(charging)' : '(ready)'} · F forfeits` });
  }
  drawBoard() {
    const g = this.cv.getContext('2d'), c = this.cup;
    g.fillStyle = '#0b0e14'; g.fillRect(0, 0, 512, 256); g.textAlign = 'center';
    g.fillStyle = '#ffd34d'; g.font = 'bold 34px sans-serif'; g.fillText('BOT ARENA CUP', 256, 46);
    if (!c) { g.fillStyle = '#9fb3c8'; g.font = '24px sans-serif'; g.fillText('Enter at the driver\'s booth', 256, 120); g.fillText(`Champion: ${G.state && G.state.best.botcup ? G.state.name : 'Overclock'}`, 256, 170); }
    else {
      const foe = this.foe; g.fillStyle = '#cfe9ff'; g.font = '24px sans-serif'; g.fillText((c.exhibition ? 'Exhibition' : STAGES[c.stage]).toUpperCase(), 256, 86);
      g.font = 'bold 30px sans-serif'; g.fillStyle = '#59e0ff'; g.fillText('YOU', 128, 140); g.fillStyle = foe ? foe.spec.hex : '#fff'; g.fillText(foe ? foe.spec.name.toUpperCase() : '', 384, 140);
      g.font = 'bold 64px sans-serif'; g.fillStyle = '#fff'; g.fillText(`${c.wins}  –  ${c.losses}`, 256, 215);
      if (c.phase === 'fight') { g.font = '22px sans-serif'; g.fillStyle = '#9fb3c8'; g.fillText(`${Math.ceil(Math.max(0, ROUND_T - c.rt))} s`, 256, 246); }
    }
    this.tex.needsUpdate = true;
  }
  // spectators: a full house during the cup, a few in the evening
  figures(A, focus) {
    if (!this.group.visible || (focus.x - this.ax) ** 2 + (focus.z - this.az) ** 2 > 140 * 140) return;
    const h = G.env.hour, n = this.cup ? this.seats.length : h >= 18 && h < 23 ? 10 : 0;
    for (let k = 0; k < n; k++) {
      const s = this.seats[(k * 7) % this.seats.length], cheer = this.cheer > 0 && k % 3 !== 0;
      A.put('bot' + k, s.x, cheer ? s.y : s.y - 0.45, s.z, s.yaw, k * 5 + 2, cheer ? 'wave' : 'sit', k, focus);   // they stand up to cheer
    }
  }
}
