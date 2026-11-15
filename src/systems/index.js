// Gameplay systems are created and ticked here so main.js stays a thin loop.
import { G } from '../core/game.js';
import { clamp } from '../core/util.js';
import { NPCSystem } from '../entities/npc.js';
import { Dog } from '../entities/dog.js';
import { Dialogue } from './dialogue.js';
import { Economy } from './economy.js';
import { Food } from './food.js';
import { Jobs } from './jobs.js';
import { Events } from './events.js';
import { Wanted } from './wanted.js';
import { Transit } from './transit.js';
import { Garage } from './garage.js';
import { Racing } from './racing.js';
import { DroneOps } from './drone.js';
import { Arcade } from './arcade.js';
import { World } from './world.js';
import { Shops } from './shops.js';
import { Home } from './home.js';
import { Teleport } from './teleport.js';
import { Rides } from './rides.js';
import { Games } from './games.js';
import { Street } from './street.js';
import { Coast } from './coast.js';
import { Ambient } from '../entities/ambient.js';
import { Wrecks } from './wrecks.js';
import { Happenings } from './happenings.js';
import { Court } from './court.js';
import { CanalRace } from './canalrace.js';
import { StreetRace } from './streetrace.js';
import { StreetTaxi } from './streettaxi.js';
import { Stadium } from './stadium.js';
import { Climbing } from './climb.js';
import { SkylineRun } from './parkour.js';
import { SwingCourse } from './swingcourse.js';
import { BotArena } from './botarena.js';
import { OrbitalLift } from './orbital.js';
import { Story } from './story.js';
import { Incidents } from './incidents.js';
import { Diving } from './diving.js';
import { CoastLine } from './coastline.js';
import { Places } from './places.js';
import { Survey } from './survey.js';
import { Gallery } from './gallery.js';
import { Fx } from './fx.js';
import { Combat } from './combat.js';
import { Damage } from './damage.js';
import { Heroes } from './heroes.js';
import { Villains } from './villains.js';
import { Phone } from '../ui/phone.js';
import { GameAudio } from './audio.js';
import { Music } from './music.js';
import { Sfx } from './sfx.js';
import { Voice } from './voice.js';
import { Settings } from '../core/settings.js';

export function initSystems() {
  G.figureHooks = [];   // extra figures drawn by the passers-by system (fares waiting at the kerb, and the like)
  // seats: every bench and stool in the city can be sat on
  for (const s of G.city.seats) G.interact.add({ pos: s, r: 1.5, yTol: 1.4, label: 'Sit', enabled: () => !s.taken, use: () => G.player.sit(s) });
  // district news: recent events that residents bring up in conversation
  G.env.news = [];
  G.addNews = (key) => { const n = G.env.news; n.push({ key, at: G.env.day * 1440 + G.env.mins }); if (n.length > 12) n.shift(); };
  G.audio = new GameAudio();
  G.music = new Music(); G.sfx = new Sfx(); G.voice = new Voice();
  Settings.onChange((k, v) => { if (k === 'volume') G.audio.setVolume(v); });
  G.npcs = new NPCSystem();
  G.dialogue = new Dialogue();
  G.economy = new Economy();
  G.food = new Food();
  G.jobs = new Jobs();
  G.events = new Events();
  G.wanted = new Wanted();
  G.transit = new Transit();
  G.garage = new Garage();
  G.racing = new Racing();
  G.drone = new DroneOps();
  G.arcade = new Arcade();
  G.world = new World();
  G.home = new Home();
  G.teleport = new Teleport();
  G.rides = new Rides();
  G.games = new Games();
  G.street = new Street();
  G.coast = new Coast();
  G.ambient = new Ambient();
  G.wrecks = new Wrecks();
  G.happen = new Happenings();
  G.court = new Court();
  G.canal = new CanalRace();
  G.nightRun = new StreetRace();
  G.expo = G.stadium = new Stadium();
  G.streetTaxi = new StreetTaxi();
  G.climbing = new Climbing();
  G.parkour = new SkylineRun();
  G.swingCourse = new SwingCourse();
  G.bots = new BotArena();
  G.orbital = new OrbitalLift();
  G.story = new Story();
  G.incidents = new Incidents();
  G.diving = new Diving();
  G.coastLine = new CoastLine();
  G.places = new Places();
  G.gallery = new Gallery();
  // Hero Mode: effects, the combat core, damage to the city, the heroes and Kurozan's crew
  G.fx = new Fx(); G.combat = new Combat(); G.damage = new Damage(); G.heroes = new Heroes(); G.villains = new Villains();
  G.survey = new Survey();
  G.figureHooks.push((A, focus) => G.bots.figures(A, focus));
  G.figureHooks.push((A, focus) => G.stadium.figures(A, focus));
  G.phone = new Phone();
  G.shops = new Shops();
  G.dog = new Dog();

  // Skip game time (waiting, sleeping, finishing a shift): the clock jumps and every
  // resident is placed where their schedule says they should be by then.
  G.skip = (mins, energy = 0, quiet = false) => {
    const go = () => {
      const env = G.env; env.mins += mins; while (env.mins >= 1440) { env.mins -= 1440; env.day++; }
      env.wxTimer -= mins; G.npcs.resync(); G.player.energy = clamp(G.player.energy + energy, 0, 100);
    };
    if (quiet) go(); else G.ui.fade(go);
  };
  // After a save is loaded: rebuild anything derived from state.
  G.afterLoad = () => { G.story.sync(); G.home.refresh(); G.garage.sync(); G.dog.refresh(); G.jobs.sync(); G.economy.refreshAster(); G.npcs.resync(); };
}

export function updateSystems(dt, prof) {
  const t = G.elapsed;
  if (G.started && !G.ui.menu && !G.minigame && G.input.pressed('Tab')) G.economy.lensMenu();
  let t0 = prof ? performance.now() : 0;
  G.npcs.update(dt, t);
  if (prof) { const n = performance.now(); prof.npcs = (prof.npcs || 0) + n - t0; t0 = n; }
  G.transit.update();
  G.dog.update(dt);
  G.economy.update(dt, t);
  G.food.update(dt, t);
  G.jobs.update(dt, t);
  G.racing.update(dt, t);
  G.drone.update(dt, t);
  G.arcade.update(dt);
  G.world.update(dt, t);
  G.shops.update(dt);
  G.home.update(dt, t);
  G.teleport.update(dt, t);
  G.rides.update(dt);
  G.games.update(dt);
  G.street.update(dt);
  G.wrecks.update(dt);
  G.coast.update(dt, t);
  G.happen.update(dt, t);
  G.court.update(dt);
  G.canal.update(dt, t);
  G.nightRun.update(dt, t);
  G.streetTaxi.update(dt, t);
  G.stadium.update(dt);
  G.parkour.update(dt);
  G.swingCourse.update(dt);
  G.bots.update(dt);
  G.orbital.update(dt);
  G.story.update(dt);
  G.incidents.update(dt, t);
  G.diving.update(dt);
  G.coastLine.update(dt);
  G.phone.update(dt);
  G.heroes.update(dt, t); G.villains.update(dt, t); G.combat.update(dt); G.damage.update(dt, t); G.fx.update(dt);
  G.events.update(dt, t);
  G.wanted.update(dt, t);
  G.audio.update(dt);
  G.music.update(dt); G.voice.update(dt);
  if (prof) prof.systems = (prof.systems || 0) + performance.now() - t0;
}
