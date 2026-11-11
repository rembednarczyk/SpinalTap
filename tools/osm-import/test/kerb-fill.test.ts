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
    out.push(` <way id="${100 + k}">${refs.map((r) => `<nd ref="${r}"/>`).join("")}${tagsXml(w.tags).join("")}</way>`);
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

  it("leaves a footway laid at the kerb as it is", () => {
    expect(build([street, footway(-4.5)]).ground.map((g) => g.surface).sort()).toEqual(["footway", "road"]);
  });
});

describe("a carriageway of estimated width reaches the paving (G-570)", () => {
  it("takes a gap of a metre and more for its own asphalt, with a kerb stone at the footway", () => {
    const ways = [street, footway(-6)];
    for (const x of [1, 30, 50, 99]) for (const z of [-3.4, -4, -4.3]) expect(surfacesAt(ways, x, z), `${x},${z}`).toEqual(["road"]);
    // The kerb stone over the footway's edge, 4.75 m off the axis: the renderer draws the kerb on it.
    expect(surfacesAt(ways, 50, -4.86).sort()).toEqual(["footway", "road", "sidewalk"]);
  });

  it("lays the asphalt widened as a piece of its own along the carriageway's piece, as the map lays that", () => {
    // A bend of many vertices, which the chunk simplifies: the edge not widened stays as it was (G-570).
    const pts = Array.from({ length: 41 }, (_, i): [number, number] => [i * 2.5, 6 * Math.sin((i * Math.PI) / 40)]);
    const bend: Way = { ...street, pts };
    const walk: Way = { tags: { highway: "footway" }, pts: pts.slice(8, 33).map(([x, z]) => [x, z - 6] as [number, number]) };
    const roads = (ways: Way[]) => build(ways).ground.filter((g) => g.surface === "road").map((g) => g.outline);
    const [own, ...widening] = roads([bend, walk]);
    expect(own).toEqual(roads([bend])[0]);
    expect(widening.length).toBeGreaterThan(0);
    // Across the kerb as the map lays it: one road piece at every point, neither a seam nor an overlap.
    const rings = roads([bend, walk]).map((o) => Array.from({ length: o.length / 2 }, (_, i) => ({ x: o[2 * i]!, z: o[2 * i + 1]! })));
    for (let x = 25; x <= 75; x += 0.7)
      for (let dz = -3.6; dz <= -2.9; dz += 0.05) {
        const z = 6 * Math.sin((x / 100) * Math.PI) + dz;
        expect(rings.filter((r) => pointInRing({ x, z }, r)), `${x.toFixed(1)},${z.toFixed(2)}`).toHaveLength(1);
      }
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
    expect(surfacesAt([zebra, footway(-6)], 50, -4)).toEqual(["road", "crossing"]);
    expect(surfacesAt([zebra, footway(-6)], 50, 3)).toEqual(["road", "crossing"]);
  });
});
