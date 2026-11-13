import { describe, expect, it } from "vitest";
import { type Line } from "../src/features.ts";
import { type Pt, pointInRing, r1, selfIntersects } from "../src/geometry.ts";
import { joinedPoints, lineBands } from "../src/ground.ts";
import { bufferBand, roundJoints, stripBand } from "../src/line-buffer.ts";

const pts = (xs: readonly (readonly [number, number])[]): Pt[] => xs.map(([x, z]) => ({ x, z }));
const line = (id: string, tags: Line["tags"], xs: readonly (readonly [number, number])[]): Line => ({ id, osmId: Number(id.slice(1)), tags, line: pts(xs) });
const covered = (rings: readonly (readonly Pt[])[], p: Pt) => rings.some((r) => pointInRing(p, r));

describe("bands along lines on Clipper2 (ADR-0078, step 2)", () => {
  // A service road looping round onto a node of its own, like w173489056 in Nabrzeże (G-658).
  const lollipop = line("w173489056", { highway: "service" }, [[0, 0], [20, 0], [30, -8], [40, 0], [30, 8], [20, 0]]);

  it("lays a lollipop's carriageway as one outline that does not cross itself, its loop's inside a hole", () => {
    const road = lineBands(lollipop, false).filter((b) => b.carriageway);
    expect(road).toHaveLength(1);
    expect(selfIntersects(road[0]!.ring)).toBe(false);
    // The loop's middle is no road, the loop's way and its tail are.
    expect(covered([road[0]!.ring], { x: 30, z: 0 })).toBe(false);
    for (const p of [{ x: 5, z: 0 }, { x: 35, z: 4 }, { x: 25, z: -4 }]) expect(covered([road[0]!.ring], p)).toBe(true);
  });

  it("lays a closed footway as a ring round its hole, with no seam where it closes", () => {
    const loop = line("w7", { highway: "footway" }, [[0, 0], [20, 0], [20, 20], [0, 20], [0, 0]]);
    const [band, ...rest] = lineBands(loop, false);
    expect(rest).toHaveLength(0);
    expect(selfIntersects(band!.ring)).toBe(false);
    expect(covered([band!.ring], { x: 10, z: 10 })).toBe(false);
    // The corner it closes on is round outside, as the others are, and covered.
    for (const p of [{ x: -0.8, z: -0.8 }, { x: 20.8, z: 20.8 }, { x: 0, z: 0 }]) expect(covered([band!.ring], p)).toBe(true);
  });

  it("fills the outer corner where two ways meet end to end, and leaves a dead end square", () => {
    const a = line("w1", { highway: "residential", sidewalk: "no" }, [[-30, 0], [0, 0]]);
    const b = line("w2", { highway: "residential", sidewalk: "no" }, [[0, 0], [0, 30]]);
    const joined = joinedPoints([a, b]);
    const bands = [...lineBands(a, false, [], false, joined), ...lineBands(b, false, [], false, joined)];
    // 6.5 m wide: the corner's outer side 3.25 m off the node, along the diagonal.
    const corner = { x: 2.1, z: -2.1 };
    expect(covered(bands.map((x) => x.ring), corner)).toBe(false);
    const rings = roundJoints(bands).map((x) => x.ring);
    expect(covered(rings, corner)).toBe(true);
    for (const r of rings) expect(selfIntersects(r)).toBe(false);
    // The dead ends stay square: nothing past them.
    expect(covered(rings, { x: -30.5, z: 0 })).toBe(false);
    expect(covered(rings, { x: 0, z: 30.5 })).toBe(false);
  });

  it("lays a round end only on bare ground, not over the way it meets", () => {
    const a = line("w1", { highway: "residential", sidewalk: "no" }, [[-30, 0], [0, 0]]);
    const b = line("w2", { highway: "residential", sidewalk: "no" }, [[0, 0], [30, 0]]);
    const joined = joinedPoints([a, b]);
    const bands = [...lineBands(a, false, [], false, joined), ...lineBands(b, false, [], false, joined)];
    // Straight on: nothing bare to fill, the bands as they were.
    expect(roundJoints(bands).map((x) => x.ring)).toEqual(bands.map((x) => x.ring));
  });

  it("leaves no gap on the cuts where two carriageways meet end to end, once rounded to 0.1 m (G-760)", () => {
    // Two streets' ends on one node, a degree or a few apart, of the same width or not, the node off
    // the 0.1 m grid: as Podzamcze#107 (1080.1, 564.0) and Turystyczna (2505.0, 331.5) are laid.
    const cases: (readonly [number, number, number, number, number, number])[] = [
      [1081.25, 564.1, 89.7, 91.2, 6.5, 9.7],
      [2506.45, 330.65, 32.5, 33.1, 9.8, 9.8],
      [930.35, 331.45, 95.8, 92.4, 9.7, 9.8],
      [26.62, -102.63, 88.9, 91.7, 7.9, 6.5],
      [12.34, 56.78, 0, 2.5, 6, 6],
      [-40.07, 18.93, 47.3, 51.1, 8, 7],
    ];
    const dir = (deg: number) => ({ x: Math.cos((deg * Math.PI) / 180), z: Math.sin((deg * Math.PI) / 180) });
    const gaps: string[] = [];
    for (const [x, z, inDeg, outDeg, wa, wb] of cases) {
      const [u, v] = [dir(inDeg), dir(outDeg)];
      const a = line("w1", { highway: "residential", width: String(wa), sidewalk: "no" }, [[x - 40 * u.x, z - 40 * u.z], [x, z]]);
      const b = line("w2", { highway: "residential", width: String(wb), sidewalk: "no" }, [[x, z], [x + 40 * v.x, z + 40 * v.z]]);
      const joined = joinedPoints([a, b]);
      const bands = [...lineBands(a, false, [], false, joined), ...lineBands(b, false, [], false, joined)];
      // The rings as the tables hold them, the gaps' patches with them.
      const rings = roundJoints(bands, (of, ring) => ({ surface: of.surface, ring, bridge: false, source: of.source })).map((r) => r.ring.map((p) => ({ x: r1(p.x), z: r1(p.z) })));
      // Each band's cut across the node, as wide as the narrower street, short of its sides.
      const half = (Math.min(wa, wb) / 2) * 0.95;
      for (const d of [u, v]) {
        for (let k = -20; k <= 20; k++) {
          const p = { x: x - (d.z * half * k) / 20, z: z + (d.x * half * k) / 20 };
          if (!covered(rings, p)) gaps.push(`${p.x.toFixed(2)},${p.z.toFixed(2)}`);
        }
      }
    }
    expect(gaps).toEqual([]);
  });

  it("closes the crack between ways of two surfaces meeting end to end, the patch lapping over the other by the rounding only (G-777)", () => {
    // A street ending on a pedestrian street's end, a footway's or a cobbled one's, a few degrees
    // apart, the node off the 0.1 m grid: as Podzamcze (837.3, 206.5) is laid. The crack between the
    // two cuts is too narrow for a round end's bit, and of two surfaces.
    const cases: (readonly [number, number, number, number, Line["tags"]])[] = [
      [837.27, 206.49, 84.1, 90.3, { highway: "pedestrian", width: "4" }],
      [12.34, 56.78, 0, 4.5, { highway: "footway", width: "3" }],
      [-40.07, 18.93, 47.3, 52.1, { highway: "pedestrian", surface: "sett", width: "5" }],
      [930.35, 331.45, 95.8, 91.4, { highway: "footway", width: "2.5" }],
    ];
    const dir = (deg: number) => ({ x: Math.cos((deg * Math.PI) / 180), z: Math.sin((deg * Math.PI) / 180) });
    const offEdge = (p: Pt, r: readonly Pt[]) =>
      Math.min(
        ...r.map((a, i) => {
          const b = r[(i + 1) % r.length]!;
          const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.z - a.z) * (b.z - a.z)) / ((b.x - a.x) ** 2 + (b.z - a.z) ** 2 || 1)));
          return Math.hypot(p.x - a.x - t * (b.x - a.x), p.z - a.z - t * (b.z - a.z));
        }),
      );
    const bare: string[] = [];
    const over: string[] = [];
    for (const [x, z, inDeg, outDeg, tags] of cases) {
      const [u, v] = [dir(inDeg), dir(outDeg)];
      const a = line("w1", { highway: "residential", width: "7", sidewalk: "no" }, [[x - 40 * u.x, z - 40 * u.z], [x, z]]);
      const b = line("w2", tags, [[x, z], [x + 40 * v.x, z + 40 * v.z]]);
      const joined = joinedPoints([a, b]);
      const bands = [...lineBands(a, false, [], false, joined), ...lineBands(b, false, [], false, joined)];
      const out = roundJoints(bands, (of, ring) => ({ surface: of.surface, ring, bridge: false, source: `patch ${of.source}` }));
      const rings = out.map((r) => r.ring.map((p) => ({ x: r1(p.x), z: r1(p.z) })));
      // The 0.1 m cells in the joint, as far as the narrower way's half width (the round end's disc, its
      // arc 0.1 m in from the circle at most): bare ones only specks of the rounding, 0.05 m² a joint
      // at most (61 cells, 0.6 m², before); a patch over a band of another surface no farther in than a cell.
      const half = Math.min(7, Number(tags.width)) / 2 - 0.1;
      const specks: string[] = [];
      for (let i = -40; i <= 40; i++) {
        for (let k = -40; k <= 40; k++) {
          const p = { x: Math.floor(x * 10 + i) / 10 + 0.05, z: Math.floor(z * 10 + k) / 10 + 0.05 };
          if (Math.hypot(p.x - x, p.z - z) > half) continue;
          const under = out.map((r, n) => ({ ...r, laid: rings[n]! })).filter((r) => pointInRing(p, r.laid));
          if (under.length === 0) specks.push(`${p.x.toFixed(2)},${p.z.toFixed(2)}`);
          for (const patch of under.filter((r) => r.source.startsWith("patch"))) {
            if (under.some((r) => r.surface !== patch.surface && offEdge(p, r.laid) > 0.1)) over.push(`${p.x.toFixed(2)},${p.z.toFixed(2)}`);
          }
        }
      }
      if (specks.length > 5) bare.push(...specks);
    }
    expect({ bare, over }).toEqual({ bare: [], over: [] });
  });

  it("lays no gap's patch over a flight of steps ending at the joint (G-760)", () => {
    // Two footways bending on a node off the grid, a flight of steps up from it between them: the
    // footways' crack and wedge reach under the steps, which cover them.
    const [x, z] = [569.33, 258.09];
    const a = line("w1", { highway: "footway", width: "2.26" }, [[553.38, 270.16], [x, z]]);
    const b = line("w2", { highway: "footway", width: "2.99" }, [[x, z], [582.74, 243.26]]);
    const s = line("w3", { highway: "steps", width: "2.37" }, [[x, z], [576.54, 261.55]]);
    const joined = joinedPoints([a, b, s]);
    const bands = [a, b, s].flatMap((l) => lineBands(l, false, [], false, joined));
    const steps = bands.filter((r) => r.surface === "steps").map((r) => r.ring);
    const out = roundJoints(bands, (of, ring) => ({ surface: of.surface, ring, bridge: false, source: `patch ${of.source}` }));
    const patches = out.filter((r) => r.source.startsWith("patch")).map((r) => r.ring.map((p) => ({ x: r1(p.x), z: r1(p.z) })));
    const over: string[] = [];
    for (let i = -30; i <= 30; i++) {
      for (let k = -30; k <= 30; k++) {
        const p = { x: x + i * 0.1 + 0.05, z: z + k * 0.1 + 0.05 };
        if (covered(steps, p) && covered(patches, p)) over.push(`${p.x.toFixed(2)},${p.z.toFixed(2)}`);
      }
    }
    expect(over).toEqual([]);
  });

  it("lays a sidewalk's inner edge on its carriageway's edge round a bend, with no gap", () => {
    const axis = pts([[0, 0], [30, 0], [50, 15]]);
    const road = bufferBand(axis, 6);
    const [left] = stripBand(axis, 3, 2.5);
    expect(left).toBeDefined();
    // Just off the road's outer edge at the bend, on the sidewalk's side (left: z up).
    for (const p of [{ x: 30, z: 3.05 }, { x: 29.2, z: 3.05 }, { x: 31.2, z: 2.9 }]) expect(covered([...road, left!], p)).toBe(true);
  });

  it("bends a band round a sharp turn without crossing itself", () => {
    const hairpin = pts([[0, 0], [30, 0], [0, 1.5]]);
    for (const r of bufferBand(hairpin, 6)) expect(selfIntersects(r)).toBe(false);
    for (const r of stripBand(hairpin, 3, 2.5)) expect(selfIntersects(r)).toBe(false);
  });

  it("gives the same rings twice", () => {
    expect(lineBands(lollipop, false)).toEqual(lineBands(lollipop, false));
  });
});
