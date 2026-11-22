import { type StreetPropItem, roomDetailShape } from "@seki/core";
import { P1, P1_BAYS, P1_CABINS, P1_CONSOLE, P1_PAY, P1_RAMP } from "./parking";

/*
 * P-1's detail after its card (`docs/pomieszczenia/alchemia-parking.md`, ADR-0098): the models Blender builds
 * (`tools/blender/rooms/alchemia_p1.py`) on and beside the pieces of `parking.ts`: the columns' bands, guards and
 * plates, the chargers' screens and cables, the services under the deck's ceiling, the barrier up by the ramp's foot,
 * the in-cabin's screen, the guard's mug on the console, a cone by the pay machine. Drawn only: P-1's solids stay. A
 * model's front (+z) faces the world's +z at yaw 0, +x at π/2 (its x along the world's -z), -z at π. Pure data.
 */

const item = (key: string, x: number, up: number, z: number, yaw: number): StreetPropItem => ({ prop: "room-detail", x, y: P1.floor + up, z, yaw, variant: roomDetailShape(key) });

const W = P1.wall;
/** The deck's aisle between its rows of bays (5 m deep either side), and its columns' middles (0.4 m square). */
const ROW_W = P1.minX + W + 5;
const ROW_E = P1_RAMP.minX - W - 5;
const COLUMNS_X = [ROW_W + 0.2, ROW_E - 0.2];
const COLUMNS_Z = [3.5, 11, 18.5];
const HIGH = P1.ceiling - P1.floor;

export const P1_DETAIL: readonly StreetPropItem[] = [
  ...COLUMNS_X.flatMap((x) => COLUMNS_Z.map((z) => item("rd-p1-column", x, 0, z, 0))),
  // The chargers' faces: their posts stand on the west wall, 0.3 m deep, facing the bays.
  ...P1_BAYS.filter((b) => b.charger).map((b) => item("rd-p1-charger", P1.minX + W + 0.3, 0, b.at.z, Math.PI / 2)),
  item("rd-p1-ceiling", (ROW_W + ROW_E) / 2, HIGH, 13.0, Math.PI / 2),
  // The barrier up on the apron by the ramp's foot, west of its lanes.
  item("rd-p1-barrier", P1_RAMP.minX - 0.4, 0, P1_RAMP.foot + 0.7, Math.PI / 2),
  // The in-cabin's screen on its south wall by the shutter.
  item("rd-p1-cabin-screen", P1_CABINS[0]!.maxX - 0.7, 1.3, P1_CABINS[0]!.minZ, Math.PI),
  item("rd-p1-guard", (P1_CONSOLE.x0 + P1_CONSOLE.x1) / 2, P1_CONSOLE.y1 - P1.floor, (P1_CONSOLE.z0 + P1_CONSOLE.z1) / 2, Math.PI / 2),
  item("rd-p1-floor", P1_PAY.x0 - 0.8, 0, P1_PAY.z0 - 0.55, 0),
];
