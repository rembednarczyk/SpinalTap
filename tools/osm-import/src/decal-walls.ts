/**
 * The walls of Lublin's buildings the decals of ADR-0058 stage 6 may go on, as the renderer draws
 * them: each building framed as the map city frames it (`cityFrames`), with what the rules need of
 * every wall that is drawn (not hidden by a neighbour): its ends, outward normal, the stretch of it
 * left in view over a neighbour, its ground floor and top, whether the facade shader paints any
 * glass on it at all, the venues' boards on it and whether a holo-ad may hang on it. It reads the
 * renderer's modules: Node loads it through Vite's module runner (`props.ts`), the tests directly.
 */
import { type FacadeFrame, type Wall, frameWallMeta, hiddenWall, plinthBand } from "../../../packages/engine/src/renderer/mapcity/facade-frame";
import { cellKey } from "../../../packages/engine/src/renderer/mapcity/map-index";
import { PROP_BLOCK } from "../../../packages/engine/src/renderer/mapcity/prop-shapes";
import { isPoleLamp } from "../../../packages/engine/src/renderer/mapcity/utility-poles";
import { holoMayHang } from "../../../packages/engine/src/renderer/mapcity/sign-plan";
import { MAP_CHUNKS } from "../../../packages/sim/src/content/lublin/sites";
import { WORLD_SCENERY } from "../../../packages/sim/src/content/world-map";
import type { DecalWall } from "./props-decals.ts";
import { type DrawnView, cityFrames, framedBoards } from "./venue-boards.ts";

/**
 * Does the facade shader paint no glass anywhere on the wall? `facadeGlass` returns nothing for a
 * wall whose storey decodes under 0.05 (`facadeDecode`): the plan bakes that for a wall without
 * bays (`wallMeta`: a garage's, a firewall's, one too short for a window). Its first test, not the
 * mask: the mask's port for the panes themselves is ADR-0058 stage 9's (PR #167).
 */
export const glassFree = (f: FacadeFrame, w: Wall): boolean => Math.floor(frameWallMeta(f, w)[0] + 0.0005) / 10 < 0.05;

/** The map's building of a view, by its centre (`chunkBuildings` puts the view's entity there). */
const buildingIds = (): Map<string, { id: string; district: string }> => {
  const out = new Map<string, { id: string; district: string }>();
  for (const c of MAP_CHUNKS)
    for (const b of c.buildings)
      out.set(`${b.x.toFixed(2)},${b.z.toFixed(2)}`, {
        id: b.id,
        district: c.district,
      });
  return out;
};

/** Every drawn wall of the buildings among `views` (landmarks marked, lifted parts left out). */
export const cityDecalWalls = (views: readonly DrawnView[]): DecalWall[] => {
  const ids = buildingIds();
  return cityFrames(views).flatMap((b) => {
    if (b.view.soffit !== undefined) return [];
    const f = b.frame;
    const own = ids.get(`${b.at.x.toFixed(2)},${b.at.z.toFixed(2)}`);
    const boards = b.landmark ? [] : framedBoards(b);
    const building = `${b.at.x.toFixed(1)},${b.at.z.toFixed(1)}`;
    return f.walls.flatMap((w): DecalWall[] => {
      if (hiddenWall(f, w)) return [];
      return [
        {
          building,
          osm: own?.id ?? "",
          district: own?.district ?? "",
          use: b.view.use,
          landmark: b.landmark,
          a: w.a,
          b: w.b,
          nx: w.nx,
          nz: w.nz,
          length: w.length,
          base: f.b.base,
          top: f.top,
          from: w.blind ? Math.max(w.coveredTo, f.b.foot) : f.b.foot,
          blind: w.blind,
          glassFree: glassFree(f, w),
          holo: holoMayHang(f, w),
          band: plinthBand(f.b),
          passages: (f.b.passages?.length ?? 0) + (f.b.doorways?.length ?? 0) > 0,
          neighbourTop: (x, z) => f.neighbour(x, z, f.b.id),
          boards: boards
            .filter((v) => v.wall === w)
            .map((v) => ({
              u0: v.u - v.width / 2,
              u1: v.u + v.width / 2,
              bottom: v.y - v.height / 2,
              top: v.y + v.height / 2,
            })),
        },
      ];
    });
  });
};

/** The height of the paving the renderer draws (ADR-0045) and of the shaped terrain the game puts the furniture on. */
export { groundY, surfaceY } from "../../../packages/sim/src/content/lublin/terrain";

/** The renderer's 256 m block of the street furniture a point is in (`StreetProps`: one mesh each). */
export const furnitureBlock = (p: { readonly x: number; readonly z: number }): string => cellKey(p.x, p.z, PROP_BLOCK);

/** Is a road lamp at p drawn as a utility pole's model (ADR-0063)? No stickers on it. */
export const poleLampAt = (p: { readonly x: number; readonly z: number }): boolean =>
  isPoleLamp({
    prop: "lamp-road",
    x: p.x,
    y: 0,
    z: p.z,
    yaw: 0,
    shape: 0,
    scale: 1,
  });

/** The venues' boards of Lublin (`venue-boards.ts`), for `props.ts` to load through one module runner with the walls. */
export { lublinVenueBoards } from "./venue-boards.ts";
/** The doors' walls of Lublin (ADR-0058 stage 9), through the same runner: one framing of the city. */
export { lublinDoorWalls } from "./door-walls.ts";

/** The decal walls of Lublin as the game draws it. */
export const lublinDecalWalls = (): DecalWall[] => cityDecalWalls(WORLD_SCENERY);
