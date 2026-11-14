// The towers with rooftop bars (world/towers.js) and the Neo Central Institute (world/campus.js):
// lifts between lobby and roof, the bar menus, music on the roofs at night, the library's city
// archive, and students on the quad by day.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { labelTexture } from '../world/materials.js';

const DRINKS = [['Neon Spritz', 14, 8, 'Bright, bitter, very blue.'], ['Orbit Old Fashioned', 18, 6, 'Smoked over real wood, which is rarer than gold.'], ['Zero-g Lemonade', 9, 10, 'Fizzes the wrong way up.'], ['Bar snacks', 22, 26, 'Printed olives and fried noodle crisps.']];
const ARCHIVE = [
  ['2161: the first slab', 'Neo Central began as a floating construction yard for the orbital ring. When the yards moved up the tether, the workers stayed below and built Meridian on the old slab.'],
  ['2174: CIVIC switches on', 'CIVIC was written to schedule cranes. Within a decade it ran the trams, the lifts and the lights. Nobody voted for that; nobody minded either.'],
  ['2190: the sea comes in', 'The southern districts flooded twice before the sea walls went up. Solara Bay is what the city made of the land it lost: a beach where the docks were.'],
  ['2203: Skyhaven lifts', 'The first floating district rose over the old rail yards on lift fans built for the ring. It has never come down, though it was meant to be temporary.'],
  ['2219: the Expo', 'The Expo grounds were built for the city\'s centenary of flight. The stadium was added so the crowds would have somewhere to sit.'],
  ['2226: now', 'More people move to Neo Central every year than to anywhere else on Earth. The archive asks each new resident one question: what will you build here?'],
];

export class Places {
  constructor() {
    const I = G.interact, M = G.metro;
    this.towers = M.towers || []; this.campus = M.campus || null;
    const label = (text, sub, color, p, w = 7) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.24), new THREE.MeshBasicMaterial({ map: labelTexture(text, { size: 60, color, sub }), transparent: true, side: THREE.DoubleSide })); m.position.set(p.x, p.y, p.z); m.rotation.y = p.yaw; G.scene.add(m); return m; };
    for (const T of this.towers) {
      I.add({ pos: T.lobbyLift, r: 2.6, yTol: 2, label: `Lift to the roof: ${T.barName}`, use: () => this.ride(T.roofLift, `${T.barName}, ${T.h} m up.`) });
      I.add({ pos: T.roofLift, r: 2.6, yTol: 2, label: `Lift down to the ${T.name} lobby`, use: () => this.ride(T.lobbyLift, null) });
      I.add({ pos: T.bar, r: 2.4, yTol: 2, prio: 0.2, label: `${T.barName}: drinks and snacks`, use: () => this.barMenu(T) });
      label(T.barName.toUpperCase(), 'rooftop bar · open late', T.glow, T.sign, 8);
      label(T.name.toUpperCase(), 'lobby open · rooftop bar', '#e9eef5', { x: T.cx + (T.door === 'W' ? -17.6 : 0), y: T.lobby.lo.y + 7, z: T.cz + (T.door === 'S' ? 17.6 : 0), yaw: T.door === 'W' ? -Math.PI / 2 : 0 }, 9);
      (G.musicSpots = G.musicSpots || []).push({ x: T.cx, z: T.cz, on: () => { const h = G.env.hour; return (h >= 19 || h < 2) && G.player.pos.y > T.top - 6; } });
    }
    if (this.campus) {
      const C = this.campus;
      label('NEO CENTRAL INSTITUTE', 'library · lecture hall · observatory', '#ffe2b0', C.sign, 10);
      I.add({ pos: C.terminal, r: 2, yTol: 2, label: 'The city archive', use: () => this.archive() });
      if (G.figureHooks) G.figureHooks.push((A, focus) => this.students(A, focus));
    }
  }
  ride(to, msg) {
    G.ui.fade(() => { const p = G.player; p.pos.set(to.x, to.y, to.z); p.vel.set(0, 0, 0); p.grounded = true; if (msg) { G.ui.toast(msg, 'info'); G.state.done['roof:' + Math.round(to.y)] = true; } });
    if (G.audio) { G.audio.blip(660, 0.08); setTimeout(() => G.audio && G.audio.blip(880, 0.08), 160); }
  }
  barMenu(T) {
    G.ui.openMenu({ title: T.barName, who: `${T.name} · ${T.h} m up`, body: G.env.hour >= 19 || G.env.hour < 2 ? 'The bar is busy, the music is up and the city is lit from end to end.' : 'Quiet at this hour. The bartender is polishing glasses and watching the sky lanes.',
      options: [...DRINKS.map(([name, price, energy, desc]) => ({ label: name, desc, price, onPick: () => { if (G.economy.spend(price, name.toLowerCase())) { G.player.energy = Math.min(100, G.player.energy + energy); G.player.play('snack', 2.4); G.state.done['bar:' + T.id] = true; } } })), { label: 'Close', onPick: () => {} }] });
  }
  archive() {
    const d = G.state.done;
    G.ui.openMenu({ title: 'The city archive', who: 'Neo Central Institute library', body: 'A terminal with the city\'s history, a page at a time.', wide: true,
      options: [...ARCHIVE.map(([t, text], k) => ({ label: `${d['arch:' + k] ? '✓ ' : ''}${t}`, onPick: () => { d['arch:' + k] = true; G.ui.openMenu({ title: t, who: 'The city archive', body: text, options: [{ label: 'Back to the archive', onPick: () => this.archive() }, { label: 'Close', onPick: () => {} }] }); } })), { label: 'Close', onPick: () => {} }] });
  }
  // a few students out on the quad by day, in twos and threes
  students(A, focus) {
    const C = this.campus, h = G.env.hour; if (h < 8 || h > 19 || (focus.x - C.quad.x) ** 2 + (focus.z - C.quad.z) ** 2 > 140 * 140) return;
    const groups = [[-8, -6, 3], [18, 12, 2], [-6, 20, 3], [20, -10, 2]];
    let n = 0;
    groups.forEach(([gx, gz, k], gi) => { for (let i = 0; i < k; i++) { const a = (i / k) * Math.PI * 2 + gi, x = C.quad.x + gx + Math.cos(a) * 1.1, z = C.quad.z + gz + Math.sin(a) * 1.1; A.put('stu' + n, x, 0.17, z, Math.atan2(C.quad.x + gx - x, C.quad.z + gz - z), 3 + n * 2, (n + Math.floor(G.elapsed / 6)) % 3 ? 'talk' : 'idle', n, focus); n++; } });
    C.benches.forEach((b, i) => { if (i % 2 === 0) A.put('stub' + i, b.x, 0.15 + 0.0, b.z, b.yaw, 9 + i, 'sit', i, focus); });
  }
}
