// Procedural materials and textures. Nothing is loaded from disk: facades, paving, signs
// and holograms are all drawn to canvases at boot.
import * as THREE from 'three';
import { RNG } from '../core/util.js';

const nightMats = [];
export function registerNight(mat, day, night, prop = 'emissiveIntensity') { nightMats.push({ mat, day, night, prop }); return mat; }
let dim = 0;   // 0..1: a blackout (the story's finale) takes the night glow out of windows and plants
export function setBlackout(k) { dim = k; }
export function applyNight(n) {
  const m = n * (1 - dim);
  for (const e of nightMats) e.mat[e.prop] = e.day + (e.night - e.day) * m;
}

export function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function canvasTex(c, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// Window-grid facade. One texture tile covers cols x rows windows; towerGeometry() scales UVs
// so a window is always the same real-world size whatever the building's dimensions.
export function makeFacade(o) {
  const {
    cols = 8, rows = 16, base = '#141a26', frame = '#0a0d14', glass = '#1b2636',
    lit = ['#ffdca8', '#bfe4ff', '#fff1d6'], litChance = 0.3, band = false, seed = 1,
    rough = 0.35, metal = 0.6, winW = 3.2, floorH = 3.6, dayGlow = 0.1, nightGlow = 1.2,
    padX = 0.1, padY = 0.19, balcony = false, planks = false, res = 1,
  } = o;
  // Three canvases: color, the lights that come on at night, and a surface map that makes the
  // glass smooth and mirror-like while frames and spandrels stay matt (green: roughness, blue: metalness).
  const W = 512 * res, H = 1024 * res, c = makeCanvas(W, H), e = makeCanvas(W, H), m = makeCanvas(W, H);
  const g = c.getContext('2d'), ge = e.getContext('2d'), gm = m.getContext('2d'), r = new RNG(seed);
  const rg = Math.round(rough * 255), mb = Math.round(metal * 255), solidGlass = rough < 0.3;
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H);
  gm.fillStyle = `rgb(0,${Math.min(255, rg + 110)},${Math.round(mb * 0.35)})`; gm.fillRect(0, 0, W, H);
  const cw = W / cols, ch = H / rows;
  for (let j = 0; j < rows; j++) {
    // spandrel between floors: a slightly lighter band with a shadow line under it
    g.fillStyle = 'rgba(255,255,255,0.045)'; g.fillRect(0, j * ch, W, ch * 0.16);
    for (let i = 0; i < cols; i++) {
      const x = i * cw, y = j * ch, px = cw * padX, py = ch * padY, ww = cw - 2 * px, wh = ch - 2 * py;
      const on = band ? (j % 4 === 1 ? r.chance(0.85) : r.chance(litChance * 0.4)) : r.chance(litChance);
      g.fillStyle = glass; g.fillRect(x + px, y + py, ww, wh);
      gm.fillStyle = `rgb(0,${solidGlass ? 14 : 40},${solidGlass ? 235 : 150})`; gm.fillRect(x + px, y + py, ww, wh);
      // the sky in the glass: brighter toward the top of each pane
      const sky = g.createLinearGradient(0, y + py, 0, y + py + wh); sky.addColorStop(0, 'rgba(150,190,240,0.2)'); sky.addColorStop(0.7, 'rgba(120,160,220,0.03)'); sky.addColorStop(1, 'rgba(0,0,0,0.12)');
      g.fillStyle = sky; g.fillRect(x + px, y + py, ww, wh);
      if (on) {
        const col = r.pick(lit), a = 0.5 + r.next() * 0.5;
        ge.globalAlpha = a; ge.fillStyle = col; ge.fillRect(x + px, y + py, ww, wh);
        if (r.chance(0.5)) { ge.globalAlpha = a * 0.45; ge.fillStyle = '#000'; ge.fillRect(x + px + ww * r.range(0.1, 0.6), y + py + wh * 0.45, ww * 0.25, wh * 0.55); }   // furniture, someone at the window
        ge.globalAlpha = 1;
        g.globalAlpha = 0.3; g.fillStyle = col; g.fillRect(x + px, y + py, ww, wh); g.globalAlpha = 1;
      }
      if (r.chance(0.3)) { const bh = wh * r.range(0.2, 0.75); g.fillStyle = 'rgba(210,215,225,0.16)'; g.fillRect(x + px, y + py, ww, bh); ge.fillStyle = 'rgba(0,0,0,0.35)'; ge.fillRect(x + px, y + py, ww, bh); }   // blinds
      g.fillStyle = frame; g.fillRect(x + px + ww / 2 - 1, y + py, 2, wh);                                    // mullion
      g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(x + px, y + py + wh, ww, 2);                           // sill catching the light
      gm.fillStyle = `rgb(0,${Math.min(255, rg + 110)},${Math.round(mb * 0.35)})`; gm.fillRect(x + px + ww / 2 - 1, y + py, 2, wh);
    }
  }
  if (planks) { g.fillStyle = 'rgba(0,0,0,0.13)'; for (let y = 0; y < H; y += ch / 5) g.fillRect(0, y, W, 1.5); }
  if (balcony) for (let j = 0; j < rows; j++) {            // a railing across each floor, with its shadow underneath
    g.fillStyle = 'rgba(225,230,238,0.42)'; g.fillRect(0, j * ch + ch * 0.66, W, ch * 0.2); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, j * ch + ch * 0.86, W, ch * 0.08);
    ge.fillStyle = 'rgba(0,0,0,0.6)'; ge.fillRect(0, j * ch + ch * 0.66, W, ch * 0.28); gm.fillStyle = `rgb(0,200,30)`; gm.fillRect(0, j * ch + ch * 0.66, W, ch * 0.2);
  }
  g.fillStyle = frame;
  for (let j = 0; j < rows; j++) g.fillRect(0, j * ch, W, Math.max(2, ch * 0.06));
  for (let i = 0; i < cols; i += band ? 5 : 4) g.fillRect(i * cw - 1.5, 0, 3, H);                             // piers every few bays
  // weathering: faint vertical streaks
  for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(0,0,0,${0.03 + r.next() * 0.05})`; g.fillRect(r.next() * W, r.next() * H, 1 + r.next() * 3, 40 + r.next() * 200); }
  const sm = canvasTex(m); sm.colorSpace = THREE.NoColorSpace;
  const mat = new THREE.MeshStandardMaterial({
    map: canvasTex(c), emissiveMap: canvasTex(e), emissive: 0xffffff, emissiveIntensity: 1, roughness: 1, metalness: 1, roughnessMap: sm, metalnessMap: sm,
  });
  registerNight(mat, dayGlow, nightGlow);
  mat.userData.tile = { w: cols * winW, h: rows * floorH };
  return mat;
}

export function towerGeometry(w, h, d, tile) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, (uv.getX(i) * dims[f][0]) / tile.w, (uv.getY(i) * dims[f][1]) / tile.h);
    }
  }
  return g;
}

// Text sign / hologram texture.
export function labelTexture(text, o = {}) {
  const { w = 512, h = 128, size = 64, color = '#bff', bg = null, sub = null, subColor = null, font = 'system-ui, sans-serif', weight = 700, border = null } = o;
  const c = makeCanvas(w, h), g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  if (border) { g.strokeStyle = border; g.lineWidth = 6; g.strokeRect(5, 5, w - 10, h - 10); }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = color; g.font = `${weight} ${size}px ${font}`;
  g.shadowColor = color; g.shadowBlur = size * 0.25;
  g.fillText(text, w / 2, sub ? h * 0.4 : h / 2, w - 20);
  if (sub) {
    g.shadowBlur = 0; g.font = `500 ${Math.round(size * 0.36)}px ${font}`; g.fillStyle = subColor || color; g.globalAlpha = 0.85;
    g.fillText(sub, w / 2, h * 0.78, w - 20);
  }
  return canvasTex(c, false);
}

function pavingTexture() {
  const c = makeCanvas(256, 256), g = c.getContext('2d'), r = new RNG(77);
  g.fillStyle = '#3a4150'; g.fillRect(0, 0, 256, 256);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const v = 58 + Math.floor(r.next() * 14);
    g.fillStyle = `rgb(${v},${v + 6},${v + 18})`; g.fillRect(i * 64 + 2, j * 64 + 2, 60, 60);
  }
  g.fillStyle = 'rgba(120,230,255,0.25)'; g.fillRect(0, 126, 256, 4);
  return canvasTex(c);
}
function asphaltTexture() {
  const c = makeCanvas(256, 256), g = c.getContext('2d'), r = new RNG(5);
  g.fillStyle = '#15181e'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) { const v = 20 + Math.floor(r.next() * 26); g.fillStyle = `rgb(${v},${v},${v + 4})`; g.fillRect(r.next() * 256, r.next() * 256, 2, 2); }
  return canvasTex(c);
}
function glowTexture() {
  const c = makeCanvas(128, 128), g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return canvasTex(c, false);
}

const neonCache = new Map();
export function neon(hex, k = 1.6) {
  const key = hex + ':' + k;
  let m = neonCache.get(key);
  if (!m) { m = new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k) }); m.userData.plain = true; neonCache.set(key, m); }
  return m;
}
const stdCache = new Map();
export function std(hex, rough = 0.7, metal = 0.1, extra) {
  const key = `${hex}:${rough}:${metal}:${extra ? JSON.stringify(extra) : ''}`;
  let m = stdCache.get(key);
  if (!m) { m = new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal, ...extra }); if (!extra) m.userData.plain = true; stdCache.set(key, m); }
  return m;
}

export const M = {};
export function initMaterials() {
  const pav = pavingTexture(); pav.repeat.set(25, 25);
  const asp = asphaltTexture(); asp.repeat.set(60, 60);
  M.sidewalk = new THREE.MeshStandardMaterial({ map: pav, roughness: 0.75, metalness: 0.1 });
  M.road = new THREE.MeshStandardMaterial({ map: asp, roughness: 0.85, metalness: 0.15 });
  M.outer = std('#07090d', 0.95, 0);
  M.roof = std('#161a22', 0.85, 0.2);
  M.metalDark = std('#1c2028', 0.45, 0.8);
  M.metal = std('#8a94a6', 0.35, 0.85);
  M.white = std('#dfe5ee', 0.5, 0.2);
  M.concrete = std('#5a6270', 0.9, 0.05);
  M.wood = std('#7a5536', 0.7, 0.05);
  M.brick = std('#6b3f33', 0.9, 0.02);
  M.glass = new THREE.MeshStandardMaterial({ color: '#9fd4ff', roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
  M.glassDark = new THREE.MeshStandardMaterial({ color: '#28405c', roughness: 0.08, metalness: 0.9, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide });
  M.glow = glowTexture();
  M.leaf = registerNight(new THREE.MeshStandardMaterial({ color: '#2f8f5a', emissive: '#2dffa0', emissiveIntensity: 0, roughness: 0.85, flatShading: true }), 0.0, 0.22);
  M.leafPink = registerNight(new THREE.MeshStandardMaterial({ color: '#b65a8d', emissive: '#ff6ad5', emissiveIntensity: 0, roughness: 0.85, flatShading: true }), 0.0, 0.3);
  M.trunk = std('#3b2f2a', 0.9, 0);
  M.facades = {
    glass: makeFacade({ seed: 11, base: '#101826', glass: '#1d2b40', litChance: 0.28, lit: ['#bfe4ff', '#e9f6ff', '#ffe2b0'], rough: 0.18, metal: 0.85 }),
    warm: makeFacade({ seed: 23, base: '#241e1c', glass: '#2a2622', litChance: 0.45, lit: ['#ffcf8a', '#ffe6bd', '#ffb46b'], rough: 0.6, metal: 0.25, cols: 6 }),
    corp: makeFacade({ seed: 37, base: '#0d1016', glass: '#141b28', litChance: 0.2, band: true, lit: ['#7fe9ff', '#c4f4ff'], rough: 0.25, metal: 0.8, cols: 10 }),
    magenta: makeFacade({ seed: 41, base: '#170f1d', glass: '#241630', litChance: 0.33, lit: ['#ff7ad9', '#ffb3ec', '#9fd8ff'], rough: 0.3, metal: 0.7 }),
    brick: makeFacade({ seed: 53, base: '#5b382e', frame: '#3d241d', glass: '#2b2420', litChance: 0.55, lit: ['#ffc779', '#ffdca0'], rough: 0.92, metal: 0.02, cols: 5, rows: 8, winW: 2.6, floorH: 3.4, dayGlow: 0.15 }),
    mega: makeFacade({ seed: 67, base: '#0b0f17', glass: '#111926', litChance: 0.16, lit: ['#bfe4ff', '#ffd9a0', '#8ff'], rough: 0.3, metal: 0.8, cols: 12, rows: 24, winW: 4, floorH: 4.2, nightGlow: 1.4 }),
    balcony: makeFacade({ seed: 83, base: '#3b414b', frame: '#23272e', glass: '#1c2430', litChance: 0.42, lit: ['#ffd9a0', '#ffe9c8', '#bfe4ff'], rough: 0.75, metal: 0.12, cols: 6, balcony: true }),
    stucco: makeFacade({ seed: 89, base: '#d6cfbf', frame: '#b3ab9a', glass: '#27313d', litChance: 0.36, lit: ['#ffd9a0', '#ffe2b8'], rough: 0.92, metal: 0, cols: 6, rows: 12, padX: 0.2, padY: 0.24, winW: 3.4, floorH: 3.4, dayGlow: 0.05, res: 0.5 }),
    siding: makeFacade({ seed: 97, base: '#8ea4ad', frame: '#e6eaee', glass: '#26303b', litChance: 0.5, lit: ['#ffd9a0', '#ffe2b8'], rough: 0.9, metal: 0, cols: 4, rows: 4, padX: 0.26, padY: 0.27, winW: 3, floorH: 3.2, planks: true, dayGlow: 0.05, res: 0.5 }),
    concrete: makeFacade({ seed: 101, base: '#5b616a', frame: '#42474f', glass: '#19212c', litChance: 0.3, lit: ['#ffd9a0', '#bfe4ff'], rough: 0.95, metal: 0.02, cols: 8, padX: 0.24, padY: 0.27, res: 0.5 }),
    loft: makeFacade({ seed: 103, base: '#6a4135', frame: '#2a1c18', glass: '#232a33', litChance: 0.5, lit: ['#ffc779', '#ffdca0', '#ffe9c8'], rough: 0.9, metal: 0.03, cols: 4, rows: 8, padX: 0.07, padY: 0.11, winW: 4.5, floorH: 4.6, dayGlow: 0.12 }),
    curtain: makeFacade({ seed: 107, base: '#0b131e', frame: '#070b12', glass: '#15314a', litChance: 0.24, lit: ['#bfe4ff', '#e9f6ff', '#9fd8ff'], rough: 0.1, metal: 0.92, cols: 10, padX: 0.025, padY: 0.035 }),
    far: makeFacade({ seed: 71, base: '#0a0d14', glass: '#0f1520', litChance: 0.22, lit: ['#bfe4ff', '#ffd9a0', '#ff9be0'], rough: 0.5, metal: 0.5, cols: 8, rows: 16, winW: 6, floorH: 6, nightGlow: 1.5 }),
  };
}
