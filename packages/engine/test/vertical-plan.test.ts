import { describe, expect, it } from "vitest";
import { LUBLIN_CHUNKS, buildingView } from "@seki/sim/lublin";
import { prng } from "../src/renderer/city-kit-data";
import { MeshSink } from "../src/renderer/mesh-sink";
import { type AcrossAt, type Span, findSpans, planFarCanyon, planNearCanyon, spanFootbridge } from "../src/renderer/mapcity/canyon-plan";
import { planCanyonSigns } from "../src/renderer/mapcity/canyon-signs";
import { type FacadeFrame, type MapBuilding, facadeFrame } from "../src/renderer/mapcity/facade-frame";
import { mapBuilding } from "../src/renderer/mapcity/map-building";
import { type P2, cleanRing, pointInRing } from "../src/renderer/mapcity/polygon";
import { STACK_STOREY, planFarVertical, planNearVertical, stackTiers } from "../src/renderer/mapcity/vertical-plan";
import { planWallClutter } from "../src/renderer/mapcity/wall-clutter";

/** Vertical Lublin 2077 (ADR-0051): superstructures, wall clutter and what spans the streets. */

const ring = (pts: readonly [number, number][]): P2[] => cleanRing(pts.map(([x, z]) => ({ x, z })));
const rect = (x0: number, z0: number, x1: number, z1: number) => ring([[x0, z0], [x1, z0], [x1, z1], [x0, z1]]);
const none = () => null;
const flat = () => 0;

const tenement = (extra: Partial<MapBuilding> = {}): MapBuilding => ({ id: 3, ring: rect(0, 0, 24, 14), base: 0, foot: 0, height: 13, levels: 4, use: "residential", look: 0x2077, rise: 15, clutter: 0.8, ...extra });

/** Every view of the generated centre as measured frames (no terrain, no neighbours). */
const lublin = (): FacadeFrame[] => {
  // One id per building of the whole city, as the renderer's entity ids are: an id per chunk made
  // the index below keep only the last building of each id (78 of 705 seen).
  let id = 0;
  return LUBLIN_CHUNKS.flatMap((c) =>
    c.buildings.map((b) => {
      id += 1;
      const view = buildingView(b, c.district);
      if (view.kind !== "building") throw new Error("not a building");
      const at = { x: b.x, y: b.y, z: b.z };
      return facadeFrame(mapBuilding(id, { ring: cleanRing(view.outline.map((p) => ({ x: p.x + at.x, z: p.z + at.z }))), view, at }, () => null), none);
    }),
  );
};

const positions = (s: MeshSink): number[] => s.positions;

describe("superstructures (ADR-0051)", () => {
  it("are a pure function of the frame", () => {
    const a = new MeshSink();
    const b = new MeshSink();
    planNearVertical(a, facadeFrame(tenement(), none));
    planNearVertical(b, facadeFrame(tenement(), none));
    expect(a.vertexCount).toBeGreaterThan(50);
    expect(positions(a)).toEqual(positions(b));
    const other = new MeshSink();
    planNearVertical(other, facadeFrame(tenement({ look: 0x1234 }), none));
    expect(positions(other)).not.toEqual(positions(a));
  });

  it("stack whole storeys from the roof up to the rise, inside the outline", () => {
    const f = facadeFrame(tenement(), none);
    const tiers = stackTiers(f);
    expect(tiers.length).toBeGreaterThan(0);
    expect(tiers[tiers.length - 1]!.y1).toBeCloseTo(f.top + 15, 6);
    for (const t of tiers) {
      expect(((t.y1 - t.y0 + (t === tiers[0] ? -0.4 : 0)) / STACK_STOREY) % 1).toBeCloseTo(0, 6);
      for (const p of t.ring) expect(pointInRing(p, f.b.ring)).toBe(true);
    }
  });

  it("stand 5 m back from a landmark they rise over, and drop what no longer fits (G-050)", () => {
    const gate = { ring: rect(0, -6, 24, 0), top: 5 };
    const tiers = stackTiers(facadeFrame(tenement({ landmarks: [gate] }), none));
    expect(tiers.length).toBeGreaterThan(0);
    expect(tiers[tiers.length - 1]!.y1).toBeCloseTo(13 + 15, 6);
    for (const t of tiers) for (const p of t.ring) expect(p.z).toBeGreaterThanOrEqual(5 - 1e-9);
    // A landmark higher than the whole stack changes nothing.
    expect(stackTiers(facadeFrame(tenement({ landmarks: [{ ...gate, top: 40 }] }), none))).toEqual(stackTiers(facadeFrame(tenement(), none)));
    // Between two landmarks, 8 m apart, no tier stands 5 m off both.
    const narrow = tenement({ ring: rect(0, 0, 24, 8), landmarks: [gate, { ring: rect(0, 8, 24, 14), top: 5 }] });
    expect(stackTiers(facadeFrame(narrow, none))).toEqual([]);
  });

  it("leave buildings without a rise as they are, and add nothing far but boxes", () => {
    const flat = facadeFrame(tenement({ rise: 0 }), none);
    const s = new MeshSink();
    planNearVertical(s, flat);
    planFarVertical(s, flat);
    expect(s.empty).toBe(true);
    const near = new MeshSink();
    const far = new MeshSink();
    planNearVertical(near, facadeFrame(tenement(), none));
    planFarVertical(far, facadeFrame(tenement(), none));
    expect(far.vertexCount).toBeLessThan(near.vertexCount);
  });

  it("rise over most of Krakowskie and Podzamcze, never over a landmark, never past an outline", () => {
    const frames = lublin();
    const rising = frames.filter((f) => (f.b.rise ?? 0) > 0);
    const stacked = rising.filter((f) => stackTiers(f).length > 0);
    expect(stacked.length / rising.length).toBeGreaterThan(0.75);
    for (const f of frames) {
      const tiers = stackTiers(f);
      if (f.b.name && /Brama|Trybunał|Wieża|Archikatedra|Zamek|Kościół/.test(f.b.name)) expect(tiers).toEqual([]);
      for (const t of tiers) {
        expect(t.y1).toBeLessThanOrEqual(f.top + (f.b.rise ?? 0) + 1e-6);
        for (const p of t.ring) expect(pointInRing(p, f.b.ring)).toBe(true);
      }
    }
  });
});

describe("over the streets (ADR-0051)", () => {
  const left = facadeFrame(tenement({ id: 1, ring: rect(0, 0, 24, 14) }), none);
  const right = facadeFrame(tenement({ id: 2, ring: rect(0, 32, 24, 46), look: 0x5151 }), none);
  const across: AcrossAt = (x, z, self) => {
    for (const f of [left, right]) if (f.b.id !== self && pointInRing({ x, z }, f.b.ring)) return { id: f.b.id, top: f.top, clutter: f.b.clutter ?? 0 };
    return null;
  };

  it("spans each pair once, from the lower id, across the street", () => {
    const spans = findSpans(left, across);
    expect(spans.length).toBe(3);
    for (const s of spans) {
      expect(s.width).toBeGreaterThan(17.5);
      expect(s.width).toBeLessThan(18.5);
      expect(s.top).toBeCloseTo(13, 6);
    }
    expect(findSpans(right, across)).toEqual([]);
  });

  it("hangs nothing from a landmark or a building without clutter", () => {
    const landmark = facadeFrame(tenement({ id: 1, rise: 0, clutter: 0 }), none);
    expect(findSpans(landmark, across)).toEqual([]);
    const s = new MeshSink();
    planWallClutter(s, landmark);
    planCanyonSigns(s, [landmark], [], false);
    expect(s.empty).toBe(true);
  });

  it("draws cables near, footbridges far, ads and curtains in the signs; lite draws less", () => {
    const spans: Span[] = findSpans(left, across);
    const full = new MeshSink();
    const lite = new MeshSink();
    planNearCanyon(full, spans, false, flat);
    planNearCanyon(lite, spans, true, flat);
    expect(full.vertexCount).toBeGreaterThan(lite.vertexCount);
    const far = new MeshSink();
    planFarCanyon(far, spans);
    expect(far.empty).toBe(spans.every((s) => spanFootbridge(s) === null));
    const signs = new MeshSink();
    const signsLite = new MeshSink();
    planCanyonSigns(signs, [left], spans, false);
    planCanyonSigns(signsLite, [left], spans, true);
    expect(signs.vertexCount).toBeGreaterThanOrEqual(signsLite.vertexCount);
  });

  it("puts a few footbridges over the busy streets of the whole city", () => {
    const frames = lublin();
    const index = new Map<number, FacadeFrame>(frames.map((f) => [f.b.id, f]));
    const at: AcrossAt = (x, z, self) => {
      for (const f of index.values()) {
        if (f.b.id === self) continue;
        const r = f.box;
        if (Math.abs(x - r.cx) > r.halfLong + r.halfShort || Math.abs(z - r.cz) > r.halfLong + r.halfShort) continue;
        if (pointInRing({ x, z }, f.b.ring)) return { id: f.b.id, top: f.top, clutter: f.b.clutter ?? 0 };
      }
      return null;
    };
    const spans = frames.flatMap((f) => findSpans(f, at));
    const bridges = spans.filter((s) => spanFootbridge(s) !== null).length;
    expect(spans.length).toBeGreaterThan(100);
    expect(bridges).toBeGreaterThanOrEqual(3);
    expect(bridges).toBeLessThanOrEqual(15);
  });
});

describe("the cables of a span over the paving (G-268)", () => {
  /** A span over an 18 m street from a building whose ground floor is 10 m under the street. */
  const span = (seed: number, top = 30): Span => ({ a: { x: 0, z: 0 }, b: { x: 0, z: 18 }, along: { x: 1, z: 0 }, width: 18, base: 0, top, clutter: 1, main: false, seed });
  const lowest = (sink: MeshSink, ground: (x: number, z: number) => number) => {
    let low = Infinity;
    for (let i = 0; i < sink.vertexCount; i++) low = Math.min(low, sink.positions[i * 3 + 1]! - ground(sink.positions[i * 3]!, sink.positions[i * 3 + 2]!));
    return low;
  };

  it("hangs every cable and lantern at least 3.5 m over the paving under it, flat or up the slope", () => {
    const street = (_x: number, z: number) => (z > 2 && z < 16 ? 10 : 10 - Math.abs(z - 9) / 3);
    for (let k = 0; k < 40; k++) {
      for (const ground of [flat, street]) {
        const sink = new MeshSink();
        planNearCanyon(sink, [span(k / 40)], false, ground);
        expect(sink.empty).toBe(false);
        expect(lowest(sink, ground)).toBeGreaterThanOrEqual(3.5 - 1e-6);
      }
    }
  });

  it("leaves out the cables that cannot clear the paving under the lower cornice", () => {
    const sink = new MeshSink();
    planNearCanyon(sink, [span(0.3, 12)], false, () => 9);
    expect(sink.empty).toBe(true);
  });

  it("draws every cable as before where the paving needs none lifted", () => {
    // One cable is 6 segments of 3 ribbons; on a phone there are no lanterns.
    const RIBBONS = 6 * 3 * 4;
    const narrow = (seed: number): Span => ({ a: { x: 0, z: 0 }, b: { x: 0, z: 14 }, along: { x: 1, z: 0 }, width: 14, base: 0, top: 20, clutter: 0.35, main: false, seed });
    for (let k = 0; k < 400; k++) {
      const s = narrow(k / 400);
      const count = Math.round(s.clutter * 1.5 * (0.5 + prng(Math.floor(s.seed * 0xfffffff) ^ 0xc0de)()));
      for (const ground of [() => null, () => -100]) {
        const sink = new MeshSink();
        planNearCanyon(sink, [s], true, ground);
        expect(sink.vertexCount, `seed ${k}/400`).toBe(count * RIBBONS);
      }
    }
    // The same span in full, as drawn before G-268: four cables and their lanterns.
    const full = new MeshSink();
    planNearCanyon(full, [narrow(33 / 400)], false, () => -100);
    expect(full.vertexCount).toBe(384);
  });
});
