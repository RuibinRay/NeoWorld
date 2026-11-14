// More to do:
//   Bowling     Sim Arena lanes, Neon District (time the release; five frames)
//   Darts       Tin Lantern bar, Undercity (throw as the crosshair drifts over the board)
//   Fishing     the jetty on the Bio-Eden lake (hook the bite, then keep tension on the line)
//   Cabinets    two arcade machines in the Sim Arena (Neon Breaker, Sky Dodge)
//   Milestones  optional goals with small rewards, listed in the lens
//   Photo mode  O hides the interface
import * as THREE from 'three';
import { G } from '../core/game.js';
import { std, neon } from '../world/materials.js';
import { clamp, RNG } from '../core/util.js';

const PINS = [[0, 0], [1, -0.15], [1, 0.15], [2, -0.3], [2, 0], [2, 0.3], [3, -0.45], [3, -0.15], [3, 0.15], [3, 0.45]];
const FISH = [['Eden minnow', 6, 10, 0.5], ['Glass trout', 14, 22, 0.3], ['Lantern carp', 32, 30, 0.15], ['Old Man Koi', 90, 0, 0.05]];

export class Games {
  constructor() {
    const I = G.interact, N = G.districts.byId.neon.things, B = G.districts.byId.bioeden.things, S = G.scene;
    this.rng = new RNG(4321); this.bowl = null; this.darts = null; this.fish = null; this.cab = null; this.mileT = 3; this.photo = false;
    // bowling: ten pins and a ball on the middle lane
    const lane = N.lanes[1]; this.lane = lane; this.pinX = N.pinX;
    const pinG = new THREE.CylinderGeometry(0.045, 0.06, 0.38, 10), pinM = std('#f1ede6', 0.4, 0.1);
    this.pins = PINS.map(([r, l]) => { const m = new THREE.Mesh(pinG, pinM); m.position.set(this.pinX + r * 0.27, lane.y + 0.27, lane.z + l); S.add(m); return { m, r, l, up: true, x: m.position.x }; });
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 12), neon('#59e0ff', 1.3)); this.ball.visible = false; S.add(this.ball);
    I.add({ pos: N.bowl, r: 2.2, yTol: 2, label: 'Bowl five frames (◈12)', enabled: () => !G.minigame, use: () => this.startBowl() });
    I.add({ pos: N.darts, r: 2, yTol: 2, label: 'Throw darts (◈8)', enabled: () => !G.minigame, use: () => this.startDarts() });
    N.cabinets.forEach((pos, i) => I.add({ pos, r: 1.5, yTol: 2, label: `Play ${['Neon Breaker', 'Sky Dodge'][i]} (◈3)`, enabled: () => !G.minigame, use: () => this.startCab(i) }));
    I.add({ pos: B.fish, r: 2, yTol: 2, label: 'Fish from the jetty', enabled: () => !G.minigame, use: () => this.startFish() });
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const sp = e.code === 'Space', esc = e.code === 'Escape';
      if (this.bowl) { if (sp) { e.preventDefault(); this.bowlThrow(); } else if (esc) this.endBowl(true); }
      else if (this.darts) { if (sp) { e.preventDefault(); this.dartThrow(); } else if (esc) this.endDarts(true); }
      else if (this.fish) { if (sp) { e.preventDefault(); this.fishKey(); } else if (esc) this.endFish(); }
      else if (this.cab) { if (esc) this.endCab(); }
      else if (e.code === 'KeyO' && G.started && !G.ui.menu && !G.ui.titleOpen) { this.photo = !this.photo; G.ui.root.style.opacity = this.photo ? 0 : 1; }
    });
  }
  ov(html) { G.arcade.overlay(html); }
  hold(on, yaw) { const p = G.player; G.arcade.lock(on); if (on) { if (p.state === 'sit') p.stand(); p.state = 'busy'; p.busyAnim = 'idle'; p.faceCam = false; p.board = false; p.jet = false; p.vel.set(0, 0, 0); if (yaw !== undefined) p.yaw = p.camYaw = yaw; } else if (p.state === 'busy') p.state = 'walk'; }
  best(key, v) { const b = G.state.best; if (v > (b[key] || 0)) { b[key] = v; return true; } return false; }

  // ---- bowling -----------------------------------------------------------------------------
  startBowl() {
    if (!G.economy.spend(12, 'five frames at the Sim Arena')) return;
    const p = G.player, l = this.lane; this.hold(true, Math.PI / 2); p.pos.set(l.x - 1.4, l.y, l.z); p.camPitch = 0.16;
    this.bowl = { frame: 1, ball: 1, score: 0, phase: 'aim', t: 0, aim: 0, z: 0, log: [] };
    this.resetPins(); this.bowlHud();
  }
  resetPins() { for (const q of this.pins) { q.up = true; q.m.visible = true; q.m.rotation.set(0, 0, 0); q.m.position.set(q.x, this.lane.y + 0.27, this.lane.z + q.l); } }
  bowlHud(msg) {
    const b = this.bowl;
    this.ov(`<h2>Sim Arena lanes</h2><div style="color:var(--dim)">Frame ${Math.min(5, b.frame)} of 5 · ball ${b.ball} · score <b style="color:#fff">${b.score}</b> ${b.log.length ? '· ' + b.log.join(' ') : ''}</div>
      <div class="track"><div class="zone" style="left:44%;width:12%"></div><div class="needle" id="bw-n" style="left:50%"></div></div>
      <div style="color:var(--dim);font-size:12.5px">${msg || 'Press <b>Space</b> when the marker is where you want the ball. The middle is the pocket. <b>Esc</b> leaves.'}</div>`);
  }
  bowlThrow() {
    const b = this.bowl; if (b.phase !== 'aim') return;
    b.phase = 'roll'; b.t = 0; b.z = b.aim * 0.62; G.player.play('work', 0.6);
    this.ball.visible = true; this.ball.position.set(this.lane.x + 0.2, this.lane.y + 0.17, this.lane.z + b.z * 0.4); if (G.audio) G.audio.burst(1.6, 0.08, 300);
  }
  bowlResolve() {
    const b = this.bowl, z = b.z, gutter = Math.abs(z) > 0.52, r = this.rng; let n = 0;
    if (!gutter) {
      const pocket = Math.abs(z) < 0.07;
      for (const q of this.pins) if (q.up && (pocket ? r.chance(0.96) : Math.abs(q.l - z) < 0.12 + q.r * 0.085 && r.chance(0.92))) q.hit = true;
      for (let pass = 0; pass < 2; pass++) for (const q of this.pins) if (q.up && !q.hit && this.pins.some((o) => o.hit && o.r === q.r - 1 && Math.abs(o.l - q.l) < 0.2) && r.chance(0.45)) q.hit = true;   // pins take their neighbors down
    }
    for (const q of this.pins) if (q.hit) { q.hit = false; q.up = false; n++; q.m.rotation.z = (q.l >= z ? -1 : 1) * 1.45; q.m.position.y = this.lane.y + 0.07; }
    const left = this.pins.filter((q) => q.up).length, strike = b.ball === 1 && left === 0, spare = b.ball === 2 && left === 0;
    b.score += n + (strike ? 10 : spare ? 5 : 0); b.log.push(strike ? 'X' : spare ? '/' : gutter ? '-' : String(n));
    if (G.audio) { if (n) G.audio.burst(0.5, 0.2 + n * 0.02, 1400, 'bandpass'); if (strike) G.audio.ui('pay'); }
    if (strike) G.ui.flash('STRIKE'); else if (spare) G.ui.flash('SPARE');
    b.phase = 'settle'; b.t = 0; b.next = strike || b.ball === 2;
  }
  updateBowl(dt) {
    const b = this.bowl; b.t += dt;
    if (b.phase === 'aim') { b.aim = Math.sin(b.t * 2.3); const n = document.getElementById('bw-n'); if (n) n.style.left = 50 + b.aim * 46 + '%'; }
    else if (b.phase === 'roll') {
      const len = this.pinX - this.lane.x, T = len / 9.5, k = Math.min(1, b.t / T);
      this.ball.position.x = this.lane.x + 0.2 + k * len; this.ball.position.z = this.lane.z + b.z * (0.4 + 0.6 * k); this.ball.rotation.z -= dt * 30;
      if (Math.abs(b.z) > 0.52 && k > 0.35) this.ball.position.z = this.lane.z + Math.sign(b.z) * 0.7;
      if (k >= 1) { this.ball.visible = false; this.bowlResolve(); }
    } else if (b.phase === 'settle' && b.t > 1.3) {
      if (b.next) { b.frame++; b.ball = 1; for (const q of this.pins) q.m.visible = true; this.resetPins(); } else { b.ball = 2; for (const q of this.pins) if (!q.up) q.m.visible = false; }
      if (b.frame > 5) return this.endBowl(false);
      b.phase = 'aim'; b.t = this.rng.range(0, 3); this.bowlHud();
    }
  }
  endBowl(quit) {
    const b = this.bowl; this.bowl = null; this.ov(null); this.hold(false); this.ball.visible = false; this.resetPins();
    if (quit) return G.ui.toast('You hand the ball back.', 'info');
    const pay = b.score >= 75 ? 120 : b.score >= 50 ? 60 : b.score >= 30 ? 25 : 0, rec = this.best('bowl', b.score);
    G.ui.toast(`Final score ${b.score}${rec ? ': a new personal best' : ''}.`, 'good'); if (pay) G.economy.earn(pay, 'lane prize');
  }

  // ---- darts -------------------------------------------------------------------------------
  startDarts() {
    if (!G.economy.spend(8, 'nine darts at the Tin Lantern')) return;
    this.hold(true, Math.PI / 2); this.darts = { n: 0, score: 0, t: this.rng.range(0, 9), hits: [], x: 0, y: 0, wait: 0 };
    this.ov(`<h2>Tin Lantern darts</h2><div style="color:var(--dim)" id="dt-s"></div><canvas id="dt-c" width="320" height="320" style="display:block;margin:12px auto;border-radius:8px"></canvas><div style="color:var(--dim);font-size:12.5px"><b>Space</b> throws where the crosshair is. Nine darts. <b>Esc</b> leaves.</div>`);
  }
  dartThrow() {
    const d = this.darts; if (d.wait > 0 || d.n >= 9) return;
    const x = d.x + this.rng.range(-5, 5), y = d.y + this.rng.range(-5, 5), r = Math.hypot(x, y), pts = r < 9 ? 50 : r < 22 ? 25 : r < 48 ? 15 : r < 80 ? 10 : r < 112 ? 5 : 0;
    d.hits.push([x, y]); d.score += pts; d.n++; d.wait = 0.5; if (pts === 50) { G.ui.flash('BULLSEYE'); G.state.done.bull = true; }
    if (G.audio) G.audio.burst(0.08, 0.2, 2200, 'bandpass');
    if (d.n >= 9) d.wait = 1.6;
  }
  updateDarts(dt) {
    const d = this.darts; d.t += dt; d.wait -= dt;
    if (d.n >= 9 && d.wait <= 0) return this.endDarts(false);
    d.x = Math.sin(d.t * 1.7) * 92 + Math.sin(d.t * 3.3) * 26; d.y = Math.cos(d.t * 1.3) * 92 + Math.sin(d.t * 2.9) * 26;
    const cv = document.getElementById('dt-c'); if (!cv) return;
    const g = cv.getContext('2d'), c = 160;
    g.fillStyle = '#0b0f17'; g.fillRect(0, 0, 320, 320);
    [[112, '#1c2230'], [80, '#e9e3d5'], [48, '#1c2230'], [22, '#2f8f5a'], [9, '#d23b3b']].forEach(([r, col]) => { g.fillStyle = col; g.beginPath(); g.arc(c, c, r, 0, 6.3); g.fill(); });
    g.strokeStyle = '#5a6578'; g.lineWidth = 1; for (let i = 0; i < 10; i++) { g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(i * 0.628) * 112, c + Math.sin(i * 0.628) * 112); g.stroke(); }
    g.fillStyle = '#ffd34d'; for (const [x, y] of d.hits) { g.beginPath(); g.arc(c + x, c + y, 4, 0, 6.3); g.fill(); }
    if (d.n < 9) { g.strokeStyle = '#7fe9ff'; g.lineWidth = 2; g.beginPath(); g.arc(c + d.x, c + d.y, 10, 0, 6.3); g.moveTo(c + d.x - 16, c + d.y); g.lineTo(c + d.x + 16, c + d.y); g.moveTo(c + d.x, c + d.y - 16); g.lineTo(c + d.x, c + d.y + 16); g.stroke(); }
    document.getElementById('dt-s').innerHTML = `Dart ${Math.min(9, d.n + 1)} of 9 · score <b style="color:#fff">${d.score}</b>`;
  }
  endDarts(quit) {
    const d = this.darts; this.darts = null; this.ov(null); this.hold(false);
    if (quit) return;
    const pay = d.score >= 200 ? 100 : d.score >= 130 ? 50 : d.score >= 80 ? 20 : 0, rec = this.best('darts', d.score);
    G.ui.toast(`Darts: ${d.score}${rec ? ', a new personal best' : ''}.`, 'good'); if (pay) G.economy.earn(pay, 'house prize');
  }

  // ---- fishing -----------------------------------------------------------------------------
  startFish(title) {
    this.fishTitle = title || 'Bio-Eden jetty';
    this.hold(true, -Math.PI / 2); G.player.busyAnim = 'work';
    this.fish = { phase: 'wait', t: this.rng.range(2, 6), f: 0.5, b: 0.3, v: 0, prog: 0.25, ft: 0 };
    this.fishHud('You cast. Watch the float.');
  }
  fishHud(msg, bar) {
    this.ov(`<h2>${this.fishTitle || 'Bio-Eden jetty'}</h2><div style="color:var(--dim)" id="fs-m">${msg}</div>${bar ? '<div class="track"><div class="zone" id="fs-z" style="left:40%;width:22%"></div><div class="needle" id="fs-n"></div></div><div class="bar"><i id="fs-p" style="width:25%"></i></div><div style="color:var(--dim);font-size:12.5px;margin-top:8px">Hold <b>Space</b> to reel. Keep the marker inside the green band while the fish pulls.</div>' : '<div style="color:var(--dim);font-size:12.5px;margin-top:10px"><b>Space</b> when it bites. <b>Esc</b> packs up.</div>'}`);
  }
  fishKey() { const f = this.fish; if (f.phase === 'bite') { f.phase = 'reel'; f.t = 0; this.fishHud('Hooked. Bring it in.', true); if (G.audio) G.audio.ui('pick'); } else if (f.phase === 'wait') { f.t = this.rng.range(2, 5); const m = document.getElementById('fs-m'); if (m) m.textContent = 'Too early. You recast.'; } }
  updateFish(dt) {
    const f = this.fish;
    if (f.phase === 'wait') { f.t -= dt; if (f.t <= 0) { f.phase = 'bite'; f.t = 0.95; const m = document.getElementById('fs-m'); if (m) m.innerHTML = '<b style="color:#ffd34d;font-size:18px">A bite!</b>'; if (G.audio) G.audio.burst(0.2, 0.12, 900, 'bandpass'); } }
    else if (f.phase === 'bite') { f.t -= dt; if (f.t <= 0) { f.phase = 'wait'; f.t = this.rng.range(2, 6); const m = document.getElementById('fs-m'); if (m) m.textContent = 'It got away with the bait. You cast again.'; } }
    else if (f.phase === 'reel') {
      f.ft += dt; f.f = clamp(0.5 + Math.sin(f.ft * 1.7) * 0.28 + Math.sin(f.ft * 4.1) * 0.12, 0.05, 0.95);
      f.v += (G.input.downRaw('Space') ? 2.6 : -2.2) * dt; f.v *= 1 - 2.5 * dt; f.b = clamp(f.b + f.v * dt, 0, 1); if (f.b === 0 || f.b === 1) f.v = 0;
      f.prog = clamp(f.prog + (Math.abs(f.b - f.f) < 0.12 ? 0.2 : -0.16) * dt, 0, 1);
      const z = document.getElementById('fs-z'), n = document.getElementById('fs-n'), pr = document.getElementById('fs-p');
      if (z) { z.style.left = (f.f - 0.12) * 100 + '%'; z.style.width = '24%'; n.style.left = f.b * 100 + '%'; pr.style.width = f.prog * 100 + '%'; }
      if (f.prog >= 1) return this.landFish();
      if (f.prog <= 0) { G.ui.toast('The line goes slack. It is gone.', 'info'); this.fish.phase = 'wait'; this.fish.t = this.rng.range(2, 5); this.fish.prog = 0.25; this.fishHud('You cast again.'); }
    }
  }
  landFish() {
    let x = this.rng.next(), kind = FISH[0]; for (const k of FISH) { if (x < k[3]) { kind = k; break; } x -= k[3]; }
    const [name, value, energy] = kind, s = G.state; this.endFish(true); this.best('fish', value); G.ui.flash(name.toUpperCase());
    G.ui.openMenu({ title: `You landed: ${name}`, who: 'Bio-Eden lake', body: value >= 90 ? 'Forty years old if it is a day. The orchard unit has a name for this one.' : 'It flashes silver on the boards.', options: [
      ...(!s.home.decor.aquarium ? [{ label: 'Keep it alive for an aquarium at home', desc: 'A tank is delivered to your home', onPick: () => { s.home.decor.aquarium = true; G.home.refresh(); G.ui.toast('An aquarium is waiting at home.', 'good'); } }] : []),
      ...(energy ? [{ label: 'Keep it for the pan', desc: `Pocket food: +${energy}% energy`, onPick: () => G.food.pocket({ name: `Grilled ${name.toLowerCase()}`, energy }) }] : []),
      { label: `Sell it to the cafe (◈${value})`, onPick: () => G.economy.earn(value, name.toLowerCase()) },
      { label: 'Let it go', onPick: () => {} }] });
  }
  endFish(silent) { this.fish = null; this.ov(null); this.hold(false); G.player.busyAnim = 'idle'; if (!silent) G.ui.toast('You reel in and pack up.', 'info'); }

  // ---- arcade cabinets -----------------------------------------------------------------------
  startCab(kind) {
    if (!G.economy.spend(3, kind ? 'Sky Dodge' : 'Neon Breaker')) return;
    this.hold(true, -Math.PI / 2);
    const c = (this.cab = { kind, t: 0, score: 0, lives: 3, x: 160, over: 0 });
    if (kind === 0) { c.bx = 160; c.by = 300; c.vx = 130; c.vy = -210; c.bricks = []; for (let r = 0; r < 5; r++) for (let i = 0; i < 8; i++) c.bricks.push({ x: 8 + i * 38, y: 40 + r * 20, on: true, col: ['#ff7ad9', '#ffd34d', '#7dff9c', '#59e0ff', '#b98cff'][r] }); }
    else { c.rocks = []; c.spawn = 0; }
    this.ov(`<h2>${kind ? 'Sky Dodge' : 'Neon Breaker'}</h2><canvas id="cb-c" width="320" height="400" style="display:block;margin:10px auto;border-radius:6px;background:#05070b"></canvas><div style="color:var(--dim);font-size:12.5px"><b>A / D</b> or the arrow keys move. <b>Esc</b> leaves.</div>`);
  }
  updateCab(dt) {
    const c = this.cab, cv = document.getElementById('cb-c'), inp = G.input; if (!cv) return;
    const g = cv.getContext('2d'), dir = (inp.downRaw('KeyD') || inp.downRaw('ArrowRight') ? 1 : 0) - (inp.downRaw('KeyA') || inp.downRaw('ArrowLeft') ? 1 : 0);
    c.t += dt; if (c.over > 0) { c.over -= dt; if (c.over <= 0) return this.endCab(); }
    else if (c.kind === 0) {
      c.x = clamp(c.x + dir * 260 * dt, 32, 288); c.bx += c.vx * dt; c.by += c.vy * dt;
      if (c.bx < 6 || c.bx > 314) { c.vx = -c.vx; c.bx = clamp(c.bx, 6, 314); } if (c.by < 6) { c.vy = Math.abs(c.vy); }
      if (c.by > 368 && c.by < 382 && Math.abs(c.bx - c.x) < 36 && c.vy > 0) { c.vy = -Math.abs(c.vy) * 1.02; c.vx = (c.bx - c.x) * 6.5; if (G.audio) G.audio.blip(520, 0.03); }
      for (const b of c.bricks) if (b.on && c.bx > b.x - 4 && c.bx < b.x + 38 && c.by > b.y - 4 && c.by < b.y + 18) { b.on = false; c.vy = -c.vy; c.score += 10; if (G.audio) G.audio.blip(880, 0.03); break; }
      if (c.by > 404) { c.lives--; c.bx = c.x; c.by = 300; c.vx = 130 * (Math.random() < 0.5 ? -1 : 1); c.vy = -210; if (c.lives <= 0) c.over = 1.5; }
      if (c.bricks.every((b) => !b.on)) { c.score += 100; c.over = 1.5; }
    } else {
      c.x = clamp(c.x + dir * 280 * dt, 14, 306); c.spawn -= dt; c.score = Math.floor(c.t * 10);
      if (c.spawn <= 0) { c.spawn = Math.max(0.16, 0.55 - c.t * 0.008); c.rocks.push({ x: 12 + Math.random() * 296, y: -20, v: 150 + Math.random() * 120 + c.t * 4, s: 10 + Math.random() * 14 }); }
      for (const r of c.rocks) { r.y += r.v * dt; if (r.y > 356 && r.y < 392 && Math.abs(r.x - c.x) < r.s + 10) { r.y = 999; c.lives--; if (G.audio) G.audio.thud(0.3); if (c.lives <= 0) c.over = 1.5; } }
      c.rocks = c.rocks.filter((r) => r.y < 420); if (c.t > 60) c.over = 1.5;
    }
    g.fillStyle = '#05070b'; g.fillRect(0, 0, 320, 400);
    if (c.kind === 0) { for (const b of c.bricks) if (b.on) { g.fillStyle = b.col; g.fillRect(b.x, b.y, 34, 14); } g.fillStyle = '#e8f4fb'; g.fillRect(c.x - 32, 376, 64, 8); g.beginPath(); g.arc(c.bx, c.by, 5, 0, 6.3); g.fill(); }
    else { g.fillStyle = '#ff7ad9'; for (const r of c.rocks) g.fillRect(r.x - r.s, r.y - r.s, r.s * 2, r.s * 2); g.fillStyle = '#59e0ff'; g.beginPath(); g.moveTo(c.x, 360); g.lineTo(c.x + 12, 388); g.lineTo(c.x - 12, 388); g.closePath(); g.fill(); }
    g.fillStyle = '#9db3c4'; g.font = '600 13px ui-monospace, monospace'; g.fillText(`SCORE ${c.score}`, 8, 18); g.fillText('♥'.repeat(Math.max(0, c.lives)), 270, 18);
    if (c.over > 0) { g.fillStyle = '#fff'; g.font = '700 22px system-ui'; g.textAlign = 'center'; g.fillText('GAME OVER', 160, 210); g.textAlign = 'start'; }
  }
  endCab() {
    const c = this.cab; this.cab = null; this.ov(null); this.hold(false);
    const key = c.kind ? 'dodge' : 'breaker', rec = this.best(key, c.score), pay = Math.min(30, Math.floor(c.score / 15));
    G.ui.toast(`${c.kind ? 'Sky Dodge' : 'Neon Breaker'}: ${c.score}${rec ? ', a new high score' : ''}.`, 'good'); if (pay) G.economy.earn(pay, 'prize tickets');
  }

  // ---- milestones ----------------------------------------------------------------------------
  list() {
    const s = G.state, d = s.done, shops = G.city.stores.filter((st) => st.kind !== 'home');
    return [
      ['home', 'A place of your own', 'Buy a home: the sky pod, a villa, the townhouse or the beach villa', () => s.owns.apartment || s.owns.villa || s.owns.townhouse || s.owns.beachvilla, 0],
      ['landlord', 'Landlord', 'Rent out a home and collect the rent', () => !!d.rentPaid, 100],
      ['gates', 'Six gates', 'Attune the transit gate in every district', () => G.districts.list.every((q) => s.gates[q.id]), 300],
      ['shops', 'Window shopper', `Walk into every shop (${shops.filter((st) => d['in:' + st.id]).length} of ${shops.length})`, () => shops.every((st) => d['in:' + st.id]), 200],
      ['rides', 'Passenger', 'Ride the maglev, the robo-bus, the tram and a sky cab', () => d.maglev && d.bus && d.tram && d.cab, 150],
      ['fleet', 'Collector', 'Own three vehicles', () => s.garage.owned.length >= 3, 250],
      ['decor', 'Nesting', 'Furnish your home with five pieces', () => Object.values(s.home.decor).filter(Boolean).length >= 5, 150],
      ['bowl', 'Clean game', 'Bowl 75 or better over five frames', () => (s.best.bowl || 0) >= 75, 100],
      ['bull', 'Dead centre', 'Hit a bullseye at the Tin Lantern', () => !!d.bull, 60],
      ['koi', 'The old man', 'Land the Old Man Koi', () => (s.best.fish || 0) >= 90, 200],
      ['caches', 'Archivist', 'Find every data cache', () => G.city.caches.every((c) => c.found), 500],
      ['high', 'Thin air', 'Take the jet harness above 200 m', () => !!d.high, 80],
      ['faces', 'Familiar face', 'Meet 25 residents', () => Object.values(s.people).filter((m) => m.met).length >= 25, 100],
      ['edge', 'Edge of the map', 'Visit the gates at the park, the bay, the port, the Heights and Beacon Isle', () => ['park', 'solara', 'port', 'heights', 'isle'].every((id) => s.gates[id]), 300],
      ['lines', 'Season ticket', 'Ride all three avenue bus lines', () => d.M1 && d.M2 && d.M3, 120],
      ['sea', 'Sea legs', 'Ride the bay ferry, a jet-ski and the big wheel', () => d.ferry && d.jet && s.street.wheel, 150],
      ['bayrun', 'Flat out', 'Finish the jet-ski bay run in under a minute', () => !!s.best.jetski && s.best.jetski < 60, 120],
      ['parkday', 'A day in the park', 'Row to the island and climb the lookout hill', () => d.island && d.lookout, 100],
      ['citizen', 'Good citizen', `Bin 30 pieces of litter and deliver 5 parcels (${Math.min(30, s.street.litter)} and ${Math.min(5, s.street.parcels)})`, () => s.street.litter >= 30 && s.street.parcels >= 5, 200],
      ['showtime', 'Night out', 'Catch Arbor Live from the front, and watch the fireworks over the bay', () => d.frontRow && d.fireworks, 120],
      ['fan', 'Season ticket holder', 'Watch a whole skyball match from your seat', () => !!d.fullMatch, 100],
      ['expo', 'Expo pass', 'Read all six exhibits in the Expo Hall', () => [0, 1, 2, 3, 4, 5].every((k) => d['ex:' + k]), 60],
      ['racer2', 'Street and water', 'Win the Night Run and Canal Dash', () => d.streetWin && d.canalWin, 250],
      ['cabbie', 'Cabbie', 'Drive 10 street taxi fares', () => (d.streetFares || 0) >= 10, 120],
      ['market', 'Market day', 'Buy something at the weekend market', () => !!d.market, 40],
      ['traceur', 'Traceur', 'Finish the Skyline Run over the rooftops by Meridian', () => !!d.skyline, 80],
      ['skygold', 'Roof runner', 'Take gold on the Skyline Run', () => !!d.skylineGold, 150],
      ['climber', 'Hands on', `Pull yourself up onto 25 ledges (${Math.min(25, d.climbs || 0)})`, () => (d.climbs || 0) >= 25, 40],
      ['botchamp', 'Bot Arena champion', 'Win the Bot Arena Cup at the Industrial Nexus', () => !!d.botcup, 200],
      ['orbit', 'Halfway to the stars', 'Ride the orbital lift up to Skyline Station', () => !!d.orbit, 60],
      ['fleet', 'Fleet owner', 'Have three of your vehicles out round the city at once', () => (s.garage.out || []).length >= 2, 80],
      ['gridkeeper', 'Gridkeeper', 'Finish the story, The Quiet Signal', () => (s.story && s.story.m) >= 7, 300],
      ['neighbour', 'Good neighbour', `Help out at 5 street incidents: breakdowns, fires, lost dogs (${Math.min(5, d.helped || 0)})`, () => (d.helped || 0) >= 5, 120],
      ['diver', 'Deep diver', 'Dive to the wreck off Solara Bay and open the sealed crate', () => !!d.wreck, 120],
      ['skybar', 'High society', 'Have a drink at both rooftop bars: Halcyon Sky Bar and Cloud Nine', () => !!(d['bar:halcyon'] && d['bar:spire']), 80],
      ['scholar', 'Scholar', 'Read all six pages of the city archive in the Institute library', () => [0, 1, 2, 3, 4, 5].every((k) => d['arch:' + k]), 60],
      ['line9', 'To the coast', 'Ride maglev line 9 from Meridian Gate to Solara Bay', () => !!d.line9, 40],
      ['surveyor', 'Surveyor', 'Photograph all eight landmarks for Dr. Okafor\'s skyline survey', () => !!d.survey, 150],
      ['podhunter', 'Pod hunter', 'Find all six lost data pods on the reefs off the coast', () => !!d.pods, 120],
      ['league', 'Beach league', 'Return 8 of 10 serves at beach volleyball', () => (s.best.volley || 0) >= 8, 80],
    ];
  }
  menu() {
    const all = this.list(), n = all.filter((m) => G.state.done['m:' + m[0]]).length;
    G.ui.openMenu({ title: 'Milestones', who: `${n} of ${all.length} · none of them are required`, wide: true,
      html: all.map(([id, name, how, , pay]) => { const ok = G.state.done['m:' + id]; return `<p style="margin:0 0 7px;${ok ? 'color:var(--ok)' : ''}">${ok ? '✓' : '○'} <b>${name}</b> <span style="color:var(--dim)">· ${how}${pay ? ` · ◈${pay}` : ''}</span></p>`; }).join(''),
      options: [{ label: 'Close', onPick: () => {} }] });
  }
  update(dt) {
    if (this.bowl) this.updateBowl(dt); else if (this.darts) this.updateDarts(dt); else if (this.fish) this.updateFish(dt); else if (this.cab) this.updateCab(dt);
    const p = G.player, d = G.state.done;
    if (p.jet && !p.grounded && p.pos.y - G.colliders.groundAt(p.pos.x, p.pos.z, p.pos.y) > 200) d.high = true;
    const st = G.shops.inside; if (st && st.kind !== 'home') d['in:' + st.id] = true;
    if (G.transit.riding) d.maglev = true; if (G.rides.line) { const l = G.rides.line; d[l.name === 'tram' ? 'tram' : l.name === 'ferry' ? 'ferry' : 'bus'] = true; if (l.bus) d[l.bus.line.id] = true; } else if (G.rides.riding) d.cab = true;
    if (G.coast.craft && G.coast.craft.spec.name === 'jet-ski') d.jet = true;
    if (p.state === 'walk' && p.grounded) { if ((p.pos.x - 668) ** 2 + (p.pos.z - 648) ** 2 < 150) d.island = true; if (p.pos.y > 8.6 && (p.pos.x - 880) ** 2 + (p.pos.z - 560) ** 2 < 60) d.lookout = true; }
    this.mileT -= dt; if (this.mileT > 0 || !G.started) return; this.mileT = 2.5;
    for (const [id, name, , test, pay] of this.list()) if (!d['m:' + id] && test()) { d['m:' + id] = true; G.ui.flash('MILESTONE'); G.ui.toast(`Milestone: ${name}.`, 'good'); if (pay) G.economy.earn(pay, 'milestone'); }
  }
}
