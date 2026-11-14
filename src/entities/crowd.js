// Mid-distance residents are drawn as instanced impostors: eight shared meshes for the whole
// crowd (torso, head, hair or hat, two legs, two arms, a soft ground shadow) posed per person.
// Draw calls stay constant however many people are on the street; the detailed skinned rig is
// only used close to the player. Shapes and colors follow the close-up rig so the swap is quiet.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { TAU } from '../core/util.js';

const MAX = 420;
export class Crowd {
  constructor() {
    const mat = () => new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0.02 });
    const torso = new THREE.CylinderGeometry(0.2, 0.165, 0.6, 10); torso.scale(1, 1, 0.58); torso.translate(0, 0.33, 0);   // pivot at the hips
    const leg = new THREE.CapsuleGeometry(0.066, 0.78, 2, 6); leg.translate(0, -0.455, 0);                                 // pivot at the hip joint
    const arm = new THREE.CapsuleGeometry(0.044, 0.5, 2, 6); arm.translate(0, -0.29, 0);                                   // pivot at the shoulder
    const hair = new THREE.SphereGeometry(0.136, 8, 5, 0, TAU, 0, Math.PI * 0.55);
    const blob = new THREE.CircleGeometry(0.44, 12); blob.rotateX(-Math.PI / 2);
    const im = (g, m = mat()) => { const o = new THREE.InstancedMesh(g, m, MAX); o.count = 0; o.frustumCulled = false; o.castShadow = false; G.scene.add(o); return o; };
    this.torso = im(torso); this.head = im(new THREE.SphereGeometry(0.125, 8, 6)); this.hair = im(hair); this.legL = im(leg); this.legR = im(leg); this.armL = im(arm); this.armR = im(arm);
    this.blob = im(blob, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.26, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    this.blob.renderOrder = 1;
    this.all = [this.torso, this.head, this.hair, this.legL, this.legR, this.armL, this.armR];
    this.n = 0; this.nb = 0; this.base = new THREE.Matrix4(); this.m = new THREE.Matrix4(); this.p = new THREE.Matrix4();
    this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3(); this.up = new THREE.Vector3(0, 1, 0);
    this.black = new THREE.Color(0, 0, 0);
  }
  begin() { this.n = 0; this.nb = 0; }
  // a soft ground shadow on its own (used under detailed rigs when sun shadows are switched off)
  shade(pos, scale) {
    if (this.nb >= MAX) return;
    this.v.set(pos.x, pos.y + 0.03, pos.z); this.s.set(scale, 1, scale); this.q.identity(); this.m.compose(this.v, this.q, this.s);
    this.blob.setMatrixAt(this.nb, this.m); this.blob.setColorAt(this.nb++, this.black);
  }
  part(mesh, i, x, y, z, rx, rz, color, sx = 1, sy = 1, sz = 1) {
    this.e.set(rx, 0, rz); this.q.setFromEuler(this.e); this.v.set(x, y, z); this.s.set(sx, sy, sz);
    this.p.compose(this.v, this.q, this.s); this.m.multiplyMatrices(this.base, this.p);
    mesh.setMatrixAt(i, this.m); mesh.setColorAt(i, color);
  }
  // colors: { top, bottom, skin, arm, hair (or null) } as THREE.Color; w = build (shoulder width)
  add(pos, yaw, scale, colors, anim, phase, w = 1) {
    if (this.n >= MAX) return;
    const i = this.n++;
    let hips = 0.93, leg = 0, swing = 0, armX = 0, armZ = 0.07, lean = 0;
    if (anim === 'walk') { swing = Math.sin(phase) * 0.5; armX = swing * 0.8; hips += Math.cos(phase * 2) * 0.012; }
    else if (anim === 'jog' || anim === 'run') { swing = Math.sin(phase) * 0.85; armX = swing * 0.8; lean = 0.16; hips += Math.cos(phase * 2) * 0.025; }
    else if (anim === 'sit' || anim === 'eat' || anim === 'faint') { hips = anim === 'faint' ? 0.34 : 0.56; leg = -1.45; armX = -0.4; }
    else if (anim === 'taichi') { armZ = 1.5 + Math.sin(phase * 2) * 0.4; swing = Math.sin(phase * 2) * 0.2; hips += Math.abs(Math.sin(phase * 2)) * 0.04; }
    else if (anim === 'dance') { const b = Math.abs(Math.sin(phase * 2)); armX = -0.5 - b * 1.6; armZ = 0.25 + Math.sin(phase) * 0.35; swing = Math.sin(phase * 2) * 0.12; hips += b * 0.06; lean = -0.05 + b * 0.08; }   // bouncing, arms pumping up
    else if (anim === 'talk' || anim === 'wave') armX = -0.6;
    else if (anim === 'tend' || anim === 'work') { lean = 0.45; armX = -1.0; }
    this.q.setFromAxisAngle(this.up, yaw); this.s.set(scale, scale, scale); this.base.compose(pos, this.q, this.s);
    const ly = Math.cos(lean), lz = Math.sin(lean);                 // where the shoulders and head end up when leaning
    this.part(this.torso, i, 0, hips, 0, lean, 0, colors.top, w);
    this.part(this.head, i, 0, hips + 0.8 * ly, 0.8 * lz, lean, 0, colors.skin);
    if (colors.hair) this.part(this.hair, i, 0, hips + 0.81 * ly, 0.81 * lz - 0.008, lean, 0, colors.hair); else this.part(this.hair, i, 0, 0, 0, 0, 0, this.black, 0, 0, 0);
    this.part(this.legL, i, 0.095 * w, hips, 0, leg - swing, 0, colors.bottom);
    this.part(this.legR, i, -0.095 * w, hips, 0, leg + swing, 0, colors.bottom);
    this.part(this.armL, i, 0.2 * w + 0.05, hips + 0.58 * ly, 0.58 * lz, armX, armZ, colors.arm || colors.top);
    this.part(this.armR, i, -0.2 * w - 0.05, hips + 0.58 * ly, 0.58 * lz, -armX, -armZ, colors.arm || colors.top);
    this.shade(pos, scale);
  }
  end() {
    for (const m of this.all) { m.count = this.n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    const b = this.blob; b.count = this.nb; b.instanceMatrix.needsUpdate = true; if (b.instanceColor) b.instanceColor.needsUpdate = true;
  }
}
