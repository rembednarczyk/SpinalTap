import type { InputFrame } from "@seki/core";
import type { LookTuning } from "@seki/engine";
import type { SettingsVm } from "@seki/ui";
import { scaleLook } from "./settings";

/** The part of the engine's BrowserInput that takes the look settings (ADR-0072). */
export interface LookTuningTarget {
  setLookTuning(tuning: LookTuning): void;
}

type LookSettings = Pick<SettingsVm, "mouseSensitivity" | "touchSensitivity" | "padSensitivity" | "padDeadzone" | "padCurve">;

/**
 * Each device's sensitivity goes to the input adapter (ADR-0072, stage 4), which scales mouse,
 * touch and pad look apart before merging them: the pad then has its own sensitivity, dead
 * zone and curve instead of the mouse's or the touch setting.
 */
export const feedLookTuning = (input: LookTuningTarget, s: LookSettings): void =>
  input.setLookTuning({
    mouse: s.mouseSensitivity,
    touch: s.touchSensitivity,
    pad: { sensitivity: s.padSensitivity, deadzone: s.padDeadzone, curve: s.padCurve },
  });

/**
 * What the app still does to the merged look (ADR-0019, ADR-0072): zoomed in, the look slows
 * with the field of view (`lookScale`) and the ADS setting on top; an inverted Y flips the pitch.
 */
export const viewLook = (frame: InputFrame, s: Pick<SettingsVm, "adsSensitivity" | "invertY">, lookScale: number): InputFrame =>
  scaleLook(frame, lookScale * (lookScale < 0.999 ? s.adsSensitivity : 1), s.invertY);
