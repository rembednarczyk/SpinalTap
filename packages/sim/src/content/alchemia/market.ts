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
import { ARKADY_FRAME, arkadyPoint, arkadySpanMid } from "./arkady";
import { SOUTH, facing } from "./plan";
import { onPavilionRoof } from "./pavilion";
import { KEEPER_SPOTS, KEEPER_YAW, type KeeperKey } from "./units";
import { MALL_LEVELS } from "./mall-plan";
import { SHELTER } from "./shelter";

/**
 * The market in Alchemia by the investor's plan (ADR-0074 §3, stage 1; once ADR-0063 stage 6):
 * the stallholders keep their units in the food hall, each behind his or her own counter (`units.ts`;
 * on the gallery's P3 since ADR-0093 O3); Hana sells from her cart on the square in front of it (T1); Ren sleeps on the roof of the
 * triangular pavilion on the corner (stage 3), the Hebi bag by him; Kurosawa of Kagami
 * waits by the lift's kiosk on the car park. The Hebi keep their stash in the air-raid shelter under
 * T2 (stage 5d2; before it on T2 before the Arkady's south arches), their lookout by its hatch.
 *
 * World metres, every point on the ground, on a floor of the gallery or on the pavilion's roof.
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

/** The Hebi stash: the shelter's room under T2 (stage 5d2; the retrieval's no-go zone, `devices.ts`). */
export const HEBI_STASH_ZONE: Rect = { minX: SHELTER.minX + SHELTER.wall, maxX: SHELTER.maxX - SHELTER.wall, minZ: SHELTER.minZ + SHELTER.wall, maxZ: SHELTER.maxZ - SHELTER.wall };

/** A point on the shelter's floor, `up` over it. */
export const inShelter = (x: number, z: number, up = 0): Vec3 => ({ x, y: SHELTER.floor + up, z });
/** A box standing on the shelter's floor. */
const onShelterFloor = (p: StaticProp): StaticProp => ({ ...p, center: { ...p.center, y: p.center.y + SHELTER.floor } });

/** A box standing on the ground at (x, z), sunk a little into the slope's high side. */
const onGround = (p: StaticProp, sink = 0.08): StaticProp => ({ ...p, center: { ...p.center, y: p.center.y + groundY(p.center.x, p.center.z) - sink } });

/**
 * The stash in the shelter's north-west corner (stage 5d2), away from both ways in: the passage
 * from the gate comes into its south-west corner, the hatch's flight into its east wall. Its cover
 * stands between it and the room, the crate that takes a body by the hand-cranked fan.
 */
const RETRIEVE_CRATE = inShelter(422.0, 95.6);

/** A lamp standing on the ground at `p`. */
const lampAt = (p: Vec3, color: string): StaticProp => ({ ...lamp(p.x, p.z, color), center: p });

const COVER = inShelter(424.6, 92.4);
const BODY_CRATE = inShelter(433.6, 88.0);
/** The lookout's post on T2 north-east of the shelter's hatch (stage 5d2). */
const HATCH_POST = ground(443.4, 98.6);

/** Hana's cart, the Hebi stash's crates and lights: the market's own things outside the hall. */
export const ALCHEMIA_MARKET_PROPS: readonly StaticProp[] = [
  // Hana's handcart, just east of where she stands.
  onGround(crate(HANA_SPOT.x + 1.3, HANA_SPOT.z, 0.9, 1.0, 1.8)),
  lampAt(ground(HANA_SPOT.x + 1.3, HANA_SPOT.z + 1.6), "#9ad7ff"),
  // The Hebi stash in the shelter: cover in front of it, and the big crate in the room takes a body (ADR-0065).
  onShelterFloor(crate(COVER.x, COVER.z, 1.0, 1.1, 2.4)),
  { ...onShelterFloor(crate(BODY_CRATE.x, BODY_CRATE.z, 1.6, 1.4, 1.4)), hide: "container" },
  // The lamp over the lookout's post by the hatch on T2.
  lampAt(ground(HATCH_POST.x - 0.4, HATCH_POST.z + 1.0), "#ffcf8a"),
];

/** A stash placed once, when the player first comes near (ADR-0021). */
export interface RoofStash {
  readonly key: string;
  readonly at: Vec3;
  readonly lines: readonly LootLine[];
}

/**
 * Ren Odagiri sleeps on the roof of the triangular pavilion on the corner (stage 3; on the hall's
 * green roof in stage 1), behind its attic and its neon, up the service ladder from the car park,
 * looking east over Lubartowska to the Old Town (act II, ADR-0023). He turns up once someone told
 * Seki where he is and is gone after the "kagami" ending. Nobody follows him up the ladder (ADR-0021).
 */
export const REN_SPOT: Vec3 = onPavilionRoof(430, -3.4);
/** He looks to the Trybunał on the Rynek (582.4; -61.2). */
const REN_YAW = facing(REN_SPOT, { x: 582.4, z: -61.2 });

/** Hebi's bag by Ren (ADR-0021): the key of the old roof stash, so a taken one stays taken. */
export const TARG_ROOF_STASH: RoofStash = {
  key: "stash:targ-roof",
  at: onPavilionRoof(431.3, -2.7),
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
const LIFT_DOOR: GroundPoint = ALCHEMIA_LIFT.doors[2]!;
export const KUROSAWA_SPOT: Vec3 = ground(LIFT_DOOR.x + 4.5, LIFT_DOOR.z - 2);
const CLEANER_SPOTS: readonly Vec3[] = [ground(408, 26.5), ground(420.5, 24), ground(413, 22.5)];

/** Tag of the cleaners (their deaths raise `killed:kagami_cleaner`). */
export const KAGAMI_CLEANER_TAG = "kagami_cleaner";

const REN: ActorDef = {
  kind: "npc",
  spawn: { key: "ren", position: REN_SPOT, yaw: REN_YAW },
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
  // Behind a counter under the gallery's roof: no umbrella (ADR-0041).
  indoor: true,
  ...(maxHp === undefined ? {} : { maxHp }),
  interactable,
});

/** The Hebi lookout by the shelter's hatch on T2 (stage 5d2, ADR-0074 §3): watches it and the stairs from T1 by day, walks P-2 at night. */
export const HEBI_LOOKOUT_POST: Vec3 = HATCH_POST;
/** He looks south-west, over the hatch to the stairs from T1. */
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

/** A point on the gallery's P2. */
const onP2 = (x: number, z: number): Vec3 => ({ x, y: MALL_LEVELS.p2, z });

/**
 * Spawn points of the market jobs, four per site. A delivery spawns nobody; its points are round
 * Hana's cart, kept for symmetry. The raids come for Oyaji in the food hall's south-east corner on
 * P3 (ADR-0093 O3; in the hall's north-east corner on T1's level until then) through the gallery:
 * up the south-west core from the car park by Świętoduska, and up the north-east one from the east
 * door on T1, the way from Lubartowska; they turn up at the cores' doors on P2, the last escalator
 * still before them, after the climb to there (`SitePlan.delay`, `contract-plans.ts`). Not walked
 * from T1 any more: the four climbed three floors on the level graph, some 20 s at twice a step's
 * cost (the raid's tests four times as long as before O3); on the way up they are out of sight.
 */
export const TARG_CONTRACT_SITE_SPAWNS: Readonly<Record<MarketSite, readonly Vec3[]>> = {
  hana_stall: [ground(426.5, 66), ground(426.5, 67.5), ground(426.5, 64.5), ground(425, 66)],
  // In the shelter's room round the stash (stage 5d2): by its cover, by the hatch's flight, by the bench, by the stash.
  hebi_stash: [inShelter(423.0, 90.6), inShelter(431.6, 94.2), inShelter(429.2, 86.2), inShelter(426.2, 95.2)],
  // Out of the south-west core's door, in the passage to the west gallery.
  raid_north: [onP2(401.2, 38.9), onP2(402.9, 39.0), onP2(404.6, 38.8), onP2(406.3, 39.0)],
  // Out of the north-east core's door, two of them on in the north gallery's east end.
  raid_east: [onP2(426.4, 56.2), onP2(426.4, 54.6), onP2(425.6, 52.2), onP2(427.2, 51.6)],
};

/**
 * Which way each market crew looks when it turns up (audit W11): the raids at Oyaji (up over the hall),
 * the stash guards west over the square they would be attacked from, the cart crew at Hana.
 */
export const TARG_CONTRACT_SITE_FACING: Readonly<Record<MarketSite, Vec3>> = {
  hana_stall: HANA_SPOT,
  // West, to the passage from the gate.
  hebi_stash: inShelter(410, 90),
  raid_north: STALL_KEEPERS.oyaji,
  raid_east: STALL_KEEPERS.oyaji,
};

/** Where the crate of a retrieval job lies (centre of the box). */
export const CONTRACT_ITEM_SPOTS: Readonly<Partial<Record<ContractSiteId, Vec3>>> = {
  hebi_stash: { ...RETRIEVE_CRATE, y: RETRIEVE_CRATE.y + 0.3 },
};
