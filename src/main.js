// NEO EARTH 2226 — boot + main loop.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import './ui/style.css';
import { G } from './core/game.js';
import { Input } from './core/input.js';
import { Settings, QUALITY } from './core/settings.js';
import { Colliders } from './core/collision.js';
import { damp } from './core/util.js';
import { initMaterials } from './world/materials.js';
import { buildCity } from './world/city.js';
import { buildNav } from './world/nav.js';
import { buildDistricts } from './world/districts.js';
import { buildRoads } from './world/roads.js';
import { buildMetro } from './world/metro/index.js';
import { buildNeon } from './world/neon.js';
import { Pad } from './core/gamepad.js';
import { Fleet } from './entities/fleet.js';
import { Environment } from './world/sky.js';
import { Player } from './entities/player.js';
import { AeroCar } from './entities/aerocar.js';
import { Traffic } from './entities/traffic.js';
import { UI } from './ui/ui.js';
import { Interact } from './systems/interact.js';
import { Save, defaultState } from './systems/save.js';
import { initSystems, updateSystems } from './systems/index.js';

// Let the loading screen (index.html) show its picture before the city is built, which holds the
// page for a second or two.
{
  const boot = document.getElementById('boot'), m = boot && getComputedStyle(boot).backgroundImage.match(/url\("?([^")]+)"?\)/);
  if (m) { const im = new Image(); im.src = m[1]; await Promise.race([im.decode().catch(() => {}), new Promise((r) => setTimeout(r, 600))]); }
  // one painted frame (a hidden tab paints nothing, so do not wait for one there)
  await new Promise((r) => { requestAnimationFrame(() => setTimeout(r, 0)); setTimeout(r, 120); });
}
const bootT0 = performance.now();
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
Settings.load();
let Q = QUALITY[Settings.data.quality];
const DPR = devicePixelRatio || 1;
let PR_MAX = Math.min(DPR, Q.prMax), PR_MIN = Math.min(Q.prMin, PR_MAX), PR = PR_MAX;
renderer.setPixelRatio(PR); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.2, 6500);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

const target = new THREE.WebGLRenderTarget(innerWidth * PR, innerHeight * PR, { type: THREE.HalfFloatType, samples: Q.msaa });
const composer = new EffectComposer(renderer, target);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.4, 0.55, 1.0);
composer.addPass(bloom);
// Final grade: a soft vignette, slightly cooler shadows at night, a touch more contrast.
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, night: { value: 0 }, storm: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float night; uniform float storm; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 d = vUv - 0.5; float v = smoothstep(0.92, 0.3, length(d * vec2(1.0, 0.82)));
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, 1.06 - storm * 0.18);                       // a little more color; storms wash it out
      c.rgb = mix(c.rgb, c.rgb * vec3(0.9, 0.96, 1.1), night * 0.35 * (1.0 - smoothstep(0.0, 0.6, l)));   // cool night shadows
      c.rgb *= mix(0.74 - night * 0.08, 1.0, v);
      gl_FragColor = c; }`,
});
composer.addPass(grade); composer.addPass(new OutputPass());
// Bloom runs at a quarter of the frame; the render scale adapts to hold a smooth frame rate.
function applySize() {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setPixelRatio(PR); renderer.setSize(innerWidth, innerHeight);
  composer.setPixelRatio(PR); composer.setSize(innerWidth, innerHeight);
  bloom.setSize(innerWidth * PR * 0.5, innerHeight * PR * 0.5);
}
applySize();
const perf = { t: 0, n: 0, good: 0, tries: 0 };
addEventListener('resize', () => { PR = PR_MAX; perf.tries = 0; applySize(); });
function adaptResolution(rawDt) {
  if (rawDt > 0.1) return; // tab was hidden
  perf.t += rawDt; perf.n++;
  if (perf.n < 50) return;
  const avg = perf.t / perf.n; perf.t = 0; perf.n = 0;
  if (avg > 0.0215 && PR > PR_MIN) { PR = Math.max(PR_MIN, PR - 0.15); perf.good = 0; applySize(); }
  else if (avg < 0.0175 && PR < PR_MAX && perf.tries < 2) { if (++perf.good >= 30) { perf.good = 0; perf.tries++; PR = Math.min(PR_MAX, PR + 0.15); applySize(); } }
  else perf.good = 0;
}

// ---- world ---------------------------------------------------------------------------------
G.scene = scene; G.camera = camera; G.renderer = renderer; G.composer = composer; G.settings = Settings.data; G.lodClose = Q.close; G.paused = false;
G.input = new Input(canvas);
G.pad = new Pad();   // gamepads: buttons become key presses, sticks move and look
G.colliders = new Colliders(24);
G.state = defaultState();
initMaterials();
G.ui = new UI();
G.env = new Environment(scene);
G.city = buildCity(scene, G.colliders);
G.nav = buildNav(G.city);
G.districts = buildDistricts(scene, G.colliders, G.city, G.nav);
G.fleet = new Fleet(scene);   // every moving car, van, taxi and truck on the roads
G.roads = buildRoads(scene, G.colliders, G.city, G.districts);
G.metro = buildMetro(scene, G.colliders, G.city, G.districts, G.roads); G.districts.sea = G.metro.waterAt; G.districts.level = G.metro.level; G.metro.onArrive = () => G.ui.toast('You have arrived.', 'good');
G.neon = buildNeon(scene, G.colliders);   // neon strips, holo adverts and holo rings on the Midtown towers
G.city.batch();
G.interact = new Interact();
G.player = new Player();
G.car = new AeroCar();
G.traffic = new Traffic();
G.save = Save;
initSystems();

// Graphics quality: applied at boot and whenever the setting changes.
function applyQuality() {
  Q = QUALITY[Settings.data.quality];
  PR_MAX = Math.min(DPR, Q.prMax); PR_MIN = Math.min(Q.prMin, PR_MAX); PR = PR_MAX; perf.tries = 0; perf.good = 0;
  for (const rt of [composer.renderTarget1, composer.renderTarget2]) if (rt.samples !== Q.msaa) { rt.samples = Q.msaa; rt.dispose(); }
  bloom.enabled = Q.bloom; G.env.sun.castShadow = Q.shadows; G.softShadows = !Q.shadows; G.lodClose = Q.close; G.metro.stream.radius = Q.detail;
  applySize();
}
applyQuality();
// compile every shader now, at the title screen, so nothing stutters the first time it comes into view
try { renderer.compile(scene, camera); } catch (e) { console.warn('shader precompile skipped', e); }
Settings.onChange((k) => { if (k === 'quality') applyQuality(); });

let started = false, autosave = 60;
// On the title screen the view is shifted so your character stands clear of the menu column.
const titleView = () => { if (started) camera.clearViewOffset(); else camera.setViewOffset(innerWidth, innerHeight, -innerWidth * 0.2, 0, innerWidth, innerHeight); };
titleView(); addEventListener('resize', titleView);
function start(fresh) {
  started = true; G.started = true; titleView();
  G.ui.setHelp();
  if (fresh) { G.ui.toast(`Welcome to Meridian Quarter, ${G.state.name}.`, 'good'); G.ui.toast('Your aerocar is parked at the Skyport, west of the park. CivicLink by the north gate lists paid work.', 'info'); }
  else { G.ui.toast(`Welcome back, ${G.state.name}.`, 'good'); if (Save.recovered) G.ui.toast('Your latest save could not be read, so the previous one was restored.', 'warn'); }
}
G.ui.showTitle({
  hasSave: Save.has(),
  onContinue: () => { if (Save.load()) { if (G.afterLoad) G.afterLoad(); start(false); } else start(true); },
  onNew: () => { Save.clear(); start(true); },
});
// the title is ready: let the loading screen fade away over it
{ const boot = document.getElementById('boot'); G.bootMs = Math.round(performance.now() - bootT0); if (boot) setTimeout(() => { boot.classList.add('gone'); setTimeout(() => boot.remove(), 700); }, 60); }

// ---- loop -------------------------------------------------------------------------------------
// Optional profiler (NEO.bench): time spent per part of the frame, in milliseconds.
let prof = null;
const lap = (k, t0) => { const t = performance.now(); if (prof) prof[k] = (prof[k] || 0) + t - t0; return t; };
function tick(dt) {
  let t0 = prof ? performance.now() : 0;
  G.elapsed += dt;
  const p = G.player;
  if (!started) { p.camYaw += dt * 0.12; p.camPitch = 0.1; }
  G.interact.update();
  G.car.update(dt);
  p.update(dt);
  if (prof) t0 = lap('player', t0);
  const fov0 = Settings.data.fov || 60, fovT = p.state === 'walk' && p.grounded && !p.firstPerson && p.speed > 5.8 ? fov0 + 5 : fov0;   // your chosen field of view; a sprint widens it a touch
  if (p.state !== 'drive' && Math.abs(camera.fov - fovT) > 0.05) { camera.fov = damp(camera.fov, fovT, p.speed > 5.8 ? 3 : 6, dt); camera.updateProjectionMatrix(); }
  G.traffic.update(dt, G.elapsed);
  G.roads.update(dt);
  if (prof) t0 = lap('traffic', t0);
  updateSystems(dt, prof);
  if (prof) t0 = performance.now();
  const env = G.env;
  env.indoor = damp(env.indoor, G.colliders.ceilingAt(camera.position.x, camera.position.z, camera.position.y, 0.3) < camera.position.y + 12 ? 1 : 0, 6, dt);
  env.update(dt, camera.position, p.state === 'drive' ? G.car.pos : p.pos, G.elapsed);
  if (G.diving) G.diving.apply(camera.position, dt, G.elapsed);   // under the sea: blue fog, dark sky, the seabed
  const lit = env.night * (1 - (G.blackout || 0) * 0.9);   // a blackout (the story's finale) puts the city's lights out
  G.city.update(dt, G.elapsed, lit);
  G.city.updateDoors(dt, env.hour);
  G.city.cull(camera.position); G.districts.cull(camera.position);
  G.metro.update(dt, G.elapsed, p.state === 'drive' ? G.car.pos : p.pos, lit);
  G.neon.update(dt, G.elapsed, env.night, camera.position, G.blackout || 0);
  if (prof) t0 = lap('world', t0);
  scene.environmentIntensity = 0.1 + env.daylight * 0.3;
  bloom.strength = 0.18 + env.night * 0.5;
  grade.uniforms.night.value = env.night; grade.uniforms.storm.value = env.storm || 0;
  G.ui.update(dt);
  if (prof) t0 = lap('ui', t0);
  if (started) { autosave -= dt; if (autosave <= 0) { autosave = 60; if (!G.minigame) Save.write(true); } }
  G.input.endFrame();
}
// One bad frame must not end the session: an error in the simulation is logged, the frame is
// dropped, and play continues. If it keeps failing the game stops and offers to reload.
let errs = 0;
function fail(e, where) {
  console.error(`[${where}]`, e); G.errors = (G.errors || 0) + 1;
  errs += 1;
  if (errs === 1) G.ui.toast('Something went wrong for a moment and was skipped. Your save is safe.', 'warn');
  if (errs > 45) {
    errs = 0; G.paused = true;
    G.ui.openMenu({ title: 'The simulation stopped', who: 'Recovery', body: `The same error kept repeating (${String(e && e.message).slice(0, 120)}). Your last save is intact.`, noClose: true, options: [
      { label: 'Reload from the last save', onPick: () => location.reload() },
      { label: 'Try to continue', onPick: () => { G.paused = false; } },
    ] });
  }
}
// Last place the player stood safely; used if a position ever becomes invalid, and by Unstuck.
const safe = { t: 0, pos: new THREE.Vector3(0, 0.15, 30) };
const finite = (v) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
function guard(dt) {
  const p = G.player, c = G.car;
  if (!finite(p.pos) || !finite(p.vel)) { p.pos.copy(safe.pos); p.vel.set(0, 0, 0); if (p.state !== 'drive') p.state = 'walk'; G.ui.toast('Position recovered.', 'info'); }
  if (!finite(c.pos) || !finite(c.vel) || !Number.isFinite(c.yaw)) { c.pos.set(-92, c.ride, 24); c.vel.set(0, 0, 0); c.yaw = 0; c.mode = 'parked'; c.auto = null; G.ui.toast('Vehicle recovered to Skyport 1.', 'info'); }
  safe.t -= dt;
  if (safe.t <= 0) { safe.t = 1; if (p.state === 'walk' && p.grounded && !p.swim && p.pos.y > -1) safe.pos.copy(p.pos); }
}
// Unstuck: back to the nearest walkway (or the nearest pad when flying).
G.unstuck = () => {
  const p = G.player, c = G.car;
  if (p.state === 'drive') {
    const pads = G.city.pads.filter((q) => !q.priv || G.state.owns[q.owner || 'apartment']).sort((a, b) => (a.x - c.pos.x) ** 2 + (a.z - c.pos.z) ** 2 - (b.x - c.pos.x) ** 2 - (b.z - c.pos.z) ** 2);
    const pad = pads[0]; c.pos.set(pad.x, pad.y + c.ride, pad.z); c.vel.set(0, 0, 0); c.mode = 'parked'; c.auto = null;
    return G.ui.toast(`Moved your vehicle to ${pad.name}.`, 'good');
  }
  if (p.state === 'busy' || p.state === 'ride' || G.minigame) return G.ui.toast('Finish what you are doing first.', 'warn');
  if (p.state === 'sit') p.stand();
  const n = G.nav.nearest(p.pos.x, p.pos.z, (q) => q.street && Math.abs(q.y - p.pos.y) < 9) || G.nav.nearest(p.pos.x, p.pos.z, (q) => q.street);
  if (n && (n.x - p.pos.x) ** 2 + (n.z - p.pos.z) ** 2 < 150 * 150) p.pos.set(n.x, n.y + 0.3, n.z); else p.pos.copy(safe.pos);
  p.vel.set(0, 0, 0); G.ui.toast('Moved you to the nearest walkway.', 'good');
};
canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); G.paused = true; G.ui.toast('Graphics were interrupted. Waiting for them to come back.', 'warn'); });
canvas.addEventListener('webglcontextrestored', () => { G.paused = !!G.ui.menu; applySize(); G.ui.toast('Graphics restored.', 'good'); });

function guarded(dt) {
  try { tick(dt); errs = Math.max(0, errs - 0.05); } catch (e) { G.input.endFrame(); fail(e, 'tick'); }
  guard(dt);
}
const meter = { t: 0, n: 0, worst: 0 };
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const raw = (now - last) / 1000, dt = Math.min(0.05, raw); last = now;
  adaptResolution(raw);
  try { G.pad.poll(dt); } catch (e) { console.warn('gamepad', e); }
  let d2 = dt; if (G.hitStop > 0) { G.hitStop -= dt; d2 = dt * 0.06; }   // a big hit freezes the world for a few frames
  if (dt > 0 && !G.paused) guarded(d2);
  try { composer.render(); } catch (e) { fail(e, 'render'); }
  if (raw < 0.5) { meter.t += raw; meter.n++; meter.worst = Math.max(meter.worst, raw); }
  if (meter.t >= 0.5) { G.fps = meter.n / meter.t; G.ui.showFps(Settings.data.fps ? `${Math.round(G.fps)} fps · ${(1000 * meter.t / meter.n).toFixed(1)} ms · worst ${(meter.worst * 1000).toFixed(0)} ms · scale ${PR.toFixed(2)}` : null); meter.t = 0; meter.n = 0; meter.worst = 0; }
}
requestAnimationFrame(frame);

// ---- debug / test hooks ----------------------------------------------------------------------------
window.NEO = {
  G,
  step(dt = 1 / 60, n = 1) { for (let i = 0; i < n; i++) tick(dt); composer.render(); },
  sim(dt = 1 / 60, n = 1) { for (let i = 0; i < n; i++) { tick(dt); guard(dt); } }, // advance without drawing
  safe(dt = 1 / 60, n = 1) { for (let i = 0; i < n; i++) if (!G.paused) guarded(dt); }, // the same guarded step the frame loop uses
  tp(x, y, z) { G.player.pos.set(x, y, z); G.player.vel.set(0, 0, 0); },
  time(h) { G.env.setTime(h); },
  weather(w) { G.env.setWeather(w, true); },
  key(code, down = true) { dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true })); },
  // Render one frame and send it to the dev server as .shots/<name>.jpg (development only).
  async shot(name = 'shot', w = 960) {
    composer.render();
    const c = document.createElement('canvas'); c.width = w; c.height = Math.round((w * canvas.height) / canvas.width);
    c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.8));
    await fetch('/__shot?name=' + name, { method: 'POST', body: blob });
    return name + ' ' + c.width + 'x' + c.height;
  },
  // Place the camera freely for a capture: position + look-at target.
  view(px, py, pz, tx, ty, tz) { camera.up.set(0, 1, 0); camera.position.set(px, py, pz); camera.lookAt(tx, ty, tz); camera.updateMatrixWorld(); },
  scale(v) { if (v) { PR = v; applySize(); } return PR; },
  fx: { composer, bloom, target, grade },
  settings: Settings,
  // Profile n frames at a fixed step: average milliseconds per frame for each part, GPU work included.
  bench(n = 60, dt = 1 / 60) {
    const gl = renderer.getContext(), out = {}; prof = {};
    const px = new Uint8Array(4), info = renderer.info;
    info.autoReset = false;
    for (let i = 0; i < n; i++) {
      tick(dt);
      info.reset();
      const t = performance.now(); composer.render(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); prof.render = (prof.render || 0) + performance.now() - t;
    }
    out.calls = info.render.calls; out.tris = info.render.triangles; info.autoReset = true;
    let sim = 0; for (const k in prof) { out[k] = +(prof[k] / n).toFixed(2); if (k !== 'render') sim += prof[k] / n; }
    out.sim = +sim.toFixed(2); prof = null; return out;
  },
  info() { return { tris: renderer.info.render.triangles, calls: renderer.info.render.calls, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures }; },
};
