/**
 * Ground surfaces (ADR-0042): areas from the map (squares, lawns, water, road areas) and bands
 * built from lines (carriageways by type, lanes and width; sidewalks from tags, from mapped
 * sidewalk ways, or added along city streets that have neither; footpaths; rails).
 */
import { type GroundSurface } from "../../../packages/core/src/world/city-geo.ts";
import { parseLength } from "./building-tags.ts";
import { type Area, type Line } from "./features.ts";
import { type Pt, type Rect, bufferLine, ccw, clipRingToRect, lineLength, offsetLine, pointAlong, pointInRing, r1, removeCollinear, signedArea, simplifyLine, simplifyRing, sliceLine, stripAlong } from "./geometry.ts";
import { type WidenRun, widenPieces } from "./kerb-widen.ts";
import { type GroundOut } from "./model.ts";
import { type Tags } from "./osm.ts";
import { cutHoles, holeFits, holesApart, notchOut } from "./ring-holes.ts";

const COBBLES = new Set(["sett", "cobblestone", "unhewn_cobblestone", "cobblestone:flattened"]);
const cobbled = (t: Tags) => COBBLES.has(t.surface ?? "");

/** Surface of a mapped area, or null when it is not ground. */
export const areaSurface = (t: Tags): GroundSurface | null => {
  if (t.building !== undefined) return null;
  if (t.amenity === "fountain" && t.fountain !== "splash_pad" && t.natural === "water") return "basin";
  if (t.natural === "water" || t.waterway === "riverbank" || t.landuse === "reservoir" || t.landuse === "basin") return "water";
  if (t.place === "square" || t.highway === "pedestrian" || t["area:highway"] === "pedestrian" || t.amenity === "marketplace") return cobbled(t) ? "cobble" : "square";
  if (t["area:highway"] === "footway" || t.highway === "footway") return cobbled(t) ? "cobble" : "footway";
  if (t["area:highway"] !== undefined || (t.amenity === "parking" && t.parking !== "underground" && t.parking !== "multi-storey")) return cobbled(t) ? "cobble" : "road";
  if (["park", "garden", "playground", "dog_park", "pitch"].includes(t.leisure ?? "")) return "grass";
  if (["grass", "village_green", "meadow", "recreation_ground", "cemetery", "allotments", "orchard", "flowerbed"].includes(t.landuse ?? "")) return "grass";
  if (["grass", "scrub", "wood", "grassland", "heath", "wetland"].includes(t.natural ?? "")) return "grass";
  return null;
};

/** Carriageway width in metres by type when neither `width` nor `lanes` says. */
const ROAD_WIDTH: Record<string, number> = {
  motorway: 14,
  trunk: 14,
  primary: 12,
  primary_link: 6,
  secondary: 10,
  secondary_link: 6,
  tertiary: 8,
  tertiary_link: 5,
  unclassified: 6,
  residential: 6.5,
  living_street: 5,
  service: 4,
  busway: 7,
  road: 6,
};
/** Streets that get sidewalks where the map has none. */
const URBAN = new Set(["primary", "secondary", "tertiary", "unclassified", "residential", "living_street"]);
const PATHS: Record<string, number> = { footway: 2.5, path: 2, cycleway: 2, steps: 3, bridleway: 2 };
/** The most a vertex of a steps way may lie off the line through its neighbours and start no new run (m). */
const STEPS_BEND = 0.05;

const underground = (t: Tags) => t.tunnel === "yes" || t.tunnel === "culvert" || t.indoor === "yes" || Number(t.layer ?? 0) < 0 || t.location === "underground";

/**
 * The narrowest strip of steps (m): the renderer draws no flight on a band under 0.4 m wide
 * (`planSteps`), and the import rounds its corners to 0.1 m.
 */
const MIN_STRIP = 0.45;

/**
 * A piece of a band of steps on the run `a`-`b`, as the renderer is to read it. The renderer
 * takes a band's long side for the run, so a piece shorter along the run than it is wide (a short
 * run of any flight: the castle stairs T-113, G-213; or what a chunk's edge leaves of a longer
 * one) is cut along the run into strips each at most 0.8 of the piece's length wide; together
 * they cover the same piece. A strip is never under `MIN_STRIP`: a piece too short for that is
 * cut into strips up to 0.9 of its length wide, and left whole when even those would be too narrow.
 * A strip the piece's shape leaves narrower or shorter (the tip of a corner a chunk's edge cuts
 * off) joins the next, so the renderer draws all of the piece.
 */
export const flightStrips = (piece: readonly Pt[], a: Pt, b: Pt): Pt[][] => {
  const run = Math.hypot(b.x - a.x, b.z - a.z);
  if (run < 1e-6) return [[...piece]];
  const [ux, uz] = [(b.x - a.x) / run, (b.z - a.z) / run];
  // In the run's frame: x along it from a, z across it to the left.
  const local = piece.map((p) => ({ x: (p.x - a.x) * ux + (p.z - a.z) * uz, z: -(p.x - a.x) * uz + (p.z - a.z) * ux }));
  const [x0, x1] = [Math.min(...local.map((p) => p.x)), Math.max(...local.map((p) => p.x))];
  const [z0, z1] = [Math.min(...local.map((p) => p.z)), Math.max(...local.map((p) => p.z))];
  const [along, across] = [x1 - x0, z1 - z0];
  let k = Math.ceil(across / (0.8 * along));
  if (across / k < MIN_STRIP) k = Math.floor(across / MIN_STRIP);
  if (k <= 1 || across / k > 0.9 * along) return [[...piece]];
  const strip = (from: number, to: number) => clipRingToRect(local, { minX: x0, maxX: x1, minZ: from, maxZ: to });
  // Drawn along the run: at least `MIN_STRIP` wide and longer than wide, so longer than a tread too.
  const drawn = (r: readonly Pt[]) => {
    const [l, w] = [Math.max(...r.map((p) => p.x)) - Math.min(...r.map((p) => p.x)), Math.max(...r.map((p) => p.z)) - Math.min(...r.map((p) => p.z))];
    return r.length >= 3 && w >= MIN_STRIP && l > w;
  };
  const cuts = Array.from({ length: k + 1 }, (_, i) => z0 + (across * i) / k);
  // The last strip joins the one before it, and that one is looked at again.
  for (let i = 0; i + 1 < cuts.length && cuts.length > 2; ) {
    if (drawn(strip(cuts[i]!, cuts[i + 1]!))) i++;
    else if (i + 2 < cuts.length) cuts.splice(i + 1, 1);
    else cuts.splice(i--, 1);
  }
  if (cuts.length <= 2) return [[...piece]];
  return cuts.slice(1).map((to, i) => strip(cuts[i]!, to).map((p) => ({ x: a.x + p.x * ux - p.z * uz, z: a.z + p.x * uz + p.z * ux })));
};

/** A path's width (m): its `width`, else by type. */
export const pathWidth = (t: Tags): number => parseLength(t.width) ?? PATHS[t.highway ?? ""] ?? 2;

export const roadWidth = (t: Tags): number => {
  const w = parseLength(t.width ?? t["width:carriageway"]);
  if (w !== null) return w;
  const lanes = Number(t.lanes);
  if (Number.isFinite(lanes) && lanes > 0) return lanes * 3.25;
  if (t.highway === "service" && t.service === "parking_aisle") return 5;
  return ROAD_WIDTH[t.highway ?? ""] ?? 6;
};

/** The narrowest carriageway a street's mapped sidewalks narrow it to, metres: one-way, and two-way (two 2.25 m lanes, T-063). */
const MIN_FITTED = { oneway: 3, twoWay: 4.5 };

/**
 * A street the map gives no width (no `width`, no `lanes`) narrowed to `kerb` metres each side of
 * its axis, short of its separately mapped sidewalks (T-046): the width by type would lay the
 * asphalt over their middle and `cutSidewalk` would drop them. The fitted width goes to
 * `width:carriageway`, so the bands, markings and zebras all read the same one.
 */
export const fitToKerb = (t: Tags, kerb: number | null, oneway: boolean): Tags => {
  if (kerb === null || ROAD_WIDTH[t.highway ?? ""] === undefined || parseLength(t.width ?? t["width:carriageway"]) !== null || Number(t.lanes) > 0) return t;
  const w = Math.max(oneway ? MIN_FITTED.oneway : MIN_FITTED.twoWay, Math.round(2 * kerb * 10) / 10);
  return w < roadWidth(t) ? { ...t, "width:carriageway": String(w) } : t;
};

export interface Band {
  readonly surface: GroundSurface;
  readonly ring: readonly Pt[];
  readonly bridge: boolean;
  /** On a bridge: the bridge way's two ends, the deck's axis from abutment to abutment. */
  readonly deck?: readonly [Pt, Pt];
  readonly source: string;
  /** A carriageway's own band (not a parking area or a road area). */
  readonly carriageway?: true;
  /** A sidewalk's line (laid along a road, or mapped on its own): `width` wide from `from` metres off `line`. */
  readonly along?: { readonly line: readonly Pt[]; readonly from: number; readonly width: number };
  /** A carriageway's axis and half its width: where its kerbs run (`kerbFills`, G-522). */
  readonly kerb?: { readonly line: readonly Pt[]; readonly half: number };
  /** A carriageway's stretches widened to its paving (`kerbFills`, G-570): laid in a chunk as pieces of their own along its piece (`widenPieces`). */
  readonly widen?: readonly WidenRun[];
  /** A band of steps' run, end to end: what its pieces in a chunk are cut along (`flightStrips`). */
  readonly run?: readonly [Pt, Pt];
  /**
   * Paving with holes, or a lawn cut out of it (`openPavings`), simplified already: simplifying it
   * again in a chunk would part the lawn from its hole. So is a kerb's fill (`kerbFills`), finer.
   */
  readonly holed?: true;
}

/** Sidewalk sides a road gets: tagged ones, or both on city streets without tags and without mapped sidewalks nearby. */
export const sidewalkSides = (t: Tags, mappedNearby: boolean): { left: boolean; right: boolean } => {
  const s = t.sidewalk ?? (t["sidewalk:both"] === "yes" ? "both" : undefined);
  const left = t["sidewalk:left"];
  const right = t["sidewalk:right"];
  if (s === "both" || s === "yes") return { left: true, right: true };
  if (s === "left" || s === "right") return { left: s === "left", right: s === "right" };
  if (s === "no" || s === "none" || s === "separate" || left !== undefined || right !== undefined)
    return { left: left === "yes", right: right === "yes" };
  if (mappedNearby || !URBAN.has(t.highway ?? "")) return { left: false, right: false };
  return { left: true, right: true };
};

/** Whether most points of `line` lie in one of the mapped water areas (a river already drawn as a polygon). */
export const coveredByWater = (line: readonly Pt[], water: readonly (readonly Pt[])[]): boolean => {
  if (water.length === 0 || line.length === 0) return false;
  const inside = line.filter((p) => water.some((ring) => pointInRing(p, ring))).length;
  return inside / line.length >= 0.6;
};

/**
 * Bands from one line; `mappedSidewalkNear` tells whether separate sidewalks run along it.
 * A river whose bed is mapped as a water area gets no band of its own: the buffered centre
 * line would lay a second, wider strip over the real banks. A tunnel `atStreet` (a gateway the
 * map tags `tunnel=yes`, G-076) is paved like the street it joins.
 */
export const lineBands = (l: Line, mappedSidewalkNear: boolean, water: readonly (readonly Pt[])[] = [], atStreet = false): Band[] => {
  const t = l.tags;
  if ((underground(t) && !atStreet) || l.line.length < 2) return [];
  const bridge = t.bridge !== undefined && t.bridge !== "no";
  const deck = bridge ? ([l.line[0]!, l.line[l.line.length - 1]!] as const) : undefined;
  const out: Band[] = [];
  const add = (surface: GroundSurface, ring: Pt[], extra: Pick<Band, "carriageway" | "kerb" | "along" | "run"> = {}) => {
    if (ring.length >= 3) out.push({ surface, ring, bridge, ...(deck ? { deck } : {}), source: l.id, ...extra });
  };
  const hw = t.highway;
  if (hw && t.area !== "yes") {
    if (ROAD_WIDTH[hw] !== undefined) {
      const w = roadWidth(t);
      add(cobbled(t) ? "cobble" : "road", bufferLine(l.line, w), { carriageway: true, kerb: { line: l.line, half: w / 2 } });
      const sides = sidewalkSides(t, mappedSidewalkNear);
      const sw = parseLength(t["sidewalk:width"]) ?? (hw === "primary" || hw === "secondary" ? 3 : 2.5);
      if (sides.left) add("sidewalk", stripAlong(l.line, w / 2, sw), { along: { line: l.line, from: w / 2, width: sw } });
      if (sides.right) add("sidewalk", stripAlong(l.line, -w / 2 - sw, sw), { along: { line: l.line, from: -w / 2 - sw, width: sw } });
    } else if (hw === "pedestrian") add(cobbled(t) ? "cobble" : "square", bufferLine(l.line, parseLength(t.width) ?? 8));
    else if (PATHS[hw] !== undefined) {
      const w = pathWidth(t);
      // Steps: one band per straight run, so the renderer reads the flight's direction off it. A
      // bend of a few centimetres starts no new run: it would leave one too short to draw (G-213).
      if (hw === "steps") {
        const runs = simplifyLine(l.line, STEPS_BEND);
        for (let i = 0; i + 1 < runs.length; i++) add("steps", bufferLine([runs[i]!, runs[i + 1]!], w), { run: [runs[i]!, runs[i + 1]!] });
      }
      // A path's crossing of a carriageway: a zebra where it is marked, the road itself where not.
      else if (crossingWay(t)) {
        if (markedCrossing({ ...t, highway: "crossing" })) add("crossing", bufferLine(l.line, Math.max(w, CROSSING_ALONG)));
      } else if (t.footway === "sidewalk") add("sidewalk", bufferLine(l.line, w), { along: { line: l.line, from: -w / 2, width: w } });
      else add(cobbled(t) ? "cobble" : "footway", bufferLine(l.line, w));
    }
  }
  if (t.railway === "rail" || t.railway === "tram" || t.railway === "light_rail") add("rail", bufferLine(l.line, 3));
  if (t.waterway === "river" && !t.tunnel && !coveredByWater(l.line, water)) add("water", bufferLine(l.line, parseLength(t.width) ?? 15));
  if ((t.waterway === "stream" || t.waterway === "canal" || t.waterway === "ditch") && !underground(t)) add("water", bufferLine(l.line, parseLength(t.width) ?? 3));
  return out;
};

/** How far a zebra runs along the road, metres. */
export const CROSSING_ALONG = 3;

/** A footway's or a cycleway's stretch across a carriageway (`footway=crossing`). */
/** A way laid as a carriageway band of its own (`lineBands`): a road by type, not an area, not under ground. */
export const isCarriageway = (t: Tags): boolean => ROAD_WIDTH[t.highway ?? ""] !== undefined && t.area !== "yes" && !underground(t);

export const crossingWay = (t: Tags): boolean => t.footway === "crossing" || t.cycleway === "crossing" || t.path === "crossing";
const UNMARKED = new Set(["unmarked", "no", "informal"]);

/** A crossing node with markings on the road (most Lublin crossings are tagged without saying). */
export const markedCrossing = (t: Tags): boolean => t.highway === "crossing" && !UNMARKED.has(t.crossing ?? "") && t["crossing:markings"] !== "no";

/**
 * A zebra's band at a crossing node: across the carriageway the node lies on, as wide as that
 * road and `CROSSING_ALONG` along it. Null when the node is on no carriageway (a crossing of a
 * footway or a cycleway) or the road is too narrow to stripe.
 */
export const crossingBand = (source: string, at: Pt, roads: readonly Line[]): Band | null => {
  let best: { d: number; tx: number; tz: number; w: number; bridge: boolean } | null = null;
  for (const l of roads) {
    const t = l.tags;
    if (!t.highway || ROAD_WIDTH[t.highway] === undefined || t.area === "yes" || underground(t)) continue;
    for (let i = 0; i + 1 < l.line.length; i++) {
      const a = l.line[i]!;
      const b = l.line[i + 1]!;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      if (len < 0.1) continue;
      const k = Math.max(0, Math.min(1, ((at.x - a.x) * dx + (at.z - a.z) * dz) / (len * len)));
      const d = Math.hypot(a.x + dx * k - at.x, a.z + dz * k - at.z);
      if (d < 1 && (!best || d < best.d)) best = { d, tx: dx / len, tz: dz / len, w: roadWidth(t), bridge: t.bridge !== undefined && t.bridge !== "no" };
    }
  }
  if (!best || best.w < 3.5) return null;
  const { tx, tz, w } = best;
  const corner = (along: number, across: number): Pt => ({ x: at.x + tx * along - tz * across, z: at.z + tz * along + tx * across });
  const h = CROSSING_ALONG / 2;
  return { surface: "crossing", ring: [corner(-h, -w / 2), corner(h, -w / 2), corner(h, w / 2), corner(-h, w / 2)], bridge: best.bridge, source };
};

export const areaBand = (a: Area): Band | null => {
  const s = areaSurface(a.tags);
  if (!s || underground(a.tags)) return null;
  return { surface: s, ring: a.ring, bridge: false, source: a.id };
};

/** The pavings, and the surfaces drawn under them (`SURFACE_LIFT`) that a paving mapped round them is not to cover. */
const PAVINGS = new Set<GroundSurface>(["square", "cobble"]);
const UNDER_PAVING = new Set<GroundSurface>(["grass", "water"]);

/**
 * Areas of paving with the lawns and the water mapped inside them cut out (G-421): the paving lies
 * over them, so Plac Litewski's lawns (inner rings of its multipolygon and the same ways tagged
 * `landuse=grass`), the trees' beds along a pedestrian street and the like were drawn but never seen.
 * Only what is drawn in a hole is cut, so the paving stays where an inner ring has nothing of its
 * own (a fence, a building, an archaeological site). `whole(b)` says a band is its area's whole
 * ground: a lawn with holes of its own would bare the paving mapped in them. The larger of two
 * lawns that touch is cut, the other stays under the paving. A lawn mapped along the paving's edge
 * (Plac Czechowicza's, with the poet's monument, G-427) is cut as a notch in it (`notchOut`); a
 * paved patch of a park, lying on its lawn, is never cut.
 */
export const openPavings = <B extends Band & { readonly box: Rect }>(bands: readonly B[], whole: (b: B) => boolean): B[] => {
  const under = bands.filter((b) => UNDER_PAVING.has(b.surface) && !b.bridge && whole(b));
  // Simplified and rounded once, before a chunk clips them, and not again in it (`holed`): a lawn
  // simplified anew where a chunk's edge cuts it would leave a strip of the hole bare (T-202).
  const grid = (ring: readonly Pt[]) => removeCollinear(simplifyRing(ccw(ring), 0.3).map((p) => ({ x: r1(p.x), z: r1(p.z) })), 0.02);
  const cut = new Set<B>();
  const out = bands.map((b) => {
    if (!PAVINGS.has(b.surface) || b.bridge) return b;
    const within = under.filter((u) => u.box.minX >= b.box.minX && u.box.maxX <= b.box.maxX && u.box.minZ >= b.box.minZ && u.box.maxZ <= b.box.maxZ);
    within.sort((p, q) => Math.abs(signedArea(q.ring)) - Math.abs(signedArea(p.ring)) || (p.source < q.source ? -1 : p.source > q.source ? 1 : 0));
    const fits = within.filter((u) => holeFits(b.ring, u.ring));
    // A lawn along the paving's edge fits no hole: it is cut as a notch in the edge (G-427).
    let ring = grid(b.ring);
    let notches = 0;
    for (const u of within) {
      const notched = fits.includes(u) ? null : notchOut(ring, grid(u.ring));
      if (!notched) continue;
      ring = notched;
      notches++;
      cut.add(u);
    }
    const holes: Pt[][] = [];
    for (const u of fits) {
      const h = grid(u.ring);
      if (!holeFits(ring, h) || !holes.every((o) => holesApart(o, h))) continue;
      holes.push(h);
      cut.add(u);
    }
    return holes.length > 0 || notches > 0 ? { ...b, ring: cutHoles(ring, holes), holed: true } : b;
  });
  // The lawns cut out laid as their holes.
  return out.map((b) => (cut.has(b) ? { ...b, ring: grid(b.ring), holed: true } : b));
};

/** Stretches of a laid sidewalk shorter than this are dropped, metres. */
const MIN_SIDEWALK = 1.5;

/**
 * A sidewalk, laid along a road or mapped on its own, cut where its middle runs over another
 * carriageway: it stops at the kerb of the street it meets instead of running across its asphalt.
 * `onRoad(p)` says whether a point lies on another carriageway. Sampled every half metre.
 */
export const cutSidewalk = (b: Band, onRoad: (p: Pt) => boolean): Band[] => {
  if (!b.along) return [b];
  const { line, from, width } = b.along;
  const mid = offsetLine(line, from + width / 2);
  const total = lineLength(line);
  const step = 0.5;
  const runs: [number, number][] = [];
  let start: number | null = null;
  for (let s = 0; s <= total + 1e-6; s += step) {
    const p = pointAlong(mid, (s / (total || 1)) * lineLength(mid));
    const free = !onRoad(p);
    if (free && start === null) start = s;
    if (!free && start !== null) {
      runs.push([start, s - step]);
      start = null;
    }
  }
  if (start !== null) runs.push([start, total]);
  if (runs.length === 1 && runs[0]![0] === 0 && runs[0]![1] >= total - 1e-6) return [b];
  return runs
    .filter(([a, c]) => c - a >= MIN_SIDEWALK)
    .map(([a, c]) => ({ surface: b.surface, ring: stripAlong(sliceLine(line, a, c), from, width), bridge: b.bridge, ...(b.deck ? { deck: b.deck } : {}), source: b.source }))
    .filter((r) => r.ring.length >= 3);
};

/** Draw order: big areas first, then roads, cobbles, sidewalks, paths and rails on top. */
const ORDER: Record<GroundSurface, number> = { water: 0, grass: 1, square: 2, road: 3, cobble: 4, crossing: 5, sidewalk: 6, footway: 7, steps: 8, rail: 9, basin: 10 };

/** Clips bands to a chunk, simplifies and rounds them, in draw order then by source id. */
export const chunkGround = (bands: readonly Band[], rect: Rect): GroundOut[] => {
  const out: { g: GroundOut; order: number; source: string; k: number }[] = [];
  const round = (ring: readonly Pt[]) => removeCollinear(ring.map((p) => ({ x: r1(p.x), z: r1(p.z) })), 0.02);
  bands.forEach((b, k) => {
    const clipped = clipRingToRect(ccw(b.ring), rect);
    const widen = (ring: readonly Pt[] | null) => {
      for (const w of b.widen ? widenPieces(ring, b.widen, rect) : []) out.push({ g: { surface: b.surface, outline: w.flatMap((q) => [q.x, q.z]) }, order: ORDER[b.surface], source: b.source, k });
    };
    if (clipped.length < 3) return widen(null);
    const simple = b.holed ? clipped : simplifyRing(clipped, 0.3);
    if (Math.abs(signedArea(round(simple))) < 0.5) return widen(null);
    // Steps are cut into strips in the chunk, so a piece its edge cuts short is cut too; the
    // strips of a piece kept are all kept, however small, or the flight would have gaps.
    const pieces = b.run ? flightStrips(simple, ...b.run).map(round) : [round(simple)];
    const deck = b.deck ? { deck: [r1(b.deck[0].x), r1(b.deck[0].z), r1(b.deck[1].x), r1(b.deck[1].z)] } : {};
    for (const p of pieces) {
      if (p.length < 3) continue;
      const ring = ccw(p);
      out.push({ g: { surface: b.surface, outline: ring.flatMap((q) => [q.x, q.z]), ...(b.bridge ? { bridge: true as const } : {}), ...deck }, order: ORDER[b.surface], source: b.source, k });
    }
    // Along the carriageway's piece as the chunk keeps it: its widening shares that edge (G-570).
    widen(pieces.length === 1 && pieces[0]!.length >= 3 ? ccw(pieces[0]!) : null);
  });
  out.sort((a, b) => a.order - b.order || (a.source < b.source ? -1 : a.source > b.source ? 1 : a.k - b.k));
  return out.map((o) => o.g);
};
