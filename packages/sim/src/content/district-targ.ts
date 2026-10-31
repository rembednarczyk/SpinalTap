import { SeededRandom } from "../rng/seeded-random";
import {
  ACT_TWO_ENDING_FLAG,
  type BlockFront,
  type BlockStyle,
  type ContractSiteId,
  KAGAMI_AMBUSH_FLAG,
  KAGAMI_CLEANER_KEYS,
  KAGAMI_JOB_FLAG,
  type LootLine,
  REN_TRAIL_FLAG,
  type Vec3,
  endingFlag,
} from "@seki/core";
import {
  type ActorDef,
  type BlockMaterial,
  type NavGraph,
  type Rect,
  type StaticProp,
  building,
  placeAt,
  placeNav,
  placeProps,
  placeRect,
  crate,
  deck,
  ladderParts,
  lamp,
  liftParts,
  neon,
  rail,
  skin,
  slab,
  stairRail,
  stairs,
  v,
} from "./builders";
import { MARKET_PLACE } from "./lublin/sites";

/**
 * The market of Podzamcze (district `targ`, ADR-0045): the old Targ pod estakadą, moved onto
 * Aleja Tysiąclecia between Plac Zamkowy and the bus station. Its deck is the viaduct over the
 * avenue, its stalls stand on the avenue's closed lanes under it; the south row of houses with
 * the fire escape is the market hall. Drawn in its own coordinates (x 66..126, z 56..116, the
 * gate on the west side) and placed by `MARKET_PLACE`: everything exported here is in the world.
 * Facades, stalls and heights come from a fixed-seed generator: the same tables on every run.
 */

/** Fixed content seed. Changing it reshuffles the districts (and the golden replay hash). */
const CONTENT_SEED = 0x7a26;

const pick = <T>(rng: SeededRandom, items: readonly [T, ...T[]]): T => items[Math.floor(rng.next() * items.length)] ?? items[0];
const between = (rng: SeededRandom, lo: number, hi: number): number => Math.round((lo + rng.next() * (hi - lo)) * 10) / 10;

/** Look of a row building (ADR-0022), from what the generator already picked: no extra draws. */
const styleOf = (material: BlockMaterial, height: number): BlockStyle =>
  material === "glass" ? (height >= 14 ? "tower" : "shop") : material === "metal" || height >= 15 ? "tenement" : "shop";

/**
 * Buildings side by side along X, covering [x0, x1] exactly. `front` is the side facing the
 * street and `street` the distance to the facades across it (ADR-0022).
 */
const facadeRow = (
  rng: SeededRandom,
  x0: number,
  x1: number,
  z: number,
  depth: number,
  heights: readonly [number, number],
  widths: readonly [number, number],
  front: BlockFront,
  street?: number,
): StaticProp[] => {
  const out: StaticProp[] = [];
  let x = x0;
  while (x1 - x > 0.01) {
    let w = between(rng, widths[0], widths[1]);
    // Never leave a sliver narrower than the minimum width at the end of the row.
    if (x1 - x - w < widths[0]) w = x1 - x;
    const material: BlockMaterial = pick(rng, ["concrete", "concrete", "glass", "metal"]);
    const h = between(rng, heights[0], heights[1]);
    out.push(building(x + w / 2, z, w, h, depth, material, skin(styleOf(material, h), front, street === undefined ? {} : { street })));
    x += w;
  }
  return out;
};

const AWNINGS: readonly [BlockMaterial, ...BlockMaterial[]] = ["glass", "metal", "concrete"];
const STRIPS = ["#ff2e88", "#00e5ff", "#ffb000", "#39ff8a", "#b46cff"] as const;

/** A market stall: counter (solid) and awning (visual). `front` is the side customers stand on. */
const stall = (rng: SeededRandom, x: number, z: number, front: 1 | -1): StaticProp[] => [
  crate(x, z, 2.6, 1.0, 1.3),
  slab(x, 2.55, z + front * 0.4, v(3.2, 0.2, 2.4), pick(rng, AWNINGS)),
];

const rng = new SeededRandom(CONTENT_SEED);

// The rows of the old Ulica Kanałowa drew from the generator before the market's: drawn and
// dropped, so the market's stalls and roofs stay where they were (ADR-0045).
facadeRow(rng, 10, 66, 63, 22, [12, 20], [16, 20], "z+", 8);
facadeRow(rng, 4, 66, 86, 8, [10, 22], [13, 17], "z-", 8);

/** A point of the market in the world: its own coordinates moved by `MARKET_PLACE`. */
export const market = (x: number, y: number, z: number): Vec3 => placeAt(MARKET_PLACE, v(x, y, z));

// ---------------------------------------------------------------- Targ pod estakadą

/** The two halves of the market in the world: the square and the hall, the viaduct and the north stalls. */
export const TARG_SOUTH_BOUNDS: Rect = placeRect(MARKET_PLACE, { minX: 66, maxX: 126, minZ: 56, maxZ: 84 });
export const TARG_NORTH_BOUNDS: Rect = placeRect(MARKET_PLACE, { minX: 66, maxX: 126, minZ: 82, maxZ: 116 });

/** Oyaji keeps the first stall of the southern row. */
const OYAJI_STALL = { x: 80, z: 68 } as const;

/** Hana sells parts from a handcart in the middle of the market, facing the gate. */
const HANA_SPOT = { x: 92, z: 74 } as const;

const southStalls = (): StaticProp[] => {
  const out = stall(rng, OYAJI_STALL.x, OYAJI_STALL.z, 1);
  for (let x = OYAJI_STALL.x + between(rng, 7, 9); x < 108; x += between(rng, 7, 9)) out.push(...stall(rng, x, OYAJI_STALL.z, 1));
  return out;
};

// Evaluated here, in the order the table used to: the generator's sequence stays the same.
const SOUTH_ROW = facadeRow(rng, 68, 114, 61, 6, [8, 16], [10, 16], "z+");

/** The south row's facade at `x`: its extent along X and its roof height. */
const southBlock = (x: number): { x0: number; x1: number; top: number } => {
  for (const p of SOUTH_ROW) {
    if (p.view.kind === "block" && Math.abs(p.center.x - x) <= p.view.size.x / 2) {
      return { x0: p.center.x - p.view.size.x / 2, x1: p.center.x + p.view.size.x / 2, top: p.view.size.y };
    }
  }
  throw new Error(`no facade at x = ${x}`);
};

/** Height of the fire escape balcony on the market face of the south row, above the market's floor. */
export const BALCONY_TOP = 4.5;
/** North face of the south row (the market side). */
const ROW_FACE = 64;
/** Climber's centre in front of a wall. */
const HANG = 0.4;
/** The three roofs of the south row (ADR-0021): low glass by the gate, concrete, glass to the east. */
const ROOF_WEST = southBlock(70);
const ROOF_MID = southBlock(88);
const ROOF_EAST = southBlock(105);
/** Roof heights of the south row above the market's floor (add `MARKET_PLACE.y` for the world). */
export const ROOF_WEST_TOP = ROOF_WEST.top;
export const ROOF_MID_TOP = ROOF_MID.top;

/**
 * Fire escape on the market face of the south row (ADR-0021): a ladder from the market up to a
 * balcony, a second one from the balcony onto the low roof, and a third from there onto the
 * concrete roof next door, where Hebi keep a stash. Parapets on the outer (south) edges keep
 * the roofs inside the map; the market side is open, and a drop from there hurts.
 */
const fireEscape = (): StaticProp[] => {
  const west = ROOF_WEST.top;
  const mid = ROOF_MID.top;
  const midX0 = ROOF_MID.x0;
  return [
    deck(68.2, 72.6, ROW_FACE, ROW_FACE + 1.3, BALCONY_TOP, 0.2, "metal"),
    rail(68.2, 72.6, ROW_FACE + 1.1, ROW_FACE + 1.3, BALCONY_TOP),
    ...ladderParts({ key: "targ-escape-1", x: 73.2, z: ROW_FACE + HANG, yaw: Math.PI, bottom: 0, top: BALCONY_TOP, exit: v(72, BALCONY_TOP, ROW_FACE + 0.65) }),
    ...ladderParts({ key: "targ-escape-2", x: 69.2, z: ROW_FACE + HANG, yaw: Math.PI, bottom: BALCONY_TOP, top: west, exit: v(69.2, west, ROW_FACE - 0.7) }),
    ...ladderParts({ key: "targ-escape-3", x: midX0 - HANG, z: 60.5, yaw: Math.PI / 2, bottom: west, top: mid, exit: v(midX0 + 0.8, mid, 60.5) }),
    rail(ROOF_WEST.x0, ROOF_WEST.x1, 58, 58.2, west),
    rail(ROOF_MID.x0, ROOF_MID.x1, 58, 58.2, mid),
    rail(ROOF_EAST.x0, ROOF_EAST.x1, 58, 58.2, ROOF_EAST.top),
    // Hebi's rooftop stash: a crate to hide behind, the bag lies next to it (TARG_ROOF_STASH).
    deck(91.9, 93.1, 60, 60.8, mid + 0.9, 0.9, "metal"),
  ];
};

/** A stash on a roof (ADR-0021): a bag placed once, when the player first comes near. */
export interface RoofStash {
  readonly key: string;
  readonly at: Vec3;
  readonly lines: readonly LootLine[];
}

export const TARG_ROOF_STASH: RoofStash = {
  key: "stash:targ-roof",
  at: market(91.2, ROOF_MID_TOP, 60.4),
  lines: [
    { kind: "eddies", qty: 180 },
    { kind: "ammo", ammo: "556", qty: 30 },
    { kind: "stack", item: "medkit", qty: 1 },
    { kind: "item", item: "holo_sight", rarity: "uncommon", qty: 1 },
  ],
};

/** The market's square: the hall (south row), the east houses, the stalls, Sachiko's kiosk by the gate. */
const SOUTH_PROPS: readonly StaticProp[] = [
  ...SOUTH_ROW,
  ...facadeRow(rng, 114, 124, 64, 12, [12, 20], [10, 10], "x-"),
  ...facadeRow(rng, 114, 124, 77, 14, [12, 20], [10, 10], "x-"),
  ...southStalls(),
  // Hana's handcart, just east of where she stands.
  crate(HANA_SPOT.x + 1.3, HANA_SPOT.z, 0.9, 1.0, 1.8),
  neon(113.9, 7, 66, v(0.15, 6, 1.4), "#ff2e88", "TAKO"),
  neon(113.9, 5.5, 78, v(0.15, 5.4, 1.2), "#39ff8a", "PACHI"),
  neon(OYAJI_STALL.x, 2.2, OYAJI_STALL.z + 0.7, v(2.4, 0.18, 0.1), pick(rng, STRIPS)),
  lamp(110, 73, "#ff9ad0"),
  lamp(88, 72.5, "#9ad7ff"),
  ...fireEscape(),
  // Sachiko's kiosk just inside the gate, her counter on its west side (ADR-0026).
  building(74, 78, 6, 3.2, 10, "metal", skin("shop", "x-")),
];

export const TARG_SOUTH_PROPS: readonly StaticProp[] = placeProps(MARKET_PLACE, SOUTH_PROPS);

const STALL_SIGNS = [
  ["RAMEN", "#ffb000"],
  ["DENKI", "#00e5ff"],
  ["SUSHI", "#ff4040"],
  ["OKONOMI", "#b46cff"],
] as const;

const northStalls = (): StaticProp[] => {
  const out: StaticProp[] = [];
  let signs = 0;
  for (let x = 76 + between(rng, 0, 2); x < 112; x += between(rng, 8, 10)) {
    out.push(...stall(rng, x, 102, -1));
    // Two lit signs; the rest of the row stays dark (point lights are a scarce resource).
    if (signs < 2 && rng.next() < 0.7) {
      const [label, color] = STALL_SIGNS[Math.floor(rng.next() * STALL_SIGNS.length)] ?? STALL_SIGNS[0];
      out.push(neon(x, 3.2, 100.5, v(2.6, 0.6, 0.15), color, label));
      signs += 1;
    }
  }
  return out;
};

/** Top of the highway deck. */
export const OVERPASS_TOP = 9.9;

/**
 * The highway deck as a walkway (ADR-0020): railings with two openings, closed ends, stairs
 * up from the west along its north edge, and a freight lift on the south side.
 */
const overpass = (): StaticProp[] => {
  const top = OVERPASS_TOP;
  // Stairs x ∈ [70.4, 86] between their own railings, then a landing flush with the deck.
  const stairX: readonly [number, number] = [70.4, 86];
  const landing: readonly [number, number] = [86, 88.4];
  const lift = { x0: 106.8, x1: 109.2 } as const;
  return [
    deck(66, 126, 87, 97, top, 1.4),
    // North railing, open onto the landing; south railing, open onto the lift gate.
    rail(66, landing[0], 96.8, 97, top),
    rail(landing[1], 126, 96.8, 97, top),
    rail(66, lift.x0, 87, 87.2, top),
    rail(lift.x1, 126, 87, 87.2, top),
    rail(66, 66.2, 87.2, 96.8, top),
    rail(125.8, 126, 87.2, 96.8, top),
    stairs(stairX[0], stairX[1], 97.2, 99, 0, top, "x", 1),
    stairRail(stairX[0], stairX[1], 97, 97.2, 0, top, "x", 1),
    stairRail(stairX[0], stairX[1], 99, 99.2, 0, top, "x", 1),
    deck(landing[0], landing[1], 97, 99, top, 0.4),
    rail(landing[0], landing[1] + 0.2, 99, 99.2, top),
    rail(landing[1], landing[1] + 0.2, 96.8, 99, top),
    // Freight lift: an open shaft between two walls, a rail on the far side up top.
    building(lift.x0 - 0.2, 85.7, 0.4, top + 1.2, 2.6),
    building(lift.x1 + 0.2, 85.7, 0.4, top + 1.2, 2.6),
    rail(lift.x0, lift.x1, 84.2, 84.4, top),
    ...liftParts({
      key: "targ-lift",
      x0: lift.x0,
      x1: lift.x1,
      z0: 84.4,
      // Flush with the deck edge, so stepping off at the top never crosses a gap.
      z1: 87,
      levels: [0.15, top],
      gates: [{ level: 1, x0: lift.x0, x1: lift.x1, z0: 87, z1: 87.2 }],
      buttons: [
        { level: 0, at: v(lift.x0 - 0.2, 1.25, 84.25) },
        { level: 1, at: v(lift.x0 - 0.2, top + 1.25, 86.6) },
      ],
    }),
    // On the west wall of the shaft: thin-in-X signs face west (props.ts), towards the stairs.
    neon(lift.x0 - 0.45, 3, 85.6, v(0.15, 2.2, 0.8), "#ffb000", "LIFT"),
  ];
};

/** The viaduct with its stairs and lift, the pillars, the north stalls and Hebi's corner. */
const NORTH_PROPS: readonly StaticProp[] = [
  // The east wall under the viaduct's end: Hebi's corner backs onto it (the camera, the HEBI sign).
  building(125, 100, 2, 8, 32, "metal"),
  // The viaduct: a deck on six pillars, walkable underneath and, since ADR-0020, on top.
  ...overpass(),
  ...[78, 96, 114].flatMap((x) => [building(x, 88.5, 1.4, 8.5, 1.4), building(x, 95.5, 1.4, 8.5, 1.4)]),
  neon(96, 7.4, 86.9, v(8, 1.4, 0.15), "#ffb000", "TARG"),
  ...northStalls(),
  // Hebi stash in the east corner under the highway: cover in front of the crate.
  crate(119.8, 92, 1.0, 1.1, 2.4),
  crate(122.5, 96.6, 1.6, 1.4, 1.4),
  lamp(116, 99, "#ffcf8a"),
  // ADR-0026, hand-placed after the generated rows: no random number moves. A car left on the
  // highway deck since the night of the blockade, cover on the west end of the walkway.
  { ...crate(76, 90, 4.2, 1.5, 2, skin("car", "x+")), center: v(76, OVERPASS_TOP + 0.75, 90) },
];

export const TARG_NORTH_PROPS: readonly StaticProp[] = placeProps(MARKET_PLACE, NORTH_PROPS);

/**
 * Level graph of the market (ADR-0021): the floor between the stall rows, the west end under
 * the deck, the foot and the head of the stairs and two points on the deck. The lift is left
 * out on purpose (NPCs take the stairs), and so are the fire escape ladders: two points on the
 * market floor that see over the roof edges are firing positions instead.
 */
const LOCAL_NAV: NavGraph = {
  nodes: [
    { id: "targ-floor-c", at: v(92, 0, 84) },
    { id: "targ-floor-w", at: v(72, 0, 85.5) },
    { id: "targ-stairs-approach", at: v(69.2, 0, 94) },
    { id: "targ-stairs-foot", at: v(69.2, 0, 98.1) },
    { id: "targ-north-w", at: v(69.2, 0, 102) },
    { id: "targ-stairs-top", at: v(87.2, OVERPASS_TOP, 98.1) },
    { id: "targ-deck-w", at: v(87.2, OVERPASS_TOP, 94.5) },
    { id: "targ-deck-e", at: v(112, OVERPASS_TOP, 92) },
    { id: "targ-view-sw", at: v(80, 0, 75) },
    { id: "targ-view-s", at: v(100, 0, 77) },
    // Ground floor round the stairs and behind the north stalls (ADR-0025): a start or a goal
    // tucked behind a counter still finds the graph.
    { id: "targ-stairs-e", at: v(90, 0, 99.9) },
    { id: "targ-north-c", at: v(90, 0, 104.4) },
    { id: "targ-north-e", at: v(110, 0, 104.4) },
  ],
  edges: [
    { a: "targ-floor-c", b: "targ-floor-w" },
    { a: "targ-floor-w", b: "targ-stairs-approach" },
    { a: "targ-stairs-approach", b: "targ-stairs-foot" },
    { a: "targ-stairs-foot", b: "targ-north-w" },
    { a: "targ-stairs-foot", b: "targ-stairs-top", via: { minX: 68.6, maxX: 88.4, minZ: 97.2, maxZ: 99 } },
    { a: "targ-stairs-top", b: "targ-deck-w" },
    { a: "targ-deck-w", b: "targ-deck-e" },
    { a: "targ-floor-c", b: "targ-view-sw" },
    { a: "targ-floor-c", b: "targ-view-s" },
    { a: "targ-floor-c", b: "targ-stairs-e" },
    { a: "targ-stairs-e", b: "targ-north-c" },
    { a: "targ-north-c", b: "targ-north-e" },
  ],
};

export const TARG_NAV: NavGraph = placeNav(MARKET_PLACE, LOCAL_NAV);

/** What the car abandoned on the highway deck still holds (ADR-0026). */
export const TARG_OVERPASS_STASH: RoofStash = {
  key: "stash:targ-overpass",
  at: market(75.2, OVERPASS_TOP, 91.6),
  lines: [
    { kind: "eddies", qty: 120 },
    { kind: "ammo", ammo: "9mm", qty: 18 },
    { kind: "stack", item: "bandage", qty: 2 },
    { kind: "stack", item: "datachip", qty: 1 },
  ],
};

/**
 * Stall keepers of the north row (ADR-0026), behind their counters: Kenta fries okonomiyaki
 * under OKONOMI, Fumiko keeps the ramen stall (the market's food shop) and Goro sells umbrellas
 * at the east end. The south row stays Oyaji's alone: Hana's protection waves walk along it
 * to his stall, and a keeper there would stand in their way.
 */
export const STALL_KEEPERS = {
  kenta: market(77.2, 0, 103.4),
  fumiko: market(93.6, 0, 103.4),
  goro: market(103.1, 0, 103.4),
} as const;

/** Oyaji can be hurt: Hebi come for him in Hana's protection jobs. */
export const OYAJI_MAX_HP = 120;

/**
 * Ren Odagiri sleeps on the concrete roof of the south row, the one up the third fire escape
 * ladder, near Hebi's stash (act II, ADR-0023). He turns up once someone told Seki where he is
 * and is gone after the "kagami" ending, when Kagami takes him.
 */
export const REN_SPOT: Vec3 = market(86, ROOF_MID_TOP, 59.6);

/** Kurosawa of Kagami waits on the overpass deck, and his cleaners come from the lift side. */
export const KUROSAWA_SPOT: Vec3 = market(100, OVERPASS_TOP, 92);
const CLEANER_SPOTS: readonly Vec3[] = [market(105, OVERPASS_TOP, 89.5), market(107, OVERPASS_TOP, 94.5), market(111, OVERPASS_TOP, 92)];

/** Tag of the cleaners (their deaths raise `killed:kagami_cleaner`). */
export const KAGAMI_CLEANER_TAG = "kagami_cleaner";

const REN: ActorDef = {
  kind: "npc",
  spawn: { key: "ren", position: REN_SPOT, yaw: 0 },
  preset: "civilian",
  faction: "hebi",
  when: { all: [REN_TRAIL_FLAG], none: [endingFlag("kagami")] },
  interactable: { kind: "dialogue", dialogueId: "ren_odagiri", prompt: "prompt.talk.ren", radius: 2.4 },
};

const KUROSAWA: ActorDef = {
  kind: "npc",
  spawn: { key: "kurosawa", position: KUROSAWA_SPOT, yaw: -Math.PI / 2 },
  preset: "fixer",
  faction: "kagami",
  when: { all: [KAGAMI_JOB_FLAG], none: [KAGAMI_AMBUSH_FLAG, ACT_TWO_ENDING_FLAG] },
  interactable: { kind: "dialogue", dialogueId: "kurosawa", prompt: "prompt.talk.kurosawa", radius: 2.4 },
};

const CLEANERS: readonly ActorDef[] = KAGAMI_CLEANER_KEYS.map(
  (key, i): ActorDef => ({
    kind: "ganger",
    spawn: { key, position: CLEANER_SPOTS[i] ?? KUROSAWA_SPOT, yaw: -Math.PI / 2, tag: KAGAMI_CLEANER_TAG },
    enemy: "kagami_cleaner",
    when: { all: [KAGAMI_AMBUSH_FLAG] },
  }),
);

export const TARG_SOUTH_ACTORS: readonly ActorDef[] = [
  {
    kind: "npc",
    spawn: { key: "oyaji", position: market(OYAJI_STALL.x, 0, OYAJI_STALL.z - 1.4), yaw: 0 },
    preset: "civilian",
    faction: "civilians",
    bystander: true,
    maxHp: OYAJI_MAX_HP,
    // By day the stall (plan §6); from 22:00 the schedule swaps in `oyaji_closed`.
    interactable: { kind: "shop", shopId: "oyaji", dialogueId: "oyaji", prompt: "prompt.shop.oyaji", radius: 3 },
  },
  {
    kind: "npc",
    spawn: { key: "hana", position: market(HANA_SPOT.x, 0, HANA_SPOT.z), yaw: -Math.PI / 2 },
    preset: "civilian",
    faction: "civilians",
    interactable: { kind: "dialogue", dialogueId: "hana", prompt: "prompt.talk.hana", radius: 2.4 },
  },
  REN,
  {
    kind: "npc",
    spawn: { key: "sachiko", position: market(70.4, 0, 79.6), yaw: -Math.PI / 2 },
    preset: "civilian",
    faction: "civilians",
    bystander: true,
    interactable: { kind: "dialogue", dialogueId: "sachiko", prompt: "prompt.shop.sachiko", radius: 2.4 },
  },
];

export const TARG_NORTH_ACTORS: readonly ActorDef[] = [
  { kind: "ganger", spawn: { key: "hebi-lookout", position: market(104, 0, 92), yaw: Math.PI, tag: null } },
  KUROSAWA,
  ...CLEANERS,
  {
    kind: "npc",
    spawn: { key: "kenta", position: STALL_KEEPERS.kenta, yaw: Math.PI },
    preset: "civilian",
    faction: "civilians",
    bystander: true,
    interactable: { kind: "dialogue", dialogueId: "kenta", prompt: "prompt.shop.kenta", radius: 3 },
  },
  {
    kind: "npc",
    spawn: { key: "fumiko", position: STALL_KEEPERS.fumiko, yaw: Math.PI },
    preset: "civilian",
    faction: "civilians",
    bystander: true,
    // From 16:00 to 4:00 the stall (ADR-0026); the rest of the day the schedule swaps in `fumiko_closed`.
    interactable: { kind: "shop", shopId: "yatai", dialogueId: "fumiko", prompt: "prompt.shop.fumiko", radius: 3 },
  },
  {
    kind: "npc",
    spawn: { key: "goro", position: STALL_KEEPERS.goro, yaw: Math.PI },
    preset: "civilian",
    faction: "civilians",
    bystander: true,
    interactable: { kind: "dialogue", dialogueId: "goro", prompt: "prompt.shop.goro", radius: 3 },
  },
];

/**
 * Spawn points of the market jobs, four per site like the M1 sites. A delivery spawns nobody;
 * its points are around Hana's cart, kept for symmetry.
 */
export const TARG_CONTRACT_SITE_SPAWNS: Readonly<Record<"hana_stall" | "hebi_stash" | "raid_north" | "raid_east", readonly Vec3[]>> = {
  hana_stall: [market(90.5, 0, 74), market(90.5, 0, 75.5), market(90.5, 0, 72.5), market(89, 0, 74)],
  hebi_stash: [market(118, 0, 89), market(119.5, 0, 95.5), market(116.5, 0, 92.5), market(121.5, 0, 88)],
  raid_north: [market(90, 0, 91), market(94, 0, 93), market(98, 0, 90.5), market(86, 0, 92.5)],
  raid_east: [market(110, 0, 74), market(111.5, 0, 78), market(108.5, 0, 71.5), market(112, 0, 81)],
};

/**
 * Which way each market crew looks when it turns up (audit W11): the raids at Oyaji's stall,
 * the stash guards west over the market floor they would be attacked from, the cart crew at
 * Hana. Their yaw is the direction from each spawn point to this point.
 */
export const TARG_CONTRACT_SITE_FACING: Readonly<Record<"hana_stall" | "hebi_stash" | "raid_north" | "raid_east", Vec3>> = {
  hana_stall: market(HANA_SPOT.x, 0, HANA_SPOT.z),
  hebi_stash: market(100, 0, 90),
  raid_north: market(OYAJI_STALL.x, 0, OYAJI_STALL.z - 1.4),
  raid_east: market(OYAJI_STALL.x, 0, OYAJI_STALL.z - 1.4),
};

/** Where the crate of a retrieval job lies (centre of the box). */
export const CONTRACT_ITEM_SPOTS: Readonly<Partial<Record<ContractSiteId, Vec3>>> = {
  hebi_stash: market(122.2, 0.3, 92),
};
