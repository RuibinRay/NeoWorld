// The Skyline Survey: Dr. Okafor (at Skyline Station) wants photographs of eight landmarks for the
// observatory's records. Photo mode (O) hides the interface; Enter or a click takes the picture.
// A picture counts when the landmark is near the middle of the frame, close enough, not hidden
// behind something, and (for some) at the right time: at night, or from under the sea.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { money } from '../ui/ui.js';

const PAY = 80, BONUS = 300;

export class Survey {
  constructor() {
    const A = G.districts.byId.aeroport, O = G.orbital, T = (G.metro.towers || [])[0], D = G.diving;
    this.targets = [
      { id: 'dam', name: 'Northgate Dam', hint: 'The whole dam, from the valley or the air', at: new THREE.Vector3(0, 120, -2300), max: 1500, slack: 120 },
      { id: 'wheel', name: 'The big wheel on Solara pier', hint: 'From the beach or the boardwalk', at: new THREE.Vector3(810, 26.8, 1404), max: 420, slack: 30 },
      { id: 'tether', name: 'The orbital lift', hint: 'The tether climbing into the sky; look up from the Aeroport', at: new THREE.Vector3(O.tx, 420, O.tz), pts: [60, 150, 400, 900].map((y) => new THREE.Vector3(O.tx, y, O.tz)), max: 2400, slack: 60 },
      { id: 'skyhaven', name: 'Skyhaven from below', hint: 'The floating district, from the ground', at: new THREE.Vector3(640, 440, -640), pts: [[0, 0], [150, 0], [-150, 0], [0, 150], [0, -150]].map(([dx, dz]) => new THREE.Vector3(640 + dx, 440, -640 + dz)), max: 1400, slack: 200, below: true },
      { id: 'tower', name: 'The Aeroport control tower', hint: 'The red light on the top', at: new THREE.Vector3(A.x + 150, 110, A.z - 95), max: 650, slack: 25 },
      { id: 'lighthouse', name: 'Beacon Isle lighthouse, lit', hint: 'After dark, from the shore or the ferry', at: new THREE.Vector3(300, 33.6, 1800), max: 900, slack: 20, night: true },
      { id: 'skybar', name: T ? `${T.barName}, lit up` : 'A rooftop bar, lit up', hint: 'After dark, from the street or another roof', at: T ? new THREE.Vector3(T.cx, T.top + 3, T.cz) : new THREE.Vector3(), pts: T ? [[-14, -14], [14, -14], [-14, 14], [14, 14], [0, 0]].map(([dx, dz]) => new THREE.Vector3(T.cx + dx, T.top + 1.5, T.cz + dz)) : [], max: 800, slack: 6, night: true },
      { id: 'wreck', name: 'The wreck off Solara Bay', hint: 'From under the sea, close to it', at: new THREE.Vector3(900, (D ? D.wreckY : -16) + 4, 1470), max: 60, slack: 20, under: true },
    ];
    // Dr. Okafor offers the survey when the story is not asking for her
    const o = G.story && G.story.spots.okafor;
    if (o) G.interact.add({ pos: { x: o.x, y: o.y, z: o.z }, r: 2.8, yTol: 2, prio: 0.2, label: 'Dr. Okafor: the skyline survey', enabled: () => !(G.story.wantsTalk && G.story.wantsTalk('okafor')) && !G.story.scene, use: () => this.menu() });
    // the shutter: Enter or a click while in photo mode
    const snap = () => { if (G.games && G.games.photo && G.started && !G.ui.menu) this.snap(); };
    addEventListener('keydown', (e) => { if (e.code === 'Enter' && !e.repeat) snap(); });
    G.renderer.domElement.addEventListener('pointerdown', (e) => { if (e.button === 0) snap(); });
    const fl = (this.flashEl = document.createElement('div')); fl.style.cssText = 'position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:6;transition:opacity .35s'; document.body.appendChild(fl);
    this.v = new THREE.Vector3(); this.d = new THREE.Vector3();
  }
  get st() { const s = G.state; if (!s.survey) s.survey = { on: false, got: {} }; return s.survey; }
  menu() {
    const st = this.st, n = Object.keys(st.got).length;
    G.ui.openMenu({ title: 'The skyline survey', who: 'Dr. Ines Okafor · Skyline Station', wide: true,
      html: `<p>${st.on ? `${n} of ${this.targets.length} done.` : '"The observatory\'s records are a century out of date. Bring me photographs of these, and I will pay for each one."'} Press <b>O</b> for photo mode, then <b>Enter</b> or click to take a picture. ${money(PAY)} a photograph, and ${money(BONUS)} more for the full set.</p>` +
        this.targets.map((t) => `<p style="margin:0 0 6px;${st.got[t.id] ? 'color:var(--ok)' : ''}">${st.got[t.id] ? '✓' : '○'} <b>${t.name}</b> <span style="color:var(--dim)">· ${t.hint}</span></p>`).join(''),
      options: [st.on ? { label: 'Close', onPick: () => {} } : { label: 'Take on the survey', onPick: () => { st.on = true; G.ui.toast('Skyline survey: photograph the eight landmarks. O for photo mode, Enter or click to take a picture.', 'good'); G.save.write(true); } }, ...(st.on ? [] : [{ label: 'Not now', onPick: () => {} }])] });
  }
  // what a picture taken now would show
  inFrame(t) {
    const cam = G.camera;
    if (t.night && G.env.night < 0.5) return false;
    if (t.under && !(G.diving && G.diving.under)) return false;
    if (t.below && cam.position.y > t.at.y - 60) return false;
    // any one of its points in the frame and in plain view will do (the top of a tether, a corner of a roof)
    return (t.pts || [t.at]).some((pt) => {
      const v = this.v.copy(pt), dist = v.distanceTo(cam.position); if (dist > t.max) return false;
      v.project(cam); if (v.z > 1 || Math.abs(v.x) > 0.8 || Math.abs(v.y) > 0.8) return false;
      const d = this.d.copy(pt).sub(cam.position).normalize(), hit = G.colliders.raycast(cam.position.x, cam.position.y, cam.position.z, d.x, d.y, d.z, dist);
      return hit >= dist - t.slack;
    });
  }
  snap() {
    this.flashEl.style.transition = 'none'; this.flashEl.style.opacity = 0.85; requestAnimationFrame(() => { this.flashEl.style.transition = 'opacity .35s'; this.flashEl.style.opacity = 0; });
    if (G.audio) { G.audio.burst(0.05, 0.08, 3200, 'highpass'); setTimeout(() => G.audio && G.audio.burst(0.04, 0.05, 2400, 'highpass'), 70); }
    const st = this.st, hit = this.targets.find((t) => this.inFrame(t));
    G.state.done.photos = (G.state.done.photos || 0) + 1;
    if (G.gallery) G.gallery.capture(hit ? hit.name : null);   // kept in the phone's Photos app
    if (!hit) return this.say('Photo saved to your phone.', 'info');
    if (!st.on) return this.say(`Photo: ${hit.name}. Dr. Okafor at Skyline Station would pay for that.`, 'info');
    if (st.got[hit.id]) return this.say(`Photo: ${hit.name} (already in the survey).`, 'info');
    st.got[hit.id] = true; G.economy.earn(PAY, `survey photo: ${hit.name}`);
    const n = Object.keys(st.got).length;
    if (n >= this.targets.length) { G.economy.earn(BONUS, 'the full skyline survey'); G.state.done.survey = true; this.say(`Survey complete: all ${n} landmarks. ${money(PAY + BONUS)}.`, 'good'); }
    else this.say(`Survey photo: ${hit.name} (${n} of ${this.targets.length}). ${money(PAY)}.`, 'good');
    G.save.write(true);
  }
  // in photo mode the interface is hidden, so say it briefly over the picture
  say(msg, kind) {
    const was = G.ui.root.style.opacity; G.ui.root.style.opacity = 1; G.ui.toast(msg, kind);
    clearTimeout(this.hideT); this.hideT = setTimeout(() => { if (G.games.photo) G.ui.root.style.opacity = 0; }, 2600); void was;
  }
}
