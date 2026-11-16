import { describe, expect, it } from "vitest";
import { DISTRICTS } from "../src/config.ts";
import { generate } from "../src/generate.ts";
import { pointInRing } from "../src/geometry.ts";
import { parseOsmXml } from "../src/osm.ts";
import { worldToGeo } from "../src/project.ts";

/**
 * A pavement reaches the kerb (G-522): a street of two lanes along x (6.5 m of asphalt, its
 * sidewalks mapped on their own) and a footway beside it, as on 3 Maja by Krakowskie
 * Przedmieście, where 1–3 m of bare terrain lay between them. Where the map gives the street no
 * width, a gap of a metre and more is its own asphalt the estimate left out: parking lanes, a bus
 * bay (G-570, T-247).
 */
type Way = {
  readonly tags: Record<string, string>;
  readonly pts: readonly [number, number][];
  readonly closed?: boolean;
  /** Tags of the way's nodes, by their index. */
  readonly nodeTags?: Readonly<Record<number, Record<string, string>>>;
  /** The way's OSM id, for one the import's tables know (by default 100 on in the map's order). */
  readonly id?: number;
};
const tagsXml = (tags: Record<string, string>) => Object.entries(tags).map(([k, v]) => `<tag k="${k}" v="${v}"/>`);
const map = (...ways: Way[]) => {
  const nodes: string[] = [];
  const out: string[] = [];
  let id = 1;
  ways.forEach((w, k) => {
    const refs = w.pts.map(([x, z], i) => {
      const g = worldToGeo({ x, z });
      nodes.push(` <node id="${id}" lat="${g.lat}" lon="${g.lon}">${tagsXml(w.nodeTags?.[i] ?? {}).join("")}</node>`);
      return id++;
    });
    if (w.closed) refs.push(refs[0]!);
    out.push(` <way id="${w.id ?? 100 + k}">${refs.map((r) => `<nd ref="${r}"/>`).join("")}${tagsXml(w.tags).join("")}</way>`);
  });
  return parseOsmXml(["<osm>", ...nodes, ...out, "</osm>"].join("\n"));
};
const chunk = [{ id: "test-0-0", district: DISTRICTS[0]!, rect: { minX: -50, minZ: -50, maxX: 150, maxZ: 150 } }];
const flat = () => 190;
/** Two lanes of 3.25 m, no width in the map: the import's estimate. */
const street: Way = { tags: { highway: "residential", lanes: "2", sidewalk: "separate" }, pts: [[0, 0], [100, 0]] };
/** The same street measured 6.5 m wide. */
const measured: Way = { ...street, tags: { ...street.tags, width: "6.5" } };
const footway = (z0: number, z1 = z0): Way => ({ tags: { highway: "footway" }, pts: [[0, z0], [100, z1]] });
const build = (ways: Way[]) => generate(map(...ways), flat, chunk, []).chunks[0]!;

/** The surfaces of the chunk's ground at (x, z), in draw order. */
const surfacesAt = (ways: Way[], x: number, z: number): string[] =>
  build(ways)
    .ground.filter((g) => {
      const ring = [];
      for (let i = 0; i + 1 < g.outline.length; i += 2) ring.push({ x: g.outline[i]!, z: g.outline[i + 1]! });
      return pointInRing({ x, z }, ring);
    })
    .map((g) => g.surface);

describe("a pavement reaches the kerb (G-522)", () => {
  it("lays a sidewalk over the bare strip between a carriageway of measured width and the footway along it", () => {
    // The asphalt ends 3.25 m off the axis, the footway (2.5 m) starts 4.75 m off it.
    const ways = [measured, footway(-6)];
    for (const x of [1, 30, 50, 99]) for (const z of [-3.4, -4, -4.6]) expect(surfacesAt(ways, x, z), `${x},${z}`).toEqual(["sidewalk"]);
  });

  it("lays one over a wedge where the footway wanders off the axis, as far as the gap is narrow", () => {
    // 1.5 m off the asphalt at x = 0, 4 m at x = 100: paved to about x = 60.
    const ways = [measured, footway(6, 8.5)];
    expect(surfacesAt(ways, 10, 4)).toEqual(["sidewalk"]);
    expect(surfacesAt(ways, 50, 4.5)).toEqual(["sidewalk"]);
    expect(surfacesAt(ways, 90, 4.5)).toEqual([]);
  });

  it("leaves a lawn, a building or a car park in the strip, a wide verge and a side with no paving as they are", () => {
    const lawn: Way = { tags: { landuse: "grass" }, pts: [[20, -3.25], [80, -3.25], [80, -4.75], [20, -4.75]], closed: true };
    expect(surfacesAt([street, footway(-6), lawn], 50, -4)).toEqual(["grass"]);
    const shed: Way = { tags: { building: "yes" }, pts: [[40, -3.5], [60, -3.5], [60, -4.5], [40, -4.5]], closed: true };
    expect(surfacesAt([street, footway(-6), shed], 50, -4)).toEqual([]);
    const bays: Way = { tags: { amenity: "parking" }, pts: [[20, -3.25], [80, -3.25], [80, -4.75], [20, -4.75]], closed: true };
    expect(surfacesAt([street, footway(-6), bays], 50, -4)).toEqual(["road"]);
    expect(surfacesAt([street, footway(-9)], 50, -5)).toEqual([]);
    expect(surfacesAt([street, footway(-6)], 50, 4)).toEqual([]);
  });

  it("lays one over a seam narrower than its step out, and none where the footway reaches the kerb (G-811)", () => {
    // The footway's edge 0.05 m off the asphalt's, as a kerb measured on the orthophoto leaves it by the map's paving.
    expect(surfacesAt([measured, footway(-4.55)], 50, -3.28)).toEqual(["sidewalk"]);
    expect(surfacesAt([measured, footway(-4.45)], 50, -3.28)).toEqual(["footway"]);
  });

  it("lays one beside and under a zebra the map draws on past the kerb, which ends at the kerb (G-811, G-836)", () => {
    const zebra: Way = { tags: { highway: "footway", footway: "crossing", crossing: "zebra" }, pts: [[50, -6], [50, 6]] };
    const ways = [measured, footway(-6), zebra];
    expect(surfacesAt(ways, 50, -3)).toEqual(["crossing"]);
    for (const x of [48.3, 50, 51.7]) expect(surfacesAt(ways, x, -4), `${x}`).toEqual(["sidewalk"]);
  });

  it("leaves a footway laid at the kerb as it is", () => {
    expect(build([street, footway(-4.5)]).ground.map((g) => g.surface).sort()).toEqual(["footway", "road"]);
  });
});

describe("a carriageway of estimated width reaches the paving (G-570)", () => {
  it("takes a gap of a metre and more for its own asphalt, with a kerb stone at the footway", () => {
    const ways = [street, footway(-6)];
    for (const x of [1, 30, 50, 99]) for (const z of [-3.4, -4, -4.3]) expect(surfacesAt(ways, x, z), `${x},${z}`).toEqual(["road"]);
    // The kerb stone on the asphalt's side of the footway's edge (4.75 m off the axis), from 4.45 m
    // to 0.1 m past the asphalt's edge (4.85 m), ranked over the asphalt that reaches under it (G-803):
    // the renderer draws the kerb where the stone starts, as before the partition (ADR-0078 step 3).
    expect(surfacesAt(ways, 50, -4.6)).toEqual(["sidewalk"]);
    expect(surfacesAt(ways, 50, -4.9)).toEqual(["sidewalk"]);
    expect(surfacesAt(ways, 50, -5.2)).toEqual(["footway"]);
  });

  it("lays the kerb 0.3 m short of the footway's mapped edge all along it, as the orthophoto shows it (G-803)", () => {
    // The footway's edge wanders from 4.75 to 5.35 m off the axis; the orthophoto puts the kerb 0.25–0.5 m
    // short of the mapped edge (T-294). The kerb is where the asphalt ends: no step in or out along it.
    const chunk = build([street, footway(-6, -6.6)]);
    const rings = chunk.ground.filter((g) => g.surface === "road").map((g) => Array.from({ length: g.outline.length / 2 }, (_, i) => ({ x: g.outline[2 * i]!, z: g.outline[2 * i + 1]! })));
    for (let x = 2; x <= 98; x += 0.5) {
      let z = -3;
      while (z > -7 && rings.some((r) => pointInRing({ x, z: z - 0.01 }, r))) z -= 0.01;
      const edge = 4.75 + (0.6 * x) / 100;
      // To the chunk's rounding of 0.1 m and the stone's simplifying (`SIMPLIFY`).
      expect(Math.abs(-z - (edge - 0.3)), `x ${x}: ${(-z).toFixed(2)}`).toBeLessThanOrEqual(0.08);
    }
  });

  it("lays the asphalt widened as a piece of its own along the carriageway's piece, as the map lays that", () => {
    // A bend of many vertices, which the chunk simplifies: the edge not widened stays as it was (G-570).
    const pts = Array.from({ length: 41 }, (_, i): [number, number] => [i * 2.5, 6 * Math.sin((i * Math.PI) / 40)]);
    const bend: Way = { ...street, pts };
    const walk: Way = { tags: { highway: "footway" }, pts: pts.slice(8, 33).map(([x, z]) => [x, z - 6] as [number, number]) };
    const roads = (ways: Way[]) => build(ways).ground.filter((g) => g.surface === "road").map((g) => g.outline);
    const [own, ...widening] = roads([bend, walk]);
    // The carriageway's own piece as without the footway, but where the widening's piece, ranked over it
    // in the partition (the smaller of one surface, ADR-0078 step 3), takes a speck of its corner at either end.
    const area = (o: readonly number[]) => Math.abs(o.reduce((a, _, i) => (i % 2 === 0 ? a + o[i]! * o[(i + 3) % o.length]! - o[(i + 2) % o.length]! * o[i + 1]! : a), 0)) / 2;
    expect(area(own!)).toBeCloseTo(area(roads([bend])[0]!), 1);
    expect(widening.length).toBeGreaterThan(0);
    // Across the kerb as the map lays it: one road piece at every point, neither a seam nor an overlap.
    const rings = roads([bend, walk]).map((o) => Array.from({ length: o.length / 2 }, (_, i) => ({ x: o[2 * i]!, z: o[2 * i + 1]! })));
    for (let x = 25; x <= 75; x += 0.7)
      for (let dz = -3.6; dz <= -2.9; dz += 0.05) {
        const z = 6 * Math.sin((x / 100) * Math.PI) + dz;
        expect(rings.filter((r) => pointInRing({ x, z }, r)), `${x.toFixed(1)},${z.toFixed(2)}`).toHaveLength(1);
      }
  });

  it("steps out a kerb's width short of a lawn's line by its end, not past the lawn's corner (G-897)", () => {
    // The footway (2.5 m) from x 38 on, 1.75 m off the asphalt; up to x 40 a lawn between it and the
    // asphalt, 1 m off the edge. The asphalt stepped out 1.5 m at x 40.5, past the lawn's corner by
    // its side: it steps out 0.5 m, a kerb's width short of the lawn's line.
    const walk: Way = { tags: { highway: "footway" }, pts: [[38, -6.25], [100, -6.25]] };
    const lawn = (near: number): Way => ({ tags: { landuse: "grass" }, pts: [[10, -near], [40, -near], [40, -4.9], [10, -4.9]], closed: true });
    expect(surfacesAt([street, walk, lawn(4.25)], 40.6, -4.2)).toEqual([]);
    expect(surfacesAt([street, walk, lawn(4.25)], 40.6, -3.5)).toEqual(["road"]);
    // A lawn at the kerb itself, or level with the paving, has no corner by the step: as before.
    expect(surfacesAt([street, walk, lawn(3.55)], 40.6, -4.2)).toEqual(["road"]);
    expect(surfacesAt([street, walk, lawn(4.75)], 40.6, -4.2)).toEqual(["road"]);
  });

  it("lays a narrower gap as a sidewalk", () => {
    // The footway starts 3.95 m off the axis: 0.7 m of gap.
    expect(surfacesAt([street, footway(-5.2)], 50, -3.6)).toEqual(["sidewalk"]);
  });

  it("keeps the street's lanes and markings and reaches its zebra on to the new kerb", () => {
    const zebra: Way = { ...street, pts: [[0, 0], [50, 0], [100, 0]], nodeTags: { 1: { highway: "crossing", crossing: "zebra" } } };
    const bare = build([zebra]);
    const wide = build([zebra, footway(-6)]);
    expect(wide.streets).toEqual(bare.streets);
    expect(wide.markings).toEqual(bare.markings);
    expect(surfacesAt([zebra], 50, -4)).toEqual([]);
    // The zebra a piece of the carriageway of its own, the asphalt cut under it (ADR-0078 step 3).
    expect(surfacesAt([zebra, footway(-6)], 50, -4)).toEqual(["crossing"]);
    expect(surfacesAt([zebra, footway(-6)], 50, 3)).toEqual(["crossing"]);
  });
});

describe("a carriageway measured on the orthophoto on one side (ADR-0080 PR 10)", () => {
  it("widens the side left at the estimate to the paving, as one of estimated width, and lays the measured side's gap as a sidewalk (G-811)", () => {
    // w107667221 of the generated table: measured on its left only, 2.65 m of asphalt left of the axis
    // and 3.25 m right of it, the estimate's half of two lanes; its carriageway 5.9 m wide, 0.3 m right of the axis.
    const ortho: Way = { ...street, id: 107667221 };
    const ways = [ortho, footway(-6), footway(6)];
    for (const x of [30, 50, 70]) for (const z of [-3.4, -4, -4.3]) expect(surfacesAt(ways, x, z), `${x},${z}`).toEqual(["road"]);
    for (const x of [30, 50, 70]) for (const z of [2.8, 4, 4.6]) expect(surfacesAt(ways, x, z), `${x},${z}`).toEqual(["sidewalk"]);
  });
});
