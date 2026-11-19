import { P2, P2_CUTTING, P2_CUTTING_PIECES, type AlchemiaPiece } from "@seki/sim";
import type { Box2 } from "../mapcity/polygon";
import { type MeshSink, type Rgba, hexColor } from "../mesh-sink";
import { RAILING, isRailed } from "./p2-geometry";

/**
 * What shows of P-2 from afar (ADR-0074 stage 5a) as the street furniture's block meshes draw it,
 * no draw call of its own, as P-1's trench (`parking-far.ts`): the cutting is cut out of the terrain
 * for good and Alchemia's outside mesh is drawn only within `ALCHEMIA_DRAW`, so beyond it the
 * cutting's walls, the portal's parapet and a dark floor close the hole, a few centimetres inside
 * the detailed boxes.
 */

const INSET = 0.03;
const TRIM: Rgba = hexColor("#5a6170");
const RAIL: Rgba = hexColor("#596070");
const FLOOR: Rgba = hexColor("#23262e");

/** Bakes the stand-in into a block's sink. */
export const bakeP2StandIn = (sink: MeshSink, pieces: readonly AlchemiaPiece[] = P2_CUTTING_PIECES): void => {
  for (const p of pieces.filter((q) => q.solid)) {
    // A railed wall (B4): the stand-in stands near too, in its block, so only its wall up to the slope and a top rail.
    const railed = p.kind === "parapet" && isRailed(p.box);
    const b = railed ? { ...p.box, y1: p.box.y1 - RAILING } : p.box;
    if (railed) {
      const alongZ = b.z1 - b.z0 > b.x1 - b.x0;
      const top = p.box.y1 - 0.05;
      sink.box({ x: (b.x0 + b.x1) / 2, y: top, z: (b.z0 + b.z1) / 2 }, alongZ ? 0.04 : b.x1 - b.x0, 0.04, alongZ ? b.z1 - b.z0 : 0.04, RAIL);
    }
    const w = b.x1 - b.x0 - 2 * INSET;
    const h = b.y1 - b.y0 - 2 * INSET;
    const d = b.z1 - b.z0 - 2 * INSET;
    if (w <= 0 || h <= 0 || d <= 0) continue;
    sink.box({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, z: (b.z0 + b.z1) / 2 }, w, h, d, TRIM);
  }
  const c = P2_CUTTING;
  const top = P2.floor - 0.02;
  sink.box({ x: (c.minX + c.maxX) / 2, y: top - 0.15, z: (c.minZ + c.maxZ) / 2 }, c.maxX - c.minX - 2 * INSET, 0.3, c.maxZ - c.minZ - 2 * INSET, FLOOR);
};

/** True when the cutting's middle stands in a block of the street furniture. */
export const p2In = (bounds: Box2): boolean => {
  const x = (P2_CUTTING.minX + P2_CUTTING.maxX) / 2;
  const z = (P2_CUTTING.minZ + P2_CUTTING.maxZ) / 2;
  return x >= bounds.minX && x < bounds.maxX && z >= bounds.minZ && z < bounds.maxZ;
};
