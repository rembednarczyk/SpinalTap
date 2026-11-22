import { type StreetPropItem, roomDetailShape } from "@seki/core";
import { BASEMENT, BASEMENT_CEILING, BASEMENT_FLOOR, CULVERT_CRAWL, CULVERT_FLIGHT, CULVERT_MOUTH, CULVERT_Z, STAIR_A, STAIR_B } from "./layout";
import { W3_Y } from "./site";

/*
 * The detail of W-3's basement and its culvert after their card (`docs/pomieszczenia/w3-basement.md`, ADR-0098): the
 * models Blender builds (`tools/blender/rooms/w3_basement.py`), drawn only, where no body goes or flat on the walls and
 * under the ceiling, so the hall's solids and their ids stay as they were (the doors' after them too). A model's front
 * (+z) faces the world's +z at yaw 0, -x at -π/2 (its x along the world's +z), +x at π/2 (its x along -z), -z at π.
 * Pure data.
 */

const item = (key: string, x: number, y: number, z: number, yaw: number): StreetPropItem => ({ prop: "room-detail", x, y: W3_Y + y, z, yaw, variant: roomDetailShape(key) });

const F = BASEMENT_FLOOR;
const B = BASEMENT;
/** The rising main's axis off the south wall: the pump's riser meets it there. */
const PIPES_Z = B.minZ + 0.3;

export const W3_BASEMENT_DETAIL: readonly StreetPropItem[] = [
  // The pipes under the ceiling along the south wall, 0.3 m under it.
  item("rd-w3b-pipes", (B.minX + B.maxX) / 2, BASEMENT_CEILING - 0.3, PIPES_Z, 0),
  // The pumping set in the south-west corner, its back to the west wall, its riser up to the pipes.
  item("rd-w3b-pump", B.minX + 1.0, F, B.minZ + 1.0, Math.PI / 2),
  // The electrical box and its emergency lamp on the east wall.
  item("rd-w3b-panel", B.maxX, F + 1.0, 404.5, -Math.PI / 2),
  // Two caged bulbs from the ceiling, clear of the shafts.
  item("rd-w3b-bulb", 2534, BASEMENT_CEILING, 404.5, 0),
  item("rd-w3b-bulb", 2521, BASEMENT_CEILING, 398.8, 0),
  // The handrails: stair A rising east along its north edge, stair B rising south along its east edge.
  item("rd-w3b-handrail-a", STAIR_A.minX, F, STAIR_A.maxZ - 0.08, 0),
  item("rd-w3b-handrail-b", STAIR_B.maxX - 0.05, F, STAIR_B.maxZ, Math.PI / 2),
  // The tannery's brick where the plaster fell: on the south wall under the pipes, on the east wall.
  item("rd-w3b-brick-wide", 2536, F + 1.0, B.minZ, 0),
  item("rd-w3b-brick-tall", B.maxX, F + 0.6, 399.5, -Math.PI / 2),
  // The culvert's grate swung open against the mouth's north wing wall, hinged at the headwall.
  item("rd-w3b-grate", CULVERT_CRAWL.minX - 1.2, CULVERT_MOUTH.floor, CULVERT_Z.maxZ - 0.06, Math.PI),
  // The smugglers' cache by the crawl's south wall near its end, their sign over it.
  item("rd-w3b-stash", CULVERT_FLIGHT.minX - 3.5, CULVERT_CRAWL.floor, CULVERT_Z.minZ, 0),
  // The water and the silt along the crawl.
  item("rd-w3b-water", (CULVERT_CRAWL.minX + CULVERT_CRAWL.maxX) / 2, CULVERT_CRAWL.floor, (CULVERT_Z.minZ + CULVERT_Z.maxZ) / 2, 0),
];
