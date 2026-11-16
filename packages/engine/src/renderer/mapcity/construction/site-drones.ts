import { groundY } from "@seki/sim";
import { LUBLIN_CONSTRUCTION_SITES, type LublinConstructionSiteData, sitePieces } from "@seki/sim/lublin";
import { BOB, DRONE_LAYER } from "../../drones/drone-flight";
import { type DroneLane, STEP } from "../../drones/drone-lanes";

/**
 * The building sites' delivery drones (ADR-0087 step 4, stage 2): one a site with a crane, on a
 * fixed lane from the gate to the middle of the dig and back, among the canyon drones in their
 * shared mesh (`DroneViews`), so no draw call more and none on the phones (`low` has no drones).
 * Its place on the loop from the site's seed. It flies `CLEAR` m over the higher of the lane's
 * ends: over the fence and the stacked containers, under the crane's hook, which hangs high at
 * rest (`site-crane.ts`); the generator keeps the crane's mast off the lane.
 */

/** The drone's feet over the higher end of its lane (m). */
export const CLEAR = 8;
/** The shortest lane a site gets (m). */
const SHORTEST = 2 * STEP;

/** The lane of a site with a crane, a gate and a dig; null without. */
export const siteDroneLane = (s: LublinConstructionSiteData, groundAt: (x: number, z: number) => number = groundY): DroneLane | null => {
  const pieces = sitePieces([s]);
  const gate = pieces.find((p) => p.prop === "site-gate");
  if (!s.dig || !gate || !pieces.some((p) => p.prop === "site-crane")) return null;
  const o = s.dig.outline;
  const mid = { x: (o[0]! + o[2]! + o[4]! + o[6]!) / 4, z: (o[1]! + o[3]! + o[5]! + o[7]!) / 4 };
  const d = Math.hypot(mid.x - gate.x, mid.z - gate.z);
  const length = Math.floor(d / STEP) * STEP;
  if (length < SHORTEST) return null;
  const [ux, uz] = [(mid.x - gate.x) / d, (mid.z - gate.z) / d];
  const points = Array.from({ length: length / STEP + 1 }, (_, k) => ({ x: gate.x + ux * k * STEP, z: gate.z + uz * k * STEP }));
  // The lane's level is the drones' feet less their kind's layer and bob.
  const level = Math.max(groundAt(gate.x, gate.z), groundAt(mid.x, mid.z)) + CLEAR - DRONE_LAYER.delivery.above - BOB;
  return { points, levels: points.map(() => level), length, seed: s.seed, kind: "delivery" };
};

/** Every site's lane, in table order. */
export const siteDroneLanes = (sites: readonly LublinConstructionSiteData[] = LUBLIN_CONSTRUCTION_SITES, groundAt: (x: number, z: number) => number = groundY): DroneLane[] =>
  sites.flatMap((s) => {
    const lane = siteDroneLane(s, groundAt);
    return lane ? [lane] : [];
  });
