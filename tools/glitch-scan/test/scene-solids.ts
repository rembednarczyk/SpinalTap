import { ARKADY_PROP } from "../../../packages/sim/src/content/alchemia/arkady";
import { inBuilding } from "../../../packages/sim/src/content/lublin/places";
import { WORLD_CHUNKS } from "../../../packages/sim/src/content/world-map";
import { DECK_HEADROOM } from "../../../packages/sim/src/world/deck";
import { type Prism, makePrism, overPrism, prismsAt } from "../../../packages/sim/src/world/prism";

/**
 * The solids of the city's chunks as the scan reads them (`seam-world.ts`, `walk-world.ts`): the
 * map's buildings and the set pieces with their rooms (the Arkady's pavement among Alchemia's),
 * the street's furniture not.
 */

type Prop = (typeof WORLD_CHUNKS)[number]["props"][number];

/** A building of the map, the Arkady rebuilt on their OSM outline among them (`lublin/city.ts`). */
const mapBuilding = (p: Prop): boolean => p.view.kind === "building" || p.prisms === ARKADY_PROP.prisms;

/** A chunk's solids as prisms: its own `prisms`, else a solid block's box; with `buildings`, the map's buildings too. */
const solidsOf = (c: (typeof WORLD_CHUNKS)[number], buildings = true): Prism[] =>
  [...c.props, ...(c.rooms ?? [])].flatMap((p) => {
    if (!p.solid || (!buildings && mapBuilding(p))) return [];
    if (p.prisms) return prismsAt(p.prisms, p.center);
    if (p.view.kind !== "block") return [];
    const { x, y, z } = p.view.size;
    const o = p.center;
    return [makePrism([{ x: o.x - x / 2, z: o.z - z / 2 }, { x: o.x + x / 2, z: o.z - z / 2 }, { x: o.x + x / 2, z: o.z + z / 2 }, { x: o.x - x / 2, z: o.z + z / 2 }], o.y - y / 2, o.y + y / 2)];
  });

/** The solids worked out on the first point that needs them. */
let solids: readonly Prism[] | undefined;
export const SCENE_SOLIDS = (): readonly Prism[] => (solids ??= WORLD_CHUNKS.flatMap((c) => solidsOf(c)));

/** Does the prism hold (x, z)? */
export const holds = (p: Prism, x: number, z: number): boolean => x >= p.box.min.x && x <= p.box.max.x && z >= p.box.min.z && z <= p.box.max.z && overPrism(p, x, z);

/**
 * The solids a walker steps onto, by 4 m square of their boxes (`floorOver` is asked at every cell
 * of the walked raster): not the map's buildings, whose roofs are no floor from the street by them
 * (the review of G-778).
 */
const CELL = 4;
const key = (i: number, k: number) => i * 65536 + k;
let index: Map<number, Prism[]> | undefined;
const solidsAt = (x: number, z: number): readonly Prism[] | undefined => {
  if (!index) {
    index = new Map();
    for (const p of WORLD_CHUNKS.flatMap((c) => solidsOf(c, false))) {
      for (let i = Math.floor(p.box.min.x / CELL); i <= Math.floor(p.box.max.x / CELL); i++) {
        for (let k = Math.floor(p.box.min.z / CELL); k <= Math.floor(p.box.max.z / CELL); k++) {
          const list = index.get(key(i, k));
          if (list) list.push(p);
          else index.set(key(i, k), [p]);
        }
      }
    }
  }
  return index.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
};

/**
 * The floor a walker stands on at (x, z) over the ground `ground` (G-759): a scene's solid over the ground
 * there that leaves no room to walk under it (its bottom less than `DECK_HEADROOM` over it, as the
 * game's ground takes a bridge's deck) is the floor, its top, and so on up a solid on that. As the
 * movement's `groundAt` takes a top: the Arkady's pavement slabs are walked, not the dip of the
 * terrain under them, which goes down past their bottoms by the building's south-east corner. Not
 * in a map building's outline, nor on the rooms cut into it: the ground there stays the terrain,
 * the building's walls `walk-blocked`'s edges (the review of G-778).
 */
export const floorOver = (x: number, z: number, ground: number): number => {
  const near = solidsAt(x, z);
  if (!near) return ground;
  let floor = ground;
  for (let lifted = true; lifted; ) {
    lifted = false;
    for (const p of near) {
      if (p.top > floor && p.bottom < floor + DECK_HEADROOM && holds(p, x, z)) {
        floor = p.top;
        lifted = true;
      }
    }
  }
  return floor !== ground && inBuilding(x, z) ? ground : floor;
};
