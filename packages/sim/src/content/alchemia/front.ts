import type { Rect } from "../builders";
import { P1_RAMP, P1_STAIR } from "./parking";
import { PARAPET, type Box, type Piece, box, outlined, piece } from "./plan";
import { type Rectangle, balustrade, outerCorners, roundedOutline } from "./rounded";
import { FRONT_OVERHANG, MALL, MALL_LEVELS } from "./mall-plan";
import { slabOf, storey as tierStorey } from "./storey";
import { ARCADE_FOOTPRINTS, ARCADE_FRONT, ARCADE_WALK, arcadeFrontPieces } from "./arcade-front";
import { FOUNTAIN, PLAZA_FLOOR } from "./front-plaza";
import { PLAZA_FOOTPRINTS, PLAZA_KIOSKS } from "./front-plaza-cafe";

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
 * Every roof lies on a floor of the gallery behind (ADR-0093 O1: L1 on P2's level, L2 on P3's, L3 on
 * its roof), every slab has its strip of light. They are scenery, solid boxes of lit glass, standing
 * against the gallery's south face.
 */

/** The storeys' roofs: L1 on the gallery's P2, L2 on its P3, L3 on its roof. */
export const L1_TOP = MALL_LEVELS.p2;
export const L2_TOP = MALL_LEVELS.p3;
export const L3_TOP = MALL_LEVELS.roof;
/** A slab's overhang past the glass (the tiers' storeys'). */
const OVER = 0.3;

/** L1's west wing: by Bajkowskiego as deep as the car park's slanted west edge allows, narrower to the north. */
export const WEST_WING: readonly Rect[] = [
  // Its front behind the house with arcades' walk (C3): its lit shops under the arches.
  { minX: 394, maxX: 404, minZ: ARCADE_FRONT.minZ + ARCADE_WALK, maxZ: 14 },
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
 * The green steps drawn as the board's slope (C2, 19.11): from L1's roof edge down to the lowest
 * step's top at its foot, along their z span. The simulation keeps its three steps.
 */
export const GREEN_SLOPE = { x0: GREEN_STEPS[GREEN_STEPS.length - 1]!.x0, x1: WEST_WING[0]!.minX, z0: STEPS_Z.z0, z1: STEPS_Z.z1, top: L1_TOP, foot: GREEN_STEPS[GREEN_STEPS.length - 1]!.top } as const;

/**
 * L1's east wing: north of the triangular pavilion, south of metro B's (its eaves clear), east of P-1's
 * stair house, which stands against its west face (ADR-0093 O2b: the house moved off the main
 * entrance's way, the wing gave it 3.7 m; it began at x 424 before); the walk from the stair house's
 * door east to Lubartowska passes south of it.
 */
export const EAST_WING: Rect = { minX: P1_STAIR.maxX, maxX: 436, minZ: 13.5, maxZ: 22.5 };

/** L2: over the west wing and the passage, east of x 422 only over the east wing and on (the walk from the stair house to Lubartowska open to the sky). */
export const L2_SLABS: readonly Rect[] = [
  { minX: 394, maxX: 422, minZ: 4, maxZ: 32 },
  { minX: 422, maxX: 436, minZ: EAST_WING.minZ, maxZ: 32 },
];
/**
 * L3: the top storey, set back from L2's front by a terrace, on north over T0's back strip to the
 * gallery's south face (ADR-0093 O1; B3 took it on to tier B's edge, z 38), whose roof it meets on
 * its level. North of the hall T1 is the hall's front and T2 the square with the memorial of Plac
 * Ofiar Getta (§6: no neon, no adverts by it), so the complex grows no wing there.
 */
export const L3: Rect = { minX: 398, maxX: 428, minZ: 12, maxZ: MALL.z0 };

/** L2's underside over the passage: a slab this thick under its glass. */
const SOFFIT = 0.35;
/** A column of the passage: its side. */
const COLUMN = 0.6;
/**
 * The passage's columns under L2, clear of the ramp's trench and its parapets, the stair house and
 * metro B's pavilion: on P-1's roof where the ramp runs covered (z over 11) and by the walls. The two
 * east of the ramp stand along its east wall (ADR-0093 O2b), on the main entrance's way's west edge;
 * at x 422.6 (z 9.5 and 24.5) they stood in its middle.
 */
export const PASSAGE_COLUMNS: readonly { readonly x: number; readonly z: number }[] = [
  { x: 405.2, z: 5.5 },
  { x: 405.2, z: 15 },
  { x: 405.2, z: 24.5 },
  { x: P1_RAMP.minX + 4, z: 15 },
  { x: P1_RAMP.minX + 4, z: 24.5 },
  { x: P1_RAMP.maxX + 0.6, z: P1_RAMP.covered + 0.8 },
  { x: P1_RAMP.maxX + 0.6, z: 24.5 },
  { x: 434.6, z: 24.5 },
];

/** L1's storeys: the wings, their joints square. */
export const L1_LEVEL: readonly Rect[] = [...WEST_WING, EAST_WING];

const rectOf = (r: Rect): Rectangle => ({ x0: r.minX, x1: r.maxX, z0: r.minZ, z1: r.maxZ });
/** The gallery behind as a neighbour of L2 and L3 (ADR-0093 O1): their corners against its south face are joints, square. */
const GALLERY_FACE: Rectangle = { ...MALL, z0: MALL.z0 - FRONT_OVERHANG };
const withGallery = (level: readonly Rect[]): Rectangle[] => [...level.map(rectOf), GALLERY_FACE];

/** L2's underside over the passage, under its glass's rounded outline. */
const soffit = (r: Rect): Piece => outlined(roundedOutline(slabOf(r), -OVER, outerCorners(rectOf(r), withGallery(L2_SLABS))), L1_TOP - SOFFIT, L1_TOP, "roof");

/**
 * A storey of a level whose storeys are `level`: its glass from `bottom` up to the slab, the slab
 * with its overhang, the light along it, the outer corners rounded (19.11) as the tiers' are.
 */
const storey = (r: Rect, bottom: number, top: number, level: readonly Rect[] = [r]): Piece[] => tierStorey(r, bottom, top, outerCorners(rectOf(r), withGallery(level)));

/**
 * The balustrade round a storey's roof, drawn only (nobody walks the front's roofs), open where the
 * green steps go down off L1 to the west.
 */
const roofRail = (r: Rect, top: number, level: readonly Rect[] = [r]): Piece[] =>
  balustrade(slabOf(r), -0.05, outerCorners(rectOf(r), withGallery(level)), top, PARAPET, false, [
    { x0: GREEN_STEPS[0]!.x0 - 1, x1: WEST_WING[0]!.minX + 0.5, z0: STEPS_Z.z0 - 0.5, z1: STEPS_Z.z1 },
    // Along the gallery's south face: its roof's own balustrade stands there (ADR-0093 O1).
    { x0: MALL.x0 - 0.5, x1: MALL.x1 + 0.5, z0: MALL.z0 - 0.5, z1: MALL.z0 + 0.5 },
    // L2's terrace goes on over the house with arcades' roof (C3): no balustrade between them.
    { x0: ARCADE_FRONT.minX - 0.5, x1: ARCADE_FRONT.maxX + 0.5, z0: ARCADE_FRONT.maxZ - 1, z1: ARCADE_FRONT.maxZ + 0.6 },
  ]);

/** The balustrade round the house with arcades' roof, on its three open sides (C3). */
const arcadeRail = (): Piece[] => {
  const A = ARCADE_FRONT;
  return balustrade({ x0: A.minX - 0.1, x1: A.maxX + 0.1, z0: A.minZ - 0.1, z1: A.maxZ }, -0.05, [false, false, false, false], A.top, PARAPET, false, [
    { x0: A.minX - 1, x1: A.maxX + 1, z0: A.maxZ - 0.5, z1: A.maxZ + 1 },
  ]);
};

/** The ground under a wing, a little under its lowest corner: the glass stands in the terrain, not over it. */
const FOOT = -3;

/** The west wing's green steps, each with its strip of light along its edge to the west, as on the board. */
const greenSteps = (): Piece[] =>
  GREEN_STEPS.flatMap((s) => [
    // Planted all over, as the board's green slope down to the street (stage 8: pale walls read from Bajkowskiego as boxes).
    piece(box(s.x0, s.x1, STEPS_Z.z0, STEPS_Z.z1, FOOT, s.top - 0.05), "green", false),
    piece(box(s.x0, s.x1, STEPS_Z.z0, STEPS_Z.z1, s.top - 0.05, s.top), "lawn", false, false),
    piece(box(s.x0 - 0.04, s.x0, STEPS_Z.z0 - 0.04, STEPS_Z.z1 + 0.04, s.top - 0.14, s.top - 0.06), "led", false, false),
    piece(box(s.x0, s.x1, STEPS_Z.z0 - 0.04, STEPS_Z.z0, s.top - 0.14, s.top - 0.06), "led", false, false),
  ]);

/** The screens on the west wing's front and on L2's south face over the passage. */
const screens = (): Piece[] => [
  piece(box(EAST_WING.minX + 1, 435, EAST_WING.minZ - 0.06, EAST_WING.minZ, -0.4, 1.7), "screen", false, false),
  // On L2's south face over the ramp's mouth, east of the house with arcades (C3).
  piece(box(ARCADE_FRONT.maxX + 2, ARCADE_FRONT.maxX + 10, L2_SLABS[0]!.minZ - 0.06, L2_SLABS[0]!.minZ, L1_TOP + 0.5, L2_TOP - 0.8), "screen", false, false),
];

/**
 * The sign on L3's south face over the passage (C4, the board's lightbox): its box, the letters are
 * the engine's (proper name). In front of the slab's edge, its top a metre over the roof's: seen
 * from the square over L2's terrace and its hedge, whose line of sight meets the face some 8.8 m up
 * (under its foot until C4 the sign showed only the top of ALCHEMIA). Drawn only, nobody reaches it.
 */
export const FRONT_SIGN: Box = box(403, 423, L3.minZ - OVER - 0.55, L3.minZ - OVER - 0.15, L2_TOP + 1.9, L3_TOP + 1.0);

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

/** The round fountain and the kiosks on the square before the front (B4, rebuilt to the board in C5): `front-plaza.ts`, `front-plaza-cafe.ts`. */
export { FOUNTAIN } from "./front-plaza";
/** The kiosks' outlines. */
export const FRONT_KIOSKS: readonly Rect[] = PLAZA_KIOSKS.map((k) => k.rect);

/**
 * What of the front stands on T0, in plan: the wings, the green steps and the passage's columns. The
 * map's furniture keeps clear of them (`street-props.ts`), as of the game's blocks.
 */
export const FRONT_FOOTPRINTS: readonly Rect[] = [
  ...WEST_WING,
  EAST_WING,
  { minX: GREEN_STEPS[GREEN_STEPS.length - 1]!.x0, maxX: WEST_WING[0]!.minX, minZ: STEPS_Z.z0, maxZ: STEPS_Z.z1 },
  ...PASSAGE_COLUMNS.map((c) => ({ minX: c.x - COLUMN / 2, maxX: c.x + COLUMN / 2, minZ: c.z - COLUMN / 2, maxZ: c.z + COLUMN / 2 })),
  ...ARCADE_FOOTPRINTS,
  // The square before it (C5): its podium with the stairs round it, the fountain on it, the kiosks and the café's tables.
  PLAZA_FLOOR,
  FOUNTAIN,
  ...PLAZA_FOOTPRINTS,
];

/** Every piece of the front, drawn with the tiers (their mesh): L1's wings, L2 on its columns, L3 with its sign. */
export const frontPieces = (): Piece[] => [
  // The west wing's roof is under the house with arcades and L2 all over: no balustrade.
  ...WEST_WING.flatMap((r) => storey(r, FOOT, L1_TOP, L1_LEVEL)),
  ...greenSteps(),
  ...storey(EAST_WING, FOOT, L1_TOP, L1_LEVEL),
  ...roofRail(EAST_WING, L1_TOP, L1_LEVEL),
  ...L2_SLABS.flatMap((r) => [soffit(r), ...storey(r, L1_TOP, L2_TOP, L2_SLABS), ...roofRail(r, L2_TOP, L2_SLABS)]),
  ...storey(L3, L2_TOP, L3_TOP),
  ...roofRail(L3, L3_TOP),
  ...columns(),
  ...screens(),
  piece(FRONT_SIGN, "sign", false, false),
  ...masts(),
  ...hedges(),
  ...arcadeFrontPieces(),
  ...arcadeRail(),
];
