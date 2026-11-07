import { type GameClock, hm, minuteOfDay } from "@seki/core";
import type { ScheduleDef } from "../world/components";
import type { ActorSpawn } from "./builders";
import { UME_CORNER, UME_HOME } from "./district-m0";
import { GRODZKA_WALK, KANAL_SPOTS } from "./district-kanal";
import { KANAL_PATROL_SCHEDULES } from "./kanal-patrols";
import { OYAJI_BACK_DOOR, OYAJI_BACK_ROOM, arkadySpanMid, atUnit, byArkady, opening } from "./alchemia";
import { HALL } from "./alchemia/plan";
import { spotNear } from "./lublin/places";
import { ground } from "./lublin/terrain";
import { WORLD_CHUNKS } from "./world-map";

/**
 * Daily plans of the characters placed by content (plan §6, "Spawn / schedule"), keyed by the
 * actor's key. Each plan is anchored on the actor's spawn point from the district tables, so
 * the districts own where a character stands and this table owns when it goes elsewhere.
 * Paths are straight lines between waypoints, laid out clear of the district's solids.
 */

const spawnOf = (key: string): ActorSpawn => {
  for (const chunk of WORLD_CHUNKS) {
    const def = chunk.actors.find((a) => a.spawn.key === key);
    if (def) return def.spawn;
  }
  throw new Error(`schedule for unknown actor "${key}"`);
};

const CIVILIAN_WALK = 1.2;
const PATROL_WALK = 1.6;

/** Babcia Ume: on the deptak from early morning, home in the doorway by the clinic late at night. */
const ume = (): ScheduleDef => {
  const spot = spawnOf("ume");
  const corner = UME_CORNER;
  const home = UME_HOME;
  return {
    speed: CIVILIAN_WALK,
    stops: [
      { label: "ulica", at: hm(6, 30), path: [corner, spot.position], yaw: spot.yaw, activity: { cycle: ["sweep", "talk"], minutes: 40 } },
      { label: "dom", at: hm(23), path: [corner, home], yaw: spot.yaw, activity: "sleep" },
    ],
  };
};

/** Oyaji keeps his shop open 8:00–22:00, then shuts it and sits out the night by his back door. */
export const OYAJI_HOURS = { open: hm(8), close: hm(22) } as const;

/** The stall is open (trade, protection jobs from Hana; ADR-0017, ADR-0018). */
export const oyajiStallOpen = (clock: GameClock): boolean => {
  const m = minuteOfDay(clock);
  return m >= OYAJI_HOURS.open && m < OYAJI_HOURS.close;
};

/** Through Oyaji's back room: from his shop's door to the back door onto T1 (ADR-0074 §3). */
const OYAJI_DOOR_X = (OYAJI_BACK_DOOR.minX + OYAJI_BACK_DOOR.maxX) / 2;
const OYAJI_EXIT_X = (opening("oyaji-door").x0 + opening("oyaji-door").x1) / 2;
const OYAJI_WAY_OUT = [
  { x: OYAJI_DOOR_X, y: HALL.floor, z: OYAJI_BACK_ROOM.minZ - 1.2 },
  { x: OYAJI_DOOR_X, y: HALL.floor, z: OYAJI_BACK_ROOM.minZ + 0.9 },
  { x: OYAJI_EXIT_X, y: HALL.floor, z: HALL.maxZ - 1.4 },
] as const;

const oyaji = (): ScheduleDef => {
  const shop = spawnOf("oyaji");
  // He sits out the night outside his back door on T1, by the front's glass.
  const doorway = ground(OYAJI_EXIT_X + 1.6, HALL.maxZ + 0.9);
  const step = ground(OYAJI_EXIT_X, HALL.maxZ + 0.9);
  return {
    speed: CIVILIAN_WALK,
    stops: [
      // He lays out and rearranges his wares (the hands-on-the-counter loop), and sweeps up.
      { label: "stragan", at: OYAJI_HOURS.open, path: [step, ...[...OYAJI_WAY_OUT].reverse(), shop.position], yaw: shop.yaw, activity: { cycle: ["cook", "cook", "sweep"], minutes: 20 } },
      {
        label: "dom",
        at: OYAJI_HOURS.close,
        path: [shop.position, ...OYAJI_WAY_OUT, step, doorway],
        yaw: Math.PI,
        activity: "sit",
        interaction: { kind: "dialogue", dialogueId: "oyaji_closed", prompt: "prompt.closed.oyaji", radius: 2.4 },
      },
    ],
  };
};

/**
 * The Hebi lookout by the Arkady north of the stash on T2 (ADR-0074 stage 2): holds his place under
 * their arches by day, walks a loop of the square at night, out of the stash's corner.
 */
const hebiLookout = (): ScheduleDef => {
  const post = spawnOf("hebi-lookout");
  const p = post.position;
  return {
    speed: PATROL_WALK,
    stops: [
      { label: "posterunek", at: hm(5), path: [p], yaw: post.yaw, activity: { cycle: ["guard", "smoke"], minutes: 30 } },
      // Out from under the arch of his span (between the piers), then round the square.
      { label: "patrol", at: hm(22), path: [p, byArkady(arkadySpanMid(8), 1.5), ground(452, 121), ground(441, 122), ground(434, 108)], yaw: post.yaw, loop: true },
    ],
  };
};

/** Where Hideo waits for the Tessen bus: on Zamkowa, below Brama Grodzka. */
export const HIDEO_BUS_STOP = spotNear(730, 155);

/**
 * Hideo (ADR-0026): sleeps in a doorway on Bramowa, walks down Grodzka and through Brama
 * Grodzka to the Tessen bus in the morning, and comes back the same way to SAKE on the Rynek in
 * the evening, where he stands until two.
 */
const hideo = (): ScheduleDef => {
  const sake = spawnOf("hideo");
  const { hideoHome: home } = KANAL_SPOTS;
  const bramowa = ground(520, -63);
  return {
    speed: CIVILIAN_WALK,
    stops: [
      { label: "dom", at: hm(2), path: [bramowa, home], yaw: Math.PI / 2, activity: "sleep" },
      { label: "do pracy", at: hm(7, 30), path: [bramowa, ...GRODZKA_WALK, HIDEO_BUS_STOP], yaw: Math.PI / 2, activity: "phone" },
      { label: "sake", at: hm(17), path: [HIDEO_BUS_STOP, ...[...GRODZKA_WALK].reverse(), sake.position], yaw: sake.yaw, activity: "drink" },
    ],
  };
};

/** Mei sings at KARAOKE from 20:00 to 4:00; by day she waits out the light in a doorway off the Rynek. */
const mei = (): ScheduleDef => {
  const stage = spawnOf("mei");
  const corner = spotNear(545, -46);
  return {
    speed: CIVILIAN_WALK,
    stops: [
      { label: "dom", at: hm(4), path: [corner, KANAL_SPOTS.meiHome], yaw: Math.PI / 2, activity: "sit" },
      // A cigarette under the KARAOKE sign between songs.
      { label: "karaoke", at: hm(20), path: [corner, stage.position], yaw: stage.yaw, activity: { cycle: ["smoke", "talk"], minutes: 15 } },
    ],
  };
};

/** Fumiko's ramen stall is open 16:00–4:00 (ADR-0026): the night market eats, the day one works. */
export const YATAI_HOURS = { open: hm(16), close: hm(4) } as const;

/** The ramen stall is open (the shop trades only then). */
export const yataiOpen = (clock: GameClock): boolean => {
  const m = minuteOfDay(clock);
  return m >= YATAI_HOURS.open || m < YATAI_HOURS.close;
};

const fumiko = (): ScheduleDef => {
  const bar = spawnOf("fumiko");
  // Out through her own door onto T1 and onto the last stool before her hatch, by day.
  const door = opening("fumiko-door");
  const x = (door.x0 + door.x1) / 2;
  const inside = { x, y: HALL.floor, z: HALL.maxZ - 1.5 };
  const outside = ground(x, HALL.maxZ + 0.9);
  const stool = atUnit("fumiko", 1.2, 1.4);
  const stoolOnT1 = ground(stool.x, stool.z);
  return {
    speed: CIVILIAN_WALK,
    stops: [
      {
        label: "dom",
        at: YATAI_HOURS.close,
        path: [bar.position, inside, outside, stoolOnT1],
        yaw: Math.PI,
        activity: "sit",
        interaction: { kind: "dialogue", dialogueId: "fumiko_closed", prompt: "prompt.closed.fumiko", radius: 3 },
      },
      { label: "stragan", at: YATAI_HOURS.open, path: [stoolOnT1, outside, inside, bar.position], yaw: bar.yaw, activity: { cycle: ["cook", "sweep"], minutes: 20 } },
    ],
  };
};

/**
 * The food hall is open 10:00-24:00 as the real one (ADR-0074, the user's decision of 6.11):
 * Kenta and Goro cook and sell at their counters then, and sit at the back of their units at night.
 * Sachiko's kiosk keeps its old hours (always), Fumiko's bar and Oyaji's shop theirs.
 */
export const FOODHALL_HOURS = { open: hm(10), close: hm(0) } as const;

const hallKeeper = (key: "kenta" | "goro"): ScheduleDef => {
  const counter = spawnOf(key);
  const back = atUnit(key, -3.6);
  return {
    speed: CIVILIAN_WALK,
    stops: [
      { label: "dom", at: FOODHALL_HOURS.close, path: [counter.position, back], yaw: counter.yaw, activity: "sit" },
      { label: "lokal", at: FOODHALL_HOURS.open, path: [back, counter.position], yaw: counter.yaw, activity: { cycle: ["cook", "sweep"], minutes: 20 } },
    ],
  };
};

export const SCHEDULES: Readonly<Record<string, ScheduleDef>> = {
  ume: ume(),
  oyaji: oyaji(),
  "hebi-lookout": hebiLookout(),
  hideo: hideo(),
  mei: mei(),
  fumiko: fumiko(),
  kenta: hallKeeper("kenta"),
  goro: hallKeeper("goro"),
  ...KANAL_PATROL_SCHEDULES,
};
