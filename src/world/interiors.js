// Walk-in spaces: the Printed Petal restaurant, Kinetic Robotics showroom and the Halcyon sky pod.
// These are real rooms at their real positions (no loading screens); the apartment is reached
// by the residents' lift.
import { M, std, neon } from './materials.js';
import { makeDecor } from './decor.js';

const FY = 0.15, H = 5.2;

function slidingDoor(c, { id, x, y, z, axis, hours }) {
  const { bx, col, city } = c;
  const panels = [-0.8, 0.8].map((o) => bx(axis === 'x' ? 1.6 : 0.08, 3.1, axis === 'x' ? 0.08 : 1.6, M.glassDark, axis === 'x' ? x + o : x, y + 1.55, axis === 'x' ? z : z + o, { noCast: true, dyn: true }));
  const collider = axis === 'x' ? col.box(x - 1.6, x + 1.6, y, y + 3.2, z - 0.15, z + 0.15) : col.box(x - 0.15, x + 0.15, y, y + 3.2, z - 1.6, z + 1.6);
  const d = { id, x, y, z, axis, panels, base: axis === 'x' ? [x - 0.8, x + 0.8] : [z - 0.8, z + 0.8], slide: 1.55, open: 0, want: false, hours, collider, isOpenHours: true };
  city.doors.push(d);
  return d;
}

function room(c, x0, x1, z0, z1, floorMat, lights) {
  const { THREE, group, flat, light, bx } = c;
  const w = x1 - x0 - 0.6, d = z1 - z0 - 0.6, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  flat(new THREE.PlaneGeometry(w, d), floorMat, cx, FY + 0.015, cz).receiveShadow = true;
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), std('#1a1d25', 0.9, 0)); ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, H - 0.02, cz); group.add(ceil);
  for (const [lx, lz, col, len, alongX] of lights) {
    bx(alongX ? len : 0.3, 0.05, alongX ? 0.3 : len, neon(col, 1.3), lx, H - 0.06, lz, { noCast: true });
    light(col, 9, 28, lx, H - 1, lz);
  }
}

function buildRestaurant(c) {
  const { THREE, group, col, city, bx, solid, cyl, holo, tower, pad, cache } = c;
  const X0 = 6, X1 = 42, Z0 = -103, Z1 = -77;
  tower(X0, X1, Z0, Z1, H, 22, M.facades.warm, { crown: '#ff9ec4' });
  const wall = std('#2a2f3a', 0.8, 0.1);
  solid(X0, X1, FY, H, Z0, Z0 + 0.3, wall); solid(X0, X0 + 0.3, FY, H, Z0, Z1, wall); solid(X1 - 0.3, X1, FY, H, Z0, Z1, wall);
  solid(X0, 22.4, FY, H, Z1 - 0.3, Z1, M.glass, { noCast: true }); solid(25.6, X1, FY, H, Z1 - 0.3, Z1, M.glass, { noCast: true });
  bx(3.2, H - FY - 3.2, 0.3, M.glassDark, 24, (FY + 3.2 + H) / 2, Z1 - 0.15, { noCast: true });
  bx(36, 0.25, 0.4, neon('#ff9ec4', 1.3), 24, H + 0.1, Z1 + 0.05, { noCast: true });
  const door = slidingDoor(c, { id: 'restaurant', x: 24, y: FY, z: Z1 - 0.15, axis: 'x', hours: [7, 23] });
  room(c, X0, X1, Z0, Z1, std('#cdbfae', 0.45, 0.05), [[15, -88, '#ffe2c0', 14, false], [33, -88, '#ffe2c0', 14, false]]);
  holo('PRINTED PETAL', 13, 2.6, 24, 7.6, Z1 + 0.4, 0, { color: '#ffb3d1', sub: 'bioprint kitchen · open 07–23' });
  const closed = holo('CLOSED · STERILIZATION CYCLE', 3, 0.5, 24, FY + 2.2, Z1 + 0.1, 0, { color: '#ff8080', size: 40, steady: true });
  city.updates.push(() => { closed.visible = !door.isOpenHours; });

  // service counter with pass, back counter with three bioprinters
  solid(9, 39, FY, FY + 1.05, -95.4, -94.6, std('#e8e2d8', 0.4, 0.1));
  bx(30, 0.04, 0.05, neon('#ff9ec4', 1.2), 24, FY + 0.9, -94.58, { noCast: true });
  bx(30, 0.55, 0.04, M.glass, 24, FY + 1.4, -94.65, { noCast: true });
  bx(1.3, 0.03, 0.6, neon('#ffb3d1', 0.9), 24, FY + 1.07, -95, { noCast: true });
  solid(9, 39, FY, FY + 0.95, -102.6, -101.4, M.metalDark);
  const printers = [14, 24, 34].map((x) => {
    const g = new THREE.Group(); g.position.set(x, FY + 0.95, -102); group.add(g);
    for (const sx of [-0.55, 0.55]) for (const sz of [-0.45, 0.45]) bx(0.05, 1.1, 0.05, M.metal, sx, 0.55, sz, { parent: g });
    bx(1.15, 0.06, 0.95, M.metal, 0, 1.1, 0, { parent: g });
    bx(1.1, 1.0, 0.02, M.glass, 0, 0.55, 0.46, { parent: g, noCast: true });
    bx(0.8, 0.04, 0.7, M.white, 0, 0.03, 0, { parent: g });
    const rail = bx(1.05, 0.04, 0.06, M.metalDark, 0, 1.0, 0, { parent: g });
    const head = bx(0.14, 0.16, 0.14, neon('#ffb3d1', 1.5), 0, 0.92, 0, { parent: g, noCast: true });
    const glow = bx(0.7, 0.01, 0.6, neon('#ffb3d1', 0.5), 0, 0.055, 0, { parent: g, noCast: true });
    return { g, rail, head, glow, x, z: -102, plateY: FY + 0.95 + 0.06, job: null };
  });
  const arms = [19, 29].map((x) => {
    const base = new THREE.Group(); base.position.set(x, H - 0.05, -98.4); group.add(base);
    cyl(0.25, 0.25, 0.3, M.metalDark, 0, -0.15, 0, 12, { parent: base });
    const sh = new THREE.Group(); sh.position.y = -0.3; base.add(sh);
    bx(0.16, 1.3, 0.16, M.white, 0, -0.65, 0, { parent: sh });
    const el = new THREE.Group(); el.position.y = -1.3; sh.add(el);
    bx(0.13, 1.2, 0.13, M.white, 0, -0.6, 0, { parent: el }); bx(0.24, 0.1, 0.24, neon('#ffb3d1', 1.2), 0, -1.25, 0, { parent: el, noCast: true });
    return { base, sh, el, ph: x };
  });
  city.updates.push((dt, t) => {
    for (const a of arms) { a.base.rotation.y = Math.sin(t * 0.5 + a.ph) * 1.3; a.sh.rotation.x = 0.55 + Math.sin(t * 0.8 + a.ph) * 0.35; a.el.rotation.x = -1.1 + Math.sin(t * 1.1 + a.ph) * 0.4; }
  });
  holo('PRINTED TO ORDER · TUNED TO YOU', 11, 1.1, 24, 3.9, -95, 0, { color: '#ffd9e6', size: 40 });

  // dining room: 8 tables, 16 stools
  let n = 0;
  for (const z of [-83.5, -89.5]) for (const x of [10.5, 16.5, 31.5, 37.5]) {
    cyl(0.55, 0.55, 0.06, M.white, x, FY + 0.75, z, 20); cyl(0.07, 0.2, 0.72, M.metalDark, x, FY + 0.37, z, 8);
    col.box(x - 0.42, x + 0.42, FY, FY + 0.78, z - 0.42, z + 0.42);
    for (const s of [-1, 1]) {
      const sx = x + s * 1.05;
      cyl(0.22, 0.18, 0.07, std('#ff9ec4', 0.7, 0), sx, FY + 0.47, z, 12); cyl(0.04, 0.12, 0.44, M.metalDark, sx, FY + 0.22, z, 6);
      city.seats.push({ id: `rs${n++}`, kind: 'stool', x: sx, y: FY + 0.5, z, yaw: s < 0 ? Math.PI / 2 : -Math.PI / 2, taken: null, table: { x: x + s * 0.28, y: FY + 0.79, z }, lane: { x: sx, z: -86.5 } });
    }
  }
  solid(26.6, 27.8, FY, FY + 1.1, -80.7, -80.1, std('#20262f', 0.4, 0.6));
  bx(1.2, 0.03, 0.6, neon('#ffb3d1', 0.8), 27.2, FY + 1.12, -80.4, { noCast: true });
  // hydroponic herb wall: farm-to-table, three meters from the table
  for (let i = 0; i < 4; i++) {
    const y = FY + 0.9 + i * 0.95;
    bx(0.5, 0.05, 13, M.metalDark, 41.35, y, -86); bx(0.4, 0.36, 12.6, M.leaf, 41.35, y + 0.22, -86, { noCast: true });
    bx(0.05, 0.04, 12.6, neon('#ff6ad5', 1.3), 41.2, y + 0.78, -86, { noCast: true });
  }
  // roof garden + landing pad
  for (const [tx, tz] of [[10, -99], [38, -99], [10, -81], [14, -90]]) city.treeSpots.push([tx, tz, 0.75, 22, tx === 14]);
  pad('petal', 'Petal Roof', 26, 22, -90, 5.5, {});
  cache(38, 22, -81);

  city.places.restaurant = {
    door, printers, bounds: [X0, X1, Z0, Z1],
    host: { x: 27.2, z: -81.4, yaw: 0 }, hostPoint: { x: 27.2, y: FY, z: -79.2 },
    pass: { x: 24, y: FY + 1.09, z: -95 }, passPoint: { x: 24, y: FY, z: -93.7 },
    chef: { x: 33, z: -98, yaw: 0 }, chefPoint: { x: 33, y: FY, z: -93.7 },
  };
}

function buildShop(c) {
  const { city, bx, solid, cyl, holo, tower, col } = c;
  const X0 = 77, X1 = 107, Z0 = -20, Z1 = 20;
  tower(X0, X1, Z0, Z1, H, 120, M.facades.corp, { neon: '#7dff9c', crown: '#7dff9c', beacon: true });
  const wall = std('#e4e8ee', 0.6, 0.1);
  solid(X1 - 0.3, X1, FY, H, Z0, Z1, wall); solid(X0, X1, FY, H, Z0, Z0 + 0.3, wall); solid(X0, X1, FY, H, Z1 - 0.3, Z1, wall);
  solid(X0, X0 + 0.3, FY, H, Z0, -1.6, M.glass, { noCast: true }); solid(X0, X0 + 0.3, FY, H, 1.6, Z1, M.glass, { noCast: true });
  bx(0.3, H - FY - 3.2, 3.2, M.glassDark, X0 + 0.15, (FY + 3.2 + H) / 2, 0, { noCast: true });
  bx(0.4, 0.25, 40, neon('#7dff9c', 1.3), X0 - 0.05, H + 0.1, 0, { noCast: true });
  const door = slidingDoor(c, { id: 'shop', x: X0 + 0.15, y: FY, z: 0, axis: 'z', hours: [9, 21] });
  room(c, X0, X1, Z0, Z1, std('#e6e9ee', 0.3, 0.2), [[87, -9, '#dff3ff', 12, true], [97, 9, '#dff3ff', 12, true]]);
  holo('KINETIC ROBOTICS', 17, 2.8, X0 - 0.5, 7.8, 0, -Math.PI / 2, { color: '#9dffb8', sub: 'companions · service units · open 09–21' });
  const closed = holo('CLOSED', 1.6, 0.5, X0 - 0.1, FY + 2.2, 0, -Math.PI / 2, { color: '#ff8080', size: 60, steady: true });
  city.updates.push(() => { closed.visible = !door.isOpenHours; });
  solid(97, 98, FY, FY + 1.05, -5, 5, M.white);
  bx(0.05, 0.04, 10, neon('#7dff9c', 1.2), 96.98, FY + 0.9, 0, { noCast: true });
  const pedestals = [[84, -10], [84, 10], [90, -15], [90, 15]].map(([px, pz]) => {
    cyl(0.9, 1, 0.4, M.metalDark, px, FY + 0.2, pz, 20); col.box(px - 0.8, px + 0.8, FY, FY + 0.4, pz - 0.8, pz + 0.8);
    cyl(0.92, 0.92, 0.03, neon('#7dff9c', 1.1), px, FY + 0.41, pz, 24, { noCast: true });
    return { x: px, y: FY + 0.42, z: pz };
  });
  for (const z of [-19.3, 19.3]) for (let i = 0; i < 3; i++) {
    bx(22, 0.06, 0.6, M.metalDark, 92, FY + 1 + i * 0.9, z);
    for (let k = 0; k < 9; k++) bx(0.8, 0.5, 0.4, k % 3 ? M.white : M.metal, 82.5 + k * 2.4, FY + 1.3 + i * 0.9, z);
  }
  city.places.shop = { door, pedestals, bounds: [X0, X1, Z0, Z1], clerk: { x: 99.6, z: 0, yaw: -Math.PI / 2 }, counterPoint: { x: 95.7, y: FY, z: 0 } };
}

function buildApartment(c) {
  const { THREE, city, bx, solid, cyl, holo, light, pad, flat } = c;
  const Y = 150, T = 153.6;
  solid(-36, -14, Y - 0.5, Y, -80, -70, std('#d9d2c6', 0.5, 0.1));          // pod floor
  solid(-34, -16, Y - 0.5, Y, -70, -54, std('#262b35', 0.6, 0.6));          // landing deck
  solid(-36, -14, T, T + 0.3, -80, -70, M.white);                           // roof
  solid(-36, -35.75, Y, T, -80, -70, M.glass, { noCast: true }); solid(-14.25, -14, Y, T, -80, -70, M.glass, { noCast: true });
  solid(-36, -26.6, Y, T, -70.25, -70, M.glass, { noCast: true }); solid(-23.4, -14, Y, T, -70.25, -70, M.glass, { noCast: true });
  bx(3.2, T - Y - 3.2, 0.25, M.glassDark, -25, (Y + 3.2 + T) / 2, -70.12, { noCast: true });
  const door = slidingDoor(c, { id: 'apt', x: -25, y: Y, z: -70.12, axis: 'x', hours: null });
  bx(22, 3.6, 0.12, std('#2b303a', 0.8, 0.1), -25, Y + 1.8, -79.9);
  for (const sx of [-34, -16]) bx(0.5, 0.5, 26, M.metalDark, sx, Y - 0.75, -67);  // support beams
  bx(22.4, 0.2, 0.3, neon('#59d8ff', 1.2), -25, T + 0.35, -70, { noCast: true });
  // deck rails, pad, charger
  const rail = M.glassDark;
  solid(-34.1, -34, Y, Y + 1.1, -70, -54, rail, { noCast: true }); solid(-16, -15.9, Y, Y + 1.1, -70, -54, rail, { noCast: true }); solid(-34, -16, Y, Y + 1.1, -54.1, -54, rail, { noCast: true });
  pad('home', 'Halcyon Deck', -25, Y, -61, 5.5, { charger: true, priv: true, cx: 7, cz: 5.5 });
  // lifts
  bx(1.9, 2.7, 0.1, M.metal, -25, Y + 1.35, -79.8); bx(2.1, 0.08, 0.12, neon('#59d8ff', 1.3), -25, Y + 2.75, -79.78, { noCast: true });
  bx(2.4, 3.1, 0.2, M.metal, -25, FY + 1.55, -79.92); bx(2.6, 0.1, 0.22, neon('#59d8ff', 1.3), -25, FY + 3.15, -79.9, { noCast: true });
  holo('RESIDENTS LIFT', 3.2, 0.6, -25, FY + 3.7, -79.7, 0, { color: '#bfe9ff', size: 50, steady: true });
  // furniture
  solid(-20.5, -15, Y, Y + 0.5, -79.2, -76.4, std('#f1ede6', 0.9, 0)); bx(1.4, 0.18, 0.7, M.white, -15.9, Y + 0.6, -77.8); bx(0.12, 1.1, 3, std('#3a4660', 0.9, 0), -14.6, Y + 0.55, -77.8);
  solid(-35.5, -34.4, Y, Y + 0.45, -76.5, -72.5, std('#3a4660', 0.9, 0)); bx(0.25, 0.9, 4, std('#3a4660', 0.9, 0), -35.5, Y + 0.6, -74.5);
  cyl(0.6, 0.6, 0.05, M.white, -32.4, Y + 0.42, -74.5, 20); cyl(0.06, 0.25, 0.4, M.metalDark, -32.4, Y + 0.2, -74.5, 8);
  flat(new THREE.PlaneGeometry(6, 4), std('#6b5d8a', 0.95, 0), -27, Y + 0.012, -75);
  bx(1.7, 1.0, 0.06, neon('#59e0ff', 0.6), -29.5, Y + 1.6, -79.8, { noCast: true });
  holo('HOME', 1.4, 0.5, -29.5, Y + 1.6, -79.74, 0, { color: '#e8fbff', size: 80, steady: true });
  solid(-35.6, -34.7, Y, Y + 2.4, -79.7, -77.9, std('#20262f', 0.5, 0.4)); bx(0.04, 2.1, 1.5, M.glassDark, -34.66, Y + 1.2, -78.8, { noCast: true });
  cyl(0.3, 0.22, 0.5, M.white, -15, Y + 0.25, -71.2, 12); const pl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 1), M.leaf); pl.position.set(-15, Y + 1.1, -71.2); c.group.add(pl);
  const lamp = light(0xffe9cf, 8, 22, -25, Y + 3, -75);
  // kitchen printer on the back wall, a work desk by the glass, seats on the sofa and at the desk
  solid(-24, -21.2, Y, Y + 0.95, -79.7, -78.95, std('#e9e3d5', 0.6, 0.1)); bx(1.1, 0.5, 0.5, M.metalDark, -22.6, Y + 1.25, -79.4); bx(0.8, 0.06, 0.3, neon('#ffb3d1', 1.3), -22.6, Y + 1.02, -79.2, { noCast: true });
  solid(-19.6, -16.8, Y, Y + 0.76, -71.5, -70.7, std('#2b303a', 0.5, 0.3)); bx(0.9, 0.55, 0.04, neon('#59e0ff', 0.7), -18.2, Y + 1.16, -70.82, { noCast: true }); cyl(0.2, 0.17, 0.46, std('#c9b68f', 0.8, 0), -18.2, Y + 0.23, -72.3, 10);
  for (const [id, sx, sz, yaw] of [['aptSofaA', -34.75, -75.5, Math.PI / 2], ['aptSofaB', -34.75, -73.5, Math.PI / 2], ['aptDesk', -18.2, -72.3, 0]]) city.seats.push({ id, kind: 'chair', x: sx, y: Y + 0.5, z: sz, yaw, taken: null, table: null, service: null });
  const cove = new THREE.MeshBasicMaterial({ color: 0xffcf9a });
  for (const z of [-79.6, -70.5]) bx(21.4, 0.06, 0.12, cove, -25, T - 0.08, z, { noCast: true, dyn: true });
  // one of each furnishing, shown once you own it (see systems/home.js)
  const decor = {}, put = (key, x, y, z, ry = 0) => { const g = makeDecor(key); g.position.set(x, y, z); g.rotation.y = ry; c.group.add(g); decor[key] = g; };
  put('records', -35.1, Y, -71.6, Math.PI / 2); put('vinyl', -27.2, Y, -79.8); put('tea', -32.4, Y + 0.45, -74.5); put('lamp', -17.2, Y + 0.76, -71.1);
  put('books', -14.6, Y, -74.2, -Math.PI / 2); put('print', -22.6, Y + 0.25, -79.82); put('plant', -30.5, Y, -70.9); put('aquarium', -31.2, Y, -79.5);
  city.places.apartment = {
    lamp, cove, decor, kitchen: { x: -22.6, y: Y, z: -78.1 }, desk: { x: -18.2, y: Y, z: -72.6 }, turntable: { x: -34.2, y: Y, z: -71.6 }, music: { x: -25, z: -75 },
    door, Y,
    liftDown: { x: -25, y: FY, z: -78.6 }, liftUp: { x: -25, y: Y, z: -78.7 },
    spawnUp: { x: -25, y: Y, z: -77.4, yaw: 0 }, spawnDown: { x: -25, y: FY, z: -77.4, yaw: 0 },
    console: { x: -29.5, y: Y, z: -78.8 }, bed: { x: -17.8, y: Y, z: -75.6 }, wardrobe: { x: -33.8, y: Y, z: -78.8 },
    inside(p) { return p.y > Y - 1 && p.y < T && p.x > -36 && p.x < -14 && p.z > -80 && p.z < -70; },
  };
}

export function buildInteriors(c) {
  buildRestaurant(c);
  buildShop(c);
  buildApartment(c);
}
