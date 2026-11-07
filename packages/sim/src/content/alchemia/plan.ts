import type { Vec3, ViewDescriptor } from "@seki/core";
import type { Rect, StaticProp } from "../builders";
import type { PrismDef } from "../../world/prism";

/**
 * Alchemia 2077 by the investor's plan (ADR-0074 stage 1): the levels and the outline of the food
 * hall under the upper terrace, in world metres (ADR-0042). Pure numbers: `foodhall.ts`,
 * `units.ts`, `lift.ts` and `terraces.ts` build on them, the engine draws the same boxes.
 *
 * Measured on the game's terrain (NMT, `docs/topografia.md` T-145): the car park along the hall's
 * back wall lies at -2.2 (T0, the hall's roof), the ground in front of its front at -5.6..-7.8,
 * levelled to -6.4 (T1, the hall's floor). The outline keeps 2.2 m off the pavilion of metro B
 * (x 424.4..431.6, z 26.2..29.8) and lies on the lines of the 4 m terrain grid of its chunk, so the
 * terrace's ground meets its walls along whole cells.
 */

/** The terraces: T0 over the hall (its roof), T1 in front of it (its floor). */
export const T0 = -2.2;
export const T1 = -6.4;

/** The food hall's outline (outer faces of its walls), its walls' thickness, floor, ceiling and roof. */
export const HALL = { minX: 400, maxX: 436, minZ: 32, maxZ: 58, wall: 0.4, floor: T1, roof: T0, ceiling: T0 - 0.4 } as const;

/** Inside the walls. */
export const HALL_INNER: Rect = { minX: HALL.minX + HALL.wall, maxX: HALL.maxX - HALL.wall, minZ: HALL.minZ + HALL.wall, maxZ: HALL.maxZ - HALL.wall };

/** The parapet round the roof where the ground falls away from it (west, north and east). */
export const PARAPET = 1.0;
/** Walls and slabs reach this far into the ground and the earth round them. */
export const SINK = 0.3;

/** A box of the world's axes: x, z and y from-to. */
export interface Box {
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
  readonly y0: number;
  readonly y1: number;
}

export const box = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number): Box => ({ x0, x1, z0, z1, y0, y1 });

/** What a piece is, for the engine's colours (one material, ADR-0074 §6). */
export type PieceKind = "wall" | "glass" | "roof" | "green" | "parapet" | "partition" | "counter" | "grille" | "table" | "bench" | "step" | "frame" | "shutter";

/** A drawn piece of Alchemia: its box, its kind, solid or not, inside the hall (drawn near only) or out. */
export interface Piece {
  readonly box: Box;
  readonly kind: PieceKind;
  readonly solid: boolean;
  readonly inside: boolean;
}

export const piece = (b: Box, kind: PieceKind, inside: boolean, solid = true): Piece => ({ box: b, kind, solid, inside });

/** Seen nowhere as an entity: the engine draws Alchemia (`scenery`). */
const NO_VIEW: ViewDescriptor = { kind: "street-props", items: [] };

/** A box as a prism around `c`. */
const prismOf = (b: Box, c: Vec3): PrismDef => ({
  points: [
    { x: b.x0 - c.x, z: b.z0 - c.z },
    { x: b.x1 - c.x, z: b.z0 - c.z },
    { x: b.x1 - c.x, z: b.z1 - c.z },
    { x: b.x0 - c.x, z: b.z1 - c.z },
  ],
  bottom: b.y0 - c.y,
  top: b.y1 - c.y,
});

/** The solid pieces as one static prop of prisms, its centre at the middle of their boxes' foot. */
export const solidProp = (pieces: readonly Piece[]): StaticProp => {
  const boxes = pieces.filter((p) => p.solid).map((p) => p.box);
  const c = {
    x: (Math.min(...boxes.map((b) => b.x0)) + Math.max(...boxes.map((b) => b.x1))) / 2,
    y: Math.min(...boxes.map((b) => b.y0)),
    z: (Math.min(...boxes.map((b) => b.z0)) + Math.max(...boxes.map((b) => b.z1))) / 2,
  };
  return { center: c, view: NO_VIEW, solid: true, prisms: boxes.map((b) => prismOf(b, c)), scenery: true };
};

/** A point on the hall's floor. */
export const onFloor = (x: number, z: number, up = 0): Vec3 => ({ x, y: HALL.floor + up, z });

/** The way to face from `from` to `to`. */
export const facing = (from: { x: number; z: number }, to: { x: number; z: number }): number => Math.atan2(to.x - from.x, to.z - from.z);

export const NORTH = 0;
export const SOUTH = Math.PI;
export const EAST = Math.PI / 2;
export const WEST = -Math.PI / 2;
