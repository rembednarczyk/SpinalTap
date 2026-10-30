import { describe, expect, it } from "vitest";
import { MeshSink } from "../src/renderer/mesh-sink";
import { Decks, deckHeight, planDeckEdges } from "../src/renderer/mapcity/deck-plan";

/** A 40 m bridge running east, 10 m wide, its deck from 2 m at the west abutment to 4 m at the east one. */
const axis = { a: { x: 0, y: 2, z: 0 }, b: { x: 40, y: 4, z: 0 } };
const road = [
  { x: 0, z: -5 },
  { x: 40, z: -5 },
  { x: 40, z: 5 },
  { x: 0, z: 5 },
];

describe("bridges' decks (ADR-0053)", () => {
  it("lay the pieces on a bridge level from abutment to abutment, over whatever valley is under them", () => {
    expect(deckHeight(axis, 20, 4)).toBeCloseTo(3, 5);
    expect(deckHeight(axis, -10, 0)).toBeCloseTo(2, 5);
    const decks = new Decks();
    decks.add(1, road, axis);
    expect(decks.heightAt(10, -2)).toBeCloseTo(2.5, 5);
    expect(decks.heightAt(10, 8)).toBeNull();
    decks.remove(1);
    expect(decks.heightAt(10, -2)).toBeNull();
  });

  it("hang a fascia under the open edges only, down below the deck", () => {
    const decks = new Decks();
    decks.add(1, road, axis);
    // A second piece north of it (the sidewalk on the same bridge): the shared edge stays open.
    decks.add(2, [{ x: 0, z: 5 }, { x: 40, z: 5 }, { x: 40, z: 8 }, { x: 0, z: 8 }], axis);
    const sink = new MeshSink();
    planDeckEdges(sink, road, (x, z) => deckHeight(axis, x, z), 0.1, (x, z) => decks.heightAt(x, z) !== null);
    // The south side and the two ends: three quads.
    expect(sink.vertexCount).toBe(12);
    let low = Infinity;
    for (let i = 0; i < sink.vertexCount; i++) {
      low = Math.min(low, sink.positions[i * 3 + 1]!);
      expect(sink.positions[i * 3 + 2]!).toBeLessThan(5.01);
    }
    expect(low).toBeCloseTo(2 + 0.1 - 0.9, 5);
  });
});
