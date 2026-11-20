import type { Vec3 } from "@seki/core";
import type { World } from "miniplex";
import { type Aabb, rayAabb } from "./collision";
import type { Entity } from "./components";
import { type GroundField, groundOf } from "./ground";
import { solidIndexOf } from "./solid-index";
import type { SolidEntity } from "./solids";

/**
 * The memory of where a point joins the level graph (`nav.ts`), a dirty flag per answer (Game
 * Programming Patterns, "Dirty Flag"). The answer is the walk tests from the point to the nodes
 * round it: it holds while the point is the same (to the bit), no solid entered or left the world
 * (static ones never change shape) and no kinematic one (a lift, a gate, a door, a shuttle) moved
 * from or onto one of its sight lines. A chase asked it for the player standing still every step,
 * each ganger after her: half of the graph's cost in Alchemia's car park (ADR-0046, 20.11).
 * A pure cache: a miss makes what a hit would have given. Unlike the pattern's flag, set by whoever
 * changes the data, the answer checks what it was made from when it is read: the solids move in a
 * handful of systems (lifts, gates, doors, shuttles) that know nothing of the graph, and only their
 * boxes on its sight lines matter, not every move.
 */

/** A walk test's segment, from `a` to `b`. */
export interface Segment {
  readonly a: Vec3;
  readonly b: Vec3;
}

/** An answer and the walk tests it cast. */
export interface Swept<T> {
  readonly value: T;
  readonly cast: readonly Segment[];
}

/** A walk test as the ray it was cast along, and the box round it. */
interface Cast {
  readonly from: Vec3;
  readonly dir: Vec3;
  readonly len: number;
  readonly box: Aabb;
}

interface Entry<T> {
  readonly value: T;
  /** Each walk test, and the box round all of them (null: none cast). */
  readonly casts: readonly Cast[];
  readonly swept: Aabb | null;
  readonly generation: number;
  readonly ground: GroundField;
  /** The kinematic solids whose box met the swept one when the answer last held, with that box. */
  readonly inside: Map<SolidEntity, Aabb>;
}

/** Points remembered per world and graph: the target of a chase, a few more round it. */
const MAX_POINTS = 8;
/** Spare round a box (m): one touching it counts as meeting it, a ray grazing it as crossing it. */
const PAD = 1e-3;

const meets = (a: Aabb, b: Aabb): boolean =>
  a.min.x <= b.max.x + PAD &&
  a.max.x >= b.min.x - PAD &&
  a.min.y <= b.max.y + PAD &&
  a.max.y >= b.min.y - PAD &&
  a.min.z <= b.max.z + PAD &&
  a.max.z >= b.min.z - PAD;

const same = (a: Aabb, b: Aabb): boolean =>
  a.min.x === b.min.x && a.min.y === b.min.y && a.min.z === b.min.z && a.max.x === b.max.x && a.max.y === b.max.y && a.max.z === b.max.z;

const memos = new WeakMap<World<Entity>, WeakMap<object, Map<string, Entry<unknown>>>>();

const pointsOf = (world: World<Entity>, scope: object): Map<string, Entry<unknown>> => {
  let byScope = memos.get(world);
  if (!byScope) {
    byScope = new WeakMap();
    memos.set(world, byScope);
  }
  let points = byScope.get(scope);
  if (!points) {
    points = new Map();
    byScope.set(scope, points);
  }
  return points;
};

const boxOf = (points: readonly Vec3[]): Aabb => ({
  min: { x: Math.min(...points.map((p) => p.x)), y: Math.min(...points.map((p) => p.y)), z: Math.min(...points.map((p) => p.z)) },
  max: { x: Math.max(...points.map((p) => p.x)), y: Math.max(...points.map((p) => p.y)), z: Math.max(...points.map((p) => p.z)) },
});

const grown = (b: Aabb): Aabb => ({ min: { x: b.min.x - PAD, y: b.min.y - PAD, z: b.min.z - PAD }, max: { x: b.max.x + PAD, y: b.max.y + PAD, z: b.max.z + PAD } });

const castOf = ({ a, b }: Segment): Cast => {
  const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  const dir = len < 1e-9 ? { x: 0, y: 0, z: 0 } : { x: (b.x - a.x) / len, y: (b.y - a.y) / len, z: (b.z - a.z) / len };
  return { from: a, dir, len, box: boxOf([a, b]) };
};

/**
 * Might a walk test of `e` cross `box`? Every hit of a solid along a ray lies in its box (`raySolid`,
 * `raySolidEntity`): a ray that misses the box, grown a little, misses the solid.
 */
const crosses = (e: Entry<unknown>, box: Aabb): boolean => {
  const g = grown(box);
  return e.casts.some((c) => meets(box, c.box) && rayAabb(c.from, c.dir, g, c.len) !== null);
};

/**
 * Does the answer still hold? A kinematic solid that moved changes it only if it met a walk test
 * where it was or where it is: elsewhere in the box round them all (a door of the hall on the way
 * of no sight line), the answer stands, its new box remembered.
 */
const holds = (world: World<Entity>, e: Entry<unknown>): boolean => {
  const index = solidIndexOf(world);
  if (index.generation !== e.generation || groundOf(world) !== e.ground) return false;
  const swept = e.swept;
  if (!swept) return true;
  for (const k of index.kinematicSolids()) {
    const then = e.inside.get(k);
    const now = k.solid;
    if (then ? same(then, now) : !meets(now, swept)) continue;
    if ((then && crosses(e, then)) || crosses(e, now)) return false;
    if (meets(now, swept)) e.inside.set(k, now);
    else e.inside.delete(k);
  }
  return true;
};

/** A coordinate as a key, to the bit: -0 is not 0 (a ray along it divides by its sign). */
const bits = (v: number): string => (Object.is(v, -0) ? "-0" : String(v));

/** The answer for `at` within `scope` (a graph): the remembered one while it holds, else `make`'s, remembered. */
export const rememberedAt = <T>(world: World<Entity>, scope: object, at: Vec3, make: () => Swept<T>): T => {
  const points = pointsOf(world, scope);
  const key = `${bits(at.x)},${bits(at.y)},${bits(at.z)}`;
  const old = points.get(key);
  points.delete(key);
  if (old && holds(world, old)) {
    points.set(key, old);
    return old.value as T;
  }
  const index = solidIndexOf(world);
  const generation = index.generation;
  const { value, cast } = make();
  const casts = cast.map(castOf);
  const swept = cast.length > 0 ? boxOf(cast.flatMap((s) => [s.a, s.b])) : null;
  const inside = new Map<SolidEntity, Aabb>();
  if (swept) for (const k of index.kinematicSolids()) if (meets(k.solid, swept)) inside.set(k, k.solid);
  points.set(key, { value, casts, swept, generation, ground: groundOf(world), inside });
  while (points.size > MAX_POINTS) {
    const first = points.keys().next();
    if (first.done) break;
    points.delete(first.value);
  }
  return value;
};
