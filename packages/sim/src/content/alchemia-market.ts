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
import { type ActorDef, type Rect, type StaticProp, crate, lamp } from "./builders";
import { ALCHEMIA_MODULES, type PlacedAlchemiaModule, alchemiaPoint } from "./alchemia";
import { ALCHEMIA_LIFT, ALCHEMIA_TERRACE } from "./alchemia-lift";
import { ground, groundY } from "./lublin/terrain";

/**
 * The market in Alchemia (ADR-0063 stage 6, the user's decision of 4.11): the people and the
 * setting of the old market on Aleja Tysiąclecia, which stood on the carriageway and is gone, now
 * at the food hall on Plac Ofiar Getta. The stallholders keep the five stalls along the plot's west
 * side, each at the foot of its own steps facing the path to Świętoduska; Hana sells from her cart
 * on the open square behind them; the Hebi keep their stash in the hollow by the ruined outbuilding
 * of the map (w66286396) at the square's north-east; Ren sleeps on the hall's roof terrace, up the
 * lift, and Kurosawa of Kagami waits for the archive on the square by the lift's door.
 *
 * World metres, every point on the map's ground (or the terrace's floor): no frame of its own.
 */

const HALL = ALCHEMIA_MODULES[0] as PlacedAlchemiaModule;
const STALLS = ALCHEMIA_MODULES.slice(1);

/** A point of a module's frame on the paving under it (see `alchemiaPoint`). */
const onPaving = (m: PlacedAlchemiaModule, x: number, z: number, up = 0): Vec3 => {
  const p = alchemiaPoint(m, x, z);
  return ground(p.x, p.z, up);
};

/** How far a stall's flight of steps reaches out of its front, in its frame (its last step's edge). */
const stepsReach = (m: PlacedAlchemiaModule): number => Math.max(m.depth / 2, ...m.steps.flatMap((s) => s.points.map(([, z]) => z)));

/** Stall `i` (0 by the hall, 4 at the north end): its module. */
const stall = (i: number): PlacedAlchemiaModule => {
  const m = STALLS[i];
  if (!m) throw new Error(`no stall ${i}`);
  return m;
};

/** The paving in front of stall `i`: `out` metres past its last step, `across` from the middle of its front (+ to the stall's own left, looking out of it). */
export const atStall = (i: number, across: number, out: number): Vec3 => {
  const m = stall(i);
  return onPaving(m, across, stepsReach(m) + out);
};

/** Which way the stalls' fronts face (west-north-west, to the path along Świętoduska). */
export const STALL_FRONT_YAW: number = stall(0).yaw;

/**
 * Where a keeper stands: a counter's width out from the last step, and 1.6 m north of the middle of the
 * front, between the ways up the steps (the middle and 3.2 m to either side, G-287), so nobody blocks them.
 */
const KEEPER_ACROSS = -1.6;
const KEEPER_OUT = 0.6;

/** The keepers' stalls, south to north: Sachiko by the car park, Oyaji at the north end. */
export const STALL_OF = { sachiko: 0, kenta: 1, fumiko: 2, goro: 3, oyaji: 4 } as const;

/** Where each stallholder stands, at the foot of the steps of his or her stall. */
export const STALL_KEEPERS = {
  sachiko: atStall(STALL_OF.sachiko, KEEPER_ACROSS, KEEPER_OUT),
  kenta: atStall(STALL_OF.kenta, KEEPER_ACROSS, KEEPER_OUT),
  fumiko: atStall(STALL_OF.fumiko, KEEPER_ACROSS, KEEPER_OUT),
  goro: atStall(STALL_OF.goro, KEEPER_ACROSS, KEEPER_OUT),
  oyaji: atStall(STALL_OF.oyaji, KEEPER_ACROSS, KEEPER_OUT),
} as const;

/** Hana sells parts from a handcart in the middle of the square behind the stalls, facing them. */
export const HANA_SPOT: Vec3 = ground(436, 68);
const HANA_YAW = -Math.PI / 2;

/** Oyaji can be hurt: Hebi come for him in Hana's protection jobs. */
export const OYAJI_MAX_HP = 120;

/** The ruined outbuilding's west wall (OSM way 66286396), from its south corner north, and the way out of it. */
const RUIN = { x: 443.1, z: 83.4 } as const;
const RUIN_ALONG = { x: 0.36, z: 0.933 } as const;
const RUIN_OUT = { x: -0.933, z: 0.36 } as const;

/** A point by the ruin's west wall: `along` metres from its south corner, `out` metres off the wall. */
export const byRuin = (along: number, out: number, up = 0): Vec3 =>
  ground(RUIN.x + RUIN_ALONG.x * along + RUIN_OUT.x * out, RUIN.z + RUIN_ALONG.z * along + RUIN_OUT.z * out, up);

/** Which way a thing on the ruin's wall faces: out of it, to the square. */
export const RUIN_OUT_YAW = Math.atan2(RUIN_OUT.x, RUIN_OUT.z);

/** The Hebi stash in the hollow by the ruin (the retrieval's no-go zone, `devices.ts`). */
export const HEBI_STASH_ZONE: Rect = { minX: 435, maxX: 449, minZ: 86, maxZ: 101 };

/** A box standing on the ground at (x, z), sunk a little into the slope's high side. */
const onGround = (p: StaticProp, sink = 0.08): StaticProp => ({ ...p, center: { ...p.center, y: p.center.y + groundY(p.center.x, p.center.z) - sink } });

const RETRIEVE_CRATE = byRuin(9, 1.8);

/** A lamp standing on the ground at `p`. */
const lampAt = (p: Vec3, color: string): StaticProp => ({ ...lamp(p.x, p.z, color), center: p });

const COVER = byRuin(9, 4.2);
const BODY_CRATE = byRuin(13.6, 1.5);

/** Hana's cart, the Hebi stash's crates and lights: the market's own things on the square. */
export const ALCHEMIA_MARKET_PROPS: readonly StaticProp[] = [
  // Hana's handcart, just east of where she stands.
  onGround(crate(HANA_SPOT.x + 1.3, HANA_SPOT.z, 0.9, 1.0, 1.8)),
  lampAt(ground(HANA_SPOT.x + 1.3, HANA_SPOT.z + 1.6), "#9ad7ff"),
  // The Hebi stash: cover in front of it, and the big crate by it takes a body (ADR-0065).
  onGround(crate(COVER.x, COVER.z, 1.0, 1.1, 2.4)),
  { ...onGround(crate(BODY_CRATE.x, BODY_CRATE.z, 1.6, 1.4, 1.4)), hide: "container" },
  lampAt(byRuin(4, 1.2), "#ffcf8a"),
];

/** A stash placed once, when the player first comes near (ADR-0021). */
export interface RoofStash {
  readonly key: string;
  readonly at: Vec3;
  readonly lines: readonly LootLine[];
}

/** A point of the roof terrace (the hall's frame), on its floor. */
const onTerrace = (x: number, z: number): Vec3 => {
  const p = alchemiaPoint(HALL, x, z);
  return { x: p.x, y: ALCHEMIA_TERRACE.roof, z: p.z };
};

/** Hebi's bag on the roof terrace, by Ren (ADR-0021): the key of the old roof stash, so a taken one stays taken. */
export const TARG_ROOF_STASH: RoofStash = {
  key: "stash:targ-roof",
  at: onTerrace(1.0, -0.9),
  lines: [
    { kind: "eddies", qty: 180 },
    { kind: "ammo", ammo: "556", qty: 30 },
    { kind: "stack", item: "medkit", qty: 1 },
    { kind: "item", item: "holo_sight", rarity: "uncommon", qty: 1 },
  ],
};

/** The bag left behind the ruin the night of the blockade (ADR-0026; once in the car on the viaduct). */
export const TARG_OVERPASS_STASH: RoofStash = {
  key: "stash:targ-overpass",
  at: byRuin(30, 1.2, 0.2),
  lines: [
    { kind: "eddies", qty: 120 },
    { kind: "ammo", ammo: "9mm", qty: 18 },
    { kind: "stack", item: "bandage", qty: 2 },
    { kind: "stack", item: "datachip", qty: 1 },
  ],
};

/**
 * Ren Odagiri sleeps on the hall's roof terrace, up the lift (act II, ADR-0023; "Rin" of the
 * user's decision). He turns up once someone told Seki where he is and is gone after the
 * "kagami" ending, when Kagami takes him.
 */
export const REN_SPOT: Vec3 = onTerrace(-0.3, -1.4);

/** Kurosawa of Kagami waits on the square by the lift's door, and his cleaners come from the square's north. */
const LIFT_DOOR: GroundPoint = { x: ALCHEMIA_LIFT.centre.x, z: ALCHEMIA_LIFT.centre.z + ALCHEMIA_LIFT.half + 1.4 };
export const KUROSAWA_SPOT: Vec3 = ground(LIFT_DOOR.x + 5.5, LIFT_DOOR.z + 2.5);
const CLEANER_SPOTS: readonly Vec3[] = [ground(433, 62), ground(436, 57.5), ground(430.5, 65)];

/** Tag of the cleaners (their deaths raise `killed:kagami_cleaner`). */
export const KAGAMI_CLEANER_TAG = "kagami_cleaner";

/** The way to face from `from` to `to`. */
const facing = (from: GroundPoint, to: GroundPoint): number => Math.atan2(to.x - from.x, to.z - from.z);

const REN: ActorDef = {
  kind: "npc",
  spawn: { key: "ren", position: REN_SPOT, yaw: HALL.yaw },
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

/** A stallholder at the foot of the steps, facing the path; he can be talked to (or traded with) from it. */
const keeper = (key: keyof typeof STALL_KEEPERS, interactable: NonNullable<Extract<ActorDef, { kind: "npc" }>["interactable"]>, maxHp?: number): ActorDef => ({
  kind: "npc",
  spawn: { key, position: STALL_KEEPERS[key], yaw: STALL_FRONT_YAW },
  preset: "civilian",
  faction: "civilians",
  bystander: true,
  ...(maxHp === undefined ? {} : { maxHp }),
  interactable,
});

/** The Hebi lookout north of the stash: watches the way in from Lubartowska by day, walks round the hollow at night. */
export const HEBI_LOOKOUT_POST: Vec3 = ground(444, 112);

export const ALCHEMIA_MARKET_ACTORS: readonly ActorDef[] = [
  // By day the stall (plan §6); from 22:00 the schedule swaps in `oyaji_closed`.
  keeper("oyaji", { kind: "shop", shopId: "oyaji", dialogueId: "oyaji", prompt: "prompt.shop.oyaji", radius: 3 }, OYAJI_MAX_HP),
  { kind: "npc", spawn: { key: "hana", position: HANA_SPOT, yaw: HANA_YAW }, preset: "civilian", faction: "civilians", interactable: { kind: "dialogue", dialogueId: "hana", prompt: "prompt.talk.hana", radius: 2.4 } },
  REN,
  keeper("sachiko", { kind: "dialogue", dialogueId: "sachiko", prompt: "prompt.shop.sachiko", radius: 2.4 }),
  { kind: "ganger", spawn: { key: "hebi-lookout", position: HEBI_LOOKOUT_POST, yaw: 0.3, tag: null } },
  KUROSAWA,
  ...CLEANERS,
  keeper("kenta", { kind: "dialogue", dialogueId: "kenta", prompt: "prompt.shop.kenta", radius: 3 }),
  // From 16:00 to 4:00 the stall (ADR-0026); the rest of the day the schedule swaps in `fumiko_closed`.
  keeper("fumiko", { kind: "shop", shopId: "yatai", dialogueId: "fumiko", prompt: "prompt.shop.fumiko", radius: 3 }),
  keeper("goro", { kind: "dialogue", dialogueId: "goro", prompt: "prompt.shop.goro", radius: 3 }),
];

type MarketSite = "hana_stall" | "hebi_stash" | "raid_north" | "raid_east";

/**
 * Spawn points of the market jobs, four per site. A delivery spawns nobody; its points are round
 * Hana's cart, kept for symmetry. The raids come for Oyaji at the north end: down the path along
 * Świętoduska, and across the square from Lubartowska.
 */
export const TARG_CONTRACT_SITE_SPAWNS: Readonly<Record<MarketSite, readonly Vec3[]>> = {
  hana_stall: [ground(434.5, 68), ground(434.5, 69.5), ground(434.5, 66.5), ground(433, 68)],
  hebi_stash: [byRuin(6, 6), byRuin(12.5, 4.5), byRuin(9.5, 7.5), byRuin(5, 2.5)],
  raid_north: [ground(428.5, 114), ground(431, 117.5), ground(426, 110.5), ground(433, 120.5)],
  raid_east: [ground(438, 80), ground(440.5, 77), ground(436, 83.5), ground(442.5, 80.5)],
};

/**
 * Which way each market crew looks when it turns up (audit W11): the raids at Oyaji's stall, the
 * stash guards west over the square they would be attacked from, the cart crew at Hana.
 */
export const TARG_CONTRACT_SITE_FACING: Readonly<Record<MarketSite, Vec3>> = {
  hana_stall: HANA_SPOT,
  hebi_stash: byRuin(7, 24),
  raid_north: STALL_KEEPERS.oyaji,
  raid_east: STALL_KEEPERS.oyaji,
};

/** Where the crate of a retrieval job lies (centre of the box). */
export const CONTRACT_ITEM_SPOTS: Readonly<Partial<Record<ContractSiteId, Vec3>>> = {
  hebi_stash: { ...RETRIEVE_CRATE, y: RETRIEVE_CRATE.y + 0.3 },
};
