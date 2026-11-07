import { ALCHEMIA_PIECES, ARKADY_CENTRE, ARKADY_FRAME, ARKADY_PIECES, type AlchemiaPiece, type AlchemiaPieceKind, FOODHALL, FOODHALL_INNER, arkadyPoint } from "@seki/sim";
import type { Box2 } from "../mapcity/polygon";
import { DRESS_FLAG, type MeshSink, type Rgba, hexColor } from "../mesh-sink";

/**
 * Alchemia's food hall as the street furniture's block meshes draw it (ADR-0074 stage 1, no draw
 * call of its own, as the metro's pavilions): its shell, roof and front a hand's breadth inside
 * the boxes of the detailed mesh (`AlchemiaView`), and the floor under it. The ground under the
 * hall is cut out of the terrain for good (`ALCHEMIA_CUTS`); the detailed mesh is drawn only near
 * it, so from afar this stand-in closes the hole. Near, the detailed boxes hide it: every face of
 * it lies inside theirs.
 */

/** How far inside the detailed boxes the stand-in's faces lie. */
const INSET = 0.03;

const COLORS: Partial<Readonly<Record<AlchemiaPieceKind, Rgba>>> = {
  wall: hexColor("#3a3d4c"),
  roof: hexColor("#2f3a33"),
  parapet: hexColor("#5a6170"),
  frame: hexColor("#15171c"),
};
/** The front's glass, lit warm as the detailed one (`win-warm` up to the doors' heads). */
const WARM: Rgba = hexColor("#c99662", DRESS_FLAG.lit);
const GREEN: Rgba = hexColor("#1f4a3a");
const FLOOR: Rgba = hexColor("#5a6170");

/** What of the hall stands in from afar: the outside's solid pieces on its outline but the steps on the ramp (not T2's, low and near). */
const standIn = (pieces: readonly AlchemiaPiece[]): AlchemiaPiece[] =>
  pieces.filter((p) => p.solid && !p.inside && p.kind !== "step" && p.box.x0 >= FOODHALL.minX - 0.2 && p.box.x1 <= FOODHALL.maxX + 0.2 && p.box.z0 >= FOODHALL.minZ - 0.2 && p.box.z1 <= FOODHALL.maxZ + 0.2);

const colorOf = (p: AlchemiaPiece): Rgba => {
  const b = p.box;
  if (p.kind === "glass") return WARM;
  if (p.kind === "roof" && (b.x1 - b.x0) * (b.z1 - b.z0) > 100) return GREEN;
  return COLORS[p.kind] ?? COLORS.wall!;
};

/** Bakes the stand-in into a block's sink. */
export const bakeAlchemiaStandIn = (sink: MeshSink, pieces: readonly AlchemiaPiece[] = ALCHEMIA_PIECES): void => {
  for (const p of standIn(pieces)) {
    const b = p.box;
    const w = b.x1 - b.x0 - 2 * INSET;
    const h = b.y1 - b.y0 - 2 * INSET;
    const d = b.z1 - b.z0 - 2 * INSET;
    if (w <= 0 || h <= 0 || d <= 0) continue;
    sink.box({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, z: (b.z0 + b.z1) / 2 }, w, h, d, colorOf(p));
  }
  const I = FOODHALL_INNER;
  sink.box({ x: (I.minX + I.maxX) / 2, y: FOODHALL.floor - 0.05, z: (I.minZ + I.maxZ) / 2 }, I.maxX - I.minX, 0.04, I.maxZ - I.minZ, FLOOR);
};

/** True when the hall's middle stands in a block of the street furniture. */
export const alchemiaIn = (bounds: Box2): boolean => {
  const x = (FOODHALL.minX + FOODHALL.maxX) / 2;
  const z = (FOODHALL.minZ + FOODHALL.maxZ) / 2;
  return x >= bounds.minX && x < bounds.maxX && z >= bounds.minZ && z < bounds.maxZ;
};

/** The Arkady's plaster, brick and paving from afar (`arkady-geometry.ts`'s swatches, near enough). */
const ARKADY_COLORS: Partial<Readonly<Record<AlchemiaPieceKind, Rgba>>> = {
  wall: hexColor("#9a9fa8"),
  step: hexColor("#5a6170"),
  parapet: hexColor("#3a3f4b"),
  roof: hexColor("#30343e"),
};
const BRICK: Rgba = hexColor("#6a4038");
/** The kit's box turned to the Arkady's frame: its local x along the building. */
const ARKADY_ROT = Math.atan2(-ARKADY_FRAME.along.z, ARKADY_FRAME.along.x);

/**
 * The Arkady (ADR-0074 stage 2) as the hall's stand-in is: their solid pieces (walls, arches,
 * roof, attic, the arcade's floor and the pavements over the dip by them) a hand's breadth inside
 * the detailed boxes, in the block holding their middle. The map's ruin gave way to them, so
 * without it they would be a hole from afar.
 */
export const bakeArkadyStandIn = (sink: MeshSink, pieces: readonly AlchemiaPiece[] = ARKADY_PIECES): void => {
  for (const p of pieces) {
    if (!p.solid) continue;
    const b = p.box;
    const w = b.x1 - b.x0 - 2 * INSET;
    const h = b.y1 - b.y0 - 2 * INSET;
    const d = b.z1 - b.z0 - 2 * INSET;
    if (w <= 0 || h <= 0 || d <= 0) continue;
    const c = arkadyPoint((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
    const brick = p.kind === "wall" && b.z1 - b.z0 < 0.8 && b.y1 < -5.6;
    sink.box({ x: c.x, y: (b.y0 + b.y1) / 2, z: c.z }, w, h, d, brick ? BRICK : (ARKADY_COLORS[p.kind] ?? ARKADY_COLORS.wall!), { rotY: ARKADY_ROT });
  }
};

/** True when the Arkady's middle stands in a block of the street furniture. */
export const arkadyIn = (bounds: Box2): boolean => ARKADY_CENTRE.x >= bounds.minX && ARKADY_CENTRE.x < bounds.maxX && ARKADY_CENTRE.z >= bounds.minZ && ARKADY_CENTRE.z < bounds.maxZ;
