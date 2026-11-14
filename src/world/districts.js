// The six outer districts of Neo Central. Built once at boot from the kit; each returns the
// spots that gameplay systems need (pads, kiosks, counters, exhibits...).
import * as THREE from 'three';
import { SITES } from '../data/sites.js';
import { makeKit } from './districtkit.js';
import { aeroport, bioeden, skyhaven } from './districtsA.js';
import { neonDistrict, oldEarth, nexus } from './districtsB.js';

export function buildDistricts(scene, col, city, nav) {
  const list = [], byId = {}, updates = [];
  const add = (site, things, kits) => {
    const d = { ...site, things, pad: things.pad, kiosk: things.kiosk, nodes: kits[0].nodes, low: kits[1] ? kits[1].nodes : null, gate: (kits.find((k) => k.gate) || {}).gate || null, groups: [...new Set(kits.map((k) => k.group))] };
    for (const k of kits) updates.push(...k.updates);
    list.push(d); byId[site.id] = d;
  };
  let k = makeKit(scene, col, city, nav, SITES.aeroport); add(SITES.aeroport, aeroport(k), [k]);
  k = makeKit(scene, col, city, nav, SITES.bioeden); add(SITES.bioeden, bioeden(k), [k]);
  k = makeKit(scene, col, city, nav, SITES.skyhaven); add(SITES.skyhaven, skyhaven(k), [k]);
  const kU = makeKit(scene, col, city, nav, SITES.neon), kL = makeKit(scene, col, city, nav, { id: 'neonlow', x: SITES.neon.x, z: SITES.neon.z, y: 0 }, kU.group);
  add(SITES.neon, neonDistrict(kU, kL), [kU, kL]);
  k = makeKit(scene, col, city, nav, SITES.oldearth); add(SITES.oldearth, oldEarth(k), [k]);
  k = makeKit(scene, col, city, nav, SITES.nexus); add(SITES.nexus, nexus(k), [k]);
  // connect each district shop's door to the nearest walkway, and list the shops per zone for the locals
  const zoneShops = {};
  for (const st of city.stores) if (st.nav) { const n = nav.nearest(st.nav.x, st.nav.z, (q) => q.zone === st.nav.zone && q.street); if (n) { nav.link(st.nav.door, n.id); (zoneShops[st.nav.zone] = zoneShops[st.nav.zone] || []).push(st.nav.inside); } }
  const lake = byId.bioeden.things.lake;
  // Small separate objects (signs, moving parts, props) are only worth drawing from close by: they go
  // into a detail group per district that is hidden when the camera is far away. Big pieces always show.
  const details = [], box = new THREE.Box3(), size = new THREE.Vector3();
  for (const d of list) for (const g of d.groups) {
    const det = new THREE.Group(); g.updateMatrixWorld(true);
    for (const o of [...g.children]) { if (o.isLight) continue; box.setFromObject(o); if (box.isEmpty()) continue; box.getSize(size); if (Math.max(size.x, size.y, size.z) < 45) det.add(o); }
    g.add(det); details.push({ det, x: d.x, y: d.y || 0, z: d.z });
  }
  // Every district's shadow casters, so a district far away can leave the sun's shadow map: with the sun
  // or moon low, the shadow volume reaches 800 m out, but a shadow cast from that far lands in the fog.
  const casters = list.map((d) => { const ms = []; for (const g of d.groups) g.traverse((o) => { if (o.isMesh && o.castShadow) ms.push(o); }); return { ms, x: d.x, z: d.z, on: true }; });
  return {
    list, byId, zoneShops, casters,
    update(dt, t) { for (const u of updates) u(dt, t); },
    cull(cam) {
      for (const e of details) e.det.visible = (cam.x - e.x) ** 2 + (cam.y - e.y) ** 2 + (cam.z - e.z) ** 2 < 470 * 470;
      for (const c of casters) { const d2 = (cam.x - c.x) ** 2 + (cam.z - c.z) ** 2, on = d2 < (c.on ? 600 : 560) ** 2; if (on !== c.on) { c.on = on; for (const m of c.ms) m.castShadow = on; } }
    },
    // which district (if any) a position is in
    at(p) { for (const d of list) if (Math.abs(p.x - d.x) < 190 && Math.abs(p.z - d.z) < 190) return d; return null; },
    // standing in water? The Bio-Eden lake (its island is dry) or a pool.
    pools: [byId.skyhaven.things.pool],
    sea: null,   // set by the metro: the sea and the canal
    waterAt(x, z, y = 0) {
      if (this.sea && y < (this.level ? this.level(x, z) : 0.02) + 0.05 && this.sea(x, z)) return true;
      if (y < 0.2 && (x - lake.x) ** 2 + (z - lake.z) ** 2 < lake.r * lake.r && (x - lake.x) ** 2 + (z - lake.z) ** 2 > 22) return true;
      for (const p of this.pools) if (x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1 && y > p.y - 0.5 && y < p.y + 0.6) return true;
      return false;
    },
  };
}
