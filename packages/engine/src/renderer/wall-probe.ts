import { type AbstractMesh, Ray, type Scene, Vector3 } from "../babylon";
import type { CameraOccluder } from "../camera/camera-rig";
import type { WallProbe } from "./body-lay";

/**
 * Walls for a lying body (G-458): the scene's blockers (the props' boxes, as for the TPP camera)
 * and the simulation's own ray through its solids, the map's buildings, the street furniture and
 * the terrain (`ray`, handed over by the app as the camera's occluder is). The nearer of the two;
 * null when neither is within `max`.
 */
export const wallProbe =
  (scene: Scene, isBlocker: (mesh: AbstractMesh) => boolean, ray: () => CameraOccluder | null): WallProbe =>
  (origin, dir, max) => {
    const hit = scene.pickWithRay(new Ray(new Vector3(origin.x, origin.y, origin.z), new Vector3(dir.x, dir.y, dir.z), max), isBlocker);
    const near = hit?.hit ? hit.distance : null;
    const far = ray()?.(origin, dir, max) ?? null;
    return near === null ? far : far === null ? near : Math.min(near, far);
  };
