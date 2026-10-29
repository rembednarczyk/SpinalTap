import type { Rect } from "./builders";

/**
 * Sidewalks with a kerb along the streets (ADR-0041). Visual only: they are not solids, so a
 * kerb never blocks the player or anyone else and the collision, the steering raster and the
 * golden replay stay as they were. The renderer bakes them into each chunk's dressing mesh
 * and lifts the feet of whoever stands on one; the minimap draws them as street strips; the
 * city's residents walk along them (content/crowd.ts).
 */

/** Height of a sidewalk's top above the road (m). */
export const SIDEWALK_HEIGHT = 0.12;

/** Which side of the slab faces the road: the kerb runs along that edge. */
export type KerbSide = "x+" | "x-" | "z+" | "z-";

export interface Walkway extends Rect {
  /** Chunk whose dressing draws it. */
  readonly chunk: string;
  /** Edges that face the road (a kerb each); none on a strip along a wall that ends at a wall. */
  readonly kerbs: readonly KerbSide[];
}

/** A zebra crossing painted on the road between two sidewalks, stripes across `along`. */
export interface Crossing extends Rect {
  readonly chunk: string;
  /** The axis people walk along it. */
  readonly along: "x" | "z";
}

/**
 * The hand-made sidewalks of the old districts are gone with them (ADR-0045): Lublin's sidewalks,
 * kerbs and crossings come from the map (`ground` surfaces drawn by the renderer's map city,
 * which also lifts the feet of whoever stands on one). The tables stay for content that wants
 * its own strips.
 */
export const SIDEWALKS: readonly Walkway[] = [];

/** Zebra crossings where the residents' routes cross a road (none of the game's own in Lublin). */
export const CROSSINGS: readonly Crossing[] = [];

/** Is the point on a sidewalk (within `margin` of one)? */
export const onSidewalk = (x: number, z: number, margin = 0, walks: readonly Walkway[] = SIDEWALKS): boolean =>
  walks.some((w) => x >= w.minX - margin && x <= w.maxX + margin && z >= w.minZ - margin && z <= w.maxZ + margin);
