import { describe, expect, it } from "vitest";
import { CLEARED } from "../../../packages/sim/src/content/lublin/sites.ts";
import { COVER } from "../../orto/src/classify.ts";
import { type Cover } from "../../orto/src/cover.ts";
import { THRESHOLDS } from "../../orto/src/thresholds.ts";
import { FILL, FILL_CLEARED, type TownPlaces, coverFills, withFills } from "../src/bare-cover.ts";
import { type Pt, type Rect, pointInRing, signedArea } from "../src/geometry.ts";
import { type GroundOut } from "../src/model.ts";

/** A 20 m square's cover: green west of x = 10, paving east of it, `at` overriding a sample. */
const RECT: Rect = { minX: 0, minZ: 0, maxX: 20, maxZ: 20 };
const cover = (at: (x: number, z: number) => number | undefined = () => undefined): Cover => {
  const n = 40;
  const cls = new Uint8Array(n * n);
  for (let row = 0; row < n; row++)
    for (let col = 0; col < n; col++) {
      const [x, z] = [(col + 0.5) / 2, 20 - (row + 0.5) / 2];
      cls[row * n + col] = at(x, z) ?? (x < 10 ? COVER.green : COVER.paving);
    }
  return { header: { district: "test", x0: 0, z1: 20, step: 0.5, width: n, height: n, classes: [], source: "", tiles: [], thresholds: THRESHOLDS }, cls };
};
const box = (minX: number, minZ: number, maxX: number, maxZ: number): Pt[] => [
  { x: minX, z: minZ },
  { x: maxX, z: minZ },
  { x: maxX, z: maxZ },
  { x: minX, z: maxZ },
];
const piece = (surface: GroundOut["surface"], ring: readonly Pt[], bridge = false): GroundOut => ({ surface, outline: ring.flatMap((p) => [p.x, p.z]), ...(bridge ? { bridge: true as const } : {}) });
const ringOf = (g: GroundOut): Pt[] => Array.from({ length: g.outline.length / 2 }, (_, k) => ({ x: g.outline[2 * k]!, z: g.outline[2 * k + 1]! }));
const surfaceAt = (fills: readonly GroundOut[], p: Pt) => fills.filter((f) => pointInRing(p, ringOf(f))).map((f) => f.surface);
/** The centres of the 0.5 m cells of a rectangle. */
const samples = (r: Rect): Pt[] => {
  const out: Pt[] = [];
  for (let x = r.minX + 0.25; x < r.maxX; x += 0.5) for (let z = r.minZ + 0.25; z < r.maxZ; z += 0.5) out.push({ x, z });
  return out;
};

describe("bare ground laid from the orthophoto's cover (ADR-0077 step 1.1)", () => {
  const road = piece("road", box(8, 0, 12, 20));
  const shed = box(3, 8, 6, 11);
  /** The whole square a town's paved place (a shops' land). */
  const TOWN: TownPlaces = { areas: [box(0, 0, 20, 20)], stops: [], shops: [] };

  it("lays a lawn on green and paving on light paving, round the map's pieces and walls", () => {
    const fills = coverFills(RECT, cover(), [road], [shed], TOWN);
    for (const p of samples({ minX: 0, minZ: 0, maxX: 8, maxZ: 20 }).filter((q) => !pointInRing(q, shed))) expect(surfaceAt(fills, p), `${p.x},${p.z}`).toEqual(["grass"]);
    for (const p of samples({ minX: 12, minZ: 0, maxX: 20, maxZ: 20 })) expect(surfaceAt(fills, p), `${p.x},${p.z}`).toEqual(["square"]);
    // Under the road the fill runs on one cell, its kerb's: the rest of the road and the shed stay bare.
    for (const p of [...samples({ minX: 8.5, minZ: 0, maxX: 11.5, maxZ: 20 }), ...samples({ minX: 3, minZ: 8, maxX: 6, maxZ: 11 })]) expect(surfaceAt(fills, p), `${p.x},${p.z}`).toEqual([]);
  });

  it("lays pieces without holes: a shed in a lawn splits it", () => {
    const fills = coverFills(RECT, cover(), [road], [shed], TOWN);
    for (const f of fills) expect(signedArea(ringOf(f))).toBeGreaterThan(0);
    const lawn = fills.filter((f) => f.surface === "grass").reduce((s, f) => s + signedArea(ringOf(f)), 0);
    // 8 by 20 m less the shed's 9 m², and the cell it runs on under the road.
    expect(lawn).toBeGreaterThan(155);
    expect(lawn).toBeLessThan(163);
  });

  it("ends a fill where the map's piece begins, between the samples", () => {
    const off = piece("square", box(13.1, 0, 20, 20));
    const fills = coverFills(RECT, cover(), [road, off], [], TOWN);
    const strip = fills.filter((f) => f.surface === "square");
    const xs = strip.flatMap((f) => ringOf(f).map((p) => p.x));
    expect(Math.max(...xs)).toBeLessThanOrEqual(13.1 + FILL.simplify + 0.05);
    expect(surfaceAt(fills, { x: 12.75, z: 10.25 })).toEqual(["square"]);
  });

  it("gives shade and crowns the class round them, and leaves asphalt and specks to their neighbourhood", () => {
    const fills = coverFills(RECT, cover((x, z) => (x > 2 && x < 4 && z > 2 && z < 4 ? COVER.canopy : x > 14 && x < 15 && z > 14 && z < 15 ? COVER.asphalt : x > 16 ? COVER.asphalt : undefined)), [road], [], TOWN);
    expect(surfaceAt(fills, { x: 3.25, z: 3.25 })).toEqual(["grass"]);
    expect(surfaceAt(fills, { x: 14.25, z: 14.25 })).toEqual(["square"]);
    expect(surfaceAt(fills, { x: 18.25, z: 10.25 })).toEqual([]);
  });

  it("lays nothing within reach of a bridge's deck, nor on the set pieces' cleared ground", () => {
    const deck = piece("road", box(0, 9, 8, 11), true);
    const fills = coverFills(RECT, cover(), [road, deck], [], TOWN);
    for (const p of samples({ minX: 0, minZ: 9 - FILL.bridge + 0.5, maxX: 7.5, maxZ: 11 + FILL.bridge - 0.5 })) expect(surfaceAt(fills, p)).toEqual([]);
    expect(surfaceAt(fills, { x: 2.25, z: 2.25 })).toEqual(["grass"]);
    expect(FILL_CLEARED).toEqual(CLEARED);
  });

  it("lays only compact regions off a town's paved places", () => {
    // A lawn 15 m wide and a 1 m strip of paving past it, by the road: a strip by a wall, not a yard.
    const east = piece("road", box(16, 0, 20, 20));
    const at = (x: number) => (x < 15 ? COVER.green : COVER.paving);
    const fills = coverFills(RECT, cover(at), [east], []);
    expect(surfaceAt(fills, { x: 15.25, z: 10.25 })).toEqual([]);
    expect(surfaceAt(fills, { x: 1.25, z: 10.25 })).toEqual(["grass"]);
    expect(surfaceAt(coverFills(RECT, cover(at), [east], [], TOWN), { x: 15.25, z: 10.25 })).toEqual(["square"]);
  });

  it("gives way within 5 m of a carriageway behind bare ground on its kerb, and stays on the kerb", () => {
    const fills = coverFills(RECT, cover((x) => (x > 12 && x < 13 ? COVER.asphalt : undefined)), [road], [], TOWN);
    for (const x of [12.25, 13.25, 16.25]) expect(surfaceAt(fills, { x, z: 10.25 }), `${x}`).toEqual([]);
    expect(surfaceAt(fills, { x: 18.25, z: 10.25 })).toEqual(["square"]);
    expect(surfaceAt(fills, { x: 7.75, z: 10.25 })).toEqual(["grass"]);
  });

  it("puts each fill first among the pieces of its surface", () => {
    const ground = [piece("water", box(0, 0, 1, 1)), piece("grass", box(1, 0, 2, 1)), piece("square", box(2, 0, 3, 1)), piece("road", box(3, 0, 4, 1))];
    const fills = [piece("square", box(5, 0, 6, 1)), piece("grass", box(6, 0, 7, 1))];
    expect(withFills(ground, fills).map((g) => g.outline[0])).toEqual([0, 6, 1, 5, 2, 3]);
  });
});
