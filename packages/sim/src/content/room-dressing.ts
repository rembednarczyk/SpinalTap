import { type KitEntry, ROOM_KITS, type RoomKitKind, type StreetPropItem, roomDetailShape } from "@seki/core";
import { fnv1a } from "../rng/derive-random";

/*
 * The rooms' dressing generator of ADR-0099: a room's kit (`ROOM_KITS`) stood on the anchors its layout gives (its
 * walls, the tops of its benches and counters), out of what is kept clear (doors, a stairs' foot, the ways, a
 * platform's edge) and of what already stands (its solids, the things placed by hand), in a fixed order: the heroes,
 * then the clutter gathered round them (§14's clusters, within 1.2 m). The order within a step is `fnv1a` of the
 * room, the shape and the candidate: no randomness, the same code gives the same room. Walls run along x or z.
 * Pure data; the pattern is ADR-0094's (zones, anchors, free zones, a fixed order) indoors.
 */

/** A rectangle of the world's ground (x, z). */
export interface GroundRect {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/** A wall a shape stands against: from `a` to `b`, the room on the side of `inward` (a unit vector along x or z). */
export interface DressWall {
  readonly a: { readonly x: number; readonly z: number };
  readonly b: { readonly x: number; readonly z: number };
  readonly inward: { readonly x: number; readonly z: number };
}

/** A top a shape stands on (a bench, a counter), and the yaw its things face. */
export interface DressSurface extends GroundRect {
  readonly top: number;
  readonly yaw: number;
}

/** Something already in the room: a solid, a thing placed by hand (a hero a cluster may gather round, by its key). */
export interface DressTaken extends GroundRect {
  readonly key?: string;
  /** On a surface's top (its things take room on it), or on the floor. */
  readonly onTop?: boolean;
}

export interface RoomLayout {
  /** The room's key: the order's and the counts' hash. */
  readonly id: string;
  readonly kind: RoomKitKind;
  readonly floor: number;
  readonly bounds: GroundRect;
  readonly walls: readonly DressWall[];
  readonly surfaces: readonly DressSurface[];
  /** Kept clear: nothing stands there (doors, a stairs' foot, ways, an edge). */
  readonly clear: readonly GroundRect[];
  readonly taken: readonly DressTaken[];
}

/** A cluster's reach (§14, `tools/rooms` `CLUSTER_LINK`). */
const REACH = 1.2;
/** The grid a wall's spots step along (§12: half a metre). */
const STEP = 0.5;
/** A top's spots step finer: things on a bench. */
const TOP_STEP = 0.25;
/** The gap kept between two things. */
const GAP = 0.05;

interface Spot {
  readonly x: number;
  readonly z: number;
  readonly y: number;
  readonly yaw: number;
  /** The footprint's half extents along x and z (the shape turned by a quarter when its wall runs along z). */
  readonly hx: number;
  readonly hz: number;
  readonly onTop: boolean;
}

const overlaps = (s: Spot, r: GroundRect): boolean =>
  s.x + s.hx + GAP > r.minX && s.x - s.hx - GAP < r.maxX && s.z + s.hz + GAP > r.minZ && s.z - s.hz - GAP < r.maxZ;
const within = (s: Spot, r: GroundRect): boolean => s.x - s.hx >= r.minX && s.x + s.hx <= r.maxX && s.z - s.hz >= r.minZ && s.z + s.hz <= r.maxZ;
const footprint = (s: Spot, key?: string): DressTaken => ({ minX: s.x - s.hx, maxX: s.x + s.hx, minZ: s.z - s.hz, maxZ: s.z + s.hz, key, onTop: s.onTop });

/** The spots along a wall, every half metre, the shape's back 2 cm off it, its front to the room. */
const wallSpots = (w: DressWall, e: KitEntry, floor: number): Spot[] => {
  const len = Math.hypot(w.b.x - w.a.x, w.b.z - w.a.z);
  const dx = (w.b.x - w.a.x) / len;
  const dz = (w.b.z - w.a.z) / len;
  const alongX = Math.abs(dx) > 0.5;
  const [hx, hz] = alongX ? [e.along / 2, e.out / 2] : [e.out / 2, e.along / 2];
  const off = e.out / 2 + 0.02;
  const out: Spot[] = [];
  for (let t = e.along / 2 + 0.1; t <= len - e.along / 2 - 0.1; t += STEP) {
    out.push({ x: w.a.x + dx * t + w.inward.x * off, z: w.a.z + dz * t + w.inward.z * off, y: floor + (e.height ?? 0), yaw: Math.atan2(w.inward.x, w.inward.z), hx, hz, onTop: false });
  }
  return out;
};

/** The spots on a top, a quarter metre apart, the shape turned as the top's things face. */
const topSpots = (s: DressSurface, e: KitEntry): Spot[] => {
  const quarter = Math.abs(Math.sin(s.yaw)) > 0.5;
  const [hx, hz] = quarter ? [e.out / 2, e.along / 2] : [e.along / 2, e.out / 2];
  const out: Spot[] = [];
  for (let x = s.minX + hx; x <= s.maxX - hx + 1e-9; x += TOP_STEP)
    for (let z = s.minZ + hz; z <= s.maxZ - hz + 1e-9; z += TOP_STEP) out.push({ x, z, y: s.top, yaw: s.yaw, hx, hz, onTop: true });
  return out;
};

/** How many of a shape the room gets: the kit's range, picked by the room's key. */
const countOf = (room: string, e: KitEntry): number => e.count[0] + (fnv1a(`${room}#${e.key}`) % (e.count[1] - e.count[0] + 1));

/** Does a clutter spot gather round a hero of its keys (or round anything placed, without keys)? */
const nearHero = (s: Spot, e: KitEntry, placed: readonly DressTaken[]): boolean =>
  placed.some((p) => (!e.near || (p.key !== undefined && e.near.includes(p.key))) && Math.hypot(s.x - (p.minX + p.maxX) / 2, s.z - (p.minZ + p.maxZ) / 2) <= REACH);

/** One kit entry's things, on the spots left, in its hashed order. */
const place = (room: RoomLayout, e: KitEntry, taken: DressTaken[]): StreetPropItem[] => {
  const spots = e.anchor === "surface-top" ? room.surfaces.flatMap((s) => topSpots(s, e)) : room.walls.flatMap((w) => wallSpots(w, e, room.floor));
  const order = spots.map((s, i) => ({ s, h: fnv1a(`${room.id}#${e.key}#${i}`) })).sort((a, b) => a.h - b.h || 0);
  const out: StreetPropItem[] = [];
  const want = countOf(room.id, e);
  for (const { s } of order) {
    if (out.length >= want) break;
    if (!s.onTop && (!within(s, room.bounds) || room.clear.some((r) => overlaps(s, r)))) continue;
    // A thing on a top minds only the other things on tops; on the floor, everything (the tops' solids among them).
    if (taken.some((t) => (s.onTop ? t.onTop === true : !t.onTop) && overlaps(s, t))) continue;
    if (e.role === "clutter" && !nearHero(s, e, taken)) continue;
    taken.push(footprint(s, e.key));
    out.push({ prop: "room-detail", x: s.x, y: s.y, z: s.z, yaw: s.yaw, variant: roomDetailShape(e.key) });
  }
  return out;
};

/** A room dressed with its kit: the heroes first, then the clutter round them (ADR-0099 §3). */
export const dressRoom = (room: RoomLayout): StreetPropItem[] => {
  const kit = ROOM_KITS[room.kind];
  const taken: DressTaken[] = [...room.taken];
  return [...kit.filter((e) => e.role === "hero"), ...kit.filter((e) => e.role === "clutter")].flatMap((e) => place(room, e, taken));
};
