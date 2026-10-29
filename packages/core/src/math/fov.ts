/**
 * Field of view (ADR-0049). The setting is a horizontal angle, so the same number shows the
 * same width of the street on a 16:9 monitor and on a phone held sideways. Between
 * `FOV_ASPECT_RANGE` the horizontal angle is kept exactly; a narrower screen (4:3, portrait)
 * keeps the vertical angle of 4:3, and a wider one (21:9) keeps the vertical angle of the
 * widest phone, so it gains a little width instead of losing height.
 */

/** Screen proportions the setting is quoted at: 16:9. */
export const FOV_REFERENCE_ASPECT = 16 / 9;

/** Aspects (width / height) that keep the horizontal field of view exactly. */
export const FOV_ASPECT_RANGE: readonly [number, number] = [4 / 3, 2.2];

export const degToRad = (deg: number): number => (deg * Math.PI) / 180;
export const radToDeg = (rad: number): number => (rad * 180) / Math.PI;

/** Horizontal angle seen through a vertical one on a screen of `aspect` (radians). */
export const horizontalFovOf = (vertical: number, aspect: number): number => 2 * Math.atan(Math.tan(vertical / 2) * aspect);

/**
 * Vertical angle (radians) for the camera that shows `horizontal` across a screen of `aspect`;
 * outside `FOV_ASPECT_RANGE` the aspect is held at the range's edge.
 */
export const verticalFov = (horizontal: number, aspect: number): number => {
  const a = Number.isFinite(aspect) && aspect > 0 ? Math.min(FOV_ASPECT_RANGE[1], Math.max(FOV_ASPECT_RANGE[0], aspect)) : FOV_REFERENCE_ASPECT;
  return 2 * Math.atan(Math.tan(horizontal / 2) / a);
};
