import type { ActivityId } from "@seki/core";
import { v } from "./builders";
import type { Vec3 } from "@seki/core";

/**
 * The residents of the city (ADR-0041): the crowd on the sidewalks. Pure data: the routes the
 * walkers loop along, the places where the others stand, and how full each district is by the
 * hour. Kept apart from the district tables, so their content and ids stay as they were.
 */

/** Quality setting the crowd follows (the graphics quality: phones take "low"). */
export type CrowdDensity = "off" | "low" | "medium" | "high";

/** Most residents a chunk ever holds, per density. */
export const CROWD_CAP: Readonly<Record<CrowdDensity, number>> = { off: 0, low: 4, medium: 8, high: 12 };

/**
 * A closed route along the sidewalks, as a polygon of points (x, z) on the ground. Walkers go
 * round it both ways, each way on its own side (they keep left), and it is rounded at the corners.
 */
export interface CrowdLane {
  readonly id: string;
  readonly chunk: string;
  readonly points: readonly (readonly [number, number])[];
}

/** A place where a resident stands and does something, facing `yaw`. */
export interface CrowdSpot {
  readonly chunk: string;
  readonly at: Vec3;
  readonly yaw: number;
  /** What it does there; it changes with the passers-by's routine slots. */
  readonly does: readonly [ActivityId, ...ActivityId[]];
  /** Under a roof: no umbrella. */
  readonly indoor?: true;
}

const EAST = Math.PI / 2;
const WEST = -Math.PI / 2;
const NORTH = 0;
const SOUTH = Math.PI;

export const CROWD_LANES: readonly CrowdLane[] = [
  // Shinsekai 7: north along the east sidewalk, over the crossing at the north end, south along
  // the west sidewalk and back over the crossing by the south wall.
  {
    id: "s7-main",
    chunk: "shinsekai-7",
    points: [
      [5.5, -34.4],
      [5.5, 41.6],
      [-5.5, 41.6],
      [-5.5, -34.4],
    ],
  },
  // Kanałowa: up the west side from Shinsekai (round a crate), east along the north kerb (round
  // the benches and the footbridge stairs), over the road by the market gate, back west along
  // the south kerb (round the stairs and the van) and down the middle of the narrow street.
  {
    id: "kanal-loop",
    chunk: "kanal",
    points: [
      [4.75, 53],
      [4.75, 67.8],
      [6.35, 69.2],
      [6.35, 70.8],
      [4.75, 72.2],
      [4.75, 80.75],
      [41, 80.75],
      [41.6, 79.25],
      [62.9, 79.25],
      [63.4, 80.75],
      [65, 80.75],
      [65, 75.25],
      [53, 75.25],
      [52.6, 78.1],
      [43.4, 78.1],
      [43, 75.25],
      [34.6, 75.25],
      [34, 78.2],
      [26, 78.2],
      [25.4, 75.25],
      [10.6, 75.25],
      [8.6, 74.7],
      [7.4, 72.5],
      [7.4, 53],
    ],
  },
  // The market: round the edge of the south square (east of Sachiko's kiosk at the gate), and
  // round the stalls in its middle.
  {
    id: "targ-square",
    chunk: "targ-south",
    points: [
      [77.65, 65.1],
      [112.75, 65.1],
      [112.75, 82.6],
      [77.65, 82.6],
    ],
  },
  {
    id: "targ-stalls",
    chunk: "targ-south",
    points: [
      [80.5, 70.6],
      [109, 70.6],
      [109, 77.8],
      [80.5, 77.8],
    ],
  },
  // Under the overpass: along the north shop fronts, down past the east pillars, back west
  // between the pillar pairs and up past the stairs.
  {
    id: "targ-deck",
    chunk: "targ-north",
    points: [
      [69.4, 104.75],
      [117, 104.75],
      [117, 90.8],
      [69.4, 90.8],
    ],
  },
  // The docks: the footpath along the east wall, west along the quay fence, back east past the
  // office and the vending machine, north up the yard.
  {
    id: "doki-round",
    chunk: "doki-quay",
    points: [
      [31.3, 93],
      [31.3, 113.6],
      [27.9, 114.4],
      [27.9, 117.6],
      [31.3, 118.6],
      [31.3, 148.75],
      [-34.2, 148.75],
      [-34.2, 125.6],
      [22.6, 125.6],
      [22.6, 123.3],
      [24.4, 122.6],
      [24.4, 93],
    ],
  },
];

const spot = (chunk: string, x: number, z: number, yaw: number, does: readonly [ActivityId, ...ActivityId[]], indoor = false): CrowdSpot =>
  indoor ? { chunk, at: v(x, 0, z), yaw, does, indoor: true } : { chunk, at: v(x, 0, z), yaw, does };

/**
 * Where residents stand: at the walls of the sidewalks (out of the walkers' way), in pairs that
 * talk, at the Neon Koi counter. Clear of the passers-by's spots and the named characters.
 */
export const CROWD_SPOTS: readonly CrowdSpot[] = [
  spot("shinsekai-7", 6.45, -26, WEST, ["smoke", "phone"]),
  spot("shinsekai-7", -6.45, -27.5, EAST, ["phone", "lean"]),
  spot("shinsekai-7", -6.45, -9.2, SOUTH, ["talk"]),
  spot("shinsekai-7", 6.45, 13, WEST, ["lean", "smoke"]),
  spot("shinsekai-7", -6.45, 27, EAST, ["smoke", "phone"]),
  spot("shinsekai-7", -6.45, -10.3, NORTH, ["talk"]),
  spot("shinsekai-7", 12.85, -2.6, EAST, ["drink"], true),
  spot("shinsekai-7", 12.85, -0.7, EAST, ["talk", "drink"], true),
  spot("shinsekai-7", 12.85, 5.7, EAST, ["drink"], true),
  spot("shinsekai-7", 11.5, -6.15, NORTH, ["lean", "phone"], true),
  spot("kanal", 4.45, 58, EAST, ["lean", "smoke"]),
  spot("kanal", 24, 81.55, SOUTH, ["smoke", "phone"]),
  spot("kanal", 14, 74.45, NORTH, ["phone", "lean"]),
  spot("kanal", 58, 74.45, NORTH, ["smoke"]),
  spot("kanal", 48, 81.55, SOUTH, ["talk", "phone"]),
  spot("targ-south", 76, 64.45, SOUTH, ["phone"]),
  spot("targ-south", 89.4, 64.45, EAST, ["talk"]),
  spot("targ-south", 113.55, 76, WEST, ["smoke", "lean"]),
  spot("targ-south", 90.5, 64.45, WEST, ["talk"]),
  spot("targ-south", 100, 64.45, SOUTH, ["phone", "lean"]),
  spot("targ-north", 88, 105.55, NORTH, ["phone"]),
  spot("targ-north", 100, 105.55, NORTH, ["lean", "phone"]),
  spot("targ-north", 96, 87.2, SOUTH, ["smoke", "lean"]),
  spot("targ-north", 118, 105.55, NORTH, ["smoke"]),
  spot("doki-yard", 12.6, 101.2, WEST, ["smoke", "lean"]),
  spot("doki-yard", 26, 104, NORTH, ["phone"]),
  spot("doki-quay", 12.6, 137.5, NORTH, ["lean", "smoke"]),
  spot("doki-quay", 5.5, 134, SOUTH, ["talk", "phone"]),
];

/**
 * How full a district is by the hour (0..1 of the chunk's share of the cap): Shinsekai lives at
 * night, the market is busiest in the evening, the docks work by day and are empty at night.
 */
export const CROWD_BY_HOUR: Readonly<Record<string, readonly number[]>> = {
  //            0    1    2    3    4    5    6    7    8    9   10   11   12   13   14   15   16   17   18   19   20   21   22   23
  nightlife: [0.9, 0.9, 0.8, 0.6, 0.3, 0.2, 0.2, 0.4, 0.5, 0.5, 0.5, 0.6, 0.6, 0.6, 0.6, 0.6, 0.7, 0.8, 0.8, 0.9, 1.0, 1.0, 1.0, 1.0],
  street: [0.5, 0.4, 0.3, 0.2, 0.1, 0.2, 0.4, 0.7, 0.8, 0.6, 0.6, 0.7, 0.8, 0.7, 0.6, 0.6, 0.7, 0.9, 0.9, 0.8, 0.8, 0.7, 0.6, 0.6],
  market: [0.4, 0.3, 0.1, 0.1, 0.1, 0.1, 0.3, 0.5, 0.5, 0.6, 0.7, 0.8, 0.9, 0.8, 0.7, 0.7, 0.8, 1.0, 1.0, 1.0, 1.0, 1.0, 0.8, 0.6],
  docks: [0, 0, 0, 0, 0, 0.2, 0.5, 0.8, 0.9, 0.9, 0.9, 0.9, 0.7, 0.9, 0.9, 0.9, 0.8, 0.6, 0.3, 0.1, 0, 0, 0, 0],
};

/** Each chunk's crowd: its profile by the hour and its share of the cap. */
export const CROWD_CHUNKS: Readonly<Record<string, { readonly profile: keyof typeof CROWD_BY_HOUR; readonly share: number }>> = {
  "shinsekai-7": { profile: "nightlife", share: 1 },
  kanal: { profile: "street", share: 0.8 },
  "targ-south": { profile: "market", share: 1 },
  "targ-north": { profile: "market", share: 0.75 },
  "doki-yard": { profile: "docks", share: 0.25 },
  "doki-quay": { profile: "docks", share: 0.6 },
};
