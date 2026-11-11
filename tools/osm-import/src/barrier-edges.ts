/**
 * Barriers that run along a carriageway or a flight of steps (ADR-0077, G-607, G-608): the map
 * draws a wall or a fence on the edge of the way, its line a little inside the band the import
 * lays at the way's width by type. Cut there, a whole kerbside fence or the walls of a flight
 * would go; so a barrier running along the band (under 30 degrees to its axis) is moved out to
 * its edge, its face `EDGE_MARGIN` past it, and only one crossing the band is cut.
 */
import { BARRIER_THICKNESS, type BarrierKind } from "../../../packages/core/src/world/barriers.ts";
import { type Line } from "./features.ts";
import { type Pt, type Rect, lineLength, pointAlong, ringBounds, simplifyLine } from "./geometry.ts";
import { isCarriageway, pathWidth, roadWidth } from "./ground.ts";

/** A barrier's face stands this far outside the band it runs along (m). */
export const EDGE_MARGIN = 0.15;
/** Along a band: under 30 degrees to its axis, as a way crossing a barrier at 30 degrees and more cuts it. */
const ALONG_SINE = 0.5;
/** Samples along a barrier for the move (m). */
const STEP = 0.5;

/** A band's axis segment and its half width. */
export interface BandAxis {
  readonly a: Pt;
  readonly b: Pt;
  readonly half: number;
  readonly box: Rect;
}

/** The axes of the carriageways' and the steps' bands, as `lineBands` lays them. */
export const bandAxes = (lines: readonly Line[]): BandAxis[] => {
  const out: BandAxis[] = [];
  for (const l of lines) {
    const t = l.tags;
    const half = isCarriageway(t) ? roadWidth(t) / 2 : t.highway === "steps" && t.area !== "yes" ? pathWidth(t) / 2 : 0;
    if (half <= 0) continue;
    for (let i = 0; i + 1 < l.line.length; i++) {
      const [a, b] = [l.line[i]!, l.line[i + 1]!];
      const box = ringBounds([a, b]);
      out.push({ a, b, half, box: { minX: box.minX - half - 2, minZ: box.minZ - half - 2, maxX: box.maxX + half + 2, maxZ: box.maxZ + half + 2 } });
    }
  }
  return out;
};

/** The point of segment a-b nearest p. */
const foot = (p: Pt, a: Pt, b: Pt): Pt => {
  const [dx, dz] = [b.x - a.x, b.z - a.z];
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return { x: a.x + dx * t, z: a.z + dz * t };
};

/** The sine of the angle between directions u and v. */
const sine = (u: Pt, v: Pt): number => (u.x * v.z - u.z * v.x) / (Math.hypot(u.x, u.z) * Math.hypot(v.x, v.z) || 1);

/** A barrier's line sampled every `STEP` metres, its corners kept. */
const samples = (line: readonly Pt[]): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < line.length; i++) {
    const seg = [line[i]!, line[i + 1]!];
    const n = Math.max(1, Math.ceil(lineLength(seg) / STEP));
    for (let k = 0; k < n; k++) out.push(pointAlong(seg, (lineLength(seg) * k) / n));
  }
  if (line.length > 0) out.push(line[line.length - 1]!);
  return out;
};

/**
 * A barrier's line with its stretches along a band moved out of it: each sample within the band
 * (and the barrier's half thickness and `EDGE_MARGIN`) of an axis it runs along goes square off
 * that axis to the edge, on its own side. What crosses a band stays where it is, for the cut.
 */
export const outOfBands = (line: readonly Pt[], kind: BarrierKind, axes: readonly BandAxis[]): Pt[] => {
  const box = ringBounds(line);
  const near = axes.filter((x) => x.box.minX <= box.maxX && x.box.maxX >= box.minX && x.box.minZ <= box.maxZ && x.box.maxZ >= box.minZ);
  if (near.length === 0) return [...line];
  const reach = BARRIER_THICKNESS[kind] / 2 + EDGE_MARGIN;
  const pts = samples(line);
  let moved = false;
  const out = pts.map((p, k) => {
    const dir = { x: pts[Math.min(k + 1, pts.length - 1)]!.x - pts[Math.max(k - 1, 0)]!.x, z: pts[Math.min(k + 1, pts.length - 1)]!.z - pts[Math.max(k - 1, 0)]!.z };
    let q = p;
    for (const x of near) {
      const f = foot(q, x.a, x.b);
      const d = Math.hypot(q.x - f.x, q.z - f.z);
      const want = x.half + reach;
      if (d >= want || Math.abs(sine(dir, { x: x.b.x - x.a.x, z: x.b.z - x.a.z })) >= ALONG_SINE) continue;
      // Square off the axis, on the barrier's side of it (the axis's left when it lies on it).
      const n = d > 1e-6 ? { x: (q.x - f.x) / d, z: (q.z - f.z) / d } : (() => {
        const l = Math.hypot(x.b.x - x.a.x, x.b.z - x.a.z) || 1;
        return { x: -(x.b.z - x.a.z) / l, z: (x.b.x - x.a.x) / l };
      })();
      q = { x: f.x + n.x * want, z: f.z + n.z * want };
      moved = true;
    }
    return q;
  });
  return moved ? simplifyLine(out, 0.05) : [...line];
};
