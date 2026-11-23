import { CLUTTER, type StreetPropItem, roomDetailShape } from "@seki/core";
import { CAR_WASH_PLACE } from "./lublin/sites";
import { groundY } from "./lublin/terrain";

/*
 * The scene of MYJNIA 24H and the yard behind it after its card (`docs/lokacje/myjnia-podworko.md`, ADR-0102 point 5):
 * what the wash and the yard need besides the blocks of `district-car-wash.ts`, as street pieces drawn with the
 * furniture (vertices, not draw calls). Pure data, world metres, each piece on the ground under it.
 *
 * - The wash works (ink `enc_s7_neko`): the gantry with its brushes, spray arch and dryer over the car (Blender,
 *   `tools/blender/rooms/car_wash.py`, drawn where the gantry's solids stand), the bay's wet floor with the drain the hot
 *   water steams from, the chemistry and the hose by the machine room, its pump and service door on the yard's side, the
 *   payment post at the way in, the tubes under the canopy.
 * - The yard shut off from the car park by things that may stand on a car park (the card's §Topografia: the car park is
 *   real, no wall): a 20 ft container along its east side from the machine room's corner and a crowd barrier, the one
 *   tight way in from Lubartowska between them (§12, compression and release), lit by a park lamp (§13: the way is the
 *   lit one); the way from the Ratusz along the machine room lit dimmer, by a cold lantern on its wall (two ways, §9).
 * - The clutter in clusters (§14): round the courier's feet (his parcel in the bag), by the dumpsters (bags, cartons,
 *   a bottle, a cup: the odds and ends of ADR-0096).
 */

/** A point of the car wash's old frame (`CAR_WASH_PLACE`) in the world. */
const at = (x: number, z: number): { x: number; z: number } => ({ x: CAR_WASH_PLACE.x + x, z: CAR_WASH_PLACE.z + z });

const piece = (prop: StreetPropItem["prop"], x: number, z: number, yaw: number, variant: number, up = 0): StreetPropItem => {
  const p = at(x, z);
  return { prop, x: p.x, y: groundY(p.x, p.z) + up, z: p.z, yaw, variant };
};

/** A model of the wash (`ROOM_DETAIL_SHAPES`), on the ground or `up` over the pad (the canopy's underside). */
const model = (key: string, x: number, z: number, yaw: number, up?: number): StreetPropItem => {
  if (up === undefined) return piece("room-detail", x, z, yaw, roomDetailShape(key));
  const p = at(x, z);
  return { prop: "room-detail", x: p.x, y: CAR_WASH_PLACE.y + up, z: p.z, yaw, variant: roomDetailShape(key) };
};

/** The odds and ends of ADR-0096 by shape (`CLUTTER_SHAPES`). */
const odd = (shape: number, x: number, z: number, yaw: number): StreetPropItem => piece("clutter", x, z, yaw, shape);

/** The yard's east side (old frame): the container's middle, the crowd barrier's, the gap between them. */
export const YARD_EAST = { x: 24.4, container: 36.63, barrier: 42.54 } as const;
/** The tight way in from Lubartowska, between the container's north end and the barrier's south end (old z). */
export const YARD_GAP = { x: YARD_EAST.x, from: YARD_EAST.container + 3.03, to: YARD_EAST.barrier - 1.42 } as const;

/** Where the hot water from the bay steams out of its drain (old frame), the renderer's steam and the ambience's hiss. */
export const BAY_DRAIN = { x: 8.7, z: 30.5 } as const;

/** The courier's spot (old frame): on the pad's level ground under the red lamp (G-754's pad ends at old z 39). */
export const COURIER_SPOT = { x: 1, z: 38.4 } as const;

export const CAR_WASH_DETAIL: readonly StreetPropItem[] = [
  // The wash: the gantry where its legs' solids stand, the bay's floor from its drain, the machine room's yard wall,
  // the chemistry against its west wall in the bay, the payment post at the way in, the canopy's tubes.
  model("rd-cw-gantry", 12.5, 30.5, 0),
  model("rd-cw-bay", BAY_DRAIN.x, BAY_DRAIN.z, 0),
  model("rd-cw-machine", 18, 35, 0),
  model("rd-cw-chem", 15, 27, -Math.PI / 2),
  model("rd-cw-pay", 6.8, 32.6, Math.PI),
  model("rd-cw-tubes", 11.6, 30.5, 0, 4.27),
  // What the courier left round his feet.
  model("rd-cw-courier", COURIER_SPOT.x + 0.3, COURIER_SPOT.z + 0.3, 0),
  // The yard's east side: the container from the machine room's corner, the barrier to the footway, the gap between.
  piece("container", YARD_EAST.x, YARD_EAST.container, Math.PI / 2, 0),
  odd(CLUTTER.railings[1][0], YARD_EAST.x, YARD_EAST.barrier, Math.PI / 2),
  // The way's light by the gap; the dimmer, cold one on the machine room's east wall, over the way from the Ratusz.
  piece("lamp-park", 22.4, 41.8, Math.PI / 2, 0),
  piece("lamp-wall-lantern", 21, 27, Math.PI / 2, 1),
  // By the big dumpster's west side and the small one's south end: bags, cartons, a bottle, a cup.
  odd(CLUTTER.bags[0], 9.2, 38.1, 0.4),
  odd(CLUTTER.bags[1], 9.35, 37.25, 2.1),
  odd(CLUTTER.boxes[0], 9.1, 36.5, 0.2),
  odd(CLUTTER.litter[0], 9.5, 36.6, 1.3),
  odd(CLUTTER.litter[1], 8.85, 37.7, 0.7),
  odd(CLUTTER.bags[1], 3.7, 36.85, 0.9),
  odd(CLUTTER.boxes[1], 4.45, 36.7, -0.3),
  odd(CLUTTER.litter[0], 4.9, 37.1, 2.6),
];
