// Ladders. World builders draw them into the merged ground mesh with drawLadder() and list them
// here; the Climbing system turns each into two interactions (bottom and top). The climbing itself
// (pulling up onto ledges, vaulting low walls, moving on a ladder) is in the player controller.
import { G } from '../core/game.js';

export const LADDERS = [];
// (x, z): where the ladder meets the wall at its foot; yaw: the way you face while climbing (into the wall).
export function drawLadder(GB, x, z, y0, y1, yaw, rail = '#c9a227') {
  const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw), cx = x - fx * 0.14, cz = z - fz * 0.14, h = y1 - y0 + 1.0;
  for (const s of [-1, 1]) GB.box('S', rail, 0.07, h, 0.07, cx + rx * s * 0.27, y0 + h / 2, cz + rz * s * 0.27, yaw);
  for (let y = y0 + 0.3; y < y1 + 0.05; y += 0.3) GB.box('S', '#aeb6c2', 0.5, 0.045, 0.045, cx, y, cz, yaw);
  const L = { x, z, y0, y1, yaw }; LADDERS.push(L); return L;
}

export class Climbing {
  constructor() {
    for (const L of LADDERS) {
      const fx = Math.sin(L.yaw), fz = Math.cos(L.yaw);
      G.interact.add({ pos: { x: L.x - fx * 0.7, y: L.y0, z: L.z - fz * 0.7 }, r: 1.4, yTol: 1.2, prio: 0.3, label: 'Climb the ladder', use: () => G.player.grabLadder(L, false) });
      G.interact.add({ pos: { x: L.x + fx * 0.6, y: L.y1, z: L.z + fz * 0.6 }, r: 1.2, yTol: 1.2, prio: 0.3, label: 'Climb down the ladder', use: () => G.player.grabLadder(L, true) });
    }
  }
  // every ledge you pull yourself onto counts toward a milestone
  count() { const d = G.state.done; d.climbs = (d.climbs || 0) + 1; if (d.climbs === 1) G.ui.toast('Climbing: Space in front of a ledge up to about 2.3 m pulls you up, or vaults a low wall. Jump at a higher ledge to grab it.', 'info'); }
}
