/** Plain vector: the fit is pure math, testable without a scene. */
export interface V3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Half sizes (m) the moon shadow's square may take, smallest first. A few fixed steps rather than
 * a continuous fit: every change of size moves the texel grid, so edges would crawl with the view.
 */
export const SHADOW_EXTENTS: readonly number[] = [6, 8, 11, 15, 21, 28];

/** How far below the focus the ground the view lands on may lie (steps, slopes). */
const GROUND_BELOW = 1.5;
/** Kept around what the view shows: casters' shadows enter from beyond the edge of the screen. */
const MARGIN = 1;
/** Shrink only when the view fits this share of the smaller step (no flicker at a boundary). */
const SHRINK_AT = 0.85;

/** The view the shadow serves: eye and the world directions of the screen's four corners. */
export interface ShadowView {
  readonly eye: V3;
  readonly corners: readonly V3[];
}

const dot = (a: V3, b: V3): number => a.x * b.x + a.y * b.y + a.z * b.z;

/**
 * Half size the shadow square (in the light's right/up axes, centred on `focus`) needs so every
 * receiver on screen is inside it: the eye and the corner rays' hits on the ground just below the
 * focus. Whatever the view shows lies on those segments, so their ends bound it. A corner that
 * looks above the ground's plane (a far view) needs the whole range: returns `max`.
 */
export const viewReach = (view: ShadowView, focus: V3, right: V3, up: V3, max: number): number => {
  const ground = focus.y - GROUND_BELOW;
  let reach = 0;
  const take = (p: V3): void => {
    const d = { x: p.x - focus.x, y: p.y - focus.y, z: p.z - focus.z };
    reach = Math.max(reach, Math.abs(dot(d, right)), Math.abs(dot(d, up)));
  };
  take(view.eye);
  for (const r of view.corners) {
    if (r.y >= -1e-3 || view.eye.y <= ground) return max;
    const t = (ground - view.eye.y) / r.y;
    take({ x: view.eye.x + r.x * t, y: ground, z: view.eye.z + r.z * t });
  }
  return Math.min(max, reach + MARGIN);
};

/**
 * Next half size of the shadow square from the current one and the reach the view needs: grows at
 * once (a shadow must not drop out of view), shrinks only well inside the smaller step.
 */
export const nextExtent = (current: number, reach: number, max: number): number => {
  const steps = SHADOW_EXTENTS.filter((e) => e < max).concat([max]);
  const fit = steps.find((e) => e >= reach) ?? max;
  if (fit >= current) return fit;
  return Math.min(current, steps.find((e) => e * SHRINK_AT >= reach) ?? max);
};
