import type { BlockFront, Vec3 } from "@seki/core";
import { type ActorSpawn, type BlockMaterial, type DoorDef, type NavGraph, type StaticProp, deck, neon, slab, v } from "./builders";
import { doorParts } from "./doors";
import { CLINIC_SITE, KOI_SITE, ROOM_STOREY, type RoomSite } from "./lublin/sites";

/**
 * Interiors of Krakowskie Przedmieście (ADR-0038, moved into Lublin by ADR-0045): Doktor Mori's
 * clinic on the north side of the deptak and the Neon Koi bar across it, each cut into the
 * ground floor of a real tenement. The building from the map keeps its storeys above the room
 * (its solid starts `ROOM_STOREY` above the room's floor) and its facade gets a doorway; the
 * room is a shell of blocks with thickness inside the facade: front wall pieces beside the
 * door, side and back walls, a ceiling under the storeys above, a floor; the furniture is
 * blocks too, solid where it stops a body (counter, chair, tables), visual where a character
 * should be able to stand at it (stools, chairs).
 *
 * The rooms keep the layout they had in Shinsekai 7: they are drawn in the old coordinates
 * (the front wall at x = -7 for the clinic, x = 7 for the bar, the room inwards from it) and
 * turned onto their facades by `inRoom`: old z runs along the facade (east), old x into the
 * building, the floor at the ground outside the door.
 */

/** Underside of the ceiling slab inside. */
const CEILING = 3.9;
/** Top of every door opening. */
export const DOOR_TOP = 2.6;
/** The facade is this far in front of the room's front wall (no z-fighting with the shell). */
const FACADE_GAP = 0.04;

/** How a room's old coordinates turn onto its facade: X = ox + z, Z = oz − x, y on the floor. */
interface RoomFrame {
  readonly ox: number;
  readonly oz: number;
  readonly floor: number;
}

/**
 * The frame of a room whose old front wall ran along x = `front` (the clinic at -7, the bar at
 * 7) and whose old z = `zStart` lies at the room's west end.
 */
const frameOf = (site: RoomSite, front: number, zStart: number): RoomFrame => ({
  ox: site.rect.minX - zStart,
  // Old x = front lies just inside the facade (Z = oz − x), the room behind it.
  oz: site.front - site.faces * FACADE_GAP + front,
  floor: site.floor,
});

const CLINIC = frameOf(CLINIC_SITE, -7, 1);
const KOI = frameOf(KOI_SITE, 7, -7);

/** A point of the old room in the world. */
const at = (f: RoomFrame, x: number, y: number, z: number): Vec3 => v(f.ox + z, f.floor + y, f.oz - x);

/** A facing of the old room in the world (the room turns by a quarter to the left). */
const FACING: Readonly<Record<BlockFront, BlockFront>> = { "x+": "z-", "x-": "z+", "z+": "x+", "z-": "x-" };

const turnProp = (f: RoomFrame, p: StaticProp): StaticProp => {
  const c = at(f, p.center.x, p.center.y, p.center.z);
  const view = p.view;
  if (view.kind === "block") return { ...p, center: c, view: { ...view, size: v(view.size.z, view.size.y, view.size.x) } };
  if (view.kind === "neon") {
    const thinX = view.size.x <= view.size.z && view.size.x <= view.size.y;
    const old: BlockFront = view.facing ?? (thinX ? (p.center.x > 0 ? "x-" : "x+") : "z-");
    return { ...p, center: c, view: { ...view, size: v(view.size.z, view.size.y, view.size.x), facing: FACING[old] } };
  }
  return { ...p, center: c };
};

/** A spawn of the old room in the world: the room turns a quarter, and so does the yaw. */
const turnSpawn = (f: RoomFrame, s: ActorSpawn): ActorSpawn => ({ key: s.key, position: at(f, s.position.x, s.position.y, s.position.z), yaw: s.yaw + Math.PI / 2 });

const turnDoor = (f: RoomFrame, d: DoorDef): DoorDef => ({
  ...d,
  at: at(f, d.at.x, d.at.y, d.at.z),
  along: d.along === "z" ? "x" : "z",
  ...(d.panel ? { panel: at(f, d.panel.x, d.panel.y, d.panel.z) } : {}),
});

/** Box spanning the given (old) ranges, solid unless told otherwise. */
const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, material: BlockMaterial = "concrete", solid = true): StaticProp => ({
  center: v((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
  view: { kind: "block", size: v(x1 - x0, y1 - y0, z1 - z0), material },
  solid,
});

/**
 * Marks props as parts of an interior: `StaticProp.interior` for the minimap, and on block views
 * for the renderer, which draws them merged and without the moon shadow (ADR-0038).
 */
const indoor = (props: readonly StaticProp[]): StaticProp[] =>
  props.map((p) => ({ ...p, interior: true, ...(p.view.kind === "block" ? { view: { ...p.view, interior: true } } : {}) }));

/** Where Seki wakes up: on the treatment chair, facing the length of the room. */
export const CLINIC_CHAIR_TOP = 0.45;
export const CLINIC_WAKE_SPOT: Vec3 = at(CLINIC, -14.6, CLINIC_CHAIR_TOP, 2.6);
/** Yaw of the wake-up: along the chair, towards its foot. */
export const CLINIC_WAKE_YAW = Math.PI / 2;

/** The clinic's door in the front wall, an opening of 1.6 m. */
export const CLINIC_DOOR: DoorDef = turnDoor(CLINIC, {
  key: "door:klinika",
  at: v(-7.15, 0, 4.4),
  along: "z",
  width: 1.6,
  height: DOOR_TOP,
  leaves: 1,
  dir: -1,
  material: "glass",
});

/**
 * Doktor Mori's clinic (old x ∈ [-17, -7.3], z ∈ [1.3, 7.7]). A waiting room by the street
 * (bench, reception counter, the queue screen) and, through a doorway in the partition at
 * x = -12, the surgery: the treatment chair with two surgical lamps over it, the monitors on
 * the back wall, an instrument cart and a cabinet.
 */
const clinic = (): StaticProp[] => [
  box(-17.3, -17, 0, ROOM_STOREY, 1, 8),
  box(-17, -7.3, 0, ROOM_STOREY, 1, 1.3),
  box(-17, -7.3, 0, ROOM_STOREY, 7.7, 8),
  // Front wall: the door's pocket, the lintel, the wall north of the door.
  box(-7.3, -7, 0, ROOM_STOREY, 1, 3.6),
  box(-7.3, -7, DOOR_TOP, ROOM_STOREY, 3.6, 5.2),
  box(-7.3, -7, 0, ROOM_STOREY, 5.2, 8),
  box(-17, -7.3, CEILING, ROOM_STOREY, 1.3, 7.7),
  slab(-12.15, 0.02, 4.5, v(9.7, 0.04, 6.4), "metal"),
  // Partition between the waiting room and the surgery, with a doorway z ∈ [4.8, 6.4].
  box(-12.2, -11.9, 0, CEILING, 1.3, 4.8),
  box(-12.2, -11.9, 0, CEILING, 6.4, 7.7),
  box(-12.2, -11.9, DOOR_TOP, CEILING, 4.8, 6.4),
  // Waiting room.
  box(-11.4, -8.6, 0, 0.45, 7.1, 7.6, "metal"),
  box(-10.6, -9.8, 0, 1.05, 1.4, 3),
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
];

/** The bar's double door in the front wall, an opening of 2.2 m. */
export const KOI_DOOR: DoorDef = turnDoor(KOI, { key: "door:neon-koi", at: v(7.15, 0, 1.5), along: "z", width: 2.2, height: DOOR_TOP, leaves: 2 });

/**
 * Neon Koi (old x ∈ [7.3, 17], z ∈ [-6.7, 10.7]). The counter runs along the room at old
 * x ≈ 13.8 with stools on the room side and the bottle shelf behind the barman; two tables by
 * the windows; a low stage in the corner with the jukebox.
 */
const koi = (): StaticProp[] => [
  box(17, 17.3, 0, ROOM_STOREY, -7, 11),
  box(7.3, 17, 0, ROOM_STOREY, -7, -6.7),
  box(7.3, 17, 0, ROOM_STOREY, 10.7, 11),
  // Front wall: the wall either side, the leaves' pockets, the lintel.
  box(7, 7.3, 0, ROOM_STOREY, -7, -1),
  box(7, 7.3, 0, ROOM_STOREY, -1, 0.4),
  box(7, 7.3, DOOR_TOP, ROOM_STOREY, 0.4, 2.6),
  box(7, 7.3, 0, ROOM_STOREY, 2.6, 4),
  box(7, 7.3, 0, ROOM_STOREY, 4, 11),
  box(7.3, 17, CEILING, ROOM_STOREY, -6.7, 10.7),
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
];

/** Signs on the street: over the clinic's door and over the bar's, facing the deptak. */
const signs = (): StaticProp[] => [
  turnProp(CLINIC, neon(-6.9, 3.4, 2.4, v(0.15, 0.9, 3.4), "#39ffd0", "KLINIKA")),
  turnProp(KOI, neon(6.9, 3.5, 1.5, v(0.15, 1.2, 6), "#ff2e88", "NEON KOI")),
];

/** Every door of Krakowskie Przedmieście. */
export const S7_DOORS: readonly DoorDef[] = [CLINIC_DOOR, KOI_DOOR];

/** The interiors, their signs and their doors. */
export const S7_INTERIORS: readonly StaticProp[] = [
  ...indoor([...clinic().map((p) => turnProp(CLINIC, p)), ...koi().map((p) => turnProp(KOI, p))]),
  ...signs(),
  ...S7_DOORS.flatMap(doorParts),
];

/** Kaito by the chair while Seki comes round (before the first conversation). */
export const FIXER_CLINIC_SPAWN: ActorSpawn = turnSpawn(CLINIC, { key: "fixer", position: v(-13.3, 0, 3.2), yaw: -Math.PI / 2 });
/** Kaito at the bar afterwards: at the counter between the stools, looking at the door. */
export const FIXER_BAR_SPAWN: ActorSpawn = turnSpawn(KOI, { key: "fixer", position: v(12.75, 0, 3.5), yaw: -1.91 });
/** Doktor Mori at the monitors behind the chair. */
export const MORI_SPAWN: ActorSpawn = turnSpawn(CLINIC, { key: "mori", position: v(-16.2, 0, 5.2), yaw: 2.59 });
export const BARMAN_SPAWN: ActorSpawn = turnSpawn(KOI, { key: "koi-barman", position: v(15.3, 0, 1.5), yaw: -Math.PI / 2 });
export const KOI_REGULAR_SPAWNS: readonly ActorSpawn[] = [
  turnSpawn(KOI, { key: "koi-regular-1", position: v(8.6, 0, -4.15), yaw: Math.PI / 2 }),
  turnSpawn(KOI, { key: "koi-regular-2", position: v(10.7, 0, 7.25), yaw: -Math.PI / 2 }),
];
/** Residents at the Neon Koi counter and by the door (ADR-0041), in the world. */
export const KOI_CROWD_SPOTS: readonly { readonly at: Vec3; readonly yaw: number }[] = [
  { at: at(KOI, 12.85, 0, -2.6), yaw: Math.PI },
  { at: at(KOI, 12.85, 0, -0.7), yaw: Math.PI },
  { at: at(KOI, 12.85, 0, 5.7), yaw: Math.PI },
  { at: at(KOI, 11.5, 0, -6.15), yaw: Math.PI / 2 },
];

/** Where the night drinker of a contract drinks (ADR-0034): at the counter by the door. */
export const KOI_BAR_SPOT: Vec3 = at(KOI, 12.6, 0, 1.2);

/**
 * Street level graph of the interiors (ADR-0038): a node in front of each door, one just inside
 * and, in the clinic, one in the surgery behind the partition.
 */
export const S7_NAV: NavGraph = {
  nodes: [
    { id: "s7-clinic-out", at: at(CLINIC, -5.6, 0, 4.4) },
    { id: "s7-clinic-in", at: at(CLINIC, -8.7, 0, 4.4) },
    { id: "s7-surgery", at: at(CLINIC, -13.6, 0, 5.6) },
    { id: "s7-koi-out", at: at(KOI, 5.6, 0, 1.5) },
    { id: "s7-koi-in", at: at(KOI, 8.7, 0, 1.5) },
  ],
  edges: [
    { a: "s7-clinic-out", b: "s7-clinic-in" },
    { a: "s7-clinic-in", b: "s7-surgery" },
    { a: "s7-koi-out", b: "s7-koi-in" },
  ],
};

/** Points of a room in the world, for tests and tools: the old coordinates of the clinic or the bar. */
export const clinicPoint = (x: number, y: number, z: number): Vec3 => at(CLINIC, x, y, z);
export const koiPoint = (x: number, y: number, z: number): Vec3 => at(KOI, x, y, z);

/** The doorway of a room's door in the facade of its building, for the building's view. */
export const doorwayOf = (d: DoorDef, site: RoomSite): { x: number; z: number; width: number; bottom: number; top: number } => ({
  x: d.at.x,
  z: site.front,
  width: d.width,
  bottom: site.floor,
  top: site.floor + d.height,
});
