// Player preferences. Kept in browser storage apart from the save game, so they survive a new game.
const KEY = 'neoearth2226.settings';

// msaa: anti-aliasing samples · pr: render scale range (the game adapts inside it to hold frame rate)
// shadows: sun shadows on/off · bloom: glow pass · close: how far out residents get their detailed rig
// detail: how far out (m) street-level detail is built in the street grid
export const QUALITY = {
  auto: { label: 'Auto', msaa: 2, prMax: 1.5, prMin: 0.8, shadows: true, bloom: true, close: 1, detail: 400 },
  high: { label: 'High', msaa: 4, prMax: 2, prMin: 1.2, shadows: true, bloom: true, close: 1.2, detail: 460 },
  medium: { label: 'Medium', msaa: 2, prMax: 1.2, prMin: 0.8, shadows: true, bloom: true, close: 1, detail: 330 },
  low: { label: 'Low', msaa: 0, prMax: 1, prMin: 0.65, shadows: false, bloom: false, close: 0.7, detail: 250 },
};
const DEFAULTS = { quality: 'auto', volume: 0.7, music: true, battleMusic: true, radio: 0, voices: true, mouseLock: true, sens: 1, invertY: false, fps: false, hints: true, fov: 60, cam: 'normal' };

export const Settings = {
  data: { ...DEFAULTS },
  listeners: [],
  load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d && typeof d === 'object') for (const k in DEFAULTS) if (typeof d[k] === typeof DEFAULTS[k]) this.data[k] = d[k];
    } catch { /* first run, or storage unavailable */ }
    if (!QUALITY[this.data.quality]) this.data.quality = 'auto';
    return this.data;
  },
  set(k, v) {
    this.data[k] = v;
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* not persisted */ }
    for (const f of this.listeners) f(k, v);
  },
  onChange(f) { this.listeners.push(f); },
};
