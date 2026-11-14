// Things to do on the water and by it: the bay ferry, a rowboat on the park lake, a jet-ski
// in Solara Bay with a buoy run, the big wheel on the pier, beach volleyball, free throws on
// the park court and fishing from the pier.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { PathLine, clamp, damp, dampAngle, TAU } from '../core/util.js';
import { Builder } from '../world/metro/builder.js';
import { waterLevel } from '../world/metro/landuse.js';
import { waveHeight } from '../world/water.js';
// a hull riding the swell: its rise, and the pitch and roll from the water under bow, stern and sides
const ride = (x, z, yaw, L = 1.6, W = 0.8) => { const fx = Math.sin(yaw), fz = Math.cos(yaw), h = waveHeight(x, z); return [h, Math.atan2(waveHeight(x - fx * L, z - fz * L) - waveHeight(x + fx * L, z + fz * L), 2 * L), Math.atan2(waveHeight(x + fz * W, z - fx * W) - waveHeight(x - fz * W, z + fx * W), 2 * W)]; };

const CRAFT = {
  row: { name: 'rowboat', vmax: 4.2, acc: 1.2, turn: 1.1, seat: 0.55, r: 1.3 },
  jet: { name: 'jet-ski', vmax: 24, acc: 1.6, turn: 1.5, seat: 0.75, r: 1.1 },
  canal: { name: 'race boat', vmax: 25, acc: 1.8, turn: 1.6, seat: 0.75, r: 1.1 },
};
const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${Math.floor((s * 10) % 10)}`;

export class Coast {
  constructor() {
    const I = G.interact, M = G.metro, C = M.coast, P = M.park, S = G.scene, p = G.player;
    // ---- ferry: Port -> Beacon Isle -> Solara pier -> Port ----
    const way = [[-320, 1226], [-320, 1305], [120, 1520], [309, 1700], [309, 1746], [330, 1700], [700, 1540], [858, 1440], [858, 1396], [858, 1446], [800, 1464], [740, 1440], [520, 1300], [-200, 1292]].map(([x, z]) => [x, 0, z]);
    const path = new PathLine(way, true), B = new Builder();
    B.box('B', '#e9edf2', 7, 2.6, 22, 0, 0.9, 0); B.box('S', '#2f6f8f', 7.1, 0.6, 22.1, 0, 0.5, 0); B.box('B', '#dfe5ee', 5.6, 2.4, 12, 0, 3.4, -1); B.box('L', '#bfe4ff', 5.7, 1, 10, 0, 3.6, -1); B.box('S', '#c0483f', 1.6, 2.2, 1.6, 0, 5.6, -4); B.box('S', '#232832', 6.6, 0.1, 5, 0, 2.25, 8);
    const fg = B.finish(new THREE.Group()); S.add(fg);
    const stopS = [0, path.len[4], path.len[8]];
    this.ferry = { g: fg, path, s: 0, v: 0, at: 0, dwell: 14, next: 1, p: fg.position, yaw: 0, stopS };
    this.ferryLine = { name: 'ferry', title: 'Bay ferry', pos: fg.position, at: () => this.ferry.at, up: 2.3, stops: C.ferry, sub: 'Tidewater Port · Beacon Isle · Solara pier' };
    G.rides.lines.push(this.ferryLine);
    C.ferry.forEach((st, k) => I.add({ pos: st, r: 8, yTol: 2.5, prio: -0.2, label: 'Board the ferry', enabled: () => this.ferry.at === k && !G.rides.line, use: () => G.rides.board(this.ferryLine) }));
    // ---- rowboat and jet-ski ----
    const boat = (kind) => {
      const b = new Builder();
      if (kind === 'row') { b.box('B', '#8a6a48', 1.5, 0.5, 3.6, 0, 0.2, 0); b.box('S', '#6a4f36', 1.3, 0.08, 0.4, 0, 0.5, -0.4); b.box('S', '#6a4f36', 1.3, 0.08, 0.4, 0, 0.5, 0.9); for (const s of [-1, 1]) b.box('S', '#c9b68f', 0.08, 0.08, 2.6, s * 1.5, 0.55, 0.2, s * 0.5); }
      else { b.box('B', kind === 'canal' ? '#1b2233' : '#e9edf2', 1.1, 0.6, 3, 0, 0.3, 0); b.box('S', kind === 'canal' ? '#ffd34d' : '#c0483f', 0.9, 0.3, 1.4, 0, 0.7, -0.3); b.box('S', '#232832', 0.7, 0.5, 0.2, 0, 1.0, 0.7); b.box('G', '#59e0ff', 1.12, 0.1, 3.02, 0, 0.12, 0); }
      const g = b.finish(new THREE.Group());
      // a seated rider, shown while you are aboard
      const rb = new Builder(); rb.box('S', '#2f4f6f', 0.5, 0.6, 0.3, 0, 1.25, -0.3); rb.box('S', '#c9a58a', 0.26, 0.26, 0.26, 0, 1.72, -0.3); rb.box('S', '#1c1f27', 0.46, 0.2, 0.6, 0, 0.92, 0); rb.box('S', '#2f4f6f', 0.6, 0.14, 0.14, 0, 1.3, 0.25);
      const rider = rb.finish(new THREE.Group()); rider.visible = false; g.add(rider); S.add(g); return { g, rider };
    };
    this.boats = {
      row: { ...boat('row'), spec: CRAFT.row, home: { x: P.jetty.x + 3.6, y: 0, z: P.jetty.z, yaw: Math.PI }, dock: P.jetty },
      jet: { ...boat('jet'), spec: CRAFT.jet, home: { x: C.jetski.x + 2.6, y: 0, z: C.jetski.z + 2, yaw: 0 }, dock: C.jetski },
      // the canal race boat waits by the pontoon at the race start
      canal: { ...boat('canal'), spec: CRAFT.canal, home: { x: 386, y: 0, z: 657.6, yaw: -Math.PI / 2 }, dock: G.metro.landings[0] },
    };
    for (const k in this.boats) { const b = this.boats[k]; b.pos = new THREE.Vector3(b.home.x, 0, b.home.z); b.yaw = b.home.yaw; b.v = 0; b.g.position.set(b.pos.x, waterLevel(b.pos.x, b.pos.z), b.pos.z); b.g.rotation.y = b.yaw; }
    this.craft = null; this.run = null; this.wheel = null; this.rally = null;
    I.add({ pos: P.jetty, r: 3, yTol: 2, label: 'Take out a rowboat', enabled: () => !this.craft && !G.minigame, use: () => this.embark('row') });
    I.add({ pos: C.jetski, r: 3.2, yTol: 2, label: () => (G.state.owns.jetski ? 'Take out a jet-ski (season pass)' : 'Hire a jet-ski (◈15)'), enabled: () => !this.craft && !G.minigame, use: () => { if (G.state.owns.jetski || G.economy.spend(15, 'jet-ski hire')) this.embark('jet'); } });
    I.add({ mode: 'ride', pos: p.pos, r: 6, yTol: 12, label: () => (this.nearDock() ? 'Step off at the jetty' : 'End the hire and return to the jetty'), enabled: () => !!this.craft && this.craft !== this.boats.canal, use: () => this.disembark() });
    // ---- the big wheel ----
    I.add({ pos: C.wheel.board, r: 3.4, yTol: 2, label: 'Ride the big wheel (◈8)', enabled: () => !this.wheel && !G.minigame, use: () => { if (G.economy.spend(8, 'a turn on the big wheel')) this.rideWheel(); } });
    I.add({ mode: 'ride', pos: p.pos, r: 6, yTol: 60, label: 'Get off at the bottom', enabled: () => !!this.wheel, use: () => this.leaveWheel() });
    // ---- games ----
    I.add({ pos: C.volley, r: 4, yTol: 2, label: 'Beach volleyball: ten serves (◈4)', enabled: () => !G.minigame, use: () => { if (G.economy.spend(4, 'a volleyball rally')) this.startRally('volley'); } });
    I.add({ pos: C.fish, r: 2.4, yTol: 2, label: 'Fish from the pier', enabled: () => !G.minigame, use: () => G.games.startFish('Solara pier') });
    addEventListener('keydown', (e) => { if (!this.rally || e.repeat) return; if (e.code === 'Space') { e.preventDefault(); this.swing(); } else if (e.code === 'Escape') this.endRally(true); });
    // the next buoy of the jet-ski run
    this.mark = new THREE.Mesh(new THREE.TorusGeometry(5, 0.25, 6, 28), new THREE.MeshBasicMaterial({ color: 0x7dff9c })); this.mark.rotation.x = Math.PI / 2; this.mark.visible = false; S.add(this.mark);
    this.v = new THREE.Vector3();
  }
  // ---- boats ------------------------------------------------------------------------------------
  nearDock() { const c = this.craft; return c && Math.hypot(c.pos.x - c.home.x, c.pos.z - c.home.z) < 10; }
  embark(kind) {
    const p = G.player, b = this.boats[kind]; this.craft = b; b.rider.visible = true; b.v = 0;
    p.state = 'ride'; p.board = false; p.jet = false; p.firstPerson = false; p.crouch = false; p.vel.set(0, 0, 0); p.camYaw = b.yaw;
    if (kind !== 'canal') G.ui.toast(kind === 'row' ? 'Rowboat: W and S to row, A and D to turn. E at the jetty to step off.' : 'Jet-ski: W to open the throttle, A and D to steer. Pass the first buoy to start the bay run.', 'info');
    if (kind === 'jet') this.run = { i: 0, t: 0, on: false };
  }
  disembark() {
    const p = G.player, b = this.craft; if (!b) return; this.craft = null; this.run = null; this.mark.visible = false; b.rider.visible = false; b.v = 0;
    b.pos.set(b.home.x, 0, b.home.z); b.yaw = b.home.yaw; b.g.position.set(b.pos.x, waterLevel(b.pos.x, b.pos.z), b.pos.z); b.g.rotation.set(0, b.yaw, 0);
    p.pos.set(b.dock.x, b.dock.y, b.dock.z); p.vel.set(0, 0, 0); p.state = 'walk'; p.grounded = true; G.ui.setObjective(null); G.ui.cool = 0.3;
  }
  sail(dt) {
    const b = this.craft, s = b.spec, inp = G.input, col = G.colliders;
    const thr = (inp.down('KeyW') ? 1 : 0) - (inp.down('KeyS') ? 0.5 : 0), steer = (inp.down('KeyA') ? 1 : 0) - (inp.down('KeyD') ? 1 : 0);
    b.v = damp(b.v, thr * s.vmax, thr ? s.acc : 0.7, dt);
    b.yaw += steer * s.turn * dt * clamp(Math.abs(b.v) / s.vmax + 0.35, 0.35, 1) * (b.v < 0 ? -1 : 1);
    const nx = b.pos.x + Math.sin(b.yaw) * b.v * dt, nz = b.pos.z + Math.cos(b.yaw) * b.v * dt;
    // stay on the water and off anything solid (jetties, hulls, the pier pontoon); the sea ends 2.5 km out
    const L = waterLevel(nx, nz) - 0.02; this.v.set(nx, L + 0.3, nz); const hit = col.resolveCircle(this.v, s.r, L + 0.1, L + 1.1);
    if (!G.metro.waterAt(this.v.x, this.v.z) || Math.hypot(this.v.x, this.v.z - 1200) > 2500) b.v *= -0.25; else { b.pos.x = this.v.x; b.pos.z = this.v.z; if (hit) b.v *= 0.93; }
    const lean = clamp(steer * b.v / s.vmax, -1, 1) * (s !== CRAFT.row ? 0.35 : 0.08), [bob, wp, wr] = ride(b.pos.x, b.pos.z, b.yaw);
    const fast = s === CRAFT.jet || s === CRAFT.canal, W = waterLevel(b.pos.x, b.pos.z) - 0.02;
    b.g.position.set(b.pos.x, W + bob + (fast ? Math.min(0.25, Math.abs(b.v) * 0.01) : 0), b.pos.z); b.g.rotation.set((fast ? -Math.min(0.12, Math.abs(b.v) * 0.006) : 0) + wp, b.yaw, -lean + wr);
    G.player.pos.set(b.pos.x, W + s.seat, b.pos.z); G.player.yaw = b.yaw;
    if (s === CRAFT.jet) this.buoyRun(dt, b);
    else if (s === CRAFT.row) G.ui.setObjective({ title: 'On the lake', text: this.nearDock() ? 'At the jetty' : 'Rowing', sub: 'W S to row, A D to turn. E at the jetty to step off.' });
  }
  buoyRun(dt, b) {
    const r = this.run, bu = G.metro.coast.buoys, next = bu[r.i], d = Math.hypot(b.pos.x - next[0], b.pos.z - next[1]);
    this.mark.visible = true; this.mark.position.set(next[0], 1.6 + Math.sin(G.elapsed * 3) * 0.2, next[1]);
    if (r.on) r.t += dt;
    if (d < 9) {
      if (r.i === 0) { r.on = true; r.t = 0; }
      r.i++; if (G.audio) G.audio.blip(700 + r.i * 60, 0.07);
      if (r.i >= bu.length) {
        const best = G.state.best.jetski, rec = !best || r.t < best; if (rec) G.state.best.jetski = +r.t.toFixed(1);
        const pay = r.t < 60 ? 60 : r.t < 80 ? 30 : 10; G.ui.toast(`Bay run: ${fmtT(r.t)}${rec ? ', a new personal best' : ''}.`, 'good'); G.economy.earn(pay, 'bay run prize');
        this.run = { i: 0, t: 0, on: false };
      }
    }
    G.ui.setObjective({ title: 'Jet-ski', text: r.on ? `Bay run: buoy ${r.i + 1} of ${bu.length} · ${fmtT(r.t)}` : 'Pass the marked buoy to start the bay run', sub: `${Math.round(Math.abs(b.v) * 3.6)} km/h · E to end the hire` });
  }
  // ---- big wheel --------------------------------------------------------------------------------
  rideWheel() {
    const p = G.player, w = G.metro.coast.wheel, k = ((Math.round((-w.a % TAU + TAU) % TAU / (TAU / 12))) % 12 + 12) % 12;
    this.wheel = { k, a0: w.a }; p.state = 'ride'; p.board = false; p.jet = false; p.firstPerson = false; p.vel.set(0, 0, 0);
    G.ui.toast('One slow turn above the bay. Look around with the mouse.', 'info');
  }
  leaveWheel() { const p = G.player, b = G.metro.coast.wheel.board; this.wheel = null; p.pos.set(b.x - 4.6, 3.2, b.z); p.vel.set(0, 0, 0); p.state = 'walk'; p.grounded = true; G.ui.setObjective(null); G.ui.cool = 0.3; G.state.street.wheel = true; }
  // ---- timing games: volleyball and free throws -----------------------------------------------
  startRally(kind) {
    const C = G.metro.coast, P = G.metro.park, at = kind === 'volley' ? C.volley : P.court;
    G.games.hold(true, kind === 'volley' ? Math.PI / 2 : Math.PI / 2); G.player.pos.set(at.x, at.y, at.z);
    this.rally = { kind, i: 0, hits: 0, x: 0, dir: 1, speed: 0.9, zone: [0.4, 0.62], wait: 0, msg: kind === 'volley' ? 'The serve is coming over.' : 'Line up the shot.' };
    this.rallyHud();
  }
  rallyHud() {
    const r = this.rally, v = r.kind === 'volley';
    G.games.ov(`<h2>${v ? 'Beach volleyball' : 'Free throws'}</h2><div style="color:var(--dim)" id="ry-m">${r.msg}</div>
      <div class="track"><div class="zone" id="ry-z" style="left:${r.zone[0] * 100}%;width:${(r.zone[1] - r.zone[0]) * 100}%"></div><div class="needle" id="ry-n"></div></div>
      <div style="margin-top:8px">${v ? 'Serve' : 'Shot'} ${Math.min(10, r.i + 1)} of 10 · ${v ? 'returned' : 'made'} <b style="color:#fff">${r.hits}</b></div>
      <div style="color:var(--dim);font-size:12.5px;margin-top:8px">Press <b>Space</b> when the marker is inside the green band. Esc to stop.</div>`);
  }
  swing() {
    const r = this.rally; if (r.wait > 0) return;
    const ok = r.x >= r.zone[0] && r.x <= r.zone[1]; if (ok) r.hits++;
    r.msg = ok ? (r.kind === 'volley' ? 'Clean return.' : 'Nothing but net.') : (r.kind === 'volley' ? 'Into the sand.' : 'Off the rim.');
    if (G.audio) G.audio.blip(ok ? 760 : 240, 0.08); G.player.emote = null;
    r.i++; r.wait = 0.7; r.speed = 0.9 + r.i * 0.11; const w = Math.max(0.1, 0.22 - r.i * 0.012), c = 0.2 + Math.random() * 0.6; r.zone = [clamp(c - w / 2, 0, 1 - w), clamp(c - w / 2, 0, 1 - w) + w];
    if (r.i >= 10) return this.endRally(false);
    this.rallyHud();
  }
  endRally(quit) {
    const r = this.rally; this.rally = null; G.games.ov(null); G.games.hold(false);
    if (quit) return;
    const key = r.kind === 'volley' ? 'volley' : 'court', rec = G.games.best(key, r.hits), pay = r.kind === 'volley' ? r.hits * 4 + (r.hits >= 8 ? 20 : 0) : r.hits * 3 + (r.hits === 10 ? 25 : 0);
    G.ui.toast(`${r.kind === 'volley' ? 'Volleyball' : 'Free throws'}: ${r.hits} of 10${rec ? ', a new personal best' : ''}.`, 'good'); if (pay) G.economy.earn(pay, r.kind === 'volley' ? 'beach league prize' : 'court side bet');
  }
  // ---- shared -----------------------------------------------------------------------------------
  // where to put the player if the game is saved while afloat or on the wheel
  safeSpot() { if (this.craft) return this.craft === this.boats.canal ? this.craft.dock.top : this.craft.dock; if (this.wheel) return { x: 805.4, y: 3.2, z: 1404 }; return null; }
  update(dt, t) {
    // ferry
    const f = this.ferry, T = f.path.total, p = G.player;
    if (f.dwell > 0) { f.dwell -= dt; f.v = damp(f.v, 0, 3, dt); if (f.dwell <= 0) { f.at = -1; } }
    else {
      const ds = (f.stopS[f.next] - f.s + T) % T;
      f.v = damp(f.v, ds < 60 ? 1.2 + ds * 0.14 : 9.5, 0.8, dt);
      if (ds < 0.6 || ds > T - 2) { f.at = f.next; f.next = (f.next + 1) % 3; f.dwell = 14; }
    }
    f.s = (f.s + f.v * dt) % T; const yaw = f.path.sample(f.s, f.p); f.yaw = dampAngle(f.yaw, yaw, 2.5, dt); f.p.y = Math.sin(t * 1.3) * 0.05; f.g.rotation.y = f.yaw;
    if (G.rides.line === this.ferryLine) G.ui.setObjective({ title: 'Bay ferry', text: f.at >= 0 ? `At ${this.ferryLine.stops[f.at].name}` : `Next: ${this.ferryLine.stops[f.next].name}`, sub: f.at >= 0 ? 'Press E to get off, or stay on.' : this.ferryLine.sub });
    if (this.craft) { if (p.state !== 'ride') this.disembark(); else this.sail(dt); }
    // the boats at their moorings ride the swell too
    for (const k in this.boats) { const b = this.boats[k]; if (b === this.craft || !b.g.visible) continue; const [h, wp, wr] = ride(b.pos.x, b.pos.z, b.yaw); b.g.position.y = waterLevel(b.pos.x, b.pos.z) + h; b.g.rotation.set(wp, b.yaw, wr); }
    { const [h, wp, wr] = ride(f.p.x, f.p.z, f.yaw, 8, 3); f.p.y = h * 0.6; f.g.rotation.x = wp * 0.5; f.g.rotation.z = wr * 0.5; }   // the ferry, more heavily
    if (this.wheel) {
      const w = G.metro.coast.wheel;
      if (p.state !== 'ride') this.wheel = null;
      else { w.gondola(this.wheel.k, this.v); p.pos.set(this.v.x, this.v.y - 0.6, this.v.z); G.ui.setObjective({ title: 'The big wheel', text: `${Math.round(p.pos.y)} m above the pier`, sub: 'E to get off early.' }); if (w.a - this.wheel.a0 >= TAU) this.leaveWheel(); }
    }
    const r = this.rally;
    if (r) { r.wait -= dt; if (r.wait <= 0) { r.x += r.dir * r.speed * dt; if (r.x > 1) { r.x = 1; r.dir = -1; } if (r.x < 0) { r.x = 0; r.dir = 1; } } const n = document.getElementById('ry-n'); if (n) n.style.left = r.x * 100 + '%'; }
  }
}
