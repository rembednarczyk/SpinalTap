import type { Vec3 } from "@seki/core";
import type { World } from "miniplex";
import type { NavGraph } from "../content/builders";
import type { Entity } from "./components";
import { lineOfSight } from "./hitscan";

/**
 * Navigation between levels (ADR-0021): a small hand-placed graph of transition points per
 * district (the foot and the head of each flight of stairs, a few points on the floor around
 * them), searched with Dijkstra. No navmesh: on its own level an NPC still walks straight at
 * its goal, the graph only answers "which way up (or down)". Everything is a pure function of
 * the world and the graph, so it is deterministic and holds no state between steps.
 */

/** A target this far above or below is on another level. */
export const LEVEL_GAP = 1.5;
/** A point and a node closer than this in height are on the same level. */
const SAME_LEVEL = 1;
/** The walk test casts at knee height: a counter or a stair railing blocks it, a kerb does not. */
const KNEE = 0.6;
/** A node this close (horizontally) is reached; the route goes on to the next one. */
export const ARRIVE = 0.5;

/**
 * A node farther than this (horizontally) is no way straight there. The graph's longest edge is 84 m
 * (W-3's pickup yard); farther the knee-high line runs off the streamed chunks, where nothing stops
 * a ray: W-3's reinforcements tested the platforms of Targowa's metro, 1.74 km away and on their
 * level, every step, at some twenty times the cost of a near line, and "saw" some through the earth.
 */
export const REACH = 120;

/** A firing position lies this far inside the weapon range: the shooter stops short of the node. */
const FIRING_MARGIN = ARRIVE + 1;

const EYE = 1.62;
const CHEST = 1.25;

const raise = (p: Vec3, dy: number): Vec3 => ({ x: p.x, y: p.y + dy, z: p.z });
const dist = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const flat = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.z - b.z);

interface Link {
  readonly to: number;
  readonly cost: number;
}

/** The graph with node indices resolved, built once per graph. */
interface Prepared {
  readonly at: readonly Vec3[];
  readonly ids: readonly string[];
  /** Neighbours per node index, in edge order. */
  readonly adj: readonly (readonly Link[])[];
  readonly graph: NavGraph;
}

const prepared = new WeakMap<NavGraph, Prepared>();

const prepare = (graph: NavGraph): Prepared => {
  const cached = prepared.get(graph);
  if (cached) return cached;
  const at = graph.nodes.map((n) => n.at);
  const index = new Map(graph.nodes.map((n, i) => [n.id, i]));
  const adj: Link[][] = graph.nodes.map(() => []);
  for (const e of graph.edges) {
    const a = index.get(e.a);
    const b = index.get(e.b);
    const pa = a === undefined ? undefined : at[a];
    const pb = b === undefined ? undefined : at[b];
    if (a === undefined || b === undefined || !pa || !pb) throw new Error(`nav edge ${e.a}-${e.b}: unknown node`);
    const cost = dist(pa, pb);
    adj[a]?.push({ to: b, cost });
    adj[b]?.push({ to: a, cost });
  }
  const p: Prepared = { at, ids: graph.nodes.map((n) => n.id), adj, graph };
  prepared.set(graph, p);
  return p;
};

/** Nodes a character standing at `from` can walk to directly, with the cost of getting there. */
const attach = (world: World<Entity>, p: Prepared, from: Vec3): Map<number, number> => {
  const out = new Map<number, number>();
  // On a flight of stairs both of its ends are in reach, whatever the height between them; over
  // or under it they are not (the street over a metro's second flight, G-368).
  for (const e of p.graph.edges) {
    const r = e.via;
    if (!r || from.x < r.minX || from.x > r.maxX || from.z < r.minZ || from.z > r.maxZ) continue;
    const ya = p.at[p.ids.indexOf(e.a)]?.y ?? from.y;
    const yb = p.at[p.ids.indexOf(e.b)]?.y ?? from.y;
    if (from.y > Math.max(ya, yb) + SAME_LEVEL || from.y < Math.min(ya, yb) - SAME_LEVEL) continue;
    p.ids.forEach((id, i) => {
      const at = p.at[i];
      if (at && (id === e.a || id === e.b)) out.set(i, dist(from, at));
    });
  }
  p.at.forEach((at, i) => {
    if (out.has(i) || Math.abs(at.y - from.y) >= SAME_LEVEL || flat(at, from) > REACH) return;
    if (lineOfSight(world, raise(from, KNEE), raise(at, KNEE))) out.set(i, dist(from, at));
  });
  return out;
};

interface Search {
  /** Cheapest way from the start to each node; Infinity where unreachable. */
  readonly cost: readonly number[];
  /** Previous node on that way, -1 for the first one. */
  readonly prev: readonly number[];
}

/** A binary min-heap of (cost, node) pairs, lowest cost first and the lowest node on a tie. */
class Frontier {
  private readonly items: [number, number][] = [];

  get size(): number {
    return this.items.length;
  }

  private static less(a: [number, number], b: [number, number]): boolean {
    return a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
  }

  push(c: number, i: number): void {
    const h = this.items;
    h.push([c, i]);
    for (let k = h.length - 1; k > 0; ) {
      const up = (k - 1) >> 1;
      if (!Frontier.less(h[k]!, h[up]!)) break;
      [h[k], h[up]] = [h[up]!, h[k]!];
      k = up;
    }
  }

  pop(): [number, number] {
    const h = this.items;
    const top = h[0]!;
    const last = h.pop()!;
    if (h.length > 0) {
      h[0] = last;
      for (let k = 0; ; ) {
        const [l, r] = [2 * k + 1, 2 * k + 2];
        let m = k;
        if (l < h.length && Frontier.less(h[l]!, h[m]!)) m = l;
        if (r < h.length && Frontier.less(h[r]!, h[m]!)) m = r;
        if (m === k) break;
        [h[k], h[m]] = [h[m]!, h[k]!];
        k = m;
      }
    }
    return top;
  }
}

/**
 * Dijkstra from the nodes in reach of `from`. Lowest cost first, lowest index on a tie: the same route
 * on every machine. A heap of the frontier (ADR-0093 O1: the gallery's floors grew the graph, and the
 * scan of every node for the next one grew with its square); the order nodes are settled in, and so
 * every way, is the scan's.
 */
const search = (world: World<Entity>, p: Prepared, from: Vec3): Search => {
  const n = p.at.length;
  const cost = new Array<number>(n).fill(Infinity);
  const prev = new Array<number>(n).fill(-1);
  const done = new Array<boolean>(n).fill(false);
  const frontier = new Frontier();
  for (const [i, c] of attach(world, p, from)) cost[i] = c;
  cost.forEach((c, i) => {
    if (c < Infinity) frontier.push(c, i);
  });
  while (frontier.size > 0) {
    const [bestCost, best] = frontier.pop();
    if (done[best] || bestCost !== cost[best]) continue;
    done[best] = true;
    for (const { to, cost: c } of p.adj[best] ?? []) {
      if (bestCost + c < (cost[to] ?? Infinity)) {
        cost[to] = bestCost + c;
        prev[to] = best;
        frontier.push(cost[to]!, to);
      }
    }
  }
  return { cost, prev };
};

/** Where to walk next on the way to node `end`: the first node of the path not yet reached. */
const firstStep = (p: Prepared, s: Search, end: number, from: Vec3): Vec3 | null => {
  const path: number[] = [];
  for (let i = end; i >= 0; i = s.prev[i] ?? -1) path.unshift(i);
  for (const i of path) {
    const at = p.at[i];
    if (at && flat(at, from) > ARRIVE) return at;
  }
  return null;
};

/**
 * The search from one point, for a walker that asks for both its way up and its firing position from
 * where it stands this step (`levelSearch`): made once, not once a question. Only for the world as it
 * stands: a kinematic solid (a lift, a gate) moved since makes another.
 */
export interface LevelSearch {
  readonly graph: NavGraph;
  readonly from: Vec3;
  readonly search: Search;
}

/** The search from `from` through the graph (null without nodes), to hand to the questions asked from there this step. */
export const levelSearch = (world: World<Entity>, graph: NavGraph, from: Vec3): LevelSearch | null =>
  graph.nodes.length === 0 ? null : { graph, from: { ...from }, search: search(world, prepare(graph), from) };

const searchOf = (world: World<Entity>, p: Prepared, from: Vec3, near: LevelSearch | undefined): Search =>
  near && near.graph === p.graph && near.from.x === from.x && near.from.y === from.y && near.from.z === from.z ? near.search : search(world, p, from);

export interface RouteStep {
  /** Point to walk towards this step. */
  readonly next: Vec3;
  /** Length of the whole way, metres. */
  readonly cost: number;
}

/**
 * The way from `from` to `to` on another level through the graph, or null when the graph
 * does not connect them (a roof reached by a ladder: NPCs do not climb).
 */
export const routeAcrossLevels = (world: World<Entity>, graph: NavGraph, from: Vec3, to: Vec3, near?: LevelSearch): RouteStep | null => {
  if (graph.nodes.length === 0) return null;
  const p = prepare(graph);
  const s = searchOf(world, p, from, near);
  let end = -1;
  let total = Infinity;
  for (const [i, c] of attach(world, p, to)) {
    const t = (s.cost[i] ?? Infinity) + c;
    if (t < total || (t === total && i < end)) {
      total = t;
      end = i;
    }
  }
  if (end < 0 || total === Infinity) return null;
  // Every node of the way is behind: straight at the target.
  return { next: firstStep(p, s, end, from) ?? to, cost: total };
};

/**
 * The nearest node (by the way there) from which a shooter standing on it sees `target`'s
 * chest within `range`: a firing position. Null when there is none.
 */
export const firingPosition = (world: World<Entity>, graph: NavGraph, from: Vec3, target: Vec3, range: number, near?: LevelSearch): RouteStep | null => {
  if (graph.nodes.length === 0) return null;
  const p = prepare(graph);
  const s = searchOf(world, p, from, near);
  // The cheapest node by the way there (the lowest index on a tie) that sees the target: the nodes
  // in that order up to the first that does. The scan by index, the same node, cast a sight line
  // from every node cheaper than the last one seeing, most of those in range; a wave of four after
  // Oyaji, from T1 up to P3 (ADR-0093 O3), asked it each a step.
  const order: number[] = [];
  p.at.forEach((at, i) => {
    if ((s.cost[i] ?? Infinity) < Infinity && flat(at, target) <= range - FIRING_MARGIN) order.push(i);
  });
  order.sort((a, b) => s.cost[a]! - s.cost[b]! || a - b);
  const end = order.find((i) => lineOfSight(world, raise(p.at[i]!, EYE), raise(target, CHEST))) ?? -1;
  if (end < 0) return null;
  const endCost = s.cost[end]!;
  const step = firstStep(p, s, end, from);
  if (step) return { next: step, cost: endCost };
  // Standing on it already: hold there, unless the shot is the node's and not from here. Within
  // `ARRIVE` of the head of a metro's stairs the pavilion's lintel hides the hall (G-368).
  const at = p.at[end];
  const held = !at || lineOfSight(world, raise(from, EYE), raise(target, CHEST)) ? from : at;
  return { next: held, cost: endCost };
};
