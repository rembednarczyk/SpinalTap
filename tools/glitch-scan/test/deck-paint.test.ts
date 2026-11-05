import { describe, expect, it } from "vitest";
import type { Vec3, ViewDescriptor } from "../../../packages/core/src";
import { WORLD_SCENERY } from "../../../packages/sim/src/content/world-map";
import { deckPaint, mapGround } from "./deck-paint";

/**
 * Paint on a bridge's deck and by it (G-301 round 2, `paint-under-deck`, `paint-lifted-by-deck`):
 * on a small world, a deck 5 m over a level valley with edge lines along it, and on the whole city.
 */

const O: Vec3 = { x: 0, y: 0, z: 0 };
const heights = Array.from({ length: 21 * 9 }, () => 0);
const VALLEY = { view: { kind: "terrain", grid: { originX: -20, originZ: -20, cell: 5, cols: 21, rows: 9, heights } }, at: O };
/** A deck from x 0 to 40, z 0.3 to 10.3: the grid's corners at z 0 and 12.5 lie off it. */
const DECK = {
  view: { kind: "ground", surface: "road", outline: [{ x: 0, z: 0.3 }, { x: 40, z: 0.3 }, { x: 40, z: 10.3 }, { x: 0, z: 10.3 }], deck: { a: { x: 0, y: 5, z: 5.3 }, b: { x: 40, y: 5, z: 5.3 } } },
  at: O,
};
/** The same deck 1.5 m over the valley, within a way's headroom (G-062): the ground of a way under it. */
const LOW_DECK = { ...DECK, view: { ...DECK.view, deck: { a: { x: 0, y: 1.5, z: 5.3 }, b: { x: 40, y: 1.5, z: 5.3 } } } };
/** A level band of steps along the deck's edge, across it, its axis (z 10.7) off the deck. */
const BAND = { view: { kind: "ground", surface: "steps", outline: [{ x: 5, z: 9.8 }, { x: 15, z: 9.8 }, { x: 15, z: 11.6 }, { x: 5, z: 11.6 }] }, at: O };
const line = (z: number) => ({ view: { kind: "road-marking", marking: "edge", line: [{ x: 3, z }, { x: 37, z }] }, at: O });
const world = (...items: { view: unknown; at: Vec3 }[]) => mapGround(items as { view: ViewDescriptor; at: Vec3 }[]);

describe("paint on and by the decks (G-301)", () => {
  it("keeps an edge line by the deck's outline on its carriageway", () => {
    expect(deckPaint(world(VALLEY, DECK, line(1), line(9.6))).under).toEqual([]);
  });

  it("keeps a line beside the deck on the terrain", () => {
    expect(deckPaint(world(VALLEY, DECK, line(11), line(-0.5))).lifted).toEqual([]);
  });

  it("finds a band across the deck's outline laid on the terrain under its carriageway (G-330)", () => {
    expect(deckPaint(world(VALLEY, LOW_DECK, BAND)).under).toEqual([{ at: expect.stringMatching(/^steps at /), what: "148 cm under the deck's carriageway" }]);
  });

  it("finds none in the city", () => {
    const { under, lifted } = deckPaint(mapGround(WORLD_SCENERY));
    expect(under).toEqual([]);
    expect(lifted).toEqual([]);
  });
});
