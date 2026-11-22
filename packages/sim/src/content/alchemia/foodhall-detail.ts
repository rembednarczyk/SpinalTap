import { type StreetPropItem, roomDetailShape } from "@seki/core";
import { FESTOON_SPOTS, FOODHALL_MEALS, FOODHALL_TABLE_TOP, TABLE_GROUPS, lanternSpots } from "./foodhall-seating";
import { FOODHALL_FLOOR } from "./units";

/*
 * The food hall's round things after its card (`docs/pomieszczenia/alchemia-foodhall.md`, ADR-0098, comic realism of
 * `docs/zasady-lokacji.md` §9: a round thing is round): the models Blender builds (`tools/blender/rooms/alchemia_foodhall.py`)
 * where the seating had boxes: the paper lanterns over the tables and along the atrium's strings (their cables stay
 * pieces), the meals left on the tables (their steam stays), a cup, the spilled one, the stool knocked over by the bar.
 * Drawn only, as the boxes were. Pure data.
 */

const item = (key: string, x: number, y: number, z: number, yaw: number): StreetPropItem => ({ prop: "room-detail", x, y, z, yaw, variant: roomDetailShape(key) });

const TOP = FOODHALL_FLOOR + FOODHALL_TABLE_TOP;

export const FOODHALL_DETAIL: readonly StreetPropItem[] = [
  ...TABLE_GROUPS.flatMap((g) => lanternSpots(g)).map((s) => item("rd-fh-lantern", s.x, s.top, s.z, 0)),
  ...FESTOON_SPOTS.map((s) => item("rd-fh-lantern-small", s.x, s.top, s.z, 0)),
  // The meals: ramen and donburi in turn, their trays turned a little each.
  ...FOODHALL_MEALS.map((m, i) => item(i % 2 === 0 ? "rd-fh-ramen" : "rd-fh-donburi", m.x, TOP, m.z, ((i * 37) % 9) * 0.2 - 0.8)),
  item("rd-fh-cup", 406.675, TOP, 46.04, 0),
  // The cup knocked over by its drink spreading on the east table.
  item("rd-fh-spilled", 429.36, TOP, 39.795, -Math.PI / 2),
  // The stool on its side by the bar, its seat at the west end.
  item("rd-fh-stool", 405.0, FOODHALL_FLOOR, 54.075, 0),
];
