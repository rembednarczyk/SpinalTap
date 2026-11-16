import { describe, expect, it } from "vitest";
import type { StreetPropItem } from "../../../packages/core/src/world/city-geo.ts";
import { bollardChains, chainSegments } from "../../../packages/sim/src/content/lublin/furniture.ts";
import { loadBollardLines } from "../src/furniture.ts";
import { LINE_GROUP, linePosts, withBollardLines } from "../src/props-bollard-lines.ts";
import type { PropsPlan } from "../src/props-gen.ts";
import { KRAKOWSKIE_CHUNKS } from "../../../packages/sim/src/content/lublin/krakowskie.generated.ts";
import { STARE_MIASTO_CHUNKS } from "../../../packages/sim/src/content/lublin/stare-miasto.generated.ts";
import { Site } from "../src/props-site.ts";
import { cityProps } from "./city.ts";

const posts = [...cityProps().byChunk.values()].flat().filter((i) => i.prop === "bollard");
const everywhere = () => true;

/** The posts within 0.8 m of a polyline. */
const along = (pts: readonly { x: number; z: number }[], of: readonly StreetPropItem[] = posts) =>
  of.filter((i) =>
    pts.slice(1).some((b, k) => {
      const a = pts[k]!;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const t = Math.max(0, Math.min(1, ((i.x - a.x) * dx + (i.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
      return Math.hypot(i.x - a.x - dx * t, i.z - a.z - dz * t) <= 0.8;
    }),
  );

describe("rows of bollards OSM maps as lines (G-818)", () => {
  it("lays a post at both ends of a line and evenly between, about 1.8 m apart", () => {
    const line = [
      { x: 0, z: 0 },
      { x: 10, z: 0 },
      { x: 10, z: 8 },
    ];
    const p = linePosts(line);
    expect(p).toHaveLength(11);
    expect(p[0]).toEqual({ x: 0, z: 0 });
    expect(p[10]).toEqual({ x: 10, z: 8 });
    for (let k = 1; k < p.length; k++) expect(Math.abs(p[k]!.x - p[k - 1]!.x) + Math.abs(p[k]!.z - p[k - 1]!.z)).toBeCloseTo(1.8, 5);
    // A line shorter than a step still has its two ends.
    expect(linePosts([line[0]!, { x: 1.9, z: 0 }])).toHaveLength(2);
  });

  it("turns the plan's point of a way into the way's posts, in its group; a way no group holds gets a group of its own", () => {
    const plan: PropsPlan = { items: [{ id: "g.bollard", kind: "bollard", points: [[0, -5], [9, 0], [20, 20]], osm: ["n1", "w7", "n2"], count: 3 }] };
    const lines = [
      { id: "w7", pts: [{ x: 0, z: 0 }, { x: 9, z: 0 }] },
      { id: "w8", pts: [{ x: 30, z: 0 }, { x: 30, z: 3.6 }] },
      { id: "w9", pts: [{ x: 5000, z: 0 }, { x: 5001, z: 0 }] },
    ];
    // A node 0.5 m off the line's first post (here the plan's n2 moved there) anchors the row in its place.
    const withNode: PropsPlan = { items: [{ ...plan.items[0]!, points: [[0, -5], [9, 0], [3.4, 0.3]] }] };
    const out = withBollardLines(withNode, lines, [], (p) => p.x < 1000);
    const g = out.items[0]!;
    expect(g.osm).toEqual(["n1", "w7#0", "w7#1", "w7#3", "w7#4", "w7#5", "n2"]);
    expect(g.points).toEqual([[0, -5], [0, 0], [1.8, 0], [5.4, 0], [7.2, 0], [9, 0], [3.4, 0.3]]);
    expect(g.count).toBe(7);
    const own = out.items.find((i) => i.id === LINE_GROUP)!;
    expect(own.points).toEqual([[30, 0], [30, 1.8], [30, 3.6]]);
    // No group and no change without lines.
    expect(withBollardLines(plan, [], [], everywhere)).toEqual(plan);
  });

  it("breaks a row where a way cars take crosses it, for the way's width and half a metre either side", () => {
    const plan: PropsPlan = { items: [] };
    const line = { id: "w1", pts: [{ x: 0, z: 0 }, { x: 18, z: 0 }] };
    const drive = { pts: [{ x: 9, z: -5 }, { x: 9, z: 5 }], width: 3.5 };
    const own = withBollardLines(plan, [line], [drive], everywhere).items[0]!;
    // Posts every 1.8 m, none within 2.25 m of x = 9.
    expect(own.points!.map((p) => p[0])).toEqual([0, 1.8, 3.6, 5.4, 12.6, 14.4, 16.2, 18]);
  });

  it("gives every line of the city its row: a post at least every 2.5 m along it, the rows chained", () => {
    const lines = loadBollardLines().filter((l) => l.id !== "w1134342877");
    expect(lines).toHaveLength(16);
    for (const l of lines) {
      const length = l.pts.slice(1).reduce((s, b, k) => s + Math.hypot(b.x - l.pts[k]!.x, b.z - l.pts[k]!.z), 0);
      expect(along(l.pts).length, l.id).toBeGreaterThanOrEqual(length / 2.5);
    }
    // Plac Łokietka before the Nowy Ratusz (w1514057822, w1514057825): one row on x ≈ 438-439 from z −45 to −113,
    // chained post to post, broken only at the zebra across Królewska (z ≈ −93…−96).
    const row = posts.filter((i) => i.x > 437 && i.x < 440 && i.z > -114 && i.z < -44).sort((a, b) => a.z - b.z);
    expect(row.length).toBeGreaterThanOrEqual(30);
    expect(row[0]!.z).toBeLessThan(-111);
    expect(row[row.length - 1]!.z).toBeGreaterThan(-46.5);
    const chained = row.filter((i) => bollardChains(i).length > 0);
    expect(chained.length).toBeGreaterThanOrEqual(row.length - 4);
    for (const i of row) for (const s of chainSegments(i)) expect(s.to.z > -96 && s.from.z < -93, `${i.x},${i.z}`).toBe(false);
  });

  it("stands a line's posts on the pavement by the kerb, not on the carriageway OSM's line runs over", () => {
    const site = new Site([...KRAKOWSKIE_CHUNKS, ...STARE_MIASTO_CHUNKS]);
    // Plac Łokietka's east row (w1514057823, x ≈ 446.2-446.5): OSM's line lies 0.3-0.4 m in the measured carriageway.
    const east = along(loadBollardLines().find((l) => l.id === "w1514057823")!.pts);
    expect(east.length).toBeGreaterThanOrEqual(11);
    expect(east.filter((i) => site.surfaceAt(i) === "road")).toEqual([]);
    const lines = loadBollardLines();
    const onRoad = lines.flatMap((l) => along(l.pts)).filter((i) => site.surfaceAt(i) === "road");
    expect(onRoad.length).toBeLessThanOrEqual(2);
  });
});
