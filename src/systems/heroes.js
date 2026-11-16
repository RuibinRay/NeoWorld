// Hero Mode. At the Hero Hall (a holo-dais in the Commons) or from the phone you become one of five
// heroes (data/heroes.js): your resident's look is put away and the hero's body, gear and powers
// take over until you go back to being yourself.
//   left click / Z  light attack (a combo)      right click / X  heavy attack
//   1 2 3           powers (each on a cooldown)  R                ultimate (when the meter is full)
// The meter fills as you land hits. Movement powers (swinging, wall running, flight, dashes) put the
// player in the 'hero' state, driven by move() below; everything else rides on normal walking.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { HEROES, HERO_IDS, HIDEOUTS, VILLAINS } from '../data/heroes.js';
import { clamp, damp, dampAngle, angDelta, lerp } from '../core/util.js';
import { std, neon, labelTexture } from '../world/materials.js';
import { makeDog, animateDog, makeHumanoid, animateRig } from '../entities/rigs.js';
import { DEFAULT_LOOK } from '../entities/player.js';
import { artUrl } from '../world/art.js';
import { Forms } from './forms.js';
const poss = (k) => { const c = VILLAINS[k].crew; return c.endsWith('s') ? c + "'" : c + "'s"; };   // Kurozan's crew's, Vektor's drones', The Shadow Clan's

const V = () => new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const SLOTS = ['p1', 'p2', 'p3', 'p5', 'ult'];
// which limb leaves the trail for each attack pose: R / L fists, F the foot, B the blade
const TRAIL_PART = { punchL: 'L', kick: 'F', roundhouse: 'F', spinkick: 'F', dropkick: 'F', slash: 'B', slash2: 'B', dashstab: 'B', spin: 'F' };
const KEYS = { p1: 'Digit1', p2: 'Digit2', p3: 'Digit3', p5: 'Digit5', ult: 'KeyR' };
// cooldowns (s) per hero and power
const CD = {
  strand: { light: 0.3, heavy: 1.2, p1: 1.0, p2: 4, p3: 16, p5: 8 }, forge: { light: 0.3, heavy: 1.2, p1: 8, p2: 11, p3: 16, p5: 18 },
  raiko: { light: 0.32, heavy: 1.4, p1: 4, p2: 10, p3: 5, p5: 14 }, sable: { light: 0.3, heavy: 1.2, p1: 7, p2: 18, p3: 12, p5: 14 },
  rook: { light: 0.3, heavy: 1.6, p1: 1.5, p2: 1, p3: 12, p5: 12 },
  brann: { light: 0.34, heavy: 1.8, p1: 3, p2: 5, p3: 9, p5: 9 }, bulwark: { light: 0.36, heavy: 1.6, p1: 4, p2: 6, p3: 5, p5: 10 },
  warden: { light: 0.3, heavy: 2.2, p1: 4, p2: 12, p3: 16, p5: 16 }, kitsu: { light: 0.22, heavy: 1.0, p1: 6, p2: 16, p3: 6, p5: 7 },
  trine: { light: 0.3, heavy: 1.6, p1: 2.2, p2: 8, p3: 6, p5: 12 }, ember: { light: 0.3, heavy: 1.4, p1: 4, p2: 12, p3: 16, p5: 14 },
};
const UP_COST = [400, 900, 1600];
const DIFF = { easy: { hp: 0.7, dmg: 0.6, raid: 1.4 }, normal: { hp: 1, dmg: 1, raid: 1 }, hard: { hp: 1.4, dmg: 1.4, raid: 0.7 } };
const XP_AT = [300, 900, 2000, 4000];
// Hero missions: The Three Storms, given by Commander Ilse Varga at the Hall
const MISSIONS = [
  { name: 'First Storm', raid: { owner: 'kurozan', type: 'smash' }, pay: 500, goal: "stop a raid by Kurozan's crew", brief: 'Kurozan sends his robots to test us. Go and show him what this Hall is for.' },
  { name: 'Cages in the Dark', raid: { owner: 'shade', type: 'rescue' }, pay: 700, goal: 'break the cages in a Shadow Clan raid and free the people inside', brief: 'Shade is taking people off the street and caging them. We do not know why yet. Get them out.' },
  { name: 'Follow the Money', raid: { owner: 'vektor', type: 'heist' }, pay: 800, goal: "stop the armoured truck in one of Vektor's raids", brief: 'Vektor is stealing credit cores. Someone is paying for three armies at once. Stop the truck before it is gone.' },
  { name: 'Hold the Line', raid: { type: 'defend' }, pay: 900, goal: "hold the orbital lift's uplink through three waves", brief: 'They are going for the orbital lift together. If the uplink falls, the city is cut off from the ring. Hold it.' },
  { name: 'The Three Storms', bosses: ['kurozan', 'vektor', 'shade'], pay: 3000, goal: 'beat Kurozan, Vektor and Shade in their arenas (Hall ▸ Boss fights)', brief: 'It was never three separate storms. They share the money and the plan. Beat all three and it ends.' },
];   // experience for levels 2, 3, 4, 5
// signature moves, unlocked at level 4 (key 4): sky strikes, blasts round you, a pack of copies, or a long dash
const SIG = {
  strand: ['Web dome', 'nova', { r: 9, dmg: 25, stun: 3, kind: 'web', color: '#e8fbff' }], forge: ['Orbital laser', 'sky', { n: 5, dmg: 45, color: '#ff8a5c', r: 3 }],
  raiko: ['Lightning rain', 'sky', { n: 7, dmg: 35, color: '#c9b8ff', r: 3 }], sable: ['Hound howl', 'nova', { r: 11, dmg: 15, stun: 3.5, color: '#ff5a6e' }],
  rook: ['Spring slam', 'leap', { r: 9, dmg: 60, color: '#f08a24' }], brann: ['Hammer fall', 'sky', { n: 6, dmg: 40, color: '#8fd3ff', r: 3.5 }],
  bulwark: ['Earthquake', 'nova', { r: 13, dmg: 55, knock: 16, up: 8, color: '#ffb347', quake: true }], warden: ['Shield wall', 'nova', { r: 7, dmg: 10, knock: 20, color: '#5fd6c2', block: 4 }],
  kitsu: ['Clone barrage', 'clones', { n: 6, t: 6 }], trine: ['Dragon cut', 'dash', { dist: 26, dmg: 70, color: '#ff6f8a' }], ember: ['Fire tornado', 'nova', { r: 8, dmg: 40, kind: 'fire', color: '#ff7a1a', fire: true }],
};
// Which Hero Hall missions (The Three Storms) must be done before a hero can be chosen. A hero you have
// already played stays unlocked, and code 7103 unlocks them all.
const UNLOCK = { strand: 0, forge: 0, raiko: 0, sable: 1, rook: 1, brann: 2, bulwark: 2, warden: 3, kitsu: 3, trine: 4, ember: 4 };
// Heroes with a Higgsfield clip (public/video/hero-<id>.mp4): it plays over the portrait on the card shown
// when you become them, which then stays up a little longer
const HERO_CLIPS = new Set(['strand', 'forge', 'raiko', 'sable', 'rook', 'brann', 'bulwark', 'warden', 'kitsu', 'trine', 'ember']);
const COPY_NAMES ={quake: 'Quake (brute slam)', volley: 'Bolt volley (gunner)', rockets: 'Rocket swarm (drone)', storm: 'Storm breath (Kurozan)', club: 'Club quake (Kurozan)' };

export class Heroes {
  constructor() {
    this.forms = new Forms(this);   // transformations (systems/forms.js), key T
    this.on = false; this.id = null; this.hp = 100; this.max = 100; this.meter = 0; this.cd = {}; this.ownLook = null; this.gear = [];
    this.saved = {}; this.partner = null; this.timers = []; this.combo = 0; this.comboT = 0; this.mv = null; this.proj = []; this.hounds = []; this.copied = null;
    this.form = 1; this.formT = 0; this.ult = 0; this.shield = 0; this.dodge = 0; this.balloon = 0; this.tired = 0; this.channel = null; this.downT = 0; this.calm = 0;
    this.v = V(); this.w = V(); this.u = V();
    this.buildHall(); this.buildHud();
    addEventListener('contextmenu', (e) => { if (this.on && e.target === G.renderer.domElement) e.preventDefault(); });
  }
  get H() { return HEROES[this.id]; }
  get st() { const s = G.state; if (!s.heroes) s.heroes = { raids: 0, boss: 0, used: {} }; return s.heroes; }
  get alive() { return this.on && this.downT <= 0 && !this.reviving; }   // still down while the screen fades to the Hall
  get diff() { return DIFF[this.st.diff || 'normal']; }
  // hero damage multiplier: Power upgrades, Bulwark's rage and rampage
  get dmgMul() { let k = (1 + 0.15 * ((this.st.up || {}).power || 0)) * (this.level() >= 3 ? 1.1 : 1); if (this.id === 'bulwark') k *= (1 + (this.rage || 0) / 100 * 0.6) * (this.ult > 0 ? 2 : 1); return k; }

  // ---- the Hero Hall --------------------------------------------------------------------------------
  buildHall() {
    const col = G.colliders; let at = null;
    const clear = (x, z, r) => !col.near(x, z, r).some((b) => b.minX < x + r && b.maxX > x - r && b.minZ < z + r && b.maxZ > z - r && b.maxY > 0.4 && b.minY < 4);
    for (let k = 0; k < 60 && !at; k++) { const a = k * 0.9, r = k ? 3 + k * 0.7 : 0, x = -26 + Math.cos(a) * r, z = 22 + Math.sin(a) * r; if (clear(x, z, 3.2) && col.groundAt(x, z, 2, 1, 0.3) < 1.2 && !(G.districts.waterAt && G.districts.waterAt(x, z, 0.2))) at = { x, z }; }
    at = at || { x: -26, z: 22 };
    const y = col.groundAt(at.x, at.z, 2, 1, 0.3), g = new THREE.Group(); g.position.set(at.x, y, at.z); G.scene.add(g);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 0.16, 40), std('#161b24', 0.4, 0.7)); disc.position.y = 0.08; disc.receiveShadow = true; g.add(disc);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.05, 6, 48), neon('#ffd34d', 1.6)); rim.rotation.x = Math.PI / 2; rim.position.y = 0.17; g.add(rim);
    this.emblem = new THREE.Group(); this.emblem.position.y = 2.6; g.add(this.emblem);
    for (const [r, c] of [[0.9, '#3fe0c5'], [0.72, '#ff9a3c'], [0.56, '#a78bff'], [0.4, '#ff5a6e'], [0.26, '#ffd34d']]) { const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035, 6, 40), neon(c, 1.8)); t.rotation.y = r * 4; this.emblem.add(t); }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.1), new THREE.MeshBasicMaterial({ map: labelTexture('HERO HALL', { color: '#ffd34d', sub: 'choose a hero · Kurozan is loose', size: 64 }), transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    sign.position.y = 4.1; g.add(sign); this.sign = sign;
    this.hall = { x: at.x, y, z: at.z };
    G.interact.add({ pos: { x: at.x, y, z: at.z }, r: 3.2, yTol: 2.5, label: () => (this.on ? `Hero Hall: ${this.H.name}` : 'Hero Hall: choose a hero'), use: () => this.menu() });
  }
  menu() {
    const s = this.st, P = G.player;
    if (P.state === 'drive' || P.state === 'ride') { G.ui.toast('Step out of the vehicle first.', 'warn'); return; }
    const m = this.mission();
    G.ui.openMenu({ title: 'Hero Hall', who: `Hero Mode · raids stopped: ${s.raids} · bosses beaten: ${(s.boss || 0) + (s.bossV || 0) + (s.bossS || 0)}`, wide: true,
      html: `<p>Kurozan, Vektor and Shade are loose in Neo Central. ${this.on ? `You are <b style="color:${this.H.color}">${this.H.name}</b>, level ${this.level()}.` : 'Choose a hero to begin.'} <b>Left click / Z</b> light, <b>right click / X</b> heavy, <b>1 2 3</b> powers, <b>4</b> signature move (level 4), <b>R</b> ultimate, <b>G</b> swap to your partner.</p>`,
      options: [
        { label: this.on ? 'Choose another hero' : 'Choose a hero', desc: `${HERO_IDS.length} heroes`, onPick: () => this.heroMenu() },
        { label: 'Hero missions', desc: m ? `Now: ${m.name}` : (s.hm || 0) >= MISSIONS.length ? 'Chapter complete' : 'The Three Storms: five missions', onPick: () => this.missionMenu() },
        ...(this.on ? [
          { label: `Partner: ${this.partner ? HEROES[this.partner].name : 'none'}`, desc: 'G swaps to them mid-fight; R with both meters full is a team strike', onPick: () => this.partnerMenu() },
          { label: `Costume: ${['classic', 'alternate', 'elite'][this.costume || 0]}`, desc: `Alternate at level 2, elite at level 5 (now level ${this.level()})`, onPick: () => this.costumeMenu() },
          { label: `${this.H.name}'s moves`, onPick: () => this.movesMenu() },
          { label: 'Boss fights', desc: 'Kurozan, Vektor and Shade, each in their own arena', onPick: () => this.bossMenu() },
          { label: 'Hideouts', desc: 'Each crew has a base: stop their raids to find it, then take it', onPick: () => this.hideoutMenu() },
        ] : []),
        { label: 'Upgrades', desc: 'Power, vitality and focus, for every hero', onPick: () => this.upgradeMenu() },
        ...(this.on ? [{ label: this.training ? 'End training' : 'Training ground', desc: 'Three robots that never hit back, and a damage readout', onPick: () => { if (this.training) { G.villains.endTraining(); G.ui.toast('Training over.', 'info'); } else G.villains.startTraining(); } }] : []),
        { label: `Difficulty: ${s.diff || 'normal'}`, desc: 'Easy: weaker villains, rarer raids · Hard: tougher, harder-hitting, more often', onPick: () => { const o = ['easy', 'normal', 'hard'], k = o.indexOf(s.diff || 'normal'); s.diff = o[(k + 1) % 3]; G.ui.toast(`Hero Mode difficulty: ${s.diff}. New villains use it.`, 'info'); this.menu(); } },
        ...(this.on ? [{ label: 'Go back to being yourself', onPick: () => this.leave() }] : []),
        { label: 'Close', onPick: () => {} },
      ] });
  }
  // ---- unlocking heroes: by Hero Hall missions, or code 7103 ----------------------------------------------
  unlocked(id) { const s = this.st; return !!(G.state.perks && G.state.perks.heroes) || !!s.used[id] || (s.hm || 0) >= (UNLOCK[id] || 0); }
  lockText(id) { const n = UNLOCK[id] || 0; return `Unlocks after hero mission ${n}: ${MISSIONS[n - 1].name}`; }
  heroMenu(pick = (id) => this.become(id), title = 'Choose a hero') {
    // load the card clips of the heroes you can pick while you choose, so the one you pick starts at once
    // (about 0.7 MB each; locked heroes' clips load when they unlock)
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.heroClips = this.heroClips || new Map();
      for (const id of HERO_CLIPS) if (this.unlocked(id) && !this.heroClips.has(id)) { const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.src = `${import.meta.env.BASE_URL}video/hero-${id}.mp4`; v.load(); this.heroClips.set(id, v); }
    }
    const card = (id) => { const h = HEROES[id], img = artUrl(`hero-${id}.jpg`), lv = this.level(id), open = this.unlocked(id); return `<div class="hero-row" style="${open ? '' : 'opacity:0.45;filter:grayscale(1)'}">${img ? `<img src="${img}" alt="" style="border-color:${h.color}">` : ''}<p><b style="color:${h.color}">${open ? '' : '🔒 '}${h.name}</b> <span style="color:var(--dim)">· ${h.title} · ${open ? `level ${lv}` : 'locked'}</span><br><small>${open ? h.blurb : this.lockText(id)}</small></p></div>`; };
    const open = HERO_IDS.filter((id) => this.unlocked(id)).length;
    G.ui.openMenu({ title, who: `Hero Hall · ${open} of ${HERO_IDS.length} heroes unlocked`, wide: true, html: HERO_IDS.map(card).join(''),
      options: [...HERO_IDS.map((id) => this.unlocked(id)
        ? { label: `${this.on && this.id === id ? '✓ ' : ''}${HEROES[id].name}`, desc: HEROES[id].title, onPick: () => pick(id) }
        : { label: `🔒 ${HEROES[id].name}`, desc: this.lockText(id), disabled: true, why: `${HEROES[id].name} is locked. ${this.lockText(id)} (Hero Hall ▸ Hero missions).` }),
      { label: 'Back', onPick: () => this.menu() }] });
  }
  bossMenu() {
    const s = this.st;
    G.ui.openMenu({ title: 'Boss fights', who: 'Hero Hall', body: 'Each boss waits in an arena of their own. If you are knocked out they leave until next time.',
      options: [
        { label: 'Kurozan, the Storm Dragon', desc: `Skyhaven Stadium · giant, then dragon · beaten ${s.boss || 0}×`, onPick: () => G.villains.startBoss('kurozan') },
        { label: 'Vektor, the Machine Overlord', desc: `The roof of the Aurelia Needle, 1 km up · break his shield pylons · beaten ${s.bossV || 0}×`, onPick: () => G.villains.startBoss('vektor') },
        { label: 'Shade, of the Shadow Clan', desc: `The Undercity · shadow copies and blinks · beaten ${s.bossS || 0}×`, onPick: () => G.villains.startBoss('shade') },
        { label: 'Back', onPick: () => this.menu() },
      ] });
  }
  hideoutMenu() {
    const s = this.st, V2 = G.villains, row = (k) => {
      const d = HIDEOUTS[k], v = VILLAINS[k], lv = (s.hideLv || {})[k] || 0, need = V2.intelNeed(k), got = Math.min(need, (s.intel || {})[k] || 0), taken = (s.taken || {})[k] || 0;
      return V2.found(k)
        ? { label: `${v.crew}: found`, desc: `${d.name}, ${d.area}${d.where ? ' (' + d.where.split(' (')[0] + ')' : ''} · level ${lv + 1} · taken ${taken}× · set a route`, onPick: () => { if (G.metro && G.metro.setRoute) try { G.metro.setRoute(d.x, d.z, G.player.pos); } catch { /* no route */ } G.ui.toast(`Route set to ${poss(k)} hideout at ${d.name}. Go within about 100 m to start.`, 'info'); } }
        : { label: `${v.crew}: intel ${got} of ${need}`, desc: `Stop ${need - got} more of their raid${need - got === 1 ? '' : 's'} to find their base${taken ? ` · taken ${taken}×` : ''}`, disabled: true, why: `Stop ${poss(k)} raids to find their hideout.` };
    };
    G.ui.openMenu({ title: 'Hideouts', who: 'Hero Hall', body: 'Every raid you stop gives intel on that crew\'s hideout. Once it is found it shows on the map in their colour. Taking it: three waves, three generators that keep calling in more of the crew, and a lieutenant in the last wave. It pays well, and the crew stop raiding for a while; they set up again, tougher.',
      options: [...Object.keys(HIDEOUTS).map(row), { label: 'Back', onPick: () => this.menu() }] });
  }
  partnerMenu() { this.heroMenu((id) => { if (id === this.id) { G.ui.toast('Pick someone else as your partner.', 'info'); return this.partnerMenu(); } this.partner = id; this.st.partner = id; G.ui.toast(`${HEROES[id].name} is your partner: G swaps in.`, 'good'); this.menu(); }, 'Choose a partner'); }
  costumeMenu() {
    const lv = this.level(), opts = [['Classic', 0, 1], ['Alternate', 1, 2], ['Elite', 2, 5]];
    G.ui.openMenu({ title: `${this.H.name}'s costume`, who: `level ${lv}`, options: [...opts.map(([n, k, need]) => ({ label: `${(this.costume || 0) === k ? '✓ ' : ''}${n}`, desc: lv >= need ? '' : `unlocks at level ${need}`, onPick: () => { if (lv < need) { G.ui.toast(`${n} unlocks at level ${need}.`, 'info'); return this.costumeMenu(); } this.st.costume = this.st.costume || {}; this.st.costume[this.id] = k; this.become(this.id, { keep: true }); } })), { label: 'Back', onPick: () => this.menu() }] });
  }
  movesMenu() {
    const h = this.H, F = this.forms.on || this.forms.def(), list = this.forms.on ? F.moves : [...h.moves, ...(F ? [['T ' + F.name, `Transform (when the meter is full): ${F.blurb}, 30 s`], ...F.moves.map(([k, d]) => [`  ${F.name} ${k}`, d])] : [])];
    G.ui.openMenu({ title: `${h.name}'s moves`, who: h.title, wide: true, html: list.map(([k, d]) => `<p style="margin:0 0 6px"><b>${k}</b> <span style="color:var(--dim)">· ${d}</span></p>`).join(''), options: [{ label: 'Back', onPick: () => this.menu() }, { label: 'Close', onPick: () => {} }] });
  }

  // ---- becoming a hero, and back ----------------------------------------------------------------------
  become(id, o = {}) {
    if (this.forms) this.forms.end(true);
    const p = G.player;
    if (p.state === 'sit') p.stand();
    if (p.state !== 'walk' && p.state !== 'hero') { G.ui.toast('Finish what you are doing first.', 'warn'); return; }
    if (!this.unlocked(id)) { G.ui.toast(`${HEROES[id].name} is locked. ${this.lockText(id)}.`, 'warn'); return; }
    if (!this.on) this.ownLook = { ...p.look };
    if (this.on && this.id) this.saved[this.id] = { hp: this.hp / this.max, meter: this.meter };
    this.endMove(); this.endPowers(); this.id = id; this.on = true;
    const H = this.H; this.costume = ((this.st.costume || {})[id]) || 0; if (this.costume === 1 && this.level(id) < 2) this.costume = 0; if (this.costume === 2 && this.level(id) < 5) this.costume = 0;
    this.partner = this.st.partner && this.st.partner !== id ? this.st.partner : this.partner === id ? null : this.partner;
    p.look = { ...DEFAULT_LOOK, ...H.look, ...(this.costume === 1 ? H.alt || {} : this.costume === 2 ? { top: '#16171c', bottom: '#16171c', vest: '#16171c', shell: '#2a2a30', accent: '#ffd34d' } : {}) }; p.buildRig(); p.firstPerson = false; p.board = false; p.jet = false; p.crouch = false;
    this.max = Math.round(H.hp * (1 + 0.2 * ((this.st.up || {}).vit || 0)) * (this.level(id) >= 5 ? 1.1 : 1)); const sv = (o.swap || o.keep) && this.saved[id]; this.hp = sv ? Math.max(1, Math.round(this.max * sv.hp)) : this.max; this.meter = sv ? sv.meter : 0; this.cd = {}; this.form = 1; this.calm = 0; this.rage = 0;
    this.dress(); this.applyStats();
    G.input.keys.clear();
    this.st.used[id] = true; G.state.done['hero:' + id] = true;
    if (o.swap) { G.ui.flash(H.name.toUpperCase(), 0.9); this.ball(this.centre(), 4, { dmg: 20, knock: 9, up: 3, color: H.color }); G.fx.ring(this.centre(), H.color, 0.4, 5, 0.4); }
    else if (!o.keep) { this.showCard(artUrl(`hero-${id}.jpg`), H.name, H.title, H.color, HERO_CLIPS.has(id) ? 3.4 : 2.2, false, HERO_CLIPS.has(id) ? `hero-${id}` : null); G.ui.toast(`You are ${H.name}, ${H.title}. Left click / Z and right click / X attack, 1 2 3 are powers, R the ultimate. All the moves: the Heroes app on your phone.`, 'good'); }
    if (G.audio) { G.audio.tone(330, 0.5, 0.06, 'sawtooth', null, 0.02, 2); G.audio.tone(660, 0.6, 0.04, 'triangle', null, 0.05, 1.5); }
    if (G.fx) { G.fx.ring(this.centre(), H.color, 0.4, 5, 0.6); G.fx.spark(this.centre(), H.color, 30, 7, 0.6, 0.16); }
    this.hud.style.display = 'block'; this.cross.style.display = 'block';
    if (G.villains) G.villains.heroOn();
    // the first time as Strand: how swinging works, and where to try it
    if (id === 'strand' && !o.swap && !o.keep && !G.state.done.swingTip) {
      G.state.done.swingTip = true;
      this.later(2.6, () => G.ui.openMenu({ title: 'Swinging, in four moves', who: 'Strand · web-slinging acrobat',
        html: '<p><b>Hold Space</b> to jump and swing from a line to the building ahead; keep holding and the next line goes out by itself.</p><p><b>Let go on the way up</b> out of a swing for a boost and a flip: the later in the rise, the bigger it is.</p><p><b>A / D</b> steer the swing, <b>Shift</b> in the air zips you forward, <b>C</b> dives.</p><p>Swing into a wall to run up it; hold <b>W</b> to keep running and vault the top.</p><p style="color:var(--dim)">The Swing Course downtown has rings, a clock and medals.</p>',
        options: [
          { label: 'Show me the Swing Course', desc: 'Sets a route to its start', onPick: () => { const c = G.swingCourse; if (c && G.metro.setRoute) { try { G.metro.setRoute(-96, -170, G.player.pos); } catch { /* no route */ } G.ui.toast('Route set to the Swing Course, downtown north of the park.', 'info'); } } },
          { label: 'Got it', onPick: () => {} },
        ] }));
    }
    if (!this.clipCache && !matchMedia('(prefers-reduced-motion: reduce)').matches) this.clipCache = ['kurozan', 'dragon', 'vektor', 'shade'].map((c) => { const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.src = `${import.meta.env.BASE_URL}video/${c}.mp4`; v.load(); return v; });   // the villain clips, loaded ahead of time
    G.ui.setHelp && G.ui.setHelp();
  }
  leave(quiet) {
    this.forms.end(true);
    if (!this.on) return;
    const p = G.player;
    this.endMove(); this.endPowers(); this.clearGear();
    this.on = false; this.id = null; this.speedK = 0; this.fovKick = 0; this.diving = false;
    p.look = { ...(this.ownLook || DEFAULT_LOOK) }; p.buildRig(); p.speedMul = 1; p.jumpV = 0; p.gravK = 1; p.camK = 1; p.fling = false; p.rig.root.scale.setScalar(1);
    if (p.state === 'hero') p.state = 'walk';
    this.hud.style.display = 'none'; this.cross.style.display = 'none'; this.bossEl.style.display = 'none'; this.foeEl.style.display = 'none';
    if (G.villains) G.villains.heroOff();
    if (!quiet) G.ui.toast("You are yourself again.", "info");
    G.ui.setHelp && G.ui.setHelp();
    G.input.keys.clear();
  }
  // speed, jump and gravity for the hero and the current form
  applyStats() {
    const p = G.player, H = this.H; if (!H) return;
    let sp = H.speed, jv = H.jump, gk = 1, sc = 1, ck = 1;
    if (this.id === 'rook') {
      if (this.ult > 0) { sp = 1.7; jv = 16; gk = 0.75; sc = 1.6; ck = 1.45; }
      else if (this.form === 2) { sp = 1.9; jv = 11; }
      else if (this.form === 4) { sp = 1.15; jv = 15; gk = 0.55; sc = 1.3; ck = 1.2; }
    }
    if (this.id === 'bulwark') { sc = this.ult > 0 ? 1.5 : 1 + (this.rage || 0) / 100 * 0.15; ck = this.ult > 0 ? 1.3 : 1; }
    const fs = this.forms && this.forms.stats(); if (fs) { sc = fs.sc; sp = fs.sp; jv = fs.jv; ck = fs.ck; gk = 1; }   // transformed (or changing)
    if (this.tired > 0) sp *= 0.55;
    if (this.channel && this.channel.slow) sp *= this.channel.slow;
    p.speedMul = sp; p.jumpV = jv; p.gravK = gk; p.camK = ck * (1 + (this.speedK || 0) * 0.18);   // the camera drops back a little at speed
    const b = this.balloon > 0 ? 1.45 : 1; p.rig.root.scale.set(sc * b, sc * (this.balloon > 0 ? 1.15 : 1), sc * b);
  }
  // the hero's gear on top of the body: masks, armour parts, blades
  dress() {
    this.clearGear();
    const r = G.player.rig, id = this.id, add = (parent, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz); m.castShadow = true; parent.add(m); this.gear.push(m); return m; };
    const B = (w, h, d) => new THREE.BoxGeometry(w, h, d), S = (rad) => new THREE.SphereGeometry(rad, 14, 10);
    if (id === 'strand') {
      add(r.head, S(0.13), std('#1d2a33', 0.5, 0.2), 0, 0.016, 0.01, 0, 0, 0, 1.0, 1.2, 1.16);                    // a full mask, over hair and nose
      add(r.head, B(0.17, 0.034, 0.03), neon('#5ff5da', 2.0), 0, 0.024, 0.148);                                                 // one glowing visor band across the front
      for (const sx of [-1, 1]) add(r.head, B(0.006, 0.1, 0.006), neon('#3fe0c5', 1.2), sx * 0.075, -0.03, 0.105, -0.25, 0, sx * 0.25);
      for (const e of [r.elbL, r.elbR]) add(e, B(0.06, 0.07, 0.07), neon('#3fe0c5', 1.5), 0, -0.27, 0.02);                      // line shooters
      for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) add(r.chest, B(0.008, 0.36, 0.008), neon('#3fe0c5', 0.9), sx * (0.05 + k * 0.045), 0.32, 0.128, 0, 0, sx * (0.1 + k * 0.18));
    } else if (id === 'forge') {
      this.core = add(r.chest, new THREE.CylinderGeometry(0.06, 0.06, 0.02, 20), neon('#9ff4ff', 2.4), 0, 0.4, 0.15, Math.PI / 2);
      for (const sx of [-1, 1]) { add(r.chest, B(0.13, 0.1, 0.16), std('#b8652a', 0.35, 0.8), sx * 0.21, 0.6, 0, 0, 0, sx * -0.2); add(r.chest, B(0.07, 0.05, 0.05), neon('#ffb066', 1.2), sx * 0.21, 0.66, 0.06); }
      for (const k of [r.kneeL, r.kneeR]) add(k, new THREE.CylinderGeometry(0.05, 0.07, 0.06, 10), neon('#9ff4ff', 1.6), 0, -0.47, 0.03);
      for (const e of [r.elbL, r.elbR]) add(e, new THREE.CylinderGeometry(0.03, 0.03, 0.01, 12), neon('#9ff4ff', 2), 0, -0.36, 0.035, Math.PI / 2);
      // thruster flames: a pale outer cone and a white-hot core out of each boot sole and palm, along the limb.
      // Hidden until Forge flies; flyStep sets their length (hover, cruise, afterburner) and flickers them.
      const flame = (parent, y, z, s) => {
        const g = new THREE.Group(); g.position.set(0, y, z); g.visible = false; parent.add(g); this.gear.push(g);
        const cone = (rad, color, op) => { const geo = new THREE.ConeGeometry(rad, 1, 12, 1, true); geo.rotateX(Math.PI); geo.translate(0, -0.5, 0); const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.frustumCulled = false; g.add(m); return m; };
        return { g, outer: cone(0.085 * s, '#4fc4ff', 0.55), inner: cone(0.042 * s, '#ffffff', 0.95), s };
      };
      this.jets = { boots: [flame(r.kneeL, -0.5, 0.03, 1), flame(r.kneeR, -0.5, 0.03, 1)], palms: [flame(r.elbL, -0.37, 0.035, 0.7), flame(r.elbR, -0.37, 0.035, 0.7)] };
      this.shieldMesh = add(r.root, S(1.25), new THREE.MeshBasicMaterial({ color: new THREE.Color('#59e0ff').multiplyScalar(0.5), transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 1.0, 0); this.shieldMesh.castShadow = false; this.shieldMesh.visible = false;
    } else if (id === 'raiko') {
      const sword = new THREE.Group(); sword.position.set(0, -0.36, 0.035); r.elbR.add(sword); this.gear.push(sword);
      add(sword, B(0.035, 0.2, 0.035), std('#1a1a22', 0.6, 0.2), 0, -0.02, 0); add(sword, B(0.09, 0.02, 0.05), std('#c9a227', 0.4, 0.8), 0, -0.13, 0);
      this.blade = add(sword, B(0.028, 0.95, 0.008), std('#d8dde8', 0.15, 0.95), 0, -0.62, 0); this.bladeGlow = add(sword, B(0.012, 0.95, 0.012), neon('#a78bff', 0.5), 0, -0.62, 0.006);
      this.blade.castShadow = false;
      add(r.hips, new THREE.TorusGeometry(0.17, 0.018, 6, 20), std('#3a7a8a', 0.6, 0.1), 0, 0.03, 0, Math.PI / 2, 0, 0, 1, 0.82, 1);   // a sash
    } else if (id === 'sable') {
      add(r.elbR, B(0.022, 0.42, 0.01), std('#c9ced8', 0.2, 0.9), 0, -0.6, 0.035); add(r.elbR, B(0.03, 0.1, 0.03), std('#20232c', 0.6, 0.2), 0, -0.38, 0.035);
      this.eyeLens = add(r.head, B(0.05, 0.034, 0.012), neon('#ff3b4f', 2.2), 0.045, 0.02, 0.122);                                    // the copy eye
      add(r.head, new THREE.TorusGeometry(0.118, 0.012, 6, 28), std('#2a2f3a', 0.4, 0.7), 0, 0.06, -0.004, Math.PI / 2 - 0.12, 0, 0, 1, 1.08, 1);
    } else if (id === 'rook') {
      add(r.hips, new THREE.TorusGeometry(0.175, 0.03, 6, 20), std('#f08a24', 0.7, 0), 0, 0.04, 0, Math.PI / 2, 0, 0, 1, 0.8, 1);
      this.fist = add(r.elbR, S(0.42), std('#e0ac7e', 0.75, 0), 0, -0.55, 0.05); this.fist.visible = false;
    } else if (id === 'brann') {   // the rune hammer
      const h = (this.tool = new THREE.Group()); h.position.set(0, -0.36, 0.04); r.elbR.add(h); this.gear.push(h);
      add(h, new THREE.CylinderGeometry(0.022, 0.026, 0.42, 8), std('#3a2a1e', 0.8, 0), 0, -0.1, 0);
      add(h, B(0.24, 0.13, 0.13), std('#9aa4b2', 0.3, 0.9), 0, -0.33, 0); add(h, B(0.25, 0.02, 0.14), neon('#8fd3ff', 1.6), 0, -0.33, 0);
    } else if (id === 'bulwark') {   // veins that glow with rage
      this.veins = [];
      for (const e of [r.elbL, r.elbR, r.armL, r.armR]) { const m = add(e, B(0.012, 0.22, 0.012), neon('#ffb347', 1.4), 0.03, e === r.armL || e === r.armR ? -0.15 : -0.12, 0.04); this.veins.push(m); }
      for (const sx of [-1, 1]) this.veins.push(add(r.chest, B(0.01, 0.2, 0.01), neon('#ffb347', 1.4), sx * 0.08, 0.35, 0.14, 0, 0, sx * 0.3));
    } else if (id === 'warden') {   // the round shield on the left forearm
      const sh = (this.tool = new THREE.Group()); sh.position.set(0.07, -0.2, 0.02); sh.rotation.z = Math.PI / 2; r.elbL.add(sh); this.gear.push(sh);
      add(sh, new THREE.CylinderGeometry(0.3, 0.3, 0.035, 28), std('#a8743a', 0.35, 0.85), 0, 0, 0);
      add(sh, new THREE.CylinderGeometry(0.13, 0.13, 0.045, 6), neon('#5fd6c2', 1.3), 0, 0.005, 0);
      add(sh, new THREE.TorusGeometry(0.29, 0.015, 6, 30), std('#d8dde8', 0.3, 0.9), 0, 0.02, 0, Math.PI / 2);
    } else if (id === 'kitsu') {   // a fox mask pushed to the side
      add(r.head, B(0.1, 0.12, 0.03), std('#f2f4f8', 0.4, 0.1), 0.1, 0.06, 0.04, 0, 1.2, 0.2);
      for (const sx of [-1, 1]) add(r.head, new THREE.ConeGeometry(0.02, 0.05, 4), std('#f2f4f8', 0.4, 0.1), 0.11, 0.13, 0.04 + sx * 0.03, 0, 1.2, 0);
    } else if (id === 'trine') {   // three blades: two in hand, one held in the teeth
      for (const e of [r.elbL, r.elbR]) { add(e, B(0.025, 0.82, 0.008), std('#e6ebf2', 0.15, 0.95), 0, -0.78, 0.035); add(e, B(0.06, 0.02, 0.04), std('#c9a227', 0.4, 0.8), 0, -0.37, 0.035); }
      add(r.head, B(0.8, 0.018, 0.006), std('#e6ebf2', 0.15, 0.95), -0.22, -0.065, 0.125); add(r.head, B(0.1, 0.03, 0.03), std('#20232c', 0.6, 0.2), 0.14, -0.065, 0.125);
    } else if (id === 'ember') {   // fists that burn
      this.fists = [r.elbL, r.elbR];
    }
  }
  clearGear() { for (const m of this.gear) m.removeFromParent(); this.gear.length = 0; this.core = this.shieldMesh = this.blade = this.bladeGlow = this.eyeLens = this.fist = this.tool = this.veins = this.fists = this.jets = null; }
  endPowers() {
    this.clearExtras();
    this.ult = 0; this.shield = 0; this.dodge = 0; this.balloon = 0; this.tired = 0; this.channel = null; this.timers.length = 0; this.form = 1; this.combo = 0;
    for (const pr of this.proj) if (pr.orb) pr.orb.life = 0; this.proj.length = 0;
    for (const h of this.hounds) h.rig.root.removeFromParent(); this.hounds.length = 0;
    if (this.guardian) this.guardian.visible = false;
    for (const c of this.clones || []) c.rig.root.removeFromParent(); this.clones = []; this.patches = []; this.block = 0; this.counter = 0; this.flame = 0; this.rage = 0; this.leap = null; this.storm = 0;
    if (this.tool) this.tool.visible = true;
  }

  // ---- helpers ---------------------------------------------------------------------------------------
  centre(out = this.u) { const p = G.player; return out.set(p.pos.x, p.pos.y + 1.0 * (p.rig ? p.rig.root.scale.y : 1), p.pos.z); }
  chest(out = V()) { const p = G.player, s = p.rig.root.scale.y; return out.set(p.pos.x, p.pos.y + 1.3 * s, p.pos.z); }
  hand(out = V()) { const r = G.player.rig; r.root.updateMatrixWorld(true); return r.elbR.localToWorld(out.set(0, -0.36, 0.03)); }
  handL(out = V()) { const r = G.player.rig; r.root.updateMatrixWorld(true); return r.elbL.localToWorld(out.set(0, -0.36, 0.03)); }
  fwd(out = V(), pitch = 0.6) { const p = G.player; return out.set(Math.sin(p.yaw), -Math.sin(p.camPitch) * pitch, Math.cos(p.yaw)).normalize(); }
  faceAim(secs = 0.4) { const p = G.player; p.yaw = p.camYaw; p.aimT = secs; }
  // what the crosshair is on: from the camera, past the hero
  aim(range = 60) {
    const cam = G.camera, d = cam.getWorldDirection(V()), o = cam.position.clone().addScaledVector(d, (G.player._cd || 4) + 0.8);
    const r = G.combat.ray(o, d, range);
    return { dir: d, ...r };
  }
  dirFrom(from, a) { return V().subVectors(a.point, from).normalize(); }
  later(t, fn) { this.timers.push({ t, fn, id: this.id }); }
  ready(k) { return !(this.cd[k] > 0); }
  cool(k, s) { this.cd[k] = s * (this.id === 'rook' && this.form === 2 && this.ult <= 0 ? 0.5 : 1) * (1 - 0.12 * (this.st.up ? this.st.up.focus : 0)); }
  strike(shape, o) { return G.combat.strike(shape, { byHero: true, ...o }); }
  cone(range, deg, o, from = this.chest(), dir = this.fwd()) { return this.strike({ kind: 'cone', o: from, dir, range, cos: Math.cos((deg * Math.PI) / 180) }, o); }
  ball(c, r, o) { return this.strike({ kind: 'sphere', c, r }, o); }
  charge(k) { if (this.on && this.ult <= 0) this.meter = Math.min(100, this.meter + k); if (this.on) this.forms.gain(k * 0.2); if (this.on) this.addXp(k * 0.3); if (this.partner) { const sv = this.saved[this.partner] || (this.saved[this.partner] = { hp: 1, meter: 0 }); sv.meter = Math.min(100, sv.meter + k * 0.5); } }
  // ---- hero levels: experience from fighting, raids and bosses -----------------------------------------
  level(id = this.id) { const x = ((this.st.xp || {})[id]) || 0; return 1 + XP_AT.filter((n) => x >= n).length; }
  addXp(n) {
    if (!this.on || !this.id) return; const st = this.st; st.xp = st.xp || {}; const before = this.level();
    st.xp[this.id] = (st.xp[this.id] || 0) + n; const after = this.level();
    if (after > before) { const what = { 2: 'the alternate costume', 3: '+10% damage', 4: 'a signature move on key 4', 5: 'the elite costume and +10% health' }[after]; G.ui.flash(`${this.H.name.toUpperCase()} LEVEL ${after}`, 1.8); G.ui.toast(`${this.H.name} reached level ${after}: ${what}.`, 'good'); G.fx.ring(this.centre(), '#ffd34d', 0.4, 4, 0.5); if (G.audio) G.audio.tone(660, 0.4, 0.05, 'triangle', null, 0.02, 1.5); }
  }
  // a generic sound from inside a move. While a move starts (use()), its own sounds from sfx.js play
  // instead, so these only add the later moments (an explosion landing, a pull finishing).
  sound(kind) {
    if (this.quietMove || !G.sfx) return;
    const name = { shot: 'repulsor', web: 'thwip' }[kind] || kind;
    G.sfx.play(name, null, kind === 'shot' ? 0.5 : 1);
  }
  // a projectile from the hero: o { from, dir, speed, r, color, dmg, knock, up, kind, blast, power, life, homing, stun, grav, trail, onHit }
  shoot(o) {
    const pr = { pos: o.from.clone(), vel: o.dir.clone().multiplyScalar(o.speed || 40), life: o.life || 2, ...o, orb: G.fx.orb(o.color || '#ffffff', o.r || 0.2) };
    pr.orb.p.copy(pr.pos); this.proj.push(pr); return pr;
  }
  stepProjectiles(dt) {
    const col = G.colliders, tmp = this.v;
    for (let i = this.proj.length - 1; i >= 0; i--) {
      const pr = this.proj[i]; pr.life -= dt;
      if (pr.homing && pr.homing.alive) { const c = G.combat.centre(pr.homing, tmp), sp0 = pr.speed || pr.vel.length(), dist = c.distanceTo(pr.pos); const want = c.sub(pr.pos).normalize().multiplyScalar(sp0); pr.vel.lerp(want, Math.min(1, (pr.turn || 5) * dt * Math.max(1, 12 / Math.max(dist, 0.5)))).setLength(sp0); }   // turning never slows it down
      if (pr.grav) pr.vel.y -= pr.grav * dt;
      const sp = pr.vel.length(), step = sp * dt, d = tmp.copy(pr.vel).divideScalar(sp || 1);
      let hit = null;
      if (pr.home) { const hc = this.chest(this.w); if (hc.distanceTo(pr.pos) < 1.3) { pr.life = 0; if (pr.onCatch) pr.onCatch(); } else pr.vel.copy(hc.sub(pr.pos).normalize().multiplyScalar(pr.speed || 40)); }
      // enemies and residents along this step
      for (const t of G.combat.targets) { if (!t.alive || (pr.done && pr.done.has(t))) continue; const c = G.combat.centre(t, this.w); const b = Math.max(0, Math.min(step, c.clone().sub(pr.pos).dot(d))); if (c.distanceTo(pr.pos.clone().addScaledVector(d, b)) < t.r + (pr.r || 0.2)) { hit = pr.pos.clone().addScaledVector(d, b); break; } }
      if (pr.pierce && hit) { this.ball(hit, (pr.r || 0.2) + 0.6, { dmg: pr.dmg, knock: pr.knock, up: pr.up, kind: pr.kind, color: pr.color, dir: d.clone(), except: pr.done }); G.fx.spark(hit, pr.color, 10, 5, 0.3, 0.12); hit = null; }
      if (!hit && G.npcs) for (const n of G.npcs.near) { if (n.inside || n.body !== 'humanoid' || (pr.done && pr.done.has(n))) continue; this.w.set(n.pos.x, n.pos.y + 0.95, n.pos.z); const b = Math.max(0, Math.min(step, this.w.clone().sub(pr.pos).dot(d))); if (this.w.distanceTo(pr.pos.clone().addScaledVector(d, b)) < 0.4 + (pr.r || 0.2)) { hit = pr.pos.clone().addScaledVector(d, b); break; } }
      let wall = false;
      if (pr.pierce && hit && pr.done) { pr.done.add([...G.npcs.near].find((n) => n.pos.distanceTo(hit) < 2) || null); this.ball(hit, 0.9, { dmg: pr.dmg, knock: pr.knock, kind: pr.kind, dir: d.clone(), except: pr.done }); hit = null; }
      if (!hit && !pr.ghost && G.wrecks) { const v = G.wrecks.ray(pr.pos, d, step); if (v.t < step) { hit = pr.pos.clone().addScaledVector(d, v.t); wall = true; } }   // road vehicles are solid
      if (!hit && !pr.ghost) { const w = col.raycast(pr.pos.x, pr.pos.y, pr.pos.z, d.x, d.y, d.z, step); if (w < step) { hit = pr.pos.clone().addScaledVector(d, w); wall = true; } }
      if (!hit && pr.ghost) pr.pos.addScaledVector(d, step);
      else if (!hit) { pr.pos.addScaledVector(d, step); const g = col.groundAt(pr.pos.x, pr.pos.z, pr.pos.y + 0.5, 1, 0.1); if (pr.pos.y < g + 0.05) { hit = pr.pos.clone(); hit.y = g; wall = true; } }
      pr.orb.p.copy(hit || pr.pos);
      if (pr.trail && Math.random() < 0.8) G.fx.glow.emit(pr.pos.x, pr.pos.y, pr.pos.z, 0, 0, 0, pr.trail, 0.25, (pr.r || 0.2) * 1.4, 0.05, 0, 0);
      if (hit) {
        const o = { dmg: pr.dmg, knock: pr.knock, up: pr.up, kind: pr.kind, stun: pr.stun, color: pr.color, dir: d.clone() };
        if (pr.blast) { this.ball(hit, pr.blast, { ...o, dir: null, from: hit }); G.fx.blast(hit, pr.color, 0.3, pr.blast * 0.8, 0.35); G.fx.ring(hit, pr.color, 0.3, pr.blast * 1.4, 0.4); if (pr.power) G.damage.burst(hit, pr.blast + 1, pr.power, pr.kind, { byHero: true }); this.sound('boom'); }
        else { this.ball(hit, (pr.r || 0.2) + 0.5, { ...o, max: 1 }); if (wall && pr.power) G.damage.impact(hit, G.damage.normalAt(hit, d), pr.power, pr.kind, { byHero: true }); }
        if (pr.kind === 'web') G.fx.spark(hit, '#f2fbff', 18, 6, 0.5, 0.18, 4);
        if (pr.onHit) pr.onHit(hit);
        pr.life = 0;
      }
      if (pr.life <= 0) { pr.orb.life = 0; this.proj.splice(i, 1); }
    }
  }

  // ---- the frame ---------------------------------------------------------------------------------------
  update(dt, t) {
    if (this.emblem) { this.emblem.rotation.y += dt * 0.8; this.emblem.rotation.x = Math.sin(t * 0.5) * 0.3; }
    if (!this.on) return;
    const p = G.player, inp = G.input;
    for (const k in this.cd) this.cd[k] -= dt;
    for (let i = this.timers.length - 1; i >= 0; i--) { const e = this.timers[i]; e.t -= dt; if (e.t <= 0) { this.timers.splice(i, 1); if (e.id === this.id) e.fn(); } }
    this.shield = Math.max(0, this.shield - dt); this.dodge = Math.max(0, this.dodge - dt); this.tired = Math.max(0, this.tired - dt); this.calm += dt;
    const was = this.balloon; this.balloon = Math.max(0, this.balloon - dt);
    if (this.ult > 0) { this.ult -= dt; if (this.ult <= 0) this.endUlt(); }
    if (this.form === 4 && this.ult <= 0) { this.formT -= dt; if (this.formT <= 0) { this.setForm(1); this.tired = 5; G.ui.toast('Form 4 wears off: out of breath for a moment.', 'info'); } }
    if (this.comboT > 0) this.comboT -= dt; else this.combo = 0;
    if (this.calm > 6 && this.hp < this.max) this.hp = Math.min(this.max, this.hp + dt * 4);
    this.meter = Math.min(100, this.meter + dt * (this.ult > 0 ? 0 : 0.6));
    if (this.channel) this.stepChannel(dt);
    this.stepProjectiles(dt); this.stepHounds(dt, t);
    if (this.downT > 0 || this.reviving) { if (this.downT > 0) { this.downT -= dt; if (this.downT <= 0) this.revive(); } this.drawHud(dt); return; }
    this.applyStats(); if (was > 0 && this.balloon <= 0) this.applyStats();
    this.visuals(dt, t); this.passives(dt, t); this.extras(dt, t); this.forms.update(dt, t); this.speedFeel(dt);
    this.punchKick = Math.max(0, (this.punchKick || 0) - dt * 28);
    this.airT = p.grounded ? 0 : (this.airT || 0) + dt;
    const free = (p.state === 'walk' || p.state === 'hero') && !G.ui.menu && !(G.phone && G.phone.open) && !G.minigame && !G.ui.titleOpen;
    if (free) {
      // movement powers that start from walking
      if (inp.pressed('KeyT')) this.forms.toggle();
      if (p.state === 'walk' && !p.grounded && !p.swim && !this.forms.active) {
        if (this.id === 'strand' && inp.pressed('Space')) this.startSwing();
        else if (this.id === 'forge' && inp.pressed('Space')) this.startMove('fly', {});
        if (this.id === 'strand' && p.state === 'walk') this.tryWall();
      }
      if (this.id === 'strand') this.strandAir(dt, inp);
      // Kitsu: a second jump in the air, off a puff of smoke
      if (this.id === 'kitsu') {
        if (p.grounded) this.dj = false;
        else if (p.state === 'walk' && !p.swim && inp.pressed('Space') && !this.dj && (this.airT || 0) > 0.08) {
          this.dj = true; p.vel.y = Math.max(p.vel.y, 0) + 9.5; const hs = Math.hypot(p.vel.x, p.vel.z); if (hs > 0.5) { p.vel.x *= 1.15; p.vel.z *= 1.15; }
          p.play('spin', 0.35); G.fx.smoke(V().set(p.pos.x, p.pos.y, p.pos.z), 3, '#e8eef4', 1, 0.6); G.fx.ring(V().set(p.pos.x, p.pos.y, p.pos.z), '#59c8ff', 0.2, 1.6, 0.25); this.sound('swish');
        }
      }
      if (inp.pressed('Mouse0') || inp.pressed('KeyZ')) this.use('light');
      // Forge in flight: hold the attack to keep firing, a palm shot every 0.13 s
      else if (this.id === 'forge' && this.mv && this.mv.kind === 'fly' && (inp.down('Mouse0') || inp.down('KeyZ')) && !(this.cd.rapid > 0)) { this.cd.rapid = 0.13; this.cd.light = 0; this.use('light'); }
      if (inp.pressed('Mouse2') || inp.pressed('KeyX')) this.use('heavy');
      for (const s of SLOTS) if (inp.pressed(KEYS[s])) this.use(s);
      if (inp.pressed('Digit4')) this.signature();
      if (inp.pressed('KeyC') && p.state === 'walk' && p.grounded) this.roll(inp);
      if (inp.pressed('KeyG')) this.swap();
    }
    this.drawHud(dt);
  }
  use(slot) {
    const id = this.id;
    if (this.forms.active) { if (this.forms.on) this.forms.use(slot); return; }   // transformed: the form's own moves (nothing while changing)
    if (this.tired > 0 && slot !== 'light') { G.ui.toast('Out of breath: give it a moment.', 'info'); return; }
    if (slot === 'ult') {
      if (this.ult > 0) return;
      if (this.partner && this.meter >= 100 && (this.saved[this.partner] || {}).meter >= 100) { this.meter = 0; this.teamStrike(); return; }
      if (this.meter < 100) { if (this.cd.ultMsg <= 0 || this.cd.ultMsg === undefined) { G.ui.toast(`Ultimate not ready: ${Math.floor(this.meter)}%. Land hits to fill the meter.`, 'info'); this.cd.ultMsg = 3; } return; }
      this.quietMove = true; let ok; try { ok = this[`${id}Ult`](); } finally { this.quietMove = false; }
      if (ok !== false) { this.meter = 0; this.kick(7); if (G.sfx) { G.sfx.play('power', null, 0.7); G.sfx.move(id, 'ult'); } if (G.voice) G.voice.shout(this.H, 'ult'); }
      return;
    }
    const P = G.player;
    // three quick light hits on the ground, then heavy: the launcher; light in the air after it: the air combo
    if (slot === 'heavy' && this.launchReady > G.elapsed && (P.grounded || P.vel.y < 4) && P.state === 'walk' && this.ready('heavy')) { this.launcher(); return; }
    if (slot === 'light' && this.airCombo > G.elapsed && !P.grounded && P.state === 'walk' && this.ready('light')) { this.airHit(); return; }
    if (!this.ready(slot)) return;
    const fn = this[`${id}${slot[0].toUpperCase()}${slot.slice(1)}`];
    this.quietMove = true; let ok; try { ok = fn && fn.call(this); } finally { this.quietMove = false; }
    if (fn && ok !== false) {
      if (G.sfx) G.sfx.move(id, slot);
      if (slot === 'light') { this.lights = G.elapsed - (this.lastLightT || 0) < 0.9 ? (this.lights || 0) + 1 : 1; this.lastLightT = G.elapsed; if (this.lights >= 3) this.launchReady = G.elapsed + 0.75; }
      if (slot === 'light' || slot === 'heavy') { const an = P.emote ? P.emote.anim : ''; this.trail(TRAIL_PART[an] || 'R', this.H.color, slot === 'heavy' ? 0.32 : 0.2, slot === 'heavy' ? 0.1 : 0.07); }
      this.kick(slot === 'heavy' ? 2.5 : slot === 'light' ? 0.6 : 1.5);
    }
    if (fn && ok !== false) this.cool(slot, (slot === 'light' && this.id === 'rook' && this.form === 3 ? 0.8 : CD[id][slot]) || 0.3);
  }
  // a damaging power that lasts a while (beams, fire, flurries): fn(k) every `every` seconds for `secs`
  startChannel(secs, every, fn, o = {}) { this.channel = { t: 0, secs, every, acc: every, fn, ...o }; }
  stepChannel(dt) {
    const c = this.channel; c.t += dt; c.acc += dt;
    while (c.acc >= c.every && this.channel) { c.acc -= c.every; c.fn(c.t / c.secs); }
    if (this.channel && c.t >= c.secs) { this.channel = null; if (c.end) c.end(); }
  }
  // a light-attack combo step: o { anims, dmg[], knock[], range, deg, kind, color, wall, sound }
  combo3(o) {
    const k = this.combo % o.anims.length; this.combo++; this.comboT = 0.85;
    const p = G.player; this.faceAim(0.45); p.play(o.anims[k], 0.24); this.sound(o.sound || 'swish');
    this.later(0.09, () => {
      const n = this.cone(o.range, o.deg, { dmg: o.dmg[k], knock: o.knock[k], up: k === o.anims.length - 1 ? 3 : 0.5, kind: o.kind || 'blunt', color: o.color });
      if (o.arc) this.arc(o.color, k % 2 ? 1 : -1, o.range);
      if (!n && o.wall) G.damage.wallHit(this.chest(), this.fwd(V(), 0.3), o.range, o.wall, o.kind, { byHero: true });
    });
  }
  // a glowing sweep in front: a fan of short beams
  arc(hex, side, range = 2.6) {
    const p = G.player, c = this.chest(), a0 = p.yaw;
    let prev = null;
    for (let i = 0; i <= 8; i++) { const a = a0 + side * (-0.9 + (i / 8) * 1.8), q = V().set(c.x + Math.sin(a) * range * 0.85, c.y - 0.1 + side * (i / 8 - 0.5) * 0.5, c.z + Math.cos(a) * range * 0.85); if (prev) G.fx.beam(prev, q, hex, 0.07, 0.16); prev = q; }
  }

  // ---- movement powers ---------------------------------------------------------------------------------
  startMove(kind, data) { const p = G.player; this.endMove(); p.state = 'hero'; p.grounded = false; this.mv = { kind, t: 0, ...data }; }
  endMove(air = true) {
    const p = G.player; const mv = this.mv; this.mv = null;
    if (mv && mv.rope) mv.rope.life = 0;
    if (mv && mv.ropes) for (const b of mv.ropes) b.life = 0;
    if (p.state === 'hero') { p.state = 'walk'; p.grounded = !air; }
  }
  move(dt, inp, col) {
    const p = G.player, mv = this.mv;
    if (!mv || !this.on) { p.state = 'walk'; return; }
    mv.t += dt;
    if (mv.kind === 'swing') this.swingStep(dt, inp, col);
    else if (mv.kind === 'wall') this.wallStep(dt, inp, col);
    else if (mv.kind === 'fly') this.flyStep(dt, inp, col);
    else if (mv.kind === 'zip' || mv.kind === 'rocket') this.zipStep(dt, col);
    else if (mv.kind === 'dash') this.dashStep(dt, col);
    else if (mv.kind === 'strike') this.strikeStep(dt, col);
    p.speed = Math.hypot(p.vel.x, p.vel.z);
  }
  // keep the body out of walls and above the ground; returns true if it touched the ground
  collide(col) {
    const p = G.player, s = p.rig.root.scale.y;
    col.resolveCircle(p.pos, 0.34 * Math.max(1, s * 0.8), p.pos.y + 0.55, p.pos.y + 1.75 * s);
    const g = col.groundAt(p.pos.x, p.pos.z, p.pos.y + 0.3, 0.5, 0.26);
    const c = col.ceilingAt(p.pos.x, p.pos.z, p.pos.y + 1.0, 0.26); if (p.pos.y + 1.8 > c) { p.pos.y = Math.max(g, c - 1.8); p.vel.y = Math.min(p.vel.y, 0); }
    if (p.pos.y <= g) { p.pos.y = g; return true; }
    return false;
  }
  // ---- Strand's swinging ---------------------------------------------------------------------------------
  // Built the way open-world web-swinging games build it (Treyarch's 2004 swing, Insomniac's from 2018):
  // the line always lands on a real building, picked to suit where you are going, not just the tallest
  // thing in view; the swing is a pendulum on a rope, bent for fun: heavier gravity for a snappy arc, a
  // push through the bottom so each swing builds speed, a pull that keeps you running straight down the
  // street instead of curling round the anchor, the line shortening so you never scrape the street, and
  // walls pushing you off. Let go as you rise out of the arc for a boost; keep holding and the next line
  // goes out by itself. Shift in the air zips you forward on a line; C dives.
  // Where you mean to go: where the camera looks, turned by A/D.
  intent(inp) { const mx = (inp.down('KeyD') ? 1 : 0) - (inp.down('KeyA') ? 1 : 0); return G.player.camYaw - Math.atan(mx); }
  // the heading for the next line: at speed, the way you are moving, bent toward where you mean to go
  swingHead(inp) {
    const p = G.player, hs = Math.hypot(p.vel.x, p.vel.z), want = this.intent(inp);
    if (hs < 8) return want;
    const mov = Math.atan2(p.vel.x, p.vel.z), d = angDelta(mov, want);
    return Math.abs(d) > 2 ? want : mov + d * 0.65;
  }
  // a point on a building ahead and above, to one side of the heading (alternating hands, so you
  // weave down the street), high enough that the bottom of the arc clears whatever is under it
  // how far above street-canyon height you are: 0 up to 30 m over the street, 1 from 60 m (see swingHigh)
  swingHigh() { const p = G.player, g = G.colliders.groundAt(p.pos.x, p.pos.z, p.pos.y + 0.3, 0.5, 0.3); return clamp((p.pos.y - g - 30) / 30, 0, 1); }
  findAnchor(head, side = 0) {
    const p = G.player, col = G.colliders, s = p.rig.root.scale.y, H = 1.5 * s, ox = p.pos.x, oy = p.pos.y + H, oz = p.pos.z;
    const fx = Math.sin(head), fz = Math.cos(head), rx = -fz, rz = fx;
    const hs = Math.hypot(p.vel.x, p.vel.z), gHere = col.groundAt(ox, oz, p.pos.y + 0.3, 0.5, 0.3);
    // High above the street, lines go further ahead and lower, so each arc dips back down toward the
    // canyon instead of every swing ratcheting you up the towers (holding Space used to climb past 200 m).
    const high = this.swingHigh(), wantAng = 0.65 + 0.45 * high;
    let best = null, bs = -1e9;
    for (let i = -5; i <= 5; i++) for (const el of high > 0 ? [0.35, 0.55, 0.75, 0.95, 1.15] : [0.55, 0.75, 0.95, 1.15, 1.35]) {
      const yaw = head + i * 0.22, ce = Math.cos(el), dx = Math.sin(yaw) * ce, dy = Math.sin(el), dz = Math.cos(yaw) * ce;
      const L = col.raycast(ox, oy, oz, dx, dy, dz, 80);
      if (L >= 80 || L < 8) continue;
      const qx = ox + dx * L, qy = oy + dy * L, qz = oz + dz * L, up = qy - oy;
      const fwd = (qx - ox) * fx + (qz - oz) * fz, lat = (qx - ox) * rx + (qz - oz) * rz;
      if (up < 6 || fwd < 2) continue;
      // the bottom of the arc is beside the wall the line hit: the line can only be as long as the drop to the ground there allows
      const floor = Math.max(gHere, col.groundAt(qx - Math.sin(yaw) * 1.6, qz - Math.cos(yaw) * 1.6, p.pos.y + 0.3, 0.5, 0.3));
      const Lmax = qy - floor - H - 1.2;
      if (Lmax < 7) continue;
      const Lr = Math.min(L, Lmax), ang = Math.atan2(fwd, up), al = Math.abs(lat);
      const bottom = qy - Math.min(L * 0.93, Lmax) - H - floor;              // where the feet will be at the bottom of this arc, above the street
      let sc = -Math.abs(ang - wantAng) * 9                                   // about 35-40 degrees ahead of straight up: a long, fast arc (further ahead when high)
        - Math.abs(i) * 0.22 * 5                                              // close to the heading
        - Math.abs(Lr - (26 + hs * 0.35)) * 0.12                              // longer lines at speed
        - (L - Lr) * 0.3                                                      // a line that has to reel in a lot is a worse line
        - Math.max(0, 2.5 - al) * 1.2 - Math.max(0, al - 14) * 0.5           // to the side, not straight into a wall
        - Math.abs(bottom - 5) * 0.22;                                        // arcs that swoop down to about 5 m over the street: without this every swing
                                                                              // gains height and you end up cruising far above the street (the games keep you low)
      if (side && Math.sign(lat) === side) sc += 3.5;
      if (sc > bs) { bs = sc; best = { a: new THREE.Vector3(qx, qy, qz), L, Lmax, side: lat >= 0 ? 1 : -1 }; }
    }
    return best;
  }
  startSwing(auto = false) {
    const p = G.player, inp = G.input, head = this.swingHead(inp), col = G.colliders, s = p.rig.root.scale.y, hy = p.pos.y + 1.5 * s;
    // hands alternate, but close to a wall the next line goes to the far side of the street
    const rx = -Math.cos(head), rz = Math.sin(head), dR = col.raycast(p.pos.x, hy, p.pos.z, rx, 0, rz, 30), dL = col.raycast(p.pos.x, hy, p.pos.z, -rx, 0, -rz, 30);
    const A = this.findAnchor(head, Math.min(dL, dR) < 7 ? (dR > dL ? 1 : -1) : -(this.lastSide || -1));
    if (!A) { if (!auto && (this.airT || 0) > 0.12 && !(this.cd.noAnchor > 0)) { G.ui.toast('Nothing tall enough to swing from here.', 'info'); this.cd.noAnchor = 4; } return false; }
    // The line is drawn to the building, but the swing pivots on a point above your path: a true pendulum
    // bottoms out under its anchor, at the wall, so every swing would drag you into the building (the
    // games cheat the same way). Only a little of the sideways offset is kept, enough to lean into.
    const lat = (A.a.x - p.pos.x) * rx + (A.a.z - p.pos.z) * rz, keep = clamp(lat * 0.3, -3, 3);
    const piv = A.a.clone(); piv.x -= rx * (lat - keep); piv.z -= rz * (lat - keep);
    const r = V().set(piv.x - p.pos.x, piv.y - hy, piv.z - p.pos.z), L = r.length(); r.divideScalar(L);
    // moving away from the anchor (a fall, a dive): that speed is turned along the arc instead of lost
    const sp = p.vel.length(), vr = p.vel.dot(r);
    if (vr < 0 && sp > 1) { p.vel.addScaledVector(r, -vr); const t = p.vel.length(); if (t > 0.3) p.vel.multiplyScalar((sp * 0.92) / t); }
    this.lastSide = A.side; this.zips = 2;
    // high up, the line is not reeled in (reeling in lifts you); low down it pulls in a little for a snappier arc
    this.startMove('swing', { a: piv, L, Lwant: Math.min(this.swingHigh() > 0.3 ? L : L * 0.93, A.Lmax), head, side: A.side, ph: -1 });
    // the line shoots out from the hand, sticks a moment later, and is drawn to the real point on the building
    const sd = A.side, from = (v) => (sd < 0 ? this.handL(v) : this.hand(v));
    this.mv.ropes = this.webLine(from, A.a, G.elapsed);
    G.fx.spark(from(V()), '#e8fbff', 4, 2, 0.15, 0.06, 0);
    this.later(0.08, () => G.fx.spark(A.a, '#f2fbff', 6, 3, 0.25, 0.1, 2));
    this.sound('web');
    return true;
  }
  // A web line: a short chain of segments with a bright core and a faint teal glow. It flies out to the
  // anchor over 0.08 s with a little droop, then hangs slack whenever you swing in closer than its length
  // and snaps straight when it takes your weight. Returns the beams (endMove releases them).
  webLine(from, to, t0, n = 6) {
    const c = { f: -1, h: V(), k: 0, s: 0 }, mv = this.mv;
    const pt = (u, out) => {
      if (c.f !== G.elapsed) {   // once a frame: where the hand is, how far the line has flown, how much it sags
        c.f = G.elapsed; from(c.h); const age = G.elapsed - t0, D = c.h.distanceTo(to);
        c.k = Math.min(1, age / 0.08);
        c.s = Math.min(3, Math.max(0, (mv.L || 0) - D) * 0.45) + D * 0.035 * Math.max(0, 1 - age / 0.22);
      }
      out.copy(c.h).lerp(to, u * c.k); out.y -= c.s * 4 * u * (1 - u);
      return out;
    };
    const list = [];
    for (let i = 0; i < n; i++) {
      const a = i / n, b = (i + 1) / n;
      list.push(G.fx.beam((v) => pt(a, v), (v) => pt(b, v), '#eefcff', 0.022, 1e9, false));
      list.push(G.fx.beam((v) => pt(a, v), (v) => pt(b, v), '#1d6a62', 0.075, 1e9, false));
    }
    return list;
  }
  swingStep(dt, inp, col) {
    const p = G.player, mv = this.mv, a = mv.a, H = 1.5 * p.rig.root.scale.y;
    if (!inp.down('Space')) { this.letGo(true); return; }
    // steering: A/D (and the camera while W is held) turn the way you are heading; S brakes
    const mz = (inp.down('KeyW') ? 1 : 0) - (inp.down('KeyS') ? 1 : 0), mx = (inp.down('KeyD') ? 1 : 0) - (inp.down('KeyA') ? 1 : 0);
    if (mx || mz > 0) mv.head = dampAngle(mv.head, this.intent(inp), 2.4, dt);
    const hx = Math.sin(mv.head), hz = Math.cos(mv.head);
    // the line pulls in to the length it wants, faster when the street is coming up
    const gUnder = col.groundAt(p.pos.x, p.pos.z, p.pos.y + 0.3, 0.5, 0.3);
    mv.Lwant = Math.min(mv.Lwant, a.y - H - gUnder - 1.2);
    if (mv.L > mv.Lwant) mv.L = Math.max(mv.Lwant, mv.L - Math.max(12, (mv.L - mv.Lwant) * 5, p.pos.y - gUnder < 3 && p.vel.y < 0 ? 30 : 0) * dt);
    mv.L = Math.max(5, mv.L);
    // walls close to either side push you back toward the middle of the street
    const hv0 = Math.hypot(p.vel.x, p.vel.z);
    if (hv0 > 4) for (const sd of [-1, 1]) { const sx = (-p.vel.z / hv0) * sd, sz = (p.vel.x / hv0) * sd, d = col.raycast(p.pos.x, p.pos.y + 1.1, p.pos.z, sx, 0, sz, 6); if (d < 6) { p.vel.x -= sx * (6 - d) * 7 * dt; p.vel.z -= sz * (6 - d) * 7 * dt; } }
    const n = Math.min(6, Math.max(1, Math.ceil((p.vel.length() * dt) / 0.35))), h = dt / n, before = this._before || (this._before = V());
    const push = 11 * (1 - clamp((p.pos.y - gUnder - 30) / 30, 0, 1));                   // high above the street the push fades, so the energy is not spent climbing
    for (let i = 0; i < n; i++) {
      p.vel.y -= 28 * h;                                                                 // heavier than a fall: a snappy arc
      const rx = a.x - p.pos.x, ry = a.y - p.pos.y - H, rz = a.z - p.pos.z, D = Math.hypot(rx, ry, rz) || 1, sp = p.vel.length();
      const low = Math.max(0, ry / D);                                                   // 1 with the line straight up: the bottom of the arc
      if (sp > 0.5 && sp < 46) p.vel.multiplyScalar(1 + (push * low * low * low * h) / sp);   // a push through the bottom: swings build speed
      const hv = Math.hypot(p.vel.x, p.vel.z);
      if (hv > 2) { const cur = Math.atan2(p.vel.x, p.vel.z), d = angDelta(cur, mv.head); if (Math.abs(d) < 1.6) { const b = cur + clamp(d, -2.6 * h, 2.6 * h); p.vel.x = Math.sin(b) * hv; p.vel.z = Math.cos(b) * hv; } }   // straight down the street, not round the anchor
      if (mz > 0) { p.vel.x += hx * 5 * h; p.vel.z += hz * 5 * h; } else if (mz < 0) p.vel.multiplyScalar(1 - 0.9 * h);
      p.pos.addScaledVector(p.vel, h);
      // the rope: never longer than the line; only the speed away from the anchor is taken out
      const bx = p.pos.x - a.x, by = p.pos.y + H - a.y, bz = p.pos.z - a.z, B = Math.hypot(bx, by, bz);
      if (B > mv.L) { const k = mv.L / B; p.pos.set(a.x + bx * k, a.y + by * k - H, a.z + bz * k); const ox = bx / B, oy = by / B, oz = bz / B, vr = p.vel.x * ox + p.vel.y * oy + p.vel.z * oz; if (vr > 0) { p.vel.x -= ox * vr; p.vel.y -= oy * vr; p.vel.z -= oz * vr; } }
      before.copy(p.pos);
      if (this.collide(col)) { this.endMove(false); p.grounded = true; p.fling = false; return; }
      if (before.distanceToSquared(p.pos) > 0.0004 && this.tryWall(true)) return;      // swung into a wall: run up it
    }
    // the body hangs along the line, the hand on the anchor's side holds it, and the legs follow the arc
    const hv = Math.hypot(p.vel.x, p.vel.z);
    if (hv > 1) p.yaw = dampAngle(p.yaw, Math.atan2(p.vel.x, p.vel.z), 8, dt);
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), rx = a.x - p.pos.x, ry = a.y - p.pos.y - H, rz = a.z - p.pos.z, R = Math.hypot(rx, ry, rz) || 1;
    const fwd = (rx * fx + rz * fz) / R, lat = (rz * fx - rx * fz) / R, up = ry / R;
    mv.ph = clamp(-fwd / 0.75, -1, 1);                                                    // -1 dropping into the arc, 0 the bottom, 1 rising out of it
    p.tiltT = { x: clamp(Math.atan2(fwd, up) * 0.85, -1, 1), z: clamp(Math.atan2(lat, up) * 0.7, -0.6, 0.6) };
    p.rig.swing = { side: mv.side, ph: mv.ph }; p.anim = 'webswing';
    // keep holding: past the rise (or as it runs out of speed) the next line goes out by itself
    // (and a swing that has gone on too long, curling round its anchor like a tetherball, hands over too)
    if (mv.t > 0.3 && ((mv.ph > 0.2 && (mv.ph >= 0.97 || p.vel.y < 1.5)) || mv.t > 2.2)) { this.letGo(false); if (inp.down('Space')) this.startSwing(true); }
  }
  // off the line, keeping the speed. Let go yourself on the way up out of the arc for a boost; the
  // later in the rise (before the line would go by itself), the bigger it is.
  letGo(byPlayer) {
    const p = G.player, ph = this.mv ? this.mv.ph : -1, rising = p.vel.y > 0;
    this.endMove(); p.fling = true;
    if (byPlayer && rising && ph >= 0.4) {
      const hv = Math.hypot(p.vel.x, p.vel.z), k = hv > 1 ? Math.min(1.12, 48 / hv) : 1;
      p.vel.x *= k; p.vel.z *= k; p.vel.y += 8 * (1 - 0.6 * this.swingHigh());   // a smaller lift when you are already high if (p.vel.length() > 50) p.vel.setLength(50);
      p.play('spin', 0.38); G.fx.ring(this.centre(), '#3fe0c5', 0.4, 3.5, 0.35); G.fx.spark(this.centre(), '#e8fbff', 10, 4, 0.35, 0.1, 2);
      if (G.sfx) G.sfx.play('whoosh', null, 0.9);
      this.perfect = (this.perfect || 0) + 1;
    } else if (byPlayer && rising && ph > 0.05) p.vel.y += 4;
    else p.vel.y += byPlayer ? 1.5 : this.swingHigh() > 0 ? 0 : 2.5;   // the hop between chained lines only low down
  }
  // Shift in the air: a line to whatever is ahead and a hard yank along it (twice, then swing, land or touch a wall)
  webZip() {
    const p = G.player, d = G.camera.getWorldDirection(V()); d.y = clamp(d.y + 0.12, -0.2, 0.5); d.normalize();
    const o = this.chest(), L = G.colliders.raycast(o.x, o.y, o.z, d.x, d.y, d.z, 50), to = o.clone().addScaledVector(d, Math.min(L, 50));
    if (this.mv) this.endMove();
    const sp = Math.min(46, Math.max(p.vel.length(), 16) + 9);
    p.vel.copy(d).multiplyScalar(sp); p.vel.y += 3; p.fling = true; p.grounded = false;
    p.yaw = Math.atan2(d.x, d.z); p.play('zip', 0.3);
    G.fx.beam((v) => this.hand(v), to, '#e8fbff', 0.022, 0.28); G.fx.beam((v) => this.handL(v), to, '#e8fbff', 0.022, 0.28);
    this.sound('web'); if (G.sfx) G.sfx.play('zip', null, 0.8);
    this.zips = (this.zips ?? 2) - 1; this.cd.webZip = 0.35;
  }
  // Strand in the air on foot: Shift zips, C dives, landing or a wall gives the zips back
  strandAir(dt, inp) {
    const p = G.player, air = !p.grounded && !p.swim;
    if (p.grounded || (this.mv && this.mv.kind === 'wall')) this.zips = 2;
    const swinging = this.mv && this.mv.kind === 'swing';
    if ((inp.pressed('ShiftLeft') || inp.pressed('ShiftRight')) && ((p.state === 'walk' && air) || swinging) && (this.zips ?? 2) > 0 && !(this.cd.webZip > 0)) this.webZip();
    this.diving = p.state === 'walk' && air && inp.down('KeyC');
    if (this.diving) {
      p.vel.y = Math.max(-50, p.vel.y - 30 * dt); p.fling = true; p.play('fly', 0.12); p.tiltT = { x: 0.5, z: 0 };   // head down: fall fast, then swing out of it for the speed
    }
  }
  // speed you can feel: a wider view, the camera dropping back, wind, and streaks rushing past
  speedFeel(dt) {
    const p = G.player, v = p.vel.length(), moving = !p.grounded && (p.state === 'hero' || p.fling);
    this.speedK = damp(this.speedK || 0, moving ? clamp((v - 12) / 30, 0, 1) : 0, 3, dt);
    this.fovKick = this.speedK * 16;
    const k = this.speedK;
    if (k > 0.15 && Math.random() < dt * 34 * k) {
      const c = G.camera.position, f = this.v.copy(p.vel).normalize(), a = this.w.set(p.pos.x + (Math.random() - 0.5) * 7 + f.x * 6, p.pos.y + 1 + (Math.random() - 0.5) * 5 + f.y * 6, p.pos.z + (Math.random() - 0.5) * 7 + f.z * 6);
      if (a.distanceToSquared(c) > 4) G.fx.beam(a.clone(), a.clone().addScaledVector(p.vel, -0.05), '#cfe9ff', 0.014, 0.14);
    }
    if (this.id === 'strand' && G.audio && Math.random() < dt * 7 * k) G.audio.burst(0.22, 0.01 + k * 0.03, 350 + k * 700, 'bandpass');
  }
  // Strand on a wall: W/S up and down, A/D along it, Space to jump off; over the top at the edge
  tryWall(force) {
    const p = G.player, col = G.colliders;
    if (this.mv && this.mv.kind === 'wall') return false;
    const hs = Math.hypot(p.vel.x, p.vel.z), yaw = hs > 1 ? Math.atan2(p.vel.x, p.vel.z) : p.yaw, dx = Math.sin(yaw), dz = Math.cos(yaw);
    const near = col.raycast(p.pos.x, p.pos.y + 1.1, p.pos.z, dx, 0, dz, force ? 1.2 : 0.8);
    if (near >= (force ? 1.2 : 0.8)) return false;
    if (col.raycast(p.pos.x, p.pos.y + 3.2, p.pos.z, dx, 0, dz, 1.6) >= 1.6) return false;           // a low wall: vault it instead
    const hit = V().set(p.pos.x + dx * near, p.pos.y + 1.1, p.pos.z + dz * near), n = G.damage.normalAt(hit, V().set(dx, 0, dz));
    if (Math.abs(n.y) > 0.5) return false;
    // hitting the wall fast turns that speed into a run straight up it
    this.startMove('wall', { n: n.setY(0).normalize(), run: this.id === 'strand' && hs > 7 ? Math.min(20, hs * 0.6) : 0 }); p.vel.set(0, 0, 0); p.yaw = Math.atan2(-n.x, -n.z);
    return true;
  }
  wallStep(dt, inp, col) {
    const p = G.player, mv = this.mv, n = mv.n, run = mv.run || 0;
    if (inp.pressed('Space')) { p.vel.set(n.x * (7 + run * 0.25), 7.5 + run * 0.35, n.z * (7 + run * 0.25)); p.yaw = Math.atan2(n.x, n.z); this.endMove(); p.fling = true; return; }
    const up = (inp.down('KeyW') ? 1 : 0) - (inp.down('KeyS') ? 1 : 0), side = (inp.down('KeyD') ? 1 : 0) - (inp.down('KeyA') ? 1 : 0), fast = inp.down('ShiftLeft') ? 1.8 : 1;
    const tx = n.z, tz = -n.x;   // along the wall, to the right as you face it
    p.pos.y += (up * 6 * fast + run) * dt; p.pos.x += tx * side * 4 * fast * dt; p.pos.z += tz * side * 4 * fast * dt;
    // the run up the wall: held by W at a steady pace, otherwise it slows to a climb
    // (W holds it only for the first 1.6 s: players hold W while swinging, and brushing a 200 m tower must not run them up all of it)
    const hold = up > 0 && this.id === 'strand' && mv.t < 1.6;
    if (run > 0 || (hold && mv.t < 0.2)) mv.run = hold ? Math.max(Math.min(8, run + 40 * dt), run - 6 * dt) : Math.max(0, run - 16 * dt);
    p.rig.climbPh = (p.rig.climbPh || 0) + (Math.abs(up) + Math.abs(side) + (run > 0 ? 2.5 : 0)) * dt * 7;
    p.yaw = Math.atan2(-n.x, -n.z); p.vel.set(0, 0, 0);
    const d = col.raycast(p.pos.x, p.pos.y + 1.1, p.pos.z, -n.x, 0, -n.z, 2.5);
    if (d > 2.2) { this.endMove(); return; }                                                  // round a corner or off the edge
    p.pos.x -= n.x * (d - 0.42); p.pos.z -= n.z * (d - 0.42);
    // the top: nothing in front at head height
    if (col.raycast(p.pos.x, p.pos.y + 1.9, p.pos.z, -n.x, 0, -n.z, 1.4) >= 1.4) {
      const tx2 = p.pos.x - n.x * 0.9, tz2 = p.pos.z - n.z * 0.9, top = col.groundAt(tx2, tz2, p.pos.y + 2.6, 0, 0.26);
      if (top > p.pos.y + 0.5) {
        // still running: vault off the edge into the air over the roof; otherwise pull up onto it
        if (run > 4) { this.endMove(); p.vel.set(-n.x * 5, Math.max(11, run * 0.9), -n.z * 5); p.fling = true; p.play('spin', 0.35); this.sound('swish'); return; }
        this.mv = null; p.startClimb(tx2, top, tz2, 0.4, false); return;
      }
    }
    const g = col.groundAt(p.pos.x, p.pos.z, p.pos.y + 0.3, 0.5, 0.26);
    if (p.pos.y <= g + 0.02 && up < 0) { p.pos.y = g; this.endMove(false); return; }
    p.anim = 'climb';
  }
  // Forge in flight
  // Forge in flight. WASD flies where the camera looks, Space climbs, C drops (C at the ground lands).
  // Shift is the afterburner: it spools up over a second to 62 m/s, and breaking 45 m/s sets off a
  // sonic boom. The body banks into turns and pitches into climbs and dives, the boots leave contrails
  // at speed, and coming down fast is a three-point landing that knocks back anyone close.
  flyStep(dt, inp, col) {
    const p = G.player, mv = this.mv, cp = p.camPitch, cy = p.camYaw, fx = Math.sin(cy), fz = Math.cos(cy);
    const mz = (inp.down('KeyW') ? 1 : 0) - (inp.down('KeyS') ? 1 : 0), mx = (inp.down('KeyD') ? 1 : 0) - (inp.down('KeyA') ? 1 : 0), up = (inp.down('Space') ? 1 : 0) - (inp.down('KeyC') ? 1 : 0);
    const boost = (inp.down('ShiftLeft') || inp.down('ShiftRight')) && mz > 0;
    if (!mv.lift) {   // takeoff: a blast ring on the ground and a kick upward
      mv.lift = true; const g = this.centre(V()); g.y = p.pos.y + 0.1; G.fx.ring(g, '#9ff4ff', 0.3, 4, 0.4); G.fx.dust(g, 12, 1.2); p.vel.y = Math.max(p.vel.y, 7); if (G.sfx) G.sfx.play('whoosh', null, 0.8);
    }
    mv.burn = damp(mv.burn || 0, boost ? 1 : 0, boost ? 1.3 : 3, dt);                    // the afterburner spools up
    const sp = 20 + mv.burn * 42, k = 2.6 + mv.burn * 1.4;
    const tx = (fx * Math.cos(cp) * mz - fz * mx) * sp, ty = -Math.sin(cp) * mz * sp + up * 13, tz = (fz * Math.cos(cp) * mz + fx * mx) * sp;
    p.vel.x = damp(p.vel.x, tx, k, dt); p.vel.y = damp(p.vel.y, ty, 3, dt); p.vel.z = damp(p.vel.z, tz, k, dt);
    if (!mz && !mx && !up) p.vel.y += Math.sin(mv.t * 2.2) * 0.6 * dt;                     // hovering: a gentle bob
    if (p.pos.y > 700) p.vel.y = Math.min(p.vel.y, 0);
    // short steps at speed, so the armour never passes through a thin wall
    const v = p.vel.length(), n = Math.min(6, Math.max(1, Math.ceil((v * dt) / 0.5))), h = dt / n; let ground = false;
    for (let i = 0; i < n; i++) { p.pos.addScaledVector(p.vel, h); if (this.collide(col)) { ground = true; break; } }
    if (ground && (inp.down('KeyC') || p.vel.y < -3)) { this.forgeLanding(-p.vel.y, Math.hypot(p.vel.x, p.vel.z)); return; }
    if (ground) p.vel.y = Math.max(p.vel.y, 1.5);
    const hs = Math.hypot(p.vel.x, p.vel.z), yaw0 = p.yaw;
    p.yaw = dampAngle(p.yaw, hs > 3 ? Math.atan2(p.vel.x, p.vel.z) : cy, 6, dt);
    const turn = angDelta(yaw0, p.yaw) / Math.max(dt, 1e-3);
    // The body: at speed it lies along the flight path (level in a cruise, head-down in a dive, upright going
    // straight up), with the head raised to see ahead; slow, it stands upright and leans a little into the drift.
    // A sharp slowdown is a flare: feet thrown forward, palms out ahead. Turns roll the body about its spine.
    const dec = ((mv.prevV ?? v) - v) / Math.max(dt, 1e-3); mv.prevV = v;
    if (dec > 14 && v > 8 && mz <= 0) mv.brake = 0.45;   // only when you let go of forward (a hard turn also costs speed)
    mv.brake = Math.max(0, (mv.brake || 0) - dt);
    const fastV = clamp((v - 6) / 14, 0, 1), elev = Math.atan2(p.vel.y, Math.max(hs, 1e-3));
    const along = clamp(Math.PI / 2 - elev - 0.12, 0, 1.95);
    let pitch = lerp(clamp(hs * 0.025, 0, 0.3), along, fastV), anim;
    if (mv.brake > 0) { anim = 'jetBrake'; pitch = -0.45; }
    else if (p.vel.y > 8 && hs < 8) anim = 'jetRise';
    else if (hs > 9 || v > 14) anim = mv.burn > 0.5 ? 'jetBoost' : 'jetCruise';
    else anim = 'jetHover';
    p.anim = anim; mv.pose = anim;
    const bank = clamp(-turn * 0.3, -1.05, 1.05) * clamp((hs - 6) / 14, 0, 1);
    p.tiltT = { x: pitch, z: bank * (1 - Math.min(1, pitch / 1.2)) * 0.6, r: bank * Math.min(1, pitch / 1.2) };   // upright: a sideways lean; lying along the path: a roll
    // the sound barrier: one boom each time you pass 45 m/s
    if (!mv.boom && v > 45) {
      mv.boom = true; const c = this.centre(V()), d = p.vel.clone().normalize();
      G.fx.ring(c, '#ffffff', 0.5, 10, 0.5, d); G.fx.ring(c.clone().addScaledVector(d, -2), '#cfe9ff', 0.5, 7, 0.4, d); G.fx.shake(0.35);
      if (G.sfx) G.sfx.play('boom', null, 0.8); G.ui.flash('MACH 1', 0.6);
    }
    if (v < 32) mv.boom = false;
    // thrusters: steady flames out of the boots and palms (how long depends on what the suit is doing), sparks and
    // heat along each flame's axis, a glow at every nozzle, contrails behind the boots when fast
    if (this.jets) {
      const J = this.jets, hot = mv.burn > 0.5, fl = 0.85 + Math.random() * 0.3;
      const boot = anim === 'jetBoost' ? 1.9 : anim === 'jetCruise' ? 1.0 : anim === 'jetRise' ? 1.35 : anim === 'jetBrake' ? 0.45 : 0.7;
      const palm = anim === 'jetBrake' ? 1.1 : anim === 'jetHover' ? 0.55 : anim === 'jetRise' ? 0.45 : anim === 'jetBoost' ? 0.75 : 0.3;
      const set = (j, len) => { j.g.visible = true; const L = len * fl * j.s; j.outer.scale.set(1, L, 1); j.inner.scale.set(1, L * 0.62, 1); j.outer.material.color.set(hot ? '#9fd8ff' : '#4fc4ff'); };
      for (const j of J.boots) set(j, boot); for (const j of J.palms) set(j, palm);
    }
    if (G.fx) {
      const r = p.rig, trail = v > 26; mv.trail = mv.trail || [V(), V(), false];
      const axis = (bone, y, out) => { const a = bone.localToWorld(this.w.set(0, y, 0.03)), b = bone.localToWorld(out.set(0, y - 0.3, 0.03)); return b.sub(a).normalize(); };
      [r.kneeL, r.kneeR].forEach((kn, i) => {
        const q = kn.localToWorld(this.w.set(0, -0.5, 0.03)).clone(), d = axis(kn, -0.5, this.v);
        G.fx.spray(q.clone().addScaledVector(d, 0.5 + mv.burn * 0.6), d, mv.burn > 0.5 ? (Math.random() < 0.5 ? '#ffd9a8' : '#ffffff') : Math.random() < 0.5 ? '#9ff4ff' : '#ffffff', 1 + Math.round(mv.burn), 10 + mv.burn * 10, 0.12, 0.1, 0.12 + mv.burn * 0.08, 0.0);
        G.fx.glow.emit(q.x, q.y, q.z, 0, 0, 0, mv.burn > 0.5 ? '#ffffff' : '#bff4ff', 0.2 + mv.burn * 0.1, 0.05, 0.02, 0, 0);
        // contrails: thin streaks joining where each boot was last frame to where it is now; they fade in 0.6 s
        if (trail && mv.trail[2]) G.fx.beam(mv.trail[i].clone(), q.clone(), '#5a6a78', 0.05, 0.6);
        mv.trail[i].copy(q);
      });
      mv.trail[2] = trail;
      for (const e of [r.elbL, r.elbR]) { const q = e.localToWorld(this.w.set(0, -0.37, 0.035)); G.fx.glow.emit(q.x, q.y, q.z, 0, 0, 0, '#bff4ff', 0.13 + (anim === 'jetBrake' || anim === 'jetHover' ? 0.06 : 0) + mv.burn * 0.05, 0.05, 0.02, 0, 0); }   // repulsor glow in the palms
    }
    if (G.audio && Math.random() < dt * (6 + mv.burn * 8)) G.audio.burst(0.15, 0.015 + mv.burn * 0.03, 900 - mv.burn * 400, 'bandpass');
  }
  // coming down out of flight: a fast or steep arrival is a three-point landing with a shockwave
  forgeLanding(drop, hs) {
    const p = G.player; this.endMove(false); p.grounded = true;
    if (drop > 9 || hs > 16) {
      const c = V().set(p.pos.x, p.pos.y + 0.3, p.pos.z); p.vel.set(0, 0, 0); p.play('slam', 0.6);
      this.ball(c, 4.5, { dmg: 12, knock: 10, up: 4, civ: false }); G.fx.ring(c, '#9ff4ff', 0.5, 6, 0.45); G.fx.ring(c, '#ffffff', 0.3, 3.5, 0.3); G.fx.dust(c, 18, 2);
      G.damage.impact(V().set(c.x, p.pos.y, c.z), V().set(0, 1, 0), 1.6, 'blunt', { byHero: true, quiet: true }); G.fx.shake(0.4); this.sound('boom');
    } else p.play('land', 0.2);
  }
  // zip (Strand's line) and rocket (Rook's stretch): straight at a point, fast
  zipStep(dt, col) {
    const p = G.player, mv = this.mv, to = mv.to, dx = to.x - p.pos.x, dy = to.y - p.pos.y, dz = to.z - p.pos.z, L = Math.max(1e-3, Math.hypot(dx, dy, dz)), sp = mv.speed || 40;
    let hitGround = false;
    if (L >= 0.9) {
      p.vel.set(dx / L * sp, dy / L * sp, dz / L * sp);
      const st = Math.min(L, sp * dt); p.pos.x += dx / L * st; p.pos.y += dy / L * st; p.pos.z += dz / L * st;
      p.yaw = Math.atan2(dx, dz); p.anim = mv.kind === 'rocket' ? 'dash' : 'zip';
      hitGround = this.collide(col);
    }
    if (L < 0.9 || mv.t > 3 || (hitGround && mv.t > 0.15)) {
      const end = mv.onEnd; this.endMove(!hitGround);
      const hl = Math.hypot(dx, dz) || 1;
      if (end) end();
      else if (this.id === 'strand' && !hitGround && G.input.down('Space')) { p.vel.set(dx / hl * 9, 16, dz / hl * 9); p.fling = true; p.play('spin', 0.35); this.sound('swish'); }   // Space held as the line arrives: launch off the point, up and on
      else if (mv.wallN && this.id === 'strand') { this.startMove('wall', { n: mv.wallN }); } else { p.vel.set(-dx / L * 4, 6, -dz / L * 4); }
    }
  }
  // a straight dash that hits everything along the way
  dashStep(dt, col) {
    const p = G.player, mv = this.mv, prev = p.pos.clone();
    if (mv.steer) {   // a flight you aim with the camera (Brann's hammer): turns smoothly toward where you look
      const d = G.camera.getWorldDirection(this.v); d.y = clamp(d.y + 0.12, -0.55, 0.65); d.normalize();
      mv.dir.lerp(d, Math.min(1, 3.2 * dt)).normalize();
      if (G.input.down('Space')) mv.dir.y = Math.min(0.8, mv.dir.y + dt * 1.5);
    }
    if (mv.spin) mv.spin(dt);
    p.vel.copy(mv.dir).multiplyScalar(mv.speed); p.pos.addScaledVector(mv.dir, mv.speed * dt);
    const ground = this.collide(col);
    if (mv.hit) { const a = prev.clone().setY(prev.y + 1), b = p.pos.clone().setY(p.pos.y + 1); this.strike({ kind: 'capsule', a, b, r: mv.r || 1.4 }, { ...mv.hit, except: mv.done, dir: mv.dir }); }
    if (mv.trail) mv.trail(prev, p.pos);
    p.yaw = Math.atan2(mv.dir.x, mv.dir.z); p.anim = mv.anim || 'dash';
    const moved = prev.distanceTo(p.pos);
    if (mv.t >= mv.T || (moved < mv.speed * dt * 0.3 && mv.t > 0.05)) {
      const end = mv.onEnd; this.endMove(!ground);
      // a dash that ends in the open air can fling you on with some of its speed (mv.keep); otherwise it stops short
      if (mv.keep && !ground && moved >= mv.speed * dt * 0.3) { p.vel.multiplyScalar(mv.keep); p.vel.y = Math.max(p.vel.y, 3); p.fling = true; } else p.vel.multiplyScalar(0.15);
      if (end) end();
    }
  }

  // ---- STRAND ------------------------------------------------------------------------------------------
  strandLight() {
    // in the air (or on a line) with an enemy in front, a web strike; otherwise punch, punch, kick
    const p = G.player, air = (p.state === 'walk' && !p.grounded && !p.swim) || (this.mv && this.mv.kind === 'swing'), t = air && this.airTarget(30, 0.75);
    if (t) return this.webStrike(t);
    this.combo3({ anims: ['punchR', 'punchL', 'kick'], dmg: [15, 15, 24], knock: [3, 3, 8], range: 2.5, deg: 55, wall: 0.6 });   // (was 11 / 11 / 18: Strand was the slowest to clear any fight)
  }
  // The web strike: a line to the enemy, a zip in feet first, and a kick that rebounds Strand up and back
  // into the air, ready to swing or strike again (the move the swing games build their air combat on)
  webStrike(t) {
    const p = G.player; if (this.mv) this.endMove();
    this.startMove('strike', { target: t, last: G.combat.centre(t, V()).clone() });
    this.mv.rope = G.fx.beam((v) => this.hand(v), (v) => (t.alive ? G.combat.centre(t, v) : v.copy(this.mv ? this.mv.last : this.hand(v))), '#e8fbff', 0.025, 1e9, false);
    p.play('zip', 0.15); this.sound('web'); if (G.sfx) G.sfx.play('zip', null, 0.7);
  }
  strikeStep(dt, col) {
    const p = G.player, mv = this.mv, t = mv.target;
    if (t.alive) G.combat.centre(t, mv.last);
    const tx = mv.last.x, ty = mv.last.y - 0.9, tz = mv.last.z, dx = tx - p.pos.x, dy = ty - p.pos.y, dz = tz - p.pos.z, L = Math.hypot(dx, dy, dz) || 1e-3;
    if (L < 1.6 || mv.t > 1.1) {
      const hl = Math.hypot(dx, dz) || 1, ux = dx / hl, uz = dz / hl, hit = L < 2.6 && t.alive, c = mv.last.clone();
      this.endMove(); p.fling = true;
      if (hit) {
        this.ball(c, 1.8, { dmg: 40, knock: 15, up: 5, kind: 'blunt', dir: V().set(ux, 0.25, uz).normalize(), max: 1 });
        G.fx.ring(c, '#3fe0c5', 0.3, 3.2, 0.3, V().set(ux, 0, uz)); G.fx.spark(c, '#e8fbff', 14, 7, 0.35, 0.12); G.fx.shake(0.25); this.sound('swish');
        p.vel.set(-ux * 6, 10, -uz * 6); p.play('spin', 0.4);   // rebound up and back off the kick
      } else p.vel.multiplyScalar(0.4);
      return;
    }
    const sp = Math.min(46, 30 + mv.t * 40), step = Math.min(L, sp * dt), n = Math.max(1, Math.ceil(step / 0.4));
    p.vel.set((dx / L) * sp, (dy / L) * sp, (dz / L) * sp);
    for (let i = 0; i < n; i++) { p.pos.x += (dx / L) * (step / n); p.pos.y += (dy / L) * (step / n); p.pos.z += (dz / L) * (step / n); if (this.collide(col) && mv.t > 0.15) { this.endMove(false); p.grounded = true; return; } }
    p.yaw = Math.atan2(dx, dz); p.anim = 'kick'; p.tiltT = { x: clamp(-dy / L, -0.6, 0.6) * 0.6, z: 0 };
  }
  // the enemy nearest the crosshair within range (cos: how far off the crosshair it may be), for moves aimed from the air
  airTarget(range, cos) {
    const f = G.camera.getWorldDirection(V()), c = this.chest(); let best = null, bs = -1e9;
    for (const t of G.combat.targets) {
      if (!t.alive) continue; const q = G.combat.centre(t, this.w), d = q.distanceTo(c); if (d > range || d < 0.5) continue;
      const dot = this.v.subVectors(q, c).normalize().dot(f); if (dot < cos) continue;
      const s = dot * 3 - d / range; if (s > bs) { bs = s; best = t; }
    }
    return best;
  }
  strandHeavy() {
    const p = G.player; this.faceAim(0.5);
    const c = this.chest(), f = this.fwd(); let best = null, bd = 15;
    for (const t of G.combat.targets) { if (!t.alive) continue; const q = G.combat.centre(t, this.w); const d = q.distanceTo(c); if (d < bd && this.v.subVectors(q, c).normalize().dot(f) > 0.6) { bd = d; best = t; } }
    p.play('castR', 0.3); this.sound('web');
    if (!best) { p.play('kick', 0.3); this.later(0.1, () => this.cone(2.8, 70, { dmg: 16, knock: 9, up: 3 })); return; }
    G.fx.beam((v) => this.hand(v), (v) => G.combat.centre(best, v), '#e8fbff', 0.03, 0.35);
    best.hit(0, this.v.subVectors(c, G.combat.centre(best, this.w)).setY(0).normalize(), { knock: Math.min(60, Math.max(0, bd - 1.6) * 5), up: 0, pull: true, byHero: true });   // slides to a stop about 1.6 m in front
    this.later(0.32, () => { p.play('smash', 0.34); this.ball(this.chest().addScaledVector(this.fwd(), 1.6), 1.8, { dmg: 34, knock: 11, up: 6, kind: 'blunt' }); G.fx.ring(this.chest(), '#3fe0c5', 0.3, 3, 0.3); });
  }
  strandP1() {
    const a = this.aim(48), p = G.player; this.faceAim(0.4); p.play('castR', 0.3); this.sound('web');
    if (a.target || a.npc) {
      const tgt = a.target || a.npc, at = (v) => (a.target ? G.combat.centre(a.target, v) : v.set(a.npc.pos.x, a.npc.pos.y + 1, a.npc.pos.z));
      G.fx.beam((v) => this.hand(v), at, '#e8fbff', 0.03, 0.4);
      const d = this.v.subVectors(this.chest(), at(this.w)).setY(0); const L = d.length(); d.normalize();
      if (a.target) a.target.hit(6, d, { knock: a.target.big ? 0 : Math.min(60, Math.max(0, L - 1.8) * 5), up: 0, pull: true, stun: 1.4, kind: 'web', byHero: true });
      else G.combat.knockResident(a.npc, d, { knock: Math.min(10, L * 1.5) });
      void tgt; return;
    }
    if (a.missed) { G.ui.toast('Out of reach.', 'info'); return false; }
    const n = a.wall ? G.damage.normalAt(a.point, a.dir) : null, to = a.point.clone().addScaledVector(n || a.dir, n ? 0.45 : -0.6); to.y -= 1.1;
    this.startMove('zip', { to, speed: 42, wallN: n && Math.abs(n.y) < 0.5 ? n.setY(0).normalize() : null });
    this.mv.rope = G.fx.beam((v) => this.hand(v), a.point.clone(), '#e8fbff', 0.025, 1e9, false);
  }
  strandP2() {
    const a = this.aim(60), h = this.hand(); this.faceAim(0.4); G.player.play('castR', 0.3); this.sound('web');
    this.shoot({ from: h, dir: this.dirFrom(h, a), speed: 36, r: 0.28, color: '#f2fbff', dmg: 14, knock: 1, stun: 4, kind: 'web', blast: 3, life: 1.6, trail: '#cfefff' });
  }
  strandP3() { this.dodge = 6; G.fx.ring(this.centre(), '#3fe0c5', 0.5, 3.5, 0.5); G.ui.flash('DANGER SENSE', 1); this.sound('power'); }
  strandUlt() {
    const p = G.player, c = this.chest(), list = [...G.combat.targets].filter((t) => t.alive && G.combat.centre(t, this.w).distanceTo(c) < 30);
    p.vel.y = 9; p.grounded = false; p.play('spin', 0.9); G.ui.flash('LINE STORM', 1.2);
    const focus = c.clone().addScaledVector(this.fwd(V(), 0), 5);
    // every villain within 30 m is hit and dragged in (70 each), then they are slammed together where they land (40 more)
    for (const t of list) { G.fx.beam((v) => this.hand(v), (v) => G.combat.centre(t, v), '#e8fbff', 0.035, 0.8); const d = V().subVectors(focus, G.combat.centre(t, this.w)).setY(0); const L = d.length(); t.hit(70 * this.dmgMul, d.normalize(), { knock: Math.min(20, L * 1.8), up: 5, stun: 5, kind: 'web', byHero: true }); }
    if (list.length) this.later(0.7, () => { this.ball(focus.clone(), 4.5, { dmg: 40, knock: 12, up: 6, kind: 'blunt', color: '#e8fbff' }); G.fx.ring(focus, '#3fe0c5', 0.4, 5, 0.4); G.fx.shake(0.3); this.sound('boom'); });
    G.fx.ring(c, '#e8fbff', 1, 30, 0.7); if (!list.length) G.ui.toast('No villains within 30 m to tie up.', 'info');
  }

  // ---- FORGE ------------------------------------------------------------------------------------------
  forgeLight() {
    const p = G.player;
    if (p.grounded && !this.mv) return this.combo3({ anims: ['punchR', 'punchL', 'heavy'], dmg: [14, 14, 21], knock: [4, 4, 10], range: 2.6, deg: 55, wall: 0.9 });
    // palm shots from alternating hands; in flight they bend toward an enemy within about 14 degrees of the crosshair
    const a = this.aim(90), h = (this.combo++ % 2) ? this.handL() : this.hand(), t = this.mv && this.mv.kind === 'fly' ? this.airTarget(90, 0.97) : null;
    this.faceAim(0.3); p.play('castR', 0.15); this.sound('shot'); G.fx.blast(h, '#9ff4ff', 0.05, 0.35, 0.08);
    this.shoot({ from: h, dir: this.dirFrom(h, a), speed: 75, r: 0.14, color: '#9ff4ff', dmg: 12, knock: 3, kind: 'energy', life: 1.3, power: 0.7, trail: '#59e0ff', ...(t ? { homing: t, turn: 6 } : {}) });
  }
  forgeHeavy() {
    const p = G.player, a = this.aim(90); this.faceAim(0.5); p.play('castR', 0.4);
    const orb = G.fx.orb('#9ff4ff', 0.12); this.later(0.25, () => { orb.life = 0; const h = this.hand(); this.sound('boom'); this.shoot({ from: h, dir: this.dirFrom(h, this.aim(90)), speed: 58, r: 0.38, color: '#bff8ff', dmg: 30, knock: 11, kind: 'energy', blast: 2.2, power: 2.4, life: 1.6, trail: '#59e0ff' }); });
    const tick = () => { if (orb.life > 0) { orb.p.copy(this.hand()); orb.r0 = orb.r1 = 0.12 + Math.random() * 0.1; } }; for (let i = 0; i < 6; i++) this.later(i * 0.04, tick);
    void a;
  }
  forgeP1() {
    const c = this.chest(), list = [...G.combat.targets].filter((t) => t.alive && G.combat.centre(t, this.w).distanceTo(c) < 75).sort((x, y) => G.combat.centre(x, this.v).distanceTo(c) - G.combat.centre(y, this.w).distanceTo(c));
    const a = this.aim(90); G.player.play('raise', 0.3); G.ui.flash('MISSILES', 0.8);
    for (let i = 0; i < 6; i++) this.later(i * 0.07, () => {
      const p = G.player, s = i % 2 ? 1 : -1, from = this.chest().add(this.v.set(Math.cos(p.yaw) * 0.25 * s, 0.35, -Math.sin(p.yaw) * 0.25 * s));
      const t = list.length ? list[i % list.length] : null, dir = V().set((Math.random() - 0.5) * 0.6, 1, (Math.random() - 0.5) * 0.6).add(this.fwd(V(), 0)).normalize();
      this.shoot({ from, dir, speed: 30, r: 0.16, color: '#ffb066', dmg: 22, knock: 8, up: 3, kind: 'blunt', blast: 3.2, power: 2.4, life: 4, homing: t, turn: 4.5, trail: '#ff8a3c', ...(t ? {} : { onHit: null }) });
      if (!t) { const pr = this.proj[this.proj.length - 1]; pr.target = a.point.clone(); pr.homing = { alive: true, pos: pr.target, h: 0, r: 0.5 }; }
      this.sound('shot');
    });
  }
  forgeP2() {
    G.player.play('beam', 2.3); this.faceAim(2.3); G.ui.flash('CHEST BEAM', 0.8); this.sound('power');
    let wallT = 0;
    this.startChannel(2.2, 0.08, () => {
      this.faceAim(0.3); const from = this.core ? this.core.getWorldPosition(V()) : this.chest(), a = this.aim(70), to = a.point.clone(), d = this.v.subVectors(to, from).normalize();
      G.fx.beam(from, to, '#bff8ff', 0.32, 0.1); G.fx.beam(from, to, '#ffffff', 0.12, 0.1); G.fx.spark(to, '#9ff4ff', 4, 5, 0.3, 0.12);
      this.strike({ kind: 'capsule', a: from, b: to, r: 0.9 }, { dmg: 7, knock: 2.5, kind: 'energy', color: '#9ff4ff', dir: d.clone() });
      wallT -= 0.08; if (a.wall && wallT <= 0) { wallT = 0.24; G.damage.impact(to, G.damage.normalAt(to, d), 1.4, 'energy', { byHero: true, quiet: true }); }
      if (G.audio && Math.random() < 0.5) G.audio.burst(0.1, 0.04, 2200, 'bandpass');
    }, { slow: 0.15 });
  }
  forgeP3() {
    const c = this.centre(); this.shield = 6; G.player.play('roar', 0.45);
    this.ball(c, 7, { dmg: 15, knock: 13, up: 5, kind: 'energy', color: '#9ff4ff' }); G.fx.ring(c, '#9ff4ff', 0.5, 8, 0.5); G.fx.blast(c, '#9ff4ff', 0.5, 3, 0.3); this.sound('boom');
  }
  forgeUlt() {
    const p = G.player; p.vel.y = 7; p.grounded = false; p.play('transform', 1.1); G.ui.flash('OVERLOAD', 1.2);
    for (let i = 0; i < 10; i++) this.later(i * 0.09, () => G.fx.spray(this.centre(), this.v.set(0, 0, 0), '#bff8ff', 6, -5, 2.5, 0.4, 0.2, 0.04));
    this.later(1.0, () => {
      const c = this.centre(); this.ball(c, 20, { dmg: 90, knock: 19, up: 8, kind: 'energy', color: '#bff8ff' });
      G.damage.burst(c, 20, 5, 'energy', { byHero: true }); G.fx.blast(c, '#bff8ff', 1, 9, 0.6); G.fx.ring(c, '#9ff4ff', 1, 24, 0.8); G.fx.ring(c, '#ffffff', 1, 16, 0.6, UP.clone().set(0, 0, 1)); G.fx.shake(1); this.sound('boom');
    });
  }

  // ---- RAIKO ------------------------------------------------------------------------------------------
  raikoLight() {
    if (this.ult > 0) { // inside the guardian: huge sweeps
      const p = G.player; this.faceAim(0.5); p.play(this.combo++ % 2 ? 'slash2' : 'slash', 0.3); this.sound('zap');
      this.later(0.1, () => { this.cone(8, 110, { dmg: 45, knock: 14, up: 4, kind: 'shock', color: '#c9b8ff' }); this.arc('#c9b8ff', this.combo % 2 ? 1 : -1, 7); G.damage.wallHit(this.chest(), this.fwd(V(), 0.3), 8, 2.5, 'shock', { byHero: true }); });
      return;
    }
    this.combo3({ anims: ['slash', 'slash2', 'slash'], dmg: [15, 15, 23], knock: [3, 3, 8], range: 3.0, deg: 70, kind: 'cut', color: '#c9b8ff', arc: true, wall: 0.7 });
  }
  raikoHeavy() {
    const p = G.player; this.faceAim(0.4);
    if (this.ult > 0) { const a = this.aim(120), h = this.hand(); p.play('dashstab', 0.32); this.sound('zap'); this.shoot({ from: h, dir: this.dirFrom(h, a), speed: 95, r: 0.45, color: '#c9b8ff', dmg: 70, knock: 14, kind: 'shock', blast: 5, power: 4, life: 1.6, trail: '#a78bff' }); return; }
    const f = this.fwd(V(), 0.2), from = p.pos.clone();
    this.startMove('dash', { dir: f, speed: 26, T: 0.16, done: new Set(), hit: { dmg: 28, knock: 9, up: 2, kind: 'shock', color: '#c9b8ff' }, r: 1.2, trail: (a, b) => G.fx.bolt(a.clone().setY(a.y + 1), b.clone().setY(b.y + 1), '#c9b8ff', 0.05, 0.2) });
    this.sound('zap'); void from;
  }
  raikoP1() {
    const p = G.player, a = this.aim(30); this.faceAim(0.3);
    const dir = V().subVectors(a.point, p.pos).setY(0); if (dir.lengthSq() < 0.01) dir.set(Math.sin(p.yaw), 0, Math.cos(p.yaw)); dir.normalize();
    this.startMove('dash', { dir, speed: 70, T: 0.2, done: new Set(), hit: { dmg: 40, knock: 8, up: 3, stun: 0.6, kind: 'shock', color: '#c9b8ff' }, r: 1.6,
      trail: (x, y) => { G.fx.bolt(x.clone().setY(x.y + 1.1), y.clone().setY(y.y + 1.1), '#c9b8ff', 0.07, 0.3, 0.9); G.fx.spark(y.clone().setY(y.y + 1), '#e8dcff', 3, 4, 0.3, 0.1); },
      onEnd: () => { p.play('slash2', 0.3); G.fx.ring(this.centre(), '#a78bff', 0.4, 4, 0.35); G.damage.wallHit(this.chest(), dir, 2, 2, 'shock', { byHero: true }); } });
    this.sound('zap'); G.fx.shake(0.15);
  }
  raikoP2() {
    const p = G.player; p.play('breathe', 1.7); this.sound('fire'); G.ui.flash('FIRE BREATH', 0.8);
    let wallT = 0;
    this.startChannel(1.6, 0.08, () => {
      this.faceAim(0.3); const from = this.chest().add(this.v.set(0, 0.4, 0)), a = this.aim(14), d = this.dirFrom(from, a);
      from.addScaledVector(d, 0.3);
      G.fx.spray(from, d, Math.random() < 0.5 ? '#ff7a1a' : '#ffc23d', 9, 16, 0.35, 0.55, 0.25, 1.1, -1);
      if (Math.random() < 0.4) G.fx.spray(from, d, '#3a3d44', 1, 8, 0.4, 1.2, 0.5, 1.6, -0.5, true);
      this.strike({ kind: 'cone', o: from, dir: d, range: 11, cos: Math.cos(0.4) }, { dmg: 6, knock: 1.5, kind: 'fire', color: '#ff8a3c' });
      wallT -= 0.08; if (wallT <= 0) { wallT = 0.3; G.damage.wallHit(from, d, 11, 1.2, 'fire', { byHero: true, quiet: true }); }
      if (G.audio && Math.random() < 0.4) G.audio.burst(0.2, 0.04, 600);
    }, { slow: 0.4 });
  }
  raikoP3() {
    const p = G.player, a = this.aim(38); this.faceAim(0.2);
    const swirl = (q) => { G.fx.ring(q.clone().setY(q.y + 1), '#a78bff', 0.2, 2.2, 0.35, new THREE.Vector3(0, 0, 1)); G.fx.spark(q.clone().setY(q.y + 1), '#c9b8ff', 14, 5, 0.4, 0.14); };
    if (a.target && !a.target.big) {
      const t = a.target, here = p.pos.clone(); swirl(here); swirl(t.pos);
      p.pos.copy(t.pos); t.pos.copy(here); p.vel.set(0, 0, 0); t.hit(10, V().set(Math.sin(p.yaw), 0, Math.cos(p.yaw)), { stun: 1.3, kind: 'shock', byHero: true });
    } else {
      if (a.missed && a.t >= 38) a.point.copy(G.camera.position).addScaledVector(a.dir, 38);
      const q = a.point.clone().addScaledVector(a.dir, -1.0), g = G.colliders.groundAt(q.x, q.z, q.y + 1.5, 2, 0.3);
      swirl(p.pos); q.y = Math.max(g, q.y - 1); p.pos.copy(q); p.vel.set(0, 0, 0); p.grounded = q.y - g < 0.1; swirl(p.pos);
    }
    this.sound('zap');
  }
  raikoUlt() {
    G.env.flash = 1;
    this.ult = 12; G.ui.flash('STORM GUARDIAN', 1.4);
    if (!this.guardian) {
      const g = (this.guardian = new THREE.Group()), m = new THREE.MeshBasicMaterial({ color: new THREE.Color('#7a5cff').multiplyScalar(0.55), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const add = (geo, x, y, z, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, 0, rz); o.scale.set(sx, sy, sz); g.add(o); return o; };
      for (let k = 0; k < 5; k++) for (const s of [-1, 1]) add(new THREE.TorusGeometry(1.4 - k * 0.12, 0.08, 6, 18, Math.PI * 0.9), s * 0.05, 2.0 + k * 0.42, 0, 0, s > 0 ? 0 : Math.PI, 1, 1, 0.8);   // ribs
      add(new THREE.CylinderGeometry(0.12, 0.12, 2.6, 8), 0, 2.6, -0.5);                                              // spine
      add(new THREE.SphereGeometry(0.85, 14, 10), 0, 4.9, 0.1, 0, 0, 1, 1.15, 1);                                     // head
      for (const s of [-1, 1]) { add(new THREE.ConeGeometry(0.16, 0.9, 8), s * 0.5, 5.7, 0.1, 0, -s * 0.5); add(new THREE.BoxGeometry(0.5, 2.4, 0.5), s * 2.1, 3.2, 0.3, 0, s * 0.35); }   // crest and arms
      add(new THREE.BoxGeometry(0.16, 4.2, 0.05), 2.6, 3.6, 1.4, 0.9, -0.2);                                          // a blade of light
      g.traverse((o) => { o.castShadow = false; }); G.scene.add(g);
    }
    this.guardian.visible = true; this.guardian.scale.setScalar(0.1); this.sound('power');
  }
  // ---- SABLE ------------------------------------------------------------------------------------------
  sableLight() { this.combo3({ anims: ['slash', 'slash2', 'punchR'], dmg: [13, 13, 17], knock: [3, 3, 7], range: 2.5, deg: 60, kind: 'cut', color: '#ff8a96', arc: true, wall: 0.6 }); }
  sableHeavy() { const p = G.player; this.faceAim(0.3); p.play('roundhouse', 0.38); this.sound('swish'); this.later(0.12, () => { this.ball(this.centre(), 2.7, { dmg: 22, knock: 10, up: 3 }); G.fx.ring(this.centre(), '#ff8a96', 0.3, 3, 0.3); }); }
  sableP1() {
    const p = G.player; this.faceAim(0.6); p.play('charge', 0.4); this.sound('zap');
    const orb = G.fx.orb('#cfe9ff', 0.16);
    for (let i = 0; i < 8; i++) this.later(i * 0.045, () => { orb.p.copy(this.hand()); G.fx.bolt(orb.p, orb.p.clone().add(this.v.set((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5))), '#cfe9ff', 0.025, 0.08, 0.5, 2); });
    this.later(0.36, () => {
      orb.life = 0; const a = this.aim(28), to = (a.target ? G.combat.centre(a.target, V()) : a.point.clone()); to.y -= 1;
      const dir = V().subVectors(to, p.pos); const L = Math.min(Math.max(2, dir.length() - 1.2), 26); dir.normalize();
      this.startMove('dash', { dir, speed: 55, T: L / 55, done: new Set(), anim: 'castR', trail: (x, y) => G.fx.bolt(x.clone().setY(x.y + 1.2), y.clone().setY(y.y + 1.2), '#cfe9ff', 0.05, 0.2),
        onEnd: () => {
          p.play('dashstab', 0.35); const h = this.chest().addScaledVector(dir, 1.0);
          const n = this.ball(h, 1.6, { dmg: 65, knock: 16, up: 5, kind: 'shock', color: '#cfe9ff', max: 1 });
          G.fx.blast(h, '#cfe9ff', 0.2, 1.8, 0.3); G.fx.spark(h, '#ffffff', 26, 9, 0.4, 0.14); G.fx.shake(0.3); this.sound('boom');
          if (!n) G.damage.wallHit(this.chest(), dir, 2.5, 4, 'shock', { byHero: true });
        } });
    });
  }
  sableP2() {
    const p = G.player; p.play('cast', 0.4); G.ui.flash('HOUND PACK', 0.8);
    const taken = new Set();
    for (let i = 0; i < 4; i++) {
      const rig = makeDog({ color: '#3a3f4a', accent: '#ff5a6e', scale: 1.15 }), a = p.yaw + (i - 1.5) * 0.6, pos = V().set(p.pos.x + Math.sin(a) * 1.6, p.pos.y, p.pos.z + Math.cos(a) * 1.6);
      G.scene.add(rig.root); G.fx.smoke(pos, 2, '#5a5f6a', 1.2, 1); G.fx.spark(pos.clone().setY(pos.y + 0.5), '#ff5a6e', 6, 3, 0.3, 0.1);
      const near = [...G.combat.targets].filter((t) => t.alive && !taken.has(t) && t.pos.distanceTo(p.pos) < 28 && !t.flying).sort((x, y) => x.pos.distanceTo(p.pos) - y.pos.distanceTo(p.pos))[0] || null;
      if (near) taken.add(near);
      this.hounds.push({ rig, pos, yaw: p.yaw, t: 0, life: 8, target: near, bit: false, ang: a });
    }
    if (G.audio) for (let i = 0; i < 3; i++) setTimeout(() => G.audio && G.audio.tone(300 + i * 40, 0.15, 0.04, 'sawtooth', null, 0, 0.6), i * 120);
  }
  stepHounds(dt, t) {
    for (let i = this.hounds.length - 1; i >= 0; i--) {
      const h = this.hounds[i]; h.t += dt; h.life -= dt;
      let tx, tz, sp = 0;
      if (h.target && h.target.alive) {
        tx = h.target.pos.x; tz = h.target.pos.z; const d = Math.hypot(tx - h.pos.x, tz - h.pos.z);
        if (d > 1.1) sp = 14; else if (!h.bit) { h.bit = true; h.target.hit(10, this.v.set(tx - h.pos.x, 0, tz - h.pos.z).normalize(), { stun: 4, kind: 'cut', byHero: true, knock: 1 }); h.life = Math.min(h.life, 3.5); if (G.audio) G.audio.tone(260, 0.12, 0.05, 'sawtooth'); }
      } else { h.ang += dt * 2; const P = G.player.pos; tx = P.x + Math.sin(h.ang) * 2.5; tz = P.z + Math.cos(h.ang) * 2.5; sp = 6; if (!h.target && h.t > 3) h.life = Math.min(h.life, 0.1); }
      if (sp) { const dx = tx - h.pos.x, dz = tz - h.pos.z, d = Math.hypot(dx, dz) || 1, st = Math.min(d, sp * dt); h.pos.x += dx / d * st; h.pos.z += dz / d * st; h.yaw = dampAngle(h.yaw, Math.atan2(dx, dz), 10, dt); }
      h.pos.y = G.colliders.groundAt(h.pos.x, h.pos.z, h.pos.y + 1, 1, 0.2);
      h.rig.root.position.copy(h.pos); h.rig.root.rotation.y = h.yaw; animateDog(h.rig, dt, sp > 8 ? 'run' : sp > 0 ? 'walk' : 'idle', sp);
      if (h.life <= 0) { G.fx.smoke(h.pos, 2, '#5a5f6a', 1.2, 1); h.rig.root.removeFromParent(); this.hounds.splice(i, 1); }
    }
  }
  sableP3() {
    const a = this.aim(32), p = G.player; this.faceAim(0.4); p.play('cast', 0.5); this.sound('power');
    const at = a.target ? G.combat.centre(a.target, V()) : a.point.clone();
    for (let i = 0; i < 6; i++) this.later(i * 0.12, () => { G.fx.ring(at, '#ff5a6e', 2.6 - i * 0.35, 0.2, 0.4, new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw))); G.fx.spray(at, this.v.set(0, 0, 0), '#ff8a96', 6, -4, 3, 0.4, 0.14, 0.02); });
    if (a.target && a.target.warp && !a.target.big) { this.later(0.7, () => { if (a.target.alive) a.target.warp(6, 45); }); }
    else if (a.target) this.later(0.7, () => a.target.alive && a.target.hit(60, V().set(0, 0, 1), { kind: 'shock', byHero: true }));
    else if (G.villains) G.villains.eraseNear(at, 4.5, 1.5);
  }
  sableUlt() {
    const k = this.copied; if (!k) { G.ui.toast('Nothing copied yet: let a villain show you a move first (stay close when they use one).', 'info'); return false; }
    G.ui.flash(`COPY: ${COPY_NAMES[k].split(' (')[0].toUpperCase()}`, 1.3); const p = G.player, c = this.centre();
    if (k === 'quake' || k === 'club') { p.play('slam', 0.5); this.later(0.25, () => { const r = k === 'club' ? 12 : 10; this.ball(c, r, { dmg: k === 'club' ? 90 : 70, knock: 17, up: 7, kind: 'blunt' }); G.damage.burst(this.centre(), r * 0.6, 4, 'blunt', { byHero: true }); G.fx.ring(this.centre(), '#ff5a6e', 0.5, r + 2, 0.5); G.fx.dust(this.centre(), 30, 3); G.fx.shake(0.8); this.sound('boom'); }); }
    else if (k === 'volley') { const list = [...G.combat.targets].filter((t) => t.alive && t.pos.distanceTo(p.pos) < 50); for (let i = 0; i < 10; i++) this.later(i * 0.06, () => { const h = this.hand(); this.shoot({ from: h, dir: V().set(Math.random() - 0.5, 0.6, Math.random() - 0.5).add(this.fwd()).normalize(), speed: 40, r: 0.15, color: '#ff8a3c', dmg: 20, knock: 5, kind: 'energy', life: 3, homing: list.length ? list[i % list.length] : null, turn: 6, trail: '#ff5a2a' }); this.sound('shot'); }); }
    else if (k === 'rockets') { this.forgeP1(); }
    else if (k === 'storm') { p.play('breathe', 2.6); this.startChannel(2.5, 0.08, () => { this.faceAim(0.3); const from = this.chest().add(this.v.set(0, 0.4, 0)), a = this.aim(40), to = a.point.clone(), d = this.dirFrom(from, a); G.fx.beam(from, to, '#ff5a2a', 0.5, 0.1); G.fx.bolt(from, to, '#ffd0b0', 0.06, 0.1, 1.2); this.strike({ kind: 'capsule', a: from, b: to, r: 1.3 }, { dmg: 12, knock: 3, kind: 'fire', color: '#ff7a3c', dir: d }); if (a.wall && Math.random() < 0.4) G.damage.impact(to, G.damage.normalAt(to, d), 1.6, 'fire', { byHero: true, quiet: true }); }, { slow: 0.2 }); }
  }
  saw(kind, pos) {
    if (!this.on || this.id !== 'sable' || !kind || G.player.pos.distanceTo(pos) > 28) return;
    if (this.copied !== kind) { this.copied = kind; G.ui.toast(`Copied: ${COPY_NAMES[kind]}. R uses it when the meter is full.`, 'good'); if (this.eyeLens) G.fx.spark(this.eyeLens.getWorldPosition(V()), '#ff3b4f', 8, 2, 0.4, 0.08, 0); }
  }

  // ---- ROOK -------------------------------------------------------------------------------------------
  setForm(f) {
    this.form = f; this.formT = f === 4 ? 25 : 0; this.applyStats();
    if (this.fist) this.fist.visible = f === 3 && this.ult <= 0;
    const names = { 1: 'BASE FORM', 2: 'FORM 2: STEAM', 3: 'FORM 3: GIANT FIST', 4: 'FORM 4: BOUNCE' };
    G.ui.flash(names[f], 1.1); G.fx.smoke(this.centre(), 6, '#e8eef4', 1.4, 2.4); G.fx.ring(this.centre(), '#ffd34d', 0.4, 4, 0.4);
    if (G.audio) G.audio.tone(200 + f * 80, 0.35, 0.05, 'triangle', null, 0.02, 1.6);
  }
  rookLight() {
    const p = G.player; this.faceAim(0.4);
    if (this.ult > 0) { p.play('slam', 0.4); this.sound('boom'); this.later(0.14, () => { const c = this.chest().addScaledVector(this.fwd(V(), 0.2), 6); c.y = p.pos.y + 0.5; this.ball(c, 6, { dmg: 60, knock: 20, up: 9 }); G.fx.ring(c, '#ffffff', 0.5, 9, 0.6); G.fx.ring(c, '#ffffff', 0.5, 13, 0.9); G.damage.burst(c, 6, 4, 'blunt', { byHero: true }); G.fx.shake(0.6); }); return; }
    if (this.form === 4) { const a = this.aim(60), h = this.hand(); p.play('heavy', 0.3); this.sound('boom'); this.shoot({ from: h, dir: this.dirFrom(h, a), speed: 62, r: 0.5, color: '#e0ac7e', dmg: 45, knock: 18, up: 5, kind: 'blunt', life: 0.7, power: 2.5, onHit: (q) => G.fx.ring(q, '#ffffff', 0.3, 3, 0.3) }); return; }
    const giant = this.form === 3, side = this.combo++ % 2, a = this.aim(giant ? 11 : 8), from = side ? this.handL() : this.hand();
    p.play(giant ? 'heavy' : side ? 'punchL' : 'punchR', 0.25); this.sound('swish');
    const end = a.point.clone(), skin = '#e0ac7e';
    G.fx.beam(from, end, skin, giant ? 0.22 : 0.09, 0.16, false);
    const fist = G.fx.orb(skin, giant ? 1.4 : 0.16); fist.p.copy(end); fist.life = 0.16; fist.c.set(skin).multiplyScalar(0.6);
    this.later(0.05, () => {
      const r = giant ? 2.6 : 0.9, n = this.ball(end, r, { dmg: (giant ? 55 : 14) * (this.form === 2 ? 1.4 : 1), knock: giant ? 16 : 6, up: giant ? 5 : 1, max: giant ? 99 : 1 });
      if (!n && a.wall) G.damage.impact(end, G.damage.normalAt(end, a.dir), giant ? 3.5 : 0.8, 'blunt', { byHero: true });
      if (giant) { G.fx.shake(0.3); G.fx.ring(end, '#ffffff', 0.3, 4, 0.3); }
    });
  }
  rookHeavy() {
    const p = G.player; this.faceAim(1.0);
    if (this.ult > 0) { p.play('slam', 0.5); this.later(0.2, () => { const c = this.centre(); c.y = p.pos.y + 0.3; this.ball(c, 15, { dmg: 40, knock: 20, up: 12 }); for (let i = 0; i < 4; i++) this.later(i * 0.12, () => G.fx.ring(c, '#ffffff', 0.5, 6 + i * 4, 0.6)); G.fx.dust(c, 30, 4); G.fx.shake(0.7); this.sound('laugh'); }); return; }
    if (this.form === 4) { const list = [...G.combat.targets].filter((t) => t.alive && t.pos.distanceTo(p.pos) < 40); p.play('heavy', 0.4); for (let i = 0; i < 3; i++) this.later(i * 0.1, () => { const h = this.hand(); this.shoot({ from: h, dir: this.fwd(V(), 0.3), speed: 40, r: 0.4, color: '#e0ac7e', dmg: 35, knock: 12, kind: 'blunt', life: 2, homing: list[i % Math.max(1, list.length)] || null, turn: 7 }); }); return; }
    p.play('punchR', 1.0); this.sound('swish');
    this.startChannel(0.9, this.form === 2 ? 0.04 : 0.06, () => {
      this.faceAim(0.3); const c = this.chest(), f = this.fwd(), a = p.yaw + (Math.random() - 0.5) * 0.7, L = 4 + Math.random() * 4;
      const end = V().set(c.x + Math.sin(a) * L, c.y + (Math.random() - 0.5) * 1.2 - Math.sin(p.camPitch) * L * 0.5, c.z + Math.cos(a) * L), from = Math.random() < 0.5 ? this.hand() : this.handL();
      G.fx.beam(from, end, '#e0ac7e', 0.08, 0.08, false); const o = G.fx.orb('#e0ac7e', 0.15); o.p.copy(end); o.life = 0.08; o.c.multiplyScalar(0.6);
      this.cone(8, 30, { dmg: 5 * (this.form === 2 ? 1.5 : 1), knock: 2, kind: 'blunt' }, c, f);
      if (G.audio && Math.random() < 0.5) G.audio.burst(0.06, 0.04, 900);
      p.anim = Math.random() < 0.5 ? 'punchL' : 'punchR'; p.play(p.anim, 0.1);
    }, { slow: 0.5 });
  }
  rookP1() {
    const a = this.aim(55), p = G.player; this.faceAim(0.3);
    if (a.missed) { G.ui.toast('Nothing to grab that far away.', 'info'); return false; }
    const to = a.point.clone().addScaledVector(a.dir, -0.8); to.y -= 1;
    const tgt = a.target; p.play('zip', 0.4);
    // the stretched arm snaps him to the point; there he lets go and is slung on past it, up and over (a hit enemy takes the blow)
    this.startMove('rocket', { to, speed: 48, onEnd: () => {
      if (tgt && tgt.alive) { this.ball(G.combat.centre(tgt, V()), 2, { dmg: 35, knock: 12, up: 4 }); G.fx.ring(this.centre(), '#ffd34d', 0.3, 3, 0.3); p.vel.set(-a.dir.x * 4, 6.5, -a.dir.z * 4); return; }
      const up = a.wall && !a.ground, hx = a.dir.x, hz = a.dir.z, hl = Math.hypot(hx, hz) || 1, fw = up ? 3 : 14;   // at a wall he springs up it instead of into it
      p.vel.set(hx / hl * fw, up ? 14 : 11, hz / hl * fw); p.fling = true; p.grounded = false; p.play('spin', 0.4); G.fx.ring(this.centre(), '#f08a24', 0.3, 2.5, 0.3);
    } });
    this.mv.rope = G.fx.beam((v) => this.hand(v), a.point.clone(), '#e0ac7e', 0.08, 1e9, false);
    this.sound('swish');
  }
  rookP2() { if (this.ult > 0) return false; this.setForm(this.form >= 4 ? 1 : this.form + 1); G.player.play('flex', 0.5); }
  rookP3() { this.balloon = 3; this.applyStats(); G.fx.ring(this.centre(), '#ffd34d', 0.5, 3, 0.4); if (G.audio) G.audio.tone(180, 0.4, 0.06, 'sine', null, 0, 2.2); }
  rookUlt() {
    this.ult = 20; this.applyStats(); if (this.fist) this.fist.visible = false;
    G.ui.flash('FORM 5', 1.6); G.fx.blast(this.centre(), '#ffffff', 1, 6, 0.6); for (let i = 0; i < 3; i++) G.fx.ring(this.centre(), '#ffffff', 0.5, 6 + i * 4, 0.7);
    this.sound('laugh');
  }
  endUlt() {
    const id = this.id; this.ult = 0;
    if (id === 'raiko' && this.guardian) { this.guardian.visible = false; G.fx.spark(this.centre(), '#a78bff', 30, 6, 0.6, 0.15); }
    if (id === 'rook') { this.tired = 4; this.setForm(1); G.ui.toast('Form 5 wears off. That took everything.', 'info'); }
    if (id === 'bulwark') { this.rage = 30; this.applyStats(); }
  }

  // ---- the second five's running effects: storms, rage, leaps, clones, fire on the ground --------------
  passives(dt, t) {
    const p = G.player, id = this.id, fx = G.fx;
    this.block = Math.max(0, (this.block || 0) - dt); this.counter = Math.max(0, (this.counter || 0) - dt); this.flame = Math.max(0, (this.flame || 0) - dt);
    if (id === 'brann' && this.ult > 0) { this.stormT = (this.stormT || 0) - dt; if (this.stormT <= 0) { this.stormT = 0.4; const list = [...G.combat.targets].filter((x) => x.alive && x.pos.distanceTo(p.pos) < 35); const tg = list[Math.floor(Math.random() * list.length)]; const at = tg ? G.combat.centre(tg, V()) : V().set(p.pos.x + (Math.random() - 0.5) * 30, p.pos.y, p.pos.z + (Math.random() - 0.5) * 30); fx.bolt(at.clone().setY(at.y + 40), at, '#cfe9ff', 0.16, 0.25, 3); G.env.flash = Math.max(G.env.flash, 0.45); if (tg) this.ball(at, 2.5, { dmg: 35, knock: 6, up: 3, kind: 'shock', color: '#8fd3ff' }); this.sound('zap'); } }
    if (id === 'bulwark') {
      if (this.calm > 4) this.rage = Math.max(0, (this.rage || 0) - dt * 3);
      for (const v of this.veins || []) v.material.color.setScalar(0.3 + (this.rage || 0) / 100 * 2.2 + (this.ult > 0 ? 1.5 : 0));
      if (this.leap && id !== 'bulwark') this.leap = null;
      if (this.leap) { this.leap.t += dt; if (this.leap.t > 0.25 && p.grounded) { const c = this.centre(); c.y = p.pos.y + 0.3; this.leap = null; this.ball(c, 7, { dmg: 45, knock: 15, up: 7 }); G.damage.impact(V().set(c.x, p.pos.y, c.z), V().set(0, 1, 0), 4.5, 'blunt', { byHero: true }); fx.ring(c, '#ffb347', 0.5, 9, 0.5); fx.dust(c, 30, 3); fx.shake(0.7); this.sound('boom'); } }
    }
    if (this.leap && id !== 'bulwark' && this.sigLeap) { this.leap.t += dt; if (this.leap.t > 0.25 && p.grounded) { const o = this.sigLeap, c = this.centre(); this.leap = null; this.ball(c, o.r, { dmg: o.dmg, knock: 16, up: 10 }); G.fx.ring(c, o.color, 0.5, o.r + 3, 0.5); G.fx.ring(c, '#ffffff', 0.5, o.r, 0.4); G.damage.impact(V().set(c.x, p.pos.y, c.z), V().set(0, 1, 0), 4, 'blunt', { byHero: true }); G.fx.shake(0.7); this.sound('boom'); } }
    if (id === 'ember') {
      for (const e of this.fists || []) if (Math.random() < dt * (this.flame > 0 ? 6 : 14)) { const q = e.localToWorld(this.w.set(0, -0.36, 0.03)); fx.glow.emit(q.x, q.y, q.z, (Math.random() - 0.5) * 0.4, 1 + Math.random(), (Math.random() - 0.5) * 0.4, Math.random() < 0.5 ? '#ff7a1a' : '#ffc23d', 0.4, 0.14, 0.03, -1, 0); }
      if (this.flame > 0) { fx.fire(V().set(p.pos.x, p.pos.y + 0.2 + Math.random() * 1.6, p.pos.z), 3, 0.8); this.flameT = (this.flameT || 0) - dt; if (this.flameT <= 0) { this.flameT = 0.3; this.ball(this.centre(), 1.6, { dmg: 6, knock: 2, kind: 'fire', civ: false }); } }
    }
    // fire left on the ground (Ember's dash and pillars)
    for (let i = (this.patches || []).length - 1; i >= 0; i--) { const f = this.patches[i]; f.t -= dt; f.k -= dt; if (Math.random() < dt * (f.pillar ? 30 : 10)) fx.fire(f.p, f.pillar ? 3 : 1, f.pillar ? 0.6 : 1.2); if (f.pillar && Math.random() < dt * 12) fx.glow.emit(f.p.x, f.p.y + Math.random() * 3, f.p.z, 0, 3, 0, '#ff7a1a', 0.5, 0.4, 0.1, -1, 0); if (f.k <= 0) { f.k = 0.3; this.ball(V().copy(f.p).setY(f.p.y + 0.8), f.r, { dmg: 5, knock: 1, kind: 'fire', civ: false }); } if (f.t <= 0) this.patches.splice(i, 1); }
    // Kitsu's clones
    for (let i = (this.clones || []).length - 1; i >= 0; i--) {
      const c = this.clones[i]; c.t -= dt; c.cool -= dt;
      const tg = (c.target && c.target.alive) ? c.target : (c.target = [...G.combat.targets].filter((x) => x.alive && !x.flying).sort((a, b) => a.pos.distanceTo(c.pos) - b.pos.distanceTo(c.pos))[0] || null);
      let sp = 0, anim = 'guard';
      if (tg) { const dx = tg.pos.x - c.pos.x, dz = tg.pos.z - c.pos.z, d = Math.hypot(dx, dz); c.yaw = Math.atan2(dx, dz); if (d > 1.6) { sp = 9; c.pos.x += dx / d * sp * dt; c.pos.z += dz / d * sp * dt; anim = 'run'; } else if (c.cool <= 0) { c.cool = 0.55; c.anim = c.anim === 'punchR' ? 'punchL' : 'punchR'; c.animT = 0.25; tg.hit(8 * this.dmgMul, V().set(dx / d, 0, dz / d), { knock: 3, byHero: true }); fx.spark(G.combat.centre(tg, V()), '#59c8ff', 5, 4, 0.25, 0.1); } }
      else { const a = t * 1.5 + i * 2.1; c.pos.x = damp(c.pos.x, p.pos.x + Math.cos(a) * 2.5, 3, dt); c.pos.z = damp(c.pos.z, p.pos.z + Math.sin(a) * 2.5, 3, dt); anim = 'jog'; sp = 3; }
      c.animT = (c.animT || 0) - dt; if (c.animT > 0) anim = c.anim;
      c.pos.y = G.colliders.groundAt(c.pos.x, c.pos.z, c.pos.y + 1, 1, 0.3);
      c.rig.root.position.copy(c.pos); c.rig.root.rotation.y = c.yaw; animateRig(c.rig, dt, anim, sp);
      if (c.t <= 0) { fx.smoke(c.pos.clone().setY(c.pos.y + 1), 4, '#e8eef4', 1.4, 1.5); c.rig.root.removeFromParent(); this.clones.splice(i, 1); }
    }
  }
  // a thrown thing that flies out and comes back to the hand (Brann's hammer, Warden's shield)
  throwBack(o) {
    const a = this.aim(o.range || 40), h = this.hand(), dir = this.dirFrom(h, a);
    if (this.tool) this.tool.visible = false;
    const back = () => this.shoot({ from: this.proj.length ? h : h, dir: dir.clone().negate(), speed: o.speed, r: o.r, color: o.color, dmg: o.dmg * 0.6, knock: 4, kind: o.kind, ghost: true, home: true, pierce: true, done: new Set(), life: 3, trail: o.trail, onCatch: () => { if (this.tool) this.tool.visible = true; } });
    const pr = this.shoot({ from: h, dir, speed: o.speed, r: o.r, color: o.color, dmg: o.dmg, knock: o.knock, up: 2, kind: o.kind, life: (o.range || 40) / o.speed, pierce: true, done: new Set(), power: o.power, trail: o.trail, onHit: (q) => { const b = this.shoot({ from: q, dir: V(), speed: o.speed, r: o.r, color: o.color, dmg: o.dmg * 0.6, knock: 4, kind: o.kind, ghost: true, home: true, pierce: true, done: new Set(), life: 3, trail: o.trail, onCatch: () => { if (this.tool) this.tool.visible = true; } }); void b; } });
    // out of range with nothing hit: come back from the far end
    this.later((o.range || 40) / o.speed - 0.02, () => { if (this.proj.includes(pr)) { const q = pr.pos.clone(); pr.life = 0; pr.onHit = null; this.shoot({ from: q, dir: V(), speed: o.speed, r: o.r, color: o.color, dmg: o.dmg * 0.6, knock: 4, kind: o.kind, ghost: true, home: true, pierce: true, done: new Set(), life: 3, trail: o.trail, onCatch: () => { if (this.tool) this.tool.visible = true; } }); } });
    void back;
  }
  // a shield (or anything) bouncing from enemy to enemy: list of targets, damage each, then home
  chain(list, dmg, hex, step = 0.17) {
    if (this.tool) this.tool.visible = false;
    const orb = G.fx.orb(hex, 0.32); orb.p.copy(this.hand()); let prev = orb.p.clone();
    list.forEach((tg, i) => this.later(step * (i + 1), () => { if (!tg.alive) return; const c = G.combat.centre(tg, V()); G.fx.beam(prev.clone(), c.clone(), hex, 0.08, 0.25); orb.p.copy(c); prev = c; tg.hit(dmg * this.dmgMul, V().subVectors(c, this.centre()).setY(0).normalize(), { knock: 6, up: 2, byHero: true }); G.combat.lastHit = tg; G.combat.lastHitT = 4; this.charge(dmg * 0.35); G.fx.spark(c, hex, 10, 5, 0.3, 0.12); if (G.audio) G.audio.tone(900 + i * 60, 0.08, 0.04, 'triangle'); }));
    this.later(step * (list.length + 1), () => { G.fx.beam(prev.clone(), this.hand(), hex, 0.08, 0.25); orb.life = 0; if (this.tool) this.tool.visible = true; });
  }
  nearest(n, range, from = G.player.pos, big = true) { return [...G.combat.targets].filter((x) => x.alive && (big || !x.big) && x.pos.distanceTo(from) < range).sort((a, b) => a.pos.distanceTo(from) - b.pos.distanceTo(from)).slice(0, n); }

  // ---- BRANN ------------------------------------------------------------------------------------------
  brannLight() { this.combo3({ anims: ['slash', 'slash2', 'heavy'], dmg: [16, 16, 25], knock: [5, 5, 11], range: 2.9, deg: 65, kind: 'shock', color: '#8fd3ff', wall: 1.1 }); }
  brannHeavy() { const p = G.player; this.faceAim(0.4); p.play('throw', 0.36); this.sound('zap'); this.throwBack({ range: 38, speed: 38, r: 0.3, color: '#cfe9ff', dmg: 26, knock: 9, kind: 'shock', power: 1.5, trail: '#8fd3ff' }); }
  brannP1() {
    const a = this.aim(90), at = a.point.clone(); G.player.play('raise', 0.4); this.faceAim(0.3);
    G.fx.ring(at, '#8fd3ff', 3, 0.4, 0.35);
    this.later(0.35, () => { if (G.env.strike) G.env.strike(at); G.fx.bolt(at.clone().setY(at.y + 45), at, '#ffffff', 0.22, 0.3, 4); G.fx.bolt(at.clone().setY(at.y + 45), at, '#8fd3ff', 0.12, 0.3, 5); this.ball(at, 4.5, { dmg: 45, knock: 9, up: 5, kind: 'shock', color: '#8fd3ff', from: at }); G.damage.burst(at, 4.5, 2.5, 'shock', { byHero: true }); G.fx.ring(at, '#cfe9ff', 0.5, 7, 0.4); G.fx.shake(0.4); this.sound('boom'); });
  }
  // hammer flight: the hammer whirls overhead and pulls him through the air for 2.4 s, steered with the
  // camera (Space lifts), crackling with lightning and hitting anyone in the way; he flies on when it ends
  brannP2() {
    const a = this.aim(80), p = G.player, dir = this.dirFrom(this.chest(), a); dir.y = Math.max(dir.y, 0.2); dir.normalize();
    const tool = this.tool;
    this.startMove('dash', { dir, speed: 34, T: 2.4, steer: true, keep: 0.6, done: new Set(), anim: 'raise', hit: { dmg: 15, knock: 8, kind: 'shock', color: '#8fd3ff' }, r: 1.3,
      spin: (dt) => { if (tool) tool.rotation.y += dt * 28; if (this.mv) this.mv.speed = Math.min(46, this.mv.speed + dt * 8); },
      trail: (x, y) => { G.fx.spark(y.clone().setY(y.y + 2.2), '#8fd3ff', 3, 3, 0.3, 0.1); if (Math.random() < 0.25) G.fx.bolt(y.clone().setY(y.y + 2.4), y.clone().set(y.x - (y.x - x.x) * 6 + (Math.random() - 0.5) * 2, y.y + 1 + Math.random() * 2, y.z - (y.z - x.z) * 6 + (Math.random() - 0.5) * 2), '#cfe9ff', 0.04, 0.15); },
      onEnd: () => { if (tool) tool.rotation.y = 0; } });
    p.play('raise', 2.4); this.sound('zap');
  }
  brannP3() { const c = this.centre(); G.player.play('smash', 0.4); this.later(0.12, () => { this.ball(c, 7, { dmg: 22, knock: 15, up: 5, kind: 'shock', color: '#8fd3ff' }); G.fx.ring(c, '#8fd3ff', 0.5, 9, 0.5); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; G.fx.bolt(c, V().set(c.x + Math.cos(a) * 6, c.y, c.z + Math.sin(a) * 6), '#cfe9ff', 0.06, 0.25); } G.fx.shake(0.3); this.sound('boom'); }); }
  brannUlt() { this.ult = 10; this.stormT = 0; G.ui.flash('STORM', 1.4); if (G.env.strike) G.env.strike(this.centre()); }

  // ---- BULWARK ----------------------------------------------------------------------------------------
  bulwarkLight() { this.combo3({ anims: ['punchR', 'punchL', 'heavy'], dmg: [18, 18, 28], knock: [7, 7, 14], range: 3.0, deg: 60, wall: 1.5 }); }
  bulwarkHeavy() { const p = G.player; p.play('groundpound', 0.48); this.later(0.16, () => { const c = this.centre(); c.y = p.pos.y + 0.3; this.ball(c, 5, { dmg: 30, knock: 12, up: 6 }); G.damage.impact(V().set(c.x, p.pos.y, c.z), V().set(0, 1, 0), 3, 'blunt', { byHero: true }); G.fx.ring(c, '#ffb347', 0.5, 6, 0.4); G.fx.dust(c, 22, 2); G.fx.shake(0.45); this.sound('boom'); }); }
  bulwarkP1() {
    // a huge jump to the crosshair, up to 80 m: the longer the jump, the higher and longer the arc
    const p = G.player, a = this.aim(80), to = a.point.clone(), g = 22 * (p.gravK || 1);
    if (!p.grounded) return false;
    const dx = to.x - p.pos.x, dz = to.z - p.pos.z, dy = to.y - p.pos.y, T = clamp(Math.hypot(dx, dz) / 40, 0.9, 1.8);
    p.vel.set(dx / T, (dy + 0.5 * g * T * T) / T, dz / T); p.grounded = false; p.fling = 'leap'; p.play('air', T); this.leap = { t: 0 };   // fling: the air does not slow the jump; 'leap': he lands in a crater, not a roll this.faceAim(0.4); this.sound('swish');
    const c = V().set(p.pos.x, p.pos.y + 0.1, p.pos.z); G.fx.dust(c, 20, 2); G.fx.ring(c, '#ffb347', 0.5, 5, 0.4); G.damage.impact(c.clone(), V().set(0, 1, 0), 2, 'blunt', { byHero: true, quiet: true }); G.fx.shake(0.3);   // the street cracks under the push-off
  }
  bulwarkP2() { const p = G.player; this.faceAim(0.4); p.play('beam', 0.38); this.later(0.12, () => { const c = this.chest(), f = this.fwd(V(), 0.3); this.cone(12, 30, { dmg: 25, knock: 18, up: 3 }, c, f); G.fx.ring(c.clone().addScaledVector(f, 1), '#ffffff', 0.3, 4, 0.3, f); G.fx.spray(c, f, '#c8c2b4', 20, 18, 0.5, 0.6, 0.6, 1.8, 0, true); G.damage.wallHit(c, f, 12, 2, 'blunt', { byHero: true }); G.fx.shake(0.3); this.sound('boom'); }); }
  bulwarkP3() {
    const p = G.player, tg = this.nearest(1, 4.5, p.pos, false)[0];
    if (!tg) { G.ui.toast('Nothing close enough to grab.', 'info'); return false; }
    tg.stun = Math.max(tg.stun || 0, 1.5); p.play('raise', 0.45); this.faceAim(0.5);
    this.later(0.4, () => { const a = this.aim(30), f = this.dirFrom(this.chest(), a); p.play('throw', 0.36); tg.hit(25 * this.dmgMul, f.clone().setY(0).normalize(), { knock: 26, up: 6, byHero: true }); const land = this.chest().addScaledVector(f, 11); this.later(0.45, () => { land.y = G.colliders.groundAt(land.x, land.z, land.y + 3, 6, 0.3) + 0.5; this.ball(land, 3, { dmg: 30, knock: 10, up: 3 }); G.fx.dust(land, 14, 1.5); G.fx.ring(land, '#ffb347', 0.4, 4, 0.35); }); this.sound('swish'); });
  }
  bulwarkUlt() { G.player.play('roar', 0.9); this.ult = 15; this.rage = 100; this.applyStats(); G.ui.flash('RAMPAGE', 1.4); G.fx.ring(this.centre(), '#ffb347', 0.5, 8, 0.5); G.fx.shake(0.5); if (G.audio) G.audio.tone(80, 1.2, 0.14, 'sawtooth', null, 0.05, 0.6); }

  // ---- WARDEN -----------------------------------------------------------------------------------------
  wardenLight() { this.combo3({ anims: ['punchL', 'punchR', 'heavy'], dmg: [13, 13, 20], knock: [5, 5, 10], range: 2.6, deg: 60, wall: 0.9 }); }
  wardenHeavy() {
    const p = G.player; this.faceAim(0.4); p.play('throw', 0.34); this.sound('swish');
    const first = this.aim(30).target, list = [];
    let from = first && first.alive ? first : this.nearest(1, 25)[0]; while (from && list.length < 4) { list.push(from); from = [...G.combat.targets].filter((x) => x.alive && !list.includes(x) && x.pos.distanceTo(list[list.length - 1].pos) < 15).sort((a, b) => a.pos.distanceTo(list[list.length - 1].pos) - b.pos.distanceTo(list[list.length - 1].pos))[0]; }
    if (!list.length) return this.throwBack({ range: 30, speed: 34, r: 0.32, color: '#d8a65a', dmg: 22, knock: 8, kind: 'blunt', power: 1.2 });
    this.chain(list, 22, '#d8a65a');
  }
  wardenP1() { const p = G.player, a = this.aim(30), dir = V().subVectors(a.point, p.pos).setY(0).normalize(); this.block = Math.max(this.block, 0.6); this.startMove('dash', { dir, speed: 30, T: 0.4, done: new Set(), anim: 'charge', hit: { dmg: 22, knock: 13, up: 3 }, r: 1.4, onEnd: () => G.fx.ring(this.centre(), '#5fd6c2', 0.3, 3, 0.3) }); this.sound('swish'); }
  wardenP2() { this.block = 6; G.player.play('guard', 0.5); G.fx.ring(this.centre(), '#5fd6c2', 0.4, 2.2, 0.4); G.ui.flash('BLOCK', 0.8); }
  wardenP3() { const c = this.centre(); this.hp = Math.min(this.max, this.hp + 40); G.player.play('raise', 0.5); this.ball(c, 6, { dmg: 5, stun: 2.2, knock: 4 }); G.fx.ring(c, '#5fd6c2', 0.5, 7, 0.5); G.fx.spark(c, '#7dff9c', 20, 4, 0.6, 0.14, -1); G.ui.flash('RALLY', 0.9); this.sound('power'); }
  wardenUlt() {
    const list = this.nearest(8, 30); if (!list.length) { G.ui.toast('No villains within 30 m.', 'info'); return false; }
    const seq = []; for (let i = 0; i < 16; i++) seq.push(list[i % list.length]);
    G.ui.flash('RICOCHET', 1.2); G.player.play('throw', 0.42); this.chain(seq, 25, '#ffd08a', 0.18);
  }

  // ---- KITSU ------------------------------------------------------------------------------------------
  kitsuLight() { this.combo3({ anims: ['punchR', 'punchL', 'kick'], dmg: [10, 10, 15], knock: [3, 3, 7], range: 2.4, deg: 60, wall: 0.6 }); }
  kitsuHeavy() { const p = G.player; this.faceAim(0.3); p.play('spinkick', 0.42); this.later(0.1, () => { this.ball(this.centre(), 2.8, { dmg: 20, knock: 10, up: 3 }); G.fx.ring(this.centre(), '#59c8ff', 0.3, 3.2, 0.3); }); this.sound('swish'); }
  kitsuP1() {
    const p = G.player; this.faceAim(0.7); p.play('charge', 0.45); this.sound('power');
    const orb = G.fx.orb('#9fe6ff', 0.2);
    for (let i = 0; i < 8; i++) this.later(i * 0.04, () => { orb.p.copy(this.hand()); orb.r0 = orb.r1 = 0.2 + i * 0.015; G.fx.ring(orb.p, '#59c8ff', 0.1, 0.5, 0.2, new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize()); });
    this.later(0.34, () => {
      const a = this.aim(26), to = a.target ? G.combat.centre(a.target, V()) : a.point.clone(); to.y -= 1;
      const dir = V().subVectors(to, p.pos); const L = Math.min(Math.max(2, dir.length() - 1.2), 24); dir.normalize();
      this.startMove('dash', { dir, speed: 50, T: L / 50, done: new Set(), anim: 'castR', trail: () => { orb.p.copy(this.hand()); },
        onEnd: () => { orb.life = 0; const h = this.chest().addScaledVector(dir, 1.1); const n = this.ball(h, 1.8, { dmg: 70, knock: 18, up: 4, kind: 'shock', color: '#9fe6ff', max: 2 }); for (let k = 0; k < 4; k++) G.fx.ring(h, '#9fe6ff', 0.2, 2 + k, 0.3 + k * 0.08, dir); G.fx.spark(h, '#ffffff', 24, 9, 0.4, 0.14); G.fx.shake(0.35); this.sound('boom'); if (!n) G.damage.wallHit(this.chest(), dir, 2.5, 4, 'blunt', { byHero: true }); } });
    });
  }
  kitsuP2() {
    const p = G.player; p.play('cast', 0.4); G.ui.flash('CLONES', 0.8); this.clones = this.clones || [];
    for (let i = 0; i < 3; i++) {
      const rig = makeHumanoid({ ...DEFAULT_LOOK, ...this.H.look }), a = p.yaw + (i - 1) * 1.6, pos = V().set(p.pos.x + Math.sin(a) * 1.8, p.pos.y, p.pos.z + Math.cos(a) * 1.8);
      G.scene.add(rig.root); G.fx.smoke(pos.clone().setY(pos.y + 1), 4, '#e8eef4', 1.3, 1.5);
      this.clones.push({ rig, pos, yaw: p.yaw, t: 10, cool: 0.3 * i, target: null });
    }
    this.sound('swish');
  }
  kitsuP3() { const p = G.player, back = V().set(-Math.sin(p.yaw) * 4, 0, -Math.cos(p.yaw) * 4); G.fx.smoke(this.centre(), 5, '#e8eef4', 1.4, 1.2); p.pos.add(back); p.pos.y = G.colliders.groundAt(p.pos.x, p.pos.z, p.pos.y + 2, 2.5, 0.3); G.colliders.resolveCircle(p.pos, 0.34, p.pos.y + 0.55, p.pos.y + 1.7); this.dodge = 2; G.fx.smoke(this.centre(), 3, '#e8eef4', 1, 1); this.sound('swish'); }
  kitsuUlt() {
    const p = G.player; p.play('raise', 0.9); G.ui.flash('GREAT SPHERE', 1.2); const orb = G.fx.orb('#9fe6ff', 0.3);
    for (let i = 0; i < 16; i++) this.later(i * 0.05, () => { orb.p.copy(this.centre()).add(this.v.set(0, 1.6 + i * 0.03, 0)); orb.r0 = orb.r1 = 0.3 + i * 0.07; if (i % 3 === 0) G.fx.ring(orb.p, '#59c8ff', 0.3, 1.8 + i * 0.08, 0.3, new THREE.Vector3(Math.random() - 0.5, 1, Math.random() - 0.5).normalize()); });
    this.later(0.85, () => { orb.life = 0; const from = this.centre().add(this.v.set(0, 2.6, 0)), a = this.aim(90); p.play('castR', 0.3); this.shoot({ from, dir: this.dirFrom(from, a), speed: 30, r: 1.4, color: '#9fe6ff', dmg: 90, knock: 20, up: 6, kind: 'shock', blast: 9, power: 5, life: 3.5, trail: '#59c8ff' }); this.sound('boom'); });
  }

  // ---- TRINE ------------------------------------------------------------------------------------------
  trineLight() { this.combo3({ anims: ['slash', 'slash2', 'slash'], dmg: [14, 14, 21], knock: [3, 3, 8], range: 3.0, deg: 85, kind: 'cut', color: '#ff6f8a', arc: true, wall: 0.8 }); }
  trineHeavy() { const p = G.player; p.play('spin', 0.6); this.sound('swish'); for (let i = 0; i < 3; i++) this.later(0.08 + i * 0.16, () => { this.ball(this.centre(), 3.6, { dmg: 11, knock: 4 + i * 3, up: i === 2 ? 4 : 0, kind: 'cut', color: '#ff6f8a', civ: i === 2 }); G.fx.ring(this.centre(), '#ff6f8a', 0.5, 3.8, 0.25); }); }
  wave(dir, from, dmg = 30, color = '#ff9ab0') {
    const pr = this.shoot({ from, dir, speed: 46, r: 0.5, color, dmg, knock: 7, kind: 'cut', pierce: true, done: new Set(), life: 1.1, power: 1.2 });
    const side = V().crossVectors(dir, UP).normalize();
    for (let i = 0; i < 22; i++) this.later(i * 0.05, () => { if (!this.proj.includes(pr)) return; G.fx.beam(pr.pos.clone().addScaledVector(side, -1.3), pr.pos.clone().addScaledVector(side, 1.3), color, 0.06, 0.06); });
  }
  trineP1() { const p = G.player, a = this.aim(60), h = this.chest(); this.faceAim(0.4); p.play('slash2', 0.3); this.wave(this.dirFrom(h, a), h, 32); this.sound('zap'); }
  trineP2() {
    const list = this.nearest(3, 22, G.player.pos, false); if (!list.length) { G.ui.toast('No villains close enough.', 'info'); return false; }
    const go = (i) => { if (i >= list.length) return; const tg = list[i], p = G.player; if (!tg.alive) return go(i + 1); const dir = V().subVectors(tg.pos, p.pos).setY(0); const L = dir.length() + 1.5; dir.normalize();
      this.startMove('dash', { dir, speed: 55, T: Math.min(0.6, L / 55), done: new Set(), anim: 'slash', hit: { dmg: 34, knock: 6, kind: 'cut', color: '#ff6f8a' }, r: 1.3, trail: (x, y) => G.fx.beam(x.clone().setY(x.y + 1), y.clone().setY(y.y + 1), '#ff6f8a', 0.08, 0.25), onEnd: () => this.later(0.08, () => go(i + 1)) }); };
    go(0); this.sound('zap');
  }
  trineP3() { this.counter = 1.5; G.player.play('guard', 1.5); G.fx.ring(this.centre(), '#ff6f8a', 0.3, 1.8, 0.4); }
  trineUlt() { const p = G.player, a = this.aim(60), h = this.chest(), d0 = this.dirFrom(h, a); G.ui.flash('NINE BLADES', 1.2); p.play('spin', 0.7); for (let i = 0; i < 9; i++) this.later(i * 0.05, () => { const ang = (i - 4) * 0.16, d = V().set(d0.x * Math.cos(ang) - d0.z * Math.sin(ang), d0.y, d0.x * Math.sin(ang) + d0.z * Math.cos(ang)).normalize(); this.wave(d, this.chest(), 36, i % 2 ? '#ff6f8a' : '#ffffff'); }); this.sound('zap'); }

  // ---- EMBER ------------------------------------------------------------------------------------------
  emberLight() { this.combo3({ anims: ['punchR', 'punchL', 'heavy'], dmg: [13, 13, 19], knock: [4, 4, 9], range: 2.6, deg: 55, kind: 'fire', color: '#ff7a1a', wall: 0.8 }); }
  emberHeavy() { const p = G.player, a = this.aim(70), h = this.hand(); this.faceAim(0.4); p.play('heavy', 0.3); this.shoot({ from: h, dir: this.dirFrom(h, a), speed: 44, r: 0.55, color: '#ff8a3c', dmg: 32, knock: 10, kind: 'fire', blast: 3, power: 2, life: 1.8, trail: '#ff7a1a' }); this.sound('fire'); }
  emberP1() { const p = G.player, a = this.aim(30), dir = V().subVectors(a.point, p.pos).setY(0).normalize(); this.patches = this.patches || [];
    this.startMove('dash', { dir, speed: 42, T: 0.34, done: new Set(), anim: 'dash', hit: { dmg: 20, knock: 7, kind: 'fire', color: '#ff7a1a' }, r: 1.4, trail: (x, y) => { this.patches.push({ p: y.clone(), t: 4, k: 0.3, r: 1.5 }); G.fx.fire(y, 4, 1); } }); this.sound('fire'); }
  emberP2() { const p = G.player; p.play('smash', 0.5); this.patches = this.patches || []; for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283, q = V().set(p.pos.x + Math.cos(a) * 4, p.pos.y, p.pos.z + Math.sin(a) * 4); q.y = G.colliders.groundAt(q.x, q.z, q.y + 2, 3, 0.3); this.patches.push({ p: q, t: 4, k: 0.1, r: 1.7, pillar: true }); } G.fx.ring(this.centre(), '#ff7a1a', 0.5, 5, 0.4); this.sound('fire'); }
  emberP3() { this.flame = 6; G.ui.flash('FLAME BODY', 0.9); G.fx.blast(this.centre(), '#ff7a1a', 0.5, 2.5, 0.3); this.sound('fire'); }
  emberUlt() {
    const a = this.aim(90), at = a.point.clone(), p = G.player; p.play('raise', 1.2); G.ui.flash('METEOR', 1.2);
    const orb = G.fx.orb('#ff6a1a', 2.5), top = at.clone().add(this.v.set(-10, 55, -6));
    for (let i = 0; i <= 24; i++) this.later(i * 0.05, () => { const u = i / 24; orb.p.copy(top).lerp(at, u); orb.r0 = orb.r1 = 2.5 + u * 1.5; G.fx.spray(orb.p, V().set(0.2, 1, 0.1).normalize(), '#ffc23d', 6, 6, 0.6, 0.5, 1.2, 0.2, -1); });
    this.later(1.25, () => { orb.life = 0; this.ball(at, 12, { dmg: 100, knock: 20, up: 8, kind: 'fire', color: '#ff7a1a', from: at }); G.damage.burst(at, 12, 6, 'fire', { byHero: true }); G.fx.blast(at, '#ff8a3c', 1, 12, 0.7); G.fx.ring(at, '#ffc23d', 1, 16, 0.8); G.fx.dust(at, 40, 4); G.fx.shake(1); this.sound('boom'); this.patches = this.patches || []; for (let k = 0; k < 6; k++) { const q = at.clone().add(this.v.set((Math.random() - 0.5) * 12, 0, (Math.random() - 0.5) * 12)); this.patches.push({ p: q, t: 5, k: 0.2, r: 2 }); } });
  }

  // ---- shared: trails, the camera kick, the launcher and air combos ----------------------------------
  // a glowing trail behind a fist (R, L), the right foot (F) or the blade (B) for a moment
  trail(part, hex, secs = 0.22, w = 0.07) {
    const r = G.player.rig; if (!r || !G.fx.trail) return;
    G.fx.trail((out) => { r.root.updateMatrixWorld(true); return part === 'L' ? r.elbL.localToWorld(out.set(0, -0.38, 0.03)) : part === 'F' ? r.kneeR.localToWorld(out.set(0, -0.5, 0.08)) : part === 'B' ? r.elbR.localToWorld(out.set(0, -0.95, 0.12)) : r.elbR.localToWorld(out.set(0, -0.38, 0.03)); }, hex, secs, w);
  }
  kick(k) { this.punchKick = Math.min(9, (this.punchKick || 0) + k); }   // the view widens for a moment on a big hit
  launcher() {
    const p = G.player, c = this.H.color, t = this.nearest(1, 6.5).find((q) => !q.flying);
    if (t) { const dx = t.pos.x - p.pos.x, dz = t.pos.z - p.pos.z, d = Math.hypot(dx, dz) || 1; if (d > 1.7) { p.pos.x += dx / d * (d - 1.6); p.pos.z += dz / d * (d - 1.6); } p.yaw = Math.atan2(dx, dz); p.aimT = 0.4; }   // step in to the nearest enemy first
    else this.faceAim(0.4);
    p.play('uppercut', 0.42); this.trail('R', c, 0.32, 0.1); this.sound('swish'); this.launchReady = 0; this.cool('heavy', 0.7);
    this.later(0.13, () => {
      const n = this.cone(4.6, 80, { dmg: 22, knock: 2, up: 13, stun: 1.4, kind: 'blunt', color: c });   // reaches an enemy the third hit knocked back G.fx.ring(this.centre(), c, 0.3, 3, 0.3);
      if (n) { this.kick(4); G.ui.flash('LAUNCH', 0.5); p.vel.y = 10.5; p.grounded = false; this.airCombo = G.elapsed + 1.8; this.airHits = 0; }
    });
  }
  airHit() {
    const p = G.player, c = this.H.color, k = this.airHits++; this.faceAim(0.3); this.cool('light', 0.2);
    if (k < 2) { p.play(k ? 'kick' : 'punchR', 0.22); this.trail(k ? 'F' : 'R', c); p.vel.y = Math.max(p.vel.y, 2.4); this.later(0.07, () => this.cone(3.4, 80, { dmg: 14, knock: 2, up: 3.2, stun: 0.8, kind: 'blunt', color: c })); this.airCombo = G.elapsed + 1.2; }
    else { p.play('dropkick', 0.36); this.trail('F', c, 0.36, 0.11); this.later(0.08, () => { const n = this.cone(3.7, 90, { dmg: 30, knock: 12, kind: 'blunt', color: c }); if (n) { this.kick(5); G.fx.shake(0.2); G.ui.flash('SPIKE', 0.5); } p.vel.y = -14; }); this.airCombo = 0; }
    this.sound('swish');
  }
  // ---- key 5: one more skill for every hero ------------------------------------------------------------
  strandP5() {   // web mine: a sticky ball on the ground that bursts when a villain comes near
    const p = G.player, at = this.aim(30).point.clone(); this.faceAim(0.3); p.play('castR', 0.3); this.sound('thwip');
    const orb = G.fx.orb('#e8fbff', 0.32); orb.p.copy(this.hand()); const from = orb.p.clone();
    for (let i = 1; i <= 8; i++) this.later(i * 0.03, () => orb.p.copy(from).lerp(at, i / 8));
    this.later(0.26, () => { this.mines = this.mines || []; this.mines.push({ p: at, t: 14, arm: 0.7, orb, color: '#e8fbff', r: 4.2, o: { dmg: 18, stun: 3, knock: 2, kind: 'web', color: '#e8fbff' } }); G.fx.ring(at, '#e8fbff', 0.2, 1.2, 0.3); });
  }
  forgeP5() {   // drone turret: hovers where you put it for 10 s and fires at the nearest villain
    const p = G.player, at = V().set(p.pos.x + Math.sin(p.yaw) * 1.6, p.pos.y + 2.6, p.pos.z + Math.cos(p.yaw) * 1.6); p.play('castR', 0.3); this.sound('power');
    const orb = G.fx.orb('#59e0ff', 0.34); orb.p.copy(at); this.turrets = this.turrets || []; this.turrets.push({ p: at, base: at.y, t: 10, cool: 0.5, orb }); G.fx.ring(at, '#59e0ff', 0.2, 1.4, 0.3);
  }
  raikoP5() {   // lightning cage: six posts of lightning round the spot you aim at; anyone inside is shocked and held
    const at = this.aim(40).point.clone(); this.faceAim(0.3); G.player.play('castR', 0.35); this.sound('zap');
    this.cages = this.cages || []; this.cages.push({ p: at, t: 4, tick: 0, r: 5.5 }); G.fx.ring(at, '#a78bff', 5.5, 5.5, 4, null, true); G.fx.bolt(V().set(at.x, at.y + 30, at.z), at, '#ffffff', 0.12, 0.25, 2);
  }
  sableP5() { this.mirror = 3; this.mirrorDmg = 0; G.player.play('guard', 0.6); G.ui.flash('MIRROR', 0.7); G.fx.ring(this.centre(), '#ff5a6e', 0.3, 2.5, 0.4); this.sound('shield'); }   // mirror guard: soak 3 s of hits, then throw them all back
  rookP5() { this.mirror = 3; this.mirrorDmg = 0; G.player.play('flex', 0.6); G.ui.flash('BOUNCE', 0.7); G.fx.ring(this.centre(), '#ffd34d', 0.3, 2.5, 0.4); this.sound('boing'); }   // rubber guard: every hit for 3 s bounces back, harder
  brannP5() {   // hammer chain: the hammer flies to the spot you aim at and drags every villain near it in
    const p = G.player, at = this.aim(40).point.clone(); this.faceAim(0.3); p.play('throw', 0.4); this.sound('zap');
    const orb = G.fx.orb('#8fd3ff', 0.4); orb.p.copy(this.hand()); const from = orb.p.clone();
    for (let i = 1; i <= 10; i++) this.later(0.1 + i * 0.025, () => orb.p.copy(from).lerp(at, i / 10));
    this.later(0.38, () => {
      orb.life = 0; G.fx.ring(at, '#8fd3ff', 0.4, 7, 0.45); G.fx.bolt(V().set(at.x, at.y + 25, at.z), at, '#ffffff', 0.1, 0.2);
      for (const t of G.combat.targets) { if (!t.alive || t.team !== 'villain' || !t.pos) continue; const d = Math.hypot(t.pos.x - at.x, t.pos.z - at.z); if (d > 7.5) continue; const dir = V().set(at.x - t.pos.x, 0, at.z - t.pos.z).normalize(); if (!t.big && t.vel) { t.vel.x += dir.x * Math.min(16, d * 3); t.vel.z += dir.z * Math.min(16, d * 3); } G.combat.hitTarget(t, dir, { dmg: 16, stun: 1.5, knock: 0, kind: 'shock', color: '#8fd3ff', byHero: true }); G.fx.bolt(at.clone().setY(at.y + 1), G.combat.centre(t, V()), '#8fd3ff', 0.06, 0.2); }
    });
  }
  bulwarkP5() {   // car toss: tear up the nearest vehicle and throw it where you aim (or a slab of street, with none near)
    const p = G.player, c = this.centre(), W = G.wrecks; let car = null, bd = 9;
    if (W) for (const s of W.live()) { if (s.dead || s.burning) continue; const d = Math.hypot(s.x - p.pos.x, s.z - p.pos.z); if (d < bd) { bd = d; car = s; } }
    this.faceAim(0.8); p.play('raise', 0.45); this.sound('slam');
    this.later(0.42, () => {
      const a = this.aim(70), dir = V().subVectors(a.point, c).normalize(); p.play('throw', 0.4); G.fx.shake(0.15);
      if (car && W.throwVehicle(car, V().set(p.pos.x, p.pos.y + 3.2, p.pos.z), V().set(dir.x * 26, Math.max(4, dir.y * 26 + 5), dir.z * 26), { byHero: true })) { G.ui.flash('CAR TOSS', 0.7); return; }
      const from = V().set(p.pos.x, p.pos.y + 2.8, p.pos.z); G.damage.impact(V().set(p.pos.x, p.pos.y, p.pos.z), V().set(0, 1, 0), 2.5, 'blunt', { byHero: true });
      this.shoot({ from, dir: V().set(dir.x, dir.y + 0.15, dir.z).normalize(), speed: 30, r: 0.7, color: '#9a958b', dmg: 34, knock: 12, up: 4, blast: 3.5, power: 2.5, kind: 'blunt', grav: 9, life: 3 });
    });
  }
  wardenP5() {   // shield wall: a wall of light in front of you for 8 s that stops shots
    const p = G.player, f = V().set(Math.sin(p.yaw), 0, Math.cos(p.yaw)), c = V().set(p.pos.x + f.x * 3, p.pos.y, p.pos.z + f.z * 3); p.play('guard', 0.5); this.sound('shield');
    const m = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 0.2), new THREE.MeshBasicMaterial({ color: new THREE.Color('#59e0ff').multiplyScalar(1.1), transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.position.set(c.x, c.y + 1.5, c.z); m.rotation.y = p.yaw; G.scene.add(m); (this.walls = this.walls || []).push({ m, t: 8 }); G.fx.ring(c, '#59e0ff', 0.4, 3.5, 0.4);
    const side = V().set(f.z, 0, -f.x); for (const k of [-2, 0, 2]) for (const h of [0.8, 2.2]) G.villains.eraseNear(V().set(c.x + side.x * k, c.y + h, c.z + side.z * k), 1.5, 8);
  }
  kitsuP5() {   // shadow swap: trade places with a clone (the one nearest where you aim), or vanish and come out behind the nearest villain
    const p = G.player, a = this.aim(40), cl = (this.clones || []).filter((q) => q.t > 0).sort((x, y) => x.pos.distanceTo(a.point) - y.pos.distanceTo(a.point))[0];
    G.fx.smoke(V().set(p.pos.x, p.pos.y + 1, p.pos.z), 6, '#e8eef4', 1.5, 1.4); this.sound('swish');
    if (cl) { const here = p.pos.clone(); p.pos.copy(cl.pos); cl.pos.copy(here); G.fx.smoke(V().set(p.pos.x, p.pos.y + 1, p.pos.z), 5, '#e8eef4', 1.4, 1.3); return; }
    const t = this.nearest(1, 18)[0]; if (!t) { const d = V().subVectors(a.point, p.pos).setY(0); if (d.length() > 10) d.setLength(10); p.pos.add(d); return; }
    const dir = V().set(t.pos.x - p.pos.x, 0, t.pos.z - p.pos.z).normalize(); p.pos.set(t.pos.x + dir.x * 1.6, Math.max(p.pos.y, t.pos.y), t.pos.z + dir.z * 1.6); p.yaw = p.camYaw = Math.atan2(-dir.x, -dir.z);
    p.play('dashstab', 0.3); this.later(0.06, () => { G.combat.hitTarget(t, V().copy(dir).negate(), { dmg: 28, stun: 1, knock: 6, kind: 'cut', color: '#59c8ff', byHero: true }); this.trail('R', '#59c8ff', 0.2, 0.08); });
  }
  trineP5() {   // whirlwind: 2 s spinning in place, dragging everyone within 9 m into the blades
    G.player.play('spin', 2); this.sound('swish');
    this.startChannel(2, 0.2, () => {
      const c = this.centre(); for (const t of G.combat.targets) { if (!t.alive || t.team !== 'villain' || t.big || !t.vel) continue; const dx = c.x - t.pos.x, dz = c.z - t.pos.z, d = Math.hypot(dx, dz); if (d < 9 && d > 1.5) { t.vel.x += dx / d * 5; t.vel.z += dz / d * 5; } }
      this.ball(c, 3.4, { dmg: 7, knock: 0, kind: 'cut', color: '#ff9ab0', civ: false }); this.arc('#ff9ab0', 1, 3.2); this.arc('#ffffff', -1, 2.4);
    }, { slow: 0.5 });
  }
  emberP5() {   // wall of fire: a line of flames across your aim, 12 m long, for 6 s
    const p = G.player, a = this.aim(30), f = V().set(Math.sin(p.yaw), 0, Math.cos(p.yaw)), c = V().set(p.pos.x + f.x * 7, p.pos.y, p.pos.z + f.z * 7), side = V().set(f.z, 0, -f.x); void a;
    this.faceAim(0.3); p.play('cast', 0.4); this.sound('fire'); this.patches = this.patches || [];
    for (let k = -5; k <= 5; k++) { const q = V().set(c.x + side.x * k * 1.2, c.y, c.z + side.z * k * 1.2); q.y = G.colliders.groundAt(q.x, q.z, q.y + 2, 3, 0.3); this.later(Math.abs(k) * 0.04, () => { this.patches.push({ p: q, t: 6, k: 0.3, r: 1.4 }); G.fx.fire(q, 6, 1.2); }); }
  }
  // the key-5 things that last: mines, turrets, cages, walls, the mirror
  extras(dt, t) {
    if (this.mines) for (let i = this.mines.length - 1; i >= 0; i--) {
      const m = this.mines[i]; m.t -= dt; m.arm -= dt; m.orb.r0 = m.orb.r1 = 0.3 + Math.sin(t * 8) * 0.05;
      const near = m.arm <= 0 && [...G.combat.targets].some((q) => q.alive && q.team === 'villain' && q.pos && q.pos.distanceTo(m.p) < 2.6);
      if (near || m.t <= 0) { m.orb.life = 0; this.mines.splice(i, 1); this.ball(m.p, m.r, { ...m.o, civ: false }); G.fx.ring(m.p, m.color, 0.3, m.r + 1, 0.4); G.fx.spark(m.p, m.color, 20, 6, 0.5, 0.15); this.sound('splat'); }
    }
    if (this.turrets) for (let i = this.turrets.length - 1; i >= 0; i--) {
      const u = this.turrets[i]; u.t -= dt; u.cool -= dt; u.p.y = u.base + Math.sin(t * 3 + i) * 0.15; u.orb.p.copy(u.p);
      if (u.cool <= 0) { u.cool = 0.45; const tg = this.nearest(1, 26, u.p)[0]; if (tg) { const c = G.combat.centre(tg, V()); this.shoot({ from: u.p.clone(), dir: V().subVectors(c, u.p).normalize(), speed: 60, r: 0.12, color: '#ffb347', dmg: 8, knock: 1.5, kind: 'energy', life: 1 }); G.fx.ring(u.p, '#59e0ff', 0.1, 0.6, 0.15); } }
      if (u.t <= 0) { u.orb.life = 0; G.fx.spark(u.p, '#59e0ff', 10, 4, 0.4, 0.1); this.turrets.splice(i, 1); }
    }
    if (this.cages) for (let i = this.cages.length - 1; i >= 0; i--) {
      const g = this.cages[i]; g.t -= dt; g.tick -= dt;
      if (g.tick <= 0) { g.tick = 0.35; const posts = [0, 1, 2, 3, 4, 5].map((k) => V().set(g.p.x + Math.cos(k * 1.047 + t) * g.r, g.p.y + 1.5, g.p.z + Math.sin(k * 1.047 + t) * g.r)); for (let k = 0; k < 6; k++) G.fx.bolt(posts[k], posts[(k + 1) % 6], '#c9b8ff', 0.05, 0.3, 0.8); this.ball(g.p, g.r, { dmg: 5, stun: 0.6, knock: 0, kind: 'shock', color: '#a78bff', civ: false }); }
      if (g.t <= 0) this.cages.splice(i, 1);
    }
    if (this.walls) for (let i = this.walls.length - 1; i >= 0; i--) { const w = this.walls[i]; w.t -= dt; w.m.material.opacity = 0.22 + Math.sin(t * 6) * 0.06 + (w.t < 1 ? (w.t - 1) * 0.2 : 0); if (w.t <= 0) { w.m.removeFromParent(); w.m.geometry.dispose(); this.walls.splice(i, 1); } }
    if (this.mirror > 0) {
      this.mirror -= dt; if (Math.random() < dt * 12) G.fx.ring(this.centre(), this.id === 'rook' ? '#ffd34d' : '#ff5a6e', 1.2, 1.4, 0.15);
      if (this.mirror <= 0 && this.id === 'sable') {   // everything soaked up goes back: a bolt to each one who hit her, and a burst round her
        const got = this.mirrorDmg || 0, src = [...(this.mirrorSrc || [])].filter((q) => q.alive); this.mirrorSrc = null;
        if (got > 0) { const c = this.centre(); this.ball(c, 6, { dmg: 20 + got, knock: 12, up: 4, kind: 'shock', color: '#ff5a6e' }); G.fx.blast(c, '#ff5a6e', 0.5, 6, 0.4); G.ui.flash('RETURNED', 0.7); this.kick(4);
          for (const q of src) { const qc = G.combat.centre(q, V()); G.fx.bolt(c.clone(), qc, '#ff5a6e', 0.09, 0.3); G.combat.hitTarget(q, V().subVectors(qc, c).setY(0).normalize(), { dmg: 15 + got * 1.5 / src.length, knock: 10, up: 3, stun: 1, kind: 'shock', color: '#ff5a6e', byHero: true }); } }
      }
    }
  }
  clearExtras() {
    for (const m of this.mines || []) m.orb.life = 0; for (const u of this.turrets || []) u.orb.life = 0; for (const w of this.walls || []) w.m.removeFromParent();
    this.mines = []; this.turrets = []; this.cages = []; this.walls = []; this.mirror = 0;
  }
  signature() {
    if (this.forms.active) return;
    if (this.level() < 4) { if (!(this.cd.sigMsg > 0)) { G.ui.toast(`${this.H.name}'s signature move unlocks at level 4 (now level ${this.level()}).`, 'info'); this.cd.sigMsg = 3; } return; }
    if (!this.ready('sig')) return;
    const [name, kind, o] = SIG[this.id], p = G.player, c = this.centre(); this.cool('sig', 14); G.ui.flash(name.toUpperCase(), 1.1); this.sound('power');
    if (kind === 'nova') { p.play(o.quake ? 'slam' : 'raise', 0.5); this.later(0.2, () => { const cc = this.centre(); this.ball(cc, o.r, { dmg: o.dmg, stun: o.stun, knock: o.knock || 10, up: o.up || 4, kind: o.kind || 'blunt', color: o.color }); G.fx.ring(cc, o.color, 0.5, o.r + 2, 0.5); G.fx.ring(cc, '#ffffff', 0.5, o.r, 0.4); if (o.quake) { G.damage.impact(V().set(cc.x, p.pos.y, cc.z), V().set(0, 1, 0), 5, 'blunt', { byHero: true }); G.fx.dust(cc, 36, 4); G.fx.shake(0.8); } if (o.block) this.block = o.block; if (o.fire) { this.patches = this.patches || []; for (let k = 0; k < 10; k++) { const a = k / 10 * 6.283; this.patches.push({ p: V().set(cc.x + Math.cos(a) * 5, p.pos.y, cc.z + Math.sin(a) * 5), t: 3, k: 0.1, r: 1.8, pillar: true }); } } }); }
    else if (kind === 'sky') { const list = this.nearest(o.n, 40); for (let k = 0; k < o.n; k++) this.later(0.1 + k * 0.15, () => { const t = list[k % Math.max(1, list.length)], at = t && t.alive ? G.combat.centre(t, V()) : V().set(p.pos.x + (Math.random() - 0.5) * 24, p.pos.y, p.pos.z + (Math.random() - 0.5) * 24); G.fx.beam(at.clone().setY(at.y + 60), at, o.color, 0.6, 0.25); G.fx.bolt(at.clone().setY(at.y + 50), at, '#ffffff', 0.08, 0.2, 3); this.ball(at, o.r, { dmg: o.dmg, knock: 8, up: 4, kind: 'shock', color: o.color, from: at }); G.damage.burst(at, o.r, 2, 'energy', { byHero: true }); G.fx.ring(at, o.color, 0.3, o.r * 1.6, 0.35); }); }
    else if (kind === 'leap') { p.vel.y = 18; p.grounded = false; this.later(0.25, () => { this.leap = { t: 0 }; this.sigLeap = o; }); }
    else if (kind === 'clones') { const n0 = this.H; for (let k = 0; k < o.n; k++) { const rig = makeHumanoid({ ...DEFAULT_LOOK, ...n0.look }), a = k / o.n * 6.283, pos = V().set(p.pos.x + Math.cos(a) * 2, p.pos.y, p.pos.z + Math.sin(a) * 2); G.scene.add(rig.root); G.fx.smoke(pos.clone().setY(pos.y + 1), 3, '#e8eef4', 1.2, 1.2); (this.clones = this.clones || []).push({ rig, pos, yaw: 0, t: o.t, cool: k * 0.1, target: null }); } }
    else if (kind === 'dash') { const a = this.aim(o.dist), dir = V().subVectors(a.point, p.pos).setY(0).normalize(); this.startMove('dash', { dir, speed: 70, T: o.dist / 70, done: new Set(), anim: 'slash', hit: { dmg: o.dmg, knock: 12, up: 5, kind: 'cut', color: o.color }, r: 2, trail: (x, y) => { G.fx.beam(x.clone().setY(x.y + 1), y.clone().setY(y.y + 1), o.color, 0.3, 0.4); G.fx.beam(x.clone().setY(x.y + 1.2), y.clone().setY(y.y + 1.2), '#ffffff', 0.08, 0.4); } }); }
  }
  // C: a dodge roll the way you are moving (backwards if standing still), untouchable for a moment
  roll(inp) {
    if (!this.ready('roll')) return; this.cd.roll = 0.8;
    const p = G.player, cy = p.camYaw, mz = (inp.down('KeyW') ? 1 : 0) - (inp.down('KeyS') ? 1 : 0), mx = (inp.down('KeyD') ? 1 : 0) - (inp.down('KeyA') ? 1 : 0);
    let dx = Math.sin(cy) * mz - Math.cos(cy) * mx, dz = Math.cos(cy) * mz + Math.sin(cy) * mx; if (!mz && !mx) { dx = -Math.sin(p.yaw); dz = -Math.cos(p.yaw); }
    const l = Math.hypot(dx, dz) || 1; this.dodge = Math.max(this.dodge, 0.4);
    this.startMove('dash', { dir: V().set(dx / l, 0, dz / l), speed: 15, T: 0.3, anim: 'crouch' }); G.fx.dust(p.pos, 6, 0.8); this.sound('swish');
  }
  // ---- the partner: G swaps heroes mid-fight; R with both meters full is a team strike -------------------
  swap() {
    if (this.forms.active) return;
    if (!this.partner) { if (!(this.cd.swapMsg > 0)) { G.ui.toast('No partner yet: choose one at the Hero Hall (Partner).', 'info'); this.cd.swapMsg = 3; } return; }
    if (!this.ready('swap') || this.mv || this.channel) return;
    if (!this.unlocked(this.partner)) { G.ui.toast(`${HEROES[this.partner].name} is locked. ${this.lockText(this.partner)}.`, 'warn'); return; }
    const was = this.id; this.become(this.partner, { swap: true }); this.partner = was; this.cd.swap = 3;
  }
  teamStrike() {
    const p = G.player, A = this.H, B = HEROES[this.partner]; G.ui.flash(`TEAM STRIKE: ${A.name.toUpperCase()} + ${B.name.toUpperCase()}`, 1.6); this.sound('power');
    const ghost = makeHumanoid({ ...DEFAULT_LOOK, ...B.look }); ghost.root.position.set(p.pos.x + Math.cos(p.yaw) * 1.5, p.pos.y, p.pos.z - Math.sin(p.yaw) * 1.5); ghost.root.rotation.y = p.yaw; G.scene.add(ghost.root); animateRig(ghost, 0.5, 'raise', 0);
    p.play('raise', 0.9); G.fx.smoke(ghost.root.position.clone().setY(p.pos.y + 1), 4, B.color, 1.2, 1);
    for (let k = 0; k < 6; k++) this.later(k * 0.1, () => { G.fx.ring(this.centre(), k % 2 ? A.color : B.color, 0.5, 3 + k * 2, 0.4); animateRig(ghost, 0.1, 'raise', 0); });
    this.later(0.75, () => { const c = this.centre(); this.ball(c, 15, { dmg: 120, knock: 20, up: 9, kind: 'shock', color: A.color }); G.damage.burst(c, 14, 5, 'energy', { byHero: true }); G.fx.blast(c, A.color, 1, 9, 0.6); G.fx.blast(c, B.color, 1, 12, 0.7); G.fx.shake(1); this.sound('boom'); G.fx.smoke(ghost.root.position.clone().setY(p.pos.y + 1), 5, B.color, 1.4, 1.2); ghost.root.removeFromParent(); });
    this.saved[this.partner].meter = 0;
  }
  // ---- hero missions: The Three Storms -----------------------------------------------------------------------
  mission() { const k = this.st.hm || 0; return this.st.hmOn && k < MISSIONS.length ? MISSIONS[k] : null; }
  missionMenu() {
    const s = this.st, k = s.hm || 0;
    if (k >= MISSIONS.length) { G.ui.openMenu({ title: 'The Three Storms', who: 'Hero missions · complete', body: 'All five missions done. Commander Ilse Varga has your name on the Hall\'s wall: Guardian of Neo Central. Raids and boss fights go on.', options: [{ label: 'Back', onPick: () => this.menu() }] }); return; }
    const m = MISSIONS[k];
    G.ui.openMenu({ title: `Mission ${k + 1} of ${MISSIONS.length}: ${m.name}`, who: 'Commander Ilse Varga · Hero Hall', wide: true, html: `<p>"${m.brief}"</p><p style="color:var(--dim)">Goal: ${m.goal}. Reward ◈${m.pay}.</p>`,
      options: [s.hmOn ? { label: 'On it', onPick: () => {} } : { label: 'Take the mission', onPick: () => { s.hmOn = true; if (!this.on) G.ui.toast('Become a hero first: the Hall, Choose a hero.', 'info'); if (m.raid && G.villains && !G.villains.raid) G.villains.nextRaid = Math.min(G.villains.nextRaid, 8); G.ui.toast(`Mission: ${m.name}. ${m.goal}.`, 'good'); } }, { label: 'Back', onPick: () => this.menu() }] });
  }
  missionRaid() { const m = this.mission(); return m && m.raid ? { ...m.raid } : null; }
  missionStep(ok) { const s = this.st, m = this.mission(); if (!m || !ok) return; s.hm = (s.hm || 0) + 1;
    const fresh = HERO_IDS.filter((id) => UNLOCK[id] === s.hm && !s.used[id]); if (fresh.length) this.later(2.2, () => { G.ui.flash('NEW HEROES', 1.6); G.ui.toast(`Unlocked: ${fresh.map((id) => HEROES[id].name).join(' and ')}. Choose them at the Hero Hall.`, 'good'); }); s.hmOn = s.hm < MISSIONS.length; G.economy.earn(m.pay, `mission: ${m.name}`); G.ui.flash('MISSION COMPLETE', 2); if (s.hm >= MISSIONS.length) { G.state.done.heroChapter = true; G.ui.toast('The Three Storms is complete. You are a Guardian of Neo Central.', 'good'); } else G.ui.toast(`Next mission at the Hero Hall: ${MISSIONS[s.hm].name}.`, 'info'); G.save.write(true); }
  raidDone(R) { const m = this.mission(); if (m && m.raid) this.missionStep((!m.raid.type || m.raid.type === R.type) && (!m.raid.owner || m.raid.owner === R.owner)); }
  bossDone(kind) { const m = this.mission(); if (!m || !m.bosses) return; const s = this.st; s.hmB = { ...(s.hmB || {}), [kind]: true }; const left = m.bosses.filter((b) => !s.hmB[b]); if (!left.length) this.missionStep(true); else G.ui.toast(`Mission: ${left.length} boss${left.length > 1 ? 'es' : ''} left (${left.join(', ')}).`, 'info'); }

  // ---- upgrades at the Hero Hall (shared by every hero) ---------------------------------------------------
  upgradeMenu() {
    const st = this.st; st.up = st.up || { power: 0, vit: 0, focus: 0 };
    const row = (k, name, what) => { const l = st.up[k], cost = UP_COST[l]; return { label: `${name} ${'●'.repeat(l)}${'○'.repeat(3 - l)}`, desc: l >= 3 ? `${what} · maxed` : `${what} · next level ◈${cost}`, onPick: () => { if (l >= 3) return this.upgradeMenu(); if (G.economy.spend(cost, `${name.toLowerCase()} upgrade`)) { st.up[k]++; if (k === 'vit' && this.on) { this.max = Math.round(this.H.hp * (1 + 0.2 * st.up.vit)); this.hp = this.max; } G.ui.toast(`${name} upgraded to level ${st.up[k]}.`, 'good'); G.save.write(true); } this.upgradeMenu(); } }; };
    G.ui.openMenu({ title: 'Hero upgrades', who: 'Hero Hall · for every hero', body: 'Paid for with raid money. Each has three levels.',
      options: [row('power', 'Power', '+15% damage a level'), row('vit', 'Vitality', '+20% health a level'), row('focus', 'Focus', '12% shorter cooldowns a level'), { label: 'Back', onPick: () => this.menu() }] });
  }

  // ---- being hit ---------------------------------------------------------------------------------------
  hurt(dmg, dir, o = {}) {
    if (!this.alive) return;
    dmg *= this.diff.dmg; if (dmg >= 18) G.hitStop = Math.max(G.hitStop || 0, 0.05);
    const p = G.player;
    if (o.copy) this.saw(o.copy, p.pos);
    if (this.dodge > 0) { G.fx.spark(this.centre(), '#3fe0c5', 10, 4, 0.3, 0.12); if (p.state === 'walk' && p.grounded) { p.vel.x += -dir.z * 6; p.vel.z += dir.x * 6; p.vel.y = 4; p.grounded = false; p.play('spin', 0.3); } return; }
    if (this.mirror > 0) { this.mirrorDmg = (this.mirrorDmg || 0) + dmg; if (o.src && o.src.alive) (this.mirrorSrc = this.mirrorSrc || new Set()).add(o.src); G.fx.ring(this.centre(), this.id === 'rook' ? '#ffd34d' : '#ff5a6e', 0.4, 2.4, 0.25); if (this.id === 'rook' && o.src && o.src.hit) o.src.hit(dmg * 1.5 + 8, V().copy(dir).negate(), { knock: 12, up: 3, byHero: true }); return; }   // key 5: soaked up (and, for Rook, bounced straight back)
    if (this.balloon > 0) { G.fx.ring(this.centre(), '#ffd34d', 0.4, 2.5, 0.3); if (o.src && o.src.hit) o.src.hit(dmg * 0.5, V().copy(dir).negate(), { knock: 10, byHero: true }); return; }
    if (this.counter > 0) { this.counter = 0; G.player.play('slash', 0.3); this.faceAim(0.3); this.cone(4.5, 120, { dmg: 60, knock: 14, up: 4, kind: 'cut', color: '#ff6f8a' }); this.arc('#ff6f8a', 1, 4); this.arc('#ffffff', -1, 4); G.ui.flash('COUNTER', 0.8); this.sound('zap'); return; }
    if (this.block > 0 && o.src && o.src.hit) o.src.hit(dmg * 0.6, V().copy(dir).negate(), { knock: 6, byHero: true });
    if (this.flame > 0 && o.src && o.src.hit) o.src.hit(6, V().copy(dir).negate(), { kind: 'fire', byHero: true });
    let k = 1; if (this.shield > 0) k = 0.2; if (this.block > 0) k = 0.2; if (this.flame > 0) k = 0.25; if (this.id === 'bulwark') { this.rage = Math.min(100, (this.rage || 0) + dmg * 0.8); if (this.ult > 0) k = 0.6; } if (this.id === 'raiko' && this.ult > 0) k = 0.1; if (this.id === 'rook' && this.ult > 0) k = 0.45; if (this.id === 'rook' && this.form === 4) k *= 0.7;
    if (this.forms.active) { const left = this.forms.soak(dmg * k); o = { ...o, knock: 0, up: 0 }; if (left <= 0) { G.fx.spark(this.centre(), this.forms.form.color, 6, 3, 0.2, 0.1); return; } dmg = left; k = 1; }   // the form's armour soaks it first; nothing knocks a form back
    else this.forms.gain(dmg * k * 0.12);
    this.hp -= dmg * k; this.calm = 0;
    const kn = (o.knock || 0) * (this.ult > 0 ? (this.id === 'bulwark' ? 0 : 0.3) : 1) * (this.block > 0 ? 0.3 : 1);
    if (p.state === 'walk' || p.state === 'hero') { if (this.mv && this.mv.kind !== 'fly' && kn > 6) this.endMove(); p.vel.x += dir.x * kn; p.vel.z += dir.z * kn; if (kn > 6 || o.up) { p.vel.y = Math.max(p.vel.y, (o.up || 0) + kn * 0.2); p.grounded = false; } }
    if (dmg * k > 3) p.play('hurt', 0.25);
    G.fx.shake(Math.min(0.6, dmg * k * 0.02)); this.vig = 1;
    if (G.sfx) { if (k < 0.3 && (this.shield > 0 || this.block > 0)) G.sfx.play('clang', null, 0.6); else G.sfx.hit(o.kind || 'blunt', dmg * k, null, null); }
    if (this.hp <= 0) this.knockedOut();
  }
  knockedOut() {
    this.forms.end(true);
    const p = G.player; this.hp = 0; this.downT = 3; this.endMove(); this.channel = null;
    if (this.ult > 0) this.endUlt();
    p.state = 'busy'; p.busyAnim = 'faint'; p.vel.set(0, 0, 0);
    G.ui.flash('KNOCKED OUT', 2.5); G.ui.toast(`${this.H.name} is down. The Hero Hall medics will patch you up.`, 'warn');
    if (G.villains) G.villains.heroDown();
    if (G.wanted && G.wanted.stars) { G.wanted.clear(); if (G.events) G.events.lost(); }   // the patrol stands down once you are out
    if (G.music) G.music.sting('lose');
  }
  revive() {
    // the hero stays down (not 'alive', so nothing can hit them again) until the fade has carried them to the Hall
    const p = G.player; this.reviving = true;
    G.ui.fade(() => { this.reviving = false; p.state = 'walk'; p.pos.set(this.hall.x + 3.5, this.hall.y + 0.2, this.hall.z + 3.5); p.vel.set(0, 0, 0); this.hp = this.max; this.meter = 0; this.downT = 0; this.cd = {}; });
  }

  // ---- looks: auras, steam, the guardian, the shield ----------------------------------------------------
  visuals(dt, t) {
    const p = G.player, fx = G.fx, id = this.id;
    if (this.shieldMesh) { this.shieldMesh.visible = this.shield > 0; if (this.shield > 0) this.shieldMesh.material.opacity = 0.15 + Math.sin(t * 12) * 0.05 + (this.shield < 1 ? 0 : 0.1); }
    if (this.core) this.core.scale.setScalar(1 + Math.sin(t * 6) * 0.08);
    if (this.dodge > 0 && Math.random() < dt * 25) fx.glow.emit(p.pos.x + (Math.random() - 0.5), p.pos.y + Math.random() * 1.8, p.pos.z + (Math.random() - 0.5), 0, 0.5, 0, '#3fe0c5', 0.4, 0.12, 0.02, 0, 0);
    if (id === 'raiko') {
      if (this.bladeGlow) this.bladeGlow.material.color.setScalar(1).multiplyScalar(this.ult > 0 ? 1.8 : 0.5 + (Math.sin(t * 9) > 0.7 ? 0.8 : 0));
      if (this.guardian && this.guardian.visible) {
        const g = this.guardian; g.position.set(p.pos.x, p.pos.y - 0.3, p.pos.z); g.rotation.y = p.yaw; g.scale.setScalar(Math.min(1, g.scale.x + dt * 2.5));
        g.children.forEach((c, i) => { c.material.opacity = 0.45 + Math.sin(t * 7 + i) * 0.12; });
        if (Math.random() < dt * 20) fx.glow.emit(p.pos.x + (Math.random() - 0.5) * 4, p.pos.y + Math.random() * 6, p.pos.z + (Math.random() - 0.5) * 4, 0, 1, 0, '#a78bff', 0.6, 0.25, 0.05, 0, 0);
        if (Math.random() < dt * 3) fx.bolt(this.v.set(p.pos.x + (Math.random() - 0.5) * 3, p.pos.y + 5, p.pos.z + (Math.random() - 0.5) * 3), this.w.set(p.pos.x + (Math.random() - 0.5) * 3, p.pos.y + 1, p.pos.z + (Math.random() - 0.5) * 3), '#c9b8ff', 0.05, 0.12);
      }
    }
    if (id === 'rook') {
      if ((this.form === 2 || this.form === 4 || this.tired > 0) && this.ult <= 0 && Math.random() < dt * (this.form === 2 ? 14 : 6)) fx.smoke(this.v.set(p.pos.x, p.pos.y + 1.2 * p.rig.root.scale.y, p.pos.z), 1, '#eef2f6', 0.5, 1.5);
      if (this.ult > 0) { if (Math.random() < dt * 30) fx.glow.emit(p.pos.x + (Math.random() - 0.5) * 2.4, p.pos.y + Math.random() * 3, p.pos.z + (Math.random() - 0.5) * 2.4, 0, 1.4, 0, '#ffffff', 0.7, 0.3, 0.05, 0, 0); if (Math.random() < dt * 1.5) fx.ring(this.v.set(p.pos.x, p.pos.y + 0.1, p.pos.z), '#ffffff', 0.5, 5, 0.6); }
    }
    if (id === 'forge' && this.mv && this.mv.kind === 'fly' && this.core) this.core.material.color.setScalar(2.4);
    if (this.jets && !(this.mv && this.mv.kind === 'fly')) for (const j of [...this.jets.boots, ...this.jets.palms]) j.g.visible = false;   // the thrusters cut out when the flight ends
    if (id === 'brann' && this.tool && !(this.mv && this.mv.spin) && this.tool.rotation.y) this.tool.rotation.y = 0;   // the hammer stops whirling when the flight ends, however it ends
  }

  // ---- HUD -------------------------------------------------------------------------------------------
  buildHud() {
    const root = G.ui.root, mk = (id, html) => { const e = document.createElement('div'); e.id = id; e.innerHTML = html; root.appendChild(e); e.style.display = 'none'; return e; };
    this.hud = mk('hero-hud', '<img class="hh-face" alt=""><div class="hh-mission"></div><div class="hh-top"><b class="hh-name"></b><span class="hh-form"></span></div><div class="hh-bar hh-hp"><i></i><span></span></div><div class="hh-bar hh-meter"><i></i><span></span></div><div class="hh-bar hh-tf"><i style="background:linear-gradient(90deg,#ffb347,#ff5a6e)"></i><span></span></div><div class="hh-moves"></div>');
    this.cross = mk('hero-cross', '');
    this.bossEl = mk('boss-bar', '<img class="bb-face" alt=""><b></b><div class="bb"><i></i></div><small></small>');
    this.foeEl = mk('foe-bar', '<b></b><div class="bb"><i></i></div>');
    this.vigEl = mk('hurt-vig', ''); this.vigEl.style.display = 'block'; this.vig = 0;
    this.hudT = 0;
  }
  drawHud(dt) {
    this.vig = Math.max(0, (this.vig || 0) - dt * 2.5); this.vigEl.style.opacity = this.on ? Math.max(this.vig * 0.8, this.hp < this.max * 0.25 ? 0.25 + Math.sin(G.elapsed * 6) * 0.1 : 0) : 0;
    this.hudT -= dt; if (this.hudT > 0 || !this.on) return; this.hudT = 0.08;
    const H = this.H, c = H.color, q = (s) => this.hud.querySelector(s);
    q('.hh-name').textContent = `${H.name} · Lv ${this.level()}${this.partner ? ` · G: ${HEROES[this.partner].name}${(this.saved[this.partner] || {}).meter >= 100 ? ' (ready)' : ''}` : ''}`; q('.hh-name').style.color = c;
    const face = q('.hh-face'), src = artUrl(`hero-${this.id}.jpg`); if (src && face.dataset.id !== this.id) { face.src = src; face.dataset.id = this.id; face.style.borderColor = c; } face.style.display = src ? 'block' : 'none';
    q('.hh-form').textContent = this.id === 'rook' ? (this.ult > 0 ? 'FORM 5' : `Form ${this.form}`) + (this.tired > 0 ? ' · out of breath' : '') : this.id === 'sable' ? (this.copied ? `copied: ${COPY_NAMES[this.copied].split(' (')[0]}` : 'nothing copied yet') : this.mv && this.mv.kind === 'fly' ? 'flying · C to land' : this.ult > 0 ? `ultimate ${Math.ceil(this.ult)} s` : H.title;
    const tr = this.training && G.villains; if (tr) { const ml0 = q('.hh-mission'); void ml0; }
    const mm = this.mission(), ml = q('.hh-mission'); ml.textContent = tr ? `Training · ${Math.round(G.villains.trainRate())} damage a second (last 5 s) · ${Math.round(G.villains.trainTotal)} in all` : mm ? `Mission: ${mm.name} · ${mm.goal}` : ''; ml.style.display = tr || mm ? 'block' : 'none';
    q('.hh-hp i').style.width = `${(this.hp / this.max) * 100}%`; q('.hh-hp span').textContent = `${Math.ceil(this.hp)} / ${this.max}`;
    q('.hh-meter i').style.width = `${this.meter}%`; q('.hh-meter i').style.background = this.meter >= 100 ? c : ''; q('.hh-meter span').textContent = this.ult > 0 ? `${Math.ceil(this.ult)} s` : this.meter >= 100 ? 'R: ULTIMATE READY' : `ultimate ${Math.floor(this.meter)}%`;
    const F = this.forms, tf = q('.hh-tf');
    if (tf) { const on = F.on || F.seq; tf.querySelector('i').style.width = `${on ? (F.on ? (F.t / 30) * 100 : 100) : F.meter}%`; tf.querySelector('span').textContent = !F.def() ? 'no transformation yet' : F.on ? `${F.on.name} · ${Math.ceil(F.t)} s · armour ${Math.ceil(F.armour)}` : F.seq ? 'transforming…' : F.meter >= 100 ? `T: TRANSFORM (${F.def().name})` : `transform ${Math.floor(F.meter)}%`; }
    const names = Object.fromEntries((F.on ? F.on.moves : H.moves).map(([k, d]) => [k.split(' ')[0], k.slice(2)]));
    q('.hh-moves').innerHTML = (F.on ? ['p1', 'p2', 'p3'] : ['p1', 'p2', 'p3', 'p5']).map((s, i) => { const left = Math.max(0, this.cd[(F.on ? 'f' : '') + s] || 0), full = (F.on ? 8 : CD[this.id][s] || 1), key = s.slice(1); void i; return `<div class="hm${left > 0 ? ' cd' : ''}"><kbd>${key}</kbd><span>${names[key] || ''}</span><i style="width:${(left / full) * 100}%"></i></div>`; }).join('') + (this.level() >= 4 ? `<div class="hm${this.cd.sig > 0 ? ' cd' : ''}"><kbd>4</kbd><span>${SIG[this.id][0]}</span><i style="width:${(Math.max(0, this.cd.sig || 0) / 14) * 100}%"></i></div>` : '');
    // the enemy you hit last
    const f = G.combat.lastHit;
    if (f && f.alive && !f.boss) { this.foeEl.style.display = 'block'; this.foeEl.querySelector('b').textContent = f.name; this.foeEl.querySelector('i').style.width = `${Math.max(0, f.hp / f.max) * 100}%`; } else this.foeEl.style.display = 'none';
  }
  // a full-screen card for a moment: a hero chosen, a villain arriving (pointer passes through it)
  showCard(src, name, sub, color, secs = 2.2, wide = false, clip = null) {
    if (!this.cardEl) { const e = (this.cardEl = document.createElement('div')); e.id = 'hero-card'; G.ui.root.appendChild(e); }
    const e = this.cardEl;
    e.className = wide ? 'wide' : '';
    // a villain's Higgsfield clip plays over the picture when there is one (not with reduced motion, not in the one-file copy)
    const vid = clip && !matchMedia('(prefers-reduced-motion: reduce)').matches ? `<video src="${import.meta.env.BASE_URL}video/${clip}.mp4" autoplay muted playsinline preload="auto" style="border-color:${color}" onerror="this.remove()" oncanplay="this.classList.add('on')"></video>` : '';
    e.innerHTML = `<div class="hc">${src || vid ? `<div class="hc-pic">${src ? `<img src="${src}" alt="" style="border-color:${color}">` : ''}${vid}</div>` : ''}<div class="hc-t"><b style="color:${color}">${name.toUpperCase()}</b><span>${sub}</span></div></div>`;
    e.style.display = 'flex'; e.classList.remove('out'); void e.offsetWidth; e.classList.add('in');
    clearTimeout(this.cardT); this.cardT = setTimeout(() => { e.classList.add('out'); this.cardT = setTimeout(() => { e.style.display = 'none'; }, 450); }, secs * 1000);
  }
  bossBar(b) {
    if (!b) { this.bossEl.style.display = 'none'; return; }
    this.bossEl.style.display = 'block'; this.bossEl.querySelector('b').textContent = b.title;
    const face = this.bossEl.querySelector('.bb-face'), src = b.face ? artUrl(b.face) : null; if (src && face.dataset.f !== b.face) { face.src = src; face.dataset.f = b.face; } face.style.display = src ? 'block' : 'none'; this.bossEl.querySelector('i').style.width = `${Math.max(0, b.hp / b.max) * 100}%`; this.bossEl.querySelector('small').textContent = b.phaseText || '';
  }
}
