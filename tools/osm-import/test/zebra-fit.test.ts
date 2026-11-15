import { describe, expect, it } from "vitest";
import { DISTRICTS } from "../src/config.ts";
import { generate } from "../src/generate.ts";
import { type Pt, pointInRing } from "../src/geometry.ts";
import { parseOsmXml } from "../src/osm.ts";
import { worldToGeo } from "../src/project.ts";

/**
 * A zebra square to its street and from kerb to kerb of the asphalt as laid (G-836): a street along
 * x, its footways mapped on their own, and a crossing node on it or a crossing way across it.
 */
type Way = { readonly tags: Record<string, string>; readonly pts: readonly [number, number][]; readonly nodeTags?: Readonly<Record<number, Record<string, string>>> };
const tagsXml = (tags: Record<string, string>) => Object.entries(tags).map(([k, v]) => `<tag k="${k}" v="${v}"/>`);
const map = (ways: readonly Way[]) => {
  const nodes: string[] = [];
  const out: string[] = [];
  let id = 1;
  ways.forEach((w, k) => {
    const refs = w.pts.map(([x, z], i) => {
      const g = worldToGeo({ x, z });
      nodes.push(` <node id="${id}" lat="${g.lat}" lon="${g.lon}">${tagsXml(w.nodeTags?.[i] ?? {}).join("")}</node>`);
      return id++;
    });
    out.push(` <way id="${100 + k}">${refs.map((r) => `<nd ref="${r}"/>`).join("")}${tagsXml(w.tags).join("")}</way>`);
  });
  return parseOsmXml(["<osm>", ...nodes, ...out, "</osm>"].join("\n"));
};
const chunk = [{ id: "test-0-0", district: DISTRICTS[0]!, rect: { minX: -50, minZ: -50, maxX: 150, maxZ: 150 } }];
/** Two lanes of 3.25 m, no width in the map: the import's estimate, widened to a footway mapped further out. */
const street: Way = { tags: { highway: "residential", lanes: "2", sidewalk: "separate" }, pts: [[0, 0], [100, 0]] };
const measured: Way = { ...street, tags: { ...street.tags, width: "6.5" } };
const footway = (z: number): Way => ({ tags: { highway: "footway" }, pts: [[0, z], [100, z]] });
const zebraWay = (pts: [number, number][]): Way => ({ tags: { highway: "footway", footway: "crossing", crossing: "zebra" }, pts });

const rings = (ways: readonly Way[], surface: string): Pt[][] =>
  generate(map(ways), () => 190, chunk, [])
    .chunks[0]!.ground.filter((g) => g.surface === surface)
    .map((g) => Array.from({ length: g.outline.length / 2 }, (_, i) => ({ x: g.outline[2 * i]!, z: g.outline[2 * i + 1]! })));
const zebraAt = (ways: readonly Way[], x: number, z: number) => rings(ways, "crossing").some((r) => pointInRing({ x, z }, r));
/** The zebra's reach across the street (z) and its sides' angle off the street's normal (degrees). */
const shape = (ring: readonly Pt[]) => {
  const zs = ring.map((p) => p.z);
  const skew = Math.max(
    ...ring.map((p, i) => {
      const q = ring[(i + 1) % ring.length]!;
      const [dx, dz] = [q.x - p.x, q.z - p.z];
      return Math.abs(dz) > 1 ? (Math.atan2(Math.abs(dx), Math.abs(dz)) * 180) / Math.PI : 0;
    }),
  );
  return { from: Math.min(...zs), to: Math.max(...zs), skew };
};

describe("a zebra from kerb to kerb, square to its street (G-836)", () => {
  it("lays a crossing way mapped askew and out to the footways as a rectangle across the asphalt only", () => {
    // The way runs 27 degrees off the normal from footway to footway, 6 m either side of the axis.
    const ways = [measured, footway(-6), footway(6), zebraWay([[47, -6], [53, 6]])];
    const zebras = rings(ways, "crossing");
    expect(zebras).toHaveLength(1);
    const s = shape(zebras[0]!);
    expect(s.skew).toBeLessThan(1);
    expect(s.from).toBeCloseTo(-3.25, 1);
    expect(s.to).toBeCloseTo(3.25, 1);
    // Round the way's crossing of the axis, none on the sidewalks laid up to the footways.
    expect(zebraAt(ways, 50, 0)).toBe(true);
    for (const [x, z] of [[47.5, -5], [52.5, 5], [50, -4], [50, 4]] as const) expect(zebraAt(ways, x, z), `${x},${z}`).toBe(false);
  });

  it("reaches a crossing node's zebra on to the widened kerb and not over its kerb stone", () => {
    // The asphalt widened to the footway, its kerb stone 4.45-4.85 m off the axis (G-803).
    const node: Way = { ...street, pts: [[0, 0], [50, 0], [100, 0]], nodeTags: { 1: { highway: "crossing", crossing: "zebra" } } };
    const zebras = rings([node, footway(-6)], "crossing");
    expect(zebras).toHaveLength(1);
    const s = shape(zebras[0]!);
    // 4.45 m to the chunk's rounding of 0.1 m.
    expect(s.from).toBeGreaterThanOrEqual(-4.55);
    expect(s.from).toBeLessThan(-4.35);
    expect(s.to).toBeCloseTo(3.25, 1);
  });

  it("gives a crossing way over a dual carriageway a zebra on each, none on the island between", () => {
    const north: Way = { ...measured, pts: [[0, 6], [100, 6]] };
    const south: Way = { ...measured, pts: [[0, -6], [100, -6]] };
    const ways = [north, south, zebraWay([[50, -11], [50, 11]])];
    const spans = rings(ways, "crossing").map((r) => shape(r)).sort((a, b) => a.from - b.from);
    expect(spans).toHaveLength(2);
    const want = [
      [-9.25, -2.75],
      [2.75, 9.25],
    ] as const;
    spans.forEach((s, i) => {
      expect(Math.abs(s.from - want[i]![0])).toBeLessThanOrEqual(0.1);
      expect(Math.abs(s.to - want[i]![1])).toBeLessThanOrEqual(0.1);
    });
  });
});
