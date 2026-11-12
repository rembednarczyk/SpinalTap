import { describe, expect, it } from "vitest";
import { DISTRICTS } from "../src/config.ts";
import { withoutReplaced } from "../src/corrections-alchemia.ts";
import { correctedLine } from "../src/corrections.ts";
import { extractFeatures } from "../src/features.ts";
import { generate } from "../src/generate.ts";
import { type Pt, pointInRing } from "../src/geometry.ts";
import { roadWidth } from "../src/ground.ts";
import { loadInputs } from "../src/load.ts";
import { type GroundOut } from "../src/model.ts";
import { parseOsmXml } from "../src/osm.ts";
import { worldToGeo } from "../src/project.ts";

/**
 * Where a line goes on from the end of another of its run within a metre along, the sideways
 * steps of 0.1 m and more between them, rounded to 0.1 m: none where the paint runs on.
 */
const markingSteps = (lines: readonly Pt[][]): string[] =>
  lines.flatMap((a) =>
    lines.flatMap((b) => {
      if (a === b) return [];
      const [p, q, r] = [a[a.length - 1]!, a[a.length - 2]!, b[0]!];
      const len = Math.hypot(p.x - q.x, p.z - q.z);
      const [ux, uz] = [(p.x - q.x) / len, (p.z - q.z) / len];
      const along = (r.x - p.x) * ux + (r.z - p.z) * uz;
      const across = Math.abs((r.x - p.x) * uz - (r.z - p.z) * ux);
      return along > -0.5 && along < 1 && across >= 0.1 && across < 1.5 ? [`${p.x.toFixed(1)},${p.z.toFixed(1)}: ${across.toFixed(1)} m`] : [];
    }),
  );

const ring = (flat: readonly number[]): Pt[] => Array.from({ length: flat.length / 2 }, (_, i) => ({ x: flat[2 * i]!, z: flat[2 * i + 1]! }));

/** The game's ground at a point: the surfaces of the pieces over it. */
const surfaces = (ground: readonly GroundOut[]) => {
  const pieces = ground.map((g) => ({ surface: g.surface, ring: ring(g.outline) }));
  return (p: Pt): string[] => pieces.filter((g) => pointInRing(p, g.ring)).map((g) => g.surface);
};

/** How far the asphalt reaches from `p` along `n` (0.05 m steps), and how much bare ground lies past it before the next surface (Infinity: none in 5 m). */
const kerbAt = (at: (p: Pt) => string[], p: Pt, n: Pt): { edge: number; bare: number } => {
  const q = (d: number) => ({ x: p.x + n.x * d, z: p.z + n.z * d });
  let edge = 0;
  while (edge < 15 && at(q(edge + 0.05)).includes("road")) edge += 0.05;
  for (let d = edge + 0.05; d <= edge + 5; d += 0.05) if (at(q(d)).length > 0) return { edge, bare: d - edge - 0.05 };
  return { edge, bare: Infinity };
};

describe("a street of mapped lanes fitted to its sidewalks (G-655)", () => {
  const node = (id: number, x: number, z: number) => {
    const g = worldToGeo({ x, z });
    return ` <node id="${id}" lat="${g.lat}" lon="${g.lon}"/>`;
  };
  const way = (id: number, a: number, b: number, tags: Record<string, string>) =>
    ` <way id="${id}"><nd ref="${a}"/><nd ref="${b}"/>${Object.entries(tags).map(([k, v]) => `<tag k="${k}" v="${v}"/>`).join("")}</way>`;
  const tinyChunk = [{ id: "test-0-0", district: DISTRICTS[0]!, rect: { minX: -50, minZ: -50, maxX: 150, maxZ: 150 } }];
  /**
   * Radziwiłłowska by Plac Litewski: three lanes (9.75 m by `lanes`) along +x, a footway 4 m off
   * the axis on its left (+z) and its right from x 0 to `right`; the asphalt's reach left and right at x.
   */
  const reach = (street: Record<string, string>, x: number, footway: Record<string, string> = { highway: "footway" }, right = 100) => {
    const map = parseOsmXml(
      ["<osm>", node(1, 0, 0), node(2, 100, 0), node(3, 0, 4), node(4, 100, 4), node(5, 0, -4), node(6, right, -4),
        way(10, 1, 2, { highway: "residential", lanes: "3", "lanes:forward": "2", "lanes:backward": "1", ...street }),
        way(11, 3, 4, footway),
        way(12, 5, 6, footway),
        "</osm>"].join("\n"),
    );
    const at = surfaces(generate(map, () => 190, tinyChunk).chunks[0]!.ground.filter((g) => g.surface === "road"));
    return [kerbAt(at, { x, z: 0 }, { x: 0, z: 1 }).edge, kerbAt(at, { x, z: 0 }, { x: 0, z: -1 }).edge].map((d) => Math.round(d * 10) / 10);
  };

  it("ends at the footways on the sides tagged separate, half a metre short of their axes", () => {
    expect(reach({ sidewalk: "separate" }, 50)).toEqual([3.5, 3.5]);
    expect(reach({ sidewalk: "separate" }, 50, { highway: "footway", footway: "sidewalk" })).toEqual([3.5, 3.5]);
  });

  it("keeps half its width by lanes on a side with no sidewalk along it", () => {
    // 9.75 / 2 = 4.875: 4.9 as the outlines round it.
    expect(reach({ "sidewalk:left": "separate" }, 50)).toEqual([3.5, 4.9]);
    expect(reach({ "sidewalk:right": "separate" }, 50)).toEqual([4.9, 3.5]);
    expect(reach({}, 50)).toEqual([4.9, 4.9]);
    expect(reach({ sidewalk: "both" }, 50)).toEqual([4.9, 4.9]);
    expect(reach({ sidewalk: "separate" }, 50, { highway: "footway", footway: "crossing" })).toEqual([4.9, 4.9]);
  });

  it("is fitted only along the stretch its sidewalk runs along", () => {
    // The right footway ends at x 60: past it the right kerb is where the map's lanes put it.
    expect(reach({ "sidewalk:right": "separate" }, 30, { highway: "footway" }, 60)).toEqual([4.9, 3.5]);
    expect(reach({ "sidewalk:right": "separate" }, 80, { highway: "footway" }, 60)).toEqual([4.9, 4.9]);
  });

  it("runs its centre and lane lines on where a fitted stretch meets the map's (G-675)", () => {
    // The right footway ends at x 60: the fitted piece's lines step 0.5 and 0.9 m there unless they shift over a taper.
    const map = parseOsmXml(
      ["<osm>", node(1, 0, 0), node(2, 100, 0), node(3, 0, 4), node(4, 100, 4), node(5, 0, -4), node(6, 60, -4),
        way(10, 1, 2, { highway: "residential", lanes: "3", "lanes:forward": "2", "lanes:backward": "1", "sidewalk:right": "separate" }),
        way(11, 3, 4, { highway: "footway" }),
        way(12, 5, 6, { highway: "footway" }),
        "</osm>"].join("\n"),
    );
    const lines = generate(map, () => 190, tinyChunk).chunks[0]!.markings.filter((m) => m.kind !== "edge").map((m) => ring(m.line));
    expect(lines.length).toBeGreaterThan(0);
    expect(markingSteps(lines)).toEqual([]);
    // Off the taper (x 55 to 65) the lines lie where each piece's lanes put them: the fitted piece's
    // axis 0.68 m left of the map's, its lanes 2.8 m wide, then 3.25 m on the map's axis.
    const zAt = (x: number) => lines.flatMap((l) => l.slice(1).flatMap((b, i) => (l[i]!.x <= x && b.x >= x ? [l[i]!.z] : []))).sort((a, b) => a - b);
    expect([zAt(20), zAt(50), zAt(70), zAt(90)]).toEqual([[-0.7, 2.1], [-0.7, 2.1], [-1.6, 1.6], [-1.6, 1.6]]);
  });

  it("keeps each of its lanes 2.25 m wide and more", () => {
    // Footways 4 m off the axis both sides of a five-lane street: 7 m would make 1.4 m lanes; 11.25 m it is.
    const [left, right] = reach({ sidewalk: "separate", lanes: "5", "lanes:forward": "3", "lanes:backward": "2" }, 50);
    expect(left! + right!).toBeGreaterThanOrEqual(11.2);
  });
});

describe("Radziwiłłowska by Plac Litewski on the map (G-655)", () => {
  const inputs = loadInputs();
  const lines = withoutReplaced(extractFeatures(inputs.osm)).lines.map((l) => correctedLine(l));
  const ground = generate(inputs.osm, () => 190, [{ id: "t-0-0", district: DISTRICTS[0]!, rect: { minX: -100, minZ: 95, maxX: 0, maxZ: 135 } }]).chunks[0]!.ground;
  const at = surfaces(ground);
  // w331453920 and w914787972, x -18.6 to -87.5: the stretch along the footway w232805936 and the one past where it turns off south.
  const ways = ["w331453920", "w914787972"].map((id) => lines.find((l) => l.id === id)!);
  const stations = ways.flatMap((road) => {
    const [a, b] = [road.line[0]!, road.line[road.line.length - 1]!];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const [tx, tz] = [(b.x - a.x) / len, (b.z - a.z) / len];
    // The way runs west: north (+z, away from the footway) is on its right.
    return Array.from({ length: Math.floor(len) - 2 }, (_, k) => ({ road, p: { x: a.x + tx * (k + 1.5), z: a.z + tz * (k + 1.5) }, north: { x: tz, z: -tx } }));
  });

  it("lays no asphalt on the footway along its south kerb", () => {
    const footway = lines.find((l) => l.id === "w232805936")!;
    const [a, b] = [footway.line[6]!, footway.line[5]!];
    // Its straight stretch from x -18.9 to -61.1, every metre.
    const n = Math.floor(Math.hypot(b.x - a.x, b.z - a.z));
    const onRoad = Array.from({ length: n }, (_, k) => ({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n })).filter((p) => at(p).includes("road"));
    expect(a.x).toBeCloseTo(-18.9, 0);
    expect(b.x).toBeCloseTo(-61.1, 0);
    expect(onRoad).toEqual([]);
  });

  it("keeps its north kerb at half its width by lanes, as on the map's axis", () => {
    const short = stations.filter(({ road, p, north }) => kerbAt(at, p, north).edge < roadWidth(road.tags) / 2 - 0.15).map(({ p }) => Math.round(p.x));
    expect(short).toEqual([]);
  });

  it("leaves no metre of bare ground between its asphalt and the footway along its south kerb", () => {
    const bare = stations.filter(({ p }) => p.x > -61).flatMap(({ p, north }) => {
      const k = kerbAt(at, p, { x: -north.x, z: -north.z });
      return k.bare >= 1 ? [`${p.x.toFixed(0)}: ${k.bare.toFixed(2)} m`] : [];
    });
    expect(bare).toEqual([]);
  });

  it("runs its centre and lane lines on where its fitted pieces meet, at x -19 and -66 (G-675)", () => {
    const markings = generate(inputs.osm, () => 190, [{ id: "t-0-0", district: DISTRICTS[0]!, rect: { minX: -100, minZ: 95, maxX: 0, maxZ: 135 } }]).chunks[0]!.markings;
    const lines = markings.filter((m) => m.kind === "centre-dash" || m.kind === "lane-dash").map((m) => ring(m.line));
    expect(lines.filter((l) => l.some((p) => p.x < -60) && l.some((p) => p.x > -70)).length).toBeGreaterThan(0);
    expect(markingSteps(lines)).toEqual([]);
  });

  it("is not narrowed past where the footway turns off south, and its asphalt fills the kerb there", () => {
    // From x -67 west the footway runs 8 m off the axis: the south kerb stays at half the width by lanes.
    const short = stations.filter(({ p }) => p.x < -67).filter(({ road, p, north }) => kerbAt(at, p, { x: -north.x, z: -north.z }).edge < roadWidth(road.tags) / 2 - 0.15).map(({ p }) => Math.round(p.x));
    expect(short).toEqual([]);
    // The kerb's fill (G-570) between it and the footway at x -67 to -71, which a fit of the whole way drops.
    expect(at({ x: -69, z: 108 })).toContain("road");
  });
});
