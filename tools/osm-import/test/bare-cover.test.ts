import { describe, expect, it } from "vitest";
import { CLEARED } from "../../../packages/sim/src/content/lublin/sites.ts";
import { COVER } from "../../orto/src/classify.ts";
import { type Cover } from "../../orto/src/cover.ts";
import { THRESHOLDS } from "../../orto/src/thresholds.ts";
import { FILL, FILL_CLEARED, type TownPlaces, coverFills, townPlaces, withFills } from "../src/bare-cover.ts";
import { frontages } from "../src/bare-fronts.ts";
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
    // The road and the shed cut the fills on their edges: none under them.
    for (const p of [...samples({ minX: 8, minZ: 0, maxX: 12, maxZ: 20 }), ...samples({ minX: 3, minZ: 8, maxX: 6, maxZ: 11 })]) expect(surfaceAt(fills, p), `${p.x},${p.z}`).toEqual([]);
  });

  it("lays pieces without holes: a shed in a lawn splits it", () => {
    const fills = coverFills(RECT, cover(), [road], [shed], TOWN);
    for (const f of fills) expect(signedArea(ringOf(f))).toBeGreaterThan(0);
    const lawn = fills.filter((f) => f.surface === "grass").reduce((s, f) => s + signedArea(ringOf(f)), 0);
    // 8 by 20 m less the shed's 9 m²: the road and the shed cut it on their edges.
    expect(lawn).toBeGreaterThan(149);
    expect(lawn).toBeLessThan(152);
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

  it("lays a strip between a carriageway and the next piece past it however narrow (step 1.2)", () => {
    // Paving east of the road: a 1.5 m strip to a pavement, and 4 m behind it.
    const pavement = piece("sidewalk", box(13.5, 0, 16, 20));
    const fills = coverFills(RECT, cover(), [road, pavement], []);
    expect(surfaceAt(fills, { x: 12.75, z: 10.25 })).toEqual(["square"]);
    expect(surfaceAt(fills, { x: 18.25, z: 10.25 })).toEqual([]);
    // With nothing past it, or the pavement over 5 m off, the strip is a loose region again.
    expect(surfaceAt(coverFills(RECT, cover(), [road], []), { x: 12.75, z: 10.25 })).toEqual([]);
    expect(surfaceAt(coverFills(RECT, cover(), [road, piece("sidewalk", box(18, 0, 20, 20))], []), { x: 12.75, z: 10.25 })).toEqual([]);
  });

  it("lays a pedestrian street's frontage up to the walls, paved where the cover shows no lawn or paving, and not a yard behind them (G-853)", () => {
    // A pedestrian street along x at z = 10, its paving 4 m wide; tenements north of z = 15 and a
    // row south of z = 5 with a yard behind it. Asphalt-dark setts north of the paving, a lawn at
    // its west end, light paving south of it and in the yard.
    const street = piece("square", box(0, 8, 20, 12));
    const walls = [box(0, 15, 20, 20), box(0, 3, 20, 5)];
    const green = (x: number, z: number) => (x < 6 && z < 14) || (x > 7 && x < 8.5 && z > 12.5 && z < 14);
    const at = (x: number, z: number) => (z > 12 && z < 15 ? (green(x, z) ? COVER.green : COVER.asphalt) : COVER.paving);
    const line = (highway: string, z: number) => ({ id: "w1", osmId: 1, tags: { highway }, line: [{ x: -5, z }, { x: 25, z }] });
    const fronts = frontages([line("pedestrian", 10)]);
    const fills = coverFills(RECT, cover(at), [street], walls, { areas: [], stops: [], shops: [], fronts });
    expect(surfaceAt(fills, { x: 10.25, z: 13.75 })).toEqual(["square"]);
    expect(surfaceAt(fills, { x: 2.25, z: 13.25 })).toEqual(["grass"]);
    // A speck of green the cover alone shows in it, 2.25 m²: the setts' patina, paved (G-775).
    expect(surfaceAt(fills, { x: 7.75, z: 13.25 })).toEqual(["square"]);
    expect(surfaceAt(fills, { x: 10.25, z: 6.25 })).toEqual(["square"]);
    expect(surfaceAt(fills, { x: 10.25, z: 1.75 }), "the yard behind the wall").toEqual([]);
    // A lawn of the map in the frontage, drawn or not, is no frontage: nothing paved over it.
    const lawned = coverFills(RECT, cover(at), [street], walls, { areas: [], stops: [], shops: [], fronts, greens: [box(12, 12.5, 16, 15)] });
    expect(surfaceAt(lawned, { x: 14.25, z: 13.75 })).toEqual([]);
    expect(surfaceAt(lawned, { x: 10.25, z: 13.75 })).toEqual(["square"]);
    // No frontage: the strips by the walls are loose regions, the asphalt bare.
    const none = coverFills(RECT, cover(at), [street], walls);
    for (const z of [13.75, 6.25]) expect(surfaceAt(none, { x: 10.25, z }), `${z}`).toEqual([]);
    // The frontages' pieces come on top of the rule's, which stay as they were, and are marked: the furniture does not read them.
    expect(fills.filter((f) => !f.front)).toEqual(none);
    expect(fills.filter((f) => f.front).length).toBeGreaterThan(0);
    // Walls past the reach: the strip the reach's edge leaves before them joins the frontage.
    const far = frontages([line("pedestrian", 1)]);
    const wide = coverFills(RECT, cover(() => COVER.asphalt), [piece("square", box(0, 0, 20, 2))], [box(0, 15, 20, 20)], { areas: [], stops: [], shops: [], fronts: far });
    for (const z of [6.25, 12.75, 14.75]) expect(surfaceAt(wide, { x: 10.25, z }), `${z}`).toEqual(["square"]);
    // A residential street has a frontage only inside the Old Town's walls, a carriageway none.
    expect(frontages([line("residential", 10), line("tertiary", 10), { ...line("pedestrian", 10), tags: { highway: "pedestrian", tunnel: "yes" } }])).toEqual([]);
    expect(frontages([{ ...line("residential", 0), line: [{ x: 560, z: -60 }, { x: 600, z: -60 }, { x: 900, z: -60 }] }]).map((f) => [f.line.length, f.reach])).toEqual([[3, 6]]);
  });

  it("lays no frontage on a building site of the map, a site's ground as the rule's first pass leaves it (G-866)", () => {
    // The street of the test above; a site (`landuse=construction`, a `building=construction` in it)
    // north of the paving, its cover green (crowns of an earlier flight) and asphalt.
    const street = piece("square", box(0, 8, 20, 12));
    const at = (x: number, z: number) => (z > 12 && z < 15 ? (x > 12 && x < 16 ? COVER.green : COVER.asphalt) : COVER.paving);
    const fronts = frontages([{ id: "w1", osmId: 1, tags: { highway: "living_street" }, line: [{ x: -5, z: 10 }, { x: 25, z: 10 }] }]);
    const area = (id: number, tags: Record<string, string>, ring: Pt[]) => ({ id: `w${id}`, osmId: id, tags, ring, holes: 0 });
    const data = { nodes: new Map(), ways: new Map(), relations: new Map() };
    const sited = (tags: Record<string, string>) => {
      const town = townPlaces(data, [area(2, tags, box(11, 12, 17, 15))], [], fronts);
      return coverFills(RECT, cover(at), [street], [box(0, 15, 20, 20)], { ...town, shops: [] });
    };
    for (const tags of [{ landuse: "construction" }, { building: "construction" }] as Record<string, string>[]) {
      const fills = sited(tags);
      for (const x of [12.25, 14.25, 16.25]) expect(surfaceAt(fills.filter((f) => f.front), { x, z: 13.75 }), `${JSON.stringify(tags)} ${x}`).toEqual([]);
      expect(surfaceAt(fills, { x: 8.25, z: 13.75 }), "the frontage beside the site").toEqual(["square"]);
    }
    expect(surfaceAt(sited({ landuse: "residential" }), { x: 14.25, z: 13.75 }), "no site: the frontage").not.toEqual([]);
  });

  it("lays crowns over paving a lawn, not paving, and leaves those over asphalt bare; a speck of green in paving stays a lawn (T-285)", () => {
    const crown = (x: number, z: number) => (x > 14 && x < 16 && z > 8 && z < 12) || (x > 17 && x < 19 && z > 2 && z < 4);
    const at = (x: number, z: number) => (crown(x, z) ? COVER.canopy : x > 16.5 && z < 6 ? COVER.asphalt : x > 17 && x < 18 && z > 15 && z < 16.5 ? COVER.green : undefined);
    const fills = coverFills(RECT, cover(at), [road], [], TOWN);
    expect(surfaceAt(fills, { x: 15.25, z: 10.25 })).toEqual(["grass"]);
    expect(surfaceAt(fills, { x: 18.25, z: 3.25 })).toEqual([]);
    expect(surfaceAt(fills, { x: 17.25, z: 15.75 })).toEqual(["grass"]);
    expect(surfaceAt(fills, { x: 18.75, z: 15.75 })).toEqual(["square"]);
  });

  it("lays no piece touching itself: a cut touching the fill's edge at a point splits it there (G-764)", () => {
    // Two yards' squares, south-west and north-east, leave the paving two squares meeting at (16; 10):
    // the cut's ring would run round both and visit that corner twice.
    const yards = [piece("square", box(12, 0, 16, 10)), piece("square", box(16, 10, 20, 20))];
    const fills = coverFills(RECT, cover(), [road, ...yards], [], TOWN);
    const paving = fills.filter((f) => f.surface === "square");
    expect(paving.length, JSON.stringify(paving.map((f) => f.outline))).toBeGreaterThan(1);
    for (const f of fills) {
      const ring = ringOf(f);
      expect(new Set(ring.map((p) => `${p.x},${p.z}`)).size, JSON.stringify(f.outline)).toBe(ring.length);
    }
    // The paving still covers both squares.
    for (const p of [
      { x: 17.25, z: 4.75 },
      { x: 14.75, z: 15.25 },
    ])
      expect(surfaceAt(fills, p), `${p.x},${p.z}`).toEqual(["square"]);
  });

  it("lays paving under crowns the leaf-off flight shows as paving, among paving and in a lawn alike (G-764)", () => {
    // A 2 by 4 m pavement under trees in paving, and one in the lawn west of the road.
    const at = (x: number, z: number) => ((x > 14 && x < 16 && z > 8 && z < 12) || (x > 3 && x < 5 && z > 2 && z < 6) ? COVER.canopyHard : undefined);
    const fills = coverFills(RECT, cover(at), [road], [], TOWN);
    for (const p of [...samples({ minX: 14, minZ: 8, maxX: 16, maxZ: 12 }), ...samples({ minX: 3, minZ: 2, maxX: 5, maxZ: 6 })]) expect(surfaceAt(fills, p), `${p.x},${p.z}`).toEqual(["square"]);
  });

  it("leaves no bare ground where a split's edge crosses a lawn's corner on the slant (G-769)", () => {
    // A lawn in the paving, two cells wide, its south row a cell east: the paving's split through it
    // (x = 14.5) crosses its corners, cut on the slant, as at Krakowskie (299.5; -228.1).
    const lawn = (x: number, z: number) => ((z > 10 && z < 11 && x > 14 && x < 15) || (z > 9.5 && z < 10 && x > 14.5 && x < 15.5) ? COVER.green : undefined);
    const fills = coverFills(RECT, cover(lawn), [road], [], TOWN);
    const bare: string[] = [];
    for (let x = 13.05; x < 17; x += 0.1) for (let z = 8.05; z < 12; z += 0.1) if (surfaceAt(fills, { x, z }).length === 0) bare.push(`${x.toFixed(2)},${z.toFixed(2)}`);
    expect(bare).toEqual([]);
  });

  it("puts each fill first among the pieces of its surface", () => {
    const ground = [piece("water", box(0, 0, 1, 1)), piece("grass", box(1, 0, 2, 1)), piece("square", box(2, 0, 3, 1)), piece("road", box(3, 0, 4, 1))];
    const fills = [piece("square", box(5, 0, 6, 1)), piece("grass", box(6, 0, 7, 1))];
    expect(withFills(ground, fills).map((g) => g.outline[0])).toEqual([0, 6, 1, 5, 2, 3]);
  });
});
