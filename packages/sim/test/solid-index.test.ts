import { describe, expect, it } from "vitest";
import { World } from "miniplex";
import type { Entity } from "../src/world/components";
import { makePrism, boundsOfPrisms } from "../src/world/prism";
import { collidersAt, solidIndexOf } from "../src/world/solid-index";
import type { Collider } from "../src/world/solids";

const still = { position: { x: 0, y: 0, z: 0 }, prevPosition: { x: 0, y: 0, z: 0 }, yaw: 0, prevYaw: 0, pitch: 0 };
const box = (x0: number, z0: number, x1: number, z1: number) => ({ min: { x: x0, y: 0, z: z0 }, max: { x: x1, y: 3, z: z1 } });
const square = (x: number, z: number, s: number) => makePrism([{ x, z }, { x: x + s, z }, { x: x + s, z: z + s }, { x, z: z + s }], 0, 6);

/**
 * A block of flats of a row of 2 m prisms along x (a building from map data, ADR-0043), a box
 * beside it, a lift's box far off, a box made before the block and one after: what a body's
 * rectangle gets back from the index.
 */
const world = () => {
  const w = new World<Entity>();
  const prisms = Array.from({ length: 12 }, (_, i) => square(2 * i, 0, 2));
  w.add({ ...still, id: 5, solid: box(10, 3, 11, 4) });
  w.add({ ...still, id: 1, solid: boundsOfPrisms(prisms), prisms });
  w.add({ ...still, id: 9, solid: box(30, 0, 31, 1) });
  w.add({ ...still, id: 7, solid: box(60, 60, 62, 62), velocity: { x: 0, y: 1, z: 0 } });
  w.add({ ...still, id: 3, solid: box(9, -2, 10.5, -1) });
  return w;
};
const xs = (cs: readonly Collider[]): string[] => cs.map((c) => `${c.box.min.x},${c.box.min.z}`);

describe("the colliders near a rectangle (ADR-0043, 20.11)", () => {
  it("hands back only the parts whose box meets it, not the rest of their building's, nor a lift far off", () => {
    // Over the block's fifth and sixth prisms (8..10, 10..12), the box at 10,3 and the one at 9,-2.
    const near = solidIndexOf(world()).collidersNear(9.5, -1.5, 10.5, 3.5);
    expect(xs(near)).toEqual(["8,0", "10,0", "9,-2", "10,3"]);
  });

  it("keeps a part touching the rectangle's edge, and drops one a hair off it", () => {
    const index = solidIndexOf(world());
    expect(xs(index.collidersNear(12, 0.5, 12.5, 1))).toEqual(["10,0", "12,0"]);
    expect(xs(index.collidersNear(12 + 1e-9, 0.5, 12.5, 1))).toEqual(["12,0"]);
  });

  it("hands back the parts of a building of many of them in their order, only those it meets", () => {
    // 40 prisms in a row, a 2 m wide strip of them asked for, and the first one's corner.
    const w = new World<Entity>();
    const prisms = Array.from({ length: 40 }, (_, i) => square(2 * i, 0, 2));
    w.add({ ...still, id: 1, solid: boundsOfPrisms(prisms), prisms });
    const index = solidIndexOf(w);
    expect(xs(index.collidersNear(15, 0.5, 21, 1))).toEqual(["14,0", "16,0", "18,0", "20,0"]);
    expect(xs(index.collidersNear(-1, -1, 0, 0))).toEqual(["0,0"]);
    expect(xs(index.collidersNear(80.5, 0, 81, 1))).toEqual([]);
  });

  it("hands every part of the solids for a point off the rectangle, the list itself for one within it", () => {
    const index = solidIndexOf(world());
    const near = index.collidersNear(9.5, -1.5, 10.5, 3.5);
    expect(collidersAt(near, 10, 1, 0.05)).toBe(near);
    // Off it by less than the margin: a part over the point may not be in the list. The lift far off too, as ever.
    expect(xs(collidersAt(near, 10.48, 1, 0.05))).toEqual([...Array.from({ length: 12 }, (_, i) => `${2 * i},0`), "9,-2", "10,3", "60,60"]);
    const plain = near.slice();
    expect(collidersAt(plain, 30, 30, 0)).toBe(plain);
  });

  it("gives a moving solid's box where it is now, when it meets the rectangle", () => {
    const w = world();
    const index = solidIndexOf(w);
    expect(xs(index.collidersNear(60.5, 60.5, 61, 61))).toEqual(["60,60"]);
    const lift = w.entities.find((e) => e.id === 7)!;
    lift.solid = box(100, 100, 102, 102);
    expect(xs(index.collidersNear(60.5, 60.5, 61, 61))).toEqual([]);
    expect(xs(index.collidersNear(101, 101, 101, 101))).toEqual(["100,100"]);
  });
});
