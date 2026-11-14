// Money and the things it buys: wallet, vehicle charging/repair/paint/valet, the robot shop,
// the sky pod (tour, purchase, sleep, wardrobe), the lens menu, autopilot destinations.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { money } from '../ui/ui.js';
import { makeDog, animateDog, makeHumanoid, animateRig, makeDrone, CLOTHES, ACCENTS, HAIRS, HAIR_STYLES } from '../entities/rigs.js';
import { fmtClock } from '../core/util.js';
import { Career } from './career.js';

const SHARES = [['cart', 'A share in the dumpling cart', 1800, 120, 'Wen Shu keeps folding; you take a slice of the heritage stipend.'], ['stall', 'An evening market stall licence', 3000, 220, 'One of the three unused licences. A vendor runs it for you.'], ['petal', 'Partnership in Printed Petal', 9000, 650, 'A silent partner in the busiest kitchen in Meridian.']];

const POD_PRICE = 6500, DOG_PRICE = 1200;
const DOG_NAMES = ['Volt', 'Mochi', 'Rivet', 'Nova', 'Juno', 'Pixel II'];
const DOG_COLORS = [['Pearl', '#e6ebf2', '#59e0ff'], ['Graphite', '#2c313b', '#ff7ad9'], ['Amber', '#d99a3a', '#7dff9c'], ['Crimson', '#b23a48', '#ffd34d']];
const PAINTS = [['Signal red', '#d9413a'], ['Pearl white', '#e9edf2'], ['Midnight', '#1b2233'], ['Solar yellow', '#e2b93a'], ['Reef teal', '#2a9d8f'], ['Violet', '#6b4fa0']];
const next = (list, cur) => list[(list.indexOf(cur) + 1) % list.length];

export class Economy {
  constructor() {
    const I = G.interact, c = G.city, ap = c.places.apartment, st = () => G.state;
    this.display = []; this.aster = null; this.wasHome = false;
    this.asterSpot = { pos: new THREE.Vector3(-20.6, 150, -72.6), name: 'Aster', h: 2.05 };
    I.add({ pos: this.asterSpot.pos, r: 2.1, prio: 0.2, label: 'Talk to Aster', enabled: () => !!this.aster, use: () => this.asterMenu('How can I help?') });
    this.refreshAster();
    // charging: park on a pad with a charger
    for (const pad of c.pads) if (pad.charger) I.add({ mode: 'drive', pos: pad, r: pad.r + 0.5, yTol: 2.5, enabled: () => G.car.mode === 'parked' && G.car.battery < 99,
      label: () => (pad.priv ? (st().owns[pad.owner || 'apartment'] ? 'Charge (your deck: free)' : 'Private deck: owner charging only') : `Induction charge ${money(this.chargeCost())}`), use: () => this.charge(pad) });
    // sky pod
    I.add({ pos: ap.liftDown, r: 1.7, label: () => (st().owns.apartment ? 'Take the lift to your sky pod' : 'Tour sky pod 41-07 (for sale)'), use: () => this.lift(ap.spawnUp) });
    I.add({ pos: ap.liftUp, r: 1.5, label: 'Take the lift down to the street', use: () => this.lift(ap.spawnDown) });
    I.add({ pos: ap.console, r: 1.5, label: 'Home console', use: () => this.homeMenu() });
    I.add({ pos: ap.bed, r: 1.6, label: () => (st().owns.apartment ? 'Sleep until morning' : 'Bed (buy the pod to use it)'), use: () => (st().owns.apartment ? this.sleep() : G.ui.toast('The pod is for sale at the home console.', 'info')) });
    I.add({ pos: ap.wardrobe, r: 1.5, label: () => (st().owns.apartment ? 'Wardrobe' : 'Wardrobe (buy the pod to use it)'), use: () => (st().owns.apartment ? this.wardrobe() : G.ui.toast('The pod is for sale at the home console.', 'info')) });
    // showroom models at Kinetic
    const P = c.places.shop.pedestals, mk = (rig, i, yaw) => { rig.root.position.set(P[i].x, P[i].y, P[i].z); rig.root.rotation.y = yaw; G.scene.add(rig.root); return rig; };
    this.display.push({ dog: mk(makeDog({ robot: true, color: '#e6ebf2', accent: '#59e0ff' }), 0, -1.2) }, { dog: mk(makeDog({ robot: true, color: '#2c313b', accent: '#ff7ad9' }), 1, -1.9) });
    this.display.push({ man: mk(makeHumanoid({ kind: 'android', shell: '#eef2f6', top: '#dfe5ee', bottom: '#8a94a6', accent: '#7dff9c', height: 1.8 }), 2, -1.6) });
    const dr = makeDrone('delivery'); dr.root.position.set(P[3].x, P[3].y + 1.2, P[3].z); G.scene.add(dr.root); this.display.push({ drone: dr });
  }
  // ---- Aster, the household android ---------------------------------------------------------------
  // ---- business shares: buy in once, collect a dividend every morning ---------------------------
  investMenu() {
    const s = G.state, inv = s.invest, daily = SHARES.reduce((a, [k, , , d]) => a + (inv[k] ? d : 0), 0);
    G.ui.openMenu({ title: 'Investments', who: 'CivicLink · small business registry', wide: true, body: daily ? `Your shares pay ◈${daily} each morning.` : 'Shares pay a dividend into your wallet each morning. They cannot be sold back in this build.',
      options: [...SHARES.map(([k, name, price, d, desc]) => ({ label: name, desc: `${desc} Pays ◈${d} a day.`, price: inv[k] ? undefined : price, disabled: inv[k], why: 'You already hold this.', onPick: () => { if (this.spend(price, name.toLowerCase())) { inv[k] = true; s.payDay = G.env.day; G.save.write(true); G.ui.toast('Registered. First dividend tomorrow morning.', 'good'); } } })), { label: 'Close', onPick: () => {} }] });
  }
  dividends() {
    const s = G.state, days = G.env.day - s.payDay; if (days <= 0) return;
    s.payDay = G.env.day;
    const daily = SHARES.reduce((a, [k, , , d]) => a + (s.invest[k] ? d : 0), 0);
    if (daily && G.started) this.earn(daily * Math.min(days, 3), days > 1 ? `dividends for ${Math.min(days, 3)} days` : 'morning dividends');
  }
  refreshAster() {
    if (this.aster) { this.aster.root.removeFromParent(); this.aster = null; }
    if (!G.state.owns.aster) return;
    const r = (this.aster = makeHumanoid({ kind: 'android', shell: '#f1ede6', top: '#e6dccb', bottom: '#5b6472', accent: '#59e0ff', height: 1.78 }));
    r.root.position.copy(this.asterSpot.pos); r.root.rotation.y = Math.atan2(-4.4, -2.6); G.scene.add(r.root);
  }
  asterMenu(text) {
    const s = G.state, env = G.env, car = G.car, onDeck = car.mode === 'parked' && Math.hypot(car.pos.x + 25, car.pos.z + 61) < 7 && car.pos.y > 140;
    G.ui.openMenu({ title: 'Aster', who: 'Household android · sky pod 41-07', body: text, options: [
      { label: 'Print me a meal', desc: 'Once a day from the pod kitchen', disabled: s.asterDay === env.day, why: 'Aster has already cooked today. The pod printer needs its cleaning cycle.', onPick: () => { s.asterDay = env.day; G.food.pocket({ name: 'Home-printed supper', energy: 45 }); this.asterMenu('Printed, plated and sealed. It is in your pocket for when you are hungry.'); } },
      { label: 'Top up the aerocar', disabled: !onDeck || car.battery > 98, why: onDeck ? 'The battery is already full.' : 'Park on the deck first and I will connect the charger.', onPick: () => { car.battery = 100; this.asterMenu('Charger connected. Battery at 100 percent.'); } },
      { label: 'How is the home?', onPick: () => this.asterMenu(`Shading is set for ${env.daylight > 0.5 ? 'daylight' : 'night'}. The pod drew less power today than the tower sign does in a minute. Forecast: ${env.forecast}.`) },
      { label: 'That is all', onPick: () => {} }] });
  }
  update(dt, t) {
    this.dividends();
    if (this.aster) {
      const home = G.city.places.apartment.inside(G.player.pos), p = G.player.pos, a = this.asterSpot.pos;
      if (home) { this.aster.lookYaw = Math.max(-1.1, Math.min(1.1, Math.atan2(p.x - a.x, p.z - a.z) - this.aster.root.rotation.y)); animateRig(this.aster, dt, 'idle', 0); }
      if (home && !this.wasHome) G.ui.say(this.asterSpot, `Welcome home, ${G.state.name}.`, 3.5);
      this.wasHome = home;
    }
    // the showroom models are drawn and animated only when you are near (they are indoors, and 20 parts each)
    const cam = G.camera.position, show = (cam.x - 92) ** 2 + cam.z ** 2 + cam.y ** 2 < 72 * 72;
    if (show !== this.displayOn) { this.displayOn = show; for (const d of this.display) (d.dog || d.man || d.drone).root.visible = show; }
    if ((G.player.pos.x - 92) ** 2 + G.player.pos.z ** 2 > 60 * 60) return;
    for (const d of this.display) {
      if (d.dog) animateDog(d.dog, dt, 'sit', 0);
      if (d.man) { d.man.lookYaw = Math.sin(t * 0.4) * 0.6; animateRig(d.man, dt, 'idle', 0); }
      if (d.drone) { d.drone.root.rotation.y += dt * 0.6; for (const r of d.drone.rotors) r.rotation.z += dt * 30; }
    }
  }

  spend(n, what) {
    const s = G.state;
    if (s.wallet < n) { G.ui.toast(`Not enough credits: ${money(n)} needed for ${what}.`, 'warn'); return false; }
    s.wallet -= n; if (n > 0) G.ui.toast(`−${money(n)}  ${what}`, 'pay'); return true;
  }
  earn(n, why) { G.state.wallet += n; G.ui.toast(`+${money(n)}  ${why}`, 'pay'); }

  // ---- vehicle ---------------------------------------------------------------------------------
  chargeCost() { return Math.ceil((100 - G.car.battery) * 0.6); }
  charge(pad) {
    if (pad.priv && !G.state.owns[pad.owner || 'apartment']) { G.ui.toast('This is a private deck.', 'warn'); return; }
    if (pad.priv || this.spend(this.chargeCost(), 'induction charge')) { G.car.battery = 100; G.ui.toast('Battery at 100%.', 'good'); if (G.audio) G.audio.blip(740, 0.1); }
  }
  repairCost() { return Math.ceil((100 - G.car.hull) * 3); }
  repair() { if (G.car.hull >= 100) return G.ui.toast('Hull is already at 100%.', 'info'); if (this.spend(this.repairCost(), 'hull repair')) { G.car.hull = 100; G.ui.toast('Hull restored.', 'good'); } }
  paintMenu() {
    G.ui.openMenu({ title: 'Respray', who: 'Meridian Skyport services', body: 'Electro-pigment respray. Takes effect immediately.', options: PAINTS.map(([n, hex]) => ({ label: n, price: G.car.paint === hex ? undefined : 150, disabled: G.car.paint === hex, why: 'That is the current color.', onPick: () => { if (this.spend(150, 'respray')) { G.car.setPaint(hex); G.state.garage.paint[G.car.model] = hex; } } })) });
  }
  // Autonomous valet: the car flies itself to the nearest public pad (also the tow when it is dead).
  valet() {
    const car = G.car, p = G.player.pos;
    if (G.player.state === 'drive') return G.ui.toast('You are already in it.', 'info');
    const pads = G.city.pads.filter((q) => (!q.priv || G.state.owns[q.owner || 'apartment']) && q.id !== 'sky4' && Math.abs(q.y - p.y) < 12).sort((a, b) => (a.x - p.x) ** 2 + (a.z - p.z) ** 2 - (b.x - p.x) ** 2 - (b.z - p.z) ** 2);
    if (!pads.length) return G.ui.toast('No landing pad near your level. Go down to the street.', 'warn');
    const dead = !car.powered, cost = dead ? 120 : 40;
    if (!this.spend(cost, dead ? 'tow and jump-charge' : 'valet flight')) return;
    const pad = pads[0];
    G.ui.fade(() => { car.pos.set(pad.x, pad.y + car.ride, pad.z); car.vel.set(0, 0, 0); car.mode = 'parked'; car.auto = null; if (dead) { car.battery = Math.max(car.battery, 25); car.hull = Math.max(car.hull, 30); } G.ui.toast(`Your aerocar is waiting at ${pad.name}.`, 'good'); });
  }
  autopilotMenu() {
    const car = G.car, pads = G.city.pads.filter((q) => (!q.priv || G.state.owns[q.owner || 'apartment']) && q.id !== 'sky4').map((q) => ({ q, d: Math.hypot(q.x - car.pos.x, q.z - car.pos.z) })).filter((e) => e.d > 12 || Math.abs(e.q.y - car.pos.y) > 6).sort((a, b) => a.d - b.d);
    const options = pads.map(({ q, d }) => ({ label: q.name, desc: `${Math.round(d)} m away · pad at ${Math.round(q.y)} m`, onPick: () => car.engageAutopilot(q) }));
    if (car.auto) options.unshift({ label: 'Cancel autopilot', onPick: () => { car.auto = null; } });
    G.ui.openMenu({ title: 'Autopilot', who: 'Select a landing pad', body: car.powered ? 'The car climbs to a clear altitude, cruises and lands itself. Touch any flight control to take over.' : 'No power.', options });
  }

  // ---- Kinetic Robotics ---------------------------------------------------------------------------
  shopMenu() {
    const s = G.state, own = s.owns.dog;
    const options = [];
    if (!own) options.push({ label: 'K9 Lumen robot dog', desc: 'Heels, sits, rides in your aerocar. Two days per charge, docks itself.', price: DOG_PRICE, onPick: () => { if (this.spend(DOG_PRICE, 'K9 Lumen')) { s.owns.dog = true; G.dog.refresh(); G.save.write(true); this.dogSetup('Your K9 is unboxed and paired to your lens. Choose a name.'); } } });
    else options.push({ label: `Rename or recolor ${s.dog.name}`, price: 0, onPick: () => this.dogSetup('Free adjustments for owners.') });
    if (s.owns.aster) options.push({ label: 'Aster household android', desc: 'Already installed in your sky pod.', disabled: true, why: 'Aster is at home.' });
    else options.push({ label: 'Aster household android', desc: 'Lives in your home: prints a meal a day, keeps the aerocar charged, greets you at the door.', price: 4500, disabled: !s.owns.apartment, why: 'Aster needs a registered home. Buy the sky pod first.', onPick: () => { if (this.spend(4500, 'Aster household android')) { s.owns.aster = true; this.refreshAster(); G.save.write(true); G.ui.toast('Aster will be waiting in your sky pod.', 'good'); } } });
    options.push(s.owns.board ? { label: 'Glide hoverboard', desc: 'You own one.', disabled: true, why: 'Press B on foot to ride it.' } : { label: 'Glide hoverboard', desc: 'Personal maglev board. Press B on foot: about three times walking pace.', price: 600, onPick: () => { if (this.spend(600, 'Glide hoverboard')) { s.owns.board = true; G.ui.setHelp(); G.save.write(true); G.ui.toast('Press B on foot to step onto your hoverboard.', 'good'); } } });
    options.push({ label: 'Leave', onPick: () => {} });
    G.ui.openMenu({ title: 'Kinetic Robotics', who: 'Kit · shop assistant', body: own ? `${s.dog.name} is reporting nominal. What can I adjust?` : 'Every unit ships with refusal firmware, a self-docking charger and a two-year maintenance plan.', options });
  }
  dogSetup(text) {
    const d = G.state.dog;
    G.ui.openMenu({ title: `Companion: ${d.name}`, who: 'K9 Lumen', body: text, options: [
      { label: `Name: ${d.name}`, desc: 'Cycle through names', onPick: () => { d.name = next(DOG_NAMES, d.name); this.dogSetup(`It answers to ${d.name} now.`); } },
      { label: `Shell: ${(DOG_COLORS.find((c) => c[1] === d.color) || DOG_COLORS[0])[0]}`, desc: 'Cycle shell colors', onPick: () => { const i = (DOG_COLORS.findIndex((c) => c[1] === d.color) + 1) % DOG_COLORS.length; d.color = DOG_COLORS[i][1]; d.accent = DOG_COLORS[i][2]; G.dog.refresh(); this.dogSetup('Shell updated.'); } },
      { label: 'Done', onPick: () => { G.save.write(true); } },
    ] });
  }

  // ---- sky pod --------------------------------------------------------------------------------------
  lift(to) {
    G.ui.fade(() => { const p = G.player; p.pos.set(to.x, to.y, to.z); p.vel.set(0, 0, 0); p.yaw = p.camYaw = to.yaw; p.grounded = true; if (G.dog.active) G.dog.pos.set(to.x + 0.8, to.y, to.z + 0.6); });
    if (G.audio) G.audio.blip(440, 0.1);
  }
  homeMenu() {
    const s = G.state, env = G.env;
    if (!s.owns.apartment) {
      return G.ui.openMenu({ title: 'Halcyon Sky Pod 41-07', who: 'For sale · 150 m above Meridian', body: 'Glass-walled pod with a private landing deck and free induction charging. The building trims its own shading and heat; a pod like this draws less power than the sign on the tower.', options: [
        { label: 'Buy this sky pod', price: POD_PRICE, onPick: () => { if (this.spend(POD_PRICE, 'Halcyon Sky Pod 41-07')) { s.owns.apartment = true; G.ui.flash('WELCOME HOME'); G.ui.toast('The pod is yours. Sleep here, change clothes, land on your own deck.', 'good'); G.save.write(true); } } },
        { label: 'Keep looking around', onPick: () => {} }] });
    }
    G.ui.openMenu({ title: 'Home', who: `Sky pod 41-07 · ${fmtClock(env.mins)} · ${env.label}`, body: `Good ${env.hour < 12 ? 'morning' : env.hour < 18 ? 'afternoon' : 'evening'}, ${s.name}. Deck charger is idle. Shading is set for ${env.daylight > 0.5 ? 'daylight' : 'night'}.`, options: [
      { label: 'Sleep until morning', desc: 'Skips to 07:00 and restores energy', onPick: () => this.sleep() },
      { label: 'Rest for an hour', onPick: () => G.skip(60, 8) },
      { label: 'Wardrobe', onPick: () => this.wardrobe() },
      { label: 'Save game', onPick: () => G.save.write() },
      { label: 'Close', onPick: () => {} }] });
  }
  sleep() {
    const env = G.env;
    if (env.hour >= 6 && env.hour < 11) return G.ui.toast('It is morning and you are wide awake. Rest for an hour at the console if you want to pass time.', 'info');
    G.skip(((7 * 60 - env.mins) + 1440) % 1440, 45); G.ui.toast('You slept well.', 'good');
  }
  wardrobe() {
    const L = G.player.look, p = G.player, redo = (patch) => { p.setLook(patch); this.wardrobe(); };
    G.ui.openMenu({ title: 'Wardrobe', who: 'Smart-fabric presets', body: 'Fabric re-dyes in seconds. Pick an option to cycle it.', options: [
      { label: 'Jacket color', onPick: () => redo({ top: next(CLOTHES, L.top) }) },
      { label: 'Trouser color', onPick: () => redo({ bottom: next(CLOTHES, L.bottom) }) },
      { label: 'Trim glow', onPick: () => redo({ accent: next(ACCENTS, L.accent) }) },
      { label: `Hair: ${HAIR_STYLES[L.hairStyle]}`, onPick: () => redo({ hairStyle: (L.hairStyle + 1) % HAIR_STYLES.length }) },
      { label: 'Hair color', onPick: () => redo({ hair: next(HAIRS, L.hair) }) },
      { label: L.coat ? 'Take off the long coat' : 'Put on the long coat', onPick: () => redo({ coat: !L.coat }) },
      { label: L.visor ? 'Remove AR visor' : 'Wear AR visor', onPick: () => redo({ visor: !L.visor }) },
      { label: 'Done', onPick: () => G.save.write(true) }] });
  }

  // ---- lens (Tab) --------------------------------------------------------------------------------------
  lensMenu() {
    const s = G.state, p = G.player, env = G.env, inv = s.inventory;
    const html = `<p><b>${s.name}</b> · Day ${env.day}, ${fmtClock(env.mins)} · ${env.label}</p>
      <p>Wallet ${money(s.wallet)} · Energy ${Math.round(p.energy)}% · Caches ${s.caches.length}/${G.city.caches.length}<br>
      Fares ${s.stats.fares} · Deliveries ${s.stats.deliveries} · Kitchen shifts ${s.stats.shifts} · Meals ${s.stats.meals} · Citations ${s.stats.fines}<br>
      Career: ${Career.summary()}<br>
      Home: ${s.owns.apartment ? 'Halcyon Sky Pod 41-07' : 'none yet'} · Companion: ${s.owns.dog ? s.dog.name : 'none'} · Best Canyon Sprint: ${s.best.race ? s.best.race.toFixed(1) + ' s' : 'no time set'}</p>
      <p>Pocket: ${inv.length ? inv.map((i) => i.name).join(', ') : 'empty'}</p>`;
    const options = [];
    const ed = inv.find((i) => i.energy > 0);
    if (ed) options.push({ label: `Eat ${ed.name}`, desc: `+${ed.energy}% energy`, onPick: () => G.food.eatPocket() });
    if (p.state === 'walk') options.push({ label: 'Order drone delivery from Printed Petal', desc: 'Flown to where you are standing', onPick: () => G.food.deliveryMenu() });
    options.push({ label: 'Districts and shuttle', desc: 'Map of Neo Central, mark a district, call a shuttle', onPick: () => G.world.districtMenu() });
    options.push({ label: 'Wait one hour', desc: 'The city carries on while you idle', onPick: () => G.skip(60, 0) });
    if (p.state !== 'drive') options.push({ label: G.car.powered ? 'Valet: send my aerocar to the nearest pad' : 'Tow and jump-charge my aerocar', price: G.car.powered ? 40 : 120, onPick: () => this.valet() });
    options.push({ label: 'Milestones', desc: 'Optional goals with small rewards', onPick: () => G.games.menu() });
    options.push({ label: 'Save game', onPick: () => G.save.write() });
    options.push({ label: 'Close', onPick: () => {} });
    G.ui.openMenu({ title: 'Lens', who: 'AR contact interface', html, options, wide: true });
  }
}
