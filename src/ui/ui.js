// HUD, menus, dialogue, speech bubbles, minimap, title screen. Plain DOM over the canvas.
import { PAD_HELP } from '../core/gamepad.js';
import * as THREE from 'three';
import { G } from '../core/game.js';
import { fmtClock, clamp } from '../core/util.js';
import { BLOCKS } from '../world/city.js';
import { artUrl } from '../world/art.js';
import { SaveFile } from '../systems/save.js';
import { useAt, coastZ, CANAL } from '../world/metro/landuse.js';
import { weekday } from '../systems/happenings.js';

const LAND = { core: '#272e3c', mid: '#232a37', edge: '#1f2530', suburb: '#1f3528', port: '#2c3038', resort: '#35322b', park: '#1c4334', green: '#1a3a2c', beach: '#b3a273', quay: '#3b4049', front: '#40444d' };
import { SKINS, HAIRS, CLOTHES, ACCENTS, HAIR_STYLES, EYES } from '../entities/rigs.js';
import { Settings, QUALITY } from '../core/settings.js';
import { STATIONS } from '../systems/music.js';

const BLOCK_NAMES = ['Northwest Heights', 'Halcyon Block', 'Northeast Heights', 'Meridian Skyport', 'Meridian Commons', 'Kinetic Block', 'Southwest Heights', 'Old Quarter', 'Southeast Heights'];
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
export const money = (n) => '◈' + Math.round(n).toLocaleString('en-US');

export class UI {
  constructor() {
    const root = (this.root = document.getElementById('ui'));
    root.innerHTML = `
      <div id="hud-tl" class="panel"><div class="clock mono" id="clock">08:00</div><div class="sub" id="daywx"></div><div class="loc" id="loc"></div></div>
      <div id="hud-tr" class="panel"><div class="wallet mono"><b>◈</b> <span id="wallet">0</span></div>
        <div class="row"><span>Energy</span><span id="energyv" class="mono"></span></div><div class="bar"><i id="energy"></i></div>
        <div class="row"><span>Standing</span><span id="standing"></span></div>
        <div class="row" id="jetrow" style="display:none"><span>Jet charge</span><span id="jetv" class="mono"></span></div></div>
      <div id="objective" class="panel"><h4 id="obj-h"></h4><div class="t" id="obj-t"></div><div class="s" id="obj-s"></div></div>
      <div id="toasts"></div>
      <div id="bubbles"></div>
      <div id="prompt" class="panel"></div>
      <div id="flash"></div>
      <div id="vehicle" class="panel"><span class="mode" id="v-mode"></span><div class="big mono"><span id="v-speed">0</span><small>km/h</small></div>
        <div class="row"><span>Altitude</span><span id="v-alt" class="mono"></span></div>
        <div class="row"><span>Battery</span><span id="v-bat" class="mono"></span></div><div class="bar"><i id="v-batbar"></i></div>
        <div class="row"><span>Hull</span><span id="v-hull" class="mono"></span></div><div class="warn" id="v-warn"></div></div>
      <div id="minimap" class="panel"><canvas id="map" width="336" height="336"></canvas></div>
      <div id="help" class="panel"></div>
      <div id="menu" class="panel"></div>
      <div id="mini"><div class="box panel" id="mini-box"></div></div>
      <div id="fps" class="mono"></div>
      <div id="fade"></div>
      <div id="title"></div>`;
    this.$ = (id) => root.querySelector('#' + id);
    this.menu = null; this.bubbles = []; this.hudT = 0; this.mapT = 0; this.cool = 0; this.titleOpen = false; this.helpOn = Settings.data.hints; this.flashT = 0; this.zoom = 250;
    this.map = this.$('map').getContext('2d');
    this._v = new THREE.Vector3();
    addEventListener('keydown', (e) => this.onKey(e));
    this.setHelp();
  }

  onKey(e) {
    if (this.titleOpen || e.target.tagName === 'INPUT') return;
    if (this.menu) {
      if (/^Digit[1-9]$/.test(e.code)) { this.pick(+e.code.slice(5) - 1); e.preventDefault(); }
      else if ((e.code === 'Escape' || e.code === 'KeyQ' || e.code === 'Tab') && !this.menu.noClose) { this.closeMenu(); e.preventDefault(); }
      return;
    }
    if (e.code === 'KeyH') { this.helpOn = !this.helpOn; Settings.set('hints', this.helpOn); this.setHelp(); }
    if (e.code === 'KeyP' && G.started && !G.minigame && !G.paused) this.pauseMenu();
    if (e.code === 'KeyM' && G.started && !G.minigame && !G.paused) this.bigMap();
  }
  showFps(text) { const el = this.$('fps'); if (text) { el.style.display = 'block'; el.textContent = text; } else if (el.style.display !== 'none') el.style.display = 'none'; }

  // ---- pause and settings ----------------------------------------------------------------------
  // The world stops while these are open (G.paused); every way out of them clears the flag.
  pauseMenu() {
    G.paused = true;
    const resume = () => { G.paused = false; };
    this.openMenu({ title: 'Paused', who: 'NEO EARTH 2226', body: 'The city waits for you.', onClose: resume, options: [
      { label: 'Resume', onPick: resume },
      { label: 'Settings', desc: 'Graphics, sound, mouse', onPick: () => this.settingsMenu() },
      { label: 'Controls', onPick: () => this.controlsMenu() },
      { label: 'Unstuck', desc: 'Move to the nearest walkway, or your vehicle to the nearest pad', onPick: () => { resume(); G.unstuck(); } },
      { label: 'Save now', onPick: () => { G.save.write(); this.pauseMenu(); } },
      { label: 'Save to a file', desc: 'Your progress and photos in one file: keep it safe, or carry on in another browser', onPick: () => { SaveFile.download(); this.pauseMenu(); } },
      { label: 'Load from a file', desc: 'Replaces the progress in this browser', onPick: () => { this.pauseMenu(); SaveFile.pick((f) => this.loadFile(f, () => this.pauseMenu())); } },
      { label: 'Save and return to the title screen', onPick: () => { G.save.write(true); location.reload(); } },
    ] });
  }
  // confirm a save file picked from disk (f: SaveFile.parse's answer); back() reopens where we came from
  loadFile(f, back) {
    if (f.error) { this.toast(f.error, 'warn'); return; }
    const when = f.saved ? new Date(f.saved).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'at an unknown time';
    this.openMenu({ title: 'Load this save file?', who: f.summary, body: `Saved ${when}, with ${f.photos.length} photo${f.photos.length === 1 ? '' : 's'}. It replaces the progress in this browser (which is kept as the backup save), and the game restarts at the title screen: press Continue.`,
      onClose: back, options: [{ label: 'Load it', onPick: () => { if (!SaveFile.apply(f)) this.toast('Could not load it: this browser\'s storage is not available.', 'warn'); } }, { label: 'Cancel', onPick: back }] });
  }
  settingsMenu() {
    const d = Settings.data, again = () => this.settingsMenu(), next = (list, v) => list[(list.indexOf(v) + 1) % list.length];
    const flip = (k) => () => { Settings.set(k, !d[k]); again(); };
    this.openMenu({ title: 'Settings', who: 'Stored on this device', body: 'Pick an entry to change it.', onClose: () => { G.paused = false; }, options: [
      { label: `Graphics quality: ${QUALITY[d.quality].label}`, desc: 'Auto adjusts resolution to hold a smooth frame rate. Low turns off sun shadows, glow and anti-aliasing.', onPick: () => { Settings.set('quality', next(Object.keys(QUALITY), d.quality)); again(); } },
      { label: `Volume: ${Math.round(d.volume * 100)}%`, onPick: () => { Settings.set('volume', next([0, 0.25, 0.5, 0.7, 1], d.volume)); again(); } },
      { label: `Background music: ${d.music ? 'on' : 'off'}`, desc: 'A quiet generated score. Concerts and the club play either way.', onPick: flip('music') },
      { label: `Battle music: ${d.battleMusic ? 'on' : 'off'}`, desc: 'Hero Mode: music that builds through raids, with a theme for each villain boss.', onPick: flip('battleMusic') },
      { label: `Car radio: ${d.radio >= 0 && STATIONS[d.radio] ? STATIONS[d.radio].name : 'off'}`, desc: 'Plays while you drive. R in a car changes station.', onPick: () => { Settings.set('radio', d.radio + 1 >= STATIONS.length ? -1 : d.radio + 1); again(); } },
      { label: `Spoken lines: ${d.voices ? 'on' : 'off'}`, desc: 'Villains, radio hosts and heroes speak with this computer\'s voices. Captions show either way.', onPick: flip('voices') },
      { label: `Lock the mouse in the world: ${d.mouseLock ? 'on' : 'off'}`, desc: d.mouseLock ? 'The cursor hides and the mouse turns the camera. Esc frees the mouse; click the game to lock it again.' : 'The cursor stays free. Hold a mouse button and drag to look around.', onPick: flip('mouseLock') },
      { label: `Mouse sensitivity: ${d.sens}×`, onPick: () => { Settings.set('sens', next([0.5, 0.75, 1, 1.5, 2], d.sens)); again(); } },
      { label: `Vertical look: ${d.invertY ? 'inverted' : 'normal'}`, onPick: flip('invertY') },
      { label: `Field of view: ${d.fov}°`, desc: 'How wide the camera sees on foot. Wider shows more of the city at the edges.', onPick: () => { Settings.set('fov', next([55, 60, 65, 70, 75, 80], d.fov)); again(); } },
      { label: `Camera distance: ${d.cam}`, desc: 'How far behind you the camera follows on foot', onPick: () => { Settings.set('cam', next(['near', 'normal', 'far'], d.cam)); again(); } },
      { label: `Frame rate display: ${d.fps ? 'on' : 'off'}`, onPick: flip('fps') },
      { label: `Control hints: ${d.hints ? 'shown' : 'hidden'}`, onPick: () => { Settings.set('hints', !d.hints); this.helpOn = d.hints; this.setHelp(); again(); } },
      { label: 'Back', onPick: () => this.pauseMenu() },
    ] });
  }
  controlsMenu() {
    const row = (k, t) => `<tr><td style="padding:3px 14px 3px 0;white-space:nowrap"><b>${k}</b></td><td style="color:var(--dim)">${t}</td></tr>`;
    const html = `<table style="border-collapse:collapse;font-size:13px">${[
      ['WASD', 'move · thrust and turn in a vehicle'], ['Mouse / arrows', 'look around'], ['Shift', 'sprint · boost in a vehicle'], ['Space', 'jump · climb and take off'], ['C', 'crouch · descend and land'],
      ['E', 'interact, talk, sit, eat, lifts, charge on a pad'], ['F', 'board or leave your vehicle'], ['T', 'autopilot (in a vehicle)'], ['V', 'first person · cockpit view'], ['B', 'hoverboard (once bought)'],
      ['Tab', 'lens: status, career, districts, pocket food, valet, save'], ['Q', 'phone: bring a vehicle to you, jump to a gate, map, cab, jobs, food'], ['M', 'full map: click a transit gate to travel'], ['J', 'jet harness (once bought)'], ['P', 'pause and settings'], ['H', 'show or hide the hint bar'], ['1 to 9', 'pick a menu entry · Esc closes a menu'],
    ].map(([k, t]) => row(k, t)).join('')}</table><p style="margin-top:10px;font-size:13px;color:var(--dim)"><b style="color:var(--c)">Gamepad:</b> ${PAD_HELP}. In menus and on the phone: D-pad or stick to choose, A to pick, B to go back.</p>`;
    this.openMenu({ title: 'Controls', html, onClose: () => { G.paused = false; }, options: [{ label: 'Back', onPick: () => this.pauseMenu() }] });
  }
  setHelp() {
    const h = this.$('help');
    h.style.display = this.helpOn ? 'block' : 'none';
    const drive = G.player && G.player.state === 'drive';
    const hero = G.heroes && G.heroes.on && !drive;
    if (hero) { h.innerHTML = `<b>${G.heroes.H.name}</b> · <b>Click / Z</b> light · <b>Right click / X</b> heavy · <b>1 2 3</b> powers · <b>R</b> ultimate · <b>Space</b> jump${G.heroes.id === 'strand' ? ' (hold: swing) · <b>Shift</b> in the air: web zip · <b>C</b> in the air: dive' : G.heroes.id === 'forge' ? ' (in the air: fly)' : ''} · <b>Q</b> phone (Heroes app) · <b>P</b> pause · <b>H</b> hide`; return; }
    h.innerHTML = drive
      ? '<b>W/S</b> thrust · <b>A/D</b> turn · <b>Space</b> climb / take off · <b>C</b> descend / land · <b>Shift</b> boost · <b>T</b> autopilot · <b>V</b> cockpit · <b>F</b> step out · <b>R</b> radio · <b>Tab</b> lens · <b>P</b> pause · <b>H</b> hide'
      : '<b>WASD</b> move · <b>Mouse</b> or <b>arrows</b> look · <b>Shift</b> sprint · <b>Space</b> jump · <b>C</b> crouch · <b>V</b> first person' + (G.state && G.state.owns.board ? ' · <b>B</b> hoverboard' : '') + (G.state && G.state.owns.jetpack ? ' · <b>J</b> jet harness' : '') + ' · <b>E</b> interact · <b>F</b> vehicle · <b>Q</b> phone · <b>M</b> map · <b>Tab</b> lens · <b>P</b> pause · <b>H</b> hide';
  }

  // ---- toasts / prompt / flash / objective --------------------------------------------------
  toast(text, kind = 'info') {
    const box = this.$('toasts'), t = document.createElement('div');
    t.className = 'toast panel ' + kind; t.textContent = text; box.appendChild(t);
    while (box.children.length > 5) box.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 520); }, 4200);
    if (G.audio) G.audio.ui(kind === 'warn' ? 'warn' : kind === 'pay' ? 'pay' : 'note');
  }
  setPrompt(key, text) {
    const p = this.$('prompt');
    if (!text) { if (this._prompt) { p.style.display = 'none'; this._prompt = null; } return; }
    const s = key + '|' + text;
    if (s !== this._prompt) { this._prompt = s; p.innerHTML = `<kbd>${esc(key)}</kbd>${esc(text)}`; p.style.display = 'block'; }
  }
  flash(text, secs = 2.2) { const f = this.$('flash'); f.textContent = text; f.style.opacity = 1; this.flashT = secs; }
  setObjective(o) {
    const el = this.$('objective');
    if (!o) { el.style.display = 'none'; return; }
    el.style.display = 'block'; this.$('obj-h').textContent = o.title; this.$('obj-t').textContent = o.text; this.$('obj-s').textContent = o.sub || '';
  }
  fade(mid) { const f = this.$('fade'); f.style.opacity = 1; setTimeout(() => { mid(); f.style.opacity = 0; }, 380); }

  // ---- menus ----------------------------------------------------------------------------------
  openMenu(m) {
    this.menu = m; G.input.blocked = true; G.input.releasePointer(); G.input.keys.clear();
    const el = this.$('menu'); el.className = 'panel' + (m.wide ? ' wide' : ''); el.style.display = 'block';
    el.innerHTML = `<h2>${esc(m.title)}</h2>${m.who ? `<div class="who">${esc(m.who)}</div>` : ''}<div class="body">${m.html || (m.body ? `<p>${esc(m.body)}</p>` : '')}</div><div class="opts"></div><div class="foot">${m.foot ? esc(m.foot) + ' · ' : ''}number keys or click${m.noClose ? '' : ' · Esc to close'}</div>`;
    const opts = el.querySelector('.opts');
    m.options.forEach((o, i) => {
      const b = document.createElement('button');
      b.className = 'opt' + (o.disabled ? ' off' : '');
      b.innerHTML = `<span class="n">${i + 1}</span><span class="l">${esc(o.label)}${o.desc ? `<small>${esc(o.desc)}</small>` : ''}</span>${o.price !== undefined ? `<span class="p">${o.price === 0 ? 'free' : money(o.price)}</span>` : ''}`;
      b.onclick = () => this.pick(i);
      opts.appendChild(b);
    });
    if (G.audio) G.audio.ui('open');
  }
  pick(i) {
    const m = this.menu, o = m && m.options[i];
    if (!o) return;
    if (o.disabled) { if (o.why) this.toast(o.why, 'warn'); return; }
    this.closeMenu(true);
    if (G.audio) G.audio.ui(o.price ? 'buy' : 'pick');
    if (o.onPick) o.onPick();
  }
  closeMenu(silent) {
    const m = this.menu; if (!m) return;
    this.menu = null; this.$('menu').style.display = 'none';
    G.input.blocked = false; G.input.hit.clear(); this.cool = 0.25;
    if (!silent && G.audio) G.audio.ui('close');
    if (m.onClose && !silent) m.onClose();
  }

  // ---- speech bubbles ----------------------------------------------------------------------------
  say(target, text, secs = 3.6) {
    let b = this.bubbles.find((x) => x.target === target);
    if (!b) {
      if (this.bubbles.length >= 8) { const old = this.bubbles.shift(); old.el.remove(); }
      b = { target, el: document.createElement('div') }; b.el.className = 'bubble'; this.$('bubbles').appendChild(b.el); this.bubbles.push(b);
    }
    b.t = secs; b.el.innerHTML = (target.name ? `<b>${esc(target.name)}</b>` : '') + esc(text);
  }
  updateBubbles(dt) {
    const cam = G.camera, w = innerWidth, h = innerHeight, v = this._v;
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i]; b.t -= dt;
      const p = b.target.pos;
      v.set(p.x, p.y + (b.target.h || 1.9), p.z);
      const d = v.distanceTo(cam.position);
      v.project(cam);
      if (b.t <= 0) { b.el.remove(); this.bubbles.splice(i, 1); continue; }
      const vis = v.z < 1 && d < 38 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      b.el.style.display = vis ? 'block' : 'none';
      if (vis) { b.el.style.left = ((v.x + 1) / 2) * w + 'px'; b.el.style.top = ((1 - v.y) / 2) * h + 'px'; b.el.style.opacity = clamp(b.t * 2, 0, 1) * clamp((38 - d) / 10, 0.3, 1); }
    }
  }

  // ---- per-frame --------------------------------------------------------------------------------------
  locate(p) {
    const ap = G.city.places.apartment, r = G.city.places.restaurant.bounds, s = G.city.places.shop.bounds;
    if (ap.inside(p)) return 'Halcyon Sky Pod 41-07';
    if (p.y < 5 && p.x > r[0] && p.x < r[1] && p.z > r[2] && p.z < r[3]) return 'Printed Petal';
    if (p.y < 5 && p.x > s[0] && p.x < s[1] && p.z > s[2] && p.z < s[3]) return 'Kinetic Robotics';
    if (G.player.state === 'ride') return G.rides && G.rides.line ? G.rides.line.title : G.rides && G.rides.riding ? 'Sky cab' : 'Maglev line 7';
    const dist = G.districts && G.districts.at(p);
    if (dist) return Math.abs(p.y - dist.y) < 40 || (dist.id === 'neon' && p.y < 40) ? (dist.id === 'neon' && p.y < 12 ? 'Neon District · Undercity' : dist.name) : `${dist.name} airspace · ${Math.round(p.y)} m`;
    for (const st of G.city.stations) if (Math.abs(p.y - st.y) < 3 && Math.hypot(p.x - st.x, p.z - st.z) < 16) return st.name + ' platform';
    if (p.y > 30) return `Meridian airspace · ${Math.round(p.y)} m`;
    for (let i = 0; i < BLOCKS.length; i++) { const b = BLOCKS[i]; if (p.x >= b.x0 && p.x <= b.x1 && p.z >= b.z0 && p.z <= b.z1) return BLOCK_NAMES[i]; }
    return Math.abs(p.x) > 192 || Math.abs(p.z) > 192 ? 'Outer Neo Central' : 'Meridian Quarter';
  }
  update(dt) {
    this.cool = Math.max(0, this.cool - dt);
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) this.$('flash').style.opacity = 0; }
    this.updateBubbles(dt);
    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.12;
      const env = G.env, p = G.player, st = G.state, car = G.car;
      this.$('clock').textContent = fmtClock(env.mins);
      this.$('daywx').textContent = `${weekday(env.day)} · Day ${env.day} · ${env.label}`;
      this.$('loc').textContent = this.locate(p.pos);
      this.$('wallet').textContent = Math.round(st.wallet).toLocaleString('en-US');
      this.$('energy').style.width = p.energy + '%'; this.$('energy').style.background = p.energy < 20 ? 'var(--warn)' : 'var(--ok)';
      this.$('energyv').textContent = Math.round(p.energy) + '%';
      const sd = st.standing;
      this.$('standing').textContent = sd >= 40 ? 'Well liked' : sd >= 15 ? 'Familiar face' : sd > -10 ? 'Newcomer' : sd > -40 ? 'Watched' : 'Flagged';
      const jr = this.$('jetrow'); jr.style.display = p.jet ? 'flex' : 'none'; if (p.jet) this.$('jetv').textContent = Math.round(p.fuel) + '%';
      const drive = p.state === 'drive', ve = this.$('vehicle');
      if (drive !== this._drive) { this._drive = drive; ve.style.display = drive ? 'block' : 'none'; this.setHelp(); }
      if (drive) {
        this.$('v-speed').textContent = Math.round(car.speed * 3.6);
        this.$('v-mode').textContent = `${car.spec.name} · ${car.auto ? 'AUTOPILOT' : car.boost ? 'BOOST' : car.assist ? 'LANDING ASSIST' : car.mode === 'fly' ? 'FLIGHT' : car.mode === 'drive' ? 'HOVER' : 'PARKED'}`;
        this.$('v-alt').textContent = `${Math.max(0, Math.round(car.altitude()))} m AGL · ${Math.round(car.pos.y)} m`;
        this.$('v-bat').textContent = Math.round(car.battery) + '%'; this.$('v-batbar').style.width = car.battery + '%'; this.$('v-batbar').style.background = car.battery < 15 ? 'var(--warn)' : 'var(--c)';
        this.$('v-hull').textContent = Math.round(car.hull) + '%';
        this.$('v-warn').textContent = car.hull <= 0 ? 'HULL FAILURE' : car.battery <= 0 ? 'BATTERY EMPTY' : G.traffic.inLane ? 'SKY LANE: AUTOPILOT ONLY' : G.traffic.nearMiss ? 'TRAFFIC PROXIMITY' : car.battery < 15 ? 'LOW BATTERY' : car.auto ? '→ ' + car.auto.pad.name.toUpperCase() : '';
      }
    }
    this.mapT -= dt;
    if (this.mapT <= 0) { this.mapT = 0.1; this.drawMap(); }
  }

  // The minimap follows you (and zooms out when you fly or drive); the full map (M) shows all of Neo Central.
  drawMap() { const d = G.player.state === 'drive' || G.player.state === 'ride' || G.player.jet; this.zoom += ((d ? 620 : 250) - this.zoom) * 0.08; this.paint(this.map, 336, G.player.pos.x, G.player.pos.z, 336 / this.zoom, false); }
  paint(g, S, cx, cz, k, full) {
    const p = G.player.pos, c = G.city, car = G.car;
    const X = (x) => S / 2 + (x - cx) * k, Y = (z) => S / 2 + (z - cz) * k;
    g.fillStyle = '#080b11'; g.fillRect(0, 0, S, S);
    if (G.metro) {                                            // the street grid: land, blocks by use, sea and canal
      const w = S / 2 / k, i0 = Math.max(-13, Math.floor((cx - w) / 120)), i1 = Math.min(13, Math.ceil((cx + w) / 120)), j0 = Math.max(-13, Math.floor((cz - w) / 120)), j1 = Math.min(10, Math.ceil((cz + w) / 120));
      g.fillStyle = '#0c2a3d'; g.fillRect(0, Y(1196), S, S);                                        // sea
      g.fillStyle = '#11151c'; g.fillRect(X(-1620), Y(-1620), 3240 * k, 2770 * k);                  // streets
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const u = useAt(i, j), col = LAND[u]; if (!col) continue;
        g.fillStyle = col;
        if (j === 10) { const z1 = coastZ(i * 120); g.fillRect(X(i * 120 - 60), Y(1150), 120 * k + 0.5, (z1 - 1150) * k); g.fillStyle = '#0c2a3d'; g.fillRect(X(i * 120 - 60), Y(z1), 120 * k + 0.5, (1262 - z1) * k); }
        else if (u === 'park' || u === 'green') g.fillRect(X(i * 120 - 60), Y(j * 120 - 60), 120 * k + 0.5, 120 * k + 0.5);
        else g.fillRect(X(i * 120 - 50), Y(j * 120 - 50), 100 * k, 100 * k);
      }
      g.fillStyle = '#17506a'; for (const c of CANAL) g.fillRect(X(c.x0), Y(c.z0), (c.x1 - c.x0) * k, (c.z1 - c.z0) * k + (c.x1 - c.x0 < 30 ? 60 * k : 0));
      g.fillStyle = '#5a6577'; for (const b of G.metro.bridges) g.fillRect(X(b.x - b.hx), Y(b.z - b.hz), b.hx * 2 * k, b.hz * 2 * k);
    }
    if (G.roads) {                                            // highways and the ring road
      g.strokeStyle = '#3a4456'; g.lineWidth = Math.max(2, 16 * k); g.lineCap = 'round';
      g.beginPath(); for (const r of G.roads.radials) { g.moveTo(X(r.ax), Y(r.az)); g.lineTo(X(r.bx), Y(r.bz)); } g.stroke();
      g.beginPath(); g.arc(X(0), Y(0), G.roads.ring * k, 0, 6.3); g.stroke();
    }
    g.fillStyle = '#171c26'; g.fillRect(X(-190), Y(-190), 380 * k, 380 * k);
    if (G.districts) for (const d of G.districts.list) { g.fillStyle = '#1d2533'; g.fillRect(X(d.x - 186), Y(d.z - 186), 372 * k, 372 * k); }
    BLOCKS.forEach((b, i) => { g.fillStyle = i === 4 ? '#1c4334' : i === 3 ? '#222c3d' : '#2a3242'; g.fillRect(X(b.x0), Y(b.z0), 100 * k, 100 * k); });
    const rect = (b, col) => { g.fillStyle = col; g.fillRect(X(b[0]), Y(b[2]), (b[1] - b[0]) * k, (b[3] - b[2]) * k); };
    rect(c.places.restaurant.bounds, '#b05a80'); rect(c.places.shop.bounds, '#3f9a66'); rect([-42, -8, -114, -80], '#3b6f95');
    for (const st of c.stores) rect([st.lo.x, st.hi.x, st.lo.z, st.hi.z], st.kind === 'home' ? '#3b6f95' : '#b98a3e');   // shops you can walk into
    g.strokeStyle = '#4de1ff'; g.lineWidth = 2;
    for (const pd of c.pads) { if (!full && pd.y > 30 && Math.abs(pd.y - p.y) > 60) continue; g.beginPath(); g.arc(X(pd.x), Y(pd.z), Math.max(3, pd.r * k * 0.7), 0, 6.3); g.stroke(); }
    if (!full) {
      g.fillStyle = '#8fa3b8';
      for (const v of G.traffic.ground) g.fillRect(X(v.p.x) - 2, Y(v.p.z) - 2, 4, 4);
      if (G.roads) for (const o of G.roads.pods) g.fillRect(X(o.x) - 2, Y(o.z) - 2, 4, 4);
      if (G.metro) for (const o of G.metro.traffic.pods) if (o.on) g.fillRect(X(o.x) - 2, Y(o.z) - 2, 4, 4);
      if (G.npcs) { g.fillStyle = '#d7e3ee'; for (const n of G.npcs.near) if (!n.inside) g.fillRect(X(n.pos.x) - 1.5, Y(n.pos.z) - 1.5, 3, 3); }
    }
    // the maglev lines: 7 round Meridian, 9 out to the coast
    for (const [line, colr] of [[G.city.train && G.city.train.path, 'rgba(127,233,255,0.75)'], [G.coastLine && G.coastLine.path, 'rgba(255,179,71,0.85)']]) {
      if (!line) continue; g.strokeStyle = colr; g.lineWidth = full ? 2.5 : 2; g.setLineDash([6, 4]); g.beginPath();
      line.pts.forEach((q, n) => (n ? g.lineTo(X(q[0]), Y(q[2])) : g.moveTo(X(q[0]), Y(q[2])))); if (line.closed) g.closePath(); g.stroke(); g.setLineDash([]);
    }
    if (full && G.coastLine) { g.fillStyle = '#ffb347'; for (const st of G.coastLine.stations) { g.beginPath(); g.arc(X(st.x), Y(st.z), 4, 0, 6.3); g.fill(); } }
    const rt = G.metro && G.metro.route;
    if (rt) {                                                 // the route you asked for, and its end
      g.strokeStyle = '#59e0ff'; g.lineWidth = full ? 3 : 4; g.lineJoin = 'round'; g.beginPath(); rt.pts.forEach((q, n) => (n ? g.lineTo(X(q[0]), Y(q[1])) : g.moveTo(X(q[0]), Y(q[1])))); g.stroke();
      let ex = X(rt.x), ey = Y(rt.z); const ddx = ex - S / 2, ddy = ey - S / 2, dd = Math.hypot(ddx, ddy), lim = S / 2 - 12; if (dd > lim) { ex = S / 2 + (ddx / dd) * lim; ey = S / 2 + (ddy / dd) * lim; }
      g.fillStyle = '#59e0ff'; g.beginPath(); g.arc(ex, ey, 6, 0, 6.3); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
    }
    if (G.garage && G.garage.parked) { g.fillStyle = '#c98a84'; for (const e of G.garage.parked) { g.save(); g.translate(X(e.x), Y(e.z)); g.rotate(Math.PI - e.yaw); g.fillRect(-3, -5, 6, 10); g.restore(); } }   // your other vehicles, parked
    g.fillStyle = '#ff5a4d'; g.save(); g.translate(X(car.pos.x), Y(car.pos.z)); g.rotate(Math.PI - car.yaw); g.fillRect(-3.5, -6, 7, 12); g.restore();
    if (G.teleport) for (const m of G.teleport.markers()) { const x = X(m.x), y = Y(m.z); g.fillStyle = m.color; g.beginPath(); g.moveTo(x, y - 7); g.lineTo(x + 6, y); g.lineTo(x, y + 7); g.lineTo(x - 6, y); g.closePath(); g.fill(); }
    const marks = G.jobs ? [...G.jobs.markers(), ...(G.drone ? G.drone.markers() : []), ...(G.world ? G.world.markers() : []), ...(G.street ? G.street.markers() : []), ...(G.happen ? G.happen.markers() : []), ...(G.streetTaxi ? G.streetTaxi.markers() : []), ...(G.story ? G.story.markers() : []), ...(G.incidents ? G.incidents.markers() : []), ...(G.villains ? G.villains.markers() : [])] : [];
    for (const m of marks) {
      let mx = X(m.x), my = Y(m.z); const dx = mx - S / 2, dy = my - S / 2, d = Math.hypot(dx, dy), lim = S / 2 - 10;
      if (d > lim) { mx = S / 2 + (dx / d) * lim; my = S / 2 + (dy / d) * lim; }
      g.strokeStyle = m.color || '#ffd34d'; g.lineWidth = 3; g.beginPath(); g.arc(mx, my, 7, 0, 6.3); g.stroke();
      if (m.story) { g.fillStyle = m.color; g.beginPath(); g.arc(mx, my, 3.5, 0, 6.3); g.fill(); }   // the story's next step
    }
    g.save(); g.translate(X(p.x), Y(p.z)); g.rotate(Math.PI - (G.player.state === 'drive' ? car.yaw : G.player.yaw));
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 7); g.lineTo(0, 3); g.lineTo(-6, 7); g.closePath(); g.fill(); g.restore();
    g.fillStyle = '#9db3c4'; g.font = '600 18px system-ui'; g.fillText('N', S / 2 - 6, 20);
    if (full) {
      g.font = '600 15px system-ui'; g.textAlign = 'center';
      g.fillStyle = '#cfe3f2'; g.fillText('MERIDIAN', X(0), Y(-205));
      for (const d of G.districts.list) g.fillText(d.name.toUpperCase(), X(d.x), Y(d.z - 198));
      g.fillStyle = '#9fc7a8'; g.fillText('GRAND ARBOR PARK', X(720), Y(720)); g.fillText('ARBOR HEIGHTS', X(-1020), Y(-1090)); g.fillText('SKYHAVEN GREEN', X(640), Y(-430));
      g.fillStyle = '#d9cfa8'; g.fillText('SOLARA BAY', X(810), Y(1290)); g.fillStyle = '#aab4c2'; g.fillText('TIDEWATER PORT', X(-840), Y(1290)); g.fillText('MIDTOWN', X(0), Y(330));
      g.textAlign = 'start';
    }
  }
  bigMap() {
    const S = 760, k = S / 3440, CZ = -150, T = G.teleport, here = T.gates.find((q) => T.usable(q) && q.pos.distanceToSquared(G.player.pos) < 12), can = here || (G.state.owns.beacon && G.player.state === 'walk');
    this.openMenu({ title: 'Neo Central', who: 'White arrow: you · red: your vehicle · diamonds: transit gates · rings: landing pads · amber: shops', wide: true,
      html: `<canvas id="bigmap" width="${S}" height="${S}" style="width:100%;border-radius:6px;display:block;cursor:${can ? 'pointer' : 'default'}"></canvas><p style="margin-top:8px;color:var(--dim);font-size:12.5px">${can ? 'Click a transit gate (diamond) to travel there.' : 'Stand on your feet to travel by clicking a gate.'} Click anywhere else to set a route along the streets; click its end again to clear it.</p>`,
      options: [{ label: 'Close', onPick: () => {} }] });
    const cv = this.$('bigmap'); this.paint(cv.getContext('2d'), S, 0, CZ, k, true);
    cv.onclick = (e) => {
      const r = cv.getBoundingClientRect(), wx = ((e.clientX - r.left) / r.width - 0.5) * S / k, wz = CZ + ((e.clientY - r.top) / r.height - 0.5) * S / k;
      const hit = T.gates.filter((q) => q !== here && T.attuned(q)).map((q) => ({ q, d: Math.hypot(q.pos.x - wx, q.pos.z - wz) })).sort((a, b) => a.d - b.d)[0];
      if (!(can && hit && hit.d < 70)) {                        // anywhere else on the map: set (or clear) a route along the streets
        const M = G.metro, from = G.player.state === 'drive' ? G.car.pos : G.player.pos;
        if (M.route && Math.hypot(M.route.x - wx, M.route.z - wz) < 90) { M.route = null; this.toast('Route cleared.', 'info'); }
        else { const rt = M.setRoute(wx, wz, from); this.toast(rt ? `Route set: ${rt.len >= 1000 ? (rt.len / 1000).toFixed(1) + ' km' : Math.round(rt.len) + ' m'} along the streets. Follow the blue line on the map.` : 'No way there along the streets.', rt ? 'good' : 'warn'); }
        this.paint(cv.getContext('2d'), S, 0, CZ, k, true); return;
      }
      if (hit && hit.d < 70) { if (!here && T.cool > 0) return this.toast(`The beacon is recharging: ${Math.ceil(T.cool)} s.`, 'warn'); this.closeMenu(true); T.go(hit.q, !here); }
    };
  }

  // ---- title + character creator ---------------------------------------------------------------------------
  showTitle({ hasSave, onContinue, onNew }) {
    this.titleOpen = true; G.input.blocked = true; this.root.classList.add('titled');
    const t = this.$('title'); t.style.display = 'flex';
    const home = () => {
      const art = artUrl('title.jpg');
      const vid = matchMedia('(prefers-reduced-motion: reduce)').matches ? '' : `<video class="t-vid" src="${import.meta.env.BASE_URL}video/title-loop.mp4" autoplay muted loop playsinline preload="auto" onerror="this.remove()" oncanplay="this.classList.add('on')"></video>`;   // a Higgsfield clip of the title picture; the still stays if it is missing
      t.innerHTML = `${art ? `<div class="t-art${document.getElementById('boot') ? ' still' : ''}" style="background-image:url(${art})">${vid}<div class="t-grad"></div></div>` : ''}<div class="col"><h1>NEO EARTH <span>2226</span></h1>
        <div class="tag">Meridian Quarter, Neo Central. No story, no missions you have to take.<br>Walk, talk, eat, work, fly. The city keeps its own schedule.</div>
        ${hasSave ? '<button class="btn" id="t-cont">Continue</button>' : ''}<button class="btn ${hasSave ? 'alt' : ''}" id="t-new">New resident</button><button class="btn alt" id="t-file" title="A save file made with Pause ▸ Save to a file">Load a save file</button><div class="tag" id="t-msg" style="color:#ffb3a8;margin:4px 0 0"></div>
        <div class="tag" style="margin-top:18px;font-size:12px">Real-time 3D · Greater Neo Central: one city from the Heights to the sea</div></div>`;
      if (hasSave) t.querySelector('#t-cont').onclick = () => { this.hideTitle(); onContinue(); };
      t.querySelector('#t-new').onclick = creator;
      t.querySelector('#t-file').onclick = () => SaveFile.pick((f) => {
        const say = (m) => { const el = t.querySelector('#t-msg'); if (el) el.textContent = m; };
        if (f.error) { say(f.error); return; }
        const when = f.saved ? new Date(f.saved).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'at an unknown time';
        t.querySelector('.col').innerHTML = `<h1 style="font-size:30px">LOAD THIS SAVE?</h1><div class="tag"><b style="color:#fff">${esc(f.summary)}</b><br>Saved ${esc(when)}, with ${f.photos.length} photo${f.photos.length === 1 ? '' : 's'}.${hasSave ? '<br>It replaces the progress in this browser, which is kept as the backup save.' : ''}</div><button class="btn" id="t-load">Load it</button><button class="btn alt" id="t-back">Back</button><div class="tag" id="t-msg" style="color:#ffb3a8;margin:4px 0 0"></div>`;
        t.querySelector('#t-load').onclick = () => { if (!SaveFile.apply(f)) say('Could not load it: this browser\'s storage is not available.'); };
        t.querySelector('#t-back').onclick = home;
      });
    };
    const creator = () => {
      const L = G.player.look, sw = (key, list) => `<div class="sw" data-k="${key}">${list.map((c) => `<i style="background:${c}" data-v="${c}" class="${L[key] === c ? 'on' : ''}"></i>`).join('')}</div>`;
      const bt = (key, list) => `<div class="sw" data-k="${key}" style="margin-top:5px">${list.map(([n, v]) => `<button data-v="${v}" class="${String(L[key]) === String(v) ? 'on' : ''}">${n}</button>`).join('')}</div>`;
      t.innerHTML = `<div class="col"><h1 style="font-size:30px">NEW RESIDENT</h1><div class="creator panel" style="max-height:66vh;overflow:auto">
        <label>Name</label><input type="text" id="c-name" maxlength="18" value="${esc(G.state.name)}">
        <label>Skin</label>${sw('skin', SKINS)}<label>Eyes</label>${sw('eye', EYES)}<label>Hair</label>${sw('hair', HAIRS)}
        <div class="sw" data-k="hairStyle" style="margin-top:6px">${HAIR_STYLES.map((n, i) => `<button data-v="${i}" class="${L.hairStyle === i ? 'on' : ''}">${n}</button>`).join('')}</div>
        <label>Highlights</label>${sw('streak', ACCENTS)}${bt('streak', [['No highlights', null]])}
        ${bt('beard', [['No beard', false], ['Beard', true]])}
        <label>Height</label><input type="range" id="c-h" min="1.55" max="1.98" step="0.01" value="${L.height}">
        <label>Build</label><input type="range" id="c-b" min="0.85" max="1.25" step="0.01" value="${L.build}">
        <label>Body shape</label><input type="range" id="c-s" min="0" max="1" step="0.01" value="${L.shape ?? 0.35}">
        <label>Outfit</label>${bt('outfit', [['Top', 'plain'], ['Open jacket', 'jacket'], ['Long coat', 'coat'], ['Vest', 'vest']])}${bt('sleeves', [['Long sleeves', 'long'], ['Short', 'short'], ['None', 'none']])}${bt('legs', [['Trousers', 'trousers'], ['Shorts', 'shorts'], ['Skirt', 'skirt']])}
        <label>Jacket or top</label>${sw('top', CLOTHES)}<label>Shirt under a jacket</label>${sw('shirt', CLOTHES)}<label>Trousers or skirt</label>${sw('bottom', CLOTHES)}<label>Smart-fabric trim</label>${sw('accent', ACCENTS)}
        <label>Extras</label>${bt('hat', [['No hat', null], ['Cap', 'cap'], ['Beanie', 'beanie'], ['Brim', 'brim'], ['Hood', 'hood'], ['Headphones', 'phones']])}${bt('glasses', [['No glasses', false], ['Glasses', true]])}
        </div><div style="margin-top:12px"><button class="btn" id="c-go">Enter Meridian</button><button class="btn alt" id="c-back">Back</button></div></div>`;
      t.querySelectorAll('.sw').forEach((box) => box.addEventListener('click', (e) => {
        const v = e.target.dataset.v; if (v === undefined) return;
        const key = box.dataset.k; G.player.setLook({ [key]: key === 'hairStyle' ? +v : v === 'true' ? true : v === 'false' ? false : v === 'null' ? null : v });
        box.querySelectorAll('.on').forEach((x) => x.classList.remove('on')); e.target.classList.add('on');
      }));
      t.querySelector('#c-h').oninput = (e) => G.player.setLook({ height: +e.target.value });
      t.querySelector('#c-b').oninput = (e) => G.player.setLook({ build: +e.target.value });
      t.querySelector('#c-s').oninput = (e) => G.player.setLook({ shape: +e.target.value });
      t.querySelector('#c-back').onclick = home;
      t.querySelector('#c-go').onclick = () => { G.state.name = t.querySelector('#c-name').value.trim() || 'Resident'; this.hideTitle(); onNew(); };
    };
    home();
  }
  hideTitle() { this.titleOpen = false; this.root.classList.remove('titled'); this.$('title').style.display = 'none'; G.input.blocked = false; G.input.hit.clear(); }
}
