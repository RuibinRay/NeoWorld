// Time of day, weather and everything that lights the world: sun/moon, sky dome, fog, rain,
// lightning, wet streets. The clock runs whether or not the player does anything.
import * as THREE from 'three';
import { M, applyNight } from './materials.js';
import { clamp, damp, lerp, smooth, RNG } from '../core/util.js';
import { G } from '../core/game.js';

const WX = {
  clear: { cloud: 0.05, rain: 0, fog: 0, storm: 0, label: 'Clear' },
  cloudy: { cloud: 0.7, rain: 0, fog: 0.05, storm: 0, label: 'Overcast' },
  rain: { cloud: 0.9, rain: 0.7, fog: 0.15, storm: 0, label: 'Rain' },
  storm: { cloud: 1, rain: 1, fog: 0.2, storm: 1, label: 'Storm' },
  fog: { cloud: 0.5, rain: 0, fog: 1, storm: 0, label: 'Fog' },
};
const NEXT = {
  clear: ['clear', 'clear', 'cloudy', 'cloudy', 'fog'], cloudy: ['clear', 'clear', 'rain', 'rain', 'cloudy', 'fog'],
  rain: ['cloudy', 'cloudy', 'storm', 'rain', 'clear'], storm: ['rain', 'rain', 'cloudy'], fog: ['clear', 'cloudy', 'cloudy'],
};
const C = (h) => new THREE.Color(h);
const SKY = {
  dayTop: C('#2f6fd0'), dayHor: C('#a8cdea'), duskTop: C('#2a3566'), duskHor: C('#ff8f5a'),
  nightTop: C('#04050c'), nightHor: C('#1b1438'), ocDayTop: C('#69727d'), ocDayHor: C('#9aa3ad'), ocNightTop: C('#07080c'), ocNightHor: C('#15141c'),
};

export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.day = 1; this.mins = 7 * 60 + 40; this.timeScale = 0.4; // game minutes per real second: a full day lasts one real hour
    this.weather = 'clear'; this.nextWx = 'cloudy'; this.wxTimer = 240; this.cloud = 0.05; this.rain = 0; this.fog = 0; this.storm = 0; this.wet = 0;
    this.night = 0; this.daylight = 1; this.flash = 0; this.indoor = 0; this.rng = new RNG(Date.now() & 0xffff);
    this.sunDir = new THREE.Vector3(0, 1, 0); this.windX = 0; this.windZ = 0; this.onThunder = null; this.onWeather = null;

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    const s = this.sun.shadow; s.mapSize.set(2048, 2048); s.bias = -0.0005; s.normalBias = 0.35;
    const sc = s.camera; sc.left = -120; sc.right = 120; sc.top = 120; sc.bottom = -120; sc.near = 1; sc.far = 1700;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbcd7ff, 0x5a5148, 1);
    scene.add(this.hemi);
    scene.fog = new THREE.FogExp2(0xa8cdea, 0.0008);

    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() }, night: { value: 0 }, cloud: { value: 0 }, time: { value: 0 }, flash: { value: 0 }, under: { value: 0 } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `
        varying vec3 vDir; uniform vec3 top, horizon, sunDir, sunCol; uniform float night, cloud, time, flash, under;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        void main(){
          vec3 d = normalize(vDir);
          vec3 col = mix(horizon, top, pow(smoothstep(-0.02, 0.85, d.y), 0.55));
          float sd = max(dot(d, sunDir), 0.0);
          col += sunCol * (pow(sd, 1100.0) * 7.0 + pow(sd, 14.0) * 0.3) * (1.0 - cloud * 0.9);
          vec2 uv = d.xz / (abs(d.y) + 0.35) * 70.0; float s = hash(floor(uv));
          float star = step(0.997, s) * smoothstep(0.02, 0.3, d.y) * (0.55 + 0.45 * sin(time * 2.0 + s * 90.0));
          col += vec3(star) * night * (1.0 - cloud);
          col += vec3(0.7, 0.75, 1.0) * flash * (0.25 + 0.4 * smoothstep(0.0, 0.6, d.y));
          // the orbital ring: a band across the southern sky, wider the higher it stands; sunlit on one side by
          // day with panels along it, a chain of lights by night; thin tethers run down from it to the horizon
          vec3 rn = normalize(vec3(0.0, 0.8, -0.6)), e1 = vec3(1.0, 0.0, 0.0), e2 = normalize(cross(rn, e1));
          float rd = dot(d, rn), above = smoothstep(-0.01, 0.08, d.y), along = atan(dot(d, e1), dot(d, e2));
          float W = 0.007 + 0.014 * clamp(d.y, 0.0, 1.0), x = rd / W;
          float body = smoothstep(1.0, 0.8, abs(x)), seg = 0.78 + 0.22 * step(0.5, fract(along * 70.0)), lit = smoothstep(-1.0, 1.0, x);
          float edge = smoothstep(0.14, 0.0, abs(abs(x) - 0.92));
          float ak = along * 1.2732, tk = abs(ak - floor(ak + 0.5)) * 0.7854;   // eight tethers round the ring
          float tether = smoothstep(0.0012, 0.0, tk) * step(rd, -W) * step(-0.55, rd) * smoothstep(0.0, 0.05, d.y);
          float lights = step(0.86, fract(along * 240.0)) * step(0.35, fract(along * 31.0 + 0.2)) * smoothstep(0.75, 0.2, abs(x));
          vec3 dayCol = mix(vec3(0.5, 0.56, 0.66), vec3(0.97, 0.98, 1.0), lit) * seg + vec3(0.6, 0.85, 1.0) * edge * 0.3;
          float dayA = clamp(body * 0.88 + edge * 0.4 + tether * 0.35, 0.0, 1.0) * above * (1.0 - cloud * 0.8);
          col = mix(col, dayCol, dayA * (1.0 - night));
          vec3 nightCol = vec3(0.06, 0.08, 0.12) * body * seg + vec3(1.0, 0.82, 0.55) * lights * 1.4 + vec3(0.4, 0.85, 1.0) * (edge * 0.6 + tether * 0.5);
          col = mix(col, col * (1.0 - body * 0.8) + nightCol, night * above * (1.0 - cloud * 0.85));
          // satellites and orbital traffic crossing the night sky
          for (int i = 0; i < 7; i++) {
            float fi = float(i), a = time * (0.012 + fi * 0.004) + fi * 1.7, tilt = 0.4 + fi * 0.33;
            vec3 sat = normalize(vec3(cos(a), 0.25 + 0.6 * abs(sin(a * 0.5 + fi)), sin(a) * cos(tilt)));
            float blink = 0.6 + 0.4 * step(0.5, fract(time * 0.7 + fi * 0.37));
            col += vec3(0.85, 0.95, 1.0) * pow(max(dot(d, sat), 0.0), 60000.0) * 2.5 * blink * night * (1.0 - cloud);
          }
          col = mix(col, vec3(0.02, 0.13, 0.19) * (1.0 - night * 0.7) + vec3(0.25, 0.45, 0.5) * pow(max(d.y, 0.0), 6.0) * (1.0 - night * 0.8), under);   // under the sea: deep blue, lighter straight up
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(4800, 32, 16), this.skyMat);
    this.dome.frustumCulled = false; this.dome.renderOrder = -10; scene.add(this.dome);

    // rain streaks: positions are generated in the vertex shader and wrap around the camera
    const N = 3200, seed = new Float32Array(N * 6), end = new Float32Array(N * 2), r = new RNG(3);
    for (let i = 0; i < N; i++) { const a = r.next(), b = r.next(), c = r.next(); seed.set([a, b, c, a, b, c], i * 6); end[i * 2] = 0; end[i * 2 + 1] = 1; }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3));
    rg.setAttribute('seed', new THREE.BufferAttribute(seed, 3)); rg.setAttribute('end', new THREE.BufferAttribute(end, 1));
    this.rainMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      uniforms: { cam: { value: new THREE.Vector3() }, time: { value: 0 }, amount: { value: 0 }, wind: { value: 0.15 } },
      vertexShader: `
        attribute vec3 seed; attribute float end; uniform vec3 cam; uniform float time, wind; varying float vA;
        void main(){
          vec3 p = seed * vec3(70.0, 44.0, 70.0);
          p.y = mod(p.y - time * (36.0 + seed.x * 12.0), 44.0);
          vec3 w = vec3(mod(p.x - cam.x, 70.0) - 35.0 + cam.x, p.y - 16.0 + cam.y, mod(p.z - cam.z, 70.0) - 35.0 + cam.z);
          w.y += end * 1.1; w.x += end * wind * 1.1;
          vA = 1.0 - end * 0.6;
          gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
        }`,
      fragmentShader: 'uniform float amount; varying float vA; void main(){ gl_FragColor = vec4(0.72, 0.82, 1.0, 0.32 * amount * vA); }',
    });
    this.rainMesh = new THREE.LineSegments(rg, this.rainMat); this.rainMesh.frustumCulled = false; this.rainMesh.visible = false; scene.add(this.rainMesh);
    this._top = new THREE.Color(); this._hor = new THREE.Color(); this._a = new THREE.Color(); this._b = new THREE.Color();
  }

  get hour() { return this.mins / 60; }
  get label() { return WX[this.weather].label; }
  get forecast() { return this.nextWx === this.weather ? `${WX[this.weather].label} holding` : `${WX[this.nextWx].label} in about ${Math.max(1, Math.round(this.wxTimer / 60))} h`; }
  setWeather(name, snap = false) {
    if (!WX[name]) return;
    const changed = name !== this.weather;
    this.weather = name; this.wxTimer = this.rng.range(150, 420); this.nextWx = this.rng.pick(NEXT[name]);
    if (snap) { const w = WX[name]; this.cloud = w.cloud; this.rain = w.rain; this.fog = w.fog; this.storm = w.storm; }
    if (changed && this.onWeather) this.onWeather(name);
  }
  // a lightning strike: at a point (a hero's or villain's lightning), or somewhere out in the storm.
  // The bolt shows when it is near enough to see; the thunder comes later the further away it is.
  strike(at = null, cam = null) {
    this.flash = 1; const c = cam || (G.camera && G.camera.position);
    let d = 120;
    if (!at && c) { const a = Math.random() * Math.PI * 2; d = 140 + Math.random() * 900; at = { x: c.x + Math.cos(a) * d, y: 0, z: c.z + Math.sin(a) * d }; if (G.colliders) at.y = G.colliders.groundAt(at.x, at.z, 900, 900, 0.5); }
    else if (at && c) d = Math.hypot(at.x - c.x, at.z - c.z);
    if (at && G.fx && d < 750) {
      const top = new THREE.Vector3(at.x + (Math.random() - 0.5) * 80, Math.max(at.y + 300, 420), at.z + (Math.random() - 0.5) * 80), bot = new THREE.Vector3(at.x, at.y, at.z), w = 0.9 + d / 300;
      G.fx.bolt(top, bot, '#f2f5ff', w, 0.34, 45, 14); G.fx.bolt(top, bot, '#9fc4ff', w * 2.2, 0.22, 45, 10);
      for (let k = 0; k < 2; k++) { const u = 0.25 + Math.random() * 0.4, from = top.clone().lerp(bot, u), to = from.clone().add(new THREE.Vector3((Math.random() - 0.5) * 140, -60 - Math.random() * 80, (Math.random() - 0.5) * 140)); G.fx.bolt(from, to, '#dfe8ff', w * 0.5, 0.26, 25, 5); }
    }
    if (this.onThunder) this.onThunder(d);
  }
  setTime(hour) { this.mins = ((hour * 60) % 1440 + 1440) % 1440; }

  update(dt, cam, focus, t) {
    // clock
    const dm = dt * this.timeScale;
    this.mins += dm;
    if (this.mins >= 1440) { this.mins -= 1440; this.day++; }
    // weather state machine
    this.wxTimer -= dm;
    if (this.wxTimer <= 0) this.setWeather(this.nextWx);
    const w = WX[this.weather], k = 0.12 * Math.max(1, this.timeScale * 0.5);
    this.cloud = damp(this.cloud, w.cloud, k, dt); this.rain = damp(this.rain, w.rain, k, dt);
    this.fog = damp(this.fog, w.fog, k, dt); this.storm = damp(this.storm, w.storm, k, dt);
    // wind: stronger in bad weather, direction drifts slowly
    const wsp = 0.6 + this.cloud * 1.6 + this.rain * 2.6 + this.storm * 5, wa = t * 0.01 + this.day;
    this.windX = Math.cos(wa) * wsp; this.windZ = Math.sin(wa) * wsp;
    this.wet = damp(this.wet, this.rain > 0.15 ? 1 : 0, this.rain > 0.15 ? 0.25 : 0.03, dt);

    // sun / moon
    const td = (this.mins - 360) / 840;                       // 0..1 across the day (06:00 - 20:00)
    const el = Math.sin(Math.PI * td) * 62;                   // degrees, negative at night
    const dl = smooth((el + 4) / 14), night = 1 - dl, twi = clamp(1 - Math.abs(el) / 14, 0, 1);
    this.daylight = dl; this.night = night;
    let dir;
    if (dl > 0.03) {
      const e = (Math.max(el, 3) * Math.PI) / 180;
      dir = this.sunDir.set(Math.cos(Math.PI * td) * Math.cos(e), Math.sin(e), 0.42 * Math.cos(e)).normalize();
      const warm = clamp(1 - el / 28, 0, 1);
      this.sun.color.setRGB(1, lerp(0.97, 0.62, warm), lerp(0.92, 0.36, warm));
      this.sun.intensity = 3.3 * dl * (1 - this.cloud * 0.78);
    } else {
      const tn = (((this.mins - 1200) % 1440) + 1440) % 1440 / 600, e = ((Math.max(Math.sin(Math.PI * tn) * 48, 8)) * Math.PI) / 180;
      dir = this.sunDir.set(-Math.cos(Math.PI * tn) * Math.cos(e), Math.sin(e), -0.3 * Math.cos(e)).normalize();
      this.sun.color.setRGB(0.62, 0.72, 1);
      this.sun.intensity = 0.5 * night * (1 - this.cloud * 0.6);
    }
    this.sun.target.position.copy(focus);
    this.sun.position.copy(focus).addScaledVector(dir, 800);

    // lightning
    if (this.storm > 0.5 && this.rng.chance(dt * (0.09 + this.storm * 0.05))) this.strike(null, cam);
    this.flash = Math.max(0, this.flash - dt * 2.6);
    const fl = this.flash * (0.5 + 0.5 * Math.sin(t * 60));

    // ambient light
    this.hemi.color.setRGB(lerp(0.3, 0.74, dl), lerp(0.27, 0.84, dl), lerp(0.58, 1, dl));
    this.hemi.groundColor.setRGB(lerp(0.16, 0.36, dl), lerp(0.12, 0.32, dl), lerp(0.22, 0.28, dl));
    this.hemi.intensity = lerp(1.15, 1.25, dl) * (1 - this.cloud * 0.25 * dl) + fl * 3;

    // sky colors
    const top = this._top.copy(SKY.nightTop).lerp(SKY.dayTop, dl), hor = this._hor.copy(SKY.nightHor).lerp(SKY.dayHor, dl);
    top.lerp(SKY.duskTop, twi * 0.7); hor.lerp(SKY.duskHor, twi * 0.85);
    this._a.copy(SKY.ocNightTop).lerp(SKY.ocDayTop, dl); this._b.copy(SKY.ocNightHor).lerp(SKY.ocDayHor, dl);
    top.lerp(this._a, this.cloud * 0.9); hor.lerp(this._b, this.cloud * 0.85);
    const u = this.skyMat.uniforms;
    u.top.value.copy(top); u.horizon.value.copy(hor); u.sunDir.value.copy(dir);
    u.sunCol.value.copy(this.sun.color).multiplyScalar(dl > 0.03 ? 1 : 0.5);
    u.night.value = night; u.cloud.value = this.cloud; u.time.value = t; u.flash.value = fl;
    this.dome.position.copy(cam);
    this.scene.fog.color.copy(hor).multiplyScalar(0.92);
    // the haze lies low: above a few hundred metres (the jet harness, Skyline Station) the air clears
    this.scene.fog.density = (0.0006 + this.cloud * 0.0004 + this.rain * 0.0011 + this.fog * 0.0058) / (1 + Math.max(0, cam.y - 150) / 900);

    // rain + wet streets
    this.rainMesh.visible = this.rain > 0.02 && this.indoor < 0.9;
    const ru = this.rainMat.uniforms; ru.cam.value.copy(cam); ru.time.value = t; ru.amount.value = this.rain * (1 - this.indoor) * (0.6 + 0.4 * dl + 0.3 * night);
    M.road.roughness = lerp(0.85, 0.22, this.wet); M.road.metalness = lerp(0.15, 0.65, this.wet);
    M.sidewalk.roughness = lerp(0.75, 0.35, this.wet);
    applyNight(night);
  }
}
