import { describe, expect, it } from "vitest";
import { terracePieces } from "../src/content/alchemia/terrace-steps";
import { EAST_RAMP, EAST_STEPS_HALF } from "../src/content/alchemia/terraces";
import { groundY, surfaceY } from "../src/content/lublin/terrain";

describe("the east ramp's steps on the ground (ADR-0074 stage 1, G-445, the user's 20.11)", () => {
  it("lays the ground level across the steps where the ramp runs on, not up a bank over their ends", () => {
    const r = EAST_RAMP;
    for (let z = 36; z <= 47; z += 0.5) {
      const axis = groundY(r.a.x, z);
      for (const dx of [-EAST_STEPS_HALF, -1.5, 1.5, EAST_STEPS_HALF]) expect(groundY(r.a.x + dx, z) - axis, `x ${r.a.x + dx}, z ${z}`).toBeLessThan(0.03);
    }
  });

  it("stands every tread over the paving drawn under its outline, its foot in the ground under it", () => {
    for (const p of terracePieces()) {
      const b = p.box;
      for (let x = b.x0; x <= b.x1 + 1e-9; x += 0.25) {
        for (const z of [b.z0, (b.z0 + b.z1) / 2, b.z1]) {
          expect(surfaceY(x, z), `top at ${x}, ${z}`).toBeLessThan(b.y1);
          expect(b.y0, `foot at ${x}, ${z}`).toBeLessThan(groundY(x, z));
        }
      }
    }
  });
});
