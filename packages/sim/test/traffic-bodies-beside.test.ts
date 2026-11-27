import { afterAll, describe, expect, it, vi } from "vitest";
import type * as Traffic from "../src/content/traffic";

/**
 * Two lanes going one way side by side read each other's bodies too (G-744), not only oncoming
 * ones. At 3 Maja by Żołnierzy Niepodległej the right lane turns out right while the left one goes
 * straight on and shifts across: a body turns at once with its lane and its front swings out over
 * the lane beside. The vehicles going one way read only each other's centres against their ways, so
 * with the two lanes a little closer than the city's own (BDOT10k's carriageway axis, ADR-0104,
 * brings them so) a car going straight drove into the side of one turning. Here the two lanes of
 * every street with two side by side are moved 1 m towards each other. Measured over seeds 1-12
 * before the fix: seeds 2 and 3 met there (0.6 m closer, seed 6; 1.4 m, none).
 *
 * A shared worker (`isolate: false`) may hold the sim from an earlier file, bound to the city's own
 * lanes, and a hoisted `vi.mock` does not reach it (G-881): the registry is reset and the sim
 * imported after the moved lanes, and reset again after the file.
 */
const CLOSER = 1;
vi.resetModules();
vi.doMock("../src/content/traffic", async (importOriginal) => {
  const mod = await importOriginal<typeof Traffic>();
  const { polylineLength } = await import("../src/content/lublin/roads");
  // The lane a route starts in: `Name#k:n` of its first part.
  const laneOf = (id: string) => /^([^>+]*):(\d)(?:[>+]|$)/.exec(id);
  const paired = new Set(mod.TRAFFIC_ROUTES.flatMap((r) => (laneOf(r.id)?.[2] === "1" ? [laneOf(r.id)![1]] : [])));
  const TRAFFIC_ROUTES = mod.TRAFFIC_ROUTES.map((r) => {
    const lane = laneOf(r.id);
    if (!lane || !paired.has(lane[1]!)) return r;
    // Lane 0 is the right one: it moves left, lane 1 right.
    const points = mod.offsetLine(r.points, lane[2] === "0" ? -CLOSER / 2 : CLOSER / 2);
    return { ...r, points, length: polylineLength(points) };
  });
  return { ...mod, TRAFFIC_ROUTES };
});
const { drive } = await import("./traffic-drive");
afterAll(() => {
  vi.doUnmock("../src/content/traffic");
  vi.resetModules();
});

describe("bodies of two lanes going one way beside each other, the lanes moved closer (G-744)", () => {
  // The seeds that met there, and two that never did.
  it.each([2, 3, 1, 4])("by 3 Maja at Żołnierzy Niepodległej, seed %i: no two vehicles meet", (seed) => {
    expect(drive(seed, -105, 90).collisions).toBe(0);
  });
});
