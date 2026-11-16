import type { GroundPoint, StreetPropItem, Vec3, ViewDescriptor } from "@seki/core";
import type { ActorDef, StaticProp } from "../builders";
import { W3_HALL_BARRIERS, W3_HALL_PROPS, W3_HALL_SHELL } from "./hall";
import { W3_EDGE_BARRIERS, W3_EDGE_PROPS } from "./quay";
import { W3_PUBLIC_ACTORS, W3_PUBLIC_PROPS, W3_YARD_PROPS, W3_ZONE_ACTORS } from "./public";
import { W3_TOWER_PROPS } from "./tower-pipes";
import { W3_ZONE } from "./site";

export * from "./site";
export { W3_NAV } from "./nav";
export { ESCORT_AMBUSH_Z, ESCORT_ROUTE, SNIPER_PERCHES, W3_CONTRACT_POSTS, W3_CONTRACT_SITE_SPAWNS, W3_ITEM_SPOTS, W3_TERMINAL_SPOTS, type ContractPost } from "./posts";
export { GENZO_SPOT } from "./public";
export { W3_OFFICE, W3_OFFICE_DOOR, W3_PIPE_LADDER, W3_TOWER_STAIR } from "./tower-pipes";
export { W3_BRIDGE_Z, W3_HALL_DOORS } from "./hall";
export { W3_CUTS, W3_VAULTS } from "./basement";
export * as W3_LAYOUT from "./layout";
export { W3_UNSEEN_WALLS } from "./quay";

/** W-3's props in the world (ADR-0082 stage 1): the hall's shell, the tower and the pipeline, the edges, the public strip. */
export const W3_PROPS: readonly StaticProp[] = [...W3_HALL_PROPS, ...W3_TOWER_PROPS, ...W3_EDGE_PROPS, ...W3_YARD_PROPS, ...W3_PUBLIC_PROPS];
/** Genzō on the public strip, the docker in the zone. */
export const W3_ACTORS: readonly ActorDef[] = [...W3_PUBLIC_ACTORS, ...W3_ZONE_ACTORS];

/** The barriers W-3 lays (its fence, railings, the retaining wall, row S's roof fence), drawn with the furniture. */
export const W3_BARRIERS: readonly StreetPropItem[] = [...W3_EDGE_BARRIERS, ...W3_HALL_BARRIERS];

/** The x where Nabrzeże's chunks meet (`nabrzeze-0-1` | `nabrzeze-1-1`): a ground piece is draped on one chunk's terrain. */
const CHUNK_SEAM = 2500;

/** The part of a ring on one side of x = `at` (Sutherland-Hodgman against one line). */
const clipX = (ring: readonly GroundPoint[], at: number, keepWest: boolean): GroundPoint[] => {
  const out: GroundPoint[] = [];
  const side = (p: GroundPoint) => (keepWest ? at - p.x : p.x - at);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i] as GroundPoint;
    const b = ring[(i + 1) % ring.length] as GroundPoint;
    const [sa, sb] = [side(a), side(b)];
    if (sa >= 0) out.push(a);
    if ((sa > 0 && sb < 0) || (sa < 0 && sb > 0)) out.push({ x: at, z: a.z + ((b.z - a.z) * sa) / (sa - sb) });
  }
  return out;
};

/** What the renderer draws of W-3 for good, with the city (`WORLD_SCENERY`), by the point that picks its chunk. */
export interface W3SceneryItem {
  readonly view: ViewDescriptor;
  readonly at: Vec3;
  /** A point inside the piece's chunk. */
  readonly in: GroundPoint;
}

const ORIGIN: Vec3 = { x: 0, y: 0, z: 0 };

/**
 * The zone's yards paved (asphalt over the riverside wood's lawn, which reaches far past the
 * fence and stays), one piece per chunk; the hall's shell; the barriers, one view per chunk.
 */
export const W3_SCENERY: readonly W3SceneryItem[] = [
  ...[true, false].map((west): W3SceneryItem => {
    const outline = clipX(W3_ZONE, CHUNK_SEAM, west);
    return { view: { kind: "ground", surface: "road", outline }, at: ORIGIN, in: { x: CHUNK_SEAM + (west ? -10 : 10), z: 420 } };
  }),
  ...W3_HALL_SHELL.map((s): W3SceneryItem => ({ view: s.view, at: s.at, in: { x: s.at.x, z: s.at.z } })),
  ...[true, false].map((west): W3SceneryItem => {
    const items = W3_BARRIERS.filter((i) => (i.x < CHUNK_SEAM) === west);
    return { view: { kind: "street-props", items }, at: ORIGIN, in: { x: CHUNK_SEAM + (west ? -10 : 10), z: 420 } };
  }),
];
