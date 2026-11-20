import { CLUTTER_SHAPES } from "@seki/core";
import { describe, expect, it } from "vitest";
import { CLUTTER_SOLIDS, furniturePrisms } from "../src/content/lublin/furniture";

/** The odds and ends of ADR-0096: the simulation's copy of their solids, and which are solid. */
describe("clutter solids (ADR-0096)", () => {
  it("are the core's table, shape by shape", () => {
    expect(CLUTTER_SOLIDS).toEqual(CLUTTER_SHAPES.map((s) => s.solid));
  });

  it("stand a boarded bin and a barrel; bags, boxes, litter and a cash machine in a wall are no solid", () => {
    const prisms = (variant: number) => furniturePrisms({ prop: "clutter", x: 0, y: 0, z: 0, yaw: 0, variant });
    const solid = CLUTTER_SHAPES.map((_, s) => prisms(s).length > 0);
    expect(CLUTTER_SHAPES.filter((_, s) => solid[s]).map((s) => s.key)).toEqual(["ex-bin-boarded", "ex-barrel"]);
    // The shape is the variant's low bits: the same shape 9 further on.
    expect(prisms(4 + 9 * 7)).toEqual(prisms(4));
  });
});
