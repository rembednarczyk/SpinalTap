import { BARRIER_OPENINGS, barrierLayout } from "@seki/core";
import { describe, expect, it } from "vitest";
import { WORLD_BARRIERS } from "../src";
import { CROWD_LANES } from "../src/content/crowd";
import { distanceToBarrier } from "../src/content/lublin/barriers";
import { MAP_CHUNKS } from "../src/content/lublin/sites";

/**
 * The squares' and the alleys' routes keep off the map's barriers running along them (G-613):
 * under the Archikatedra, Podwale's footway w56965511 runs about 1.7 m from the retaining wall
 * w67626198, and its walkers walk the footway, not the foot of the wall, which stays.
 */

type P = { readonly x: number; readonly z: number };

/** How far (p) is beside the segment a..b, square to it; past its ends (the map's edge cuts a wall there) it is not beside it. */
const besideDistance = (p: P, a: P, b: P): number => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1);
  return t <= 0 || t >= 1 ? Infinity : Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
};
const sine = (u: P, v: P): number => (u.x * v.z - u.z * v.x) / (Math.hypot(u.x, u.z) * Math.hypot(v.x, v.z) || 1);

const barrierLines = (keep: (id: string) => boolean) =>
  MAP_CHUNKS.flatMap((c) =>
    (c.barriers ?? [])
      .filter((b) => !BARRIER_OPENINGS.has(b.kind) && keep(b.id))
      .map((b) => ({ id: b.id, kind: b.kind, pts: Array.from({ length: b.line.length / 2 }, (_, k): P => ({ x: b.line[2 * k]!, z: b.line[2 * k + 1]! })) })),
  );

/** A closed route resampled every quarter metre. */
const dense = (pts: readonly P[]): P[] =>
  pts.flatMap((a, i) => {
    const b = pts[(i + 1) % pts.length]!;
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.25));
    return Array.from({ length: n }, (_, k) => ({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n }));
  });

/**
 * The nearest a route comes to a barrier running along it, with the place: the route's way at a
 * point taken over a metre either side, so that a turn's short chords do not count as along, and
 * only beside the barrier's segments.
 */
const nearestAlong = (laneIds: (id: string) => boolean, lines: ReturnType<typeof barrierLines>, where: (p: P) => boolean) => {
  const segs = lines.flatMap((l) => l.pts.slice(1).map((b, k) => ({ id: l.id, a: l.pts[k]!, b })));
  let worst = { d: Infinity, at: "", id: "" };
  for (const lane of CROWD_LANES.filter((l) => laneIds(l.id))) {
    const pts = dense(lane.points.map(([x, z]): P => ({ x, z })));
    pts.forEach((p, i) => {
      const [u, v] = [pts[(i + pts.length - 4) % pts.length]!, pts[(i + 4) % pts.length]!];
      const dir = { x: v.x - u.x, z: v.z - u.z };
      if (Math.hypot(dir.x, dir.z) < 1 || !where(p)) return;
      for (const s of segs) {
        if (Math.abs(p.x - s.a.x) > 60 || Math.abs(p.z - s.a.z) > 60) continue;
        if (Math.abs(sine(dir, { x: s.b.x - s.a.x, z: s.b.z - s.a.z })) >= 0.5) continue;
        const d = besideDistance(p, s.a, s.b);
        if (d < worst.d) worst = { d, at: `${p.x.toFixed(1)}, ${p.z.toFixed(1)} (${lane.id})`, id: s.id };
      }
    });
  }
  return worst;
};

/** The pairs of a closed route's segments that cross each other (not neighbours, not lying on each other: a route walked there and back). */
const crossings = (pts: readonly P[]): [number, number][] => {
  const side = (a: P, b: P, c: P): number => Math.sign((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x));
  const n = pts.length;
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const [a, b] = [pts[i]!, pts[(i + 1) % n]!];
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const [c, d] = [pts[j]!, pts[(j + 1) % n]!];
      if (Math.max(a.x, b.x) < Math.min(c.x, d.x) || Math.max(c.x, d.x) < Math.min(a.x, b.x) || Math.max(a.z, b.z) < Math.min(c.z, d.z) || Math.max(c.z, d.z) < Math.min(a.z, b.z)) continue;
      if (side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0) out.push([i, j]);
    }
  }
  return out;
};

describe("the squares' routes by the map's barriers (G-613)", () => {
  it("walks Podwale's footway at least 1 m off the retaining wall w67626198", () => {
    // Short of the map's east edge at x 760, which cuts the wall and the footway (T-049): the routes turn back there.
    const w = nearestAlong((id) => /^stare-miasto-1-[01]-square-/.test(id), barrierLines((id) => id === "w67626198"), (p) => p.x < 759);
    expect(w.d, `a route at ${w.at} is ${w.d.toFixed(2)} m from the wall`).toBeGreaterThanOrEqual(0.95);
  });

  it("runs no square's or alley's route on a barrier along it", () => {
    // 2777 quarter metres within 0.7 m before G-613; what is left under 1 m are turns round a planter's corner (krakowskie-1-1) and the map's edge.
    const w = nearestAlong((id) => id.includes("-square-"), barrierLines(() => true), () => true);
    expect(w.d, `a route at ${w.at} is ${w.d.toFixed(2)} m from ${w.id}`).toBeGreaterThan(0.6);
  });

  it("moves no square's or alley's route into loops of its own", () => {
    // A footway's way that comes back to a node of its own (w364587755, a loop on a tail) laid one band over itself (G-654).
    const crossed = CROWD_LANES.filter((l) => l.id.includes("-square-")).flatMap((l) => {
      const pts = l.points.map(([x, z]): P => ({ x, z }));
      return crossings(pts).map(([i, j]) => `${l.id} ${i}x${j} at ${pts[i]!.x.toFixed(1)}, ${pts[i]!.z.toFixed(1)}`);
    });
    expect(crossed).toEqual([]);
  });

  it("keeps the wall under the Archikatedra in the game over 170 of its 183 m", () => {
    const [line] = barrierLines((id) => id === "w67626198");
    const pieces = Object.values(WORLD_BARRIERS)
      .flat()
      .filter((i) => barrierLayout(i.variant).kind === "retaining-wall");
    let total = 0;
    let kept = 0;
    for (const l of barrierLines((id) => id === line?.id)) {
      l.pts.slice(1).forEach((b, k) => {
        const a = l.pts[k]!;
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        const n = Math.max(1, Math.ceil(len / 0.5));
        for (let i = 0; i < n; i++) {
          const p = { x: a.x + ((b.x - a.x) * (i + 0.5)) / n, z: a.z + ((b.z - a.z) * (i + 0.5)) / n };
          total += len / n;
          if (pieces.some((it) => Math.abs(it.x - p.x) < 10 && Math.abs(it.z - p.z) < 10 && distanceToBarrier(it, p.x, p.z) <= 0.15)) kept += len / n;
        }
      });
    }
    expect(total).toBeGreaterThan(180);
    expect(kept, `${kept.toFixed(0)} of ${total.toFixed(0)} m kept`).toBeGreaterThan(170);
  });
});
