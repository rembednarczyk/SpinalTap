import type { EntityId, Transform } from "@seki/core";
import type { CharacterRig } from "./character-rig";
import type { Shoulder } from "./knockout-pose";

/**
 * How close (metres) a knocked-out body stands to the followed character when that one carries it:
 * the simulation puts a carried body right on its carrier (ADR-0065), a lying one is kept a body's
 * width away by the push-out.
 */
const CARRIED_WITHIN = 0.3;

/** A character view as far as carrying goes: where it stands and its rig. */
export interface Carrier {
  readonly rig: CharacterRig;
  readonly transform: Transform;
}

/**
 * The followed character's left shoulder (the TPP camera looks over the right one) in the frame
 * of the knocked-out body `id` at `t` it carries; null when it is not carried. The simulation names
 * no carrier, so a body on the followed character's spot is taken as on its shoulder.
 */
export const carriedShoulder = (id: EntityId, t: Transform, followed: EntityId | null, views: ReadonlyMap<EntityId, Carrier>): Shoulder | null => {
  if (!t.unconscious || followed === null || followed === id) return null;
  const carrier = views.get(followed);
  if (!carrier) return null;
  const c = carrier.transform.position;
  if (Math.hypot(c.x - t.position.x, c.z - t.position.z) > CARRIED_WITHIN || Math.abs(c.y - t.position.y) > CARRIED_WITHIN) return null;
  const arm = carrier.rig.armL.position;
  return { x: arm.x, y: arm.y + carrier.rig.body.position.y, z: arm.z };
};
