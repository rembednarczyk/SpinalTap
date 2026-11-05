import { describe, expect, it } from "vitest";
import { MeshSink } from "../src/renderer/mesh-sink";
import { Decks, deckHeight, planDeckEdges, planDeckUnderside } from "../src/renderer/mapcity/deck-plan";
import { MapEntries } from "../src/renderer/mapcity/map-entries";
import { MARKING_LIFT, planMarking } from "../src/renderer/mapcity/marking-plan";
import { boundsOf } from "../src/renderer/mapcity/polygon";

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
    planDeckEdges(sink, road, (x, z) => deckHeight(axis, x, z), 0.1, decks.heightAt);
    // The south side and the two ends: three quads.
    expect(sink.vertexCount).toBe(12);
    let low = Infinity;
    for (let i = 0; i < sink.vertexCount; i++) {
      low = Math.min(low, sink.positions[i * 3 + 1]!);
      expect(sink.positions[i * 3 + 2]!).toBeLessThan(5.01);
    }
    expect(low).toBeCloseTo(2 + 0.1 - 0.9, 5);
  });

  it("close a step down onto a lower piece of the bridge with a face down to it, and leave a kerb open (G-340)", () => {
    // The sidewalk north of the road at the road's height in the west, 1.6 m over it in the east.
    const walk = [{ x: 0, z: 5 }, { x: 40, z: 5 }, { x: 40, z: 8 }, { x: 0, z: 8 }];
    const level = { a: { x: 0, y: 2, z: 6.5 }, b: { x: 40, y: 5.6, z: 6.5 } };
    const decks = new Decks();
    decks.add(1, road, axis);
    decks.add(2, walk, level);
    const faces = (top: typeof level) => {
      const sink = new MeshSink();
      planDeckEdges(sink, walk, (x, z) => deckHeight(top, x, z), 0, decks.heightAt);
      return Array.from({ length: sink.vertexCount }, (_, i) => ({ x: sink.positions[i * 3]!, y: sink.positions[i * 3 + 1]!, z: sink.positions[i * 3 + 2]! }));
    };
    const all = faces(level);
    // Over the valley the north side and the two ends, a quad each; over the road a quad every 2 m.
    expect(all).toHaveLength((3 + 20) * 4);
    // The face over the road runs from the sidewalk down to the road: 1.52 m 2 m off the east end.
    const step = all.filter((p) => Math.abs(p.z - 5) < 1e-6 && p.x > 1e-6 && p.x < 40 - 1e-6);
    for (const p of step) expect([deckHeight(level, p.x, 5), deckHeight(axis, p.x, 0)].some((y) => Math.abs(p.y - y) < 1e-6)).toBe(true);
    expect([...new Set(step.filter((p) => Math.abs(p.x - 38) < 1e-6).map((p) => p.y.toFixed(2)))].sort()).toEqual(["3.90", "5.42"]);
    // A kerb of 0.2 m over the road: no face, the edge is the road going on.
    expect(faces({ a: { x: 0, y: 2.2, z: 6.5 }, b: { x: 40, y: 4.2, z: 6.5 } })).toHaveLength(3 * 4);
  });

  it("leave a way under the bridge on the terrain, with room for a walker's head under the deck (G-062)", () => {
    const decks = new Decks();
    decks.add(1, road, axis);
    // A valley 3 m under the deck in the middle, up to the abutments at its ends.
    const valley = (x: number) => deckHeight(axis, x, 0) - 3 * Math.sin((Math.PI * x) / 40);
    expect(decks.heightAt(20, 0, valley(20))).toBeNull();
    expect(decks.heightAt(2, 0, valley(2))).toBeCloseTo(deckHeight(axis, 2, 0), 5);
    expect(decks.heightAt(20, 0)).toBeCloseTo(3, 5);
    const h = (x: number, z: number) => deckHeight(axis, x, z);
    for (const plan of [(s: MeshSink) => planDeckEdges(s, road, h, 0, () => null, valley), (s: MeshSink) => planDeckUnderside(s, road, h, 0, valley)]) {
      const sink = new MeshSink();
      plan(sink);
      let headroom = Infinity;
      for (let i = 0; i < sink.vertexCount; i++) {
        const x = sink.positions[i * 3]!;
        if (h(x, 0) - valley(x) > 2) headroom = Math.min(headroom, sink.positions[i * 3 + 1]! - valley(x));
      }
      expect(headroom).toBeGreaterThan(1.8);
      expect(headroom).toBeLessThan(2.2);
    }
  });

  it("paint the lines by a deck's edge on its carriageway, and those beside it on the terrain (G-301)", () => {
    const entries = new MapEntries();
    const heights = Array.from({ length: 21 * 9 }, () => 0);
    entries.terrains.set(1, { grid: { originX: -20, originZ: -20, cell: 5, cols: 21, rows: 9, heights }, open: undefined, bounds: { minX: -20, maxX: 80, minZ: -20, maxZ: 20 }, mesh: null });
    // The deck 2-4 m over the level valley to z 4.7 either way: the drape's grid has corners at 2.5 on it and 5 off it.
    entries.addGround(2, { surface: "road", ring: road.map((p) => ({ x: p.x, z: p.z * 0.94 })), y: 0, bounds: { minX: 0, maxX: 40, minZ: -4.7, maxZ: 4.7 }, cell: "", deck: axis });
    for (const [z, on] of [[4, true], [-4, true], [4.9, false], [-6, false]] as const) {
      const line = [{ x: 3, z }, { x: 37, z }];
      const g = { surface: "road" as const, marking: "edge" as const, ring: line, y: 0, bounds: boundsOf(line), cell: "" };
      const sink = new MeshSink();
      planMarking(sink, "edge", line, entries.groundHeight(g));
      for (let i = 0; i < sink.vertexCount; i++) {
        const [x, y, vz] = [sink.positions[i * 3]!, sink.positions[i * 3 + 1]!, sink.positions[i * 3 + 2]!];
        expect(y, `${x}, ${vz}`).toBeCloseTo((on ? deckHeight(axis, x, vz) : 0) + MARKING_LIFT, 6);
      }
    }
  });

  it("paint a line cut at the bridge's end wholly on its surface, a centimetre past the outline too (G-330)", () => {
    const entries = new MapEntries();
    const heights = Array.from({ length: 21 * 9 }, () => 0);
    entries.terrains.set(1, { grid: { originX: -20, originZ: -20, cell: 5, cols: 21, rows: 9, heights }, open: undefined, bounds: { minX: -20, maxX: 80, minZ: -20, maxZ: 20 }, mesh: null });
    entries.addGround(2, { surface: "road", ring: road, y: 0, bounds: boundsOf(road), cell: "", deck: axis });
    // The import rounds both the deck's outline and the lines to 0.1 m: the deck's line may end just past its end, the road's on beyond it just short of it.
    for (const [from, to, on] of [[3, 40.02, true], [39.98, 60, false]] as const) {
      const line = [{ x: from, z: 4 }, { x: to, z: 4 }];
      const g = { surface: "road" as const, marking: "edge" as const, ring: line, y: 0, bounds: boundsOf(line), cell: "" };
      const sink = new MeshSink();
      planMarking(sink, "edge", line, entries.groundHeight(g));
      for (let i = 0; i < sink.vertexCount; i++) {
        const [x, y, vz] = [sink.positions[i * 3]!, sink.positions[i * 3 + 1]!, sink.positions[i * 3 + 2]!];
        expect(y, `${x}, ${vz}`).toBeCloseTo((on ? deckHeight(axis, x, vz) : 0) + MARKING_LIFT, 6);
      }
    }
  });
});
