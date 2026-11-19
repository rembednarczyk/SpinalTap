import { describe, expect, it } from "vitest";
import { ALCHEMIA_TIER_PIECES, ARCADE_BAYS, ARCADE_FRONT, ARCADE_PIER, ARCADE_WALK, FRONT_FOOTPRINTS, FOUNTAIN, L2_SLABS, L2_TOP, P1_RAMP, WEST_WING, arcadePiers } from "../src";

/** The pale house with arcades in the front's axis (C3 of the board 1:1, decision of the user of 19.11). */
describe("Alchemia's house with arcades (C3)", () => {
  const A = ARCADE_FRONT;
  const plaster = ALCHEMIA_TIER_PIECES.filter((p) => p.kind === "plaster");

  it("stands between the green slope and the ramp's trench, behind the fountain, its roof on L2's level", () => {
    expect(A.minX).toBeGreaterThanOrEqual(WEST_WING[0]!.minX);
    expect(A.maxX).toBeLessThan(P1_RAMP.minX - 0.3);
    expect(A.minZ).toBeGreaterThan(FOUNTAIN.maxZ + 1);
    expect(A.top).toBe(L2_TOP);
    // Its roof meets L2's slab: one terrace.
    expect(A.maxZ).toBeCloseTo(L2_SLABS[0]!.minZ - 0.3, 6);
  });

  it("has five arches between six solid piers, their walk open behind them, the west wing's lit shops at its back", () => {
    const piers = arcadePiers();
    expect(piers.length).toBe(ARCADE_BAYS + 1);
    const arch = piers[1]! - piers[0]! - ARCADE_PIER.width;
    expect(arch).toBeGreaterThan(1.8);
    for (const x of piers) {
      const p = plaster.find((q) => Math.abs(q.box.x0 - x) < 1e-6 && q.box.z0 === A.minZ);
      expect(p, `${x}`).toBeDefined();
      expect(p!.solid).toBe(true);
      expect(FRONT_FOOTPRINTS.some((f) => Math.abs(f.minX - x) < 1e-6)).toBe(true);
    }
    // Nothing solid in the walk under the upper storey between the piers and the west wing's glass.
    expect(WEST_WING[0]!.minZ).toBeCloseTo(A.minZ + ARCADE_WALK, 6);
    const y = A.ceiling - 1;
    for (let k = 0; k < ARCADE_BAYS; k++) {
      const x = piers[k]! + ARCADE_PIER.width + arch / 2;
      const z = A.minZ + ARCADE_PIER.depth + 0.5;
      const blocked = ALCHEMIA_TIER_PIECES.some((p) => p.solid && x > p.box.x0 && x < p.box.x1 && z > p.box.z0 && z < p.box.z1 && y > p.box.y0 && y < p.box.y1);
      expect(blocked, `${x},${z}`).toBe(false);
    }
  });

  it("keeps the upper storey solid over the walk, from the arcade's ceiling to its roof", () => {
    const upper = plaster.find((p) => p.box.y0 === A.ceiling && p.box.x0 === A.minX && p.box.x1 === A.maxX);
    expect(upper).toBeDefined();
    expect(upper!.solid).toBe(true);
    expect(upper!.box.y1).toBeLessThan(A.top);
  });
});
