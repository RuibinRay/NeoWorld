// Entertainment and small skill games:
//   Grav-Hoops   anti-gravity basketball on the Skyport sports deck (aim, charge, shoot)
//   Dance floor  rhythm game at the nightly holo-concert (arrow keys on the beat)
//   Diagnostics  technician job at Kinetic Robotics (repeat the fault sequence)
import * as THREE from 'three';
import { G } from '../core/game.js';
import { std, neon, labelTexture } from '../world/materials.js';
import { Career } from './career.js';
import { clamp, RNG } from '../core/util.js';

const FY = 0.15, HY = 4.0, HZ = 46, GRAV = 5.2;
const LANES = { ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3, KeyA: 0, KeyS: 1, KeyW: 2, KeyD: 3 };
const PAD_COL = ['#59e0ff', '#ff7ad9', '#7dff9c', '#ffd34d'];

export class Arcade {
  constructor() {
    const S = G.scene; this.rng = new RNG(77); this.hoops = null; this.dance = null; this.diag = null; this.cx = -106;
    // ---- Grav-Hoops court ----
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(15, 12), std('#1d2433', 0.5, 0.3)); floor.rotation.x = -Math.PI / 2; floor.position.set(this.cx, FY + 0.02, 41.5); floor.receiveShadow = true; S.add(floor);
    const line = new THREE.Mesh(new THREE.RingGeometry(2.6, 2.75, 40), neon('#ff9a52', 1.2)); line.rotation.x = -Math.PI / 2; line.position.set(this.cx, FY + 0.04, 36.5); S.add(line);
    this.hoop = new THREE.Group(); this.hoop.position.set(this.cx, HY, HZ); S.add(this.hoop);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.045, 8, 28), neon('#ff9a52', 1.8)); ring.rotation.x = Math.PI / 2; this.hoop.add(ring);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.4), new THREE.MeshBasicMaterial({ color: 0x59e0ff, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false })); board.position.set(0, 0.55, 0.52); this.hoop.add(board);
    const kiosk = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.5), std('#20262f', 0.4, 0.7)); kiosk.position.set(-97.5, FY + 1.1, 36.5); kiosk.castShadow = true; S.add(kiosk);
    G.colliders.box(-98.1, -96.9, FY, FY + 2.2, 36.25, 36.75);
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.5), new THREE.MeshBasicMaterial({ map: labelTexture('GRAV-HOOPS', { size: 70, color: '#ffb37a' }), transparent: true, depthWrite: false })); lab.position.set(-97.5, FY + 1.7, 36.24); lab.rotation.y = Math.PI; S.add(lab);
    this.balls = []; for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), neon('#ff9a52', 1.3)); m.visible = false; S.add(m); this.balls.push({ m, on: false, v: new THREE.Vector3(), scored: false, t: 0 }); }
    G.interact.add({ pos: { x: -97.5, y: FY, z: 35.4 }, r: 1.9, label: 'Play Grav-Hoops (◈10)', use: () => this.startHoops() });
    // dance pad: a marked spot in front of the stage, lit while the concert is on
    this.pad = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 32), neon('#ff7ad9', 1.6)); this.pad.rotation.x = -Math.PI / 2; this.pad.position.set(-12, FY + 0.05, 30.3); this.pad.visible = false; S.add(this.pad);
    G.interact.add({ pos: { x: -12, y: FY, z: 30.3 }, r: 1.9, prio: 0.4, label: 'Join the dance floor', enabled: () => G.city.places.stage.on && !G.minigame, use: () => this.startDance() });
    addEventListener('keydown', (e) => {
      if (this.dance && e.code in LANES) { e.preventDefault(); if (!e.repeat) this.danceHit(LANES[e.code]); }
      if (this.dance && e.code === 'Escape') this.endDance(true);
      if (this.diag) { if (/^Digit[1-4]$/.test(e.code)) this.diagPress(+e.code.slice(5) - 1); else if (e.code === 'Escape') this.endDiag(); }
    });
  }
  overlay(html) { const m = document.getElementById('mini'); m.style.display = html ? 'flex' : 'none'; if (html) document.getElementById('mini-box').innerHTML = html; }
  lock(on) { G.minigame = on; G.input.blocked = on; if (on) G.input.releasePointer(); else { G.input.hit.clear(); G.ui.cool = 0.3; } }

  // ---- Grav-Hoops ------------------------------------------------------------------------------
  startHoops() {
    const p = G.player;
    if (p.state !== 'walk' || G.minigame || (G.racing && G.racing.gp)) return;
    if (!G.economy.spend(10, 'Grav-Hoops entry')) return;
    p.state = 'busy'; p.busyAnim = 'idle'; p.faceCam = true; p.board = false; p.crouch = false; p.vel.set(0, 0, 0); p.pos.set(this.cx, FY, 36.5); p.yaw = p.camYaw = 0; p.camPitch = 0.12;
    this.hoops = { t: 60, score: 0, streak: 0, makes: 0, ph: 0, c: 0, charging: false };
    G.ui.toast('Grav-Hoops: aim with the mouse or arrow keys, hold Space to charge, release to shoot. F or Esc to stop.', 'info');
  }
  endHoops(quit) {
    const h = this.hoops, p = G.player, s = G.state; this.hoops = null;
    for (const b of this.balls) { b.on = false; b.m.visible = false; }
    if (p.state === 'busy') p.state = 'walk'; G.ui.setObjective(null); G.ui.cool = 0.3; this.hoop.position.x = this.cx;
    const pay = Math.min(250, h.score * 5);
    if (h.score > (s.best.hoops || 0)) { s.best.hoops = h.score; if (h.score) G.ui.toast(`New Grav-Hoops best: ${h.score} points.`, 'good'); }
    if (pay) G.economy.earn(pay, `Grav-Hoops · ${h.makes} baskets`); else G.ui.toast(quit ? 'You walk off the court.' : 'No baskets this round.', 'info');
  }
  updateHoops(dt) {
    const h = this.hoops, p = G.player, inp = G.input;
    if (inp.pressed('KeyF') || inp.pressed('Escape') || p.state !== 'busy') return this.endHoops(true);
    h.t -= dt; h.ph += (0.5 + (1 - h.t / 60) * 0.9) * dt;
    const hx = this.cx + Math.sin(h.ph) * 3.2; this.hoop.position.x = hx;
    const power = 1 - Math.abs(1 - (h.c % 2));
    if (inp.down('Space')) { h.charging = true; h.c += dt / 0.55; }
    else if (h.charging) {
      h.charging = false; h.c = 0;
      const b = this.balls.find((x) => !x.on);
      if (b) {
        const yaw = p.camYaw, el = clamp(0.95 - p.camPitch * 0.7, 0.45, 1.3), v = 6.5 + power * 5.5;
        b.on = true; b.scored = false; b.t = 0; b.m.visible = true; b.m.position.set(p.pos.x + Math.sin(yaw) * 0.4, p.pos.y + 2.0, p.pos.z + Math.cos(yaw) * 0.4);
        b.v.set(Math.sin(yaw) * Math.cos(el) * v, Math.sin(el) * v, Math.cos(yaw) * Math.cos(el) * v); p.play('wave', 0.5); if (G.audio) G.audio.blip(300, 0.06);
      }
    }
    for (const b of this.balls) {
      if (!b.on) continue;
      const q = b.m.position, py = q.y, pz = q.z; b.t += dt; b.v.y -= GRAV * dt; q.addScaledVector(b.v, dt);
      if (!b.scored && py > HY && q.y <= HY && Math.hypot(q.x - hx, q.z - HZ) < 0.5) {
        b.scored = true; h.streak++; h.makes++; h.score += 2 + Math.min(4, h.streak - 1); G.ui.flash(h.streak > 1 ? `SWISH ×${h.streak}` : 'SWISH', 0.9); if (G.audio) { G.audio.blip(880, 0.1); G.audio.blip(1320, 0.07); }
      }
      if (pz < HZ + 0.5 && q.z >= HZ + 0.5 && Math.abs(q.x - hx) < 1.1 && q.y > HY - 0.2 && q.y < HY + 1.3) { q.z = HZ + 0.5; b.v.z *= -0.5; b.v.x *= 0.8; }
      if (q.y < 0.35 || b.t > 7) { b.on = false; b.m.visible = false; if (!b.scored) h.streak = 0; }
    }
    G.ui.setObjective({ title: 'Grav-Hoops', text: `${Math.max(0, Math.ceil(h.t))} s · ${h.score} points · streak ${h.streak}`, sub: `Power ${'▮'.repeat(Math.round(power * 8))}${'▯'.repeat(8 - Math.round(power * 8))}  · look up or down to change the arc` });
    if (h.t <= 0 && !this.balls.some((b) => b.on)) this.endHoops(false);
  }

  // ---- dance floor -------------------------------------------------------------------------------
  startDance() {
    if (G.minigame || G.player.state !== 'walk') return;
    this.lock(true);
    const notes = []; let last = -1;
    for (let i = 0; i < 26; i++) { let lane = Math.floor(this.rng.next() * 4); if (lane === last) lane = (lane + 1) % 4; last = lane; notes.push({ t: 2.4 + i * 0.72, lane, hit: 0 }); }
    this.dance = { t: 0, notes, score: 0, combo: 0, best: 0, msg: 'Feel the beat' };
    this.overlay(`<h2>Commons dance floor</h2><div style="color:var(--dim)">Press the arrow key (or A S W D) as each light reaches the line. Esc to step off.</div>
      <div id="dz" style="position:relative;height:300px;margin-top:12px;background:rgba(255,255,255,0.05);border-radius:6px;overflow:hidden">
        <div style="position:absolute;left:0;right:0;top:86%;height:3px;background:#fff;opacity:0.7"></div>
        ${['←', '↓', '↑', '→'].map((a, i) => `<div style="position:absolute;left:${i * 25}%;width:25%;bottom:4px;text-align:center;color:${PAD_COL[i]};font-size:20px">${a}</div>`).join('')}
        ${notes.map((n, i) => `<i id="dn${i}" style="position:absolute;left:${n.lane * 25 + 6}%;width:13%;height:18px;border-radius:9px;background:${PAD_COL[n.lane]};box-shadow:0 0 12px ${PAD_COL[n.lane]};top:-30px"></i>`).join('')}
      </div><div id="dmsg" style="margin-top:10px;color:var(--txt)"></div>`);
    G.player.play('dance', 24);
  }
  danceHit(lane) {
    const d = this.dance; let best = null, bd = 0.3;
    for (const n of d.notes) { if (n.hit || n.lane !== lane) continue; const e = Math.abs(n.t - d.t); if (e < bd) { bd = e; best = n; } }
    if (!best) { d.combo = 0; d.msg = 'Off beat'; if (G.audio) G.audio.blip(200, 0.04); return; }
    best.hit = 1; d.combo++; d.best = Math.max(d.best, d.combo); d.score += bd < 0.12 ? 100 : 60; d.msg = bd < 0.12 ? 'Perfect' : 'Good'; if (G.audio) G.audio.blip(660 + lane * 110, 0.06);
  }
  updateDance(dt) {
    const d = this.dance; d.t += dt;
    d.notes.forEach((n, i) => {
      const el = document.getElementById('dn' + i); if (!el) return;
      if (!n.hit && d.t - n.t > 0.3) { n.hit = -1; d.combo = 0; d.msg = 'Missed'; }
      const y = 1 - (n.t - d.t) / 1.5;
      el.style.display = n.hit || y < -0.05 ? 'none' : 'block'; el.style.top = `calc(${y * 86}% - 9px)`;
    });
    const m = document.getElementById('dmsg'); if (m) m.textContent = `${d.msg} · combo ${d.combo} · ${d.score} points`;
    if (d.t > d.notes[d.notes.length - 1].t + 1) this.endDance(false);
  }
  endDance(quit) {
    const d = this.dance, s = G.state; this.dance = null; this.overlay(null); this.lock(false); G.player.emote = null;
    const pct = d.score / (d.notes.length * 100), pay = Math.round(pct * 160) + (d.best >= 10 ? 30 : 0);
    if (Math.round(pct * 100) > (s.best.dance || 0)) s.best.dance = Math.round(pct * 100);
    if (pay && !quit) {
      G.economy.earn(pay, `tips from the crowd · ${Math.round(pct * 100)}% on beat`);
      if (pct > 0.6) { s.standing = clamp(s.standing + 1, -100, 100); for (const n of G.npcs.close) if (n.act === 'concert' && n.doing) { n.mem.rep = clamp(n.mem.rep + 1, -100, 100); n.feel('happy', 5); } }
    } else G.ui.toast(quit ? 'You step off the dance floor.' : 'The beat got away from you tonight.', 'info');
  }

  // ---- diagnostics (technician job) ---------------------------------------------------------------
  startDiag() {
    if (G.minigame || G.player.state !== 'walk') return;
    this.lock(true); this.diag = { round: 0, seq: [], phase: 'show', e: -0.6, input: 0, done: 0, flash: -1, ft: 0 };
    this.overlay(`<h2>Diagnostics bench · Kinetic Robotics</h2><div style="color:var(--dim)">A unit plays back its fault pattern. Repeat it with keys 1 to 4 (or click). Five units, each pattern one step longer. Esc to stop.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:16px auto 8px;width:260px">${PAD_COL.map((c, i) => `<button id="dp${i}" style="height:90px;border-radius:10px;border:2px solid ${c};background:${c};opacity:0.22;color:#000;font:700 22px system-ui;cursor:pointer">${i + 1}</button>`).join('')}</div>
      <div id="dgmsg" style="text-align:center;color:var(--txt)"></div>`);
    PAD_COL.forEach((c, i) => { document.getElementById('dp' + i).onclick = () => this.diagPress(i); });
    this.diagNext();
  }
  diagNext() { const d = this.diag; d.seq = Array.from({ length: 3 + d.round }, () => Math.floor(this.rng.next() * 4)); d.phase = 'show'; d.e = -0.6; d.input = 0; }
  diagPress(k) {
    const d = this.diag; if (!d || d.phase !== 'input') return;
    d.flash = k; d.ft = 0.2;
    if (k !== d.seq[d.input]) { if (G.audio) G.audio.blip(180, 0.1); return this.endDiag(); }
    if (G.audio) G.audio.blip(440 + k * 110, 0.07);
    if (++d.input >= d.seq.length) { d.done++; d.round++; if (d.round >= 5) return this.endDiag(); this.diagNext(); }
  }
  updateDiag(dt) {
    const d = this.diag; let lit = -1;
    if (d.phase === 'show') { d.e += dt; const i = Math.floor(d.e / 0.56); if (d.e >= 0 && i < d.seq.length) { if (d.e % 0.56 < 0.42) lit = d.seq[i]; } else if (i >= d.seq.length) d.phase = 'input'; }
    if (d.ft > 0) { d.ft -= dt; lit = d.flash; }
    for (let i = 0; i < 4; i++) { const el = document.getElementById('dp' + i); if (el) el.style.opacity = i === lit ? 1 : 0.22; }
    const m = document.getElementById('dgmsg'); if (m) m.textContent = `Unit ${Math.min(5, d.round + 1)} of 5 · ${d.phase === 'show' ? 'watch the pattern' : `your turn: ${d.input} / ${d.seq.length}`}`;
  }
  endDiag() {
    const d = this.diag; this.diag = null; this.overlay(null); this.lock(false);
    if (!d.done) { G.ui.toast('The unit goes back on the shelf, undiagnosed.', 'info'); return; }
    const pay = Math.round((40 + 45 * d.done) * Career.mult('mechanic'));
    G.economy.earn(pay, `diagnostics · ${d.done} of 5 units cleared`); Career.add('mechanic', 'repairs');
    const kit = G.npcs.byId.get('clerk'); if (kit) { kit.mem.rep = clamp(kit.mem.rep + d.done, -100, 100); if (kit.isNear) G.ui.say(kit, d.done >= 5 ? 'All five cleared. You have steadier hands than my last technician.' : 'Thank you. The rest can wait for the night shift.'); }
    G.skip(30, -4, true);
  }

  update(dt) {
    this.pad.visible = G.city.places.stage.on;
    if (this.hoops) this.updateHoops(dt);
    if (this.dance) this.updateDance(dt);
    if (this.diag) this.updateDiag(dt);
  }
}
