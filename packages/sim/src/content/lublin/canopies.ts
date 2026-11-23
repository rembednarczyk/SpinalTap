/**
 * The map's roofs on posts (`building=roof`, G-063) as solids of the game and views of the
 * scenery: the slab from its soffit to its top over the outline, and the steel posts under it
 * from the ground to the soffit. One walks and drives under them between the posts; the crowd,
 * the furniture and the ground under them are the chunk's as before.
 */
import type { Vec3, ViewDescriptor } from "@seki/core";
import type { PrismDef } from "../../world/prism";
import type { StaticProp } from "../builders";
import type { LublinCanopyData, LublinChunkData } from "./types";

/** A post's side, metres (`tools/osm-import/src/canopies.ts`). */
export const CANOPY_POST = 0.25;

const toPoints = (flat: readonly number[]): { x: number; z: number }[] => Array.from({ length: flat.length >> 1 }, (_, i) => ({ x: flat[2 * i]!, z: flat[2 * i + 1]! }));

/** The posts' centres relative to the roof's (x, z). */
export const canopyPosts = (c: LublinCanopyData): { x: number; z: number }[] => toPoints(c.posts);

/** A roof drawn as a building lifted to its soffit: the slab's edge a plain fascia (the renderer finds its posts by its place). */
export const canopyView = (c: LublinCanopyData): ViewDescriptor => ({
  kind: "building",
  outline: toPoints(c.outline),
  height: c.height,
  levels: 1,
  use: "garage",
  roofShape: "flat",
  look: c.look,
  soffit: c.soffit,
  ...(c.name === undefined ? {} : { name: c.name }),
});

/** The roof and its posts as one solid of the game, drawn as scenery. */
export const canopyProp = (c: LublinCanopyData): StaticProp => {
  const h = CANOPY_POST / 2;
  const posts: PrismDef[] = canopyPosts(c).map((p) => ({
    points: [
      { x: p.x - h, z: p.z - h },
      { x: p.x + h, z: p.z - h },
      { x: p.x + h, z: p.z + h },
      { x: p.x - h, z: p.z + h },
    ],
    bottom: 0,
    top: c.soffit,
  }));
  const slab: PrismDef[] = c.parts.map((part) => ({ points: toPoints(part), bottom: c.soffit, top: c.height }));
  return { center: { x: c.x, y: c.y, z: c.z }, view: canopyView(c), solid: true, prisms: [...slab, ...posts], scenery: true };
};

/** A chunk's roofs on posts as solids, in the data's order. */
export const chunkCanopies = (c: LublinChunkData): StaticProp[] => (c.canopies ?? []).map(canopyProp);

/** A chunk's roofs on posts as views of the scenery. */
/** A view of the scenery (`SceneryItem` of `city.ts`, which reaches this module back through the index). */
type CanopyScenery = { readonly chunk: string; readonly view: ViewDescriptor; readonly at: Vec3 };

export const canopyScenery = (c: LublinChunkData): CanopyScenery[] => chunkCanopies(c).map((p) => ({ chunk: c.id, view: p.view, at: p.center }));
