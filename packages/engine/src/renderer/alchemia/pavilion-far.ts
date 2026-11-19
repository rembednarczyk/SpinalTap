import { PAVILION_CENTRE } from "@seki/sim";
import type { Box2 } from "../mapcity/polygon";
import { DRESS_FLAG, type MeshSink, type Rgba, hexColor } from "../mesh-sink";
import { type PavilionLook, pavilionFaces } from "./pavilion-shape";

/**
 * The triangular pavilion (ADR-0074 stage 3) as the street furniture's block meshes draw it, no
 * draw call of its own, like the food hall's and the Arkady's stand-ins: Alchemia's detailed mesh
 * is drawn only within `ALCHEMIA_DRAW` of the hall, and Brama Krakowska is beyond it. Its glass
 * lit, its roof, attic and board, the neon ALCHEMIA, all a few centimetres inside the detailed
 * faces, so near the eye those hide it.
 */

/** How far inside the detailed faces the stand-in's lie. */
const INSET = 0.03;

/** The kit's colours of the detailed swatches, near enough; glass and neon self-lit. */
const COLOR: Readonly<Record<PavilionLook, Rgba>> = {
  plinth: hexColor("#3a3d4c"),
  glass: hexColor("#a87a4c", DRESS_FLAG.lit),
  "glass-top": hexColor("#121a24"),
  frame: hexColor("#15171c"),
  fascia: hexColor("#15171c"),
  roof: hexColor("#30343e"),
  annex: hexColor("#3a3d4c"),
  door: hexColor("#1b1514"),
  attic: hexColor("#5a6170"),
  metal: hexColor("#596070"),
  board: hexColor("#1a1c22"),
  neon: hexColor("#00e5ff", DRESS_FLAG.lit),
};

/** Bakes the stand-in into a block's sink. */
export const bakePavilionStandIn = (sink: MeshSink): void => {
  pavilionFaces((corners, n, look) => sink.quad(corners, n, COLOR[look]), INSET, false);
};

/** True when the pavilion's middle stands in a block of the street furniture. */
export const pavilionIn = (bounds: Box2): boolean => PAVILION_CENTRE.x >= bounds.minX && PAVILION_CENTRE.x < bounds.maxX && PAVILION_CENTRE.z >= bounds.minZ && PAVILION_CENTRE.z < bounds.maxZ;
