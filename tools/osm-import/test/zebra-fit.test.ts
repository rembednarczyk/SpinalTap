import { describe, expect, it } from "vitest";
import { DISTRICTS } from "../src/config.ts";
import { generate } from "../src/generate.ts";
import { type Pt, pointInRing } from "../src/geometry.ts";
import { parseOsmXml } from "../src/osm.ts";
import { worldToGeo } from "../src/project.ts";
import { fitZebras } from "../src/zebra-fit.ts";
import { generatedAround } from "./city.ts";

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

  it("stops short of a kerb stone laid over the asphalt's edge, where the kerb is drawn", () => {
    const road = { id: "w1", osmId: 1, tags: { highway: "residential" }, line: [{ x: 0, z: 0 }, { x: 100, z: 0 }] };
    const box = (z0: number, z1: number) => ({ ring: [{ x: 0, z: z0 }, { x: 100, z: z0 }, { x: 100, z: z1 }, { x: 0, z: z1 }], box: { minX: 0, maxX: 100, minZ: z0, maxZ: z1 } });
    const zebra = { surface: "crossing" as const, ring: [], bridge: false, source: "n1" };
    const [rings] = fitZebras([zebra], () => [{ at: { x: 50, z: 0 }, along: 3 }], [road], () => 0, [box(-5, 5)], [box(-5, -4.5)]);
    const s = shape(rings![0]!);
    expect(s.from).toBeCloseTo(-4.5, 1);
    expect(s.to).toBeCloseTo(5, 1);
  });

  it("ends where its side meets a sidewalk a little short of its middle, not where a mouth runs off metres short", () => {
    const road = { id: "w1", osmId: 1, tags: { highway: "residential" }, line: [{ x: 0, z: 0 }, { x: 100, z: 0 }] };
    const ring = (pts: [number, number][]) => ({ ring: pts.map(([x, z]) => ({ x, z })), box: { minX: Math.min(...pts.map((p) => p[0])), maxX: Math.max(...pts.map((p) => p[0])), minZ: Math.min(...pts.map((p) => p[1])), maxZ: Math.max(...pts.map((p) => p[1])) } });
    const zebra = { surface: "crossing" as const, ring: [], bridge: false, source: "n1" };
    // The kerb at z 4 runs askew: 4.6 m off the axis at x 48.5, 4 m at x 51.5; a sidewalk past it.
    const asphalt = [ring([[0, -4], [100, -4], [100, 4], [51.5, 4], [48.5, 4.6], [0, 4.6]])];
    const walk = [ring([[0, 4.6], [48.5, 4.6], [51.5, 4], [100, 4], [100, 8], [0, 8]])];
    const fit = (walks: typeof walk) => shape(fitZebras([zebra], () => [{ at: { x: 50, z: 0 }, along: 3 }], [road], () => 0, asphalt, [], walks)[0]![0]!);
    expect(fit(walk).to).toBeCloseTo(4, 1);
    // Off a sidewalk (a mouth's ground, or nothing): to the kerb on its middle.
    expect(fit([]).to).toBeCloseTo(4.3, 1);
  });

  it("bridges the seam where two ways' bands end at the crossing node, under the zebra's middle", () => {
    const road = { id: "w1", osmId: 1, tags: { highway: "residential" }, line: [{ x: 0, z: 0 }, { x: 100, z: 0 }] };
    const box = (x0: number, x1: number, z0: number, z1: number) => ({ ring: [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }], box: { minX: x0, maxX: x1, minZ: z0, maxZ: z1 } });
    const zebra = { surface: "crossing" as const, ring: [], bridge: false, source: "n1" };
    // The two bands 0.1 m apart at the node, their ends square.
    const [rings] = fitZebras([zebra], () => [{ at: { x: 50, z: 0 }, along: 3 }], [road], () => 0, [box(0, 49.95, -4, 4), box(50.05, 100, -4, 4)], []);
    const s = shape(rings![0]!);
    expect(s.from).toBeCloseTo(-4, 1);
    expect(s.to).toBeCloseTo(4, 1);
  });

  it("keeps a zebra square to a street whose ways meet in line at it, whatever the path's angle, and lays a junction's along its path", () => {
    const way = (id: number, pts: [number, number][]) => ({ id: `w${id}`, osmId: id, tags: { highway: "residential" }, line: pts.map(([x, z]) => ({ x, z })) });
    const asphalt = [{ ring: [{ x: 0, z: -4 }, { x: 100, z: -4 }, { x: 100, z: 4 }, { x: 0, z: 4 }], box: { minX: 0, maxX: 100, minZ: -4, maxZ: 4 } }];
    const zebra = { surface: "crossing" as const, ring: [], bridge: false, source: "n1" };
    // A path 30 degrees off the normal.
    const path = { x: Math.sin(Math.PI / 6), z: Math.cos(Math.PI / 6) };
    // The angle of the zebra's long side (across the street) off the street's normal.
    const fit = (roads: ReturnType<typeof way>[]) => {
      const r = fitZebras([zebra], () => [{ at: { x: 50, z: 0 }, along: 3, path }], roads, () => 0, asphalt, [])[0]![0]!;
      const [a, b] = [r[1]!, r[2]!];
      return (Math.atan2(Math.abs(b.x - a.x), Math.abs(b.z - a.z)) * 180) / Math.PI;
    };
    expect(fit([way(1, [[0, 0], [50, 0]]), way(2, [[50, 0], [100, 0]])])).toBeLessThan(1);
    // A side street leaving at the node: a junction.
    expect(fit([way(1, [[0, 0], [100, 0]]), way(3, [[50, 0], [80, 40]])])).toBeCloseTo(30, 0);
    // A drive leaving there: no junction (G-836 round 3, the curator's (621,-218)).
    const drive = { ...way(3, [[50, 0], [80, 40]]), tags: { highway: "service", service: "driveway" } };
    expect(fit([way(1, [[0, 0], [100, 0]]), drive])).toBeLessThan(1);
    // A crossing way (`footway=crossing`) at the junction: square to its street, whatever the way's angle.
    const r = fitZebras([zebra], () => [{ at: { x: 50, z: 0 }, along: 3, path, way: true }], [way(1, [[0, 0], [100, 0]]), way(3, [[50, 0], [80, 40]])], () => 0, asphalt, [])[0]![0]!;
    expect(Math.abs(r[2]!.x - r[1]!.x)).toBeLessThan(0.01);
  });
});

describe("the city's zebras where the map draws a crossing way askew or a drive at a crossing (G-836, round 3)", () => {
  /** The zebras of the city's chunks round `points`: their middle and their long side's angle (degrees, from -z toward +x, mod 180). */
  const zebras = (points: readonly Pt[]) =>
    generatedAround(points).chunks.flatMap((c) =>
      c.ground
        .filter((g) => g.surface === "crossing")
        .map((g) => {
          const r = Array.from({ length: g.outline.length / 2 }, (_, i) => ({ x: g.outline[2 * i]!, z: g.outline[2 * i + 1]! }));
          const sides = r.map((a, i) => ({ a, b: r[(i + 1) % r.length]! }));
          const { a, b } = sides.reduce((p, q) => (Math.hypot(q.b.x - q.a.x, q.b.z - q.a.z) > Math.hypot(p.b.x - p.a.x, p.b.z - p.a.z) ? q : p));
          const angle = ((((Math.atan2(b.x - a.x, -(b.z - a.z)) * 180) / Math.PI) % 180) + 180) % 180;
          return { x: r.reduce((s, p) => s + p.x, 0) / r.length, z: r.reduce((s, p) => s + p.z, 0) / r.length, angle };
        }),
    );
  const near = (all: ReturnType<typeof zebras>, x: number, z: number) => all.filter((q) => Math.hypot(q.x - x, q.z - z) < 3);
  const off = (a: number, b: number) => Math.min(Math.abs(a - b), 180 - Math.abs(a - b));

  it("lays a crossing way's zebra square to its street, a drive at its end no junction, and a junction's node along its path", () => {
    const all = zebras([{ x: 620.5, z: -217.2 }, { x: 2361.1, z: 432.2 }, { x: 913.3, z: 345.9 }]);
    // w305027462 over Podwale (w40052391, 114 degrees), drawn 12 degrees askew, a drive (w179269926) leaving
    // Podwale under it; on the orthophoto square to Podwale within about a degree, its middle at (620.6, -220.5)
    // along the street (across it, the game's Podwale is narrowed about its axis: T-063).
    const f4 = near(all, 620.5, -217.2);
    expect(f4).toHaveLength(1);
    expect(off(f4[0]!.angle, 114 - 90)).toBeLessThan(5);
    const street = { x: Math.sin((114 * Math.PI) / 180), z: -Math.cos((114 * Math.PI) / 180) };
    expect(Math.abs((f4[0]!.x - 620.6) * street.x + (f4[0]!.z + 220.5) * street.z)).toBeLessThan(1.5);
    // The junctions' nodes with a foot path through them stay along it: n4087364975 and n4586176953.
    for (const [x, z, angle] of [[2361.1, 432.2, 175.8], [913.3, 345.9, 83]] as const) {
      const at = near(all, x, z);
      expect(at, `${x},${z}`).toHaveLength(1);
      expect(off(at[0]!.angle, angle), `${x},${z}`).toBeLessThan(1);
    }
  });
});
