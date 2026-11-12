import { describe, expect, it } from "vitest";
import { PODZAMCZE_CHUNKS } from "../../../packages/sim/src/content/lublin/podzamcze.generated.ts";
import { type Pt, pointInRing } from "../src/geometry.ts";

/**
 * G-662: the part of VIVO's garage w173070505 past the mall's north-east wall (x 1105.8-1120,
 * z 228-239.7 on the map) stands over the street: a green roof with skylights, its wall's shadow
 * reaching z 249.5 on the 2025-04 orthophoto (T-261). Since G-600 the garage (`level=-2`) is no
 * solid and the triangle was a lawn on the ground.
 */

const ring = (flat: readonly number[], x = 0, z = 0): Pt[] => Array.from({ length: flat.length / 2 }, (_, k) => ({ x: x + flat[2 * k]!, z: z + flat[2 * k + 1]! }));
const buildings = PODZAMCZE_CHUNKS.flatMap((c) => c.buildings);
const outlineOf = (id: string) => {
  const b = buildings.find((x) => x.id === id)!;
  return ring(b.outline, b.x, b.z);
};
// The triangle, 0.3 m in from the mall's wall, the garage's north edge and the map's edge.
const TRIANGLE: Pt[] = [
  { x: 1106.4, z: 239.4 },
  { x: 1115.1, z: 228.8 },
  { x: 1119.7, z: 228.4 },
  { x: 1119.7, z: 238.5 },
];
const samples = (): Pt[] => {
  const out: Pt[] = [];
  for (let x = 1105.25; x < 1120; x += 0.5) for (let z = 227.75; z < 240; z += 0.5) if (pointInRing({ x, z }, TRIANGLE)) out.push({ x, z });
  return out;
};

describe("VIVO's garage past the mall's north-east wall (G-662)", () => {
  it("stands as a low solid over the whole triangle, off the mall", () => {
    const vivo = outlineOf("r5601275");
    const left = samples().filter((p) => !buildings.some((b) => b.id !== "r5601275" && pointInRing(p, ring(b.outline, b.x, b.z))));
    expect(left.length, left.slice(0, 12).map((p) => `${p.x},${p.z}`).join(" ")).toBe(0);
    const garage = buildings.filter((b) => samples().some((p) => pointInRing(p, ring(b.outline, b.x, b.z))));
    expect(garage.map((b) => b.id)).toHaveLength(1);
    // Lower than the mall (LoD1 17.2 m), as high as its shadow on the orthophoto says (T-261).
    expect(garage[0]!.height).toBeGreaterThanOrEqual(9);
    expect(garage[0]!.height).toBeLessThanOrEqual(12);
    expect(samples().filter((p) => pointInRing(p, vivo))).toEqual([]);
  });

  it("lays no ground under it: neither the bed of T-258 nor the roof's lawn r11978659", () => {
    const ground = PODZAMCZE_CHUNKS.flatMap((c) => c.ground).map((g) => ({ surface: g.surface, ring: ring(g.outline) }));
    const under = samples().flatMap((p) => ground.filter((g) => pointInRing(p, g.ring)).map((g) => `${g.surface}@${p.x},${p.z}`));
    expect(under.slice(0, 12).join(" ")).toBe("");
  });
});
