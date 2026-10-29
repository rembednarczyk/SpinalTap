import type { Vec3 } from "@seki/core";
import { type BlockMaterial, type StaticProp, neon, stairs, v } from "./builders";
import type { RoofStash } from "./district-targ";
import { TRASA_PODZIEMNA as T } from "./lublin/sites";

/**
 * Trasa Podziemna, the cellars under the Rynek (ADR-0048), in a small first version: the real
 * route starts in the Trybunał Koronny (Rynek 1), and so does this one. A vaulted vestibule from
 * the Trybunał's north-west door (lined by the renderer, `TRASA_PODZIEMNA.vestibule`) leads to a
 * stair hall; the stairs go down east to a landing, a corridor runs south from it, another west
 * along the Trybunał's south side, and from its end a doorway opens into the loch where Mei sang
 * for coins before the cellars were shut (`m4-ulica.ink`). Somebody left a bag there.
 *
 * The cellars are a shell of interior blocks (ADR-0038) under the Trybunał's footprint; the
 * terrain under them is dug out (`PADS` in sites.ts), so the floors are slabs.
 */

/** Floor of the vestibule (the Rynek at the door), of the cellars, and the ceilings. */
const D = T.door;
const F = T.floor;
/** Underside of the stair hall's ceiling (the vestibule's crown) and of the cellars'. */
const H = D + T.hall;
const C = F + 2.7;
const WALL = 0.3;

const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, material: BlockMaterial = "concrete"): StaticProp => ({
  center: v((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
  view: { kind: "block", size: v(x1 - x0, y1 - y0, z1 - z0), material, interior: true },
  solid: true,
  interior: true,
});

const { minX: HX0, maxX: HX1, minZ: HZ0, maxZ: HZ1 } = T.stairs;
/** The vestibule's sides where it opens into the stair hall. */
const VZ0 = T.vestibule.from.z - T.vestibule.width / 2;
const VZ1 = T.vestibule.from.z + T.vestibule.width / 2;
/** The stairs end here; the landing runs on to the hall's east wall. */
const STAIRS_END = 582.5;
/** The south corridor (x 582.6..HX1) and the west corridor (z 'south'..-62.4). */
const SOUTH_X0 = 582.6;
const WEST_Z0 = -64.5;
const WEST_Z1 = -62.4;
/** The loch: x 575.5..582.3, z -62.1..HZ0 - WALL, its doorway at the west end. */
const LOCH_X0 = 575.5;
const LOCH_DOOR = 577.5;

/** The stair hall: floor, stairs, walls round it with the vestibule's opening, the ceiling. */
const hall = (): StaticProp[] => [
  // The vestibule's floor where the dug-out terrain starts, and the stairs down to the landing.
  box(570, HX0, D - 0.3, D, VZ0, VZ1),
  stairs(HX0, STAIRS_END, HZ0, HZ1, F, D, "x", -1),
  box(HX0 - WALL, HX1 + WALL, F - 0.3, F, WEST_Z0 - WALL, HZ1 + WALL),
  box(HX0 - WALL, HX1 + WALL, F - 0.3, H + 0.25, HZ1, HZ1 + WALL),
  box(HX0 - WALL, SOUTH_X0 - WALL, F - 0.3, H + 0.25, HZ0 - WALL, HZ0),
  box(HX1, HX1 + WALL, F - 0.3, H + 0.25, WEST_Z0 - WALL, HZ1 + WALL),
  // West wall: either side of the vestibule, and under its floor.
  box(HX0 - WALL, HX0, F - 0.3, H + 0.25, HZ0 - WALL, VZ0),
  box(HX0 - WALL, HX0, F - 0.3, H + 0.25, VZ1, HZ1 + WALL),
  box(HX0 - WALL, HX0, F - 0.3, D - 0.3, VZ0, VZ1),
  box(HX0 - WALL, HX1 + WALL, H, H + 0.25, HZ0 - WALL, HZ1 + WALL),
  // Over the way down into the low cellars.
  box(SOUTH_X0 - WALL, HX1, C, H + 0.25, HZ0 - WALL, HZ0),
];

/** The cellars: the south corridor, the west corridor and the loch, under one low ceiling. */
const cellars = (): StaticProp[] => [
  box(LOCH_X0 - WALL, HX1 + WALL, C, C + 0.2, WEST_Z0 - WALL, HZ0 - WALL),
  // South and west outer walls.
  box(LOCH_X0 - WALL, HX1 + WALL, F - 0.3, C, WEST_Z0 - WALL, WEST_Z0),
  box(LOCH_X0 - WALL, LOCH_X0, F - 0.3, C, WEST_Z0, HZ0 - WALL),
  // Between the south corridor and the loch, and between the west corridor and the loch.
  box(SOUTH_X0 - WALL, SOUTH_X0, F - 0.3, C, WEST_Z1, HZ0 - WALL),
  box(LOCH_DOOR, SOUTH_X0, F - 0.3, C, WEST_Z1, WEST_Z1 + WALL),
  box(LOCH_DOOR - 0.05, LOCH_DOOR + 0.05, F + 2.1, C, WEST_Z1 - 0.15, WEST_Z1 + WALL + 0.15, "metal"),
  // Ribs of the vault across the corridors, every few metres.
  ...[-59.6, -61.4, -63.4].map((z) => box(SOUTH_X0, HX1, C - 0.35, C, z - 0.15, z + 0.15)),
  ...[584.2, 580.8, 577.2].map((x) => box(x - 0.15, x + 0.15, C - 0.35, C, WEST_Z0, WEST_Z1)),
];

/** Warm lamps along the way and the loch's old sign; the sign over the Trybunał's door. */
const lights = (): StaticProp[] => [
  neon(HX1 - 0.04, D + 1.2, (HZ0 + HZ1) / 2, v(0.05, 0.25, 1.6), "#ffb36b"),
  neon((HX0 + STAIRS_END) / 2, H - 0.05, HZ1 - 0.2, v(6, 0.06, 0.08), "#ffcf8a"),
  neon(HX1 - 0.04, F + 1.9, -61, v(0.05, 0.2, 1.4), "#ffb36b"),
  neon(580, C - 0.05, WEST_Z0 + 0.25, v(4, 0.06, 0.08), "#ffcf8a"),
  neon(579, F + 1.8, HZ0 - WALL - 0.04, v(2.4, 0.5, 0.05), "#ff2e88", "KARAOKE"),
  { center: v(LOCH_X0 + 0.04, F + 1.4, -60.3), view: { kind: "neon", size: v(0.05, 1.1, 1.6), color: "#b46cff", facing: "x+" }, solid: false },
];

/** Mei's old stage in the loch: a low crate of a platform and a speaker. */
const stage = (): StaticProp[] => [box(578, 581.5, F, F + 0.25, -60.6, HZ0 - WALL, "metal"), box(581.6, 582.2, F, F + 1.1, -59.4, -58.6, "metal")];

export const TRASA_PODZIEMNA_PROPS: readonly StaticProp[] = [...hall(), ...cellars(), ...lights(), ...stage()];

/** Where the loch is, for tests and the debug camera: the middle of its floor. */
export const LOCH_SPOT: Vec3 = { x: 579, y: F, z: -60.3 };
/** The way in: outside the Trybunał's door, the head of the stairs, the landing, the loch. */
export const TRASA_PODZIEMNA_WALK: readonly (readonly [number, number])[] = [
  [563, -57],
  [571, -57],
  [584, -57],
  [583.8, -63.4],
  [576.5, -63.4],
  [576.5, -60.5],
];

/** A bag left in the loch, by the stage (ADR-0048). */
export const TRASA_PODZIEMNA_STASH: RoofStash = {
  key: "stash:trasa-podziemna",
  at: { x: 576.3, y: F, z: -59.2 },
  lines: [
    { kind: "eddies", qty: 90 },
    { kind: "stack", item: "datachip", qty: 1 },
    { kind: "stack", item: "medkit", qty: 1 },
  ],
};
