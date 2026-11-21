import { CLUTTER_SHAPES } from "@seki/core";
import { describe, expect, it } from "vitest";
import { CLUTTER_SOLIDS, furniturePrisms } from "../src/content/lublin/furniture";

/** The odds and ends of ADR-0096: the simulation's copy of their solids, and which are solid. */
describe("clutter solids (ADR-0096)", () => {
  it("are the core's table, shape by shape", () => {
    expect(CLUTTER_SOLIDS).toEqual(CLUTTER_SHAPES.map((s) => s.solid));
  });

  it("stand a boarded bin, a barrel and a building site's cones and barriers; bags, boxes, litter and a cash machine in a wall are no solid", () => {
    const prisms = (variant: number) => furniturePrisms({ prop: "clutter", x: 0, y: 0, z: 0, yaw: 0, variant });
    const solid = CLUTTER_SHAPES.map((_, s) => prisms(s).length > 0);
    expect(CLUTTER_SHAPES.filter((_, s) => solid[s]).map((s) => s.key)).toEqual([
      "ex-bin-boarded",
      "ex-barrel",
      "ex-cone",
      "ex-barrier-concrete",
      "ex-barrier-red",
      "ex-railing-a",
      "ex-railing-a-bent",
      "ex-railing-b",
      "ex-railing-b-bent",
    ]);
    // The shape is the variant's low bits: the same shape a table's length further on.
    expect(prisms(4 + CLUTTER_SHAPES.length * 7)).toEqual(prisms(4));
  });
});
