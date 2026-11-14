// Procedural sound. Nothing is loaded from disk; everything is synthesized from oscillators and
// filtered noise. Starts on the first click or key press (browser rule).
//   ambience: city hum, rain, wind, a bed and occasional sounds for each district, crowd murmur
//   movement: footsteps (heel and toe, left and right) by surface, landings, swimming, breathing after a
//             sprint, wind on rooftops, hover traffic swishing past, the maglev passing
//   vehicle:  repulsor whine per model, boost, wind
//   interface: menu, purchase and notice tones
//   music:    concert and club loops near their stages, and an optional quiet generated score
import { G } from '../core/game.js';
import { clamp } from '../core/util.js';

const ENGINE = { wisp: [1, 'sawtooth'], halo: [0.8, 'triangle'], kestrel: [1.45, 'sawtooth'], atlas: [0.62, 'square'], vanta: [1.2, 'sawtooth'] };
// per-district bed: [noise filter Hz, noise gain, drone Hz, drone gain]
const AREA = { 'Solara Bay': 'coast', 'Old Earth seafront': 'coast', sea: 'coast', 'Tidewater Port': 'port', 'Grand Arbor Park': 'park', 'Skyhaven Green': 'park', 'Arbor Heights': 'heights', Northbank: 'midtown', Eastline: 'midtown', Southgate: 'midtown', Westworks: 'midtown', 'Outer Midtown': 'midtown' };
const BED = { coast: [760, 0.06, 0, 0], port: [320, 0.055, 50, 0.018], park: [1400, 0.022, 0, 0], heights: [1100, 0.014, 0, 0], midtown: [340, 0.03, 80, 0.005], aeroport: [420, 0.05, 48, 0.02], bioeden: [1400, 0.03, 0, 0], skyhaven: [900, 0.05, 0, 0], neon: [260, 0.05, 120, 0.012], neonlow: [180, 0.06, 60, 0.02], oldearth: [600, 0.025, 0, 0], nexus: [300, 0.07, 55, 0.035] };
const CHORDS = [[220, 277.2, 329.6], [196, 246.9, 293.7], [174.6, 220, 261.6], [164.8, 207.7, 246.9]];
const PENTA = [1046.5, 1174.7, 1318.5, 1568, 1760, 2093];

export class GameAudio {
  constructor() {
    this.ctx = null; this.stepT = 0; this.beat = 0; this.beatT = 0; this.zoneT = 2; this.padT = 3; this.chord = 0; this.wasGround = true; this.model = '';
    const start = () => { if (!this.ctx) this.init(); else if (this.ctx.state === 'suspended') this.ctx.resume(); };
    addEventListener('pointerdown', start); addEventListener('keydown', start);
  }
  init() {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = (this.ctx = new AC());
    this.master = c.createGain(); this.master.gain.value = 0.7 * (G.settings ? G.settings.volume : 0.7); this.master.connect(c.destination);
    // ambience goes through one filter that closes when you are indoors
    this.amb = c.createBiquadFilter(); this.amb.type = 'lowpass'; this.amb.frequency.value = 18000; this.amb.connect(this.master);
    const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = buf.getChannelData(0);
    let last = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.04 * w) / 1.04; d[i] = last * 3 + w * 0.15; }
    this.noise = buf;
    const loop = (type, freq, q, dest = this.amb) => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = c.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(dest); s.start(0, Math.random()); return { f, g }; };
    this.hum = loop('lowpass', 320, 0.5); this.rain = loop('highpass', 2600, 0.3); this.rainLow = loop('lowpass', 800, 0.4); this.wind = loop('bandpass', 700, 0.8);
    this.bed = loop('lowpass', 400, 0.6); this.crowd = loop('bandpass', 520, 1.4); this.train = loop('bandpass', 380, 2.5); this.water = loop('bandpass', 900, 0.7);
    this.drone = c.createOscillator(); this.drone.type = 'sawtooth'; this.drone.frequency.value = 55; this.droneF = c.createBiquadFilter(); this.droneF.type = 'lowpass'; this.droneF.frequency.value = 220;
    this.droneG = c.createGain(); this.droneG.gain.value = 0; this.drone.connect(this.droneF); this.droneF.connect(this.droneG); this.droneG.connect(this.amb); this.drone.start();
    this.eng = c.createOscillator(); this.eng.type = 'sawtooth'; this.eng2 = c.createOscillator(); this.eng2.type = 'triangle';
    this.engF = c.createBiquadFilter(); this.engF.type = 'lowpass'; this.engF.frequency.value = 600; this.engG = c.createGain(); this.engG.gain.value = 0;
    this.eng.connect(this.engF); this.eng2.connect(this.engF); this.engF.connect(this.engG); this.engG.connect(this.master); this.eng.start(); this.eng2.start();
    this.musicG = c.createGain(); this.musicG.gain.value = 0; this.musicG.connect(this.master);
    // footsteps come slightly from the side of the foot that lands
    this.panL = c.createStereoPanner ? c.createStereoPanner() : c.createGain(); this.panR = c.createStereoPanner ? c.createStereoPanner() : c.createGain();
    if (this.panL.pan) { this.panL.pan.value = -0.18; this.panR.pan.value = 0.18; } this.panL.connect(this.master); this.panR.connect(this.master);
    this.padF = c.createBiquadFilter(); this.padF.type = 'lowpass'; this.padF.frequency.value = 900; this.padG = c.createGain(); this.padG.gain.value = 0; this.padF.connect(this.padG); this.padG.connect(this.master);
  }
  setVolume(v) { if (this.ctx) this.master.gain.setTargetAtTime(0.7 * v, this.ctx.currentTime, 0.05); }
  // One enveloped oscillator note. slide: frequency ratio reached at the end (chirps, sweeps).
  tone(freq, dur, vol, type = 'sine', dest, attack = 0, slide = 1) {
    const c = this.ctx; if (!c) return;
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide !== 1) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    if (attack > 0) { g.gain.setValueAtTime(0.0005, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); } else g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g); g.connect(dest || this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  blip(freq = 600, vol = 0.06) { this.tone(freq, 0.12, vol, 'triangle'); }
  burst(dur, vol, freq, type = 'lowpass', dest) {
    const c = this.ctx; if (!c) return;
    const s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; const g = c.createGain(), t = c.currentTime;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(f); f.connect(g); g.connect(dest || this.master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  thud(v = 0.5) { this.burst(0.35, 0.5 * v + 0.15, 180); }
  // thunder: sound travels about 340 m a second, so a far strike rumbles in late and low; a close one cracks first
  thunder(d = 250) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + Math.min(d / 343, 3.2), k = clamp(1.25 - d / 1000, 0.25, 1.1) * (1 - G.env.indoor * 0.5), out = this.amb;
    const nb = (at, dur, vol, freq, type = 'lowpass', attack = 0.01) => { const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noise; f.type = type; f.frequency.value = freq; g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + attack); g.gain.exponentialRampToValueAtTime(0.0001, at + attack + dur); s.connect(f); f.connect(g); g.connect(out); s.start(at, Math.random()); s.stop(at + attack + dur + 0.05); };
    if (d < 280) { nb(t, 0.25, 0.9 * k, 3000, 'highpass', 0.002); nb(t, 0.5, 0.8 * k, 900, 'lowpass', 0.003); }
    const n = 3 + Math.floor(Math.random() * 3);                     // the rumble rolls in a few waves
    for (let i = 0; i < n; i++) nb(t + 0.1 + i * (0.35 + Math.random() * 0.4), 1.4 + Math.random(), (0.55 - i * 0.07) * k, 120 + Math.random() * 90, 'lowpass', 0.15);
  }
  // Interface tones: short, quiet, distinct per kind.
  ui(kind) {
    if (kind === 'open') this.tone(660, 0.09, 0.035, 'triangle');
    else if (kind === 'pick') this.tone(880, 0.07, 0.035, 'triangle');
    else if (kind === 'close') this.tone(440, 0.08, 0.03, 'triangle');
    else if (kind === 'buy' || kind === 'pay') { this.tone(988, 0.09, 0.04, 'triangle'); setTimeout(() => this.tone(1318.5, 0.16, 0.04, 'triangle'), 80); }
    else if (kind === 'warn') { this.tone(233, 0.16, 0.05, 'square'); }
    else this.tone(523, 0.1, 0.03, 'sine');
  }
  surface(p) {
    if (p.swim) return 'water';
    if (p.pos.y > 1400) return 'glass';                                     // Skyline Station
    if (G.env.indoor > 0.6) return 'floor';
    const d = G.districts && G.districts.at(p.pos);
    if (d) return d.id === 'bioeden' ? 'grass' : d.id === 'oldearth' ? 'stone' : 'metal';
    if (Math.abs(p.pos.x) < 56 && Math.abs(p.pos.z) < 56 && p.pos.y < 2) return 'grass';
    const a = G.metro && p.pos.y < 30 ? G.metro.areaAt(p.pos.x, p.pos.z) : null;
    if (a === 'Grand Arbor Park' || a === 'Skyhaven Green') return 'grass';
    if (a === 'Solara Bay' && p.pos.z > 1150 && p.pos.y < 0.6) return 'sand';
    if (p.pos.y > 5 && p.pos.y < 30) return 'roof';                           // rooftops, decks, the Skyline Run
    return p.pos.y > 30 ? 'metal' : 'stone';
  }
  // a footstep: the heel, then the toe a moment later; a little different every time
  step(surface, hard, side = 0) {
    const v = hard ? 1.5 : 1, j = 0.85 + Math.random() * 0.3, out = side < 0 ? this.panL : side > 0 ? this.panR : this.master, toe = (hard ? 45 : 70) * (0.8 + Math.random() * 0.4);
    const later = (f) => setTimeout(f, toe);
    if (G.env.wet > 0.5 && G.env.indoor < 0.4 && (surface === 'stone' || surface === 'roof' || surface === 'metal')) later(() => this.burst(0.09, 0.02 * v, 1300 * j, 'bandpass', out));   // a splash in the wet
    if (surface === 'grass') { this.burst(0.08, 0.03 * v, 380 * j, 'lowpass', out); later(() => this.burst(0.05, 0.012 * v, 1800 * j, 'bandpass', out)); }
    else if (surface === 'sand') { this.burst(0.11, 0.03 * v, 520 * j, 'lowpass', out); later(() => this.burst(0.07, 0.015 * v, 2600 * j, 'highpass', out)); }
    else if (surface === 'metal') { this.burst(0.05, 0.035 * v, 1600 * j, 'bandpass', out); this.tone(160 * j, 0.07, 0.018 * v, 'sine', out); later(() => this.tone(420 * j, 0.04, 0.008 * v, 'triangle', out)); }
    else if (surface === 'glass') { this.burst(0.04, 0.03 * v, 2400 * j, 'bandpass', out); later(() => this.tone(1900 * j, 0.06, 0.006 * v, 'sine', out)); }
    else if (surface === 'roof') { this.burst(0.06, 0.04 * v, 1100 * j, 'lowpass', out); later(() => this.burst(0.05, 0.02 * v, 3200 * j, 'highpass', out)); }   // gravel and membrane
    else if (surface === 'floor') { this.burst(0.05, 0.035 * v, 1300 * j, 'lowpass', out); later(() => this.burst(0.03, 0.012 * v, 2600 * j, 'bandpass', out)); }
    else if (surface === 'water') this.burst(0.22, 0.05, 700 * j, 'bandpass');
    else { this.burst(0.05, 0.045 * v, 850 * j, 'lowpass', out); this.tone(95 * j, 0.05, 0.016 * v, 'sine', out); later(() => this.burst(0.035, 0.016 * v, 2200 * j, 'bandpass', out)); }
  }
  // breath after a hard run: soft puffs that slow and fade
  breath(k) { this.burst(0.32, 0.022 * k, 1300, 'bandpass'); setTimeout(() => this.burst(0.42, 0.016 * k, 900, 'bandpass'), 420); }
  // a hover car going past close by: a swell of air and a falling hum (its Doppler)
  swish(v, closeness) {
    const c = this.ctx; if (!c) return;
    const s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime, k = clamp(v / 15, 0.4, 1.3) * closeness;
    f.type = 'bandpass'; f.Q.value = 0.9; f.frequency.setValueAtTime(900 + v * 30, t); f.frequency.exponentialRampToValueAtTime(380 + v * 10, t + 0.9);
    g.gain.setValueAtTime(0.0005, t); g.gain.exponentialRampToValueAtTime(0.09 * k, t + 0.22); g.gain.exponentialRampToValueAtTime(0.0005, t + 1.0);
    s.connect(f); f.connect(g); g.connect(this.amb); s.start(t, Math.random()); s.stop(t + 1.1);
    this.tone(150 + v * 3, 0.9, 0.025 * k, 'triangle', this.amb, 0.15, 0.78);
  }
  // Occasional sounds that tell you where you are.
  zoneEvent(id, env) {
    const out = this.amb, r = Math.random();
    if (id === 'coast') { if (r < 0.5) { const f = 1500 + r * 900; this.tone(f, 0.22, 0.03, 'sine', out, 0.01, 0.7); setTimeout(() => this.tone(f * 0.9, 0.3, 0.028, 'sine', out, 0.01, 0.6), 240); } else this.burst(2.2, 0.07, 620, 'bandpass', out); return 2 + r * 6; }                 // gulls, a wave breaking
    if (id === 'port') { if (r < 0.15) { this.tone(98, 2.4, 0.05, 'sawtooth', out, 0.3); return 30 + r * 40; } this.burst(0.1, 0.07, 900, 'bandpass', out); this.tone(70, 0.25, 0.04, 'square', out); return 2.5 + r * 5; }   // a ship's horn, containers landing
    if (id === 'heights') { if (r < 0.2) { this.burst(0.07, 0.05, 700, 'bandpass', out); setTimeout(() => this.burst(0.07, 0.05, 700, 'bandpass', out), 220); return 6 + r * 14; } const f = 2400 + r * 1400; this.tone(f, 0.08, 0.02, 'sine', out, 0.01, 1.2); return 1.5 + r * 4; }   // a dog, garden birds
    if (id === 'midtown') { this.tone(1320, 0.07, 0.012, 'square', out); setTimeout(() => this.tone(1320, 0.07, 0.012, 'square', out), 180); return 5 + r * 9; }                 // a crossing signal
    if (id === 'park') id = 'bioeden';
    if (id === 'bioeden') {
      if (env.night > 0.6) { for (let i = 0; i < 4; i++) setTimeout(() => this.tone(4300, 0.05, 0.012, 'sine', out), i * 70); return 0.9 + r * 1.6; }     // crickets
      const f = 2200 + r * 1800; this.tone(f, 0.09, 0.03, 'sine', out, 0.01, 1.25); if (r > 0.5) setTimeout(() => this.tone(f * 1.2, 0.08, 0.025, 'sine', out, 0.01, 0.85), 130); // birds
      return 0.6 + r * 2.4;
    }
    if (id === 'nexus') { this.burst(0.12, 0.09, 1500, 'bandpass', out); this.tone(92, 0.2, 0.05, 'square', out); return 1.25; }                     // presses
    if (id === 'aeroport') {
      if (r < 0.3) { [784, 659.3, 523.3].forEach((f, i) => setTimeout(() => this.tone(f, 0.5, 0.03, 'sine', out, 0.02), i * 260)); return 14 + r * 20; } // announcement chime
      this.burst(5, 0.1, 500, 'bandpass', out); return 9 + r * 14;                                                                               // a departure overhead
    }
    if (id === 'skyhaven') { this.tone(PENTA[Math.floor(r * PENTA.length)], 1.6, 0.018, 'sine', out, 0.005); return 0.5 + r * 3.5; }                // wind chimes
    if (id === 'oldearth') {
      if (r < 0.25) { this.tone(440, 2.6, 0.05, 'sine', out, 0.004); this.tone(1108, 1.6, 0.02, 'sine', out, 0.004); return 22 + r * 30; }            // the square's bell
      this.burst(0.03, 0.03, 2600, 'highpass', out); return 0.15 + r * 0.9;                                                                      // the tavern fire
    }
    if (id === 'neon') { this.tone(120, 0.35, 0.02, 'sawtooth', out, 0.05); return 1.5 + r * 5; }                                               // a sign buzzing
    if (id === 'neonlow') { this.tone(1500 + r * 900, 0.05, 0.02, 'sine', out, 0, 0.6); return 0.7 + r * 3; }                                    // water dripping
    return 4;
  }
  update(dt) {
    const c = this.ctx; if (!c) return;
    const env = G.env, car = G.car, p = G.player, now = c.currentTime, set = (param, v, k = 0.15) => { if (Number.isFinite(v)) param.setTargetAtTime(v, now, k); };
    const driving = p.state === 'drive', pos = driving ? car.pos : p.pos, high = clamp(pos.y / 200, 0, 1), open = 1 - env.indoor;
    set(this.amb.frequency, 1400 + open * 16600, 0.25);
    const dist = G.districts && G.districts.at(pos), area = !dist && G.metro && Math.hypot(pos.x, pos.z) > 200 && pos.y < 60 ? G.metro.areaAt(pos.x, pos.z) : null, zone = dist ? (dist.id === 'neon' && pos.y < 12 ? 'neonlow' : dist.id) : (area && AREA[area]) || null, bed = zone && BED[zone];
    set(this.hum.g.gain, (0.11 - env.night * 0.03) * (1 - high * 0.6) * (dist ? 0.35 : 1));
    set(this.rain.g.gain, env.rain * 0.16 * (0.25 + open * 0.75) * (zone === 'neonlow' ? 0.3 : 1));
    set(this.rainLow.g.gain, env.rain * env.rain * 0.09 * (0.2 + open * 0.8) * (zone === 'neonlow' ? 0.3 : 1), 0.4);   // a heavy downpour roars
    // rain drumming on the car roof
    if (p.state === 'drive' && env.rain > 0.1 && Math.random() < dt * env.rain * 45) this.burst(0.02, 0.012 + Math.random() * 0.02, 2600 + Math.random() * 2600, 'bandpass');
    set(this.bed.g.gain, bed ? bed[1] : 0, 0.6); if (bed) set(this.bed.f.frequency, bed[0], 0.6);
    set(this.droneG.gain, bed ? bed[3] : 0, 0.6); if (bed && bed[2]) set(this.drone.frequency, bed[2], 0.4);
    if (zone) { this.zoneT -= dt; if (this.zoneT <= 0) this.zoneT = this.zoneEvent(zone, env); }
    // people nearby: a murmur that grows with the crowd
    const crowd = G.npcs ? clamp(G.npcs.close.length / 14, 0, 1) : 0;
    set(this.crowd.g.gain, driving ? 0 : crowd * 0.05 * (0.8 + 0.2 * Math.sin(G.elapsed * 0.9)), 0.4);
    // the maglev passing overhead
    const tr = G.city.train, tc = tr && tr.cars && tr.cars[1];
    if (tc) { const d = Math.hypot(tc.position.x - pos.x, tc.position.z - pos.z, tc.position.y - pos.y), v = Math.abs(tr.v || 0); set(this.train.g.gain, clamp(1 - d / 70, 0, 1) * clamp(v / 20, 0, 1) * 0.12); set(this.train.f.frequency, 260 + v * 9); }
    // lake water in Bio-Eden
    const lake = G.districts && G.districts.byId.bioeden.things.lake;
    set(this.water.g.gain, lake ? clamp(1 - (Math.hypot(pos.x - lake.x, pos.z - lake.z) - lake.r) / 30, 0, 1) * 0.05 * (0.7 + 0.3 * Math.sin(G.elapsed * 1.3)) : 0, 0.5);
    // vehicle
    const moving = driving && car.mode !== 'parked', sp = car.speed;
    if (car.model !== this.model && ENGINE[car.model]) { this.model = car.model; this.eng.type = ENGINE[car.model][1]; }
    const pitch = ENGINE[car.model] ? ENGINE[car.model][0] : 1;
    const roofWind = driving ? 0 : clamp((pos.y - 4) / 36, 0, 1) * (0.05 + 0.04 * Math.sin(G.elapsed * 0.7) * Math.sin(G.elapsed * 0.23)) * (0.3 + open * 0.7);   // gusts on rooftops and high places
    const gust = (env.storm || 0) * 0.07 * (0.5 + 0.5 * Math.sin(G.elapsed * 0.6) * Math.sin(G.elapsed * 1.7)) * (0.3 + open * 0.7);   // storm gusts
    set(this.wind.g.gain, (moving ? clamp(sp / 72, 0, 1) * 0.2 + high * 0.03 + (car.boost ? 0.08 : 0) : high * 0.05 + roofWind + (zone === 'skyhaven' ? 0.05 : 0)) + gust); set(this.wind.f.frequency, moving ? 500 + sp * 14 : 520 + roofWind * 3000);
    set(this.engG.gain, moving ? 0.035 + Math.abs(car.ctrl.throttle) * 0.02 + Math.max(0, car.ctrl.lift) * 0.02 + (car.boost ? 0.02 : 0) : 0);
    const f = (62 + sp * 1.9 + Math.max(0, car.ctrl.lift) * 28 + Math.abs(car.ctrl.throttle) * 14) * pitch; set(this.eng.frequency, f); set(this.eng2.frequency, f * 1.503); set(this.engF.frequency, 380 + sp * 16 + (car.boost ? 500 : 0));
    // footsteps by surface, and landings
    const ground = p.state === 'walk' && p.grounded;
    if (p.state === 'walk' && !p.board && p.swim && p.speed > 0.6) {
      this.stepT -= dt * 1.3;
      if (this.stepT <= 0) { this.stepT = 1; this.step(this.surface(p), false); }
    }
    // on land, a footstep each time the animation puts a foot down (so sound and steps agree)
    const steps = p.rig.steps || 0;
    if (steps !== this.lastSteps) { if (ground && !p.board && !p.swim && p.speed > 0.3) this.step(this.surface(p), p.speed > 5, steps % 2 ? 1 : -1); this.lastSteps = steps; }
    // out of breath after a long sprint
    if (p.state === 'walk' && p.anim === 'run') this.runT = (this.runT || 0) + dt; else if (this.runT > 0) { if (this.runT > 4) this.puff = Math.min(9, this.runT); this.runT = 0; }
    if (this.puff > 0) { this.puffT = (this.puffT || 0) - dt; if (this.puffT <= 0) { this.breath(clamp(this.puff / 6, 0.3, 1)); this.puffT = 0.85 + (9 - this.puff) * 0.06; this.puff -= 1.1; } }
    // hover traffic swishing past when you are on foot
    this.swT = (this.swT || 0) - dt;
    if (!driving && this.swT <= 0) {
      this.swT = 0.08; let best = null, bd = 18 * 18;
      const look = (list) => { for (const o of list) { if (o.on === false || !(o.v > 5)) continue; const d = (o.x - pos.x) ** 2 + (o.z - pos.z) ** 2; if (d < bd) { bd = d; best = o; } } };
      if (G.metro && G.metro.traffic) look(G.metro.traffic.pods); if (G.roads && G.roads.pods) look(G.roads.pods);
      if (best) { const d = Math.sqrt(bd); if (best === this.near && d > this.nearD + 0.05 && this.nearD < 13 && !best._swished) { best._swished = 3; this.swish(best.v, clamp(1.5 - this.nearD / 12, 0.35, 1.2)); } this.near = best; this.nearD = d; }
      for (const list of [G.metro && G.metro.traffic && G.metro.traffic.pods, G.roads && G.roads.pods]) if (list) for (const o of list) if (o._swished) o._swished = Math.max(0, o._swished - 0.08);   // each can swish again after a few seconds
    }
    if (ground && !this.wasGround && p.landed > 4) { this.step(this.surface(p), true); if (p.landed > 9) this.thud(0.25); }
    this.wasGround = ground || p.state !== 'walk';
    // live music: a small sequenced loop, louder near the stage
    let d = 1e9; for (const s of G.musicSpots || []) if (s.on()) d = Math.min(d, Math.hypot(p.pos.x - s.x, p.pos.z - s.z));
    set(this.musicG.gain, clamp(1 - d / 90, 0, 1) * 0.35 * (0.4 + open * 0.6));
    if (d < 95) {
      this.beatT -= dt;
      if (this.beatT <= 0) {
        this.beatT += 0.24; const b = this.beat++ % 16, root = [110, 110, 130.8, 98][Math.floor(this.beat / 16) % 4];
        if (b % 4 === 0) this.tone(root / 2, 0.22, 0.5, 'sine', this.musicG);
        if (b % 2 === 1) this.tone(root * [2, 3, 2.5, 4, 3, 2.5, 3.75, 3][(b >> 1) % 8], 0.2, 0.16, 'square', this.musicG);
        if (b % 8 === 4) this.tone(root * 1.5, 0.5, 0.12, 'sawtooth', this.musicG);
      }
    }
    // background score: slow chords that fade in and out, silent near live music
    const score = G.settings && G.settings.music && G.started && d > 120 && !(G.music && G.music.busy);
    set(this.padG.gain, score ? 0.05 + env.night * 0.02 : 0, 1.5);
    if (score) {
      this.padT -= dt;
      if (this.padT <= 0) {
        this.padT = 7 + Math.random() * 3; const ch = CHORDS[this.chord++ % CHORDS.length], k = driving && pos.y > 60 ? 1.5 : 1;
        for (const n of ch) { this.tone(n * k, 8.5, 0.5, 'triangle', this.padF, 2.6); this.tone(n * k * 1.004, 8.5, 0.3, 'sine', this.padF, 3.2); }
        if (Math.random() < 0.6) setTimeout(() => this.tone(ch[Math.floor(Math.random() * 3)] * 4 * k, 3.5, 0.12, 'sine', this.padF, 0.4), 2500 + Math.random() * 2500);
      }
    }
  }
}
