import { type StreetPropItem, roomDetailShape } from "@seki/core";
import { KITCHEN_ROUND } from "./foodhall-kitchens";
import { FUMIKO_P0_ROUND } from "./fumiko-p0";
import { FESTOON_SPOTS, FOODHALL_MEALS, FOODHALL_TABLE_TOP, TABLE_GROUPS, lanternSpots } from "./foodhall-seating";
import { FOODHALL_FLOOR } from "./units";

/*
 * The food hall's round things after its card (`docs/pomieszczenia/alchemia-foodhall.md`, ADR-0098, comic realism of
 * `docs/zasady-lokacji.md` §9: a round thing is round): the models Blender builds (`tools/blender/rooms/alchemia_foodhall.py`)
 * where the seating had boxes: the paper lanterns over the tables and along the atrium's strings (their cables stay
 * pieces), the meals left on the tables (their steam stays), a cup, the spilled one, the stool knocked over by the bar;
 * in the units' kitchens their pots, stacks of bowls, cups and gas bottles (`KITCHEN_ROUND`).
 * Drawn only, as the boxes were. Pure data.
 */

const item = (key: string, x: number, y: number, z: number, yaw: number): StreetPropItem => ({ prop: "room-detail", x, y, z, yaw, variant: roomDetailShape(key) });

const TOP = FOODHALL_FLOOR + FOODHALL_TABLE_TOP;

/** Where the eaters' leftovers lie: by the meals, the cup and the spilled one, on their tables, clear of the condiments. */
const LEFT_BY: readonly (readonly [number, number])[] = [
  [406.75, 40.55],
  [406.85, 46.42],
  [429.2, 40.35],
  [429.05, 42.95],
  [415.85, 33.55],
  [412.65, 14.4],
  [405.95, 55.15],
];

export const FOODHALL_DETAIL: readonly StreetPropItem[] = [
  ...TABLE_GROUPS.flatMap((g) => lanternSpots(g)).map((s) => item("rd-fh-lantern", s.x, s.top, s.z, 0)),
  ...FESTOON_SPOTS.map((s) => item("rd-fh-lantern-small", s.x, s.top, s.z, 0)),
  // The meals: ramen and donburi in turn, their trays turned a little each.
  ...FOODHALL_MEALS.map((m, i) => item(i % 2 === 0 ? "rd-fh-ramen" : "rd-fh-donburi", m.x, TOP, m.z, ((i * 37) % 9) * 0.2 - 0.8)),
  item("rd-fh-cup", 406.675, TOP, 46.04, 0),
  // Each table's condiments in its middle, and the eaters' napkins, receipt and glass by what they left (§14's clusters).
  ...TABLE_GROUPS.map((g) => {
    const [x, z] = [(g.x0 + g.x1) / 2, (g.z0 + g.z1) / 2];
    return g.along === "z" ? item("rd-fh-condiments", x, TOP, z + 0.75, Math.PI / 2) : item("rd-fh-condiments", x + 0.75, TOP, z, 0);
  }),
  ...LEFT_BY.map(([x, z]) => item("rd-fh-leftovers", x, TOP, z, 0.3)),
  // The cup knocked over by its drink spreading on the east table.
  item("rd-fh-spilled", 429.36, TOP, 39.795, -Math.PI / 2),
  // The stool on its side by the bar, its seat at the west end.
  item("rd-fh-stool", 405.0, FOODHALL_FLOOR, 54.075, 0),
  // The kitchens' pots, stacks of bowls, cups and gas bottles, each in the middle of the box it had, on its foot (no lower than the floor).
  ...KITCHEN_ROUND.map((r) => item(r.key, (r.box.x0 + r.box.x1) / 2, Math.max(r.box.y0, FOODHALL_FLOOR), (r.box.z0 + r.box.z1) / 2, 0)),
  // Fumiko's second place on P0: her pots, bowls and the cup in the hatch.
  ...FUMIKO_P0_ROUND.map((r) => item(r.key, (r.box.x0 + r.box.x1) / 2, r.box.y0, (r.box.z0 + r.box.z1) / 2, 0)),
];
