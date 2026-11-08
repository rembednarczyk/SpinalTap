import { describe, expect, it } from "vitest";
import { DISTRICTS } from "../src/config.ts";
import { generate } from "../src/generate.ts";
import { pointInRing } from "../src/geometry.ts";
import { parseOsmXml } from "../src/osm.ts";
import { worldToGeo } from "../src/project.ts";

/**
 * A pavement reaches the kerb (G-522): a street of two lanes along x (6.5 m of asphalt, its
 * sidewalks mapped on their own) and a footway beside it, as on 3 Maja by Krakowskie
 * Przedmieście, where 1–3 m of bare terrain lay between them.
 */
type Way = { readonly tags: Record<string, string>; readonly pts: readonly [number, number][]; readonly closed?: boolean };
const map = (...ways: Way[]) => {
  const nodes: string[] = [];
  const out: string[] = [];
  let id = 1;
  ways.forEach((w, k) => {
    const refs = w.pts.map(([x, z]) => {
      const g = worldToGeo({ x, z });
      nodes.push(` <node id="${id}" lat="${g.lat}" lon="${g.lon}"/>`);
      return id++;
    });
    if (w.closed) refs.push(refs[0]!);
    const tags = Object.entries(w.tags).map(([k, v]) => `<tag k="${k}" v="${v}"/>`);
    out.push(` <way id="${100 + k}">${refs.map((r) => `<nd ref="${r}"/>`).join("")}${tags.join("")}</way>`);
  });
  return parseOsmXml(["<osm>", ...nodes, ...out, "</osm>"].join("\n"));
};
const chunk = [{ id: "test-0-0", district: DISTRICTS[0]!, rect: { minX: -50, minZ: -50, maxX: 150, maxZ: 150 } }];
const flat = () => 190;
const street: Way = { tags: { highway: "residential", lanes: "2", sidewalk: "separate" }, pts: [[0, 0], [100, 0]] };
const footway = (z0: number, z1 = z0): Way => ({ tags: { highway: "footway" }, pts: [[0, z0], [100, z1]] });

/** The surfaces of the chunk's ground at (x, z), drawn last on top. */
const surfacesAt = (ways: Way[], x: number, z: number): string[] =>
  generate(map(...ways), flat, chunk)
    .chunks[0]!.ground.filter((g) => {
      const ring = [];
      for (let i = 0; i + 1 < g.outline.length; i += 2) ring.push({ x: g.outline[i]!, z: g.outline[i + 1]! });
      return pointInRing({ x, z }, ring);
    })
    .map((g) => g.surface);

describe("a pavement reaches the kerb (G-522)", () => {
  it("lays a sidewalk over the bare strip between a carriageway and the footway along it", () => {
    // The asphalt ends 3.25 m off the axis, the footway (2.5 m) starts 4.75 m off it.
    const ways = [street, footway(-6)];
    for (const x of [1, 30, 50, 99]) for (const z of [-3.4, -4, -4.6]) expect(surfacesAt(ways, x, z), `${x},${z}`).toEqual(["sidewalk"]);
  });

  it("lays one over a wedge where the footway wanders off the axis, as far as the gap is narrow", () => {
    // 1.5 m off the asphalt at x = 0, 4 m at x = 100: paved to about x = 60.
    const ways = [street, footway(6, 8.5)];
    expect(surfacesAt(ways, 10, 4)).toEqual(["sidewalk"]);
    expect(surfacesAt(ways, 50, 4.5)).toEqual(["sidewalk"]);
    expect(surfacesAt(ways, 90, 4.5)).toEqual([]);
  });

  it("leaves a lawn, a building or another carriageway in the strip, a wide verge and a side with no paving as they are", () => {
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
    const ground = generate(map(street, footway(-4.5)), flat, chunk).chunks[0]!.ground;
    expect(ground.map((g) => g.surface).sort()).toEqual(["footway", "road"]);
  });
});
