// Street furniture. Each prop is a handful of boxes and prisms written into the tile's shared
// buffers (see builder.js), so a street full of them adds no draw calls.
// draw[type](B, x, y, z, a, extra): y is the ground the prop stands on, a its yaw.
import { ADS, adUV } from '../art.js';
import { drawVehicle, PAINTS, TAXI, BOXES } from '../../entities/fleet.js';
const PAINT = ['#d9dde4', '#2e3440', '#a8343f', '#2f6f8f', '#d2a52e', '#5b4a8f', '#2f8f5a'];
const rot = (a, lx, lz) => [lx * Math.cos(a) + lz * Math.sin(a), -lx * Math.sin(a) + lz * Math.cos(a)];
export const LAMP_COL = '#fff0d2';

export const draw = {
  // road lamp: tapered pole, an arm out over the street, a slim light, sometimes a banner
  lamp(B, x, y, z, a) {
    B.cyl('S', '#232832', 0.06, 0.11, 6.6, x, y + 3.3, z, 6);
    const [ax, az] = rot(a, 0, 0.75), [hx, hz] = rot(a, 0, 1.45);
    B.box('S', '#232832', 0.1, 0.1, 1.7, x + ax, y + 6.62, z + az, a);
    B.box('L', LAMP_COL, 0.34, 0.09, 0.9, x + hx, y + 6.52, z + hz, a);
    B.cyl('S', '#2e3440', 0.16, 0.19, 0.5, x, y + 0.25, z, 6);
    if (((x * 7 + z * 13) | 0) % 5 === 0) { const [bx, bz] = rot(a, 0.34, 0); B.box('S', PAINT[(((x + z) | 0) >>> 0) % 7], 0.55, 1.3, 0.04, x + bx, y + 4.6, z + bz, a); }
    B.pool(x + hx * 1.2, y + 0.03, z + hz * 1.2, 8);
  },
  bin(B, x, y, z, a) {
    B.cyl('S', '#39404c', 0.27, 0.24, 0.86, x, y + 0.43, z, 8); B.cyl('S', '#1c2028', 0.3, 0.3, 0.07, x, y + 0.9, z, 8);
    const [ox, oz] = rot(a, 0.62, 0);
    B.cyl('S', '#2f6f4f', 0.27, 0.24, 0.86, x + ox, y + 0.43, z + oz, 8); B.cyl('S', '#1c2028', 0.3, 0.3, 0.07, x + ox, y + 0.9, z + oz, 8);
    B.box('G', '#7dff9c', 0.2, 0.06, 0.02, x + ox + rot(a, 0, 0.28)[0], y + 0.6, z + oz + rot(a, 0, 0.28)[1], a);
  },
  bench(B, x, y, z, a) {
    B.box('S', '#8a6a48', 1.8, 0.07, 0.5, x, y + 0.46, z, a);
    const [bx, bz] = rot(a, 0, -0.27); B.box('S', '#8a6a48', 1.8, 0.42, 0.06, x + bx, y + 0.78, z + bz, a);
    for (const s of [-0.75, 0.75]) { const [lx, lz] = rot(a, s, -0.05); B.box('S', '#1c2028', 0.07, 0.46, 0.5, x + lx, y + 0.23, z + lz, a); }
  },
  planter(B, x, y, z) { B.box('S', '#59606c', 1.6, 0.55, 1.6, x, y + 0.275, z); B.blob('S', '#2c7a4c', 0.85, 0.55, 0.85, x, y + 0.85, z, x); B.blob('S', (x | 0) % 2 ? '#c05a8f' : '#d9b84a', 0.4, 0.3, 0.4, x + 0.3, y + 1.15, z - 0.2, z); },
  hydrant(B, x, y, z) { B.cyl('S', '#b8452f', 0.13, 0.15, 0.62, x, y + 0.31, z, 8); B.cyl('S', '#d9dde4', 0.17, 0.17, 0.08, x, y + 0.66, z, 8); B.box('G', '#7dff9c', 0.08, 0.08, 0.3, x, y + 0.45, z); },
  vend(B, x, y, z, a) {
    B.box('S', '#1d222c', 1.2, 1.95, 0.8, x, y + 0.975, z, a);
    const [fx, fz] = rot(a, -0.14, 0.41); B.box('G', (x | 0) % 2 ? '#59e0ff' : '#ff7ad9', 0.78, 1.25, 0.03, x + fx, y + 1.2, z + fz, a);
    const [gx, gz] = rot(a, 0.42, 0.41); B.box('G', '#ffd34d', 0.2, 0.5, 0.03, x + gx, y + 1.15, z + gz, a);
  },
  rack(B, x, y, z, a) { B.box('S', '#2a303b', 2, 0.06, 0.1, x, y + 0.03, z, a); for (const s of [-0.75, -0.25, 0.25, 0.75]) { const [lx, lz] = rot(a, s, 0); B.box('S', '#aeb6c2', 0.05, 0.8, 0.55, x + lx, y + 0.42, z + lz, a); } },
  box(B, x, y, z, a) { B.box('S', '#4a5a52', 0.95, 1.15, 0.5, x, y + 0.575, z, a); B.box('S', '#2a303b', 1.0, 0.06, 0.55, x, y + 1.18, z, a); },
  ad(B, x, y, z, a) {
    B.box('S', '#1c2028', 0.14, 0.75, 0.3, x, y + 0.375, z, a); B.box('S', '#1c2028', 0.2, 1.9, 1.36, x, y + 1.7, z, a);
    const c = ['#ff7ad9', '#59e0ff', '#ffd34d', '#7dff9c'][(((x * 3 + z) | 0) >>> 0) % 4];
    const k = (((x * 7 + z * 3) | 0) >>> 0) % ADS.length;   // a poster on each face, lit from behind
    for (const s of [-1, 1]) { const [fx, fz] = rot(a, s * 0.11, 0); B.box('G', c, 0.02, 1.7, 1.2, x + fx, y + 1.7, z + fz, a); const [px, pz] = rot(a, s * 0.13, 0); B.poster(adUV((k + (s > 0 ? 0 : 3)) % ADS.length), 1.04, 1.56, x + px, y + 1.7, z + pz, a + s * Math.PI / 2); }
  },
  // a parked pod: extra picks the paint
  // a parked car, taxi or van (extra picks which, and its paint)
  pod(B, x, y, z, a, k = 0) { const type = k % 10 === 3 ? 'taxi' : k % 5 === 1 ? 'van' : 'car'; drawVehicle(B, type, x, y, z, a, type === 'taxi' ? TAXI : PAINTS[k % PAINTS.length], undefined, true); },
  lorry(B, x, y, z, a, k = 0) { drawVehicle(B, 'truck', x, y, z, a, BOXES[k % BOXES.length], undefined, true); },
  shelter(B, x, y, z, a) {
    const [bx, bz] = rot(a, 0, -0.75); B.box('S', '#5d7f96', 6, 2.2, 0.08, x + bx, y + 1.25, z + bz, a);
    const [rx, rz] = rot(a, 0, 0.05); B.box('B', '#232832', 6.4, 0.12, 1.9, x + rx, y + 2.5, z + rz, a);
    for (const s of [-2.9, 2.9]) { const [px, pz] = rot(a, s, 0.8); B.box('S', '#232832', 0.1, 2.5, 0.1, x + px, y + 1.25, z + pz, a); const [qx, qz] = rot(a, s, -0.75); B.box('S', '#232832', 0.1, 2.5, 0.1, x + qx, y + 1.25, z + qz, a); }
    const [sx, sz] = rot(a, -0.6, -0.4); B.box('S', '#8a6a48', 3.2, 0.07, 0.42, x + sx, y + 0.48, z + sz, a);
    const [dx, dz] = rot(a, 2.2, -0.68); B.box('G', '#ffd34d', 1.1, 0.55, 0.04, x + dx, y + 1.75, z + dz, a);
    const [lx, lz] = rot(a, 0, 0.05); B.box('L', LAMP_COL, 5.6, 0.04, 0.2, x + lx, y + 2.42, z + lz, a);
    { const k = (((x * 5 + z * 11) | 0) >>> 0) % ADS.length, [ix, iz] = rot(a, -1.6, -0.69), [ox, oz] = rot(a, 0.9, -0.81);   // posters: one inside on the back wall, a bigger one outside
      B.poster(adUV(k), 1, 1.5, x + ix, y + 1.45, z + iz, a); B.poster(adUV((k + 2) % ADS.length), 1.2, 1.8, x + ox, y + 1.25, z + oz, a + Math.PI); }
    const [ex, ez] = rot(a, 3.6, 0.9); B.cyl('S', '#232832', 0.05, 0.05, 2.9, x + ex, y + 1.45, z + ez, 6); B.box('G', '#59e0ff', 0.5, 0.5, 0.05, x + ex, y + 2.7, z + ez, a);
  },
  locker(B, x, y, z, a) {
    B.box('S', '#2b3340', 3, 2, 0.7, x, y + 1, z, a);
    for (let i = -2; i <= 2; i++) { const [lx, lz] = rot(a, i * 0.58, 0.36); B.box('S', '#3d4757', 0.5, 1.7, 0.02, x + lx, y + 1, z + lz, a); }
    const [gx, gz] = rot(a, 0, 0.37); B.box('G', '#ffd34d', 2.9, 0.08, 0.02, x + gx, y + 1.94, z + gz, a);
  },
  fountain(B, x, y, z) {
    B.cyl('B', '#6a7280', 3.4, 3.5, 0.55, x, y + 0.275, z, 20); B.cyl('S', '#2a7f9f', 3.05, 3.05, 0.02, x, y + 0.57, z, 20);
    B.cyl('S', '#8a94a6', 0.5, 0.7, 1.6, x, y + 0.8, z, 10); B.cyl('S', '#6a7280', 1.3, 0.4, 0.25, x, y + 1.7, z, 12); B.cyl('G', '#9fe9ff', 0.12, 0.12, 1.1, x, y + 2.3, z, 6);
  },
  truck(B, x, y, z, a) {
    B.box('B', '#d9c9a6', 2.3, 2.1, 5.2, x, y + 1.5, z, a); B.box('S', '#1c2028', 2.1, 0.5, 4.8, x, y + 0.35, z, a);
    const [hx, hz] = rot(a, 1.17, 0.4); B.box('G', '#ffb347', 0.03, 0.9, 2.6, x + hx, y + 1.75, z + hz, a);
    const [ax, az] = rot(a, 1.7, 0.4); B.box('S', '#c0483f', 1.1, 0.06, 3, x + ax, y + 2.45, z + az, a);
    const [sx, sz] = rot(a, 0, 0); B.box('G', '#ff7ad9', 1.6, 0.4, 0.05, x + sx, y + 2.8, z + sz, a + Math.PI / 2);
  },
  // beach furniture
  umbrella(B, x, y, z, a, k = 0) { B.cyl('S', '#e9edf2', 0.04, 0.04, 2.3, x, y + 1.15, z, 6); B.cyl('S', ['#c0483f', '#2f6f8f', '#d9b84a', '#e9edf2', '#2f8f5a'][k % 5], 0.12, 1.55, 0.5, x, y + 2.35, z, 10); },
  lounger(B, x, y, z, a) { B.box('S', '#e9edf2', 0.7, 0.1, 1.9, x, y + 0.3, z, a); const [hx, hz] = rot(a, 0, -0.8); B.box('S', '#e9edf2', 0.7, 0.5, 0.1, x + hx, y + 0.5, z + hz, a); for (const s of [-0.7, 0.7]) { const [lx, lz] = rot(a, 0, s); B.box('S', '#8a6a48', 0.6, 0.28, 0.08, x + lx, y + 0.14, z + lz, a); } },
  guard(B, x, y, z) { for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.box('S', '#8a6a48', 0.18, 2.6, 0.18, x + sx * 1.1, y + 1.3, z + sz * 1.1); B.box('B', '#e9edf2', 2.8, 0.15, 2.8, x, y + 2.65, z); B.box('B', '#c0483f', 2.2, 1.5, 2.2, x, y + 3.45, z); B.box('S', '#e9edf2', 2.9, 0.12, 2.9, x, y + 4.25, z); B.box('L', '#fff0d2', 1.2, 0.5, 0.05, x, y + 3.5, z + 1.12); B.cyl('S', '#e9edf2', 0.03, 0.03, 2, x + 1.2, y + 5.2, z + 1.2, 5); B.box('S', '#d9b84a', 0.7, 0.45, 0.03, x + 1.55, y + 5.9, z + 1.2); },
  hut(B, x, y, z, a, k = 0) { B.box('B', ['#c0483f', '#2f6f8f', '#d9b84a', '#2f8f5a', '#c9709f'][k % 5], 2.2, 2.3, 2.2, x, y + 1.15, z); B.gable('B', '#e9edf2', 2.5, 2.5, 0.8, x, y + 2.3, z); B.box('S', '#e9edf2', 0.8, 1.8, 0.05, x, y + 0.9, z - 1.12); },
  boards(B, x, y, z, a) { B.box('S', '#8a6a48', 3, 0.1, 0.3, x, y + 1.3, z, a); for (let k = 0; k < 5; k++) { const [lx, lz] = rot(a, -1.2 + k * 0.6, 0.15); B.box('S', ['#ff7a45', '#59e0ff', '#ffd34d', '#e9edf2', '#7dff9c'][k], 0.5, 2.2, 0.08, x + lx, y + 1.1, z + lz, a); } },
  bollard(B, x, y, z) { B.cyl('S', '#39404c', 0.09, 0.1, 0.72, x, y + 0.36, z, 6); B.cyl('L', '#ffb347', 0.1, 0.1, 0.05, x, y + 0.75, z, 6); },
  // traffic signal: pole and mast arm; the lamps themselves are separate (they change colour)
  signal(B, x, y, z, a) {
    B.cyl('S', '#232832', 0.08, 0.12, 6, x, y + 3, z, 6);
    const [ax, az] = rot(a, 0, 2.2); B.box('S', '#232832', 0.12, 0.12, 4.4, x + ax, y + 5.9, z + az, a);
    const [hx, hz] = rot(a, 0, 4.2); B.box('S', '#11151c', 0.42, 1.25, 0.42, x + hx, y + 5.2, z + hz, a);
    B.box('S', '#11151c', 0.42, 1.25, 0.42, x, y + 3.2, z, a);
  },
};

// Trees: 0 green, 1 blossom, 2 palm. s scales the tree.
export function tree(B, x, y, z, s, kind) {
  if (kind === 2) {
    B.cyl('S', '#6a5a48', 0.13 * s, 0.24 * s, 7.4 * s, x, y + 3.7 * s, z, 6);
    for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2 + x, [fx, fz] = rot(a, 0, 1.5 * s); B.box('S', k % 2 ? '#2f8f5a' : '#3a9a52', 0.5 * s, 0.08, 3 * s, x + fx, y + (7.3 - (k % 2) * 0.35) * s, z + fz, a); }
    B.blob('S', '#2f8f5a', 0.7 * s, 0.5 * s, 0.7 * s, x, y + 7.5 * s, z, x);
    return;
  }
  B.cyl('S', '#3b2f2a', 0.15 * s, 0.25 * s, 3.6 * s, x, y + 1.8 * s, z, 6);
  B.blob('B', kind ? '#b65a8d' : '#2f8f5a', 2.4 * s, 2.0 * s, 2.4 * s, x, y + 4.6 * s, z, x + z);
  B.blob('S', kind ? '#c9709f' : '#3a9a52', 1.5 * s, 1.3 * s, 1.5 * s, x + 0.9 * s, y + 5.8 * s, z - 0.5 * s, z);
  B.quad('S', '#20242c', 1.5, 1.5, x, y + 0.012, z);
}
