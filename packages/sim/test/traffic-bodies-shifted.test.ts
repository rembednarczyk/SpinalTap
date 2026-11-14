import { describe, expect, it, vi } from "vitest";
import { polylineLength } from "../src/content/lublin/roads";
import type * as Traffic from "../src/content/traffic";

/**
 * The bodies of two lanes giving way at a bend hold with the lanes a little off where they are
 * (G-768). Kołłątaja bends by 24 degrees at Zesłańców Sybiru, its two lanes about 3.2 m apart: a
 * body turning there swings across the lane coming the other way. Each vehicle read where the
 * bodies meet from steps along its route counted from wherever it was, so a narrow place just past
 * the bend fell between them every other frame; which of the two gave way changed from frame to
 * frame, neither braked and both drove into each other. The lanes move by centimetres whenever the
 * import's width does (ADR-0080), so the city's own lanes are not enough to show it: here every
 * lane is moved to its right by ±0.1 m (measured before the fix: at -0.1 m seeds 10, 13, 20 and 28
 * met, at -0.05 m seed 10; at +0.1 m none).
 */

/** The traffic tests' minute of driving, with every lane of the city moved `by` metres to its right. */
const shifted = async (by: number) => {
  vi.resetModules();
  vi.doMock("../src/content/traffic", async (importOriginal) => {
    const mod = await importOriginal<typeof Traffic>();
    const TRAFFIC_ROUTES = mod.TRAFFIC_ROUTES.map((r) => {
      const points = mod.offsetLine(r.points, by);
      return { ...r, points, length: polylineLength(points) };
    });
    return { ...mod, TRAFFIC_ROUTES };
  });
  const { drive } = await import("./traffic-drive");
  vi.doUnmock("../src/content/traffic");
  return drive;
};

const SEEDS = Array.from({ length: 40 }, (_, k) => k + 1);

describe("bodies giving way at Kołłątaja's bend by Zesłańców Sybiru, the lanes moved (G-768)", () => {
  it.each([-0.1, 0.1])("with every lane moved %d m to its right, seeds 1-40: no two vehicles meet", async (by) => {
    const drive = await shifted(by);
    const met = SEEDS.filter((seed) => drive(seed, -108, -150).collisions > 0);
    expect(met).toEqual([]);
  }, 300_000);
});
