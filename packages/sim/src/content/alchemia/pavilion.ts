import type { GroundPoint, Vec3, ViewDescriptor } from "@seki/core";
import type { LadderDef } from "../../world/components";
import type { PrismDef } from "../../world/prism";
import { type Rect, type StaticProp, ladderParts } from "../builders";
import { groundY } from "../lublin/terrain";
import { EAST } from "./plan";

/**
 * The triangular glass pavilion (ADR-0074 §1, stage 3) on the corner of Bajkowskiego and
 * Lubartowska, where the MPK ticket booths stood (S1, S7, S13): in the notch the car park w173531008
 * leaves at the corner, one storey on the ground of the corner (its T0), glass on a steel frame,
 * a flat roof behind an attic that gives cover, the neon ALCHEMIA on the roof (a proper name, no
 * i18n). Background with a restaurant behind the glass, no inside (decision of 6.11). Ren sleeps on
 * its roof; up to it a service ladder on the back-of-house box towards the car park (ADR-0021).
 *
 * The triangle's sides follow the streets: the south one Bajkowskiego's sidewalk w232464426, the
 * east one Lubartowska's w749050539, each a hand's breadth off its paving (0.4..0.8 m); the third
 * looks north-west over the car park. The ground under it is the NMT's, -0.82..-0.30 (no pad): the
 * floor stands a step over its highest point, a plinth on the low side.
 */

/** The triangle's corners: on Bajkowskiego to the west, at the corner of the streets, on Lubartowska to the north. */
export const PAVILION_CORNERS: readonly [GroundPoint, GroundPoint, GroundPoint] = [
  { x: 420.5, z: -8.85 },
  { x: 432.3, z: -8.2 },
  { x: 436.2, z: 6.0 },
];

/** The back-of-house box on the north-west side, towards the car park: the ladder hangs on its west face. */
export const PAVILION_ANNEX: Rect = { minX: 424.5, maxX: 428.5, minZ: -3.5, maxZ: 0 };

/**
 * Its levels: the plinth's foot in the ground, the floor (0.15 m over the highest ground under it),
 * the roof (a storey of 4 m), the dark fascia under the roof's edge, the attic round the roof.
 * Floor to the attic's top: 5 m.
 */
export const ALCHEMIA_PAVILION = { base: -1.1, floor: -0.15, roof: 3.85, fascia: 0.6, attic: 1.0, atticThick: 0.25 } as const;

const [A, B, C] = PAVILION_CORNERS;

/** Where the north-west side (A to C) crosses the line z (or x). */
const acAtZ = (z: number): GroundPoint => ({ x: A.x + ((C.x - A.x) * (z - A.z)) / (C.z - A.z), z });
const acAtX = (x: number): GroundPoint => ({ x, z: A.z + ((C.z - A.z) * (x - A.x)) / (C.x - A.x) });

/**
 * The roof's outline, counter-clockwise on the map: the triangle with the annex standing out of
 * its north-west side (where that side enters the annex's south face and leaves its east one).
 */
export const PAVILION_OUTLINE: readonly GroundPoint[] = [
  A,
  B,
  C,
  acAtX(PAVILION_ANNEX.maxX),
  { x: PAVILION_ANNEX.maxX, z: PAVILION_ANNEX.maxZ },
  { x: PAVILION_ANNEX.minX, z: PAVILION_ANNEX.maxZ },
  { x: PAVILION_ANNEX.minX, z: PAVILION_ANNEX.minZ },
  acAtZ(PAVILION_ANNEX.minZ),
];

/** The ladder (ADR-0021): its foot 0.4 m off the annex's west face, in the middle of it, the climber facing east. */
const LADDER_Z = (PAVILION_ANNEX.minZ + PAVILION_ANNEX.maxZ) / 2;
const LADDER_FOOT: GroundPoint = { x: PAVILION_ANNEX.minX - 0.4, z: LADDER_Z };
export const PAVILION_LADDER: LadderDef = {
  key: "alchemia-pavilion",
  x: LADDER_FOOT.x,
  z: LADDER_FOOT.z,
  yaw: EAST,
  bottom: groundY(LADDER_FOOT.x, LADDER_FOOT.z),
  top: ALCHEMIA_PAVILION.roof,
  exit: { x: PAVILION_ANNEX.minX + 0.7, y: ALCHEMIA_PAVILION.roof, z: LADDER_Z },
};
/** The attic is open this far either side of the ladder, so the climber steps off onto the roof. */
const LADDER_GAP = 0.65;

/**
 * A wall of the attic along the outline from `a` to `b`, standing inside it: its inner face from
 * `a2` to `b2`, mitred at the outline's corners, square to the side at the ladder's gap.
 */
export interface AtticWall {
  readonly a: GroundPoint;
  readonly b: GroundPoint;
  readonly a2: GroundPoint;
  readonly b2: GroundPoint;
}

/** The inward unit normal of the way from `a` to `b`: left of it (the outline is counter-clockwise). */
const inwardOf = (a: GroundPoint, b: GroundPoint): GroundPoint => {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  return { x: -(b.z - a.z) / len, z: (b.x - a.x) / len };
};

const ring = (i: number): GroundPoint => PAVILION_OUTLINE[(i + PAVILION_OUTLINE.length) % PAVILION_OUTLINE.length]!;

/** The outline's corner `i` moved a wall's thickness in along both its sides (a mitre). */
const mitre = (i: number): GroundPoint => {
  const n1 = inwardOf(ring(i - 1), ring(i));
  const n2 = inwardOf(ring(i), ring(i + 1));
  const k = ALCHEMIA_PAVILION.atticThick / (1 + n1.x * n2.x + n1.z * n2.z);
  return { x: ring(i).x + (n1.x + n2.x) * k, z: ring(i).z + (n1.z + n2.z) * k };
};

const square = (p: GroundPoint, n: GroundPoint): GroundPoint => ({ x: p.x + n.x * ALCHEMIA_PAVILION.atticThick, z: p.z + n.z * ALCHEMIA_PAVILION.atticThick });

/** The attic round the roof along every side of the outline, open at the ladder's head. */
export const PAVILION_ATTIC: readonly AtticWall[] = PAVILION_OUTLINE.flatMap((a, i): AtticWall[] => {
  const b = ring(i + 1);
  const [a2, b2] = [mitre(i), mitre(i + 1)];
  const ladderSide = a.x === PAVILION_ANNEX.minX && b.x === PAVILION_ANNEX.minX;
  if (!ladderSide) return [{ a, b, a2, b2 }];
  // The west face runs south (a at its north end): the attic either side of the gap.
  const n = inwardOf(a, b);
  const gapN = { x: a.x, z: LADDER_Z + LADDER_GAP };
  const gapS = { x: a.x, z: LADDER_Z - LADDER_GAP };
  return [
    { a, b: gapN, a2, b2: square(gapN, n) },
    { a: gapS, b, a2: square(gapS, n), b2 },
  ];
});

/** A wall's inward unit normal. */
export const atticInward = (w: AtticWall): GroundPoint => inwardOf(w.a, w.b);

/** The neon ALCHEMIA (a proper name) on a board on two posts over the roof, along the south side, read from Bajkowskiego and from T0. */
export const PAVILION_SIGN = { x0: 425.3, x1: 431.5, z: -7.0, thick: 0.12, bottom: ALCHEMIA_PAVILION.roof + 1.0, top: ALCHEMIA_PAVILION.roof + 2.2, posts: [425.6, 431.2], post: 0.12 } as const;

/** A point on the pavilion's roof. */
export const onPavilionRoof = (x: number, z: number): Vec3 => ({ x, y: ALCHEMIA_PAVILION.roof, z });

/** The middle of the triangle: for drawing distances and the far stand-in's block. */
export const PAVILION_CENTRE: GroundPoint = { x: (A.x + B.x + C.x) / 3, z: (A.z + B.z + C.z) / 3 };

/** Seen nowhere as an entity: the engine draws the pavilion (`renderer/alchemia/pavilion-geometry.ts`). */
const NO_VIEW: ViewDescriptor = { kind: "street-props", items: [] };

const rel = (p: GroundPoint): GroundPoint => ({ x: p.x - PAVILION_CENTRE.x, z: p.z - PAVILION_CENTRE.z });
const rect = (r: Rect): GroundPoint[] => [
  { x: r.minX, z: r.minZ },
  { x: r.maxX, z: r.minZ },
  { x: r.maxX, z: r.maxZ },
  { x: r.minX, z: r.maxZ },
];

/** A prism of world corners between world heights, relative to the solid's centre (its foot at the plinth's). */
const prism = (pts: readonly GroundPoint[], y0: number, y1: number): PrismDef => ({ points: pts.map(rel), bottom: y0 - ALCHEMIA_PAVILION.base, top: y1 - ALCHEMIA_PAVILION.base });

/** An attic wall as its convex footprint: the side and its inner face. */
export const atticFootprint = (w: AtticWall): GroundPoint[] => [w.a, w.b, w.b2, w.a2];

const S = PAVILION_SIGN;
const top = ALCHEMIA_PAVILION.roof;

/** The pavilion's solids: the triangle, the annex, the attic, the sign's posts and board. */
const PAVILION_SOLID: StaticProp = {
  center: { x: PAVILION_CENTRE.x, y: ALCHEMIA_PAVILION.base, z: PAVILION_CENTRE.z },
  view: NO_VIEW,
  solid: true,
  scenery: true,
  prisms: [
    prism(PAVILION_CORNERS, ALCHEMIA_PAVILION.base, top),
    prism(rect(PAVILION_ANNEX), ALCHEMIA_PAVILION.base, top),
    ...PAVILION_ATTIC.map((w) => prism(atticFootprint(w), top, top + ALCHEMIA_PAVILION.attic)),
    ...S.posts.map((x) => prism(rect({ minX: x - S.post / 2, maxX: x + S.post / 2, minZ: S.z - S.post / 2, maxZ: S.z + S.post / 2 }), top, S.bottom)),
    prism(rect({ minX: S.x0, maxX: S.x1, minZ: S.z - S.thick / 2, maxZ: S.z + S.thick / 2 }), S.bottom, S.top),
  ],
};

/**
 * The pavilion in the world: its solid, then the ladder (its rails drawn with the pavilion by the
 * engine, so no entity of its own is drawn: `scenery`) and its two grab points.
 */
export const PAVILION_PROPS: readonly StaticProp[] = [PAVILION_SOLID, ...ladderParts(PAVILION_LADDER).map((p): StaticProp => (p.mechanism?.kind === "ladder" ? { ...p, scenery: true } : p))];
