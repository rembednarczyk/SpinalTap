import type { NavGraph, NavNode } from "../builders";
import { ground } from "../lublin/terrain";
import { W3_BRIDGE_Z } from "./hall";
import { W3_HALL_EDGES, W3_HALL_NODES } from "./nav-hall";
import { W3_PIPE_LADDER, W3_TOWER_STAIR } from "./tower-pipes";
import { W3_PLATFORM, W3_ROOF, w3 } from "./site";

/**
 * W-3's level graph in stage 1 (ADR-0082, ADR-0021, ADR-0025): the way from the metro past Genzō
 * to the service gate and round the zone's yards, up the tower's stair to its platform, over the
 * bridge onto row N's roof and out along the pipe walk; on the river's west side, from the
 * Lutosławski bridge down to the foot of the pipeline's ladder (the ladder itself is the
 * player's). Stage 2 adds the hall's floors (`nav-hall.ts`). The ways up the stair's flights and over the bridge
 * reach onto their landings, so one standing at a turn is on the way and goes on.
 */

const P = W3_PLATFORM;
const R = W3_ROOF;
const node = (id: string, at: NavNode["at"]): NavNode => ({ id, at });

const NODES: readonly NavNode[] = [
  // The public strip: the metro's entrance A, Genzō's container, the service gate outside.
  node("w3-metro", ground(2534, 388)),
  node("w3-genzo", ground(2492.5, 388.6)),
  node("w3-strip-e", ground(2545, 389.6)),
  node("w3-wicket-out", ground(2550, 389.8)),
  // The zone's yards: inside the gate, the strip south of the hall, the east yard, the pickup yard,
  // the gap between the tower and the hall, the west yard before the wagon gate, the quay, the pier.
  node("w3-wicket-in", w3(2550, 0, 394)),
  node("w3-south", w3(2530, 0, 394)),
  node("w3-yard-se", w3(2589, 0, 394.5)),
  node("w3-east", w3(2589, 0, 420)),
  node("w3-pickup-e", w3(2589, 0, 443.8)),
  node("w3-pickup-w", w3(2505, 0, 443.8)),
  node("w3-gap-n", w3(2498, 0, 446)),
  node("w3-office-door", w3(2497.6, 0, 443)),
  node("w3-office", w3(2493, 0, 441.5)),
  node("w3-gap-s", w3(2498, 0, 437)),
  node("w3-stair-foot", w3(2495.6, 0, 435.1)),
  node("w3-west", w3(2494, 0, 426)),
  node("w3-gate-w", w3(2496, 0, 418)),
  node("w3-quay", w3(2482, 0, 430)),
  node("w3-pier", w3(2474.6, 0, 431.4)),
  // The tower's stair, its platform round the shaft, the bridge onto row N's roof.
  node("w3-stair-mid", w3(2485.5, 5, 435.1)),
  node("w3-stair-turn", w3(2485.4, 5, 433.1)),
  node("w3-stair-top", w3(2495.5, P, 433.1)),
  node("w3-plat-se", w3(2495, P, 437.1)),
  node("w3-plat-sw", w3(2487.2, P, 437.1)),
  node("w3-plat-nw", w3(2487.2, P, 444.9)),
  node("w3-plat-ne", w3(2495, P, 444.9)),
  node("w3-plat-w", w3(2487.2, P, 442.55)),
  node("w3-plat-e", w3(2495, P, 438.65)),
  node("w3-roof-nw", w3(2501.6, R, 438.65)),
  node("w3-roof-n1", w3(2530, R, 435)),
  node("w3-roof-n2", w3(2566, R, 435)),
  node("w3-roof-w", w3(2505, R, 418)),
  // The pipe walk.
  node("w3-pipe-e", w3(2484.5, P, 442.55)),
  node("w3-pipe-w", w3(2446, P, 442.55)),
  // West of the river: the bridge's deck at its west end, the bank's path, the ladder's foot.
  node("w3-bridge-w", ground(2443, 435.4)),
  node("w3-bank-w", ground(2441.2, 440.5)),
  node("w3-pipe-ladder", ground(W3_PIPE_LADDER.x, W3_PIPE_LADDER.z - 0.2)),
  ...W3_HALL_NODES,
];

const s = W3_TOWER_STAIR;

export const W3_NAV: NavGraph = {
  nodes: NODES,
  edges: [
    { a: "w3-metro", b: "w3-genzo" },
    { a: "w3-metro", b: "w3-strip-e" },
    { a: "w3-strip-e", b: "w3-wicket-out" },
    { a: "w3-wicket-out", b: "w3-wicket-in" },
    { a: "w3-wicket-in", b: "w3-south" },
    { a: "w3-wicket-in", b: "w3-yard-se" },
    { a: "w3-yard-se", b: "w3-east" },
    { a: "w3-east", b: "w3-pickup-e" },
    { a: "w3-pickup-e", b: "w3-pickup-w" },
    { a: "w3-pickup-w", b: "w3-gap-n" },
    { a: "w3-gap-n", b: "w3-office-door" },
    { a: "w3-office-door", b: "w3-office" },
    { a: "w3-office-door", b: "w3-gap-s" },
    { a: "w3-gap-s", b: "w3-stair-foot" },
    { a: "w3-stair-foot", b: "w3-west" },
    { a: "w3-west", b: "w3-gate-w" },
    { a: "w3-west", b: "w3-quay" },
    { a: "w3-quay", b: "w3-pier" },
    { a: "w3-stair-foot", b: "w3-stair-mid", via: { minX: s.first.minX - 0.4, maxX: s.first.maxX + 1.4, minZ: s.first.minZ, maxZ: s.first.maxZ } },
    { a: "w3-stair-mid", b: "w3-stair-turn" },
    { a: "w3-stair-turn", b: "w3-stair-top", via: { minX: s.landing.minX, maxX: s.second.maxX + 0.4, minZ: s.second.minZ, maxZ: s.second.maxZ } },
    { a: "w3-stair-top", b: "w3-plat-se" },
    { a: "w3-plat-se", b: "w3-plat-sw" },
    { a: "w3-plat-sw", b: "w3-plat-w" },
    { a: "w3-plat-w", b: "w3-plat-nw" },
    { a: "w3-plat-nw", b: "w3-plat-ne" },
    { a: "w3-plat-ne", b: "w3-plat-e" },
    { a: "w3-plat-se", b: "w3-plat-e" },
    { a: "w3-plat-e", b: "w3-roof-nw", via: { minX: 2494.6, maxX: 2501.2, minZ: W3_BRIDGE_Z.minZ, maxZ: W3_BRIDGE_Z.maxZ } },
    { a: "w3-roof-nw", b: "w3-roof-n1" },
    { a: "w3-roof-n1", b: "w3-roof-n2" },
    { a: "w3-roof-nw", b: "w3-roof-w" },
    { a: "w3-plat-w", b: "w3-pipe-e" },
    { a: "w3-pipe-e", b: "w3-pipe-w" },
    { a: "w3-bridge-w", b: "w3-bank-w" },
    { a: "w3-bank-w", b: "w3-pipe-ladder" },
    ...W3_HALL_EDGES,
  ],
};
