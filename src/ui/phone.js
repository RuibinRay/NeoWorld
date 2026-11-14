// The player's phone (Q). A small handset on screen with apps: bring a vehicle to where you
// stand, jump to a transit gate or home, open the map, call a cab, find work, order food.
// The world keeps running while it is open.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { MODELS } from '../data/vehicles.js';
import { fmtClock } from '../core/util.js';

const APPS = [
  ['vehicle', 'Vehicle', '#59e0ff', '▲'], ['travel', 'Travel', '#b98cff', '◆'], ['map', 'Map', '#7dff9c', '⌖'],
  ['cab', 'Sky cab', '#ffd34d', '◉'], ['jobs', 'Jobs', '#ff9a52', '≡'], ['food', 'Food', '#ff7ad9', '●'],
  ['goals', 'Milestones', '#9fe9ff', '★'], ['camera', 'Camera', '#e8f4fb', '◐'], ['settings', 'Settings', '#9db3c4', '⚙'],
  ['events', "What's on", '#ff9a52', '♪'], ['story', 'Story', '#ff4fd8', '✦'], ['photos', 'Photos', '#e8f4fb', '▣'], ['heroes', 'Heroes', '#ffd34d', '⚡'],
];

export class Phone {
  constructor() {
    const el = (this.el = document.createElement('div')); el.id = 'phone'; G.ui.root.appendChild(el);
    this.open = false; this.screen = 'home'; this.cool = 0; this.prop = null;
    addEventListener('keydown', (e) => {
      if (e.repeat || G.ui.titleOpen || (e.target && e.target.tagName === 'INPUT')) return;
      if (e.code === 'KeyQ' && !G.ui.menu && G.started && !G.minigame && !G.paused) { if (this.open) this.close(); else this.show('home'); e.preventDefault(); }
      else if (this.open && !G.ui.menu) {
        if (e.code === 'Escape' || e.code === 'Backspace') { if (this.screen === 'home') this.close(); else this.show('home'); }
        else if (/^Digit[0-9]$/.test(e.code)) { const n = +e.code.slice(5), b = this.el.querySelectorAll('[data-i]')[n === 0 ? 9 : n - 1]; if (b) b.click(); }
      }
    });
  }
  show(screen) {
    const p = G.player, s = G.state;
    if (!this.open) { this.open = true; G.input.blocked = true; G.input.releasePointer(); G.input.keys.clear(); if (G.audio) G.audio.ui('open'); if (p.state === 'walk') p.emote = { anim: 'phone', t: 1e9 }; this.hand(true); }
    this.screen = screen;
    const head = `<div class="ph-bar"><span>${fmtClock(G.env.mins)}</span><span>◈ ${Math.round(s.wallet).toLocaleString('en-US')}</span><span>▮▮▮▯</span></div>`;
    let body = '';
    if (screen === 'home') body = `<div class="ph-grid">${APPS.map(([id, name, col, glyph], i) => `<button data-i="${i}" data-app="${id}"><i style="background:${col}">${glyph}</i><span>${name}</span></button>`).join('')}</div><div class="ph-hint">Number keys or click · Q closes</div>`;
    else if (screen === 'vehicle') {
      const g = s.garage, car = G.car;
      body = `<h3>Vehicle</h3><p>Brings a vehicle to where you are standing. It needs a little open ground.</p>${g.owned.map((id, i) => { const c = id === g.active ? { b: car.battery, h: car.hull } : g.cond[id] || { b: 100, h: 100 }; return `<button class="ph-row" data-i="${i}" data-veh="${id}"><b>${MODELS[id].name}</b><small>${MODELS[id].kind} · battery ${Math.round(c.b)}% · hull ${Math.round(c.h)}%${id === g.active ? ' · out now' : ''}</small></button>`; }).join('')}<p class="ph-note">More models are sold at the Skyport showroom and the AeroWisp Exchange.</p>`;
    } else if (screen === 'travel') {
      const T = G.teleport, list = T.gates.filter((q) => T.usable(q));
      body = `<h3>Travel</h3><p>${this.cool > 0 ? `Recharging: ${Math.ceil(this.cool)} s.` : 'Jump straight to a transit gate, a home, or your vehicle.'}</p>${list.map((q, i) => `<button class="ph-row" data-i="${i}" data-gate="${q.id}"><b>${q.name}</b><small>${Math.round(Math.hypot(q.pos.x - p.pos.x, q.pos.z - p.pos.z))} m away</small></button>`).join('')}<button class="ph-row" data-i="${list.length}" data-gate="@car"><b>My vehicle</b><small>${Math.round(Math.hypot(G.car.pos.x - p.pos.x, G.car.pos.z - p.pos.z))} m away</small></button>`;
    }
    else if (screen === 'story') body = G.story.phoneHtml();
    else if (screen === 'photos') body = G.gallery.html();
    else if (screen === 'events') {
      this.events = G.happen.whatsOn();
      body = `<h3>What's on</h3><p>${G.happen.day()}. Pick one to set a route there.</p>${this.events.map((e, i) => `<button class="ph-row" data-i="${i}" data-go="${i}"><b>${e.name}</b><small>${e.when} · ${e.where}</small></button>`).join('')}`;
    }
    this.el.innerHTML = `<div class="ph-body">${head}<div class="ph-screen">${body}</div>${screen === 'home' ? '' : '<button class="ph-back" data-back="1">‹ Back</button>'}</div>`;
    this.el.style.display = 'block';
    this.el.querySelectorAll('button').forEach((b) => { b.onclick = () => { const d = b.dataset; if (G.audio) G.audio.ui('pick'); if (d.back) this.show('home'); else if (d.photo !== undefined) { this.close(); G.gallery.view(+d.photo); } else if (d.story) { this.close(); G.story.phone(d.story); } else if (d.app) this.app(d.app); else if (d.veh) this.summon(d.veh); else if (d.gate) this.jump(d.gate); else if (d.go) this.goTo(this.events[+d.go]); }; });
  }
  goTo(e) {
    const from = G.player.state === 'drive' ? G.car.pos : G.player.pos, rt = G.metro.setRoute(e.x, e.z, from); this.close();
    G.ui.toast(rt ? `Route to ${e.name}: ${rt.len >= 1000 ? (rt.len / 1000).toFixed(1) + ' km' : Math.round(rt.len) + ' m'} along the streets.` : `${e.name}: ${e.where}. It is marked on your map.`, 'good');
  }
  close() {
    if (!this.open) return;
    this.open = false; this.el.style.display = 'none'; G.input.blocked = !!G.ui.menu; G.input.hit.clear(); G.ui.cool = 0.25;
    const p = G.player; if (p.emote && p.emote.anim === 'phone') p.emote = null; this.hand(false);
  }
  // the handset in the character's hand
  hand(on) {
    const rig = G.player.rig;
    if (!this.prop) { this.prop = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.1, 0.052), new THREE.MeshStandardMaterial({ color: '#101216', roughness: 0.3, metalness: 0.6 })), f = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.088, 0.044), new THREE.MeshBasicMaterial({ color: new THREE.Color('#9fe9ff').multiplyScalar(1.4) })); f.position.x = 0.009; this.prop.add(b, f); this.prop.position.set(0.012, -0.345, 0.03); }
    if (on && this.prop.parent !== rig.elbR) rig.elbR.add(this.prop);
    this.prop.visible = on && G.player.state === 'walk';
  }
  app(id) {
    if (id === 'vehicle' || id === 'travel' || id === 'events' || id === 'story' || id === 'photos') return this.show(id);
    const p = G.player; this.close();
    if (id === 'map') G.ui.bigMap();
    else if (id === 'heroes') G.heroes.menu();
    else if (id === 'jobs') G.jobs.board();
    else if (id === 'food') { if (p.state === 'walk') G.food.deliveryMenu(); else G.ui.toast('Stand somewhere the drone can reach you.', 'info'); }
    else if (id === 'goals') G.games.menu();
    else if (id === 'camera') { G.ui.toast('Photo mode: the interface hides in a moment. Press O to bring it back.', 'info'); setTimeout(() => { G.games.photo = true; G.ui.root.style.opacity = 0; }, 1600); }
    else if (id === 'settings') G.ui.pauseMenu();
    else if (id === 'cab') { const pad = G.city.pads.find((q) => Math.abs(q.y - p.pos.y) < 2.5 && Math.hypot(q.x - p.pos.x, q.z - p.pos.z) < q.r + 1 && (!q.priv || G.state.owns[q.owner || 'apartment'])); if (pad && p.state === 'walk' && G.rides.cab.phase === 'off') G.rides.cabMenu(pad); else G.ui.toast(G.rides.cab.phase === 'off' ? 'Cabs land on pads: stand on any landing pad and call again.' : 'Your cab is already on its way.', 'info'); }
  }
  // Put the chosen vehicle on open ground next to the player.
  summon(id) {
    const p = G.player, car = G.car, col = G.colliders, g = G.state.garage;
    if (p.state !== 'walk') return G.ui.toast(p.state === 'drive' ? 'You are already in it.' : 'You need to be standing on your feet.', 'info');
    if (G.racing.gp || car.locked) return G.ui.toast('Your vehicle is busy right now.', 'warn');
    const base = col.groundAt(p.pos.x, p.pos.z, p.pos.y + 0.3), R = MODELS[id].R + 0.3, probe = { x: 0, z: 0 };
    if (col.ceilingAt(p.pos.x, p.pos.z, p.pos.y + 1.2, 0.3) < p.pos.y + 12) return G.ui.toast('It cannot come indoors. Step outside and call it again.', 'warn');
    for (const d of [4.6, 6.2, 8]) for (let i = 0; i < 13; i++) {
      const a = p.yaw + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.48, x = p.pos.x + Math.sin(a) * d, z = p.pos.z + Math.cos(a) * d;
      const top = col.groundAt(x, z, base + 0.6, 0.6, R);
      if (Math.abs(top - base) > 0.6 || col.groundAt(x, z, base + 0.6, 0.6, 0.3) < top - 0.3) continue;           // level ground only
      probe.x = x; probe.z = z; if (col.resolveCircle(probe, R, top + 0.35, top + 2.4)) continue;                  // nothing in the way
      if (col.ceilingAt(x, z, top + 1, R) < top + 12 || G.districts.waterAt(x, z, top)) continue;                  // under open sky only, and not in water
      this.close();
      if (id !== g.active) G.garage.switchTo(id);
      car.pos.set(x, top + car.ride, z); car.vel.set(0, 0, 0); car.yaw = p.yaw; car.mode = 'parked'; car.auto = null;
      G.ui.toast(`Your ${car.spec.name} is here. Press F beside it to board.`, 'good'); if (G.audio) { G.audio.tone(300, 0.5, 0.06, 'sine', null, 0.02, 2.5); G.audio.ui('pay'); }
      return;
    }
    G.ui.toast('No room for it here. Step out into the open and try again.', 'warn');
  }
  jump(id) {
    const p = G.player, T = G.teleport;
    if (p.state === 'sit') p.stand();
    if (p.state !== 'walk') return G.ui.toast('You need to be on foot.', 'warn');
    if (this.cool > 0) return G.ui.toast(`The phone is recharging the jump: ${Math.ceil(this.cool)} s.`, 'warn');
    this.cool = 12; this.close();
    if (id === '@car') { const c = G.car, gy = G.colliders.groundAt(c.pos.x, c.pos.z, c.pos.y); return T.go({ name: 'Your vehicle', pos: new THREE.Vector3(c.pos.x + Math.cos(c.yaw) * 1.4, gy, c.pos.z - Math.sin(c.yaw) * 1.4 - 1.2), id: null }, false); }
    T.go(T.gates.find((q) => q.id === id), false);
  }
  update(dt) { this.cool = Math.max(0, this.cool - dt); if (this.open && G.player.state !== 'walk' && this.prop) this.prop.visible = false; }
}
