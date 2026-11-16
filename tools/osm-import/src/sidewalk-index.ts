/**
 * The map's sidewalks by place, for the carriageways beside them (G-082, T-046, G-655): whether a
 * street has separate sidewalks along it, how far its carriageway may reach short of them, and its
 * lanes fitted side by side to them. Split off `generate` (ADR-0031).
 */
import { type Line } from "./features.ts";
import { type Pt } from "./geometry.ts";
import { roadWidth } from "./ground.ts";
import { type KerbSample, fitLanes } from "./lane-fit.ts";
import { type Tags } from "./osm.ts";

/** `plain`: a point of a footway without `footway=sidewalk` (`kerb` reads it on a street's side tagged `separate`). */
type SidewalkPoint = Pt & { readonly tx: number; readonly tz: number; readonly plain?: true };

/** Samples along a line every `step` metres, with the line's direction there. */
const samplesAlong = (line: readonly Pt[], step: number): (Pt & { tx: number; tz: number })[] => {
  const out: (Pt & { tx: number; tz: number })[] = [];
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k < n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n, tx: (b.x - a.x) / (len || 1), tz: (b.z - a.z) / (len || 1) });
  }
  return out;
};

/**
 * How far short of a mapped sidewalk's axis a fitted carriageway ends, metres: its middle stays off
 * the asphalt where it wiggles a little nearer than the median. Not at the sidewalk's inner edge
 * (2 x (axis - half the sidewalk)): the asphalt under the sidewalk's inner half is what keeps the
 * two-way lanes (1.2 m and more off the axis, ADR-0055) and their cars on the road.
 */
const KERB_MARGIN = 0.5;
/** A street side's mapped sidewalk counts as running along it over this many samples (2 m apart) and more. */
const MIN_KERB_SAMPLES = 5;

/**
 * Whether a footway without `footway=sidewalk` is a street's sidewalk where that street's side
 * says its sidewalk is mapped `separate`ly: Lublin maps many sidewalks as plain footways (the one
 * along Radziwiłłowska by Plac Litewski, G-655). A crossing and a paved area are not.
 */
const plainFootway = (t: Tags): boolean => t.highway === "footway" && t.footway !== "sidewalk" && t.footway !== "crossing" && t.area !== "yes";

/** The sides of a street (left, right of its direction) whose sidewalks the map says are separate ways. */
const separateSides = (t: Tags): [boolean, boolean] => {
  const all = t.sidewalk === "separate" || t["sidewalk:both"] === "separate";
  return [all || t["sidewalk:left"] === "separate", all || t["sidewalk:right"] === "separate"];
};

/** A coarse spatial hash of points along mapped sidewalks (`footway=sidewalk`, and plain footways: `plainFootway`), with their direction. */
export const sidewalkIndex = (lines: readonly Line[]) => {
  const cell = 10;
  const grid = new Map<string, SidewalkPoint[]>();
  const key = (x: number, z: number) => `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
  for (const l of lines) {
    const plain = plainFootway(l.tags);
    if (l.tags.footway !== "sidewalk" && !plain) continue;
    const pts: SidewalkPoint[] = samplesAlong(l.line, 3);
    const end = pts[pts.length - 1];
    if (end) pts.push({ ...l.line[l.line.length - 1]!, tx: end.tx, tz: end.tz });
    for (const p of pts) {
      const list = grid.get(key(p.x, p.z)) ?? [];
      list.push(plain ? { ...p, plain } : p);
      grid.set(key(p.x, p.z), list);
    }
  }
  const around = (p: Pt): SidewalkPoint[] => {
    const out: SidewalkPoint[] = [];
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) out.push(...(grid.get(`${Math.floor(p.x / cell) + dx},${Math.floor(p.z / cell) + dz}`) ?? []));
    return out;
  };
  /**
   * Each sample of the road 2 m apart, its arc length and how far from the axis its carriageway
   * may reach on its left and right (Infinity: no sidewalk there), `KERB_MARGIN` short of its
   * mapped sidewalks running along it (parallel, beside it) with their axis on its carriageway by
   * type; a plain footway counts on the sides `plain` says.
   */
  const kerbSamples = (road: Line, plain: readonly [boolean, boolean]): KerbSample[] => {
    const reach = roadWidth(road.tags) / 2;
    let at = 0;
    return samplesAlong(road.line, 2).map((p, i, all) => {
      if (i > 0) at += Math.hypot(p.x - all[i - 1]!.x, p.z - all[i - 1]!.z);
      const kerb: [number, number] = [Infinity, Infinity];
      for (const q of around(p)) {
        const along = (q.x - p.x) * p.tx + (q.z - p.z) * p.tz;
        const across = (q.z - p.z) * p.tx - (q.x - p.x) * p.tz;
        if (Math.abs(along) > 2 || Math.abs(across) >= reach || Math.abs(q.tx * p.tx + q.tz * p.tz) < 0.9) continue;
        const side = across >= 0 ? 0 : 1;
        if (q.plain && !plain[side]) continue;
        kerb[side] = Math.min(kerb[side], Math.abs(across) - KERB_MARGIN);
      }
      return { at, kerb };
    });
  };
  return {
    /** True when separate sidewalks run along at least a third of the road. */
    along: (road: Line): boolean => {
      const reach = roadWidth(road.tags) / 2 + 7;
      const samples = samplesAlong(road.line, 8);
      const near = samples.filter((p) => around(p).some((q) => !q.plain && Math.hypot(q.x - p.x, q.z - p.z) <= reach)).length;
      return samples.length > 0 && near / samples.length >= 1 / 3;
    },
    /**
     * How far from the road's axis its carriageway may reach, `KERB_MARGIN` short of its mapped
     * sidewalks where they run along it (parallel, beside it) with their axis on its carriageway
     * by type: the median on each side, the nearer side's. Only a side whose sidewalk runs along
     * half the road and more counts (`MIN_KERB_SAMPLES` at least): a sidewalk turning in to a
     * crossing at a junction says nothing of the rest of the street (T-062). Null without one.
     */
    kerb: (road: Line): number | null => {
      const samples = kerbSamples(road, [false, false]);
      const sides = [0, 1].map((side) => samples.flatMap((p) => (Number.isFinite(p.kerb[side]) ? [p.kerb[side]!] : [])));
      const medians = sides.filter((s) => s.length >= MIN_KERB_SAMPLES && s.length * 2 >= samples.length).map((s) => [...s].sort((a, b) => a - b)[Math.floor(s.length / 2)]!);
      return medians.length > 0 ? Math.min(...medians) : null;
    },
    /**
     * A street of mapped `lanes` (G-655) fitted side by side and stretch by stretch to its
     * sidewalks and, on a side tagged `separate`, its plain footways (`plainFootway`, `fitLanes`):
     * its carriageway's pieces, or null where none runs along it.
     */
    lanes: (road: Line): Line[] | null => (Number(road.tags.lanes) > 0 ? fitLanes(road, kerbSamples(road, separateSides(road.tags)), MIN_KERB_SAMPLES) : null),
  };
};
