import type { GroundPoint, ViewDescriptor } from "@seki/core";
import type { StaticProp } from "./builders";
import type { PrismDef } from "../world/prism";
import { surfaceY } from "./lublin/terrain";

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
 * lowest. The simulation has each one as solid prisms from the ground up (`ALCHEMIA_PROPS`,
 * scenery: the engine draws the models, `renderer/alchemia`): a stall as its box, the hall as its
 * body up to its flat roof and its outside stair up to the stair's top, so the roof is a floor a
 * body can stand on (the next stages put a character up there and a working lift next to the hall:
 * `ALCHEMIA_ROOF` and `ALCHEMIA_LIFT_SITE` keep their places, nothing stands on them yet).
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
}

/** A block of a module's solid in the model's frame (glTF metres from the middle of its foot). */
export interface AlchemiaPart {
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
  readonly top: number;
}

/** A module set on the ground: its floor (the model's foot, world y) and the bottom of its plinth. */
export interface PlacedAlchemiaModule extends AlchemiaModule {
  readonly floor: number;
  readonly base: number;
}

/** The models' sizes (`extras.size` of alchemia-props.glb; a test holds them to the file). */
const HALL = { width: 11.03, depth: 12.21, height: 12.92 } as const;
const STALL = { width: 8.79, depth: 8.79, height: 8.96 } as const;
/**
 * The hall's solid (tools/city_alchemia.py, `HALL_ROOF`): its body up to the flat roof at 11.51 m
 * (16.44 units of the source × 0.7; the parapets, the box on the roof and the name over it are not
 * solid), the roof's bevel over the front of the upper storey a step lower, and the outside stair
 * on its east side up to the top of its landing (7.35 m).
 */
export const ALCHEMIA_HALL_ROOF = 11.51;
const BODY_X1 = 2.9;
const BEVEL_Z = 1.0;
const HALL_PARTS: readonly AlchemiaPart[] = [
  { x0: -HALL.width / 2, x1: BODY_X1, z0: -HALL.depth / 2, z1: BEVEL_Z, top: ALCHEMIA_HALL_ROOF },
  { x0: -HALL.width / 2, x1: BODY_X1, z0: BEVEL_Z, z1: HALL.depth / 2, top: 9.6 },
  { x0: BODY_X1, x1: HALL.width / 2, z0: -HALL.depth / 2, z1: HALL.depth / 2, top: 7.35 },
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
  };
};

/** The hall and the five stalls, south to north. */
export const ALCHEMIA_LAYOUT: readonly AlchemiaModule[] = [{ key: "alchemia-hall", x: 421, z: 45, yaw: HALL_YAW, ...HALL, parts: HALL_PARTS }, ...[0, 1, 2, 3, 4].map(stall)];

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

/** The module on the paving: its floor on the highest point under it, its plinth down past the lowest. */
export const placeAlchemiaModule = (m: AlchemiaModule): PlacedAlchemiaModule => {
  const ys = footprintSamples(m).map((p) => surfaceY(p.x, p.z));
  return { ...m, floor: Math.max(...ys), base: Math.min(...ys) - PLINTH_SINK };
};

/** The modules set on the ground, in the layout's order. */
export const ALCHEMIA_MODULES: readonly PlacedAlchemiaModule[] = ALCHEMIA_LAYOUT.map(placeAlchemiaModule);

/** Seen nowhere as an entity: the engine draws the models and plinths (`scenery`). */
const NO_VIEW: ViewDescriptor = { kind: "street-props", items: [] };

/** The blocks of a module's solid: its parts, or its whole box. */
export const alchemiaParts = (m: AlchemiaModule): readonly AlchemiaPart[] => m.parts ?? [{ x0: -m.width / 2, x1: m.width / 2, z0: -m.depth / 2, z1: m.depth / 2, top: m.height }];

/** A module as a solid: a prism per part from the plinth's bottom to the part's top. */
const moduleProp = (m: PlacedAlchemiaModule): StaticProp => {
  const rel = (x: number, z: number) => {
    const p = alchemiaPoint(m, x, z);
    return { x: p.x - m.x, z: p.z - m.z };
  };
  const prisms: PrismDef[] = alchemiaParts(m).map((q) => ({ points: [rel(q.x0, q.z0), rel(q.x0, q.z1), rel(q.x1, q.z1), rel(q.x1, q.z0)], bottom: 0, top: m.floor + q.top - m.base }));
  return { center: { x: m.x, y: m.base, z: m.z }, view: NO_VIEW, solid: true, prisms, scenery: true };
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
  corners: [alchemiaPoint(HALL_MODULE, -HALL.width / 2, -HALL.depth / 2), alchemiaPoint(HALL_MODULE, -HALL.width / 2, BEVEL_Z), alchemiaPoint(HALL_MODULE, BODY_X1, BEVEL_Z), alchemiaPoint(HALL_MODULE, BODY_X1, -HALL.depth / 2)],
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
