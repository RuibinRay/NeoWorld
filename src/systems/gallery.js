// Your photographs. Every picture taken in photo mode (O, then Enter or a click) is kept: the
// newest twelve, as JPEG images in this browser's storage (apart from the save game). The phone's
// Photos app shows them; any one can be saved to your computer or deleted.
import { G } from '../core/game.js';

const KEY = 'neoearth2226.photos', MAX = 12, W = 960;
export const PHOTO_KEY = KEY, PHOTO_MAX = MAX;

export class Gallery {
  constructor() { this.list = this.load(); }
  load() { try { const l = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(l) ? l.filter((p) => p && typeof p.src === 'string') : []; } catch { return []; } }
  store() {
    // if storage is full, drop the oldest until it fits
    while (this.list.length) { try { localStorage.setItem(KEY, JSON.stringify(this.list)); return true; } catch { this.list.pop(); } }
    try { localStorage.removeItem(KEY); } catch { /* nothing to do */ }
    return false;
  }
  // render the frame as it is now and keep it
  capture(label) {
    const canvas = G.renderer.domElement; G.composer.render();
    const c = document.createElement('canvas'); c.width = W; c.height = Math.round((W * canvas.height) / canvas.width);
    c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
    const env = G.env, hh = Math.floor(env.mins / 60), mm = Math.floor(env.mins % 60);
    const pp = G.player.pos, where = (Math.abs(pp.x) < 200 && Math.abs(pp.z) < 200 ? 'Meridian' : null) || (G.districts.at(pp) || {}).name || (G.metro && G.metro.areaAt(pp.x, pp.z)) || 'Neo Central';
    const photo = { src: c.toDataURL('image/jpeg', 0.82), at: Date.now(), label: label || where, when: `Day ${env.day}, ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` };
    this.list.unshift(photo); if (this.list.length > MAX) this.list.length = MAX;
    if (!this.store()) G.ui.toast('Your photos could not be kept: this browser\'s storage is full.', 'warn');
    return photo;
  }
  // the phone screen
  html() {
    if (!this.list.length) return '<h3>Photos</h3><p>No photos yet. Press O for photo mode, then Enter or click to take a picture.</p>';
    return `<h3>Photos</h3><p>${this.list.length} of ${MAX} kept, newest first.</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">${this.list.map((p, i) => `<button class="ph-row" data-i="${i}" data-photo="${i}" style="padding:3px"><img src="${p.src}" style="width:100%;display:block;border-radius:4px" alt=""><small>${p.label}</small></button>`).join('')}</div>`;
  }
  view(i) {
    const p = this.list[i]; if (!p) return;
    G.ui.openMenu({ title: p.label, who: p.when, wide: true, html: `<img src="${p.src}" style="width:100%;border-radius:6px;display:block" alt="">`,
      options: [
        { label: 'Save to your computer', desc: 'Downloads it as a JPEG image', onPick: () => { const a = document.createElement('a'); a.href = p.src; a.download = `neo-earth-${new Date(p.at).toISOString().slice(0, 19).replace(/[:T]/g, '-')}.jpg`; document.body.appendChild(a); a.click(); a.remove(); this.view(i); } },
        { label: 'Delete this photo', onPick: () => { this.list.splice(i, 1); this.store(); G.ui.toast('Photo deleted.', 'info'); } },
        { label: 'Close', onPick: () => {} },
      ] });
  }
}
