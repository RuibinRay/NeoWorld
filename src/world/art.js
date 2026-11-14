// Artwork made with Canva's AI image generator (the pictures in src/assets/art/), and the one
// texture that carries the advert pictures for the whole city: six cells, each a picture with the
// brand's name set over it in sharp type. An advert with no picture yet gets a simple drawn design;
// a picture saved into src/assets/art/ under its file name replaces it the next time the game starts.
// The holo adverts on the towers (neon.js) and the street posters (metro furniture) share this sheet.
import * as THREE from 'three';
import { makeCanvas, canvasTex } from './materials.js';

const files = import.meta.glob('../assets/art/*.jpg', { eager: true, query: '?url', import: 'default' });
export const artUrl = (name) => files[`../assets/art/${name}`] || null;

export const ADS = [
  { file: 'ad-aerowisp.jpg', name: 'AEROWISP', tag: 'every class of flying car', color: '#59e0ff' },
  { file: 'ad-neon-spritz.jpg', name: 'NEON SPRITZ', tag: 'the drink of the rooftop bars', color: '#3fb8ff' },
  { file: 'ad-orbital.jpg', name: 'ORBITAL LIFT', tag: 'tickets to the ring', color: '#ffb347' },
  { file: 'ad-skyball.jpg', name: 'SKYBALL', tag: 'live at Skyhaven Stadium', color: '#a78bff', draw: 'ball' },
  { file: 'ad-solara.jpg', name: 'SOLARA BAY', tag: 'the beach is back', color: '#ff8a5c', draw: 'sun' },
  { file: 'ad-tin-lantern.jpg', name: 'TIN LANTERN', tag: 'robot bar · no closing time', color: '#ffd34d', draw: 'lantern' },
];
export const COLS = 3, ROWS = 2, CW = 512, CH = 768, CELL_ASPECT = CW / CH;
const W = COLS * CW, H = ROWS * CH;

// uv rectangle [u0, v0, u1, v1] of advert k, a few pixels inside its cell so mipmaps do not bleed
export function adUV(k) {
  const c = k % COLS, r = Math.floor(k / COLS) % ROWS, e = 4 / W, f = 4 / H;
  return [c / COLS + e, 1 - (r + 1) / ROWS + f, (c + 1) / COLS - e, 1 - r / ROWS - f];
}

let sheet = null;
export function adSheet() {
  if (sheet) return sheet;
  const c = makeCanvas(W, H), g = c.getContext('2d'), tex = canvasTex(c, false);
  ADS.forEach((a, k) => { drawn(g, a, k); label(g, a, k); });
  let pictures = 0;
  ADS.forEach((a, k) => {
    const url = artUrl(a.file); if (!url) return;
    const im = new Image();
    im.onload = () => { cover(g, im, k); label(g, a, k); tex.needsUpdate = true; sheet.loaded++; };
    im.src = url; pictures++;
  });
  sheet = { canvas: c, tex, pictures, loaded: 0 };
  return sheet;
}

let posterMat = null;
// street posters: lit from behind, so they read at night, a little below full white by day
export function posterMaterial() { return posterMat || (posterMat = new THREE.MeshBasicMaterial({ map: adSheet().tex, color: '#d8d8d8' })); }

const cell = (k) => [(k % COLS) * CW, Math.floor(k / COLS) * CH];
function clipCell(g, k) { const [x, y] = cell(k); g.save(); g.beginPath(); g.rect(x + 6, y + 6, CW - 12, CH - 12); g.clip(); return [x, y]; }

// the picture, scaled to cover the cell
function cover(g, im, k) {
  const [x, y] = clipCell(g, k), s = Math.max(CW / im.width, CH / im.height), w = im.width * s, h = im.height * s;
  g.fillStyle = '#000'; g.fillRect(x, y, CW, CH); g.drawImage(im, x + (CW - w) / 2, y + (CH - h) / 2, w, h); g.restore();
}

// the brand's name and line over a dark strip at the bottom
function label(g, a, k) {
  const [x, y] = clipCell(g, k), gr = g.createLinearGradient(0, y + CH * 0.6, 0, y + CH);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.45, 'rgba(0,0,0,0.7)'); gr.addColorStop(1, 'rgba(0,0,0,0.9)');
  g.fillStyle = gr; g.fillRect(x, y + CH * 0.6, CW, CH * 0.4);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = a.color; g.shadowBlur = 18; g.fillStyle = '#ffffff'; g.font = '800 62px system-ui, -apple-system, sans-serif';
  g.fillText(a.name, x + CW / 2, y + CH * 0.79, CW - 48);
  g.shadowBlur = 8; g.fillStyle = a.color; g.font = '600 27px system-ui, -apple-system, sans-serif';
  g.fillText(a.tag.toUpperCase(), x + CW / 2, y + CH * 0.865, CW - 56);
  g.fillRect(x + CW / 2 - 60, y + CH * 0.735, 120, 3);
  g.restore();
}

// a simple drawn design for an advert that has no picture yet
function drawn(g, a, k) {
  const [x, y] = clipCell(g, k), cx = x + CW / 2;
  const bg = g.createLinearGradient(0, y, 0, y + CH);
  if (a.draw === 'sun') {
    bg.addColorStop(0, '#1a0b3d'); bg.addColorStop(0.45, '#ff5e7e'); bg.addColorStop(0.62, '#ffb35c'); g.fillStyle = bg; g.fillRect(x, y, CW, CH);
    g.fillStyle = '#ffe39a'; g.beginPath(); g.arc(cx, y + CH * 0.5, 130, Math.PI, 0); g.fill();
    g.fillStyle = '#0e6f8f'; g.fillRect(x, y + CH * 0.5, CW, CH * 0.5);
    g.strokeStyle = 'rgba(255,227,154,0.7)'; for (let i = 0; i < 8; i++) { g.lineWidth = 6 - i * 0.6; const w = 220 - i * 22; g.beginPath(); g.moveTo(cx - w / 2, y + CH * 0.53 + i * 18); g.lineTo(cx + w / 2, y + CH * 0.53 + i * 18); g.stroke(); }
    g.fillStyle = '#1a0b3d'; g.fillRect(x + 92, y + CH * 0.2, 12, CH * 0.33);                        // a palm
    for (let i = 0; i < 6; i++) { g.save(); g.translate(x + 98, y + CH * 0.2); g.rotate(-2.6 + i * 0.75); g.beginPath(); g.ellipse(46, 0, 52, 11, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
  } else if (a.draw === 'lantern') {
    bg.addColorStop(0, '#120a06'); bg.addColorStop(1, '#3a210c'); g.fillStyle = bg; g.fillRect(x, y, CW, CH);
    const glow = g.createRadialGradient(cx, y + CH * 0.36, 10, cx, y + CH * 0.36, 260); glow.addColorStop(0, 'rgba(255,211,77,0.55)'); glow.addColorStop(1, 'rgba(255,211,77,0)'); g.fillStyle = glow; g.fillRect(x, y, CW, CH);
    g.fillStyle = '#c8ccd4'; g.beginPath(); g.roundRect(cx - 110, y + CH * 0.22, 220, 190, 34); g.fill();     // a robot's head
    g.fillStyle = '#1b1f27'; g.beginPath(); g.roundRect(cx - 86, y + CH * 0.26, 172, 110, 22); g.fill();
    g.shadowColor = '#ffd34d'; g.shadowBlur = 24; g.fillStyle = '#ffd34d'; for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * 40, y + CH * 0.33, 18, 0, Math.PI * 2); g.fill(); }
    g.fillRect(cx - 34, y + CH * 0.385, 68, 7); g.shadowBlur = 0;
    g.fillStyle = '#8a8f99'; g.fillRect(cx - 4, y + CH * 0.16, 8, 46); g.beginPath(); g.arc(cx, y + CH * 0.155, 14, 0, Math.PI * 2); g.fill();
  } else {
    bg.addColorStop(0, '#0b0620'); bg.addColorStop(1, '#2a1260'); g.fillStyle = bg; g.fillRect(x, y, CW, CH);
    g.strokeStyle = 'rgba(167,139,255,0.45)'; g.lineWidth = 4; for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(cx, y + CH * 0.62, 90 + i * 40, 22 + i * 10, 0, 0, Math.PI * 2); g.stroke(); }   // a stadium bowl
    g.shadowColor = a.color; g.shadowBlur = 40; g.fillStyle = a.color; g.beginPath(); g.arc(cx + 30, y + CH * 0.3, 96, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 5; g.beginPath(); g.arc(cx + 30, y + CH * 0.3, 96, 0, Math.PI * 2); g.moveTo(cx - 66, y + CH * 0.3); g.bezierCurveTo(cx, y + CH * 0.22, cx + 60, y + CH * 0.38, cx + 126, y + CH * 0.3); g.stroke();
    g.strokeStyle = a.color; g.lineWidth = 3; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(cx - 120 - i * 30, y + CH * 0.18 + i * 26); g.lineTo(cx - 60 - i * 30, y + CH * 0.22 + i * 26); g.stroke(); }
  }
  g.restore();
}
