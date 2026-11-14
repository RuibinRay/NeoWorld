// Music made while you play (nothing is loaded from disk): battle music that builds with the fight,
// a theme for each villain, short stings when a fight is won or lost, and four car radio stations.
// Notes are scheduled a moment ahead on the audio clock, so the beat holds steady when frames stutter.
import { G } from '../core/game.js';
import { clamp } from '../core/util.js';
import { Settings } from '../core/settings.js';

const hz = (m) => 440 * 2 ** ((m - 69) / 12);
const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], insen: [0, 1, 5, 7, 10], pent: [0, 3, 5, 7, 10], dorian: [0, 2, 3, 5, 7, 9, 10], major: [0, 2, 4, 5, 7, 9, 11], majpent: [0, 2, 4, 7, 9] };
const CHORD = { m: [0, 3, 7], M: [0, 4, 7], m7: [0, 3, 7, 10], M7: [0, 4, 7, 11] };

// A style: tempo, key (MIDI note of the bass root), scale, one chord per bar (semitones above the key
// plus its quality), 16-step patterns ('x' hit, 'o' octave up, '5' fifth, '.' rest), the drum kit,
// the voices, how busy the melody is, and the seed it is made from.
const STYLES = {
  // battle themes
  street: { bpm: 128, root: 45, scale: 'minor', prog: ['0m', '8M', '3M', '10M'], kit: 'std', kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.xx', bass: 'x.xo..x.x.xo..xo', bassW: 'sawtooth', lead: 'saw', dens: 0.45, seed: 3 },
  vektor: { bpm: 136, root: 40, scale: 'phrygian', prog: ['0m', '1M', '0m', '10M'], kit: 'electro', kick: 'x...x...x...x...', snare: '....x.......x..x', hat: 'xxxxxxxxxxxxxxxx', bass: 'x.oxx.oxx.oxx.ox', bassW: 'square', lead: 'square', dens: 0.6, seed: 11 },
  shade: { bpm: 108, root: 38, scale: 'insen', prog: ['0m', '1M', '0m', '10m'], kit: 'clan', kick: 'x......x..x.....', snare: '....x.......x...', hat: '..x...x...x...xx', bass: 'x.......x...o...', bassW: 'triangle', lead: 'pluck', lead3: 'flute', dens: 0.35, seed: 7 },
  kurozan: { bpm: 96, root: 36, scale: 'pent', prog: ['0m', '0m', '8M', '10M'], kit: 'taiko', kick: 'x..x..x.x...x.x.', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: 'x..x..x.x...x...', bassW: 'sawtooth', lead: 'brass', dens: 0.3, seed: 5 },
  dragon: { bpm: 148, root: 37, scale: 'pent', prog: ['0m', '8M', '10M', '0m'], kit: 'taiko', kick: 'x.x.x..xx.x.x..x', snare: '....x.......x.x.', hat: 'xxxxxxxxxxxxxxxx', bass: 'x.xox.xox.xox.xo', bassW: 'sawtooth', lead: 'saw', lead3: 'brass', dens: 0.6, seed: 9 },
  // radio
  synth: { bpm: 100, root: 41, scale: 'minor', prog: ['0m', '8M', '3M', '10M'], kit: 'gated', kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', bass: 'xoxoxoxoxoxoxoxo', bassW: 'sawtooth', lead: 'saw', dens: 0.35, pad: true, seed: 21 },
  house: { bpm: 124, root: 43, scale: 'dorian', prog: ['0m', '5M', '3M', '10M'], kit: 'house', kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', bass: '..x...x...x..xx.', bassW: 'square', lead: 'stab', dens: 0.3, pad: true, seed: 31 },
  lofi: { bpm: 82, root: 48, scale: 'major', prog: ['0M7', '9m7', '5M7', '7M'], kit: 'lofi', kick: 'x.....x...x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', swing: 0.18, bass: 'x.....x...x.....', bassW: 'sine', lead: 'keys', dens: 0.3, pad: true, crackle: true, seed: 41 },
  drift: { bpm: 70, root: 38, scale: 'majpent', prog: ['0M', '5M', '9m', '7M'], kit: 'none', kick: '', snare: '', hat: '', bass: 'x...............', bassW: 'sine', lead: 'bell', dens: 0.18, pad: true, seed: 51 },
};

export const STATIONS = [
  { name: 'Neon 88.6', style: 'synth', dj: 'Neon eighty eight point six. Bright lights, long drives.', tracks: ['Chrome Sunset', 'Night Lane Seven', 'Afterglow Avenue'] },
  { name: 'Pulse 104.2', style: 'house', dj: 'Pulse, one oh four point two. Keep Neo Central moving.', tracks: ['Skyline Shuffle', 'Mag Rail Groove', 'Rooftop Hours'] },
  { name: 'Harbor Lo-Fi 92.1', style: 'lofi', dj: 'Harbor Lo-Fi. Slow beats from the Tidewater docks.', tracks: ['Rain on the Pier', 'Tea at the Fish Market', 'Lighthouse Nap'] },
  { name: 'Orbit 99.9', style: 'drift', dj: 'Orbit ninety nine point nine. Music for the sky lanes.', tracks: ['Above the Clouds', 'Lift Deck Dawn', 'Slow Orbit'] },
];

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// a two-bar melody: scale steps that wander, more notes on the beat than off it
function melody(seed, dens) {
  const r = rng(seed), out = new Array(32).fill(null); let deg = 4;
  for (let i = 0; i < 32; i++) {
    const p = dens * (i % 4 === 0 ? 1.5 : i % 2 === 0 ? 1 : 0.55);
    if (r() < p) { deg = clamp(deg + Math.round((r() - 0.5) * 4.4), 0, 9); out[i] = { deg, len: 1 + Math.floor(r() * 3) }; i += out[i].len - 1; }
  }
  return out;
}
const parse = (c) => { const m = /^(\d+)([mM])(7?)$/.exec(c); return { off: +m[1], tones: CHORD[m[2] + m[3]] }; };

// One running piece of music on its own output: picks up a new style at the next bar.
class Seq {
  constructor(au, out) { this.au = au; this.out = out; this.st = null; this.pending = undefined; this.step = 0; this.t = 0; this.level = 3; }
  set(key, variant = 0, now = false) {
    if (!key) { this.pending = null; if (now) this.st = null; return; }
    const b = STYLES[key], v = variant % 3;
    const st = { ...b, key, root: b.root + [0, 3, -2][v], seed: b.seed + v * 17, prog: b.prog.slice(v).concat(b.prog.slice(0, v)) };
    st.mel = melody(st.seed, st.dens); st.chords = st.prog.map(parse); st.sc = SCALES[st.scale];
    if (now || !this.st) { this.st = st; this.step = 0; this.t = this.au.ctx.currentTime + 0.06; this.pending = undefined; } else this.pending = st;
  }
  get playing() { return !!this.st; }
  run() {
    const c = this.au.ctx, now = c.currentTime;
    if (!this.st) return;
    if (this.t < now - 0.25) this.t = now + 0.05;            // fell behind (a hidden tab): carry on from now
    while (this.t < now + 0.16) {
      if (this.step % 16 === 0 && this.pending !== undefined) { this.st = this.pending; this.pending = undefined; this.step = 0; if (!this.st) return; }
      const sd = 60 / this.st.bpm / 4, sw = this.step % 2 ? (this.st.swing || 0) * sd : 0;
      this.play(this.step, this.t + sw, sd);
      this.t += sd; this.step++;
    }
  }
  play(i, t, sd) {
    const st = this.st, L = this.level, s = i % 16, bar = Math.floor(i / 16), ch = st.chords[bar % st.chords.length], o = this.out, n = MUSIC;
    const hit = (pat) => pat && pat[s] === 'x';
    // drums
    if (hit(st.kick)) n.kick(this.au, t, st.kit, L < 2 ? 0.7 : 1, o);
    if (L >= 2 && hit(st.snare)) n.snare(this.au, t, st.kit, o);
    if (hit(st.hat) && (L >= 2 || s % 2 === 0)) n.hat(this.au, t, st.kit, s, o);
    if (L >= 3 && s === 0 && bar % 4 === 0 && st.kit !== 'none' && st.kit !== 'lofi') n.crash(this.au, t, o);
    if (st.crackle && s % 4 === 0) n.crackle(this.au, t, sd * 4, o);
    // bass: the chord's root (an octave up for 'o', the fifth for '5')
    const bc = st.bass[s];
    if (bc && bc !== '.') { const off = ch.off > 6 ? ch.off - 12 : ch.off; n.bass(this.au, t, hz(st.root + off + (bc === 'o' ? 12 : bc === '5' ? 7 : 0)), sd * (st.kit === 'none' ? 14 : 1.8), st.bassW, L < 2 ? 0.65 : 1, o); }
    // the chord held through the bar
    if ((st.pad || L >= 3) && s === 0) n.pad(this.au, t, ch.tones.map((x) => hz(st.root + 24 + (ch.off > 6 ? ch.off - 12 : ch.off) + x)), sd * 16, st.pad ? 1 : 0.7, o);
    // melody
    if (L >= 2) {
      const m = st.mel[i % 32];
      if (m) {
        const sc = st.sc, deg = m.deg, f = hz(st.root + 24 + sc[deg % sc.length] + 12 * Math.floor(deg / sc.length));
        if (st.lead === 'stab') n.stab(this.au, t, ch.tones.map((x) => hz(st.root + 24 + ch.off + x)), sd, o);
        else n.lead(this.au, t, f, sd * m.len, st.lead, o);
        if (L >= 3 && st.lead3 && bar % 2 === 1) n.lead(this.au, t, f * 2, sd * m.len, st.lead3, o);
      }
    }
  }
}

// ---- instruments: each one is a few oscillators or a burst of noise, started at time t ---------------
function osc(au, t, f, dur, vol, type, out, attack = 0.004, slide = 1, cutoff = 0, q = 0.8, vib = 0) {
  const c = au.ctx, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide !== 1) o.frequency.exponentialRampToValueAtTime(f * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur);
  let head = o;
  if (cutoff) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(cutoff, t); fl.frequency.exponentialRampToValueAtTime(Math.max(200, cutoff * 0.35), t + attack + dur); fl.Q.value = q; o.connect(fl); head = fl; }
  if (vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5.5; lg.gain.value = f * vib; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + attack + dur + 0.05); }
  head.connect(g); g.connect(out); o.start(t); o.stop(t + attack + dur + 0.05);
}
function noise(au, t, dur, vol, freq, type, out, q = 1, attack = 0.002) {
  const c = au.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = au.noise; f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur);
  s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 1.5); s.stop(t + attack + dur + 0.05);
}
const MUSIC = {
  kick(au, t, kit, v, o) {
    if (kit === 'taiko' || kit === 'clan') { osc(au, t, kit === 'taiko' ? 95 : 110, kit === 'taiko' ? 0.7 : 0.5, 0.9 * v, 'sine', o, 0.003, 0.48); noise(au, t, 0.25, 0.45 * v, 320, 'lowpass', o); return; }
    if (kit === 'lofi') { osc(au, t, 120, 0.25, 0.55 * v, 'sine', o, 0.004, 0.42); return; }
    osc(au, t, 150, 0.28, 0.9 * v, 'sine', o, 0.002, 0.32);
    if (kit === 'electro') noise(au, t, 0.02, 0.25 * v, 3000, 'highpass', o);
  },
  snare(au, t, kit, o) {
    if (kit === 'clan') { osc(au, t, 900, 0.05, 0.3, 'sine', o); osc(au, t, 1400, 0.03, 0.15, 'triangle', o); return; }               // a wood block
    if (kit === 'taiko') { osc(au, t, 180, 0.3, 0.5, 'sine', o, 0.003, 0.66); noise(au, t, 0.18, 0.3, 900, 'bandpass', o); return; } // a tom
    if (kit === 'house') { for (let k = 0; k < 3; k++) noise(au, t + k * 0.011, 0.05 + k * 0.03, 0.32, 1500, 'bandpass', o, 1.2); return; }   // a clap
    if (kit === 'lofi') { noise(au, t, 0.12, 0.22, 2200, 'lowpass', o); return; }
    noise(au, t, kit === 'gated' ? 0.24 : 0.16, kit === 'gated' ? 0.5 : 0.42, kit === 'electro' ? 2600 : 1800, kit === 'electro' ? 'highpass' : 'bandpass', o);
    osc(au, t, 190, 0.1, 0.25, 'triangle', o);
  },
  hat(au, t, kit, s, o) {
    if (kit === 'clan') { noise(au, t, 0.06, 0.1, 5000, 'bandpass', o, 1.5); return; }
    if (kit === 'electro') { noise(au, t, 0.025, s % 4 === 2 ? 0.16 : 0.09, 9000, 'bandpass', o, 6); return; }
    if (kit === 'house') { noise(au, t, s % 4 === 2 ? 0.14 : 0.03, 0.14, 7000, 'highpass', o); return; }
    noise(au, t, 0.035, kit === 'lofi' ? 0.06 : 0.13, 8000, 'highpass', o);
  },
  crash(au, t, o) { noise(au, t, 1.4, 0.16, 5200, 'highpass', o); },
  crackle(au, t, span, o) { for (let k = 0; k < 3; k++) noise(au, t + Math.random() * span, 0.008, 0.06 + Math.random() * 0.06, 4000, 'highpass', o); },
  bass(au, t, f, dur, type, v, o) { osc(au, t, f, dur, (type === 'sine' ? 0.32 : 0.2) * v, type, o, 0.006, 1, type === 'sine' || type === 'triangle' ? 0 : 900, 2); },
  pad(au, t, fs, dur, v, o) { for (const f of fs) { osc(au, t, f, dur * 0.9, 0.035 * v, 'triangle', o, dur * 0.25, 1, 1400); osc(au, t, f * 1.005, dur * 0.9, 0.02 * v, 'sine', o, dur * 0.3); } },
  stab(au, t, fs, sd, o) { for (const f of fs) osc(au, t, f, sd * 1.2, 0.06, 'square', o, 0.003, 1, 2200, 3); },
  lead(au, t, f, dur, kind, o) {
    if (kind === 'saw') osc(au, t, f, dur * 0.95, 0.1, 'sawtooth', o, 0.006, 1, 3000, 4);
    else if (kind === 'square') osc(au, t, f, dur * 0.8, 0.07, 'square', o, 0.003, 1, 3400, 2);
    else if (kind === 'pluck') { osc(au, t, f, Math.min(dur * 2, 0.5), 0.2, 'triangle', o, 0.002, 0.995); osc(au, t, f * 2, 0.2, 0.05, 'sine', o, 0.002); }   // like a plucked string
    else if (kind === 'flute') { osc(au, t, f, dur * 1.1, 0.12, 'sine', o, 0.06, 1, 0, 0.8, 0.012); noise(au, t, dur * 0.6, 0.02, f * 2, 'bandpass', o, 3, 0.05); }
    else if (kind === 'brass') osc(au, t, f, dur * 1.05, 0.12, 'sawtooth', o, 0.04, 1, 1500, 1.5);
    else if (kind === 'keys') { osc(au, t, f, dur * 1.3, 0.12, 'sine', o, 0.008); osc(au, t, f * 2, dur * 0.6, 0.03, 'triangle', o, 0.008); }
    else if (kind === 'bell') { osc(au, t, f * 2, 1.8, 0.07, 'sine', o, 0.003); osc(au, t, f * 5.52, 0.9, 0.02, 'sine', o, 0.003); }
  },
};

// ---- the director: what should be playing right now ---------------------------------------------------
export class Music {
  constructor() { this.level = 0; this.theme = null; this.hold = 0; this.idle = 0; this.track = 0; this.bars = 0; this.lastStation = null; }
  build(au) {
    const c = au.ctx;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.connect(au.master);
    this.bus = c.createGain(); this.bus.gain.value = 0; this.bus.connect(comp);
    this.stingBus = c.createGain(); this.stingBus.gain.value = 0.5; this.stingBus.connect(comp);
    // the car radio comes through small speakers: less bass and top
    const lo = c.createBiquadFilter(); lo.type = 'lowpass'; lo.frequency.value = 6500; const hi = c.createBiquadFilter(); hi.type = 'highpass'; hi.frequency.value = 70;
    this.radioBus = c.createGain(); this.radioBus.gain.value = 0; this.radioBus.connect(lo); lo.connect(hi); hi.connect(comp);
    this.battle = new Seq(au, this.bus); this.radio = new Seq(au, this.radioBus); this.radio.level = 3;
  }
  // battle level: 0 quiet, 1 a raid nearby, 2 fighting, 3 a boss
  want() {
    const H = G.heroes, V = G.villains, P = G.player.pos;
    if (!H || !H.on || !V || !G.settings.battleMusic) return [null, 0];
    const b = V.boss;
    if (b && b.alive !== false && V.bossArena && P.distanceTo(V.bossArena) < 130) { const k = b.bossKind || 'kurozan'; return [k === 'kurozan' && (b.phase === 'dragon' || b.phase === 'turn') ? 'dragon' : k, 3]; }
    const R = V.raid;
    if (R && R.spawned) { const d = Math.hypot(P.x - R.site.x, P.z - R.site.z), th = R.owner === 'vektor' ? 'vektor' : R.owner === 'shade' ? 'shade' : 'street'; if (d < 160) return [th, d < 50 ? 2 : 1]; }
    if (H.training) return ['street', 1];
    for (const f of V.foes) if (f.alive && f.pos.distanceTo(P) < 35) return ['street', 2];
    return [null, 0];
  }
  update(dt) {
    const au = G.audio; if (!au || !au.ctx) return; if (!this.bus) this.build(au);
    const c = au.ctx, now = c.currentTime;
    // battle
    let [theme, level] = this.want();
    if (level < this.level && this.hold > 0) { this.hold -= dt; theme = this.theme; level = this.level; } else if (level >= this.level) this.hold = 4;
    if (theme && theme !== this.theme) { this.battle.set(theme, 0, !this.battle.playing || this.level === 0); }
    if (theme) this.theme = theme;
    this.level = level; this.battle.level = Math.max(1, level);
    this.bus.gain.setTargetAtTime(level > 0 ? [0, 0.2, 0.3, 0.34][level] : 0, now, level > 0 ? 0.6 : 1.4);
    if (level === 0) { this.idle += dt; if (this.idle > 6 && this.battle.playing) { this.battle.set(null, 0, true); this.theme = null; } } else this.idle = 0;
    this.battle.run();
    // radio: while driving, unless a fight is on
    const drive = G.player.state === 'drive', st = G.settings.radio, on = drive && st >= 0 && st < STATIONS.length && level === 0 && !G.paused;
    if (drive && G.input.pressed('KeyR') && !G.ui.menu && !(G.phone && G.phone.open)) this.nextStation();
    if (on && this.lastStation !== st) { this.track = 0; this.bars = 0; this.radio.set(STATIONS[st].style, 0, true); this.lastStation = st; this.announce(true); }
    if (!on && this.radio.playing) { this.radioOff = (this.radioOff || 0) + dt; if (this.radioOff > 2) { this.radio.set(null, 0, true); this.lastStation = null; } } else this.radioOff = 0;
    this.radioBus.gain.setTargetAtTime(on ? 0.26 * (G.car && G.car.cockpit ? 1.15 : 1) : 0, now, on ? 0.3 : 0.4);
    if (on) {
      const before = this.radio.step; this.radio.run();
      if (Math.floor(this.radio.step / 16) !== Math.floor(before / 16)) { this.bars++; if (this.bars >= 40) { this.bars = 0; this.track = (this.track + 1) % 3; this.radio.set(STATIONS[st].style, this.track); this.announce(false); } }
    }
  }
  nextStation() {
    const s = G.settings.radio, n = s + 1 >= STATIONS.length ? -1 : s + 1;
    Settings.set('radio', n); this.static();
    if (n < 0) G.ui.toast('Radio off. R turns it back on.', 'info');
  }
  announce(station) {
    const S = STATIONS[G.settings.radio]; if (!S) return;
    G.ui.toast(`📻 ${S.name} · ${S.tracks[this.track]}${station ? ' · R changes station' : ''}`, 'info');
    if (station && G.voice) G.voice.say(S.name, S.dj, { voice: ['Daniel', 'Samantha', 'Alex', 'Karen'], rate: 1.05, quiet: true, noCaption: true });
  }
  static() { const au = G.audio; if (au && au.ctx && this.radioBus) noise(au, au.ctx.currentTime, 0.25, 0.08, 3000, 'bandpass', au.master, 0.6); }
  // short pieces over the top: a won raid, a beaten boss, being knocked out, a big change in a fight
  sting(kind) {
    const au = G.audio; if (!au || !au.ctx || !this.stingBus || !G.settings.battleMusic) return;
    const t = au.ctx.currentTime + 0.03, o = this.stingBus;
    if (kind === 'win' || kind === 'boss') {
      const notes = kind === 'boss' ? [60, 64, 67, 72, 76, 79, 84] : [60, 64, 67, 72];
      notes.forEach((m, i) => { osc(au, t + i * 0.09, hz(m), 0.5, 0.12, 'sawtooth', o, 0.005, 1, 3200, 2); osc(au, t + i * 0.09, hz(m + 12), 0.3, 0.04, 'square', o, 0.005, 1, 4000); });
      const end = t + notes.length * 0.09;
      for (const m of [48, 60, 64, 67]) osc(au, end, hz(m), kind === 'boss' ? 2.6 : 1.4, 0.07, 'sawtooth', o, 0.02, 1, 2400);
      noise(au, end, 1.8, 0.14, 5200, 'highpass', o); osc(au, end, 55, 0.6, 0.5, 'sine', o, 0.002, 0.5);
      this.hold = 0; this.level = 0;                        // the battle music gives way to the sting
      this.bus.gain.setTargetAtTime(0, au.ctx.currentTime, 0.15);
    } else if (kind === 'lose') {
      [67, 63, 60, 55].forEach((m, i) => osc(au, t + i * 0.28, hz(m), 0.6, 0.1, 'triangle', o, 0.01, 0.985, 1800));
      osc(au, t + 1.12, hz(36), 2, 0.2, 'sawtooth', o, 0.05, 0.9, 600);
    } else if (kind === 'rise') {
      const c = au.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = au.noise; f.type = 'bandpass'; f.Q.value = 2; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(5000, t + 2.6);
      g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 2.5); g.gain.exponentialRampToValueAtTime(0.001, t + 2.8);
      s.connect(f); f.connect(g); g.connect(o); s.start(t); s.stop(t + 2.9);
      osc(au, t + 2.6, 50, 1.6, 0.6, 'sine', o, 0.002, 0.6); noise(au, t + 2.6, 1.2, 0.3, 400, 'lowpass', o);
    } else if (kind === 'hit') {                              // a villain arrives
      osc(au, t, 48, 1.8, 0.6, 'sine', o, 0.002, 0.6); osc(au, t, 96, 1.2, 0.12, 'sawtooth', o, 0.004, 0.7, 900); noise(au, t, 1.4, 0.25, 500, 'lowpass', o); noise(au, t, 1.6, 0.1, 5000, 'highpass', o);
    }
  }
  // what the background score and the ambience need to know
  get busy() { return this.level > 0 || (this.radio && this.radio.playing && G.player.state === 'drive'); }
}
