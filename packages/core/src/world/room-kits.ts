/**
 * The rooms' kits of ADR-0099: what the dressing generator stands in a room of a kind, each shape of the rooms' detail
 * (`room-detail.ts`) with its anchor, its role and its footprint. Pure data; the generator is the simulation's
 * (`room-dressing/`), the shapes' models Blender's (`tools/blender/rooms/`).
 */

/**
 * Where a shape stands (ADR-0099 §1): on the floor with its back to a wall, on a surface's top (a bench, a counter,
 * a table), on a wall at a height, or on the floor out of the ways.
 */
export type RoomAnchor = "floor-wall" | "surface-top" | "wall" | "floor-free";

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
}

/** The kinds of rooms with a kit. */
export type RoomKitKind = "platform";

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

export const ROOM_KITS: Readonly<Record<RoomKitKind, readonly KitEntry[]>> = { platform: PLATFORM };
