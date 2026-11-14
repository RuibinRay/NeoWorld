// Skyball at Skyhaven Stadium, and the Expo Hall next door. Matches: Tuesday, Thursday and
// Saturday 18:00 to 20:00, Sunday 14:00 to 16:00; the Harbor Sharks at home to a rotating
// visitor. Buy a ticket at the desk to take your seat; bet on the result if you like.
// The match is simulated whether you watch or not, so the score is the same either way.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { RNG, clamp } from '../core/util.js';
import { STADIUM as S, ring, rowY } from '../world/expo.js';
import { weekday } from './happenings.js';

const TEAMS = [['Harbor Sharks', '#2f6f8f', 'SHA'], ['Skyline Comets', '#c0483f', 'COM'], ['Neon Volts', '#d94fb0', 'VLT'], ['Heights Owls', '#2f8f5a', 'OWL']];
export const MATCHES = [['match', ['Tuesday', 'Thursday', 'Saturday'], 18, 20], ['matchsun', ['Sunday'], 14, 16]];
const C = (h) => new THREE.Color(h);
export class Stadium {
  constructor() {
    const X = (this.X = G.metro.expo), I = G.interact;
    this.m = null; this.seated = false; this.watched = null; this.bet = null; this.drawn = ''; this.murmurT = 0; this.v = new THREE.Vector3();
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd34d').multiplyScalar(1.6) })); this.ball.visible = false; G.scene.add(this.ball);
    // seats in the stands: about a third of them have someone in
    const rng = new RNG(5150); this.crowd = [];
    for (let k = 0; k < 72; k++) for (let r = 0; r < S.rows; r++) { if (!rng.chance(0.3)) continue; const t = ((k + rng.range(0.2, 0.8)) / 72) * Math.PI * 2, [x, z] = ring(t, r * S.tread + 0.45); this.crowd.push({ x, y: rowY(r) - 0.08, z, yaw: Math.atan2(S.x - x, S.z - z), n: this.crowd.length * 7 + 3, home: Math.cos(t) > 0 }); }
    // the ticket desk
    const desk = { x: X.gate.x + 7, y: 0.15, z: X.gate.z - 1.6 };
    I.add({ pos: desk, r: 2.6, yTol: 2, label: () => this.deskLabel(), enabled: () => !this.seated, use: () => this.deskMenu() });
    // the Expo Hall's six exhibits
    X.exhibits.forEach((e, k) => I.add({ pos: e.pos, r: 1.8, yTol: 1.6, label: `Read: ${e.name}`, use: () => { G.state.done['ex:' + k] = true; G.ui.openMenu({ title: e.name, who: `Expo Hall · exhibit ${k + 1} of 6`, body: e.text, options: [{ label: 'Close', onPick: () => {} }] }); } }));
  }
  // ---- the fixture list -------------------------------------------------------------------------
  slot(day = G.env.day) { const d = weekday(day); for (const [id, days, from, to] of MATCHES) if (days.includes(d)) return { id, day, from, to }; return null; }
  live() { const s = this.slot(), h = G.env.hour; return s && h >= s.from && h < s.to ? s : null; }
  away(day) { return TEAMS[1 + (day % 3)]; }
  next() { for (let k = 0; k < 8; k++) { const s = this.slot(G.env.day + k); if (s && (k > 0 || G.env.hour < s.to)) return { ...s, when: k === 0 ? 'today' : k === 1 ? 'tomorrow' : weekday(G.env.day + k) }; } return null; }
  deskLabel() { const s = this.live() || this.next(), a = s && this.away(s.day); return s ? `Skyball: Sharks v ${a[0].split(' ')[1]}${this.live() ? ' · on now' : ` · ${s.when} ${s.from}:00`}` : 'Skyhaven Stadium'; }
  deskMenu() {
    const s = this.live(), n = this.next(), a = n && this.away(n.day), minute = this.m ? Math.floor(this.m.minute) : 0, betOpen = s && (!this.m || this.m.minute < 45) && !this.bet;
    const opts = [];
    if (s) opts.push({ label: 'Buy a ticket and take your seat', price: 12, desc: this.m && this.m.phase === 'full' ? 'The match is over; the bowl is emptying' : `Sharks ${this.m ? this.m.hs : 0} - ${this.m ? this.m.as : 0} ${a[0]}, ${minute}'`, onPick: () => { if (G.economy.spend(12, 'a skyball ticket')) this.sit(); } });
    if (betOpen) for (const [team, k] of [[TEAMS[0], 'home'], [a, 'away']]) opts.push({ label: `Bet ◈50 on the ${team[0]}`, desc: 'Pays ◈95 if they win; a draw gives your stake back', price: 50, onPick: () => { if (G.economy.spend(50, 'a bet on the skyball')) { this.bet = { side: k, day: n.day }; G.ui.toast(`Bet placed on the ${team[0]}.`, 'good'); } } });
    opts.push({ label: 'Close', onPick: () => {} });
    G.ui.openMenu({ title: 'Skyhaven Stadium', who: 'Tickets and fixtures', body: s ? `On now: Harbor Sharks v ${a[0]}.` : n ? `Next match ${n.when} at ${n.from}:00: Harbor Sharks v ${a[0]}. Matches on Tuesday, Thursday and Saturday at 18:00, and Sunday at 14:00.` : 'No matches this week.', options: opts });
  }
  sit() {
    G.ui.fade(() => {
      const t = Math.PI / 2 + 0.05, r = 5, [x, z] = ring(t, r * S.tread + 0.45), p = G.player;
      p.sit({ kind: 'bench', x, y: rowY(r) + 0.42, z, yaw: Math.atan2(S.x - x, S.z - z), taken: null });
      this.fp = p.firstPerson; p.firstPerson = true; p.camYaw = p.yaw; p.camPitch = 0.22;   // the rows behind would hide a camera over your shoulder
      this.seated = true; this.seatedAtKickoff = !this.m || this.m.minute < 2; G.ui.toast('Your seat: south stand, row 6. Space to leave.', 'info');
    });
  }
  leave() { this.seated = false; const g = this.X.gate, p = G.player; p.firstPerson = !!this.fp; G.ui.fade(() => { p.pos.set(g.x, g.y, g.z); p.vel.set(0, 0, 0); p.state = 'walk'; }); }
  // ---- the match ----------------------------------------------------------------------------------
  kickoff(toHome) { const m = this.m; m.ball.set(S.x, 0.45, S.z); m.bv.set(0, 0, 0); m.poss = toHome ? 0 : 1; m.hold = 1.5; }
  sim(dt) {
    const m = this.m, r = m.rng, b = m.ball, goalX = m.poss === 0 ? S.x + 50 : S.x - 50;
    if (m.phase === 'goal') { m.goalT -= dt; if (m.goalT <= 0) { m.phase = 'play'; this.kickoff(m.lastScorer === 1); } }
    else if (m.phase === 'play') {
      if (m.hold > 0) m.hold -= dt;
      else {
        // carry the ball toward the goal, weaving; now and then the other side wins it back
        const dx = goalX - b.x, dz = S.z + m.lane - b.z, d = Math.hypot(dx, dz) || 1, sp = 6.5 + r.next() * 2;
        m.bv.x += ((dx / d) * sp - m.bv.x) * dt * 1.5; m.bv.z += ((dz / d) * sp - m.bv.z) * dt * 1.5; m.laneT -= dt; if (m.laneT <= 0) { m.laneT = r.range(1.5, 3); m.lane = r.range(-22, 22); }
        if (r.chance(dt * 0.28)) { m.poss = 1 - m.poss; m.bv.multiplyScalar(-0.4); }
        if (Math.abs(goalX - b.x) < 13) {                                                           // a shot
          const p = m.poss === 0 ? 0.36 : 0.32;
          if (r.chance(p)) { if (m.poss === 0) m.hs++; else m.as++; m.lastScorer = m.poss; m.phase = 'goal'; m.goalT = 5; b.set(goalX + Math.sign(goalX - S.x) * 1.5, 0.9, S.z + r.range(-3, 3)); this.cheer(m.poss); }
          else { m.poss = 1 - m.poss; b.x = goalX - Math.sign(goalX - S.x) * 6; m.bv.set(-Math.sign(goalX - S.x) * 8, 0, r.range(-4, 4)); }
        }
        b.x += m.bv.x * dt; b.z = clamp(b.z + m.bv.z * dt, S.z - 30, S.z + 30); b.x = clamp(b.x, S.x - 49, S.x + 49);
      }
    }
  }
  cheer(side) {
    const near = Math.hypot(G.player.pos.x - S.x, G.player.pos.z - S.z);
    if (G.audio && near < 600) { const v = clamp(1 - near / 600, 0.1, 1); G.audio.burst(3, 0.35 * v, 700, 'bandpass'); setTimeout(() => G.audio.burst(2, 0.25 * v, 500, 'bandpass'), 900); }
    if (this.seated) G.ui.flash(side === 0 ? 'GOAL · SHARKS' : `GOAL · ${this.m.away[2]}`, 1.6);
  }
  board() {
    const m = this.m, key = m ? `${m.hs}-${m.as}-${Math.floor(m.minute)}-${m.phase}` : 'idle';
    if (key === this.drawn) return; this.drawn = key;
    const c = this.X.scCanvas, g = c.getContext('2d'); g.fillStyle = '#05070c'; g.fillRect(0, 0, 512, 256); g.textAlign = 'center'; g.textBaseline = 'middle';
    if (!m) { const n = this.next(); g.fillStyle = '#9fe9ff'; g.font = '800 44px system-ui'; g.fillText('SKYHAVEN', 256, 80); g.font = '600 26px system-ui'; g.fillStyle = '#cfe3f2'; g.fillText(n ? `Next: Sharks v ${this.away(n.day)[0].split(' ')[1]}` : 'No matches', 256, 150); g.fillText(n ? `${n.when}, ${n.from}:00` : '', 256, 190); }
    else { g.font = '800 40px system-ui'; g.fillStyle = TEAMS[0][1]; g.fillText(TEAMS[0][2], 110, 70); g.fillStyle = m.away[1]; g.fillText(m.away[2], 402, 70); g.fillStyle = '#fff'; g.font = '800 110px system-ui'; g.fillText(`${m.hs}  ${m.as}`, 256, 140); g.font = '600 30px system-ui'; g.fillStyle = m.phase === 'goal' ? '#ffd34d' : '#9fe9ff'; g.fillText(m.phase === 'full' ? 'FULL TIME' : m.phase === 'goal' ? 'GOAL!' : `${Math.floor(m.minute)}'`, 256, 222); }
    this.X.scTex.needsUpdate = true;
  }
  figures(A, focus) {
    const m = this.m, near = Math.hypot(focus.x - S.x, focus.z - S.z);
    if (!m || near > 520) return;
    const cheer = m.phase === 'goal';
    for (const q of this.crowd) A.put('s' + q.n, q.x, q.y, q.z, q.yaw, q.n, cheer && q.home === (m.lastScorer === 0) ? 'dance' : 'sit', G.elapsed * 3 + q.n, focus);
    if (m.phase === 'full') return;
    // players: five a side, shaped round the ball; goalkeepers on their line
    const b = m.ball, cols = [{ top: C(TEAMS[0][1]), bottom: C('#e9edf2'), skin: C('#c9a58a'), arm: C(TEAMS[0][1]), hair: C('#2a1d16') }, { top: C(m.away[1]), bottom: C('#1c1f27'), skin: C('#8a5a3a'), arm: C(m.away[1]), hair: C('#1c1f27') }];
    for (let side = 0; side < 2; side++) {
      const dir = side === 0 ? 1 : -1, att = m.poss === side;
      for (let k = 0; k < 5; k++) {
        const P = m.pl[side][k], keeper = k === 0;
        const tx = keeper ? S.x - dir * 47 : b.x + dir * (att ? [0, -6, 4, 10, -14][k] : [0, -16, -10, -4, 2][k]), tz = keeper ? S.z + clamp((b.z - S.z) * 0.2, -3, 3) : b.z + [0, -12, 10, -4, 16][k] * (att ? 1 : 0.7);
        const dx = tx - P.x, dz = tz - P.z, d = Math.hypot(dx, dz), sp = Math.min(d, 8 * this.dt);
        if (d > 0.1) { P.x += (dx / d) * sp; P.z += (dz / d) * sp; P.yaw = Math.atan2(dx, dz); }
        this.v.set(P.x, 0.03, P.z); A.crowd.add(this.v, P.yaw, 1.02, cols[side], d > 1 ? 'run' : 'idle', G.elapsed * 9 + k * 2 + side, 1);
      }
    }
  }
  update(dt) {
    this.dt = dt;
    const s = this.live(), h = G.env.hour, X = this.X;
    for (const [k, m] of X.holos.entries()) { m.rotation.y += dt * (0.6 + k * 0.1); m.rotation.x += dt * 0.3; }
    // a match starts, runs for ninety minutes of play (an hour and a half of game time), then full time until the bowl empties
    if (s && (!this.m || this.m.day !== s.day)) { const a = this.away(s.day); this.m = { day: s.day, from: s.from, away: a, hs: 0, as: 0, minute: 0, phase: 'play', ball: new THREE.Vector3(), bv: new THREE.Vector3(), poss: 0, hold: 0, lane: 0, laneT: 2, rng: new RNG(s.day * 977 + 11), pl: [0, 1].map(() => Array.from({ length: 5 }, () => ({ x: S.x, z: S.z, yaw: 0 }))), lastScorer: 0, goalT: 0 }; this.kickoff(true); if (G.started && G.player.pos.distanceTo(new THREE.Vector3(S.x, 0, S.z)) < 1500) G.ui.toast(`Kick-off at Skyhaven Stadium: Harbor Sharks v ${a[0]}.`, 'info'); }
    if (!s && this.m) this.settle();
    const m = this.m;
    if (m) {
      const playing = h < m.from + 1.5;
      if (playing) { m.minute = clamp(((h - m.from) / 1.5) * 90, 0, 90); this.sim(dt); } else if (m.phase !== 'full') { m.phase = 'full'; this.fullTime(); }
      const near = Math.hypot(G.player.pos.x - S.x, G.player.pos.z - S.z) < 520;
      this.ball.visible = near && m.phase !== 'full'; if (this.ball.visible) this.ball.position.copy(m.ball);
      if (near && G.audio) { this.murmurT -= dt; if (this.murmurT <= 0) { this.murmurT = 0.6 + Math.random(); G.audio.burst(1.2, 0.03, 420 + Math.random() * 300, 'bandpass'); } }
    } else this.ball.visible = false;
    this.board();
    // leaving your seat: back out to the gate
    if (this.seated && G.player.state !== 'sit') this.leave();
  }
  fullTime() {
    const m = this.m, won = m.hs > m.as ? 'home' : m.as > m.hs ? 'away' : 'draw';
    if (this.seated) { G.ui.flash(`FULL TIME · ${m.hs} - ${m.as}`, 3); if (this.seatedAtKickoff) G.state.done.fullMatch = true; }
    if (this.bet && this.bet.day === m.day) { if (won === 'draw') G.economy.earn(50, 'a drawn match: your stake back'); else if (won === this.bet.side) { G.economy.earn(95, 'your skyball bet came in'); G.state.done.betWon = true; } else if (G.started) G.ui.toast(`Your bet lost: ${m.hs} - ${m.as}.`, 'info'); this.bet = null; }
  }
  settle() { if (this.m && this.m.phase !== 'full') this.fullTime(); this.m = null; }
}
