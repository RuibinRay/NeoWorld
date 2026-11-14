// Maglev line 7: lifts between street and platform at four stations, and riding the train.
import { G } from '../core/game.js';

export class Transit {
  constructor() {
    const I = G.interact, c = G.city;
    this.riding = false;
    for (const st of c.stations) {
      I.add({ pos: st.bottom, r: 2.4, label: `Lift up to the ${st.name} platform`, use: () => this.lift(st.top, st.yaw) });
      I.add({ pos: st.top, r: 2.2, label: 'Lift down to the street', use: () => this.lift(st.bottom, st.yaw + Math.PI) });
      I.add({ pos: st, r: 10, yTol: 2, prio: -0.3, label: () => `Board the maglev toward ${c.stations[(st.k + 1) % 4].name}`, enabled: () => c.train.at === st.k, use: () => this.board() });
    }
    I.add({ mode: 'ride', pos: G.player.pos, r: 6, yTol: 12, label: () => `Get off at ${c.stations[c.train.at].name}`, enabled: () => this.riding && c.train.at >= 0, use: () => this.alight() });
  }
  lift(to, yaw) {
    G.ui.fade(() => { const p = G.player; p.pos.set(to.x, to.y, to.z); p.vel.set(0, 0, 0); p.yaw = p.camYaw = yaw; p.grounded = true; if (G.dog.active) G.dog.pos.set(to.x + 0.7, to.y, to.z + 0.5); });
    if (G.audio) G.audio.blip(440, 0.1);
  }
  board() {
    const p = G.player; p.state = 'ride'; p.board = false; p.firstPerson = false; p.vel.set(0, 0, 0); p.crouch = false; this.riding = true;
    G.ui.toast('Maglev line 7: doors closing.', 'info'); if (G.audio) G.audio.blip(520, 0.1);
  }
  alight() {
    const st = G.city.stations[G.city.train.at], p = G.player;
    p.pos.set(st.x, st.y, st.z); p.vel.set(0, 0, 0); p.state = 'walk'; p.grounded = true; p.yaw = p.camYaw = st.yaw + Math.PI; this.riding = false;
    if (G.dog.active) G.dog.pos.set(st.x + 0.8, st.y, st.z + 0.6);
    G.ui.setObjective(null);
  }
  // where to put the player if the game is saved mid-ride
  safeSpot() { const t = G.city.train, st = G.city.stations[t.at >= 0 ? t.at : t.next]; return { x: st.x, y: st.y, z: st.z }; }
  update() {
    if (!this.riding) return;
    const t = G.city.train, car = t.cars[1].position, p = G.player;
    p.pos.set(car.x, car.y + 0.9, car.z);
    G.ui.setObjective({ title: 'Maglev line 7', text: t.at >= 0 ? `At ${G.city.stations[t.at].name}` : `Next stop: ${G.city.stations[t.next].name}`, sub: t.at >= 0 ? 'Press E to get off, or stay on.' : `${Math.round(t.v * 3.6)} km/h` });
  }
}
