import { describe, expect, it, vi } from "vitest";
import type * as Traffic from "../src/content/traffic";
import { drive } from "./traffic-drive";

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
 */

vi.mock("../src/content/traffic", async (importOriginal) => {
  const mod = await importOriginal<typeof Traffic>();
  const { polylineLength } = await import("../src/content/lublin/roads");
  const TRAFFIC_ROUTES = mod.TRAFFIC_ROUTES.map((r) => {
    const points = mod.offsetLine(r.points, -0.1);
    return { ...r, points, length: polylineLength(points) };
  });
  return { ...mod, TRAFFIC_ROUTES };
});

describe("bodies giving way at Kołłątaja's bend by Zesłańców Sybiru, the lanes moved (G-768)", () => {
  // The seeds that met there, and a few that met with the lanes moved further (7, 26) or never (1).
  it.each([10, 13, 20, 28, 1, 7, 26])("with every lane moved 0.1 m to its left, seed %i: no two vehicles meet", (seed) => {
    expect(drive(seed, -108, -150).collisions).toBe(0);
  });
});
