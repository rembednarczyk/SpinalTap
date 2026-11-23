import { type StreetPropItem, roomDetailShape } from "@seki/core";
import { CLINIC_CHAIR_TOP, clinicPoint } from "./interiors";

/*
 * Doktor Mori's clinic's detail after its card (`docs/pomieszczenia/clinic.md`, ADR-0098): the models
 * Blender builds (`tools/blender/rooms/clinic.py`) standing where the clinic's solids are (`clinic()` of
 * `interiors.ts`, whose blocks are drawn no more). Placed in the room's old coordinates and turned onto
 * its facade by `clinicPoint` (old -x, into the room, is the world's +z; old +z the world's +x): a
 * model's front (+z) faces the world's +z at yaw 0, -z at π, -x at -π/2, and its x runs along the world's
 * z at ±π/2. Pure data.
 */

const item = (key: string, x: number, y: number, z: number, yaw: number): StreetPropItem => {
  const p = clinicPoint(x, y, z);
  return { prop: "room-detail", x: p.x, y: p.y, z: p.z, yaw, variant: roomDetailShape(key) };
};

/** The lamps' heads' underside over the floor (their solids' glass, `clinic()`). */
const LAMP_FOOT = 2.83;

export const CLINIC_DETAIL: readonly StreetPropItem[] = [
  // The bench along the waiting room's back wall, facing the room (old -z).
  item("rd-clinic-bench", -10.0, 0, 7.35, -Math.PI / 2),
  // The reception counter faces the door (old +x).
  item("rd-clinic-reception", -10.2, 0, 2.2, Math.PI),
  item("rd-clinic-counter-things", -10.2, 1.05, 2.4, Math.PI),
  // The chair along old z, its head at the south end, as its solids.
  item("rd-clinic-chair", -14.6, 0, 2.8, 0),
  // The lamp's two heads over the chair, along old z.
  item("rd-clinic-lamp", -14.6, LAMP_FOOT, 2.85, Math.PI / 2),
  // The cart and the cabinet face the room (old +x).
  item("rd-clinic-cart", -13.1, 0, 1.9, Math.PI),
  item("rd-clinic-cabinet", -16.7, 0, 6.95, Math.PI),
  // Kaito's stool on the chair's far side from the cart, where he sat the nights she did not wake (ADR-0102 point 5).
  item("rd-clinic-stool", -15.7, 0, 3.3, 0),
  // The bin for medical waste by the chair's foot.
  item("rd-clinic-sharps", -15.6, 0, 4.4, 0),
  // The washbasin on the surgery's south wall by the chair's head, facing into the room (old +z); the curtain on its
  // rail between the chair and the doorway in the partition, along old z (ADR-0099 batch 2).
  item("rd-k-washbasin", -16.4, 0, 1.3, Math.PI / 2),
  item("rd-k-curtain", -13.65, 0, 2.95, 0),
  // The waiting room's ceiling fittings (the office's suspended pair, `rd-tessen-lights`) along old x, a hair under the
  // ceiling: the source of its light in the interior mode (§13, no light from nowhere).
  item("rd-tessen-lights", -9.6, 3.895, 4.5, 0),
];

/** The chair's seat height the models keep (the wake-up spot lies on it). */
export const CLINIC_DETAIL_SEAT = CLINIC_CHAIR_TOP;
