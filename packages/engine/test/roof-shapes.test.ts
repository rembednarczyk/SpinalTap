import { describe, expect, it } from "vitest";
import type { RoofShape } from "@seki/core";
import { LUBLIN_CHUNKS, buildingView } from "@seki/sim/lublin";
import { MeshSink } from "../src/renderer/mesh-sink";
import { type MapBuilding, facadeFrame } from "../src/renderer/mapcity/facade-frame";
import { planFarBuilding, planNearBuilding } from "../src/renderer/mapcity/facade-plan";
import { ROOF_STYLE, facadeStyle } from "../src/renderer/mapcity/facade-style";
import { type BuildingSource, mapBuilding } from "../src/renderer/mapcity/map-building";
import { type P2, cleanRing } from "../src/renderer/mapcity/polygon";

/**
 * Roofs from the map's `roof:shape` (ADR-0064, G-056): a tenement's gable along or across its
 * plot, a mansard, a half-hipped roof, a chapel's dome and the onion helmet of Brama Krakowska.
 * Buildings without the tag keep the roof they had.
 */

const rect = (x0: number, z0: number, x1: number, z1: number): P2[] =>
  cleanRing([
    { x: x0, z: z0 },
    { x: x1, z: z0 },
    { x: x1, z: z1 },
    { x: x0, z: z1 },
  ]);

/** A 20 x 10 m tenement along x, eaves at 12 m, a 4 m roof. */
const house = (shape?: RoofShape, more: Partial<MapBuilding> = {}): MapBuilding => ({
  id: 3,
  ring: rect(0, 0, 20, 10),
  base: 0,
  foot: 0,
  height: 12,
  levels: 3,
  use: "residential",
  look: 0x5eed,
  roof: 4,
  ...(shape ? { roofShape: shape } : {}),
  ...more,
});

interface Tri {
  readonly pts: readonly { x: number; y: number; z: number }[];
  readonly n: { x: number; y: number; z: number };
  readonly roof: boolean;
}

const plan = (b: MapBuilding, far = false): Tri[] => {
  const sink = new MeshSink();
  (far ? planFarBuilding : planNearBuilding)(sink, facadeFrame(b, () => null));
  const out: Tri[] = [];
  for (let t = 0; t < sink.indices.length; t += 3) {
    const ids = [sink.indices[t]!, sink.indices[t + 1]!, sink.indices[t + 2]!];
    const pts = ids.map((i) => ({ x: sink.positions[i * 3]!, y: sink.positions[i * 3 + 1]!, z: sink.positions[i * 3 + 2]! }));
    const i = ids[0]!;
    out.push({ pts, n: { x: sink.normals[i * 3]!, y: sink.normals[i * 3 + 1]!, z: sink.normals[i * 3 + 2]! }, roof: sink.uvs2[i * 2 + 1]! >= ROOF_STYLE });
  }
  return out;
};

/** The pitched faces of the roof: their distinct normals. */
const slopes = (tris: readonly Tri[]): Set<string> => new Set(tris.filter((t) => t.roof && t.n.y > 0.05 && t.n.y < 0.99).map((t) => `${t.n.x.toFixed(2)},${t.n.y.toFixed(2)},${t.n.z.toFixed(2)}`));
const top = (tris: readonly Tri[]): number => Math.max(...tris.flatMap((t) => t.pts.map((p) => p.y)));
/** Points of the roof's crest: its ridge or its apex. */
const crest = (tris: readonly Tri[]) => {
  const y = top(tris);
  return tris.flatMap((t) => t.pts).filter((p) => p.y > y - 0.01);
};
const spread = (v: readonly number[]): number => Math.max(...v) - Math.min(...v);
/** Walls (non-roof, vertical) reaching over the eaves: gable ends. */
const gableWalls = (tris: readonly Tri[], eaves: number) => tris.filter((t) => !t.roof && Math.abs(t.n.y) < 0.01 && t.pts.some((p) => p.y > eaves + 1));

describe("the roof's shape from the map (ADR-0064)", () => {
  it("draws the shape it is given, whatever the look, also on a part lifted onto a landmark", () => {
    const kinds = { gabled: "gable", "half-hipped": "half-hip", mansard: "mansard", hipped: "hip", pyramidal: "pyramid", skillion: "skillion", dome: "dome", onion: "onion", flat: "flat" } as const;
    for (const [shape, kind] of Object.entries(kinds) as [RoofShape, string][]) {
      for (let look = 0; look < 32; look++) {
        for (const lifted of [false, true]) {
          expect(facadeStyle({ use: "church", levels: 4, height: 16, roof: 5, look, area: 300, width: 12, shape, ...(lifted ? { lifted } : {}) }).roof, `${shape} ${look}`).toBe(kind);
        }
      }
    }
  });

  it("keeps the colours and the rest of the facade the untagged building would have", () => {
    for (let look = 0; look < 64; look++) {
      const input = { use: "residential", levels: 3, height: 12, roof: 4, look, area: 200, width: 10 } as const;
      const plain = facadeStyle(input);
      expect(facadeStyle({ ...input, shape: "hipped" })).toEqual(plain);
      expect({ ...facadeStyle({ ...input, shape: "gabled" }), roof: plain.roof }).toEqual(plain);
    }
  });

  it("raises a gable: two slopes, a ridge along the long side, gable walls at the ends", () => {
    const tris = plan(house("gabled"));
    expect(slopes(tris).size).toBe(2);
    expect(top(tris)).toBeCloseTo(12 + 4 - 0.08, 1);
    const ridge = crest(tris);
    expect(spread(ridge.map((p) => p.z))).toBeLessThan(0.01);
    expect(ridge[0]!.z).toBeCloseTo(5, 1);
    expect(spread(ridge.map((p) => p.x))).toBeGreaterThan(19);
    const gables = gableWalls(tris, 12);
    expect(gables.length).toBeGreaterThan(0);
    for (const g of gables) expect(Math.abs(g.n.x)).toBeCloseTo(1, 3);
  });

  it("turns the ridge across the plot for roof:orientation=across", () => {
    const tris = plan(house("gabled", { roofAcross: true }));
    expect(slopes(tris).size).toBe(2);
    const ridge = crest(tris);
    expect(spread(ridge.map((p) => p.x))).toBeLessThan(0.01);
    expect(ridge[0]!.x).toBeCloseTo(10, 1);
    for (const g of gableWalls(tris, 12)) expect(Math.abs(g.n.z)).toBeCloseTo(1, 3);
  });

  it("hips the top of the gables of a half-hipped roof, breaks every side of a mansard in two", () => {
    const half = plan(house("half-hipped"));
    expect(slopes(half).size).toBe(4);
    expect(gableWalls(half, 12).length).toBeGreaterThan(0);
    // The gable walls stop under the ridge: the hips take its ends.
    expect(Math.max(...gableWalls(half, 12).flatMap((t) => t.pts.map((p) => p.y)))).toBeLessThan(top(half) - 0.5);
    const mansard = plan(house("mansard"));
    expect(slopes(mansard).size).toBe(8);
    expect(gableWalls(mansard, 12)).toHaveLength(0);
  });

  it("brings a pyramid to one apex and slopes a skillion one way", () => {
    const pyramid = plan(house("pyramidal"));
    expect(slopes(pyramid).size).toBe(4);
    const apex = crest(pyramid);
    expect(spread(apex.map((p) => p.x)) + spread(apex.map((p) => p.z))).toBeLessThan(0.01);
    expect(plan(house("skillion")).filter((t) => t.roof && t.n.y > 0.05 && t.n.y < 0.99).length).toBeGreaterThan(0);
    expect(slopes(plan(house("skillion"))).size).toBe(1);
  });

  it("crowns a turret with an onion: a bulb wider than its neck, a point at the top of the roof", () => {
    const turret = house("onion", { ring: rect(0, 0, 7, 6), roof: 9.6, use: "historic", lifted: true, foot: 16.7, base: 0, height: 20 });
    for (const far of [false, true]) {
      const tris = plan(turret, far).filter((t) => t.roof && t.pts.some((p) => p.y > 20.05));
      const r = (p: { x: number; z: number }) => Math.hypot(p.x - 3.5, p.z - 3);
      const pts = tris.flatMap((t) => t.pts);
      expect(Math.max(...pts.map((p) => p.y)), `far ${far}`).toBeCloseTo(20 + 9.6, 0);
      const neck = Math.max(...pts.filter((p) => p.y < 20.3).map(r));
      const bulb = Math.max(...pts.filter((p) => p.y > 21 && p.y < 24).map(r));
      expect(bulb, `far ${far}`).toBeGreaterThan(neck);
    }
  });

  it("keeps the far block's roof the same shape as near", () => {
    for (const shape of ["gabled", "half-hipped", "mansard", "pyramidal"] as const) {
      expect(top(plan(house(shape), true)), shape).toBeCloseTo(top(plan(house(shape))), 1);
      expect(slopes(plan(house(shape), true)).size, shape).toBe(slopes(plan(house(shape))).size);
    }
  });
});

describe("roofs of the generated centre (G-056)", () => {
  const all = LUBLIN_CHUNKS.flatMap((c) => c.buildings);
  const source = (id: string): BuildingSource => {
    const b = all.find((o) => o.id === id);
    if (!b) throw new Error(`no ${id}`);
    const view = buildingView(b) as BuildingSource["view"];
    return { ring: cleanRing(view.outline.map((p) => ({ x: p.x + b.x, z: p.z + b.z }))), view, at: { x: b.x, y: b.y, z: b.z } };
  };
  const roofOf = (id: string) => facadeFrame(mapBuilding(1, source(id), () => null), () => null).style.roof;

  it("passes the shape from the view to the frame", () => {
    expect(roofOf("w617878341")).toBe("onion");
    expect(roofOf("w617763434")).toBe("dome");
    expect(roofOf("w617763433")).toBe("gable");
    expect(mapBuilding(1, source("w618270604"), () => null)).toMatchObject({ roofShape: "gabled", roofAcross: true });
  });

  it("leaves untagged buildings to the old rule", () => {
    const untagged = all.filter((b) => b.roofShape === undefined && (b.roof ?? 0) > 0.3);
    expect(untagged.length).toBeGreaterThan(5);
    for (const b of untagged) expect(["hip", "dome"]).toContain(roofOf(b.id));
  });
});

describe("a building without roof:shape (ADR-0064: unchanged)", () => {
  it("draws the very same mesh as before", () => {
    const sums: string[] = [];
    for (let look = 0; look < 12; look++) {
      for (const far of [false, true]) {
        const sink = new MeshSink();
        (far ? planFarBuilding : planNearBuilding)(sink, facadeFrame(house(undefined, { look, use: look % 3 === 0 ? "civic" : look % 3 === 1 ? "church" : "residential" }), () => null));
        sums.push(`${sink.positions.length}:${sink.positions.reduce((s, v, i) => s + v * ((i % 7) + 1), 0).toFixed(3)}`);
      }
    }
    expect(sums).toEqual(UNTAGGED);
  });
});

/** Measured on the renderer before ADR-0064 (the hipped roof and the chance dome). */
const UNTAGGED: readonly string[] = [
  "2268:82731.547",
  "60:1890.000",
  "1596:62221.195",
  "204:7286.913",
  "732:22357.394",
  "108:3713.813",
  "984:31076.047",
  "108:3713.813",
  "1848:70808.839",
  "204:7286.913",
  "732:22357.394",
  "108:3713.813",
  "984:30947.442",
  "108:3713.813",
  "1596:62221.195",
  "204:7286.913",
  "732:22357.394",
  "108:3713.813",
  "732:22357.394",
  "108:3713.813",
  "972:31864.633",
  "204:7286.913",
  "732:22357.394",
  "108:3713.813",
];
