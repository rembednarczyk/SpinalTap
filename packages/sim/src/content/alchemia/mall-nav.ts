import type { NavEdge, NavGraph, NavNode, Rect } from "../builders";
import { groundY } from "../lublin/terrain";
import { CORE_WALL, ESCALATORS, LANE_A, LANE_B, MAIN_WAY_X, MALL, MALL_LEVELS, STAIR_CORES, type StairCore, escalatorHead } from "./mall-plan";
import { coreLanes, coreSpan } from "./mall-cores";
import { STAIR_HOUSE } from "./foodhall";

/*
 * The gallery in the level graph (ADR-0093 O1, as the hall's in `nav.ts`): on every floor four nodes
 * round the atrium on the gallery (and one by the escalators' landing), the cores' flights storey by
 * storey (a node at each end of each lane: the floor landing's two, the mid landing's two), the
 * escalators as flights, the doors from T0's strip, the east ramp and the hall's stair house. The
 * lifts are the player's (ADR-0021: no lifts in the graph).
 */

const L = MALL_LEVELS;
const UPPER: readonly [string, number][] = [
  ["g1", L.p1],
  ["g2", L.p2],
  ["g3", L.p3],
  ["gr", L.roof],
];

const node = (id: string, x: number, y: number, z: number): NavNode => ({ id: `alchemia-${id}`, at: { x, y, z } });
const edge = (a: string, b: string, via?: Rect): NavEdge => ({ a: `alchemia-${a}`, b: `alchemia-${b}`, ...(via ? { via } : {}) });
const on = (id: string, x: number, z: number): NavNode => node(id, x, groundY(x, z), z);

/**
 * The gallery's ring round the atrium on a floor: south-west, south (by the escalators), south-east.
 * The rest of the ring is in sight of them along the west and east galleries (few nodes: the level
 * graph's search grows with the square of its nodes, every walker's every step).
 */
const RING: readonly [string, number, number][] = [
  ["sw", 409.5, 38.5],
  ["s", 416.8, 38.5],
  ["se", 426.5, 38.5],
];

/**
 * On the floors with shops (ADR-0093 O2) the east gallery's north end, by the north-east lift's lobby:
 * the shops' partitions hide the lobby from the ring's south-east node.
 */
const EAST: readonly [string, number, number] = ["e", 426.5, 50.65];
/** And on the food hall's P3 (O3): its east tables hide it from the south-east node too. */
const SHOP_FLOORS: ReadonlySet<string> = new Set(["g1", "g2", "g3"]);

const ringNodes = (): NavNode[] => [
  ...UPPER.flatMap(([f, y]) => RING.map(([k, x, z]) => node(`${f}-${k}`, x, y, z))),
  ...UPPER.filter(([f]) => SHOP_FLOORS.has(f)).map(([f, y]) => node(`${f}-${EAST[0]}`, EAST[1], y, EAST[2])),
];
const ringEdges = (): NavEdge[] => [
  ...UPPER.flatMap(([f]) => RING.slice(1).map(([k], i) => edge(`${f}-${RING[i]![0]}`, `${f}-${k}`))),
  ...UPPER.filter(([f]) => SHOP_FLOORS.has(f)).map(([f]) => edge(`${f}-se`, `${f}-${EAST[0]}`)),
];

/** A core's nodes and edges: per floor its landing's two (south and north lane) and the door's outside, per storey the mid landing's two. */
const core = (c: StairCore): { nodes: NavNode[]; edges: NavEdge[] } => {
  const lanes = coreLanes(c);
  const [zs, zn] = [(lanes.s.z0 + lanes.s.z1) / 2, (lanes.n.z0 + lanes.n.z1) / 2];
  const xl = c.x0 + c.landing / 2;
  const id = (what: string, i: number) => `core-${c.key}-${what}-${i}`;
  const door = c.door.side === "n" ? { x: (c.door.a0 + c.door.a1) / 2, z: c.z1 + CORE_WALL + 1.0 } : { x: c.x0 - CORE_WALL - 1.0, z: (c.door.a0 + c.door.a1) / 2 };
  const nodes: NavNode[] = [];
  const edges: NavEdge[] = [];
  c.floors.forEach((y, i) => {
    nodes.push(node(id("s", i), xl, y, zs), node(id("n", i), xl, y, zn), node(id("door", i), door.x, y, door.z));
    edges.push(edge(id("s", i), id("n", i)), edge(id("n", i), id("door", i)));
    const next = c.floors[i + 1];
    if (next === undefined) return;
    const rise = next - y;
    const { xm } = coreSpan(c, rise);
    const xmid = (xm + c.x1) / 2;
    nodes.push(node(id("mid-n", i), xmid, y + rise / 2, zn), node(id("mid-s", i), xmid, y + rise / 2, zs));
    edges.push(
      // Each lane's way over the whole core, its landings too: a body by either end is on the way (no hunting back and forth round a node).
      edge(id("n", i), id("mid-n", i), { minX: c.x0, maxX: c.x1, minZ: lanes.n.z0, maxZ: lanes.n.z1 }),
      edge(id("mid-n", i), id("mid-s", i)),
      edge(id("mid-s", i), id("s", i + 1), { minX: c.x0, maxX: c.x1, minZ: lanes.s.z0, maxZ: lanes.s.z1 }),
    );
  });
  return { nodes, edges };
};

const CORES = STAIR_CORES.map(core);
/**
 * A core's door opens beside the ring's south-west node (the south-west core's) or in sight of its
 * south-east one up the east gallery (the north-east's); on P0 (O3) beside the north-east node by the
 * lift's lobby (`P0_NODES`).
 */
const coreToRing = (): NavEdge[] =>
  STAIR_CORES.flatMap((c) =>
    c.floors.map((y, i) => {
      const f = UPPER.find(([, g]) => g === y);
      // On the roof (O4) the north-east core's door opens onto its way north off the ring's north-east corner.
      const ring = c.key === "sw" ? "sw" : f?.[0] === "gr" ? "ne" : "se";
      return edge(`core-${c.key}-door-${i}`, f ? `${f[0]}-${ring}` : "g0-ne");
    }),
  );

/**
 * P0's walkway round the atrium (O3, its shops round it): a node by the north-east lift's lobby, before
 * the core's corridor, in sight of the way in's aisle along the north side and of the escalators' foot
 * along the east one. The east door from T1 opens into the core's corridor.
 */
const P0_NODES: readonly NavNode[] = [node("g0-ne", 426.5, L.p0, 51.2)];
const P0_EDGES: readonly NavEdge[] = [edge("g0-ne", "hall-centre"), edge("g0-ne", "g0-east"), edge("t1-east-door", "core-ne-door-0")];

/**
 * The food hall on P3 (O3): the west gallery's north end and the aisles before the west and east
 * units' counters, behind the tables (their customers in sight of no ring node past them).
 */
const P3_NODES: readonly NavNode[] = [
  node("g3-w", 409.0, L.p3, 50.5),
  node("g3-wa", 405.2, L.p3, 48.4),
  node("g3-ea", 430.7, L.p3, 49.0),
  // Before and behind the flap at the north end of Oyaji's counter: the Hebi's way in to him (his back door onto T1 on P0 until O3).
  node("g3-oyaji-out", 427.2, L.p3, 36.0),
  node("g3-oyaji-in", 429.6, L.p3, 36.0),
];
const P3_EDGES: readonly NavEdge[] = [edge("g3-sw", "g3-w"), edge("g3-w", "g3-wa"), edge("g3-e", "g3-ea"), edge("g3-se", "g3-oyaji-out"), edge("g3-oyaji-out", "g3-oyaji-in")];

/**
 * The green roof (O4): the paved ring's north corners round the atrium's balustrade (the west and
 * north-east ways past the beds and pergolas) and the west pergola's middle between its benches.
 */
const ROOF_NODES: readonly NavNode[] = [node("gr-nw", 409.6, L.roof, 51.4), node("gr-ne", 426.5, L.roof, 51.4), node("gr-wp", 404.3, L.roof, 52.05)];
const ROOF_EDGES: readonly NavEdge[] = [edge("gr-sw", "gr-nw"), edge("gr-nw", "gr-ne"), edge("gr-se", "gr-ne"), edge("gr-nw", "gr-wp")];

/** The escalators' ends: P0's foot, each landing's node in lane A and in lane B. */
const [E1, E2, E3] = ESCALATORS as readonly [(typeof ESCALATORS)[number], (typeof ESCALATORS)[number], (typeof ESCALATORS)[number]];
const za = (LANE_A.z0 + LANE_A.z1) / 2;
const zb = (LANE_B.z0 + LANE_B.z1) / 2;
/**
 * A flight's way, the floor before its foot included (a body on its first tread is on the way, not back
 * on the floor it left); not past its head, under whose landing the floor below runs on.
 */
const lane = (e: typeof E1): Rect => {
  const head = escalatorHead(e);
  const foot = e.x0 - e.dir * 1.5;
  return { minX: Math.min(foot, head), maxX: Math.max(foot, head), minZ: e.lane.z0, maxZ: e.lane.z1 };
};

/** A flight's foot a step before its first tread; its head a hand onto its landing, within reach of its way's end (no hunting round a node). */
const footAt = (e: typeof E1): number => e.x0 - e.dir * 0.6;
const headAt = (e: typeof E1): number => escalatorHead(e) + e.dir * 0.3;
const ESCALATOR_NODES: readonly NavNode[] = [
  node("g0-esc", footAt(E1), L.p0, za),
  node("g0-east", E1.x0 - E1.dir * 1.2, L.p0, 39.2),
  node("g1-esc-a", headAt(E1), L.p1, za),
  node("g1-esc-b", footAt(E2), L.p1, zb),
  node("g2-esc-b", headAt(E2), L.p2, zb),
  node("g2-esc-a", footAt(E3), L.p2, za),
  node("g3-esc-a", headAt(E3), L.p3, za),
];
const ESCALATOR_EDGES: readonly NavEdge[] = [
  edge("g0-esc", "g1-esc-a", lane(E1)),
  edge("g1-esc-a", "g1-esc-b"),
  edge("g1-esc-b", "g2-esc-b", lane(E2)),
  edge("g2-esc-b", "g2-esc-a"),
  edge("g2-esc-a", "g3-esc-a", lane(E3)),
  // Off the landings onto the gallery.
  edge("g1-esc-a", "g1-s"),
  edge("g2-esc-a", "g2-se"),
  edge("g3-esc-a", "g3-s"),
  // P0's foot, by the hall's back aisle south of the first flight.
  edge("g0-esc", "g0-east"),
  edge("g0-east", "hall-south"),
];

/** Inside the hall's stair house on its landing at P1, between its doors south, west and north (into the south-west core). */
const SH = { x: (STAIR_HOUSE.north.x0 + STAIR_HOUSE.north.x1) / 2 + 0.05, z: 33.4 } as const;

const DOOR_NODES: readonly NavNode[] = [
  node("sh-landing", SH.x, L.p1, SH.z),
  on("g1-west-out", MALL.x0 - 1.4, (STAIR_HOUSE.west.z0 + STAIR_HOUSE.west.z1) / 2),
  node("g1-east-in", MALL.x1 - 1.4, L.p1, 33.15),
  on("g1-east-out", MALL.x1 + 1.6, 33.15),
  // Between the shops (ADR-0093 O2): on the gallery straight in from the main doors, and the east door's lobby's west end before its way north to the gallery.
  node("g1-main-in", MAIN_WAY_X, L.p1, 37.8),
  // The main entrance's way from Bajkowskiego (O2b) where it passes P-1's stair house, in sight of the footway and of its door.
  on("t0-axis", MAIN_WAY_X, 11.0),
  node("g1-east-lobby", 426.6, L.p1, 34.0),
];
const DOOR_EDGES: readonly NavEdge[] = [
  edge("stair-head", "sh-landing"),
  edge("sh-landing", "g1-west-out"),
  edge("g1-west-out", "t0-west"),
  edge("sh-landing", "core-sw-s-0"),
  // Through the main doors from T0's strip onto the gallery's south side, between the shops either side of the doors' hall (O2).
  edge("t0-roof", "g1-main-in"),
  // Up the main entrance's way under L2 to T0's strip before the doors, and round P-1's stair house's corner to its door (O2b).
  edge("t0-axis", "t0-roof"),
  edge("t0-axis", "p1-stair-out"),
  edge("g1-main-in", "g1-s"),
  edge("t0-east", "g1-east-out"),
  edge("g1-east-out", "g1-east-in"),
  edge("g1-east-in", "g1-east-lobby"),
  edge("g1-east-lobby", "g1-se"),
];

/** The gallery's graph, joined to the hall's (`nav.ts`) at its stair head, its back aisle and T0's nodes. */
export const MALL_NAV: NavGraph = {
  nodes: [...ringNodes(), ...CORES.flatMap((c) => c.nodes), ...ESCALATOR_NODES, ...DOOR_NODES, ...P0_NODES, ...P3_NODES, ...ROOF_NODES],
  edges: [...ringEdges(), ...CORES.flatMap((c) => c.edges), ...coreToRing(), ...ESCALATOR_EDGES, ...DOOR_EDGES, ...P0_EDGES, ...P3_EDGES, ...ROOF_EDGES],
};
