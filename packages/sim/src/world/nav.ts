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
  // On a flight of stairs both of its ends are in reach, whatever the height.
  for (const e of p.graph.edges) {
    const r = e.via;
    if (!r || from.x < r.minX || from.x > r.maxX || from.z < r.minZ || from.z > r.maxZ) continue;
    p.ids.forEach((id, i) => {
      const at = p.at[i];
      if (at && (id === e.a || id === e.b)) out.set(i, dist(from, at));
    });
  }
  p.at.forEach((at, i) => {
    if (out.has(i) || Math.abs(at.y - from.y) >= SAME_LEVEL) return;
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

const search = (world: World<Entity>, p: Prepared, from: Vec3): Search => {
  const n = p.at.length;
  const cost = new Array<number>(n).fill(Infinity);
  const prev = new Array<number>(n).fill(-1);
  const done = new Array<boolean>(n).fill(false);
  for (const [i, c] of attach(world, p, from)) cost[i] = c;
  for (;;) {
    let best = -1;
    let bestCost = Infinity;
    // Lowest cost first, lowest index on a tie: the same route on every machine.
    cost.forEach((c, i) => {
      if (!done[i] && c < bestCost) {
        best = i;
        bestCost = c;
      }
    });
    if (best < 0) break;
    done[best] = true;
    for (const { to, cost: c } of p.adj[best] ?? []) {
      if (bestCost + c < (cost[to] ?? Infinity)) {
        cost[to] = bestCost + c;
        prev[to] = best;
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
export const routeAcrossLevels = (world: World<Entity>, graph: NavGraph, from: Vec3, to: Vec3): RouteStep | null => {
  if (graph.nodes.length === 0) return null;
  const p = prepare(graph);
  const s = search(world, p, from);
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
export const firingPosition = (world: World<Entity>, graph: NavGraph, from: Vec3, target: Vec3, range: number): RouteStep | null => {
  if (graph.nodes.length === 0) return null;
  const p = prepare(graph);
  const s = search(world, p, from);
  let end = -1;
  let endCost = Infinity;
  p.at.forEach((at, i) => {
    const c = s.cost[i] ?? Infinity;
    if (c >= endCost || flat(at, target) > range - FIRING_MARGIN) return;
    if (lineOfSight(world, raise(at, EYE), raise(target, CHEST))) {
      end = i;
      endCost = c;
    }
  });
  if (end < 0) return null;
  // Standing on it already: hold there.
  return { next: firstStep(p, s, end, from) ?? from, cost: endCost };
};
