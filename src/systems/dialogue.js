// Talking to residents. Every conversation reads and writes that person's memory of you:
// whether you have met, how often you talk, gifts, bumps, favors. Reputation changes what
// they say and how they greet you in the street.
import { G } from '../core/game.js';
import { greeting, chatLine, TIPS } from '../data/people.js';
import { clamp, RNG } from '../core/util.js';

const relation = (r) => (r >= 40 ? 'friend' : r >= 15 ? 'friendly' : r > -10 ? 'acquaintance' : 'wary of you');

export class Dialogue {
  constructor() { this.rng = new RNG(7); this.npc = null; }
  rep(npc, d, what) {
    const m = npc.mem; m.rep = clamp(m.rep + d, -100, 100);
    if (what && Math.abs(d) >= 8) G.npcs.gossip(npc, d, what); // their friends will hear about it
    G.state.standing = clamp(G.state.standing + d * 0.25, -100, 100);
    if (d > 0) npc.feel('happy', 6);
  }
  start(npc) {
    const p = G.player, m = npc.mem;
    this.npc = npc; npc.converse = true; npc.faceYaw = npc.faceTo(p.pos.x, p.pos.z);
    if (p.state === 'walk') { p.yaw = Math.atan2(npc.pos.x - p.pos.x, npc.pos.z - p.pos.z); p.vel.set(0, 0, 0); }
    if (m.lastDay !== G.env.day) m.today = 0;
    const line = greeting(npc, m, G.env, G.state.name);
    if (!m.met) { m.met = true; this.rep(npc, 3); }
    m.talks++; m.lastDay = G.env.day;
    this.show(line);
  }
  end() {
    const n = this.npc; this.npc = null;
    if (n) { n.converse = false; n.faceYaw = n.doing && n.doing.face !== undefined ? n.doing.face : null; n.cool.wave = 60; }
  }
  show(text) {
    const n = this.npc, m = n.mem, st = G.state, opts = [], jobs = G.jobs;
    if (jobs.courier && jobs.courier.to === n) opts.push({ label: `Hand over the ${jobs.courier.what}`, onPick: () => { jobs.deliverParcel(); this.rep(n, 8, 'brought over a delivery'); this.show(jobs.lastThanks); } });
    opts.push({ label: 'Chat', onPick: () => { if (m.today < 3) this.rep(n, 2); m.today++; this.show(chatLine(n, G.env, this.rng)); } });
    if (n.lines.length) opts.push({ label: n.android ? 'Ask about its function' : n.child ? 'Ask what he is up to' : 'Ask about their work', onPick: () => { if (!m.asked) { m.asked = true; this.rep(n, 2); } m.k = (m.k || 0) + 1; this.show(n.lines[m.k % n.lines.length]); } });
    if (!n.role && !n.child) opts.push({ label: 'Ask what is worth seeing around here', onPick: () => this.tip() });
    if (n.role === 'host') opts.push({ label: 'See the menu', onPick: () => { this.end(); G.food.openMenu(); } });
    if (n.role === 'chef') opts.push({ label: 'Work a shift on the print line', desc: 'Timing minigame. Pays by print quality.', onPick: () => { this.end(); jobs.startShift(); } });
    if (n.role === 'clerk') opts.push({ label: 'Browse companions', onPick: () => { this.end(); G.economy.shopMenu(); } });
    if (n.role === 'clerk') opts.push({ label: 'Work the diagnostics bench', desc: 'Technician job: repeat each unit\'s fault pattern. Pays per unit cleared.', onPick: () => { this.end(); G.arcade.startDiag(); } });
    for (const it of n.def.shop || []) opts.push({ label: it.label, price: it.price, onPick: () => { if (it.item.gift && st.inventory.length >= 6) return this.show('Your pockets are full.'); if (G.economy.spend(it.price, it.item.name)) { G.food.pocket({ ...it.item }); this.show(it.say); } else this.show('Come back when you have the credits.'); } });
    if (n.role === 'aerodealer') { opts.push({ label: 'Vehicle exchange and tuning', onPick: () => { this.end(); G.garage.menu(); } }); opts.push({ label: 'Fly the Aeroport Speed Loop', desc: `One lap of the field, twelve rings. Your best: ${st.best.loop ? st.best.loop.toFixed(1) + ' s' : 'none yet'}.`, onPick: () => { this.end(); G.world.armLoop(); } }); }
    if (n.role === 'vrhost') opts.push({ label: 'Enter the Sim Arena', price: 15, onPick: () => { this.end(); G.world.startVR(); } });
    if (n.role === 'qa') opts.push({ label: 'Work a line QA shift', desc: 'Pull defective crates off the belt. Pays per defect.', onPick: () => { this.end(); G.world.startQA(); } });
    if (n.role === 'ops') opts.push({ label: 'Flight Ops: jobs and services', onPick: () => { this.end(); jobs.flightOps(); } });
    if (n.role === 'vendor') opts.push({ label: 'Buy hand-folded dumplings', price: 9, onPick: () => { const ok = G.food.buyStreet(); this.show(ok ? 'Careful, they are hot. Six to a box, folded this morning.' : 'Come back when your wallet has recovered.'); } });
    const stall = n.role && n.role.startsWith('stall') ? [['Buy a Lumen pear', 7, { name: 'Lumen pear', energy: 12 }, 'Printed this afternoon. The glow fades when it is ripe.'], ['Buy night skewers', 11, { name: 'Night skewers', energy: 24 }, 'Cultivated, grilled over real charcoal. The charcoal is the expensive part.'], ['Buy a glow bouquet', 25, { name: 'Glow bouquet', energy: 0, gift: true }, 'They glow for a week. Give them to someone before then.']][+n.role.slice(5)] : null;
    if (stall) opts.push({ label: stall[0], price: stall[1], onPick: () => { if (st.inventory.length >= 6 && stall[2].gift) return this.show('Your pockets are full. Eat something first, or give something away.'); if (G.economy.spend(stall[1], stall[2].name)) { G.food.pocket({ ...stall[2] }); this.show(stall[3]); } else this.show('Come back when you have the credits.'); } });
    if (n.role === 'wellness') opts.push({ label: 'Join the morning session', desc: 'Follow along for a while', disabled: !(n.act === 'post' && n.doing), why: 'Sessions run from 06:10 on the dance floor.', onPick: () => { this.end(); G.player.play('taichi', 16); let c = 0; for (const o of G.npcs.list) if (o.act === 'exercise' && o.doing && o.doing.anim === 'taichi') { o.mem.rep = clamp(o.mem.rep + 2, -100, 100); c++; } st.standing = clamp(st.standing + 1, -100, 100); G.ui.toast(c ? `You follow Sol through the form. ${c} neighbors nod at you.` : 'You follow Sol through the form.', 'good'); } });
    const gi = Math.max(0, st.inventory.findIndex((x) => x.gift));
    if (st.inventory.length && n.body === 'humanoid' && !n.android && !stall) opts.push({ label: `Offer your ${st.inventory[gi].name}`, desc: st.inventory[gi].gift ? 'A proper gift' : 'A small gift', onPick: () => { const it = st.inventory.splice(gi, 1)[0]; m.gifts++; this.rep(n, it.gift ? 18 : m.gifts <= 3 ? 10 : 3, 'gave them a gift'); this.show(it.gift ? 'For me? They are beautiful. Thank you!' : n.child ? 'For me? Thanks!' : 'That is kind of you. Thank you.'); } });
    opts.push({ label: 'Goodbye', onPick: () => this.end() });
    G.ui.openMenu({ title: n.name, who: `${n.job} · ${relation(m.rep)}`, body: text, options: opts, onClose: () => this.end() });
  }
  tip() {
    const n = this.npc, open = TIPS.filter(([, i]) => !G.city.caches[i].found);
    if (!open.length) return this.show('You have already found everything I know about.');
    const [text, i] = this.rng.pick(open);
    G.jobs.reveal(i);
    this.show(text + ' I have marked it on your lens map.');
  }
}
