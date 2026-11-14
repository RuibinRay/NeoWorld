// The orbital lift at the Aeroport: a glass passenger capsule climbs the tether to Skyline
// Station, an enclosed observation deck 1,500 m up, in fifty seconds. Up there: telescopes you
// can look through, benches by the glass, a coffee counter, and the lift back down.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { clamp } from '../core/util.js';
import { std, neon, labelTexture } from '../world/materials.js';
import { mergeMeshes } from '../world/batch.js';

export const DECK_H = 1500;
const BASE = 17.5, RIDE = 50, FARE = 40, R = 16.4;
const SCOPES = [[Math.PI, 'north: Arbor Heights, Bio-Eden, the mountains and Northgate Dam'], [Math.PI / 2, 'east: Meridian, the megatowers and Skyhaven floating beyond'], [0, 'south: the Nexus stacks, Tidewater Port and the sea'], [-Math.PI / 2, 'west: the runways and the edge of the city']];   // yaw 0 faces south (+z)

export class OrbitalLift {
  constructor() {
    const A = G.districts.byId.aeroport, tx = (this.tx = A.x + 60), tz = (this.tz = A.z - 20), col = G.colliders, H = DECK_H;
    const glass = new THREE.MeshStandardMaterial({ color: '#bfe6ff', roughness: 0.05, metalness: 0.5, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });
    const white = std('#e9eef5', 0.35, 0.5), dark = std('#2b303a', 0.55, 0.5), cyan = neon('#7fe9ff', 1.6);
    const make = (parent, list) => { const out = []; for (const [geo, mat, x, y, z, rx = 0, ry = 0] of list) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); m.receiveShadow = true; parent.add(m); out.push(m); } mergeMeshes(parent, out); };
    // the capsule: a glass ring round the tether
    const cap = (this.cap = new THREE.Group()); cap.position.set(tx, BASE, tz); G.scene.add(cap);
    const capParts = [[new THREE.CylinderGeometry(3.6, 3.4, 0.35, 24), white, 0, -0.17, 0], [new THREE.CylinderGeometry(3.6, 3.6, 0.4, 24), white, 0, 4.0, 0], [new THREE.CylinderGeometry(3.55, 3.55, 3.8, 24, 1, true), glass, 0, 1.95, 0], [new THREE.CylinderGeometry(1.5, 1.5, 4.2, 14), dark, 0, 1.95, 0], [new THREE.TorusGeometry(3.6, 0.07, 6, 40), cyan, 0, 0.05, 0, Math.PI / 2], [new THREE.TorusGeometry(3.6, 0.07, 6, 40), cyan, 0, 3.8, 0, Math.PI / 2]];
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; capParts.push([new THREE.BoxGeometry(0.14, 3.8, 0.14), white, Math.sin(a) * 3.55, 1.95, Math.cos(a) * 3.55]); }
    make(cap, capParts);
    // Skyline Station
    const deck = (this.deck = new THREE.Group()); deck.position.set(tx, H, tz); G.scene.add(deck);
    // a solid floor in the middle and a ring of glass floor round the edge, so you can look straight down
    const floorGlass = new THREE.MeshStandardMaterial({ color: '#cfeeff', roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.RingGeometry(12.6, R + 0.1, 48, 1);
    const parts = [[new THREE.CylinderGeometry(12.6, 12, 1.2, 48), dark, 0, -0.6, 0], [new THREE.CylinderGeometry(12.6, 12.6, 0.04, 48), std('#4a515d', 0.6, 0.3), 0, 0.02, 0], [new THREE.ConeGeometry(12, 12, 32), white, 0, -7.2, 0, Math.PI],
      [ring, floorGlass, 0, 0.01, 0, -Math.PI / 2], [new THREE.TorusGeometry(R + 0.1, 0.12, 6, 64), white, 0, -0.05, 0, Math.PI / 2], [new THREE.TorusGeometry(12.6, 0.06, 6, 64), cyan, 0, 0.05, 0, Math.PI / 2],
      [new THREE.CylinderGeometry(R + 0.1, R + 0.1, 4.6, 48, 1, true), glass, 0, 2.3, 0], [new THREE.CylinderGeometry(R + 0.7, R + 0.7, 0.6, 48), white, 0, 4.9, 0], [new THREE.TorusGeometry(R - 0.3, 0.06, 6, 64), neon('#ffd9a8', 1.2), 0, 4.55, 0, Math.PI / 2]];
    for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; parts.push([new THREE.BoxGeometry(0.18, 4.6, 0.18), white, Math.sin(a) * (R + 0.1), 2.3, Math.cos(a) * (R + 0.1)]); }
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; parts.push([new THREE.BoxGeometry(0.12, 0.08, R - 12.4), white, Math.sin(a) * (R + 12.6) / 2, -0.02, Math.cos(a) * (R + 12.6) / 2, 0, a]); }   // the glass floor's frame
    // benches facing out, the telescopes, the coffee counter
    this.seats = [];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + Math.PI / 6, x = Math.sin(a) * 12.6, z = Math.cos(a) * 12.6;
      parts.push([new THREE.BoxGeometry(2.6, 0.12, 0.6), std('#8a6a48', 0.7, 0.1), x, 0.46, z, 0, a], [new THREE.BoxGeometry(2.4, 0.4, 0.4), dark, x, 0.2, z, 0, a]);
      col.box(tx + x - 0.4, tx + x + 0.4, H, H + 0.5, tz + z - 0.4, tz + z + 0.4, { noCam: true });   // small, so standing up does not put you on it
      for (const o of [-0.65, 0.65]) this.seats.push({ id: 'skyline' + k + (o > 0 ? 'b' : 'a'), kind: 'bench', x: tx + x + Math.cos(a) * o, y: H + 0.5, z: tz + z - Math.sin(a) * o, yaw: a, taken: null });
    }
    this.scopes = SCOPES.map(([a0, what]) => {
      const a = a0 + Math.PI / 24, x = Math.sin(a) * 15.2, z = Math.cos(a) * 15.2;   // between two mullions
      parts.push([new THREE.CylinderGeometry(0.08, 0.14, 1.2, 8), dark, x, 0.6, z], [new THREE.CylinderGeometry(0.11, 0.09, 0.8, 10), white, x + Math.sin(a) * 0.1, 1.35, z + Math.cos(a) * 0.1, Math.PI / 2 - 0.4, a]);
      col.box(tx + x - 0.2, tx + x + 0.2, H, H + 1.4, tz + z - 0.2, tz + z + 0.2, { noCam: true });
      return { a, what, x: tx + x - Math.sin(a) * 0.8, y: H, z: tz + z - Math.cos(a) * 0.8, eye: new THREE.Vector3(tx + x + Math.sin(a) * 0.75, H + 1.5, tz + z + Math.cos(a) * 0.75) };   // the view starts just past the lens
    });
    parts.push([new THREE.BoxGeometry(0.8, 1.05, 4), dark, -9, 0.53, 0], [new THREE.BoxGeometry(0.9, 0.06, 4.1), white, -9, 1.08, 0], [new THREE.BoxGeometry(0.6, 0.06, 3.6), neon('#ffd9a8', 1), -9.42, 0.9, 0]);
    col.box(tx - 9.4, tx - 8.6, H, H + 1.05, tz - 2, tz + 2, { noCam: true });
    make(deck, parts);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.6), new THREE.MeshBasicMaterial({ map: labelTexture('SKYLINE STATION', { size: 60, color: '#cfe9ff', sub: '1,500 m · the first stop of the orbital lift' }), transparent: true, side: THREE.DoubleSide }));
    sign.position.set(0, 3.7, 6.2); deck.add(sign);
    // colliders: the floor (a disc as three boxes), the glass (as 24 boxes), the roof, the lift in the middle
    for (const [w, d] of [[R, 6.8], [6.8, R], [11.6, 11.6]]) col.box(tx - w, tx + w, H - 1.2, H, tz - d, tz + d);
    for (let k = 0; k < 24; k++) { const a = ((k + 0.5) / 24) * Math.PI * 2, x = Math.sin(a) * (R + 0.2), z = Math.cos(a) * (R + 0.2), hx = Math.abs(Math.cos(a)) * 2.2 + 0.15, hz = Math.abs(Math.sin(a)) * 2.2 + 0.15; col.box(tx + x - hx, tx + x + hx, H, H + 4.6, tz + z - hz, tz + z + hz, { noCam: true }); }
    for (const [w, d] of [[R, 6.8], [6.8, R], [11.6, 11.6]]) col.box(tx - w, tx + w, H + 4.6, H + 5.2, tz - d, tz + d, { noCam: true });
    col.box(tx - 2.7, tx + 2.7, H, H + 4.4, tz - 2.7, tz + 2.7);
    // the gate at the foot of the base
    const gate = new THREE.Group(); gate.position.set(tx, 0, tz + 29.5); G.scene.add(gate);
    make(gate, [[new THREE.BoxGeometry(0.5, 5, 0.5), white, -3, 2.5, 0], [new THREE.BoxGeometry(0.5, 5, 0.5), white, 3, 2.5, 0], [new THREE.BoxGeometry(6.5, 0.6, 0.6), white, 0, 5.2, 0], [new THREE.BoxGeometry(5.5, 0.12, 0.12), cyan, 0, 4.8, 0.3]]);
    for (const x of [-3, 3]) col.box(tx + x - 0.25, tx + x + 0.25, 0, 5, tz + 29.25, tz + 29.75, { noCam: true });
    const gs = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.4), new THREE.MeshBasicMaterial({ map: labelTexture('ORBITAL LIFT', { size: 60, color: '#cfe9ff', sub: `Skyline Station · 1,500 m · ◈${FARE}` }), transparent: true, side: THREE.DoubleSide }));
    gs.position.set(0, 6.4, 0.1); gate.add(gs);
    // interactions
    const I = G.interact;
    I.add({ pos: { x: tx, y: 0, z: tz + 28.6 }, r: 3.2, label: 'Orbital lift: ride up to Skyline Station', enabled: () => !this.ride, use: () => this.menu() });
    I.add({ pos: { x: tx, y: H, z: tz + 3.6 }, r: 2.2, label: 'Ride the lift back down to the Aeroport', enabled: () => !this.ride, use: () => this.go(-1) });
    for (const s of this.scopes) I.add({ pos: s, r: 1.3, yTol: 1.5, label: 'Look through the telescope', use: () => this.look(s) });
    for (const s of this.seats) I.add({ pos: s, r: 1.3, yTol: 1.4, label: 'Sit', enabled: () => !s.taken, use: () => G.player.sit(s) });
    I.add({ pos: { x: tx - 8, y: H, z: tz }, r: 2.2, label: 'Skyline Café: a coffee with a view', use: () => { if (G.economy.spend(8, 'coffee at Skyline Station')) { G.player.energy = Math.min(100, G.player.energy + 12); G.player.play('eat', 2.5); G.ui.toast('A flat white, 1,500 m up.', 'good'); } } });
    this.ride = null; this.scope = null; this.v = new THREE.Vector3();
  }
  // where to put you if the game is saved mid-ride
  safeSpot() { return this.ride ? { x: this.tx, y: this.ride.dir > 0 ? 0.06 : DECK_H, z: this.ride.dir > 0 ? this.tz + 27 : this.tz + 4.6 } : null; }
  menu() {
    G.ui.openMenu({ title: 'Orbital lift', who: 'Aeroport tether · passenger capsule', body: 'The capsule climbs the tether to Skyline Station, an observation deck 1,500 m above the Aeroport, in fifty seconds. Cargo goes on to geostationary orbit; passengers stop at the deck. Telescopes, a coffee counter, and the whole city below.',
      options: [{ label: 'Ride up', desc: 'Fifty seconds each way', price: FARE, onPick: () => { if (G.economy.spend(FARE, 'orbital lift')) this.go(1); } }, { label: 'Close', onPick: () => {} }] });
  }
  go(dir) {
    G.ui.fade(() => {
      const p = G.player; if (p.state === 'sit') p.stand();
      p.state = 'ride'; p.board = false; p.jet = false; p.crouch = false; p.firstPerson = false; p.vel.set(0, 0, 0);
      p.camYaw = dir > 0 ? 0 : Math.PI; p.camPitch = dir > 0 ? -0.15 : 0.35;
      this.ride = { dir, t: 0 }; this.cap.position.y = dir > 0 ? BASE : DECK_H;
      G.ui.toast(dir > 0 ? 'Doors closing. Next stop: Skyline Station, 1,500 m.' : 'Going down to the Aeroport.', 'info'); if (G.audio) G.audio.blip(520, 0.1);
    });
  }
  look(s) {
    const p = G.player; p.state = 'busy'; p.busyAnim = 'idle'; p.faceCam = true; p.vel.set(0, 0, 0); p.pos.set(s.x, s.y, s.z); p.camYaw = s.a; p.camPitch = 0.6;
    this.scope = { s, t: 0 }; G.ui.toast(`Looking ${s.what}.`, 'info');
  }
  update(dt) {
    const p = G.player, inp = G.input, cam = G.camera, H = DECK_H;
    if (this.ride) {
      const r = this.ride; r.t += dt; const u = clamp(r.t / RIDE, 0, 1), e = u * u * (3 - 2 * u), y = r.dir > 0 ? BASE + (H - BASE) * e : H - (H - BASE) * e;
      this.cap.position.y = y; p.pos.set(this.tx, y + 0.1, this.tz + 2.6); p.vel.set(0, 0, 0);
      G.ui.setObjective({ title: 'Orbital lift', text: `${Math.round(y)} m · ${Math.ceil(RIDE - r.t)} s to ${r.dir > 0 ? 'Skyline Station' : 'the Aeroport'}`, sub: 'Mouse to look around' });
      // a camera that circles the capsule (the tether would otherwise get between it and you)
      const cy = p.camYaw, pc = clamp(p.camPitch, -0.6, 1.2), d = 15, cx = this.tx, cz = this.tz, ty = y + 2;
      cam.up.set(0, 1, 0); cam.position.set(cx - Math.sin(cy) * Math.cos(pc) * d, ty + Math.sin(pc) * d, cz - Math.cos(cy) * Math.cos(pc) * d); cam.lookAt(cx, ty, cz);
      if (u >= 1) {
        this.ride = null; G.ui.setObjective(null); p.state = 'walk'; p.grounded = true;
        if (r.dir > 0) { p.pos.set(this.tx, H, this.tz + 4.6); p.yaw = p.camYaw = 0; G.state.done.orbit = true; G.ui.toast('Skyline Station, 1,500 m. Telescopes by the glass, coffee on the west side. The lift down is behind you.', 'good'); }
        else { this.cap.position.y = BASE; p.pos.set(this.tx, 0.06, this.tz + 27); p.yaw = p.camYaw = 0; }
        if (G.audio) G.audio.blip(880, 0.1);
      }
      return;
    }
    // the capsule waits wherever you are: up at the deck while you are there, otherwise at the base
    const up = p.pos.y > H - 60 && (p.pos.x - this.tx) ** 2 + (p.pos.z - this.tz) ** 2 < 40 * 40; this.cap.position.y = up ? H : BASE;
    if (this.scope) {
      const sc = this.scope; sc.t += dt;
      if (p.state !== 'busy' || (sc.t > 0.3 && (inp.pressed('KeyE') || inp.pressed('KeyF') || inp.pressed('Escape') || inp.pressed('Space')))) { this.scope = null; if (p.state === 'busy') p.state = 'walk'; p.faceCam = false; G.ui.setObjective(null); return; }
      const e = sc.s.eye, pc = clamp(p.camPitch, -0.2, 1.2); p.camYaw = clamp(p.camYaw, sc.s.a - 1.1, sc.s.a + 1.1);
      cam.up.set(0, 1, 0); cam.position.copy(e); cam.lookAt(e.x + Math.sin(p.camYaw) * Math.cos(pc), e.y - Math.sin(pc), e.z + Math.cos(p.camYaw) * Math.cos(pc));
      cam.fov = 14; cam.updateProjectionMatrix();
      G.ui.setObjective({ title: 'Telescope', text: `Looking ${sc.s.what}`, sub: 'Mouse to look · E to step back' });
    }
  }
}
