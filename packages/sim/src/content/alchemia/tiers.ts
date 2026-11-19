import { HALL, PARAPET, type Box, type Piece, box, outlined, piece } from "./plan";
import { ALL_CORNERS, type Corners, type Rectangle, balustrade, cornerRadius, outerCorners, roundedOutline } from "./rounded";

/*
 * Alchemia's green tiers over the food hall (ADR-0074, decisions of 15.11: the concept board
 * `docs/world/koncepty/alchemia/01-rozbudowa-front.jpg`). The complex grows up in steps from the
 * hall's roof (T0): tier A of shops and passages, glazed all round, and on it tier B, the food
 * court's terrace, a ring round an open courtyard (the board's green roof with its hole). Each roof
 * is a terrace with a parapet, planters and lawns, its slab's edge lined with light; a stair on
 * the west side climbs from T0 to A and on to B, so the player can walk up for the view over the
 * Old Town. The tiers are scenery for the eye and a floor for her feet: nobody works or walks
 * inside them (the hall below is the market), so they are solid boxes of lit glass.
 *
 * The strip along the hall's back wall stays T0's own: the stair house, the lift's kiosk and the
 * way along the car park (z 32..36). The front strip keeps its planters (z 54.5..58), the east one
 * the walk round to the front for whoever comes off the car park (`nav.ts`).
 */

const R = HALL.roof;
/** A slab's thickness at a tier's top, its overhang past the glass, a parapet's thickness. */
const SLAB = 0.3;
const OVER = 0.3;
const WALL = 0.25;

/** Tier A, the shops' floor on the hall's roof: its outline and top (its roof's walking level). */
export const TIER_A = { minX: 402, maxX: 434, minZ: 36, maxZ: 54.5, bottom: R, top: R + 4.5 } as const;

/** Tier B, the food court's ring on A, round the courtyard open to the sky. */
export const TIER_B = { minX: 406, maxX: 430, minZ: 38, maxZ: 52, bottom: TIER_A.top, top: TIER_A.top + 4.2 } as const;
export const COURTYARD = { minX: 414, maxX: 422, minZ: 42, maxZ: 48 } as const;

/** A flight of steps up a strip from `z0` northwards: its x span, the rise it climbs from `from`, its riser count. */
interface Flight {
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly from: number;
  readonly rise: number;
  readonly risers: number;
}
/** The going of a tread. */
export const TREAD = 0.28;
/** Its landing on the top floor, this long. */
const LANDING = 1.5;

/** From T0 up to A's roof, between the hall's west parapet and tier A. */
export const FLIGHT_A: Flight = { x0: HALL.minX + WALL, x1: TIER_A.minX, z0: 37, from: R, rise: TIER_A.top - R, risers: 25 };
/** From A's roof up to B's, beside B's west face, a walk left beside it from the first flight's landing. */
export const FLIGHT_B: Flight = { x0: 403.8, x1: TIER_B.minX, z0: 38.5, from: TIER_A.top, rise: TIER_B.top - TIER_A.top, risers: 24 };

/** Where a flight ends and its landing, from-to along z. */
export const flightTop = (f: Flight): number => f.z0 + f.risers * TREAD;
export const landing = (f: Flight): { readonly z0: number; readonly z1: number } => ({ z0: flightTop(f), z1: flightTop(f) + LANDING });

/** A balustrade's thickness and height over the treads. */
const RAIL = 0.15;
const RAIL_HIGH = 1.0;

/**
 * The flight's treads and landing, a balustrade along its open west side (over the drop) and across
 * the landing's north end; its east side is the tier's glass.
 */
const flight = (f: Flight): Piece[] => {
  const out: Piece[] = [];
  const riser = f.rise / f.risers;
  for (let k = 1; k <= f.risers; k++) out.push(piece(box(f.x0, f.x1, f.z0 + (k - 1) * TREAD, f.z0 + k * TREAD, f.from - 0.05, f.from + k * riser), "step", false));
  const l = landing(f);
  out.push(piece(box(f.x0, f.x1, l.z0, l.z1, f.from - 0.05, f.from + f.rise), "step", false));
  const top = f.from + f.rise + RAIL_HIGH;
  out.push(piece(box(f.x0, f.x0 + RAIL, f.z0 + 2 * TREAD, l.z1, f.from + 0.4, top), "parapet", false));
  out.push(piece(box(f.x0, f.x1, l.z1, l.z1 + RAIL, f.from + f.rise, top), "parapet", false));
  return out;
};

type Area = { minX: number; maxX: number; minZ: number; maxZ: number };

/** A storey's slab: its glass's outline grown by the overhang. */
export const slabOf = (r: Area): Rectangle => ({ x0: r.minX - OVER, x1: r.maxX + OVER, z0: r.minZ - OVER, z1: r.maxZ + OVER });

/**
 * The balustrade round a terrace (19.11, the board's): a hand in from its slab's rounded edge, open
 * over a stair's landing on its west side (the z spans in `gapsWest`).
 */
const terraceRail = (r: Area, y: number, gapsWest: readonly { z0: number; z1: number }[], radius?: number): Piece[] => {
  const s = slabOf(r);
  const gaps = gapsWest.map((g) => ({ x0: s.x0 - 1, x1: r.minX + 0.5, z0: g.z0, z1: g.z1 }));
  return balustrade(s, -0.05, ALL_CORNERS, y, PARAPET, true, gaps, radius);
};

/** A ring of parapets round a rectangle at `y` (the courtyard's hole: square, knee-high walls). */
const parapets = (r: Area, y: number, gapsWest: readonly { z0: number; z1: number }[] = []): Piece[] => {
  const top = y + PARAPET;
  const west: Piece[] = [];
  let z = r.minZ + WALL;
  for (const g of [...gapsWest].sort((a, b) => a.z0 - b.z0)) {
    if (g.z0 > z) west.push(piece(box(r.minX, r.minX + WALL, z, g.z0, y, top), "parapet", false));
    z = g.z1;
  }
  if (r.maxZ - WALL > z) west.push(piece(box(r.minX, r.minX + WALL, z, r.maxZ - WALL, y, top), "parapet", false));
  return [
    piece(box(r.minX, r.maxX, r.minZ, r.minZ + WALL, y, top), "parapet", false),
    piece(box(r.minX, r.maxX, r.maxZ - WALL, r.maxZ, y, top), "parapet", false),
    piece(box(r.maxX - WALL, r.maxX, r.minZ + WALL, r.maxZ - WALL, y, top), "parapet", false),
    ...west,
  ];
};

/**
 * A slab over glass: the glass up to it, the slab with its overhang, a strip of light along its
 * edge; its `corners` rounded (19.11), the glass's concentric with the slab's.
 */
export const storey = (r: Area, bottom: number, top: number, corners: Corners = ALL_CORNERS, radius = cornerRadius(slabOf(r))): Piece[] => {
  const s = top - SLAB;
  const slab = slabOf(r);
  return [
    outlined(roundedOutline(slab, -OVER, corners, undefined, radius), bottom - 0.05, s, "glass"),
    outlined(roundedOutline(slab, 0, corners, undefined, radius), s, top, "roof"),
    ...ledRing(r, s, OVER),
  ];
};

/** The light along a slab's edge: four thin strips just outside it, under its top. */
const ledRing = (r: { minX: number; maxX: number; minZ: number; maxZ: number }, y: number, over: number): Piece[] => {
  const [x0, x1, z0, z1] = [r.minX - over - 0.04, r.maxX + over + 0.04, r.minZ - over - 0.04, r.maxZ + over + 0.04];
  const [y0, y1] = [y + 0.06, y + 0.14];
  return [
    piece(box(x0, x1, z0, z0 + 0.04, y0, y1), "led", false, false),
    piece(box(x0, x1, z1 - 0.04, z1, y0, y1), "led", false, false),
    piece(box(x0, x0 + 0.04, z0, z1, y0, y1), "led", false, false),
    piece(box(x1 - 0.04, x1, z0, z1, y0, y1), "led", false, false),
  ];
};

/** Tier B: its four bars round the courtyard. */
const B_BARS: readonly { minX: number; maxX: number; minZ: number; maxZ: number }[] = [
  { minX: TIER_B.minX, maxX: TIER_B.maxX, minZ: TIER_B.minZ, maxZ: COURTYARD.minZ },
  { minX: TIER_B.minX, maxX: TIER_B.maxX, minZ: COURTYARD.maxZ, maxZ: TIER_B.maxZ },
  { minX: TIER_B.minX, maxX: COURTYARD.minX, minZ: COURTYARD.minZ, maxZ: COURTYARD.maxZ },
  { minX: COURTYARD.maxX, maxX: TIER_B.maxX, minZ: COURTYARD.minZ, maxZ: COURTYARD.maxZ },
];

/** The green roof's lawns on B, one on each bar, a step in from its parapets (the roof's lawns of stage 7, moved up on 15.11). */
export const ROOF_LAWNS: readonly Box[] = B_BARS.map((b) => box(b.minX + 0.8, b.maxX - 0.8, b.minZ + 0.8, b.maxZ - 0.8, TIER_B.top, TIER_B.top + 0.05)).filter(
  (b) => b.x1 - b.x0 > 1 && b.z1 - b.z0 > 1,
);

/** The planters on A's roof along its north parapet, knee high, between which one looks down on the square. */
export const TIER_PLANTERS: readonly Box[] = [404, 411, 418, 425].map((x) => box(x, x + 5, TIER_A.maxZ - 1.25, TIER_A.maxZ - WALL, TIER_A.top, TIER_A.top + 0.5));

/** Green hanging over the parapets of both roofs, the board's cascades: thin, not in anybody's way. */
const cascades = (): Piece[] => {
  const out: Piece[] = [];
  for (const x of [405, 413, 421, 429]) out.push(piece(box(x, x + 3, TIER_A.maxZ + OVER, TIER_A.maxZ + OVER + 0.2, TIER_A.top - 2.2, TIER_A.top + 0.6), "green", false, false));
  for (const x of [409, 419]) out.push(piece(box(x, x + 4, TIER_B.maxZ + OVER, TIER_B.maxZ + OVER + 0.2, TIER_B.top - 1.8, TIER_B.top + 0.6), "green", false, false));
  for (const z of [40, 47]) out.push(piece(box(TIER_A.maxX + OVER, TIER_A.maxX + OVER + 0.2, z, z + 3, TIER_A.top - 2.0, TIER_A.top + 0.6), "green", false, false));
  return out;
};

/** The courtyard's floor on A's slab: a skylight over the shops and a tree in a bed, its crown in two tiers under B's roof, so the court stays open from above. */
const courtyard = (): Piece[] => [
  piece(box(COURTYARD.minX + 0.5, COURTYARD.maxX - 0.5, COURTYARD.minZ + 0.5, COURTYARD.maxZ - 0.5, TIER_A.top, TIER_A.top + 0.05), "glass", false, false),
  piece(box(417, 419, 44, 46, TIER_A.top, TIER_A.top + 0.6), "green", false),
  piece(box(417.75, 418.25, 44.75, 45.25, TIER_A.top + 0.6, TIER_A.top + 3.4), "pergola", false, false),
  piece(box(416.7, 419.3, 43.7, 46.3, TIER_A.top + 2.6, TIER_A.top + 3.6), "green", false, false),
  piece(box(417.2, 418.8, 44.2, 45.8, TIER_A.top + 3.6, TIER_A.top + 4.3), "green", false, false),
];

/** Hedges along the terraces' outer parapets, the board's green edges: B's south and north, A's east. Knee high, a step wide. */
export const TIER_HEDGES: readonly Box[] = [
  box(TIER_B.minX + 1.5, TIER_B.maxX - 0.5, TIER_B.minZ + WALL, TIER_B.minZ + WALL + 0.5, TIER_B.top, TIER_B.top + 0.6),
  box(TIER_B.minX + 1.5, TIER_B.maxX - 0.5, TIER_B.maxZ - WALL - 0.5, TIER_B.maxZ - WALL, TIER_B.top, TIER_B.top + 0.6),
  box(TIER_A.maxX - WALL - 0.5, TIER_A.maxX - WALL, TIER_A.minZ + 1, TIER_A.maxZ - 1.5, TIER_A.top, TIER_A.top + 0.6),
];

/** The tables and benches of A's south terrace, under the food court's windows. */
const terraceFurniture = (): Piece[] =>
  [409, 415, 421, 427].flatMap((x) => [
    piece(box(x, x + 1.2, TIER_A.minZ + 0.6, TIER_A.minZ + 1.4, TIER_A.top, TIER_A.top + 0.75), "table", false),
    piece(box(x - 0.1, x + 1.3, TIER_A.minZ + 0.3, TIER_A.minZ + 0.5, TIER_A.top, TIER_A.top + 0.45), "bench", false),
  ]);

/** B's ring rounds at its bars' radius (the narrowest bar's), its joints round the courtyard square. */
export const B_RADIUS = Math.min(...B_BARS.map((b) => cornerRadius(slabOf(b))));
const B_RECTS = B_BARS.map((b) => ({ x0: b.minX, x1: b.maxX, z0: b.minZ, z1: b.maxZ }));

export const tierPieces = (): Piece[] => {
  const lA = landing(FLIGHT_A);
  const lB = landing(FLIGHT_B);
  return [
    ...storey(TIER_A, TIER_A.bottom, TIER_A.top),
    ...B_BARS.flatMap((b, i) => storey(b, TIER_B.bottom, TIER_B.top, outerCorners(B_RECTS[i]!, B_RECTS), B_RADIUS)),
    ...terraceRail(TIER_A, TIER_A.top, [{ z0: lA.z0 - 0.1, z1: lA.z1 + 0.1 }]),
    ...terraceRail(TIER_B, TIER_B.top, [{ z0: lB.z0 - 0.1, z1: lB.z1 + 0.1 }], B_RADIUS),
    // Round the courtyard's hole in B's roof: knee-high walls with nothing between.
    ...parapets({ minX: COURTYARD.minX - WALL, maxX: COURTYARD.maxX + WALL, minZ: COURTYARD.minZ - WALL, maxZ: COURTYARD.maxZ + WALL }, TIER_B.top),
    ...flight(FLIGHT_A),
    ...flight(FLIGHT_B),
    ...TIER_PLANTERS.map((b) => piece(b, "green", false)),
    ...TIER_HEDGES.map((b) => piece(b, "green", false)),
    ...ROOF_LAWNS.map((b) => piece(b, "lawn", false, false)),
    ...cascades(),
    ...courtyard(),
    ...terraceFurniture(),
  ];
};

/** On the roof of A or B, walking (their slabs' tops). */
export const onTierRoof = (x: number, z: number): number | null => {
  const inB = x >= TIER_B.minX && x <= TIER_B.maxX && z >= TIER_B.minZ && z <= TIER_B.maxZ && !(x > COURTYARD.minX && x < COURTYARD.maxX && z > COURTYARD.minZ && z < COURTYARD.maxZ);
  if (inB) return TIER_B.top;
  if (x >= TIER_A.minX && x <= TIER_A.maxX && z >= TIER_A.minZ && z <= TIER_A.maxZ) return TIER_A.top;
  return null;
};
