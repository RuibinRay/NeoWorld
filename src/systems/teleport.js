// Transit gates: a ring in Meridian, one in every district and one at each home you own. Walk
// up to a gate once to attune it; after that you can step from any gate to any attuned one.
// A recall beacon (sold at the Repair Cafe) lets you jump to a gate from anywhere on foot.
import * as THREE from 'three';
import { G } from '../core/game.js';

export class Teleport {
  constructor() {
    const D = G.districts.byId, ap = G.city.places.apartment, off = (p, dx, dz) => ({ x: p.x + dx, y: p.y, z: p.z + dz });
    const defs = [
      { id: 'meridian', name: 'Meridian Commons', pos: { x: 21, y: 0.15, z: -45 }, open: true },
      ...G.districts.list.map((d) => ({ id: d.id, name: d.name, pos: off(d.kiosk, 5.5, 1.5) })),
      { id: 'home', name: 'Halcyon sky pod', pos: { x: -32, y: ap.Y, z: -56.2 }, owner: 'apartment' },
      { id: 'villa', name: 'Skyhaven villa', pos: off(D.skyhaven.things.villa.console, 16, 36), owner: 'villa' },
      // the new parts of the city
      { id: 'park', name: 'Grand Arbor Park', pos: { x: 745, y: 0, z: 541 } }, { id: 'solara', name: 'Solara Bay', pos: { x: 797, y: 0.2, z: 1154 } }, { id: 'port', name: 'Tidewater Port', pos: { x: -340, y: 0, z: 1190 } },
      { id: 'heights', name: 'Arbor Heights', pos: { x: -712, y: 0.15, z: -750 } }, { id: 'isle', name: 'Beacon Isle', pos: { x: 290, y: 2, z: 1786 } },
      { id: 'townhouse', name: 'Arbor Heights townhouse', pos: G.metro.suburb.home.door, owner: 'townhouse' },
      { id: 'dam', name: 'Northgate Dam', pos: { x: G.metro.north.viewpoint.x - 6, y: G.metro.north.viewpoint.y, z: G.metro.north.viewpoint.z + 2 } },
      { id: 'expo', name: 'Expo grounds and stadium', pos: { x: G.metro.expo.plaza.x - 6, y: 0, z: G.metro.expo.plaza.z } },
      { id: 'beachvilla', name: 'Solara Bay beach villa', pos: G.metro.beachVilla.door, owner: 'beachvilla' },
      // the places added since: the rooftop course, the towers with roof bars, the Institute, line 9's Meridian end
      { id: 'skyline', name: 'Skyline Run', pos: { x: G.metro.skyline.cx - 16, y: G.metro.skyline.y, z: G.metro.skyline.cz - 47 } },
      ...(G.metro.towers || []).map((T) => ({ id: T.id, name: `${T.name} (${T.barName})`, pos: { x: T.cx + (T.door === 'W' ? -26 : 8), y: T.lobby.lo.y, z: T.cz + (T.door === 'W' ? 8 : 26) } })),
      ...(G.metro.campus ? [{ id: 'campus', name: 'Neo Central Institute', pos: { x: G.metro.campus.cx - 4, y: 0.15, z: G.metro.campus.cz + 38 } }] : []),
      { id: 'line9', name: 'Meridian Gate (line 9 to the coast)', pos: { x: 269.9, y: 0.15, z: 313.9 } },
    ];
    const ringG = new THREE.TorusGeometry(1.3, 0.085, 8, 36), discG = new THREE.CircleGeometry(1.22, 28), baseG = new THREE.CylinderGeometry(1.7, 1.9, 0.14, 28);
    const ringM = new THREE.MeshBasicMaterial({ color: new THREE.Color('#9fe9ff').multiplyScalar(1.5) }), baseM = new THREE.MeshStandardMaterial({ color: '#20262f', roughness: 0.4, metalness: 0.7 });
    this.gates = defs.map((d) => {
      const g = new THREE.Group(); g.position.set(d.pos.x, d.pos.y, d.pos.z);
      const base = new THREE.Mesh(baseG, baseM); base.position.y = 0.07; base.receiveShadow = true;
      const ring = new THREE.Mesh(ringG, ringM); ring.position.y = 1.55;
      const field = new THREE.Mesh(discG, new THREE.MeshBasicMaterial({ color: 0x59e0ff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); field.position.y = 1.55;
      g.add(base, ring, field); G.scene.add(g);
      const gate = { ...d, g, ring, field, pos: new THREE.Vector3(d.pos.x, d.pos.y, d.pos.z) };
      G.interact.add({ pos: gate.pos, r: 2.4, yTol: 2, prio: 0.3, label: () => `Step into the ${d.name} gate`, enabled: () => this.usable(gate), use: () => this.menu(gate) });
      return gate;
    });
    this.cool = 0; this.flashT = 0;
  }
  usable(g) { return !g.owner || G.state.owns[g.owner]; }
  // every gate you may use is open to you; visiting one in person is only recorded for the milestone
  attuned(g) { return this.usable(g); }
  // from: the gate you are standing in, or null when using the recall beacon
  menu(from) {
    const wait = Math.ceil(this.cool);
    G.ui.openMenu({ title: from ? `${from.name} gate` : 'Recall beacon', who: 'Transit gates', wide: true,
      body: from ? 'Step through to any other gate.' : wait > 0 ? `Recharging: ${wait} s.` : 'Jump to any gate.',
      options: [...this.gates.filter((g) => g !== from && this.usable(g)).map((g) => { const ok = this.attuned(g); return { label: g.name, desc: ok ? `${Math.round(Math.hypot(g.pos.x - G.player.pos.x, g.pos.z - G.player.pos.z))} m away` : 'Not attuned yet: visit it once on foot', disabled: !ok || (!from && wait > 0), why: ok ? 'The beacon is still recharging.' : 'Walk up to that gate once to attune it.', onPick: () => this.go(g, !from) }; }), { label: 'Stay here', onPick: () => {} }] });
  }
  go(g, beacon) {
    const p = G.player; if (p.state === 'sit') p.stand(); if (p.state !== 'walk') return G.ui.toast('You need to be on foot.', 'warn');
    if (beacon) this.cool = 12;
    const fade = G.ui.$('fade'); fade.style.background = '#dff6ff';
    if (G.audio) { G.audio.tone(320, 0.7, 0.07, 'sine', null, 0.02, 4); G.audio.tone(640, 0.7, 0.04, 'triangle', null, 0.02, 3); }
    G.ui.fade(() => {
      p.pos.set(g.pos.x + 1.9, g.pos.y + 0.1, g.pos.z + 1.2); p.vel.set(0, 0, 0); p.grounded = true; p.jet = false; p.board = false;
      if (G.dog && G.dog.active) G.dog.pos.set(g.pos.x + 2.6, g.pos.y, g.pos.z + 1.8);
      if (g.id) G.state.gates[g.id] = true; G.ui.flash(g.name.toUpperCase());
      setTimeout(() => { fade.style.background = '#000'; }, 900);
    });
  }
  update(dt, t) {
    this.cool = Math.max(0, this.cool - dt);
    const p = G.player.pos;
    for (const g of this.gates) {
      const d2 = (g.pos.x - p.x) ** 2 + (g.pos.z - p.z) ** 2 + (g.pos.y - p.y) ** 2, show = d2 < 420 * 420 && this.usable(g);
      g.g.visible = show; if (!show) continue;
      g.ring.rotation.y = t * 0.7; g.field.rotation.y = t * 0.7; g.field.material.opacity = (this.attuned(g) ? 0.26 : 0.08) + Math.sin(t * 2.4 + g.pos.x) * 0.06;
      if (d2 < 36 && !G.state.gates[g.id] && !g.open && !g.owner && G.player.state === 'walk') { G.state.gates[g.id] = true; G.ui.toast(`Gate visited: ${g.name}.`, 'good'); if (G.audio) G.audio.ui('pay'); }
    }
  }
  markers() { return this.gates.filter((g) => this.usable(g)).map((g) => ({ x: g.pos.x, z: g.pos.z, color: this.attuned(g) ? '#9fe9ff' : '#4a6f80', gate: g })); }
}
