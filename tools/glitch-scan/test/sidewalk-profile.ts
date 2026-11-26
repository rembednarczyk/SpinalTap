import type { GroundSurface } from "../../../packages/core/src";

/**
 * The sidewalks as the game draws them, measured the way a road survey measures a street: stations
 * along the axis and offsets out from the kerb (linear referencing, GIS; a road inventory's cross
 * sections). At each station, on each side, the samples from the carriageway's edge outwards give the
 * walk's band: its surface, its width, the gaps in it and the steps between its pieces. The four kinds
 * of the scan (`sidewalk-surface-patch`, `sidewalk-gap`, `sidewalk-step`, `sidewalk-width-jump`) read
 * the profiles stretch by stretch, from junction to junction, against the district's rule
 * (`sidewalk-rules.ts`). It reads the drawn ground, not the import's strips: what the player sees.
 */

/** What the profile reads of the ground. */
export interface GroundLookup {
  /** The surfaces drawn at (x, z), any order. */
  readonly surfaces: (x: number, z: number) => readonly GroundSurface[];
  /** How far the drawn surface at (x, z) is lifted above the ground (`surfaceLiftAt`). */
  readonly lift: (x: number, z: number) => number;
  /** Is (x, z) in a building? The walk ends at its wall. */
  readonly building: (x: number, z: number) => boolean;
}

export type Pt = { readonly x: number; readonly z: number };

/** The surfaces a walk is paved with. */
export const WALK: ReadonlySet<GroundSurface> = new Set<GroundSurface>(["sidewalk", "footway", "square", "cobble"]);
const CARRIAGEWAY: ReadonlySet<GroundSurface> = new Set<GroundSurface>(["road", "crossing", "rail"]);

/** Stations along the axis (m). */
export const STATION = 1;
/** Samples across, out from the kerb (m). */
export const ACROSS = 0.25;
/** How far out from the kerb a walk is looked for (m). */
export const REACH = 8;
/** How far out from the axis the kerb is looked for, past the carriageway's reach (m). */
const KERB_SLACK = 3;
/** A walk starts this near the kerb, or the station has none (m): a kerb's stone, a gutter. */
const START = 0.5;

/** The strip by the kerb a sidewalk is judged on (m): past it lie forecourts and yards, paved as they are. */
export const STRIP = 2;

/** One sample across: its surface (the one drawn on top), or what ends the walk. */
export type Sample = GroundSurface | "bare" | "building";

/** The surface drawn at (x, z): the walk's own over others, the highest lifted among them. */
export const drawnSurface = (g: GroundLookup, x: number, z: number): Sample => {
  if (g.building(x, z)) return "building";
  const s = g.surfaces(x, z);
  if (s.length === 0) return "bare";
  const walk = s.filter((k) => WALK.has(k));
  if (walk.length > 0) return walk.includes("sidewalk") ? "sidewalk" : walk.includes("footway") ? "footway" : walk.includes("square") ? "square" : "cobble";
  return s.some((k) => CARRIAGEWAY.has(k)) ? "road" : s[0]!;
};

/** A station's side: the walk's band out from the kerb, or null where none starts by the kerb. */
export interface SideProfile {
  /** Where the kerb is, m out from the axis. */
  readonly kerb: number;
  /** The band's surface: the one most of its samples have. */
  readonly surface: GroundSurface;
  /** The strip by the kerb: the surface most of the band's first `STRIP` m have, how far that surface runs unbroken from the band's start (m) and what lies past it. */
  readonly strip: { readonly surface: GroundSurface; readonly width: number; readonly next: Sample | "reach" };
  /** m from the kerb to the band's last walk sample, gaps included. */
  readonly width: number;
  /** m of samples in the band that are no walk (bare ground, grass, a road) with walk beyond them. */
  readonly gap: number;
  /** The largest change of the drawn surface's lift between neighbouring samples of the band (m). */
  readonly step: number;
  /** Where the band ends: a building, a road, the reach, or ground that is no walk (bare, grass, water). */
  readonly end: "building" | "road" | "reach" | "open";
}

/** The most a band may hold of no walk between its pieces before it ends (m): a tree's bed, a drain. */
export const BRIDGE = 1.5;

/** The side of the axis at `at` along unit normal `n` (pointing out), the carriageway's reach `reach` m. */
export const sideProfile = (g: GroundLookup, at: Pt, n: Pt, reach: number): SideProfile | null => {
  const onRoad = (d: number) => drawnSurface(g, at.x + n.x * d, at.z + n.z * d) === "road";
  let kerb = -1;
  for (let d = 0; d <= reach + KERB_SLACK; d += ACROSS) {
    if (!onRoad(d)) {
      kerb = d;
      break;
    }
  }
  if (kerb < 0) return null;
  const samples: Sample[] = [];
  const lifts: number[] = [];
  for (let d = kerb; d <= kerb + REACH + 1e-9; d += ACROSS) {
    const x = at.x + n.x * d;
    const z = at.z + n.z * d;
    samples.push(drawnSurface(g, x, z));
    lifts.push(g.lift(x, z));
  }
  const first = samples.findIndex((s) => s !== "bare" && s !== "grass");
  if (first < 0 || first * ACROSS > START || !WALK.has(samples[first] as GroundSurface)) return null;
  // The band: walk samples, with runs of no walk up to BRIDGE between them.
  let last = first;
  let run = 0;
  let gap = 0;
  let end: SideProfile["end"] = "reach";
  for (let i = first + 1; i < samples.length; i++) {
    const s = samples[i]!;
    if (WALK.has(s as GroundSurface)) {
      gap += run;
      run = 0;
      last = i;
      continue;
    }
    if (s === "building" || s === "road") {
      end = s;
      break;
    }
    run += ACROSS;
    if (run > BRIDGE) {
      end = "open";
      break;
    }
  }
  if (end === "reach" && run > 0) end = "open";
  const counts = new Map<GroundSurface, number>();
  let step = 0;
  for (let i = first; i <= last; i++) {
    const s = samples[i]!;
    if (WALK.has(s as GroundSurface)) counts.set(s as GroundSurface, (counts.get(s as GroundSurface) ?? 0) + 1);
    if (i > first && WALK.has(s as GroundSurface) && WALK.has(samples[i - 1] as GroundSurface)) step = Math.max(step, Math.abs(lifts[i]! - lifts[i - 1]!));
  }
  const most = (m: Map<GroundSurface, number>) => [...m].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]![0];
  const near = new Map<GroundSurface, number>();
  for (let i = first; i <= last && (i - first) * ACROSS < STRIP; i++) {
    const s = samples[i]!;
    if (WALK.has(s as GroundSurface)) near.set(s as GroundSurface, (near.get(s as GroundSurface) ?? 0) + 1);
  }
  const stripSurface = most(near);
  let to = first;
  while (to + 1 <= last && samples[to + 1] === stripSurface) to++;
  const strip = { surface: stripSurface, width: samples[first] === stripSurface ? (to + 1 - first) * ACROSS : 0, next: samples[to + 1] ?? ("reach" as const) };
  return { kerb, surface: most(counts), strip, width: (last + 1) * ACROSS - first * ACROSS, gap, step, end };
};

/** A station: where it is along its stretch and both sides' profiles. */
export interface Station {
  readonly at: Pt;
  readonly left: SideProfile | null;
  readonly right: SideProfile | null;
}

/** Points every `STATION` m along a polyline, with the unit normal to the left of the way it runs. */
export const stations = (line: readonly Pt[]): { at: Pt; left: Pt }[] => {
  const out: { at: Pt; left: Pt }[] = [];
  let carry = 0;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 1e-6) continue;
    const t = { x: (b.x - a.x) / len, z: (b.z - a.z) / len };
    for (let s = carry; s < len; s += STATION) out.push({ at: { x: a.x + t.x * s, z: a.z + t.z * s }, left: { x: -t.z, z: t.x } });
    carry = (STATION - ((len - carry) % STATION)) % STATION;
  }
  return out;
};
