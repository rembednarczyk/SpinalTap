import type { Vec3 } from "@seki/core";
import type { GroundCut } from "../world/ground";
import { type BlockMaterial, type Rect, type StaticProp, v } from "./builders";
import { MAP_CHUNKS } from "./lublin/sites";
import { groundY } from "./lublin/terrain";

/**
 * The pavilion over a metro entrance (ADR-0071 stage 2): a low box of 7.2 × 3.6 m and 3.1 m on
 * the street, open at one short end, with the stairs going down from the opening to a hall
 * 2.7 m lower, inside its walls. The ticket machine stands in the hall against the far wall. The
 * ground is dug out under the stairs and the hall only (`cut`), so the hole never shows outside
 * the walls. Stage 2 has plain blocks: concrete under the street and as the plinth, glass above
 * it, a flat roof with its eaves; stage 3 dresses it. They are solids drawn by the scenery: the
 * renderer bakes them into the street furniture's meshes (no draw call of their own).
 *
 * Pavilions stand square to the map's axes: the dug ground is a rectangle of the ground's own
 * grid (`GroundCut`) and the stairs a slope along an axis.
 */

/** The footprint: along the long side, across it, and the height over the street. */
export const PAVILION = { length: 7.2, width: 3.6, height: 3.1 } as const;
/** How far down the hall lies under the street at the opening. */
export const HALL_DEPTH = 2.7;
/** The stairs: 16 steps of 0.17 m, 0.28 m deep, 2.4 m wide, below a landing inside the opening. */
export const STAIRS = { steps: 16, run: 4.48, width: 2.4, landing: 0.5 } as const;
/**
 * The landing stands this much over the street at the opening: a sill. The terrain there is the
 * dug shaft's edge, steep as a bank (ADR-0043); feet on the sill are over the street outside, so
 * they walk out where the street climbs a little from the opening.
 */
const SILL = 0.05;
/** The end wall's thickness; the side walls fill the rest of the width beside the stairs. */
const END_WALL = 0.25;
/** The granite plinth over the street, the eaves round the roof, the roof's slab. */
const PLINTH = 0.5;
const EAVES = 0.6;
const ROOF = 0.2;
/** The lintel over the opening starts this high over the street. */
const LINTEL = 2.5;
/** The ticket machine: across the hall, deep, tall. */
export const MACHINE_SIZE: Vec3 = v(0.8, 1.6, 0.45);

/** Where an entrance stands: its middle, the axis its long side runs along and the way its opening faces. */
export interface PavilionSpot {
  readonly x: number;
  readonly z: number;
  readonly along: "x" | "z";
  /** The opening is at the end of the long side towards +along (1) or -along (-1). */
  readonly opens: 1 | -1;
}

/** A pavilion built: its outline, the dug ground, the street and hall levels, its blocks, the machine and where a rider comes up. */
export interface Pavilion {
  readonly outline: Rect;
  readonly cut: GroundCut;
  /** The street at the opening: the head of the stairs. */
  readonly street: number;
  /** The hall's floor. */
  readonly floor: number;
  /** The way into the pavilion from the street, a step outside the opening. */
  readonly door: Vec3;
  readonly props: readonly StaticProp[];
  /** Middle of the ticket machine's foot, its box on the world's axes; it faces `machineYaw`. */
  readonly machine: Vec3;
  readonly machineSize: Vec3;
  readonly machineYaw: number;
  /** On the hall's floor, facing the stairs up. */
  readonly arrival: Vec3;
  readonly arrivalYaw: number;
}

/** The yaw facing +x, +z, -x or -z (0 faces +Z). */
const yawOf = (along: "x" | "z", sign: 1 | -1): number => (along === "z" ? (sign > 0 ? 0 : Math.PI) : sign > 0 ? Math.PI / 2 : -Math.PI / 2);

/** The map chunk holding (x, z). */
export const pavilionChunk = (x: number, z: number): string => {
  const c = MAP_CHUNKS.find((m) => x >= m.bounds.minX && x <= m.bounds.maxX && z >= m.bounds.minZ && z <= m.bounds.maxZ);
  if (!c) throw new Error(`no map chunk at ${x},${z}`);
  return c.id;
};

export const pavilion = (spot: PavilionSpot): Pavilion => {
  const { along, opens } = spot;
  // u: from the opening inwards along the long side; w: across it.
  const mouth = (along === "x" ? spot.x : spot.z) + (opens * PAVILION.length) / 2;
  const across = along === "x" ? spot.z : spot.x;
  const point = (u: number, w: number): { x: number; z: number } => (along === "x" ? { x: mouth - opens * u, z: across + w } : { x: across + w, z: mouth - opens * u });
  const rect = (u0: number, u1: number, w0: number, w1: number): Rect => {
    const a = point(u0, w0);
    const b = point(u1, w1);
    return { minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x), minZ: Math.min(a.z, b.z), maxZ: Math.max(a.z, b.z) };
  };
  const at = point(0, 0);
  const street = Math.round(groundY(at.x, at.z) * 100) / 100;
  const floor = street - HALL_DEPTH;
  const box = (u0: number, u1: number, w0: number, w1: number, y0: number, y1: number, material: BlockMaterial, solid = true): StaticProp => {
    const r = rect(u0, u1, w0, w1);
    return { center: v((r.minX + r.maxX) / 2, (y0 + y1) / 2, (r.minZ + r.maxZ) / 2), view: { kind: "block", size: v(r.maxX - r.minX, y1 - y0, r.maxZ - r.minZ), material }, solid, scenery: true };
  };
  const L = PAVILION.length;
  const half = PAVILION.width / 2;
  const inner = STAIRS.width / 2;
  const top = street + PAVILION.height;
  const base = floor - 0.3;
  const hallEnd = L - END_WALL;
  const foot = STAIRS.landing + STAIRS.run;
  const stairs = rect(STAIRS.landing, foot, -inner, inner);
  const props: StaticProp[] = [
    // The landing inside the opening, and the stairs rising to it: one slope, drawn as its steps.
    box(0, STAIRS.landing, -inner, inner, base, street + SILL, "concrete"),
    {
      center: v((stairs.minX + stairs.maxX) / 2, (floor + street) / 2, (stairs.minZ + stairs.maxZ) / 2),
      view: { kind: "block", size: v(stairs.maxX - stairs.minX, street - floor, stairs.maxZ - stairs.minZ), material: "concrete", slope: { axis: along, dir: opens, low: 0, steps: STAIRS.steps } },
      solid: true,
      scenery: true,
    },
    // The hall's floor.
    box(foot, hallEnd, -inner, inner, base, floor, "concrete"),
    // The side walls and the end wall: concrete up to the plinth's top, glass above.
    ...[-1, 1].flatMap((s) => [box(0, L, s * inner, s * half, base, street + PLINTH, "concrete"), box(0, L, s * inner, s * half, street + PLINTH, top, "glass")]),
    box(hallEnd, L, -inner, inner, base, street + PLINTH, "concrete"),
    box(hallEnd, L, -inner, inner, street + PLINTH, top, "glass"),
    // The lintel over the opening and the roof with its eaves.
    box(0, END_WALL, -inner, inner, street + LINTEL, top, "glass"),
    box(-EAVES, L + EAVES, -half - EAVES, half + EAVES, top, top + ROOF, "concrete"),
    // Two gates by the machine, towards the second flight of stage 4: drawn, not in the way.
    ...[0.2, 0.85].map((w) => box(foot + 0.4, foot + 1.3, w, w + 0.15, floor, floor + 1, "metal", false)),
  ];
  const m = point(hallEnd - MACHINE_SIZE.z / 2, -inner + MACHINE_SIZE.x / 2 + 0.1);
  const arrive = point(foot + 0.6, -0.2);
  const door = point(-1, 0);
  return {
    outline: rect(0, L, -half, half),
    cut: { bounds: rect(0, hallEnd, -inner, inner), floor: floor - 1 },
    street,
    floor,
    door: v(door.x, groundY(door.x, door.z), door.z),
    props,
    machine: v(m.x, floor, m.z),
    machineSize: along === "x" ? v(MACHINE_SIZE.z, MACHINE_SIZE.y, MACHINE_SIZE.x) : MACHINE_SIZE,
    machineYaw: yawOf(along, opens),
    arrival: v(arrive.x, floor, arrive.z),
    arrivalYaw: yawOf(along, opens),
  };
};
