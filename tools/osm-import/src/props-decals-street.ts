/**
 * The decals of Lublin 2077 on the street (ADR-0058 stage 6), by rules from the map data:
 * 1. **Stickers** on the poles and cabinets the furniture placed (`STICKER_HOSTS`: modern and road
 *    lamps, traffic lights, trolleybus poles, street cabinets), not on a road lamp drawn as a
 *    utility pole's model. Up to `MAX_STICKERS` a host by a hash against the district's share
 *    (`STICK`: the market and the deptak most, the Old Town little), each on a face of the host at a
 *    height within its range, two on one face `STICKER_GAP` apart.
 * 2. **Gully grates** in the carriageway at the kerb of the streets cars drive (`DRAINED`): one every
 *    `GRATE_STEP` metres along each side, and one on each kerb `CROSSING_GAP` before and after every
 *    zebra crossing. A grate lies `KERB_GAP` off the road's edge where a pavement runs beside it,
 *    wholly on the carriageway and off the crossings' bands, `ROAD_ROOM` from a manhole or a
 *    bollard and `GRATE_SPACING` from another grate; the road's fall under it is in its variant,
 *    up to `MAX_GRATE_SLOPE`.
 */
import type { StreetPropItem, StreetPropKind } from "../../../packages/core/src/world/city-geo.ts";
import { DRAIN_GRATE, MAX_GRATE_SLOPE, STICKER, STICKER_DESIGNS, STICKER_HOSTS, grateVariant, hostFaces, stickerVariant } from "../../../packages/core/src/world/decals.ts";
import { crossingBands, inCrossingBand } from "../../../packages/sim/src/content/lublin/crossing-bands.ts";
import type { Pt } from "./geometry.ts";
import type { DecalContext } from "./props-decals.ts";
import { fnv, stations, unit, yawOf } from "./props-place.ts";
import { Site } from "./props-site.ts";

/** Share of the hosts with stickers by district, and the most on one host. */
export const STICK: Readonly<Record<string, number>> = {
  targ: 1,
  "shinsekai-7": 0.85,
  doki: 0.6,
  kanal: 0.2,
};
export const MAX_STICKERS = 3;
/** Between the middles of two stickers on one face (m). */
export const STICKER_GAP = STICKER.height + 0.03;

/** The streets that get grates: the ones cars drive. */
export const DRAINED: ReadonlySet<string> = new Set(["primary", "secondary", "tertiary", "residential", "unclassified", "primary_link", "secondary_link", "tertiary_link", "trunk", "living_street"]);
export const GRATE_STEP = 32;
export const CROSSING_GAP = 1.2;
/** A grate's long edge off the road's edge, the most it looks for the edge from the axis (m). */
export const KERB_GAP = 0.08;
const CORNER_SLACK = 0.03;
const KERB_REACH = 14;
/** How far past the road's edge the sidewalk is looked for (m). */
export const KERB_LOOK = 0.15;
export const ROAD_ROOM = 0.8;
export const GRATE_SPACING = 5;
const ON_ROAD: ReadonlySet<StreetPropKind> = new Set(["manhole", "bollard"]);

export interface StreetDecal {
  readonly item: StreetPropItem;
  readonly district: string;
}

const r2 = (v: number): number => Math.round(v * 100) / 100 + 0;

/** The stickers of one host piece. */
const stickersOn = (p: StreetPropItem, district: string): StreetPropItem[] => {
  const host = STICKER_HOSTS.findIndex((h) => h.kind === p.prop);
  const h = STICKER_HOSTS[host];
  if (!h) return [];
  const key = `${p.prop}:${p.x}:${p.z}`;
  const n = Math.floor(unit(key) * (MAX_STICKERS + 1) * (STICK[district] ?? 0));
  const faces = hostFaces(h);
  const out: { face: number; lift: number }[] = [];
  for (let k = 0; k < Math.min(n, MAX_STICKERS); k++) {
    const face = faces[fnv(`f${k}:${key}`) % faces.length]!;
    const lift = Math.round((h.low + unit(`y${k}:${key}`) * (h.high - h.low)) * 10) / 10;
    if (out.some((s) => s.face === face && Math.abs(s.lift - lift) < STICKER_GAP)) continue;
    out.push({ face, lift });
  }
  return out.map((s, k) => ({
    prop: "sticker",
    x: p.x,
    y: p.y,
    z: p.z,
    yaw: p.yaw,
    variant: stickerVariant({
      design: fnv(`d${k}:${key}`) % STICKER_DESIGNS,
      host,
      face: s.face,
      lift: s.lift,
    }),
  }));
};

/**
 * The road's drawn edge from a point on it along `n`: the distance to the first ground that is no
 * road or is a sidewalk (drawn over the road where the two overlap), or null.
 */
const roadEdge = (site: Site, sidewalks: Site, p: Pt, n: Pt): number | null => {
  for (let d = 0; d <= KERB_REACH; d += 0.05) {
    const q = { x: p.x + n.x * d, z: p.z + n.z * d };
    if (site.surfaceAt(q) !== "road" || sidewalks.surfaceAt(q) === "walk") return d;
  }
  return null;
};

/** A grate's corners: its middle, local x along `dir`, local z along `n` (towards the kerb). */
export const grateCorners = (c: Pt, n: Pt, grow = 0): Pt[] => {
  const dir = { x: n.z, z: -n.x };
  const [hl, hw] = [DRAIN_GRATE.length / 2 + grow, DRAIN_GRATE.width / 2 + grow];
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([a, b]) => ({
    x: c.x + dir.x * hl * a! + n.x * hw * b!,
    z: c.z + dir.z * hl * a! + n.z * hw * b!,
  }));
};

/** A grate at the kerb beside the axis point `p` on the side `n`, or why not. */
const grateAt = (site: Site, sidewalks: Site, ctx: DecalContext, p: Pt, n: Pt, taken: readonly StreetPropItem[], bands: ReturnType<typeof crossingBands>): StreetPropItem | string => {
  // From an axis off the road the edge is at 0 and the grate behind it, off the road: the corners' test turns it down.
  const e = roadEdge(site, sidewalks, p, n);
  if (e === null) return "edge";
  // The renderer draws a kerb only on a sidewalk's edge along a road (`ground-plan.ts`).
  const out = {
    x: p.x + n.x * (e + KERB_LOOK),
    z: p.z + n.z * (e + KERB_LOOK),
  };
  const beyond = site.surfaceAt(out);
  if (sidewalks.surfaceAt(out) !== "walk" && beyond !== "green" && beyond !== null) return "kerb";
  const d = e - KERB_GAP - DRAIN_GRATE.width / 2;
  const c = { x: p.x + n.x * d, z: p.z + n.z * d };
  // A hair larger than the grate: its place is rounded to the centimetre in the table.
  const corners = grateCorners(c, n, CORNER_SLACK);
  if (corners.some((q) => site.surfaceAt(q) !== "road" || sidewalks.surfaceAt(q) === "walk")) return "road";
  if (corners.some((q) => bands.some((b) => inCrossingBand(b, q)))) return "crossing";
  if (taken.some((t) => (ON_ROAD.has(t.prop) && Math.hypot(t.x - c.x, t.z - c.z) < ROAD_ROOM) || (t.prop === "drain-grate" && Math.hypot(t.x - c.x, t.z - c.z) < GRATE_SPACING))) return "taken";
  const y = ctx.groundY(c);
  const dir = { x: n.z, z: -n.x };
  const fall = (v: Pt) => (ctx.groundY({ x: c.x + v.x * 0.25, z: c.z + v.z * 0.25 }) - ctx.groundY({ x: c.x - v.x * 0.25, z: c.z - v.z * 0.25 })) / 0.5;
  const slopeX = fall(dir);
  const slopeZ = fall(n);
  if (Math.abs(slopeX) > MAX_GRATE_SLOPE || Math.abs(slopeZ) > MAX_GRATE_SLOPE) return "slope";
  return {
    prop: "drain-grate",
    x: r2(c.x),
    y: r2(y),
    z: r2(c.z),
    yaw: Math.round(yawOf(n.x, n.z) * 10000) / 10000,
    variant: grateVariant({
      casting: fnv(`${c.x}:${c.z}`) % 2,
      slopeX,
      slopeZ,
    }),
  };
};

/** The stations of the grates: along the drained streets on both sides, and before and after each zebra. */
const grateStations = (site: Site, bands: ReturnType<typeof crossingBands>): { p: Pt; n: Pt }[] => {
  const out: { p: Pt; n: Pt }[] = [];
  site.streets.forEach((st, i) => {
    if (!DRAINED.has(st.kind)) return;
    const first = 4 + ((fnv(`${st.name}:${i}`) % 1000) / 1000) * (GRATE_STEP - 8);
    for (const s of stations(st.line, GRATE_STEP, first)) for (const side of [1, -1]) out.push({ p: s.p, n: { x: -s.dir.z * side, z: s.dir.x * side } });
  });
  for (const b of bands) {
    // Across the walking direction `u`, the band's side plus the gap; to both kerbs along `u`.
    const perp = { x: -b.u.z, z: b.u.x };
    for (const side of [1, -1]) {
      const p = {
        x: b.c.x + perp.x * side * (b.across + CROSSING_GAP),
        z: b.c.z + perp.z * side * (b.across + CROSSING_GAP),
      };
      for (const k of [1, -1]) out.push({ p, n: { x: b.u.x * k, z: b.u.z * k } });
    }
  }
  return out;
};

/** The sidewalks of a site alone (its "walk" there and nowhere else): where the renderer draws kerbs. */
export const sidewalkSite = (site: Site): Site =>
  new Site(
    site.chunks.map((c) => ({
      ...c,
      buildings: [],
      streets: [],
      ground: c.ground.filter((g) => g.surface === "sidewalk" && !g.bridge),
    })),
  );

/** The stickers and grates of the chunks' furniture, by district. */
export const addStreetDecals = (byChunk: ReadonlyMap<string, readonly StreetPropItem[]>, site: Site, ctx: DecalContext, rejected: Record<string, number> = {}): StreetDecal[] => {
  const out: StreetDecal[] = [];
  const all: StreetPropItem[] = [];
  for (const [id, items] of byChunk) {
    const district = site.chunks.find((c) => c.id === id)?.district ?? "";
    for (const p of items) {
      all.push(p);
      if (p.prop === "lamp-road" && ctx.poleLamp?.(p)) continue;
      for (const s of stickersOn(p, district)) out.push({ item: s, district });
    }
  }
  const bands = crossingBands(site.chunks);
  const sidewalks = sidewalkSite(site);
  for (const { p, n } of grateStations(site, bands)) {
    const got = grateAt(site, sidewalks, ctx, p, n, all, bands);
    if (typeof got === "string") {
      rejected[`drain-grate ${got}`] = (rejected[`drain-grate ${got}`] ?? 0) + 1;
      continue;
    }
    all.push(got);
    out.push({ item: got, district: site.chunkAt(got)?.district ?? "" });
  }
  return out;
};
