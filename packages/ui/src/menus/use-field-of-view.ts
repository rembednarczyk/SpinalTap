import { HORIZONTAL_FOV_RANGE } from "../store/ui-store";
import { useCameraIntents, useUi } from "../use-ui";

/** The field of view setting as the settings slider needs it (ADR-0049). */
export interface FieldOfViewControl {
  /** Horizontal degrees from the hip. */
  readonly degrees: number;
  readonly min: number;
  readonly max: number;
  set(degrees: number): void;
}

/** The camera's field of view setting: its value from the store, changes through the camera intent. */
export const useFieldOfView = (): FieldOfViewControl => {
  const degrees = useUi((s) => s.settings.horizontalFov);
  const intents = useCameraIntents();
  return { degrees, min: HORIZONTAL_FOV_RANGE[0], max: HORIZONTAL_FOV_RANGE[1], set: (d) => intents.setFieldOfView(d) };
};
