import { type GameClock, type Vec3, hm, minuteOfDay } from "@seki/core";
import type { ScheduleDef } from "../world/components";
import { type ActorSpawn, v } from "./builders";
import { FOOTBRIDGE_WALK, KANAL_SPOTS } from "./district-targ";
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

/** Babcia Ume: on the street from early morning, home in the doorway by the south lamp late at night. */
const ume = (): ScheduleDef => {
  const spot = spawnOf("ume");
  const corner = offset(spot.position, -0.2, -4);
  const home = offset(spot.position, -1.1, -7.5);
  return {
    speed: CIVILIAN_WALK,
    stops: [
      { label: "ulica", at: hm(6, 30), path: [corner, spot.position], yaw: spot.yaw },
      { label: "dom", at: hm(23), path: [corner, home], yaw: spot.yaw },
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
      { label: "stragan", at: OYAJI_HOURS.open, path: [front, stall.position], yaw: stall.yaw },
      {
        label: "dom",
        at: OYAJI_HOURS.close,
        path: [front, door],
        yaw: stall.yaw,
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
      { label: "posterunek", at: hm(5), path: [p], yaw: post.yaw },
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

/**
 * Hideo (ADR-0026): sleeps in the doorway of the west block, crosses the footbridge to the
 * market gate in the morning (the Tessen office bus stops there), and comes back over it to
 * the SAKE bar in the evening, where he stands until two.
 */
const hideo = (): ScheduleDef => {
  const sake = spawnOf("hideo");
  const { hideoHome: home, hideoKiosk: kiosk } = KANAL_SPOTS;
  const bend = v(7, 0, 72);
  const kerb = v(7, 0, 78.8);
  const westEnd = v(12, 0, 79);
  return {
    speed: CIVILIAN_WALK,
    stops: [
      { label: "dom", at: hm(2), path: [bend, home], yaw: Math.PI / 2 },
      { label: "do pracy", at: hm(7, 30), path: [kerb, ...FOOTBRIDGE_WALK, kiosk], yaw: Math.PI / 2 },
      { label: "sake", at: hm(19), path: [kiosk, ...[...FOOTBRIDGE_WALK].reverse(), westEnd, bend, sake.position], yaw: sake.yaw },
    ],
  };
};

/** Mei sings at KARAOKE from 20:00 to 4:00; by day she waits out the light in the corner by the bend. */
const mei = (): ScheduleDef => {
  const stage = spawnOf("mei");
  const corner = v(9, 0, 80.6);
  return {
    speed: CIVILIAN_WALK,
    stops: [
      { label: "dom", at: hm(4), path: [corner, KANAL_SPOTS.meiHome], yaw: Math.PI / 2 },
      { label: "karaoke", at: hm(20), path: [corner, stage.position], yaw: stage.yaw },
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
        interaction: { kind: "dialogue", dialogueId: "fumiko_closed", prompt: "Ramen u Fumiko: zamknięte do 16:00", radius: 3 },
      },
      { label: "stragan", at: YATAI_HOURS.open, path: [behind, stall.position], yaw: stall.yaw },
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
};
