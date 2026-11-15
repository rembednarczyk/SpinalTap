import type { GroundPoint, StreetPropItem } from "@seki/core";
import { type StaticProp, crate, placeProps, skin, water } from "../builders";
import { groundY } from "../lublin/terrain";
import { barrierLine, barrierSolids, box, slabTop, unseenWall } from "./parts";
import {
  W3_BASIN,
  W3_FENCE,
  W3_FENCE_S0,
  W3_FENCE_SW,
  W3_HALL_CUT,
  W3_PIER,
  W3_QUAY_WALL,
  W3_VEHICLE_GATE,
  W3_WATER_Y,
  W3_WICKET,
  W3_Y,
} from "./site";

/**
 * W-3's edges (ADR-0082 stage 1): the fence round the zone, the quay and the pier on the river,
 * the basin's quay, the water. Per the curator's corrections:
 * - the fence 3 m off the riverside path; where the terrace stands over the zone's floor, a
 *   retaining wall under it takes the step (P1, P2);
 * - the quay's wall only along z 418.5..438.5, from the river's bench up to the floor (P4); the
 *   pier z 426..438 off it, on piles over the water (P7);
 * - a fence 2.7 m over the deck of the Lutosławski bridge along its north edge (P7: the bridge
 *   of 1908 has no parapet in the game, T-023), so nobody drops from it into the zone;
 * - the slanted bank by the tower stays earth, the fence 3 m off the water (P11).
 * Over the water's edges a railing 1.1 m and an unseen wall to the fence's height, as the docks'
 * were, till Seki can swim.
 */

/** The railing on the quay, the pier and the basin's quay. */
const RAILING = 1.1;
/** Lowest step of the terrace kept by a wall under the fence (m over the floor). */
const WALL_FROM = 0.4;

/** The Lutosławski bridge's north edge (OSM w834402001, audit): z = 439.4 - 0.594 (x - 2441.7), 0.15 m inside the deck. */
const bridgeEdge = (x: number): GroundPoint => ({ x, z: 439.4 - 0.594 * (x - 2441.7) - 0.15 });

/** The bridge's fence: along its north edge from the abutment to over the pier's south end (x 2466). */
const bridgeFence = (): StreetPropItem[] => barrierLine("fence", W3_FENCE, [bridgeEdge(2486), bridgeEdge(2466)], groundY);

/** How far outside the fence its foot is measured on the public side (m). */
const FOOT_OUT = 0.4;

/**
 * A line of the fence (the zone on its left, looking along it) on the ground of the public side,
 * with a retaining wall under it down to the zone's floor wherever that ground stands over it.
 */
const terraceFence = (line: readonly GroundPoint[]): StreetPropItem[] => {
  const out: StreetPropItem[] = [];
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i] as GroundPoint;
    const b = line[i + 1] as GroundPoint;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const [ox, oz] = [((b.z - a.z) / len) * FOOT_OUT, (-(b.x - a.x) / len) * FOOT_OUT];
    const n = Math.max(1, Math.ceil(len / 2));
    for (let k = 0; k < n; k++) {
      const p = { x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n };
      const q = { x: a.x + ((b.x - a.x) * (k + 1)) / n, z: a.z + ((b.z - a.z) * (k + 1)) / n };
      const foot = Math.max(groundY((p.x + q.x) / 2 + ox, (p.z + q.z) / 2 + oz), W3_Y);
      const step = Math.round((foot - W3_Y) * 10) / 10;
      if (step >= WALL_FROM) out.push(...barrierLine("retaining-wall", step, [p, q], () => W3_Y, "concrete"));
      out.push(...barrierLine("fence", W3_FENCE, [p, q], () => (step >= WALL_FROM ? W3_Y + step : groundY((p.x + q.x) / 2, (p.z + q.z) / 2))));
    }
  }
  return out;
};

const fenceOnGround = (line: readonly GroundPoint[]): StreetPropItem[] => barrierLine("fence", W3_FENCE, line, groundY);

/** The fence round the zone, the gates in it, the bridge's fence. */
const fences = (): StreetPropItem[] => {
  const z = W3_FENCE_S0.z;
  return [
    ...terraceFence([{ x: 2486.3, z: 412.9 }, ...W3_FENCE_SW]),
    ...terraceFence([W3_HALL_CUT[1], W3_FENCE_S0, { x: 2541, z }]),
    ...fenceOnGround([{ x: 2541, z }, { x: W3_WICKET.minX, z }]),
    ...barrierLine("gate", W3_FENCE, [{ x: W3_WICKET.minX, z }, { x: W3_WICKET.maxX, z }], groundY),
    ...fenceOnGround([{ x: W3_WICKET.maxX, z }, { x: W3_VEHICLE_GATE.minX, z }]),
    ...barrierLine("lift-gate", 1.1, [{ x: W3_VEHICLE_GATE.minX, z }, { x: W3_VEHICLE_GATE.maxX, z }], groundY),
    ...fenceOnGround([{ x: W3_VEHICLE_GATE.maxX, z }, { x: 2606, z }, { x: 2606, z: 452 }, { x: W3_BASIN.maxX, z: 452 }]),
    // The slanted bank by the tower (P11), round to its north face; the quay's north end.
    ...fenceOnGround([{ x: W3_BASIN.minX, z: 452 }, { x: 2493, z: 452 }, { x: 2493, z: 446.1 }]),
    ...fenceOnGround([{ x: 2486, z: 440 }, { x: W3_QUAY_WALL.minX, z: 440 }]),
    ...bridgeFence(),
  ];
};

/** Railings over the water: the quay's edge either side of the pier, round the pier, along the basin's quay. */
const WATER_EDGES: readonly (readonly GroundPoint[])[] = [
  [
    { x: W3_QUAY_WALL.minX + 0.1, z: W3_QUAY_WALL.maxZ },
    { x: W3_QUAY_WALL.minX + 0.1, z: W3_PIER.maxZ },
  ],
  [
    { x: W3_PIER.maxX, z: W3_PIER.maxZ - 0.1 },
    { x: W3_PIER.minX + 0.1, z: W3_PIER.maxZ - 0.1 },
    { x: W3_PIER.minX + 0.1, z: W3_PIER.minZ + 0.1 },
    { x: W3_PIER.maxX, z: W3_PIER.minZ + 0.1 },
  ],
  // Off the bridge's deck: its north edge is at z 418.37 by x 2477.
  [
    { x: W3_QUAY_WALL.minX + 0.1, z: W3_PIER.minZ },
    { x: W3_QUAY_WALL.minX + 0.1, z: W3_QUAY_WALL.minZ },
  ],
  [
    { x: W3_BASIN.maxX, z: 451.9 },
    { x: W3_BASIN.minX, z: 451.9 },
  ],
];

/**
 * The pier's west and south edges face the bridge's deck, 1.8 m over the floor and 1-4 m off: its
 * unseen wall rises to the bridge fence's top over the deck (+4.5), past any jump from the deck
 * (review round 2: a jump's peak is 1.225 m). Just off the pier's edge, so nobody stands on the
 * deck's rim outside it.
 */
const PIER_BRIDGE_SIDE: readonly GroundPoint[] = [
  { x: W3_PIER.minX - 0.15, z: W3_PIER.maxZ },
  { x: W3_PIER.minX - 0.15, z: W3_PIER.minZ - 0.15 },
  { x: W3_PIER.maxX, z: W3_PIER.minZ - 0.15 },
];
/** Over the bridge's deck (+1.8) as high as its fence. */
const OVER_DECK = 4.6;

/** The unseen walls go down past the river's bed: nobody in the water walks under one onto the pier. */
const UNDER = 3;

/** The unseen walls over the water's edges (a body stops, the eye passes). */
/**
 * The water's edges again, just off the floor's rim (0.15 m out): the wall stands where nobody in the
 * water can stand on the rim outside it. The quay's edge, the pier's north side, the basin's quay.
 */
const OUT = 0.15;
const UNSEEN_EDGES: readonly (readonly GroundPoint[])[] = [
  [
    { x: W3_QUAY_WALL.minX - OUT, z: W3_QUAY_WALL.maxZ },
    { x: W3_QUAY_WALL.minX - OUT, z: W3_PIER.maxZ + OUT },
    { x: W3_PIER.minX - OUT, z: W3_PIER.maxZ + OUT },
    { x: W3_PIER.minX - OUT, z: W3_PIER.maxZ },
  ],
  [
    { x: W3_PIER.maxX, z: W3_PIER.minZ - OUT },
    { x: W3_QUAY_WALL.minX - OUT, z: W3_PIER.minZ - OUT },
    // Short of the bridge's deck (its north edge at z 418.52 there).
    { x: W3_QUAY_WALL.minX - OUT, z: W3_QUAY_WALL.minZ + 0.2 },
  ],
  [
    { x: W3_BASIN.maxX, z: W3_BASIN.minZ + OUT },
    { x: W3_BASIN.minX, z: W3_BASIN.minZ + OUT },
  ],
];

export const W3_UNSEEN_WALLS: readonly StaticProp[] = [
  ...UNSEEN_EDGES.flatMap((line) => unseenWall(line, W3_Y - UNDER, W3_FENCE + UNDER)),
  ...unseenWall(PIER_BRIDGE_SIDE, W3_Y - UNDER, OVER_DECK + UNDER),
];

const railings = (): StreetPropItem[] => WATER_EDGES.flatMap((line) => barrierLine("fence", RAILING, line, () => W3_Y));

/** The barriers of W-3's edges, drawn with the furniture. */
export const W3_EDGE_BARRIERS: readonly StreetPropItem[] = [...fences(), ...railings()];

/** How deep a solid's foot goes into the ground under it (m). */
const SINK = 0.25;
/** The middle of the basin's quay wall (its face over the water at z 452), the pickup yard's paved edge before it. */
const BASIN_WALL = 451.75;

/** The quay's wall, the pier on its piles with the armoured car, the basin's quay wall, the water. */
const quayAndPier = (): StaticProp[] => {
  const w = W3_QUAY_WALL;
  const p = W3_PIER;
  // Each solid's foot sunk a little into the ground under its middle (the scan's prop-off-ground).
  const foot = (x: number, z: number) => groundY(x, z) - W3_Y - SINK;
  const piles = [2468, 2472.5].flatMap((x) => [428, 436].map((z) => box(x - 0.25, x + 0.25, foot(x, z), -0.4, z - 0.25, z + 0.25, "concrete")));
  return [
    box(w.minX, w.maxX, foot((w.minX + w.maxX) / 2, (w.minZ + w.maxZ) / 2), 0, w.minZ, w.maxZ, "concrete"),
    slabTop(p.minX, p.maxX, p.minZ, p.maxZ, 0, 0.4, "concrete"),
    ...piles,
    // The armoured car on the pier: cover.
    ...placeProps({ x: 0, y: W3_Y, z: 0 }, [crate(2470.5, 435.7, 5.4, 2.4, 2.4, skin("van", "x-"))]),
    // The basin's quay wall: the pickup yard's edge over the water, half a metre past the basin's
    // ends, over the terrain's last cell sloping into it (to the grid's columns at x 2507.5, 2592.5).
    box(W3_BASIN.minX - 0.5, W3_BASIN.maxX + 0.5, foot(2550, BASIN_WALL), 0, BASIN_WALL - 0.25, W3_BASIN.minZ, "concrete"),
    slabTop(W3_BASIN.minX - 0.5, W3_BASIN.maxX + 0.5, 450, BASIN_WALL - 0.25, 0, 0.3, "concrete"),
    water(W3_BASIN.minX, W3_BASIN.maxX, W3_BASIN.minZ, W3_BASIN.maxZ + 1.5, W3_WATER_Y),
  ];
};

/** W-3's edges as solids: the quay, the pier, the drawn barriers and the unseen walls over the water. */
export const W3_EDGE_PROPS: readonly StaticProp[] = [
  ...quayAndPier(),
  ...barrierSolids(W3_EDGE_BARRIERS),
  ...W3_UNSEEN_WALLS,
];
