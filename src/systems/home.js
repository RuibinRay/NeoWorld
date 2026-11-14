// Life at home, in the Halcyon sky pod and the Skyhaven villa: a kitchen printer and pantry, a work
// terminal, lighting themes, a turntable, and the furnishings bought in the shops.
import { G } from '../core/game.js';
import { clamp } from '../core/util.js';

// Homes you can buy with cash and also rent out: the rent is paid every morning, and while tenants live there you cannot use it.
export const PROPS = {
  townhouse: { name: 'Arbor Heights townhouse', short: 'townhouse', price: 16000, rent: 160, flash: 'HOME ON THE HEIGHTS', sale: 'For sale · two floors, front garden', blurb: 'A brick-and-stucco townhouse on a quiet street in Arbor Heights, five minutes from the green and the M3 bus. Kitchen, bed and wardrobe included; your furnishings are moved in for you.', hello: 'Two floors, a hedge, and neighbours who wave.' },
  beachvilla: { name: 'Solara Bay beach villa', short: 'beach villa', price: 26000, rent: 310, flash: 'A HOUSE BY THE SEA', sale: 'For sale · roof terrace, pool, sea view', blurb: 'A white villa across Shoreline Drive from the sand: open-plan ground floor, a roof terrace with loungers, a pool in the garden. Furnished; your things are moved in for you.', hello: 'The sea is right there. It has been all day.' },
};
const THEMES = [['Warm', 0xffe9cf, '#ffcf9a', 1], ['Daylight', 0xf2f6ff, '#cfe9ff', 1.1], ['Neon', 0xff8ae0, '#59e0ff', 0.9], ['Dim', 0xffb070, '#ff9a52', 0.45]];

export class Home {
  constructor() {
    const I = G.interact, ap = G.city.places.apartment, v = G.districts.byId.skyhaven.things.villa;
    const th = G.metro.suburb.home, bv = G.metro.beachVilla;
    this.places = [{ key: 'apartment', name: 'sky pod', p: ap }, { key: 'villa', name: 'villa', p: v }, { key: 'townhouse', name: 'townhouse', p: th }, { key: 'beachvilla', name: 'beach villa', p: bv }];
    this.playing = null; this.teaAt = -1e9;
    // a home you can use: owned, and not rented out
    const own = (key) => G.state.owns[key] && !G.state.home.rent[key], forSale = (key) => G.ui.toast(G.state.owns[key] ? 'Your tenants live here now. Stop renting at the console to move back in.' : 'This home is for sale at its console.', 'info');
    for (const h of this.places) {
      I.add({ pos: h.p.kitchen, r: 1.6, label: 'Kitchen printer', use: () => (own(h.key) ? this.kitchen() : forSale(h.key)) });
      I.add({ pos: h.p.turntable, r: 1.5, label: () => (this.playing === h ? 'Stop the record' : 'Play a record'), enabled: () => own(h.key) && G.state.home.decor.records, use: () => { this.playing = this.playing === h ? null : h; G.ui.toast(this.playing ? 'Side A. The needle drops.' : 'The record stops.', 'info'); } });
      G.musicSpots.push({ x: h.p.music.x, z: h.p.music.z, on: () => this.playing === h && Math.abs(G.player.pos.y - h.p.kitchen.y) < 8 });
    }
    I.add({ pos: ap.desk, r: 1.5, label: 'Work terminal', use: () => (own('apartment') ? this.terminal() : forSale('apartment')) });
    I.add({ pos: v.wardrobe, r: 1.6, label: 'Wardrobe', use: () => (own('villa') ? G.economy.wardrobe() : forSale('villa')) });
    // the townhouse and the beach villa: bought (and rented out) at their consoles
    for (const [key, p] of [['townhouse', th], ['beachvilla', bv]]) {
      const P = PROPS[key];
      I.add({ pos: p.wardrobe, r: 1.5, label: 'Wardrobe', use: () => (own(key) ? G.economy.wardrobe() : forSale(key)) });
      I.add({ pos: p.bed, r: 1.8, label: () => (own(key) ? 'Sleep until morning' : G.state.owns[key] ? 'Bed (your tenants\' now)' : `Bed (the ${P.short} is for sale at the console)`), use: () => (own(key) ? G.economy.sleep() : forSale(key)) });
      I.add({ pos: p.console, r: 1.6, label: `${P.short[0].toUpperCase() + P.short.slice(1)} console`, use: () => this.property(key) });
    }
    this.refresh();
  }
  // furnishings you own are shown in every home; the lighting theme is applied
  refresh() {
    const d = G.state.home.decor, t = THEMES[G.state.home.theme % THEMES.length], ap = G.city.places.apartment, v = G.districts.byId.skyhaven.things.villa;
    for (const h of this.places) for (const key in h.p.decor) h.p.decor[key].visible = !!d[key];
    ap.lamp.color.setHex(t[1]); ap.lamp.intensity = 8 * t[3]; ap.cove.color.set(t[2]); v.room.lamp = t[2]; G.metro.suburb.home.room.lamp = t[2]; G.metro.beachVilla.room.lamp = t[2];
  }
  property(key) {
    const s = G.state, P = PROPS[key], rent = s.home.rent;
    if (s.owns[key]) {
      const rented = !!rent[key], other = Object.keys(PROPS).some((k) => k !== key && s.owns[k] && !rent[k]) || s.owns.apartment || s.owns.villa;
      return G.ui.openMenu({ title: P.name, who: rented ? `Yours · rented out for ◈${P.rent} a day` : 'Yours', body: rented ? 'Your tenants pay every morning. They keep the place tidy and water the plants, mostly.' : `Good ${G.env.hour < 12 ? 'morning' : 'evening'}, ${s.name}. ${P.hello}`, options: [
        rented ? { label: 'Stop renting it out', desc: 'Your tenants leave tonight and the home is yours to use again', onPick: () => { rent[key] = false; G.ui.toast(`The ${P.short} is yours again.`, 'good'); G.save.write(true); } }
          : { label: `Rent it out for ◈${P.rent} a day`, desc: 'Paid every morning. You cannot use the home while tenants live there.', disabled: !other, why: 'Keep at least one home for yourself.', onPick: () => { rent[key] = true; G.state.done.landlord = true; G.ui.toast(`Tenants move in tomorrow. ◈${P.rent} every morning.`, 'good'); G.save.write(true); } },
        ...(rented ? [] : [{ label: 'CivicLink: jobs and notices', onPick: () => G.jobs.board() }, { label: 'Investments', onPick: () => G.economy.investMenu() }]), { label: 'Close', onPick: () => {} }] });
    }
    G.ui.openMenu({ title: P.name, who: P.sale, body: P.blurb, options: [
      { label: `Buy the ${P.short}`, price: P.price, onPick: () => { if (G.economy.spend(P.price, P.name)) { s.owns[key] = true; G.ui.flash(P.flash); G.save.write(true); } } }, { label: 'Not today', onPick: () => {} }] });
  }
  kitchen() {
    const s = G.state, p = G.player, home = s.home, inv = s.inventory, teaReady = G.elapsed - this.teaAt > 75;
    G.ui.openMenu({ title: 'Kitchen', who: 'Home printer and pantry', body: `Pantry: ${home.pantry.length} of 12. Pockets: ${inv.length} of 6.`, options: [
      { label: 'Print a home-cooked plate', desc: '+45% energy. A fraction of what a restaurant charges', price: 5, onPick: () => { if (G.economy.spend(5, 'home-cooked plate')) { p.energy = clamp(p.energy + 45, 0, 100); s.stats.meals++; p.play('snack', 2.6); G.ui.toast(`Energy ${Math.round(p.energy)}%.`, 'good'); } } },
      ...(home.decor.tea ? [{ label: 'Brew a cup of eden tea', desc: '+8% energy', disabled: !teaReady, why: 'The pot is still steeping.', onPick: () => { this.teaAt = G.elapsed; p.energy = clamp(p.energy + 8, 0, 100); p.play('snack', 2.2); G.ui.toast('Smoked, green, quiet.', 'good'); } }] : []),
      { label: 'Put pocket food in the pantry', disabled: !inv.length || home.pantry.length >= 12, why: inv.length ? 'The pantry is full.' : 'Your pockets are empty.', onPick: () => { while (inv.length && home.pantry.length < 12) home.pantry.push(inv.shift()); G.ui.toast(`Pantry: ${home.pantry.length} of 12.`, 'info'); this.kitchen(); } },
      { label: 'Fill your pockets from the pantry', disabled: !home.pantry.length || inv.length >= 6, why: home.pantry.length ? 'Your pockets are full.' : 'The pantry is empty.', onPick: () => { while (home.pantry.length && inv.length < 6) inv.push(home.pantry.shift()); G.ui.toast(`Pockets: ${inv.length} of 6.`, 'info'); this.kitchen(); } },
      { label: `Lighting: ${THEMES[home.theme % THEMES.length][0]}`, desc: 'Warm, Daylight, Neon or Dim', onPick: () => { home.theme = (home.theme + 1) % THEMES.length; this.refresh(); this.kitchen(); } },
      { label: 'Close', onPick: () => {} }] });
  }
  terminal() {
    G.ui.openMenu({ title: 'Work terminal', who: 'Sky pod 41-07', body: 'Everything the city asks of you, without the walk.', options: [
      { label: 'CivicLink: jobs and notices', onPick: () => G.jobs.board() },
      { label: 'Investments', onPick: () => G.economy.investMenu() },
      { label: 'Districts and shuttle', onPick: () => G.world.districtMenu() },
      { label: 'Close', onPick: () => {} }] });
  }
  update(dt, t) {
    // rent, paid each morning for every home that is rented out (at most three days are made up after a long sleep)
    const h = G.state.home, day = G.env.day;
    if (!h.rentDay) h.rentDay = day;
    if (day > h.rentDay && G.started) { const days = Math.min(3, day - h.rentDay); h.rentDay = day; let sum = 0; for (const k in PROPS) if (G.state.owns[k] && h.rent[k]) sum += PROPS[k].rent * days; if (sum) { G.state.done.rentPaid = true; G.economy.earn(sum, days > 1 ? `rent for ${days} days` : 'rent from your tenants'); } }
    // the fish in the aquarium drift
    for (const h of this.places) { const a = h.p.decor.aquarium; if (a.visible && Math.abs(G.player.pos.y - h.p.kitchen.y) < 8) a.userData.fish.forEach((f, i) => { f.position.x = Math.sin(t * (0.4 + i * 0.13) + i * 2) * 0.55; f.position.z = Math.cos(t * 0.5 + i) * 0.1; }); }
  }
}
