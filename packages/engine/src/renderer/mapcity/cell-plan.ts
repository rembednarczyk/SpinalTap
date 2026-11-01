import type { MeshSink } from "../mesh-sink";
import type { FacadeFrame } from "./facade-frame";
import { type ObstacleQuery, type PropPlacer, planFacadeExtras } from "./facade-props";
import { planFarBuilding, planNearBuilding } from "./facade-plan";
import { isLandmarkFrame, planFarLandmark, planLandmarkCables, planLandmarkSigns, planNearLandmark } from "./landmarks";
import { type SignGround, planBuildingSigns } from "./sign-plan";
import { planVenueSigns } from "./venue-plan";
import { planFarVertical, planNearVertical } from "./vertical-plan";
import { planWallClutter } from "./wall-clutter";

/**
 * The buildings of a map city cell, planned into its sinks: a landmark from its recipe
 * (ADR-0062), every other building from the facade plan with its superstructure (ADR-0051),
 * clutter and signs.
 */

/**
 * The far solids and the signs of a cell's buildings; `nameSlot` gives a name's row in the atlas,
 * `lite` (the low quality) draws the venues' signs without their streaks.
 */
export const planFarFrames = (far: MeshSink, signs: MeshSink, frames: readonly FacadeFrame[], nameSlot: (name: string) => number | null, ground: SignGround, lite = false): void => {
  for (const f of frames) {
    if (isLandmarkFrame(f)) {
      planFarLandmark(far, f);
      planLandmarkSigns(signs, f, nameSlot);
      continue;
    }
    planFarBuilding(far, f);
    planFarVertical(far, f);
    planBuildingSigns(signs, f, nameSlot, ground);
    planVenueSigns(signs, f, ground, lite);
  }
};

/** The detailed buildings of a cell; `place` takes the facade props (none on the low quality's `lite`). */
export const planNearFrames = (sink: MeshSink, frames: readonly FacadeFrame[], lite: boolean, place: PropPlacer | undefined, obstacles: ObstacleQuery): void => {
  for (const f of frames) {
    if (isLandmarkFrame(f)) {
      planNearLandmark(sink, f);
      planLandmarkCables(sink, f);
      continue;
    }
    planNearBuilding(sink, f);
    planNearVertical(sink, f, place);
    if (!lite) planWallClutter(sink, f, place);
    if (!lite && place) planFacadeExtras(f, place, obstacles);
  }
};
