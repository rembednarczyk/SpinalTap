import { describe, expect, it } from "vitest";
import { FARA_DOORS, FARA_FOUNDATIONS, FARA_HEIGHTS, FARA_HOLO, FARA_HOLO_FACETS, FARA_HOLO_INNER, FARA_HOLO_OUTLINES, FARA_LEAN_TOS, FARA_NAVE, FARA_OPENINGS, FARA_TOWER, faraWallHeight, groundY, leanHeight } from "../src";
import { inPlan } from "../src/content/fara-holo-plan";
import { FARA_DETAIL_FACETS, FARA_DETAIL_LINES } from "../src/content/fara-holo-detail";
import { FARA_FOUNDATION_TOP, FARA_LEVEL, FARA_PAD } from "../src/content/lublin/fara-pad";
import { LUBLIN_CHUNKS } from "../src/content/lublin";
import { WORLD_BARRIERS } from "../src/content/world-barriers";
import { barrierLayout } from "@seki/core";

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

const base = FARA_FOUNDATION_TOP;
/** The highest point of the hologram's facets over (x, z) whose plan covers it: a roof over a room. */
const roofOver = (x: number, z: number): number => {
  let best = -Infinity;
  for (const f of FARA_HOLO_FACETS) {
    const plan = f.map(([px, , pz]) => [px, pz] as const);
    const ys = f.map((p) => p[1]);
    if (Math.max(...ys) - Math.min(...ys) < 0.01 && f.length === 4) continue;
    if (inPlan(plan, x, z)) best = Math.max(best, ...ys);
  }
  return best;
};

describe("the hologram of the parish church over its foundations (Plac po Farze), V2", () => {
  it("finds the foundations' masonry on the map: the ruin's two outlines and its seven piers and blocks", () => {
    expect(ruinWalls.length).toBeGreaterThanOrEqual(8);
    expect(FARA_FOUNDATIONS).toHaveLength(9);
    expect(FARA_FOUNDATIONS.reduce((n, r) => n + r.length, 0)).toBeGreaterThan(180);
  });

  it("covers the foundations 1:1: a wall rises from every face of their masonry, its foot on the face's ends", () => {
    const key = (x: number, z: number) => `${x.toFixed(3)},${z.toFixed(3)}`;
    const feet = new Set([...FARA_HOLO_FACETS, ...FARA_HOLO_INNER].filter((f) => f.length === 4).map((f) => `${key(f[0]![0], f[0]![2])}>${key(f[1]![0], f[1]![2])}`));
    const missing = FARA_FOUNDATIONS.flatMap((run) => run.slice(1).map((b, k) => `${key(run[k]![0], run[k]![1])}>${key(b[0], b[1])}`)).filter((s) => !feet.has(s));
    expect(missing).toEqual([]);
    // The faces looking out of the church in the bright shell, those into the rooms and the piers' fainter inside it.
    expect(FARA_HOLO_INNER.length).toBeGreaterThan(60);
  });

  it("raises the walls by zone: the nave's 13 m, the chancel's 12 m, the chapels' under their lean-tos, the apse's buttresses' stubs 4 m", () => {
    expect(faraWallHeight(670, 32.5)).toBe(FARA_HEIGHTS.nave);
    expect(faraWallHeight(666.3, 37.9)).toBe(FARA_HEIGHTS.nave);
    expect(faraWallHeight(685, 38.5)).toBe(FARA_HEIGHTS.chancel);
    expect(faraWallHeight(692.3, 42)).toBe(FARA_HEIGHTS.chancel);
    expect(faraWallHeight(668.7, 57.5)).toBeCloseTo(leanHeight(FARA_LEAN_TOS[0]!, 57.5), 9);
    expect(faraWallHeight(695.0, 38.7)).toBe(FARA_HEIGHTS.buttress);
  });

  it("roofs every room the masonry closes: the nave, the chancel, the chapels and the annexes", () => {
    const rooms: [string, number, number, number][] = [
      ["nave", 670, 42, FARA_HEIGHTS.nave],
      ["chancel", 685, 42, FARA_HEIGHTS.chancel],
      ["north chapel", 668.7, 55, 6],
      ["north-west chapel", 663.5, 54.5, 6],
      ["south chapel", 674, 29.5, 6],
      ["south-west chapel", 664, 28, 6],
      ["south-east annex", 682, 34, 6],
      ["north-east annex", 683, 50, 6],
    ];
    for (const [name, x, z, h] of rooms) expect(roofOver(x, z) - base, name).toBeGreaterThan(h - 0.01);
  });

  it("raises the tower over the nave's west bay, on the piers the foundations show at its corners, its helmet within it", () => {
    for (const [x, z] of FARA_TOWER) expect(toFoundations(x, z), `${x},${z}`).toBeLessThan(1.5);
    expect(Math.min(...FARA_TOWER.map((p) => p[0]))).toBeGreaterThanOrEqual(FARA_NAVE.minX);
    const mid = { x: (FARA_TOWER[0]![0] + FARA_TOWER[1]![0]) / 2, z: (FARA_TOWER[0]![1] + FARA_TOWER[2]![1]) / 2 };
    const helmet = FARA_HOLO_FACETS.flat().filter((p) => p[1] > base + FARA_HEIGHTS.tower + 0.01 && Math.hypot(p[0] - mid.x, p[2] - mid.z) < 6);
    const [x0, x1] = [Math.min(...FARA_TOWER.map((p) => p[0])), Math.max(...FARA_TOWER.map((p) => p[0]))];
    const [z0, z1] = [Math.min(...FARA_TOWER.map((p) => p[1])), Math.max(...FARA_TOWER.map((p) => p[1]))];
    for (const [x, , z] of helmet) {
      expect(x).toBeGreaterThan(x0);
      expect(x).toBeLessThan(x1);
      expect(z).toBeGreaterThan(z0);
      expect(z).toBeLessThan(z1);
    }
    expect(Math.max(...helmet.map((p) => p[1])) - base).toBeCloseTo(FARA_HEIGHTS.spire, 6);
  });

  it("carries the bronze model's and the lithograph's detail: buttresses, cornices, the ridge turret, dormers, gables, tracery", () => {
    const pts = FARA_DETAIL_FACETS.flat();
    // Stepped buttresses round the apse reach out past its walls (the foundations' spurs), up to 10.6 m.
    expect(pts.some(([x, y]) => x > 693 && y - base > 10)).toBe(true);
    // The ridge turret over the nave's east bay, above its ridge.
    expect(pts.some(([x, y, z]) => Math.abs(x - 675.6) < 1 && Math.abs(z - 42.4) < 1 && y - base > FARA_HEIGHTS.ridge + 5)).toBe(true);
    // The north chapels' gables over their lean-tos.
    expect(pts.filter(([, y, z]) => z > 56 && y - base > 8.5).length).toBeGreaterThanOrEqual(3);
    expect(FARA_DETAIL_FACETS.length).toBeGreaterThan(80);
    // Cornices, the dormers' windows, the roof's cross; and in the openings a mullion and an oculus, a door's archivolts.
    expect(FARA_DETAIL_LINES.length).toBeGreaterThan(10);
    expect(FARA_HOLO_OUTLINES.length).toBeGreaterThan(FARA_OPENINGS.length * 2);
  });

  it("stands a face on the paving where the game keeps no wall under it: the south-west chapel's face over Archidiakońska (the curator's review)", () => {
    const feet = [...FARA_HOLO_FACETS, ...FARA_HOLO_INNER].filter((f) => f.length === 4).flatMap((f) => [f[0]!, f[1]!]);
    const sw = feet.filter(([x, , z]) => toSegment(x, z, [666.4, 23.7, 657.6, 30.0]) < 0.05);
    expect(sw.filter(([x, y, z]) => Math.abs(y - groundY(x, z)) < 1e-6).length).toBeGreaterThanOrEqual(1);
  });

  it("opens the tower's windows over the nave's ridge, none under its roof (the curator's review)", () => {
    const [x0, x1] = [Math.min(...FARA_TOWER.map((p) => p[0])), Math.max(...FARA_TOWER.map((p) => p[0]))];
    const tower = FARA_OPENINGS.filter((o) => o.sill > FARA_HEIGHTS.nave && o.a[0] >= x0 && o.b[0] <= x1 && o.a[0] > x0 - 0.01 && o.sill > 20);
    expect(tower.length).toBeGreaterThanOrEqual(12);
    for (const o of tower) expect(o.sill).toBeGreaterThan(FARA_HEIGHTS.ridge);
    expect(FARA_HEIGHTS.tower - FARA_HEIGHTS.ridge).toBeGreaterThanOrEqual(10);
  });

  it("is facets of three or four corners, standing on the ground and under the cross's top", () => {
    expect(FARA_HOLO_FACETS.length).toBeGreaterThan(200);
    for (const f of FARA_HOLO_FACETS) {
      expect([3, 4]).toContain(f.length);
      for (const [x, y, z] of f) {
        expect(y).toBeGreaterThanOrEqual(groundY(x, z) - 0.6);
        expect(y - FARA_FOUNDATION_TOP).toBeLessThanOrEqual(FARA_HEIGHTS.spire + 1e-9);
      }
    }
    expect(Math.hypot(FARA_HOLO.x - 676, FARA_HOLO.z - 42.3)).toBeLessThan(1e-9);
  });

  it("opens windows and doors within their walls: each inside its wall's length, the doors on the ground, the windows under the wall's top", () => {
    expect(FARA_OPENINGS.length).toBeGreaterThan(20);
    for (const o of FARA_OPENINGS) {
      const len = Math.hypot(o.b[0] - o.a[0], o.b[1] - o.a[1]);
      expect(o.at * len - o.width / 2, JSON.stringify(o)).toBeGreaterThan(-1e-6);
      expect((1 - o.at) * len - o.width / 2, JSON.stringify(o)).toBeGreaterThan(-1e-6);
    }
    for (const d of FARA_DOORS) expect(d.sill).toBe(0);
  });

  it("opens no window into a lean-to's roof: every window's sill over the lean-to under it", () => {
    for (const o of FARA_OPENINGS) {
      if (o.sill === 0) continue;
      const [x, z] = [o.a[0] + (o.b[0] - o.a[0]) * o.at, o.a[1] + (o.b[1] - o.a[1]) * o.at];
      for (const l of FARA_LEAN_TOS) if (inPlan(l.plan, x, z, 0.05) && o.sill + 0.05 < leanHeight(l, z)) expect(o.sill, `${x.toFixed(1)},${z.toFixed(1)} under its own lean-to's wall`).toBeLessThan(leanHeight(l, z) - o.height - o.rise);
    }
  });

  it("lays the foundations' tops level all round, up to the hologram's foot: where the ground falls off the pad a wall stands taller (the user's note of 24.11)", () => {
    const nearRuin = (x: number, z: number) => FARA_FOUNDATIONS.some((r) => toSegment(x, z, r.flat()) < 0.3);
    const pieces = Object.values(WORLD_BARRIERS).flat().filter((p) => p.x > 650 && p.x < 700 && p.z > 18 && p.z < 64 && nearRuin(p.x, p.z));
    expect(pieces.length).toBeGreaterThan(100);
    // A piece's top at its low end: on the ground there and its height over it (level pieces stand on their low end).
    const lowTop = (p: (typeof pieces)[number]) => {
      const b = barrierLayout(p.variant);
      const half = { x: (Math.sin(p.yaw) * b.length) / 2, z: (Math.cos(p.yaw) * b.length) / 2 };
      return (b.rise === 0 ? p.y : Math.min(groundY(p.x - half.x, p.z - half.z), groundY(p.x + half.x, p.z + half.z))) + b.height;
    };
    const low = pieces.filter((p) => lowTop(p) < FARA_FOUNDATION_TOP - 0.02);
    expect(low.map((p) => `${p.x},${p.z}`)).toEqual([]);
    // And none higher than the level but where the ground itself is (the south-west chapel's corner on Archidiakońska).
    for (const p of pieces) {
      const b = barrierLayout(p.variant);
      if (b.height > 0.55) {
        expect(p.y + b.height, `${p.x},${p.z}`).toBeGreaterThanOrEqual(FARA_FOUNDATION_TOP - 0.02);
        expect(p.y + b.height, `${p.x},${p.z}`).toBeLessThan(FARA_FOUNDATION_TOP + 0.11);
      }
    }
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

});
