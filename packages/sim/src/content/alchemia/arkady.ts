import type { GroundPoint, Vec3, ViewDescriptor } from "@seki/core";
import type { StaticProp } from "../builders";
import { KRAKOWSKIE_CHUNKS } from "../lublin/krakowskie.generated";
import { mapHeight } from "../lublin/shape";
import { STARE_MIASTO_CHUNKS } from "../lublin/stare-miasto.generated";
import type { PrismDef } from "../../world/prism";
import { type Box, type Piece, box, piece } from "./plan";

/**
 * The Arkady rebuilt (ADR-0074 §1, stage 2): the ruined outbuilding of Świętoduska 7 (OSM way
 * 66286396, once the butchers' stalls, later the café "Pod Arkadami") on its OSM outline, 49.7 ×
 * 5.8 m, with the storey the investor's plan adds "after the inter-war materials" (S6). Its ground
 * floor stands on T2 with an arcade along its west side, the restaurants behind it; its upper floor
 * is level with Lubartowska's pavement, a door onto it; a flat roof behind an attic (no data of
 * the roof). Background with restaurants, no mechanics (decision of 6.11): the arcade is walked,
 * the restaurants are not entered.
 *
 * The building lies askew of the world's axes (21°), so its pieces are boxes of its own frame: `x`
 * along it from the south-west corner (`a`, 0..ARKADY.length), `z` across it from the west face
 * east (`c`, 0..ARKADY.depth), `y` the world's. `arkadyPoint` and `ARKADY_FRAME` turn them into
 * the world's metres.
 *
 * Levels measured on the NMT (1 m, `docs/topografia.md` T-218): along the west face -7.1 at the
 * south corner, -8.0..-8.8 to its middle and -9.3..-9.4 at the north end; along the east face
 * -5.4..-5.7 over four fifths of it, down to -8.9 at its north end, where Lubartowska falls away.
 */

/** OSM id of the building, and the buildings the plan keeps on their OSM outline (the scan's `osm-building-kept`). */
export const ARKADY_OSM_ID = "w66286396";
export const KEPT_OSM: readonly string[] = [ARKADY_OSM_ID, "w1565213799"];

/** The outline's corners as the import has them (`krakowskie.generated.ts`): south-west, south-east, north-east, north-west. */
export const ARKADY_OUTLINE: readonly GroundPoint[] = [
  { x: 443.1, z: 83.4 },
  { x: 448.5, z: 81.3 },
  { x: 466.5, z: 127.7 },
  { x: 461.0, z: 129.8 },
];

const [SW, SE, , NW] = ARKADY_OUTLINE as [GroundPoint, GroundPoint, GroundPoint, GroundPoint];
const LENGTH = Math.hypot(NW.x - SW.x, NW.z - SW.z);
const ALONG = { x: (NW.x - SW.x) / LENGTH, z: (NW.z - SW.z) / LENGTH };
/** Square to the west face (the outline is 1° off a rectangle: its east corners stand 0.1 m off the frame's). */
const ACROSS = { x: ALONG.z, z: -ALONG.x };
const DEPTH = (SE.x - SW.x) * ACROSS.x + (SE.z - SW.z) * ACROSS.z;

/** The building's frame: its south-west corner, the unit vector along it (north) and square across it (east, into it). */
export const ARKADY_FRAME = { origin: SW, along: ALONG, across: ACROSS } as const;

/** A point of the building's frame in the world: `a` along it, `c` across it. */
export const arkadyPoint = (a: number, c: number): GroundPoint => ({
  x: SW.x + ARKADY_FRAME.along.x * a + ARKADY_FRAME.across.x * c,
  z: SW.z + ARKADY_FRAME.along.z * a + ARKADY_FRAME.across.z * c,
});

/** The world's point in the building's frame. */
export const arkadyLocal = (x: number, z: number): { readonly a: number; readonly c: number } => {
  const dx = x - SW.x;
  const dz = z - SW.z;
  return { a: dx * ARKADY_FRAME.along.x + dz * ARKADY_FRAME.along.z, c: dx * ARKADY_FRAME.across.x + dz * ARKADY_FRAME.across.z };
};

/** The world x of the building's line `c` across it (0 the west face, `ARKADY.depth` the east one) at the world's z. */
export const arkadyLineX = (c: number, z: number): number => {
  const p = arkadyPoint(0, c);
  return p.x + ((z - p.z) * ARKADY_FRAME.along.x) / ARKADY_FRAME.along.z;
};

/**
 * Its levels: the ground floor on T2, the upper floor level with Lubartowska's pavement (-5.6 on
 * the NMT along the east face), the roof a storey over it, the attic.
 */
export const ARKADY = {
  length: LENGTH,
  depth: DEPTH,
  ground: -9.2,
  upper: -5.6,
  roof: -2.2,
  attic: 0.7,
  /** The arcade's depth from the west face, its spans (`ARKADY_PIERS`) and its piers' width. */
  arcade: 2.4,
  spans: 14,
  pier: 0.55,
  /** Under the arches: from the floor up to the arches' crown. */
  clear: 2.7,
} as const;

/** The arcade's paved floor, a few centimetres over T2 (the ground under it is T2, `plaza.ts`). */
export const ARKADY_ARCADE_FLOOR = ARKADY.ground + 0.03;

/** The upper floor's slab, under the floor. */
const SLAB = 0.35;
const SINK = 0.3;
/** The attic's thickness. */
const ATTIC = 0.25;

/**
 * The middles of the arcade's 13 piers along the west face, from the south corner, as the PZGiK
 * orthophoto (5 cm/px) has them (±0.15 m, `docs/topografia.md` T-218): 14 spans, unequal, the
 * south one 2.95 m (the closed corner room), the north one 3.35 m to the corner.
 */
export const ARKADY_PIERS: readonly number[] = [2.95, 6.25, 9.9, 13.6, 17.2, 20.8, 24.55, 28.25, 31.75, 35.4, 39.1, 42.95, 46.4];

/** Span `k` (0-based from the south) between the middles of its piers, or of the building's ends. */
export const arkadySpan = (k: number): { readonly a0: number; readonly a1: number } => ({
  a0: k <= 0 ? 0 : (ARKADY_PIERS[k - 1] ?? ARKADY.length),
  a1: k >= ARKADY_PIERS.length ? ARKADY.length : (ARKADY_PIERS[k] ?? 0),
});

/** The middle of span `k` (0-based) along the building. */
export const arkadySpanMid = (k: number): number => {
  const s = arkadySpan(k);
  return (s.a0 + s.a1) / 2;
};

/** The span `a` along the building lies in. */
export const arkadySpanAt = (a: number): number => ARKADY_PIERS.filter((p) => p <= a).length;

/** The arcade's floor along the building: from the first pier's middle (the south span is closed) to the north end wall. */
export const ARKADY_ARCADE_SPAN = { a0: ARKADY_PIERS[0] ?? 0, a1: ARKADY.length - ARKADY.pier } as const;

/** The restaurants behind the arcade: which spans each fills, its kitchen (its sign's colour), its door's span. */
export interface ArkadyRestaurant {
  readonly id: string;
  readonly cuisine: string;
  readonly from: number;
  readonly to: number;
  readonly door: number;
}

export const ARKADY_RESTAURANTS: readonly ArkadyRestaurant[] = [
  { id: "arkady-south", cuisine: "polish", from: 0, to: 5, door: 2 },
  { id: "arkady-middle", cuisine: "italian", from: 5, to: 9, door: 7 },
  { id: "arkady-north", cuisine: "wine", from: 9, to: 14, door: 11 },
];

/** The door onto Lubartowska's pavement, in the upper floor's east wall: from-to along the building. */
export const ARKADY_EAST_DOOR = { a0: 19.4, a1: 21.4, top: 2.4 } as const;

const A = ARKADY;
const L = A.length;
const D = A.depth;

/**
 * The ground floor: the arcade along the west face from the first pier (the south span is a corner
 * room of the south restaurant, closed), its floor, piers and the arches over it, the restaurants'
 * block behind it.
 */
const groundFloor = (): Piece[] => {
  const crown = A.ground + A.clear;
  const under = A.upper - SLAB;
  const first = ARKADY_ARCADE_SPAN.a0;
  const out: Piece[] = [piece(box(first, L, 0, A.arcade, A.ground - SINK, ARKADY_ARCADE_FLOOR), "step", false)];
  // The 13 piers from the orthophoto and the north corner's.
  for (const a of [...ARKADY_PIERS.map((m) => m - A.pier / 2), L - A.pier]) {
    out.push(piece(box(a, a + A.pier, 0, A.pier, A.ground - SINK, under), "wall", false));
  }
  out.push(piece(box(first, L, 0, A.pier, crown, under), "wall", false));
  out.push(piece(box(first, L, A.arcade, D, A.ground - SINK, under), "wall", false));
  out.push(piece(box(0, first - A.pier / 2, 0, D, A.ground - SINK, under), "wall", false));
  // The arcade's north end: a wall, the way in from T2 is through the arches.
  out.push(piece(box(L - A.pier, L, A.pier, A.arcade, A.ground - SINK, under), "wall", false));
  return out;
};

/** The upper floor, its slab with the cornice over the arches, the roof and the attic round it. */
const upperFloor = (): Piece[] => [
  piece(box(0, L, 0, D, A.upper - SLAB, A.roof), "wall", false),
  piece(box(-0.15, L, -0.15, 0, A.upper - SLAB, A.upper), "parapet", false, false),
  piece(box(0, L, 0, D, A.roof, A.roof + 0.12), "roof", false),
  piece(box(0, L, 0, ATTIC, A.roof, A.roof + A.attic), "parapet", false),
  piece(box(0, L, D - ATTIC, D, A.roof, A.roof + A.attic), "parapet", false),
  piece(box(0, ATTIC, ATTIC, D - ATTIC, A.roof, A.roof + A.attic), "parapet", false),
  piece(box(L - ATTIC, L, ATTIC, D - ATTIC, A.roof, A.roof + A.attic), "parapet", false),
];

/** The south door into the upper floor, from the landing off T1 (`pavement`): across the building. */
export const ARKADY_SOUTH_DOOR = { c0: 1.9, c1: 3.9, top: 2.4 } as const;

/** The restaurants' fronts at the back of the arcade (glass, a door each), the corner room's window and the upper floor's, drawn only. */
const glazing = (): Piece[] => {
  const out: Piece[] = [];
  const first = ARKADY_ARCADE_SPAN.a0;
  const front = A.arcade - 0.04;
  for (const r of ARKADY_RESTAURANTS) {
    for (let k = Math.max(r.from, 1); k < r.to; k++) {
      const s = arkadySpan(k);
      const [a0, a1] = [s.a0 + A.pier / 2 + 0.25, Math.min(s.a1, L - A.pier) - A.pier / 2 - 0.25];
      out.push(piece(box(a0, a1, front, A.arcade, A.ground + (k === r.door ? 0 : 0.5), A.ground + 2.4), k === r.door ? "frame" : "glass", false, false));
    }
  }
  out.push(piece(box(0.6, first - 0.9, -0.04, 0, A.ground + 0.9, A.ground + 2.4), "glass", false, false));
  for (let k = 0; k < A.spans; k++) {
    const m = arkadySpanMid(k);
    out.push(piece(box(m - 0.75, m + 0.75, -0.04, 0, A.upper + 0.9, A.upper + 2.5), "glass", false, false));
    const door = m > ARKADY_EAST_DOOR.a0 - 1 && m < ARKADY_EAST_DOOR.a1 + 1;
    if (!door) out.push(piece(box(m - 0.75, m + 0.75, D, D + 0.04, A.upper + 0.9, A.upper + 2.5), "glass", false, false));
  }
  const d = ARKADY_EAST_DOOR;
  out.push(piece(box(d.a0, d.a1, D, D + 0.05, A.upper, A.upper + d.top), "frame", false, false));
  out.push(piece(box(d.a0 - 0.4, d.a1 + 0.4, D, D + 1.2, A.upper + d.top + 0.1, A.upper + d.top + 0.25), "parapet", false, false));
  const s = ARKADY_SOUTH_DOOR;
  out.push(piece(box(-0.05, 0, s.c0, s.c1, A.upper, A.upper + s.top), "frame", false, false));
  return out;
};

/** The map's own terrain where the Arkady stand (both districts' grids meet at x 460), to 1 cm. */
const raw = (p: GroundPoint): number => Math.round(mapHeight([...KRAKOWSKIE_CHUNKS, ...STARE_MIASTO_CHUNKS], p.x, p.z) * 100) / 100;

/**
 * The pavement along the east face (Lubartowska's side), in slabs up to 2 m along it and `PAVEMENT`
 * wide, and the landing off T1 before the south door: over the dip the arcade's grid points leave
 * round the building (`plaza.ts`). Each is level with the highest of the map's ground under it, so
 * no ground shows through it (a kerb over its lower side). The pavement runs from 2 m south of the
 * building to 44 m along it, past the last of the dip where Lubartowska falls away to the north
 * (G-460: a 40..43, to 0.97 m under the map's ground); north of it the ground is the map's. The
 * landing reaches 2.2 m west of the building and half a metre along its corner room, over the dip
 * the first span's grid points leave at the foot of T1's slope (G-460, the scan's `pad-dip-uncovered`).
 *
 * The street falls there by up to half a metre a metre along and a quarter across, so a slab level
 * with the highest ground under it stands that much over its lower edges (G-778: 2 m slabs left
 * steps of 0.54 and 0.75 m, and the 5 m wide ones ledges of 0.6 m over the ground north of them
 * and 0.48 m over the dip south of the first). So the pavement lies in two strips, the dip's by the
 * wall the whole way and the outer one to `PAVEMENT_FALL`, where the street starts to fall (north
 * of it the ground off the wall lies on the map's, no dip to cover), each stepping down in `CELL`s
 * merged up to 2 m while their tops stay within `EVEN`.
 */
const PAVEMENT = 5;
const PAVEMENT_FROM = -2;
const PAVEMENT_TO = 44;
const PAVEMENT_FALL = 38;
const PAVEMENT_STRIPS = [
  { c0: 0, c1: 2, to: PAVEMENT_TO },
  { c0: 2, c1: PAVEMENT, to: PAVEMENT_FALL },
] as const;
const CELL = 0.5;
const SLAB_LONGEST = 2;
const EVEN = 0.1;
const LANDING = 3;
const LANDING_WEST = 2.2;
const LANDING_ALONG = 0.5;
const LANDING_TOP = Math.max(...[0, 1, 2, 3].flatMap((t) => [-LANDING_WEST, -1, 0, 2, 4, 5.8].map((c) => raw(arkadyPoint(-t, c)))));

/** The highest of the map's ground under the pavement from `a` a `CELL` along, `c0..c1` out from the wall. */
const cellTop = (a: number, c0: number, c1: number): number => {
  const across = Array.from({ length: Math.round((c1 - Math.max(c0, 0.5)) / 0.5) + 1 }, (_, i) => Math.max(c0, 0.5) + i * 0.5);
  return Math.max(...[0, 0.25, 0.5].flatMap((t) => across.map((c) => raw(arkadyPoint(a + t, D + c)))));
};

/** A strip's slabs: runs of cells up to `SLAB_LONGEST`, their tops within `EVEN` of the first's. */
const stripSlabs = (s: (typeof PAVEMENT_STRIPS)[number]): Box[] => {
  const slabs: { a0: number; a1: number; first: number; top: number }[] = [];
  for (let a = PAVEMENT_FROM; a < s.to - 1e-6; a += CELL) {
    const top = cellTop(a, s.c0, s.c1);
    const last = slabs.at(-1);
    if (last && a + CELL - last.a0 <= SLAB_LONGEST + 1e-6 && Math.abs(top - last.first) <= EVEN) {
      last.a1 = a + CELL;
      last.top = Math.max(last.top, top);
    } else slabs.push({ a0: a, a1: a + CELL, first: top, top });
  }
  return slabs.map((b) => box(b.a0, b.a1, D + s.c0, D + s.c1, b.top - 3, b.top));
};

const pavement = (): Piece[] => [
  ...PAVEMENT_STRIPS.flatMap(stripSlabs).map((b) => piece(b, "step", false)),
  piece(box(-LANDING, 0, 0, D, LANDING_TOP - 3, LANDING_TOP), "step", false),
  piece(box(-LANDING, LANDING_ALONG, -LANDING_WEST, 0, LANDING_TOP - 3, LANDING_TOP), "step", false),
];

/** The building's pieces in its frame: its walls, arches, roof and glass. */
export const ARKADY_BUILDING: readonly Piece[] = [...groundFloor(), ...upperFloor(), ...glazing()];
/** The pavement and the landing round it, in its frame. */
export const ARKADY_PAVEMENT: readonly Piece[] = pavement();
/** Every drawn piece of the Arkady, in the building's frame. */
export const ARKADY_PIECES: readonly Piece[] = [...ARKADY_BUILDING, ...ARKADY_PAVEMENT];

/** A box of the building's frame as a prism round `c` (world). */
const prismOf = (b: Box, c: Vec3): PrismDef => ({
  points: [arkadyPoint(b.x0, b.z0), arkadyPoint(b.x1, b.z0), arkadyPoint(b.x1, b.z1), arkadyPoint(b.x0, b.z1)].map((p) => ({ x: p.x - c.x, z: p.z - c.z })),
  bottom: b.y0 - c.y,
  top: b.y1 - c.y,
});

/** Seen nowhere as an entity: the engine draws the Arkady (`scenery`). */
const NO_VIEW: ViewDescriptor = { kind: "street-props", items: [] };

/** The middle of the building on the ground floor. */
export const ARKADY_CENTRE: Vec3 = { ...arkadyPoint(L / 2, D / 2), y: A.ground - SINK };

/** Solid pieces as one static prop of prisms round the building's middle. */
const propOf = (pieces: readonly Piece[]): StaticProp => ({
  center: ARKADY_CENTRE,
  view: NO_VIEW,
  solid: true,
  prisms: pieces.filter((p) => p.solid).map((p) => prismOf(p.box, ARKADY_CENTRE)),
  scenery: true,
});

/**
 * The Arkady's solids: the building on its OSM outline (the scan's `osm-building-kept`), in the map's
 * ruin's place among its chunk's buildings (`lublin/city.ts`), and the pavement round it, Alchemia's.
 */
export const ARKADY_PROP: StaticProp = propOf(ARKADY_BUILDING);
export const ARKADY_PAVEMENT_PROP: StaticProp = propOf(ARKADY_PAVEMENT);
