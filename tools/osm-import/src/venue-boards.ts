/**
 * Where the renderer hangs the venues' boards (ADR-0064 stage 4), for the street furniture and
 * the glitch scan: every building view framed as the map city frames it (its neighbours hide
 * walls, landmarks keep their own signs) and its boards from the renderer's own `venueBoards`, so
 * the board's place has one source. It reads the renderer's modules: Node loads it through
 * Vite's module runner (`props.ts`), the tests directly.
 */
import type { Vec3, ViewDescriptor } from "../../../packages/core/src";
import { type FacadeFrame, type Wall, facadeFrame } from "../../../packages/engine/src/renderer/mapcity/facade-frame";
import { landmarkAt } from "../../../packages/engine/src/renderer/mapcity/landmarks";
import { mapBuilding } from "../../../packages/engine/src/renderer/mapcity/map-building";
import { boundsOf, cleanRing, pointInRing } from "../../../packages/engine/src/renderer/mapcity/polygon";
import { venueBoards } from "../../../packages/engine/src/renderer/mapcity/venue-plan";
import { WORLD_SCENERY } from "../../../packages/sim/src/content/world-map";
import type { BoardSpan } from "./props-boards.ts";

/** A view the renderer draws for good and where it stands (the sim's `SceneryItem`). */
export interface DrawnView {
  readonly view: ViewDescriptor;
  readonly at: Vec3;
}

const point = (w: Wall, u: number) => ({ x: w.a.x + ((w.b.x - w.a.x) * u) / w.length, z: w.a.z + ((w.b.z - w.a.z) * u) / w.length });

/** A building of the map city as the renderer frames it, with its view and whether it is a landmark (its own model and signs). */
export interface FramedBuilding {
  readonly frame: FacadeFrame;
  readonly view: Extract<ViewDescriptor, { kind: "building" }>;
  readonly at: Vec3;
  readonly landmark: boolean;
}

/** Every building view among `views` framed as the map city frames it. */
export const cityFrames = (views: readonly DrawnView[]): FramedBuilding[] => {
  const buildings = views.flatMap(({ view, at }) => {
    if (view.kind !== "building") return [];
    const ring = cleanRing(view.outline.map((p) => ({ x: p.x + at.x, z: p.z + at.z })));
    return ring.length < 3 ? [] : [{ ring, view, at, bounds: boundsOf(ring) }];
  });
  // The map city's `neighbourAt`: the top of another building over the point.
  const neighbour = (x: number, z: number, self: number): number | null => {
    let top: number | null = null;
    buildings.forEach((b, i) => {
      if (i + 1 === self || x < b.bounds.minX || x > b.bounds.maxX || z < b.bounds.minZ || z > b.bounds.maxZ) return;
      if (pointInRing({ x, z }, b.ring)) top = Math.max(top ?? -Infinity, b.at.y + b.view.height);
    });
    return top;
  };
  return buildings.map((b, i) => ({ frame: facadeFrame(mapBuilding(i + 1, b, () => null), neighbour), view: b.view, at: b.at, landmark: landmarkAt(b.at.x, b.at.z, b.view.outline.length) !== null }));
};

/** Every venue board of the city's buildings among `views`. */
export const cityVenueBoards = (views: readonly DrawnView[]): BoardSpan[] =>
  cityFrames(views).flatMap((b) => {
    if (!b.view.venues?.length || b.landmark) return [];
    return venueBoards(b.frame).map((v) => ({
      a: point(v.wall, v.u - v.width / 2),
      b: point(v.wall, v.u + v.width / 2),
      nx: v.wall.nx,
      nz: v.wall.nz,
      bottom: v.y - v.height / 2,
      top: v.y + v.height / 2,
      wallA: v.wall.a,
      wallB: v.wall.b,
      text: v.text,
    }));
  });

/** The boards of Lublin as the game draws it. */
export const lublinVenueBoards = (): BoardSpan[] => cityVenueBoards(WORLD_SCENERY);
