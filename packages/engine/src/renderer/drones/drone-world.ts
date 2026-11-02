import type { GroundPoint, GroundSurface, Vec3, ViewDescriptor } from "@seki/core";
import type { LublinChunkData } from "@seki/sim/lublin";
import { landmarkAt } from "../mapcity/landmarks";
import { type P2, cleanRing } from "../mapcity/polygon";
import type { DroneBuilding, DroneWorld } from "./drone-lanes";

/**
 * What the drones' lanes are planned from (ADR-0058 stage 7), out of the map city's views: the same
 * for the renderer (`MapCity.droneWorld`) and the glitch scan (from the scenery). Pure.
 */

type BuildingView = Extract<ViewDescriptor, { kind: "building" }>;

/** The streets the drones follow, by OSM `highway`: roads and pedestrian streets, not links, service ways or paths. */
export const DRONE_STREETS: ReadonlySet<string> = new Set(["primary", "secondary", "tertiary", "residential", "unclassified", "pedestrian", "living_street"]);

/** The street's surfaces a drone may fly over (ADR-0042): carriageway, pavements, squares; not lawns, water or rails. */
export const DRONE_SURFACES: ReadonlySet<GroundSurface> = new Set(["road", "sidewalk", "square", "cobble", "footway", "steps", "crossing"]);

/** The axes of the map's streets (OSM, clipped per chunk; `joinAxes` joins them again). */
export const streetAxes = (chunks: readonly LublinChunkData[]): P2[][] =>
  chunks.flatMap((c) =>
    c.streets.flatMap((st) => {
      if (!DRONE_STREETS.has(st.kind)) return [];
      const pts: P2[] = [];
      for (let i = 0; i + 1 < st.line.length; i += 2) pts.push({ x: st.line[i] as number, z: st.line[i + 1] as number });
      return pts.length >= 2 ? [pts] : [];
    }),
  );

/** A building's ring in the world. */
export const worldRing = (outline: readonly GroundPoint[], at: Vec3): P2[] => cleanRing(outline.map((p) => ({ x: p.x + at.x, z: p.z + at.z })));

/**
 * A building as the drones see it: the top of its walls, its superstructure (ADR-0051) and its
 * roof; a landmark when a recipe draws it (ADR-0062) or it is a church.
 */
export const droneBuilding = (view: BuildingView, at: Vec3, ring: readonly P2[]): DroneBuilding => ({
  ring,
  top: at.y + view.height + Math.max(0, view.vertical?.rise ?? 0) + Math.max(0, view.roof ?? 0),
  landmark: view.use === "church" || landmarkAt(at.x, at.z, view.outline.length) !== null,
});

/** The world of the lanes from views and where they stand (buildings, the street's surfaces) and the streets' axes. */
export const droneWorldOf = (items: Iterable<{ readonly view: ViewDescriptor; readonly at: Vec3 }>, axes: readonly (readonly P2[])[], groundAt: (x: number, z: number) => number | null): DroneWorld => {
  const buildings: DroneBuilding[] = [];
  const roads: P2[][] = [];
  for (const { view, at } of items) {
    if (view.kind === "building") {
      const ring = worldRing(view.outline, at);
      if (ring.length >= 3) buildings.push(droneBuilding(view, at, ring));
    } else if (view.kind === "ground" && DRONE_SURFACES.has(view.surface)) {
      const ring = worldRing(view.outline, at);
      if (ring.length >= 3) roads.push(ring);
    }
  }
  return { axes, roads, buildings, groundAt };
};
