// Save / load to the browser's local storage. One slot, autosaved, with a backup of the previous
// session's save that is used automatically if the main one cannot be read.
import { G } from '../core/game.js';
import { PHOTO_KEY, PHOTO_MAX } from './gallery.js';

// ?slot=name in the URL selects a separate save slot (used for testing without touching the main save).
const KEY = 'neoearth2226.save.v1' + (new URLSearchParams(location.search).get('slot') || '');
const BAK = KEY + '.bak';
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const valid = (d) => !!d && d.v === 1 && !!d.state && !!d.env && !!d.player && !!d.car && num(d.player.x) && num(d.player.y) && num(d.player.z) && num(d.car.x) && num(d.car.y) && num(d.car.z) && num(d.env.mins);
const pct = (v, def) => (num(v) ? Math.min(100, Math.max(0, v)) : def);
export function defaultState() {
  return {
    name: 'Resident', wallet: 600, standing: 0,
    owns: { apartment: false, dog: false, aster: false, board: false, villa: false, jetpack: false, beacon: true, boardTune: false, jetski: false, townhouse: false, beachvilla: false },   // the phone has the gate beacon built in
    home: { decor: {}, theme: 0, pantry: [], rent: {}, rentDay: 0 }, gates: {}, done: {}, street: { sat: false, parcels: 0, litter: 0, wheel: false },
    picked: {}, museum: [],
    asterDay: 0,
    garage: { owned: ['wisp'], active: 'wisp', tune: {}, paint: {}, cond: {}, out: [] },   // out: vehicles parked round the city besides the one you drive
    invest: { cart: false, stall: false, petal: false }, payDay: 1,
    bot: { motor: 0, armor: 0, boost: 0 },   // upgrades for your Bot Arena robot
    story: { m: 0, step: -1, choice: null, warden: 0, fault: -1, faultAt: 0, heard: false },   // the story: mission index, step (-1: not begun), the finale's choice, grid warden jobs
    dog: { name: 'Volt', color: '#e6ebf2', accent: '#59e0ff' },
    inventory: [],            // food pods: { id, name, energy }
    people: {},               // per-resident memory: { rep, met, talks, lastDay, bumped, gifts, tipped }
    best: { race: null, shift: 0, gp: null, slalom: null, hoops: 0, dance: 0, vr: 0, loop: null, bowl: 0, darts: 0, fish: 0, breaker: 0, dodge: 0, jetski: null, volley: 0, court: 0, canal: null, street: null, skyline: null, botcup: 0 },
    caches: [],
    stats: { fares: 0, deliveries: 0, meals: 0, shifts: 0, fines: 0, races: 0, cargo: 0, droneDrops: 0, repairs: 0, gp: 0, slalom: 0 },
    heroes: { raids: 0, boss: 0, used: {}, kos: 0 },   // Hero Mode
  };
}
export const Save = {
  recovered: false, backedUp: false,
  has() { try { return !!(localStorage.getItem(KEY) || localStorage.getItem(BAK)); } catch { return false; } },
  write(silent) {
    if (this.locked) return false;   // a save file is being loaded: keep it as it is
    const p = G.player, c = G.car, e = G.env, pp = p.state === 'ride' ? (G.coastLine && G.coastLine.safeSpot()) || (G.orbital && G.orbital.safeSpot()) || (G.coast && G.coast.safeSpot()) || (G.rides && G.rides.safeSpot()) || G.transit.safeSpot() : p.pos;
    const data = {
      v: 1, map: 2, state: G.state, env: { day: e.day, mins: e.mins, weather: e.weather },
      player: { x: pp.x, y: pp.y, z: pp.z, yaw: p.yaw, energy: p.energy, look: G.heroes && G.heroes.on && G.heroes.ownLook ? G.heroes.ownLook : p.look, driving: p.state === 'drive' },
      car: { x: c.pos.x, y: c.pos.y, z: c.pos.z, yaw: c.yaw, battery: c.battery, hull: c.hull, paint: c.paint },
    };
    if (!valid(data)) { if (!silent) G.ui.toast('Not saved: the game is in an unusual state. Try again in a moment.', 'warn'); return false; }
    try {
      // the first save of a session keeps the previous session's save as a restore point
      if (!this.backedUp) { this.backedUp = true; const old = localStorage.getItem(KEY); if (old) localStorage.setItem(BAK, old); }
      localStorage.setItem(KEY, JSON.stringify(data)); if (!silent) G.ui.toast('Game saved.', 'good'); return true;
    }
    catch { if (!silent) G.ui.toast('Could not save (browser storage unavailable).', 'warn'); return false; }
  },
  read() {
    for (const k of [KEY, BAK]) {
      try { const d = JSON.parse(localStorage.getItem(k)); if (valid(d)) { this.recovered = k === BAK; return d; } } catch { /* unreadable: try the backup */ }
    }
    return null;
  },
  // Apply a save to the running world. Returns false if there is nothing to load.
  load() {
    const d = this.read(); if (!d) return false;
    const def = defaultState();
    G.state = { ...def, ...d.state, owns: { ...def.owns, ...d.state.owns }, dog: { ...def.dog, ...d.state.dog }, best: { ...def.best, ...d.state.best }, stats: { ...def.stats, ...d.state.stats }, street: { ...def.street, ...d.state.street } };
    const sg = d.state.garage || {};
    G.state.garage = { ...def.garage, ...sg, tune: { ...sg.tune }, paint: { ...sg.paint }, cond: { ...sg.cond }, out: Array.isArray(sg.out) ? sg.out : [] };
    G.state.invest = { ...def.invest, ...d.state.invest };
    G.state.story = { ...def.story, ...d.state.story };
    G.state.heroes = { ...def.heroes, ...d.state.heroes, used: { ...(d.state.heroes || {}).used } };
    const sh = d.state.home || {}; G.state.home = { decor: { ...sh.decor }, theme: sh.theme | 0, pantry: Array.isArray(sh.pantry) ? sh.pantry : [], rent: { ...sh.rent }, rentDay: sh.rentDay | 0 };
    G.state.gates = { ...d.state.gates }; G.state.done = { ...d.state.done }; G.state.owns.beacon = true;
    G.state.best = { ...def.best, ...d.state.best };
    if (!num(G.state.wallet)) G.state.wallet = def.wallet; if (!num(G.state.standing)) G.state.standing = 0;
    if (!Array.isArray(G.state.inventory)) G.state.inventory = []; if (!G.state.people || typeof G.state.people !== 'object') G.state.people = {};
    G.car.setModel(G.state.garage.active);
    const e = G.env; e.day = d.env.day; e.mins = d.env.mins; e.setWeather(d.env.weather, true);
    const c = G.car, col = G.colliders;
    c.pos.set(d.car.x, d.car.y, d.car.z); c.yaw = d.car.yaw; c.battery = pct(d.car.battery, 100); c.hull = pct(d.car.hull, 100); c.setPaint(d.car.paint); c.vel.set(0, 0, 0);
    c.pos.y = col.groundAt(c.pos.x, c.pos.z, c.pos.y, 0.6, 1.3) + c.ride; c.mode = 'parked';
    const p = G.player; p.setLook(d.player.look); p.energy = pct(d.player.energy, 70); p.yaw = p.camYaw = d.player.yaw;
    if (d.player.driving) { p.pos.set(c.pos.x + Math.cos(c.yaw) * 2.7, c.pos.y - c.ride, c.pos.z - Math.sin(c.yaw) * 2.7); }
    else p.pos.set(d.player.x, d.player.y, d.player.z);
    // Saves from before the street grid: four districts moved by 10 m to line up with it. Anyone (or any
    // vehicle) saved inside a ground district is put at that district's gate kiosk or landing pad.
    if ((d.map || 1) < 2) for (const q of G.districts.list) {
      if (q.y > 100) continue;
      if (Math.abs(p.pos.x - q.x) < 205 && Math.abs(p.pos.z - q.z) < 205 && p.pos.y < 120) p.pos.set(q.kiosk.x + 1.5, q.kiosk.y + 0.2, q.kiosk.z + 1.5);
      if (Math.abs(c.pos.x - q.x) < 205 && Math.abs(c.pos.z - q.z) < 205 && c.pos.y < 120) { c.pos.set(q.pad.x, q.pad.y + c.ride, q.pad.z); if (d.player.driving) p.pos.set(c.pos.x + 2.7, c.pos.y - c.ride, c.pos.z); }
    }
    p.vel.set(0, 0, 0);
    return true;
  },
  clear() { try { localStorage.removeItem(KEY); localStorage.removeItem(BAK); } catch { /* ignore */ } },
};

// Save files: your progress and your photos as one JSON file, to keep somewhere safe or to carry on
// in another browser (each browser, and the standalone copy, keeps its own save).
const APP = 'NEO EARTH 2226';
const slug = (t) => String(t || 'resident').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'resident';
export const summary = (d) => `${d.state.name || 'Resident'} · day ${d.env.day} · ◈${Math.round(d.state.wallet) || 0}`;
export const SaveFile = {
  download() {
    if (G.started && !Save.write(true)) { G.ui.toast('Could not save just now, so no file was made. Try again in a moment.', 'warn'); return false; }
    const d = Save.read(); if (!d) { G.ui.toast('There is no saved game to put in a file yet.', 'warn'); return false; }
    const photos = G.gallery ? G.gallery.list : [];
    const blob = new Blob([JSON.stringify({ app: APP, kind: 'save', v: 1, saved: new Date().toISOString(), save: d, photos })], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `neo-earth-2226-${slug(d.state.name)}-day-${d.env.day}.json`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    G.ui.toast(`Save file made: ${a.download} (${photos.length} photo${photos.length === 1 ? '' : 's'} in it).`, 'good');
    return true;
  },
  // ask for a file; cb gets { save, photos, summary, saved } or { error }
  pick(cb) {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = () => { const f = inp.files && inp.files[0]; if (f) this.parse(f).then(cb); };
    inp.click();
  },
  async parse(file) {
    const bad = { error: 'That file is not a NEO EARTH 2226 save file.' };
    if (!file || file.size > 30e6) return bad;
    let d; try { d = JSON.parse(await file.text()); } catch { return bad; }
    if (!d || d.app !== APP || d.kind !== 'save' || !valid(d.save)) return bad;
    const photos = (Array.isArray(d.photos) ? d.photos : []).filter((p) => p && typeof p.src === 'string' && p.src.startsWith('data:image/') && typeof p.label === 'string');
    return { save: d.save, photos, summary: summary(d.save), saved: typeof d.saved === 'string' ? d.saved : '' };
  },
  // put the file's game in place of the one in this browser (which becomes the backup save), add its
  // photos to yours (newest twelve kept), and restart at the title screen
  apply(f) {
    try {
      const old = localStorage.getItem(KEY); if (old) localStorage.setItem(BAK, old);
      localStorage.setItem(KEY, JSON.stringify(f.save));
    } catch { return false; }
    Save.locked = true;
    if (f.photos.length) {
      let mine = []; try { const l = JSON.parse(localStorage.getItem(PHOTO_KEY)); if (Array.isArray(l)) mine = l; } catch { /* none */ }
      const seen = new Set(), all = [...f.photos, ...mine].filter((p) => { const id = `${p.at}:${p.src.length}`; return !seen.has(id) && seen.add(id); }).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, PHOTO_MAX);
      while (all.length) { try { localStorage.setItem(PHOTO_KEY, JSON.stringify(all)); break; } catch { all.pop(); } }
    }
    location.reload();
    return true;
  },
};
