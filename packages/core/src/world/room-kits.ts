/**
 * The rooms' kits of ADR-0099: what the dressing generator stands in a room of a kind, each shape of the rooms' detail
 * (`room-detail.ts`) with its anchor, its role and its footprint. Pure data; the generator is the simulation's
 * (`room-dressing/`), the shapes' models Blender's (`tools/blender/rooms/`).
 */

/**
 * Where a shape stands (ADR-0099 §1): on the floor with its back to a wall, on a surface's top (a bench, a counter,
 * a table), on a wall at a height, on the floor out of the ways, or on the wall over a way out (an exit sign).
 */
export type RoomAnchor = "floor-wall" | "surface-top" | "wall" | "floor-free" | "over-door";

/** Its part in the room (§14): the thing a cluster gathers round, or the small things of the cluster. */
export type RoomRole = "hero" | "clutter";

export interface KitEntry {
  /** The shape's key in `ROOM_DETAIL_SHAPES`. */
  readonly key: string;
  readonly anchor: RoomAnchor;
  readonly role: RoomRole;
  /** Its footprint on its anchor (m): along the wall or the surface, and out from it. */
  readonly along: number;
  readonly out: number;
  /** For a `wall` shape, its foot over the floor. */
  readonly height?: number;
  /** How many of it a room of the kind gets: a range the room's key picks in. */
  readonly count: readonly [number, number];
  /** A clutter shape stands within the cluster's reach (1.2 m, §14) of a hero of these keys, or of anything placed. */
  readonly near?: readonly string[];
  /**
   * Stands by a door of the room (within 2.5 m of it), an extinguisher by the way out; or by an opening the weather
   * comes in at, a puddle where the rain does.
   */
  readonly by?: "door" | "weather";
  /** Two of it stand at least this far apart (m): gullies along a corridor, not in a heap. */
  readonly apart?: number;
}

/** The kinds of rooms with a kit. */
export type RoomKitKind = "platform" | "service-corridor" | "office" | "shop" | "shop-tech" | "shelter" | "car-park" | "assembly-hall";

/**
 * A metro platform (`docs/pomieszczenia/metro-*.md`, the street's faction, §16: dense): the litter of a wait by the
 * back wall and its benches, the bag of rubbish somebody left, a cup knocked over by it. The shapes are the shared detail of
 * the rooms' catalogue (`docs/pomieszczenia/katalog.md`, family 1); the platform's own (grille, poster, timetable,
 * validator, camera) stay placed by hand in `metro-detail.ts`.
 */
const PLATFORM: readonly KitEntry[] = [
  { key: "rd-capsule-trash", anchor: "floor-wall", role: "hero", along: 0.55, out: 0.5, count: [1, 2] },
  { key: "rd-metro-litter", anchor: "surface-top", role: "hero", along: 0.8, out: 0.4, count: [1, 2] },
  { key: "rd-fh-spilled", anchor: "floor-wall", role: "clutter", along: 0.25, out: 0.12, count: [1, 2], near: ["rd-capsule-trash", "waste-bin"] },
  { key: "rd-fh-cup", anchor: "surface-top", role: "clutter", along: 0.1, out: 0.1, count: [1, 2], near: ["rd-metro-litter"] },
];

/**
 * A service corridor (Alchemia's tunnel from P-2 to T2, `docs/pomieszczenia/alchemia-p2-tunnel.md`; technique's faction,
 * §16): the fire kit by its ways out, the hose cabinet and the fuse box on its walls, gullies along them, a delivery's
 * cartons left with the bottles and cups of whoever waits, a puddle where the rain comes in (§15).
 */
const SERVICE_CORRIDOR: readonly KitEntry[] = [
  { key: "rd-c-extinguisher", anchor: "floor-wall", role: "hero", along: 0.3, out: 0.2, count: [1, 2], by: "door", apart: 10 },
  { key: "rd-c-hydrant", anchor: "floor-wall", role: "hero", along: 0.7, out: 0.27, count: [1, 1] },
  { key: "rd-c-fusebox", anchor: "floor-wall", role: "hero", along: 0.45, out: 0.17, count: [1, 1] },
  { key: "rd-c-drain", anchor: "floor-wall", role: "hero", along: 0.5, out: 0.5, count: [2, 3], apart: 8 },
  { key: "rd-c-cartons", anchor: "floor-wall", role: "hero", along: 0.72, out: 0.5, count: [1, 1] },
  { key: "rd-c-puddle", anchor: "floor-wall", role: "hero", along: 0.85, out: 0.6, count: [1, 1], by: "weather" },
  { key: "rd-c-bottles", anchor: "floor-wall", role: "clutter", along: 0.34, out: 0.21, count: [1, 2], near: ["rd-c-cartons"] },
  { key: "rd-c-cups", anchor: "floor-wall", role: "clutter", along: 0.3, out: 0.2, count: [1, 1], near: ["rd-c-cartons"] },
  { key: "rd-c-cable", anchor: "floor-wall", role: "clutter", along: 0.42, out: 0.3, count: [1, 1], near: ["rd-c-fusebox"] },
  { key: "rd-w3h-exit", anchor: "over-door", role: "hero", along: 0.4, out: 0.08, count: [2, 3] },
];

/**
 * A corporation's office (Tessen's pass office, `docs/pomieszczenia/tessen-office.md`; §16: sparse and clean): the
 * extinguisher by the door, the fuse box, a box of files waiting to go; nothing loose (a cable alone would lie loose).
 */
const OFFICE: readonly KitEntry[] = [
  { key: "rd-c-extinguisher", anchor: "floor-wall", role: "hero", along: 0.3, out: 0.2, count: [1, 1], by: "door" },
  { key: "rd-c-fusebox", anchor: "floor-wall", role: "hero", along: 0.45, out: 0.17, count: [1, 1] },
  { key: "rd-c-cartons", anchor: "floor-wall", role: "hero", along: 0.72, out: 0.5, count: [0, 1] },
];

/**
 * A shop of Alchemia's gallery and front (`docs/pomieszczenia/alchemia-shop-*.md`; the street's faction in a mall, §16):
 * the day's receipts and flyers by the till on the counter with a cup by them, the cartons of a delivery in a back
 * corner, the extinguisher by the door. Its goods, racks and the till itself are the shop's fit-out (`shop-trades.ts`).
 */
const SHOP: readonly KitEntry[] = [
  { key: "rd-c-papers", anchor: "surface-top", role: "hero", along: 0.38, out: 0.27, count: [1, 1] },
  { key: "rd-c-cups", anchor: "surface-top", role: "clutter", along: 0.3, out: 0.2, count: [0, 1], near: ["rd-c-papers"] },
  { key: "rd-c-cartons", anchor: "floor-wall", role: "hero", along: 0.72, out: 0.5, count: [0, 1] },
  { key: "rd-c-extinguisher", anchor: "floor-wall", role: "hero", along: 0.3, out: 0.2, count: [0, 1], by: "door" },
];

/** A shop of the technical trades (electronics, repair, crypto, VR, implants): its counter's laptop open on an error and a cable by it. */
const SHOP_TECH: readonly KitEntry[] = [
  { key: "rd-c-papers", anchor: "surface-top", role: "hero", along: 0.38, out: 0.27, count: [1, 1] },
  { key: "rd-c-laptop", anchor: "surface-top", role: "clutter", along: 0.35, out: 0.25, count: [1, 1], near: ["rd-c-papers"] },
  { key: "rd-c-cable", anchor: "surface-top", role: "clutter", along: 0.42, out: 0.3, count: [0, 1], near: ["rd-c-papers"] },
  { key: "rd-c-cups", anchor: "surface-top", role: "clutter", along: 0.3, out: 0.2, count: [0, 1], near: ["rd-c-papers"] },
  { key: "rd-c-cartons", anchor: "floor-wall", role: "hero", along: 0.72, out: 0.5, count: [0, 1] },
  { key: "rd-c-extinguisher", anchor: "floor-wall", role: "hero", along: 0.3, out: 0.2, count: [0, 1], by: "door" },
];

/**
 * The air-raid shelter under T2 kept as a memorial (`docs/pomieszczenia/alchemia-shelter.md`; history's faction with the
 * street's Hebi in it, §16): the museum's extinguisher by a way in and its fuse box, damp from the ground pooling by a
 * wall (§15), and the Hebi's things round his laptop on the cover crate: a delivery's cartons, bottles and a cup.
 */
const SHELTER: readonly KitEntry[] = [
  { key: "rd-c-extinguisher", anchor: "floor-wall", role: "hero", along: 0.3, out: 0.2, count: [1, 1], by: "door" },
  { key: "rd-c-fusebox", anchor: "floor-wall", role: "hero", along: 0.45, out: 0.17, count: [1, 1] },
  { key: "rd-c-puddle", anchor: "floor-wall", role: "hero", along: 0.85, out: 0.6, count: [1, 1] },
  { key: "rd-c-cartons", anchor: "floor-wall", role: "hero", along: 0.72, out: 0.5, count: [1, 1] },
  { key: "rd-c-bottles", anchor: "surface-top", role: "clutter", along: 0.34, out: 0.21, count: [1, 1], near: ["rd-shelter-hebi"] },
  { key: "rd-c-cups", anchor: "surface-top", role: "clutter", along: 0.3, out: 0.2, count: [1, 1], near: ["rd-shelter-hebi"] },
  { key: "rd-w3h-exit", anchor: "over-door", role: "hero", along: 0.4, out: 0.08, count: [2, 2] },
];
/**
 * A car park's deck (Alchemia's P-1, `docs/pomieszczenia/alchemia-parking.md`; the street's faction, §16): the fire kit by
 * its ways out, the fuse box, gullies along its walls, oil and water pooled in its empty bays (§15), and by the hand-over
 * cabins what the waiting drivers leave: a delivery's cartons, bottles, a cup (§14).
 */
const CAR_PARK: readonly KitEntry[] = [
  { key: "rd-c-extinguisher", anchor: "floor-wall", role: "hero", along: 0.3, out: 0.2, count: [1, 2], by: "door", apart: 6 },
  { key: "rd-c-fusebox", anchor: "floor-wall", role: "hero", along: 0.45, out: 0.17, count: [1, 1] },
  { key: "rd-c-drain", anchor: "floor-wall", role: "hero", along: 0.5, out: 0.5, count: [2, 3], apart: 8 },
  { key: "rd-c-puddle", anchor: "floor-free", role: "hero", along: 0.85, out: 0.6, count: [2, 3], apart: 4 },
  { key: "rd-c-cartons", anchor: "floor-wall", role: "hero", along: 0.72, out: 0.5, count: [1, 1] },
  { key: "rd-c-bottles", anchor: "floor-wall", role: "clutter", along: 0.34, out: 0.21, count: [1, 1], near: ["rd-c-cartons"] },
  { key: "rd-c-cups", anchor: "floor-wall", role: "clutter", along: 0.3, out: 0.2, count: [0, 1], near: ["rd-c-cartons"] },
  { key: "rd-w3h-exit", anchor: "over-door", role: "hero", along: 0.4, out: 0.08, count: [2, 3] },
];
/**
 * A factory's assembly hall (Tessen's W-3, `docs/pomieszczenia/w3-hall.md`; technique's faction under a corporation, §16:
 * kept, but worked in): the fire kit by every way out, the fuse boxes, gullies along the walls, oil pooled by the arms'
 * bases (§15), the cartons of a delivery of parts by a wall; no cable alone (it would lie loose, §14).
 */
const ASSEMBLY_HALL: readonly KitEntry[] = [
  { key: "rd-c-extinguisher", anchor: "floor-wall", role: "hero", along: 0.3, out: 0.2, count: [2, 3], by: "door", apart: 8 },
  { key: "rd-c-fusebox", anchor: "floor-wall", role: "hero", along: 0.45, out: 0.17, count: [1, 2], apart: 10 },
  { key: "rd-c-drain", anchor: "floor-wall", role: "hero", along: 0.5, out: 0.5, count: [2, 3], apart: 8 },
  { key: "rd-c-puddle", anchor: "floor-free", role: "hero", along: 0.85, out: 0.6, count: [2, 3], apart: 6 },
  { key: "rd-c-cartons", anchor: "floor-wall", role: "hero", along: 0.72, out: 0.5, count: [1, 2], apart: 6 },
];
export const ROOM_KITS: Readonly<Record<RoomKitKind, readonly KitEntry[]>> = {
  platform: PLATFORM,
  "service-corridor": SERVICE_CORRIDOR,
  office: OFFICE,
  shop: SHOP,
  "shop-tech": SHOP_TECH,
  shelter: SHELTER,
  "car-park": CAR_PARK,
  "assembly-hall": ASSEMBLY_HALL,
};
