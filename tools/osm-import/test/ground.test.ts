import { describe, expect, it } from "vitest";
import { type Line } from "../src/features.ts";
import { CROSSING_ALONG, chunkGround, coveredByWater, crossingBand, cutSidewalk, lineBands, markedCrossing } from "../src/ground.ts";

const river: Line = { id: "w1", osmId: 1, tags: { waterway: "river" }, line: [{ x: 0, z: 0 }, { x: 50, z: 0 }, { x: 100, z: 0 }] };
const bed = [{ x: -10, z: -20 }, { x: 110, z: -20 }, { x: 110, z: 20 }, { x: -10, z: 20 }];

describe("river bands", () => {
  it("buffer a river with no mapped bed", () => {
    expect(lineBands(river, false).map((b) => b.surface)).toEqual(["water"]);
  });

  it("leave a river whose bed is mapped as water to that area", () => {
    expect(coveredByWater(river.line, [bed])).toBe(true);
    expect(lineBands(river, false, [bed])).toEqual([]);
  });

  it("keep the band where the bed covers only a small part of the line", () => {
    const pond = [{ x: -10, z: -5 }, { x: 10, z: -5 }, { x: 10, z: 5 }, { x: -10, z: 5 }];
    expect(coveredByWater(river.line, [pond])).toBe(false);
    expect(lineBands(river, false, [pond])).toHaveLength(1);
  });
});

describe("zebra crossings (ADR-0042)", () => {
  const street: Line = { id: "w2", osmId: 2, tags: { highway: "residential" }, line: [{ x: -50, z: 0 }, { x: 50, z: 0 }] };

  it("stripe a marked footway crossing instead of paving it across the road, and leave an unmarked one to the asphalt", () => {
    const across = (crossing: string): Line => ({ id: "w3", osmId: 3, tags: { highway: "footway", footway: "crossing", crossing }, line: [{ x: 0, z: -4 }, { x: 0, z: 4 }] });
    expect(lineBands(across("zebra"), false).map((b) => b.surface)).toEqual(["crossing"]);
    expect(lineBands(across("unmarked"), false)).toEqual([]);
  });

  it("put a band across the carriageway at a crossing node, as wide as the road and 3 m along it", () => {
    expect(markedCrossing({ highway: "crossing" })).toBe(true);
    expect(markedCrossing({ highway: "crossing", crossing: "unmarked" })).toBe(false);
    const band = crossingBand("n1", { x: 10, z: 0.2 }, [street])!;
    expect(band.surface).toBe("crossing");
    const xs = band.ring.map((p) => p.x);
    const zs = band.ring.map((p) => p.z);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(CROSSING_ALONG, 5);
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(6.5, 5);
    // Off the carriageway (a crossing of a park path): no zebra.
    expect(crossingBand("n2", { x: 10, z: 8 }, [street])).toBeNull();
  });
});

describe("sidewalks at the streets they meet (ADR-0042)", () => {
  it("stop at the kerb of a crossing street instead of running across its asphalt", () => {
    const main: Line = { id: "w10", osmId: 10, tags: { highway: "residential", sidewalk: "both" }, line: [{ x: -40, z: 0 }, { x: 40, z: 0 }] };
    const side = lineBands(main, false).filter((b) => b.surface === "sidewalk");
    expect(side.length).toBe(2);
    // A street 8 m wide crosses at x = 0.
    const onRoad = (p: { x: number; z: number }) => Math.abs(p.x) < 4;
    for (const b of side) {
      const pieces = cutSidewalk(b, onRoad);
      expect(pieces.length).toBe(2);
      for (const piece of pieces) for (const p of piece.ring) expect(Math.abs(p.x)).toBeGreaterThan(3.4);
    }
    // Nothing in the way: the sidewalk stays whole.
    expect(cutSidewalk(side[0]!, () => false)).toEqual([side[0]]);
  });
});

describe("flights of steps (G-203, G-213)", () => {
  type P = { x: number; z: number };
  // Along x and across z of a piece of a run along x, and its corners' extent in the run's frame for a run turned.
  const box = (ring: readonly P[]) => ({
    along: Math.round((Math.max(...ring.map((p) => p.x)) - Math.min(...ring.map((p) => p.x))) * 10) / 10,
    across: Math.round((Math.max(...ring.map((p) => p.z)) - Math.min(...ring.map((p) => p.z))) * 10) / 10,
  });
  const area = (ring: readonly P[]) => Math.abs(ring.reduce((s, p, i) => s + p.x * ring[(i + 1) % ring.length]!.z - ring[(i + 1) % ring.length]!.x * p.z, 0)) / 2;
  const steps = (width: string | undefined, ...pts: [number, number][]): Line => ({ id: "w1", osmId: 1, tags: { highway: "steps", ...(width ? { width } : {}) }, line: pts.map(([x, z]) => ({ x, z })) });
  const everywhere = { minX: -100, minZ: -100, maxX: 100, maxZ: 100 };
  const pieces = (l: Line, rect = everywhere) =>
    chunkGround(lineBands(l, false), rect).map((g) => Array.from({ length: g.outline.length / 2 }, (_, i) => ({ x: g.outline[2 * i]!, z: g.outline[2 * i + 1]! })));

  it("cuts a run shorter than its width into strips each longer along the run than across, covering the whole width", () => {
    const strips = pieces(steps("10", [0, 0], [4, 0])).map(box);
    expect(strips.length).toBeGreaterThan(1);
    for (const s of strips) expect(s.along).toBeGreaterThan(s.across);
    expect(strips.reduce((w, s) => w + s.across, 0)).toBeCloseTo(10, 6);
  });

  it("cuts a short run of a default 3 m flight too, and one as long as it is wide (G-213)", () => {
    for (const run of [1.3, 2, 3]) {
      const strips = pieces(steps(undefined, [0, 0], [run, 0]));
      expect(strips.length).toBeGreaterThan(1);
      for (const s of strips.map(box)) expect(s.along).toBeGreaterThan(s.across);
      // All of them, however small: a strip under 0.5 m² is no sliver to drop.
      expect(strips.reduce((a, s) => a + area(s), 0)).toBeCloseTo(3 * run, 1);
    }
  });

  it("cuts a turned run along its own direction", () => {
    const [ux, uz] = [Math.cos(0.6), Math.sin(0.6)];
    for (const s of pieces(steps(undefined, [0, 0], [2 * ux, 2 * uz]))) {
      const local = s.map((p) => ({ x: p.x * ux + p.z * uz, z: -p.x * uz + p.z * ux }));
      const b = box(local);
      expect(b.along).toBeGreaterThan(b.across);
    }
  });

  it("cuts what a chunk's edge leaves of a longer run, short along it, into strips along it", () => {
    // A 4.7 m run whose first 0.9 m lie in the chunk.
    const strips = pieces(steps(undefined, [-0.9, 0], [3.8, 0]), { minX: -10, minZ: -10, maxX: 0, maxZ: 10 }).map(box);
    expect(strips.length).toBeGreaterThan(1);
    for (const s of strips) expect(s.along).toBeGreaterThan(s.across);
  });

  it("cuts a piece 0.6-0.65 m long into strips no narrower than the renderer draws, and leaves one of 0.5-0.55 m whole", () => {
    // Cut: 0.8 of the run leaves strips under 0.45 m, so they are made 0.45 m and more, up to 0.9 of the run.
    // Whole: even strips 0.9 of the run wide would be under 0.45 m.
    for (const [width, run, cut] of [[undefined, 0.5, false], [undefined, 0.55, false], [undefined, 0.6, true], [undefined, 0.65, true], ["10", 0.5, false], ["10", 0.6, true]] as const) {
      const strips = pieces(steps(width, [0, 0], [run, 0]));
      expect(strips.length > 1, `${width ?? 3} m wide, ${run} m long`).toBe(cut);
      // planSteps draws no flight on a band under 0.4 m wide or STEP_DEPTH long.
      for (const s of strips.map(box)) {
        expect(Math.min(s.along, s.across)).toBeGreaterThanOrEqual(0.4);
        if (cut) expect(s.along).toBeGreaterThan(s.across);
      }
      // The import rounds corners to 0.1 m.
      expect(Math.abs(strips.reduce((a, s) => a + area(s), 0) - Number(width ?? 3) * run)).toBeLessThan(Number(width ?? 3) * 0.1);
    }
  });

  it("cuts the short run of w293370649 where it turns off the long one into strips along it", () => {
    // Stare Miasto (571; -69): a 3.46 m run and a 0.61 m one turning 90° off it, both 3 m wide.
    const line = steps(undefined, [573.83, -71], [570.85, -69.24], [571.17, -68.72]);
    const [a, b] = [line.line[1]!, line.line[2]!];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const [ux, uz] = [(b.x - a.x) / len, (b.z - a.z) / len];
    const short = chunkGround([lineBands(line, false)[1]!], { minX: 500, minZ: -100, maxX: 650, maxZ: 0 }).map((g) => Array.from({ length: g.outline.length / 2 }, (_, i) => ({ x: g.outline[2 * i]! - a.x, z: g.outline[2 * i + 1]! - a.z })));
    expect(short.length).toBeGreaterThan(1);
    for (const s of short) {
      const b2 = box(s.map((p) => ({ x: p.x * ux + p.z * uz, z: -p.x * uz + p.z * ux })));
      expect(b2.across).toBeGreaterThanOrEqual(0.4);
      expect(b2.along).toBeGreaterThan(b2.across);
    }
  });

  it("leaves the corner of w56965515 a chunk's edge cuts off whole, not cut into strips longer across than along", () => {
    // Podzamcze (729; 160): the head of its last run under the chunks' edge z = 160, a triangle about 1.6 x 0.9 m.
    const pieces160 = pieces(steps(undefined, [729.51, 159.94], [727.29, 164.03]), { minX: 610, minZ: -40, maxX: 760, maxZ: 160 });
    expect(pieces160).toHaveLength(1);
  });

  it("cuts a slanted piece a chunk's edge leaves into strips the renderer draws, and leaves a corner too small to cut whole", () => {
    const cut = (deg: number, inside: number) => {
      const [ux, uz] = [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
      const strips = pieces(steps(undefined, [-inside * ux, -inside * uz], [4 * ux, 4 * uz]), { minX: -10, minZ: -10, maxX: 0, maxZ: 10 });
      return strips.map((s) => box(s.map((p) => ({ x: p.x * ux + p.z * uz, z: -p.x * uz + p.z * ux }))));
    };
    // The edge 10° off square to the run, 1.5 m of it in the chunk: a trapezoid.
    const slanted = cut(10, 1.5);
    expect(slanted.length).toBeGreaterThan(1);
    for (const b of slanted) {
      expect(b.across).toBeGreaterThanOrEqual(0.4);
      expect(b.along).toBeGreaterThan(b.across);
    }
    // 60° off, 1.2 m in: a triangle whose strips would have tips too short to draw; it stays one piece.
    expect(cut(60, 1.2)).toHaveLength(1);
  });

  it("drops a piece a chunk's edge leaves under 0.5 m², and keeps all strips of a piece over it however small", () => {
    // 0.15 m of a run in the chunk: 0.45 m², a sliver.
    expect(pieces(steps(undefined, [-0.15, 0], [3, 0]), { minX: -10, minZ: -10, maxX: 0, maxZ: 10 })).toEqual([]);
    // A 0.7 m run 3 m wide: each strip under 0.5 m², all of them kept.
    const strips = pieces(steps(undefined, [0, 0], [0.7, 0]));
    expect(strips.length).toBeGreaterThan(1);
    for (const s of strips) expect(area(s)).toBeLessThan(0.5);
    expect(strips.reduce((a, s) => a + area(s), 0)).toBeCloseTo(2.1, 1);
  });

  it("takes a bend of a few centimetres for no new run, so no run is left too short to cut", () => {
    // w1435832512: 0.65 m and 0.37 m, the bend 5 mm off the line.
    const strips = pieces(steps(undefined, [0, 0], [0.65, 0.005], [1.02, 0])).map(box);
    expect(strips.length).toBeGreaterThan(1);
    for (const s of strips) expect(s.along).toBeCloseTo(1, 1);
    // A real turn stays a turn: two runs.
    expect(lineBands(steps(undefined, [0, 0], [4, 0], [4, 4]), false)).toHaveLength(2);
  });

  it("keeps a run longer than its width in one band", () => {
    expect(pieces(steps("10", [0, 0], [16, 0])).map(box)).toEqual([{ along: 16, across: 10 }]);
    expect(pieces(steps(undefined, [0, 0], [4, 0])).map(box)).toEqual([{ along: 4, across: 3 }]);
  });
});
