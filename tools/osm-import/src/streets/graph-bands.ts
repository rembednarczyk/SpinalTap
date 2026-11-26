/**
 * The streets of the districts on the street graph laid from it (ADR-0104, stages E2-E3): in the
 * bands after `cutSidewalk`, the carriageways and sidewalks of the streets with a carriageway in
 * those districts are replaced by the pieces of `streetAreas` within the districts; outside them
 * the old bands stay, cut at the districts' edge. A street's carriageway pieces keep its `kerb`
 * (the traffic's lanes read their halves off it, `streetHalves`) and are `graph`: `kerbFills`
 * neither widens them nor lays strips by them, as their sidewalks reach the kerb by construction.
 *
 * A street's sidewalk on a side: the one its tags give there (`sidewalk:<side>`, `sidewalk:width` or
 * 3 m by a primary or secondary street and 2.5 m by the rest, as `roadSection`), else the sidewalk
 * mapped on its own beside it (`footway=sidewalk`, ADR-0080's `mapped-way`: from the kerb out to the
 * mapped strip's far edge, the median along the street), else none. The mapped strips in the
 * districts are laid with the streets' as one (`walks`), not as bands of their own.
 *
 * `SEKI_STREET_GRAPH` (comma-separated district ids) adds districts for a trial build (E2).
 */
import { parseLength } from "../building-tags.ts";
import { type Band } from "../ground.ts";
import { ALL_CHUNKS } from "../config.ts";
import { type Line } from "../features.ts";
import { type Pt, type Rect, lineLength, offsetLine, pointInRing, rectsOverlap, ringBounds, signedArea } from "../geometry.ts";
import { type Tags } from "../osm.ts";
import { type Area, areaOfRing, grown, join, less, rings, within } from "./clip.ts";
import { STREETS, footwaysAlongStreets } from "./along-footways.ts";
import { type StreetEdge, streetAreas } from "./street-ground.ts";

/** The districts whose streets are laid from the street graph (ADR-0104 E3 on), by slug. */
export const STREET_GRAPH_DISTRICTS: ReadonlySet<string> = new Set<string>([]);

/** The districts of this build: the constant's, and the trial's from `SEKI_STREET_GRAPH`. */
export const graphDistricts = (): ReadonlySet<string> => new Set([...STREET_GRAPH_DISTRICTS, ...(process.env.SEKI_STREET_GRAPH ?? "").split(",").filter((s) => s !== "")]);

/**
 * The kerb's corner radius by the street's type: 4 m by a primary or secondary street, 3 m by the
 * rest. ADR-0080 had 6 m by the main streets; a fillet reaches r / tan(θ / 2) along each kerb, and at
 * the city's acute corners (30-45°) 6 m flooded 15-22 m of the corner with asphalt (ADR-0104 E2).
 */
const kerbRadius = (highway: string): number => (highway.startsWith("primary") || highway.startsWith("secondary") ? 4 : 3);

/** How far out from the kerb a mapped sidewalk beside a street is read as its sidewalk (m, as `sidewalkIndex`). */
const MAPPED_REACH = 7;
/** The narrowest gap to a mapped sidewalk that is asphalt by a street of estimated width (m, `kerbFills`' `ROAD_GAP`). */
const ROAD_GAP = 1;
/** The narrowest and widest sidewalk read off a mapped one (m). */
const [WALK_MIN, WALK_MAX] = [1.5, 6];
/** The step along a mapped sidewalk its offsets are read at (m). */
const PROBE = 2;

/** Each point of `line` every `PROBE` m. */
const probes = (line: readonly Pt[]): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < line.length; i++) {
    const [a, b] = [line[i]!, line[i + 1]!];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / PROBE));
    for (let k = 0; k < n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n });
  }
  return out;
};

/** The signed offset of `p` from `axis` (left positive, as `offsetLine`), where it lies beside a segment of it. */
const offsetFrom = (axis: readonly Pt[], p: Pt): number | null => {
  let best: number | null = null;
  for (let i = 0; i + 1 < axis.length; i++) {
    const [a, b] = [axis[i]!, axis[i + 1]!];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 1e-9) continue;
    const t = ((p.x - a.x) * (b.x - a.x) + (p.z - a.z) * (b.z - a.z)) / (len * len);
    if (t < 0 || t > 1) continue;
    // `offsetLine`'s left: the normal (-dz, dx).
    const side = ((p.x - a.x) * -(b.z - a.z) + (p.z - a.z) * (b.x - a.x)) / len;
    if (best === null || Math.abs(side) < Math.abs(best)) best = side;
  }
  return best;
};

const median = (xs: readonly number[]): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
};

/** A mapped sidewalk: its way's line and its band's width (area over half its outline). */
interface Mapped {
  readonly line: readonly Pt[];
  readonly width: number;
  readonly box: Rect;
}

const perimeter = (r: readonly Pt[]) => r.reduce((s, p, i) => s + Math.hypot(r[(i + 1) % r.length]!.x - p.x, r[(i + 1) % r.length]!.z - p.z), 0);

/** A side's mapped sidewalk beside the kerb: how far out its near edge and its far edge lie (m past the kerb, medians along the street); null if none. */
const mappedWalk = (axis: readonly Pt[], half: number, side: 1 | -1, mapped: readonly Mapped[]): { near: number; far: number } | null => {
  const near: number[] = [];
  const far: number[] = [];
  const box = ringBounds(axis);
  const reach = half + MAPPED_REACH;
  for (const m of mapped) {
    if (!rectsOverlap(m.box, { minX: box.minX - reach, maxX: box.maxX + reach, minZ: box.minZ - reach, maxZ: box.maxZ + reach })) continue;
    for (const p of probes(m.line)) {
      const o = offsetFrom(axis, p);
      if (o === null || Math.sign(o) !== side || Math.abs(o) < half || Math.abs(o) > reach) continue;
      near.push(Math.max(0, Math.abs(o) - half - m.width / 2));
      far.push(Math.abs(o) - half + m.width / 2);
    }
  }
  const [n, f] = [median(near), median(far)];
  // Read only where it runs beside a good part of the street, not where it crosses its end.
  if (n === null || f === null || far.length * PROBE < lineLength(axis) / 3) return null;
  return { near: n, far: Math.min(WALK_MAX, Math.max(WALK_MIN, f)) };
};

/** A side's sidewalk tag: `sidewalk:<side>`, else `sidewalk:both`, else what `sidewalk` says of that side. */
const sideTag = (t: Tags, side: 1 | -1): string | undefined => {
  const own = t[side > 0 ? "sidewalk:left" : "sidewalk:right"] ?? t["sidewalk:both"];
  if (own !== undefined) return own;
  const s = t.sidewalk;
  if (s === "both" || s === "yes" || s === "separate" || s === "no" || s === "none") return s === "both" ? "yes" : s;
  if (s === "left" || s === "right") return (s === "left") === side > 0 ? "yes" : "no";
  return undefined;
};

/**
 * A side's sidewalk by the tags: its width where they give one (`sidewalk:width`, else 3 m by a
 * primary or secondary street and 2.5 m by the rest, as `roadSection`), 0 where they say there is
 * none, null where they leave it to the sidewalk mapped on its own (`separate`) or say nothing.
 */
const taggedWalk = (t: Tags, side: 1 | -1): number | null => {
  const v = sideTag(t, side);
  if (v === "no" || v === "none") return 0;
  if (v !== "yes") return null;
  return parseLength(t["sidewalk:width"]) ?? (t.highway === "primary" || t.highway === "secondary" ? 3 : 2.5);
};

type Boxed<B> = B & { box: Rect };

/** The widest gap between a street and the ground beside it closed (m): as `kerbFills`' `KERB_REACH`. */
const GAP = 3;
/** Half the narrowest gap laid (m): narrower, the chunks' rounding to 0.1 m crosses it over. */
const THIN = 0.1;
/** How far out from the kerb the gaps are closed (m): a wide sidewalk and the gap past it. */
const GAP_REACH = 6 + GAP;

/**
 * The bare gaps up to `GAP` across between a street (its carriageway and sidewalks) and the paving
 * or the buildings beside it, laid as sidewalk: what `kerbFills` closed strip by strip, here as the
 * morphological closing of all the ground at once (dilate, then erode by `GAP / 2`), less the
 * ground, within `GAP_REACH` of the kerb.
 */
const kerbGaps = (c: Area, sidewalks: Area, beside: readonly Band[], buildings: readonly (readonly Pt[])[]): Area => {
  const ground = join(c, sidewalks, ...beside.map((b) => areaOfRing(b.ring)), ...buildings.map(areaOfRing));
  const gaps = within(less(grown(grown(ground, GAP / 2), -GAP / 2), ground), grown(c, GAP_REACH));
  // Opened by `THIN`: a seam narrower than the chunks' rounding to 0.1 m would cross itself once rounded.
  return grown(grown(gaps, -THIN), THIN);
};

/** The bands with the districts' streets laid from the street graph (see the head of the file). */
export const graphBands = <B extends Band>(
  bands: readonly Boxed<B>[],
  lines: readonly Line[],
  buildings: readonly (readonly Pt[])[],
  estimated: (source: string, side: 1 | -1) => boolean,
  districts = graphDistricts(),
): Boxed<B>[] => {
  if (districts.size === 0) return [...bands];
  const rects = ALL_CHUNKS.filter((c) => districts.has(c.district.slug) || districts.has(c.district.id)).map((c) => c.rect);
  if (rects.length === 0) return [...bands];
  const inside = (box: Rect) => rects.some((r) => rectsOverlap(r, box));
  const region: Area = join(...rects.map((r) => areaOfRing([{ x: r.minX, z: r.minZ }, { x: r.maxX, z: r.minZ }, { x: r.maxX, z: r.maxZ }, { x: r.minX, z: r.maxZ }])));
  const tags = new Map(lines.map((l) => [l.id, l.tags]));
  const streets = bands.filter((b) => b.carriageway && b.kerb && !b.bridge && !b.patch && STREETS.has(tags.get(b.source)?.highway ?? "") && inside(b.box));
  const ways = new Set(streets.map((b) => b.source));
  // The sidewalks mapped on their own in the districts: read for the streets' widths, laid with theirs.
  // A plain footway along a street is its sidewalk too (map matching, `footwaysAlongStreets`), but not one beside a mapped place.
  const places = bands.filter((b) => !b.along && !b.carriageway && (b.surface === "square" || b.surface === "cobble") && inside(b.box)).map((b) => b.ring);
  const along = footwaysAlongStreets(lines, places);
  const mapped = bands.filter((b) => (b.surface === "sidewalk" || b.surface === "footway") && !ways.has(b.source) && (tags.get(b.source)?.footway === "sidewalk" || along.has(b.source)) && inside(b.box));
  const lineOf = new Map(lines.map((l) => [l.id, l.line]));
  const mappedWays: Mapped[] = mapped.flatMap((b) => {
    const line = lineOf.get(b.source);
    return line ? [{ line, width: (2 * Math.abs(signedArea(b.ring))) / Math.max(perimeter(b.ring), 1e-9), box: b.box }] : [];
  });
  const pieces = [...new Map(streets.map((b) => [b.kerb!.line, b])).values()];
  // A side's kerb and sidewalk: by the tags; else to the mapped sidewalk, its asphalt out to it where
  // the street's width is the estimate and the gap a lane's (G-570, T-247: a parking lane or a bay);
  // else the sidewalk by type.
  // The mapped lawns and water in the districts: no sidewalk over them, and one between a kerb and a mapped sidewalk is a verge.
  const greens = bands.filter((b) => (b.surface === "grass" || b.surface === "water") && !b.bridge && inside(b.box));
  const vergeAt = (axis: readonly Pt[], off: number, side: 1 | -1): boolean => {
    const ps = probes(offsetLine(axis, side * off));
    return ps.filter((p) => greens.some((g) => p.x >= g.box.minX && p.x <= g.box.maxX && p.z >= g.box.minZ && p.z <= g.box.maxZ && pointInRing(p, g.ring))).length * 2 > ps.length;
  };
  const sideOf = (b: Boxed<B>, side: 1 | -1): { kerb: number; walk: number } => {
    const half = b.kerb!.half;
    const tagged = taggedWalk(tags.get(b.source)!, side);
    if (tagged !== null) return { kerb: half, walk: tagged };
    const m = mappedWalk(b.kerb!.line, half, side, mappedWays);
    if (m === null) return { kerb: half, walk: 2.5 };
    if (m.near < ROAD_GAP) return { kerb: half, walk: m.far };
    // A lawn in the gap is a verge: the mapped sidewalk stays past it, the kerb where it is.
    if (vergeAt(b.kerb!.line, half + m.near / 2, side)) return { kerb: half, walk: 0 };
    return estimated(b.source, side) ? { kerb: half + m.near, walk: Math.max(WALK_MIN, m.far - m.near) } : { kerb: half, walk: m.far };
  };
  const edges: StreetEdge[] = pieces.map((b) => {
    const [l, r] = [sideOf(b, 1), sideOf(b, -1)];
    return { way: b.source, axis: b.kerb!.line, left: l.kerb, right: r.kerb, walkLeft: l.walk, walkRight: r.walk, kerbRadius: kerbRadius(tags.get(b.source)!.highway!) };
  });
  const near = buildings.filter((r) => inside(ringBounds(r)));
  const areas = streetAreas(edges, [...near, ...greens.map((g) => g.ring)], join(...mapped.map((m) => areaOfRing(m.ring))));
  const laid: Boxed<B>[] = [];
  const add = (from: B, area: Area, more: Partial<Band>) => {
    for (const ring of rings(within(area, region))) laid.push({ ...from, ...more, ring, holed: true, box: ringBounds(ring) } as Boxed<B>);
  };
  for (const o of areas.own) {
    const b = pieces[o.edge]!;
    if (o.surface === "road") add(b, o.area, { graph: true });
    else add({ surface: "sidewalk", ring: [], bridge: false, source: b.source } as unknown as B, o.area, {});
  }
  if (mapped.length > 0) add({ surface: "sidewalk", ring: [], bridge: false, source: mapped[0]!.source } as unknown as B, areas.rest, {});
  // The old bands of those streets and mapped sidewalks: only outside the districts, cut at their edge.
  const replaced = new Set<Band>(mapped);
  const kept = bands.filter((b) => !replaced.has(b) && !(ways.has(b.source) && (b.carriageway || b.along || b.patch || b.slit || b.surface === "sidewalk")) && !b.bridge && inside(b.box));
  // Not to a lawn or water: what lies between the street and the green is the cover's to lay (`bare-cover.ts`).
  if (edges.length > 0) add({ surface: "sidewalk", ring: [], bridge: false, source: edges[0]!.way } as unknown as B, kerbGaps(areas.c, areas.sidewalks, kept.filter((b) => b.surface !== "grass" && b.surface !== "water"), near), {});
  const out: Boxed<B>[] = [];
  for (const b of bands) {
    if (!(ways.has(b.source) && (b.carriageway || b.along || b.patch || b.slit || b.surface === "sidewalk")) && !replaced.has(b)) {
      out.push(b);
      continue;
    }
    for (const ring of rings(less(areaOfRing(b.ring), region))) {
      const { along: _along, ...rest } = b;
      out.push({ ...rest, ring, holed: true, box: ringBounds(ring) } as unknown as Boxed<B>);
    }
  }
  return [...out, ...laid];
};
