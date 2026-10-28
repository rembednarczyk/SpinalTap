import type { ContractSiteId, EnemyTypeId, Vec3 } from "@seki/core";
import {
  type ActorDef,
  type BlockMaterial,
  type NavGraph,
  type Rect,
  type StaticProp,
  building,
  crate,
  deck,
  ladderParts,
  lamp,
  neon,
  rail,
  skin,
  slab,
  stairRail,
  stairs,
  v,
  water,
} from "./builders";

/**
 * Doki (ADR-0024): the port at the mouth of the canal, north of Ulica Kanałowa. A narrow
 * passage leaves the street through a gap in its north row (X ∈ [24, 30]) into the container
 * yard; past the yard lies the quay with Tessen's office, a gantry crane and a pier into the
 * water. Everything is hand-placed: no generator, so nothing here moves the other districts.
 *
 * Levels (ADR-0020/0021): a ladder up a container stack and a catwalk between stacks (player
 * only), stairs onto the warehouse roof and onto the crane deck (NPCs too, through DOKI_NAV).
 * The quay edge and the pier are fenced too high to jump: the water is scenery.
 */

/** The yard: from the street's north row to the start of the quay. */
export const DOKI_YARD_BOUNDS: Rect = { minX: -40, maxX: 34, minZ: 90.2, maxZ: 124 };
/** The quay, the pier and the water in front of it. */
export const DOKI_QUAY_BOUNDS: Rect = { minX: -40, maxX: 34, minZ: 124.2, maxZ: 218 };

/**
 * Parapet on the outer edges of the warehouse roof: higher than a jump clears (about 1.7 m),
 * so nobody hops from the roof onto the crown of the district walls. The edges over the yard
 * keep the usual 1.05 m: a drop there lands inside the map, and the sniper sees over them.
 */
const OUTER_PARAPET = 1.9;

/** Gap in the north row of Ulica Kanałowa that leads into the docks. */
export const DOKI_PASSAGE = { x0: 24, x1: 30 } as const;

/** Roof of the warehouse on the west side of the yard. */
export const WAREHOUSE_TOP = 9;
/** Walkway of the gantry crane over the quay. */
export const CRANE_TOP = 8;
/** One container; two of them make a stack. */
const CONTAINER = { w: 6, h: 2.6, d: 2.4 } as const;
/** The quay ends here; beyond it, past the fence, the water. */
export const QUAY_EDGE = 150;
/** Fences on the quay edge and the pier: higher than a jump and a pull-up reach. */
const FENCE = 2.7;
/** Climber's centre in front of a wall (as on the market's fire escape). */
const HANG = 0.4;

const SODIUM = "#ffb46a";
const TESSEN_BLUE = "#39d0ff";

/** A container (or two stacked) with its long side along X, standing on the ground. */
const container = (x: number, z: number, stacked: boolean, material: BlockMaterial = "metal"): StaticProp[] => {
  const bottom = building(x, z, CONTAINER.w, CONTAINER.h, CONTAINER.d, material);
  if (!stacked) return [bottom];
  return [bottom, deck(x - CONTAINER.w / 2, x + CONTAINER.w / 2, z - CONTAINER.d / 2, z + CONTAINER.d / 2, CONTAINER.h * 2, CONTAINER.h, material === "metal" ? "glass" : "metal")];
};

/** Container rows of the yard: z of each row's centre and which of the four slots are stacked (null: empty). */
const CONTAINER_ROWS: readonly { readonly z: number; readonly slots: readonly (boolean | null)[] }[] = [
  { z: 101.2, slots: [true, false, false, true] },
  { z: 109.2, slots: [false, true, null, true] },
  { z: 117.2, slots: [true, false, true, false] },
];
const SLOT_X = [-9, -3, 3, 9] as const;

const containers = (): StaticProp[] =>
  CONTAINER_ROWS.flatMap((row, r) =>
    row.slots.flatMap((stacked, i) => (stacked === null ? [] : container(SLOT_X[i] ?? 0, row.z, stacked, (r + i) % 2 === 0 ? "metal" : "glass"))),
  );

const STACK_TOP = CONTAINER.h * 2;

/**
 * The way onto the containers (player only, ADR-0021): a ladder up the low container of the
 * first row, a second one from its roof onto the stack next door, and a catwalk from there
 * across the aisle to the stack of the second row.
 */
const containerClimb = (): StaticProp[] => {
  const low = CONTAINER.h;
  const rowZ = CONTAINER_ROWS[0]?.z ?? 101.2;
  const south = rowZ - CONTAINER.d / 2;
  return [
    ...ladderParts({ key: "doki-stack-1", x: 3, z: south - HANG, yaw: 0, bottom: 0, top: low, exit: v(3, low, south + 0.8) }),
    ...ladderParts({ key: "doki-stack-2", x: 6 - HANG, z: rowZ, yaw: Math.PI / 2, bottom: low, top: STACK_TOP, exit: v(6.8, STACK_TOP, rowZ) }),
    deck(8.2, 9.8, rowZ + CONTAINER.d / 2, 108, STACK_TOP, 0.25, "metal"),
    rail(8, 8.2, rowZ + CONTAINER.d / 2, 108, STACK_TOP),
    rail(9.8, 10, rowZ + CONTAINER.d / 2, 108, STACK_TOP),
  ];
};

/** The warehouse: a flat roof with parapets, reached by stairs along its east face. */
const warehouse = (): StaticProp[] => {
  const top = WAREHOUSE_TOP;
  return [
    // Offices over the loading bays, from the city kit (ADR-0022); its own signs stay off.
    building(-28, 107, 20, top, 26, "metal", skin("tenement", "x+", { signs: false })),
    stairs(-17.8, -16.2, 97, 115, 0, top, "z", 1),
    stairRail(-16.2, -16, 97, 115, 0, top, "z", 1),
    deck(-18, -16, 115, 117.2, top, 0.4),
    rail(-16, -15.8, 115, 117.4, top),
    rail(-18, -15.8, 117.2, 117.4, top),
    rail(-38, -18, 94, 94.2, top, OUTER_PARAPET),
    rail(-38, -18, 119.8, 120, top),
    rail(-38, -37.8, 94.2, 119.8, top, OUTER_PARAPET),
    // East parapet, open onto the landing at the head of the stairs.
    rail(-18.2, -18, 94.2, 115, top),
    rail(-18.2, -18, 117.2, 119.8, top),
    // Air handlers on the roof: cover for whoever lies up there.
    deck(-31, -28.6, 112, 113.4, top + 1.2, 1.2, "metal"),
    deck(-27, -25, 100, 101.4, top + 1.2, 1.2, "metal"),
  ];
};

/** Tessen's office on the quay: four walls with a door on the east side, a desk with the terminal. */
const office = (): StaticProp[] => [
  building(-29.85, 133, 0.3, 3.6, 10),
  building(-24, 128.15, 12, 3.6, 0.3),
  building(-24, 137.85, 12, 3.6, 0.3),
  building(-18.15, 129.5, 0.3, 3.6, 3),
  building(-18.15, 135.5, 0.3, 3.6, 5),
  deck(-30, -18, 128, 138, 3.9, 0.3, "metal"),
  crate(-28.6, 133, 1.2, 0.85, 3),
  neon(-24, 4.7, 127.9, v(5, 0.9, 0.15), TESSEN_BLUE, "TESSEN"),
];

/** The gantry crane: a walkway on four legs, stairs from the south, cabin, mast and jib over the water. */
const crane = (): StaticProp[] => {
  const top = CRANE_TOP;
  return [
    ...[12.6, 23.4].flatMap((x) => [building(x, 138.6, 0.8, top - 0.4, 0.8, "metal"), building(x, 141.4, 0.8, top - 0.4, 0.8, "metal")]),
    deck(12, 26, 138, 142, top, 0.4, "metal"),
    stairs(24.2, 25.8, 124, 138, 0, top, "z", 1),
    stairRail(24, 24.2, 124, 138, 0, top, "z", 1),
    stairRail(25.8, 26, 124, 138, 0, top, "z", 1),
    rail(12, 24, 138, 138.2, top),
    rail(25.8, 26, 138, 142, top),
    rail(12, 25.8, 141.8, 142, top),
    rail(12, 12.2, 138.2, 141.8, top),
    // Operator's cabin on the walkway (solid: cover for the sniper).
    deck(15, 18, 138.4, 140.6, top + 2.4, 2.4, "glass"),
    slab(18, top + 4.6, 140, v(1.2, 9, 1.2), "metal"),
    slab(18, top + 8.6, 153, v(1, 0.8, 26), "metal"),
    neon(18, top + 9.2, 165.6, v(0.5, 0.5, 0.15), "#ff3030"),
  ];
};

/** The quay edge and the pier, fenced; the boat that takes Mika away; the water and the far ship. */
const waterfront = (): StaticProp[] => [
  deck(-38, -2, QUAY_EDGE, QUAY_EDGE + 0.2, FENCE, FENCE, "metal"),
  deck(6, 32, QUAY_EDGE, QUAY_EDGE + 0.2, FENCE, FENCE, "metal"),
  slab(2, 0.05, 161, v(8, 0.1, 22), "metal"),
  deck(-2.2, -2, QUAY_EDGE, 172, FENCE, FENCE, "metal"),
  deck(6, 6.2, QUAY_EDGE, 172, FENCE, FENCE, "metal"),
  deck(-2.2, 6.2, 172, 172.2, FENCE, FENCE, "metal"),
  // Bollards at the end of the pier.
  crate(-0.8, 170.8, 0.5, 0.7, 0.5),
  crate(4.8, 170.8, 0.5, 0.7, 0.5),
  // Genzō's boat, moored on the east side of the pier.
  slab(9.6, -0.5, 164, v(3.6, 1.6, 11), "metal"),
  slab(9.6, 0.9, 166, v(2.4, 1.4, 3), "glass"),
  water(-40, 34, QUAY_EDGE, 200, -1.3),
  // A freighter at anchor: a silhouette in the mist, nothing more.
  slab(-12, 2.5, 214, v(46, 8, 10), "metal"),
  neon(-30, 7.2, 208.9, v(0.4, 0.4, 0.15), "#ff3030"),
];

export const DOKI_YARD_PROPS: readonly StaticProp[] = [
  slab(-3, -0.1, 107, v(74, 0.2, 34), "asphalt"),
  // Outer walls: west, east, and south of the yard where the street's buildings do not reach.
  building(-39, 120, 2, 8, 60, "metal"),
  building(33, 120, 2, 8, 60, "metal"),
  building(-23, 90.6, 30, 8, 1.2, "metal"),
  ...warehouse(),
  ...containers(),
  ...containerClimb(),
  // Genzō's corner by the passage: a container office, a fire barrel, a sign.
  building(19, 100.5, 6, 2.8, 3, "metal", skin("shop", "z-", { signs: false })),
  crate(23.2, 97.4, 0.7, 0.9, 0.7),
  neon(19, 2.3, 98.9, v(3.2, 0.7, 0.15), "#ffb000", "KAIUN"),
  lamp(25.5, 95, SODIUM),
  lamp(13, 112, "#9ad7ff"),
  // Pallets by the east wall, a car parked by the crane stairs.
  crate(29.5, 108, 2.4, 1.2, 3.2),
  crate(29.8, 116, 2, 2.2, 2),
  crate(27, 120, 2, 1.5, 4.2, skin("car", "z-")),
];

export const DOKI_QUAY_PROPS: readonly StaticProp[] = [
  slab(-3, -0.1, 137, v(74, 0.2, 26), "asphalt"),
  slab(-3, 0.04, QUAY_EDGE - 1.2, v(70, 0.08, 2.4), "concrete"),
  ...office(),
  ...crane(),
  // Cover around the terminal under the crane, and two containers on the west quay.
  crate(5.5, 132.5, 2.4, 1.2, 1.2),
  crate(11, 130, 1.4, 1.1, 1.4),
  // A skip by the office and Tessen's van by the east fence: cover on the way in.
  crate(-14, 127, 2.4, 1.4, 1.4, skin("dumpster", "z-")),
  crate(28.5, 140, 2.4, 2.2, 5, skin("van", "z+")),
  ...container(-10, 145.2, false),
  // Single, not stacked: nothing on the quay is high enough to jump the fence from.
  ...container(-16, 145.2, false, "glass"),
  lamp(-8, 147.5, SODIUM),
  lamp(28, 133, SODIUM),
  ...waterfront(),
];

/**
 * Level graph of the docks (ADR-0021): the yard floor around the containers, the foot and the
 * head of the warehouse stairs and points on its roof, the quay and the crane walkway. The
 * container ladders and the catwalk are left out on purpose: those roofs are the player's.
 */
export const DOKI_NAV: NavGraph = {
  nodes: [
    // On Ulica Kanałowa in front of the passage: joins this graph to the street's (KANAL_NAV).
    { id: "doki-passage-s", at: v(27, 0, 79) },
    { id: "doki-gate", at: v(27, 0, 93) },
    { id: "doki-yard-s", at: v(13, 0, 96) },
    { id: "doki-yard-e", at: v(17, 0, 106) },
    { id: "doki-yard-n", at: v(16, 0, 121) },
    { id: "doki-yard-w", at: v(-14.5, 0, 95.5) },
    { id: "doki-wh-foot", at: v(-17, 0, 96.2) },
    { id: "doki-wh-top", at: v(-17, WAREHOUSE_TOP, 116.2) },
    { id: "doki-roof-n", at: v(-23, WAREHOUSE_TOP, 116.8) },
    { id: "doki-roof-w", at: v(-34, WAREHOUSE_TOP, 107) },
    { id: "doki-roof-s", at: v(-23, WAREHOUSE_TOP, 97.2) },
    { id: "doki-quay-c", at: v(2, 0, 130) },
    { id: "doki-quay-w", at: v(-12, 0, 130) },
    { id: "doki-pier", at: v(2, 0, 151) },
    { id: "doki-crane-foot", at: v(25, 0, 123.2) },
    { id: "doki-crane-top", at: v(25, CRANE_TOP, 138.8) },
    { id: "doki-crane-deck", at: v(20.5, CRANE_TOP, 141) },
  ],
  edges: [
    { a: "kanal-street-w", b: "doki-passage-s" },
    { a: "doki-passage-s", b: "doki-gate" },
    { a: "doki-gate", b: "doki-yard-s" },
    { a: "doki-yard-s", b: "doki-yard-e" },
    { a: "doki-yard-e", b: "doki-yard-n" },
    { a: "doki-yard-s", b: "doki-yard-w" },
    { a: "doki-yard-w", b: "doki-wh-foot" },
    { a: "doki-wh-foot", b: "doki-wh-top", via: { minX: -17.8, maxX: -16.2, minZ: 96.6, maxZ: 115.4 } },
    { a: "doki-wh-top", b: "doki-roof-n" },
    { a: "doki-roof-n", b: "doki-roof-w" },
    { a: "doki-roof-w", b: "doki-roof-s" },
    { a: "doki-roof-n", b: "doki-roof-s" },
    { a: "doki-yard-n", b: "doki-quay-c" },
    { a: "doki-quay-c", b: "doki-quay-w" },
    { a: "doki-quay-c", b: "doki-pier" },
    { a: "doki-yard-n", b: "doki-crane-foot" },
    { a: "doki-crane-foot", b: "doki-crane-top", via: { minX: 24.2, maxX: 25.8, minZ: 123.6, maxZ: 138.4 } },
    { a: "doki-crane-top", b: "doki-crane-deck" },
  ],
};

/** Genzō, the smuggler who hands out the docks jobs, stands by his container office. */
export const GENZO_SPOT = v(20.6, 0, 97.6);

export const DOKI_YARD_ACTORS: readonly ActorDef[] = [
  {
    kind: "npc",
    spawn: { key: "genzo", position: GENZO_SPOT, yaw: 2.3 },
    preset: "civilian",
    faction: "fixers",
    interactable: { kind: "dialogue", dialogueId: "genzo", prompt: "Rozmawiaj z Genzō", radius: 2.4 },
  },
];

export const DOKI_QUAY_ACTORS: readonly ActorDef[] = [
  // A docker on a smoke break by the east fence: life in the port, nothing to say.
  { kind: "npc", spawn: { key: "doker", position: v(27, 0, 147.4), yaw: Math.PI }, preset: "civilian", faction: "civilians", bystander: true },
];

/**
 * A guard post of a docks job: where a Tessen man stands, which way he looks, what he is. With
 * `onAlarm` he arrives only when the job's alarm goes up (the escort's ambush, the hack's wave).
 */
export interface ContractPost {
  readonly at: Vec3;
  readonly yaw: number;
  readonly type: EnemyTypeId;
  readonly onAlarm?: true;
}

const post = (x: number, y: number, z: number, yaw: number, type: EnemyTypeId = "tessen_guard", onAlarm = false): ContractPost =>
  onAlarm ? { at: v(x, y, z), yaw, type, onAlarm: true } : { at: v(x, y, z), yaw, type };

/**
 * Sniper perches (ADR-0024): the north-east and north-west corners of the warehouse roof and the
 * south rail of the crane walkway. Each stands right at a parapet, so the shooter sees down onto
 * the quay over it.
 */
export const SNIPER_PERCHES: readonly Vec3[] = [v(-19, WAREHOUSE_TOP, 119.3), v(-36.4, WAREHOUSE_TOP, 119.3), v(20.5, CRANE_TOP, 138.7)];

/**
 * Posts of the docks jobs, in target index order (the first one decides the chunk, so it lies on
 * the quay). Escort: the ambush from the office side. Infiltration: the office guard looks over
 * the room, the door guard out onto the quay, the others over the quay and the yard. Hack: the
 * wave, with a sniper on the warehouse roof always among them.
 */
export const DOKI_CONTRACT_POSTS: Readonly<Partial<Record<ContractSiteId, readonly ContractPost[]>>> = {
  docks_escort: [
    post(-12, 0, 134, Math.PI / 2, "tessen_guard", true),
    post(-8, 0, 143, Math.PI / 2, "tessen_guard", true),
    post(-16, 0, 125.5, Math.PI / 2, "tessen_guard", true),
    post(22, 0, 133, -Math.PI / 2, "tessen_guard", true),
  ],
  tessen_office: [
    post(-21, 0, 136.4, Math.PI),
    post(-15.6, 0, 132, Math.PI / 2),
    post(-6, 0, 141, Math.PI / 2),
    post(-9, 0, 122.6, Math.PI / 2),
    post(-26, 0, 125.4, Math.PI / 2),
  ],
  quay_terminal: [
    post(-12, 0, 140, Math.PI / 2, "tessen_guard", true),
    post(-19, WAREHOUSE_TOP, 119.3, 1.1, "tessen_sniper", true),
    post(16, 0, 121, 0, "tessen_guard", true),
    post(28, 0, 128, -Math.PI / 2, "tessen_guard", true),
    post(-4, 0, 124, 0, "tessen_guard", true),
  ],
};

/** Mika's way from Genzō's corner to the boat: around the office, up the east aisle, across the quay, down the pier. */
export const ESCORT_ROUTE: readonly [Vec3, ...Vec3[]] = [
  v(18.4, 0, 97.6),
  v(13.6, 0, 97.8),
  v(14, 0, 106),
  v(16, 0, 122),
  v(4, 0, 128),
  v(2, 0, 136),
  v(2, 0, 149),
  v(2, 0, 169),
];

/** Mika passing this line (past the yard, onto the quay) springs the ambush. */
export const ESCORT_AMBUSH_Z = 124;

/** Where the data of an infiltration lies (on the office desk) and where the hack terminal stands. */
export const DOKI_ITEM_SPOTS: Readonly<Partial<Record<ContractSiteId, Vec3>>> = {
  tessen_office: v(-27.6, 0.9, 133),
};
export const DOKI_TERMINAL_SPOTS: Readonly<Partial<Record<ContractSiteId, Vec3>>> = {
  quay_terminal: v(8, 0, 134),
};

/** Spawn points by site, for the shared table (the posts' positions). */
export const DOKI_CONTRACT_SITE_SPAWNS: Readonly<Record<"docks_escort" | "tessen_office" | "quay_terminal", readonly Vec3[]>> = {
  docks_escort: (DOKI_CONTRACT_POSTS.docks_escort ?? []).map((p) => p.at),
  tessen_office: (DOKI_CONTRACT_POSTS.tessen_office ?? []).map((p) => p.at),
  quay_terminal: (DOKI_CONTRACT_POSTS.quay_terminal ?? []).map((p) => p.at),
};
