// Shared game context. Systems attach themselves here so modules can reach each other
// without circular imports. Filled in by main.js during boot.
export const G = {
  scene: null, camera: null, renderer: null,
  input: null, colliders: null,
  env: null,        // time of day + weather
  city: null,       // map data: pads, lamps, seats, nav graph, doors
  player: null, car: null, traffic: null, npcs: null, dog: null,
  ui: null, audio: null, interact: null,
  economy: null, jobs: null, events: null, food: null,
  save: null,
  paused: false,
  elapsed: 0,
};
