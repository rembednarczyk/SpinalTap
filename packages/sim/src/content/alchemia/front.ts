import type { Rect } from "../builders";
import { P1_RAMP, P1_STAIR } from "./parking";
import { type Box, type Piece, box, piece } from "./plan";
import { TIER_A, TIER_B } from "./tiers";

/*
 * Alchemia's front on Bajkowskiego (ADR-0074, "Bryła na całym terenie", stage B1, decisions of
 * 19.11): the board `docs/world/koncepty/alchemia/01-rozbudowa-front.jpg` is a view from
 * Bajkowskiego and Plac Łokietka, and the complex fills the whole site, the car park w173531008
 * included. Over P-1 three storeys step back from the street:
 * - L1, the podium: a west wing along the car park's slanted edge by Świętoduska, its roof stepping
 *   down westwards in green, screens on its front, and an east wing between the triangular pavilion
 *   and metro B's pavilion;
 * - L2, one slab on columns over T0 between the wings, its south edge a terrace over the street: under
 *   it P-1's ramp (open to z 11), its stair house, the beds by the ramp and the way into metro B stay
 *   T0's, a covered passage;
 * - L3, the top storey, the sign ALCHEMIA CENTRUM HANDLOWE on its south face and masts on its roof.
 * Every roof lies on a level of the green tiers (L1 = A's roof, L2 = B's, L3 four metres over),
 * every slab has its strip of light. They are scenery, solid boxes of lit glass, as the tiers are.
 */

/** The storeys' roofs: L1 on A's level, L2 on B's, L3 a storey over it. */
export const L1_TOP = TIER_A.top;
export const L2_TOP = TIER_B.top;
export const L3_TOP = L2_TOP + 4.2;
/** A slab's thickness at a storey's top and its overhang past the glass. */
const SLAB = 0.3;
const OVER = 0.3;

/** L1's west wing: by Bajkowskiego as deep as the car park's slanted west edge allows, narrower to the north. */
export const WEST_WING: readonly Rect[] = [
  { minX: 394, maxX: 404, minZ: -2, maxZ: 14 },
  { minX: 396, maxX: 404, minZ: 14, maxZ: 27.5 },
];
/** The green steps down the west wing's west side, westwards to the car park's edge: their x spans and tops. */
export const GREEN_STEPS: readonly { readonly x0: number; readonly x1: number; readonly top: number }[] = [
  { x0: 391.6, x1: 394, top: L1_TOP - 1.05 },
  { x0: 389.2, x1: 391.6, top: L1_TOP - 2.1 },
  { x0: 386.8, x1: 389.2, top: L1_TOP - 3.15 },
];
const STEPS_Z = { z0: -2, z1: 14 } as const;

/**
 * L1's east wing: north of the triangular pavilion, south of metro B's (its eaves clear), east of P-1's
 * stair house; the walk from the stair house's door east to Lubartowska passes south of it.
 */
export const EAST_WING: Rect = { minX: 424, maxX: 436, minZ: 13.5, maxZ: 22.5 };

/** L2: over the west wing and the passage, east of x 422 only over the east wing and on (the walk from the stair house to Lubartowska open to the sky). */
export const L2_SLABS: readonly Rect[] = [
  { minX: 394, maxX: 422, minZ: 4, maxZ: 32 },
  { minX: 422, maxX: 436, minZ: EAST_WING.minZ, maxZ: 32 },
];
/** L3: the top storey, set back from L2's front by a terrace, its back to the tiers. */
export const L3: Rect = { minX: 398, maxX: 428, minZ: 12, maxZ: 32 };

/** L2's underside over the passage: a slab this thick under its glass. */
const SOFFIT = 0.35;
/** A column of the passage: its side. */
const COLUMN = 0.6;
/**
 * The passage's columns under L2, clear of the ramp's trench and its parapets, the stair house and
 * metro B's pavilion: on P-1's roof where the ramp runs covered (z over 11) and by the walls.
 */
export const PASSAGE_COLUMNS: readonly { readonly x: number; readonly z: number }[] = [
  { x: 405.2, z: 5.5 },
  { x: 405.2, z: 15 },
  { x: 405.2, z: 24.5 },
  { x: P1_RAMP.minX + 4, z: 15 },
  { x: P1_RAMP.minX + 4, z: 24.5 },
  { x: P1_STAIR.maxX + 0.9, z: 9.5 },
  { x: P1_STAIR.maxX + 0.9, z: 24.5 },
  { x: 434.6, z: 24.5 },
];

/** The light along a slab's edge: four thin strips just outside it, under its top. */
const ledRing = (r: Rect, y: number, over: number): Piece[] => {
  const [x0, x1, z0, z1] = [r.minX - over - 0.04, r.maxX + over + 0.04, r.minZ - over - 0.04, r.maxZ + over + 0.04];
  const [y0, y1] = [y + 0.06, y + 0.14];
  return [
    piece(box(x0, x1, z0, z0 + 0.04, y0, y1), "led", false, false),
    piece(box(x0, x1, z1 - 0.04, z1, y0, y1), "led", false, false),
    piece(box(x0, x0 + 0.04, z0, z1, y0, y1), "led", false, false),
    piece(box(x1 - 0.04, x1, z0, z1, y0, y1), "led", false, false),
  ];
};

/** A storey: its glass from `bottom` up to the slab, the slab with its overhang, the light along it. */
const storey = (r: Rect, bottom: number, top: number): Piece[] => [
  piece(box(r.minX, r.maxX, r.minZ, r.maxZ, bottom, top - SLAB), "glass", false),
  piece(box(r.minX - OVER, r.maxX + OVER, r.minZ - OVER, r.maxZ + OVER, top - SLAB, top), "roof", false),
  ...ledRing(r, top - SLAB, OVER),
];

/** The ground under a wing, a little under its lowest corner: the glass stands in the terrain, not over it. */
const FOOT = -3;

/** The west wing's green steps, each with its strip of light along its edge to the west, as on the board. */
const greenSteps = (): Piece[] =>
  GREEN_STEPS.flatMap((s) => [
    piece(box(s.x0, s.x1, STEPS_Z.z0, STEPS_Z.z1, FOOT, s.top - 0.05), "wall", false),
    piece(box(s.x0, s.x1, STEPS_Z.z0, STEPS_Z.z1, s.top - 0.05, s.top), "lawn", false, false),
    piece(box(s.x0 - 0.04, s.x0, STEPS_Z.z0 - 0.04, STEPS_Z.z1 + 0.04, s.top - 0.14, s.top - 0.06), "led", false, false),
    piece(box(s.x0, s.x1, STEPS_Z.z0 - 0.04, STEPS_Z.z0, s.top - 0.14, s.top - 0.06), "led", false, false),
  ]);

/** The screens on the west wing's front and on L2's south face over the passage. */
const screens = (): Piece[] => [
  piece(box(395.5, 402.5, -2.06, -2, -1.1, 1.6), "screen", false, false),
  piece(box(425, 435, EAST_WING.minZ - 0.06, EAST_WING.minZ, -0.4, 1.7), "screen", false, false),
  piece(box(L2_SLABS[0]!.minX + 1, L2_SLABS[0]!.minX + 9, L2_SLABS[0]!.minZ - 0.06, L2_SLABS[0]!.minZ, L1_TOP + 0.5, L2_TOP - 0.8), "screen", false, false),
];

/** The sign on L3's south face over the passage: its box, the letters are the engine's (proper name). */
export const FRONT_SIGN: Box = box(403, 423, L3.minZ - 0.5, L3.minZ - 0.1, L2_TOP + 0.6, L3_TOP - 0.7);

/** Masts on L3's roof, thin: the board's antennas. */
const masts = (): Piece[] =>
  [
    { x: 400.5, z: 29, h: 7 },
    { x: 425.5, z: 28, h: 5 },
  ].flatMap((m) => [
    piece(box(m.x - 0.12, m.x + 0.12, m.z - 0.12, m.z + 0.12, L3_TOP, L3_TOP + m.h), "column", false),
    piece(box(m.x - 0.5, m.x + 0.5, m.z - 0.05, m.z + 0.05, L3_TOP + m.h - 1.2, L3_TOP + m.h - 0.4), "column", false, false),
  ]);

/** The passage's columns, from the ground to L2's underside. */
const columns = (): Piece[] => PASSAGE_COLUMNS.map((c) => piece(box(c.x - COLUMN / 2, c.x + COLUMN / 2, c.z - COLUMN / 2, c.z + COLUMN / 2, FOOT, L1_TOP - SOFFIT), "column", false));

/** Hedges along L2's and L3's south terraces, knee high, a step in from their edges. */
const hedges = (): Piece[] => [
  piece(box(L2_SLABS[0]!.minX + 1, L2_SLABS[0]!.maxX - 1, L2_SLABS[0]!.minZ + 0.3, L2_SLABS[0]!.minZ + 0.8, L2_TOP, L2_TOP + 0.6), "green", false),
  piece(box(L3.minX + 1, L3.maxX - 1, L3.maxZ - 0.8, L3.maxZ - 0.3, L3_TOP, L3_TOP + 0.6), "green", false),
];

/**
 * What of the front stands on T0, in plan: the wings, the green steps and the passage's columns. The
 * map's furniture keeps clear of them (`street-props.ts`), as of the game's blocks.
 */
export const FRONT_FOOTPRINTS: readonly Rect[] = [
  ...WEST_WING,
  EAST_WING,
  { minX: GREEN_STEPS[GREEN_STEPS.length - 1]!.x0, maxX: WEST_WING[0]!.minX, minZ: STEPS_Z.z0, maxZ: STEPS_Z.z1 },
  ...PASSAGE_COLUMNS.map((c) => ({ minX: c.x - COLUMN / 2, maxX: c.x + COLUMN / 2, minZ: c.z - COLUMN / 2, maxZ: c.z + COLUMN / 2 })),
];

/** Every piece of the front, drawn with the tiers (their mesh): L1's wings, L2 on its columns, L3 with its sign. */
export const frontPieces = (): Piece[] => [
  ...WEST_WING.flatMap((r) => storey(r, FOOT, L1_TOP)),
  ...greenSteps(),
  ...storey(EAST_WING, FOOT, L1_TOP),
  ...L2_SLABS.flatMap((r) => [piece(box(r.minX, r.maxX, r.minZ, r.maxZ, L1_TOP - SOFFIT, L1_TOP), "roof", false), ...storey(r, L1_TOP, L2_TOP)]),
  ...storey(L3, L2_TOP, L3_TOP),
  ...columns(),
  ...screens(),
  piece(FRONT_SIGN, "sign", false),
  ...masts(),
  ...hedges(),
];
