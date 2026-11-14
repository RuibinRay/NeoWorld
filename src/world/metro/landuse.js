// Land use for Greater Neo Central. Meridian's street grid (100 m blocks, 20 m streets) is
// extended over the whole map; every block has one use, and that table drives the ground,
// the buildings, the streets, the map screen and where things may be placed.
// Block (i, j) is centred on (120 i, 120 j). North is -z.
import { SITE_LIST } from '../../data/sites.js';

export const P = 120, HB = 50, NB = 13, EDGE = NB * P + 60;   // pitch, half a block, blocks out from the centre, land edge (1620 m)
export const SHORE = 1140;                                     // centre line of Shoreline Drive; south of it is the waterfront row
export const PARK = { x0: 430, x1: 1010, z0: 430, z1: 1010 };  // Grand Arbor Park: one super-block of 5 x 5
// The Meridian Canal runs in two street corridors: west from the park lake, then south to the sea.
export const CANAL = [{ x0: -70, x1: 430, z0: 650, z1: 670 }, { x0: -70, x1: -50, z0: 650, z1: 1150 }];
// The boating lake in the park (a formal basin with stone edges), the channel that feeds the canal, its island, and the lookout hill.
export const LAKE = { x0: 515, x1: 765, z0: 575, z1: 735 }, INLET = { x0: 430, x1: 515, z0: 650, z1: 670 }, ISLE = { x: 668, z: 648, r: 13 }, HILL = { x: 880, z: 560, r: 75, h: 9 };
export const inLake = (x, z) => ((x > LAKE.x0 && x < LAKE.x1 && z > LAKE.z0 && z < LAKE.z1) || (x > INLET.x0 && x <= LAKE.x0 && z > INLET.z0 && z < INLET.z1)) && (x - ISLE.x) ** 2 + (z - ISLE.z) ** 2 > ISLE.r * ISLE.r;
export const hillY = (x, z) => { const d = Math.hypot(x - HILL.x, z - HILL.z); return d < HILL.r ? HILL.h * 0.5 * (1 + Math.cos((Math.PI * d) / HILL.r)) : 0; };
export const SITE_HALF = 190;                                  // every district has a 380 m ground plate

// z of the shoreline at x. Quays in the west, the Solara Bay beach from x = 300 to 1320, a rocky point east of it.
export function coastZ(x) {
  if (x > -70 && x < -50) return 1150;                                           // the canal mouth
  if (x < 300) return 1205;
  if (x < 1320) return 1196 + 44 * Math.sin((Math.PI * (x - 300)) / 1020);
  if (x < 1500) return 1196 + 60 * Math.sin((Math.PI * (x - 1320)) / 180);
  return 1196;
}
export const inSea = (x, z) => z > coastZ(x);
export const inCanal = (x, z) => CANAL.some((c) => x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1);
// The canal runs 2.4 m below the streets between stone walls, so boats pass under its bridges.
export const CANAL_Y = -2.4;
export const waterLevel = (x, z) => (inCanal(x, z) ? CANAL_Y + 0.02 : z < -2290 ? 140.02 : 0.02);   // the canal; the reservoir behind Northgate Dam; everywhere else, the sea

export const blockRect = (i, j) => ({ x0: i * P - HB, x1: i * P + HB, z0: j * P - HB, z1: j * P + HB });
export const cellRect = (i, j) => ({ x0: i * P - 60, x1: i * P + 60, z0: j * P - 60, z1: j * P + 60 });
export const hit = (a, b, m = 0) => a.x1 > b.x0 - m && a.x0 < b.x1 + m && a.z1 > b.z0 - m && a.z0 < b.z1 + m;
export const siteRect = (s, m = 0) => ({ x0: s.x - SITE_HALF - m, x1: s.x + SITE_HALF + m, z0: s.z - SITE_HALF - m, z1: s.z + SITE_HALF + m });
export const blockOf = (v) => Math.round(v / P);

const memo = new Map();
export function useAt(i, j) {
  const key = i * 100 + j; let u = memo.get(key);
  if (u === undefined) memo.set(key, (u = classify(i, j)));
  return u;
}
function classify(i, j) {
  if (Math.abs(i) > NB || j < -NB) return 'void';
  if (j >= 11) return 'sea';
  if (j === 10) return i >= 3 && i <= 11 ? 'beach' : i <= -3 ? 'quay' : 'front';   // the waterfront row
  if (Math.abs(i) <= 1 && Math.abs(j) <= 1) return 'meridian';
  const b = blockRect(i, j);
  for (const s of SITE_LIST) if (hit(b, siteRect(s))) return s.y > 100 ? 'green' : 'district';
  if (hit(b, PARK)) return 'park';
  if (i <= -4 && j <= -5) return 'suburb';
  if (j >= 8 && i <= -3) return 'port';
  if (j === 9 && i >= 4) return 'resort';
  if (Math.hypot(i, j) * P < 500) return 'core';
  if (Math.abs(i) >= 11 || j <= -11) return 'edge';
  return 'mid';
}
const SHORE_ROW = { beach: 1, quay: 1, front: 1 };
// Uses that have raised pavements with buildings on them.
export const URBAN = { core: 1, mid: 1, edge: 1, suburb: 1, port: 1, resort: 1 };
// A street runs between two neighbouring blocks unless both belong to the same open area.
export function streetBetween(a, b) {
  if (a === 'void' || b === 'void' || a === 'sea' || b === 'sea') return false;
  if (a === b && (a === 'park' || a === 'district' || a === 'green' || a === 'meridian')) return false;
  if (SHORE_ROW[a] && SHORE_ROW[b]) return false;                 // the waterfront is one open strip
  return true;
}
export const NAMES = { core: 'Midtown', mid: 'Midtown', edge: 'Outer Midtown', suburb: 'Arbor Heights', port: 'Tidewater Port', resort: 'Solara Bay', beach: 'Solara Bay', quay: 'Tidewater Port', front: 'Old Earth seafront', park: 'Grand Arbor Park', green: 'Skyhaven Green' };
// Which named part of the city a position is in (for the map, toasts and sound beds).
export function areaAt(x, z) {
  if (z > coastZ(x)) return 'sea';
  const u = useAt(blockOf(x), blockOf(z));
  if (u === 'core' || u === 'mid') { const a = Math.atan2(z, x); return a < -Math.PI * 0.75 || a > Math.PI * 0.75 ? 'Westworks' : a < -Math.PI / 4 ? 'Northbank' : a < Math.PI / 4 ? 'Eastline' : 'Southgate'; }
  return NAMES[u] || null;
}
// Rectangle a minus rectangle b, as up to four rectangles.
export function subtract(a, b) {
  if (!hit(a, b)) return [a];
  const out = [];
  if (b.z0 > a.z0) out.push({ x0: a.x0, x1: a.x1, z0: a.z0, z1: b.z0 });
  if (b.z1 < a.z1) out.push({ x0: a.x0, x1: a.x1, z0: b.z1, z1: a.z1 });
  const z0 = Math.max(a.z0, b.z0), z1 = Math.min(a.z1, b.z1);
  if (b.x0 > a.x0) out.push({ x0: a.x0, x1: b.x0, z0, z1 });
  if (b.x1 < a.x1) out.push({ x0: b.x1, x1: a.x1, z0, z1 });
  return out;
}
