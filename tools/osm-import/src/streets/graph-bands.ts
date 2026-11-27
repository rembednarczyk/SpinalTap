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
import { type Pt, type Rect, lineLength, offsetLine, pointInRing, r1, rectsOverlap, ringBounds, selfIntersects, signedArea } from "../geometry.ts";
import { type Tags } from "../osm.ts";
import { COVER } from "../../../orto/src/classify.ts";
import { isCarFree } from "../corrections-car-free.ts";
import { type Area, areaOfRing, grown, holesOf, join, less, rings, within } from "./clip.ts";
import { STREETS, footwaysAlongStreets } from "./along-footways.ts";
import { type StreetEdge, streetAreas } from "./street-ground.ts";
import { weldTJunctions } from "./t-junctions.ts";
import { abutmentJoints } from "./abutment-joints.ts";
import { WidthReport, sourcedWidth } from "./widths.ts";

/** The districts whose streets are laid from the street graph (ADR-0104 E3 on), by slug. */
export const STREET_GRAPH_DISTRICTS: ReadonlySet<string> = new Set<string>(["krakowskie"]);

/** The districts of this build: the constant's, and the trial's from `SEKI_STREET_GRAPH`. */
export const graphDistricts = (): ReadonlySet<string> => new Set([...STREET_GRAPH_DISTRICTS, ...(process.env.SEKI_STREET_GRAPH ?? "").split(",").filter((s) => s !== "")]);

/**
 * The districts on the street graph that a build lays: those of its chunks. A build of chunks in
 * other districts (a test's chunk somewhere on the map's ground) lays its streets the old way,
 * wherever its rect lies; a build of some of a graph district's chunks lays the whole district's graph.
 */
export const builtGraphDistricts = (chunks: readonly { readonly district: { readonly slug: string; readonly id: string } }[]): ReadonlySet<string> =>
  new Set([...graphDistricts()].filter((d) => chunks.some((c) => c.district.slug === d || c.district.id === d)));

/**
 * The kerb's corner radius by the street's type: 4 m by a primary or secondary street, 3 m by the
 * rest. ADR-0080 had 6 m by the main streets; a fillet reaches r / tan(θ / 2) along each kerb, and at
 * the city's acute corners (30-45°) 6 m flooded 15-22 m of the corner with asphalt (ADR-0104 E2).
 */
/** A hole between the places smaller than this is theirs, kept off the sidewalks (m²): a bed between two pavements, not a block. */
const PLACE_HOLE_MAX = 500;

export const kerbRadius = (highway: string): number => (highway.startsWith("primary") || highway.startsWith("secondary") ? 4 : 3);

/** How far out from the kerb a mapped sidewalk beside a street is read as its sidewalk (m, as `sidewalkIndex`). */
const MAPPED_REACH = 7;
/** How far past a kerb another carriageway makes the side a median (m): a dual road's split of up to some 6 m. */
const MEDIAN = 6;
/** The narrowest verge read off the orthophoto (m): narrower, a kerb's shadow or a tree's crown. */
const VERGE_MIN = 0.75;
/** The widest verge read (m), and the step it is read at. */
const [VERGE_MAX, VERGE_STEP] = [4, 0.25];
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

/** The largest bare island within the streets' ground laid whole (m²): a traffic island, a corner's triangle between three streets. */
const ISLAND_MAX = 400;
/** The step of the orthophoto's samples over an island or a verge (m): the cover's cell. */
const ISLAND_STEP = 0.5;

/** The share of a ring's samples (`ISLAND_STEP` apart: the orthophoto cover's own cells) the orthophoto shows green. */
const greenShare = (ring: readonly Pt[], cover: (p: Pt) => number): number => {
  const box = ringBounds(ring);
  const step = ISLAND_STEP;
  let [green, all] = [0, 0];
  for (let x = box.minX + step / 2; x < box.maxX; x += step)
    for (let z = box.minZ + step / 2; z < box.maxZ; z += step)
      if (pointInRing({ x, z }, ring)) {
        all++;
        if (cover({ x, z }) === COVER.green) green++;
      }
  return all === 0 ? 0 : green / all;
};

/**
 * The islands the ground closes round by a street, up to `ISLAND_MAX`: laid whole, as lawn where
 * the orthophoto shows green over most of them, else as a square's paving by a mapped square or
 * pedestrian area, else as sidewalk. Left bare, the sidewalks round a corner's triangle and their gaps closed made a ring of
 * sidewalk round a bare hole (ADR-0104 E2, 185; 85).
 */
const islands = (street: Area, beside: readonly (Band & { readonly box: Rect })[], buildings: readonly (readonly Pt[])[], cover: (p: Pt) => number): { surface: "grass" | "sidewalk" | "square"; area: Area }[] => {
  // The holes of all the ground round the streets: a corner's triangle is bounded by a footway or a lawn as often as by the street.
  const near = beside.filter((b) => !b.bridge && !b.patch);
  const ground = join(street, ...near.map((b) => areaOfRing(b.ring)), ...buildings.map(areaOfRing));
  const touches = grown(street, 0.5);
  // A square's or a pedestrian area's paving: an island by one is its paving, level with it (as step 1 of the sidewalks' uniformity kept a fill by a place).
  const squares = grown(join(...near.filter((b) => b.surface === "square" || b.surface === "cobble").map((b) => areaOfRing(b.ring))), 0.5);
  // A hole by a street the game closes to cars (T-324's deptak, off the graph) is its own: its setts reach the kerb of its bays as before.
  const carFree = grown(join(...near.filter((b) => b.carriageway && isCarFree(b.source)).map((b) => areaOfRing(b.ring))), 0.5);
  return holesOf(ground).flatMap((hole) => {
    const area = areaOfRing(hole);
    if (Math.abs(signedArea(hole)) > ISLAND_MAX || within(area, touches).length === 0 || within(area, carFree).length > 0) return [];
    const paved = within(area, squares).length > 0 ? ("square" as const) : ("sidewalk" as const);
    // Opened by `THIN`, as the gaps: a hole between many bands has seams the rounding to 0.1 m crosses over.
    return [{ surface: greenShare(hole, cover) > 0.5 ? ("grass" as const) : paved, area: grown(grown(area, -THIN), THIN) }];
  });
};

/** The widest gap between a street and the ground beside it closed (m): as `kerbFills`' `KERB_REACH`. */
const GAP = 3;
/**
 * The surfaces that rank over a sidewalk where they meet (`partitionGround`, besides the
 * carriageways). Not the zebras: they are fitted to the kerbs after (`laidZebras`), and their
 * rectangles as the map lays them reach past the kerb, a hole in the sidewalk left bare once fitted.
 */
const OVER_WALKS: ReadonlySet<string> = new Set(["steps", "rail", "basin"]);
/** The surfaces of the map's areas a street's sidewalk stops at: squares, pedestrian areas, carriageways' areas and car parks. */
const PLACES: ReadonlySet<string> = new Set(["square", "cobble", "road"]);
/** Half the narrowest gap laid (m): narrower, the chunks' rounding to 0.1 m crosses it over. */
const THIN = 0.1;
/**
 * A piece as the rounding to 0.1 m leaves it whole: one whose neck the rounding closes crosses
 * itself (`ground-ring-self-cross`), so it is opened by `THIN` (eroded, then dilated) and its necks
 * narrower than twice that are dropped; a piece that rounds well stays as it is.
 */
export const roundable = (ring: readonly Pt[]): Pt[][] =>
  selfIntersects(ring.map((p) => ({ x: r1(p.x), z: r1(p.z) }))) ? rings(grown(grown(areaOfRing(ring), -THIN), THIN)) : [[...ring]];
/** Half the widest niche of a facade a street's sidewalk reaches into (m, `graphBands`): a doorway's. */
const NICHE = 0.3;
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

/**
 * What the orthophoto and the map's green say beside a street: whether a line out from its axis is
 * green (a verge) or paved (the walk), and how wide the green past a kerb is.
 */
const coverReads = <B extends Band>(bands: readonly Boxed<B>[], inside: (box: Rect) => boolean, cover: (p: Pt) => number) => {
  // The mapped lawns and water in the districts: no sidewalk over them, and one between a kerb and a mapped sidewalk is a verge.
  const greens = bands.filter((b) => (b.surface === "grass" || b.surface === "water") && !b.bridge && inside(b.box));
  // The orthophoto's green counts too: many verges are no lawn of the map (G-825, `kerbFills`' strips to the lawn).
  const green = (p: Pt) => cover(p) === COVER.green || greens.some((g) => p.x >= g.box.minX && p.x <= g.box.maxX && p.z >= g.box.minZ && p.z <= g.box.maxZ && pointInRing(p, g.ring));
  const vergeAt = (axis: readonly Pt[], off: number, side: 1 | -1): boolean => {
    const ps = probes(offsetLine(axis, side * off));
    return ps.filter(green).length * 2 > ps.length;
  };
  // Whether the orthophoto shows paving along most of a line `off` m out: the walk itself, not a verge.
  const pavedAt = (axis: readonly Pt[], off: number, side: 1 | -1): boolean => {
    const ps = probes(offsetLine(axis, side * off));
    return ps.filter((p) => cover(p) === COVER.paving).length * 2 > ps.length;
  };
  const vergeOf = (axis: readonly Pt[], kerb: number, side: 1 | -1): number => {
    const ws: number[] = [];
    for (let i = 0; i + 1 < axis.length; i++) {
      const [a, b] = [axis[i]!, axis[i + 1]!];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (len < 1e-9) continue;
      // `offsetLine`'s left: the normal (-dz, dx).
      const [nx, nz] = [(-(b.z - a.z) / len) * side, ((b.x - a.x) / len) * side];
      for (let u = PROBE / 2; u < len; u += PROBE) {
        const [px, pz] = [a.x + ((b.x - a.x) * u) / len, a.z + ((b.z - a.z) * u) / len];
        let t = 0;
        while (t < VERGE_MAX && green({ x: px + nx * (kerb + t + VERGE_STEP / 2), z: pz + nz * (kerb + t + VERGE_STEP / 2) })) t += VERGE_STEP;
        ws.push(t);
      }
    }
    const w = median(ws) ?? 0;
    return w < VERGE_MIN ? 0 : w;
  };
  return { greens, vergeAt, pavedAt, vergeOf };
};

/** The bands with the districts' streets laid from the street graph (see the head of the file). */
export const graphBands = <B extends Band>(
  bands: readonly Boxed<B>[],
  lines: readonly Line[],
  buildings: readonly (readonly Pt[])[],
  estimated: (source: string, side: 1 | -1) => boolean,
  cover: (p: Pt) => number = () => COVER.none,
  districts = graphDistricts(),
): Boxed<B>[] => {
  if (districts.size === 0) return [...bands];
  const rects = ALL_CHUNKS.filter((c) => districts.has(c.district.slug) || districts.has(c.district.id)).map((c) => c.rect);
  if (rects.length === 0) return [...bands];
  const inside = (box: Rect) => rects.some((r) => rectsOverlap(r, box));
  const region: Area = join(...rects.map((r) => areaOfRing([{ x: r.minX, z: r.minZ }, { x: r.maxX, z: r.minZ }, { x: r.maxX, z: r.maxZ }, { x: r.minX, z: r.maxZ }])));
  const tags = new Map(lines.map((l) => [l.id, l.tags]));
  // Not a street the game closes to cars (T-324's deptak): a place for walkers, laid as before with its square ends and stalls.
  const streets = bands.filter((b) => b.carriageway && b.kerb && !b.bridge && !b.patch && !isCarFree(b.source) && STREETS.has(tags.get(b.source)?.highway ?? "") && inside(b.box));
  const ways = new Set(streets.map((b) => b.source));
  // The sidewalks mapped on their own in the districts: read for the streets' widths, laid with theirs.
  // A plain footway along a street is its sidewalk too (map matching, `footwaysAlongStreets`), but not one beside a mapped place.
  const places = bands.filter((b) => !b.along && !b.carriageway && (b.surface === "square" || b.surface === "cobble") && inside(b.box)).map((b) => b.ring);
  // The map's asphalt areas by the kerbs (car parks along the street, a carriageway's own area): a footway behind one is the sidewalk still.
  const isLine = new Set(lines.map((l) => l.id));
  const bays = bands.filter((b) => !isLine.has(b.source) && !b.carriageway && !b.bridge && b.surface === "road" && inside(b.box)).map((b) => b.ring);
  // Not on a bridge: its deck's sidewalk stays the deck's piece; laid by the graph on the ground under it, the deck had a slot (`deck-slot`, Mełgiewska's bridges).
  const walksAlong = (along: ReadonlySet<string>) => bands.filter((b) => (b.surface === "sidewalk" || b.surface === "footway") && !b.bridge && !ways.has(b.source) && (tags.get(b.source)?.footway === "sidewalk" || along.has(b.source)) && inside(b.box));
  // Along the graph's streets only: a footway by the deptak (off the graph) is its kerb as before, its setts reach it.
  const mapped = walksAlong(footwaysAlongStreets(lines.filter((l) => !isCarFree(l.id)), places, bays, (p) => cover(p) === COVER.green));
  const lineOf = new Map(lines.map((l) => [l.id, l.line]));
  const waysOf = (bs: readonly Boxed<B>[]): Mapped[] =>
    bs.flatMap((b) => {
      const line = lineOf.get(b.source);
      return line ? [{ line, width: (2 * Math.abs(signedArea(b.ring))) / Math.max(perimeter(b.ring), 1e-9), box: b.box }] : [];
    });
  const mappedWays = waysOf(mapped);
  const pieces = [...new Map(streets.map((b) => [b.kerb!.line, b])).values()];
  // A side's kerb and sidewalk: by the tags; else to the mapped sidewalk, its asphalt out to it where
  // the street's width is the estimate and the gap a lane's (G-570, T-247: a parking lane or a bay);
  // else the sidewalk by type.
  const { greens, vergeAt, pavedAt, vergeOf } = coverReads(bands, inside, cover);
  // Whether along most of a side another street's carriageway lies within `MEDIAN` m past the kerb (probed 1, 2.5, 4 and 6 m out).
  const medianAt = (way: string, axis: readonly Pt[], kerb: number, side: 1 | -1): boolean => {
    const other = (p: Pt) => streets.some((o) => o.source !== way && p.x >= o.box.minX && p.x <= o.box.maxX && p.z >= o.box.minZ && p.z <= o.box.maxZ && pointInRing(p, o.ring));
    const rows = [1, 2.5, 4, MEDIAN].map((d) => probes(offsetLine(axis, side * (kerb + d))));
    const n = Math.min(...rows.map((r) => r.length));
    let hits = 0;
    for (let k = 0; k < n; k++) if (rows.some((r) => other(r[k]!))) hits++;
    return n > 0 && hits * 2 > n;
  };
  // A side's kerb, verge and sidewalk: by the tags; else to the mapped sidewalk, past a verge where
  // the gap is green, its asphalt out to it where the street's width is the estimate and the gap a
  // lane's (G-570, T-247: a parking lane or a bay); else the sidewalk by type.
  // The carriageway's half width each side by the order of the sources (`widths.ts`), and the report of where they come from.
  const report = new WidthReport();
  const widthOf = new Map(pieces.map((b) => [b, sourcedWidth(b.source, tags.get(b.source)!, b.kerb!.line, b.kerb!.half, estimated, report)] as const));
  const sideOf = (b: Boxed<B>, side: 1 | -1): { kerb: number; verge: number; walk: number } => {
    const [axis, half] = [b.kerb!.line, widthOf.get(b)![side > 0 ? 0 : 1].half];
    const tagged = taggedWalk(tags.get(b.source)!, side);
    if (tagged !== null) return { kerb: half, verge: tagged > 0 ? vergeOf(axis, half, side) : 0, walk: tagged };
    const m = mappedWalk(axis, half, side, mappedWays);
    // A median: another carriageway close past the kerb (a dual road's other half), no sidewalk by type there.
    if (m === null && medianAt(b.source, axis, half, side)) return { kerb: half, verge: 0, walk: 0 };
    // OSM's `sidewalk:*=separate` with no way of it by the kerb: the sidewalk is a path of its own past a lawn, laid as one
    // (`footwaysAlongStreets`), not one by type at the kerb over the lawn (Andersa's link, the curator's review of E4, P5).
    // Where the orthophoto shows paving at the kerb, the sidewalk by type stays: the path's own paving reaches it.
    if (m === null && sideTag(tags.get(b.source)!, side) === "separate") {
      const verge = vergeOf(axis, half, side);
      if (verge > 0) return { kerb: half, verge, walk: 0 };
    }
    if (m === null) return { kerb: half, verge: vergeOf(axis, half, side), walk: 2.5 };
    if (m.near < ROAD_GAP) return { kerb: half, verge: 0, walk: m.far };
    // A green gap is a verge; a wider one than `GAP` too (ADR-0080: past `KERB_REACH`, no lane's
    // asphalt), but for one the orthophoto shows paved: the sidewalk reaches the kerb across it, or its
    // paving was laid as a square's a step below the sidewalk's (`sidewalk-step`, Radziwiłłowska).
    if (vergeAt(axis, half + m.near / 2, side)) return { kerb: half, verge: m.near, walk: Math.max(WALK_MIN, m.far - m.near) };
    if (m.near > GAP) return pavedAt(axis, half + m.near / 2, side) ? { kerb: half, verge: 0, walk: m.far } : { kerb: half, verge: m.near, walk: Math.max(WALK_MIN, m.far - m.near) };
    return estimated(b.source, side) ? { kerb: half + m.near, verge: 0, walk: Math.max(WALK_MIN, m.far - m.near) } : { kerb: half, verge: 0, walk: m.far };
  };
  if (pieces.length > 0) console.log(report.toString());
  const edges: StreetEdge[] = pieces.map((b) => {
    const [l, r] = [sideOf(b, 1), sideOf(b, -1)];
    return { way: b.source, axis: b.kerb!.line, left: l.kerb, right: r.kerb, walkLeft: l.walk, walkRight: r.walk, vergeLeft: l.verge, vergeRight: r.verge, kerbRadius: kerbRadius(tags.get(b.source)!.highway!) };
  });
  const near = buildings.filter((r) => inside(ringBounds(r)));
  // The places the map draws as areas: squares and pedestrian areas, a carriageway's own area
  // (`area:highway`) and car parks (`areaSurface`). They keep their own ground: a street's sidewalk
  // stops at their edge (the curator's review of E2: Plac Łokietka cut into strips, a patch on the deptak).
  // So does a street closed to cars (T-324's deptak), laid as before.
  const placesOf = bands.filter((b) => ((!lineOf.has(b.source) && !b.carriageway) || isCarFree(b.source)) && !b.bridge && PLACES.has(b.surface) && inside(b.box)).map((b) => b.ring);
  // The small holes the places leave between them, left out of their ground on purpose: the beds of shrubs between
  // T-165's pavement of al. Tysiąclecia and the strip under the Bazar's eaves, which the bare ground rule lays as
  // lawns. A sidewalk stops at them as at the places (the curator's review of E4, P4): it laid its slabs over the beds.
  const beds = holesOf(join(...placesOf.map((r) => areaOfRing(r)))).filter((h) => Math.abs(signedArea(h)) < PLACE_HOLE_MAX);
  const areas = streetAreas(edges, [...near, ...greens.map((g) => g.ring), ...placesOf, ...beds], join(...mapped.map((m) => areaOfRing(m.ring))));
  // The old bands of those streets and mapped sidewalks: only outside the districts, cut at their edge.
  const replaced = new Set<Band>(mapped);
  const kept = bands.filter((b) => !replaced.has(b) && !(ways.has(b.source) && (b.carriageway || b.along || b.patch || b.slit || b.surface === "sidewalk")) && !b.bridge && inside(b.box));
  // What ranks over a sidewalk in the partition (`partitionGround`) and is not a street's: its pieces less it, or it cut them to hairs the rounding crosses over.
  const over = join(...kept.filter((b) => OVER_WALKS.has(b.surface)).map((b) => areaOfRing(b.ring)));
  const laid: Boxed<B>[] = [];
  const add = (from: B, area: Area, more: Partial<Band>) => {
    const own = from.surface === "road" ? area : less(area, over);
    for (const whole of rings(within(own, region))) {
      // A hair of sidewalk (narrower than `THIN` twice on average) the rounding to 0.1 m would cross over: dropped.
      if (from.surface !== "road" && (2 * Math.abs(signedArea(whole))) / perimeter(whole) < 2 * THIN) continue;
      const pieces = from.surface !== "road" ? roundable(whole) : [whole];
      for (const ring of pieces) laid.push({ ...from, ...more, ring, holed: true, box: ringBounds(ring) } as Boxed<B>);
    }
  };
  // A street's sidewalk reaches into the niches of the facades by it (morphological closing with the
  // buildings by `NICHE`, the buildings and the asphalt less): a doorway's niche 0.25 m deep by
  // Krakowskie Przedmieście (151; −103) was a hair the rounding drops, left bare, and its door's
  // jamb stood 0.17 m over the ground (`door-floating`).
  const builtArea = join(...near.map(areaOfRing));
  const intoNiches = (walk: Area): Area => {
    const local = within(builtArea, grown(walk, 2 * NICHE));
    if (local.length === 0) return walk;
    const closed = grown(grown(join(walk, local), NICHE), -NICHE);
    // Only what the closing adds against a facade: not between the walk and the asphalt or other ground.
    const niches = within(within(less(closed, join(local, areas.c, walk)), grown(walk, 2 * NICHE)), grown(local, NICHE));
    return join(walk, niches);
  };
  for (const o of areas.own) {
    const b = pieces[o.edge]!;
    // Not the old band's widenings (fitted lanes, bays): the graph's carriageway is the sources' width, and the lanes read that.
    if (o.surface === "road") add(b, o.area, { graph: true, widen: undefined, widenLanes: undefined });
    else add({ surface: "sidewalk", ring: [], bridge: false, source: b.source } as unknown as B, intoNiches(o.area), {});
  }
  if (mapped.length > 0) add({ surface: "sidewalk", ring: [], bridge: false, source: mapped[0]!.source } as unknown as B, areas.rest, {});
  // The streets' joints with the bridges' decks at their abutments (`abutmentJoints`): asphalt from the deck's end to the graph's kerbs.
  const decks = bands.filter((b) => b.bridge && b.carriageway && b.kerb && inside(b.box)).map((b) => ({ ring: b.ring, line: b.kerb!.line, half: b.kerb!.half }));
  for (const j of abutmentJoints(edges, decks)) add(pieces[j.edge]!, j.area, { graph: true, widen: undefined, widenLanes: undefined });
  // Not to a lawn or water: what lies between the street and the green is the cover's to lay (`bare-cover.ts`).
  // The verges are no gaps: left bare, for the cover's lawn.
  // Nor over one: a lawn the map draws inside a square (Plac Litewski's, a hole in its paving) is no
  // gap, though the closing fills it as one; the sidewalk laid over it hid the lawn (`grass-under-paving`).
  const mappedGreen = join(...kept.filter((b) => b.surface === "grass" || b.surface === "water").map((b) => areaOfRing(b.ring)));
  const gaps = less(kerbGaps(join(areas.c, areas.verges), areas.sidewalks, kept.filter((b) => b.surface !== "grass" && b.surface !== "water"), near), join(areas.verges, mappedGreen));
  if (edges.length > 0) add({ surface: "sidewalk", ring: [], bridge: false, source: edges[0]!.way } as unknown as B, gaps, {});
  // The verges the orthophoto shows green over most of their piece laid as lawn: narrow, the bare ground rule drops them (`dropLoose`).
  for (const ring of rings(areas.verges)) if (greenShare(ring, cover) > 0.5) add({ surface: "grass", ring: [], bridge: false, source: edges[0]!.way } as unknown as B, areaOfRing(ring), {});
  for (const island of islands(join(areas.c, areas.sidewalks, gaps, areas.verges), kept, near, cover)) add({ surface: island.surface, ring: [], bridge: false, source: edges[0]!.way } as unknown as B, island.area, {});
  const out: Boxed<B>[] = [];
  for (const b of bands) {
    // A band of theirs wholly outside the districts stays as it was: the next district's ground is not touched.
    const theirs = (ways.has(b.source) && (b.carriageway || b.along || b.patch || b.slit || b.surface === "sidewalk")) || replaced.has(b);
    const own = theirs && inside(b.box) ? areaOfRing(b.ring) : [];
    if (!theirs || within(own, region).length === 0) {
      out.push(b);
      continue;
    }
    for (const ring of rings(less(own, region))) {
      const { along: _along, ...rest } = b;
      out.push({ ...rest, ring, box: ringBounds(ring) } as unknown as Boxed<B>);
    }
  }
  // The pieces the graph laid share their edges' vertices: none rounds apart from its neighbour (`weldTJunctions`).
  const welded = weldTJunctions(laid.map((l) => l.ring));
  return [...out, ...laid.map((l, i) => ({ ...l, ring: welded[i]! }))];
};
