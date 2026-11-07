import { type AbstractMesh, Ray, type Scene, Vector3 } from "../babylon";
import type { CameraOccluder } from "../camera/camera-rig";
import type { WallProbe } from "./body-lay";

/**
 * Walls for a lying body (G-458): what stops the TPP camera, the scene's blockers (the props'
 * boxes) and the simulation's own ray through the map's buildings and terrain (the camera's
 * occluder, ADR-0045). The nearer of the two; null when neither is within `max`.
 */
export const wallProbe =
  (scene: Scene, isBlocker: (mesh: AbstractMesh) => boolean, occluder: () => CameraOccluder | null): WallProbe =>
  (origin, dir, max) => {
    const hit = scene.pickWithRay(new Ray(new Vector3(origin.x, origin.y, origin.z), new Vector3(dir.x, dir.y, dir.z), max), isBlocker);
    const near = hit?.hit ? hit.distance : null;
    const far = occluder()?.(origin, dir, max) ?? null;
    return near === null ? far : far === null ? near : Math.min(near, far);
  };
