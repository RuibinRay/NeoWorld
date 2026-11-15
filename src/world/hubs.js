// The four Midtown squares (data/hubs.js). The block layout already makes each one an open plaza
// with a fountain, benches, planters and a ring of trees; this adds the parts that make it a
// place: coloured paving, a lit column in the fountain that carries the square's name, a food
// kiosk on the east side, and the walkways the square's regulars stroll on.
import { G } from '../core/game.js';
import { HUBS } from '../data/hubs.js';
import { FY } from './metro/layout.js';

export function layoutHubs(ctx) {
  const { GB, col, block } = ctx, nav = G.nav, Y = FY, out = [];
  for (const h of HUBS) {
    const b = block(h.i, h.j); if (!b || !b.hub) continue;
    const cx = b.cx, cz = b.cz;
    // paving: stone setts with a band of the quarter's colour round the edge, a pale ring and a tinted disc round the fountain
    GB.box('S', h.pave, 76, 0.03, 76, cx, Y + 0.012, cz);
    GB.box('S', '#6e6b66', 72, 0.03, 72, cx, Y + 0.02, cz);
    GB.cyl('S', '#9a968e', 23, 23, 0.03, cx, Y + 0.03, cz, 32);
    GB.cyl('G', h.color, 22.1, 22.1, 0.03, cx, Y + 0.04, cz, 48);
    GB.cyl('S', '#4f4c48', 21.8, 21.8, 0.03, cx, Y + 0.05, cz, 32);
    // the column in the fountain: the name signs hang near the top (systems/hubs.js), a glow ring above
    GB.cyl('B', '#2b303a', 0.45, 0.6, 9, cx, Y + 4.5, cz, 12); col.box(cx - 0.6, cx + 0.6, Y, Y + 9, cz - 0.6, cz + 0.6);
    GB.cyl('G', h.color, 0.62, 0.62, 0.3, cx, Y + 9.15, cz, 16); GB.cyl('G', h.color, 0.5, 0.5, 0.18, cx, Y + 2.2, cz, 16);
    for (const s of [-1, 1]) { GB.box('B', '#2b303a', 6.6, 0.12, 0.12, cx, Y + 8.3, cz + s * 3.2); GB.box('B', '#2b303a', 0.12, 0.12, 6.6, cx + s * 3.2, Y + 8.3, cz); GB.box('B', '#2b303a', 3.2, 0.1, 0.1, cx + s * 1.6, Y + 8.3, cz); GB.box('B', '#2b303a', 0.1, 0.1, 3.2, cx, Y + 8.3, cz + s * 1.6); }   // the frame the signs hang from
    // the kiosk: a counter facing the fountain, a back shelf, a roof on four posts
    const kx = cx + 27.8, kz = cz - 7, accent = h.color;
    GB.box('B', '#d9d2c4', 1, 1.05, 5.2, kx - 1.9, Y + 0.525, kz); col.box(kx - 2.4, kx - 1.4, Y, Y + 1.05, kz - 2.6, kz + 2.6);
    GB.box('G', accent, 0.04, 0.12, 5.2, kx - 2.42, Y + 0.9, kz);
    GB.box('B', '#3a3f4a', 0.6, 1.6, 3.2, kx + 2.1, Y + 0.8, kz - 1); col.box(kx + 1.8, kx + 2.4, Y, Y + 1.6, kz - 2.6, kz + 0.6);   // the gap at the south end is the way in
    GB.box('S', '#c9c2b2', 0.5, 0.06, 3, kx + 2.1, Y + 1.63, kz - 1);
    for (const [px, pz] of [[-2.3, -3], [-2.3, 3], [2.3, -3], [2.3, 3]]) { GB.cyl('B', '#2b303a', 0.08, 0.08, 3, kx + px, Y + 1.5, kz + pz, 6); col.box(kx + px - 0.1, kx + px + 0.1, Y, Y + 3, kz + pz - 0.1, kz + pz + 0.1, { noCam: true }); }
    GB.box('B', accent, 5.6, 0.22, 6.8, kx, Y + 3.1, kz); GB.box('G', accent, 0.06, 0.3, 6.8, kx - 2.84, Y + 3.0, kz);
    for (let k = 0; k < 3; k++) GB.box('G', '#ffe2b0', 0.3, 0.3, 0.3, kx - 1.2, Y + 2.7, kz - 2 + k * 2);   // three hanging lamps
    // walkways: an inner ring round the fountain, an outer ring inside the trees, spokes on the compass
    // lines; the regulars' doors at the four corners; the keeper's post behind the counter
    const id = (s) => `${h.id}:${s}`, add = (s, x, z, o = {}) => nav.add(id(s), cx + x, cz + z, { y: Y, zone: h.id, ...o }).id;
    const inner = [], outer = [], street = [], doors = [];
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; inner.push(add('i' + k, Math.cos(a) * 20, Math.sin(a) * 20, { street: true })); outer.push(add('o' + k, Math.cos(a) * 42, Math.sin(a) * 42, { street: true })); }
    for (let k = 0; k < 8; k++) { nav.link(inner[k], inner[(k + 1) % 8]); nav.link(outer[k], outer[(k + 1) % 8]); if (k % 2 === 0) nav.link(inner[k], outer[k]); }
    street.push(...inner, ...outer);
    [[-45, -45, 5], [45, -45, 7], [-45, 45, 3], [45, 45, 1]].forEach(([x, z, k], n) => { const d = add('d' + n, x, z, { door: true }); nav.link(d, outer[k]); doors.push(d); });
    const back = add('back', 31.6, -4.6), post = add('post', 28.6, -7); nav.link(post, back); nav.link(back, outer[0]);
    // two places at the counter: the regulars drop by for something to eat (as district locals do their shops)
    const buy = [add('buyA', 24.3, -8.4), add('buyB', 24.3, -5.6)]; for (const q of buy) nav.link(q, inner[0]);
    if (G.districts) G.districts.zoneShops[h.id] = buy;
    out.push({ ...h, cx, cz, y: Y, kiosk: { x: kx, z: kz }, counter: { x: cx + 24.6, y: Y, z: kz }, post, face: -Math.PI / 2, doors, street, sign: { x: cx, y: Y + 7.4, z: cz } });
  }
  return out;
}
