import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { buildGanger } from "../src/renderer/characters";
import { markEnforcer } from "../src/renderer/enforcer-mark";

describe("enforcer mark (ADR-0036)", () => {
  it("puts a glowing band on the left upper arm that goes with the rig", () => {
    const scene = new Scene(new NullEngine());
    const materials = new ToonMaterials(scene);
    const rig = buildGanger(scene, materials, "boss");
    const band = markEnforcer(scene, materials, rig, "boss");
    expect(band.parent).toBe(rig.armL);
    expect(band.material?.name).toBe("toon-enforcerBand");
    rig.root.dispose(false, false);
    expect(band.isDisposed()).toBe(true);
  });
});
