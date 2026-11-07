import { INTERIORS, type InteriorDef } from "../../../packages/sim/src/content/interior-areas";
import { METRO_PLATFORMS } from "../../../packages/sim/src/content/metro";
import { WORLD_NAV } from "../../../packages/sim/src/content/world-map";
import { groundY } from "../../../packages/sim/src/content/lublin/terrain";

/**
 * The glitch scan's `underground-level-exit` (ADR-0074 §4 and §11, stage 4): every interior of
 * the game's own under the ground has at least two ways out in the level graph (ADR-0021) that a
 * walker, the player's pursuer or one fleeing her, can take. A way out is an edge of the graph
 * from a node in its rooms to one outside them. A metro platform's second way is its train.
 */

type Finding = { readonly at: string; readonly what: string };
type Room = InteriorDef["rooms"][number];
type P3 = { readonly x: number; readonly y: number; readonly z: number };

export interface LevelExitInput {
  readonly interiors: readonly { readonly id: string; readonly rooms: readonly Room[]; readonly extra: number }[];
  readonly nodes: readonly { readonly id: string; readonly at: P3 }[];
  readonly edges: readonly { readonly a: string; readonly b: string }[];
}

/** Feet this far under a room's floor still count as in it (a slab, a step). */
const SLACK = 0.3;

const inRooms = (rooms: readonly Room[], p: P3): boolean => rooms.some((r) => p.x >= r.minX && p.x <= r.maxX && p.z >= r.minZ && p.z <= r.maxZ && p.y >= r.bottom - SLACK && p.y <= r.top);

/** The interiors with fewer than two ways out. */
export const undergroundLevelExits = (input: LevelExitInput): Finding[] => {
  const at = new Map(input.nodes.map((n) => [n.id, n.at]));
  return input.interiors.flatMap((i) => {
    const exits = input.edges.filter((e) => {
      const [a, b] = [at.get(e.a), at.get(e.b)];
      return a !== undefined && b !== undefined && inRooms(i.rooms, a) !== inRooms(i.rooms, b);
    }).length;
    const r = i.rooms[0];
    const where = r ? `${((r.minX + r.maxX) / 2).toFixed(0)},${((r.minZ + r.maxZ) / 2).toFixed(0)}` : "?";
    return exits + i.extra >= 2 ? [] : [{ at: where, what: `${i.id}: ${exits + i.extra} way(s) out` }];
  });
};

/** A room under the ground: its ceiling more than a metre under the terrain over its middle (an interior with one is underground). */
const underground = (r: Room): boolean => r.top < groundY((r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2) - 1;

/**
 * The game's: its own set pieces under the ground (the rooms cut into the map's buildings, as the
 * cellars of Trasa Podziemna, keep the building's doors and are not in the graph), with the
 * level graph of the city.
 */
export const levelExitsInGame = (): LevelExitInput => {
  const platforms = new Set(METRO_PLATFORMS.map((e) => `metro-${e.station}`));
  return {
    interiors: INTERIORS.filter((i) => i.building === null && i.rooms.some(underground)).map((i) => ({ id: i.id, rooms: i.rooms, extra: platforms.has(i.id) ? 1 : 0 })),
    nodes: WORLD_NAV.nodes,
    edges: WORLD_NAV.edges,
  };
};
