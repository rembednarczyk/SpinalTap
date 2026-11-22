import { type StreetPropItem, roomDetailShape } from "@seki/core";
import { capsulePoint } from "./capsule-room";

/*
 * The capsule room's detail after its card (`docs/pomieszczenia/capsule.md`, ADR-0098): the models Blender builds
 * (`tools/blender/rooms/capsule.py`) on the bought model's surfaces, measured in Blender (the counter at 0.87 m, the
 * sink's basin at 0.67, the mattress at 0.92, the chest's lid at 0.44), and on the game's walls (the front wall's
 * inner face at model z 2.24, the side walls at x ±1.86). Placed in the model's coordinates (`capsulePoint`: x east,
 * z towards the door, the world's -z): a model's front (+z) faces the world's +z (into the room from the front wall)
 * at yaw 0, -x at -π/2, +x at π/2, -z at π. Drawn only: none of them is in a body's way (the door's leaf lies on the
 * wall beside the doorway, the bag in the corner by it), so the room's solids stay as they were. Pure data.
 */

const item = (key: string, x: number, y: number, z: number, yaw: number): StreetPropItem => {
  const p = capsulePoint(x, y, z);
  return { prop: "room-detail", x: p.x, y: p.y, z: p.z, yaw, variant: roomDetailShape(key) };
};

/** The front wall's inner face and the east wall's, in the model's metres. */
const FRONT_FACE = 2.235;
const EAST_FACE = 1.86;

export const CAPSULE_DETAIL: readonly StreetPropItem[] = [
  // The sliding door pushed open over the wall east of the doorway, its rail over it, the card lock past the west jamb.
  item("rd-capsule-door", 1.27, 0, FRONT_FACE, 0),
  // Coat hooks on the east wall by the door, facing the room.
  item("rd-capsule-hooks", EAST_FACE, 0, 1.55, -Math.PI / 2),
  // The rubbish in the corner west of the doorway, the pizza box against the wall.
  item("rd-capsule-trash", -0.95, 0, 1.95, 0),
  // The dishes in the sink's basin, the food on the counter by the hob (the wall at the model's west).
  item("rd-capsule-sink", -1.45, 0.67, 0.8, 0),
  item("rd-capsule-food", -1.55, 0.87, 1.4, Math.PI / 2),
  // The towel on the mattress, its end over the mattress's front edge (model z -0.7) onto the frame's lip (0.81 m).
  item("rd-capsule-towel", 0.9, 0.92, -0.9, Math.PI),
  // The phone and its cable on the chest's lid, the socket on the east wall.
  item("rd-capsule-charger", 1.54, 0.44, 0.0, 0),
  // The rental card on the front wall west of the card lock.
  item("rd-capsule-rules", -0.95, 1.38, FRONT_FACE, 0),
];
