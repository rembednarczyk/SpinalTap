import { P1_PIECES, P1_RAMP, P1_RAMP_CUT, type AlchemiaPiece, p1RampY } from "@seki/sim";
import type { Box2 } from "../mapcity/polygon";
import { type MeshSink, type Rgba, hexColor } from "../mesh-sink";

/**
 * What shows of P-1 from the car park (ADR-0074 stage 4) as the street furniture's block meshes
 * draw it, no draw call of its own, like the food hall's stand-in: the ramp's trench is cut out of
 * the terrain for good and Alchemia's outside mesh is drawn only within `ALCHEMIA_DRAW`, so from
 * afar its parapets, a dark floor under them and the stair core's house close the hole, a few
 * centimetres inside the detailed boxes.
 */

const INSET = 0.03;
const WALL: Rgba = hexColor("#3a3d4c");
const TRIM: Rgba = hexColor("#5a6170");
const FLOOR: Rgba = hexColor("#23262e");

/** The outside's solid pieces: the trench's parapets and portal, the stair house. */
const standIn = (pieces: readonly AlchemiaPiece[]): AlchemiaPiece[] => pieces.filter((p) => p.solid && !p.inside);

/** Bakes the stand-in into a block's sink. */
export const bakeParkingStandIn = (sink: MeshSink, pieces: readonly AlchemiaPiece[] = P1_PIECES): void => {
  for (const p of standIn(pieces)) {
    const b = p.box;
    const w = b.x1 - b.x0 - 2 * INSET;
    const h = b.y1 - b.y0 - 2 * INSET;
    const d = b.z1 - b.z0 - 2 * INSET;
    if (w <= 0 || h <= 0 || d <= 0) continue;
    sink.box({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, z: (b.z0 + b.z1) / 2 }, w, h, d, p.kind === "parapet" ? TRIM : WALL);
  }
  // The trench's floor, dark, level under the lowest of the detailed sloped surface in it.
  const c = P1_RAMP_CUT.bounds;
  const top = p1RampY(P1_RAMP.covered) - 0.05;
  sink.box({ x: (P1_RAMP.minX + P1_RAMP.maxX) / 2, y: (P1_RAMP_CUT.floor + top) / 2, z: (c.minZ + c.maxZ) / 2 }, P1_RAMP.maxX - P1_RAMP.minX - 2 * INSET, top - P1_RAMP_CUT.floor, c.maxZ - c.minZ - 2 * INSET, FLOOR);
};

/** True when the trench's middle stands in a block of the street furniture. */
export const parkingIn = (bounds: Box2): boolean => {
  const c = P1_RAMP_CUT.bounds;
  const x = (c.minX + c.maxX) / 2;
  const z = (c.minZ + c.maxZ) / 2;
  return x >= bounds.minX && x < bounds.maxX && z >= bounds.minZ && z < bounds.maxZ;
};
