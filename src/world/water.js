// The look of the water: waves drawn into the sea, the canal and the lake (a sum of travelling
// waves bends the surface normal per pixel, so the light glints and ripples; calm on the canal
// and the lake, livelier out at sea, with a few whitecaps), and foam washing up and down the
// shore and round Beacon Isle.
import * as THREE from 'three';
import { makeCanvas, canvasTex } from './materials.js';
import { coastZ } from './metro/landuse.js';

const uTime = { value: 0 };
// The same travelling waves the sea's shading uses, as heights: boats and swimmers ride them.
const WAVES = [[0.3, 1.0, 31.0, 0.16, 0.9], [-0.7, 1.0, 13.7, 0.1, 1.3], [1.0, 0.35, 7.1, 0.05, 2.0], [-0.9, -0.5, 4.3, 0.03, 2.6]].map(([dx, dz, len, amp, sp]) => { const l = Math.hypot(dx, dz); return [dx / l, dz / l, 6.2832 / len, amp, sp]; });
export function waveHeight(x, z) {
  let h = 0; const t = uTime.value; for (const [dx, dz, k, amp, sp] of WAVES) h += amp * Math.sin((x * dx + z * dz) * k + t * sp);
  const open = Math.min(1, Math.max(0, (z - 1170) / 250)); return h * (0.18 + 0.82 * open * open * (3 - 2 * open));   // calm near the shore and on the canal, livelier out at sea
}
export function waterMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.32 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uTime; varying vec3 vWPos;
// a travelling wave: its height, and the slope it adds (x, z)
vec3 wave(vec2 p, vec2 d, float len, float amp, float speed) { float k = 6.2832 / len, ph = dot(p, d) * k + uTime * speed; return vec3(amp * sin(ph), amp * k * cos(ph) * d); }
vec3 waves(vec2 p) { return wave(p, normalize(vec2(0.3, 1.0)), 31.0, 0.16, 0.9) + wave(p, normalize(vec2(-0.7, 1.0)), 13.7, 0.1, 1.3) + wave(p, normalize(vec2(1.0, 0.35)), 7.1, 0.05, 2.0) + wave(p, normalize(vec2(-0.9, -0.5)), 4.3, 0.03, 2.6) + wave(p, normalize(vec2(0.45, -1.0)), 2.3, 0.015, 3.6) + wave(p, normalize(vec2(-0.2, 1.0)), 1.1, 0.006, 5.2); }
float seaLevel(vec2 p) { return smoothstep(1170.0, 1420.0, p.y); }   // open sea 1, sheltered water 0`)
      .replace('#include <color_fragment>', `#include <color_fragment>
vec3 W = waves(vWPos.xz); float open = seaLevel(vWPos.xz), calm = mix(0.18, 1.0, open);
float patchy = smoothstep(0.35, 0.8, sin(vWPos.x * 0.013 + uTime * 0.07) * sin(vWPos.z * 0.017 - uTime * 0.05));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.82, 0.9, 0.95), smoothstep(0.27, 0.34, W.x) * patchy * open * 0.5);   // a few whitecaps on the crests out at sea
diffuseColor.rgb *= 0.94 + W.x * 0.3 * calm;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
normal = normalize((viewMatrix * vec4(normalize(vec3(-W.y * calm, 1.0, -W.z * calm)), 0.0)).xyz);`);
  };
  return m;
}

// foam: a strip along the shore and a ring round the island, washing in and out
export function shoreFoam(group, isle) {
  const c = makeCanvas(256, 64), g = c.getContext('2d');
  g.clearRect(0, 0, 256, 64);
  // a bright edge where the wave runs out on the sand, broken lines of foam behind it
  const grd = g.createLinearGradient(0, 0, 0, 20); grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(0.35, 'rgba(255,255,255,0.95)'); grd.addColorStop(1, 'rgba(255,255,255,0.25)'); g.fillStyle = grd; g.fillRect(0, 0, 256, 20);
  for (let k = 0; k < 320; k++) { const x = Math.random() * 256, y = 8 + Math.pow(Math.random(), 1.4) * 56, w = 6 + Math.random() * 34; g.fillStyle = `rgba(255,255,255,${0.12 + (1 - y / 64) * 0.7})`; g.fillRect(x, y, w, 1 + Math.random() * 2.5); }
  const tex = canvasTex(c); tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, color: new THREE.Color(0xf2f8ff).multiplyScalar(1.25) });
  const pos = [], uv = [], idx = [];
  const strip = (pts) => { const n0 = pos.length / 3; pts.forEach(([ax, az, bx, bz, u]) => { pos.push(ax, 0.045, az, bx, 0.045, bz); uv.push(u, 1, u, 0); }); for (let k = 0; k < pts.length - 1; k++) { const a = n0 + k * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } };
  // along the coast, from 0.6 m up the sand to 6 m out; not across the canal mouth
  for (const [x0, x1] of [[-1610, -72], [-48, 1610]]) { const pts = []; for (let x = x0; x <= x1; x += 6) { const z = coastZ(x); pts.push([x, z - 1.2, x, z + 9, x / 24]); } strip(pts); }
  { const pts = []; for (let k = 0; k <= 64; k++) { const a = (k / 64) * Math.PI * 2; pts.push([isle.x + Math.cos(a) * (isle.r - 2.5), isle.z + Math.sin(a) * (isle.r - 2.5), isle.x + Math.cos(a) * (isle.r + 4), isle.z + Math.sin(a) * (isle.r + 4), k * 1.5]); } strip(pts); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeBoundingSphere();
  const m = new THREE.Mesh(geo, mat); m.renderOrder = 2; group.add(m);
  return {
    update(t) { uTime.value = t; tex.offset.x = t * 0.01; const wash = Math.sin(t * 0.55); m.position.z = wash * 1.1; tex.offset.y = -0.1 + wash * 0.08; mat.opacity = 0.65 + 0.3 * (0.5 + 0.5 * Math.sin(t * 0.55 + 1.2)); },
  };
}
