import type { StreetPropItem } from "@seki/core";
import type { CrowdSpot } from "./crowd-spot";
import { ACTIVITY_SPOTS } from "./activity-spots";
import { furnitureClearance } from "./furniture-index";
import { inBuilding, nearestWall } from "./lublin/places";
import { SEAT_KINDS, type SeatSpot, seatGroups } from "./lublin/seats";
import { groundY } from "./lublin/terrain";
import { WORLD_CHUNKS, WORLD_STREET_PROPS } from "./world-map";

/**
 * The residents' places at the street furniture (ADR-0050): sitting on the benches and in the
 * café gardens, talking by a garden's fence, queueing at a kiosk, waiting under a bus shelter.
 * Groups, taken whole by the standers of a chunk. Pure data of the map's furniture, chosen once:
 * per chunk the groups in an order of their position's hash, kept apart from each other, from
 * the walls, the passers-by's spots and the named characters.
 */

/** Most groups a chunk offers; its standers take some of them (the seed picks which). */
const GROUPS_PER_CHUNK = 14;
/** Groups' first spots keep this far apart, so one square is not a single crowd (m). */
const GROUP_SPACING = 7;
/** Every spot keeps this far from a wall (a body and a little air). */
const WALL_CLEARANCE = 0.5;
/** And this far from the passers-by's spots and the named characters' places. */
const OTHERS_CLEARANCE = 1.3;
/** And a body's radius from every solid piece of furniture, its own seat's bench included. */
const BODY_CLEARANCE = 0.39;

/** Integer hash of a position, for an order that does not depend on the table's. */
const hashOf = (x: number, z: number): number => {
  let h = Math.imul(Math.round(x * 10), 73856093) ^ Math.imul(Math.round(z * 10), 19349663);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return (h ^ (h >>> 15)) >>> 0;
};

const named = WORLD_CHUNKS.flatMap((c) => c.actors.map((a) => a.spawn.position)).filter((p) => Math.abs(p.y - groundY(p.x, p.z)) < 1);

const spotFits = (s: SeatSpot, bounds: { minX: number; maxX: number; minZ: number; maxZ: number }): boolean =>
  s.x >= bounds.minX &&
  s.x <= bounds.maxX &&
  s.z >= bounds.minZ &&
  s.z <= bounds.maxZ &&
  !inBuilding(s.x, s.z) &&
  nearestWall(s.x, s.z).d >= WALL_CLEARANCE &&
  furnitureClearance(s.x, s.z) >= BODY_CLEARANCE &&
  !ACTIVITY_SPOTS.some((a) => Math.hypot(a.at.x - s.x, a.at.z - s.z) < OTHERS_CLEARANCE) &&
  !named.some((p) => Math.hypot(p.x - s.x, p.z - s.z) < OTHERS_CLEARANCE);

const chunkSpots = (chunk: string, bounds: { minX: number; maxX: number; minZ: number; maxZ: number }, items: readonly StreetPropItem[]): CrowdSpot[] => {
  const groups = items
    .filter((i) => SEAT_KINDS.has(i.prop))
    .flatMap((i) => seatGroups(i))
    .filter((g) => g.length > 0 && g.every((s) => spotFits(s, bounds)))
    .sort((a, b) => hashOf(a[0]!.x, a[0]!.z) - hashOf(b[0]!.x, b[0]!.z));
  const taken: SeatSpot[][] = [];
  for (const g of groups) {
    if (taken.length >= GROUPS_PER_CHUNK) break;
    const first = g[0]!;
    if (taken.some((t) => Math.hypot(t[0]!.x - first.x, t[0]!.z - first.z) < GROUP_SPACING)) continue;
    taken.push(g);
  }
  return taken.flatMap((g, k) =>
    g.map((s): CrowdSpot => ({ chunk, at: { x: s.x, y: groundY(s.x, s.z), z: s.z }, yaw: s.yaw, does: s.does, group: `${chunk}:seat-${k}`, ...(s.indoor ? { indoor: true as const } : {}) })),
  );
};

/** The furniture's crowd spots of every chunk, in the chunk table's order. */
export const SEAT_SPOTS: readonly CrowdSpot[] = WORLD_CHUNKS.flatMap((c) => chunkSpots(c.id, c.bounds, WORLD_STREET_PROPS[c.id] ?? []));
