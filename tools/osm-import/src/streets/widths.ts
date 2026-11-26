/**
 * The width of a street's carriageway by the order of the sources (ADR-0104 pkt 4): the map's own
 * `width` → BDOT10k's carriageway (`OT_SKJZ_L.SZEROKOSCNAWIERZCHNI`, `pnpm gugik:roads`) → the
 * orthophoto's measure (ADR-0080 PR 10) → the width fitted to the mapped sidewalks → the estimate by
 * type. Each width carries its source, and a report tells how much of the streets' length each
 * gives, and where two of them disagree by more than `CONFLICT` (a matter for review, not for a
 * choice by the look of the photo).
 *
 * Pattern: conflation with an explicit source priority and the provenance of every value (as GIS
 * conflation tools keep a source per attribute); BDOT10k's carriageway is matched to the street's
 * axis by distance and heading (map matching, as `along-footways.ts`).
 */
import { type Carriageway, loadCarriageways } from "../../../gugik/src/extracts.ts";
import { parseLength } from "../building-tags.ts";
import { orthoSides } from "../corrections-kerb.ts";
import { type Pt, lineLength } from "../geometry.ts";
import { type Tags } from "../osm.ts";

export type WidthSource = "osm" | "bdot10k" | "ortho" | "fitted" | "default";

/** The step of the samples along a street's axis (m). */
const STEP = 2;
/** How far from the axis a BDOT10k carriageway's line may run and still be the street's (m). */
const NEAR = 3;
/** |cos| of the angle between the axis and the carriageway's line. */
const PARALLEL = 0.9;
/** The share of the axis's samples a BDOT10k carriageway must run beside. */
const SHARE = 0.5;
/** Two sources further apart than this are a conflict (m). */
export const CONFLICT = 1;

let cache: readonly Carriageway[] | undefined;
/** The BDOT10k carriageways of `data/gugik/jezdnie.json`, read once. */
export const carriageways = (): readonly Carriageway[] => (cache ??= loadCarriageways());

/** Samples every `STEP` m along a line, each with its direction. */
const samples = (line: readonly Pt[]): { p: Pt; d: Pt }[] => {
  const out: { p: Pt; d: Pt }[] = [];
  for (let i = 0; i + 1 < line.length; i++) {
    const [a, b] = [line[i]!, line[i + 1]!];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 1e-6) continue;
    const d = { x: (b.x - a.x) / len, z: (b.z - a.z) / len };
    for (let u = STEP / 2; u < len; u += STEP) out.push({ p: { x: a.x + d.x * u, z: a.z + d.z * u }, d });
  }
  return out;
};

/** The width BDOT10k gives the carriageway along `axis`: the median of the matched samples' widths; null where it runs beside too little of it. */
export const bdotWidth = (axis: readonly Pt[], from: readonly Carriageway[] = carriageways()): number | null => {
  const ss = samples(axis);
  if (ss.length === 0) return null;
  const box = axis.reduce((b, p) => ({ minX: Math.min(b.minX, p.x), maxX: Math.max(b.maxX, p.x), minZ: Math.min(b.minZ, p.z), maxZ: Math.max(b.maxZ, p.z) }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
  const near = from.filter((c) => c.width !== null && c.line.some((q) => q.x > box.minX - NEAR - 50 && q.x < box.maxX + NEAR + 50 && q.z > box.minZ - NEAR - 50 && q.z < box.maxZ + NEAR + 50));
  const widths: number[] = [];
  for (const { p, d } of ss) {
    let best: { dist: number; width: number } | null = null;
    for (const c of near)
      for (let i = 0; i + 1 < c.line.length; i++) {
        const [a, b] = [c.line[i]!, c.line[i + 1]!];
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        if (len < 1e-6 || Math.abs(((b.x - a.x) * d.x + (b.z - a.z) * d.z) / len) < PARALLEL) continue;
        const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.z - a.z) * (b.z - a.z)) / (len * len)));
        const dist = Math.hypot(a.x + (b.x - a.x) * t - p.x, a.z + (b.z - a.z) * t - p.z);
        if (dist <= NEAR && (!best || dist < best.dist)) best = { dist, width: c.width! };
      }
    if (best) widths.push(best.width);
  }
  if (widths.length < ss.length * SHARE) return null;
  const s = [...widths].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
};

/** A side's half width of the carriageway and where it comes from. */
export interface SideWidth {
  readonly half: number;
  readonly source: WidthSource;
}

/**
 * The carriageway's half width on each side by the order of the sources: `half` is the import's
 * own (`kerb.half`: the orthophoto's, the fitted or the estimate, as `ortho` and `estimated` say).
 */
export const streetWidth = (tags: Tags, half: number, ortho: boolean, estimated: (side: 1 | -1) => boolean, bdot: number | null): [SideWidth, SideWidth] => {
  const osm = parseLength(tags.width);
  // BDOT10k and the orthophoto's measure further apart than `CONFLICT`: the measure the street is laid
  // with now stays, the traffic's lanes with it, and the conflict goes to the review (`WidthReport`).
  const disputed = bdot !== null && ortho && Math.abs(bdot - 2 * half) > CONFLICT;
  const side = (s: 1 | -1): SideWidth =>
    osm !== null
      ? { half: osm / 2, source: "osm" }
      : bdot !== null && !disputed
        ? { half: bdot / 2, source: "bdot10k" }
        : ortho
          ? { half, source: "ortho" }
          : !estimated(s)
            ? { half, source: "fitted" }
            : { half, source: "default" };
  return [side(1), side(-1)];
};

/** A street's sides' widths by the order of the sources, added to `report`: `half` and `estimated` the import's own (`kerb.half`, `estimatedSide`). */
export const sourcedWidth = (way: string, tags: Tags, axis: readonly Pt[], half: number, estimated: (source: string, side: 1 | -1) => boolean, report: WidthReport): [SideWidth, SideWidth] => {
  const ortho = orthoSides(way) !== undefined;
  const bdot = bdotWidth(axis);
  const sides = streetWidth(tags, half, ortho, (side) => estimated(way, side), bdot);
  report.add(way, tags.name ?? "", axis, sides, half, bdot, ortho);
  return sides;
};

/** The provenance report of a district's streets: length by source, and the conflicts between them. */
export class WidthReport {
  private readonly length = new Map<WidthSource, number>();
  private readonly conflicts: string[] = [];

  /** A street's two sides, its length, and the import's own width beside BDOT10k's where both are. */
  add(way: string, name: string, axis: readonly Pt[], sides: readonly [SideWidth, SideWidth], own: number, bdot: number | null, ortho: boolean): void {
    const len = lineLength(axis) / 2;
    for (const s of sides) this.length.set(s.source, (this.length.get(s.source) ?? 0) + len);
    if (bdot !== null && ortho && Math.abs(bdot - 2 * own) > CONFLICT) this.conflicts.push(`${way} ${name}: BDOT10k ${bdot} m, orthophoto ${(2 * own).toFixed(1)} m`);
  }

  toString(): string {
    const total = [...this.length.values()].reduce((a, b) => a + b, 0) || 1;
    const by = (["osm", "bdot10k", "ortho", "fitted", "default"] as const).map((s) => `${s} ${((this.length.get(s) ?? 0) / 1000).toFixed(2)} km (${((100 * (this.length.get(s) ?? 0)) / total).toFixed(1)}%)`).join(", ");
    return `street graph widths (ADR-0104 pkt 4), carriageway sides: ${by}; conflicts over ${CONFLICT} m: ${this.conflicts.length}${this.conflicts.length ? ` (${this.conflicts.slice(0, 20).join("; ")})` : ""}`;
  }
}
