import { type METRO_ENTRANCES, PAVILION, STAIRS } from "@seki/sim";
import type { MeshSink, Rgba, Vec } from "../mesh-sink";

/** An entrance of the metro as the simulation builds it (ADR-0071 stage 2). */
export type Entrance = (typeof METRO_ENTRANCES)[number];

/**
 * A pavilion's own frame, as `metro-pavilion.ts` in the simulation lays it out: `u` metres from
 * the opening inwards along the long side, `w` metres across it. Pavilions stand square to the
 * map's axes, so a box of the frame is a box of the world.
 */
export interface PavilionFrame {
  readonly e: Entrance;
  /** The street at the opening and the hall's floor. */
  readonly street: number;
  readonly floor: number;
  /** The walls' top: the roof's underside. */
  readonly top: number;
  readonly length: number;
  readonly half: number;
  /** Half the stairs' width: the side walls stand from here to `half`. */
  readonly inner: number;
  /** Where the stairs end and the hall starts, from the opening. */
  readonly foot: number;
  /** The point at (u, w) on the street's plane. */
  at(u: number, w: number, y: number): Vec;
  /** The world's direction of +u and of +w. */
  readonly inward: Vec;
  readonly across: Vec;
}

export const pavilionFrame = (e: Entrance): PavilionFrame => {
  const { along, opens } = e.spot;
  const length = PAVILION.length;
  const mouth = (along === "x" ? e.spot.x : e.spot.z) + (opens * length) / 2;
  const side = along === "x" ? e.spot.z : e.spot.x;
  const at = (u: number, w: number, y: number): Vec => (along === "x" ? { x: mouth - opens * u, y, z: side + w } : { x: side + w, y, z: mouth - opens * u });
  return {
    e,
    street: e.street,
    floor: e.floor,
    top: e.street + PAVILION.height,
    length,
    half: PAVILION.width / 2,
    inner: STAIRS.width / 2,
    foot: STAIRS.landing + STAIRS.run,
    at,
    inward: along === "x" ? { x: -opens, y: 0, z: 0 } : { x: 0, y: 0, z: -opens },
    across: along === "x" ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 },
  };
};

/** A box of the frame between u0..u1, w0..w1 and y0..y1 (in any order). */
export const frameBox = (sink: MeshSink, f: PavilionFrame, u: readonly [number, number], w: readonly [number, number], y: readonly [number, number], color: Rgba, bottom = false): void => {
  const a = f.at(u[0], w[0], y[0]);
  const b = f.at(u[1], w[1], y[1]);
  sink.box({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 }, Math.abs(b.x - a.x), Math.abs(b.y - a.y), Math.abs(b.z - a.z), color, { bottom });
};

/** A square rod `t` thick from `a` to `b`: a rail, a bracket, a stroke of a neon letter. */
export const rod = (sink: MeshSink, a: Vec, b: Vec, t: number, color: Rgba): void => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const flat = Math.hypot(dx, dz);
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
  // Along local x: turned to the rod's heading, tilted to its slope (as `MeshSink.cable`).
  sink.box(mid, Math.hypot(flat, dy), t, t, color, { rotY: flat > 1e-9 ? Math.atan2(-dz, dx) : 0, tilt: Math.atan2(dy, flat) });
};

/** The side of the opening the pylon stands on: away from a wall beside the pavilion. */
export const pylonSide = (e: Entrance): 1 | -1 => (e.spot.wall?.side === -1 ? 1 : -1);

/** A small deterministic hash of a pavilion's place, 0..1, for its stickers. */
export const placeHash = (e: Entrance, k: number): number => {
  const s = Math.sin(e.spot.x * 12.9898 + e.spot.z * 78.233 + k * 37.719) * 43758.5453;
  return s - Math.floor(s);
};
