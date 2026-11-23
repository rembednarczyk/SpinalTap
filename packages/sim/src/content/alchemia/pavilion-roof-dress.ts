import { CLUTTER, type GroundPoint, type StreetPropItem, type Vec3, type ViewDescriptor, roomDetailShape } from "@seki/core";
import type { StaticProp } from "../builders";
import type { PrismDef } from "../../world/prism";
import { ALCHEMIA_PAVILION, PAVILION_CORNERS, PAVILION_LADDER, PAVILION_SIGN } from "./pavilion";
import { REN_SPOT } from "./market";

/*
 * The roof of the triangular pavilion dressed after its card (`docs/lokacje/alchemia-pawilon-dach.md`, ADR-0102): Ren's
 * camp of act II and what the roof has besides. Pattern: environmental storytelling (Smith and Worch, GDC 2010), the
 * one-page level of Librande (GDC 2010) whose first frame is the ladder's head. What happened here: Ren has just rigged a
 * new tarp because the old one leaked in the night; the can on his crate still sweats, the chip reader blinks green, the
 * rain of the night drips off the tarp's low corner into a bucket.
 *
 * - The camp: a mattress on two pallets along the sign's board, the ammunition crate he uses for a table with his lantern
 *   (the camp's light, §13's 30%), a thermos, cans, a tin of ends and the chip reader on it, a carton of his things, a
 *   rubbish bag; the tarp tied to the sign's board, to a mast with a dish clamped to the north-west attic and to a pole
 *   lashed to the east one (the engine draws the tarp from `PAVILION_TARP`), the bucket under its low corner.
 * - The roof's services: the kitchen's exhaust fan over the back-of-house box, the neon's sealed transformer at the
 *   sign's west post, the drain the membrane falls to with its puddle.
 * - The way up: the green bulkhead lamp over the ladder's foot and the service door (§13), the Hebi snake sprayed on the
 *   box beside the ladder, Ren's carabiner on its head, a market's flyer trodden flat by it.
 *
 * Blender's models (`tools/blender/rooms/alchemia_pavilion.py`) and the game's (`clutter`, ADR-0096), deterministic: every
 * place is a number here. Solid where somebody stops (§7): the bed, the crate, the carton, the mast, the pole, the fan,
 * the transformer; the small things drawn only. The way from the ladder's head to Ren and to the bag stays free.
 */

const R = ALCHEMIA_PAVILION.roof;
const [A, B, C] = PAVILION_CORNERS;

/** The point of the side from `p` to `q` (counter-clockwise) at z, moved `off` metres into the roof off the attic's inner face. */
const offAttic = (p: GroundPoint, q: GroundPoint, z: number, off: number): GroundPoint & { readonly yaw: number } => {
  const len = Math.hypot(q.x - p.x, q.z - p.z);
  const n = { x: -(q.z - p.z) / len, z: (q.x - p.x) / len };
  const x = p.x + ((q.x - p.x) * (z - p.z)) / (q.z - p.z);
  const d = ALCHEMIA_PAVILION.atticThick + off;
  return { x: x + n.x * d, z: z + n.z * d, yaw: Math.atan2(n.x, n.z) };
};

/** The mast on the north-west attic (the side from C to A), its brackets on its inner face, facing into the roof. */
export const PAVILION_MAST = offAttic(C, A, -2.15, 0.07);
/** The pole lashed to the east attic (the side from B to C). */
export const PAVILION_POLE = offAttic(B, C, -2.9, 0.1);

/** Heights over the roof where the tarp is tied: the board's top, the mast's knot, the pole's. */
const TIE = { board: 2.12, mast: 2.0, pole: 1.76 } as const;

/**
 * The tarp's corners (south-west, south-east, north-east, north-west): tied to the board's back near its top, to the pole
 * (its low corner, where the water runs off) and to the mast. Over Ren's place and the bag; above a standing head
 * where one walks under it (§7: drawn only).
 */
export const PAVILION_TARP: readonly [Vec3, Vec3, Vec3, Vec3] = [
  { x: 429.5, y: R + TIE.board, z: PAVILION_SIGN.z + PAVILION_SIGN.thick / 2 + 0.01 },
  { x: 431.45, y: R + TIE.board, z: PAVILION_SIGN.z + PAVILION_SIGN.thick / 2 + 0.01 },
  { x: PAVILION_POLE.x, y: R + TIE.pole, z: PAVILION_POLE.z },
  { x: PAVILION_MAST.x, y: R + TIE.mast, z: PAVILION_MAST.z },
];

/** The bed along the board: two pallets end to end under the mattress (2.4 x 0.8). */
export const REN_BED = { x: 430.5, z: -6.35, hx: 1.2, hz: 0.4, top: 0.36 } as const;
/** The ammunition crate he uses for a table, in front of him to his right as he looks to the Trybunał (0.7 x 0.4). */
export const REN_TABLE = { x: 431.05, z: -3.95, hx: 0.35, hz: 0.2, top: 0.42 } as const;
/** The carton of his things at the bed's east end, turned across it (0.63 x 0.79). */
const REN_CARTON = { x: 432.08, z: -5.55, hx: 0.315, hz: 0.395, top: 0.45 } as const;
/** The kitchen's exhaust fan on the back-of-house box (0.9 x 0.9, its windband 0.86 m high). */
export const PAVILION_EXTRACTOR = { x: 427.05, z: 0.15, h: 0.45, top: 0.86 } as const;
/** The neon's transformer behind the sign's west post. */
const NEON_BOX = { x: PAVILION_SIGN.posts[0] + 0.25, z: PAVILION_SIGN.z + 0.28, hx: 0.2, z0: -0.12, z1: 0.125, top: 0.5 } as const;
/** The bucket under the tarp's low corner, a hand off the pole's block. */
export const REN_BUCKET: GroundPoint = { x: 433.05, z: -3.1 };

/** The camp lantern's light (§13): in its diffuser on the crate's west end. */
export const PAVILION_CAMP_LAMP: Vec3 = { x: REN_TABLE.x - 0.2, y: R + REN_TABLE.top + 0.1, z: REN_TABLE.z + 0.04 };
/** The bulkhead lamp on the back-of-house box's west face, 0.55 m from its north-west corner, over the ladder's foot. */
const BULKHEAD = { x: PAVILION_LADDER.x + 0.4, y: ALCHEMIA_PAVILION.floor + 2.2, z: 0.45 } as const;
/** Its light, in its green lens a hand off the wall. */
export const PAVILION_NAV_LAMP: Vec3 = { x: BULKHEAD.x - 0.12, y: BULKHEAD.y + 0.08, z: BULKHEAD.z };

const WEST = -Math.PI / 2;
const item = (key: string, x: number, y: number, z: number, yaw: number): StreetPropItem => ({ prop: "room-detail", x, y, z, yaw, variant: roomDetailShape(key) });
const clutter = (variant: number, x: number, z: number, yaw: number): StreetPropItem => ({ prop: "clutter", x, y: R, z, yaw, variant });

/** The models on the roof, by the ladder and on the box, Blender's and the game's (ADR-0096), in the order of the card. */
export const PAVILION_ROOF_DETAIL: readonly StreetPropItem[] = [
  item("rd-ren-bed", REN_BED.x, R, REN_BED.z, 0),
  item("rd-ren-table", REN_TABLE.x, R, REN_TABLE.z, 0),
  item("rd-ren-mast", PAVILION_MAST.x, R, PAVILION_MAST.z, PAVILION_MAST.yaw),
  item("rd-ren-pole", PAVILION_POLE.x, R, PAVILION_POLE.z, PAVILION_POLE.yaw),
  item("rd-ren-bucket", REN_BUCKET.x, R, REN_BUCKET.z, 0),
  clutter(CLUTTER.boxes[1], REN_CARTON.x, REN_CARTON.z, Math.PI / 2),
  clutter(CLUTTER.bags[1], 432.9, -3.75, 0.8),
  item("rd-pav-extractor", PAVILION_EXTRACTOR.x, R, PAVILION_EXTRACTOR.z, 0),
  item("rd-pav-neon-box", NEON_BOX.x, R, NEON_BOX.z, 0),
  item("rd-c-drain", 432.3, R, -0.8, 0),
  item("rd-c-puddle", 432.05, R, -0.65, 0.4),
  item("rd-pav-bulkhead", BULKHEAD.x, BULKHEAD.y, BULKHEAD.z, WEST),
  item("rd-pav-hebi", PAVILION_LADDER.x + 0.4, 0.6, -2.5, WEST),
  item("rd-pav-carabiner", PAVILION_LADDER.x + 0.29, R + 0.35, PAVILION_LADDER.z + 0.28, WEST),
  item("rd-c-papers", PAVILION_LADDER.exit.x + 0.4, R, PAVILION_LADDER.z - 0.55, 0.6),
];

/** A rectangle round (x, z), counter-clockwise on the map. */
const rect = (x: number, z: number, hx: number, hz: number): GroundPoint[] => [
  { x: x - hx, z: z - hz },
  { x: x + hx, z: z - hz },
  { x: x + hx, z: z + hz },
  { x: x - hx, z: z + hz },
];

/** A rectangle of a model's own axes (hx along its x, hz along its z) turned to `yaw`, counter-clockwise on the map. */
const turned = (c: GroundPoint, yaw: number, hx: number, hz: number): GroundPoint[] => {
  const [cs, sn] = [Math.cos(yaw), Math.sin(yaw)];
  const at = (x: number, z: number): GroundPoint => ({ x: c.x + x * cs + z * sn, z: c.z - x * sn + z * cs });
  // A turn, no mirror: the order keeps its sense.
  return [at(-hx, -hz), at(hx, -hz), at(hx, hz), at(-hx, hz)];
};

const CENTRE: Vec3 = { x: REN_SPOT.x, y: R, z: REN_SPOT.z };
const prism = (pts: readonly GroundPoint[], top: number): PrismDef => ({ points: pts.map((p) => ({ x: p.x - CENTRE.x, z: p.z - CENTRE.z })), bottom: -0.05, top });

/** Seen nowhere as an entity: Blender's models are the scenery's (`PAVILION_ROOF_DETAIL`). */
const NO_VIEW: ViewDescriptor = { kind: "street-props", items: [] };

/** The camp's and the roof's solids, one prop (`scenery`): the bed, the crate, the carton, the mast, the pole and its block, the fan, the transformer. */
export const PAVILION_ROOF_PROP: StaticProp = {
  center: CENTRE,
  view: NO_VIEW,
  solid: true,
  scenery: true,
  prisms: [
    prism(rect(REN_BED.x, REN_BED.z, REN_BED.hx, REN_BED.hz), REN_BED.top),
    prism(rect(REN_TABLE.x, REN_TABLE.z, REN_TABLE.hx, REN_TABLE.hz), REN_TABLE.top),
    prism(rect(REN_CARTON.x, REN_CARTON.z, REN_CARTON.hx, REN_CARTON.hz), REN_CARTON.top),
    prism(rect(PAVILION_MAST.x, PAVILION_MAST.z, 0.035, 0.035), 2.08),
    prism(turned(PAVILION_POLE, PAVILION_POLE.yaw, 0.195, 0.095), 0.19),
    prism(rect(PAVILION_POLE.x, PAVILION_POLE.z, 0.03, 0.03), 1.8),
    prism(rect(PAVILION_EXTRACTOR.x, PAVILION_EXTRACTOR.z, PAVILION_EXTRACTOR.h, PAVILION_EXTRACTOR.h), PAVILION_EXTRACTOR.top),
    prism([
      { x: NEON_BOX.x - NEON_BOX.hx, z: NEON_BOX.z + NEON_BOX.z0 },
      { x: NEON_BOX.x + NEON_BOX.hx, z: NEON_BOX.z + NEON_BOX.z0 },
      { x: NEON_BOX.x + NEON_BOX.hx, z: NEON_BOX.z + NEON_BOX.z1 },
      { x: NEON_BOX.x - NEON_BOX.hx, z: NEON_BOX.z + NEON_BOX.z1 },
    ], NEON_BOX.top),
  ],
};

/** The roof's solids among Alchemia's props: the last of them (23.11), so every id before stays. */
export const PAVILION_ROOF_PROPS: readonly StaticProp[] = [PAVILION_ROOF_PROP];
