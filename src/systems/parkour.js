// The Skyline Run: eleven rings over the rooftops of block (2, 2), timed from the first ring to
// the last, with a zip line for the long drop. Falling to the street ends the run; touching the
// first ring again restarts it. The course is built in world/skyline.js.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { labelTexture } from '../world/materials.js';
import { money } from '../ui/ui.js';

const MEDALS = [[40, 'GOLD', 250], [55, 'SILVER', 150], [75, 'BRONZE', 90]];
const NEXT = new THREE.Color('#7dff9c'), LATER = new THREE.Color('#3fb8ff'), LAST = new THREE.Color('#ffd34d');

export class SkylineRun {
  constructor() {
    const S = (this.S = G.metro.skyline), n = S.rings.length;
    this.rings = new THREE.InstancedMesh(new THREE.TorusGeometry(1.6, 0.1, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, fog: false }), n);
    this.yaws = S.rings.map((r, i) => { const a = S.rings[Math.min(n - 1, i + 1)], b = i === n - 1 ? S.rings[i - 1] : r; return i === n - 1 ? Math.atan2(r.x - b.x, r.z - b.z) : Math.atan2(a.x - r.x, a.z - r.z); });
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3();
    this.paint(0); this.rings.computeBoundingSphere(); G.scene.add(this.rings);
    // the zip line's cable
    const a = S.zip.a, b = S.zip.b, d = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z), len = (this.zipLen = d.length());
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 5), new THREE.MeshStandardMaterial({ color: '#c9d2de', roughness: 0.4, metalness: 0.8 }));
    cable.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); cable.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()); G.scene.add(cable);
    this.zipDir = d.normalize(); this.trolley = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.5), new THREE.MeshStandardMaterial({ color: '#ffd34d', roughness: 0.5 })); this.trolley.position.copy(a); G.scene.add(this.trolley);
    // a sign at the foot of the first ladder
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.5), new THREE.MeshBasicMaterial({ map: labelTexture('SKYLINE RUN', { size: 64, color: '#b9ffcf', sub: 'rooftop parkour · eleven rings · up the ladder' }), transparent: true, side: THREE.DoubleSide }));
    sign.position.set(S.board.x, S.board.y + 3.1, S.board.z); sign.rotation.y = Math.PI; G.scene.add(sign);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.4, 0.14), new THREE.MeshStandardMaterial({ color: '#2b303a' })); post.position.set(S.board.x, S.board.y + 1.2, S.board.z); G.scene.add(post);
    G.colliders.box(S.board.x - 0.1, S.board.x + 0.1, S.board.y, S.board.y + 2.4, S.board.z - 0.1, S.board.z + 0.1, { noCam: true });
    G.interact.add({ pos: { x: S.board.x, y: S.board.y, z: S.board.z + 0.8 }, r: 2, label: 'Skyline Run: how it works and best time', use: () => this.info() });
    G.interact.add({ pos: { x: a.x + 1.1, y: a.y - 2.4, z: a.z }, r: 2.2, yTol: 1.5, label: 'Ride the zip line', enabled: () => !this.zip, use: () => this.zipStart() });
    this.run = null; this.zip = null;
  }
  info() {
    const b = G.state.best.skyline;
    G.ui.openMenu({ title: 'Skyline Run', who: 'Rooftop parkour · block 2-2, south-east of Meridian', body: `Climb the ladder, then run through the eleven rings in order: the next one is green, the finish is gold. The clock starts at the first ring. Space in front of a ledge pulls you up or vaults it, a jump at a ledge you nearly reach grabs it, E uses ladders and the zip line. Back on the street, the run is over.<br><br>Gold under ${MEDALS[0][0]} s, silver under ${MEDALS[1][0]} s, bronze under ${MEDALS[2][0]} s. ${b ? `Your best: ${b.toFixed(1)} s.` : 'No time set yet.'}`,
      options: [{ label: 'Close', onPick: () => {} }] });
  }
  paint(i) {
    const S = this.S, n = S.rings.length;
    for (let k = 0; k < n; k++) {
      const r = S.rings[k], sc = k < i ? 0 : k === i ? 1 : 0.8;
      this.e.set(0, this.yaws[k], 0); this.q.setFromEuler(this.e); this.v.set(r.x, r.y, r.z); this.s.set(sc, sc, sc);
      this.m.compose(this.v, this.q, this.s); this.rings.setMatrixAt(k, this.m); this.rings.setColorAt(k, k === n - 1 ? LAST : k === i ? NEXT : LATER);
    }
    this.rings.instanceMatrix.needsUpdate = true; this.rings.instanceColor.needsUpdate = true;
  }
  fail(msg) { this.run = null; this.paint(0); G.ui.setObjective(null); G.ui.toast(msg, 'warn'); }
  finish() {
    const t = this.run.t, s = G.state, medal = MEDALS.find((m) => t <= m[0]), best = !s.best.skyline || t < s.best.skyline;
    if (best) s.best.skyline = t; this.run = null; this.paint(0); G.ui.setObjective(null);
    G.ui.flash(`${medal ? medal[1] : 'FINISHED'} · ${t.toFixed(1)} s`, 3.2); const pay = medal ? medal[2] : 40;
    G.economy.earn(pay, medal ? `Skyline Run ${medal[1].toLowerCase()}` : 'Skyline Run finisher'); s.done.skyline = true; if (medal && medal[1] === 'GOLD') s.done.skylineGold = true;
    G.ui.toast(`${best ? 'New personal best. ' : ''}${money(pay)} for the run.`, 'good'); if (G.audio) G.audio.blip(990, 0.15);
  }
  zipStart() {
    const p = G.player; this.zip = { s: 0, v: 2.5 }; p.state = 'busy'; p.busyAnim = 'hang'; p.faceCam = false; p.board = false; p.jet = false; p.crouch = false; p.vel.set(0, 0, 0);
    p.yaw = Math.atan2(this.zipDir.x, this.zipDir.z); if (G.audio) G.audio.blip(500, 0.08);
  }
  zipStep(dt) {
    const z = this.zip, a = this.S.zip.a, p = G.player, d = this.zipDir;
    z.v = Math.min(13, z.v + 7 * dt); z.s = Math.min(this.zipLen, z.s + z.v * dt);
    this.trolley.position.set(a.x + d.x * z.s, a.y + d.y * z.s, a.z + d.z * z.s); p.pos.set(this.trolley.position.x, this.trolley.position.y - 2.35, this.trolley.position.z);
    if (z.s >= this.zipLen || p.state !== 'busy') {
      this.zip = null; this.trolley.position.copy(a);
      if (p.state === 'busy') { p.state = 'walk'; p.busyAnim = null; p.grounded = false; p.vel.set(d.x * 3, 0, d.z * 3); }
    }
  }
  update(dt) {
    const p = G.player, S = this.S, n = S.rings.length, near = (p.pos.x - S.cx) ** 2 + (p.pos.z - S.cz) ** 2 < 170 * 170;
    this.rings.visible = near;
    if (this.zip) this.zipStep(dt);
    if (!near) { if (this.run) this.fail('You left the Skyline Run course.'); return; }
    const r = this.run, i = r ? r.i : 0, c = S.rings[i];
    if (r) {
      r.t += dt;
      G.ui.setObjective({ title: 'Skyline Run', text: `${r.t.toFixed(1)} s · ring ${i} of ${n}`, sub: 'Space at a ledge climbs · E for ladders and the zip line' });
      if (p.state === 'walk' && p.grounded && p.pos.y < S.y + 1) return this.fail('Back on the street: the run is over. Climb up and start again.');
      if (p.state === 'drive' || p.state === 'sit' || r.t > 300) return this.fail('Skyline Run abandoned.');
    }
    const dx = p.pos.x - c.x, dy = p.pos.y + 1 - c.y, dz = p.pos.z - c.z;
    if (dx * dx + dy * dy + dz * dz < 1.9 * 1.9 && p.state !== 'drive') {
      if (i === 0) { this.run = { i: 0, t: 0 }; G.ui.toast('Skyline Run: the clock is running.', 'info'); }
      this.run.i++; if (G.audio) G.audio.blip(700 + this.run.i * 40, 0.08);
      if (this.run.i >= n) return this.finish();
      this.paint(this.run.i);
    }
  }
}
