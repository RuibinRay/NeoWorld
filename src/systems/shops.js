// Walk-in shops: a clerk behind each counter and a menu of goods. Food goes in your pocket or is
// eaten on the spot; furnishings are delivered to your home and appear there; services act at once.
// One lamp is shared by every shop and follows the player into whichever one they are in, so
// twenty lit interiors cost one light.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { clamp } from '../core/util.js';
import { makeHumanoid, varyLook, animateRig, setMood, SKINS, HAIRS, ACCENTS } from '../entities/rigs.js';

const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
export const DECOR = { records: 'Turntable and records', vinyl: 'Wall of vinyl sleeves', tea: 'Tea set', lamp: 'Refurbished desk lamp', books: 'Shelf of paper novels', print: 'Framed city print', plant: 'Eden fern', aquarium: 'Aquarium' };

const CATALOG = {
  expo: { clerk: 'Ottoline Park', role: 'Expo guide', top: '#2f6f8f', hello: 'Welcome to the Expo. The gift shop is the only exhibit you can take home.', items: [
    { label: 'Model of the first Skyhaven deck', price: 35, act: () => G.ui.toast('Twelve tiny columns. It wobbles, like the real one did.', 'good') },
    { label: 'Expo poster, framed', price: 120, decor: 'print', desc: 'Delivered to your home' },
    { label: 'Postcards of the bay', price: 3, act: () => G.ui.toast('Five postcards. Nobody sends them; everybody buys them.', 'info') }] },
  glasshouse: { clerk: 'Odalys Reyes', role: 'gardener and tea', top: '#3f7a4c', hello: 'Everything in here is alive, including the tea. Mind the orchids, they bruise if you look at them wrong.', items: [
    { label: 'Hothouse tea and a slice of yuzu cake, here', price: 9, eat: 14, mins: 15, mood: true, desc: 'A quiet quarter of an hour under glass' },
    { label: 'Jar of park honey', price: 12, food: { name: 'Park honey', energy: 12 } },
    { label: 'Eden fern in a pot', price: 60, decor: 'plant', desc: 'Delivered to your home' }] },
  surf: { clerk: 'Kai Lindqvist', role: 'surf shop', top: '#2f6f8f', hello: 'Water is twenty-four degrees and flat as a table. Perfect for a jet-ski, useless for a board.', items: [
    { label: 'Jet-ski season pass', price: 220, desc: 'Take a jet-ski out from the jetty whenever you like, no hire fee', need: () => !G.state.owns.jetski, needWhy: 'You already hold a pass.', act: () => { G.state.owns.jetski = true; G.ui.toast('Season pass on your lens. The jetty is west of the pier.', 'good'); } },
    { label: 'Frozen mango bar', price: 5, food: { name: 'Frozen mango bar', energy: 10 } },
    { label: 'Tune your hoverboard', price: 80, desc: 'Faster top speed, for good', need: () => G.state.owns.board && !G.state.owns.boardTune, needWhy: () => (G.state.owns.board ? 'Already tuned.' : 'You do not own a hoverboard.'), act: () => { G.state.owns.boardTune = true; G.ui.toast('Board tuned. It will pull harder now.', 'good'); } }] },
  beachbar: { clerk: 'Marisol Achebe', role: 'bar and grill', top: '#c98a2e', hello: 'Shoes are optional. Paying is not.', items: [
    { label: 'Grilled fish tacos, at the bar', price: 14, eat: 34, mins: 15, desc: 'Takes a quarter of an hour' },
    { label: 'Coconut cooler', price: 6, eat: 10, mins: 5, mood: true, desc: 'Five minutes with your feet in the sand' },
    { label: 'Bag of plantain crisps', price: 5, food: { name: 'Plantain crisps', energy: 12 } }] },
  fishmarket: { clerk: 'Bram Kowalczyk', role: 'fishmonger', top: '#34495e', hello: 'Landed this morning. The boat is the blue one, the fish are the ones looking at you.', items: [
    { label: 'Chowder, eaten at the counter', price: 11, eat: 30, mins: 10, desc: 'Ten minutes, standing' },
    { label: 'Sashimi box', price: 13, food: { name: 'Sashimi box', energy: 26 } },
    { label: 'Grilled mackerel roll', price: 9, food: { name: 'Mackerel roll', energy: 20 } }] },
  corner: { clerk: 'Priya Nakamura-Osei', role: 'corner shop', top: '#7a5a8f', hello: 'Milk, batteries, gossip. Two of those are free.', items: [
    { label: 'Bag of groceries', price: 15, food: { name: 'Groceries', energy: 30 } },
    { label: 'Flask of coffee', price: 4, food: { name: 'Flask of coffee', energy: 8 } },
    { label: 'The Heights Gazette', price: 2, desc: 'Paper, folded twice', act: () => G.ui.toast(['Gazette: "Hedge height dispute enters ninth year."', 'Gazette: "Lost robot dog found two streets away, embarrassed."', 'Gazette: "Council promises the avenue bus will be on time. Again."'][Math.floor(Math.random() * 3)], 'info') }] },
  records: { clerk: 'Dov Marchetti', role: 'record dealer', top: '#7a2f3b', hello: 'Everything in here was pressed before the towers went up. Play them loud; the neighbors are forty floors away.', items: [
    { label: 'Turntable and a crate of records', price: 420, decor: 'records', desc: 'Delivered to your home. Play a side whenever you are in.' },
    { label: 'Wall of vinyl sleeves', price: 160, decor: 'vinyl', desc: 'Delivered to your home: twelve covers, framed.' }] },
  bao: { clerk: 'Auntie Lin', role: 'bao and broth', top: '#f1ede6', hello: 'Sit, eat. Or take it with you, I will not be offended. Much.', items: [
    { label: 'Eat in: three bao and a bowl of broth', price: 16, eat: 36, mins: 15, desc: 'Takes a quarter of an hour' },
    { label: 'Steamed bao to go', price: 8, food: { name: 'Steamed bao', energy: 18 } },
    { label: 'Flask of bone broth', price: 11, food: { name: 'Broth flask', energy: 22 } }] },
  tea: { clerk: 'Haruto Mbeki', role: 'tea master', top: '#2f6b55', hello: 'The water is at eighty-two degrees. It has been at eighty-two degrees since 2191.', items: [
    { label: 'Pot of smoked oolong, here', price: 8, eat: 12, mins: 20, mood: true, desc: 'Twenty quiet minutes' },
    { label: 'Mooncake', price: 7, food: { name: 'Mooncake', energy: 15 } },
    { label: 'Tea set and a tin of eden leaf', price: 90, decor: 'tea', desc: 'Delivered to your home. Brew a cup any time.' }] },
  repair: { clerk: 'Ines Okafor', role: 'fixer', top: '#34495e', hello: 'If it has a seam, I can open it. If it does not, give me a minute.', items: [
    { label: 'Patch your vehicle hull', price: 45, desc: 'A drone goes out to it: +30% hull', need: () => G.car.hull < 100, needWhy: 'Your hull is already at 100%.', act: () => { G.car.hull = clamp(G.car.hull + 30, 0, 100); G.ui.toast(`Hull patched: ${Math.round(G.car.hull)}%.`, 'good'); } },
    { label: 'Tune your hoverboard', price: 80, desc: 'Faster top speed, for good', need: () => G.state.owns.board && !G.state.owns.boardTune, needWhy: () => (G.state.owns.board ? 'Already tuned.' : 'You do not own a hoverboard.'), act: () => { G.state.owns.boardTune = true; G.ui.toast('Board tuned. It will pull harder now.', 'good'); } },
    { label: 'Refurbished jet harness', price: 3200, desc: 'Personal flight. Press J to arm it, hold Space to climb', need: () => !G.state.owns.jetpack, needWhy: 'You already own one.', act: () => { G.state.owns.jetpack = true; G.ui.flash('JET HARNESS'); G.ui.toast('Press J to arm the harness. It recharges on the ground.', 'good'); } },
    { label: 'Refurbished desk lamp', price: 55, decor: 'lamp', desc: 'Delivered to your home' }] },
  books: { clerk: 'Wilhelmina Sato', role: 'bookseller', top: '#4a3f6e', hello: 'Paper. It does not update, it does not listen, and it has never once asked me to rate it.', items: [
    { label: "A page from the explorer's atlas", price: 90, desc: 'Marks one hidden data cache on your map', need: () => G.city.caches.some((c) => !c.found && !G.jobs.revealed.has(c.id)), needWhy: 'You have every page I own.', act: () => { const c = G.city.caches.find((q) => !q.found && !G.jobs.revealed.has(q.id)); G.jobs.reveal(c.id); G.ui.toast('A cache location is now marked on your map.', 'good'); } },
    { label: 'Shelf of paper novels', price: 180, decor: 'books', desc: 'Delivered to your home' },
    { label: 'Framed city print, Meridian 2190', price: 140, decor: 'print', desc: 'Delivered to your home' }] },
};

export class Shops {
  constructor() {
    this.light = new THREE.PointLight(0xfff1d6, 0, 30, 1.5); G.scene.add(this.light);
    this.clerks = []; this.inside = null; this.col = new THREE.Color();
    for (const st of G.city.stores) {
      const cat = CATALOG[st.id]; if (!cat || !st.keeper) continue;
      const seed = hash(st.id + ':clerk');
      const look = varyLook({ kind: 'human', skin: SKINS[seed % 6], hair: HAIRS[(seed >> 3) % 8], hairStyle: (seed >> 6) % 10, top: cat.top, bottom: '#1c1f27', accent: ACCENTS[(seed >> 9) % 6], height: 1.6 + ((seed >> 12) % 28) / 100, build: 0.95 + ((seed >> 17) % 20) / 100, coat: false, visor: false }, seed, {});
      const rig = makeHumanoid(look); rig.root.position.set(st.keeper.x, st.keeper.y, st.keeper.z); rig.root.rotation.y = st.keeper.yaw; rig.root.visible = false; G.scene.add(rig.root);
      const k = { st, rig, cat, greet: 0, talk: 0, pos: new THREE.Vector3(st.keeper.x, st.keeper.y, st.keeper.z), name: cat.clerk, h: look.height + 0.28 };
      this.clerks.push(k);
      G.interact.add({ pos: st.counter, r: 1.9, yTol: 1.6, prio: 0.2, label: () => `Talk to ${cat.clerk}`, use: () => this.menu(k) });
    }
  }
  storeAt(p) { for (const st of G.city.stores) if (p.x > st.lo.x && p.x < st.hi.x && p.z > st.lo.z && p.z < st.hi.z && p.y > st.lo.y - 0.6 && p.y < st.hi.y) return st; return null; }
  menu(k, note) {
    const home = G.state.home; k.talk = 4;
    G.ui.openMenu({ title: k.st.name, who: `${k.cat.clerk} · ${k.cat.role}`, body: note || k.cat.hello, options: [...k.cat.items.map((it) => {
      const owned = it.decor && home.decor[it.decor], blocked = !owned && it.need && !it.need();
      return { label: it.label, desc: owned ? 'Already in your home.' : it.desc, price: owned ? undefined : it.price, disabled: owned || blocked, why: owned ? 'You already have this at home.' : typeof it.needWhy === 'function' ? it.needWhy() : it.needWhy, onPick: () => this.buy(k, it) };
    }), { label: 'Leave', onPick: () => {} }] });
  }
  buy(k, it) {
    const p = G.player;
    if (!G.economy.spend(it.price, it.label.toLowerCase())) return;
    if (it.food) G.food.pocket({ ...it.food });
    if (it.eat) { G.state.stats.meals++; const go = () => { p.energy = clamp(p.energy + it.eat, 0, 100); G.ui.toast(`Energy ${Math.round(p.energy)}%.`, 'good'); }; if (it.mins) G.skip(it.mins, it.eat, false); else go(); }
    if (it.decor) { G.state.home.decor[it.decor] = true; G.home.refresh(); G.ui.toast(G.state.owns.apartment || G.state.owns.villa || G.state.owns.townhouse || G.state.owns.beachvilla ? `${DECOR[it.decor]}: delivered to your home.` : `${DECOR[it.decor]}: held for you until you have a home.`, 'good'); }
    if (it.act) it.act();
    setMood(k.rig, 'happy'); k.greet = 3;
    G.save.write(true);
  }
  update(dt) {
    const p = G.player, here = p.state === 'drive' ? null : this.storeAt(p.pos);
    // the shared lamp fades in where you are, tinted like that shop's panels
    if (here) { this.light.position.set(here.center.x, here.center.y, here.center.z); this.light.color.set(here.lamp); this.light.distance = Math.max(26, (here.hi.x - here.lo.x) * 0.9); }
    this.light.intensity += ((here ? 9 + Math.min(14, here.h * 1.1) : 0) - this.light.intensity) * Math.min(1, dt * 4);
    if (here !== this.inside) { this.inside = here; const k = here && this.clerks.find((c) => c.st === here); if (k && k.greet <= 0) { k.greet = 6; G.ui.say(k, here.id === 'bao' ? 'Come in, come in.' : 'Welcome in. Look around.', 3); } }
    for (const k of this.clerks) {
      const d2 = (k.pos.x - p.pos.x) ** 2 + (k.pos.z - p.pos.z) ** 2, near = d2 < 45 * 45 && Math.abs(k.pos.y - p.pos.y) < 12;
      k.rig.root.visible = near; if (!near) continue;
      k.greet -= dt; k.talk -= dt;
      const face = d2 < 60 ? Math.atan2(p.pos.x - k.pos.x, p.pos.z - k.pos.z) - k.st.keeper.yaw : 0;
      k.rig.lookYaw += (clamp(Math.atan2(Math.sin(face), Math.cos(face)), -1, 1) - k.rig.lookYaw) * Math.min(1, dt * 5);
      if (k.greet <= 0 && k.rig.mood !== 'neutral') setMood(k.rig, 'neutral');
      animateRig(k.rig, dt, k.talk > 0 || G.ui.menu && k.talk > -1 ? 'talk' : k.greet > 4.5 ? 'wave' : 'idle', 0);
    }
  }
}
