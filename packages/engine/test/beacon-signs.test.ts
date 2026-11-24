import { describe, expect, it } from "vitest";
import { KATEDRALNY_BEACON } from "@seki/sim";
import { planBeacons } from "../src/renderer/mapcity/beacon-signs";
import { MAP_SIGN_KIND } from "../src/renderer/mapcity/sign-plan";
import { MeshSink } from "../src/renderer/mesh-sink";

describe("the masts' obstruction lights in the signs' mesh (24.11)", () => {
  it("draws the tower's beacon once, in the cell holding it, as a blinking cross seen from any side", () => {
    let total = 0;
    for (let x = 560; x < 620; x += 20)
      for (let z = -180; z < -120; z += 20) {
        const sink = new MeshSink();
        const n = planBeacons(sink, { minX: x, maxX: x + 20, minZ: z, maxZ: z + 20 });
        total += n;
        if (n === 0) continue;
        expect(sink.vertexCount).toBe(2 * 2 * 4);
        for (let i = 0; i < sink.vertexCount; i++) {
          expect(Math.round(sink.uvs2[i * 2 + 1]!)).toBe(MAP_SIGN_KIND.strobe);
          expect(Math.abs(sink.positions[i * 3 + 1]! - KATEDRALNY_BEACON.y)).toBeLessThan(0.5);
        }
      }
    expect(total).toBe(1);
  });
});
