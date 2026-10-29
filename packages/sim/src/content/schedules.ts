import { type GameClock, type Vec3, hm, minuteOfDay } from "@seki/core";
import type { ScheduleDef } from "../world/components";
import type { ActorSpawn } from "./builders";
import { UME_CORNER, UME_HOME } from "./district-m0";
import { GRODZKA_WALK, KANAL_SPOTS } from "./district-kanal";
import { KANAL_PATROL_SCHEDULES } from "./kanal-patrols";
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

const offset = (p: Vec3, dx: number, dz: number): Vec3 => ({ x: p.x + dx, y: p.y, z: p.z + dz });

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

/** Oyaji keeps his stall open 8:00–22:00, then shuts it and sits out the night in his doorway. */
export const OYAJI_HOURS = { open: hm(8), close: hm(22) } as const;

/** The stall is open (trade, protection jobs from Hana; ADR-0017, ADR-0018). */
export const oyajiStallOpen = (clock: GameClock): boolean => {
  const m = minuteOfDay(clock);
  return m >= OYAJI_HOURS.open && m < OYAJI_HOURS.close;
};

const oyaji = (): ScheduleDef => {
  const stall = spawnOf("oyaji");
  const front = offset(stall.position, -3, -1.2);
  // His door, kept clear of the fire-escape ladder at x 73.2 so the night prompt never covers it.
  const door = offset(stall.position, -4, -2);
  return {
    speed: CIVILIAN_WALK,
    stops: [
      // He lays out and rearranges his wares (the hands-on-the-counter loop), and sweeps up.
      { label: "stragan", at: OYAJI_HOURS.open, path: [front, stall.position], yaw: stall.yaw, activity: { cycle: ["cook", "cook", "sweep"], minutes: 20 } },
      {
        label: "dom",
        at: OYAJI_HOURS.close,
        path: [front, door],
        yaw: stall.yaw,
        activity: "sit",
        interaction: { kind: "dialogue", dialogueId: "oyaji_closed", prompt: "Stragan Oyajiego: zamknięte do 8:00", radius: 2.4 },
      },
    ],
  };
};

/** The Hebi lookout under the highway: holds his corner by day, walks a loop round the pillars at night. */
const hebiLookout = (): ScheduleDef => {
  const post = spawnOf("hebi-lookout");
  const p = post.position;
  return {
    speed: PATROL_WALK,
    stops: [
      { label: "posterunek", at: hm(5), path: [p], yaw: post.yaw, activity: { cycle: ["guard", "smoke"], minutes: 30 } },
      {
        label: "patrol",
        at: hm(22),
        path: [p, offset(p, -16, 0), offset(p, -16, 7), offset(p, 6, 7), offset(p, 6, 0)],
        yaw: post.yaw,
        loop: true,
      },
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
  const stall = spawnOf("fumiko");
  const behind = offset(stall.position, 0, 1);
  // A stool behind the next stall west, by the wall of the north row.
  const stool = offset(stall.position, -3.4, 1.2);
  return {
    speed: CIVILIAN_WALK,
    stops: [
      {
        label: "dom",
        at: YATAI_HOURS.close,
        path: [behind, stool],
        yaw: stall.yaw,
        activity: "sit",
        interaction: { kind: "dialogue", dialogueId: "fumiko_closed", prompt: "Ramen u Fumiko: zamknięte do 16:00", radius: 3 },
      },
      { label: "stragan", at: YATAI_HOURS.open, path: [behind, stall.position], yaw: stall.yaw, activity: { cycle: ["cook", "sweep"], minutes: 20 } },
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
  ...KANAL_PATROL_SCHEDULES,
};
