// The four Midtown squares: one open block in each quarter, 480 m out from Meridian on the
// compass lines. Each has a fountain, benches, a food stall with a keeper, a few regulars who
// live round it, and the hot food runs between the squares (systems/hubs.js).
// i, j: the block on the land-use grid (centre at 120 i, 120 j). North is -z.
export const HUBS = [
  {
    id: 'hubN', name: 'Lantern Square', quarter: 'Northbank', i: 0, j: -4, color: '#ffb347', pave: '#5a4636',
    keeper: { name: 'Hollis Ade', job: 'noodle seller, Lantern Square', lines: ['Hand-pulled, ninety seconds in the pot. The lanterns go on at six whether anyone is here or not.', 'Northbank works late. Half my trade is people eating standing up on their way back to the towers.'] },
    menu: [{ name: 'Lantern noodles', price: 11, energy: 26, say: 'Chilli oil on the side. You will want it.' }, { name: 'Ginger broth', price: 5, energy: 10, say: 'Hold it with both hands. That is half the cure.' }],
    dish: 'lantern noodles',
    locals: [['lantern maker', ['Every lantern on the square is paper over a light strip. The paper is the expensive part.', 'Northbank people walk fast. The square is where they remember not to.']], ['tower concierge', ['I open doors in the Halcyon all day, then come here to sit somewhere that does not open for me.', 'The noodles are better than anything printed in Meridian. Do not tell the Petal I said that.']], ['night-school teacher', ['Adults learning to code by hand, like it is a craft. It is a craft.', 'We meet above the stall. The smell of chilli oil is part of the curriculum now.']]],
  },
  {
    id: 'hubE', name: 'Circuit Plaza', quarter: 'Eastline', i: 4, j: 0, color: '#4de1ff', pave: '#2f4a5a',
    keeper: { name: 'Tamsin Okeke', job: 'repair-cafe keeper, Circuit Plaza', lines: ['Bring me a broken lens and buy a coffee. One of them will be fixed by the time the other is gone.', 'Eastline builds things. Most of them break near here, for some reason.'] },
    menu: [{ name: 'Solder-shot espresso', price: 6, energy: 16, say: 'Strong enough to wake a drone. Careful.' }, { name: 'Circuit bao', price: 9, energy: 22, say: 'The pattern on top is a real circuit. It does nothing.' }],
    dish: 'circuit bao',
    locals: [['drone mechanic', ['Courier drones come down in Eastline more than anywhere. Wind off the ring road.', 'I fix them on the bench by the fountain. People watch. I do not mind.']], ['firmware tester', ['My job is to find the one thing a robot should not do and make it do that.', 'The plaza is quiet at lunch. The best ideas come out of quiet.']], ['startup founder', ['Three companies, two failures. The third makes the little lights on the fountain.', 'Everyone here is building something. Ask anyone. They will tell you for an hour.']]],
  },
  {
    id: 'hubS', name: 'Tidewalk Square', quarter: 'Southgate', i: 0, j: 4, color: '#7dff9c', pave: '#36503f',
    keeper: { name: 'Marisol Vey', job: 'fish-taco cook, Tidewalk Square', lines: ['The fish swam in a farm off Solara Bay this morning. The tortillas are my grandmother\'s recipe.', 'Southgate smells of the sea when the wind turns. You can taste it in the salt.'] },
    menu: [{ name: 'Kelp-fish taco', price: 10, energy: 24, say: 'Lime first, then bite. That is the rule.' }, { name: 'Sea-salt lemonade', price: 4, energy: 8, say: 'The salt is from the bay. Trust me.' }],
    dish: 'kelp-fish tacos',
    locals: [['canal boat pilot', ['The canal runs past the end of the street. I eat here between trips.', 'Tourists ask if the canal is natural. Nothing in this city is natural except the weather, and only some days.']], ['harbour clerk', ['Every container through Tidewater crosses my screen. I come here to look at something that is not a container.', 'The square fills up after work. Southgate is the friendly quarter, everyone says so, mostly us.']], ['street painter', ['I paint the square every spring. The city pays me in tacos, more or less.', 'The fountain tiles were mine. Look for the fish. There are nine.']]],
  },
  {
    id: 'hubW', name: 'Foundry Yard', quarter: 'Westworks', i: -4, j: 0, color: '#ff7a45', pave: '#4f3b33',
    keeper: { name: 'Bram Okoro', job: 'grill master, Foundry Yard', lines: ['Westworks used to cast hull plates on this spot. Now I cast skewers. Better smell.', 'The yard keeps the old crane hook over the fountain. Nobody knows who owns it, so nobody can move it.'] },
    menu: [{ name: 'Foundry skewers', price: 12, energy: 28, say: 'Mind the end. It has been in the fire.' }, { name: 'Smoked corn', price: 6, energy: 14, say: 'Butter is on the counter. Take more than you think.' }],
    dish: 'foundry skewers',
    locals: [['retired welder', ['Forty years on the hull line. My hands still hum when the trams go past.', 'They kept the yard open so we would have somewhere to argue. It works.']], ['metal sculptor', ['I buy scrap off the Nexus by the kilo and sell it back as art by the gram.', 'Westworks is loud all day. The yard is loud in a nicer way.']], ['shift foreman', ['Night shift at the plating works, breakfast here at seven. Bram has the grill hot by then.', 'If you want something built in this city, ask in Westworks. Then wait a year.']]],
  },
];
export const HUB_AT = new Map(HUBS.map((h) => [h.i * 100 + h.j, h]));
