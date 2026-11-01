import { cellKey } from "../../../packages/engine/src/renderer/mapcity/map-index";
import { PROP_BLOCK } from "../../../packages/engine/src/renderer/mapcity/prop-shapes";
import { isPoleLamp } from "../../../packages/engine/src/renderer/mapcity/utility-poles";
import { crossingBands } from "../../../packages/sim/src/content/lublin/crossing-bands";
import { MAP_CHUNKS, PASSAGES } from "../../../packages/sim/src/content/lublin/sites";
import { groundY, surfaceY } from "../../../packages/sim/src/content/lublin/terrain";
import { WORLD_SCENERY } from "../../../packages/sim/src/content/world-map";
import { loadBuildingTags } from "../../osm-import/src/props-art.ts";
import { cityVenueBoards } from "../../osm-import/src/venue-boards.ts";
import type { DecalWorld } from "./decal-pieces";

/** The decals' checks' world for Lublin as the game draws it (`decal-pieces.ts`). */

type Pt = { readonly x: number; readonly z: number };

const ring = (flat: readonly number[], dx = 0, dz = 0): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push({ x: flat[i]! + dx, z: flat[i + 1]! + dz });
  return out;
};

const grounds = (surface: string): Pt[][] => MAP_CHUNKS.flatMap((c) => c.ground.filter((g) => g.surface === surface && !g.bridge).map((g) => ring(g.outline)));

export const lublinDecalWorld = (): DecalWorld => {
  const tags = loadBuildingTags();
  const ids = new Map<string, string>();
  for (const c of MAP_CHUNKS) for (const b of c.buildings) ids.set(`${b.x.toFixed(2)},${b.z.toFixed(2)}`, b.id);
  return {
    views: WORLD_SCENERY,
    boards: cityVenueBoards(WORLD_SCENERY),
    passages: PASSAGES,
    roads: grounds("road"),
    sidewalks: grounds("sidewalk"),
    crossings: crossingBands(MAP_CHUNKS),
    groundY,
    surfaceY,
    districtAt: (p) => MAP_CHUNKS.find((c) => p.x >= c.bounds.minX && p.x < c.bounds.maxX && p.z >= c.bounds.minZ && p.z < c.bounds.maxZ)?.district ?? "",
    tagsAt: (at) => tags.get((ids.get(`${at.x.toFixed(2)},${at.z.toFixed(2)}`) ?? "").split("/")[0]!) ?? {},
    blockOf: (p) => cellKey(p.x, p.z, PROP_BLOCK),
    poleLamp: (p) =>
      isPoleLamp({
        prop: "lamp-road",
        x: p.x,
        y: 0,
        z: p.z,
        yaw: 0,
        shape: 0,
        scale: 1,
      }),
  };
};
