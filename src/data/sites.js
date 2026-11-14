// Where the districts of Neo Central sit around Meridian Quarter (which is at the origin).
// Each site is a 380 m square that sits inside the street grid (so no street runs under a district
// edge); Skyhaven floats at 450 m.
export const SITES = {
  aeroport: { id: 'aeroport', name: 'Aeroport', x: -870, z: -220, y: 0, blurb: 'Orbital lift, hangars, the vehicle exchange and the Speed Loop.' },
  bioeden: { id: 'bioeden', name: 'Bio-Eden', x: -220, z: -870, y: 0, blurb: 'Climate dome, lake, vertical forests, orchards and farms.' },
  skyhaven: { id: 'skyhaven', name: 'Skyhaven', x: 640, z: -640, y: 450, blurb: 'Floating decks at 450 m: mansions, gardens, Aurum Table, a villa for sale.' },
  neon: { id: 'neon', name: 'Neon District', x: 870, z: 220, y: 14, blurb: 'Two levels: neon avenues above, the Undercity market, club and bar below.' },
  oldearth: { id: 'oldearth', name: 'Old Earth', x: 220, z: 870, y: 0, blurb: 'Preserved old town under a solar canopy: square, tavern, tram, museum.' },
  nexus: { id: 'nexus', name: 'Industrial Nexus', x: -640, z: 640, y: 0, blurb: 'Automated factory halls, container yard, cooling towers, line QA work.' },
};
export const SITE_LIST = Object.values(SITES);
