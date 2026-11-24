import { describe, expect, it } from "vitest";
import { FARA_CHANCEL, FARA_CHAPELS, FARA_DOORS, FARA_HEIGHTS, FARA_HOLO, FARA_HOLO_FACETS, FARA_NAVE, FARA_NAVE_WALLS, FARA_OPENINGS, FARA_TOWER, groundY } from "../src";
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
        expect(y - groundY(668, 42.4)).toBeLessThanOrEqual(FARA_HEIGHTS.spire + 1e-9);
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
});
