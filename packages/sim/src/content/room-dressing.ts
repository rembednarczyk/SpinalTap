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
  /**
   * The room's doors and openings, each a strip on the floor against its wall: what a kit's `by` stands near (`weather`:
   * the rain and the wind come in there), what an exit sign hangs over (`top` the opening's height, `inward` into the room
   * when the strip lies inside it, not on its outline).
   */
  readonly doors?: readonly (GroundRect & { readonly weather?: true; readonly top?: number; readonly inward?: { readonly x: number; readonly z: number } })[];
  /** The ceiling's underside over the floor: an exit sign hangs short of it. */
  readonly ceiling?: number;
  /** Where a `floor-free` thing may stand, out of the ways: an empty bay, a corner. Without it, nowhere. */
  readonly open?: readonly GroundRect[];
}

/** A cluster's reach (§14, `tools/rooms` `CLUSTER_LINK`). */
const REACH = 1.2;
/** How near a door a `by: "door"` thing stands. */
const BY_DOOR = 2.5;
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

/** The spots on an open patch of floor, every half metre (§12), the shape square to the room. */
const freeSpots = (r: GroundRect, e: KitEntry, floor: number): Spot[] => {
  const [hx, hz] = [e.along / 2, e.out / 2];
  const out: Spot[] = [];
  for (let x = r.minX + hx; x <= r.maxX - hx + 1e-9; x += STEP)
    for (let z = r.minZ + hz; z <= r.maxZ - hz + 1e-9; z += STEP) out.push({ x, z, y: floor, yaw: 0, hx, hz, onTop: false });
  return out;
};

/** An opening's top over the floor when the layout does not give it, and a sign's height with its hangers. */
const DOOR_TOP = 2.1;
const SIGN_H = 0.4;

/** The spot over each of the room's ways out, on the wall it is in: an exit sign's, its face to the room. */
const overDoorSpots = (room: RoomLayout, e: KitEntry): Spot[] =>
  (room.doors ?? []).map((d) => {
    const b = room.bounds;
    // The strip is thin across its wall: the wall runs along x when the strip is shallower in z.
    const alongX = d.maxZ - d.minZ < d.maxX - d.minX;
    const into = d.inward ?? (alongX ? { x: 0, z: Math.abs(d.maxZ - b.maxZ) < Math.abs(d.minZ - b.minZ) ? -1 : 1 } : { x: Math.abs(d.maxX - b.maxX) < Math.abs(d.minX - b.minX) ? -1 : 1, z: 0 });
    // The wall's face is the strip's side away from the room.
    const face = alongX ? { x: (d.minX + d.maxX) / 2, z: into.z < 0 ? d.maxZ : d.minZ } : { x: into.x < 0 ? d.maxX : d.minX, z: (d.minZ + d.maxZ) / 2 };
    const up = Math.min((d.top ?? DOOR_TOP) + 0.1, (room.ceiling ?? Infinity) - SIGN_H);
    const off = e.out / 2 + 0.02;
    const [hx, hz] = alongX ? [e.along / 2, e.out / 2] : [e.out / 2, e.along / 2];
    return { x: face.x + into.x * off, z: face.z + into.z * off, y: room.floor + up, yaw: Math.atan2(into.x, into.z), hx, hz, onTop: true };
  });

/** The spots of a kit entry's anchor in the room. */
const spotsOf = (room: RoomLayout, e: KitEntry): Spot[] => {
  if (e.anchor === "surface-top") return room.surfaces.flatMap((s) => topSpots(s, e));
  if (e.anchor === "floor-free") return (room.open ?? []).flatMap((r) => freeSpots(r, e, room.floor));
  if (e.anchor === "over-door") return overDoorSpots(room, e);
  return room.walls.flatMap((w) => wallSpots(w, e, room.floor));
};

/** How many of a shape the room gets: the kit's range, picked by the room's key. */
const countOf = (room: string, e: KitEntry): number => e.count[0] + (fnv1a(`${room}#${e.key}`) % (e.count[1] - e.count[0] + 1));

/** Does a clutter spot gather round a hero of its keys (or round anything placed, without keys)? */
const nearHero = (s: Spot, e: KitEntry, placed: readonly DressTaken[]): boolean =>
  placed.some((p) => (!e.near || (p.key !== undefined && e.near.includes(p.key))) && Math.hypot(s.x - (p.minX + p.maxX) / 2, s.z - (p.minZ + p.maxZ) / 2) <= REACH);

const clampTo = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const placedOf = (taken: readonly DressTaken[], key: string): DressTaken[] => taken.filter((t) => t.key === key);

/** The walls of a rectangular room along x and z, broken by its openings (each a span `[a0, a1]` along its wall). */
export const rectWalls = (
  r: GroundRect,
  openings: Readonly<Partial<Record<"n" | "s" | "e" | "w", readonly (readonly [number, number])[]>>> = {},
): DressWall[] => {
  const runs = (a0: number, a1: number, gaps: readonly (readonly [number, number])[] = []): [number, number][] => {
    const out: [number, number][] = [];
    let at = a0;
    for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) {
      if (g0 > at) out.push([at, Math.min(g0, a1)]);
      at = Math.max(at, g1);
    }
    if (at < a1) out.push([at, a1]);
    return out.filter(([p, q]) => q - p > 0.4);
  };
  return [
    ...runs(r.minX, r.maxX, openings.s).map(([a, b]): DressWall => ({ a: { x: a, z: r.minZ }, b: { x: b, z: r.minZ }, inward: { x: 0, z: 1 } })),
    ...runs(r.minX, r.maxX, openings.n).map(([a, b]): DressWall => ({ a: { x: a, z: r.maxZ }, b: { x: b, z: r.maxZ }, inward: { x: 0, z: -1 } })),
    ...runs(r.minZ, r.maxZ, openings.w).map(([a, b]): DressWall => ({ a: { x: r.minX, z: a }, b: { x: r.minX, z: b }, inward: { x: 1, z: 0 } })),
    ...runs(r.minZ, r.maxZ, openings.e).map(([a, b]): DressWall => ({ a: { x: r.maxX, z: a }, b: { x: r.maxX, z: b }, inward: { x: -1, z: 0 } })),
  ];
};

/** One kit entry's things, on the spots left, in its hashed order. */
const place = (room: RoomLayout, e: KitEntry, taken: DressTaken[]): StreetPropItem[] => {
  const spots = spotsOf(room, e);
  const order = spots.map((s, i) => ({ s, h: fnv1a(`${room.id}#${e.key}#${i}`) })).sort((a, b) => a.h - b.h || 0);
  const out: StreetPropItem[] = [];
  const want = countOf(room.id, e);
  for (const { s } of order) {
    if (out.length >= want) break;
    if (!s.onTop && (!within(s, room.bounds) || room.clear.some((r) => overlaps(s, r)))) continue;
    // A thing on a top minds only the other things on tops; on the floor, everything (the tops' solids among them).
    if (taken.some((t) => (s.onTop ? t.onTop === true : !t.onTop) && overlaps(s, t))) continue;
    if (e.role === "clutter" && !nearHero(s, e, taken)) continue;
    if (e.by && !(room.doors ?? []).some((d) => (e.by === "door" || d.weather) && Math.hypot(s.x - clampTo(s.x, d.minX, d.maxX), s.z - clampTo(s.z, d.minZ, d.maxZ)) <= BY_DOOR)) continue;
    if (e.apart && placedOf(taken, e.key).some((p) => Math.hypot(s.x - (p.minX + p.maxX) / 2, s.z - (p.minZ + p.maxZ) / 2) < e.apart!)) continue;
    taken.push(footprint(s, e.key));
    // A wall's model stands with its back on the wall: its origin half its depth behind its footprint's middle.
    const back = e.back ? e.out / 2 : 0;
    out.push({ prop: "room-detail", x: s.x - Math.sin(s.yaw) * back, y: s.y, z: s.z - Math.cos(s.yaw) * back, yaw: s.yaw, variant: roomDetailShape(e.key) });
  }
  return out;
};

/** A room dressed with its kit: the heroes first, then the clutter round them (ADR-0099 §3). */
export const dressRoom = (room: RoomLayout): StreetPropItem[] => {
  const kit = ROOM_KITS[room.kind];
  const taken: DressTaken[] = [...room.taken];
  return [...kit.filter((e) => e.role === "hero"), ...kit.filter((e) => e.role === "clutter")].flatMap((e) => place(room, e, taken));
};
