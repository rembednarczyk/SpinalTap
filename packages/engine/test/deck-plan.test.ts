import { describe, expect, it } from "vitest";
import { DECK_HEADROOM, deckDepth } from "@seki/sim";
import { MeshSink } from "../src/renderer/mesh-sink";
import { Decks, deckHeight, planDeckEdges, planDeckUnderside } from "../src/renderer/mapcity/deck-plan";
import { MapEntries } from "../src/renderer/mapcity/map-entries";
import { MARKING_LIFT, planMarking } from "../src/renderer/mapcity/marking-plan";
import { type P2, boundsOf } from "../src/renderer/mapcity/polygon";

/** A 40 m bridge running east, 10 m wide, its deck from 2 m at the west abutment to 4 m at the east one. */
const axis = { a: { x: 0, y: 2, z: 0 }, b: { x: 40, y: 4, z: 0 } };
const road = [
  { x: 0, z: -5 },
  { x: 40, z: -5 },
  { x: 40, z: 5 },
  { x: 0, z: 5 },
];

/**
 * How far the deck's underside hangs below the fascia's lower edge along the outline at most
 * (`below`, a tooth seen from under the bridge) and how far above it (`above`, a slit), metres.
 */
const fasciaGap = (ring: readonly P2[], h: (x: number, z: number) => number, terrain: (x: number, z: number) => number): { below: number; above: number } => {
  const edges = new MeshSink();
  planDeckEdges(edges, ring, h, 0, () => false, terrain);
  const under = new MeshSink();
  planDeckUnderside(under, ring, h, 0, terrain);
  const at = (s: MeshSink, i: number) => ({ x: s.positions[i * 3]!, y: s.positions[i * 3 + 1]!, z: s.positions[i * 3 + 2]! });
  // The fascia's quads: their two lower corners first (`quadUv`).
  const fasciaLow = (x: number, z: number): number => {
    for (let q = 0; q < edges.vertexCount; q += 4) {
      const [p, r] = [at(edges, q), at(edges, q + 1)];
      const len = Math.hypot(r.x - p.x, r.z - p.z);
      const t = ((x - p.x) * (r.x - p.x) + (z - p.z) * (r.z - p.z)) / (len * len);
      const off = Math.abs((x - p.x) * (r.z - p.z) - (z - p.z) * (r.x - p.x)) / len;
      if (t >= -1e-9 && t <= 1 + 1e-9 && off < 1e-6) return p.y + (r.y - p.y) * t;
    }
    throw new Error(`no fascia at ${x}, ${z}`);
  };
  const undersideAt = (x: number, z: number): number => {
    for (let t = 0; t + 2 < under.indices.length; t += 3) {
      const [a, b, c] = [0, 1, 2].map((k) => at(under, under.indices[t + k]!)) as [ReturnType<typeof at>, ReturnType<typeof at>, ReturnType<typeof at>];
      const det = (b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z);
      if (Math.abs(det) < 1e-12) continue;
      const u = ((x - a.x) * (c.z - a.z) - (c.x - a.x) * (z - a.z)) / det;
      const v = ((b.x - a.x) * (z - a.z) - (x - a.x) * (b.z - a.z)) / det;
      if (u >= -1e-7 && v >= -1e-7 && u + v <= 1 + 1e-7) return a.y + u * (b.y - a.y) + v * (c.y - a.y);
    }
    throw new Error(`no underside at ${x}, ${z}`);
  };
  let [below, above] = [0, 0];
  for (let i = 0; i < ring.length; i++) {
    const [a, b] = [ring[i]!, ring[(i + 1) % ring.length]!];
    for (let k = 0; k <= 400; k++) {
      const [x, z] = [a.x + ((b.x - a.x) * k) / 400, a.z + ((b.z - a.z) * k) / 400];
      const gap = fasciaLow(x, z) - undersideAt(x, z);
      below = Math.max(below, gap);
      above = Math.max(above, -gap);
    }
  }
  return { below, above };
};

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

  it("leave a way under the bridge on the terrain, with room for a walker's head under the deck (G-062)", () => {
    const decks = new Decks();
    decks.add(1, road, axis);
    // A valley 3 m under the deck in the middle, up to the abutments at its ends.
    const valley = (x: number) => deckHeight(axis, x, 0) - 3 * Math.sin((Math.PI * x) / 40);
    expect(decks.heightAt(20, 0, valley(20))).toBeNull();
    expect(decks.heightAt(2, 0, valley(2))).toBeCloseTo(deckHeight(axis, 2, 0), 5);
    expect(decks.heightAt(20, 0)).toBeCloseTo(3, 5);
    const h = (x: number, z: number) => deckHeight(axis, x, z);
    for (const plan of [(s: MeshSink) => planDeckEdges(s, road, h, 0, () => false, valley), (s: MeshSink) => planDeckUnderside(s, road, h, 0, valley)]) {
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

  it("keep the deck's depth continuous over the room under it, through the headroom too (G-743)", () => {
    let last = deckDepth(10, 10);
    for (let room = 0.01; room <= 4; room += 0.01) {
      const depth = deckDepth(10, 10 - room);
      expect(Math.abs(depth - last), `room ${room.toFixed(2)}`).toBeLessThan(0.02);
      last = depth;
    }
    // Still clear of a walker's head (1.8 m) wherever there is room to walk under the deck.
    for (let room = DECK_HEADROOM + 0.001; room <= 4; room += 0.01) expect(room - deckDepth(10, 10 - room)).toBeGreaterThan(1.8);
  });

  it("hang the underside nowhere below the fascia's lower edge, over a bank the room under the deck rises over (G-743)", () => {
    // A level deck 13 m up, off the drape's grid, over a bank: 1.2 m under it at the west end, 3.6 m at the east one.
    const ring = [
      { x: 0.37, z: -4.81 },
      { x: 40.37, z: -4.81 },
      { x: 40.37, z: 4.19 },
      { x: 0.37, z: 4.19 },
    ];
    const bank = (x: number, z: number) => 13 - (1.2 + (2.4 * (x - 0.37)) / 40) - 0.05 * z;
    expect(fasciaGap(ring, () => 13, bank)).toEqual({ below: expect.closeTo(0, 6), above: expect.closeTo(0, 6) });
    // A slanting piece of a deck climbing east over a wavy bank, its room through the headroom and back.
    const slant = [
      { x: 3.1, z: 1.3 },
      { x: 31.7, z: 17.9 },
      { x: 27.2, z: 26.4 },
      { x: 9.8, z: 20.6 },
      { x: -1.4, z: 8.8 },
    ];
    const climb = (x: number) => 20 + 0.03 * x;
    const wavy = (x: number, z: number) => climb(x) - 2.4 - 1.1 * Math.sin(x / 3.7) * Math.cos(z / 5.3);
    expect(fasciaGap(slant, climb, wavy)).toEqual({ below: expect.closeTo(0, 6), above: expect.closeTo(0, 6) });
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
