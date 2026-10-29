import type { BlockSkin } from "@seki/core";
import { type ActorSpawn, type BlockMaterial, type DoorDef, type NavGraph, type StaticProp, building, deck, neon, skin, slab, v } from "./builders";
import { doorParts } from "./doors";

/**
 * Interiors of Shinsekai 7 (ADR-0038): Doktor Mori's clinic in the west row and the Neon Koi
 * bar in the east row, cut out of the blocks that stood there. Each block is split in three:
 *
 * - the storeys above the ground floor stay a city kit block with its skin (the kit fills a
 *   block's whole volume with closed building models, so a skinned block cannot have a hole);
 * - the ground floor is a shell of blocks with thickness: the front wall (its pieces beside the
 *   door carry the facade's skin, see `storefront`), side walls, a ceiling slab under the upper
 *   block, a floor slab, and a solid filler at the back that serves as the back wall;
 * - the furniture is plain blocks too: solid where it stops a body (counter, chair, tables),
 *   visual only where a character should be able to stand at it (stools, chairs).
 *
 * The front of the clinic faces east (x = -7), the bar's west (x = 7). The doors are in
 * `S7_DOORS`, the characters inside in `district-m0.ts`, and the street level graph in `S7_NAV`.
 */

/** Height of the ground floor: the upper, skinned block starts here. */
const GROUND = 4.2;
/** Underside of the ceiling slab inside. */
const CEILING = 3.9;
/** Top of every door opening. */
const DOOR_TOP = 2.6;
/** Distance to the facades across the street, for the kit (ADR-0022). */
const STREET = 14;

/** Box spanning the given ranges, solid unless told otherwise, optionally with a kit skin. */
const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, material: BlockMaterial, solid = true, look?: BlockSkin): StaticProp => ({
  center: v((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
  view: look ? { kind: "block", size: v(x1 - x0, y1 - y0, z1 - z0), material, skin: look } : { kind: "block", size: v(x1 - x0, y1 - y0, z1 - z0), material },
  solid,
});

/**
 * Marks props as parts of an interior: `StaticProp.interior` for the minimap, and on block views
 * for the renderer, which draws them merged and without the moon shadow (ADR-0038).
 */
const indoor = (props: readonly StaticProp[]): StaticProp[] =>
  props.map((p) => ({ ...p, interior: true, ...(p.view.kind === "block" ? { view: { ...p.view, interior: true } } : {}) }));

/**
 * A piece of the ground-floor front wall beside the door, with its own kit skin: the facade's
 * skin lives on these thin solids, so the shop windows, the bar's storefront and its BAR sign
 * stay on the street while the door opening between them is real. The kit squeezes its
 * models to the wall's thickness, which nobody sees from the street.
 */
const storefront = (x0: number, x1: number, z0: number, z1: number, style: "shop" | "bar", front: "x+" | "x-"): StaticProp =>
  box(x0, x1, 0, GROUND, z0, z1, "concrete", true, skin(style, front, { street: STREET, signs: false }));

/** Where Seki wakes up: on the treatment chair, facing the length of the room. */
export const CLINIC_CHAIR_TOP = 0.45;
export const CLINIC_WAKE_SPOT = v(-14.6, CLINIC_CHAIR_TOP, 2.6);

/** The clinic's door in the front wall (x = -7.15), opening z ∈ [3.6, 5.2]. */
export const CLINIC_DOOR: DoorDef = {
  key: "door:klinika",
  at: v(-7.15, 0, 4.4),
  along: "z",
  width: 1.6,
  height: DOOR_TOP,
  leaves: 1,
  dir: -1,
  material: "glass",
};

/**
 * Doktor Mori's clinic: x ∈ [-17, -7.3], z ∈ [1.3, 7.7]. A waiting room by the street (bench,
 * reception counter, the queue screen) and, through a doorway in the partition at x = -12,
 * the surgery: the treatment chair with two surgical lamps over it, the monitors on the back
 * wall, an instrument cart and a cabinet. The Ramen bar keeps the north half of the old block.
 */
const clinic = (): StaticProp[] =>
  indoor([
    building(-14, 11.5, 14, 14, 7, "concrete", skin("shop", "x+", { street: STREET, signs: false })),
    box(-21, -7, GROUND, 14, 1, 8, "concrete", true, skin("tenement", "x+", { street: STREET, signs: false })),
    box(-21, -17, 0, GROUND, 1, 8, "concrete"),
    box(-17, -7.3, 0, GROUND, 1, 1.3, "concrete"),
    box(-17, -7.3, 0, GROUND, 7.7, 8, "concrete"),
    // Front wall: the door's pocket, the lintel, the window north of the door.
    box(-7.3, -7, 0, GROUND, 1, 3.6, "concrete"),
    box(-7.3, -7, DOOR_TOP, GROUND, 3.6, 5.2, "concrete"),
    storefront(-7.3, -7, 5.2, 8, "shop", "x+"),
    box(-17, -7.3, CEILING, GROUND, 1.3, 7.7, "concrete"),
    slab(-12.15, 0.02, 4.5, v(9.7, 0.04, 6.4), "metal"),
    // Partition between the waiting room and the surgery, with a doorway z ∈ [4.8, 6.4].
    box(-12.2, -11.9, 0, CEILING, 1.3, 4.8, "concrete"),
    box(-12.2, -11.9, 0, CEILING, 6.4, 7.7, "concrete"),
    box(-12.2, -11.9, DOOR_TOP, CEILING, 4.8, 6.4, "concrete"),
    // Waiting room.
    box(-11.4, -8.6, 0, 0.45, 7.1, 7.6, "metal"),
    box(-10.6, -9.8, 0, 1.05, 1.4, 3, "concrete"),
    neon(-11.85, 2, 3, v(0.05, 0.6, 1.2), "#00e5ff", "NUMER 7"),
    // Surgery: the chair (seat and headrest at the south end), lamps, monitors, cart, cabinet.
    box(-15, -14.2, 0, CLINIC_CHAIR_TOP, 1.7, 3.7, "metal"),
    box(-15, -14.2, CLINIC_CHAIR_TOP, 1.15, 1.6, 1.85, "metal"),
    slab(-14.6, 3.45, 2.8, v(0.08, 0.9, 0.08), "metal"),
    slab(-14.6, 2.95, 2.4, v(0.8, 0.12, 0.6), "glass"),
    slab(-14.6, 2.95, 3.3, v(0.8, 0.12, 0.6), "glass"),
    neon(-14.6, 2.86, 2.4, v(0.7, 0.05, 0.05), "#eafcff"),
    neon(-14.6, 2.86, 3.3, v(0.7, 0.05, 0.05), "#eafcff"),
    neon(-16.95, 1.9, 3.2, v(0.05, 0.6, 1.1), "#39ffd0", "PULS 48"),
    neon(-16.95, 1.9, 4.6, v(0.05, 0.5, 0.9), "#ff4d6d"),
    box(-13.4, -12.8, 0, 0.9, 1.6, 2.2, "metal"),
    box(-17, -16.4, 0, 2, 6.2, 7.7, "metal"),
  ]);

/** The bar's double door in the front wall (x = 7.15), opening z ∈ [0.4, 2.6]. */
export const KOI_DOOR: DoorDef = { key: "door:neon-koi", at: v(7.15, 0, 1.5), along: "z", width: 2.2, height: DOOR_TOP, leaves: 2 };

/**
 * Neon Koi: x ∈ [7.3, 17], z ∈ [-6.7, 10.7]. The counter runs along z at x ≈ 13.8 with stools
 * on the room side and the bottle shelf behind the barman; two tables by the windows; a low
 * stage in the north-east corner with the jukebox.
 */
const koi = (): StaticProp[] =>
  indoor([
    box(7, 21, GROUND, 10, -7, 11, "concrete", true, skin("tenement", "x-", { street: STREET, signs: false })),
    box(17, 21, 0, GROUND, -7, 11, "concrete"),
    box(7.3, 17, 0, GROUND, -7, -6.7, "concrete"),
    box(7.3, 17, 0, GROUND, 10.7, 11, "concrete"),
    // Front wall: windows either side, the leaves' pockets, the lintel.
    storefront(7, 7.3, -7, -1, "shop", "x-"),
    box(7, 7.3, 0, GROUND, -1, 0.4, "concrete"),
    box(7, 7.3, DOOR_TOP, GROUND, 0.4, 2.6, "concrete"),
    box(7, 7.3, 0, GROUND, 2.6, 4, "concrete"),
    storefront(7, 7.3, 4, 11, "bar", "x-"),
    box(7.3, 17, CEILING, GROUND, -6.7, 10.7, "concrete"),
    slab(12.15, 0.02, 2, v(9.7, 0.04, 17.4), "concrete"),
    // Counter, shelf with its neon, stools (visual: a character can stand at one).
    box(13.4, 14.2, 0, 1.1, -3.5, 6.5, "metal"),
    box(16.4, 17, 0, 2.4, -3.5, 6.5, "metal"),
    neon(16.35, 1.6, 1.5, v(0.05, 0.35, 8), "#ff2e88"),
    ...[-2.5, -1, 0.5, 2, 5].map((z) => slab(12.8, 0.37, z, v(0.4, 0.74, 0.4), "metal")),
    // Tables by the windows, a chair at each.
    box(9.2, 10.1, 0, 0.75, -4.6, -3.7, "metal"),
    box(9.2, 10.1, 0, 0.75, 6.8, 7.7, "metal"),
    slab(10.6, 0.25, -4.15, v(0.45, 0.5, 0.45), "metal"),
    slab(8.7, 0.25, 7.25, v(0.45, 0.5, 0.45), "metal"),
    // The stage and the jukebox.
    deck(10.5, 13, 8.6, 10.7, 0.3, 0.3, "metal"),
    neon(11.75, 2.6, 10.65, v(2.2, 0.4, 0.05), "#ff2e88", "KOI LIVE"),
    box(15.6, 16.4, 0, 1.6, 9.9, 10.7, "metal"),
    neon(16, 1, 9.85, v(0.6, 0.5, 0.05), "#ffb000", "JUKE"),
  ]);

/** Every door of Shinsekai 7. */
export const S7_DOORS: readonly DoorDef[] = [CLINIC_DOOR, KOI_DOOR];

/** The interiors and their doors, appended to the district's props. */
export const S7_INTERIORS: readonly StaticProp[] = [...clinic(), ...koi(), ...S7_DOORS.flatMap(doorParts)];

/** Kaito by the chair while Seki comes round (before the first conversation). */
export const FIXER_CLINIC_SPAWN: ActorSpawn = { key: "fixer", position: v(-13.3, 0, 3.2), yaw: -Math.PI / 2 };
/** Kaito at the bar afterwards: at the counter between the stools, looking at the door. */
export const FIXER_BAR_SPAWN: ActorSpawn = { key: "fixer", position: v(12.75, 0, 3.5), yaw: -1.91 };
/** Doktor Mori at the monitors behind the chair. */
export const MORI_SPAWN: ActorSpawn = { key: "mori", position: v(-16.2, 0, 5.2), yaw: 2.59 };
export const BARMAN_SPAWN: ActorSpawn = { key: "koi-barman", position: v(15.3, 0, 1.5), yaw: -Math.PI / 2 };
export const KOI_REGULAR_SPAWNS: readonly ActorSpawn[] = [
  { key: "koi-regular-1", position: v(8.6, 0, -4.15), yaw: Math.PI / 2 },
  { key: "koi-regular-2", position: v(10.7, 0, 7.25), yaw: -Math.PI / 2 },
];

/**
 * Street level graph of Shinsekai 7 (ADR-0038): a node in front of each door, one just inside
 * and, in the clinic, one in the surgery behind the partition. The rest of the district is one
 * open level, so nothing else is needed.
 */
export const S7_NAV: NavGraph = {
  nodes: [
    { id: "s7-clinic-out", at: v(-5.6, 0, 4.4) },
    { id: "s7-clinic-in", at: v(-8.7, 0, 4.4) },
    { id: "s7-surgery", at: v(-13.6, 0, 5.6) },
    { id: "s7-koi-out", at: v(5.6, 0, 1.5) },
    { id: "s7-koi-in", at: v(8.7, 0, 1.5) },
  ],
  edges: [
    { a: "s7-clinic-out", b: "s7-clinic-in" },
    { a: "s7-clinic-in", b: "s7-surgery" },
    { a: "s7-koi-out", b: "s7-koi-in" },
  ],
};

/** The side door of Tessen's office onto the quay (x = -18.15), opening z ∈ [131, 133], on the code from the hook. */
export const TESSEN_OFFICE_DOOR: DoorDef = {
  key: "door:tessen-office",
  at: v(-18.15, 0, 132),
  along: "z",
  width: 2,
  height: DOOR_TOP,
  leaves: 2,
  lock: { kind: "code", staff: "tessen", during: "infiltrate" },
  panel: v(-17.94, 1.3, 133.6),
};

/** The office door and the lintel over it (the walls are 3.6 m high), appended to the quay's props. */
export const DOKI_DOORS: readonly StaticProp[] = [...indoor([box(-18.3, -18, DOOR_TOP, 3.6, 131, 133, "concrete")]), ...doorParts(TESSEN_OFFICE_DOOR)];
