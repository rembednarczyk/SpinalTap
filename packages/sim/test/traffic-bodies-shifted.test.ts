import { afterAll, describe, expect, it, vi } from "vitest";
import type * as Traffic from "../src/content/traffic";

/**
 * The bodies of two lanes giving way at a bend hold with the lanes a little off where they are
 * (G-768). Kołłątaja bends by 24 degrees at Zesłańców Sybiru, its two lanes about 3.2 m apart: a
 * body turning there swings across the lane coming the other way. Each vehicle read where the
 * bodies meet from steps along its route counted from wherever it was, so a narrow place just past
 * the bend fell between them every other frame; which of the two gave way changed from frame to
 * frame, neither braked and both drove into each other. The lanes move by centimetres whenever the
 * import's width does (ADR-0080), so the city's own lanes are not enough to show it: here every
 * lane is moved 0.1 m to its left, the two lanes of a street 0.2 m closer. Measured over seeds 1-40
 * before the fix: seeds 10, 13, 20 and 28 met there (moved 0.1 m to the right, none).
 *
 * A shared worker (`isolate: false`) may hold the sim from an earlier file, bound to the city's own
 * lanes, and a hoisted `vi.mock` does not reach it (G-881): the registry is reset and the sim
 * imported after the moved lanes, and reset again after the file.
 */
vi.resetModules();
vi.doMock("../src/content/traffic", async (importOriginal) => {
  const mod = await importOriginal<typeof Traffic>();
  const { polylineLength } = await import("../src/content/lublin/roads");
  const TRAFFIC_ROUTES = mod.TRAFFIC_ROUTES.map((r) => {
    const points = mod.offsetLine(r.points, -0.1);
    return { ...r, points, length: polylineLength(points) };
  });
  return { ...mod, TRAFFIC_ROUTES };
});
const { drive } = await import("./traffic-drive");
const { TRAFFIC_ROUTES } = await import("../src/content/traffic");
const { pointAt } = await import("../src/content/traffic-lane");
const { Simulation, ground } = await import("../src");
const { teleportPlayer } = await import("./helpers");
afterAll(() => {
  vi.doUnmock("../src/content/traffic");
  vi.resetModules();
});

describe("bodies giving way at Kołłątaja's bend by Zesłańców Sybiru, the lanes moved (G-768)", () => {
  it("drives the moved lanes: the vehicles stand where their moved lane puts them", () => {
    const sim = Simulation.create({ seed: 1, crowd: "high" });
    teleportPlayer(sim, ground(-108, -175), 0);
    for (let t = 0; t < 30; t++) sim.step();
    const off = [...sim.world].flatMap((e) => {
      if (!e.vehicle) return [];
      const at = pointAt(TRAFFIC_ROUTES[e.vehicle.route]!.points, e.vehicle.s);
      return [Math.hypot(e.position.x - at.x, e.position.z - at.z)];
    });
    expect(off.length).toBeGreaterThan(0);
    expect(Math.max(...off)).toBeLessThan(0.05);
  });

  // The seeds that met there, and a few that met with the lanes moved further (7, 26) or never (1).
  it.each([10, 13, 20, 28, 1, 7, 26])("with every lane moved 0.1 m to its left, seed %i: no two vehicles meet", (seed) => {
    expect(drive(seed, -108, -150).collisions).toBe(0);
  });
});
