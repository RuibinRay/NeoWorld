// Getting around Neo Central and what there is to do in each district:
// district shuttle and map, Neon lifts, Sim Arena (VR target range), line QA shift (Nexus),
// table service (Aurum Table, Hearth), the public orchard, the museum, the Skyhaven villa,
// and the Aeroport Speed Loop.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { SITES } from '../data/sites.js';
import { neon } from '../world/materials.js';
import { makeDish } from './food.js';
import { Career } from './career.js';
import { money } from '../ui/ui.js';
import { clamp, smooth, RNG, TAU } from '../core/util.js';

const MERIDIAN = { id: 'meridian', name: 'Meridian Quarter', x: 0, z: 0, y: 0.15, blurb: 'Home district: the Commons, Printed Petal, Kinetic, the Skyport.', kiosk: { x: -111.5, y: 0.15, z: -14.2 } };
const MENUS = {
  aurum: { name: 'Aurum Table', who: 'Skyhaven · served at your table', standing: 2, items: [['Zero-g souffle', 'Set in free fall on the morning shuttle. It has never known its own weight.', 120, 30, 'cloud'], ['Orbital-grown tuna', 'Raised in a spinning tank above the equator.', 180, 62, 'wagyu'], ['Tasting of nine printers', 'Nine kitchens, one bite each.', 260, 75, 'bento']] },
  hearth: { name: 'Hearth', who: 'Old Earth · cooked over a wood fire', standing: 0, items: [['Wood-fired flatbread', 'Flour, water, salt, fire. Nothing printed.', 12, 34, 'katsu'], ['Grandmother stew', 'Simmered since the morning in an iron pot.', 15, 44, 'ramen'], ['Garden plate', 'Picked behind the tavern today.', 10, 26, 'garden']] },
};
const EXHIBITS = [
  ['The pocket telephone', 'A slab of glass people carried everywhere and looked at for hours. It held their maps, their friends and their money. Lenses replaced it by 2090; the habit of looking down took another generation to fade.'],
  ['The combustion engine', 'It burned ancient liquid to turn a wheel. Cities were built around feeding and parking these machines. The last street in Neo Central to allow one is the tram loop outside, and the tram is electric.'],
  ['Paper money', 'Value printed on cloth and passed hand to hand. It could be lost, stolen, or forgotten in a coat. The lumen ledger made it obsolete; this note is here because nobody could bear to recycle it.'],
  ['A door key', 'A piece of cut metal that opened one door and no other. If you lost it, you waited outside your own home. Buildings have recognised their residents since 2105.'],
  ['The office chair', 'People sat in one of these for eight hours a day, in a room with others doing the same. The Nexus now runs with nine human staff. What everyone else does with the day is the story of this century.'],
  ['A paper book', 'Ink on pressed fibre, bound along one edge. It cannot be searched, updated or dimmed. The shop on the corner of Meridian still sells them, and still sells out.'],
];
const VR_PAY = 1.4, LOOP_MEDALS = [[24, 'GOLD', 500], [30, 'SILVER', 300], [40, 'BRONZE', 150]];

export class World {
  constructor() {
    const I = G.interact, D = G.districts, by = D.byId; this.rng = new RNG(606); this.marker = null; this.meal = null; this.vr = null; this.qa = null; this.loop = null;
    this.places = [MERIDIAN, ...D.list];
    const mk = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 0.5), new THREE.MeshStandardMaterial({ color: '#20262f', roughness: 0.4, metalness: 0.7 })), glow = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.3, 0.06), neon('#ffd34d', 0.8));
    mk.position.set(MERIDIAN.kiosk.x, 1.35, MERIDIAN.kiosk.z - 1.2); glow.position.set(0, 0.2, 0.27); mk.add(glow); mk.castShadow = true; G.scene.add(mk); G.colliders.box(mk.position.x - 0.7, mk.position.x + 0.7, 0.15, 2.55, mk.position.z - 0.25, mk.position.z + 0.25);
    // shuttle kiosks
    for (const d of this.places) I.add({ pos: d.kiosk, r: 1.9, label: 'District shuttle', use: () => this.shuttleMenu(d, 25) });
    // Neon lifts
    for (const l of by.neon.things.lifts) { I.add({ pos: l.low, r: 2, label: 'Lift up to the neon avenues', use: () => this.hop(l.up) }); I.add({ pos: l.up, r: 2, label: 'Lift down to the Undercity', use: () => this.hop(l.low) }); }
    // orchard, museum, villa, stations for the two skill games
    by.bioeden.things.orchard.forEach((pos, i) => I.add({ pos, r: 2.2, label: () => (G.state.picked[i] === G.env.day ? 'This tree is picked for today' : 'Pick a sun-apple'), use: () => this.pick(i) }));
    by.oldearth.things.exhibits.forEach((pos, i) => I.add({ pos, r: 1.6, label: `Read: ${EXHIBITS[i][0]}`, use: () => this.exhibit(i) }));
    const v = by.skyhaven.things.villa;
    I.add({ pos: v.console, r: 1.7, label: 'Villa console', use: () => this.villaMenu() });
    I.add({ pos: v.bed, r: 2, label: () => (G.state.owns.villa ? 'Sleep until morning' : 'Bed (the villa is for sale at the console)'), use: () => (G.state.owns.villa ? G.economy.sleep() : G.ui.toast('The villa is for sale at its console.', 'info')) });
    I.add({ pos: by.neon.things.vr, r: 1.9, label: 'Enter the Sim Arena (◈15)', use: () => this.startVR() });
    I.add({ pos: by.nexus.things.qa, r: 1.9, label: 'Line QA station: work a shift', use: () => this.startQA() });
    // table service at Aurum Table and Hearth
    I.add({ mode: 'sit', pos: G.player.pos, r: 3, yTol: 3, prio: 0.2,
      label: () => (this.meal ? `Eat: ${this.meal.item[0]}` : `Order (${MENUS[G.player.seat.service].name})`),
      enabled: () => G.player.seat && G.player.seat.service && (!this.meal || (this.meal.ready && this.meal.seat === G.player.seat)), use: () => (this.meal ? this.bite() : this.orderMenu()) });
    // crosshair for the Sim Arena
    this.cross = document.createElement('div'); this.cross.style.cssText = 'position:absolute;left:50%;top:50%;width:18px;height:18px;margin:-9px 0 0 -9px;border:2px solid #7dff9c;border-radius:50%;display:none;box-shadow:0 0 8px #7dff9c';
    document.getElementById('ui').appendChild(this.cross);
    this.targets = []; for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x7dff9c, wireframe: true })); m.visible = false; G.scene.add(m); this.targets.push({ m, life: 0, dir: new THREE.Vector3() }); }
    // Aeroport Speed Loop rings
    const A = SITES.aeroport, geo = new THREE.TorusGeometry(9, 0.36, 8, 40), zAxis = new THREE.Vector3(0, 0, 1), pts = [];
    for (let i = 0; i < 12; i++) { const a = Math.PI - (i / 12) * TAU; pts.push([A.x + Math.cos(a) * 215, 46 + 14 * Math.sin(2 * a), A.z + Math.sin(a) * 160]); }
    this.rings = pts.map((p, i) => { const a = pts[(i + 11) % 12], b = pts[(i + 1) % 12], n = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize(), m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x59e0ff, transparent: true, opacity: 0.4 })); m.position.set(p[0], p[1], p[2]); m.quaternion.setFromUnitVectors(zAxis, n); m.visible = false; G.scene.add(m); return { m, c: m.position, n }; });
    this.prev = new THREE.Vector3();
    addEventListener('keydown', (e) => { if (!this.qa) return; if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) this.qaReject(); } else if (e.code === 'Escape') this.endQA(); });
    // music: the Commons stage and the Pulse club
    const st = G.city.places.stage, club = by.neon.things.club;
    G.musicSpots = [{ x: st.x, z: st.z, on: () => st.on }, { x: club.x, z: club.z, on: () => { const h = G.env.hour; return (h >= 18 || h < 4) && G.player.pos.y < 13; } }];
  }
  markers() { const out = []; if (this.marker) out.push({ x: this.marker.x, z: this.marker.z, color: '#b98cff' }); if (this.loop) { const c = this.rings[this.loop.idx % 12].c; out.push({ x: c.x, z: c.z, color: '#7dff9c' }); } return out; }

  // ---- travel ----------------------------------------------------------------------------------
  hop(to) { G.ui.fade(() => { const p = G.player; p.pos.set(to.x, to.y, to.z); p.vel.set(0, 0, 0); p.grounded = true; if (G.dog.active) G.dog.pos.set(to.x + 0.7, to.y, to.z + 0.5); }); if (G.audio) G.audio.blip(440, 0.1); }
  shuttleMenu(here, cost) {
    const p = G.player.pos;
    G.ui.openMenu({ title: 'District shuttle', who: `Autonomous air taxi · ${money(cost)} a ride`, wide: true, body: 'Pick a district. The shuttle sets you down at its kiosk; the ride takes about ten minutes of city time.',
      options: [...this.places.filter((d) => d !== here).map((d) => ({ label: d.name, desc: `${d.blurb}  ${Math.round(Math.hypot(d.x - p.x, d.z - p.z))} m away.`, price: cost, onPick: () => { if (G.economy.spend(cost, `shuttle to ${d.name}`)) { this.hop(d.kiosk); G.skip(10, 0, true); G.ui.toast(`Arrived: ${d.name}.`, 'good'); } } })), { label: 'Stay here', onPick: () => {} }] });
  }
  districtMenu() {
    const p = G.player.pos, here = G.districts.at(p);
    G.ui.openMenu({ title: 'Neo Central', who: 'Seven districts', wide: true, body: 'Pick a district to mark it on your lens map. Fly there yourself (autopilot knows every pad), or call a shuttle.',
      options: [...this.places.map((d) => ({ label: `${d.name}${d === here || (!here && d === MERIDIAN && Math.hypot(p.x, p.z) < 260) ? ' · you are here' : ''}`, desc: `${d.blurb}  ${Math.round(Math.hypot(d.x - p.x, d.z - p.z))} m.`, onPick: () => { this.marker = d; G.ui.toast(`${d.name} is marked on your map.`, 'info'); } })),
        { label: 'Call a shuttle to where I am standing', desc: 'Costs more than boarding at a kiosk', price: 40, disabled: G.player.state !== 'walk', why: 'You need to be on foot.', onPick: () => this.shuttleMenu(null, 40) }, { label: 'Close', onPick: () => {} }] });
  }

  // ---- small district things -------------------------------------------------------------------------
  pick(i) { const s = G.state; if (s.picked[i] === G.env.day) return G.ui.toast('Leave some for the neighbors. It will fruit again tomorrow.', 'info'); s.picked[i] = G.env.day; G.food.pocket({ name: 'Sun-apple', energy: 15 }); G.ui.toast('You pick a sun-apple. It is warm, like it has been in the light all day.', 'good'); }
  exhibit(i) {
    const s = G.state, first = !s.museum.includes(i); if (first) s.museum.push(i);
    const done = first && s.museum.length === EXHIBITS.length; if (done) { G.economy.earn(150, 'heritage stipend: you read the whole collection'); s.standing = clamp(s.standing + 2, -100, 100); }
    G.ui.openMenu({ title: EXHIBITS[i][0], who: `House of Old Things · exhibit ${i + 1} of ${EXHIBITS.length} · ${s.museum.length} read`, body: EXHIBITS[i][1], options: [{ label: 'Step back', onPick: () => {} }] });
  }
  villaMenu() {
    const s = G.state;
    if (s.owns.villa) return G.ui.openMenu({ title: 'Skyhaven villa', who: 'Yours', body: `Good ${G.env.hour < 12 ? 'morning' : 'evening'}, ${s.name}. The deck holds itself at 450 m; the weather happens below you.`, options: [{ label: 'Sleep until morning', onPick: () => G.economy.sleep() }, { label: 'Save game', onPick: () => G.save.write() }, { label: 'Close', onPick: () => {} }] });
    G.ui.openMenu({ title: 'Skyhaven villa', who: 'For sale · floating deck, private pad', body: 'A glass villa on its own deck above the cloud line, with a private landing pad and charger. The repulsor field under your feet draws more power than all of Meridian Commons.', options: [
      { label: 'Buy the villa', price: 38000, onPick: () => { if (G.economy.spend(38000, 'Skyhaven villa')) { s.owns.villa = true; G.ui.flash('ABOVE THE WEATHER'); G.save.write(true); } } }, { label: 'Not today', onPick: () => {} }] });
  }

  // ---- table service -------------------------------------------------------------------------------------
  orderMenu() {
    const seat = G.player.seat, menu = MENUS[seat.service];
    G.ui.openMenu({ title: menu.name, who: menu.who, wide: true, body: seat.service === 'aurum' ? 'A plate assembles itself in front of you. Nobody here asks what anything costs.' : 'The cook nods at you from the oven. It will take as long as it takes.',
      options: [...menu.items.map((it) => ({ label: it[0], desc: `${it[1]}  (+${it[3]}% energy)`, price: it[2], onPick: () => { if (!G.economy.spend(it[2], it[0])) return; const d = makeDish(it[4]); d.g.position.set(seat.table.x, seat.table.y, seat.table.z); d.food.scale.y = 0.01; G.scene.add(d.g); this.meal = { seat, item: it, t: 0, dish: d, bites: 0, ready: false, menu }; } })), { label: 'Just sitting', onPick: () => {} }] });
  }
  bite() {
    const m = this.meal, p = G.player; m.bites++; p.play('eat', 1.5); p.energy = clamp(p.energy + m.item[3] / 5, 0, 100); m.dish.food.scale.setScalar(1 - m.bites * 0.18); if (G.audio) G.audio.blip(300, 0.04);
    if (m.bites >= 5) { G.state.stats.meals++; G.state.standing = clamp(G.state.standing + m.menu.standing, -100, 100); G.ui.toast(`${m.item[0]}: finished. Energy ${Math.round(p.energy)}%.`, 'good'); m.dish.g.removeFromParent(); this.meal = null; }
  }

  // ---- Sim Arena: full-dive target range -------------------------------------------------------------------
  startVR() {
    const p = G.player; if (p.state !== 'walk' || G.minigame || this.vr) return;
    if (!G.economy.spend(15, 'Sim Arena session')) return;
    p.state = 'busy'; p.busyAnim = 'idle'; p.faceCam = true; p.board = false; p.vel.set(0, 0, 0); this.vr = { t: 45, score: 0, combo: 0, hits: 0, fp: p.firstPerson }; p.firstPerson = true; p.camPitch = 0;
    this.cross.style.display = 'block'; for (const t of this.targets) this.spawn(t);
    G.ui.toast('Sim Arena: look at a target and press Space to fire. F ends the session.', 'info');
  }
  spawn(t) { const p = G.player, yaw = p.camYaw + this.rng.range(-1.3, 1.3), el = this.rng.range(-0.05, 0.6), d = this.rng.range(12, 22); t.dir.set(Math.sin(yaw) * Math.cos(el), Math.sin(el), Math.cos(yaw) * Math.cos(el)); t.dist = d; t.size = this.rng.range(0.7, 1.3); t.life = this.rng.range(2.6, 4.2); t.m.visible = true; t.m.scale.setScalar(t.size); t.m.position.set(p.pos.x + t.dir.x * d, p.pos.y + p.eyeY + t.dir.y * d, p.pos.z + t.dir.z * d); }
  updateVR(dt, t) {
    const v = this.vr, p = G.player, inp = G.input;
    if (inp.pressed('KeyF') || p.state !== 'busy') return this.endVR();
    v.t -= dt;
    const fx = Math.sin(p.camYaw) * Math.cos(p.camPitch), fy = -Math.sin(p.camPitch), fz = Math.cos(p.camYaw) * Math.cos(p.camPitch);
    let aimed = null;
    for (const g of this.targets) { g.life -= dt; g.m.rotation.y += dt * 2; g.m.rotation.x += dt; if (g.life <= 0) { this.spawn(g); continue; } const dot = fx * g.dir.x + fy * g.dir.y + fz * g.dir.z; if (dot > Math.cos(Math.atan(g.size / g.dist) + 0.012) && (!aimed || g.dist < aimed.dist)) aimed = g; g.m.material.color.set(0x7dff9c); }
    if (aimed) aimed.m.material.color.set(0xffd34d);
    if (inp.pressed('Space')) { if (aimed) { v.combo++; v.hits++; v.score += 10 + Math.min(10, v.combo - 1) * 2; this.spawn(aimed); if (G.audio) G.audio.blip(700 + v.combo * 30, 0.07); } else { v.combo = 0; if (G.audio) G.audio.blip(200, 0.04); } }
    G.ui.setObjective({ title: 'Sim Arena', text: `${Math.max(0, Math.ceil(v.t))} s · ${v.score} points · combo ${v.combo}`, sub: 'Look at a target (it turns gold), Space to fire · F to leave' });
    if (v.t <= 0) this.endVR();
  }
  endVR() {
    const v = this.vr, p = G.player, s = G.state; this.vr = null; this.cross.style.display = 'none'; for (const t of this.targets) t.m.visible = false;
    if (p.state === 'busy') p.state = 'walk'; p.firstPerson = v.fp; G.ui.setObjective(null); G.ui.cool = 0.3;
    if (v.score > (s.best.vr || 0)) s.best.vr = v.score;
    const pay = Math.min(260, Math.round(v.score * VR_PAY));
    if (pay) G.economy.earn(pay, `Sim Arena · ${v.hits} targets`); else G.ui.toast('The arena fades out. No score this time.', 'info');
  }

  // ---- line QA shift: reject the defective crates as they pass the scanner ---------------------------------
  startQA() {
    if (G.minigame || G.player.state !== 'walk') return;
    G.minigame = true; G.input.blocked = true; G.input.releasePointer();
    this.qa = { t: 32, score: 0, good: 0, bad: 0, crates: [], next: 0.4, n: 0, msg: 'Watch the scanner' };
    const m = document.getElementById('mini'); m.style.display = 'flex';
    document.getElementById('mini-box').innerHTML = `<h2>Line QA · Industrial Nexus</h2><div style="color:var(--dim)">Crates cross the scanner band. Press <kbd>Space</kbd> to reject a red-tagged crate while it is in the band. Let the good ones through. Esc to clock off.</div>
      <div id="qz" style="position:relative;height:90px;margin-top:14px;background:rgba(255,255,255,0.05);border-radius:6px;overflow:hidden"><div style="position:absolute;left:44%;width:12%;top:0;bottom:0;background:rgba(127,233,255,0.16);border-left:2px solid var(--c);border-right:2px solid var(--c)"></div></div><div id="qmsg" style="margin-top:10px"></div>`;
  }
  qaReject() {
    const q = this.qa, c = q.crates.find((x) => !x.gone && x.x > 0.44 && x.x < 0.56);
    if (!c) { q.msg = 'Nothing in the band'; return; }
    c.gone = true; c.el.style.opacity = 0.15;
    if (c.bad) { q.score += 2; q.good++; q.msg = 'Defect pulled'; if (G.audio) G.audio.blip(880, 0.07); } else { q.score -= 2; q.bad++; q.msg = 'That one was fine'; if (G.audio) G.audio.blip(200, 0.07); }
  }
  updateQA(dt) {
    const q = this.qa, zone = document.getElementById('qz'); q.t -= dt; q.next -= dt;
    const speed = 0.22 + (1 - q.t / 32) * 0.2;
    if (q.next <= 0 && q.t > 2 && zone) { q.next = 0.75 + this.rng.next() * 0.7; const bad = this.rng.chance(0.35), el = document.createElement('i'); el.style.cssText = `position:absolute;top:22px;width:44px;height:44px;border-radius:5px;background:#b98a5a;border-top:8px solid ${bad ? '#ff4d4d' : '#7dff9c'}`; zone.appendChild(el); q.crates.push({ x: -0.08, bad, el, gone: false }); }
    for (const c of q.crates) { c.x += speed * dt; c.el.style.left = `calc(${c.x * 100}% - 22px)`; if (!c.done && c.x > 0.58) { c.done = true; if (c.bad && !c.gone) { q.score -= 1; q.bad++; q.msg = 'A defect got through'; } } }
    const m = document.getElementById('qmsg'); if (m) m.textContent = `${q.msg} · ${Math.max(0, Math.ceil(q.t))} s · score ${q.score}`;
    if (q.t <= 0) this.endQA();
  }
  endQA() {
    const q = this.qa; this.qa = null; G.minigame = false; G.input.blocked = false; G.input.hit.clear(); G.ui.cool = 0.3; document.getElementById('mini').style.display = 'none';
    if (q.good + q.bad === 0) return G.ui.toast('You clock off without touching the line.', 'info');
    G.economy.earn(Math.max(20, Math.round((40 + q.score * 9) * Career.mult('mechanic'))), `line QA · ${q.good} defects pulled, ${q.bad} mistakes`); Career.add('mechanic', 'repairs'); G.skip(30, -4, true);
  }

  // ---- Aeroport Speed Loop ---------------------------------------------------------------------------------
  armLoop() {
    if (G.jobs) { G.jobs.endRace(); G.jobs.endTaxi(); }
    this.loop = { idx: 0, t: 0, running: false }; this.paint(); this.prev.copy(G.car.pos);
    G.ui.toast('Speed Loop armed: one lap of the Aeroport, twelve rings. Fly through the green ring on the west side to start.', 'good');
  }
  paint() { const i = this.loop.idx; this.rings.forEach((r, k) => { const d = (k - (i % 12) + 12) % 12, show = d < 3 && i + d <= 12; r.m.visible = show; r.m.material.color.set(d === 0 ? (i === 0 ? '#7dff9c' : '#ffd34d') : '#59e0ff').multiplyScalar(d === 0 ? 1.8 : 1); r.m.material.opacity = d === 0 ? 0.95 : 0.3; }); }
  endLoop(msg) { if (!this.loop) return; this.loop = null; for (const r of this.rings) r.m.visible = false; G.ui.setObjective(null); if (msg) G.ui.toast(msg, 'info'); }
  updateLoop(dt) {
    const l = this.loop, car = G.car, r = this.rings[l.idx % 12];
    if (l.running) { l.t += dt; if (l.t > 200) return this.endLoop('Speed Loop timed out.'); }
    const d0 = (this.prev.x - r.c.x) * r.n.x + (this.prev.y - r.c.y) * r.n.y + (this.prev.z - r.c.z) * r.n.z, d1 = (car.pos.x - r.c.x) * r.n.x + (car.pos.y - r.c.y) * r.n.y + (car.pos.z - r.c.z) * r.n.z;
    if (d0 < 0 && d1 >= 0 && G.player.state === 'drive') {
      const px = car.pos.x - r.n.x * d1 - r.c.x, py = car.pos.y - r.n.y * d1 - r.c.y, pz = car.pos.z - r.n.z * d1 - r.c.z;
      if (px * px + py * py + pz * pz < 9.8 ** 2) {
        if (l.idx === 0) { l.running = true; l.t = 0; }
        l.idx++; if (G.audio) G.audio.blip(660 + l.idx * 40, 0.1);
        if (l.idx > 12) { const t = l.t, s = G.state, medal = LOOP_MEDALS.find((m) => t <= m[0]), best = !s.best.loop || t < s.best.loop; if (best) s.best.loop = t; G.ui.flash(`${medal ? medal[1] : 'FINISHED'} · ${t.toFixed(1)} s`, 3.2); G.economy.earn(medal ? medal[2] : 50, medal ? `Speed Loop ${medal[1].toLowerCase()}` : 'Speed Loop finisher'); Career.add('racer', 'races'); return this.endLoop(best ? 'New personal best on the Speed Loop.' : null); }
        this.paint();
      }
    }
    this.prev.copy(car.pos);
    G.ui.setObjective({ title: 'Aeroport Speed Loop', text: l.running ? `${l.t.toFixed(1)} s · ring ${l.idx - 1} / 12` : 'Fly through the green ring on the west side', sub: `Gold under ${LOOP_MEDALS[0][0]} s. Fast vehicles and boost help.` });
  }

  update(dt, t) {
    G.districts.update(dt, t);
    const m = this.meal;
    if (m) { m.t += dt; if (!m.ready) { m.dish.food.scale.y = Math.max(0.01, smooth(m.t / 5)); if (m.t >= 5) { m.ready = true; if (G.audio) G.audio.blip(880, 0.08); } } else if (G.player.seat !== m.seat && m.t > 60) { m.dish.g.removeFromParent(); this.meal = null; } }
    if (this.vr) this.updateVR(dt, t);
    if (this.qa) this.updateQA(dt);
    if (this.loop) this.updateLoop(dt);
  }
}
