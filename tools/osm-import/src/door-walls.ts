/**
 * The walls of Lublin's buildings that may take a door (ADR-0058 stage 9), as the renderer draws
 * them: each building framed as the map city frames it (`cityFrames`), and on each wall the slots
 * between or over the panes the facade shader paints, under the venues' boards (`doorSlots`), with
 * the boards themselves. Landmarks (their own models and doors) and lifted footbridges take none.
 * It reads the renderer's modules: Node loads it through Vite's module runner (`props.ts`), the
 * tests directly.
 */
import { boardsOn, doorSlots } from "../../../packages/engine/src/renderer/mapcity/door-slots";
import { glyphCell, venueBoards } from "../../../packages/engine/src/renderer/mapcity/venue-plan";
import { WORLD_SCENERY } from "../../../packages/sim/src/content/world-map";
import type { DoorWall } from "./props-doors.ts";
import { type DrawnView, cityFrames } from "./venue-boards.ts";

/** A venue's name as its board spells it (`venueBoards`: upper case, the letters of the atlas). */
const spelt = (name: string): string =>
  [...name.toUpperCase()]
    .filter((c) => glyphCell(c) !== null)
    .join("")
    .trim();

/** Every wall of the drawn buildings among `views` with a slot for a door, with its boards. */
export const cityDoorWalls = (views: readonly DrawnView[]): DoorWall[] =>
  cityFrames(views).flatMap((b) => {
    if (b.landmark || b.view.soffit !== undefined) return [];
    const f = b.frame;
    const boards = venueBoards(f);
    const building = `${b.at.x.toFixed(1)},${b.at.z.toFixed(1)}`;
    return f.walls.flatMap((w) => {
      const slots = doorSlots(f, w, boards);
      if (slots.length === 0) return [];
      const on = boardsOn(f, w, boards).map((s, k) => {
        const text = boards.filter((x) => x.wall === w)[k]!.text;
        const venue = (b.view.venues ?? []).find((v) => spelt(v.name) === text);
        return { u0: s.u0, u1: s.u1, kind: venue?.kind ?? "shop" };
      });
      return [{ building, use: b.view.use, a: w.a, b: w.b, nx: w.nx, nz: w.nz, length: w.length, base: f.b.base, slots, boards: on }];
    });
  });

/** The height of the paving the renderer draws (ADR-0045), for a door's foot. */
export { surfaceY } from "../../../packages/sim/src/content/lublin/terrain";

/** The door walls of Lublin as the game draws it. */
export const lublinDoorWalls = (): DoorWall[] => cityDoorWalls(WORLD_SCENERY);
