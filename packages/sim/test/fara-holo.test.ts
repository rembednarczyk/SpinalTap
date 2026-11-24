import { describe, expect, it } from "vitest";
import { FARA_CHANCEL, FARA_CHAPELS, FARA_DOORS, FARA_HEIGHTS, FARA_HOLO, FARA_HOLO_FACETS, FARA_NAVE, FARA_NAVE_WALLS, FARA_OPENINGS, FARA_TOWER, groundY } from "../src";
import { FARA_FOUNDATION_TOP, FARA_LEVEL, FARA_PAD } from "../src/content/lublin/fara-pad";
import { LUBLIN_CHUNKS } from "../src/content/lublin";

/*
 * The hologram of St Michael's parish church (`fara-holo.ts`) stands on its foundations as the map has them: the ruin's
 * low walls (0.5 m, `historic=ruins` on Plac po Farze, `barriers.ts`). The user's note of 24.11: the hologram fitted to
 * the foundations, its walls see-through as the game's other holograms.
 */
const ruinWalls = LUBLIN_CHUNKS.flatMap((c) => c.barriers ?? []).filter((b) => b.kind === "wall" && b.height === 0.5 && b.line[0]! > 640 && b.line[0]! < 700 && b.line[1]! > 20 && b.line[1]! < 62);

const toSegment = (x: number, z: number, l: readonly number[]): number => {
  let best = Infinity;
  for (let k = 0; k + 3 < l.length; k += 2) {
    const [ax, az, bx, bz] = [l[k]!, l[k + 1]!, l[k + 2]!, l[k + 3]!];
    const [dx, dz] = [bx - ax, bz - az];
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return best;
};
const toFoundations = (x: number, z: number): number => Math.min(...ruinWalls.map((w) => toSegment(x, z, w.line)));

/** Points every metre along a run of the plan, closed or open. */
const along = (pts: readonly (readonly [number, number])[], closed: boolean): [number, number][] => {
  const out: [number, number][] = [];
  for (let k = 0; k < (closed ? pts.length : pts.length - 1); k++) {
    const [[ax, az], [bx, bz]] = [pts[k]!, pts[(k + 1) % pts.length]!];
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az)));
    for (let i = 0; i < n; i++) out.push([ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n]);
  }
  return out;
};

describe("the hologram of the parish church over its foundations (Plac po Farze)", () => {
  it("finds the foundations' walls on the map", () => {
    expect(ruinWalls.length).toBeGreaterThanOrEqual(8);
  });

  it("stands its nave's and chancel's walls on the foundations' walls (their middle within 1.2 m of a foundation's face)", () => {
    for (const [name, run, closed] of [["nave", FARA_NAVE_WALLS, false], ["chancel", FARA_CHANCEL, false]] as const) {
      const off = along(run, closed).filter(([x, z]) => toFoundations(x, z) > 1.2);
      expect(off.map(([x, z]) => `${name} ${x.toFixed(1)},${z.toFixed(1)}`)).toEqual([]);
    }
  });

  it("raises the tower over the nave's west bay, on the piers the foundations show at its corners", () => {
    for (const [x, z] of FARA_TOWER) expect(toFoundations(x, z), `${x},${z}`).toBeLessThan(1.5);
    // Inside the nave, not west of the foundations as the first hologram had it.
    expect(Math.min(...FARA_TOWER.map((p) => p[0]))).toBeGreaterThanOrEqual(FARA_NAVE[0]![0]);
  });

  it("is facets of three or four corners, standing on the ground and under the spire's point", () => {
    expect(FARA_HOLO_FACETS.length).toBeGreaterThan(20);
    for (const f of FARA_HOLO_FACETS) {
      expect([3, 4]).toContain(f.length);
      for (const [x, y, z] of f) {
        expect(y).toBeGreaterThanOrEqual(groundY(x, z) - 0.6);
        expect(y - FARA_FOUNDATION_TOP).toBeLessThanOrEqual(FARA_HEIGHTS.spire + 1e-9);
      }
    }
    expect(FARA_HOLO.x).toBeGreaterThan(FARA_NAVE[0]![0]);
    expect(FARA_HOLO.x).toBeLessThan(FARA_NAVE[1]![0]);
  });

  it("stands the side chapels, the sacristy and the annex on the foundations round the nave and the chancel", () => {
    expect(FARA_CHAPELS.length).toBeGreaterThanOrEqual(7);
    for (const c of FARA_CHAPELS) {
      // Their far corners on the foundations' outline (within 1.5 m), their lean-to under the wall they lean on.
      const far = c.pts.filter((p) => Math.abs(p[1] - c.wall) > 1);
      for (const [x, z] of far) expect(toFoundations(x, z), `${x},${z}`).toBeLessThan(1.5);
      expect(c.inner).toBeGreaterThan(c.out);
      expect(c.inner).toBeLessThan(FARA_HEIGHTS.chancel);
    }
  });

  it("opens windows and doors within their walls: each inside its wall's length, the doors on the ground, the windows under the wall's top", () => {
    expect(FARA_OPENINGS.length).toBeGreaterThan(15);
    for (const o of FARA_OPENINGS) {
      const len = Math.hypot(o.b[0] - o.a[0], o.b[1] - o.a[1]);
      expect(o.at * len - o.width / 2, JSON.stringify(o)).toBeGreaterThan(0);
      expect(o.at * len + o.width / 2, JSON.stringify(o)).toBeLessThan(len);
      expect(o.sill + o.height + o.rise).toBeLessThan(FARA_HEIGHTS.tower);
    }
    for (const d of FARA_DOORS) expect(d.sill).toBe(0);
    // The west portal on the nave's axis, in the tower's west wall.
    const west = FARA_DOORS[0]!;
    expect(west.a[1] + (west.b[1] - west.a[1]) * west.at).toBeCloseTo(42.4, 6);
    expect(west.a[0]).toBe(FARA_TOWER[0]![0]);
  });

  it("stands on the foundations levelled to one height: the square under their walls flat at the pad's level, off the south-west wedge on Archidiakońska", () => {
    expect(FARA_PAD.y).toBe(FARA_LEVEL);
    expect(FARA_PAD.row).toBe("T-347");
    const samples = ruinWalls.flatMap((w) => Array.from({ length: w.line.length / 2 }, (_, k) => [w.line[2 * k]!, w.line[2 * k + 1]!] as const));
    const flat = samples.filter(([x, z]) => Math.abs(groundY(x, z) - FARA_LEVEL) < 0.1);
    // Nine in ten of the walls' corners on the level within 0.1 m (on the NMT they ran from -4.9 to -2.4 m); the rest
    // within 0.3 m (the pad's edge on the import's 5 m grid), but the south-west wedge left on the NMT (z under 27).
    expect(flat.length / samples.length).toBeGreaterThan(0.9);
    // The south-west wedge on Archidiakońska, and the north-west turret's tip on the slope down to the footway.
    const wedge = (x: number, z: number) => z < 27 || (x < 669 && z < 31) || (x < 659 && z > 55);
    for (const [x, z] of samples.filter(([x, z]) => !wedge(x, z))) expect(Math.abs(groundY(x, z) - FARA_LEVEL), `${x},${z}`).toBeLessThan(0.3);
  });

  it("opens the doors in the foundations' gaps: under 0.3 m of a door's width over the ruin's masonry (the curator's review of 24.11)", () => {
    // The closed outlines of the ruin's masonry (the walls' faces drawn round them).
    const masonry = ruinWalls.filter((w) => w.line.length >= 8 && w.line[0] === w.line[w.line.length - 2] && w.line[1] === w.line[w.line.length - 1]);
    const inside = (x: number, z: number) =>
      masonry.some((w) => {
        let c = false;
        for (let i = 0, j = w.line.length / 2 - 1; i < w.line.length / 2; j = i++) {
          const [xi, zi, xj, zj] = [w.line[2 * i]!, w.line[2 * i + 1]!, w.line[2 * j]!, w.line[2 * j + 1]!];
          if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
        }
        return c;
      });
    for (const d of FARA_DOORS) {
      const len = Math.hypot(d.b[0] - d.a[0], d.b[1] - d.a[1]);
      let over = 0;
      for (let s = -d.width / 2 + 0.05; s < d.width / 2; s += 0.1) {
        const t = d.at + s / len;
        if (inside(d.a[0] + (d.b[0] - d.a[0]) * t, d.a[1] + (d.b[1] - d.a[1]) * t)) over += 0.1;
      }
      expect(over, JSON.stringify(d)).toBeLessThan(0.3);
    }
  });

  it("opens a chancel's window over the lean-to of a chapel leaning on it, not into its roof", () => {
    for (const o of FARA_OPENINGS) {
      const [x, z] = [o.a[0] + (o.b[0] - o.a[0]) * o.at, o.a[1] + (o.b[1] - o.a[1]) * o.at];
      const ch = FARA_CHAPELS.find((c) => Math.abs(c.wall - z) < 0.8 && x > Math.min(...c.pts.map((q) => q[0])) && x < Math.max(...c.pts.map((q) => q[0])));
      if (ch) expect(o.sill, `${x.toFixed(1)},${z.toFixed(1)}`).toBeGreaterThan(ch.inner);
    }
  });
});
