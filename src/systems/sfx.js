// Sound effects for Hero Mode, made from oscillators and filtered noise: a sound for every hero move,
// hits that sound different for fists, blades, fire and lightning (and clank on robots), walls
// cracking and rubble falling. Sounds placed in the world get quieter with distance and come from
// the side they happen on.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { clamp } from '../core/util.js';

const _r = new THREE.Vector3();
const ROBOTS = new Set(['brute', 'gunner', 'drone', 'hdrone', 'vcore']);

export class Sfx {
  constructor() { this.hitT = 0; this.hitN = 0; }
  get ok() { return !!(G.audio && G.audio.ctx); }
  // an output for one sound at pos (null: right at the listener). Returns null when it is too far to hear.
  out(pos, v = 1) {
    const au = G.audio, c = au.ctx; let g = v, pan = 0;
    if (pos && G.camera) {
      const cam = G.camera.position, dx = pos.x - cam.x, dy = pos.y - cam.y, dz = pos.z - cam.z, d = Math.hypot(dx, dy, dz);
      g *= clamp(1.15 - d / 110, 0, 1) ** 1.6; if (g < 0.01) return null;
      _r.setFromMatrixColumn(G.camera.matrixWorld, 0); pan = clamp((dx * _r.x + dz * _r.z) / Math.max(d, 3), -1, 1) * 0.75;
    }
    const gn = c.createGain(); gn.gain.value = g;
    if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; gn.connect(p); p.connect(au.master); } else gn.connect(au.master);
    return gn;
  }
  // primitives (t: seconds from now)
  o(out, t, f, dur, vol, type = 'sine', slide = 1, attack = 0.003, cutoff = 0) {
    const c = G.audio.ctx, T = c.currentTime + t, os = c.createOscillator(), g = c.createGain();
    os.type = type; os.frequency.setValueAtTime(f, T); if (slide !== 1) os.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), T + attack + dur);
    g.gain.setValueAtTime(0.0001, T); g.gain.exponentialRampToValueAtTime(vol, T + attack); g.gain.exponentialRampToValueAtTime(0.0001, T + attack + dur);
    let head = os; if (cutoff) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = cutoff; os.connect(fl); head = fl; }
    head.connect(g); g.connect(out); os.start(T); os.stop(T + attack + dur + 0.05);
  }
  n(out, t, dur, vol, freq, type = 'lowpass', q = 1, sweep = 1, attack = 0.002) {
    const au = G.audio, c = au.ctx, T = c.currentTime + t, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = au.noise; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, T); if (sweep !== 1) f.frequency.exponentialRampToValueAtTime(freq * sweep, T + attack + dur);
    g.gain.setValueAtTime(0.0001, T); g.gain.exponentialRampToValueAtTime(vol, T + attack); g.gain.exponentialRampToValueAtTime(0.0001, T + attack + dur);
    s.connect(f); f.connect(g); g.connect(out); s.start(T, Math.random() * 1.5); s.stop(T + attack + dur + 0.05);
  }
  // play a named sound; pos optional; v loudness
  play(name, pos = null, v = 1) {
    if (!this.ok) return; const fn = SOUNDS[name]; if (!fn) return;
    const out = this.out(pos, v); if (out) fn(this, out);
  }
  // a hero move: a sound of its own for each hero and each slot
  move(id, slot) {
    const m = MOVES[id] && MOVES[id][slot]; if (!m || !this.ok) return;
    for (const [name, delay = 0, v = 1] of m) { if (delay) setTimeout(() => this.play(name, null, v), delay * 1000); else this.play(name, null, v); }
  }
  // a hit landing on someone: what hit them (kind), how hard (dmg), where, and who
  hit(kind, dmg, pos, t) {
    if (!this.ok) return;
    const now = performance.now(); if (now - this.hitT < 35) { this.hitN++; return; }   // many targets in one blow: one sound
    this.hitT = now; const v = clamp(0.55 + dmg / 60 + this.hitN * 0.08, 0.5, 1.4); this.hitN = 0;
    const out = this.out(pos, v); if (!out) return;
    if (kind === 'cut') SOUNDS.cut(this, out); else if (kind === 'fire') SOUNDS.sear(this, out); else if (kind === 'shock') SOUNDS.zapHit(this, out); else if (kind === 'web') SOUNDS.splat(this, out); else SOUNDS.punch(this, out);
    if (dmg >= 30) SOUNDS.heavy(this, out);
    if (t && ROBOTS.has(t.kind)) SOUNDS.clank(this, out);
  }
  // a wall or the street breaking: crack, then rubble
  crack(pos, power) {
    if (!this.ok) return; const out = this.out(pos, clamp(0.4 + power / 5, 0.4, 1.3)); if (!out) return;
    this.n(out, 0, 0.12, 0.35, 1800, 'bandpass', 0.8); this.o(out, 0, 90, 0.3, 0.3, 'sine', 0.5);
    const k = Math.round(clamp(power * 1.5, 2, 9));
    for (let i = 0; i < k; i++) this.n(out, 0.08 + Math.random() * (0.3 + power * 0.08), 0.04 + Math.random() * 0.06, 0.05 + Math.random() * 0.07, 600 + Math.random() * 2400, 'bandpass', 2);
  }
}

// ---- the sounds -----------------------------------------------------------------------------------------
const SOUNDS = {
  swish: (s, o) => s.n(o, 0, 0.14, 0.12, 2600, 'bandpass', 1.2, 0.35, 0.02),
  whoosh: (s, o) => s.n(o, 0, 0.45, 0.16, 500, 'bandpass', 0.9, 3, 0.12),
  punch: (s, o) => { s.n(o, 0, 0.06, 0.4, 900); s.o(o, 0, 130, 0.1, 0.35, 'sine', 0.45); },
  heavy: (s, o) => { s.o(o, 0, 70, 0.35, 0.5, 'sine', 0.5); s.n(o, 0, 0.3, 0.3, 300); },
  cut: (s, o) => { s.n(o, 0, 0.08, 0.3, 3500, 'highpass', 1, 0.6); s.o(o, 0.01, 3200, 0.25, 0.04, 'sine', 0.92); },
  sear: (s, o) => { s.n(o, 0, 0.25, 0.25, 1200, 'lowpass', 1, 0.5); s.n(o, 0.05, 0.1, 0.08, 4000, 'highpass'); },
  zapHit: (s, o) => { for (let i = 0; i < 4; i++) s.n(o, i * 0.025 + Math.random() * 0.02, 0.03, 0.25, 3000 + Math.random() * 3000, 'highpass'); s.o(o, 0, 1500, 0.12, 0.06, 'sawtooth', 0.25); },
  splat: (s, o) => { s.n(o, 0, 0.12, 0.3, 700); s.o(o, 0, 320, 0.12, 0.1, 'sine', 0.4); },
  clank: (s, o) => { for (const f of [410, 1130, 1870]) s.o(o, 0, f * (0.95 + Math.random() * 0.1), 0.22, 0.05, 'triangle', 0.98); },
  // hero moves
  thwip: (s, o) => { s.n(o, 0, 0.07, 0.3, 4500, 'highpass'); s.o(o, 0, 1900, 0.08, 0.06, 'sine', 0.3); },
  zip: (s, o) => { s.n(o, 0, 0.35, 0.18, 600, 'bandpass', 2, 5); s.o(o, 0, 500, 0.3, 0.04, 'sine', 3); },
  sense: (s, o) => { for (const f of [880, 1320, 1760]) s.o(o, 0, f, 0.7, 0.035, 'sine', 1.02, 0.05); },
  repulsor: (s, o) => { s.o(o, 0, 400, 0.12, 0.08, 'sine', 4, 0.02); s.n(o, 0.12, 0.22, 0.4, 1400, 'lowpass', 1, 0.4); s.o(o, 0.12, 220, 0.2, 0.08, 'sawtooth', 0.5, 0.003, 1200); },
  missile: (s, o) => { s.o(o, 0, 300, 0.5, 0.06, 'sawtooth', 3, 0.01, 1800); s.n(o, 0, 0.7, 0.18, 2500, 'bandpass', 0.7, 0.4, 0.05); },
  beam: (s, o) => { s.o(o, 0, 110, 1.9, 0.09, 'sawtooth', 1.1, 0.08, 1400); s.o(o, 0, 220, 1.9, 0.05, 'square', 1.08, 0.08, 1800); s.n(o, 0, 1.9, 0.08, 3000, 'bandpass', 0.8, 1, 0.08); },
  shield: (s, o) => { for (const f of [520, 1336, 2100]) s.o(o, 0, f, 0.9, 0.06, 'sine', 1, 0.004); s.n(o, 0, 0.2, 0.2, 700, 'lowpass'); },
  boom: (s, o) => { s.n(o, 0, 1.0, 0.6, 2600, 'lowpass', 0.7, 0.08); s.o(o, 0, 80, 0.7, 0.6, 'sine', 0.45); },
  zap: (s, o) => { for (let i = 0; i < 6; i++) s.n(o, Math.random() * 0.22, 0.03, 0.22, 2500 + Math.random() * 4000, 'highpass'); s.o(o, 0, 1200, 0.25, 0.07, 'sawtooth', 0.18); },
  bolt: (s, o) => { s.n(o, 0, 0.15, 0.7, 2500, 'highpass'); s.n(o, 0.05, 1.6, 0.6, 180, 'lowpass', 0.7, 0.6, 0.05); s.o(o, 0, 60, 1.2, 0.4, 'sine', 0.6); },
  fire: (s, o) => { s.n(o, 0, 0.6, 0.3, 900, 'lowpass', 0.8, 0.7, 0.05); for (let i = 0; i < 4; i++) s.n(o, Math.random() * 0.5, 0.015, 0.12, 5000, 'highpass'); },
  roar: (s, o) => { s.n(o, 0, 1.5, 0.35, 500, 'lowpass', 0.8, 1.6, 0.25); s.o(o, 0, 70, 1.4, 0.2, 'sawtooth', 0.8, 0.2, 500); },
  fireball: (s, o) => { s.n(o, 0, 0.5, 0.3, 400, 'bandpass', 1, 3, 0.05); s.n(o, 0, 0.4, 0.15, 900, 'lowpass'); },
  blink: (s, o) => { s.o(o, 0, 2200, 0.15, 0.07, 'sine', 0.1); s.n(o, 0, 0.12, 0.15, 4000, 'highpass'); },
  warp: (s, o) => { s.o(o, 0, 700, 0.7, 0.1, 'sine', 0.1, 0.02); s.n(o, 0, 0.8, 0.2, 900, 'lowpass', 2, 0.2, 0.1); },
  growl: (s, o) => { s.o(o, 0, 72, 0.6, 0.15, 'sawtooth', 0.85, 0.05, 420); s.n(o, 0.05, 0.4, 0.12, 300, 'bandpass', 3); },
  charge: (s, o) => s.o(o, 0, 300, 0.45, 0.08, 'sawtooth', 4, 0.05, 2600),
  stretch: (s, o) => { s.o(o, 0, 200, 0.12, 0.12, 'sine', 2.6); s.o(o, 0.13, 520, 0.18, 0.1, 'sine', 0.35); },
  boing: (s, o) => { s.o(o, 0, 150, 0.45, 0.15, 'sine', 4); s.o(o, 0.05, 300, 0.4, 0.05, 'triangle', 2.5); },
  steam: (s, o) => s.n(o, 0, 0.8, 0.2, 5000, 'highpass', 0.8, 0.7, 0.04),
  clang: (s, o) => { for (const f of [380, 1020, 1710]) s.o(o, 0, f, 0.45, 0.07, 'triangle'); s.n(o, 0, 0.04, 0.3, 3000, 'highpass'); },
  ring: (s, o) => { for (const f of [660, 1570, 2480]) s.o(o, 0, f, 1.0, 0.045, 'sine'); },
  whirl: (s, o) => { s.n(o, 0, 0.7, 0.22, 600, 'bandpass', 4, 6, 0.1); s.o(o, 0, 180, 0.7, 0.05, 'triangle', 3, 0.1); },
  clap: (s, o) => { s.n(o, 0, 0.09, 0.8, 1100, 'bandpass', 0.8); s.o(o, 0, 60, 0.6, 0.5, 'sine', 0.6); s.n(o, 0.05, 0.6, 0.25, 600, 'lowpass', 1, 0.3); },
  slam: (s, o) => { s.o(o, 0, 55, 0.9, 0.7, 'sine', 0.5); s.n(o, 0, 0.9, 0.5, 900, 'lowpass', 0.7, 0.2); },
  poof: (s, o) => { s.n(o, 0, 0.3, 0.2, 1500, 'bandpass', 0.8, 0.5, 0.01); s.o(o, 0, 900, 0.2, 0.05, 'sine', 0.3); },
  shing: (s, o) => { s.n(o, 0, 0.12, 0.25, 6000, 'highpass', 1, 0.5); s.o(o, 0.02, 4200, 0.5, 0.05, 'sine', 0.97); s.o(o, 0.02, 6300, 0.35, 0.02, 'sine'); },
  whistle: (s, o) => s.o(o, 0, 2200, 1.2, 0.08, 'sine', 0.15, 0.1),
  power: (s, o) => { s.o(o, 0, 220, 0.6, 0.08, 'sawtooth', 3, 0.05, 3000); s.o(o, 0.05, 440, 0.7, 0.05, 'triangle', 2, 0.1); s.n(o, 0, 0.7, 0.12, 800, 'bandpass', 1.5, 6, 0.3); },
  laugh: (s, o) => { for (let i = 0; i < 4; i++) s.o(o, i * 0.12, 520 + (i % 2) * 140, 0.1, 0.06, 'triangle'); },
};

// [sound, delay seconds, loudness] for each hero and slot. Light attacks also get their own swing sound
// from the combo itself; these give each hero a voice of their own.
const MOVES = {
  strand: { light: [['swish']], heavy: [['thwip'], ['zip', 0.1]], p1: [['thwip'], ['zip', 0.08]], p2: [['thwip'], ['splat', 0.25]], p3: [['sense']], ult: [['thwip'], ['thwip', 0.1], ['thwip', 0.2], ['thwip', 0.3], ['zip', 0.4]] },
  forge: { light: [['repulsor', 0, 0.5]], heavy: [['repulsor']], p1: [['missile'], ['missile', 0.12, 0.7]], p2: [['beam']], p3: [['boom', 0, 0.7], ['shield', 0.1]], ult: [['charge'], ['boom', 0.45, 1.3]] },
  raiko: { light: [['shing', 0, 0.7]], heavy: [['zap'], ['shing', 0.05]], p1: [['blink'], ['zap', 0.05]], p2: [['roar']], p3: [['blink']], ult: [['bolt'], ['ring', 0.2]] },
  sable: { light: [['shing', 0, 0.5]], heavy: [['whoosh']], p1: [['charge'], ['zap', 0.45]], p2: [['growl'], ['growl', 0.3, 0.7]], p3: [['warp']], ult: [['warp', 0, 0.6]] },
  rook: { light: [['stretch']], heavy: [['stretch'], ['stretch', 0.15, 0.8], ['stretch', 0.3, 0.8], ['stretch', 0.45, 0.8]], p1: [['stretch'], ['whoosh', 0.2]], p2: [['steam'], ['boing', 0.1, 0.6]], p3: [['boing']], ult: [['boing'], ['steam', 0.2], ['boing', 0.4, 0.8]] },
  brann: { light: [['clang', 0, 0.6]], heavy: [['whirl']], p1: [['charge'], ['bolt', 0.35]], p2: [['whirl'], ['zap', 0.1]], p3: [['clap'], ['zap', 0.12]], ult: [['bolt'], ['bolt', 0.5, 0.8]] },
  bulwark: { light: [['punch', 0, 0.8]], heavy: [['slam']], p1: [['whoosh'], ['slam', 0.9]], p2: [['clap']], p3: [['whoosh', 0.15]], ult: [['roar'], ['slam', 0.3]] },
  warden: { light: [['clang', 0, 0.8]], heavy: [['whirl'], ['clang', 0.3]], p1: [['whoosh'], ['clang', 0.3]], p2: [['shield']], p3: [['ring'], ['shield', 0.1, 0.6]], ult: [['clang'], ['clang', 0.3], ['clang', 0.6], ['clang', 0.9]] },
  kitsu: { light: [['swish', 0, 0.8]], heavy: [['whoosh']], p1: [['whirl'], ['whirl', 0.4, 0.8]], p2: [['poof'], ['poof', 0.08], ['poof', 0.16]], p3: [['poof']], ult: [['whirl'], ['whirl', 0.5], ['boom', 1.0, 0.8]] },
  trine: { light: [['shing', 0, 0.8]], heavy: [['whirl'], ['shing', 0.1], ['shing', 0.3]], p1: [['shing'], ['whoosh', 0.05]], p2: [['shing'], ['shing', 0.2], ['shing', 0.4]], p3: [['clang', 0, 0.6], ['ring', 0.05]], ult: [0, 0.08, 0.16, 0.24, 0.32, 0.4, 0.48, 0.56, 0.64].map((d) => ['shing', d, 0.7]) },
  ember: { light: [['fire', 0, 0.5]], heavy: [['fireball']], p1: [['fireball'], ['fire', 0.1]], p2: [['roar']], p3: [['roar', 0, 0.8]], ult: [['whistle'], ['boom', 1.2, 1.3]] },
  // the third wave
  tempo: { light: [['swish', 0, 0.7]], heavy: [['whirl'], ['zap', 0.3, 0.6]], p1: [['blink'], ['zap', 0.03]], p2: [['charge']], p3: [['sense']], ult: [['zap'], ['zap', 0.4], ['zap', 0.9], ['bolt', 1.3]] },
  zenith: { light: [['punch', 0, 0.9]], heavy: [['whoosh', 0, 0.7]], p1: [['beam']], p2: [['whoosh'], ['steam', 0.1]], p3: [['whoosh']], ult: [['whoosh'], ['roar', 0.2, 0.6]] },
  ginro: { light: [['shing', 0, 0.6]], heavy: [['zap'], ['growl', 0.05, 0.7]], p1: [['slam', 0, 0.8]], p2: [['poof'], ['zap', 0.1, 0.6]], p3: [['whirl'], ['roar', 0.1, 0.4]], ult: [['bolt'], ['growl', 0.1], ['roar', 0.2, 0.7]] },
  orbit: { light: [['blink', 0, 0.5]], heavy: [['warp', 0, 0.7]], p1: [['warp'], ['ring', 0.1, 0.6]], p2: [['slam', 0, 0.5]], p3: [['shield']], ult: [['warp'], ['roar', 0.3, 0.6]] },
  lapse: { light: [['shing', 0, 0.7]], heavy: [['blink']], p1: [['warp', 0, 0.8], ['blink', 0.1]], p2: [['ring'], ['warp', 0.05, 0.5]], p3: [['sense'], ['charge', 0.05, 0.5]], ult: [['ring'], ['warp', 0.1], ['sense', 0.3]] },
  prism: { light: [['shing', 0, 0.6]], heavy: [['repulsor']], p1: [['ring'], ['shield', 0.1, 0.5]], p2: [['blink'], ['ring', 0.02, 0.6]], p3: [['shield']], ult: [['charge'], ['sense', 0.2]] },
};
