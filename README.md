# NEO EARTH 2226 — Phases 1 to 5, the expansion round, Greater Neo Central, rooftops, robots and the orbital lift, a more futuristic look, and the story

Neo Central: one continuous city of about 3.2 km × 3.2 km, from the houses of Arbor Heights to the sea, running as a real-time 3D game in the browser. Meridian Quarter and the six original districts sit inside a street grid with a park, a canal, a beach, a port and an island offshore.
No story. Walk, talk, eat, work, ride, race, fly; the district keeps its own schedule.

- **Phase 1:** the playable neighborhood (walk, interiors, residents, aerocar, food, jobs, economy).
- **Phase 2:** living-city systems (full population, social life, public transport, emergencies, services, weather effects, daily events).
- **Phase 3:** transportation and minigames (five vehicle classes, dealership and tuning, flight upgrades, racing, drone piloting, new jobs, entertainment, career ranks, investments).
- **Phase 4:** world expansion (Aeroport, Bio-Eden, Skyhaven, Neon District, Old Earth, Industrial Nexus; district shuttle; 87 district locals; one or more activities in each).
- **Phase 5:** polish and optimization (rebuilt characters and animation, resident variety, safer collision, a rendering overhaul, district sound, a color grade, settings and pause, error recovery, save backup).
- **Expansion round:** new character bodies and faces, walk-in shops everywhere, upgraded homes, transit gates, a jet harness, rideable bus and tram, sky cabs, highways and a ring road, a larger map, more detailed buildings, bowling, darts, fishing, arcade cabinets and milestones.
- **Greater Neo Central (the big map update):** a street grid over the whole map with 1,423 buildings of 15 kinds, about 20,900 pieces of street furniture and 6,600 trees, avenues with working signals and traffic, three bus lines, street furniture you can use, Grand Arbor Park, the Meridian Canal with five bridges, Solara Bay (beach, boardwalk, pier, big wheel), Tidewater Port, Beacon Isle, a wind farm and a sea platform, Arbor Heights with a townhouse for sale, passers-by, a ferry, a rowboat and a jet-ski. Details in "Greater Neo Central" below.
- **Living city update:** real car, taxi, van and truck models for all road traffic and parked vehicles, signals wherever a highway or the ring road crosses a street, livelier passers-by (children, elders, dogs, people at the bars and cafes), and a week of events: live music in the park, fireworks over the bay, a weekend market. Details in "Living city" below.
- **Reasons to cross the map:** a street race through Eastline, a boat race down the (now sunken) canal, street taxi shifts, crashes with traffic, a beach villa for sale and renting out your homes, a basketball shootout, and Skyhaven Stadium with skyball matches and the Expo grounds. Details in "Reasons to cross the map" below.
- **Looks:** waves and glints on all the water, foam washing up the beach, a mountain range with Northgate Dam and its reservoir in the north, and concrete medians and guard rails on the highways and the ring road. Details in "Looks" below.

## Play on the web

**https://ruibinray.github.io/NeoWorld/**: plays in a desktop browser (Chrome, Safari, Edge or
Firefox) with a keyboard and mouse or a gamepad. There are no touch controls. Each push to `main`
rebuilds and republishes it (`.github/workflows/pages.yml`, about a minute). The web version keeps
its own save in that browser; to bring progress across, use Pause ▸ Save to a file, then "Load a
save file" on the title screen.

## Run

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5226. Click the view once so the mouse controls the camera.

Or double-click **Play NEO EARTH.command** in this folder: it starts the game's server if it is
not already running (and installs the packages the first time), then opens the game in your
default web browser. Each browser keeps its own save, so a game started in one browser does not
appear in another: use a save file to move it (below).

**A copy to share:** `npm run share` writes `share/NEO EARTH 2226.html`, the whole game in one
file of about 3.4 MB (script, styles and pictures inside). It needs no server and nothing installed:
double-click it, or send it to someone. It keeps its own save in the browser that opens it.

## Controls

| On foot | In a vehicle |
| --- | --- |
| `WASD` move, mouse or arrow keys look | `W/S` thrust, `A/D` turn |
| `Shift` sprint, `Alt` walk slowly | `Space` climb / take off, `C` (or `Ctrl`) descend / land |
| `Space` jump, `C` crouch; in front of a ledge up to about 2.3 m, `Space` pulls you up (or vaults a low wall); in deep sea water `C` dives | `Shift` boost |
| `V` first person, `B` hoverboard (once bought) | `V` cockpit view |
| `E` interact / talk / sit / eat / lifts / board the maglev | `E` charge when parked on a pad |
| `F` board your vehicle | `F` step out, `T` autopilot, `R` radio station |
| `Tab` lens menu (status, career, pocket food, drone delivery, wait, valet, save) | |
| `P` pause: settings (graphics quality, volume, music, battle music, car radio, spoken lines, mouse lock, mouse), controls, unstuck, save | same |
| `Q` phone: bring a vehicle to where you stand, jump to a gate, a home or your vehicle, map, cab, jobs, food, milestones, camera, settings | |
| `M` full map (click a transit gate to travel) · `J` jet harness (once bought) · `O` photo mode (hides the interface; `Enter` or click takes a picture) | `M` full map |

**Gamepad** (Xbox or PlayStation layout): left stick move (a light tilt walks), right stick look, A jump or climb, B crouch, X use, Y board or step out, LT sprint or boost, RT throttle, LB phone, RB view, View map, Menu pause, L3 hoverboard, R3 jet harness. On the title screen, in menus and on the phone: D-pad or stick to choose, A to pick, B to go back.
On a ladder: `W/S` climb, `Shift` faster, `Space` lets go. Bot Arena: `W/S` drive, `A/D` turn, `Space` ram, `F` forfeit.
**Mouse:** once you are in the world the cursor locks to the game and the mouse steers the camera. `Esc` frees the mouse; click the game to lock it again. Settings ▸ Lock the mouse in the world turns this off (then hold a mouse button and drag to look). Some embedded browser views (such as the Claude app's browser pane) never allow the lock; the game says so and dragging still works.
Number keys pick menu options. `H` hides the control hints. While piloting a drone: `W/S` thrust,
`A/D` turn, `Space/C` height, `F` recall. Grav-Hoops: aim with the camera, hold `Space` to charge, release to shoot.

## Where things are

- **Skyport (west of the park):** your vehicle, Vesper (Flight Ops: air taxi, Canyon Sprint, Ring Road GP, cargo runs, drone delivery, vehicle exchange and tuning, repairs), the showroom, the Grav-Hoops court.
- **CivicLink (north gate of the park):** courier runs, Commons Drone Slalom, investments, career summary, notices.
- **Printed Petal (north of the park):** meals, kitchen shift (ask the chef).
- **Kinetic Robotics (east of the park):** robot dog, household android, hoverboard, diagnostics job (ask Kit).
- **Commons stage (south of the park):** concert and dance pad from 20:00, morning movement session at 06:10.

**New in the expansion round**

- **Shops you can walk into:** the five Old Quarter shops south of the park (Analog Records, Bao & Broth, Tea House, Repair Cafe, Paper Books), Root & Leaf in Bio-Eden, the Old Earth bakery, the Tin Lantern bar and the Sim Arena in the Neon District, and the AeroWisp Exchange hangar at the Aeroport.
- **Phone (`Q`):** the Vehicle app puts any vehicle you own on open ground beside you (not indoors); the Travel app jumps to any transit gate, a home you own, or your vehicle, with a 12-second recharge.
- **Repair Cafe:** sells the jet harness (◈3,200), patches your hull and tunes your hoverboard.
- **Transit gates:** a ring near the park's north gate, one beside each district's shuttle kiosk, one at each home you own. Step from any gate to any other, or use the phone.
- **Rides:** the robo-bus stops twice on its loop around the park; the Old Earth tram stops on both sides of the square; stand on any public landing pad to call a sky cab.
- **Roads:** highways leave Meridian for the Aeroport, Bio-Eden, the Neon District and Old Earth; a ring road at 560 m joins them and carries the spurs to the Nexus and to the Skyhaven ground lift.
- **Home:** kitchen printer and pantry, work terminal, lighting themes, a turntable, sofa seats; furnishings from the shops and the lake appear there. The villa has a pool.
- **Games:** bowling and two arcade cabinets in the Sim Arena, darts in the Tin Lantern, fishing from the jetty on the Bio-Eden lake. Milestones are listed in the lens (`Tab`).

**The outer districts** (about 900 m from Meridian; fly there, let autopilot take you, or use a District Shuttle kiosk: Meridian's is at the Skyport taxi rank; `Tab` → Districts and shuttle shows the map)

| District | What it is | What you can do |
| --- | --- | --- |
| Aeroport (west) | terminal, control tower, airliners, hangars, the orbital lift | vehicle exchange (Marlo), Speed Loop time trial, long-haul cargo destination |
| Bio-Eden (north) | climate dome with a lake, vertical forests, farms | swim to the island, pick sun-apples, Root & Leaf cafe |
| Skyhaven (north-east, 450 m up) | floating decks, mansions, gardens | Aurum Table (table service), buy the villa (◈38,000) and sleep there |
| Neon District (east) | neon avenues on raised plates, the Undercity beneath | lifts between levels, Sim Arena target range, Tin Lantern bar, night market, Pulse club after 20:00 |
| Old Earth (south) | preserved old town under a solar canopy | Hearth tavern (table service), bakery, tram, six museum exhibits (stipend for reading all) |
| Industrial Nexus (south-west) | automated halls, conveyors, cooling towers, container yard | line QA shift, long-haul cargo destination |

## Engine and assets: what this is and is not

- **Engine:** Three.js (WebGL), not Unreal Engine 5. This machine has no Unreal Engine or Xcode
  and 8 GB of RAM, so a UE5 project could not be built or tested here. Everything in `src/`
  is engine-agnostic in design (schedules, nav graph, flight model, economy) and is the spec for a UE5 port.
- **Art:** procedural models (no model files), stylized low-poly, not photoreal. The only image files
  are pictures made with Canva's and Higgsfield's AI image generators: see "Artwork" below.
- **Higgsfield:** the Higgsfield connector can only read (balance, models, past generations), but
  the Higgsfield API, with your API key, generates images: eleven pictures for Hero Mode, adverts
  and the framed print were made with it on 13 November 2026 (see "Artwork"). The key is never
  stored in this folder or in the game: the docs warn against putting it in browser code.
  `tools/higgsfield.mjs` calls the API with a key read from the `HF_API_KEY_ID` and
  `HF_API_KEY_SECRET` environment variables: `node tools/higgsfield.mjs check` tests the key for
  free, and `image "<prompt>" out.jpg` makes one Soul picture (billed to your API balance). 3D
  models are not something it makes; GLB models you make elsewhere could be dropped in later.
- Characters are stylized, not realistic. They now have shaped bodies with continuous limbs, faces with eyes that glance, brows, a nose, lips that move when speaking, layered clothing and hands, but no cloth simulation, no individual fingers and no recorded voices.
- Residents browse the shops but do not buy anything or use the shop seats; clerks never leave the counter. Hearth, Aurum Table, the House of Old Things and the market stalls stay open-air. The Lumen Exchange is an office tower with no interior.
- Highway traffic is simple: pods keep to their lane and brake for you, but do not collide with your vehicle. The Skyhaven and Nexus spurs start at the ring road because megatowers stand on the direct line.
- The larger flyable area has skyline towers but no new districts.
- The new games were tuned with scripted players, not human play.
- Mid-distance residents are simplified figures; they become full characters when you get close.
- Rival riders follow the racing line with rubber-banding; they do not block or collide.
- Business shares are a one-time purchase with a fixed daily dividend; you do not run the business.
- Audio is fully synthesized, including all music. Spoken lines use the computer's own speech voices, so they sound like a screen reader, not actors. The sounds were checked for running without errors, not judged by ear.
- Dialogue: written lines chosen by context, memory, mood and news, not open conversation.
- Old Quarter shops, the bus and the Old Earth tram: visible and moving, cannot be entered or ridden.
- District locals only stroll, stay home or work a post: they have no full daily plans, seats or commutes.
- District buildings are facades and open-air spaces; only the Hearth terrace, Aurum pavilion, the villa and the Undercity are walk-in.
- The Neon "Undercity" is ground level under raised plates, not a dug-out level.
- Swimming is wading with a swim animation; there is no depth or diving.
- Mouse look uses pointer lock; automated tests drove the camera by keyboard only.
- Medal times and payouts were calibrated with scripted test pilots, not human play.

**Not built yet**

Rooftop parkour, robot tournaments; climbing; true underground levels;
more than one vehicle out at a time; riding the orbital lift; thousands of residents;
photoreal characters and animation.

## Greater Neo Central

**Where things are** (north is up on the map, `M`)

| Area | Where | What is there |
| --- | --- | --- |
| Midtown (Northbank, Eastline, Southgate, Westworks) | all round Meridian, out to the districts | street grid of 120 m blocks: towers, slabs, stepped terraces, twin towers, retail rows, malls, civic halls, charging hubs, building sites, plazas with fountains and food trucks |
| Grand Arbor Park | south-east, between Neon and Old Earth | boating lake with an island, lookout hill, jogging loop, plaza, amphitheatre, the Glasshouse cafe, ball court, dog run, four gates |
| Meridian Canal | from the park lake west, then south to the sea | railings, two footbridges, Park Avenue bridge, the highway bridge to Old Earth, the Tidewater Gate bridge at the mouth |
| Solara Bay | south-east coast | 1 km beach with umbrellas and loungers, boardwalk with palms, pier with the big wheel, surf shop, Driftwood Bar, volleyball court, jet-ski jetty, resort hotels and villas behind |
| Old Earth seafront | south, below Old Earth | promenade, sea wall, bandstand |
| Tidewater Port | south-west coast | container yard, four gantry cranes with moving trolleys, two ships, fish market, ferry jetty, warehouses behind |
| Offshore | south of the coast | Beacon Isle (lighthouse with a turning beam at night, cottage, jetty), a wind farm, a sea platform with a landing pad, sailboats, a freighter on the horizon |
| Arbor Heights | north-west | streets of houses with gardens, a green with a playground, a school, a shop parade with the corner shop, a townhouse for sale (◈16,000) |
| Skyhaven Green | north-east, under Skyhaven | lawn and trees round the sky lift |

**Getting around the new parts**

- **Roads:** every street is drivable. Junctions have signals; avenue traffic stops at red, queues, brakes and honks for you.
- **Busier streets:** the avenues carry a pool of 72 vehicles around you (was 38), placed from 70 m
  away and weighted toward the near streets; closer than 200 m only where the camera is not looking,
  so no car ever pops into sight. Meridian's own streets have two cars round each block, nine on the
  outer avenue and five on each cross street (was one, three and two), spread evenly so they do not
  queue. On the downtown street by the Swing Course there are now 6-9 vehicles within 120 m (was 0-2),
  and 40-50 within 250 m; traffic costs under 1 ms a frame.
- **The park lawn** is a soft, low-contrast grass (broad light and dark patches, thin blades in close
  shades, lightly blurred) instead of a tile of bright and dark specks that read as static.
- **The far skyline** (620 simple towers 1.7-3.4 km out, past the edge of the street grid) is a
  backdrop meant to be seen from the city; the gaps between those towers have no streets or people.
- **Route on the map:** open the map (`M` or the phone's Map app) and click anywhere to set a route along the streets; a blue line shows on the map and minimap. Click its end again to clear it.
- **Buses:** M1 Park and Beach, M2 Harbor, M3 Heights. Wait at a stop shelter and press `E` when the bus is standing there. Any shelter shows the lines and times.
- **Ferry:** Tidewater Port → Beacon Isle → Solara pier → Port. Board from the jetty when it is alongside.
- **Transit gates and the phone:** five new gates (park, Solara Bay, port, Arbor Heights, Beacon Isle) plus the townhouse once you own it.
- **Landing pads:** Solara Bay, Tidewater Port, Arbor Heights green and the sea platform, for autopilot and sky cabs. The flyable area is 2.6 km.

**Things to do**

| Where | What |
| --- | --- |
| Any pavement | sit on benches, buy from vending machines and food trucks, toss a coin in a fountain, say hello to passers-by |
| Any bin | street clean-up: collect ten marked pieces of litter, empty the bag in a bin (◈5 each, bonus for all ten) |
| Any parcel locker | take a parcel to another locker 300 m to 1 km away for a fee; the route is set for you |
| Park jetty | rowboat on the lake (free); row to the island |
| Park court | free throws, ten shots |
| Pier | the big wheel (◈8, one turn, about 90 s), fishing, a food truck |
| Beach | volleyball (ten serves), loungers, jet-ski hire (◈15, or a season pass from the surf shop) with a six-buoy bay run against the clock |
| Shops with a counter | the Glasshouse, Longboard Surf Shop, Driftwood Bar, Tidewater Fish Market, Heights Corner Shop |
| Townhouse | kitchen, bed, wardrobe, console, your furnishings |
| Everywhere | 20 more data caches, 7 more milestones |

**How it is built**

- One land-use table (`src/world/metro/landuse.js`) gives every block a use; ground, buildings, streets and the map are generated from it.
- The layout of every block (buildings, furniture, trees) is generated as plain data at start from a fixed seed, so the city is the same every time. All colliders are registered then.
- Building bodies are merged into one mesh per facade style for the whole city (about a dozen draw calls), so the skyline never pops in.
- Street-level detail is built only for 240 m tiles within 400 m of you (330 m on Medium, 250 m on Low), one block per frame, and freed when you leave. Furniture is written straight into shared buffers with the colour in the vertices, so a tile is four to six meshes.
- Water is a flat sheet with the swim state, as in the Bio-Eden lake. The park hill and Beacon Isle use a ground-height hook in the collision code.
- Four districts (Aeroport, Bio-Eden, Neon, Old Earth) were moved 10 m so their edges line up with the grid, and the megatowers were moved onto block plots. A save from before this update that was inside one of those districts puts you at its gate kiosk.

**Tested (by script, driving the real controls)**

- Every street segment (1,003) probed in both lanes for anything solid: clear. Routes from Meridian to the beach, the port, the Heights and the east edge: clear.
- Avenue traffic: 38 pods (now 72) stayed on streets, stopped at red. Bus: waited at a stop, boarded, rode to the next stop, got off there. Ferry: Port to Beacon Isle, got off on the jetty.
- Bench, vending machine, litter job (ten pieces, paid), parcel run (paid), rowboat, jet-ski with a full bay run, big wheel (one turn, back on the pier), volleyball, free throws, pier fishing, all five shop counters, buying the townhouse and using its kitchen and bed.
- Autopilot to the Solara Bay pad and to the sea platform landed with no damage.
- One full game day across 15 places in every new area: no errors. 319 tiles built and freed over 50 trips: geometry and texture counts unchanged (no leak).
- A save with the new fields removed loads with its progress.

**Draw calls after the update** (exact; best to worst of eight view directions at each spot)

| Spot | Noon | 20:30, market and concert on |
| --- | --- | --- |
| Meridian Commons | 296 to 403 | 361 to 446 |
| On Meridian's border, looking across the quarter | 174 to 464 | 259 to 559 |
| Midtown street | 184 to 397 | 255 to 479 |
| Grand Arbor Park, lake | 124 to 322 | 139 to 338 |
| Boardwalk | 111 to 354 | 129 to 379 |
| Pier head | 91 to 356 | not measured |
| Port quay | 96 to 352 | not measured |
| Arbor Heights green | 117 to 382 | 133 to 402 |
| East edge of the map | 110 to 366 | not measured |

The target was 600 and every spot measured is inside it. The first version of this update reached
680 on Meridian's border; that was fixed by sorting the quarter's 359 small separate parts
(stall parts, door panels, labels, home furnishings) into three size classes that are hidden at
130 m, 300 m and the quarter's own range, and by not drawing the six delivery drones beyond 280 m
or the showroom robots beyond 72 m. Those were being drawn from anywhere on the map, so every
other spot dropped by 100 to 150 calls as well.

Building a tile usually takes 1.4 to 3.9 ms in a frame (target 4 ms); one 6.6 ms step was seen in
Arbor Heights. Game logic stays under 1 ms. Frame times were only measured in a small background
preview (9 to 13 ms at 853 × 355), so the frame rate at a full-size window is not verified.

**Finished and prototype**

| Finished | Prototype or simplified |
| --- | --- |
| Ground, streets, signals, bridges, bus lines, ferry, building shells and detail, street furniture and its uses, park, beach, pier, port, isle, suburb centre, townhouse, gates, pads, map and routes, saves | Passers-by: 64 walkers plus joggers, strollers and people on benches, with no homes or schedules; twelve looks between them |
| | Water: flat geometry with drawn-in waves (no real swell), foam along the shore; the canal lies below its bridges, so boats pass under them there |
| | One hill (and the isle) only; everything else is flat |
| | Generic Midtown buildings cannot be entered; their shop fronts are facades |
| | (Fixed in the living city update: vehicles are real models, and highway crossings have signals) |
| | (Fixed: highways now have medians and guard rails, open where streets cross at the signals) |
| | (Fixed: the park court is now a real basketball shootout; volleyball is still a timing game) |

**Not built in this update:** a campus and a maglev line to the coast. (The Expo grounds and stadium, and the mountains in the north, came later; see below.)

## Living city

**Traffic**

- Every moving vehicle on the roads (Meridian's streets, the avenues, the highways and the ring road) is now one of four models: a city car, a taxi, a van and a box truck, with wheels, glass, lamps and side strips. Parked cars along the kerbs and lorries outside the port's warehouses use the same models. All moving vehicles together cost nine draw calls.
- Where a highway runs along a street for 20 m or more, the street is handed over to the highway (12 short street segments). Everywhere else a highway or the ring road crosses a street there is now a crossing with signals: 45 in all. The 27 that fall inside or next to a junction give that junction a third signal phase for the highway; the other 18 have their own two-phase signal with poles, heads and stop lines on both roads.
- Highway traffic, avenue traffic and the buses all stop for these signals. Highway vehicles queue behind each other, and never drive into a car or bus that is still crossing. Avenue cars wait for the junction box to clear, give way at junctions without signals, turn only into a lane with room, and keep their distance from buses. Pedestrians only cross a junction when the highway through it is held too.

**People**

- 24 passer-by looks instead of 12, including three children and three elders. Every seventh walker has a child alongside, and every ninth walks a dog (the four nearest dogs are shown). A few families stroll the boardwalk.
- Seats at the Driftwood Bar and its terrace fill up from late afternoon, the Glasshouse tables in the daytime, and benches on the pier and Beacon Isle.
- Passers-by thin out in heavy rain.

**Events** (the week starts on a Friday; the day is shown on the HUD and in the phone's new **What's on** app, which sets a route to any of them)

| Event | When | Where | What happens |
| --- | --- | --- | --- |
| Arbor Live | Wednesday to Sunday, 19:00 to 22:30 | Grand Arbor Park amphitheatre | a three-piece band on stage, light beams, a screen, about 70 seated and 28 dancing; live music; join in with "Dance with the crowd" |
| Fireworks over the bay | Friday and Saturday, 21:30 to 22:15 | a barge off Solara Bay | shells every one to two seconds (peony, ring, willow, crackle, two-colour), a faster finale, the boom arriving late with distance, a flash that lights the beach; a crowd on the sand and the pier from 21:00 |
| Weekend market | Saturday and Sunday, 09:00 to 16:00 | the plaza at Avenue 20 & L Street | ten stalls with keepers and shoppers: tacos, fruit, vinyl, flowers, prints, bread and honey, tea, a repair bench, a book swap, noodles; furnishings go to your home |

Events that are on show as orange rings on the map. Two new milestones: "Night out" (the concert from the front, and the fireworks) and "Market day".

**Tested (by script)**

- Six areas, four minutes each with all traffic running: no highway vehicle overlapped an avenue car or a bus; no highway vehicle stayed stopped for more than 90 seconds. Four brief overlaps between avenue cars remain, all at junctions, when a car turning in meets one going straight.
- A full game day from Friday 08:00 to Saturday 14:30 across ten places: the concert, the fireworks and the market all ran; no errors; memory returns to about 205 MB after garbage collection.
- Bought from a market stall, set a route from What's on, saw the concert and the fireworks from the beach.

**Performance**

- The four vehicle models replace about 50 separate meshes for Meridian's street traffic and two box meshes elsewhere; the crossing signal lamps are one instanced mesh.
- In a 1280 × 720 window in the app's preview, frame render times were 20 to 22 ms at render scale 1.0 and 32 to 39 ms at 1.5. The game lowers its render scale on its own when frames run long, so it should settle near scale 1.0. These numbers were noisy (the preview runs in the background), so the frame rate on your own screen is still not verified.

**Limits**

- Event crowds are simple figures except the few within 16 m, which get detailed rigs (one per look).
- The band's music is the same simple generated loop as the Commons stage.
- A car turning at a junction can still briefly overlap one going straight.


## Reasons to cross the map

| What | Where and when | How it works |
| --- | --- | --- |
| Midtown Night Run | the corner of Avenue 20 and N Street, Eastline; any time; ◈30 | two laps of a 1.5 km square of streets in live traffic, against three drivers; everyone drives a loaned Vanta GT; every red light run costs 2 s, rivals included; places are by time plus penalties; prizes ◈800 / 450 / 200 / 60; wrecking the car ends the race |
| Canal Dash | the steps by Park Avenue bridge; any time; ◈20 | a jet boat race down the canal to the sea lock, under five bridges and round the bend, through 12 gates, against three rivals; prizes ◈400 / 200 / 80 |
| Street taxi | start a shift at any CivicLink terminal or the phone's Jobs app | fares wait at the kerb 150 to 400 m away (marked on the map, route set); they ask for named places 0.5 to 1.6 km away by road; fare ◈18 plus about ◈55 a km; a quick, clean ride earns a tip; red lights and knocks cost stars; flying with a fare aboard halves it; eight fares to a shift |
| Traffic you can hit | every road | your vehicle on the ground now collides with cars, vans, trucks and race cars: it is pushed off, slowed and dented when the knock is hard |
| Solara Bay beach villa | across Shoreline Drive from the beach; ◈26,000 | a home like the townhouse: kitchen, bed, wardrobe, console, your furnishings; a roof terrace and a pool; its own transit gate |
| Renting out | the console of the townhouse or the beach villa | tenants pay every morning (townhouse ◈160, beach villa ◈310 a day); you cannot use a home while it is let; you must keep one home for yourself |
| Shootout | the court in Grand Arbor Park | ten shots from five spots round the east hoop with a real ball: aim with the mouse, hold Space for power, look up for a higher arc; the ball bounces off the rim, the board and the floor; 2 points from the free-throw line, 3 from the arc |
| Skyhaven Stadium | Skyhaven Green, under the deck; Tuesday, Thursday and Saturday 18:00, Sunday 14:00 | the Harbor Sharks at home to the Comets, the Volts or the Owls; buy a ticket at the desk (◈12) and watch from your seat in the south stand (first person); bet ◈50 on a side (◈95 back if they win, your stake back on a draw); about 240 people in the stands, cheering when their side scores; two scoreboards; the match is played whether you watch or not |
| Expo grounds | next to the stadium | a glass dome with a garden, a spiral tower, a flag plaza, a landing pad, a transit gate, and the Expo Hall: six exhibits about how the city was made, and a gift shop |

**The canal** now lies 2.4 m below the streets between stone walls, with a weir at each end where it meets the park lake and the sea. Four sets of steps lead down to pontoons, so you can climb out if you fall in.

**New milestones:** Landlord, Season ticket holder (a whole match from your seat), Expo pass (all six exhibits), Street and water (win both races), Cabbie (ten street fares).

**Tested (by script)**

- Night Run: a driving script finished both laps (32 gates) and was placed correctly by time plus penalties, then the loaner car was handed back. With traffic running, the same script kept crashing into cars and wrecked the car; it cannot dodge traffic as a person would.
- Canal Dash: the script won in 38.3 s, the prize was paid, and you are put on the finish pontoon. Walking down the steps, swimming in the canal and climbing back up all work.
- Street taxi: pickup, destination, fare with a tip, and the next fare (the drive itself was skipped by moving the car).
- Buying the beach villa, renting it out, being refused its kitchen while let, and ◈310 rent the next morning.
- Shootout: the script sank 5 of 10.
- A match from 18:18 to full time (finished 3-2), sitting and leaving the seat, a bet, the Expo exhibits and the gift shop.
- About six game hours across these places with no errors. Memory returns to about 205 MB after garbage collection.
- Draw calls at the new places: 122 to 420 (target 600).

**Limits**

- Skyball players are simple figures and the match is a simple simulation (the ball runs from end to end, with shots and turnovers), not football physics.
- Night Run rivals do not stop at red lights; they take the 2 s penalty instead, as you do.
- The Expo exhibits are text panels with a hologram, not interactive.


## Looks

- **Water:** the sea, the canal and the park lake now show moving waves: several travelling ripples bend the light on the surface, so the sun glints and the colour shifts. It is calm on the canal and the lake and livelier out at sea, with a few whitecaps. This is drawn per pixel; the water surface itself is still flat.
- **Foam:** a strip of foam runs the whole coast and round Beacon Isle, washing a metre in and out with a bright edge on the sand.
- **The canal fix:** a dark ground layer had been covering the sunken canal since the last update, so it looked black; it now shows its water.
- **Mountains:** a range of peaks up to about 1,200 m rises beyond the city's northern edge, green on the lower slopes, grey rock, snow on the tops, lightly fogged so it shows from the city. It replaces the wall of distant towers that stood there. The ground is solid: you can walk up the foothills, and vehicles cannot fly through a mountain.
- **Northgate Dam:** an arch dam 140 m high closes the valley due north of the city centre, beyond Bio-Eden. On top: a road with lamps and parapets, and a viewing platform with a landing pad (Northgate Dam), a transit gate and a data cache. Behind it is a reservoir you can swim in; water pours down a spillway into a stream that runs down the valley.
- **Highways:** a concrete median with amber reflectors down the middle of every highway and the ring road, and steel guard rails along both edges, 1,633 pieces in all. They open wherever a street crosses, at junctions with the ring road and at the ends, so traffic still crosses at the signals. Your vehicle on the ground cannot drive through them.

**Tested (by script)**

- Autopilot from Meridian to the dam pad landed with no damage. Walking off the crest into the reservoir gives swimming. The ground on the mountains is at the right height (413 m and 347 m at two sample points).
- Five game hours across the dam, the beach, the canal, the highways, Midtown, the Heights, the park and the foothills: no errors; memory comes back down after garbage collection.
- Draw calls at the new views: 86 to 426. Render times at 1280 × 720 and render scale 1.0 were 7.5 to 13 ms at these spots, measured in the background preview.

**Limits**

- The waves are a lighting effect on flat water: boats and swimmers do not rise and fall with them.
- The mountains are a smooth height field with flat-shaded faces, no rocks or trees on them.
- The reservoir is shallow (1.5 m) so that swimming works; you cannot dive.


## Climbing, rooftops, robots, the orbital lift

| What | Where | How it works |
| --- | --- | --- |
| Climbing | anywhere | `Space` in front of a ledge between knee height and about 2.3 m pulls you up onto it if there is room to stand; a low wall with open ground behind is vaulted instead. Jumping at a ledge just out of reach grabs it. Ladders are used with `E` at the foot or the top. |
| Skyline Run | block 2-2, just south-east of Meridian; free | nine low rooftops built for parkour: two planks, gaps to jump, a ledge to pull up onto, two ladders, three stepping pillars and a zip line. Eleven rings in order (the next is green, the finish gold), timed from the first ring; back on the street ends the run. Gold under 40 s (◈250), silver under 55 s, bronze under 75 s. A practice yard of walls from 0.9 to 2.3 m fills the rest of the block. |
| Bot Arena Cup | Industrial Nexus, west of the cooling towers; ◈120 entry | robot sumo on a 7.5 m platform: quarter-final, semi-final and final, each the best of three 30 s rounds. You drive from the booth with a chase camera. A bot that meets the other more squarely gets its front under it and lifts it, and a lifted bot slides; nose to nose it is motor against weight. Prizes ◈150 / 350 / 900. The workshop at the booth sells three stages each of motor, ballast and ram capacitor. Crowds fill the stands during the cup and some evenings. |
| Orbital lift | the tether at the Aeroport, gate on its south side; ◈40 | a glass capsule climbs to Skyline Station, an enclosed observation deck 1,500 m up, in 50 s (and back down the same way). On the deck: a glass floor ring round the edge to look straight down, four telescopes (mouse to look, zoomed), benches, a coffee counter. The haze now thins with height, so the whole map shows from up there. |
| Several vehicles out | the vehicle exchange, then anywhere | switching at the Skyport or the Aeroport rolls the other vehicle out beside the one you have, which stays parked where it is. Walk up to any of your parked vehicles and press `E` to take it: the one you had out is left parked where it stands. They show on the map, keep their charge and condition, are solid, and are saved. The exchange can bring one back from wherever it is, or return them all to the depot. |

**New milestones:** Traceur (finish the Skyline Run), Roof runner (gold), Hands on (25 ledges climbed), Bot Arena champion, Halfway to the stars (Skyline Station), Fleet owner (three vehicles out at once).

**Tested (by script)**

- Climbing: pulled up onto a 2.0 m ledge and a 2.3 m wall, mantled onto a 0.8 m deep rail, vaulted a thin 1.1 m rail and landed on the far side, and an 8 m wall correctly gave a plain jump. A jump that fell short of a stepping pillar was saved by the ledge grab.
- Skyline Run: each section on its own: up the first ladder, the running jump between D and E (3 m), up onto D from C, between the pillars, the zip line (lands on the finish roof), and down the last ladder. The whole course was not run in one go by script.
- Bot Arena: a simple driving script played full cups: with no upgrades it beat the weakest bots and lost to the middle tier; with all upgrades it won the final 2-1. Prize money, the knock-out, withdrawing and forfeiting all return you to the booth.
- Orbital lift: up and down, the telescope view, sitting on a deck bench and standing up, and saving on the deck (you load on the deck and the capsule is waiting there).
- Several vehicles: three out at the Skyport, taking a parked one, saving and reloading (all three back where they were).
- Draw calls at the new places: 224 to 472 (target 600). About 40 game minutes across them with no errors; memory 207 MB.

**Limits**

- Climbing works on any collision box, so some odd things can be climbed (a parked vehicle's roof, a kiosk) and a wall is either climbable or not: there is no wall-running or hanging from a ledge.
- The Bot Arena opponents are simple steering rules with a reaction delay, not learning drivers; bots are boxes on a flat disc, with no damage.
- Skyline Station is as high as the passenger lift goes; the tether and the cargo climber carry on up, but space is not modelled.
- Only the vehicle you drive is simulated; parked ones are fixed models (they do not lose charge or get towed).

## The story: The Quiet Signal

Seven missions that tie the city together. All week the holo adverts have been stuttering and the courier drones have been losing their routes, and someone is talking on the city's own channels. The first mission starts with Juno Reyes on the Meridian plaza (✦ on your map; a message points you there in a new game and in an old save).

| # | Mission | What you do | Pay |
| --- | --- | --- | --- |
| 1 | Static | climb to a relay on the Skyline Run rooftops and take a reading | ◈200 |
| 2 | Three Readings | take readings at relays in Northbank, Eastline and Westworks, then report to Juno | ◈350 |
| 3 | Sprocket | meet the bot-builder at the Nexus and beat Clank in an exhibition match | ◈400 |
| 4 | Altitude | ride the orbital lift, meet Dr. Ines Okafor and find a red beacon at the port through a telescope | ◈500 |
| 5 | Ghost Drone | after dark, open a container in the port yard; a drone escapes and you chase it in your vehicle up the valley to Northgate Dam | ◈700 |
| 6 | Northgate | land on the dam, hear from CIVIC (the city's AI), and cycle three breakers along the crest within 60 s | ◈800 |
| 7 | Blackout | after dark on the Meridian plaza the city's lights go out; re-seed three pylons within 90 s, then make a choice for CIVIC | ◈2,500 |

- **The cast:** Juno Reyes (courier dispatcher, Meridian plaza), Tomas "Sprocket" Vale (Bot Arena, Industrial Nexus), Dr. Ines Okafor (Skyline Station) and CIVIC, a see-through hologram by the CivicLink terminal. They stand at their places all the time.
- **Scenes:** talking to someone turns the camera over your shoulder to them, and they talk as they speak. Calls come in on your phone. During the chase, messages appear on screen instead, so you keep control.
- **Guidance:** each step has an objective panel, a pink ✦ on the map, a beam of light at the place, and a street route when it is far.
- **Waiting for dark:** missions 5 and 7 need dark. Phone ▸ Story can wait until 20:00 for you.
- **Failing:** if you lose the drone (more than 450 m away for 8 s), it goes back to the port and you try again. If you run out of time at the breakers or pylons, you start the clock again at any of them.
- **Phone ▸ Story** lists the missions and what to do next. It can set a route or restart a mission.
- **The ending:** you choose to reset CIVIC or let it keep learning. If you let it learn, it stays on the plaza as a hologram and now and then sends you a tip. Either way you become a **Grid Warden**: every four game hours a relay faults somewhere (marked), and fixing it pays ◈150.
- **The blackout** puts out the street lamps, window glow, neon strips and holo rings. The adverts drop to a stuttering red standby frame.
- Saves keep your place in the story. A save made mid-chase restarts the chase at the port.
- New milestone: Gridkeeper (finish the story).

**Tested (by script):** all seven missions in one save, with reloads between them:
- Every scene, call and radio message, the payments (◈5,450 in all), and both endings.
- The exhibition match was won by a driving script on the first try.
- The telescope found the beacon.
- The full chase took 86 s and ended on the dam.
- The breakers were tried once too slowly (the clock reset) and then in time.
- After the ending: a Grid Warden fault was fixed for ◈150.
- No errors. Draw calls on the plaza at night with the cast: 428 (target 600).

**Limits:**
- Scenes are text panels with the camera on the speaker; there are no voices.
- The chase drone follows a fixed route and slows down if you fall behind; it does not dodge.
- The story was played by script, not by hand: the timing of the timed steps, and how easy the chase is in your own vehicle, may need tuning.

## Movement and a more futuristic city

**Walking and running**

- **One gait from a stroll to a sprint:** walking, jogging and sprinting blend into each other by speed instead of switching. Each leg sweeps back at a steady rate while its foot is on the ground, so feet stay planted, and swings forward quickly in the air. The step rate comes from the speed: about 2.5 steps a second walking, 2.7 jogging, 3.3 sprinting. Running has a flight phase, high knees, pumping bent arms and more forward lean; walking vaults over the standing leg.
- **Momentum:** you reach a jog in about a quarter of a second and a full sprint in about half a second. At speed you turn in an arc rather than snapping round, and reversing at a sprint brakes first. Your body faces the way you are moving.
- **Lean:** you lean into a start and rock back on a hard stop.
- **Camera:** it trails you slightly, so stairs, starts and landings are smoother. A sprint widens the view a touch. First person has a light head bob.
- **Footsteps** now sound when a foot actually touches down.
- The new gait is used by everyone in the city, not just you.

**Futuristic look**

- **Hover traffic:** street cars, taxis, vans and trucks float on four glowing lift pods with a light strip under the floor, instead of wheels. Parked ones are powered down.
- **Neon towers:** 257 of the city's 381 tower volumes, megatowers included, have neon strips up two corners and round the roof, brighter at night.
- **Holo adverts:** 188 animated holographic billboards on tower faces. Each changes every few seconds (logos, bars, shapes, text rows) with scanlines, a sweep of light and the odd flicker. They are drawn by a shader, so there are no image files.
- **Holo rings:** 35 of the tallest roofs have a spinning upright ring and a rocking halo over them.
- **The orbital ring:** a ring station arcs across the southern sky. By day it is a sunlit band with panels. By night it is a chain of lights with eight thin tethers down to the horizon, and satellites cross the sky.

**Tested (by script)**

- Movement: from standing to jog, jog to sprint, a reversal at full sprint, and stopping. Step rates were counted, and side-on frames of the walk, jog and sprint were checked one by one.
- The new look by day and night: from the street, from a rooftop and from the beach; a close-up of a hover car; an advert over several seconds.
- Draw calls 121 to 447 (target 600). About 35 game minutes of running and travelling with no errors; memory 173 MB.

**Limits**

- The rig has no feet or ankles to bend, so a planted foot stays flat rather than rolling heel to toe.
- The adverts are generated patterns, not real brands or readable slogans.
- The orbital ring is painted on the sky: you cannot fly to it, and it does not cast shadows.

## Feel, gamepad and sound

- **Feet on uneven ground:** standing on a stair, a kerb or a slope, your hips drop to the lower foot, and the other leg bends so its foot rests on its own step (up to about 40 cm).
- **Turning on the spot** (in first person, or swinging round from standing) takes a few small steps instead of sliding round.
- **Gamepad support:** see Controls. Buttons send the same presses as the keyboard, so every activity works with it. The left stick sets your pace as well as your direction, and menus, the phone and the title screen can be driven with the pad.
- **Footsteps** now have a heel and a toe, vary a little each time, come slightly from the side of the foot that lands, and sound different on stone, grass, sand, rooftops, metal, indoor floors and Skyline Station's glass.
- **Breathing** after a sprint of more than four seconds: soft breaths that slow and fade.
- **Wind** picks up on rooftops and high places, in gusts.
- **Hover traffic** swishes past when a car goes by within about 13 m of you, with a falling hum.

**Frame rate on your screen:** read from a real session in the visible browser pane (853 × 810, Auto quality), standing in Arbor Heights at midday. It held the full render scale (1.5×) at 60 fps, with brief dips to 48–58. A bigger window lowers the render scale on its own to hold about 50 fps.

**Tested (by script):**
- The feet were checked on a kerb (one foot in the road) and on the canal steps (one step apart).
- The gamepad was tested with a simulated pad:
  - On foot: the title screen and creator, walking at half and full tilt, sprinting, looking, jumping.
  - Menus and phone: the pause menu, the phone.
  - Vehicle: boarding and flying.
- Sounds were counted as they fired: footsteps on six surfaces, breaths after a sprint, a swish for each car that passed close. No errors.

**Limits:**
- Feet settle only when you stand still. Walking up stairs still uses the normal stride.
- No real controller was available for testing, only a simulated one, so button labels on unusual pads may differ.
- Sounds are synthesized, not recorded.

## A city that reacts

- **Street incidents:** every few minutes something happens 120 to 330 m from you, marked orange on the map with a beam of light.
  - A hover car broken down at the kerb with its hazards on: reset its lift pods (◈60) and it floats up and drives off.
  - A street kiosk on fire, with bystanders watching: put it out with the extinguisher (◈80).
  - A lost dog: talk to the owner, find the dog nosing about a block or two away, take its lead and walk it back (◈100).
  - Helping raises your standing. Ignored incidents are dealt with by the city after a few minutes.
  - New milestone: Good neighbour (help at 5).
- **Civic Patrol:** the Aegis-12 security drone now answers anywhere in the city, not just in Meridian.
  - On city streets it notices red lights you run and speeding above 120 km/h for a few seconds (highways and the ring road have no limit), as well as the old offences: reckless flying, flying in a sky lane, parking in the Commons, crashes.
  - When it comes for you (in from above if it is far off), pull over and stop, and it scans you and writes a ticket (◈60 to ◈80).
  - Keep driving for 18 s and the fine doubles.
  - Organised races are exempt.
- **Traffic:** a final check each frame stops two cars from ending up inside each other at a junction: the one that ran into the other stops and drops back. Night Run rivals now brake for red lights (they still pay the 2 s penalty if they get caught on one).
- **Shoppers:** residents who browse the Old Quarter shops often take something to the counter, pay ("I'll take it."), and walk off carrying a bag for a few minutes.
- **Doors:** Midtown passers-by sometimes step into a shop door along their way, and others come out of doors onto the pavement.

**Tested (by script):**
- Each incident from start to reward.
- The patrol: two red lights → it arrives from 171 m in 9 s → stopping gave a ◈70 ticket; driving on gave ◈140 after 18 s.
- Red-light detection at a real junction.
- Traffic: two minutes of traffic in Midtown, where the check separated 41 near-collisions and left 13 frames with an overlap of 0.3 to 0.65 m. That count was taken before a second pass per frame was added; the second pass was not measured.
- 90 s of Night Run with the rivals stopping 14 times.
- Ten minutes of shop hours: 5 purchases.
- One minute in Midtown: 15 people went into shop doors.
- Draw calls with an incident in view: 226. No errors.

**Limits:**
- People who go into a shop door simply disappear inside; Midtown buildings still have no interiors.
- Incidents are set pieces near you, not caused by the simulation (no car actually crashes into a kiosk).
- The patrol is one drone: it cannot follow you into a district or chase a car at full speed for long.

## More world: diving, line 9, towers with rooftop bars, the Institute

- **Diving:** in deep sea water, `C` dives and holds you down, `Space` rises, `Shift` swims faster; you have about 30 s of breath (a meter shows while you are under), and running out sends you back up. The seabed shelves down to 16 m off the coast, with reefs of coral, seaweed and schools of fish. Under the surface the water turns blue and murky, the sky goes dark, and bubbles rise from you. A freighter lies broken in two past the pier at Solara Bay, with a sealed crate inside (◈300 salvage, milestone Deep diver). The seabed is only drawn while you are under; everything else (boats, your aerocar, the beach) keeps the sea's old flat floor.
- **Riding the swell:** boats (moored and the one you sail), the ferry and swimmers now rise, fall, pitch and roll with the same waves the sea's surface is shaded with: gentle by the shore and on the canal, livelier out at sea.
- **Maglev line 9, to the coast:** an elevated line from Meridian Gate (south-east of Meridian, outside the line 7 loop) east along the street, then south between Old Earth and Grand Arbor Park, over the canal, to Solara Bay. Stations at Meridian Gate, Arbor Park and Solara Bay, each with a lift from the street. The three-car train shuttles end to end at up to 100 km/h and stops 12 s at each; Meridian Gate to Solara Bay takes a little over a minute. Pillars stand on the street's centre line, mid-block, clear of the traffic lanes and junctions.
- **Halcyon Tower (Eastline, 150 m) and Northbank Spire (176 m):** a glass lobby you walk into from the street (reception, sofas, plants), a lift to the roof, and a rooftop bar: a glass parapet you cannot climb over, a counter with a back bar, stools, sofas, planters and strings of lights. Drinks and snacks at the counter. In the evening the stools fill with regulars and there is music on the roof. Milestone High society (a drink at both).
- **Neo Central Institute** (block south-west of Meridian): a quad with paths, trees and benches, students out on the lawn by day, a library you can walk into (shelves, reading tables, a desk) with the city archive terminal (six pages of the city's history; milestone Scholar), a lecture hall with columns, an observatory dome and a clock tower.

**Tested (by script):** diving to 11 m, the breath running out and the surface, the wreck crate; a full line 9 ride from Meridian Gate to Solara Bay (73 s) with the lifts at both ends; walking into both lobbies through their doors, the lift to each roof, a drink at the bar, nine regulars on the stools at 21:30; walking into the library and reading the archive. No errors. Draw calls: diving 113, line 9 platform 249, rooftop bar at night 247, campus quad 445.

**Limits:** you cannot dive in the canal, the lake or the reservoir; fish swim set circles; the wreck is the only thing to find down there. The towers have a lobby and a roof but no floors in between. Line 9 is not on the transit gates or the phone's travel list.

## Getting around, and the skyline survey

- **New transit gates** at the Skyline Run, Halcyon Tower, Northbank Spire, the Neo Central Institute and Meridian Gate (line 9). They are on the phone's travel list and the full map like every other gate.
- **The maps show both maglev lines:** line 7 round Meridian in blue, line 9 to the coast in amber, with its three stations marked on the full map.
- **The skyline survey** (Dr. Okafor at Skyline Station, any time the story does not need her): photograph eight landmarks for the observatory's records.
  - The landmarks: Northgate Dam, the big wheel on the pier, the orbital lift's tether, Skyhaven from below, the Aeroport control tower, Beacon Isle lighthouse after dark, Halcyon Sky Bar lit up after dark, and the wreck from under the sea.
  - `O` for photo mode, then `Enter` or a click takes a picture (a flash and a shutter).
  - A landmark counts when one of its points is near the middle of the frame, close enough and in plain view, at the right time.
  - ◈80 a photograph, ◈300 more for the set; milestone Surveyor.
  - A picture of a landmark before you have taken on the survey tells you Dr. Okafor would pay for it.
- **Start-up:** the title screen is ready about 1.7 s after the page opens, world generation included (measured on the development server), so there is no loading bar.

**Tested (by script):**
- Each new gate stands on clear ground; a jump to one works.
- Both lines appear on the full map.
- Each of the eight landmarks was photographed from a sensible spot.
- A picture of nothing pays nothing.
- The rooftop bar counts from four of six street spots round the tower; the other two are behind other buildings.

**Limits:**
- The third-person camera cannot tilt straight up, so very tall things need a few steps back.
- Pictures are not saved as image files.

## Photos, camera settings, data pods

- **Your photos are kept:** every picture taken in photo mode (`O`, then `Enter` or a click) is stored in this browser, the newest twelve (about 50 to 130 KB each), separately from the save game. The phone's new **Photos** app shows them with where and when they were taken; open one to **save it to your computer** as a JPEG or delete it.
- **Camera settings** (Pause ▸ Settings): field of view from 55° to 80° (a sprint still widens it a touch), and camera distance near, normal or far.
- **Six lost data pods** lie by the reefs off the coast, glowing so you can find them in the murk. While you dive, the panel counts them and says roughly how far the nearest one is. ◈60 each and ◈200 more for all six; milestone Pod hunter.

**Tested (by script):** two photos taken and labelled (one counted for the survey), shown on the phone, one opened and deleted; field of view 75° and the far camera (6.1 m behind you) and back; a data pod found with the dive panel's guide and recovered. No errors.

**Limits:** photos live in this browser only (saving one to your computer is the way to keep it elsewhere).

## Save files, a loading screen, the one-file copy

- **Save to a file** (Pause ▸ Save to a file): your progress and your photos in one JSON file
  (about 120 KB with one photo), named after your resident and the day, e.g.
  `neo-earth-2226-tester-day-1.json`. Keep it as a backup, or carry on in another browser.
- **Load from a file** (Pause ▸ Load from a file, or **Load a save file** on the title screen): it
  says whose game it is (name, day, money), when it was saved and how many photos it has, and asks
  first. Loading replaces the progress in this browser; that progress is kept as the backup save
  (the one the game falls back on if the main save cannot be read). Its photos are added to yours,
  the newest twelve kept. The game restarts at the title screen: press Continue. A file that is not
  a NEO EARTH 2226 save is turned away with a message.
- **Loading screen:** the title picture with "Building the city…" shows the moment the page opens,
  and fades into the title screen once the city is built (about 1.1 s here).
- **The one-file copy** (`npm run share`, above). Browsers do not load separate script files for a
  page opened from disk, so the build puts everything inside the one HTML file.
- **Draw calls:** far districts now leave the sun's shadow map when you are more than about 600 m
  from them (with the sun or moon low, the shadow volume reaches that far, but those shadows land in
  the fog). It saves 8 to 14 draw calls at night and none at noon. Busiest views measured after it:
  Meridian park at night 481, a Midtown street at night 406, Meridian at noon 433 (budget 600).
  A shorter shadow reach was measured too and saved almost nothing, so it was left as it was.

**Tested:** the one-file copy opened straight from disk in a separate headless Google Chrome with
its own profile: loading screen, title, a new game, a photo, Save to a file, a wrong file turned
away, the real file loaded from the title screen (name, money and photo back, the spoiled progress
kept as the backup), the pause menu's Load from a file question, no page errors. The normal version:
loading screen, pause menu entries, both builds. Not tested: Safari and Firefox, and a real download
dialog (the test caught the file on its way out).

## Hero Mode

At the **Hero Hall** (a holo-dais in the Commons, west of the spawn, with a ring of five colours
over it) or from the phone's **Heroes** app you become one of five original heroes. Your own
resident's look is put away (and is what gets saved) until you choose **Go back to being yourself**.

| Hero | Based on the kind of powers of | Light / heavy | 1 | 2 | 3 | R (ultimate) | Moving |
|---|---|---|---|---|---|---|---|
| **Strand**, web-slinging acrobat | a web-slinger | punch, punch, kick / yank the nearest enemy into a slam | line: pull an enemy in, or zip to a wall | snare: a sticky ball that ties up everyone it splashes | danger sense: 6 s of dodging every attack | line storm: every villain within 30 m tied up and pulled together | hold Space to jump and swing, and keep holding to chain line after line; let go rising out of the arc for a boost; A/D steer; Shift in the air web-zips; C dives; hitting a wall runs up it (W keeps running, over the top at the edge; Space jumps off) |
| **Forge**, armoured inventor | an armoured flyer | armoured punches (palm shots in the air) / charged palm blast | six homing missiles | 2 s chest beam | shockwave, then a 6 s shield | overload: a blast 20 m wide | Space in the air to fly: WASD, Space up, C down, Shift fast; C on the ground lands |
| **Raiko**, lightning swordsman | a lightning swordsman | sword cuts / lightning thrust | thunder dash through everything for 14 m | fire breath for 1.6 s | swap places with an enemy, or blink to the spot | storm guardian: 12 s inside a giant guardian of light, huge sweeps and lightning arrows | |
| **Sable**, the copy fighter | a copy fighter | blade cuts / spinning kick | lightning palm: charge, dash, one very hard hit | a pack of four hounds that pin villains | warp: a vortex swallows an enemy for 6 s | copy: the last villain move he saw, stronger (brute slam, gunner volley, drone rockets, Kurozan's club or storm breath) | |
| **Rook**, rubber brawler | a rubber-bodied brawler | stretch punch 7 m / a flurry of stretching punches | rocket: grab a far wall and sling yourself at it | next form: 2 steam (fast), 3 giant fist, 4 bounce (25 s, then out of breath), back to base | balloon: 3 s of attacks bouncing off | Form 5: 20 s giant, glowing, everything turns to rubber | |

**How Strand swings** (`systems/heroes.js`, after the way open-world web-swinging games are built:
Treyarch's 2004 swing and Insomniac's from 2018). Each line lands on a real building, picked to suit
where you are going: about 35° ahead of straight up, off to one side so you weave down the street
(alternating hands), longer at speed, and never so long that the bottom of the arc would scrape
the street (the line reels in to keep about a metre of air under you). The swing is a pendulum on a
rope, bent for fun: gravity is heavier on the line for a snappy arc, the bottom of each arc adds
speed, the sideways pull toward the anchor is turned back to your heading so you run straight down
the street, and walls within 6 m push you back to the middle. The line is drawn to the building, but
the swing pivots on a point above your path (a true pendulum bottoms out under its anchor, at the
wall); close to a wall, the next line goes to the far side. On a downtown street this keeps you about
15 m from the nearest wall on average. The line flies out from the hand, droops while slack and snaps
straight under your weight (a bright core with a teal glow). Landing fast (over 15 m/s, or hard)
turns into a forward roll that keeps 12 m/s and comes out running. Speed you bring in (a fall, a
dive) is turned along the arc instead of lost. Off the line your speed carries through the air and
the keys only turn it; you run out of it when you land. Letting go late in the rise is the skill:
on a 6 s run down a Midtown street holding Space chains five lines and covers 154 m, and timing the
releases covers 206 m. The feel is sold by the camera (it trails further behind and the view widens
by up to 16° with speed), streaks and wind, and the body: it hangs along the line, the hand on the
anchor's side holds it, and the legs trail, tuck through the bottom and kick out on the way up.
Lines prefer arcs that swoop down to about 5 m over the street, so you swing low between the towers
instead of creeping ever higher (with timed releases a run down a street stays between 2 and 18 m).
A swing that goes on longer than 2.2 s hands over to the next line, so it can never curl round its
anchor like a tetherball, and W keeps a wall run going only for its first 1.6 s, so brushing a 200 m
tower does not run you up all of it. The first time you are Strand, a card explains the four moves.

**The Swing Course** (`systems/swingcourse.js`): twelve big rings (14 m across) through the downtown
streets, starting at a sign on the street at (-96, -170), north of the park. It runs east along the
start street, south, west one block and north to the finish, about 570 m; these are the streets near
the start with towers close on both sides, so there is nearly always a line to take (the open plaza
further west along z = -60 is left out). The next ring is green, the rest blue, the finish gold. The
clock starts at the first ring; rings count when you cross them in the right direction, with a pass
zone a little larger than the drawn ring, as game rings forgive a near miss. The rings sit at swing
height (8-18 m), set ring by ring from test runs, and the first ring after each corner is 35 m into
the new street, lower, so you have a swing or two to line up. Over 3.5 s back on the street, or 160 m
off course, ends the run. Gold under 28 s (◈400), silver under 40 s (◈250), bronze under 60 s (◈140),
plus hero experience; the best time is kept. Tested with a scripted Strand that steers at each ring,
lets go on the way up, dives when well above a ring and web-zips round corners: 11 of 12 runs
finished, in 23.8 to 94 s (median 35 s), with no landings mid-course in most runs.

**Unlocking heroes.** Strand, Forge and Raiko are open from the start; the others unlock two at a
time as you finish the Hero Hall missions (The Three Storms): Sable and Rook after mission 1, Brann
and Bulwark after 2, Warden and Kitsu after 3, Trine and Ember after 4. A hero you have already
played stays unlocked. Locked heroes show greyed out with a lock in the Hero Hall.

**Code 7103** (pause menu ▸ Redeem a code): unlimited money (the wallet stays at ◈9,999,999 whatever
you buy or are fined), unlimited energy, and every hero unlocked. It is saved with your progress and
can be switched off in the same menu. Being a single-player browser game, the code is in the game's
script, so anyone who reads the source can find it.

**Fighting from the air.** Strand's light attack in the air (or on a line) with an enemy within 30 m
in front is a web strike: a line to them, a zip in feet first and a kick (34 damage), then a rebound up
and back into the air to swing or strike again; with nobody in front it is the usual punches. Forge,
flying, keeps firing palm shots while the attack is held (about one every 0.13 s, hands alternating),
and the shots bend toward an enemy within about 14° of the crosshair (no help further off). Tested by
script: a strike from 14 m lands in 0.37 s, one launched mid-swing lands too; 13 shots in 1.5 s of
held fire dealt 156 damage with the crosshair 8° off a robot, none with it 25° off.

**Moving as the other heroes.** Forge flies where the camera looks; Shift is an afterburner that
spools up to 62 m/s and sets off a sonic boom past 45 m/s, the armour banks into turns and pitches
into dives, the boots leave contrails, and a fast arrival is a three-point landing with a shockwave.
Brann's hammer flight lasts 2.4 s and is steered with the camera (Space lifts), the hammer whirling
overhead, and he flies on with his speed when it ends. Rook's rocket snaps him to a point and slings
him on past it (up a wall, if he grabbed one). Bulwark's leap reaches 80 m and lands where you aim
(the air no longer slows it). Kitsu has a second jump in the air. Aiming at the open street now lands
on it (the crosshair ray used to pass under the ground), which helps every power aimed at the ground.

**Controls:** left click or **Z** light attack (a combo), right click or **X** heavy, **1 2 3**
powers, **R** ultimate when the meter is full (landing hits fills it). The crosshair aims. On a
gamepad in Hero Mode: RB light, LB heavy, the d-pad up/right/down for 1/2/3 and left for R.

**Kurozan's crew:** every couple of minutes while you are a hero, his war robots (Stormbreaker
brutes, gunners and storm drones) raid a street 100–400 m away: a red beam marks it, the map shows
it and a route is set. Until you come they smash shopfronts and scare people off the street; then
they fight (brutes punch and slam, gunners keep their distance and shoot, drones circle overhead).
Every 5-9 s a drone swoops: a red ring marks the spot in front of you (0.7 s), it rams through it at
chest height (step out of the ring and it misses), then hangs there for 1.6 s, low enough to punch,
before it climbs back; one drone at a time. Heroes who fight up close no longer need to aim up to
reach them (Bulwark, standing and punching, downs one on its first swoop).
Stopping a raid pays ◈250 plus ◈50 a robot. A raid you leave alone ends after a while.

**Raids on busy streets.** A raid picks one of the busiest street corners or bus stops 60-380 m
away (by how many residents are outdoors within 40 m), so it lands in a crowd; only when the streets
are empty does it fall back to any stop. From the plaza at midday the sites had 10-11 people nearby
(the old choice: none), and even at 3 a.m. one had 7. The crowd runs from the robots as they smash
the street. Your own blows that catch bystanders during a raid or boss fight only knock them over:
nobody goes down, there is no patrol and no wanted star, just a little standing and a word from them
(one gentle warning the first time). When you stop the raid, everyone within 50 m turns to you,
waves and thanks you, and your standing rises with how many saw it.

**Kurozan, the Storm Dragon:** after two raids (or any time from the Hall or the app) you can face
him at Skyhaven Stadium. A giant warlord with an iron club (slam, sweep, thrown rocks, a charge, a
roar); at half health he turns into a flying dragon (storm breath, fireballs, dives: hit it while
it is low). Beating him pays ◈2,500. If you are knocked out the Hall's medics patch you up and he
leaves until next time.

**The city in a fight:** walls and streets take scorched, cracked holes; chunks of facade fall and
settle; strong hits start fires with smoke. A city repair drone comes to each damaged spot after
45 s, welds, and the damage and debris are gone. Buildings never collapse (at this map size that
would cost far too much). **Residents** caught by a hit are knocked over backwards, lie a moment,
get up and run. A hero's own hits hurt them: an adult has 60 health (an android 80), and one who
takes enough goes down for good and lies still (no blood) until the city medics take them away
after 20 s; they are home again the next day, so nobody's story or schedule is lost. **Children are
never hurt this way**: whatever hits them, they are only knocked over, and they always run. About a
quarter of adults are fighters: hit one, or hurt someone near one, and they come at you throwing
punches (5 damage each) until you knock them down or get more than 35 m away. Everyone else nearby
panics and runs, further when someone has gone down. Villains' hits only ever knock people over.
Hitting residents costs standing with them and their friends (much more when they go down), and the
Aegis-12 patrol comes for you (◈120 for attacking residents, ◈90 for damaging property outside a
fight with villains).

**Vehicles can be wrecked** (`systems/wrecks.js`). Every moving car, taxi, van and truck on the avenues,
Meridian's streets and the highways takes damage: a hero's punches and powers, shots aimed at it (the
crosshair and projectiles now stop at a vehicle instead of passing through), blasts, villains' attacks
and stray shots, and ramming it with your own vehicle at more than about 22 km/h. A hit vehicle stops for
a few seconds. Below 55% health it smokes; below 25% it catches fire, the people nearby run, and about
4.5 s later it blows up (at once, if it is finished off): a fireball, a scorch on the street and walls,
up to 8 m of blast that hurts villains, the hero and your own vehicle and knocks residents flat (never
hurting them), and that can set off the vehicle next to it (one touching it goes up too, one a car's
length away is left smoking). Health: cars and taxis 100, vans 140, trucks 220. The wreck stays where it
stopped, charred, tilted and lights out, burning for a while and smoking, and the traffic behind it
queues; the city tows it away 40 s later once you are not looking (after 100 s whatever happens) and
it rejoins the traffic. A hero who blows up vehicles outside a fight with villains is reported for
damaging city property (one star for a car). Parked vehicles (drawn into the street tiles) and buses
cannot be damaged, and your own vehicle still only loses hull (no explosion). Tested: eight combos of
Strand's punches leave a car smoking at half health, Forge's six missiles blow one up from 16 m, a
22 m/s crash leaves a van smoking; a raid fought beside the avenue hurt one passing car and blew up
none; six burning or wrecked vehicles at once cost about 0.02 ms a frame.

**Wanted level** (`systems/wanted.js`, stars under your wallet). Offences raise it: a hit on a
resident is about a star, someone going down about two, shooting down a patrol drone or running from
a stop more; traffic offences alone never go past 2 stars. At 1-2 stars the Aegis-12 drone comes for
you: hold still for its scan and you pay the fine times your stars, which clears them. At 3, 4 and 5
stars armed enforcer drones join (2, 4, then 6): they circle you and fire stun shots (harder to hit
when you move fast), and there is no stopping for a scan any more. A hero can shoot them down, which
only raises the stars; as yourself on foot, three stuns and you are taken in. Every drone needs a
clear line of sight within 90 m: break it (round a building, indoors, or by outrunning them) and the
stars flash while they search the last place you were seen; stay hidden for 6 s plus 3 s a star and
you lose them. A knocked-out hero's stars clear too. Not saved: a reload starts clean. Tested by
script: 3 stars from two deaths, enforcers costing Bulwark 30 health in 8 s, a lost search after 15 s,
Forge outflying them on afterburner in 26 s, and three stuns on foot fining ◈360.

**The second wave of heroes** (added the same day; each also has a Higgsfield portrait):

| Hero | Light / heavy | 1 | 2 | 3 | R |
|---|---|---|---|---|---|
| **Brann**, storm-hammer warrior | hammer swings / throw the hammer: it flies out and comes back | a lightning bolt from the sky at the crosshair | hammer flight: a long flying dash | thunderclap ring | storm: 10 s of lightning striking villains nearby |
| **Bulwark**, the brute who gets angrier | smashing punches / ground slam | a huge leap that lands in a crater | a clap whose shockwave travels forward | grab the nearest enemy and hurl it at the others | rampage: 15 s giant, double damage, nothing knocks him down. Rage fills as he fights (more damage, a little bigger) |
| **Warden**, shield-thrower | shield bashes / the shield bounces between up to four enemies | charge behind the shield | block: 6 s, a fifth of the damage, attackers hit back | rally: heal 40, stun everyone round you | ricochet: 16 bounces among every villain within 30 m |
| **Kitsu**, clone ninja | fast strikes / spinning kick | spiral sphere: charge, dash, drill one enemy | three clones fight for 10 s | substitute: vanish in smoke, reappear behind, dodge for 2 s | great sphere: a 9 m blast |
| **Trine**, three-blade swordswoman | wide three-blade cuts / whirlwind | a flying slash that passes through a line of enemies | dash through up to three enemies in turn | counter: a 1.5 s guard, then a huge counter-slash if hit | nine flying slashes in a fan |
| **Ember**, fire-fist brawler | burning punches (they set robots alight) / fireball | fire dash that leaves flames behind | a ring of fire pillars | flame body: 6 s, a quarter of the damage, attackers burn | a meteor at the crosshair, 12 m wide |

**Upgrades** (Hero Hall ▸ Upgrades, for every hero): Power (+15% damage), Vitality (+20% health),
Focus (12% shorter cooldowns), three levels each at ◈400, ◈900 and ◈1,600.

**Two more villains** lead raids of their own: **Vektor, the Machine Overlord** (a floating core
in red rings that fires telegraphed lasers and hijacks two more drones every 12 s, with a crew of
hijacked drones) and **Shade, of the Shadow Clan** (blinks behind you, slashes, throws fans of
stars, calls shadow clones every 14 s, with a crew of ninjas that do the same). Each arrives with a
portrait card.

**Raid types:** *smash* (stop them), *rescue* (three residents in energy cages: break the cages,
◈100 each), *heist* (an armoured truck drives off: stop it before it is 450 m away, ◈300), *defend*
(the crew attack the orbital lift's uplink; hold them off for three waves, ◈400; lost if it falls).
Which crew and which kind are picked at random after your first raid.

**Tested (second wave, by script):** every power of the six new heroes fired at a crew with no
errors (damage confirmed close up for melee, fire patches and the dash); an upgrade bought and the
damage bonus applied; a Shade rescue raid (cages freed, ninjas fighting back), a Vektor heist (the
truck driving off, stopped, paid), a defence of the uplink through three waves (paid); Vektor's and
Shade's defeats counted. A Vektor raid with Kitsu's clones out measured 381 draw calls, simulation
1 ms. Not yet played by hand.

**Hero Mode, the next level** (the same day):

- **Hero Hall menu** is split up: Choose a hero, Hero missions, Partner, Costume, moves, Boss
  fights, Upgrades.
- **Boss fights for Vektor and Shade** (Hall ▸ Boss fights): Vektor on the roof of the Aurelia
  Needle, 1,040 m up (lasers after a warning line, a laser that sweeps the roof, more hijacked drones;
  at half health a shield that only drops when the four pylons at the roof's corners are broken).
  Shade in the Undercity under the Neon District (blinks behind you, fans of stars, three shadow
  copies every 11 s that pop in one hit, faster at half health). ◈2,000 each; Kurozan stays ◈2,500.
- **Partner:** pick a second hero at the Hall; **G** swaps between them mid-fight (each keeps their
  own health and meter, and the one arriving hits everything near them). The partner's meter fills
  at half speed while off the field. **R** with both meters full is a **team strike**: the partner
  appears beside you and a blast 15 m wide goes off.
- **Hero levels** (1–5) from experience: hits, knockouts, raids (+100) and bosses (+400). Level 2
  unlocks an alternate costume, level 3 +10% damage, level 4 a **signature move on key 4**, level 5 an
  elite black-and-gold costume and +10% health. Signature moves: Strand web dome, Forge orbital laser,
  Raiko lightning rain, Sable hound howl, Rook spring slam, Brann hammer fall, Bulwark earthquake,
  Warden shield wall, Kitsu clone barrage (six clones), Trine dragon cut (a 26 m dash), Ember fire tornado.
- **Hero missions, The Three Storms** (Hall ▸ Hero missions, from Commander Ilse Varga): stop a
  Kurozan raid; free the caged in a Shadow Clan raid; stop Vektor's truck; hold the orbital lift's
  uplink; then beat all three bosses. Taking a mission makes the next raid the right kind. Rewards
  ◈500 to ◈3,000, and the title Guardian of Neo Central at the end. The current mission shows above
  the hero panel.

**Tested (by script):** Vektor's fight (roof at 1,040 m, shield up at half health and blocking
damage, pylons dropping it, defeat counted and paid), Shade's fight (copies spawning, defeat counted),
a partner swap there and back with health kept, a team strike (475 damage on a crew), a signature move
at level 4, the alternate costume, mission 1 forcing a Kurozan raid and paying, mission 2 lined up,
the HUD's mission and level lines. No errors. Not yet played by hand.

**Polish and balance:**

- **Training ground** (Hero Hall ▸ Training ground): three training robots by the Hall that take every
  hit and never hit back, and a readout over the hero panel (damage a second over the last 5 s, and in
  all). Residents are never hit while you train, and raids wait until you end it.
- **Difficulty** (Hero Hall ▸ Difficulty): easy (villains 70% health, 60% damage, raids 40% rarer),
  normal, hard (140% health and damage, raids 30% more often). New villains use the setting.
- **Feel:** a big hit (30 damage or more) freezes the world for a few frames, and so does a hard hit
  taken; robots pop larger for a moment when hit; red rings on the ground warn where a brute's slam,
  Kurozan's club and thrown rock, and the dragon's dive will land.
- **Dodge roll on C** for every hero (it no longer crouches in Hero Mode): a quick roll the way you
  are moving, or backwards, untouchable for a moment, 0.8 s between rolls.
- **Gamepad in Hero Mode:** RB light, LB heavy, d-pad up/right/down powers 1/2/3, d-pad left
  ultimate, Y signature move, B dodge roll, right stick click partner swap, View/Select the phone.

**Tested (by script):** training (readout, robots refilling, no residents hit, raids paused), a
dodge roll (4.6 m), hard difficulty (a brute at 182 health instead of 130), a warning ring before a
brute's slam, the hit freeze being set by a big hit. No errors. The gamepad layout is untested (no
pad here).

**Measured:** a busy raid fight in a Midtown street at night (eight robots, Raiko's guardian and fire
breath) is 509 draw calls (471 without it; budget 600); simulation 1.7 ms. Each kind of effect is
one draw call (sparks, smoke, beams, rings, glows, marks, debris).

**Tested (by script, in the game):** all five heroes' light, heavy, three powers and ultimate
fired at a raid crew with no errors (damage dealt where a power does damage); Strand swinging
(a line 49 m up, 11 m covered in a second), zipping onto a wall and climbing onto a roof; Forge
taking off, flying 99 m and landing on a roof; Raiko's 18 m dash; Rook's rocket to a wall and his
forms; Sable copying a gunner's volley and a brute's slam and using both (homing bolts and missiles
were fixed to keep their speed when turning); a raid spawning, fighting back and paying; a
resident knocked down, getting up and running, with standing and patrol heat going down and up;
damage marks, debris and the repair drone; Kurozan's giant form, the change at half health, the
dragon, his defeat and the reward; saving as a hero keeps your own look; leaving Hero Mode.

**Not tested / limits:** a gamepad (no pad here); fights were driven by script, not by a person
playing them, so difficulty and cooldowns are first guesses. Heroes are stylised low-poly like
everyone else; Kurozan's dragon is a chain of shaped segments. The heroes' and Kurozan's portraits
(Higgsfield) are concept art: the figures in the game are the low-poly versions of them.

## Sound, battle music and storms

Everything here is made while you play (oscillators and filtered noise); nothing is downloaded.

- **Battle music (Hero Mode).** It starts as a low pulse when a raid is within about 160 m, turns
  into the full beat with a melody once you are within 50 m, and adds held chords and cymbals in a
  boss fight. Each crew has its own sound: Kurozan's robots are driving rock-style synths, Vektor's
  drones are fast electronic arpeggios, the Shadow Clan is wood blocks and plucked strings with a
  breathy flute. Kurozan has a slow taiko-drum theme; when he turns into the dragon the music
  speeds up and rises a semitone. A fanfare plays when a raid is stopped (a longer one for a boss),
  a falling phrase when you are knocked out, a rising rush when the dragon appears, and a deep hit
  when a villain arrives. Settings ▸ Battle music turns it off; the quiet background score steps
  aside while battle music or the radio plays.
- **Hero sounds.** Every hero's light, heavy, three powers and ultimate have their own sounds:
  Strand's line shots and zips, Forge's repulsors, missiles and chest beam, Raiko's blade and
  lightning, Sable's hounds and warp, Rook's stretching and bouncing, Brann's hammer and thunder,
  Bulwark's slams and clap, Warden's shield ring, Kitsu's wind spheres and smoke, Trine's blades,
  Ember's fire and the meteor's whistle. Hits sound different for fists, blades, fire, lightning
  and sticky lines; robots clank; walls crack and rubble rattles down after big blows. Sounds out in
  the world get quieter with distance and come from their side. Heroes call out their ultimate.
- **Spoken lines.** Kurozan, Vektor, Shade and the robot crews speak their lines through the
  browser's speech voices (on a Mac it picks deep, robotic and whispering voices where it has
  them), always with a caption at the bottom of the screen. Settings ▸ Spoken lines turns the voices
  off; the captions stay.
- **Storms.** Lightning strikes are real bolts in the sky now, with branches. Thunder arrives late
  for far strikes (sound travels about 340 m a second) and cracks right away for close ones, then
  rolls in a few waves. Heavy rain roars, rain drums on the car roof, storms gust, and footsteps
  splash on wet streets. Kurozan's fight brings a storm to the stadium that breaks into rain when it
  ends. Brann's Lightning call and Storm bring bolts down from the sky; Raiko's ultimate lights up
  the sky.
- **Car radio.** Four stations while you drive: Neon 88.6 (synthwave), Pulse 104.2 (house), Harbor
  Lo-Fi 92.1 and Orbit 99.9 (slow ambient). Each has three tracks that change about every minute
  and a half, with a "now playing" note; a host says the station's name when you tune in. **R** in a
  car changes station (and turns it off after the last); Settings ▸ Car radio does the same. The
  radio fades out in a fight and when you step out.

**Tested (by script, in a separate tab):** the battle music for a raid going from quiet to a pulse
at 60 m to the full beat at 6 m; the robots' line; all eleven heroes' moves playing their own
sounds; hits on robots; walls cracking; the raid's fanfare; Kurozan's fight (storm weather,
his theme, the rush and the dragon theme, his lines, the boss fanfare, the storm turning to rain
after, and being knocked out by the dragon with his parting line); Vektor's and Shade's themes,
shield and decoy lines and defeats; a lightning bolt drawn over the city (picture checked); all
four radio stations, off and back on, the R key, a track change, and the radio stopping when you
step out. The music costs about 0.02 ms a frame. No errors.

**Not tested / limits:** the music and sounds were not judged by ear here, so the mix (how loud
music is against effects) may need a tweak; tell me what sounds wrong. Speech voices differ by
browser and computer; Safari and Chrome on a Mac have them, and where none exist only the captions
show. The radio has no gamepad button yet.

## Artwork (Canva and Higgsfield)

### From Canva

Four pictures were generated with Canva's AI image generator on 13 November 2026, from prompts
agreed beforehand, and live in `src/assets/art/` (about 1 MB together):

| File | Size | Used for |
|---|---|---|
| `title.jpg` | 1920×1084 | The title screen and the loading screen, behind the menu (it drifts slowly; still if your system asks for reduced motion) |
| `ad-aerowisp.jpg` | 682×1024 | Advert: AEROWISP, every class of flying car |
| `ad-neon-spritz.jpg` | 682×1024 | Advert: NEON SPRITZ, the drink of the rooftop bars |
| `ad-orbital.jpg` | 682×1024 | Advert: ORBITAL LIFT, tickets to the ring |

- **Holo adverts on the towers:** three slides in four now show an advert picture (the other one
  the old animated patterns), with scanlines, the sweep, the odd flicker and a short sideways tear as
  each new one comes in; in the blackout they still drop to the red standby frame. All 185 are still
  one draw call. They only show from the front now (seen from behind, the lettering was mirrored).
- **Street posters:** the advert panels on the pavements and both sides of every bus shelter carry
  the same adverts, lit from behind (about 6 more draw calls in a busy street).
- **Brand names** are set in sharp type by the game over each picture (`src/world/art.js`), since
  AI pictures garble lettering. Shop signs are still drawn by the game.
- **The other three adverts** (SKYBALL, SOLARA BAY, TIN LANTERN) are Higgsfield pictures (below).
  Canva had refused them with "You have exceeded your credit quota"; until then they were simple
  drawn designs, which still stand in for any advert picture that is missing.
- Canva only hands back small previews of generated pictures, so the four were placed on pages of a
  holder design in the Canva account ("NEO EARTH 2226 image board") and exported from there at full
  size. Its first page has Canva's own layout and is not used.

**Tested:** the title screen; tower adverts at night and by day (all six designs seen, brightness
checked against bloom); posters on an advert panel by day and night and on both sides of a bus
shelter; the framed print. Draw calls in the busiest views 502 and 550 (budget 600). No errors.


### From Higgsfield

Eleven pictures made with the Higgsfield API (model: Soul) on 13 November 2026, from prompts agreed
beforehand, also in `src/assets/art/` (about 0.8 MB together; the originals were 1536×2048):

| File | Size | Used for |
|---|---|---|
| `hero-strand.jpg`, `hero-forge.jpg`, `hero-raiko.jpg`, `hero-sable.jpg`, `hero-rook.jpg` | 600×800 | Each hero's card in the Hero Hall menu, the portrait beside the hero HUD, and a full-screen card when you become that hero |
| `villain-kurozan.jpg` | 600×800 | Kurozan's card when the boss fight starts, and the portrait on the boss bar |
| `villain-dragon.jpg` | 1280×720 | The card when Kurozan turns into the dragon, then the boss bar portrait |
| `ad-skyball.jpg`, `ad-solara.jpg`, `ad-tin-lantern.jpg` | 682×1024 | The three adverts that were drawn designs, on the towers and the street posters |
| `hero-brann.jpg`, `hero-bulwark.jpg`, `hero-warden.jpg`, `hero-kitsu.jpg`, `hero-trine.jpg`, `hero-ember.jpg` | 600×800 | The second wave of heroes, used the same way |
| `villain-vektor.jpg`, `villain-shade.jpg` | 600×800 | The cards when Vektor and Shade arrive in a raid |
| `print-meridian.jpg` | 1200×696 | The framed city print you can buy for your home (cropped to the picture: Higgsfield drew it hanging on a wall) |

- The first try used Higgsfield's Soul Cinema model and failed on their side (failed requests are
  not charged); everything was then made with Soul.
- Strand's first portrait came out with pointed ears and big white eye lenses, too close to existing
  comic heroes, so it was made again with a smooth helmet and one teal visor band, and his mask in the
  game was changed to match. Rook's colours were changed (green top, charcoal shorts, orange sash) so
  his outfit is not a well-known pirate's.
- Cost: the API is billed to your Higgsfield API balance, which only the Higgsfield console shows
  (the connector's 294.62 credits did not change). Higgsfield's docs do not list prices.

**Video (Higgsfield, Kling 2.5 Turbo image-to-video):** `public/video/title-loop.mp4` (1280×722, 1 MB)
is the title picture brought to life: the camera drifts in, flying cars cross between the towers,
boats move on the bay. Its 5 seconds play forward then backward, so the 10-second loop has no jump.
It plays behind the title menu; if your system asks for reduced motion, or in the one-file copy
(which leaves video out to stay small), the still picture shows instead.

Four more clips, made from the villain pictures, play on the villains' cards: `kurozan.mp4` (he
raises his club as lightning strikes) when his boss fight starts, `dragon.mp4` (the dragon breathes
fire and lightning onto the stadium) when he transforms, `vektor.mp4` (his rings pulse among the
drones) and `shade.mp4` (she rises from her crouch, eyes glowing) when they arrive in a raid or a
boss fight. 5 seconds each, 0.65–0.9 MB; loaded in the background when you become a hero so they
start at once. Same fallback to the still picture. All five clips together are about 4 MB, in
`public/video/`. Their cost shows only in the Higgsfield console.

**Hero card clips** (Higgsfield API, Hailuo 2.3 image-to-video, 768p): every hero's portrait brought
to life, `public/video/hero-<id>.mp4` (768×1024, 5.9 s each, 7.4 MB for all eleven). Strand lowers
the arm holding his line and steps toward the camera; Forge hovers over the bay, thrusters flaring;
Raiko's blade floods the rainy neon street with violet light; Sable steps forward as the hounds raise
their heads (the pack grows from four to about seven: an AI quirk, kept); Rook finishes a stretch
punch, bounces and grins; Brann lifts the hammer into the storm; Bulwark roars as his veins blaze;
Warden raises the shield; Kitsu's wind sphere swells as the camera closes in; Trine turns her blades
in falling blossoms; Ember walks forward, fists burning. A clip plays over the portrait on the card
shown when you become that hero (the card then stays up 3.4 s instead of 2.2), and the clips of the
heroes you can pick load while the Hero Hall's hero list is open, so they start at once. Made with
`node tools/higgsfield.mjs video <image-url> "<prompt>" out.mp4`, from each portrait's address in
this public repository (the API takes the picture as a public URL), all eleven at once in about two
minutes; then re-encoded (H.264, CRF 27, no sound) to 0.4-1 MB each. `HERO_CLIPS` in
`systems/heroes.js` lists the heroes that have one.

**Tested:** the title clip loading and looping; Kurozan's, Shade's, Vektor's and the dragon's
clips playing on their cards (with reduced motion switched off in the test tab only). No errors.

**Tested:** the Hero Hall menu with the five portraits, the hero card and the HUD portrait, Kurozan's
card and the dragon card, the boss bar portrait, all six advert pictures loaded on the towers, the
framed print, Strand's new visor and Rook's new colours. No errors.
## Performance (Phase 5)

Measured on the development machine (Apple M2, 8 GB) in the app's browser pane at full render
scale (1.5×), while a second copy of the game was running in another tab, so absolute times are
pessimistic. Draw calls are exact.

| Scene | Draw calls before | after | Frame render before | after |
| --- | --- | --- | --- | --- |
| Park at noon | 1,023 | 302 | 30.6 ms | 13 ms |
| Concert, 31 residents close up | 2,327 | 441 | 36.9 ms | 16 ms |
| Bio-Eden looking at the city | 1,723 | 424 | 23.7 ms | 14 ms |
| Street in rain, evening | not recorded | 352 | 22.3 ms | 13 ms |

What changed: fixed city geometry is merged (the quarter went from 1,087 objects to 71), each
character is one skinned mesh instead of about 38 parts, vehicles and service machines are merged
per joint, small props and anything indoors or airborne stay out of the shadow map, far-away
street furniture is hidden, and anti-aliasing is 2× by default (4× on High). Game logic costs
under 1 ms per frame. On Low the park renders in about 6.5 ms. A run of three game days
(216,000 steps across all districts and every weather type) finished with no errors.

## Layout

```
src/core      input, collision, math, settings, shared game context
src/world     city, interiors, shop rooms, furnishings, roads, tower detail, six outer districts and their construction kit, static batching, nav graph, sky and weather, materials, park, coast, suburb, beach villa, expo, mountains, water, the Skyline Run rooftops
src/world/metro  the street grid: land use, block layout, geometry writer, building shells, tile streaming, streets and signals, furniture, building detail, avenue traffic, buses, routes
src/entities  rigs, crowd impostors, player, vehicle flight model, traffic, residents, passers-by, companion dog
src/systems   dialogue, economy, garage, career, food, jobs, racing, drone, arcade, games, shops, home, teleport, rides, street activities, coast activities, world (districts), events, transit, audio, save, interaction, climbing (ladders), the Skyline Run, the Bot Arena, the orbital lift, stadium, races, street taxi
src/data      identities, schedules, social graph, dialogue text, vehicle classes, district sites
src/ui        HUD, menus, title and character creator
```

`window.NEO` in the browser console exposes test hooks (`NEO.time(21)`, `NEO.weather('storm')`, `NEO.tp(x, y, z)`, `NEO.bench()` for a per-part frame profile).
Adding `?slot=name` to the address uses a separate save slot.
