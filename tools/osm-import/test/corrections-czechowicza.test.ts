import { describe, expect, it } from "vitest";
import { KRAKOWSKIE_CHUNKS } from "../../../packages/sim/src/content/lublin/krakowskie.generated.ts";

/** The added paving on Plac Czechowicza (T-210): the strip before the Sąd Okręgowy w69672563 and along its east wall. */

const ground = KRAKOWSKIE_CHUNKS.flatMap((c) => c.ground);
const buildings = KRAKOWSKIE_CHUNKS.flatMap((c) => c.buildings).map((b) => b.outline.map((v, i) => v + (i % 2 === 0 ? b.x : b.z)));
const inside = (x: number, z: number, o: readonly number[]) => {
  let hit = false;
  for (let i = 0, j = o.length - 2; i < o.length; j = i, i += 2) {
    if (o[i + 1]! > z !== o[j + 1]! > z && x < ((o[j]! - o[i]!) * (z - o[i + 1]!)) / (o[j + 1]! - o[i + 1]!) + o[i]!) hit = !hit;
  }
  return hit;
};
/** The surface drawn on top at (x, z): the last piece in draw order, or null for bare terrain. */
const surfaceAt = (x: number, z: number) => ground.reduce<string | null>((s, g) => (inside(x, z, g.outline) ? g.surface : s), null);
const inBuilding = (x: number, z: number) => buildings.some((o) => inside(x, z, o));

describe("the paving before the Sąd Okręgowy on Plac Czechowicza (G-436)", () => {
  // The square w505211283 ends 1-2 m short of the court's north wall and the footway w288178955's
  // band 2-3 m short of its east wall: bare terrain where the orthophoto (PZGiK) has the pavement
  // up to the walls. The register's test: no bare sample on a 0.25 m grid round the court's corner.
  it("paves from the square and the footway up to the court's north and east walls", () => {
    const bare: string[] = [];
    for (let x = 2.625; x < 22; x += 0.25)
      for (let z = -119.875; z < -104.75; z += 0.25) if (!inBuilding(x, z) && surfaceAt(x, z) === null) bare.push(`${x},${z}`);
    expect(bare.length, bare.slice(0, 20).join(" ")).toBe(0);
    expect(surfaceAt(10, -105.8)).toBe("square");
    expect(surfaceAt(19.5, -110)).toBe("square");
    expect(surfaceAt(18.6, -120)).toBe("square");
  });

  it("leaves the footway, the street and the square's car park on top, and the court's walls where they are", () => {
    expect(surfaceAt(22.5, -108)).toBe("footway");
    expect(surfaceAt(25, -108)).toBe("road");
    expect(surfaceAt(10, -100)).toBe("road");
    expect(inBuilding(10, -107)).toBe(true);
    expect(inBuilding(18, -110)).toBe(true);
  });
});
