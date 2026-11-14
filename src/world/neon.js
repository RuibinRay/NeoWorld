// Futuristic dressing for the Midtown skyline, each kind one draw call for the whole city:
// neon strips up tower corners and round their roofs (brighter at night), holographic adverts on
// tower faces (a new advert every few seconds: mostly the advert pictures from art.js, now and then
// an animated pattern, all with scanlines, a sweep and the odd flicker), and holo rings turning over some of the tallest roofs.
import * as THREE from 'three';
import { adSheet, ADS, COLS, ROWS, CELL_ASPECT } from './art.js';

const PAL = ['#59e0ff', '#ff4fd8', '#ffb347', '#7dff9c', '#a78bff', '#ff5a6e', '#3fb8ff'];
const hash = (x, z, k = 0) => { const s = Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453; return s - Math.floor(s); };

// Every tower volume in the city (Midtown, Meridian's ring of mid-rises, each tier of the megatowers).
export function buildNeon(scene, colliders) {
  const towers = [];
  for (const b of colliders.all) if (b.tag === 'tower' && b.maxY - b.minY > 12 && b.maxY > 30 && b.maxX - b.minX > 8 && b.maxZ - b.minZ > 8) towers.push([b.minX, b.maxX, b.minZ, b.maxZ, b.minY, b.maxY]);
  const group = new THREE.Group(); scene.add(group);

  // ---- neon strips: only the faces that look outward, written straight into arrays ----------------
  const pos = [], col = [], c = new THREE.Color();
  const quad = (a, b, cc, d) => { pos.push(...a, ...b, ...cc, ...a, ...cc, ...d); for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b); };
  let lit = 0;
  for (const [x0, x1, z0, z1, y0, y1] of towers) {
    if (hash(x0, z0) > 0.65) continue;
    lit++; c.set(PAL[Math.floor(hash(x1, z1, 1) * PAL.length)]);
    const t = 0.32, o = 0.06, ya = y0 + 3, yb = y1 - 0.1;
    // two opposite corners: the faces toward -x/-z at (x0, z0) and +x/+z at (x1, z1)
    quad([x0 - o, ya, z0 - o + t], [x0 - o, ya, z0 - o], [x0 - o, yb, z0 - o], [x0 - o, yb, z0 - o + t]);
    quad([x0 - o, ya, z0 - o], [x0 - o + t, ya, z0 - o], [x0 - o + t, yb, z0 - o], [x0 - o, yb, z0 - o]);
    quad([x1 + o, ya, z1 + o - t], [x1 + o, ya, z1 + o], [x1 + o, yb, z1 + o], [x1 + o, yb, z1 + o - t]);
    quad([x1 + o, ya, z1 + o], [x1 + o - t, ya, z1 + o], [x1 + o - t, yb, z1 + o], [x1 + o, yb, z1 + o]);
    // a rim round the roof
    const r0 = y1 - 0.75, r1 = y1 - 0.45;
    quad([x0 - o, r0, z0 - o], [x1 + o, r0, z0 - o], [x1 + o, r1, z0 - o], [x0 - o, r1, z0 - o]);
    quad([x1 + o, r0, z1 + o], [x0 - o, r0, z1 + o], [x0 - o, r1, z1 + o], [x1 + o, r1, z1 + o]);
    quad([x0 - o, r0, z1 + o], [x0 - o, r0, z0 - o], [x0 - o, r1, z0 - o], [x0 - o, r1, z1 + o]);
    quad([x1 + o, r0, z0 - o], [x1 + o, r0, z1 + o], [x1 + o, r1, z1 + o], [x1 + o, r1, z0 - o]);
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); sg.computeBoundingSphere();
  const stripMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const strips = new THREE.Mesh(sg, stripMat); strips.matrixAutoUpdate = false; group.add(strips);

  // ---- holographic adverts -------------------------------------------------------------------------
  const ads = [];
  for (const [x0, x1, z0, z1, y0, y1] of towers) {
    const h = y1 - y0; if (h < 30 || hash(x0, z1, 2) > 0.62) continue;
    const side = Math.floor(hash(z0, x1, 3) * 4), along = side < 2 ? x1 - x0 : z1 - z0, w = Math.min(along * 0.62, along > 60 ? 36 : 16), hh = Math.min(w * 1.5, h * 0.42), cy = y1 - hh / 2 - Math.min(12, h * 0.06);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const at = [[cx, z0 - 0.8, Math.PI], [cx, z1 + 0.8, 0], [x0 - 0.8, cz, -Math.PI / 2], [x1 + 0.8, cz, Math.PI / 2]][side];
    ads.push({ x: at[0], z: at[1], yaw: at[2], w, h: hh, y: cy, c: PAL[Math.floor(hash(x1, z0, 4) * PAL.length)], s: hash(x0, y1, 5) });
  }
  const adMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide, fog: true,   // they face out from the tower: from behind there is only wall
    uniforms: { ...THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { time: { value: 0 }, night: { value: 0 }, dark: { value: 0 } }]), adMap: { value: adSheet().tex } },
    defines: { N_ADS: ADS.length.toFixed(1), COLS: COLS.toFixed(1), ROWS: ROWS.toFixed(1), CELL_A: CELL_ASPECT.toFixed(4) },
    vertexShader: `
      #include <fog_pars_vertex>
      attribute float seed, aspect; varying vec2 vUv; varying vec3 vCol; varying float vSeed, vAspect;
      void main(){
        vUv = uv; vSeed = seed; vAspect = aspect;
        #ifdef USE_INSTANCING_COLOR
          vCol = instanceColor;
        #else
          vCol = vec3(0.35, 0.88, 1.0);
        #endif
        vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <fog_pars_fragment>
      uniform float time, night, dark; uniform sampler2D adMap; varying vec2 vUv; varying vec3 vCol; varying float vSeed, vAspect;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        vec2 uv = vUv; float t = time + vSeed * 40.0, slide = floor(t / 4.5), kind = h(vec2(slide, vSeed));
        vec2 e = min(uv, 1.0 - uv); float frame = step(min(e.x * 1.5, e.y), 0.02);
        vec2 g = floor(uv * vec2(6.0, 14.0)); float rows = step(0.5, h(g + slide * 3.1 + vSeed * 9.0)) * step(0.3, fract(uv.y * 14.0)) * step(uv.y, 0.42) * step(0.08, uv.x) * step(uv.x, 0.92);
        vec2 c = (uv - vec2(0.5, 0.7)) * vec2(1.0, 1.5);
        float ring = smoothstep(0.035, 0.0, abs(length(c) - 0.24 - 0.02 * sin(t * 2.0))), disc = step(length(c), 0.11 + 0.02 * sin(t * 3.0));
        float bars = step(abs(c.x), 0.32) * step(abs(c.y), 0.16) * step(0.45, fract(uv.x * 7.0 - t * 0.6));
        float tri = step(abs(c.x) * 1.4 + c.y, 0.2) * step(-0.2, c.y);
        float shape = kind < 0.4 ? ring + disc * 0.7 : kind < 0.75 ? bars : tri + ring * 0.5;
        float scan = 0.72 + 0.28 * sin(uv.y * 240.0 - t * 7.0), sweep = smoothstep(0.05, 0.0, abs(fract(uv.y - t * 0.12) - 0.5));
        float flick = 1.0 - 0.6 * step(0.965, h(vec2(floor(t * 14.0), vSeed)));
        float a = (frame * 1.3 + rows * 0.75 + shape * 0.95 + 0.07) * scan * flick + sweep * 0.3;
        vec3 col = mix(vCol, vec3(1.0), shape * 0.2 + frame * 0.25) * a * (0.55 + night * 0.9);
        // three slides in four show an advert picture: cropped to the panel (keeping the name strip),
        // torn sideways for a moment as it comes in
        float pick = h(vec2(slide, vSeed) + 7.31);
        if (pick < 0.75) {
          float k = min(floor(pick / 0.75 * N_ADS), N_ADS - 1.0), since = mod(t, 4.5);
          vec2 q = uv;
          q.x += (h(vec2(floor(q.y * 36.0), floor(t * 24.0))) - 0.5) * 0.14 * max(0.0, 1.0 - since / 0.35);
          if (vAspect > CELL_A) { float f = CELL_A / vAspect; q.y = (1.0 - f) * 0.25 + q.y * f; } else { float f = vAspect / CELL_A; q.x = (1.0 - f) * 0.5 + q.x * f; }
          q = clamp(q, 0.006, 0.994);
          float cx = mod(k, COLS), cy = floor(k / COLS);
          vec3 img = texture2D(adMap, vec2((cx + q.x) / COLS, (ROWS - 1.0 - cy + q.y) / ROWS)).rgb;
          col = (img * (0.8 + 0.2 * scan) + vCol * (frame * 0.9 + sweep * 0.12)) * flick * (0.5 + night * 0.4);
        }
        // in a blackout the adverts drop to a red standby frame that stutters
        col = mix(col, vec3(1.0, 0.08, 0.06) * frame * 0.9 * step(0.35, h(vec2(floor(t * 6.0), vSeed))), dark);
        #ifdef USE_FOG
          #ifdef FOG_EXP2
            col *= exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
          #else
            col *= 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
          #endif
        #endif
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const adMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), adMat, Math.max(1, ads.length));
  const seeds = new Float32Array(Math.max(1, ads.length)), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  const aspects = new Float32Array(Math.max(1, ads.length));
  ads.forEach((a, i) => { e.set(0, a.yaw, 0); q.setFromEuler(e); m.compose(v.set(a.x, a.y, a.z), q, s.set(a.w, a.h, 1)); adMesh.setMatrixAt(i, m); adMesh.setColorAt(i, c.set(a.c)); seeds[i] = a.s; aspects[i] = a.w / a.h; });
  adMesh.count = ads.length; adMesh.geometry.setAttribute('seed', new THREE.InstancedBufferAttribute(seeds, 1)); adMesh.geometry.setAttribute('aspect', new THREE.InstancedBufferAttribute(aspects, 1)); adMesh.computeBoundingSphere(); group.add(adMesh);

  // ---- holo rings turning over the tallest roofs ---------------------------------------------------
  const rings = [];
  for (const [x0, x1, z0, z1, y0, y1] of towers) {
    if (y1 < 70 || hash(z1, x0, 6) > 0.22) continue;
    const r = Math.max(3, Math.min(8, Math.min(x1 - x0, z1 - z0) * 0.32));
    rings.push({ x: (x0 + x1) / 2, y: y1 + r + 2.5, z: (z0 + z1) / 2, r, c: PAL[Math.floor(hash(x0, z0, 7) * PAL.length)], sp: 0.4 + hash(x1, z1, 8) * 0.8 });
  }
  const ringMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const ringMesh = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.05, 4, 40), ringMat, Math.max(1, rings.length * 2));
  rings.forEach((g, i) => { ringMesh.setColorAt(i * 2, c.set(g.c)); ringMesh.setColorAt(i * 2 + 1, c.set(g.c).lerp(new THREE.Color('#ffffff'), 0.4)); });
  ringMesh.count = rings.length * 2; ringMesh.frustumCulled = false; group.add(ringMesh);

  return {
    group, ads, stats: { towers: towers.length, strips: lit, ads: ads.length, rings: rings.length },
    update(dt, t, night, cam, dark = 0) {
      stripMat.color.setScalar((0.45 + night * 1.25) * (1 - dark * 0.92));
      adMat.uniforms.time.value = t; adMat.uniforms.night.value = night; adMat.uniforms.dark.value = dark; ringMesh.visible = dark < 0.5;
      // each site: an upright ring spinning like a coin, and a halo under it that rocks gently
      for (let i = 0; i < rings.length; i++) {
        const g = rings[i], y = g.y + Math.sin(t * 0.8 + i) * 0.4;
        e.set(0, t * g.sp, 0); q.setFromEuler(e); m.compose(v.set(g.x, y, g.z), q, s.set(g.r, g.r, g.r)); ringMesh.setMatrixAt(i * 2, m);
        e.set(Math.PI / 2 + 0.22 * Math.sin(t * 0.6 + i), 0, 0); q.setFromEuler(e); m.compose(v.set(g.x, y - g.r * 0.2, g.z), q, s.set(g.r * 1.25, g.r * 1.25, g.r * 1.25)); ringMesh.setMatrixAt(i * 2 + 1, m);
      }
      ringMesh.instanceMatrix.needsUpdate = true;
    },
  };
}
