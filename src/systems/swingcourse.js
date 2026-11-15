// The Swing Course: a route of big rings through the downtown streets, for Strand. Swing through them in
// order: the next is green, the finish is gold. The clock starts at the first ring. Rings are passed by
// crossing them (at 40 m/s you would skip clean past a small one between frames), and each lies across
// the line of the street. Back on the street for more than a few seconds, or far off the course, ends
// the run. Medals pay credits and hero experience; the best time is kept (G.state.best.swing).
import * as THREE from 'three';
import { G } from '../core/game.js';
import { labelTexture } from '../world/materials.js';
import { money } from '../ui/ui.js';

// The route's corners, on the street centre lines (the downtown grid has streets at x = -61, 60, 180
// and z = -174, -60): east along the start street, south, west one block, then north to the finish.
// Of the streets near the start these have the most towers close on both sides, so a line is nearly
// always there to take; the stretch of z = -60 west of x = 45 opens onto a plaza with nothing to swing
// from, so the route turns north before it.
const ROUTE = [[-75, -172], [180, -172], [180, -60], [60, -60], [60, -135]];   // the finish ring sits 47 m short of the start street
const START = { x: -96, z: -170 };              // the sign, on the street just before the first ring
// Big hoops (14 m across, about half the street), at swing height: at course speed (35-50 m/s) arcs
// over these streets run from about 6 m to 28 m, half the time above 17 m. The pass zone is a little
// larger than the drawn ring, more so sideways (PASS_W x PASS_H half-sizes), as game rings forgive a near miss.
const R = 7, GAP = 40, PASS_W = 8.5, PASS_H = 7.5;
// Each ring's height (after the first), set from test runs: where a fast swing over that stretch tends to
// be. Rings just after a corner sit lower (you come out of the turn low); stretches where swings were
// passing over the ring got higher ones. Rings beyond this list repeat its last entry.
const HEIGHTS = [12, 16, 16, 18, 16, 12, 15, 14, 14, 14, 13];
const FIRST = { at: 40, y: 8 };              // the first ring meets the rise of your first swing
// seconds, name, credits, hero experience. Set from 12 test runs by a scripted Strand (11 finished:
// 23.8, 28.4, 29.7, 29.8, 34.2, 35.3, 43.6, 47.8, 51.9, 89.2, 94.2 s): gold takes a strong, clean run;
// silver is a typical good one; bronze allows a missed ring or two and a loop back.
const MEDALS = [[28, 'GOLD', 400, 60], [40, 'SILVER', 250, 40], [60, 'BRONZE', 140, 25]];
const NEXT = new THREE.Color('#7dff9c'), LATER = new THREE.Color('#3fb8ff'), LAST = new THREE.Color('#ffd34d');

export class SwingCourse {
  constructor() {
    this.rings = this.layout();
    const n = this.rings.length;
    this.mesh = new THREE.InstancedMesh(new THREE.TorusGeometry(R, 0.24, 8, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, fog: false }), n);
    this.mesh.frustumCulled = false;
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3();
    this.paint(0); G.scene.add(this.mesh);
    // the sign at the start
    const y = G.colliders.groundAt(START.x, START.z, 2, 1, 0.3);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.6), new THREE.MeshBasicMaterial({ map: labelTexture('SWING COURSE', { size: 64, color: '#b9ffcf', sub: `Strand · ${n} rings downtown · swing through the first` }), transparent: true, side: THREE.DoubleSide }));
    sign.position.set(START.x, y + 3.4, START.z); sign.rotation.y = -Math.PI / 2; G.scene.add(sign);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.6, 0.14), new THREE.MeshStandardMaterial({ color: '#2b303a' })); post.position.set(START.x, y + 1.3, START.z); G.scene.add(post);
    G.interact.add({ pos: { x: START.x, y, z: START.z }, r: 2.4, label: 'Swing Course: how it works and best time', use: () => this.info() });
    this.cx = (ROUTE[0][0] + ROUTE[1][0]) / 2; this.cz = (ROUTE[1][1] + ROUTE[2][1]) / 2;
    this.run = null; this.prev = new THREE.Vector3(); this.cur = new THREE.Vector3();
  }
  // rings every GAP metres along the route, heights varied, each facing along the street; any ring that
  // would sit inside something is dropped, so a later change to the city cannot leave one in a wall
  layout() {
    const col = G.colliders, out = [];
    let carry = FIRST.at - Math.hypot(ROUTE[0][0] - START.x, ROUTE[0][1] - START.z), k = -1;
    const add = (x, z, yaw) => { const y = k < 0 ? FIRST.y : HEIGHTS[Math.min(k, HEIGHTS.length - 1)]; k++; if (!col.resolveCircle({ x, z }, R, y - R, y + R)) out.push({ x, y, z, yaw, nx: Math.sin(yaw), nz: Math.cos(yaw) }); };
    for (let i = 0; i < ROUTE.length - 1; i++) {
      const [ax, az] = ROUTE[i], [bx, bz] = ROUTE[i + 1], L = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bx - ax, bz - az), last = i === ROUTE.length - 2;
      // along the street, stopping short of the junction; after a corner the next ring is 35 m into the
      // new street, between its walls (the open junction itself has nothing near to swing from, and you
      // need a swing or two to line up after the turn)
      for (let s = carry; s <= (last ? L : L - 18); s += GAP) add(ax + (bx - ax) * (s / L), az + (bz - az) * (s / L), yaw);
      carry = 35;
    }
    return out;
  }
  info() {
    const b = G.state.best.swing, strand = G.heroes && G.heroes.on && G.heroes.id === 'strand';
    G.ui.openMenu({ title: 'Swing Course', who: `Downtown · ${this.rings.length} rings through the downtown streets`,
      html: `<p>For Strand. Swing through the rings in order: the next one is green, the finish is gold. The clock starts at the first ring, just down the street. Hold Space to swing and keep holding to chain lines; let go on the way up out of a swing for a boost; A and D steer; Shift zips you forward. More than a few seconds back on the street ends the run.</p><p>Gold under ${MEDALS[0][0]} s, silver under ${MEDALS[1][0]} s, bronze under ${MEDALS[2][0]} s. ${b ? `Your best: <b>${b.toFixed(1)} s</b>.` : 'No time set yet.'}</p>`,
      options: [
        ...(!strand && G.heroes ? [{ label: 'Become Strand', desc: G.heroes.unlocked('strand') ? 'The web-slinging acrobat' : 'Locked', onPick: () => G.heroes.become('strand') }] : []),
        { label: 'Close', onPick: () => {} },
      ] });
  }
  paint(i) {
    const n = this.rings.length;
    for (let k = 0; k < n; k++) {
      const r = this.rings[k], sc = k < i ? 0 : k === i ? 1 : 0.85;
      this.e.set(0, r.yaw, 0); this.q.setFromEuler(this.e); this.v.set(r.x, r.y, r.z); this.s.set(sc, sc, sc);
      this.m.compose(this.v, this.q, this.s); this.mesh.setMatrixAt(k, this.m); this.mesh.setColorAt(k, k === n - 1 ? LAST : k === i ? NEXT : LATER);
    }
    this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true;
  }
  // did the body pass through ring r between last frame and this one? (crossing its plane inside the hoop,
  // going the right way; a slow brush past the middle counts too)
  through(r, a, b) {
    const da = (a.x - r.x) * r.nx + (a.z - r.z) * r.nz, db = (b.x - r.x) * r.nx + (b.z - r.z) * r.nz;
    if (da < 0 && db >= 0) {
      const t = da / (da - db), x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, z = a.z + (b.z - a.z) * t;
      const lat = (x - r.x) * -r.nz + (z - r.z) * r.nx, dy = y - r.y;
      if ((lat / PASS_W) ** 2 + (dy / PASS_H) ** 2 < 1) return true;
    }
    return (b.x - r.x) ** 2 + (b.y - r.y) ** 2 + (b.z - r.z) ** 2 < 3 * 3;
  }
  fail(msg) { this.run = null; this.paint(0); G.ui.setObjective(null); G.ui.toast(msg, 'warn'); }
  finish() {
    const t = this.run.t, s = G.state, medal = MEDALS.find((m) => t <= m[0]), best = !s.best.swing || t < s.best.swing;
    if (best) s.best.swing = t; this.run = null; this.paint(0); G.ui.setObjective(null);
    G.ui.flash(`${medal ? medal[1] : 'FINISHED'} · ${t.toFixed(1)} s`, 3.2);
    const pay = medal ? medal[2] : 60; G.economy.earn(pay, medal ? `Swing Course ${medal[1].toLowerCase()}` : 'Swing Course finisher');
    if (G.heroes && G.heroes.on) G.heroes.addXp(medal ? medal[3] : 10);
    s.done.swingCourse = true; if (medal && medal[1] === 'GOLD') s.done.swingGold = true;
    G.ui.toast(`${best ? 'New personal best. ' : ''}${money(pay)} for the run.${medal && medal !== MEDALS[0] ? ` ${MEDALS[MEDALS.indexOf(medal) - 1][1].toLowerCase()} is under ${MEDALS[MEDALS.indexOf(medal) - 1][0]} s.` : ''}`, 'good');
    if (G.audio) G.audio.blip(990, 0.15); G.save.write(true);
  }
  update(dt) {
    const p = G.player, n = this.rings.length, d2 = (p.pos.x - this.cx) ** 2 + (p.pos.z - this.cz) ** 2;
    this.mesh.visible = d2 < 420 * 420;
    this.cur.set(p.pos.x, p.pos.y + 1, p.pos.z);
    if (!this.mesh.visible) { if (this.run) this.fail('You left the Swing Course.'); this.prev.copy(this.cur); return; }
    const strand = G.heroes && G.heroes.on && G.heroes.id === 'strand', r = this.run, i = r ? r.i : 0, ring = this.rings[i];
    if (r) {
      r.t += dt;
      r.ground = p.grounded && p.state === 'walk' ? r.ground + dt : 0;
      const far = Math.hypot(p.pos.x - ring.x, p.pos.z - ring.z);
      G.ui.setObjective({ title: 'Swing Course', text: `${r.t.toFixed(1)} s · ring ${i + 1} of ${n} · ${Math.round(far)} m`, sub: r.ground > 0.5 ? `Back in the air: ${Math.max(0, 3.5 - r.ground).toFixed(1)} s` : 'Hold Space to swing · let go on the way up · Shift zips' });
      if (!strand) return this.fail('Swing Course over: it is for Strand.');
      if (r.ground > 3.5) return this.fail('Back on the street too long: the run is over. Swing through the first ring to start again.');
      if (far > 160 || p.state === 'drive' || p.state === 'sit' || r.t > 240) return this.fail('Swing Course abandoned.');
    }
    if (this.through(ring, this.prev, this.cur)) {
      if (i === 0) {
        if (!strand) { if (!(this.warnT > 0)) { G.ui.toast('The Swing Course is for Strand: become Strand at the Hero Hall.', 'info'); this.warnT = 6; } this.prev.copy(this.cur); this.warnT -= dt; return; }
        this.run = { i: 0, t: 0, ground: 0 }; G.ui.toast('Swing Course: the clock is running.', 'info');
      }
      this.run.i++; if (G.audio) G.audio.blip(660 + this.run.i * 30, 0.08);
      if (G.fx) G.fx.ring(this.v.set(ring.x, ring.y, ring.z), '#7dff9c', R * 0.8, R * 1.6, 0.35, this.s.set(ring.nx, 0, ring.nz));
      if (this.run.i >= n) { this.prev.copy(this.cur); return this.finish(); }
      this.paint(this.run.i);
    }
    this.warnT = (this.warnT || 0) - dt;
    this.prev.copy(this.cur);
  }
}
