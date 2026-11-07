import { ALCHEMIA_PIECES, type AlchemiaPiece, type AlchemiaPieceKind, FOODHALL, FOODHALL_INNER } from "@seki/sim";
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

/** What of the hall stands in from afar: the outside's solid pieces but the steps on the ramp. */
const standIn = (pieces: readonly AlchemiaPiece[]): AlchemiaPiece[] => pieces.filter((p) => p.solid && !p.inside && p.kind !== "step");

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
