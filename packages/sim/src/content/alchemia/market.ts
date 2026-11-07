import {
  ACT_TWO_ENDING_FLAG,
  type ContractSiteId,
  type GroundPoint,
  KAGAMI_AMBUSH_FLAG,
  KAGAMI_CLEANER_KEYS,
  KAGAMI_JOB_FLAG,
  type LootLine,
  REN_TRAIL_FLAG,
  type Vec3,
  endingFlag,
} from "@seki/core";
import { type ActorDef, type Rect, type StaticProp, crate, lamp } from "../builders";
import { ground, groundY } from "../lublin/terrain";
import { ALCHEMIA_LIFT } from "./lift";
import { ARKADY_ARCADE_FLOOR, ARKADY_FRAME, arkadyPoint, arkadySpanMid } from "./arkady";
import { HALL, NORTH, SOUTH, facing } from "./plan";
import { KEEPER_SPOTS, KEEPER_YAW, type KeeperKey } from "./units";

/**
 * The market in Alchemia by the investor's plan (ADR-0074 §3, stage 1; once ADR-0063 stage 6):
 * the stallholders keep their units in the food hall, each behind his or her own counter (`units.ts`);
 * Hana sells from her cart on the square in front of it (T1); Ren sleeps on the hall's green roof
 * (T0) until the triangular pavilion is built (stage 3), the Hebi bag by him; Kurosawa of Kagami
 * waits by the lift's kiosk on the car park. The Hebi keep their stash on the lower square T2 before
 * the Arkady's south arches (stage 2, until the shelter of stage 5), their lookout by the Arkady.
 *
 * World metres, every point on the ground, on the hall's floor or on its roof.
 */

/** The keepers' units (`units.ts`): once the numbers of the five stalls. */
export const STALL_OF = { sachiko: "sachiko", kenta: "kenta", fumiko: "fumiko", goro: "goro", oyaji: "oyaji" } as const;

/** Where each keeper stands, behind the counter of his or her unit. */
export const STALL_KEEPERS: Readonly<Record<KeeperKey, Vec3>> = KEEPER_SPOTS;

/** Hana sells parts from a handcart on T1 in front of the hall, facing its way in. */
export const HANA_SPOT: Vec3 = ground(428, 66);
const HANA_YAW = SOUTH;

/** Oyaji can be hurt: Hebi come for him in Hana's protection jobs. */
export const OYAJI_MAX_HP = 120;

/** A point before the Arkady's west face (`arkady.ts`): `along` metres from its south corner, `out` metres off it, on the ground. */
export const byArkady = (along: number, out: number, up = 0): Vec3 => {
  const p = arkadyPoint(along, -out);
  return ground(p.x, p.z, up);
};

/** Which way a thing on the Arkady's west face faces: out of it, to the square. */
export const ARKADY_OUT_YAW = Math.atan2(-ARKADY_FRAME.across.x, -ARKADY_FRAME.across.z);

/** The Hebi stash on T2 before the Arkady's south arches (the retrieval's no-go zone, `devices.ts`). */
export const HEBI_STASH_ZONE: Rect = { minX: 435, maxX: 449, minZ: 86, maxZ: 101 };

/** A box standing on the ground at (x, z), sunk a little into the slope's high side. */
const onGround = (p: StaticProp, sink = 0.08): StaticProp => ({ ...p, center: { ...p.center, y: p.center.y + groundY(p.center.x, p.center.z) - sink } });

/**
 * The stash before the third span from the south (6.25..9.9 m, the orthophoto's, `ARKADY_PIERS`),
 * its cover further out: where they stood by the ruin, which the retrieval's sneaking is laid out round.
 */
const STASH_ALONG = 9;
const RETRIEVE_CRATE = byArkady(STASH_ALONG, 1.8);

/** A lamp standing on the ground at `p`. */
const lampAt = (p: Vec3, color: string): StaticProp => ({ ...lamp(p.x, p.z, color), center: p });

const COVER = byArkady(STASH_ALONG, 4.2);
const BODY_CRATE = byArkady(13.6, 1.5);

/** Hana's cart, the Hebi stash's crates and lights: the market's own things outside the hall. */
export const ALCHEMIA_MARKET_PROPS: readonly StaticProp[] = [
  // Hana's handcart, just east of where she stands.
  onGround(crate(HANA_SPOT.x + 1.3, HANA_SPOT.z, 0.9, 1.0, 1.8)),
  lampAt(ground(HANA_SPOT.x + 1.3, HANA_SPOT.z + 1.6), "#9ad7ff"),
  // The Hebi stash: cover in front of it, and the big crate by it takes a body (ADR-0065).
  onGround(crate(COVER.x, COVER.z, 1.0, 1.1, 2.4)),
  { ...onGround(crate(BODY_CRATE.x, BODY_CRATE.z, 1.6, 1.4, 1.4)), hide: "container" },
  lampAt(byArkady(4, 1.2), "#ffcf8a"),
];

/** A stash placed once, when the player first comes near (ADR-0021). */
export interface RoofStash {
  readonly key: string;
  readonly at: Vec3;
  readonly lines: readonly LootLine[];
}

/** A point on the hall's green roof (T0). */
const onRoof = (x: number, z: number): Vec3 => ({ x, y: HALL.roof, z });

/**
 * Ren Odagiri sleeps on the hall's green roof, between its planters by the north parapet, looking
 * over T1 to the Old Town (act II, ADR-0023; on the triangular pavilion's roof from stage 3). He
 * turns up once someone told Seki where he is and is gone after the "kagami" ending.
 */
export const REN_SPOT: Vec3 = onRoof(419, 55.8);

/** Hebi's bag by Ren (ADR-0021): the key of the old roof stash, so a taken one stays taken. */
export const TARG_ROOF_STASH: RoofStash = {
  key: "stash:targ-roof",
  at: onRoof(420.6, 56.2),
  lines: [
    { kind: "eddies", qty: 180 },
    { kind: "ammo", ammo: "556", qty: 30 },
    { kind: "stack", item: "medkit", qty: 1 },
    { kind: "item", item: "holo_sight", rarity: "uncommon", qty: 1 },
  ],
};

/** The bag left by the Arkady the night of the blockade (ADR-0026; once in the car on the viaduct, then behind the ruin). */
export const TARG_OVERPASS_STASH: RoofStash = {
  key: "stash:targ-overpass",
  at: byArkady(arkadySpanMid(8), 1.2, 0.2),
  lines: [
    { kind: "eddies", qty: 120 },
    { kind: "ammo", ammo: "9mm", qty: 18 },
    { kind: "stack", item: "bandage", qty: 2 },
    { kind: "stack", item: "datachip", qty: 1 },
  ],
};

/** Kurosawa of Kagami waits on the car park by the lift's kiosk; his cleaners come from across it. */
const LIFT_DOOR: GroundPoint = ALCHEMIA_LIFT.doors[1];
export const KUROSAWA_SPOT: Vec3 = ground(LIFT_DOOR.x + 4.5, LIFT_DOOR.z - 2);
const CLEANER_SPOTS: readonly Vec3[] = [ground(408, 26.5), ground(420.5, 24), ground(413, 22.5)];

/** Tag of the cleaners (their deaths raise `killed:kagami_cleaner`). */
export const KAGAMI_CLEANER_TAG = "kagami_cleaner";

const REN: ActorDef = {
  kind: "npc",
  spawn: { key: "ren", position: REN_SPOT, yaw: NORTH },
  preset: "civilian",
  faction: "hebi",
  when: { all: [REN_TRAIL_FLAG], none: [endingFlag("kagami")] },
  interactable: { kind: "dialogue", dialogueId: "ren_odagiri", prompt: "prompt.talk.ren", radius: 2.4 },
};

const KUROSAWA: ActorDef = {
  kind: "npc",
  spawn: { key: "kurosawa", position: KUROSAWA_SPOT, yaw: facing(KUROSAWA_SPOT, LIFT_DOOR) },
  preset: "fixer",
  faction: "kagami",
  when: { all: [KAGAMI_JOB_FLAG], none: [KAGAMI_AMBUSH_FLAG, ACT_TWO_ENDING_FLAG] },
  interactable: { kind: "dialogue", dialogueId: "kurosawa", prompt: "prompt.talk.kurosawa", radius: 2.4 },
};

const CLEANERS: readonly ActorDef[] = KAGAMI_CLEANER_KEYS.map((key, i): ActorDef => {
  const at = CLEANER_SPOTS[i] ?? KUROSAWA_SPOT;
  return { kind: "ganger", spawn: { key, position: at, yaw: facing(at, LIFT_DOOR), tag: KAGAMI_CLEANER_TAG }, enemy: "kagami_cleaner", when: { all: [KAGAMI_AMBUSH_FLAG] } };
});

/** A keeper behind the counter, facing out of the unit; talked to (or traded with) across it. */
const keeper = (key: KeeperKey, interactable: NonNullable<Extract<ActorDef, { kind: "npc" }>["interactable"]>, maxHp?: number): ActorDef => ({
  kind: "npc",
  spawn: { key, position: STALL_KEEPERS[key], yaw: KEEPER_YAW[key] },
  preset: "civilian",
  faction: "civilians",
  bystander: true,
  // Behind a counter under the hall's roof: no umbrella (ADR-0041).
  indoor: true,
  ...(maxHp === undefined ? {} : { maxHp }),
  interactable,
});

/** The Hebi lookout by the Arkady north of the stash, under their arches: watches T2 and the stairs from T1 by day, walks the square at night. */
export const HEBI_LOOKOUT_POST: Vec3 = { ...byArkady(arkadySpanMid(8), -1.2), y: ARKADY_ARCADE_FLOOR };
/** He looks south-west down the square, to the stairs from T1 and the stash. */
const HEBI_LOOKOUT_YAW = Math.atan2(431 - HEBI_LOOKOUT_POST.x, 90 - HEBI_LOOKOUT_POST.z);

export const ALCHEMIA_MARKET_ACTORS: readonly ActorDef[] = [
  // By day the shop; from 22:00 the schedule swaps in `oyaji_closed`.
  keeper("oyaji", { kind: "shop", shopId: "oyaji", dialogueId: "oyaji", prompt: "prompt.shop.oyaji", radius: 3 }, OYAJI_MAX_HP),
  { kind: "npc", spawn: { key: "hana", position: HANA_SPOT, yaw: HANA_YAW }, preset: "civilian", faction: "civilians", interactable: { kind: "dialogue", dialogueId: "hana", prompt: "prompt.talk.hana", radius: 2.4 } },
  REN,
  keeper("sachiko", { kind: "dialogue", dialogueId: "sachiko", prompt: "prompt.shop.sachiko", radius: 2.4 }),
  { kind: "ganger", spawn: { key: "hebi-lookout", position: HEBI_LOOKOUT_POST, yaw: HEBI_LOOKOUT_YAW, tag: null } },
  KUROSAWA,
  ...CLEANERS,
  keeper("kenta", { kind: "dialogue", dialogueId: "kenta", prompt: "prompt.shop.kenta", radius: 3 }),
  // From 16:00 to 4:00 the bar (ADR-0026); the rest of the day the schedule swaps in `fumiko_closed`.
  keeper("fumiko", { kind: "shop", shopId: "yatai", dialogueId: "fumiko", prompt: "prompt.shop.fumiko", radius: 3 }),
  keeper("goro", { kind: "dialogue", dialogueId: "goro", prompt: "prompt.shop.goro", radius: 3 }),
];

type MarketSite = "hana_stall" | "hebi_stash" | "raid_north" | "raid_east";

/**
 * Spawn points of the market jobs, four per site. A delivery spawns nobody; its points are round
 * Hana's cart, kept for symmetry. The raids come for Oyaji in the hall's north-east corner: up
 * from Świętoduska onto T1 at its west end, and across T1 from Lubartowska.
 */
export const TARG_CONTRACT_SITE_SPAWNS: Readonly<Record<MarketSite, readonly Vec3[]>> = {
  hana_stall: [ground(426.5, 66), ground(426.5, 67.5), ground(426.5, 64.5), ground(425, 66)],
  hebi_stash: [byArkady(6, 6), byArkady(12.5, 4.5), byArkady(9.5, 7.5), byArkady(5, 2.5)],
  raid_north: [ground(403, 72), ground(400.5, 74.5), ground(406, 74), ground(399, 70)],
  raid_east: [ground(441, 66), ground(442.5, 63), ground(439.5, 69), ground(443, 68)],
};

/**
 * Which way each market crew looks when it turns up (audit W11): the raids at Oyaji's back door,
 * the stash guards west over the square they would be attacked from, the cart crew at Hana.
 */
export const TARG_CONTRACT_SITE_FACING: Readonly<Record<MarketSite, Vec3>> = {
  hana_stall: HANA_SPOT,
  hebi_stash: byArkady(7, 24),
  raid_north: STALL_KEEPERS.oyaji,
  raid_east: STALL_KEEPERS.oyaji,
};

/** Where the crate of a retrieval job lies (centre of the box). */
export const CONTRACT_ITEM_SPOTS: Readonly<Partial<Record<ContractSiteId, Vec3>>> = {
  hebi_stash: { ...RETRIEVE_CRATE, y: RETRIEVE_CRATE.y + 0.3 },
};
