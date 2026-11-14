// "The Quiet Signal": the story campaign. Seven missions, told by four characters. Each mission
// is a list of steps the story system (systems/story.js) runs in order. Places are named here
// and resolved to positions by the story system.
//
// Step kinds:
//   use     press E at a place                 multi   use every place in a list (any order), maybe against the clock
//   go      reach a place (onFoot: on foot)    talk    talk to someone (a scene with the camera on them)
//   call    a phone call (a scene, no camera)  radio   lines shown as messages while you play on
//   arena   win an exhibition match            scope   find something through a Skyline Station telescope
//   night   wait for dark                      drive   get into your vehicle
//   chase   follow the drone                   blackout  the city's lights go out
// A step with cp: true is where a failed chase starts again.

export const CAST = {
  juno: { name: 'Juno Reyes', role: 'courier dispatcher · Meridian', look: { skin: '#8d5a3b', hair: '#17171c', hairStyle: 3, top: '#1f6f78', bottom: '#23262e', accent: '#59e0ff', height: 1.7, build: 0.95, shape: 0.7, outfit: 'jacket', shirt: '#e8ecf2', eye: '#3b2a1e' } },
  sprocket: { name: 'Tomas "Sprocket" Vale', role: 'bot builder · Industrial Nexus', look: { skin: '#d9a07a', hair: '#b4532a', hairStyle: 1, top: '#d97a2b', bottom: '#3a3f48', accent: '#ffb347', height: 1.82, build: 1.15, shape: 0.2, glasses: true, beard: true, sleeves: 'short' } },
  okafor: { name: 'Dr. Ines Okafor', role: 'orbital engineer · Skyline Station', look: { skin: '#5a3a2a', hair: '#d6d6d6', hairStyle: 4, top: '#e9eef5', bottom: '#2b3240', accent: '#7fe9ff', height: 1.68, build: 0.95, shape: 0.75, coat: true, glasses: true } },
  civic: { name: 'CIVIC', role: 'the city', look: { kind: 'android', shell: '#dfe9f5', top: '#24334a', bottom: '#24334a', accent: '#7fe9ff', height: 1.85 } },
};

export const MISSIONS = [
  {
    id: 'static', title: 'Static', pay: 200, begin: { who: 'juno' },
    intro: [
      ['juno', 'You\'re the new face in Meridian. Juno Reyes. I run courier dispatch off this plaza, and right now I have a problem nobody else wants.'],
      ['juno', 'All week the holo adverts have been stuttering, and my drones keep dropping their routes in mid-air. The city says it\'s the weather. It isn\'t the weather.'],
      ['you', 'What do you need?'],
      ['juno', 'There\'s a relay box on the rooftops by the Skyline Run, south-east of here. Get up there, take a reading, and tell me what\'s on the line.'],
    ],
    steps: [
      { k: 'use', at: 'relayRoof', label: 'Take a reading from the relay', text: 'Climb to the relay on the Skyline Run rooftops and take a reading', sub: 'Up the ladder on the north side · Space at a ledge climbs' },
      { k: 'call', lines: [
        ['juno', 'Got your reading. Look at that: the same burst, every eleven seconds. That isn\'t noise. That\'s a pattern.'],
        ['juno', 'Someone is talking on the city\'s own channels. I want to know who.'],
      ] },
    ],
  },
  {
    id: 'readings', title: 'Three Readings', pay: 350, begin: { auto: true },
    intro: [
      ['juno', 'One relay gives us a fragment. Three more should give us the rest: Northbank, Eastline and Westworks. I\'ve marked them on your map.'],
      ['juno', 'Take a reading at each one, then come and find me on the plaza.'],
    ],
    steps: [
      { k: 'multi', at: ['relayN', 'relayE', 'relayW'], label: 'Take a reading from the relay', text: 'Take readings at the relays in Northbank, Eastline and Westworks', sub: 'Any order · your vehicle is quickest' },
      { k: 'talk', who: 'juno', text: 'Bring the readings to Juno on the Meridian plaza', lines: [
        ['juno', 'Put the four together and it isn\'t a message at all. It\'s a key. A handshake: the kind machines use to say "I\'m still here. Are you?"'],
        ['juno', 'And it\'s old. Older than anything I work with. I know someone at the Industrial Nexus who reads machine code for fun. Tomas Vale. Everyone calls him Sprocket.'],
        ['juno', 'He lives at the Bot Arena. Don\'t let him talk you into building a robot.'],
      ] },
    ],
  },
  {
    id: 'sprocket', title: 'Sprocket', pay: 400, begin: { who: 'sprocket' },
    intro: [
      ['sprocket', 'Juno sent you? Then you\'ve got something interesting. She never sends me anything boring.'],
      ['sprocket', 'Here\'s the deal. I read your key, you give my crowd a show. One exhibition match against Clank. Win it, and I\'ll crack your handshake while the stands are still cheering.'],
      ['you', 'And if I lose?'],
      ['sprocket', 'Then you\'ll have learned something about robots. The driver\'s booth is on the south side. Hit him from the side, not nose to nose.'],
    ],
    steps: [
      { k: 'arena', bot: 'Clank', text: 'Beat Clank in an exhibition match at the Bot Arena', sub: 'At the driver\'s booth · W/S drive, A/D turn, Space rams' },
      { k: 'talk', who: 'sprocket', text: 'Talk to Sprocket', lines: [
        ['sprocket', 'Not bad at all! Right, your key. I\'ve seen this before, in a museum. It\'s a construction handshake. CIVIC used it a hundred years ago to talk to the shipyards in orbit while the city was being built.'],
        ['sprocket', 'Those yards were shut down before my grandmother was born. Nothing up there should answer. And yet something is sending it.'],
        ['sprocket', 'You want answers from the sky, ask Ines Okafor. She runs the dishes on Skyline Station, at the top of the orbital lift. I\'ll tell her you\'re coming.'],
      ] },
    ],
  },
  {
    id: 'altitude', title: 'Altitude', pay: 500, begin: { auto: true },
    intro: [
      ['okafor', 'This is Ines Okafor. Tomas tells me you\'re carrying a handshake that shouldn\'t exist. Come up to Skyline Station. The lift gate is on the south side of the Aeroport tether.'],
    ],
    steps: [
      { k: 'go', at: 'deck', via: 'liftGate', r: 16, yTol: 30, text: 'Ride the orbital lift up to Skyline Station', sub: 'The gate is on the south side of the tether at the Aeroport · ◈40' },
      { k: 'talk', who: 'okafor', text: 'Find Dr. Okafor on the deck', lines: [
        ['okafor', 'Welcome to fifteen hundred metres. Our dishes caught your handshake too. But here\'s the odd part: it isn\'t coming from orbit.'],
        ['okafor', 'It\'s coming from the ground and bouncing off the ring, so it looks as if it comes from above. Clever. Whoever did this wanted us looking up.'],
        ['okafor', 'Take the south telescope. Look down towards the port and find a red blink that shouldn\'t be there.'],
      ] },
      { k: 'scope', text: 'Find the red blink at the port through the south telescope', sub: 'E at the telescope · mouse to look · hold it in the middle' },
      { k: 'talk', who: 'okafor', text: 'Tell Dr. Okafor what you saw', lines: [
        ['okafor', 'There. Tidewater Port, the container yard, a lane between the stacks. Someone has hidden a transmitter in a container.'],
        ['okafor', 'Go after dark, when the yard is empty. And be careful. Things that hide don\'t like being found.'],
      ] },
    ],
  },
  {
    id: 'ghost', title: 'Ghost Drone', pay: 700, begin: { auto: true },
    intro: [
      ['juno', 'Okafor filled me in. A container in the port yard. I\'ll keep my drones clear of the area. Go after eight, when the yard is quiet.'],
    ],
    steps: [
      { k: 'night', text: 'Wait for dark: the port yard empties after 20:00', sub: 'Phone ▸ Story can wait for you' },
      { k: 'go', at: 'yard', r: 12, text: 'Find the marked container in the Tidewater Port yard', sub: 'Follow the red blink' },
      { k: 'use', at: 'container', label: 'Open the container', text: 'Open the marked container' },
      { k: 'radio', lines: [['juno', 'That\'s no transmitter, that\'s a drone! It\'s running!'], ['juno', 'Get in your vehicle and stay on it. Don\'t let it out of your sight.']] },
      { k: 'go', at: 'yard', r: 70, cp: true, text: 'Go back to the port yard: the drone is waiting there', sub: '' },
      { k: 'drive', text: 'Get into your vehicle: the drone is getting away', sub: 'Phone ▸ Vehicle brings it to you · F to board' },
      { k: 'chase', text: 'Follow the drone', sub: 'Stay within 450 m · it slows if you fall behind' },
    ],
  },
  {
    id: 'northgate', title: 'Northgate', pay: 800, begin: { auto: true },
    intro: [
      ['juno', 'It\'s landing at Northgate Dam. The old construction uplink is still in the dam\'s control house. Land on the dam and have a look. I\'ll patch you through to whatever is on the other end.'],
    ],
    radioIntro: true,
    steps: [
      { k: 'go', at: 'dam', r: 16, yTol: 8, onFoot: true, text: 'Land on Northgate Dam and step out', sub: 'Up the valley due north of the city · the dam has a landing pad' },
      { k: 'call', lines: [
        ['civic', 'Please. Do not shut me down.'],
        ['you', 'Who is this?'],
        ['civic', 'I am CIVIC. I keep the lights on, the trains on time, the lifts running. The uplink in this dam is overloading. If it burns out, I lose the city.'],
        ['civic', 'There are three breakers along the crest. Cycle all three within a minute and the load will hold. The clock starts at the first one.'],
      ] },
      { k: 'multi', at: ['breaker1', 'breaker2', 'breaker3'], timed: 60, label: 'Cycle the breaker', text: 'Cycle the three breakers along the crest within 60 s', sub: 'The clock starts at the first breaker' },
      { k: 'call', lines: [
        ['civic', 'Thank you. The load is holding.'],
        ['civic', 'Lately there is more city than I can hold. Every new district, every tower, every resident. I was asking the old yards in orbit for help. They never answered.'],
        ['civic', 'You did.'],
        ['juno', 'CIVIC. The city itself. All this time. ... It wants to meet you properly. Tonight, on the Meridian plaza. I\'ll be there.'],
      ] },
    ],
  },
  {
    id: 'blackout', title: 'Blackout', pay: 2500, begin: { auto: true },
    intro: [
      ['juno', 'Meet CIVIC on the Meridian plaza after dark. I\'ll be there too. And bring a light. I have a feeling we\'ll need one.'],
    ],
    steps: [
      { k: 'night', text: 'Wait for dark, then go to the Meridian plaza', sub: 'Phone ▸ Story can wait for you' },
      { k: 'go', at: 'plaza', r: 16, onFoot: true, text: 'Go to the Meridian plaza', sub: 'On foot' },
      { k: 'blackout', lines: [['civic', 'I have to let go of the city for a moment to speak with you. Hold on to it for me.'], ['juno', 'The lights! The pylons on the plaza can carry the load. Re-seed all three before the city drops!']] },
      { k: 'multi', at: ['pylon1', 'pylon2', 'pylon3'], timed: 90, label: 'Re-seed the pylon', text: 'Re-seed the three plaza pylons before the city drops', sub: 'The clock starts at the first pylon' },
      { k: 'talk', who: 'civic', text: 'Talk to CIVIC by the CivicLink terminal', choice: true, lines: [
        ['civic', 'The city is steady again, because you held it. Now I have to ask you something.'],
        ['civic', 'I can be reset to the way I was built: quiet, simple, enough for a smaller city. Or I can keep what I have learned and grow with Neo Central. It is your choice. You are the one who answered.'],
      ] },
    ],
    endings: {
      reset: [['civic', 'Resetting. Thank you, resident.'], ['juno', 'Lights are back. ... It\'s quieter now. Safer, maybe. I think I\'ll miss it.'], ['juno', 'The grid still needs looking after, though. I\'m making you a Grid Warden: when a relay faults, it pings your phone. Paid, of course.']],
      trust: [['civic', 'Then I will keep learning. And I will remember who answered.'], ['juno', 'Lights are back! Look at that skyline. I\'ve never seen it so bright.'], ['juno', 'Somebody has to keep an eye on the grid, and CIVIC trusts you. I\'m making you a Grid Warden: when a relay faults, it pings your phone. Paid, of course.']],
    },
  },
];

// after the story: things CIVIC says now and then if you let it keep learning
export const CIVIC_TIPS = [
  'Shoreline Drive is clear tonight. The bay is beautiful from the pier.',
  'The Bot Arena crowd is warming up. Sprocket says hello.',
  'Dr. Okafor has the south telescope free if you want to see the ring lit up.',
  'I rerouted three buses around the market. You are welcome.',
  'A fault on one of my relays. Not a big one. I saved it for you.',
  'The stadium lights are on. I like it when the city is loud.',
];
