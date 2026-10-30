import { describe, expect, it } from "vitest";
import { DISTRICT_M0_PROPS } from "../src/content/district-m0";
import { groundY } from "../src/content/lublin/terrain";

describe("the game's props on Krakowskie Przedmieście (ADR-0045)", () => {
  it("the wreck, the vans and the dumpsters stand on the terrain under them, not half in it", () => {
    const skins = ["wreck", "van", "dumpster"];
    const pieces = DISTRICT_M0_PROPS.filter((p) => p.view.kind === "block" && skins.includes(p.view.skin?.style ?? ""));
    expect(pieces.length).toBeGreaterThanOrEqual(3);
    for (const p of pieces) {
      if (p.view.kind !== "block") continue;
      expect(Math.abs(p.center.y - p.view.size.y / 2 - groundY(p.center.x, p.center.z)), p.view.skin?.style).toBeLessThan(0.05);
    }
  });
});
