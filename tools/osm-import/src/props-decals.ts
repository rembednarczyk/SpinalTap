/**
 * The decals of Lublin 2077 on the walls (ADR-0058 stage 6), placed by rules from the map data, no
 * list of points, so they carry over to new districts with `pnpm osm:props`:
 * 1. **Graffiti** goes where the facade shader paints no glass, on the buildings of the districts
 *    that take it (`PAINT`: the market under the viaduct and the riverside most, the deptak some,
 *    the Old Town and the Rynek none, as the districts' character in ADR-0058), never on a
 *    landmark, a building of historic, sacred or civic use or one the map tags `historic` or
 *    `heritage`. Three places on a wall:
 *    - `street`: a wall without glass from the ground up (a garage's, a short stretch of an
 *      outline), the piece from `STREET_LIFT` over the pavement;
 *    - `mural`: a firewall over its lower neighbour where no holo-ad may hang (`holoMayHang`),
 *      from `MURAL_LIFT` over the neighbour's top;
 *    - `plinth`: the plinth of a building on a slope, under its ground floor (the shader's glass
 *      starts over it), where it is at least `PLINTH_MIN` tall over the paving.
 *    A wall takes one piece per `WALL_STEP` of its length at most, by a hash of the building's
 *    place, the wall and the zone against the district's share.
 * 2. **A house number** (`addr:housenumber` of the building's outline in the map) on one street wall
 *    without glass of its building, the one facing a street of its `addr:street` first, its plate
 *    `PLATE_LIFT` over the pavement. The plate shows the map's number. Not on landmarks.
 * Every wall decal keeps `END_ROOM` from its wall's ends, its corners out of the neighbours taller
 * than it, its span off the venues' boards on the wall (`BOARD_ROOM`), its middle `PASSAGE_ROOM`
 * from a passage's axis and off a building with the game's doorways or passages, and an open
 * ground in front of it at street level (`FRONT`); its bottom stays over the paving under both its
 * ends. The rest (stickers, gully grates) is in `props-decals-street.ts`.
 */
import type { StreetPropItem, StreetPropKind } from "../../../packages/core/src/world/city-geo.ts";
import { GRAFFITI_DESIGNS, HOUSE_PLATE, graffitiVariant, parseHouseNumber, plateVariant } from "../../../packages/core/src/world/decals.ts";
import type { Pt } from "./geometry.ts";
import type { Tags } from "./osm.ts";
import { addStreetDecals } from "./props-decals-street.ts";
import { fnv, unit, yawOf } from "./props-place.ts";
import type { Site } from "./props-site.ts";

/** A drawn wall of a building of the map (`decal-walls.ts` takes them from the renderer's frames). */
export interface DecalWall {
  /** The building's place (`x,z` of its entity, one decimal): one per building. */
  readonly building: string;
  /** The map's element of its outline (`w…`, `r…`), "" for the game's own buildings. */
  readonly osm: string;
  readonly district: string;
  readonly use: string;
  readonly landmark: boolean;
  readonly a: Pt;
  readonly b: Pt;
  readonly nx: number;
  readonly nz: number;
  readonly length: number;
  /** The ground floor (world y): the shader's glass starts over it. */
  readonly base: number;
  readonly top: number;
  /** Where the wall shows from (world y): its foot, or a firewall's neighbour's top. */
  readonly from: number;
  readonly blind: boolean;
  /** The facade shader paints no glass on it at all (`glassFree`). */
  readonly glassFree: boolean;
  /** A holo-ad may hang on it (`holoMayHang`). */
  readonly holo: boolean;
  /** Its building has the game's doorways or passages. */
  readonly passages: boolean;
  /** The top (world y) of another building over a point, or null. */
  readonly neighbourTop: (x: number, z: number) => number | null;
  /** The venues' boards on it: along it from `a`, world y. */
  readonly boards: readonly {
    readonly u0: number;
    readonly u1: number;
    readonly bottom: number;
    readonly top: number;
  }[];
}

export interface DecalContext {
  /** The ground the game puts the furniture on (the shaped terrain): a piece's `y`. */
  readonly groundY: (p: Pt) => number;
  /** The paving drawn at a point; the ground without it. */
  readonly surfaceY?: (p: Pt) => number;
  /** The tags of the buildings' outlines by the map's element. */
  readonly buildingTags?: ReadonlyMap<string, Tags>;
  /** Is a road lamp drawn as a utility pole there (`isPoleLamp`)? No stickers on its model. */
  readonly poleLamp?: (p: Pt) => boolean;
}

export type DecalZone = "street" | "mural" | "plinth";

/** Share of the walls of each zone that take a piece, by district (ADR-0058: the districts' character). */
export const PAINT: Readonly<Record<string, number>> = {
  targ: 1,
  doki: 1,
  "shinsekai-7": 0.5,
  kanal: 0,
};
const ZONE_SHARE: Readonly<Record<DecalZone, number>> = {
  street: 0.8,
  mural: 0.55,
  plinth: 0.4,
};
/** Uses and tags of the buildings no graffiti goes on. */
export const PROTECTED_USE: ReadonlySet<string> = new Set(["historic", "church", "civic"]);
export const isProtected = (w: DecalWall, tags: Tags | undefined): boolean => w.landmark || PROTECTED_USE.has(w.use) || tags?.historic !== undefined || tags?.heritage !== undefined;

/** From a wall's ends, the venues' boards' ends and a passage's axis (m). */
export const END_ROOM = 0.3;
export const BOARD_ROOM = 0.3;
export const PASSAGE_ROOM = 3;
/** Graffiti's bottom over the pavement in the zones, the mural's over the neighbour, and their room under the wall's top (m). */
export const STREET_LIFT = 0.3;
export const MURAL_LIFT = 0.5;
const TOP_ROOM = 0.3;
/** The least plinth that takes graffiti, its bottom over the paving and its top under the ground floor (m). */
export const PLINTH_MIN = 0.9;
const PLINTH_FOOT = 0.12;
const PLINTH_HEAD = 0.06;
/** A piece per this much wall at most (m). */
export const WALL_STEP = 9;
/** A house plate's bottom over the pavement (m), and how far in front of its wall a street's axis may run. */
export const PLATE_LIFT = 2.2;
export const STREET_REACH = 14;
/** How far in front of a decal the ground must be open, and the corners' look-out for neighbours (m). */
export const FRONT = 0.4;
const OUT = 0.05;

const dmDown = (v: number): number => Math.floor(v * 10 + 1e-6) / 10;
const dmUp = (v: number): number => Math.ceil(v * 10 - 1e-6) / 10;
const r2 = (v: number): number => Math.round(v * 100) / 100 + 0;

export const pointOn = (w: DecalWall, u: number, out = 0): Pt => ({
  x: w.a.x + ((w.b.x - w.a.x) * u) / w.length + w.nx * out,
  z: w.a.z + ((w.b.z - w.a.z) * u) / w.length + w.nz * out,
});

/** A wall decal planned: its kind, middle along the wall, width, bottom and top (world y), variant from its lift. */
interface WallSpot {
  readonly kind: StreetPropKind;
  readonly u: number;
  readonly width: number;
  readonly bottom: number;
  readonly top: number;
  readonly variant: (lift: number, height: number) => number;
}

/** Why a spot was turned down, for the importer's report. */
export type Reject = "neighbour" | "board" | "passage" | "front" | "top" | "district";

/** The least height a piece is painted (m). */
const MIN_HEIGHT = 0.2;

const groundAt = (ctx: DecalContext, p: Pt): number => Math.max(ctx.groundY(p), ctx.surfaceY?.(p) ?? -Infinity);

/** The highest paving under a stretch of the wall, looked at just in front of it. */
const pavingUnder = (ctx: DecalContext, w: DecalWall, u0: number, u1: number): number => Math.max(...[u0, (u0 + u1) / 2, u1].map((u) => groundAt(ctx, pointOn(w, u, 0.15))));

/**
 * The checks every wall decal passes; the piece, or why not. The spots come inside the wall's ends
 * and over the paving (`graffitiSpots`, `plateSpot`); the bottom is rounded up to its 0.1 m step.
 */
const settle = (site: Site, w: DecalWall, s: WallSpot, ctx: DecalContext, street: boolean): StreetPropItem | Reject => {
  const u0 = s.u - s.width / 2;
  const u1 = s.u + s.width / 2;
  const at = pointOn(w, s.u);
  const y = r2(ctx.groundY(at));
  const lift = dmUp(s.bottom - y);
  const height = dmDown(s.top - (y + lift));
  if (height < MIN_HEIGHT || lift < 0) return "top";
  const bottom = y + lift;
  const top = bottom + height;
  for (const u of [u0, u1]) {
    for (const yy of [bottom, top]) {
      const p = pointOn(w, u, OUT);
      const n = w.neighbourTop(p.x, p.z);
      if (n !== null && n > yy) return "neighbour";
    }
  }
  if (w.boards.some((b) => b.u0 < u1 + BOARD_ROOM && b.u1 > u0 - BOARD_ROOM && b.bottom < top + BOARD_ROOM && b.top > bottom - BOARD_ROOM)) return "board";
  if (w.passages || site.nearPassage(at, PASSAGE_ROOM)) return "passage";
  if (street && !site.standable(pointOn(w, s.u, FRONT))) return "front";
  return {
    prop: s.kind,
    x: r2(at.x),
    y,
    z: r2(at.z),
    yaw: Math.round(yawOf(w.nx, w.nz) * 10000) / 10000,
    variant: s.variant(lift, height),
  };
};

/** The graffiti spots of a wall in a zone, by hash: its size from the room the zone leaves. */
const graffitiSpots = (w: DecalWall, zone: DecalZone, ctx: DecalContext, key: string): WallSpot[] => {
  const share = (PAINT[w.district] ?? 0) * ZONE_SHARE[zone];
  const count = Math.max(1, Math.floor(w.length / WALL_STEP));
  const out: WallSpot[] = [];
  for (let k = 0; k < count; k++) {
    const kk = `${key}:${zone}:${k}`;
    if (unit(kk) >= share) continue;
    const slot = w.length / count;
    const room = slot - 2 * END_ROOM;
    const maxW = zone === "mural" ? Math.min(6, room) : Math.min(zone === "plinth" ? 2.4 : 3.2, room);
    const minW = zone === "mural" ? 2.5 : 0.6;
    if (maxW < minW) continue;
    const width = dmDown(minW + unit(`${kk}:w`) * (maxW - minW));
    const u = k * slot + END_ROOM + width / 2 + unit(`${kk}:u`) * (room - width);
    let bottom: number;
    let top: number;
    if (zone === "mural") {
      bottom = w.from + MURAL_LIFT;
      top = Math.min(w.top - TOP_ROOM, bottom + 1.5 + unit(`${kk}:h`) * 2.5);
    } else if (zone === "street") {
      bottom = pavingUnder(ctx, w, u - width / 2, u + width / 2) + STREET_LIFT;
      top = Math.min(w.top - TOP_ROOM, bottom + 0.5 + unit(`${kk}:h`) * 1.1);
    } else {
      const paving = pavingUnder(ctx, w, u - width / 2, u + width / 2);
      if (w.base - paving < PLINTH_MIN) continue;
      bottom = paving + PLINTH_FOOT;
      top = w.base - PLINTH_HEAD;
    }
    const design = fnv(`${kk}:d`) % GRAFFITI_DESIGNS;
    out.push({
      kind: "graffiti",
      u,
      width,
      bottom,
      top,
      variant: (lift, height) => graffitiVariant({ design, width, height, lift }),
    });
  }
  return out;
};

/** The zones a wall offers graffiti. */
export const zonesOf = (w: DecalWall): DecalZone[] => [...(w.glassFree && !w.blind ? ["street" as const] : []), ...(w.glassFree && w.blind && !w.holo ? ["mural" as const] : []), "plinth"];

/** Does a street's axis run in front of the wall's middle, within `STREET_REACH`? Its name, or null. */
export const streetInFront = (site: Site, w: DecalWall): string | null => {
  for (let d = 1; d <= STREET_REACH; d += 1) {
    const q = pointOn(w, w.length / 2, d);
    for (const st of site.streets) {
      for (let k = 0; k + 1 < st.line.length; k++) {
        const a = st.line[k]!;
        const b = st.line[k + 1]!;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const t = Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
        if (Math.hypot(a.x + dx * t - q.x, a.z + dz * t - q.z) < 1) return st.name;
      }
    }
  }
  return null;
};

/** The house plate of a building: on its street wall without glass, the one on its `addr:street` first. */
const plateSpot = (site: Site, walls: readonly DecalWall[], tags: Tags, ctx: DecalContext): { w: DecalWall; s: WallSpot } | null => {
  const no = parseHouseNumber(tags["addr:housenumber"]);
  if (!no) return null;
  const fits = walls.filter((w) => !w.landmark && w.glassFree && !w.blind && w.length >= HOUSE_PLATE.width + 2 * END_ROOM);
  const facing = fits.map((w) => ({ w, street: streetInFront(site, w) })).filter((f) => f.street !== null);
  facing.sort((p, q) => Number(q.street === tags["addr:street"]) - Number(p.street === tags["addr:street"]) || q.w.length - p.w.length);
  const pick = facing[0]?.w;
  if (!pick) return null;
  const u = pick.length / 2;
  const bottom = pavingUnder(ctx, pick, u - HOUSE_PLATE.width / 2, u + HOUSE_PLATE.width / 2) + PLATE_LIFT;
  return {
    w: pick,
    s: {
      kind: "house-plate",
      u,
      width: HOUSE_PLATE.width,
      bottom,
      top: Math.min(bottom + HOUSE_PLATE.height + 0.1, pick.top - 0.2),
      variant: (lift) => plateVariant({ ...no, lift }),
    },
  };
};

export interface DecalsOut {
  /** Pieces placed per kind and district. */
  readonly per: Record<string, Record<string, number>>;
  /** Spots turned down, by reason. */
  readonly rejected: Record<string, number>;
}

/**
 * Adds the decals to the furniture per chunk (after it: the stickers go on its poles and cabinets,
 * the grates keep off its manholes): the walls' here, the street's in `addStreetDecals`.
 */
export const addDecals = (byChunk: Map<string, StreetPropItem[]>, site: Site, walls: readonly DecalWall[], ctx: DecalContext): DecalsOut => {
  const per: Record<string, Record<string, number>> = {};
  const rejected: Record<string, number> = {};
  const put = (item: StreetPropItem): void => {
    const chunk = site.chunkAt(item);
    if (!chunk) return;
    const list = byChunk.get(chunk.id) ?? [];
    list.push(item);
    byChunk.set(chunk.id, list);
    (per[item.prop] ??= {})[chunk.district] = (per[item.prop]?.[chunk.district] ?? 0) + 1;
  };
  const street = addStreetDecals(byChunk, site, ctx, rejected);
  const byBuilding = new Map<string, DecalWall[]>();
  for (const w of walls) byBuilding.set(w.building, [...(byBuilding.get(w.building) ?? []), w]);
  for (const [building, list] of byBuilding) {
    const tags = ctx.buildingTags?.get(list[0]!.osm);
    if (!isProtected(list[0]!, tags)) {
      list.forEach((w, k) => {
        for (const zone of zonesOf(w)) {
          for (const s of graffitiSpots(w, zone, ctx, `${building}:${k}`)) {
            const settled = settle(site, w, s, ctx, zone !== "mural");
            // A building over a district's edge: the piece goes by the district it is in.
            const got = typeof settled !== "string" && (PAINT[site.chunkAt(settled)?.district ?? ""] ?? 0) <= 0 ? "district" : settled;
            if (typeof got === "string") rejected[`graffiti ${got}`] = (rejected[`graffiti ${got}`] ?? 0) + 1;
            else put(got);
          }
        }
      });
    }
    const plate = tags ? plateSpot(site, list, tags, ctx) : null;
    if (plate) {
      const got = settle(site, plate.w, plate.s, ctx, true);
      if (typeof got === "string") rejected[`house-plate ${got}`] = (rejected[`house-plate ${got}`] ?? 0) + 1;
      else put(got);
    }
  }
  for (const s of street) put(s.item);
  return { per, rejected };
};
