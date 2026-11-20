import { describe, expect, it } from "vitest";
import type { StreetPropItem } from "../../../packages/core/src";
import type { PlanItem } from "../../osm-import/src/props-gen.ts";
import { MATCH, gameOn, handPoints, planPropsInGame, planPropsUnderGame } from "./plan-prop-under-game";

const item = (over: Partial<PlanItem>): PlanItem => ({ id: "t.bench", kind: "bench", points: [[0, 0], [10, 0]], inOsm: false, ...over });
const piece = (prop: StreetPropItem["prop"], x: number, z: number): StreetPropItem => ({ prop, x, y: 0, z, yaw: 0, variant: 0 });

describe("plan-prop-under-game (the curator's review of C5, PR #793)", () => {
  it("takes the plan's points laid by hand, not the map's nor a line's", () => {
    expect(handPoints([item({})]).map((p) => [p.id, p.n, p.prop, p.x, p.z])).toEqual([
      ["t.bench", 0, "bench", 0, 0],
      ["t.bench", 1, "bench", 10, 0],
    ]);
    expect(handPoints([item({ points: undefined, position: { x: 3, z: 4 } })]).map((p) => [p.x, p.z])).toEqual([[3, 4]]);
    expect(handPoints([item({ inOsm: true }), item({ inOsm: undefined }), item({ points: undefined, line: [0, 0, 10, 0] }), item({ kind: "no-such-kind" })])).toEqual([]);
    // A plan kind drawn as another: the piece it asks for.
    expect(handPoints([item({ kind: "street-lamp" })])[0]!.prop).toBe("lamp-road");
  });

  it("finds a point whose piece the map places and the game drops, and none kept, never placed or moved off", () => {
    const pts = handPoints([item({})]);
    const placed = [piece("bench", 0.05, 0), piece("bench", 10, 0)];
    expect(planPropsUnderGame(pts, placed, [piece("bench", 10, 0)], () => "on a block")).toEqual([{ at: "0.0,0.0", what: "t.bench#0 bench (0; 0): on a block" }]);
    expect(planPropsUnderGame(pts, placed, placed)).toEqual([]);
    expect(planPropsUnderGame(pts, [], [])).toEqual([]);
    expect(planPropsUnderGame(pts, [piece("bench", MATCH + 0.05, 0)], [])).toEqual([]);
    expect(planPropsUnderGame(pts, [piece("bollard", 0, 0)], [])).toEqual([]);
  });

  it("finds the plan's benches on T0 under Alchemia's front and says what stands there", () => {
    expect(gameOn({ x: 404.75, z: 0 })).toMatch(/^by Alchemia's front footprint/);
    expect(gameOn({ x: 412.5, z: 27.8, prop: "lamp-pastoral" })).toMatch(/^under the front's L2/);
    expect(gameOn({ x: 412.5, z: 27.8, prop: "bench" })).not.toMatch(/L2/);
    const found = planPropsInGame().map((f) => f.what.split(" ")[0]);
    expect(found).toContain("alchemia-t0.bench-west#0");
    expect(found).not.toContain("alchemia-t0.bench-east#0");
  });
});
