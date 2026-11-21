/*
 * The driver's door of a car's close-up opening upward (ADR-0097, the user's request of 21.11): a
 * scissor door as on the Lamborghini Countach, hinged at the top of its front edge, its rear swung up
 * about the car's cross axis until it stands nearly upright over the front wing. The bake keeps it a
 * range of vertices of its own after the wheels (`tools/city_vehicle_doors.py`); the hinge comes from
 * the range's own box, whatever the template's turn and scale. As it rises it moves out a little, as
 * a scissor door's hinge carries it, so it clears the wing and the A-pillar.
 */

/** The door of a template: its vertices, the hinge and the side it is on (-1 left, 1 right of the template). */
export interface DoorPart {
  readonly first: number;
  readonly count: number;
  readonly hinge: { readonly y: number; readonly z: number };
  readonly side: number;
}

/** How far up it swings fully open (rad): short of upright, as a Countach's door. */
export const DOOR_SWING = (80 * Math.PI) / 180;
/** How far out it moves fully open (m). */
export const DOOR_OUT = 0.08;
/** The hinge at this share of the door's height from its sill, and this far behind its front edge (m). */
const HINGE_HEIGHT = 0.7;
const HINGE_IN = 0.03;

/** The door of a template's vertex range [first, count] from its positions (front +z). */
export const doorPart = (positions: Float32Array, [first, count]: readonly [number, number]): DoorPart => {
  let [loY, hiY, hiZ, sumX] = [Infinity, -Infinity, -Infinity, 0];
  for (let v = first; v < first + count; v++) {
    const y = positions[v * 3 + 1] ?? 0;
    loY = Math.min(loY, y);
    hiY = Math.max(hiY, y);
    hiZ = Math.max(hiZ, positions[v * 3 + 2] ?? 0);
    sumX += positions[v * 3] ?? 0;
  }
  return { first, count, hinge: { y: loY + HINGE_HEIGHT * (hiY - loY), z: hiZ - HINGE_IN }, side: sumX < 0 ? -1 : 1 };
};

/**
 * The shape with its door `open` (0 shut .. 1 up) posed into `out`, or `src` itself when it is shut or
 * there is no door. `src` may be `out` (the wheels already posed into it): the door is turned in place.
 */
export const poseDoor = (
  src: { readonly positions: Float32Array; readonly normals: Float32Array },
  part: DoorPart | undefined,
  open: number | undefined,
  out: { positions: Float32Array; normals: Float32Array },
): { readonly positions: Float32Array; readonly normals: Float32Array } => {
  if (!part || !open || open <= 0) return src;
  if (src !== out) {
    if (out.positions.length !== src.positions.length) {
      out.positions = new Float32Array(src.positions.length);
      out.normals = new Float32Array(src.normals.length);
    }
    out.positions.set(src.positions);
    out.normals.set(src.normals);
  }
  // Eased in and out, as a strut lifts it.
  const e = open * open * (3 - 2 * open);
  const a = e * DOOR_SWING;
  const [ca, sa] = [Math.cos(a), Math.sin(a)];
  const dx = part.side * DOOR_OUT * e;
  const { y: hy, z: hz } = part.hinge;
  const p = out.positions;
  const n = out.normals;
  for (let v = part.first; v < part.first + part.count; v++) {
    const o = v * 3;
    // Its rear up about the cross axis through the hinge: a point behind the hinge (dz < 0) rises.
    const dy = (p[o + 1] ?? 0) - hy;
    const dz = (p[o + 2] ?? 0) - hz;
    p[o] = (p[o] ?? 0) + dx;
    p[o + 1] = hy + dy * ca - dz * sa;
    p[o + 2] = hz + dz * ca + dy * sa;
    const ny = n[o + 1] ?? 0;
    const nz = n[o + 2] ?? 0;
    n[o + 1] = ny * ca - nz * sa;
    n[o + 2] = nz * ca + ny * sa;
  }
  return out;
};
