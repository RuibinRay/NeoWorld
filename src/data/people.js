// Who lives in Meridian Quarter: identities, occupations, daily plans, and what they say.
// Everything is generated from a fixed seed so the same neighbors are there every launch.
import { RNG } from '../core/util.js';
import { SKINS, HAIRS, CLOTHES, ACCENTS } from '../entities/rigs.js';

const FIRST = ['Amara', 'Kenji', 'Soraya', 'Tomasz', 'Ife', 'Linnea', 'Mateo', 'Priya', 'Dae-jung', 'Noor', 'Ansel', 'Yara', 'Bao', 'Zofia', 'Kofi', 'Mirela', 'Tariq', 'Sunniva', 'Rafael', 'Hana', 'Oluwaseun', 'Chiara', 'Vikram', 'Elif', 'Jonas', 'Marisol', 'Tevita', 'Aiko', 'Desmond', 'Leilani'];
const LAST = ['Lindqvist', 'Oyelaran', 'Whitlock', 'Nakamura', 'Castellanos', 'Okafor', 'Petrov', 'Haddad', 'Sorensen', 'Mbeki', 'Tanaka', 'Alvarez', 'Kowalski', 'Rahman', 'Fontaine', 'Adeyemi', 'Ishikawa', 'Novak', 'Delgado', 'Bergstrom', 'Chaudhary', 'Vasquez', 'Morgan', 'Park', 'Lemaire', 'Osei', 'Yilmaz', 'Santos'];

// Occupations double as world-building: each line says how a 2226 technology is powered,
// maintained, kept safe, or what it changed for people.
export const JOBS = [
  { job: 'atmospheric engineer', lines: ['I tune the scrubber towers on the ring. The air is cleaner than it was in 2100, but only because forty thousand filters get swapped every month.', 'People think the weather is natural again. Half of it is. The other half is a maintenance schedule.'] },
  { job: 'neural-interface clinician', lines: ['Most of my patients do not want upgrades. They want their implants to stop pinging them at three in the morning.', 'A neural link draws about as much power as a hearing aid. The hard part was never energy. It was consent.'] },
  { job: 'orbital freight broker', lines: ['Everything heavy still goes up the slow way. The lift cable moves cargo, not people in a hurry.', 'If the Aeroport ever opens the east docks I can stop commuting to the equator.'] },
  { job: 'holo-architect', lines: ['Half the facades you see are light. Cheaper to repaint, but when the grid browns out the district looks naked.', 'Buildings adjust their own shading now. The art is making them agree with their neighbors.'] },
  { job: 'vertical-farm agronomist', lines: ['The herbs at Printed Petal travelled three meters. The wheat still travels three hundred kilometers. Nobody prints bread from nothing.', 'A farm tower drinks light. We run the grow cycle at night, when the sky lanes are quiet and power is cheap.'] },
  { job: 'memory archivist', lines: ['I keep the Old Quarter records. People pay to remember how a street smelled.', 'Lens recordings last forever unless you file for forgetting. Most people never do.'] },
  { job: 'grid balancer', lines: ['Every aerocar on a charger is a battery I can borrow for a minute. That is how the lights stay on at dusk.', 'A big storm costs us two days of stored power. The towers dim their signs first, then the lifts slow down.'] },
  { job: 'biofabrication technician', lines: ['Cultivated meat stopped being strange a century ago. What is strange now is someone who has tasted the other kind.', 'A food printer is only as good as its sterilization cycle. That is why the kitchens close at night.'] },
  { job: 'AI auditor', lines: ['I interview service units for a living. If one starts giving the answers it thinks I want, that is the finding.', 'Every robot here logs why it did what it did. Reading those logs is most of city politics.'] },
  { job: 'skyway traffic controller', lines: ['Manual flight is legal below the first lane and above the roofs. In the lanes, the city flies and you ride.', 'We fine hard landings because the pads remember them. Cracked deck plates cost more than cars.'] },
  { job: 'robot behaviorist', lines: ['Dogs taught us most of what we know about companion units. The robots walk the dogs now, which is a little funny.', 'A unit that never refuses is a badly made unit. Refusal is a safety feature.'] },
  { job: 'water reclamation operator', lines: ['Every raindrop that lands on Meridian is used four times before it leaves.', 'The fountain is a display. The real water runs in the walls.'] },
  { job: 'med-bay nurse', lines: ['Most injuries I see are from people trusting the fall-dampener and jumping anyway.', 'Healthcare robots do the lifting and the scanning. People still want a person to tell them it will be fine.'] },
  { job: 'maglev line supervisor', lines: ['Line 7 is never late. It is occasionally cancelled, which is different.', 'The train floats on about the power of a kitchen. Stopping it is what takes the energy.'] },
];

const CHAT = {
  rain: ['Rain is good for the reclamation tanks. Bad for my shoes.', 'Smart fabric is supposed to shed water. Mine has opinions about that.'],
  storm: ['They ground the small pods in weather like this. I would keep it low if I were flying.', 'Listen to that. The towers hum when the lightning rods are working.'],
  fog: ['On fog days the lane lights do all the work.', 'You cannot see the Needle at all today. Strange how much smaller the city feels.'],
  night: ['Meridian is better after dark. The towers finally show off.', 'There is a concert at the Commons most nights, if the holo-rig behaves.'],
  morning: ['The first shuttle is always full. I walk when I can.', 'Kitchens have just finished their sterilization cycle. Best time for breakfast.'],
  noon: ['Printed Petal tunes the bento to your biometrics. Mine always comes out with extra iron, which feels judgmental.', 'The dumpling cart by the west gate still folds everything by hand. Costs more, tastes like somebody meant it.'],
  evening: ['Sunset through the tower gaps is the one thing the architects did not plan.', 'I should be home. The park is nicer, though.'],
  any: ['They say Skyhaven opens to visitors next year. They say that every year.', 'My lens keeps recommending a robot dog. I think it knows something.', 'Bio-Eden has real soil. You are not allowed to touch it.', 'Did you see the maglev? Line 7 runs the ring every few minutes. Nobody is ever on the platform.', 'I heard the Industrial Nexus runs with nine people. Nine. For the whole district.', 'Half my building is owned by one investor who has never visited.'],
};
const CHAT_ANDROID = ['Ambient conditions are within my comfort band. I am told that counts as a nice day.', 'I am not permitted to have a favorite resident. Hypothetically, it would not be the one who kicked the cleaner.', 'My charge is at 71 percent. I mention it because humans like to exchange status.', 'I logged 14,000 steps today. The dog logged more.'];
export const TIPS = [ // [what they tell you, index into city.caches]
  ['There is a data cache on the Printed Petal roof garden. Couriers leave them for whoever bothers to go up.', 7],
  ['Somebody stashed a cache in the alley behind the Old Quarter shops. Walk around the back.', 4],
  ['The skybridge behind Halcyon has something glowing on top of it. You would need to fly.', 2],
  ['Top of the Spire. If your aerocar can make three hundred and forty meters, there is a cache up there.', 3],
  ['Skyport control tower, on the roof. The attendants pretend they do not know about it.', 5],
  ['Meridian South maglev platform. Take the lift up from the ring road. Nobody looks at the far end.', 8],
  ['Halcyon roof. Two hundred and eighty meters. Bring a full battery.', 6],
];
const AMBIENT = [
  ['Did they fix the lift in your tower?', 'It speaks now. I preferred it broken.'],
  ['Are you going to the concert tonight?', 'If the rain holds off. Holograms and puddles, you know.'],
  ['My kid wants a robot dog.', 'Get the K9. Mine fetches parcels from the roof.'],
  ['The shuttle was late again.', 'It was not late. It was "rescheduled in real time".'],
  ['Have you tried the lattice wagyu?', 'Printed marbling. I could not tell the difference. That is what worries me.'],
  ['I saw someone flying manually over the park.', 'Brave. Or new here.'],
  ['Power dipped during the storm.', 'The signs went dark for a whole second. People gasped.'],
  ['They are selling the sky pod in Halcyon.', 'With the private deck? I would never leave.'],
];

export const pick = (rng, arr) => arr[Math.floor(rng.next() * arr.length)];
export function ambientPair(rng) { return pick(rng, AMBIENT); }

// Things that recently happened in the district; residents bring them up in conversation.
const NEWS = {
  citation: ['Aegis wrote somebody up in the Commons earlier. Tell me that was not you.', 'There was a citation today. The drone reads the charge out loud. It is mortifying.'],
  storm: ['That storm knocked the tower signs out for a full second. Everyone on the street gasped.', 'The lanes thin out when the lightning starts. Sensible. I would not fly in it.'],
  lamp: ['A lamp failed on my street and a Torque unit had it fixed in two minutes. I timed it.', 'Did you see the sparks? Maintenance was out again. Something is always wearing out.'],
  medical: ['Someone fainted in the street today. The med-drone was there before I had my lens out.', 'A resident collapsed earlier. They are fine. The drone logged it as dehydration.'],
  concert: ['The stage is on tonight. You can hear the bass from Halcyon.', 'Are you going to the Commons later? The holo-rig is supposed to be behaving.'],
  race: ['Somebody tore through the canyon rings today. You could hear the repulsors from the park.', 'There is a new time on the Canyon Sprint board. People are talking.'],
  market: ['The evening market is up by the east path. Get the skewers before they run out.', 'I bought a bouquet that glows. It was that or dinner.'],
};
export function newsLine(env, rng) {
  const now = env.day * 1440 + env.mins, list = (env.news || []).filter((n) => now - n.at < 420);
  if (!list.length) return null;
  const n = list[list.length - 1 - Math.floor(rng.next() * Math.min(2, list.length))];
  return pick(rng, NEWS[n.key] || []) || null;
}
export function chatLine(npc, env, rng) {
  if (!npc.child && rng.chance(0.35)) { const l = newsLine(env, rng); if (l) return l; }
  if (npc.mood < -0.3 && !npc.android && rng.chance(0.5)) return pick(rng, ['Not my best day, honestly.', 'I have been rained on, bumped into and overcharged. Ask me tomorrow.', 'Sorry. I am poor company right now.']);
  if (npc.android && rng.chance(0.6)) return pick(rng, CHAT_ANDROID);
  const h = env.hour, pools = [CHAT.any];
  if (env.storm > 0.5) pools.push(CHAT.storm, CHAT.storm); else if (env.rain > 0.3) pools.push(CHAT.rain, CHAT.rain); else if (env.fog > 0.5) pools.push(CHAT.fog, CHAT.fog);
  pools.push(h < 10 ? CHAT.morning : h < 14 ? CHAT.noon : h < 20 ? CHAT.evening : CHAT.night);
  return pick(rng, pick(rng, pools));
}
export function greeting(npc, mem, env, playerName) {
  const day = env.day;
  if (mem.met && mem.heard) {
    const h = mem.heard, who = h.from.split(' ')[0]; delete mem.heard;
    return h.good ? `${who} told me you ${h.what}. That was decent of you.` : `I heard you ${h.what}. ${who} was not impressed.`;
  }
  if (!mem.met) return npc.android ? `Hello. I am ${npc.name}, ${npc.job}. I do not believe we have been introduced.` : `I do not think we have met. ${npc.name}. I am ${/^[aeiou]/i.test(npc.job) ? 'an' : 'a'} ${npc.job}.`;
  if (mem.bumped > 0 && mem.rep < 0) return 'Watch where you are walking this time.';
  if (mem.rep <= -20) return 'Oh. You again.';
  if (mem.rep >= 40) return `${playerName}! Good to see you.`;
  if (mem.lastDay === day && mem.talks >= 2) return 'Twice in one day. You are either lost or friendly.';
  if (mem.lastDay && day - mem.lastDay >= 2) return `It has been a few days. Still finding your way around, ${playerName}?`;
  return npc.android ? `Hello again, ${playerName}.` : `Hey, ${playerName}.`;
}

// ---- cast -------------------------------------------------------------------------------------
const m = (h, mm = 0) => h * 60 + mm;
function humanLook(r, o = {}) {
  return { kind: 'human', skin: pick(r, SKINS), hair: pick(r, HAIRS), hairStyle: r.int(0, 5), top: pick(r, CLOTHES), bottom: pick(r, CLOTHES.slice(0, 5)), accent: pick(r, ACCENTS), height: r.range(1.58, 1.92), build: r.range(0.9, 1.18), coat: r.chance(0.35), visor: r.chance(0.3), pack: r.chance(0.2), ...o };
}
const droid = (shell, top, bottom, accent, o = {}) => ({ kind: 'android', shell, top, bottom, accent, height: 1.8, ...o });

export function buildCast(doors) {
  const r = new RNG(4242), cast = [], used = new Set();
  const name = () => { let n; do { n = pick(r, FIRST) + ' ' + pick(r, LAST); } while (used.has(n)); used.add(n); return n; };
  const door = (not) => { let d; do { d = pick(r, doors); } while (d === not); return d; };
  const jit = (t, j = 25) => t + Math.round(r.range(-j, j));
  const add = (o) => { o.id = o.id || 'p' + cast.length; cast.push(o); return o; };
  const leisure = () => pick(r, ['park', 'park', 'stroll', 'shop', 'eat', 'market']);

  // residents with jobs: half work in the district, half commute out by air shuttle
  JOBS.forEach((j, i) => {
    const home = door(), commuter = i % 2 === 1, work = door(home);
    const plan = commuter
      ? [[0, 'home'], [jit(m(7, 20)), 'commute'], [jit(m(17, 40)), 'return'], [jit(m(18, 30)), leisure()], [jit(m(20, 15)), r.chance(0.5) ? 'concert' : 'stroll'], [jit(m(22, 0)), 'home']]
      : [[0, 'home'], [jit(m(7, 15), 40), 'work'], [jit(m(12, 10), 15), 'eat'], [jit(m(13, 20), 10), 'work'], [jit(m(17, 20), 30), leisure()], [jit(m(19, 0)), leisure()], [jit(m(20, 30)), r.chance(0.4) ? 'concert' : 'home'], [jit(m(22, 30)), 'home']];
    add({ name: name(), job: j.job, lines: j.lines, look: humanLook(r), home, work, plan, talk: true, transit: i % 4 === 1 ? 'shuttle' : 'mag' + (i % 4) });
  });
  // on-site staff
  add({ id: 'host', name: 'Maitre-7', job: 'host unit at Printed Petal', android: true, look: droid('#16181d', '#1c1f27', '#16181d', '#ffb3d1', { antenna: true }), home: 'restKit', plan: [[0, 'home'], [m(6, 50), 'post', 'restHost', 0], [m(23, 5), 'home']], talk: true, role: 'host',
    lines: ['The printers assemble a dish in about forty seconds. Tuning it to your biometrics takes four, and people complain about the four.', 'I am an android, so I do not eat. I have, however, read every review.'] });
  add({ id: 'chef', name: 'Odalys Ferreira', job: 'chef-curator at Printed Petal', look: humanLook(r, { top: '#f1ede6', bottom: '#1c1f27', hairStyle: 2, coat: false, visor: false }), home: door(), plan: [[0, 'home'], [m(6, 30), 'post', 'restChef', 0], [m(15, 0), 'park'], [m(16, 40), 'post', 'restChef', 0], [m(22, 40), 'home']], talk: true, role: 'chef',
    lines: ['The machines print the structure. I decide what it should taste like and I finish every plate by hand. That last part is not efficient. It is the point.', 'We grow the herbs on that wall. The proteins come from the cultivators under the Nexus. Nothing on your plate ever had a nervous system.'] });
  add({ id: 'clerk', name: 'Kit', job: 'shop assistant at Kinetic Robotics', android: true, look: droid('#eef2f6', '#e8edf3', '#3b4250', '#7dff9c'), home: 'shopClerk', plan: [[0, 'home'], [m(8, 50), 'post', 'shopClerk', -Math.PI / 2], [m(21, 10), 'home']], talk: true, role: 'clerk',
    lines: ['A companion unit runs two days on a charge and docks itself. Owners forget they are machines until the first firmware notice.', 'Every unit we sell can refuse an unsafe instruction. Customers ask if that can be turned off. It cannot.'] });
  add({ id: 'ops', name: 'Vesper', job: 'flight operations attendant', android: true, look: droid('#dfe5ee', '#205a7a', '#1c2a3a', '#4de1ff', { antenna: true }), home: 'skyOps', plan: [[0, 'post', 'skyOps', Math.PI / 2]], talk: true, role: 'ops',
    lines: ['Pads charge by induction. A full charge is about the energy of a week of your apartment, so the grid schedules it.', 'If your battery reaches zero the repulsors hold a reserve for one controlled descent. Please do not test this over the park.'] });
  add({ id: 'vendor', name: 'Wen Shu', job: 'dumpling maker', look: humanLook(r, { top: '#b3382f', hairStyle: 0, coat: false, visor: false, height: 1.66 }), home: 'old1', plan: [[0, 'home'], [m(10, 20), 'post', 'cartV', 0], [m(21, 30), 'home']], talk: true, role: 'vendor',
    lines: ['My family has folded these the same way since before the towers. The city pays me a heritage stipend to keep doing it slowly.', 'People can print a dumpling in six seconds. They queue here for ten minutes anyway.'] });
  // dog walkers: a person with a robot dog, and a household android walking its owner's dog
  add({ id: 'walker', name: 'Imre Kovacs', job: 'retired lift mechanic', look: humanLook(r, { hair: '#b8bcc6', coat: true }), home: door(), plan: [[0, 'home'], [m(6, 30), 'walkdog'], [m(8, 10), 'park'], [m(9, 30), 'home'], [m(17, 50), 'walkdog'], [m(19, 30), 'home']], talk: true, pet: { robot: true, name: 'Pixel', color: '#e6ebf2', accent: '#ffd34d' },
    lines: ['Pixel never needs feeding, never gets old. I thought that would make it easier. You get attached anyway.', 'I serviced the lifts in Halcyon for thirty years. Now they service themselves and send me a birthday message.'] });
  add({ id: 'nanny', name: 'TESS', job: 'household unit, Halcyon 38-02', android: true, look: droid('#f3ead8', '#e9d9c0', '#6b5d4f', '#ff9a52'), home: 'liftDoor', plan: [[0, 'home'], [m(10, 50), 'walkdog'], [m(12, 30), 'home'], [m(15, 50), 'walkdog'], [m(17, 10), 'home']], talk: true, pet: { robot: false, name: 'Biscuit', color: '#b9824f' },
    lines: ['Biscuit belongs to the Okafor family. I walk him twice daily. He has decided I am part of the furniture that moves.', 'I carry a waste kit, a water dish and a legal liability waiver. Dogs remain the least predictable system in the city.'] });
  // a child with a companion robot, and a parent
  add({ id: 'kid', name: 'Pip', job: 'age nine', child: true, look: humanLook(r, { height: 1.22, child: true, coat: false, visor: false, top: '#d9b23a', bottom: '#2c3e63' }), home: 'liftDoor', plan: [[0, 'home'], [m(8, 0), 'work'], [m(15, 0), 'play'], [m(18, 30), 'home']], work: door(), talk: true, companion: { name: 'Bolo' },
    lines: ['Bolo is my learning companion. He lets me win at tag but he says he does not.', 'I am going to be a sky lane pilot. Bolo says the lanes fly themselves. Bolo is boring.'] });
  add({ id: 'parent', name: 'Noor Haddad', job: 'parent, structural engineer', look: humanLook(r, { hairStyle: 1 }), home: 'liftDoor', plan: [[0, 'home'], [m(8, 0), 'work'], [m(15, 0), 'park'], [m(18, 30), 'home']], work: door(), talk: true,
    lines: ['The companion logs everything Pip learns. I read it at night. It is the best and the strangest part of my day.', 'I design the dampers that stop these towers swaying. On a windy day the top of the Needle still moves two meters.'] });
  add({ id: 'jogger', name: name(), job: 'physiotherapist', look: humanLook(r, { coat: false, top: '#2f6b55', pack: false }), home: door(), work: door(), plan: [[0, 'home'], [m(6, 0), 'jog'], [m(7, 20), 'work'], [m(18, 20), 'jog'], [m(19, 30), 'home']], talk: true,
    lines: ['Everyone has perfect posture data and terrible posture. I have job security.', 'Running is the one thing nobody has automated. Give them time.'] });
  // a shopper followed by a porter robot carrying the groceries
  add({ id: 'shopper', name: name(), job: 'ceramicist', look: humanLook(r), home: door(), plan: [[0, 'home'], [m(10, 0), 'shop'], [m(11, 10), 'stroll'], [m(12, 20), 'home'], [m(16, 0), 'shop'], [m(17, 0), 'park'], [m(18, 0), 'home']], talk: true, companion: { name: 'Porter', porter: true },
    lines: ['Porter carries the clay. I carry the opinions.', 'Handmade costs more now than it ever did. People want to see the thumbprint.'] });
  // tourists
  for (let i = 0; i < 4; i++) add({ id: 'tour' + i, name: name(), job: 'visitor from ' + pick(r, ['the Lagos arcology', 'New Jakarta', 'the Andes terraces', 'Reykjavik deep-city']), look: humanLook(r, { pack: true, visor: true }), home: 'old' + (i % 4), plan: [[0, 'home'], [jit(m(9, 30)), 'tour'], [jit(m(12, 30), 10), 'eat'], [jit(m(13, 40), 10), 'tour'], [jit(m(17, 30)), 'home'], [jit(m(20, 0)), i < 2 ? 'concert' : 'home'], [jit(m(22, 0)), 'home']], talk: true, tourist: true,
    lines: ['Where I am from the towers are shorter and the sky lanes are louder. This is very civilized.', 'The guide said to look up. I have been looking up for an hour. My neck has filed a complaint.'] });
  // the night crowd
  for (let i = 0; i < 6; i++) add({ id: 'night' + i, name: name(), job: pick(r, ['lighting designer', 'sound sculptor', 'student', 'night-shift logistics planner', 'holo-performer', 'bartender on her night off']), look: humanLook(r, { top: pick(r, ['#5b2e4f', '#4a3f6e', '#1c1f27', '#7a2f3b']), visor: true }), home: door(), plan: [[m(1, 0) + i * 6, 'home'], [jit(m(19, 50)), 'eat'], [m(20, 40) + i * 4, 'concert']], talk: true,
    lines: ['The performer is a recording of someone who retired in 2190. Still sells out the lawn.', 'Nights are when the city feels shared. Daytime, everybody is on a schedule.'] });
  // law and order
  add({ id: 'officer', name: 'Sgt. Adaeze Okonkwo', job: 'district officer', look: humanLook(r, { top: '#182236', bottom: '#182236', accent: '#4d7dff', coat: false, visor: true, hairStyle: 2 }), home: door(), plan: [[0, 'home'], [m(6, 45), 'patrol'], [m(12, 30), 'eat'], [m(13, 15), 'patrol'], [m(19, 15), 'home']], talk: true,
    lines: ['Aegis units do the watching. I do the talking. Most trouble ends when somebody is listened to.', 'Reckless flying is the big one. The lanes are safe. It is the people who think they are better than the lanes.'] });
  // service machines
  add({ id: 'fern', name: 'Fern', job: 'gardener unit', android: true, look: droid('#cfe3d2', '#2f6b55', '#3b4250', '#7dff9c'), home: 'dock', plan: [[0, 'home'], [m(5, 30), 'tend'], [m(19, 0), 'home']], talk: true,
    lines: ['Each planter reports moisture and root health. I am mostly here because residents like seeing someone care.', 'The pink trees are engineered to fix nitrogen and glow slightly. The glow was a committee decision.'] });
  for (let i = 0; i < 2; i++) add({ id: 'torque' + i, name: 'Torque-' + (3 + i * 2), job: 'maintenance unit', android: true, look: droid('#ff9a52', '#ff9a52', '#2a2f3a', '#ffd34d', { pack: true }), home: 'skyHub2', plan: [[0, 'repair']], talk: true,
    lines: ['Street lamps report their own faults. I am dispatched before most residents notice.', 'Maintenance is forty percent of the city budget. Nothing futuristic about it. Things wear out.'] });
  for (let i = 0; i < 3; i++) add({ id: 'rover' + i, name: 'Courier ' + (11 + i * 7), job: 'delivery rover', body: 'rover', home: 'skyHub2', plan: [[0, 'deliver']], speed: 2.1 });
  add({ id: 'cleaner', name: 'Sweep', job: 'sanitation unit', body: 'cleaner', home: 'dock', plan: [[0, 'home'], [m(5, 0), 'clean'], [m(23, 0), 'home']], speed: 0.9 });
  // ---- Phase 2: the rest of the district ---------------------------------------------------
  const MORE = [
    { job: 'lens optician', lines: ['AR contacts last a year. People wear them for three and wonder why the city looks smeared.', 'I can tell what someone watches by how their lens is scratched.'] },
    { job: 'drone dispatcher', lines: ['Six thousand deliveries a day cross this district and you notice maybe ten. That is the job done right.', 'Drones route around weather, concerts and funerals. The last one is a rule I wrote.'] },
    { job: 'tower window technician', lines: ['The glass cleans itself. I clean the things that clean the glass.', 'At four hundred meters the wind decides when you take your break.'] },
    { job: 'school mentor', lines: ['Every child has an AI tutor. My job is everything the tutor is bad at, which is mostly lunch and heartbreak.', 'We still teach handwriting. Nobody can say why and nobody will vote to stop.'] },
    { job: 'cultivator operator', lines: ['A cultivator vat makes a tonne of protein from sugar, light and patience. Mostly patience.', 'One contaminated line and the district eats kelp for a week. So I wash my hands a lot.'] },
    { job: 'transit planner', lines: ['Line 7 exists because walking the ring takes twenty minutes and people will not.', 'Shuttles, maglev, lanes. The hard part is the last hundred meters, same as it ever was.'] },
    { job: 'sim-therapy guide', lines: ['People rehearse hard conversations with me in simulation. The real one still frightens them. Good.', 'Half my clients just want an hour where nothing pings.'] },
    { job: 'elevator auditor', lines: ['A kilometer-high tower is mostly lift shaft. I count the seconds people lose and argue for more shafts.', 'Lifts negotiate with each other now. Sometimes they sulk.'] },
    { job: 'fabric coder', lines: ['Smart fabric re-dyes in seconds. The fashion is now in how it changes, not what it is.', 'Your trim is running last season firmware, by the way.'] },
    { job: 'reclamation diver', lines: ['Under the Nexus there are tanks the size of stadiums. Somebody has to swim the filters.', 'Robots do the routine dives. I do the ones where something moved.'] },
    { job: 'holo-rig technician', lines: ['The performer at the Commons is a recording. The mistakes are added so it feels live.', 'Rain scatters the projection. We call it atmosphere and bill for it.'] },
    { job: 'civic mediator', lines: ['Most disputes are about noise, shade and whose robot did what.', 'A machine can find the fair answer. People want to be heard first.'] },
  ];
  const transitOf = (i) => (i % 3 === 0 ? null : i % 3 === 1 ? 'shuttle' : 'mag' + (i % 4));
  for (let i = 0; i < 46; i++) {
    const j = i < MORE.length ? MORE[i] : pick(r, [...JOBS, ...MORE]), home = door(), work = door(home), transit = transitOf(i);
    const early = i % 5 === 0 ? [[jit(m(6, 22), 6), 'exercise']] : [];
    const plan = transit
      ? [[0, 'home'], ...early, [jit(m(7, 30), 35), 'commute'], [jit(m(17, 30), 40), 'return'], [jit(m(18, 20)), leisure()], [jit(m(19, 40)), r.chance(0.4) ? 'concert' : leisure()], [jit(m(22, 0), 40), 'home']]
      : [[0, 'home'], ...early, [jit(m(7, 40), 40), 'work'], [jit(m(12, 15), 25), 'eat'], [jit(m(13, 25), 15), 'work'], [jit(m(17, 15), 30), leisure()], [jit(m(18, 45)), leisure()], [jit(m(20, 20)), r.chance(0.35) ? 'concert' : 'home'], [jit(m(22, 20)), 'home']];
    add({ name: name(), job: j.job, lines: j.lines, look: humanLook(r), home, work, plan, talk: true, transit });
  }
  for (let i = 0; i < 10; i++) add({ name: name(), job: 'retired ' + pick(r, ['pilot', 'teacher', 'grid engineer', 'chef', 'surveyor', 'nurse']), look: humanLook(r, { hair: pick(r, ['#b8bcc6', '#b8bcc6', '#c9a063']), coat: true }), home: door(),
    plan: [[0, 'home'], ...(i % 2 ? [[jit(m(6, 20), 5), 'exercise']] : []), [jit(m(8, 20)), 'park'], [jit(m(11, 40)), r.chance(0.6) ? 'eat' : 'home'], [jit(m(13, 30)), 'stroll'], [jit(m(15, 0)), 'park'], [jit(m(17, 10)), 'market'], [jit(m(19, 0)), 'home']], talk: true,
    lines: ['I remember when the Needle was the tallest thing here. For about a year.', 'The city pays me to keep moving. They call it a wellness dividend. I call it a walk.'] });
  for (let i = 0; i < 8; i++) add({ name: name(), job: 'student, year ' + r.int(9, 12), look: humanLook(r, { height: r.range(1.5, 1.7), coat: false, pack: true, visor: true }), home: door(), work: door(),
    plan: [[0, 'home'], [jit(m(7, 40), 15), 'work'], [jit(m(15, 10), 15), 'park'], [jit(m(16, 40)), r.chance(0.5) ? 'shop' : 'market'], [jit(m(18, 10)), 'stroll'], [jit(m(19, 40)), 'home']], talk: true,
    lines: ['My tutor AI says I am ahead in physics and behind in arguing. I argued about it.', 'Everyone wants to design lanes or companions. I want to run the dumpling cart.'] });
  for (let i = 0; i < 6; i++) add({ name: name(), job: 'night-shift ' + pick(r, ['lane monitor', 'vat technician', 'grid operator', 'med-bay orderly']), look: humanLook(r), home: door(), work: door(),
    plan: [[0, 'work'], [jit(m(6, 30)), 'eat'], [jit(m(7, 40)), 'home'], [jit(m(18, 30)), 'market'], [jit(m(20, 20)), 'concert'], [jit(m(22, 30)), 'work']], talk: true,
    lines: ['The city at four in the morning belongs to the machines and to me.', 'Nights pay a third more. You earn it at dawn, walking home against everyone else.'] });
  for (let i = 0; i < 8; i++) add({ name: name(), job: pick(r, ['remote systems designer', 'translator', 'novelist', 'data gardener']), look: humanLook(r), home: door(),
    plan: [[0, 'home'], [jit(m(9, 0)), 'park'], [jit(m(10, 30)), 'home'], [jit(m(12, 15)), 'eat'], [jit(m(13, 30)), 'home'], [jit(m(16, 30)), 'stroll'], [jit(m(18, 0)), 'market'], [jit(m(19, 40)), 'home']], talk: true,
    lines: ['I work from the pod. The commute is eleven steps and I still manage to be late.', 'The park is my office. The bench by the fountain has the best signal.'] });
  // evening market stalls and the morning wellness unit
  const stalls = [['Printed fruit', 'fruit printer'], ['Night skewers', 'grill cook'], ['Glow blooms', 'florist']];
  stalls.forEach(([what, job], k) => add({ id: 'stall' + k, name: name(), job: `${job}, evening market`, look: humanLook(r, { coat: false, visor: false }), home: door(), role: 'stall' + k,
    plan: [[0, 'home'], [m(16, 45), 'post', 'stallV' + k, 0], [m(21, 40), 'home']], talk: true,
    lines: [`${what}, every evening until the lamps dim. The city licenses six stalls and three of us turn up.`, 'A market is the one place the district does not optimize. People wander. That is the product.'] }));
  add({ id: 'sol', name: 'Sol', job: 'wellness unit', android: true, look: droid('#f6f1e4', '#ffd98a', '#8a6a2f', '#ffd34d', { antenna: true }), home: 'dock', role: 'wellness',
    plan: [[0, 'home'], [m(6, 10), 'post', 'audLead', 0], [m(7, 50), 'home']], talk: true,
    lines: ['Forty minutes of slow movement lowers a resident clinic visit rate by a tenth. I am cheaper than the clinic.', 'I lead. I do not judge. I do log attendance.'] });

  // social graph: every resident has a couple of friends; some share a home with a partner
  const soc = cast.filter((c) => c.talk && !c.android && !c.child && !c.role && !c.pet && !c.companion && c.look);
  for (const c of soc) c.friends = [];
  for (const c of soc) { let guard = 0; while (c.friends.length < 2 && guard++ < 20) { const o = pick(r, soc); if (o !== c && !c.friends.includes(o.id)) { c.friends.push(o.id); if (!o.friends.includes(c.id)) o.friends.push(c.id); } } }
  for (let i = 0; i + 1 < soc.length; i += 5) { const a = soc[i], b = soc[i + 1]; if (a.id.startsWith('tour') || b.id.startsWith('tour')) continue; a.partner = b.id; b.partner = a.id; b.home = a.home; }
  // more life on the streets: people from the wider city who spend their day out in Meridian,
  // shopping in the Old Quarter, eating, walking, staying for the concert
  const OUT = [
    ['in from the outer ring for the day', ['I come in for the Old Quarter. Out where I live every tower has the same lobby.', 'Bao first, then records, then I complain about my feet.']],
    ['freelance fabricator', ['I print parts at home and deliver them by hand. The walk is the only meeting I enjoy.', 'The Repair Cafe taught me half of what I know. I never told them.']],
    ['ward nurse on her days off', ['Twelve hours on, then two days of pretending I do not know what a monitor sounds like.', 'The tea house is the quietest room in the city. I checked.']],
    ['sky-lane inspector', ['I look up for a living. Down here I get to look at shop windows instead.', 'Lane four has been drifting west for a year. Nobody believes me.']],
    ['retired maglev driver', ['I drove line seven for thirty years. Now I ride it and criticize the braking.', 'The stations smell the same. That is the part I did not expect to miss.']],
    ['street photographer', ['The light between the towers lasts eleven minutes at this time of year. I am early.', 'People stopped posing when lenses went into eyes. Now everyone just looks like themselves.']],
  ];
  for (let i = 0; i < 48; i++) {
    const [job, lines] = OUT[i % OUT.length], k = i % 4;
    const plan = k === 0 ? [[0, 'home'], [jit(m(9, 40)), 'shop'], [jit(m(11, 50)), 'eat'], [jit(m(13, 0)), 'stroll'], [jit(m(14, 40)), 'shop'], [jit(m(16, 20)), 'park'], [jit(m(18, 20)), 'home']]
      : k === 1 ? [[0, 'home'], [jit(m(8, 10)), 'work'], [jit(m(17, 20)), 'stroll'], [jit(m(18, 10)), 'market'], [jit(m(19, 30)), 'eat'], [jit(m(20, 20)), 'concert'], [jit(m(22, 30)), 'home']]
        : k === 2 ? [[0, 'home'], [jit(m(6, 40)), 'stroll'], [jit(m(8, 10)), 'park'], [jit(m(9, 40)), 'shop'], [jit(m(11, 0)), 'home'], [jit(m(14, 30)), 'shop'], [jit(m(15, 50)), 'stroll'], [jit(m(17, 30)), 'home']]
          : [[0, 'stroll'], [jit(m(0, 50), 10), 'home'], [jit(m(12, 30)), 'stroll'], [jit(m(14, 0)), 'shop'], [jit(m(16, 30)), 'park'], [jit(m(19, 40)), 'eat'], [jit(m(20, 50)), 'concert'], [jit(m(23, 0)), 'stroll']];
    add({ name: name(), job, lines, look: humanLook(r), home: door(), work: door(), plan, talk: true, friends: [], transit: 'mag' + (i % 4) });
  }
  return cast;
}

// ---- Phase 4: locals and staff of the outer districts ------------------------------------------
// Each district has its own small population that lives on that district's walkways.
const LOCALS = {
  aeroport: { n: 10, jobs: [['long-haul steward', ['Orbit and back in three days. My body thinks it is always Tuesday.', 'The lift never stops. Cargo up, cargo down. People are the smallest thing it carries.']], ['traveller in transit', ['Six hours between climbers. I have walked this concourse nine times.', 'They say the view from the lift at dawn is worth the ticket. I slept through it.']], ['apron marshal', ['Aircraft park themselves. I am here for the day one does not.', 'A liner drinks a district worth of power on takeoff. The grid schedules the whole city around departures.']]] },
  bioeden: { n: 10, jobs: [['canopy botanist', ['The dome holds a climate that no longer exists outside it. We keep it as a reference copy.', 'Every flower here was designed. The bees were not. That still surprises people.']], ['soil microbiologist', ['Real soil takes a century to make. We guard it like a bank guards money.', 'The vertical forests clean more air than the scrubbers. They are also much nicer to stand under.']], ['resident of the green', ['We vote on everything here, including the height of the grass.', 'You can swim in the lake. The fish have been asked to tolerate it.']]] },
  skyhaven: { n: 8, look: { coat: true, visor: true }, jobs: [['fund trustee', ['The deck charges a mooring fee that would buy a tower floor in Meridian. One pays for the quiet.', 'Storms pass below us. I find I miss the rain, in theory.']], ['retired architect', ['I designed three of the towers you flew past. From up here they finally look finished.', 'A floating house needs more energy to stay still than a flying car needs to move.']], ['collector', ['Everything rare ends up on this deck eventually, including people.', 'The villa is for sale again. It always is. Nobody stays who has to ask the price.']]] },
  neon: { n: 8, night: true, jobs: [['sign writer', ['Half the light in this district is advertising for the other half.', 'A neon tube lasts forty years. The business under it lasts four.']], ['night courier', ['Deliveries after midnight pay double and ask no questions.', 'I know every lift between the levels and which ones stick.']], ['sim athlete', ['I train eight hours a day lying down. My heart rate says it is real.', 'The arena pays for a top score. The top score has stood since spring.']]] },
  neonlow: { n: 8, night: true, jobs: [['market regular', ['The Undercity never sees the sun and never closes. Suits me.', 'Upstairs sells the future. Down here sells dinner.']], ['off-shift machinist', ['Twelve hours watching robots work, then a drink poured by a robot. I do see the joke.', 'The plates overhead hum when the big towers draw power. You stop hearing it after a year.']], ['street musician', ['The club drowns me out after eight. Before eight, the canyon is mine.', 'Acoustics under a deck plate are terrible. People stop anyway.']]] },
  oldearth: { n: 10, jobs: [['heritage resident', ['My family has had this door for two hundred years. The canopy went up over my grandmother.', 'We keep the clock wound by hand. The city offered to automate it. We said no, loudly.']], ['restorer', ['Old brick breathes. New sealant suffocates it. Half my job is taking modern repairs back out.', 'Tourists ask if any of it is real. All of it is. That is the exhibit.']], ['tram conductor', ['The tram goes round the square and nowhere else. It is the most popular line in the city.', 'There is a bell. I am the only person in Neo Central paid to ring one.']]] },
  nexus: { n: 3, jobs: [['line supervisor', ['Nine of us, eleven thousand machines. My whole job is noticing what they do not.', 'A hall can retool itself overnight. What it cannot do is decide what is worth making.']], ['safety officer', ['Every arm on that line can stop in a hundredth of a second. I test that it still wants to.', 'The yard moves a container every four seconds. Nobody has been hurt here in thirty years, and I count each day.']], ['process engineer', ['The foundry runs on off-peak power. At night this is the brightest place in the city.', 'Waste heat from the halls warms Bio-Eden in winter. Nothing here is thrown away twice.']]] },
};
export function buildLocals(D) {
  const r = new RNG(7777), out = [], used = new Set(), m = (h, mm = 0) => h * 60 + mm, jit = (t, j = 30) => t + Math.round(r.range(-j, j));
  const name = () => { let n; do { n = pick(r, FIRST) + ' ' + pick(r, LAST); } while (used.has(n)); used.add(n); return n; };
  const zoneNodes = { aeroport: D.byId.aeroport.nodes, bioeden: D.byId.bioeden.nodes, skyhaven: D.byId.skyhaven.nodes, neon: D.byId.neon.nodes, neonlow: D.byId.neon.low, oldearth: D.byId.oldearth.nodes, nexus: D.byId.nexus.nodes };
  for (const [zone, cfg] of Object.entries(LOCALS)) {
    const nodes = zoneNodes[zone];
    for (let i = 0; i < cfg.n; i++) {
      const [job, lines] = cfg.jobs[i % cfg.jobs.length];
      const plan = cfg.night ? [[0, 'stroll'], [jit(m(3, 30)), 'home'], [jit(m(15, 0)), 'stroll']] : [[0, 'home'], [jit(m(7, 30)), 'stroll'], [jit(m(12, 40)), 'home'], [jit(m(14, 0)), 'stroll'], [jit(m(21, 0)), 'home']];
      out.push({ id: `${zone}${i}`, zone, name: name(), job, lines, look: humanLook(r, cfg.look), home: pick(r, nodes.doors), plan, talk: true });
    }
  }
  // people who come to dance at Pulse
  for (let i = 0; i < 7; i++) out.push({ id: 'pulse' + i, zone: 'neonlow', club: 'neonlow:club', name: name(), job: pick(r, ['dancer', 'student', 'off-duty pilot', 'tattooist']), lines: ['Pulse has run every night for sixty years. Different crowd, same floor.', 'Come back after eight. Before that it is just a lit-up floor and a robot checking cables.'], look: humanLook(r, { visor: true, top: pick(r, ['#5b2e4f', '#4a3f6e', '#1c1f27']) }), home: pick(r, zoneNodes.neonlow.doors), plan: [[0, 'club'], [jit(m(4, 0)), 'home'], [jit(m(17, 30)), 'stroll'], [m(20, 0) + i * 5, 'club']], talk: true });
  // staff at their posts
  const staff = (zone, key, o) => { const p = zoneNodes[zone].posts[key]; out.push({ id: `${zone}:${key}`, zone, name: o.name || name(), talk: true, home: p.id, plan: [[0, 'post', p.id, p.face]], ...o, look: o.android ? droid(o.shell || '#dfe5ee', o.top || '#8a94a6', '#3b4250', o.accent || '#59e0ff', { antenna: true }) : humanLook(r, { coat: false, visor: false, ...(o.look || {}) }) }); };
  const worker = ['The schedule says what to do. I am here for when the schedule is wrong.', 'I do not tire. I do wear. There is a difference, and a maintenance budget.'];
  staff('aeroport', 'crew1', { android: true, role: 'worker', job: 'ground crew unit', top: '#ffb347', accent: '#ffd34d', lines: worker });
  staff('aeroport', 'crew2', { android: true, role: 'worker', job: 'ground crew unit', top: '#ffb347', accent: '#ffd34d', lines: worker });
  staff('aeroport', 'gate', { android: true, job: 'lift concierge', lines: ['The orbital lift carries cargo today. Passenger climbers resume when the upper station reopens.', 'A climber takes thirty-six hours. Most passengers sleep. A few stare the whole way.'] });
  staff('aeroport', 'dealer', { android: true, name: 'Marlo', role: 'aerodealer', job: 'AeroWisp exchange agent', top: '#2f6b55', accent: '#7dff9c', lines: ['Every class is on the floor. The Vanta is the one people stand next to for a photograph.', 'The Speed Loop runs round the whole field. Bring something quick.'] });
  staff('bioeden', 'cafe', { job: 'cafe keeper at Root & Leaf', lines: ['Everything on the counter was growing an hour ago.', 'People come for the tea and stay because nothing here beeps.'], shop: [{ label: 'Buy a living salad', price: 16, item: { name: 'Living salad', energy: 30 }, say: 'Still growing when I packed it. Eat it soon or water it.' }, { label: 'Buy Eden tea', price: 8, item: { name: 'Eden tea', energy: 10 }, say: 'Steeped from the dome garden. Mind the cup, it is warm.' }] });
  staff('bioeden', 'farm1', { android: true, role: 'gardener', job: 'field unit', top: '#2f6b55', accent: '#7dff9c', lines: ['Each bed reports its own thirst. I am the hands.', 'The pink light is the part of sunlight the leaves actually use. The rest was decoration.'] });
  staff('bioeden', 'farm2', { android: true, role: 'gardener', job: 'orchard unit', top: '#2f6b55', accent: '#7dff9c', lines: ['One sun-apple per tree per visitor per day. I am not permitted to enforce it. I am permitted to look disappointed.', 'The orchard is public. That was the founders one unanimous vote.'] });
  staff('skyhaven', 'host', { android: true, role: 'aurumhost', name: 'Sommelier-2', job: 'host at Aurum Table', shell: '#f1ede6', top: '#c9a24a', accent: '#ffd34d', lines: ['Please take any table. The menu appears when you sit.', 'We serve nine guests an evening. Tonight there is room.'] });
  staff('skyhaven', 'butler', { android: true, job: 'house unit', shell: '#f1ede6', top: '#e6dccb', lines: ['The residents are out. They are usually out. I keep the house in case they return.', 'I polish the same railing every day. It has never once been dirty.'] });
  staff('neon', 'arcade', { android: true, role: 'vrhost', job: 'Sim Arena attendant', top: '#5b2e4f', accent: '#7dff9c', lines: ['Forty-five seconds, as many targets as you can. The record holder has not been seen since.', 'Full-dive is safe. Your body stays right here. I watch it for you.'] });
  staff('neonlow', 'dj', { android: true, role: 'dj', name: 'Cadence', job: 'resident DJ at Pulse', top: '#1c1f27', accent: '#ff7ad9', lines: ['I read the floor: heart rates, footfalls, who is leaving. Then I change the next eight bars.', 'Doors at eight. Before that I am just a robot dancing alone, which I am told is unsettling.'] });
  staff('neonlow', 'bar', { android: true, name: 'Tin', job: 'bartender at the Tin Lantern', top: '#8a6a2f', accent: '#ffd34d', lines: ['I pour to the milliliter and I listen to everything. Both are in my contract.', 'No closing time. The last customer and the first one are often the same person.'], shop: [{ label: 'Buy a Volt tonic', price: 12, item: { name: 'Volt tonic', energy: 20 }, say: 'Electrolytes and something that glows. One at a time, please.' }, { label: 'Buy a slow amber', price: 18, item: { name: 'Slow amber', energy: 8 }, say: 'Aged eleven years in a cellar under this plate. Sip it.' }] });
  staff('neonlow', 'stall1', { job: 'noodle seller, night market', lines: ['Glass noodles, pulled by hand, cooked in ninety seconds.', 'Rent down here is a tenth of upstairs. So is the daylight.'], shop: [{ label: 'Buy glass noodles', price: 9, item: { name: 'Glass noodles', energy: 22 }, say: 'Careful, the broth is still boiling.' }] });
  staff('neonlow', 'stall2', { job: 'charm seller, night market', lines: ['Lantern charms. They do nothing. People have bought them here for a century.', 'Give one away and you get the luck. Keep it and you just have a lamp.'], shop: [{ label: 'Buy a lantern charm', price: 30, item: { name: 'Lantern charm', energy: 0, gift: true }, say: 'Give it to someone. That is how it works.' }] });
  staff('oldearth', 'cook', { role: 'cook', job: 'cook at Hearth', look: { top: '#f1ede6' }, lines: ['Sit down, I will come to you. The fire has been going since six.', 'No printer in this kitchen. The city gives us a heritage licence to burn real wood.'] });
  staff('oldearth', 'baker', { job: 'baker', look: { top: '#c9b68f' }, lines: ['The starter is older than the canopy. I feed it before I feed myself.', 'People queue here who could print a loaf in ten seconds. I never ask why.'], shop: [{ label: 'Buy a sourdough roll', price: 5, item: { name: 'Sourdough roll', energy: 14 }, say: 'Still warm. The crust is the point.' }, { label: 'Buy honey cake', price: 9, item: { name: 'Honey cake', energy: 16 }, say: 'Real honey, from the Bio-Eden hives.' }] });
  staff('oldearth', 'guide', { android: true, name: 'Docent-4', job: 'museum guide', top: '#6b4f3a', accent: '#ffd9a0', lines: ['Six objects on the plinths behind me. Read all six and the heritage fund pays you a stipend. People are surprised how long it takes.', 'I was built to explain the past to people who find it unbelievable. Business is steady.'] });
  for (let i = 0; i < 4; i++) staff('nexus', 'w' + i, { android: true, role: 'worker', job: 'assembly unit', top: '#ff9a52', accent: '#ffd34d', lines: worker });
  staff('nexus', 'sup', { role: 'qa', job: 'shift supervisor, hall 3', look: { top: '#34495e' }, lines: ['The scanner flags defects. A person still decides. That is the law, and I think it is right.', 'If you want work, the QA station is right there. Pay is per defect caught.'] });
  staff('nexus', 'yard', { android: true, job: 'yard marshal unit', top: '#d9b23a', lines: ['Four thousand containers. I know where each one is. Ask me about any of them. Nobody ever does.', 'The gantry and I have an understanding. It lifts. I stand clear.'] });
  return out;
}
