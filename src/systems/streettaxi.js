// Street taxi shifts: drive your own vehicle on the roads, pick people up at the kerb and take
// them across the city. The fare grows with the distance along the streets; a quick, careful ride
// earns a tip. Red lights and knocks cost you stars; flying with a fare aboard halves it.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { RNG } from '../core/util.js';
import { blockOf, P } from '../world/metro/landuse.js';
import { eSeg, sSeg, ranRed } from '../world/metro/streets.js';
import { findRoute } from '../world/metro/route.js';

const LINES = { hello: ['Evening. Thanks for stopping.', 'Finally, a real driver.', 'Could you keep it gentle? Long day.', 'I am late, if that helps.', 'Nice car. Is it yours?'], good: ['Smooth. Five stars.', 'That was quick. Keep the change.', 'Best ride I have had all week.'], bad: ['I will be walking next time.', 'Was that light red? It looked red.', 'My coffee is now on my shirt.'] };
export class StreetTaxi {
  constructor() {
    this.rng = new RNG(1717); this.shift = null; this.v = new THREE.Vector3();
    // where people ask to go: named places all over the new city
    this.places = () => [
      ...G.metro.bus.lines.flatMap((l) => l.stops.map((s) => ({ name: `${s.name}, ${s.area}`, x: s.x, z: s.z }))),
      { name: 'the Solara Bay boardwalk', x: 810, z: 1144 }, { name: 'Tidewater Fish Market', x: -362, z: 1150 }, { name: 'Arbor Heights green', x: -720, z: -660 },
      { name: 'the Grand Arbor Park north gate', x: 720, z: 420 }, { name: 'the Glasshouse', x: 870, z: 790 }, { name: 'the weekend market plaza', x: G.happen.market.plaza.cx, z: G.happen.market.plaza.cz - 62 },
      { name: 'the Skyhaven lift', x: G.roads.lift.ground.x, z: G.roads.lift.ground.z }, { name: 'the Canal Dash pontoon', x: 366, z: 640 },
      ...(G.metro.expo ? [{ name: 'Skyhaven Stadium', x: G.metro.expo.gate.x, z: G.metro.expo.gate.z + 20 }, { name: 'the Expo Hall', x: G.metro.expo.plaza.x, z: G.metro.expo.plaza.z }] : []),
    ];
    if (G.figureHooks) G.figureHooks.push((A, focus) => this.figures(A, focus));
  }
  // a kerbside spot on a street 150 to 400 m from (x, z)
  kerb(x, z) {
    const r = this.rng;
    for (let k = 0; k < 40; k++) {
      const a = r.range(0, 6.283), d = r.range(150, 400), i = blockOf(x + Math.cos(a) * d), j = blockOf(z + Math.sin(a) * d), b = G.metro.block(i, j);
      if (!b || !b.y0 || b.cut) continue;
      const side = r.int(0, 3), t = r.range(-30, 30), seg = [sSeg(i, j - 1), sSeg(i, j), eSeg(i - 1, j), eSeg(i, j)][side];
      if (seg !== 'street') continue;
      const px = b.cx + [t, t, -48.5, 48.5][side], pz = b.cz + [-48.5, 48.5, t, t][side];
      return { x: px, y: b.y0, z: pz, yaw: Math.atan2(-[0, 0, -1, 1][side], -[-1, 1, 0, 0][side]), look: r.int(0, 17) };
    }
    return null;
  }
  start() {
    if (this.shift) return;
    if (G.jobs) { G.jobs.endTaxi(); G.jobs.endRace(); }
    this.shift = { fares: 0, earned: 0, fare: null };
    G.ui.toast('Street taxi shift: drive on the roads. Fares wait at the kerb, marked on your map. End the shift at any CivicLink terminal or in the phone\'s Jobs app.', 'good');
    this.next();
  }
  next() {
    const s = this.shift, from = G.player.state === 'drive' ? G.car.pos : G.player.pos, k = this.kerb(from.x, from.z);
    if (!k) { s.fare = null; s.retry = 3; return; }
    s.fare = { phase: 'pickup', at: k, to: null, t: 0, est: 0, len: 0, pen: 0, knocks: 0, flew: false, prev: new THREE.Vector3() };
    G.metro.setRoute(k.x, k.z, from);
  }
  end(msg) { const s = this.shift; if (!s) return; this.shift = null; G.metro.route = null; G.ui.setObjective(null); G.ui.toast(msg || `Shift over: ${s.fares} fares, ◈${s.earned}.`, 'good'); }
  markers() { const f = this.shift && this.shift.fare; if (!f) return []; const p = f.phase === 'pickup' ? f.at : f.to; return [{ x: p.x, z: p.z, color: f.phase === 'pickup' ? '#ffd34d' : '#7dff9c' }]; }
  figures(A, focus) { const f = this.shift && this.shift.fare; if (f && f.phase === 'pickup') A.put('taxi', f.at.x, f.at.y, f.at.z, f.at.yaw, f.at.look, 'wave', G.elapsed * 3, focus); else if (f && f.phase === 'leave' && f.walk > 0) A.put('taxi', f.out.x, f.out.y, f.out.z, f.out.yaw, f.out.look, 'walk', G.elapsed * 5, focus); }
  update(dt, t) {
    const s = this.shift; if (!s) return;
    if (!s.fare) { s.retry -= dt; if (s.retry <= 0) this.next(); return; }
    const f = s.fare, car = G.car, p = G.player, driving = p.state === 'drive', ground = driving && car.mode !== 'fly' && car.pos.y - car.ride < 1.5, slow = car.speed < 3;
    if (f.phase === 'pickup') {
      const d = Math.hypot(car.pos.x - f.at.x, car.pos.z - f.at.z);
      if (driving && d < 9 && slow && ground) {
        // aboard: pick somewhere 500 m to 1.6 km away by road
        const cands = this.places().map((q) => ({ q, r: findRoute(f.at.x, f.at.z, q.x, q.z) })).filter((c) => c.r && c.r.len > 500 && c.r.len < 1600);
        const c = cands.length ? this.rng.pick(cands) : null; if (!c) { this.next(); return; }
        f.phase = 'ride'; f.to = c.q; f.len = c.r.len; f.est = 20 + c.r.len / 11; f.t = 0; f.knocks = car.knocks || 0; f.prev.copy(car.pos);
        G.metro.setRoute(c.q.x, c.q.z, car.pos); G.ui.say({ pos: car.pos, h: 2.4 }, this.rng.pick(LINES.hello), 3);
        G.ui.toast(`Take them to ${c.q.name}: ${(c.r.len / 1000).toFixed(1)} km by road. The route is on your map.`, 'info'); if (G.audio) G.audio.blip(660, 0.08);
      }
      G.ui.setObjective({ title: 'Street taxi', text: `Fare waiting ${Math.round(d)} m away`, sub: d < 30 ? 'Pull up beside them and stop.' : 'Follow the route on your map. Stay on the roads.' });
    } else if (f.phase === 'ride') {
      f.t += dt;
      if (driving && ranRed(f.prev.x, f.prev.z, car.pos.x, car.pos.z, t)) { f.pen++; G.ui.say({ pos: car.pos, h: 2.4 }, 'That was red!', 2); }
      if (driving && car.mode === 'fly' && car.pos.y - car.ride > 4 && !f.flew) { f.flew = true; G.ui.toast('Your fare: "This is a street taxi. Down, please." Half fare now.', 'warn'); }
      f.prev.copy(car.pos);
      const d = Math.hypot(car.pos.x - f.to.x, car.pos.z - f.to.z);
      if (driving && d < 12 && slow && ground) {
        const knocks = (car.knocks || 0) - f.knocks, stars = Math.max(1, 5 - f.pen - knocks - (f.t > f.est * 1.5 ? 1 : 0));
        let pay = Math.round(18 + f.len * 0.055); if (f.flew) pay = Math.round(pay / 2);
        const tip = stars >= 5 && f.t < f.est ? Math.round(pay * 0.35) : stars >= 4 ? Math.round(pay * 0.15) : 0;
        G.economy.earn(pay + tip, `fare, ${'★'.repeat(stars)}${tip ? ` with a ◈${tip} tip` : ''}`); s.earned += pay + tip; s.fares++; G.state.stats.fares = (G.state.stats.fares || 0) + 1; G.state.done.streetFares = (G.state.done.streetFares || 0) + 1;
        G.ui.say({ pos: car.pos, h: 2.4 }, this.rng.pick(stars >= 4 ? LINES.good : LINES.bad), 3);
        const yaw = car.yaw + Math.PI / 2; f.phase = 'leave'; f.walk = 4; f.out = { x: car.pos.x + Math.sin(yaw) * 2.2, y: 0.15, z: car.pos.z + Math.cos(yaw) * 2.2, yaw, look: f.at.look }; G.metro.route = null;
      }
      G.ui.setObjective({ title: 'Street taxi', text: `To ${f.to.name} · ${Math.round(d)} m`, sub: `${Math.round(f.t)} s of about ${Math.round(f.est)} · red lights ${f.pen} · knocks ${(car.knocks || 0) - f.knocks}` });
    } else { f.walk -= dt; const y = f.out.yaw; f.out.x += Math.sin(y) * 1.3 * dt; f.out.z += Math.cos(y) * 1.3 * dt; if (f.walk <= 0) { if (s.fares >= 8) return this.end(); this.next(); } }
  }
}
