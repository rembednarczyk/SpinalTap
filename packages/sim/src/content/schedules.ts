import { type GameClock, type Vec3, hm, minuteOfDay } from "@seki/core";
import type { ScheduleDef } from "../world/components";
import type { ActorSpawn } from "./builders";
import { UME_CORNER, UME_HOME } from "./district-m0";
import { GRODZKA_WALK, KANAL_SPOTS } from "./district-kanal";
import { KANAL_PATROL_SCHEDULES } from "./kanal-patrols";
import { P2, atUnit } from "./alchemia";
import { FUMIKO_DOWN, FUMIKO_OUT, FUMIKO_UP, OYAJI_NIGHT } from "./alchemia/keeper-walks";
import { FUMIKO_WINDOW_YAW } from "./alchemia/fumiko-p0";
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

/**
 * Oyaji's shop in the food hall on P3 (ADR-0093 O3; on the hall's floor until then, his night by its
 * back door on T1): at 22:00 he steps back from the counter and sits out the night behind his grille
 * by its south end, the shop dark, in reach across the counter.
 */
const oyaji = (): ScheduleDef => {
  const shop = spawnOf("oyaji");
  return {
    speed: CIVILIAN_WALK,
    stops: [
      // He lays out and rearranges his wares (the hands-on-the-counter loop), and sweeps up.
      { label: "stragan", at: OYAJI_HOURS.open, path: [OYAJI_NIGHT, shop.position], yaw: shop.yaw, activity: { cycle: ["cook", "cook", "sweep"], minutes: 20 } },
      {
        label: "dom",
        at: OYAJI_HOURS.close,
        path: [shop.position, OYAJI_NIGHT],
        yaw: -Math.PI / 2,
        activity: "sit",
        interaction: { kind: "dialogue", dialogueId: "oyaji_closed", prompt: "prompt.closed.oyaji", radius: 2.4 },
      },
    ],
  };
};

/**
 * The Hebi lookout by the shelter's hatch on T2 (ADR-0074 stage 5d2, §3): holds his post by it by
 * day; at night walks P-2, there and back: west along T2 north of its beds, into the cutting, down
 * the corridor past the shelter's gate to the store's corner and its service aisle.
 */
const hebiLookout = (): ScheduleDef => {
  const post = spawnOf("hebi-lookout");
  const p = post.position;
  const f = P2.floor;
  const out = [ground(430, 99.8), ground(417.4, 99.8), { x: 417.4, y: f, z: 90 }, { x: 417.4, y: f, z: 72 }, { x: 419.35, y: f, z: 34 }, { x: 419.35, y: f, z: 26.5 }, { x: 416.5, y: f, z: 26.5 }, { x: 416, y: f, z: 20 }];
  const back = out.slice(0, -1).reverse();
  return {
    speed: PATROL_WALK,
    stops: [
      { label: "posterunek", at: hm(5), path: [p], yaw: post.yaw, activity: { cycle: ["guard", "smoke"], minutes: 30 } },
      { label: "patrol", at: hm(22), path: [p, ...out, ...back], yaw: post.yaw, loop: true },
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
  // Over the Rynek and into Bramowa at its mouth: from SAKE straight to Bramowa runs through the houses (G-943).
  const rynek = ground(548, -70);
  const mouth = ground(536, -54);
  return {
    speed: CIVILIAN_WALK,
    stops: [
      { label: "dom", at: hm(2), path: [rynek, mouth, bramowa, home], yaw: Math.PI / 2, activity: "sleep" },
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

/**
 * The food hall is open 10:00-24:00 as the real one (ADR-0074, the user's decision of 6.11):
 * Kenta and Goro cook and sell at their counters then, and sit at the back of their units at night.
 * Sachiko's kiosk keeps its old hours (always), Fumiko's bar and Oyaji's shop theirs.
 */
export const FOODHALL_HOURS = { open: hm(10), close: hm(0) } as const;

/** Fumiko's ramen stall is open 16:00–4:00 (ADR-0026): the night market eats, the day one works. */
export const YATAI_HOURS = { open: hm(16), close: hm(4) } as const;

/** The ramen stall is open (the shop trades only then). */
export const yataiOpen = (clock: GameClock): boolean => {
  const m = minuteOfDay(clock);
  return m >= YATAI_HOURS.open || m < YATAI_HOURS.close;
};

/**
 * Fumiko (ADR-0026; ADR-0093 O3): from four in the afternoon at her bar in the food hall on P3; after
 * midnight, the food hall shut, down the escalators and round by T1 to her second place on P0, the
 * night market served across its hatch till four; then out of its door onto the last stool before
 * the hatch until the afternoon (`alchemia/keeper-walks.ts`).
 */
const fumiko = (): ScheduleDef => {
  const bar = spawnOf("fumiko");
  return {
    speed: CIVILIAN_WALK,
    stops: [
      { label: "okienko", at: FOODHALL_HOURS.close, path: FUMIKO_DOWN.slice(1) as [Vec3, ...Vec3[]], yaw: FUMIKO_WINDOW_YAW, activity: { cycle: ["cook", "sweep"], minutes: 20 } },
      {
        label: "dom",
        at: YATAI_HOURS.close,
        path: FUMIKO_OUT.slice(1) as [Vec3, ...Vec3[]],
        yaw: Math.PI,
        activity: "sit",
        interaction: { kind: "dialogue", dialogueId: "fumiko_closed", prompt: "prompt.closed.fumiko", radius: 3 },
      },
      { label: "stragan", at: YATAI_HOURS.open, path: [FUMIKO_UP[1]!, ...FUMIKO_UP.slice(2, -1), bar.position], yaw: bar.yaw, activity: { cycle: ["cook", "sweep"], minutes: 20 } },
    ],
  };
};

const hallKeeper = (key: "kenta" | "goro"): ScheduleDef => {
  const counter = spawnOf(key);
  // At the back of the unit before its kitchen's line (ADR-0093 O3: the food hall's units on P3 are 4.8 m deep).
  const back = atUnit(key, -3.2);
  return {
    speed: CIVILIAN_WALK,
    stops: [
      { label: "dom", at: FOODHALL_HOURS.close, path: [counter.position, back], yaw: counter.yaw, activity: "sit" },
      { label: "lokal", at: FOODHALL_HOURS.open, path: [back, counter.position], yaw: counter.yaw, activity: { cycle: ["cook", "sweep"], minutes: 20 } },
    ],
  };
};

/**
 * Sachiko keeps her kiosk all day (ADR-0093 O3): one stop, so a character restored from a save made
 * before the food hall went up to P3 is put behind her counter there, not left on P0 (ADR-0017).
 */
const sachiko = (): ScheduleDef => {
  const kiosk = spawnOf("sachiko");
  return { speed: CIVILIAN_WALK, stops: [{ label: "kiosk", at: 0, path: [kiosk.position], yaw: kiosk.yaw }] };
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
  sachiko: sachiko(),
  ...KANAL_PATROL_SCHEDULES,
};
