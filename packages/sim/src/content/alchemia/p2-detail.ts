import { type StreetPropItem, roomDetailShape } from "@seki/core";
import { P2 } from "./p2";
import { P2_AISLE, P2_CONTROL, P2_LANE } from "./p2-store";

/*
 * P-2's detail after its card (`docs/pomieszczenia/alchemia-p2.md`, ADR-0098): the models Blender builds
 * (`tools/blender/rooms/alchemia_p2.py`) besides the pallets, cars, racks, rails, beacons, robots and the control room's
 * console of `p2-store.ts`: the technician's things by the control room's door, the control cabinet in it, pipes and
 * caged lamps over the service aisle, oil on the lane. Drawn only, against the walls, under the ceiling and on the
 * floor: P-2's solids stay. A model's front (+z) faces the world's +z at yaw 0, -x at -π/2 (its x along the world's
 * +z, its back at its origin's x plus its depth). Pure data.
 */

const item = (key: string, x: number, up: number, z: number, yaw: number): StreetPropItem => ({ prop: "room-detail", x, y: P2.floor + up, z, yaw, variant: roomDetailShape(key) });

const EAST = P2.maxX - P2.wall;
const HIGH = P2.ceiling - P2.floor;
const AISLE_MID = (P2_AISLE.x0 + P2_AISLE.x1) / 2;

export const P2_DETAIL: readonly StreetPropItem[] = [
  // The technician's overalls, toolbox, canister and rags on the control room's north wall, east of its door.
  item("rd-p2-tech", 416.9, 0, P2_CONTROL.maxZ, 0),
  // The control cabinet against the control room's east wall, facing the console.
  item("rd-p2-cabinet", EAST - 0.25, 0, 5.8, -Math.PI / 2),
  // Pipes under the ceiling along the east wall, north of the control room; caged lamps over the aisle.
  item("rd-p2-pipes", EAST - 0.2, HIGH - 0.2, (8.0 + 31.4) / 2, -Math.PI / 2),
  ...[11, 18, 25].map((z) => item("rd-p2-lamp", AISLE_MID, HIGH, z, 0)),
  // Oil on the lane between its rails.
  item("rd-p2-oil", (P2_LANE.x0 + P2_LANE.x1) / 2, 0.001, 14.0, 0),
];
