import type { BlockFront, BlockStyle, SaveSnapshot, Vec3 } from "@seki/core";
import { SeededRandom } from "../../src/rng/seeded-random";
import {
  type BlockMaterial,
  type ChunkDef,
  type NavGraph,
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
} from "../../src";

/**
 * The old market of Podzamcze as a test floor (ADR-0063 stage 6 took it off Aleja Tysiąclecia and
 * moved its people to Alchemia): the south row with the fire escape, its balcony and three ladders,
 * the stalls, and the viaduct's deck with its stairs, railings and freight lift, on flat ground at
 * y = 0 in a chunk of its own. The geometry is the removed `district-targ.ts`'s, drawn by the same
 * generator from the same seed, so the tests of jumps, falls, ladders, levels and lifts (ADR-0020,
 * ADR-0021, G-308, G-313, G-318) keep measuring the same shapes. Load it with
 * `Simulation.create({ seed, chunks: [OLD_MARKET_CHUNK] })`.
 */

/** Where the market's own coordinates (x 66..126, z 56..116) stand: as before, on flat ground at 0. */
export const MARKET_PLACE: Vec3 = { x: 689, y: 0, z: 260 };

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
/**
 * How far the balcony stands out of the wall, its rail included (G-318): a walk off the low roof
 * above it (4.2 m/s, the stick held) lands on it, 2.8 m out, instead of flying over the rail
 * onto the market 9 m below. A faster walk with buffs lands on the rail.
 */
const BALCONY_DEPTH = 3.4;
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
    deck(68.2, 72.6, ROW_FACE, ROW_FACE + BALCONY_DEPTH, BALCONY_TOP, 0.2, "metal"),
    rail(68.2, 72.6, ROW_FACE + BALCONY_DEPTH - 0.2, ROW_FACE + BALCONY_DEPTH, BALCONY_TOP),
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
  // Hebi stash in the east corner under the highway: cover in front of the crate. The big crate
  // by the stash takes a body (ADR-0065).
  crate(119.8, 92, 1.0, 1.1, 2.4),
  { ...crate(122.5, 96.6, 1.6, 1.4, 1.4), hide: "container" },
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

/** The test floor: both halves of the old market in one chunk with its level graph, nothing else in the world. */
export const OLD_MARKET_CHUNK: ChunkDef = {
  id: "old-market",
  district: "targ",
  bounds: placeRect(MARKET_PLACE, { minX: 60, maxX: 132, minZ: 50, maxZ: 122 }),
  props: [...TARG_SOUTH_PROPS, ...TARG_NORTH_PROPS],
  // A Hebi ganger under the deck where the market's lookout stood: a body to carry, kept by saves.
  nav: TARG_NAV,
  actors: [{ kind: "ganger", spawn: { key: "old-market-ganger", position: market(104, 0, 92), yaw: Math.PI, tag: null } }],
};

/** The test floor of the player's position in a save, as `Simulation.fromSnapshot` takes it. */
export const oldMarketFloorOf = (snap: SaveSnapshot): readonly ChunkDef[] | undefined => {
  const p = snap.entities.find((e) => e.key === "player")?.position;
  return p ? oldMarketFloor(p).chunks : undefined;
};

/** The test floor for a point of it, as `Simulation.create`'s options take it; the city elsewhere. */
export const oldMarketFloor = (p: Vec3): { readonly chunks?: readonly ChunkDef[] } => {
  const b = OLD_MARKET_CHUNK.bounds;
  return p.x >= b.minX && p.x <= b.maxX && p.z >= b.minZ && p.z <= b.maxZ ? { chunks: [OLD_MARKET_CHUNK] } : {};
};
