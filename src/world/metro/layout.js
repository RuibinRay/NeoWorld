// Block layout as plain data: for every block of the land-use grid, the buildings (as boxes),
// the street furniture and the trees. It is generated once at start from a fixed seed per
// block, so the city is the same on every launch; meshes are built from it only near the player.
import { RNG } from '../../core/util.js';
import { SITE_LIST } from '../../data/sites.js';
import { P, HB, useAt, blockRect, URBAN, streetBetween, inCanal } from './landuse.js';

export const FY = 0.15;
const FAC = {
  core: ['glass', 'glass', 'corp', 'corp', 'magenta', 'curtain', 'curtain', 'warm'],
  mid: ['warm', 'glass', 'balcony', 'brick', 'concrete', 'loft', 'curtain', 'balcony'],
  edge: ['brick', 'warm', 'concrete', 'loft', 'balcony'],
  suburb: ['siding', 'stucco', 'siding'], port: ['concrete', 'loft', 'brick'], resort: ['stucco', 'balcony', 'stucco', 'curtain'],
};
const KINDS = {
  core: ['tower', 'tower', 'tower', 'step', 'step', 'twin', 'slab', 'row', 'mall', 'civic'],
  mid: ['slab', 'slab', 'tower', 'step', 'row', 'row', 'court', 'twin', 'mall', 'civic', 'hub', 'site'],
  edge: ['row', 'row', 'row', 'slab', 'court', 'shed', 'hub', 'site'],
  port: ['shed', 'shed', 'shed', 'row'], resort: ['hotel', 'hotel', 'villa', 'villa'], suburb: ['house'],
};
const ACC = ['#4de1ff', '#ff4fd8', '#ffd34d', '#7dff9c', '#ff7a45', '#a98bff'];
const SHOPS = ['NOODLE BAR', 'KAFE 88', 'VOLT MART', 'PIXEL PRINT', 'ORBIT GYM', 'LUMA OPTICS', 'TEA & BYTE', 'GREENGROCER', 'DRONE DEPOT', 'HOLO NAILS', 'BAO HOUSE', 'SYNTH RECORDS', 'CLINIC', 'PHARMA+', 'BOOK NOOK', 'CYCLE LAB', 'RAMEN YA', 'CHARGE & GO', 'PET POD', 'TAILOR', 'BAKERY', 'FLORIST', 'ARCADE', 'LAUNDRY'];

// does the segment a-b pass within m of the rectangle?
function segNearRect(ax, az, bx, bz, r, m) {
  const x0 = r.x0 - m, x1 = r.x1 + m, z0 = r.z0 - m, z1 = r.z1 + m, dx = bx - ax, dz = bz - az;
  let t0 = 0, t1 = 1;
  for (const [p, q] of [[-dx, ax - x0], [dx, x1 - ax], [-dz, az - z0], [dz, z1 - az]]) {
    if (p === 0) { if (q < 0) return false; } else { const t = q / p; if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; } }
  }
  return true;
}

export function makeLayout(col, roads) {
  const ring = roads.ring, radials = roads.radials;
  // Is a highway or the ring road within m of this rectangle?
  const roadNear = (r, m) => {
    const cx = Math.max(r.x0, Math.min(0, r.x1)), cz = Math.max(r.z0, Math.min(0, r.z1)), minD = Math.hypot(cx, cz);
    const maxD = Math.hypot(Math.max(Math.abs(r.x0), Math.abs(r.x1)), Math.max(Math.abs(r.z0), Math.abs(r.z1)));
    if (minD < ring + 8 + m && maxD > ring - 8 - m) return true;
    for (const s of radials) if (segNearRect(s.ax, s.az, s.bx, s.bz, r, 8 + m)) return true;
    return false;
  };
  // Anything already standing here (megatowers, the ring of mid-rises round Meridian, district structures)?
  const occupied = (r, m = 3) => {
    const l = col.near((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, Math.hypot(r.x1 - r.x0, r.z1 - r.z0) / 2 + m);
    for (let n = 0; n < l.length; n++) { const b = l[n]; if (b.maxY - b.minY > 2 && b.minY < 40 && b.maxX > r.x0 - m && b.minX < r.x1 + m && b.maxZ > r.z0 - m && b.minZ < r.z1 + m) return true; }
    return false;
  };
  // Low roofs under the straight flight lines from Meridian to each district.
  const flightLine = (r) => SITE_LIST.some((s) => segNearRect(0, 0, s.x, s.z, r, 46));

  function massing(r, kind, L, y0, H) {
    const w = L.x1 - L.x0, d = L.z1 - L.z0, bx = [], add = (ix, iz, a, b, sx = 0, sz = 0) => bx.push([L.x0 + ix + sx, L.x1 - ix + sx, L.z0 + iz + sz, L.z1 - iz + sz, a, b]);
    if (kind === 'tower') { const pod = Math.min(13, H * 0.22), a = r.range(0.12, 0.2); add(0, 0, y0, y0 + pod); add(w * a, d * a, y0 + pod, y0 + H); if (r.chance(0.5)) add(w * (a + 0.13), d * (a + 0.13), y0 + H, y0 + H * 1.1); }
    else if (kind === 'step') { add(0, 0, y0, y0 + H * 0.5); add(w * 0.12, d * 0.12, y0 + H * 0.5, y0 + H * 0.78); add(w * 0.26, d * 0.26, y0 + H * 0.78, y0 + H); }
    else if (kind === 'twin') {
      add(0, 0, y0, y0 + 10);
      if (w >= d) { bx.push([L.x0 + 2, L.x0 + w * 0.4, L.z0 + 3, L.z1 - 3, y0 + 10, y0 + H], [L.x1 - w * 0.4, L.x1 - 2, L.z0 + 3, L.z1 - 3, y0 + 10, y0 + H * 0.84]); }
      else { bx.push([L.x0 + 3, L.x1 - 3, L.z0 + 2, L.z0 + d * 0.4, y0 + 10, y0 + H], [L.x0 + 3, L.x1 - 3, L.z1 - d * 0.4, L.z1 - 2, y0 + 10, y0 + H * 0.84]); }
    } else if (kind === 'slab' || kind === 'hotel') {
      const t = r.range(0.42, 0.55), pod = kind === 'hotel' ? 9 : r.chance(0.5) ? 8 : 0, s = r.chance(0.5) ? 1 : -1;
      if (pod) add(0, 0, y0, y0 + pod);
      if (w >= d) add(0, (d * (1 - t)) / 2, y0 + pod, y0 + H, 0, pod ? (s * d * (1 - t)) / 2 : 0); else add((w * (1 - t)) / 2, 0, y0 + pod, y0 + H, pod ? (s * w * (1 - t)) / 2 : 0, 0);
    } else if (kind === 'row') { const h = Math.max(8, Math.min(16, H * 0.3)); add(0, 0, y0, y0 + h); if (r.chance(0.5)) add(w * 0.18, d * 0.18, y0 + h, y0 + h + 7); }
    else if (kind === 'court') { const h = Math.max(14, Math.min(40, H * 0.6)), t = 12; bx.push([L.x0, L.x1, L.z0, L.z0 + t, y0, y0 + h], [L.x0, L.x1, L.z1 - t, L.z1, y0, y0 + h], [L.x0, L.x0 + t, L.z0 + t, L.z1 - t, y0, y0 + h], [L.x1 - t, L.x1, L.z0 + t, L.z1 - t, y0, y0 + h * 0.8]); }
    else if (kind === 'shed') add(0, 0, y0, y0 + r.range(10, 18));
    else if (kind === 'mall') { add(0, 0, y0, y0 + 14); add(w * 0.3, d * 0.3, y0 + 14, y0 + 19); }                               // two trading floors and a raised atrium
    else if (kind === 'civic') { add(w * 0.06, d * 0.06, y0, y0 + 13); add(w * 0.3, d * 0.3, y0 + 13, y0 + 24); }                // a hall with a drum on top
    else if (kind === 'hub') bx.push([L.x0 + w * 0.36, L.x1 - w * 0.36, L.z0 + d * 0.36, L.z1 - d * 0.36, y0, y0 + 4.2]);       // charging hub: a kiosk under a wide canopy
    else if (kind === 'site') { add(w * 0.18, d * 0.18, y0, y0 + Math.max(14, H * 0.45)); }                                      // a building going up
    else if (kind === 'villa') { add(w * 0.08, d * 0.2, y0, y0 + 7.2); add(w * 0.3, d * 0.3, y0 + 7.2, y0 + 10.6); }
    else if (kind === 'house') { add(0, 0, y0, y0 + 6.4); }
    return bx;
  }

  function lotsFor(r, use) {
    const A = 44, g = 4, q = (x0, x1, z0, z1) => ({ x0, x1, z0, z1 });
    if (use === 'suburb') { const out = []; for (const z of [-25, 25]) for (const x of [-30, 0, 30]) { const w = r.range(10, 13), d = r.range(8.5, 11); out.push(q(x - w / 2, x + w / 2, z - d / 2, z + d / 2)); } return out; }
    if (use === 'port') return r.chance(0.5) ? [q(-A, A, -A, -g), q(-A, A, g, A)] : [q(-A, -g, -A, A), q(g, A, -A, A)];
    if (use === 'resort') return [q(-A, A, -A, -g), q(-A, -g, g, A), q(g, A, g, A)];
    const k = r.int(0, use === 'core' ? 4 : 5);
    if (k === 0) return [q(-40, 40, -40, 40)];
    if (k === 1) return [q(-A, -g, -A, A), q(g, A, -A, A)];
    if (k === 2) return [q(-A, A, -A, -g), q(-A, A, g, A)];
    if (k === 3) return [q(-A, A, -A, -g), q(-A, -g, g, A), q(g, A, g, A)];
    return [q(-A, -g, -A, -g), q(g, A, -A, -g), q(-A, -g, g, A), q(g, A, g, A)];
  }

  function block(i, j) {
    const use = useAt(i, j), R = blockRect(i, j), cx = i * P, cz = j * P, r = new RNG(((i + 40) * 7919 + (j + 40) * 104729) >>> 0);
    const b = { i, j, use, cx, cz, R, cut: false, y0: FY, bld: [], props: [], trees: [], solids: [], plaza: false, acc: r.pick(ACC) };
    if (!URBAN[use]) {
      b.y0 = 0;
      // the lawn under Skyhaven: scattered trees and a few benches
      if (use === 'green') for (let k = 0; k < 16; k++) { const x = cx + r.range(-47, 47), z = cz + r.range(-47, 47), q = { x0: x - 1, x1: x + 1, z0: z - 1, z1: z + 1 }; if (!roadNear(q, 6) && !occupied(q, 4)) { if (k % 5 === 4) b.props.push(['bench', x, z, r.range(0, 6.28)]); else b.trees.push([x, z, r.range(0.9, 1.5), r.chance(0.2) ? 1 : 0]); } }
      return b;
    }
    b.cut = roadNear(R, 0); if (b.cut) b.y0 = 0;
    b.streets = { n: streetBetween(use, useAt(i, j - 1)), s: streetBetween(use, useAt(i, j + 1)), w: streetBetween(use, useAt(i - 1, j)), e: streetBetween(use, useAt(i + 1, j)) };
    const dist = Math.hypot(cx, cz);
    b.plaza = !b.cut && (use === 'core' || use === 'mid') && r.chance(0.07);
    // ---- buildings ----
    if (!b.plaza) for (const l of lotsFor(r, use)) {
      const L = { x0: cx + l.x0, x1: cx + l.x1, z0: cz + l.z0, z1: cz + l.z1 };
      let kind = r.pick(KINDS[use]); const f = r.pick(FAC[use]);
      if ((kind === 'hub' || kind === 'site') && r.chance(0.6)) kind = 'row';                 // a few of these go a long way
      let H = use === 'core' ? (r.chance(0.25) ? r.range(35, 60) : r.range(60, 150)) : use === 'mid' ? r.range(22, 85) * (dist > 1100 ? 0.7 : 1) : use === 'edge' ? r.range(12, 38) : use === 'resort' ? r.range(28, 60) : use === 'port' ? 14 : 6.4;
      const acc = r.pick(ACC), shop = r.pick(SHOPS), seed = r.int(1, 1e6);
      if (roadNear(L, 5) || occupied(L)) continue;
      if (flightLine(L)) H = Math.min(H, 56);
      const boxes = massing(r, kind, L, b.y0, H), cxL = (L.x0 + L.x1) / 2, czL = (L.z0 + L.z1) / 2;
      const face = kind === 'civic' ? 'stucco' : kind === 'mall' ? 'curtain' : kind === 'hub' ? 'corp' : kind === 'site' ? 'concrete' : kind === 'villa' ? 'stucco' : f;
      b.bld.push({ kind, f: face, boxes, acc, shop, seed, L });
      // parts that are not building volumes but still solid: canopy columns, a crane mast
      if (kind === 'hub') for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.solids.push([cxL + sx * (L.x1 - L.x0) * 0.42 - 0.3, cxL + sx * (L.x1 - L.x0) * 0.42 + 0.3, b.y0, b.y0 + 6, czL + sz * (L.z1 - L.z0) * 0.42 - 0.3, czL + sz * (L.z1 - L.z0) * 0.42 + 0.3]);
      if (kind === 'site') b.solids.push([L.x0 + 1, L.x0 + 3, b.y0, b.y0 + Math.max(14, H * 0.45) + 22, L.z0 + 1, L.z0 + 3]);
    }
    // ---- sidewalk furniture and trees (only on raised pavements) ----
    if (!b.cut) furnish(r, b);
    return b;
  }

  // Street furniture along the four pavements of a block. Each prop: [type, x, z, yaw].
  function furnish(r, b) {
    const { cx, cz, use } = b, quiet = use === 'suburb' || use === 'edge', E = HB;
    const put = (t, x, z, a = 0) => { if (!inCanal(x, z)) b.props.push([t, x, z, a]); };
    // side: outward normal (nx, nz); a point at t along the kerb and `ins` metres in from it
    const sides = [[0, -1, 'n'], [0, 1, 's'], [-1, 0, 'w'], [1, 0, 'e']];
    for (const [nx, nz, key] of sides) {
      const at = (t, ins) => [cx + nx * (E - ins) + (nx ? 0 : t), cz + nz * (E - ins) + (nz ? 0 : t)], face = Math.atan2(nx, nz);   // yaw that looks out at the street
      const street = b.streets[key];
      for (const t of [-36, -12, 12, 36]) put('lamp', ...at(t, 1.5), face);
      for (const t of quiet ? [-30, -18, 0, 18, 30] : [-24, 0, 24]) if (r.chance(quiet ? 0.8 : 0.65)) { const [x, z] = at(t, 2.2); b.trees.push([x, z, r.range(0.8, 1.15), use === 'resort' ? 2 : r.chance(0.18) ? 1 : 0]); }
      if (!street) continue;
      if (r.chance(0.8)) put('bin', ...at(-33.6, 1.6), face);
      if (r.chance(0.45)) put('bin', ...at(33.6, 1.6), face);
      if (r.chance(0.5)) put('bench', ...at(r.pick([-18, 18, 6, -6]), 3.6), face);
      if (r.chance(0.3)) put('planter', ...at(r.pick([-29, 29]), 3.2), face);
      if (r.chance(0.35)) put('hydrant', ...at(r.pick([-40, 40, -8]), 1.1), face);
      if (!quiet && r.chance(0.22)) put('vend', ...at(r.pick([-15, 9, 20]), 4.6), face);
      if (!quiet && r.chance(0.2)) put('rack', ...at(r.pick([-21, 15]), 2.4), face);
      if (r.chance(0.25)) put('box', ...at(r.pick([-42, 42]), 4.4), face);
      if (!quiet && r.chance(0.16)) put('ad', ...at(r.pick([-27, 27]), 2.6), face);
      // parked pods in the kerbside bay
      // parked cars in the kerbside bay (facing the way the traffic on that side goes); lorries outside the port's warehouses
      const bay = (t) => [cx + nx * (E + 2.6) + (nx ? 0 : t), cz + nz * (E + 2.6) + (nz ? 0 : t)], park = face - Math.PI / 2;
      if (use !== 'port') { for (const t of [-31, -23, 23, 31]) if (r.chance(quiet ? 0.5 : 0.35)) { const k = r.int(0, 59), [x, z] = bay(t); if (inCanal(x, z)) continue; b.props.push(['pod', x, z, park, k]); } }
      else for (const t of [-27, 27]) if (r.chance(0.6)) { const [x, z] = bay(t); if (!inCanal(x, z)) b.props.push(['lorry', x, z, park, r.int(0, 5)]); }
    }
    // one bus shelter on the south pavement of every third block, a parcel locker now and then
    if (b.streets.s && (b.i * 2 + b.j * 3) % 5 === 0 && use !== 'suburb') { put('shelter', cx + 14, cz + E - 2.4, 0); b.stop = { x: cx + 14, z: cz + E - 2.4 }; }
    if (r.chance(0.12)) put('locker', cx - 20, cz - E + 4.4, Math.PI);
    if (b.plaza) {
      put('fountain', cx, cz, 0);
      for (const [x, z] of [[-18, -18], [18, -18], [-18, 18], [18, 18]]) { put('bench', cx + x * 0.6, cz + z * 0.6, Math.atan2(-x, -z)); put('planter', cx + x * 1.5, cz + z * 1.5, 0); }
      for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; b.trees.push([cx + Math.cos(a) * 34, cz + Math.sin(a) * 34, r.range(0.9, 1.3), k % 4 === 0 ? 1 : 0]); }
      put('truck', cx - 30, cz + 8, Math.PI / 2);
    }
    // corner bollards
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const o of [[3.2, 0.7], [0.7, 3.2], [1.6, 1.6]]) put('bollard', cx + sx * (E - o[0]), cz + sz * (E - o[1]), 0);
    // suburb gardens: hedges and a tree per house
    if (use === 'suburb') for (const h of b.bld) { const hx = (h.L.x0 + h.L.x1) / 2, hz = (h.L.z0 + h.L.z1) / 2; if (r.chance(0.8)) b.trees.push([hx + r.range(-9, 9), hz + (hz > cz ? -1 : 1) * r.range(9, 13), r.range(0.7, 1.1), r.chance(0.3) ? 1 : 0]); }
  }

  return { block, roadNear };
}
// Footprint of a prop for collision: [half width, half depth, height]. Props not listed are not solid.
export const SOLID = { lamp: [0.14, 0.14, 7], bin: [0.3, 0.3, 1], bench: [0.9, 0.3, 0.9], planter: [0.8, 0.8, 0.7], hydrant: [0.18, 0.18, 0.8], vend: [0.6, 0.45, 2], rack: [1, 0.3, 0.9], box: [0.5, 0.3, 1.2], ad: [0.12, 0.7, 2.6], pod: [1.05, 2.6, 2.2], lorry: [1.3, 3.85, 3.5], shelter: [3, 0.25, 2.6], locker: [1.5, 0.4, 2], fountain: [3.4, 3.4, 0.7], truck: [1.2, 2.7, 2.6], umbrella: [0.06, 0.06, 2.2], lounger: [0.35, 0.95, 0.4], guard: [1.3, 1.3, 4.2], hut: [1.1, 1.1, 2.6], boards: [1.5, 0.2, 2.2], bollard: [0.12, 0.12, 0.8], signal: [0.14, 0.14, 6] };
