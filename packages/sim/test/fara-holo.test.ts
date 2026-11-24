import { describe, expect, it } from "vitest";
import { FARA_CHANCEL, FARA_HEIGHTS, FARA_HOLO, FARA_HOLO_FACETS, FARA_NAVE, FARA_NAVE_WALLS, FARA_TOWER, groundY } from "../src";
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
});
