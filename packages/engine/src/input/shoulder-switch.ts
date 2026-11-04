import type { InputFrame } from "@seki/core";

/** Left stick click on a standard pad: sprint, and while aiming (no sprint then) the shoulder swap. */
export const PAD_LEFT_STICK = 10;

/**
 * The shoulder the TPP camera looks over (G-275), kept by the input adapter like a toggle button
 * and written into every frame, so the simulation's shots start on the side the camera shows. The
 * key flips it; on a pad the left stick click does while aiming, as every other button is taken.
 */
export class ShoulderSwitch {
  /** True over the left shoulder; the settings set it at start and whenever they change. */
  left = false;
  /** Called after a press flipped the side, for the settings to remember it. */
  onChange: (left: boolean) => void = () => {};

  apply(frame: InputFrame, keyPressed: boolean, padStickPressed: boolean): InputFrame {
    if (keyPressed || (padStickPressed && frame.aim)) {
      this.left = !this.left;
      this.onChange(this.left);
    }
    return this.left ? { ...frame, leftShoulder: true } : frame;
  }
}
