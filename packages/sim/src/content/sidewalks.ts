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

const walk = (chunk: string, minX: number, maxX: number, minZ: number, maxZ: number, ...kerbs: KerbSide[]): Walkway => ({ chunk, minX, maxX, minZ, maxZ, kerbs });

/**
 * Shinsekai 7: both sides of the main street (X ∈ [-7, 7]), leaving the car wash bay and the
 * dumpsters and the car at the north end. The narrow strips the district had (ADR-0001) lie
 * under the facades and stay as they were.
 */
const SHINSEKAI: readonly Walkway[] = [
  walk("shinsekai-7", -7, -4.9, -35.8, 42.8, "x+", "z-", "z+"),
  walk("shinsekai-7", 4.9, 7, -35.8, 26, "x-", "z-", "z+"),
  walk("shinsekai-7", 4.9, 7.2, 35.4, 42.8, "x-", "z-", "z+"),
];

/**
 * Ulica Kanałowa: the west side of the street from Shinsekai, both kerbs of the long segment
 * (the north one over the strip it always had), the south one broken by the footbridge stairs.
 */
const KANAL: readonly Walkway[] = [
  walk("kanal", 4, 5.4, 52, 80.2, "x+"),
  walk("kanal", 4, 66, 80.2, 82, "z-", "x+"),
  walk("kanal", 10, 43.6, 74, 75.8, "z+", "x-", "x+"),
  walk("kanal", 52.4, 66, 74, 75.8, "z+", "x-", "x+"),
];

/** The market: along the shop fronts of the south row, the east row and the north row. */
const TARG: readonly Walkway[] = [
  walk("targ-south", 68, 114, 64, 65.8, "z+"),
  walk("targ-south", 112.2, 114, 65.8, 84, "x-"),
  walk("targ-north", 68, 124, 104.2, 106, "z-"),
];

/** The docks: a footpath along the east wall from the passage off Kanałowa down to the quay. */
const DOKI: readonly Walkway[] = [walk("doki-yard", 30.9, 32, 91.2, 124, "x-"), walk("doki-quay", 30.9, 32, 124.2, 147.6, "x-")];

export const SIDEWALKS: readonly Walkway[] = [...SHINSEKAI, ...KANAL, ...TARG, ...DOKI];

/** Zebra crossings where the residents' routes cross a road (content/crowd.ts). */
export const CROSSINGS: readonly Crossing[] = [
  { chunk: "shinsekai-7", minX: -4.9, maxX: 4.9, minZ: -35.4, maxZ: -33.4, along: "x" },
  { chunk: "shinsekai-7", minX: -4.9, maxX: 4.9, minZ: 40.6, maxZ: 42.6, along: "x" },
  { chunk: "kanal", minX: 64, maxX: 66, minZ: 75.8, maxZ: 80.2, along: "z" },
  { chunk: "kanal", minX: 5.4, maxX: 9.6, minZ: 52.2, maxZ: 54.2, along: "x" },
];

/** Is the point on a sidewalk (within `margin` of one)? */
export const onSidewalk = (x: number, z: number, margin = 0, walks: readonly Walkway[] = SIDEWALKS): boolean =>
  walks.some((w) => x >= w.minX - margin && x <= w.maxX + margin && z >= w.minZ - margin && z <= w.maxZ + margin);
