import type { GroundPoint, ViewDescriptor } from "@seki/core";
import type { StaticProp } from "./builders";
import type { PrismDef } from "../world/prism";
import { surfaceY } from "./lublin/terrain";
import { type AlchemiaFlight, type AlchemiaPart, HALL_CORNER, HALL_STAIR_FOOT, HALL_STAIR_PARTS, HALL_UPPER_X, HALL_WALL_X, flightSteps, rectPart } from "./alchemia-stairs";

export type { AlchemiaFlight, AlchemiaPart } from "./alchemia-stairs";

/**
 * Alchemia 2077 (ADR-0063 stage 4): the food hall of the Arkady company's real plan, built by
 * 2077 on the fenced brownfield in the middle of Plac Ofiar Getta (OSM way 1559354343,
 * `landuse=brownfield`, `proposed:landuse=retail`, some 4 400 m²) between Świętoduska, Lubartowska
 * and Bajkowskiego, behind the Ratusz. A deliberate departure of the future (docs/topografia.md,
 * T-145). Only the outside for now: no interior, car park or events; its doors are shut.
 *
 * It is the models of `alchemia-props.glb` (tools/city_alchemia.py, both CC-BY 4.0 from the
 * user's pack): the hall (igor.tesV's Cyberpunk Building, 11 × 12.2 m and 12.9 m to the top of
 * the name on its roof) facing south to the car park and the Ratusz, and five food stalls (Just_Eh's
 * shopfronts, 8.8 m square and 9 m high) in a row along the plot's west fence, their windows to
 * Świętoduska, each on its own floor down the plot's slope (some 4 m from the hall to the fifth
 * stall): a low pavilion on several levels. The east half of the plot stays the open square of
 * the plan, with the outbuilding and the shed of the map where they are.
 *
 * Each module stands on the highest paving under its footprint; a plinth under it reaches the
 * lowest, and flights of steps come down from its doors to the paving (G-287). The
 * simulation has each one as solid prisms from the ground up (`ALCHEMIA_PROPS`, scenery: the
 * engine draws the models, their plinths and steps, `renderer/alchemia`): a stall as its box and
 * its steps, the hall as its body up to its flat roof and its outside stair as drawn, step by step
 * up to the landing (G-288, `alchemia-stairs.ts`), so the roof is a floor a body can stand on (the
 * next stages put a character up there and a working lift next to the hall: `ALCHEMIA_ROOF` and
 * `ALCHEMIA_LIFT_SITE` keep their places, nothing stands on them yet).
 */

/** A module of the hall: its model's key, the middle of its footprint, its front and its box. */
export interface AlchemiaModule {
  readonly key: string;
  readonly x: number;
  readonly z: number;
  /** The way its front (the model's +Z) faces: (sin yaw, cos yaw) in the world's x and z. */
  readonly yaw: number;
  /** Its model's size in metres: across its front, front to back, foot to top. */
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  /**
   * Its solid as blocks of the model's own frame (glTF metres: x across its front, as seen from in
   * front of it, z to its front, the top over its foot); without them, its whole box.
   */
  readonly parts?: readonly AlchemiaPart[];
  /** The flights of steps out of it down to the paving (G-287, G-288). */
  readonly flights?: readonly AlchemiaFlight[];
}

/** A module set on the ground: its floor (the model's foot, world y), the bottom of its plinth and its flights' steps there. */
export interface PlacedAlchemiaModule extends AlchemiaModule {
  readonly floor: number;
  readonly base: number;
  readonly steps: readonly AlchemiaPart[];
}

/** The models' sizes (`extras.size` of alchemia-props.glb; a test holds them to the file). */
const HALL = { width: 11.03, depth: 12.21, height: 12.92 } as const;
const STALL = { width: 8.79, depth: 8.79, height: 8.96 } as const;
/**
 * The hall's solid as alchemia-props.glb draws it (`alchemia-hall`, measured off its upright faces;
 * G-297, G-298): the plinth at its floor out to the footprint, the podium (1.23 m) the building
 * stands on, and inside the podium's edges its walls, set back from them: the ground storey between
 * the west wall (x -4.80), the back wall (z -4.60), the wall over the stair (x 2.24) and its front
 * (z 2.80), its east corner cut at 45° (x + z = 3.35), up to the flat roof at 11.51
 * m (`HALL_ROOF` of tools/city_alchemia.py, 16.44 units × 0.7; the parapets, the box on the roof
 * and the name over it are not solid); the upper storey over the porch out to z 4.80 and x 0.40
 * from the porch's ceiling (6.03 m) to the roof's bevel a step lower (9.9 m), its windows' sills
 * (7.9 m) 0.3 m deep, so the porch under it and the balcony east of it are open; the fixtures on
 * its walls; and the outside stair on its east side, up to its landing (G-288, `HALL_STAIR_PARTS`).
 */
export const ALCHEMIA_HALL_ROOF = 11.51;
const WALL = { west: -4.8, back: -4.6, front: 2.8, corner: HALL_CORNER } as const;
const UPPER = { front: 4.8, east: HALL_UPPER_X, bottom: 6.03, sill: 7.9, window: 4.5, top: 9.9 } as const;
/**
 * What stands out of its walls (x0, x1, z0, z1, bottom, top): the upper storey's west wall over
 * the ground storey's, two bands along the back, a sign at the front's west corner, a lamp over the
 * back's east corner and a sign on the east wall over the balcony.
 */
const HALL_FIXTURES: readonly (readonly [number, number, number, number, number, number])[] = [
  [-5.11, WALL.west, WALL.back, 3.25, 5.04, ALCHEMIA_HALL_ROOF],
  [-4.89, -0.09, -4.81, WALL.back, 5.04, 5.98],
  [-4.92, HALL_WALL_X, -4.98, WALL.back, 8.7, 9.91],
  [-4.7, -4.5, UPPER.front, 6.1, 5.36, 9.89],
  [1.75, HALL_WALL_X, -HALL.depth / 2, WALL.back, 6.06, 6.27],
  [UPPER.east, 0.88, 3.0, 3.55, 10.1, 10.43],
];
/** The roof over the ground storey round its edge from its back west corner: the roof the next stages stand on. */
const HALL_ROOF_OUTLINE: readonly (readonly [number, number])[] = [
  [WALL.west, WALL.back],
  [WALL.west, WALL.front],
  [WALL.corner - WALL.front, WALL.front],
  [HALL_WALL_X, WALL.corner - HALL_WALL_X],
  [HALL_WALL_X, WALL.back],
];
const HALL_PARTS: readonly AlchemiaPart[] = [
  { points: HALL_ROOF_OUTLINE, top: ALCHEMIA_HALL_ROOF },
  rectPart(WALL.west, UPPER.east, WALL.front, UPPER.front, UPPER.sill, UPPER.bottom),
  rectPart(WALL.west, UPPER.east, WALL.front, UPPER.window, UPPER.top, UPPER.sill),
  ...HALL_FIXTURES.map(([x0, x1, z0, z1, bottom, top]) => rectPart(x0, x1, z0, z1, top, bottom)),
  rectPart(-HALL.width / 2, HALL.width / 2, -HALL.depth / 2, HALL.depth / 2, 0),
  ...HALL_STAIR_PARTS,
];

/** The plot's west fence from (406.1, 65.3) north to (435.4, 125.6): its direction and the inward normal. */
const FENCE = { x: 406.1, z: 65.3 } as const;
const ALONG = { x: 0.437, z: 0.899 } as const;
const INWARD = { x: 0.899, z: -0.437 } as const;
/** The stalls stand this far in from the fence (their middles), side by side from this far along it. */
const STALL_IN = 6.2;
const STALL_FROM = -2.4;
/** Their windows face away from the plot, west-north-west to Świętoduska. */
const STALL_YAW = Math.atan2(-INWARD.x, -INWARD.z);
/** The hall faces south-south-west, square to the plot's south edge along the car park. */
const HALL_YAW = Math.atan2(-0.289, -0.957);

const stall = (i: number): AlchemiaModule => {
  const s = STALL_FROM + i * STALL.width;
  return {
    key: `alchemia-stall-${i + 1}`,
    x: FENCE.x + ALONG.x * s + INWARD.x * STALL_IN,
    z: FENCE.z + ALONG.z * s + INWARD.z * STALL_IN,
    yaw: STALL_YAW,
    ...STALL,
    flights: [{ x0: -STALL.width / 2, x1: STALL.width / 2, z: STALL.depth / 2, dir: 1, top: 0 }],
  };
};

/** The hall and the five stalls, south to north. */
export const ALCHEMIA_LAYOUT: readonly AlchemiaModule[] = [{ key: "alchemia-hall", x: 421, z: 45, yaw: HALL_YAW, ...HALL, parts: HALL_PARTS, flights: [HALL_STAIR_FOOT] }, ...[0, 1, 2, 3, 4].map(stall)];

/**
 * A point of the model's frame (glTF x and z) in the world: its +Z is the module's front and,
 * as the engine stands it (`facing`), its +X lies left of the front, (-cos yaw, sin yaw).
 */
export const alchemiaPoint = (m: AlchemiaModule, x: number, z: number): GroundPoint => {
  const fx = Math.sin(m.yaw);
  const fz = Math.cos(m.yaw);
  return { x: m.x + fx * z - fz * x, z: m.z + fz * z + fx * x };
};

/** The corners of a module's footprint in the world, counter-clockwise (x east, z north). */
export const alchemiaCorners = (m: AlchemiaModule): GroundPoint[] => [footprintPoint(m, -1, -1), footprintPoint(m, 1, -1), footprintPoint(m, 1, 1), footprintPoint(m, -1, 1)];

/** A point of a module's footprint: `side` from its left (-1) to its right (1) edge, `front` from its back (-1) to its front (1). */
const footprintPoint = (m: AlchemiaModule, side: number, front: number): GroundPoint => {
  const fx = Math.sin(m.yaw);
  const fz = Math.cos(m.yaw);
  // Right of the front when looking along it: (fz, -fx).
  return { x: m.x + fz * side * (m.width / 2) + fx * front * (m.depth / 2), z: m.z - fx * side * (m.width / 2) + fz * front * (m.depth / 2) };
};

/** Points over a module's footprint, every metre or so, corners included. */
const footprintSamples = (m: AlchemiaModule): GroundPoint[] => {
  const pts: GroundPoint[] = [];
  const n = Math.ceil(Math.max(m.width, m.depth));
  for (let i = 0; i <= n; i++) for (let k = 0; k <= n; k++) pts.push(footprintPoint(m, (2 * i) / n - 1, (2 * k) / n - 1));
  return pts;
};

/** How far the plinth reaches under the lowest ground of the footprint (m). */
const PLINTH_SINK = 0.3;

/** The module on the paving: its floor on the highest point under it, its plinth down past the lowest, its steps down to the paving. */
export const placeAlchemiaModule = (m: AlchemiaModule): PlacedAlchemiaModule => {
  const ys = footprintSamples(m).map((p) => surfaceY(p.x, p.z));
  const floor = Math.max(...ys);
  const ground = (x: number, z: number) => {
    const p = alchemiaPoint(m, x, z);
    return surfaceY(p.x, p.z) - floor;
  };
  return { ...m, floor, base: Math.min(...ys) - PLINTH_SINK, steps: (m.flights ?? []).flatMap((f) => flightSteps(f, ground)) };
};

/** The modules set on the ground, in the layout's order. */
export const ALCHEMIA_MODULES: readonly PlacedAlchemiaModule[] = ALCHEMIA_LAYOUT.map(placeAlchemiaModule);

/** Seen nowhere as an entity: the engine draws the models and plinths (`scenery`). */
const NO_VIEW: ViewDescriptor = { kind: "street-props", items: [] };

/** The blocks of a module's solid: its parts, or its whole box. */
export const alchemiaParts = (m: AlchemiaModule): readonly AlchemiaPart[] => m.parts ?? [rectPart(-m.width / 2, m.width / 2, -m.depth / 2, m.depth / 2, m.height)];

/** A module as a solid: a prism per part and step from its bottom (the plinth's, if it has none) to its top. */
const moduleProp = (m: PlacedAlchemiaModule): StaticProp => {
  const prism = (q: AlchemiaPart): PrismDef => ({
    points: q.points.map(([x, z]) => {
      const p = alchemiaPoint(m, x, z);
      return { x: p.x - m.x, z: p.z - m.z };
    }),
    bottom: q.bottom === undefined ? 0 : m.floor + q.bottom - m.base,
    top: m.floor + q.top - m.base,
  });
  return { center: { x: m.x, y: m.base, z: m.z }, view: NO_VIEW, solid: true, prisms: [...alchemiaParts(m), ...m.steps].map(prism), scenery: true };
};

/** Every solid of Alchemia, in the layout's order (the order their ids are given). */
export const ALCHEMIA_PROPS: readonly StaticProp[] = ALCHEMIA_MODULES.map(moduleProp);

const HALL_MODULE = ALCHEMIA_MODULES[0] as PlacedAlchemiaModule;

/**
 * The hall's flat roof (for the next stages: a character standing up there): world y and its
 * corners. Solid and clear today; the way up is the lift of `ALCHEMIA_LIFT_SITE`, still to come.
 */
export const ALCHEMIA_ROOF: { readonly y: number; readonly corners: readonly GroundPoint[] } = {
  y: HALL_MODULE.floor + ALCHEMIA_HALL_ROOF,
  corners: HALL_ROOF_OUTLINE.map(([x, z]) => alchemiaPoint(HALL_MODULE, x, z)),
};

/**
 * Where the hall's lift will stand (a later stage): a 3 × 3 m shaft against the middle of the
 * hall's back wall, from the paving to the roof. Kept clear of the stalls, the paths and the
 * map's own things (a test holds it so); nothing is built on it yet.
 */
export const ALCHEMIA_LIFT_SITE: { readonly centre: GroundPoint; readonly yaw: number; readonly size: number } = {
  centre: alchemiaPoint(HALL_MODULE, -1, -HALL.depth / 2 - 1.6),
  yaw: HALL_MODULE.yaw,
  size: 3,
};

/** Where the hall stands: the middle of the whole group, for streaming and drawing distances. */
export const ALCHEMIA_CENTRE: GroundPoint = { x: 418, z: 68 };
