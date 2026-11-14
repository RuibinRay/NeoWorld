// Procedural character rigs: humans, androids, dogs (bio + robot), rovers and drones.
// All rigs face +z. A humanoid is one skinned mesh on a small skeleton (plus one mesh for its
// glowing trim), so a whole person costs two draw calls. animateRig() drives the bones from a
// pose state, so every transition (walk -> sit -> eat ...) blends instead of snapping.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { std, neon } from '../world/materials.js';
import { TAU, lerp, clamp, smooth, RNG } from '../core/util.js';
import { flatten } from '../world/batch.js';

const cacheG = new Map();
const geo = (key, make) => { let g = cacheG.get(key); if (!g) { g = make(); cacheG.set(key, g); } return g; };
const BOX = new THREE.BoxGeometry(1, 1, 1);
const capsule = (r, len) => geo(`c${r}:${len}`, () => new THREE.CapsuleGeometry(r, len, 3, 8));
const sphere = (r) => geo(`s${r}`, () => new THREE.SphereGeometry(r, 12, 9));
const ball = (r) => geo(`b${r}`, () => new THREE.SphereGeometry(r, 8, 6));          // small parts
const cylinder = (r, h, seg = 10) => geo(`y${r}:${h}:${seg}`, () => new THREE.CylinderGeometry(r, r, h, seg));
const TORSO = new THREE.CylinderGeometry(1, 0.84, 0.5, 14);                           // unit-radius tapered trunk
const HAIRCAP = new THREE.SphereGeometry(0.127, 12, 8, 0, TAU, 0, Math.PI * 0.52);
function part(g, mat, parent, x = 0, y = 0, z = 0, sx, sy, sz) {
  const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); if (sx !== undefined) m.scale.set(sx, sy, sz); m.castShadow = true; parent.add(m); return m;
}
const box = (mat, parent, w, h, d, x, y, z) => part(BOX, mat, parent, x, y, z, w, h, d);

export const SKINS = ['#f1c9a5', '#e0ac7e', '#c68d6b', '#a56b46', '#7b4a2f', '#4f2f1f'];
export const HAIRS = ['#16171c', '#3a2a1e', '#7a4a25', '#c9a063', '#b8bcc6', '#d24b7a', '#4ab8d9', '#7b5cd6'];
export const CLOTHES = ['#2c3e63', '#1c1f27', '#7a2f3b', '#2f6b55', '#c9b68f', '#4a3f6e', '#b8552a', '#d7dbe2', '#34495e', '#8a6a2f', '#205a7a', '#5b2e4f'];
export const ACCENTS = ['#59e0ff', '#ff7ad9', '#7dff9c', '#ffd34d', '#b98cff', '#ff9a52'];
export const HAIR_STYLES = ['Short', 'Long', 'Bun', 'Crest', 'Shaved', 'Bob', 'Afro', 'Ponytail', 'Braids', 'Curls', 'Side part', 'Quiff', 'Wavy', 'Undercut'];
const SHOES = ['#15171c', '#15171c', '#e8e8ea', '#5a3a26', '#2c3e63', '#7a2f3b'];
const HATS = ['cap', 'beanie', 'brim', 'phones', 'hood'];
export const EYES = ['#3b2a1e', '#5a3d28', '#2b1c14', '#2f4f6b', '#3f6b4a', '#6b6f78', '#7a5a2a'];
const SHIRTS = ['#d7dbe2', '#f1ede6', '#1c1f27', '#c9b68f', '#8fb7c9', '#c98f9d', '#9dc98f'];

// Everyone shares two materials; the colors live in the vertices.
const CLOTH_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, side: THREE.DoubleSide });
const SHELL_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.36, metalness: 0.7 });
const DEFAULT_STYLE = { swing: 1, stride: 1, bounce: 1, posture: 0, sway: 1, stiff: false };

// More variety from a seed, without touching who anybody is: outfit details, accessories,
// body shape and a personal way of walking. The same seed always gives the same person.
export function varyLook(look, seed, o = {}) {
  if (!look) return look;
  const r = new RNG(seed >>> 0), l = { ...look }, pick = (a) => a[Math.floor(r.next() * a.length)];
  if (l.kind === 'android') {
    if (l.headType === undefined) l.headType = Math.floor(r.next() * 4);
    l.style = { ...DEFAULT_STYLE, swing: 0.55, bounce: 0.35, sway: 0.2, stiff: true };
    return l;
  }
  const def = (k, v) => { if (l[k] === undefined) l[k] = v; };
  def('girth', 0.9 + r.next() * 0.34);
  def('shape', o.child ? 0.3 : r.next()); def('faceW', 0.95 + r.next() * 0.11); def('jaw', 0.88 + r.next() * 0.24); def('nose', 0.85 + r.next() * 0.35); def('brow', 0.8 + r.next() * 0.6);
  def('eye', pick(EYES)); def('shirt', pick(SHIRTS)); def('boots', r.chance(0.2));
  def('outfit', l.coat ? 'coat' : pick(['plain', 'plain', 'plain', 'jacket', 'jacket', 'vest']));
  def('legs', l.outfit !== 'coat' && !o.elder && l.shape > 0.5 && r.chance(0.3) ? 'skirt' : !l.coat && !o.elder && r.chance(0.13) ? 'shorts' : 'trousers');
  def('sleeves', l.coat ? 'long' : pick(['long', 'long', 'short', 'short', 'none']));
  def('hat', r.chance(o.child ? 0.4 : 0.28) ? pick(HATS) : null);
  def('hatColor', pick(CLOTHES));
  def('glasses', !l.visor && r.chance(o.elder ? 0.45 : 0.16));
  def('beard', !o.child && r.chance(0.15));
  def('scarf', r.chance(0.13) ? pick(CLOTHES) : null);
  def('vest', pick(CLOTHES));
  def('bag', !l.pack && r.chance(0.17));
  def('shoe', pick(SHOES));
  if (o.generic && l.hairStyle !== 4 && r.chance(0.34)) l.hairStyle = 6 + Math.floor(r.next() * 8);
  l.style = { swing: 0.75 + r.next() * 0.5, stride: 0.92 + r.next() * 0.16, bounce: 0.7 + r.next() * 0.7, posture: -0.02 + r.next() * 0.07, sway: 0.6 + r.next() * 0.9, stiff: false };
  def('prop', o.child ? null : pick([null, null, null, 'phone', 'phone', 'bag', 'cup'])); def('bagCol', pick(['#b98a3e', '#e9e3d5', '#3a2f2a', '#7a2f3b', '#2f6b55']));
  if (o.elder) Object.assign(l.style, { posture: 0.17, stride: 0.84, bounce: 0.5, swing: 0.6 });
  if (o.child) Object.assign(l.style, { bounce: 1.5, swing: 1.25 });
  return l;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
const colCache = new Map();
const lin = (hex) => { let c = colCache.get(hex); if (!c) colCache.set(hex, (c = new THREE.Color(hex))); return c; };
const mix = (a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();

// A lofted surface through elliptical rings [y, rx, rz, zCenter], listed top to bottom: torsos,
// limbs, heads, jackets, skirts and hair are all made with it. A partial sweep leaves it open
// (phi 0 is the front, +z).
function loft(rings, seg = 12, phi0 = 0, phiLen = TAU, caps = true) {
  const pos = [], idx = [], full = phiLen >= TAU - 1e-6, cols = full ? seg : seg + 1, R = rings.length;
  for (const [y, rx, rz, zc = 0] of rings) for (let k = 0; k < cols; k++) { const a = phi0 + (k / seg) * phiLen; pos.push(Math.sin(a) * rx, y, Math.cos(a) * rz + zc); }
  for (let i = 0; i < R - 1; i++) for (let k = 0; k < seg; k++) {
    const k1 = full ? (k + 1) % seg : k + 1, a = i * cols + k, b = i * cols + k1, c = (i + 1) * cols + k, d = (i + 1) * cols + k1;
    idx.push(a, c, b, b, c, d);
  }
  if (full && caps) {
    let t = pos.length / 3; pos.push(0, rings[0][0], rings[0][3] || 0); for (let k = 0; k < seg; k++) idx.push(t, k, (k + 1) % seg);
    t = pos.length / 3; const o = (R - 1) * cols; pos.push(0, rings[R - 1][0], rings[R - 1][3] || 0); for (let k = 0; k < seg; k++) idx.push(t, o + ((k + 1) % seg), o + k);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  g.userData.own = true; return g;
}

// Bake parts into one skinned geometry. A part is { g, color, bone, m: [x, y, z, sx, sy, sz, rx, rz], blend }.
// color may be a function of the height inside the part (sleeves, shorts, joint bands);
// blend = [bone2, y, half] hands the vertices below y over to a second bone, smoothly, so limbs bend.
function bake(parts, bones, colored) {
  const geos = [];
  for (const p of parts) {
    const g = p.g.userData.own ? p.g : p.g.clone(), m = p.m;
    if (g.attributes.uv) g.deleteAttribute('uv');
    // most parts are only moved, not turned or scaled: translating is far cheaper than a full transform
    const plain = m[3] === 1 && m[4] === 1 && m[5] === 1 && !m[6] && !m[7];
    if (!plain) { _m.compose(_v.set(m[0], m[1], m[2]), _q.setFromEuler(_e.set(m[6] || 0, 0, m[7] || 0)), _s.set(m[3], m[4], m[5])); g.applyMatrix4(_m); }
    else if (m[0] || m[1] || m[2]) g.translate(m[0], m[1], m[2]);
    const P = g.attributes.position, n = P.count, bi = bones.indexOf(p.bone), b2 = p.blend ? bones.indexOf(p.blend[0]) : bi, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    const col = colored ? new Float32Array(n * 3) : null, fn = typeof p.color === 'function';
    for (let i = 0; i < n; i++) {
      const y = P.getY(i);
      let w2 = 0; if (p.blend) { const t = clamp((p.blend[1] + p.blend[2] - y) / (2 * p.blend[2]), 0, 1); w2 = t * t * (3 - 2 * t); }
      si[i * 4] = bi; si[i * 4 + 1] = b2; sw[i * 4] = 1 - w2; sw[i * 4 + 1] = w2;
      if (col) { const c = lin(fn ? p.color(y) : p.color); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    }
    const bw = p.bone.matrixWorld.elements;
    if (bw[0] === 1 && bw[5] === 1 && bw[10] === 1) g.translate(bw[12], bw[13], bw[14]); else g.applyMatrix4(p.bone.matrixWorld);
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    if (col) g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geos.push(g);
  }
  const out = mergeGeometries(geos); for (const g of geos) g.dispose();
  return out;
}

export function makeHumanoid(a) {
  const android = a.kind === 'android';
  const root = new THREE.Group(), body = new THREE.Group();
  const s = (a.height || 1.75) / 1.75, w = a.build || 1, girth = a.girth || 1, shape = android ? 0.2 : a.shape ?? 0.35;
  body.scale.setScalar(s); root.add(body);
  const skin = android ? a.shell || '#dfe5ee' : a.skin || SKINS[2];
  const top = a.top || (android ? '#eef2f6' : CLOTHES[0]), bottom = a.bottom || (android ? '#3b4250' : CLOTHES[1]);
  const outfit = android ? 'plain' : a.outfit || (a.coat ? 'coat' : a.vest ? 'vest' : 'plain');     // plain | jacket | coat | vest
  const legwear = android ? 'trousers' : a.legs || (a.shorts ? 'shorts' : 'trousers');              // trousers | shorts | skirt
  const shirt = outfit === 'jacket' || outfit === 'coat' ? a.shirt || '#d7dbe2' : top, sleeves = android ? 'long' : a.sleeves || 'long';
  const shoe = a.shoe || '#15171c', dark = '#14151a', steel = '#1c2028', accentHex = a.accent || ACCENTS[0];
  const bones = [], parts = [], glow = [];
  const bone = (parent, x, y, z) => { const b = new THREE.Bone(); b.position.set(x, y, z); if (parent) parent.add(b); bones.push(b); return b; };
  const P = (g, color, b, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0, blend) => parts.push({ g, color, bone: b, m: [x, y, z, sx, sy, sz, rx, rz], blend });
  const B = (color, b, bw, bh, bd, x, y, z, rx, rz) => P(BOX, color, b, x, y, z, bw, bh, bd, rx, rz);
  const L = (rings, color, b, blend, seg, phi0, phiLen) => P(loft(rings, seg, phi0, phiLen), color, b, 0, 0, 0, 1, 1, 1, 0, 0, blend);
  const Gl = (g, b, x, y, z, sx = 1, sy = 1, sz = 1) => glow.push({ g, color: null, bone: b, m: [x, y, z, sx, sy, sz, 0, 0] });

  const hips = bone(null, 0, 0.93, 0), chest = bone(hips, 0, 0.08, 0), head = bone(chest, 0, 0.73, 0);
  head.scale.setScalar(a.child ? 1.18 : 1);
  // body shape: 0 is broad-shouldered and straight, 1 is narrow-shouldered with a waist and wider hips
  const sh = lerp(1.06, 0.9, shape), waist = lerp(0.82, 0.68, shape), hipW = lerp(0.9, 1.07, shape);
  const hw = 0.2 * w, hd = 0.118 * girth;
  const trunk = (k, from = 0, to = 8) => [[0.58, 0.058 * k, 0.056 * k], [0.548, hw * 0.6 * sh * k, hd * 0.7 * k], [0.495, hw * 1.02 * sh * k, hd * 0.97 * k], [0.4, hw * sh * k, hd * (1.04 + shape * 0.1) * k, 0.005 + shape * 0.012],
    [0.26, hw * lerp(sh, waist, 0.6) * k, hd * 0.97 * k, 0.004], [0.12, hw * waist * k, hd * 0.9 * k], [0.0, hw * lerp(waist, hipW, 0.6) * k * 1.03, hd * 0.95 * k * 1.03], [-0.07, hw * hipW * k * 1.03, hd * 0.98 * k * 1.03]].slice(from, to);
  // pelvis, trunk, neck
  L([[0.1, hw * waist, hd * 0.9], [0.03, hw * hipW, hd * 0.98], [-0.05, hw * hipW * 1.02, hd], [-0.13, hw * hipW * 0.7, hd * 0.78]], android ? (y) => (y > 0.06 ? steel : bottom) : bottom, hips);
  L(trunk(1), android ? (y) => (y < 0.1 ? steel : y > 0.3 && y < 0.5 ? top : skin) : shirt, chest, null, 14);
  L([[0.67, 0.046, 0.05], [0.56, 0.053, 0.057]], android ? steel : skin, chest, null, 10);
  const over = outfit === 'plain' ? 1 : 1.085;
  if (outfit === 'vest') L(trunk(1.06, 1), a.vest || CLOTHES[4], chest, null, 14);
  else if (outfit === 'jacket') L(trunk(1.075, 1), top, chest, null, 14, 0.4, TAU - 0.8);                                   // worn open over the shirt
  else if (outfit === 'coat') L([...trunk(1.075, 1), [-0.22, hw * hipW * 1.12, hd * 1.14], [-0.44, hw * hipW * 1.16, hd * 1.2]], top, chest, [hips, -0.02, 0.07], 14, 0.4, TAU - 0.8);
  if (outfit !== 'plain' && !android) L([[0.615, 0.07, 0.074, -0.004], [0.565, 0.078, 0.08, -0.004]], top, chest, null, 10, 0.55, TAU - 1.1); // collar
  if (legwear === 'skirt') L([[0.08, hw * waist * 1.06, hd * 0.96], [-0.04, hw * hipW * 1.1, hd * 1.1], [-0.4, hw * 1.22, hd * 1.75]], bottom, hips, null, 14, 0, TAU, false);
  for (const sx of [-1, 1]) Gl(BOX, chest, sx * 0.13 * w * sh, 0.37, 0.006, 0.018, 0.3, hd * 2.14 * over);
  if (a.pack) B('#262a33', chest, 0.26, 0.34, 0.12, 0, 0.32, -hd * over - 0.05);
  if (a.bag) { B('#3a2f2a', hips, 0.08, 0.2, 0.25, hw * hipW * over + 0.04, -0.03, 0.01); B('#3a2f2a', chest, 0.03, 0.66, 0.012, 0.01, 0.27, hd * over + 0.006, 0, 0.62); }
  if (a.scarf) L([[0.64, 0.066, 0.07], [0.6, 0.082, 0.086], [0.555, 0.08, 0.084]], a.scarf, chest, null, 10);

  let visorMat = null, mouth = null, lipLow = null, browL = null, browR = null, eyes = null, gaze = null;
  if (android) {
    const ht = a.headType || 0;
    if (ht === 1) { B(skin, head, 0.2, 0.2, 0.2, 0, 0.01, 0); B('#0a0c10', head, 0.17, 0.09, 0.02, 0, 0.02, 0.095); for (const sx of [-1, 1]) Gl(BOX, head, sx * 0.04, 0.02, 0.108, 0.036, 0.036, 0.01); }
    else if (ht === 2) { P(cylinder(0.085, 0.22, 12), skin, head, 0, 0.01, 0); P(cylinder(0.088, 0.05, 12), '#0a0c10', head, 0, 0.03, 0); Gl(cylinder(0.09, 0.022, 12), head, 0, 0.03, 0); }
    else if (ht === 3) { P(sphere(0.12), skin, head, 0, 0, 0, 1.25, 0.76, 1.0); B('#0a0c10', head, 0.22, 0.07, 0.03, 0, 0, 0.1); Gl(BOX, head, 0, 0, 0.118, 0.2, 0.02, 0.012); }
    else { L([[0.13, 0.03, 0.03], [0.11, 0.085, 0.085], [0.05, 0.118, 0.12], [-0.03, 0.112, 0.116], [-0.09, 0.08, 0.085], [-0.118, 0.05, 0.05]], skin, head, null, 14); B('#0a0c10', head, 0.17, 0.1, 0.03, 0, 0.012, 0.106); Gl(BOX, head, 0, 0.015, 0.124, 0.145, 0.028, 0.012); }
    if (a.antenna) { B(steel, head, 0.012, 0.12, 0.012, 0.07, 0.17, 0); Gl(ball(0.016), head, 0.07, 0.235, 0); }
    Gl(BOX, chest, 0, 0.42, hd * 1.05 + 0.006, 0.07, 0.07, 0.01);
    visorMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(accentHex).multiplyScalar(1.6) });
  } else {
    // head: crown, brow, cheek, jaw and chin as one surface; fuller at the back, chin set forward
    const fw = a.faceW || 1, jaw = a.jaw || 1, hair = a.hair || HAIRS[0], st = a.hairStyle ?? 0, hat = a.hat || null, low = hat && hat !== 'phones';
    L([[0.131, 0.03 * fw, 0.035], [0.118, 0.07 * fw, 0.078, -0.002], [0.09, 0.098 * fw, 0.108, -0.004], [0.05, 0.11 * fw, 0.122, -0.004], [0.01, 0.113 * fw, 0.124, -0.004], [-0.03, 0.108 * fw * lerp(1, jaw, 0.4), 0.118, -0.002],
      [-0.065, 0.093 * fw * jaw, 0.104, 0.004], [-0.095, 0.069 * fw * jaw, 0.082, 0.012], [-0.116, 0.04 * fw * jaw, 0.05, 0.022]], skin, head, null, 13);
    for (const sx of [-1, 1]) { P(ball(0.024), skin, head, sx * 0.112 * fw, 0.004, -0.012, 0.5, 1, 0.75); }                              // ears
    const ns = a.nose || 1;                                                                                                              // nose: a bridge and a tip
    P(geo('nose', () => new THREE.CylinderGeometry(0.0045, 0.0165, 0.056, 4)), skin, head, 0, 0.004, 0.122, ns, 1, ns, -0.3); P(ball(0.0135), skin, head, 0, -0.024, 0.131, 1.2 * ns, 0.8, 0.9 * ns);
    // eyes: whites, colored irises and pupils that follow the gaze, a lash line; the whole set closes to blink
    eyes = bone(head, 0, 0.018, 0.108); gaze = bone(eyes, 0, 0, 0);
    for (const sx of [-1, 1]) {
      P(ball(0.02), '#ece8e1', eyes, sx * 0.043, 0, 0, 1.05, 0.6, 0.4); B(dark, eyes, 0.043, 0.0045, 0.006, sx * 0.043, 0.011, 0.005, 0, -sx * 0.06);
      P(ball(0.0105), a.eye || '#3b2a1e', gaze, sx * 0.043, 0, 0.0052, 1, 1, 0.45); P(ball(0.0055), '#050506', gaze, sx * 0.043, 0, 0.0088, 1, 1, 0.4);
    }
    const browCol = st === 4 ? dark : mix(hair, '#101014', 0.35), bt = a.brow || 1;
    const brow = (sx) => { const b = bone(head, sx * 0.043, 0.05, 0.112); B(browCol, b, 0.047, 0.0085 * bt, 0.01, 0, 0, 0, 0, -sx * 0.1); return b; };
    browL = brow(1); browR = brow(-1);
    // mouth: two lips over a dark interior with teeth; the lower lip drops to speak or smile
    const lip = a.lip || mix(skin, '#a8484a', 0.5);
    mouth = bone(head, 0, -0.062, 0.103); lipLow = bone(mouth, 0, 0, 0);
    B('#2a1214', mouth, 0.04, 0.016, 0.004, 0, -0.004, -0.002); B('#f1efe8', mouth, 0.03, 0.006, 0.004, 0, 0.0015, 0.0005);
    P(ball(0.02), lip, mouth, 0, 0.0045, 0, 1.2, 0.26, 0.42); P(ball(0.02), lip, lipLow, 0, -0.0055, 0, 1.08, 0.3, 0.42);
    // hair: a shell that follows the skull to the hairline, a curtain round the back and sides, and
    // separate locks for the fringe and the volume on top. Three shades of the color give it depth.
    const hi = mix(hair, '#ffffff', 0.13), lo = mix(hair, '#000000', 0.24), shade = (y) => (y > 0.105 ? hi : y > -0.02 ? hair : lo), streak = a.streak || null, stub = mix(skin, hair, 0.42), top = !low;
    const scalp = (k = 1, col = shade) => L([[0.147, 0.02, 0.025, -0.004], [0.138, 0.07 * fw * k, 0.078 * k, -0.005], [0.115, 0.1 * fw * k, 0.112 * k, -0.007], [0.09, 0.114 * fw * k, 0.127 * k, -0.008]], col, head, null, 14);
    const curtain = (to, k = 1, flare = 0, gap = 1.9, col = shade) => L([[0.094, 0.115 * fw * k, 0.128 * k, -0.008], [0.04, 0.12 * fw * k, 0.131 * k, -0.01], [Math.max(to, -0.03), 0.12 * fw * k, 0.128 * k, -0.012],
      ...(to < -0.03 ? [[(to - 0.03) / 2, (0.118 + flare * 0.5) * fw * k, (0.124 + flare * 0.5) * k, -0.016], [to, (0.108 + flare) * fw * k, (0.11 + flare) * k, -0.02]] : [])], col, head, null, 12, gap / 2, TAU - gap);
    const lock = (x, y, z, sx, sy, sz, rx = 0, rz = 0, col = streak || hi) => P(ball(0.05), col, head, x, y, z, sx, sy, sz, rx, rz);
    switch (st) {
      case 0: scalp(); curtain(-0.02); if (top) { lock(-0.02, 0.1, 0.092, 1.5, 0.42, 0.75, -0.35, 0.12); lock(0.045, 0.108, 0.07, 1.1, 0.4, 0.8, -0.3, -0.2); } break;                       // short, swept fringe
      case 1: scalp(); curtain(-0.3, 1.0, -0.012, 1.7); if (top) { lock(-0.05, 0.096, 0.09, 1.0, 0.38, 0.7, -0.3, 0.5); lock(0.05, 0.096, 0.09, 1.0, 0.38, 0.7, -0.3, -0.5); } break;   // long, centre part
      case 2: scalp(0.995); curtain(-0.03, 0.995); if (top) P(sphere(0.06), shade, head, 0, 0.135, -0.075); break;                                                                 // bun
      case 3: scalp(0.99, () => stub); curtain(-0.01, 0.99, 0, 1.9, () => stub); if (top) for (let q = 0; q < 6; q++) lock(0, 0.15 - Math.abs(q - 2) * 0.012, 0.085 - q * 0.04, 0.42, 0.75, 0.6, 0, 0, streak || hair); break;   // crest
      case 4: scalp(0.985, () => stub); curtain(-0.015, 0.985, 0, 1.9, () => stub); break;                                                                                          // shaved: a shadow of stubble
      case 5: scalp(); curtain(-0.1, 1.02, 0.014, 1.75); if (top) lock(0, 0.088, 0.095, 2.1, 0.5, 0.6, -0.25, 0); break;                                                           // bob with a straight fringe
      case 6: scalp(); if (top) P(sphere(0.127), shade, head, 0, 0.05, -0.015, 1.3, 1.22, 1.27); else curtain(-0.06, 1.08, 0.02); break;                                             // afro
      case 7: scalp(); curtain(-0.02); P(ball(0.03), shade, head, 0, 0.07, -0.132); L([[0.065, 0.03, 0.03, -0.14], [-0.06, 0.036, 0.036, -0.165], [-0.22, 0.012, 0.012, -0.15]], shade, head, null, 8); if (top) lock(0.03, 0.1, 0.088, 1.5, 0.4, 0.75, -0.35, -0.15); break;   // ponytail
      case 8: scalp(); curtain(-0.02); for (const sx of [-1, 1]) for (let q = 0; q < 6; q++) P(ball(0.024), q % 2 ? hair : lo, head, sx * 0.092, -0.035 - q * 0.042, -0.035 + q * 0.012); if (top) lock(0, 0.096, 0.09, 1.7, 0.4, 0.7, -0.3, 0); break;   // braids
      case 9: scalp(); curtain(-0.05, 1.03, 0.012); if (top) for (let q = 0; q < 12; q++) { const an = q * 0.82, rr = q < 7 ? 0.078 : 0.05; lock(Math.cos(an) * rr, 0.108 + (q % 3) * 0.014 + (q < 7 ? 0 : 0.03), Math.sin(an) * rr - 0.012, 1, 1, 1, 0, 0, q % 4 === 0 && streak ? streak : q % 2 ? hi : hair); } break;   // curls
      case 10: scalp(); curtain(-0.025); if (top) { lock(0.03, 0.118, 0.03, 1.95, 0.55, 1.9, -0.12, -0.22); lock(-0.07, 0.1, 0.07, 0.7, 0.36, 0.9, -0.3, 0.5, lo); } break;             // side part
      case 11: scalp(0.99); curtain(-0.01, 0.99); if (top) { lock(0, 0.14, 0.055, 1.5, 0.95, 1.25, -0.5, 0); lock(0, 0.125, -0.02, 1.6, 0.6, 1.5, 0, 0, hair); } break;               // quiff
      case 12: scalp(); curtain(-0.17, 1.03, 0.02, 1.75); if (top) { lock(-0.04, 0.1, 0.09, 1.3, 0.42, 0.75, -0.3, 0.35); lock(0.05, 0.102, 0.085, 1.2, 0.42, 0.75, -0.3, -0.3); } for (const sx of [-1, 1]) for (let q = 0; q < 3; q++) lock(sx * (0.118 + (q % 2) * 0.012), -0.06 - q * 0.05, -0.02, 0.5, 0.75, 0.9, 0, 0, q % 2 ? hi : hair); break;   // wavy, to the shoulders
      default: scalp(0.985, () => stub); curtain(0.0, 0.985, 0, 1.9, () => stub); if (top) { lock(0, 0.128, 0.0, 1.75, 0.55, 2.2, -0.1, 0); lock(0, 0.112, 0.085, 1.4, 0.45, 0.7, -0.45, 0); }   // undercut: shaved sides, long top swept back
    }
    if (a.beard) L([[-0.04, 0.1 * fw * jaw, 0.11, 0.004], [-0.085, 0.08 * fw * jaw, 0.095, 0.012], [-0.125, 0.045 * fw * jaw, 0.058, 0.022]], hair, head, null, 12, -1.5, 3.0);
    if (a.glasses) { B(dark, head, 0.2, 0.01, 0.01, 0, 0.024, 0.118); for (const sx of [-1, 1]) B('#28323f', head, 0.062, 0.04, 0.006, sx * 0.045, 0.018, 0.121); }
    if (a.visor) Gl(BOX, head, 0, 0.02, 0.125, 0.2, 0.03, 0.02);
    const hc = a.hatColor || top;
    if (hat === 'cap') { P(HAIRCAP, hc, head, 0, 0.024, -0.004, 1.06, 1.14, 1.1, -0.3); B(hc, head, 0.15, 0.012, 0.11, 0, 0.075, 0.15, 0.2); }
    else if (hat === 'beanie') { P(HAIRCAP, hc, head, 0, 0.024, -0.006, 1.07, 1.3, 1.1, -0.3); P(ball(0.03), hc, head, 0, 0.185, -0.05); }
    else if (hat === 'brim') { P(cylinder(0.105, 0.09, 12), hc, head, 0, 0.13, -0.005); P(cylinder(0.2, 0.012, 14), hc, head, 0, 0.09, -0.005); }
    else if (hat === 'hood') { P(HAIRCAP, top, head, 0, 0.018, -0.02, 1.12, 1.22, 1.18, -0.45); B(top, chest, 0.24, 0.1, 0.1, 0, 0.6, -0.085); }
    else if (hat === 'phones') { for (const sx of [-1, 1]) { P(ball(0.04), steel, head, sx * 0.122, 0.005, 0, 0.55, 1, 1); Gl(ball(0.016), head, sx * 0.146, 0.005, 0); } B(steel, head, 0.25, 0.014, 0.03, 0, 0.136, 0); }
  }
  // limbs: one continuous sleeve and trouser leg each, bending smoothly at the elbow and knee
  const at = 0.86 + 0.14 * w, lt = (0.84 + 0.16 * w) * (0.88 + 0.12 * girth);
  const armCol = android ? (y) => (Math.abs(y + 0.3) < 0.035 ? steel : y > -0.3 ? top : skin) : sleeves === 'none' ? (y) => (y > 0.0 ? top : skin) : sleeves === 'short' ? (y) => (y > -0.15 ? top : skin) : (y) => (y > -0.535 ? top : skin);
  const legCol = android ? (y) => (Math.abs(y + 0.44) < 0.04 ? steel : y > -0.44 ? bottom : skin) : legwear === 'shorts' ? (y) => (y > -0.3 ? bottom : skin) : legwear === 'skirt' ? () => skin : () => bottom;
  const limbs = (side) => {
    const shb = bone(chest, side * (hw * sh + 0.042), 0.5, 0), el = bone(shb, 0, -0.3, 0);
    L([[0.05, 0.03 * at, 0.03 * at], [0.02, 0.054 * at, 0.056 * at], [-0.05, 0.056 * at, 0.058 * at], [-0.16, 0.049 * at, 0.05 * at], [-0.27, 0.042 * at, 0.043 * at], [-0.3, 0.041 * at, 0.042 * at], [-0.35, 0.043 * at, 0.044 * at], [-0.46, 0.036 * at, 0.037 * at], [-0.555, 0.028 * at, 0.03 * at]], armCol, shb, [el, -0.3, 0.045], 8);
    P(ball(0.032), skin, el, 0, -0.29, 0.004, 0.46, 1.25, 0.95); P(ball(0.027), skin, el, 0, -0.34, 0.008, 0.42, 1.15, 0.88, 0.25); P(ball(0.012), skin, el, 0, -0.295, 0.032, 1, 1.7, 1, -0.5);  // palm, fingers, thumb
    if (a.prop === 'phone' && side < 0) { B('#101216', el, 0.012, 0.09, 0.046, 0.014, -0.335, 0.03); Gl(BOX, el, 0.022, -0.335, 0.03, 0.004, 0.076, 0.038); }
    else if (a.prop === 'cup' && side < 0) P(cylinder(0.024, 0.08, 10), '#f1ede6', el, 0.01, -0.34, 0.05);
    else if (a.prop === 'bag' && side > 0) { B(a.bagCol || '#b98a3e', el, 0.08, 0.24, 0.3, 0, -0.5, 0.01); B('#2a2f3a', el, 0.012, 0.12, 0.2, 0, -0.36, 0.01); }
    const hip = bone(hips, side * 0.092 * w * lerp(1, 1.07, shape), -0.02, 0), kn = bone(hip, 0, -0.44, 0);
    L([[0.05, 0.07 * lt, 0.07 * lt], [-0.03, 0.088 * lt, 0.09 * lt], [-0.2, 0.079 * lt, 0.082 * lt], [-0.36, 0.063 * lt, 0.066 * lt], [-0.44, 0.058 * lt, 0.06 * lt], [-0.52, 0.06 * lt, 0.062 * lt, -0.004], [-0.63, 0.056 * lt, 0.06 * lt, -0.008], [-0.78, 0.042 * lt, 0.044 * lt, -0.003], [-0.875, 0.037 * lt, 0.04 * lt]], legCol, hip, [kn, -0.44, 0.05], 8);
    B('#0c0d10', kn, 0.098, 0.024, 0.255, 0, -0.47, 0.046); P(ball(0.05), shoe, kn, 0, -0.444, 0.052, 0.96, 0.56, 2.25); P(ball(0.046), shoe, kn, 0, -0.44, -0.034, 0.96, 0.72, 0.9);
    if (a.boots) L([[-0.29, 0.052, 0.055], [-0.44, 0.048, 0.052]], shoe, kn, null, 10);
    return { sh: shb, el, hip, kn };
  };
  const LL = limbs(1), RR = limbs(-1);

  hips.updateMatrixWorld(true);                                     // bind pose
  const mesh = new THREE.SkinnedMesh(bake(parts, bones, true), android ? SHELL_MAT : CLOTH_MAT);
  mesh.add(hips); mesh.castShadow = true; mesh.frustumCulled = true;
  mesh.bind(new THREE.Skeleton(bones));
  mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.95, 0), 1.35);
  body.add(mesh);
  const trim = new THREE.SkinnedMesh(bake(glow, bones, false), visorMat || neon(accentHex, 1.2));
  trim.bind(mesh.skeleton, mesh.bindMatrix); trim.boundingSphere = mesh.boundingSphere; body.add(trim);

  return {
    root, body, mesh, hips, chest, head, eyes, gaze, mouth, lipLow, armL: LL.sh, armR: RR.sh, elbL: LL.el, elbR: RR.el, legL: LL.hip, legR: RR.hip, kneeL: LL.kn, kneeR: RR.kn,
    visorMat, browL, browR, android, accentHex, scale: s, style: { ...DEFAULT_STYLE, ...(android ? { swing: 0.55, bounce: 0.35, sway: 0.2, stiff: true } : null), ...a.style },
    seed: Math.random(), blinkT: 1 + Math.random() * 4, bank: 0, open: 0, eyeOpen: 1, prop: a.prop || null,
    phase: Math.random() * 6, t: Math.random() * 10, lookYaw: 0, carry: false, mood: 'neutral',
    pose: { hipsY: 0.93, lean: 0, twist: 0, sway: 0, lL: 0, lR: 0, kL: 0, kR: 0, aL: 0, aR: 0, eL: -0.15, eR: -0.15, aLz: 0.06, aRz: -0.06, headX: 0, headY: 0, headZ: 0 },
  };
}
function M_dark() { return std('#1c2028', 0.45, 0.8); }

const LEG = [0, 0];
const T = { hipsY: 0, lean: 0, twist: 0, sway: 0, lL: 0, lR: 0, kL: 0, kR: 0, aL: 0, aR: 0, eL: 0, eR: 0, aLz: 0, aRz: 0, headX: 0, headY: 0, headZ: 0 };
export function animateRig(r, dt, anim, speed = 0) {
  r.t += dt;
  const t = r.t, st = r.style;
  T.hipsY = 0.93; T.lean = st.posture; T.twist = 0; T.sway = 0; T.lL = 0; T.lR = 0; T.kL = 0; T.kR = 0; T.aL = 0; T.aR = 0; T.eL = -0.15; T.eR = -0.15; T.aLz = 0.06; T.aRz = -0.06; T.headX = -st.posture * 0.6; T.headY = r.lookYaw; T.headZ = 0;
  let k = 12;
  switch (anim) {
    case 'walk': case 'jog': case 'run': {
      // One gait from a stroll to a sprint, blended by speed. Each leg sweeps back at a steady rate while its
      // foot is on the ground, so the foot stays planted, and swings forward quickly in the air; the step rate
      // follows from the speed, so steps never run ahead of the ground covered or lag behind it.
      const v = speed > 0.05 ? speed : anim === 'run' ? 6.5 : anim === 'jog' ? 3.4 : 1.4;
      const a = smooth((v - 1.6) / 1.8), b = smooth((v - 3.6) / 3.2), rn = smooth((v - 2.4) / 1.6);
      const G3 = (w, j, x) => lerp(lerp(w, j, a), x, b);
      const d = G3(0.62, 0.42, 0.32), A = G3(0.36, 0.55, 0.7) * Math.sqrt(st.stride), kSw = G3(0.95, 1.35, 1.85), kSt = G3(0.1, 0.24, 0.32);
      const L = 0.86 * (r.scale || 1) * st.stride, prev = r.gp || 0;
      r.gp = prev + dt * ((d * v) / (2 * A * L)) * 0.92; if (r.gp > 1) r.gp -= 1;
      if (Math.floor(prev * 2) !== Math.floor(r.gp * 2)) { r.steps = (r.steps || 0) + 1; r.stepRun = rn; }   // a foot comes down
      const leg = (p) => {
        p -= Math.floor(p);
        if (p < d) { const u = p / d; LEG[0] = A * (1 - 2 * u); LEG[1] = kSt * Math.sin(Math.PI * u); }
        else { const u = (p - d) / (1 - d), e = u * u * (3 - 2 * u); LEG[0] = -A + 2 * A * e; LEG[1] = kSw * Math.sin(Math.PI * Math.min(1, u * 1.15)); }
        return LEG;
      };
      const [hL, kL] = leg(r.gp), thL = hL, knL = kL, [hR, kR] = leg(r.gp + 0.5);
      T.lL = -thL; T.kL = knL + 0.04; T.lR = -hR; T.kR = kR + 0.04;
      const arm = G3(0.9, 0.85, 1.0) * st.swing;
      T.aL = thL * arm; T.aR = hR * arm;
      const elb = G3(-0.32, -1.15, -1.5);
      T.eL = elb - Math.max(0, -T.aL) * 0.4 * st.swing; T.eR = elb - Math.max(0, -T.aR) * 0.4 * st.swing;   // the forearm folds on the forward swing
      const q = Math.cos(TAU * 2 * (r.gp - d / 2));                                                        // 1 at mid-stance of either foot
      T.hipsY = 0.93 - rn * 0.035 + q * G3(0.016, 0.035, 0.05) * st.bounce * (1 - 2 * rn) - (kSt * 0.04);    // walking vaults over the leg; running sinks into it
      T.lean = st.posture + G3(0.05, 0.13, 0.25) + (r.accLean || 0);
      T.twist = ((thL - hR) / (2 * A)) * G3(0.08, 0.09, 0.07);
      T.sway = Math.cos(TAU * (r.gp - d / 2)) * G3(0.035, 0.02, 0.012) * st.sway;
      T.headY = r.lookYaw + T.twist * 0.4; T.headX = -st.posture * 0.6 - q * 0.02 * rn;
      k = 30;
      break;
    }
    case 'sit': {
      const v = Math.floor(r.seed * 3);
      T.hipsY = 0.56; T.lL = T.lR = -1.5; T.kL = T.kR = 1.5; T.aL = T.aR = -0.45; T.eL = T.eR = -0.6; T.headX = Math.sin(t * 0.6) * 0.04; T.lean = 0;
      if (v === 1) { T.lR = -1.66; T.kR = 1.15; T.lean = -0.1; T.aL = -0.25; T.eL = -0.95; }                    // one leg out, leaning back
      else if (v === 2) { T.lean = 0.3; T.aL = T.aR = -0.72; T.eL = T.eR = -1.0; T.headX = -0.22 + Math.sin(t * 0.6) * 0.04; }   // elbows on knees
      break;
    }
    case 'eat': {
      const b = Math.max(0, Math.sin(t * 2.4));
      T.hipsY = 0.56; T.lL = T.lR = -1.5; T.kL = T.kR = 1.5; T.aL = -0.5; T.eL = -0.7; T.aR = -0.75 - 0.45 * b; T.eR = -1.5 - 0.7 * b; T.headX = 0.14 * b; T.lean = 0.1;
      break;
    }
    case 'snack': { const b = Math.max(0, Math.sin(t * 2.6)); T.aR = -0.8 - 0.5 * b; T.eR = -1.5 - 0.7 * b; T.headX = 0.12 * b; T.aL = -0.2; T.eL = -0.9; break; }
    case 'taichi': { const a = Math.sin(t * 0.9), b = Math.cos(t * 0.9); T.hipsY = 0.86 + a * 0.03; T.kL = T.kR = 0.35; T.lL = T.lR = -0.2; T.aL = -0.9 + a * 0.5; T.aR = -0.9 - a * 0.5; T.aLz = 0.5 + b * 0.4; T.aRz = -0.5 + b * 0.4; T.eL = T.eR = -0.4; T.twist = a * 0.3; T.lean = 0; k = 5; break; }
    case 'faint': T.hipsY = 0.34; T.lL = T.lR = -1.45; T.kL = T.kR = 0.25; T.lean = 0.5; T.aL = T.aR = 0.2; T.eL = T.eR = -0.2; T.headX = 0.5; k = 6; break;
    case 'board': T.hipsY = 0.85 + Math.sin(t * 3) * 0.01; T.twist = 0.35; T.kL = 0.5; T.kR = 0.45; T.lL = -0.5; T.lR = 0.35; T.aLz = 0.55; T.aRz = -0.7; T.eL = T.eR = -0.3; T.lean = 0.1 + Math.min(0.22, speed * 0.016); break;
    case 'swim': { const s = Math.sin(t * 2.6); T.lean = 0.5; T.aLz = 0.9 + s * 0.7; T.aRz = -0.9 - s * 0.7; T.aL = T.aR = -1.2; T.eL = T.eR = -0.5 - s * 0.4; T.lL = s * 0.5; T.lR = -s * 0.5; T.kL = T.kR = 0.5; T.headX = -0.35; break; }
    case 'drive': T.hipsY = 0.56; T.lL = T.lR = -1.45; T.kL = T.kR = 1.2; T.aL = T.aR = -1.15; T.eL = T.eR = -0.45; T.lean = 0; break;
    case 'talk': { const u = t + r.seed * 20; T.aR = -0.45 + Math.sin(u * 3.1) * 0.22; T.eR = -1.15 + Math.sin(u * 2.3) * 0.3; T.aL = -0.1; T.eL = -0.5 + Math.sin(u * 1.7) * 0.15; T.headX += Math.sin(u * 2.6) * 0.06; T.headZ = Math.sin(u * 0.9) * 0.07; T.sway = Math.sin(u * 0.5) * 0.04; break; }
    case 'wave': T.aRz = -2.5 + Math.sin(t * 9) * 0.3; T.eR = -0.3; T.headZ = -0.1; break;
    case 'work': T.aR = -2.5 + Math.sin(t * 7) * 0.12; T.eR = -0.35; T.aL = -1.7; T.eL = -0.9; T.headX = -0.35; break;
    case 'tend': T.lean = 0.55; T.aL = -1.0 + Math.sin(t * 2.1) * 0.25; T.aR = -1.0 - Math.sin(t * 2.1) * 0.25; T.eL = T.eR = -0.5; T.headX = 0.25; T.hipsY = 0.9; break;
    case 'dance': {
      const u = t + r.seed * 3, b = Math.sin(u * 6.2), v = Math.floor(r.seed * 3);
      T.hipsY = 0.9 + Math.abs(b) * 0.05; T.lL = b * 0.28; T.lR = -b * 0.28; T.kL = Math.max(0, b) * 0.5; T.kR = Math.max(0, -b) * 0.5; T.twist = Math.sin(u * 3.1) * 0.4; T.sway = b * 0.08; T.lean = 0;
      if (v === 0) { T.aLz = 1.7 + b * 0.5; T.aRz = -1.7 + Math.sin(u * 6.2 + 1.3) * 0.5; T.eL = T.eR = -0.7; }                // arms up
      else if (v === 1) { T.aL = -0.6 + b * 0.5; T.aR = -0.6 - b * 0.5; T.eL = T.eR = -1.3; T.aLz = 0.25; T.aRz = -0.25; }         // close, pumping
      else { T.aLz = 0.9 + b * 0.3; T.aRz = -0.9 + b * 0.3; T.eL = -0.9 - b * 0.4; T.eR = -0.9 + b * 0.4; T.headZ = b * 0.1; }      // side to side
      break;
    }
    case 'stumble': T.lean = -0.28; T.aLz = 1.3; T.aRz = -1.3; T.lL = -0.3; T.kR = 0.5; k = 20; break;
    case 'crouch': T.hipsY = 0.6; T.lL = T.lR = -1.05; T.kL = T.kR = 1.75; T.lean = 0.38; T.aL = T.aR = -0.3; break;
    case 'crouchwalk': {
      r.phase += dt * (speed / 0.9) * TAU; const s = Math.sin(r.phase);
      T.hipsY = 0.62; T.lL = -1.0 - s * 0.35; T.lR = -1.0 + s * 0.35; T.kL = 1.6 + s * 0.2; T.kR = 1.6 - s * 0.2; T.lean = 0.4; T.aL = s * 0.3; T.aR = -s * 0.3; k = 20;
      break;
    }
    case 'air': T.lL = -0.55; T.lR = 0.25; T.kL = 0.95; T.kR = 0.5; T.aLz = 0.75; T.aRz = -0.75; T.eL = T.eR = -0.4; k = 16; break;
    case 'phone': T.aR = -0.92; T.eR = -1.55; T.aRz = 0.14; T.headX = 0.3; T.aL = Math.sin(t * 1.1) * 0.03; T.sway = 0.04; break;
    case 'mantle': T.hipsY = 0.82; T.aL = T.aR = -2.3; T.eL = T.eR = -1.0; T.lL = -1.2; T.lR = -0.35; T.kL = 1.5; T.kR = 0.7; T.lean = 0.4; T.headX = -0.2; k = 22; break;
    case 'climb': { const c = Math.sin(r.climbPh || 0); T.aL = -2.45 + c * 0.35; T.aR = -2.45 - c * 0.35; T.eL = -0.55 - c * 0.3; T.eR = -0.55 + c * 0.3; T.lL = -0.75 - c * 0.45; T.lR = -0.75 + c * 0.45; T.kL = 1.0 + c * 0.45; T.kR = 1.0 - c * 0.45; T.lean = 0.12; T.headX = -0.25; k = 16; break; }
    case 'hang': T.aL = T.aR = -2.9; T.eL = T.eR = -0.15; T.lL = -0.5; T.lR = -0.2; T.kL = 0.7; T.kR = 0.4; T.lean = 0.05; T.headX = -0.1; T.sway = Math.sin(t * 2) * 0.05; k = 10; break;
    case 'land': T.hipsY = 0.76; T.lL = T.lR = -0.6; T.kL = T.kR = 1.15; T.lean = 0.32; T.aLz = 0.45; T.aRz = -0.45; T.eL = T.eR = -0.5; k = 30; break;
    case 'pet': T.lean = 0.6; T.hipsY = 0.8; T.kL = T.kR = 0.6; T.lL = T.lR = -0.5; T.aR = -1.1 + Math.sin(t * 6) * 0.15; T.eR = -0.3; break;
    // ---- fighting (Hero Mode): short, snappy poses held for a moment; the blend from the last pose is the move
    case 'guard': T.aL = T.aR = -0.75; T.eL = T.eR = -1.65; T.aLz = -0.1; T.aRz = 0.1; T.lean = 0.12; T.kL = T.kR = 0.25; T.lL = -0.2; T.lR = 0.1; T.hipsY = 0.88; k = 18; break;
    case 'punchR': T.aR = -1.55; T.eR = -0.05; T.aRz = -0.05; T.aL = -0.7; T.eL = -1.7; T.twist = -0.5; T.lean = 0.15; T.lL = -0.45; T.kL = 0.35; T.lR = 0.25; T.hipsY = 0.88; k = 32; break;
    case 'punchL': T.aL = -1.55; T.eL = -0.05; T.aLz = 0.05; T.aR = -0.7; T.eR = -1.7; T.twist = 0.5; T.lean = 0.15; T.lR = -0.45; T.kR = 0.35; T.lL = 0.25; T.hipsY = 0.88; k = 32; break;
    case 'heavy': T.aR = -1.6; T.eR = 0; T.aL = -0.3; T.eL = -1.4; T.twist = -0.8; T.lean = 0.38; T.lL = -0.7; T.kL = 0.6; T.lR = 0.5; T.kR = 0.2; T.hipsY = 0.82; k = 26; break;
    case 'kick': T.lR = -1.55; T.kR = 0.08; T.lL = 0.1; T.kL = 0.2; T.lean = -0.3; T.aLz = 0.6; T.aRz = -0.6; T.eL = T.eR = -0.5; T.twist = 0.2; k = 30; break;
    case 'slash': T.aR = -1.3; T.aRz = -1.1; T.eR = -0.15; T.aL = -0.4; T.eL = -1.2; T.twist = 0.65; T.lean = 0.2; T.lL = -0.5; T.kL = 0.5; T.lR = 0.3; T.hipsY = 0.86; k = 30; break;
    case 'slash2': T.aR = -1.1; T.aRz = 0.9; T.eR = -0.2; T.aL = -0.5; T.eL = -1.3; T.twist = -0.7; T.lean = 0.2; T.lR = -0.5; T.kR = 0.5; T.lL = 0.3; T.hipsY = 0.86; k = 30; break;
    case 'cast': T.aL = T.aR = -1.55; T.eL = T.eR = -0.08; T.aLz = 0.12; T.aRz = -0.12; T.lean = 0.12; T.lL = -0.35; T.kL = 0.3; T.lR = 0.2; k = 24; break;
    case 'castR': T.aR = -1.6; T.eR = -0.05; T.aL = -0.2; T.eL = -0.4; T.twist = -0.35; T.lean = 0.08; T.lL = -0.3; T.kL = 0.25; k = 26; break;
    case 'slam': T.aL = T.aR = -0.75; T.eL = T.eR = -0.2; T.lean = 0.65; T.hipsY = 0.66; T.lL = T.lR = -1.0; T.kL = T.kR = 1.5; T.headX = -0.3; k = 30; break;
    case 'raise': T.aL = T.aR = -2.9; T.eL = T.eR = -0.1; T.aLz = 0.3; T.aRz = -0.3; T.lean = -0.15; T.headX = -0.4; k = 14; break;
    case 'charge': T.aR = -0.9; T.eR = -0.3; T.aRz = 0.3; T.aL = -0.6; T.eL = -1.4; T.lean = 0.45; T.hipsY = 0.8; T.lL = -0.75; T.kL = 0.95; T.lR = 0.45; T.kR = 0.4; T.twist = -0.3; k = 18; break;
    case 'dash': T.lean = 0.95; T.aR = 0.75; T.eR = -0.2; T.aL = -0.9; T.eL = -0.9; T.lL = -1.0; T.kL = 1.1; T.lR = 0.7; T.kR = 0.5; T.hipsY = 0.82; k = 30; break;
    case 'breathe': T.headX = 0.25; T.lean = 0.3; T.aL = T.aR = -0.5; T.eL = T.eR = -1.3; T.aLz = 0.3; T.aRz = -0.3; T.lL = -0.4; T.kL = 0.4; k = 16; break;
    case 'fly': T.lean = 1.3; T.headX = -1.0; T.aL = T.aR = 0.35; T.aLz = 0.28; T.aRz = -0.28; T.eL = T.eR = -0.1; T.lL = T.lR = 0.12; T.kL = 0.15; T.kR = 0.25; k = 7; break;
    case 'hover': T.lean = 0.08 + Math.sin(t * 2) * 0.03; T.aLz = 0.45; T.aRz = -0.45; T.eL = T.eR = -0.55; T.lL = -0.25; T.kL = 0.45; T.lR = 0.08; T.kR = 0.2; k = 8; break;
    case 'swing': T.aR = -2.95; T.eR = -0.05; T.aRz = 0.1; T.aL = -0.5; T.eL = -0.6; T.lL = -0.75; T.kL = 1.1; T.lR = 0.25; T.kR = 0.7; T.lean = 0.15; T.headX = -0.25; k = 10; break;
    case 'webswing': {
      // Strand on a line: the hand on the anchor's side holds it overhead, the other reaches out; the legs
      // trail behind dropping in, tuck through the bottom, and kick forward rising out (r.swing.ph -1 .. 1)
      const sw = r.swing || { side: 1, ph: 0 }, u = clamp(sw.ph, -1, 1), w = Math.abs(u);
      if (sw.side >= 0) { T.aR = -2.95; T.eR = -0.05; T.aRz = 0.12; T.aL = -0.4; T.eL = -0.8; T.aLz = 0.55; }
      else { T.aL = -2.95; T.eL = -0.05; T.aLz = -0.12; T.aR = -0.4; T.eR = -0.8; T.aRz = -0.55; }
      const tuck = { lL: -1.1, lR: -0.95, kL: 1.7, kR: 1.55, lean: 0.35, headX: -0.2 };
      const end = u < 0 ? { lL: 0.25, lR: 0.5, kL: 0.5, kR: 0.95, lean: 0.25, headX: -0.35 } : { lL: -1.4, lR: -1.05, kL: 0.2, kR: 0.55, lean: -0.25, headX: -0.3 };
      T.lL = lerp(tuck.lL, end.lL, w); T.lR = lerp(tuck.lR, end.lR, w); T.kL = lerp(tuck.kL, end.kL, w); T.kR = lerp(tuck.kR, end.kR, w); T.lean = lerp(tuck.lean, end.lean, w); T.headX = lerp(tuck.headX, end.headX, w);
      k = 9; break;
    }
    case 'zip': T.aL = T.aR = -2.6; T.eL = T.eR = -0.1; T.lean = 0.5; T.lL = -0.4; T.lR = 0.3; T.kL = 0.8; T.kR = 0.5; k = 16; break;
    case 'spin': T.twist = t * 22; T.aLz = 1.4; T.aRz = -1.4; T.eL = T.eR = -0.1; T.lL = -0.3; T.kL = 0.6; k = 40; break;
    case 'hurt': T.lean = -0.4; T.headX = -0.35; T.aLz = 0.8; T.aRz = -0.8; T.eL = T.eR = -0.6; T.lL = 0.2; T.kR = 0.4; T.hipsY = 0.88; k = 30; break;
    case 'flex': T.aL = T.aR = -0.2; T.aLz = 1.3; T.aRz = -1.3; T.eL = T.eR = -1.9; T.lean = -0.08; T.lL = -0.25; T.lR = 0.25; T.hipsY = 0.9; k = 12; break;
    default: {
      // standing still: a small repertoire, changed every few seconds, different for everyone
      const slot = Math.floor(t / 6 + r.seed * 40), v = st.stiff ? (slot % 3 ? 0 : 1) : (Math.imul(slot + 7, 2654435761) >>> 8) % 8, u = t * 1.1 + r.seed * 20;
      T.aL = Math.sin(u) * 0.03; T.aR = -Math.sin(u) * 0.03; T.hipsY = 0.93 + Math.sin(t * 1.6) * 0.004; T.headX += Math.sin(t * 0.5) * 0.03;
      if (v === 1) T.headY += Math.sin(t * 0.7) * 0.5;                                                         // looks around
      else if (v === 2) { T.sway = 0.07; T.kR = 0.2; T.lR = -0.1; T.lL = 0.03; }                               // weight on the left leg
      else if (v === 3) { T.sway = -0.07; T.kL = 0.2; T.lL = -0.1; T.lR = 0.03; }                              // weight on the right leg
      else if (v === 4) { T.aL = -0.8; T.eL = -1.5; T.aLz = -0.22; T.headX += 0.3; T.headY += 0.22; }          // checks the wrist display
      else if (v === 5) { T.aL = T.aR = 0.32; T.aLz = 0.42; T.aRz = -0.42; T.eL = T.eR = -1.25; }              // hands at the hips
      else if (v === 6) { T.aL = T.aR = -0.42; T.aLz = -0.3; T.aRz = 0.3; T.eL = T.eR = -1.7; T.sway = 0.03; } // arms folded
      k = 4;
    }
  }
  // someone with a phone looks at it now and then, walking or standing
  if (r.prop === 'phone' && (anim === 'walk' || k === 4) && ((Math.floor(t / 8 + r.seed * 30) & 3) < 2)) { T.aR = -0.9; T.eR = -1.5; T.aRz = 0.14; T.headX = 0.28; T.headY *= 0.3; }
  else if (r.prop === 'cup' && k === 4 && ((Math.floor(t / 5 + r.seed * 30) & 3) === 0)) { T.aR = -0.8; T.eR = -1.9; T.headX = -0.1; }
  if (r.carry) { T.aL = T.aR = -0.95; T.eL = T.eR = -0.75; T.aLz = -0.12; T.aRz = 0.12; }
  // standing on uneven ground (a stair, a kerb, a slope): the hips drop to the lower foot and the other
  // leg bends to meet its own step (two-bone solve in the rig's own units: thigh 0.44, shin 0.47)
  const ft = r.feet;
  if (ft && (ft.drop > 0.005 || ft.l > 0.005 || ft.r > 0.005)) {
    const s = r.scale || 1, a = 0.44, b = 0.47;
    T.hipsY -= ft.drop / s;
    const solve = (h) => { const D = Math.max(0.35, a + b - h / s), k = Math.PI - Math.acos(clamp((a * a + b * b - D * D) / (2 * a * b), -1, 1)), th = Math.acos(clamp((a * a + D * D - b * b) / (2 * a * D), -1, 1)); return [th, k]; };
    if (ft.l > 0.005) { const [th, k] = solve(ft.l); T.lL = Math.min(T.lL, -th); T.kL = Math.max(T.kL, k); }
    if (ft.r > 0.005) { const [th, k] = solve(ft.r); T.lR = Math.min(T.lR, -th); T.kR = Math.max(T.kR, k); }
  }
  const p = r.pose, f = 1 - Math.exp(-k * dt);
  for (const key in T) p[key] = lerp(p[key], T[key], f);
  r.hips.position.y = p.hipsY; r.hips.rotation.y = p.twist; r.hips.rotation.z = p.sway;
  r.chest.rotation.x = p.lean; r.chest.rotation.y = -p.twist * 1.4; r.chest.rotation.z = -p.sway * 0.9 + r.bank;
  r.legL.rotation.x = p.lL; r.legR.rotation.x = p.lR; r.kneeL.rotation.x = p.kL; r.kneeR.rotation.x = p.kR;
  r.armL.rotation.x = p.aL; r.armR.rotation.x = p.aR; r.armL.rotation.z = p.aLz; r.armR.rotation.z = p.aRz;
  r.elbL.rotation.x = p.eL; r.elbR.rotation.x = p.eR; r.head.rotation.x = p.headX; r.head.rotation.y = p.headY; r.head.rotation.z = p.headZ;
  if (r.eyes) { // people blink, breathe, glance where they turn, and move their lips to speak
    r.blinkT -= dt; if (r.blinkT < -0.12) r.blinkT = 1.5 + Math.random() * 4.5;
    r.eyes.scale.y = r.blinkT < 0 ? 0.12 : r.eyeOpen;
    r.gaze.position.x = lerp(r.gaze.position.x, clamp(p.headY * 1.4, -1, 1) * 0.0065, f);
    r.chest.scale.z = 1 + Math.sin(t * (anim === 'run' ? 4.2 : 1.5) + r.seed * 9) * (anim === 'run' ? 0.035 : 0.022);
    const talk = anim === 'talk' ? 0.003 + 0.009 * Math.abs(Math.sin(t * 9.5 + Math.sin(t * 3.1) * 2)) : anim === 'eat' || anim === 'snack' ? 0.006 * Math.abs(Math.sin(t * 7)) : 0;
    r.lipLow.position.y = lerp(r.lipLow.position.y, -(r.open + talk), Math.min(1, dt * 30));
  }
}

const MOOD_COL = { neutral: null, happy: '#7dff9c', annoyed: '#ffb347', alarm: '#ff4d4d', surprised: '#ffffff' };
export function setMood(r, mood) {
  if (r.mood === mood) return;
  r.mood = mood;
  if (r.android && r.visorMat) r.visorMat.color.set(MOOD_COL[mood] || r.accentHex).multiplyScalar(1.6);
  if (r.mouth) {
    const m = r.mouth, bl = r.browL, br = r.browR;
    m.scale.set(1, 1, 1); r.open = 0; r.eyeOpen = 1; bl.rotation.z = br.rotation.z = 0; bl.position.y = br.position.y = 0.05;
    if (mood === 'happy') { m.scale.set(1.3, 1, 1); r.open = 0.005; bl.position.y = br.position.y = 0.054; }                                  // a smile that shows teeth
    else if (mood === 'annoyed') { m.scale.set(0.8, 0.9, 1); bl.rotation.z = 0.4; br.rotation.z = -0.4; bl.position.y = br.position.y = 0.044; r.eyeOpen = 0.72; }
    else if (mood === 'surprised' || mood === 'alarm') { m.scale.set(0.62, 1, 1); r.open = 0.014; bl.position.y = br.position.y = 0.062; r.eyeOpen = 1.2; }
  }
}

// Machines keep their jointed parts, but the fixed meshes inside each joint are merged and
// only parts big enough to matter cast a shadow (things that fly cast none).
function slim(root, keep = [], noShadow = false) {
  const groups = []; root.traverse((o) => { if (o.isGroup) groups.push(o); });
  for (const g of groups) flatten(g, keep);
  root.traverse((m) => {
    if (!m.isMesh) return;
    if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
    if (noShadow || m.geometry.boundingSphere.radius * Math.max(m.scale.x, m.scale.y, m.scale.z) < 0.16) m.castShadow = false;
  });
}

// ---- dogs ---------------------------------------------------------------------------------
export function makeDog(o = {}) {
  const robot = !!o.robot, sc = o.scale || 1;
  const root = new THREE.Group(), g = new THREE.Group(); g.scale.setScalar(sc); root.add(g);
  const bodyM = robot ? std(o.color || '#e6ebf2', 0.3, 0.8) : std(o.color || '#b9824f', 0.95, 0);
  const dark = robot ? std('#1c2028', 0.45, 0.8) : std('#3a281c', 0.95, 0);
  const acc = neon(o.accent || '#59e0ff', 1.4);
  const body = new THREE.Group(); body.position.y = 0.46; g.add(body);
  box(bodyM, body, 0.24, 0.22, 0.62, 0, 0, 0);
  if (robot) { box(acc, body, 0.245, 0.03, 0.4, 0, 0.06, 0).castShadow = false; box(dark, body, 0.2, 0.05, 0.3, 0, 0.13, -0.05); }
  const head = new THREE.Group(); head.position.set(0, 0.12, 0.36); body.add(head);
  box(bodyM, head, 0.19, 0.18, 0.2, 0, 0.03, 0.04); box(robot ? dark : bodyM, head, 0.11, 0.09, 0.15, 0, -0.01, 0.2);
  if (robot) box(acc, head, 0.16, 0.035, 0.02, 0, 0.06, 0.145).castShadow = false;
  else { for (const sx of [-1, 1]) { part(sphere(0.018), std('#111', 0.3, 0), head, sx * 0.05, 0.06, 0.142); box(dark, head, 0.05, 0.1, 0.03, sx * 0.08, 0.13, 0.0); } box(std('#111', 0.3, 0), head, 0.04, 0.03, 0.03, 0, 0.02, 0.28); }
  if (robot) for (const sx of [-1, 1]) box(dark, head, 0.02, 0.09, 0.05, sx * 0.07, 0.15, 0);
  const tail = new THREE.Group(); tail.position.set(0, 0.08, -0.31); body.add(tail);
  box(robot ? dark : bodyM, tail, 0.03, 0.03, 0.26, 0, 0.06, -0.1).rotation.x = 0.6;
  if (robot) part(sphere(0.022), acc, tail, 0, 0.14, -0.2);
  const legs = [];
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const hip = new THREE.Group(); hip.position.set(sx * 0.1, -0.05, sz * 0.24); body.add(hip);
    box(robot ? dark : bodyM, hip, 0.06, 0.22, 0.07, 0, -0.11, 0);
    const kn = new THREE.Group(); kn.position.y = -0.22; hip.add(kn);
    box(bodyM, kn, 0.05, 0.2, 0.055, 0, -0.1, 0); box(dark, kn, 0.06, 0.04, 0.08, 0, -0.2, 0.01);
    legs.push({ hip, kn, front: sz > 0, diag: sx * sz > 0 });
  }
  slim(root);
  return { root, body, head, tail, legs, robot, phase: 0, t: Math.random() * 9, sit: 0 };
}
export function animateDog(r, dt, anim, speed = 0) {
  r.t += dt;
  const sitT = anim === 'sit' ? 1 : 0; r.sit = lerp(r.sit, sitT, 1 - Math.exp(-8 * dt));
  let amp = 0, kn = 0.5;
  if (anim === 'walk' || anim === 'run') { r.phase += dt * (speed / (anim === 'run' ? 1.5 : 0.75)) * TAU; amp = anim === 'run' ? 0.85 : 0.5; kn = anim === 'run' ? 1.1 : 0.7; }
  const s = Math.sin(r.phase), c = Math.cos(r.phase);
  for (const l of r.legs) {
    const sg = l.diag ? 1 : -1, sw = -s * sg * amp, bend = Math.max(0, c * sg) * kn + 0.15;
    if (l.front) { l.hip.rotation.x = lerp(sw, -0.35, r.sit); l.kn.rotation.x = lerp(bend, 0.3, r.sit); }
    else { l.hip.rotation.x = lerp(sw, -1.5, r.sit); l.kn.rotation.x = lerp(bend, 2.3, r.sit); }
  }
  r.body.rotation.x = -0.42 * r.sit; r.body.position.y = 0.46 - 0.13 * r.sit + (amp ? Math.abs(c) * 0.02 : 0);
  r.tail.rotation.y = Math.sin(r.t * (anim === 'sit' ? 9 : 6)) * 0.5; r.head.rotation.x = 0.42 * r.sit + Math.sin(r.t * 0.9) * 0.05;
}

// ---- service machines ------------------------------------------------------------------------
export function makeRover(accent = '#ffb347') {
  const root = new THREE.Group(), dark = M_dark();
  box(std('#eef1f5', 0.4, 0.5), root, 0.62, 0.46, 0.95, 0, 0.45, 0); box(dark, root, 0.64, 0.05, 0.97, 0, 0.7, 0);
  box(neon(accent, 1.4), root, 0.5, 0.05, 0.02, 0, 0.5, 0.48).castShadow = false; box(neon('#ff4d4d', 1.2), root, 0.5, 0.04, 0.02, 0, 0.5, -0.48).castShadow = false;
  const wheels = [];
  for (const sx of [-1, 1]) for (const sz of [-0.33, 0, 0.33]) { const wm = part(cylinder(0.13, 0.08, 12), dark, root, sx * 0.34, 0.13, sz); wm.rotation.z = Math.PI / 2; wheels.push(wm); }
  box(dark, root, 0.015, 0.7, 0.015, 0.25, 1.05, -0.4); part(sphere(0.035), neon(accent, 1.8), root, 0.25, 1.42, -0.4);
  slim(root, wheels);
  return { root, wheels };
}
export function makeCleaner() {
  const root = new THREE.Group();
  part(cylinder(0.45, 0.2, 20), std('#dfe5ee', 0.3, 0.6), root, 0, 0.16, 0); part(cylinder(0.46, 0.03, 20), neon('#59e0ff', 1.2), root, 0, 0.2, 0).castShadow = false;
  part(sphere(0.12), M_dark(), root, 0, 0.3, 0.1);
  slim(root);
  return { root };
}
export function makeDrone(kind = 'police') {
  const root = new THREE.Group(), dark = M_dark(), police = kind === 'police';
  part(sphere(0.32), police ? std('#182236', 0.3, 0.8) : std('#eef1f5', 0.35, 0.5), root, 0, 0, 0, 1, 0.7, 1);
  const rotors = [];
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    box(dark, root, 0.04, 0.03, 0.5, sx * 0.25, 0.05, sz * 0.25).rotation.y = (sx * sz * Math.PI) / 4;
    const r = part(geo('rotor', () => new THREE.TorusGeometry(0.16, 0.018, 6, 16)), dark, root, sx * 0.42, 0.07, sz * 0.42); r.rotation.x = Math.PI / 2; rotors.push(r);
  }
  let red = null, blue = null, cone = null, parcel = null;
  if (police) {
    red = new THREE.MeshBasicMaterial({ color: 0xff2020 }); blue = new THREE.MeshBasicMaterial({ color: 0x2060ff });
    box(red, root, 0.16, 0.05, 0.06, -0.1, 0.24, 0); box(blue, root, 0.16, 0.05, 0.06, 0.1, 0.24, 0);
    const cg = new THREE.ConeGeometry(1.4, 5, 16, 1, true); cg.translate(0, -2.5, 0);
    cone = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: 0x59e0ff, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    cone.visible = false; root.add(cone);
  } else {
    parcel = box(std('#b98a5a', 0.9, 0), root, 0.3, 0.24, 0.3, 0, -0.3, 0);
    part(sphere(0.03), neon('#7dff9c', 1.8), root, 0, 0.24, 0);
  }
  slim(root, [...rotors, parcel, cone], true);
  return { root, rotors, red, blue, cone, parcel };
}
export function makeServer() { // restaurant serving drone
  const root = new THREE.Group();
  part(cylinder(0.26, 0.05, 20), std('#f3f5f8', 0.3, 0.5), root, 0, 0, 0); part(cylinder(0.27, 0.012, 20), neon('#ffb3d1', 1.3), root, 0, -0.03, 0).castShadow = false;
  part(sphere(0.07), M_dark(), root, 0, -0.08, 0);
  slim(root, [], true);
  return { root };
}
// Personal weather canopy: a faint field that keeps the rain off (shown only while it rains).
let canopyMat = null;
export function addCanopy(rig) {
  if (!canopyMat) canopyMat = new THREE.MeshBasicMaterial({ color: 0x8fe9ff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const m = new THREE.Mesh(geo('canopy', () => new THREE.SphereGeometry(0.62, 14, 6, 0, TAU, 0, Math.PI * 0.32)), canopyMat);
  m.position.y = 1.52; m.visible = false; rig.body.add(m); rig.canopy = m; return m;
}
export function makeParcel() { const m = new THREE.Mesh(BOX, std('#b98a5a', 0.9, 0)); m.scale.set(0.34, 0.26, 0.3); m.castShadow = true; return m; }
