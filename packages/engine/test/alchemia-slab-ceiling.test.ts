// @ts-expect-error The engine is typed for the browser; the test reads the kit off disk.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ALCHEMIA_UNITS, FOODHALL_CEILING } from "@seki/sim";
import { type GeometrySink, parseCityKit } from "../src/renderer/city-kit-data";
import { alchemiaGeometry } from "../src/renderer/alchemia/alchemia-geometry";

/**
 * The gallery's slabs (ADR-0093 O1) drawn with the rooms' ceilings where the simulation has them, their underside: the
 * beam a downstand along the atrium and the facade only (user's note of 22.11: the whole slab drawn down to the beam's
 * foot put every ceiling 0.32 m low and cut the food hall's signs, its lamps and pipes in that band hidden).
 */
describe("Alchemia's slabs over its rooms (ADR-0093 O1)", () => {
  const bytes = (readFileSync as (url: URL) => Uint8Array)(new URL("../../app/public/city/city-kit.glb", import.meta.url));
  const data = parseCityKit(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  const sinks: GeometrySink[] = Object.values(alchemiaGeometry(data));
  /** The lowest level face over (x, z) between `lo` and `hi`: the ceiling the eye sees there. */
  const ceiling = (x: number, z: number, lo: number, hi: number): number => {
    let low = Infinity;
    for (const s of sinks)
      for (let i = 0; i < s.indices.length; i += 3) {
        const ps = [s.indices[i]!, s.indices[i + 1]!, s.indices[i + 2]!].map((k) => [s.positions[3 * k]!, s.positions[3 * k + 1]!, s.positions[3 * k + 2]!] as const);
        const ys = ps.map((p) => p[1]);
        if (Math.max(...ys) - Math.min(...ys) > 0.01 || ys[0]! < lo || ys[0]! > hi) continue;
        const xs = ps.map((p) => p[0]);
        const zs = ps.map((p) => p[2]);
        if (Math.min(...xs) <= x && Math.max(...xs) >= x && Math.min(...zs) <= z && Math.max(...zs) >= z) low = Math.min(low, ys[0]!);
      }
    return low;
  };

  it("hangs no ceiling under the slab before any food hall unit's sign: their names whole", () => {
    for (const u of ALCHEMIA_UNITS) {
      const q = u.rect;
      const [x, z] = u.open === "n" ? [(q.minX + q.maxX) / 2, q.maxZ + 0.3] : u.open === "s" ? [(q.minX + q.maxX) / 2, q.minZ - 0.3] : u.open === "e" ? [q.maxX + 0.3, (q.minZ + q.maxZ) / 2] : [q.minX - 0.3, (q.minZ + q.maxZ) / 2];
      expect(ceiling(x, z, FOODHALL_CEILING - 0.6, FOODHALL_CEILING + 0.05), u.id).toBeCloseTo(FOODHALL_CEILING, 3);
    }
  });

  it("puts the gallery's ceilings on P1 and P2 at their slabs' underside, the beam along the atrium's edge", () => {
    expect(ceiling(409.5, 45, 1.4, 2.05)).toBeCloseTo(2.0, 3);
    expect(ceiling(409.5, 45, 5.6, 6.25)).toBeCloseTo(6.2, 3);
  });
});
