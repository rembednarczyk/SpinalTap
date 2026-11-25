import { describe, expect, it } from "vitest";
import { beaconOffTip, sceneLampInSolid } from "./scene-lamps";

/** A scene's lamp in a building or the ground, and an obstruction light off its tip (PR #1032's review). */

const house = (x: number, z: number) => x > 0 && x < 10 && z > 0 && z < 10;
const flat = () => 0;

describe("scene lamps in solids (scene-lamp-in-solid)", () => {
  it("finds a lamp in a building's outline and one under the ground, not one over the paving", () => {
    const found = sceneLampInSolid(
      [
        { group: "g", key: "in", at: { x: 5, y: 3, z: 5 } },
        { group: "g", key: "under", at: { x: 20, y: -0.4, z: 0 } },
        { group: "g", key: "ok", at: { x: 20, y: 6, z: 0 } },
        { group: "g", key: "set", at: { x: 22, y: -0.03, z: 0 } },
      ],
      house,
      flat,
    );
    expect(found.map((f) => f.what)).toEqual(["g in in a building", "g under 0.40 m under the ground"]);
  });
});

describe("obstruction lights off their tips (beacon-off-tip)", () => {
  it("passes a light on its tip and finds one beside it, one under it and one high over it", () => {
    const top = { x: 0, z: 0, y: 58.6 };
    const found = beaconOffTip([
      { id: "ok", at: { x: 0.1, y: 58.9, z: 0 }, top },
      { id: "beside", at: { x: 1, y: 58.9, z: 0 }, top },
      { id: "under", at: { x: 0, y: 42.4, z: 0 }, top },
      { id: "high", at: { x: 0, y: 60, z: 0 }, top },
    ]);
    expect(found.map((f) => f.what.split(" ")[0])).toEqual(["beside", "under", "high"]);
  });
});
