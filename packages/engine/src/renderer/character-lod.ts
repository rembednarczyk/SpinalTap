/**
 * Draw distance of the characters (ADR-0040). Past it a character is a few pixels behind the
 * night haze, yet costs a skinned mesh or three in every pass and its animation; it is switched
 * off until the camera comes closer. The camera's own character always stays.
 */
export const CHARACTER_DRAW_DISTANCE = 60;

/** Is a character at `p` close enough to the camera at `c` to be drawn (on the ground plane)? */
export const withinDrawDistance = (p: { readonly x: number; readonly z: number }, c: { readonly x: number; readonly z: number }, limit = CHARACTER_DRAW_DISTANCE): boolean => {
  const dx = p.x - c.x;
  const dz = p.z - c.z;
  return dx * dx + dz * dz <= limit * limit;
};
