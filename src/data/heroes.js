// Hero Mode: five original heroes and the villain they face. Looks are humanoid rig options
// (entities/rigs.js) plus the gear systems/heroes.js adds on top; the powers live there too.
// keys: left click / Z light attack, right click / X heavy attack, 1 2 3 powers, R ultimate (when the meter is full)

export const HEROES = {
  strand: {
    alt: { top: '#3a1d2b', bottom: '#3a1d2b', accent: '#ff7ad9' },
    name: 'Strand', title: 'web-slinging acrobat', color: '#3fe0c5', hp: 120, speed: 1.3, jump: 10.5,
    blurb: 'Swings between towers on lines, runs up walls, and ties villains up.',
    look: { kind: 'human', skin: '#c68d6b', hair: '#16171c', hairStyle: 4, top: '#1d2a33', bottom: '#1d2a33', accent: '#3fe0c5', outfit: 'plain', sleeves: 'long', legs: 'trousers', shoe: '#0f1418', height: 1.76, build: 0.95, shape: 0.3, boots: true },
    moves: [
      ['Light', 'Punch, punch, kick'], ['Heavy', 'Yank: pulls the nearest enemy in front of you into a slam'],
      ['1 Line', 'Pull an enemy to you, or zip to the wall you aim at'], ['2 Snare', 'A sticky ball that ties up everyone it splashes'],
      ['3 Danger sense', 'For 6 s every attack misses you'], ['R Line storm', 'Lines to every villain within 30 m: tied up and pulled together'],
      ['Space in the air', 'Hold to swing from a line; let go to fly on'], ['Space at a wall', 'Run up it; Space again to jump off'],
    ],
  },
  forge: {
    alt: { shell: '#d8dde4', top: '#2f5d8a', accent: '#ffd34d' },
    name: 'Forge', title: 'armoured inventor', color: '#ff9a3c', hp: 180, speed: 1.0, jump: 8.5,
    blurb: 'A suit of flying armour with palm blasters, missiles and a chest beam.',
    look: { kind: 'android', shell: '#3a4048', top: '#b8652a', bottom: '#2b3038', accent: '#59e0ff', headType: 0, height: 1.85, build: 1.15, girth: 1.08 },
    moves: [
      ['Light', 'Armoured punches; in the air, palm shots'], ['Heavy', 'Charged palm blast'],
      ['1 Missiles', 'Six missiles that find the nearest villains'], ['2 Chest beam', 'A beam from the core for 2 s'],
      ['3 Pulse shield', 'A shockwave, then 6 s of a shield that stops most damage'], ['R Overload', 'The whole suit discharges: a blast 20 m wide'],
      ['Space in the air', 'Fly: WASD, Space up, C down, Shift for speed; C on the ground to land'],
    ],
  },
  raiko: {
    alt: { top: '#e8e4da', shirt: '#2b2f45', accent: '#59e0ff' },
    name: 'Raiko', title: 'lightning swordsman', color: '#a78bff', hp: 140, speed: 1.35, jump: 9.5,
    blurb: 'A sword charged with lightning, fire from the lungs, and a guardian of light.',
    look: { kind: 'human', skin: '#e0ac7e', hair: '#1b1d26', hairStyle: 13, top: '#2b2f45', shirt: '#c9ced8', bottom: '#1a1c26', accent: '#a78bff', outfit: 'coat', sleeves: 'long', legs: 'trousers', height: 1.78, build: 0.95, shape: 0.35, boots: true, eye: '#2b1c14' },
    moves: [
      ['Light', 'Sword cuts'], ['Heavy', 'Lightning thrust'],
      ['1 Thunder dash', 'A 14 m dash through everything in the way'], ['2 Fire breath', 'A cone of fire for 1.6 s'],
      ['3 Swap', 'Trade places with the enemy you aim at, or blink to the spot'], ['R Storm guardian', '12 s inside a giant guardian of light: huge sweeps, lightning arrows'],
    ],
  },
  sable: {
    alt: { vest: '#2f5d4a', top: '#1c2028', accent: '#7dff9c' },
    name: 'Sable', title: 'the copy fighter', color: '#ff5a6e', hp: 130, speed: 1.3, jump: 9,
    blurb: 'Reads any move used against him and uses it back, with a pack of hounds.',
    look: { kind: 'human', skin: '#f1c9a5', hair: '#8a3b2a', hairStyle: 10, top: '#202430', vest: '#3a3f4a', bottom: '#20232c', accent: '#ff5a6e', outfit: 'vest', sleeves: 'long', legs: 'trousers', height: 1.81, build: 0.95, shape: 0.3, boots: true, eye: '#3b2a1e' },
    moves: [
      ['Light', 'Short-blade cuts'], ['Heavy', 'Spinning kick'],
      ['1 Lightning palm', 'Charge, then a dash that hits one enemy very hard'], ['2 Hound pack', 'Four hounds run down the nearest villains and pin them'],
      ['3 Warp', 'A vortex swallows the enemy you aim at for a while'], ['R Copy', 'Uses the last villain move you saw, stronger'],
    ],
  },
  rook: {
    alt: { top: '#2b4a7a', bottom: '#d8c9a8', accent: '#ffd34d' },
    name: 'Rook', title: 'rubber brawler, five forms', color: '#f08a24', hp: 160, speed: 1.25, jump: 10,
    blurb: 'Stretches, bounces and changes up through five forms, each wilder than the last.',
    look: { kind: 'human', skin: '#e0ac7e', hair: '#16171c', hairStyle: 9, top: '#2f8f4e', bottom: '#3a3d44', accent: '#f08a24', outfit: 'plain', sleeves: 'none', legs: 'shorts', shoe: '#2a2c31', height: 1.74, build: 1.0, shape: 0.25 },
    moves: [
      ['Light', 'Stretch punch that reaches 7 m (Form 3: a giant fist)'], ['Heavy', 'A flurry of stretching punches'],
      ['1 Rocket', 'Grab a far wall and sling yourself at it'], ['2 Next form', 'Form 2 steam (fast), Form 3 giant fist, Form 4 bounce, then back'],
      ['3 Balloon', 'Puff up for 3 s: attacks bounce off you'], ['R Form 5', '20 s: giant, glowing, and everything turns to rubber'],
    ],
  },
  brann: {
    alt: { top: '#5a2a2a', accent: '#ffcf5a' },
    name: 'Brann', title: 'storm-hammer warrior', color: '#8fd3ff', hp: 170, speed: 1.15, jump: 10,
    blurb: 'A rune hammer that calls lightning down from the sky and comes back when thrown.',
    look: { kind: 'human', skin: '#e0ac7e', hair: '#2a1c14', hairStyle: 8, top: '#3a4a63', shirt: '#2b3038', bottom: '#2a2c33', accent: '#8fd3ff', outfit: 'coat', sleeves: 'long', legs: 'trousers', height: 1.9, build: 1.25, girth: 1.1, beard: true, boots: true, shape: 0.1 },
    moves: [
      ['Light', 'Hammer swings'], ['Heavy', 'Throw the hammer: it flies out and comes back'],
      ['1 Lightning call', 'A bolt from the sky where you aim'], ['2 Hammer flight', 'Spin the hammer and fly a long way'],
      ['3 Thunderclap', 'A ring of thunder that throws everyone back'], ['R Storm', '10 s: lightning strikes every villain nearby'],
    ],
  },
  bulwark: {
    alt: { vest: '#2f4a6b', bottom: '#2a2c31', accent: '#59e0ff' },
    name: 'Bulwark', title: 'the brute who gets angrier', color: '#ffb347', hp: 240, speed: 1.1, jump: 12,
    blurb: 'Every hit he takes or gives makes him angrier, bigger and harder to stop.',
    look: { kind: 'human', skin: '#a56b46', hair: '#16171c', hairStyle: 4, top: '#2a2c31', vest: '#3a3226', bottom: '#4a4a3a', accent: '#ffb347', outfit: 'vest', sleeves: 'none', legs: 'trousers', height: 2.0, build: 1.55, girth: 1.35, boots: true, shape: 0.0 },
    moves: [
      ['Light', 'Smashing punches'], ['Heavy', 'Ground slam'],
      ['1 Leap', 'A huge jump to where you aim, landing in a crater'], ['2 Clap', 'A clap that sends a shockwave forward'],
      ['3 Grab and throw', 'Grab the nearest enemy and hurl it into the others'], ['R Rampage', '15 s giant: double damage, nothing knocks him down'],
      ['Rage', 'Fills as he fights; more rage, more damage'],
    ],
  },
  warden: {
    alt: { top: '#2f3f5f', bottom: '#2a2c31', accent: '#ff9a3c' },
    name: 'Warden', title: 'shield-thrower', color: '#5fd6c2', hp: 190, speed: 1.2, jump: 9.5,
    blurb: 'A round shield that blocks anything and bounces from enemy to enemy.',
    look: { kind: 'human', skin: '#c68d6b', hair: '#3a2a1e', hairStyle: 10, top: '#3d4a2f', bottom: '#5a5040', accent: '#5fd6c2', outfit: 'jacket', shirt: '#2b3038', sleeves: 'long', legs: 'trousers', height: 1.84, build: 1.15, boots: true, shape: 0.2 },
    moves: [
      ['Light', 'Shield bashes'], ['Heavy', 'Shield throw: bounces between up to four enemies'],
      ['1 Charge', 'Rush forward behind the shield'], ['2 Block', '6 s: damage cut to a fifth, shots bounce back'],
      ['3 Rally', 'Heal 40 and stun everyone around you'], ['R Ricochet', '3 s: the shield bounces between every villain within 30 m'],
    ],
  },
  kitsu: {
    alt: { top: '#e8742a', bottom: '#16171c', accent: '#ffd34d' },
    name: 'Kitsu', title: 'clone ninja', color: '#59c8ff', hp: 140, speed: 1.4, jump: 11,
    blurb: 'Fills the street with copies of himself and hits with a spinning sphere of wind.',
    look: { kind: 'human', skin: '#f1c9a5', hair: '#1f3a6b', hairStyle: 3, top: '#2a8a9c', bottom: '#e8eef4', accent: '#59c8ff', outfit: 'jacket', shirt: '#e8eef4', sleeves: 'long', legs: 'trousers', height: 1.7, build: 0.9, shape: 0.3 },
    moves: [
      ['Light', 'Fast strikes'], ['Heavy', 'Spinning kick'],
      ['1 Spiral sphere', 'A sphere of wind in the hand: dash in and drill one enemy'], ['2 Clones', 'Three copies of you fight for 10 s'],
      ['3 Substitute', 'Vanish in smoke and reappear behind, dodging for 2 s'], ['R Great sphere', 'A huge sphere thrown at the crosshair: a 9 m blast'],
    ],
  },
  trine: {
    alt: { top: '#e8eef4', shirt: '#8a1f2f', accent: '#59e0ff' },
    name: 'Trine', title: 'three-blade swordswoman', color: '#ff6f8a', hp: 150, speed: 1.3, jump: 9.5,
    blurb: 'Three blades, one in her teeth, and slashes that fly through the air.',
    look: { kind: 'human', skin: '#e0ac7e', hair: '#141418', hairStyle: 7, top: '#8a1f2f', shirt: '#1c1f27', bottom: '#1c1f27', accent: '#ff6f8a', outfit: 'coat', sleeves: 'long', legs: 'trousers', height: 1.76, build: 0.9, shape: 0.75, boots: true },
    moves: [
      ['Light', 'Three-blade cuts'], ['Heavy', 'Whirlwind: cuts all round'],
      ['1 Flying slash', 'A blade of air that passes through everything in a line'], ['2 Triple dash', 'Dash through up to three enemies in turn'],
      ['3 Counter', '1.5 s guard: if hit, a huge counter-slash'], ['R Nine blades', 'Nine flying slashes in a fan'],
    ],
  },
  ember: {
    alt: { top: '#2a2c31', shirt: '#b8322a', accent: '#59e0ff' },
    name: 'Ember', title: 'fire-fist brawler', color: '#ff7a1a', hp: 160, speed: 1.3, jump: 10,
    blurb: 'Punches on fire, a body that turns to flame, and a meteor from the sky.',
    look: { kind: 'human', skin: '#e0ac7e', hair: '#e8742a', hairStyle: 11, top: '#b8322a', shirt: '#1c1f27', bottom: '#16171c', accent: '#ff7a1a', outfit: 'jacket', sleeves: 'long', legs: 'trousers', height: 1.8, build: 1.05, shape: 0.25, boots: true },
    moves: [
      ['Light', 'Burning punches'], ['Heavy', 'Fire fist: a fireball'],
      ['1 Fire dash', 'Dash leaving a trail of flame'], ['2 Fire pillars', 'A ring of fire pillars around you'],
      ['3 Flame body', '6 s as living fire: blows pass through you, touching burns'], ['R Meteor', 'A giant fireball falls on the crosshair: 12 m wide'],
    ],
  },
};
export const HERO_IDS = Object.keys(HEROES);

export const KUROZAN = {
  name: 'Kurozan, the Storm Dragon', short: 'Kurozan', hp: 1400, color: '#e0482f',
  look: { kind: 'human', skin: '#a56b46', hair: '#1a1416', hairStyle: 1, top: '#1c1d24', bottom: '#2a1c1c', accent: '#e0482f', outfit: 'coat', sleeves: 'long', legs: 'trousers', height: 1.9, build: 1.45, girth: 1.3, beard: true, boots: true, shape: 0.1 },
};
// Kurozan's crew: the Stormbreakers, war robots
// the other two villains: they lead raids of their own
export const VILLAINS = {
  kurozan: { name: 'Kurozan', crew: "Kurozan's crew", color: '#ff3b30' },
  vektor: { name: 'Vektor, the Machine Overlord', short: 'Vektor', crew: "Vektor's drones", color: '#ff2a4f', hp: 520 },
  shade: { name: 'Shade, of the Shadow Clan', short: 'Shade', crew: 'The Shadow Clan', color: '#b26bff', hp: 420,
    look: { kind: 'human', skin: '#c68d6b', hair: '#121216', hairStyle: 1, top: '#1c1624', bottom: '#14111a', accent: '#b26bff', outfit: 'coat', sleeves: 'long', legs: 'trousers', hat: 'hood', height: 1.78, build: 0.9, shape: 0.6, boots: true } },
};
export const CREW = {
  brute: { name: 'Stormbreaker brute', hp: 130, look: { kind: 'android', shell: '#2b2e36', top: '#3a2222', bottom: '#1c1e24', accent: '#ff3b30', headType: 1, height: 2.25, build: 1.5, girth: 1.3 } },
  gunner: { name: 'Stormbreaker gunner', hp: 65, look: { kind: 'android', shell: '#3b3f4a', top: '#4a3a24', bottom: '#22252c', accent: '#ff8a00', headType: 3, height: 1.85, build: 1.0 } },
  drone: { name: 'Storm drone', hp: 40 },
  hdrone: { name: 'Hijacked drone', hp: 35 },
  ninja: { name: 'Shadow ninja', hp: 60, look: { kind: 'human', skin: '#a56b46', hair: '#121216', hairStyle: 4, top: '#1a1820', bottom: '#14121a', accent: '#b26bff', outfit: 'plain', sleeves: 'long', legs: 'trousers', hat: 'hood', height: 1.75, build: 0.95, boots: true } },
};
