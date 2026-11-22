import { type StreetPropItem, roomDetailShape } from "@seki/core";
import { SHELTER } from "./shelter";

/*
 * The air-raid shelter's detail after its card (`docs/pomieszczenia/alchemia-shelter.md`, ADR-0098): the models Blender
 * builds (`tools/blender/rooms/alchemia_shelter.py`) round the pieces Alchemia's engine draws (`exhibitPieces` of
 * `shelter.ts`: the benches, the columns, the cases, the photographs, the fan, the emergency lamps) and on the Hebi's
 * cover crate (`market.ts`, 1 x 1.1 x 2.4 m at 424.6, 92.4). Drawn only, flat on the walls, on the floor and on the
 * crate: the shelter's solids stay. A model's front (+z) faces the world's +z at yaw 0, -z at π, +x at π/2 (its x along
 * the world's -z). Pure data.
 */

const item = (key: string, x: number, up: number, z: number, yaw: number): StreetPropItem => ({ prop: "room-detail", x, y: SHELTER.floor + up, z, yaw, variant: roomDetailShape(key) });

const W = SHELTER.wall;
const WEST = SHELTER.minX + W;
const SOUTH = SHELTER.minZ + W;
const NORTH = SHELTER.maxZ - W;
/** The ceiling's underside over the floor (2.3 m); the conduits run 12 cm under it, over the emergency lamps. */
const CONDUIT = SHELTER.ceiling - SHELTER.floor - 0.12;
const MID_X = (SHELTER.minX + SHELTER.maxX) / 2;

export const SHELTER_DETAIL: readonly StreetPropItem[] = [
  // The blast door open flat on the west wall, hinged at the passage's doorway in the south-west corner.
  item("rd-shelter-door", WEST, 0, SOUTH + 0.03 + 0.45, Math.PI / 2),
  // The gas masks and the helmet on the north wall east of the bench; the tenants' list over the south bench.
  item("rd-shelter-masks", 432.4, 1.2, NORTH, Math.PI),
  item("rd-shelter-list", 428.0, 1.0, SOUTH, 0),
  // Paraffin lamps on the columns' east faces.
  item("rd-shelter-oil-lamp", 427.8, 1.5, 87.0, Math.PI / 2),
  item("rd-shelter-oil-lamp", 427.8, 1.5, 91.8, Math.PI / 2),
  // Wiring under the ceiling along the north and south walls.
  item("rd-shelter-conduit", MID_X, CONDUIT, NORTH, Math.PI),
  item("rd-shelter-conduit", MID_X, CONDUIT, SOUTH, 0),
  // The broken case's glass north of the west case; boot prints from the passage to the stash.
  item("rd-shelter-shards", 425.5, 0, 90.0, 0),
  item("rd-shelter-prints", 422.6, 0, 89.5, 0),
  // The Hebi's laptop on the cover crate, its cable down to the battery box west of it.
  item("rd-shelter-hebi", 424.6, 1.1, 92.4, Math.PI / 2),
];
