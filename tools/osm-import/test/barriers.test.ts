import { describe, expect, it } from "vitest";
import { BARRIER_HEIGHT, RUIN_WALL_HEIGHT, barrierHeight, barrierKind, chunkBarriers, worldBarriers } from "../src/barriers.ts";
import { EDGE_MARGIN } from "../src/barrier-edges.ts";
import { roadWidth } from "../src/ground.ts";
import { type Area, type Line } from "../src/features.ts";
import { SKIPPED, knownKind, propOf } from "../src/props-kinds.ts";
import { type OsmData, type OsmNode, type OsmWay } from "../src/osm.ts";
import { geoToWorld, worldToGeo } from "../src/project.ts";

type P = [number, number];

/** A map of ways drawn in world metres: their nodes at the points' geographic places, ids from 1 per way. */
const mapOf = (ways: { id: number; tags: Record<string, string>; pts: P[]; nodeTags?: Record<number, Record<string, string>> }[]) => {
  const nodes = new Map<number, OsmNode>();
  const osmWays = new Map<number, OsmWay>();
  const lines: Line[] = [];
  for (const w of ways) {
    const ids = w.pts.map((p, k) => {
      const id = w.id * 100 + k;
      const g = worldToGeo({ x: p[0], z: p[1] });
      const tags = w.nodeTags?.[k];
      nodes.set(id, { id, lat: g.lat, lon: g.lon, ...(tags ? { tags } : {}) });
      return id;
    });
    osmWays.set(w.id, { id: w.id, nodes: ids, tags: w.tags });
    // The points as the import reads them back: through the projection both ways.
    lines.push({ id: `w${w.id}`, osmId: w.id, tags: w.tags, line: ids.map((id) => geoToWorld(nodes.get(id)!.lat, nodes.get(id)!.lon)) });
  }
  const data: OsmData = { nodes, ways: osmWays, relations: new Map() };
  return { data, lines };
};

const fence = { id: 1, tags: { barrier: "fence" }, pts: [[0, 0], [20, 0]] as P[] };
const cutsNone = { buildings: [], bands: [], lines: [] };

/** Lengths of a barrier's pieces along x, rounded to 0.1 m. */
const spans = (out: ReturnType<typeof worldBarriers>) => out.map((b) => [Math.round(b.line[0]!.x * 10) / 10, Math.round(b.line[b.line.length - 1]!.x * 10) / 10]);

describe("barriers of the map (ADR-0077 point 4)", () => {
  it("take the kind's default height without a tag, the tag's within reason", () => {
    expect(barrierKind({ barrier: "retaining_wall" })).toBe("retaining-wall");
    expect(barrierKind({ barrier: "wall", wall: "city_wall" })).toBe("city-wall");
    expect(barrierKind({ barrier: "bollard" })).toBeNull();
    expect(barrierHeight({}, "wall")).toBe(1);
    expect(barrierHeight({}, "city-wall")).toBe(2);
    expect(barrierHeight({}, "fence")).toBe(1.6);
    expect(barrierHeight({}, "hedge")).toBe(1.2);
    expect(barrierHeight({ height: "2.35 m" }, "fence")).toBe(2.4);
    expect(barrierHeight({ height: "40" }, "wall")).toBe(BARRIER_HEIGHT.wall);
  });

  it("lay a fence whole, with its kind, height and fence type", () => {
    const { data, lines } = mapOf([{ ...fence, tags: { barrier: "fence", fence_type: "chain_link", height: "2" } }]);
    const out = worldBarriers(data, lines, [], cutsNone);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "w1", kind: "fence", height: 2, material: "chain_link" });
    expect(spans(out)).toEqual([[0, 20]]);
  });

  it("cut a barrier where it runs through a building, over a carriageway or over steps", () => {
    const { data, lines } = mapOf([fence]);
    const box = (x0: number, x1: number) => [
      { x: x0, z: -2 },
      { x: x1, z: -2 },
      { x: x1, z: 2 },
      { x: x0, z: 2 },
    ];
    const out = worldBarriers(data, lines, [], { buildings: [{ ring: box(4, 6) }], bands: [{ ring: box(10, 12), surface: "road", carriageway: true }, { ring: box(15, 16), surface: "steps" }], lines: [] });
    const s = spans(out);
    expect(s).toHaveLength(4);
    expect(s[0]![1]).toBeLessThanOrEqual(4);
    expect(s[1]![0]).toBeGreaterThanOrEqual(6);
    expect(s[1]![1]).toBeLessThanOrEqual(10);
    expect(s[2]![0]).toBeGreaterThanOrEqual(12);
    // A car park's paving does not cut it: a fence round a car park stands on it.
    expect(worldBarriers(data, lines, [], { buildings: [], bands: [{ ring: box(10, 12), surface: "road" }], lines: [] })).toHaveLength(1);
  });

  it("open a barrier as wide as a way crossing it, not for a way along it", () => {
    const path = { id: 2, tags: { highway: "footway" }, pts: [[8, -5], [8, 5]] as P[] };
    const along = { id: 3, tags: { highway: "footway" }, pts: [[1, 0.0], [19, 0.0]] as P[] };
    const { data, lines } = mapOf([fence, path, along]);
    const s = spans(worldBarriers(data, lines, [], { buildings: [], bands: [], lines }));
    expect(s).toHaveLength(2);
    // The footway is 2.5 m wide, the opening 0.4 m wider: 1.45 m either side of its axis.
    expect(s[0]![1]).toBeGreaterThan(6.3);
    expect(s[0]![1]).toBeLessThanOrEqual(6.6);
    expect(s[1]![0]).toBeGreaterThanOrEqual(9.4);
  });

  it("open a gate in a barrier and draw it as an opening with posts", () => {
    const { data, lines } = mapOf([{ ...fence, pts: [[0, 0], [10, 0], [20, 0]], nodeTags: { 1: { barrier: "gate", width: "3" } } }]);
    const out = worldBarriers(data, lines, [], cutsNone);
    const gate = out.find((b) => b.kind === "gate")!;
    expect(gate.id).toBe("n101");
    expect(gate.line[0]!.x).toBeCloseTo(8.5, 1);
    expect(gate.line[1]!.x).toBeCloseTo(11.5, 1);
    // The fence ends at the posts, within a step of its cuts.
    const [west, east] = spans(out.filter((b) => b.kind === "fence"));
    expect(west![1]).toBeLessThanOrEqual(8.5);
    expect(west![1]).toBeGreaterThanOrEqual(8.2);
    expect(east![0]).toBeGreaterThanOrEqual(11.5);
    expect(east![0]).toBeLessThanOrEqual(11.8);
  });

  it("draw a lift gate on a road across it, its posts at the carriageway's edges", () => {
    const road = { id: 4, tags: { highway: "service" }, pts: [[0, 0], [0, 10], [0, 20]] as P[], nodeTags: { 1: { barrier: "lift_gate" } } };
    const { data, lines } = mapOf([road]);
    const out = worldBarriers(data, lines, [], { buildings: [], bands: [], lines });
    expect(out).toHaveLength(1);
    expect(out[0]!.kind).toBe("lift-gate");
    expect(Math.abs(out[0]!.line[0]!.x - out[0]!.line[1]!.x)).toBeGreaterThan(3);
    expect(out[0]!.line[0]!.z).toBeCloseTo(10, 1);
  });

  it("move a barrier running along a carriageway or a flight out of its band to its edge, cut one crossing it (G-607, G-608)", () => {
    // A residential street on z = 0, a fence along it 2 m off its axis: inside the band.
    const road = { id: 7, tags: { highway: "residential" }, pts: [[-10, 0], [30, 0]] as P[] };
    const along = { id: 8, tags: { barrier: "fence" }, pts: [[0, 2], [20, 2]] as P[] };
    const { data, lines } = mapOf([road, along]);
    const w = roadWidth({ highway: "residential" }) / 2;
    const band = { ring: [{ x: -10, z: -w }, { x: 30, z: -w }, { x: 30, z: w }, { x: -10, z: w }], surface: "road", carriageway: true as const };
    const out = worldBarriers(data, lines, [], { buildings: [], bands: [band], lines });
    expect(out).toHaveLength(1);
    expect(spans(out)).toEqual([[0, 20]]);
    for (const p of out[0]!.line) expect(p.z).toBeCloseTo(roadWidth({ highway: "residential" }) / 2 + 0.06 + EDGE_MARGIN, 2);
    // A wall across the street is cut where it crosses the band, not moved.
    const across = mapOf([road, { id: 9, tags: { barrier: "wall" }, pts: [[5, -10], [5, 10]] as P[] }]);
    const cut = worldBarriers(across.data, across.lines, [], { buildings: [], bands: [band], lines: across.lines });
    expect(cut).toHaveLength(2);
    expect(cut.every((b) => b.line.every((p) => Math.abs(p.x - 5) < 1e-6))).toBe(true);
  });

  it("lay the walls of a ruin's outline low: the Fara's foundations (G-605)", () => {
    const fara: Area = { id: "w5", osmId: 5, tags: { historic: "ruins" }, ring: [{ x: -1, z: -1 }, { x: 30, z: -1 }, { x: 30, z: 10 }, { x: -1, z: 10 }], holes: 0 };
    const { data, lines } = mapOf([{ id: 6, tags: { barrier: "wall" }, pts: [[0, 0], [20, 0]] as P[] }, { id: 7, tags: { barrier: "wall", height: "1.2" }, pts: [[0, 5], [20, 5]] as P[] }]);
    const out = worldBarriers(data, lines, [fara], cutsNone);
    expect(out.map((b) => b.height)).toEqual([RUIN_WALL_HEIGHT, 1.2]);
    expect(worldBarriers(data, lines, [], cutsNone).map((b) => b.height)).toEqual([1, 1.2]);
  });

  it("leave out a ring of walls lining a stream's channel", () => {
    const ring = { id: 5, tags: { barrier: "wall" }, pts: [[0, 0], [8, 0], [8, 50], [0, 50], [0, 0]] as P[] };
    const stream = { id: 6, tags: { waterway: "stream" }, pts: [[4, -10], [4, 60]] as P[] };
    const { data, lines } = mapOf([ring, stream]);
    expect(worldBarriers(data, lines, [], { buildings: [], bands: [], lines })).toEqual([]);
    expect(worldBarriers(data, lines.slice(0, 1), [], cutsNone)).toHaveLength(1);
    // A stream in a culvert under a fenced yard leaves the fence.
    const covered = mapOf([ring, { ...stream, tags: { waterway: "stream", tunnel: "culvert" } }]);
    expect(worldBarriers(covered.data, covered.lines, [], { buildings: [], bands: [], lines: covered.lines })).toHaveLength(1);
  });

  it("leave the plan's hedges to the barriers: no rows of shrubs along them in osm:props", () => {
    expect(propOf("hedge")).toBeNull();
    expect(knownKind("hedge")).toBe(true);
    expect(SKIPPED.hedge).toContain("ADR-0077");
  });

  it("take a closed area's barrier as its outline, and clip a barrier to the chunks, an opening whole by its centre", () => {
    const yard: Area = { id: "w9", osmId: 9, tags: { landuse: "grass", barrier: "hedge" }, ring: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }, { x: 0, z: 10 }], holes: 0 };
    const out = worldBarriers({ nodes: new Map(), ways: new Map(), relations: new Map() }, [], [yard], cutsNone);
    expect(out).toHaveLength(1);
    expect(out[0]!.line).toHaveLength(5);
    const west = chunkBarriers(out, { minX: -5, minZ: -5, maxX: 5, maxZ: 15 });
    expect(west.map((b) => b.line)).toEqual([
      [0, 0, 5, 0],
      [5, 10, 0, 10, 0, 0],
    ]);
    expect(west.every((b) => b.kind === "hedge" && b.height === 1.2)).toBe(true);
  });
});
