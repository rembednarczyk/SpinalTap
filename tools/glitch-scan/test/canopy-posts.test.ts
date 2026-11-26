import { describe, expect, it } from "vitest";
import { turnLocal } from "../../../packages/sim/src/content/lublin/furniture";
import { CANVAS, NEAR, canvasDistance, stallsOnPosts } from "./canopy-posts";

describe("prop-on-canopy-post (G-966)", () => {
  it("measures from the canvas in the stall's own frame, turned as the renderer turns it", () => {
    const s = { x: 10, z: 20, yaw: 0.7 };
    const edge = turnLocal(s.yaw, CANVAS.hx + 0.5, 0);
    expect(canvasDistance(s, { x: s.x + edge.x, z: s.z + edge.z })).toBeCloseTo(0.5);
    const inside = turnLocal(s.yaw, 1, -0.8);
    expect(canvasDistance(s, { x: s.x + inside.x, z: s.z + inside.z })).toBe(0);
  });

  it("finds a stall whose canvas comes within a hand of a post's face, and none further off", () => {
    const stall = { x: 0, z: 0, yaw: 0 };
    const post = (gap: number) => [{ id: "w1", x: CANVAS.hx + 0.125 + gap, z: 0 }];
    expect(stallsOnPosts(post(NEAR - 0.01), [stall], 0.25)).toHaveLength(1);
    expect(stallsOnPosts(post(NEAR + 0.01), [stall], 0.25)).toEqual([]);
  });
});
