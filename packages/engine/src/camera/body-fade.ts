import type { Vec3 } from "@seki/core";

/** Closer than this (horizontally, camera to the figure's axis) the figure fades whatever it covers. */
export const FADE_NEAR = 1;
/** Fully faded at this distance and closer. */
const FADE_NEAR_FULL = 0.55;
/** Half width of the figure with the gun held out, round its vertical axis. */
export const FADE_BODY_RADIUS = 0.42;
/** Faded figure: the share of each dot cell left out; the dots that stay keep its shape readable. */
export const FADE_MAX = 0.75;

const smooth = (t: number): number => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

/**
 * How much the player's figure should fade in the TPP view (G-275), 0..1: when the camera is
 * pulled in close to it, or when the line of the crosshair passes through it. The figure is a
 * vertical capsule from the feet `base` up `height` metres; `forward` is the view direction.
 */
export const bodyFadeTarget = (camera: Vec3, forward: Vec3, base: Vec3, height: number): number => {
  const near = 1 - smooth((Math.hypot(camera.x - base.x, camera.z - base.z) - FADE_NEAR_FULL) / (FADE_NEAR - FADE_NEAR_FULL));
  // Closest pass of the crosshair's line to the figure's axis, sampled up the axis.
  let closest = Infinity;
  for (let i = 0; i <= 8; i++) {
    const q = { x: base.x - camera.x, y: base.y + (height * i) / 8 - camera.y, z: base.z - camera.z };
    const t = q.x * forward.x + q.y * forward.y + q.z * forward.z;
    if (t <= 0) continue;
    closest = Math.min(closest, Math.hypot(q.x - forward.x * t, q.y - forward.y * t, q.z - forward.z * t));
  }
  const covers = 1 - smooth((closest - FADE_BODY_RADIUS) / 0.1);
  return Math.max(near, covers);
};

/** The eased fade of the player's figure in the TPP view, told to whoever draws it as it changes. */
export class BodyFade {
  private amount = 0;
  /** Fade of the figure in front of the camera, 0 solid .. 1 gone; called when it changes. */
  onChange: (amount: number) => void = () => {};

  /** Eases towards `want` (0..1) of the full fade. */
  update(want: number, dt: number): void {
    const goal = want * FADE_MAX;
    const next = this.amount + (goal - this.amount) * Math.min(1, dt * 10);
    // Snapped once close, so a settled fade stops calling back every frame.
    const amount = Math.abs(goal - next) < 0.01 ? goal : next;
    if (amount === this.amount) return;
    this.amount = amount;
    this.onChange(amount);
  }
}
