import { describe, expect, it } from "vitest";
import { MARKET_FESTOONS, PLAC_ZAMKOWY_FESTOONS } from "@seki/sim";
import { planFestoons } from "../src/renderer/mapcity/festoon-signs";
import { MAP_SIGN_KIND } from "../src/renderer/mapcity/sign-plan";
import { MeshSink } from "../src/renderer/mesh-sink";

describe("Plac Zamkowy's festoons in the signs' mesh (24.11)", () => {
  it("plans each festoon once, in the cell holding its middle", () => {
    let total = 0;
    for (let x = 600; x < 900; x += 20)
      for (let z = 140; z < 640; z += 20) total += planFestoons(new MeshSink(), { minX: x, maxX: x + 20, minZ: z, maxZ: z + 20 });
    expect(total).toBe(MARKET_FESTOONS.length);
    expect(MARKET_FESTOONS.length).toBeGreaterThan(PLAC_ZAMKOWY_FESTOONS.length);
  });

  it.each(PLAC_ZAMKOWY_FESTOONS.map((s, i) => [i, s] as const))("%i: tubes of light along its cable, between its posts and under their tops", (_i, s) => {
    const sink = new MeshSink();
    const mx = (s.a.x + s.b.x) / 2;
    const mz = (s.a.z + s.b.z) / 2;
    expect(planFestoons(sink, { minX: mx - 0.1, maxX: mx + 0.1, minZ: mz - 0.1, maxZ: mz + 0.1 }, [s])).toBe(1);
    expect(sink.vertexCount).toBeGreaterThan(0);
    for (let i = 0; i < sink.vertexCount; i++) {
      expect(Math.round(sink.uvs2[i * 2 + 1]!)).toBe(MAP_SIGN_KIND.tube);
      const [x, y, z] = [sink.positions[i * 3]!, sink.positions[i * 3 + 1]!, sink.positions[i * 3 + 2]!];
      expect(x).toBeGreaterThan(Math.min(s.a.x, s.b.x) - 0.2);
      expect(x).toBeLessThan(Math.max(s.a.x, s.b.x) + 0.2);
      expect(z).toBeGreaterThan(Math.min(s.a.z, s.b.z) - 0.2);
      expect(z).toBeLessThan(Math.max(s.a.z, s.b.z) + 0.2);
      expect(y).toBeLessThan(Math.max(s.a.y, s.b.y) + 0.1);
    }
  });

  it("strings bulbs on the bulbs' festoons, none on a neon strip", () => {
    const count = (style: "bulbs" | "strip") => {
      const s = PLAC_ZAMKOWY_FESTOONS.find((f) => f.style === style)!;
      const sink = new MeshSink();
      planFestoons(sink, { minX: -1e4, maxX: 1e4, minZ: -1e4, maxZ: 1e4 }, [s]);
      return sink.vertexCount;
    };
    // The cable alone: 16 pieces, two ribbons each both ways, four corners.
    expect(count("strip")).toBe(16 * 4 * 4);
    expect(count("bulbs")).toBeGreaterThan(16 * 4 * 4 + 20 * 8 * 4);
  });
});
