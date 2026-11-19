import { describe, expect, it } from "vitest";
import {
  ALCHEMIA_PROPS,
  EAST_WING,
  FRONT_SIGN,
  L1_TOP,
  L2_SLABS,
  L2_TOP,
  L3,
  L3_TOP,
  P1_RAMP,
  P2_ROBOTS,
  P1_STAIR,
  PASSAGE_COLUMNS,
  PAVILION_CORNERS,
  TIER_A,
  TIER_B,
  WEST_WING,
  frontDressPieces,
  frontPieces,
  groundY,
} from "../src";

/**
 * Alchemia's front on Bajkowskiego (ADR-0074, B1, decisions of 19.11): the complex fills the
 * site over P-1, its storeys stepping back from the street on the tiers' levels, the passage
 * under L2 left to the ramp, P-1's stair house and metro B.
 */

type R = { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };
const apart = (a: R, b: R, gap: number): boolean => a.maxX + gap <= b.minX || b.maxX + gap <= a.minX || a.maxZ + gap <= b.minZ || b.maxZ + gap <= a.minZ;
/** Metro B's pavilion before Alchemia (`plan.ts`), open east to Lubartowska. */
const METRO_B: R = { minX: 424.4, maxX: 431.6, minZ: 26.2, maxZ: 29.8 };

describe("Alchemia's front over P-1 (B1)", () => {
  it("lays its roofs on the tiers' levels, L3 a storey over L2", () => {
    expect(L1_TOP).toBe(TIER_A.top);
    expect(L2_TOP).toBe(TIER_B.top);
    expect(L3_TOP - L2_TOP).toBeCloseTo(4.2, 6);
    // Twelve metres and more over Bajkowskiego's footway.
    expect(L3_TOP - groundY(410, -8.8)).toBeGreaterThan(11);
  });

  it("steps back from the street: the wings' fronts, then L2's, then L3's", () => {
    const l1 = Math.min(...WEST_WING.map((r) => r.minZ));
    const l2 = Math.min(...L2_SLABS.map((r) => r.minZ));
    expect(l1).toBeLessThan(l2);
    expect(l2).toBeLessThan(L3.minZ);
    expect(L3.minZ - l2).toBeGreaterThanOrEqual(6);
  });

  it("keeps its wings and columns off the ramp's trench, P-1's stair house, the pavilions and metro B's way", () => {
    const trench: R = { minX: P1_RAMP.minX - 0.3, maxX: P1_RAMP.maxX + 0.3, minZ: P1_RAMP.top, maxZ: P1_RAMP.covered };
    const columns = PASSAGE_COLUMNS.map((c) => ({ minX: c.x - 0.3, maxX: c.x + 0.3, minZ: c.z - 0.3, maxZ: c.z + 0.3 }));
    const pavilion: R = { minX: Math.min(...PAVILION_CORNERS.map((c) => c.x)), maxX: Math.max(...PAVILION_CORNERS.map((c) => c.x)), minZ: Math.min(...PAVILION_CORNERS.map((c) => c.z)), maxZ: Math.max(...PAVILION_CORNERS.map((c) => c.z)) };
    for (const r of [...WEST_WING, EAST_WING, ...columns]) {
      expect(apart(r, trench, 0.5), JSON.stringify(r)).toBe(true);
      expect(apart(r, P1_STAIR, 0.5), JSON.stringify(r)).toBe(true);
      expect(apart(r, pavilion, 2), JSON.stringify(r)).toBe(true);
      expect(apart(r, METRO_B, 1.5), JSON.stringify(r)).toBe(true);
    }
  });

  it("leaves the passage under L2 2.9 m and more over its ground", () => {
    const soffit = L1_TOP - 0.35;
    for (let x = 405; x <= 435; x += 2) {
      for (let z = 4; z <= 31; z += 2) {
        if (!L2_SLABS.some((r) => x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ)) continue;
        expect(soffit - groundY(x, z), `${x},${z}`).toBeGreaterThan(2.9);
      }
    }
  });

  it("faces its sign to Bajkowskiego on L3's south face, a prop of its own the last of Alchemia's", () => {
    expect(FRONT_SIGN.z1).toBeLessThanOrEqual(L3.minZ);
    expect(FRONT_SIGN.y0).toBeGreaterThan(L2_TOP);
    expect(FRONT_SIGN.y1).toBeLessThan(L3_TOP);
    expect(ALCHEMIA_PROPS.at(-1 - P2_ROBOTS.length)!.prisms).toHaveLength([...frontPieces(), ...frontDressPieces()].filter((p) => p.solid).length);
  });
});
