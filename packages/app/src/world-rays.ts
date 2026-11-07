import type { Vec3 } from "@seki/core";
import { type Simulation, rayGeometry } from "@seki/sim";

/** A ray through the world's static geometry: distance to the first hit, or null within `maxDist`. */
type WorldRay = (origin: Vec3, dir: Vec3, maxDist: number) => number | null;

/** What of the renderer asks the simulation about its solids. */
export interface RayClient {
  readonly rig: { setOccluder(ray: WorldRay | null): void };
  wallRay: WorldRay | null;
}

/**
 * Hands the simulation's own rays to the renderer (the current simulation of `sim()`, which a new
 * game or a load replaces):
 * - the TPP camera stops at the map's buildings and the terrain (ADR-0045) and looks past the
 *   street furniture (ADR-0050);
 * - a lying body is laid clear of every solid, the street furniture too (G-458).
 */
export const connectWorldRays = (renderer: RayClient, sim: () => Simulation): void => {
  renderer.rig.setOccluder((origin, dir, maxDist) => rayGeometry(sim().world, origin, dir, maxDist, true));
  renderer.wallRay = (origin, dir, maxDist) => rayGeometry(sim().world, origin, dir, maxDist);
};
