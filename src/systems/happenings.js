// What happens in the new parts of the city during the week: live music at the Grand Arbor Park
// amphitheatre (Wednesday to Sunday evenings), fireworks over Solara Bay (Friday and Saturday
// nights) and a market on a Midtown plaza (Saturday and Sunday). The game starts on a Friday.
// Each event draws its own crowd through the passers-by (entities/ambient.js).
import * as THREE from 'three';
import { G } from '../core/game.js';
import { RNG, clamp, fmtClock } from '../core/util.js';
import { M, makeCanvas, canvasTex } from '../world/materials.js';
import { Builder } from '../world/metro/builder.js';
import { makeHumanoid, animateRig, varyLook, SKINS, HAIRS } from '../entities/rigs.js';
import { streetName } from '../world/metro/buildings.js';

export const DAYS = ['Friday', 'Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
export const weekday = (day) => DAYS[(((day - 1) % 7) + 7) % 7];
const TAU = Math.PI * 2;

// The market's stalls: name, colour, goods. Goods: { label, price, food | eat+mins | decor | act, desc }
const STALLS = [
  ['STREET TACOS', '#ff9a52', [{ label: 'Two fish tacos, eaten standing', price: 9, eat: 30, mins: 10 }, { label: 'Horchata to go', price: 4, food: { name: 'Horchata', energy: 8 } }]],
  ['FRESH FRUIT', '#7dff9c', [{ label: 'Bag of peaches', price: 5, food: { name: 'Peaches', energy: 16 } }, { label: 'Printed mango, sliced', price: 6, eat: 12, mins: 5 }]],
  ['VINTAGE VINYL', '#ff7ad9', [{ label: 'Wall of vinyl sleeves', price: 140, decor: 'vinyl', desc: 'Delivered to your home' }, { label: 'One record, for the shelf', price: 18, act: () => G.ui.toast('A first pressing, slightly warped. Perfect.', 'good') }]],
  ['FLOWERS', '#ffd34d', [{ label: 'Eden fern in a pot', price: 55, decor: 'plant', desc: 'Delivered to your home' }, { label: 'Bunch of glow tulips', price: 8, act: () => G.ui.toast('They will glow for about a week.', 'good') }]],
  ['PRINTS', '#59e0ff', [{ label: 'Framed city print', price: 120, decor: 'print', desc: 'Delivered to your home' }]],
  ['BREAD & HONEY', '#e9c46a', [{ label: 'Sourdough loaf', price: 7, food: { name: 'Sourdough', energy: 22 } }, { label: 'Jar of honey', price: 9, food: { name: 'Honey', energy: 12 } }]],
  ['TEA SAMPLER', '#9fe9ff', [{ label: 'Iced tea in a paper cup', price: 3, eat: 8, mins: 5 }, { label: 'Tea set and a tin of leaf', price: 80, decor: 'tea', desc: 'Delivered to your home' }]],
  ['REPAIR BENCH', '#c9a8ff', [{ label: 'Patch your vehicle hull', price: 30, desc: '+20% hull, a drone goes out to it', need: () => G.car.hull < 100, act: () => { G.car.hull = clamp(G.car.hull + 20, 0, 100); G.ui.toast(`Hull patched: ${Math.round(G.car.hull)}%.`, 'good'); } }]],
  ['BOOK SWAP', '#b98a3e', [{ label: 'Shelf of paper novels', price: 150, decor: 'books', desc: 'Delivered to your home' }, { label: 'A paperback', price: 4, act: () => G.ui.toast('A detective story, missing its last page.', 'info') }]],
  ['NOODLE POT', '#ff5a4d', [{ label: 'Bowl of noodles', price: 8, eat: 28, mins: 10 }]],
];

export class Happenings {
  constructor() {
    const I = G.interact, S = G.scene, park = G.metro.park;
    this.rng = new RNG(31337); this.told = {}; this.v = new THREE.Vector3();
    // ---- concert --------------------------------------------------------------------------------
    const st = (this.stage = { x: park.stage.x, z: park.stage.z });
    this.concert = { on: false, g: new THREE.Group(), beams: [], perf: null, t: 0 };
    const cg = this.concert.g; cg.visible = false; S.add(cg);
    for (let k = 0; k < 4; k++) {
      const g = new THREE.ConeGeometry(2.2, 18, 14, 1, true); g.translate(0, -9, 0);
      const b = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: ['#ff7ad9', '#59e0ff', '#ffd34d', '#7dff9c'][k], transparent: true, opacity: 0.11, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      b.position.set(st.x - 6 + k * 4, 6.9, st.z + 7); cg.add(b); this.concert.beams.push(b);
    }
    { const c = makeCanvas(512, 192), g = c.getContext('2d'); g.fillStyle = '#05070c'; g.fillRect(0, 0, 512, 192); g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#fff'; g.font = '800 64px system-ui, sans-serif'; g.shadowColor = '#fff'; g.shadowBlur = 18; g.fillText('ARBOR LIVE', 256, 84); g.shadowBlur = 0; g.font = '600 26px system-ui, sans-serif'; g.fillText('tonight on the park stage', 256, 146);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(13, 4.9), new THREE.MeshBasicMaterial({ map: canvasTex(c, false), color: 0xffffff })); m.position.set(st.x, 4.1, st.z + 11.6); m.rotation.y = Math.PI; cg.add(m); this.concert.screen = m; }
    const wash = new THREE.Mesh(new THREE.CircleGeometry(7.6, 32), new THREE.MeshBasicMaterial({ map: M.glow, color: 0xff7ad9, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    wash.rotation.x = -Math.PI / 2; wash.position.set(st.x, 0.79, st.z + 6); cg.add(wash); this.concert.wash = wash;
    G.musicSpots.push({ x: st.x, z: st.z + 2, on: () => this.concert.on });
    I.add({ pos: new THREE.Vector3(st.x, 0, st.z - 6), r: 6, prio: -0.2, label: 'Dance with the crowd', enabled: () => this.concert.on, use: () => { G.player.play('dance', 14); G.state.done.danced = true; } });
    // audience: seats on the tiers (a share of them), and a crowd standing in front of the stage
    this.seats = [];
    for (let t = 0; t < 5; t++) for (let k = -5; k <= 5; k++) for (const s of [-0.7, 0.7]) {
      const a = -Math.PI / 2 + k * 0.2, r = 14 + t * 2.4, h = 0.45 + t * 0.45, x = st.x + Math.cos(a) * r - Math.sin(a) * s, z = st.z + 2 + Math.sin(a) * r + Math.cos(a) * s;
      if (this.rng.chance(0.62)) this.seats.push([x, h - 0.5, z, Math.atan2(st.x - x, st.z + 6 - z), this.seats.length * 7]);
    }
    this.front = []; for (let k = 0; k < 28; k++) { const a = -Math.PI / 2 + this.rng.range(-0.75, 0.75), r = this.rng.range(7, 11), x = st.x + Math.cos(a) * r, z = st.z + 2 + Math.sin(a) * r; this.front.push([x, z, Math.atan2(st.x - x, st.z + 6 - z), k * 11, this.rng.range(0, 6)]); }

    // ---- fireworks ------------------------------------------------------------------------------
    const BN = 4200, fw = (this.fw = { on: false, n: BN, p: new Float32Array(BN * 3), v: new Float32Array(BN * 3), c: new Float32Array(BN * 3), base: new Float32Array(BN * 3), life: new Float32Array(BN), max: new Float32Array(BN), kind: new Uint8Array(BN), next: 0, t: 0, shells: [], barge: { x: 810, z: 1560 } });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(fw.p, 3)); geo.setAttribute('color', new THREE.BufferAttribute(fw.c, 3));
    fw.points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 6, map: M.glow, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
    fw.points.frustumCulled = false; fw.points.visible = false; S.add(fw.points);
    { const B = new Builder(); B.box('B', '#2b303a', 14, 1.6, 30, fw.barge.x, 0.5, fw.barge.z); B.box('S', '#c0483f', 14.2, 0.3, 30.2, fw.barge.x, 0.1, fw.barge.z); for (let k = 0; k < 6; k++) B.cyl('S', '#59606c', 0.5, 0.5, 1.4, fw.barge.x - 4 + (k % 3) * 4, 2, fw.barge.z - 6 + Math.floor(k / 3) * 12, 8); B.box('L', '#ffd34d', 0.4, 0.4, 0.4, fw.barge.x, 3.2, fw.barge.z - 14);
      fw.bargeMesh = B.finish(new THREE.Group()); S.add(fw.bargeMesh); }
    this.flash = new THREE.PointLight(0xffffff, 0, 700, 1.2); this.flash.position.set(810, 120, 1560); S.add(this.flash);

    // ---- market ---------------------------------------------------------------------------------
    const plaza = G.metro.list.filter((b) => b.plaza).sort((a, b) => Math.hypot(a.cx, a.cz) - Math.hypot(b.cx, b.cz))[0];
    const mk = (this.market = { on: false, plaza, stalls: [], g: new THREE.Group(), name: `${streetName(true, plaza.i)} & ${streetName(false, plaza.j)}` });
    mk.g.visible = false; S.add(mk.g);
    { const c = makeCanvas(1024, 320), g = c.getContext('2d'); g.textAlign = 'center'; g.textBaseline = 'middle';
      STALLS.forEach(([name, col], n) => { const x = (n % 4) * 256, y = Math.floor(n / 4) * 106; g.fillStyle = '#10131a'; g.fillRect(x + 4, y + 4, 248, 98); g.fillStyle = col; g.font = '800 34px system-ui, sans-serif'; g.fillText(name, x + 128, y + 54, 232); });
      const B = new Builder(), signMat = new THREE.MeshBasicMaterial({ map: canvasTex(c, false) }), y0 = plaza.y0;
      STALLS.forEach(([name, col, goods], n) => {
        const row = n < 5 ? -1 : 1, x = plaza.cx - 16 + (n % 5) * 8, z = plaza.cz + row * 19, f = -row, a = f > 0 ? 0 : Math.PI;   // the counter faces the middle of the plaza
        B.box('B', '#7a5536', 3.2, 1.0, 1.3, x, y0 + 0.5, z); B.box('S', '#d9c9a6', 3.3, 0.06, 1.4, x, y0 + 1.03, z);
        for (const sx of [-1.6, 1.6]) for (const sz of [-0.9, 0.9]) B.box('S', '#2a303b', 0.08, 2.6, 0.08, x + sx, y0 + 1.3, z + sz);
        { const P = (dx, dy, dz) => [x + dx, y0 + 2.62 + dy, z - f * 0.1 + dz]; B.hull('B', col, [P(-1.9, -0.04, -1.2), P(1.9, -0.04, -1.2), P(1.9, -0.04, 1.2), P(-1.9, -0.04, 1.2), P(-1.9, 0.04, -1.2), P(1.9, 0.04, -1.2), P(1.9, 0.04, 1.2), P(-1.9, 0.04, 1.2)], true); }   // the awning, seen from below too
        B.box('S', '#f4f1ea', 3.8, 0.3, 0.05, x, y0 + 2.45, z + f * 1.2);
        for (let k = 0; k < 6; k++) B.blob('S', [col, '#e9edf2', '#c0483f', '#7dff9c', '#ffd34d'][k % 5], 0.16, 0.12, 0.16, x - 1.2 + k * 0.48, y0 + 1.16, z + f * 0.2, k);
        B.sign((n % 4) / 4, 1 - (Math.floor(n / 4) * 106 + 102) / 320, (n % 4) / 4 + 0.25, 1 - Math.floor(n / 4) * 106 / 320, 2.6, 1.0, x, y0 + 3.2, z + f * 0.6, a);
        const colB = G.colliders.box(x - 1.6, x + 1.6, y0, y0 + 1.05, z - 0.65, z + 0.65); colB.enabled = false;
        const s = { name, goods, x, z, f, y: y0, col: colB, front: new THREE.Vector3(x, y0, z + f * 1.9), keeper: [x, y0, z - f * 1.4, a + Math.PI] };
        mk.stalls.push(s);
        I.add({ pos: s.front, r: 2, yTol: 1.6, label: `Browse: ${name.toLowerCase().replace(/(^|\s)\w/g, (m) => m.toUpperCase())}`, enabled: () => mk.on, use: () => this.stallMenu(s) });
      });
      B.finish(mk.g, null, signMat);
    }
    this.flags = { concert: 0, fw: 0, front: 0 };
  }
  // ---- schedule ---------------------------------------------------------------------------------
  // [id, name, where, days, from, to, x, z]
  list() {
    const mk = this.market, st = this.stage;
    return [
      ['concert', 'Arbor Live', 'Grand Arbor Park amphitheatre', ['Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], 19, 22.5, st.x, st.z - 10],
      ['fireworks', 'Fireworks over the bay', 'Solara Bay: the beach and the pier', ['Friday', 'Saturday'], 21.5, 22.25, 810, 1160],
      ['market', 'Weekend market', `Plaza at ${mk.name}`, ['Saturday', 'Sunday'], 9, 16, mk.plaza.cx, mk.plaza.cz],
      ['holo', 'Holo-concert', 'Meridian Commons stage', DAYS, 20, 25, -12, 22],
      ['evening', 'Evening market', 'Meridian Commons, east path', DAYS, 17, 21.5, 34, -3],
      ['match', 'Skyball at Skyhaven Stadium', 'Skyhaven Green, under the deck', ['Tuesday', 'Thursday', 'Saturday'], 18, 20, G.metro.expo.gate.x, G.metro.expo.gate.z + 12],
      ['matchsun', 'Skyball at Skyhaven Stadium', 'Skyhaven Green, under the deck', ['Sunday'], 14, 16, G.metro.expo.gate.x, G.metro.expo.gate.z + 12],
    ];
  }
  day() { return `${weekday(G.env.day)}, day ${G.env.day}`; }
  // map markers for what is on right now
  markers() { return this.whatsOn().filter((e) => e.now && e.id !== 'holo' && e.id !== 'evening').map((e) => ({ x: e.x, z: e.z, color: '#ff9a52' })); }
  live(id) { const e = this.list().find((q) => q[0] === id), h = G.env.hour, d = weekday(G.env.day); return e[3].includes(d) && h >= e[4] && h < e[5]; }
  // ---- market -----------------------------------------------------------------------------------
  stallMenu(s) {
    const home = G.state.home;
    G.ui.openMenu({ title: s.name.toLowerCase().replace(/(^|\s)\w/g, (m) => m.toUpperCase()), who: 'Weekend market stall', body: 'Everything here is made, grown or found by the person selling it.', options: [...s.goods.map((it) => {
      const owned = it.decor && home.decor[it.decor], blocked = !owned && it.need && !it.need();
      return { label: it.label, desc: owned ? 'Already in your home.' : it.desc, price: owned ? undefined : it.price, disabled: owned || blocked, why: owned ? 'You already have this at home.' : 'Not needed right now.', onPick: () => this.buy(it) };
    }), { label: 'Just looking', onPick: () => {} }] });
  }
  buy(it) {
    const p = G.player;
    if (!G.economy.spend(it.price, it.label.toLowerCase())) return;
    G.state.done.market = true;
    if (it.food) G.food.pocket({ ...it.food });
    if (it.eat) { G.state.stats.meals++; G.skip(it.mins || 5, it.eat, false); }
    if (it.decor) { G.state.home.decor[it.decor] = true; G.home.refresh(); G.ui.toast('Delivered to your home.', 'good'); }
    if (it.act) it.act();
    if (G.audio) G.audio.ui('pay'); void p;
  }
  // ---- fireworks --------------------------------------------------------------------------------
  spawn(x, y, z, vx, vy, vz, r, g, b, life, kind) {
    const f = this.fw, i = f.next; f.next = (f.next + 1) % f.n;
    f.p[i * 3] = x; f.p[i * 3 + 1] = y; f.p[i * 3 + 2] = z; f.v[i * 3] = vx; f.v[i * 3 + 1] = vy; f.v[i * 3 + 2] = vz;
    f.base[i * 3] = r; f.base[i * 3 + 1] = g; f.base[i * 3 + 2] = b; f.life[i] = life; f.max[i] = life; f.kind[i] = kind;
  }
  launch() {
    const f = this.fw, r = this.rng, x = f.barge.x + r.range(-5, 5), z = f.barge.z + r.range(-12, 12);
    f.shells.push({ x, y: 2, z, vx: r.range(-3, 3), vy: r.range(50, 62), vz: r.range(-3, 3), type: r.pick(['peony', 'peony', 'ring', 'willow', 'crackle', 'double']), col: r.pick([[1, 0.35, 0.8], [0.35, 0.9, 1], [1, 0.85, 0.3], [0.5, 1, 0.55], [1, 0.4, 0.3], [0.85, 0.6, 1]]) });
    if (G.audio) { const d = Math.hypot(x - G.player.pos.x, z - G.player.pos.z); if (d < 1400) setTimeout(() => G.audio.tone(70, 0.25, 0.08 * (1 - d / 1400), 'sine'), (d / 343) * 1000); }
  }
  burst(s) {
    const r = this.rng, [cr, cg, cb] = s.col, n = s.type === 'willow' ? 200 : s.type === 'ring' ? 130 : 260, sp = r.range(38, 52), kind = s.type === 'willow' ? 1 : s.type === 'crackle' ? 2 : 0;
    const ax = r.range(0, TAU), tilt = r.range(0.2, 0.7);
    for (let k = 0; k < n; k++) {
      let dx, dy, dz;
      if (s.type === 'ring') { const a = (k / n) * TAU; dx = Math.cos(a); dy = Math.sin(a) * Math.cos(tilt); dz = Math.sin(a) * Math.sin(tilt); const c = Math.cos(ax), sn = Math.sin(ax); [dx, dz] = [dx * c - dz * sn, dx * sn + dz * c]; }
      else { const u = r.range(-1, 1), a = r.range(0, TAU), q = Math.sqrt(1 - u * u); dx = q * Math.cos(a); dy = u; dz = q * Math.sin(a); }
      const two = s.type === 'double' && k % 2, m = s.type === 'willow' ? [1, 0.75, 0.35] : two ? [1, 1, 1] : [cr, cg, cb], v = sp * (s.type === 'ring' ? 1 : r.range(0.85, 1.05));
      this.spawn(s.x, s.y, s.z, dx * v + s.vx, dy * v + s.vy * 0.3, dz * v + s.vz, m[0] * 3.2, m[1] * 3.2, m[2] * 3.2, s.type === 'willow' ? r.range(3.4, 4.4) : r.range(2.2, 3.0), kind);
    }
    this.flash.position.set(s.x, s.y, s.z); this.flash.color.setRGB(cr, cg, cb); this.flashT = 0.35;
    if (G.audio) { const d = Math.hypot(s.x - G.player.pos.x, s.z - G.player.pos.z), vol = clamp(1 - d / 1800, 0.04, 1); setTimeout(() => { G.audio.burst(1.1, 0.5 * vol, 140, 'lowpass'); if (kind === 2) setTimeout(() => G.audio.burst(1.3, 0.12 * vol, 3200, 'highpass'), 450); }, (d / 343) * 1000); }
  }
  updateFireworks(dt, on, t) {
    const f = this.fw;
    if (on && !f.on) { f.on = true; f.t = 0; f.wait = 1; f.points.visible = true; }
    if (!on && f.on && !f.shells.length && !f.life.some((l) => l > 0)) { f.on = false; f.points.visible = false; f.points.geometry.setDrawRange(0, 0); }
    if (!f.on) return;
    if (on) { f.t += dt; f.wait -= dt; const end = this.fwEnd - G.env.hour; if (f.wait <= 0) { this.launch(); f.wait = end < 0.1 ? 0.22 : this.rng.range(1.0, 2.4); } }
    for (let k = f.shells.length - 1; k >= 0; k--) {
      const s = f.shells[k]; s.vy -= 9.8 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      this.spawn(s.x, s.y, s.z, 0, -2, 0, 2.4, 1.6, 0.7, 0.45, 0);
      if (s.vy < 6) { this.burst(s); f.shells.splice(k, 1); }
    }
    const P = f.p, V = f.v, C = f.c, Bc = f.base, L = f.life, Mx = f.max;
    for (let i = 0; i < f.n; i++) {
      if (L[i] <= 0) { if (C[i * 3] || C[i * 3 + 1] || C[i * 3 + 2]) { C[i * 3] = C[i * 3 + 1] = C[i * 3 + 2] = 0; } continue; }
      L[i] -= dt; const drag = f.kind[i] === 1 ? 1.3 : 0.75, o = i * 3, k = Math.exp(-drag * dt);
      V[o] *= k; V[o + 1] = V[o + 1] * k - 4.5 * dt; V[o + 2] *= k; P[o] += V[o] * dt; P[o + 1] += V[o + 1] * dt; P[o + 2] += V[o + 2] * dt;
      let a = Math.max(0, L[i] / Mx[i]); a = a * a; if (f.kind[i] === 2 && Math.sin(t * 40 + i) > 0.3) a *= 0.15;
      C[o] = Bc[o] * a; C[o + 1] = Bc[o + 1] * a; C[o + 2] = Bc[o + 2] * a;
    }
    f.points.geometry.attributes.position.needsUpdate = true; f.points.geometry.attributes.color.needsUpdate = true; f.points.geometry.setDrawRange(0, f.n);
  }
  // ---- crowds for the passers-by system ------------------------------------------------------------
  figures(A, focus) {
    const st = this.stage, ph = G.elapsed;
    if (this.concert.on && Math.hypot(focus.x - st.x, focus.z - st.z) < 230) {
      for (const [x, y, z, yaw, n] of this.seats) A.put('c' + n, x, y, z, yaw, n, 'sit', 0, focus);
      for (const [x, z, yaw, n, p0] of this.front) A.put('f' + n, x, 0, z, yaw, n, n % 33 === 0 ? 'talk' : 'dance', ph * (2.6 + (n % 5) * 0.2) + p0, focus);
    }
    if (this.fw.crowd && Math.hypot(focus.x - 810, focus.z - 1170) < 600) {
      for (let k = 0; k < 46; k++) { const x = 470 + k * 15 + (k % 3) * 2.5, z = 1172 + (k % 4) * 2.2; if (x > 790 && x < 830) continue; A.put('w' + k, x, 0, z, Math.PI * 0 + (k % 5 - 2) * 0.08, k * 13, 'sit', 0, focus); }
      for (let k = 0; k < 14; k++) { const s = k % 2 ? 1 : -1, z = 1196 + k * 13; A.put('p' + k, 810 + s * 4.2, 3.2, z, 0, k * 17 + 3, 'idle', 0, focus); }
    }
    const mk = this.market;
    if (mk.on && Math.hypot(focus.x - mk.plaza.cx, focus.z - mk.plaza.cz) < 260) {
      mk.stalls.forEach((s, n) => {
        A.put('k' + n, s.keeper[0], s.y, s.keeper[2], s.keeper[3], n * 5 + 2, n % 3 ? 'idle' : 'talk', ph + n, focus);
        if (n % 3 !== 1) A.put('b' + n, s.x + (n % 2 ? 0.8 : -0.9), s.y, s.z + s.f * 2.2, s.f > 0 ? Math.PI : 0, n * 9 + 4, 'talk', ph + n * 2, focus);
      });
      for (let k = 0; k < 12; k++) { const a = ph * 0.05 * (k % 2 ? 1 : -1) + (k / 12) * TAU, r = 13 + (k % 3) * 1.4, x = mk.plaza.cx + Math.cos(a) * r, z = mk.plaza.cz + Math.sin(a) * r * 0.55; A.put('s' + k, x, mk.plaza.y0, z, Math.atan2(-Math.sin(a) * (k % 2 ? 1 : -1), Math.cos(a) * 0.55 * (k % 2 ? 1 : -1)), k * 7 + 1, 'walk', ph * 5 + k, focus); }
    }
  }
  // ---- per frame ----------------------------------------------------------------------------------
  update(dt, t) {
    const env = G.env, h = env.hour, p = G.player, focus = p.state === 'drive' ? G.car.pos : p.pos, day = weekday(env.day), key = env.day + ':';
    const notice = (id, text) => { if (this.told[key + id] || !G.started) return; this.told[key + id] = true; G.ui.toast(text, 'info'); };
    // concert
    const c = this.concert, cOn = this.live('concert'), near = Math.hypot(focus.x - this.stage.x, focus.z - this.stage.z) < 260;
    if (cOn !== c.on) { c.on = cOn; if (cOn) notice('concert', 'Arbor Live is on at the Grand Arbor Park amphitheatre until 22:30.'); }
    c.g.visible = c.on && near;
    if (c.g.visible) {
      c.t += dt; c.beams.forEach((b, k) => { b.rotation.x = Math.PI + 0.45 + Math.sin(c.t * 0.8 + k) * 0.35; b.rotation.z = Math.sin(c.t * 0.6 + k * 1.7) * 0.6; });
      c.screen.material.color.setHSL((c.t * 0.05) % 1, 0.7, 0.6); c.wash.material.color.setHSL((c.t * 0.11 + 0.5) % 1, 0.9, 0.55); c.wash.material.opacity = 0.35 + Math.abs(Math.sin(c.t * 4)) * 0.3;
      if (!c.perf) c.perf = [0, 1, 2].map((k) => { const rig = makeHumanoid(varyLook({ kind: 'human', skin: SKINS[(k * 2 + 1) % SKINS.length], hair: HAIRS[(k * 3 + 2) % HAIRS.length], hairStyle: [6, 2, 11][k], top: ['#ff7ad9', '#1c1f27', '#e9edf2'][k], bottom: '#1c1f27', accent: '#59e0ff', height: 1.7 + k * 0.05, build: 1, coat: k === 1, visor: false }, 4400 + k, {})); G.scene.add(rig.root); return rig; });
      c.perf.forEach((rig, k) => { rig.root.visible = true; rig.root.position.set(this.stage.x - 3.5 + k * 3.5, 0.78, this.stage.z + 4.5 + (k === 1 ? -1 : 0)); rig.root.rotation.y = Math.PI + Math.sin(c.t * 0.7 + k) * 0.3; animateRig(rig, dt, k === 1 ? 'dance' : 'idle', 0); });
      if (Math.hypot(p.pos.x - this.stage.x, p.pos.z - this.stage.z - 2) < 26) { this.flags.front += dt; if (this.flags.front > 30) G.state.done.frontRow = true; }
    } else if (c.perf) for (const rig of c.perf) rig.root.visible = false;
    // fireworks: the show itself, the crowd on the beach from half an hour before
    const fwDay = ['Friday', 'Saturday'].includes(day), fwOn = fwDay && h >= 21.5 && h < 22.25; this.fwEnd = 22.25;
    this.fw.crowd = fwDay && h >= 21 && h < 22.6;
    if (fwDay && h >= 21 && h < 21.5) notice('fwsoon', 'Fireworks over Solara Bay at 21:30. The beach and the pier have the best view.');
    this.updateFireworks(dt, fwOn, t);
    this.fw.bargeMesh.visible = Math.hypot(focus.x - 810, focus.z - 1560) < 1600;
    if (this.flashT > 0) { this.flashT -= dt; this.flash.intensity = Math.max(0, this.flashT / 0.35) * 2600; } else this.flash.intensity = 0;
    if (fwOn && Math.hypot(p.pos.x - 810, p.pos.z - 1560) < 700) G.state.done.fireworks = true;
    // market: stalls up from 09:00 to 16:00 at the weekend
    const mk = this.market, mOn = this.live('market');
    if (mOn !== mk.on) { mk.on = mOn; for (const s of mk.stalls) s.col.enabled = mOn; if (mOn) notice('market', `The weekend market is open on the plaza at ${mk.name} until 16:00.`); }
    mk.g.visible = mk.on && Math.hypot(focus.x - mk.plaza.cx, focus.z - mk.plaza.cz) < 420;
  }
  // a line for the phone: what is on today, and when
  whatsOn() {
    const h = G.env.hour, d = weekday(G.env.day), tomorrow = weekday(G.env.day + 1);
    return this.list().map(([id, name, where, days, from, to, x, z]) => {
      const today = days.includes(d), now = today && h >= from && h < to, later = today && h < from;
      const when = now ? `On now, until ${fmtClock(Math.round((to % 24) * 60))}` : later ? `Today from ${fmtClock(Math.round(from * 60))}` : days.includes(tomorrow) ? `Tomorrow (${tomorrow}) from ${fmtClock(Math.round(from * 60))}` : `${days.length === 7 ? 'Every day' : days.join(', ')} from ${fmtClock(Math.round(from * 60))}`;
      return { id, name, where, when, now, x, z, rank: now ? 0 : later ? 1 : 2 };
    }).sort((a, b) => a.rank - b.rank);
  }
}
