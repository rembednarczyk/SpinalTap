import { describe, expect, it } from "vitest";
import { ALCHEMIA_PIECES, ALCHEMIA_UNITS } from "../src";
import { FOODHALL_CEILING } from "../src/content/alchemia/units";

/**
 * The units' signs over their counters (ADR-0093 O3, drawn in `foodhall-geometry.ts` 0.12..0.62 m under the slab, their
 * neon 0.12..0.17 m out of the open side) are read from the floor: nothing drawn hangs before them (user's note of 22.11:
 * the services' pipe run under the slab ate the top of every name on the floor).
 */
describe("the food hall's signs (ADR-0093 O3)", () => {
  // Half a metre out nothing up to the slab; a metre out nothing as low as the sign (from under it a lower thing hides its top).
  for (const [out, top, what] of [
    [0.5, FOODHALL_CEILING, "from its foot to the slab, half a metre out"],
    [1.0, FOODHALL_CEILING - 0.12, "at its height, a metre out"],
  ] as const)
    it(`leaves the air before every unit's sign clear ${what}`, () => {
      const y0 = FOODHALL_CEILING - 0.62;
      for (const u of ALCHEMIA_UNITS) {
        const q = u.rect;
        // The sign runs along the counter's opening where the unit opens on part of its side (Oyaji's: #908).
        const span = (a0: number, a1: number) => [(u.opening?.[0] ?? a0) + 0.35, (u.opening?.[1] ?? a1) - 0.35] as const;
        const [x0, x1, z0, z1] =
          u.open === "s" ? [...span(q.minX, q.maxX), q.minZ - out, q.minZ] : u.open === "n" ? [...span(q.minX, q.maxX), q.maxZ, q.maxZ + out] : u.open === "e" ? [q.maxX, q.maxX + out, ...span(q.minZ, q.maxZ)] : [q.minX - out, q.minX, ...span(q.minZ, q.maxZ)];
        const before = ALCHEMIA_PIECES.filter((p) => p.box.x1 > x0 + 1e-6 && p.box.x0 < x1 - 1e-6 && p.box.z1 > z0 + 1e-6 && p.box.z0 < z1 - 1e-6 && p.box.y1 > y0 + 1e-6 && p.box.y0 < top - 1e-6);
        expect(before.map((p) => `${p.kind} ${p.box.x0},${p.box.z0},${p.box.y0}`), u.id).toEqual([]);
      }
    });
});
