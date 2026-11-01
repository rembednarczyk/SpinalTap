import { describe, expect, it } from "vitest";
import { SURFACE_LIFT } from "@seki/core";
import { DISTRICT_M0_PROPS } from "../src/content/district-m0";
import { surfacesAt } from "../src/content/lublin/roads";
import { groundY } from "../src/content/lublin/terrain";

/** The top of what the renderer draws at (x, z): the terrain and the highest paving laid there. */
const drawn = (x: number, z: number) => groundY(x, z) + Math.max(0, ...surfacesAt(x, z).map((s) => SURFACE_LIFT[s]));

describe("the game's props on Krakowskie Przedmieście (ADR-0045)", () => {
  it("the wreck, the vans and the dumpsters stand on the terrain under them, not half in it", () => {
    const skins = ["wreck", "van", "dumpster"];
    const pieces = DISTRICT_M0_PROPS.filter((p) => p.view.kind === "block" && skins.includes(p.view.skin?.style ?? ""));
    expect(pieces.length).toBeGreaterThanOrEqual(3);
    for (const p of pieces) {
      if (p.view.kind !== "block") continue;
      const bottom = p.center.y - p.view.size.y / 2;
      if (p.view.skin?.style === "dumpster") {
        expect(Math.abs(bottom - groundY(p.center.x, p.center.z)), p.view.skin.style).toBeLessThan(0.05);
        continue;
      }
      // A vehicle stands level on the paving drawn under its box (G-130): its highest point at most a tyre's squash over the bottom.
      const { x: w, z: d } = p.view.size;
      const top = Math.max(...[-0.5, 0.5].flatMap((a) => [-0.5, 0.5].map((b) => drawn(p.center.x + w * a, p.center.z + d * b))), drawn(p.center.x, p.center.z));
      expect(top - bottom, p.view.skin?.style).toBeLessThanOrEqual(0.05 + 1e-9);
      expect(top - bottom, p.view.skin?.style).toBeGreaterThan(-0.05);
    }
  });
});
