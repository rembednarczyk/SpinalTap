import type { FacadeFrame } from "../facade-frame";
import type { LandmarkPart } from "./recipes";

/** A facade frame of a landmark (ADR-0062): its recipe part, and a style with no windows, shops or roof of its own. */
export interface LandmarkFrame extends FacadeFrame {
  readonly landmark: LandmarkPart;
}
