/**
 * Street furniture of Lublin 2077 (ADR-0047) from `docs/world/lublin-props.todo.json`: every
 * group of the plan becomes `StreetPropItem`s per chunk. Points stay exact, lines with a
 * spacing are walked (lamps on the pavement beside the axis or on the facades), areas are
 * scattered by a Halton sequence, and the groups without geometry (manholes, cabinets, name
 * plates, bins) follow the streets and benches of the chunks. `y` is the chunk's terrain.
 */
import type { StreetPropItem, StreetPropKind } from "../../../packages/core/src/world/city-geo.ts";
import type { LublinChunkData } from "../../../packages/sim/src/content/lublin/types.ts";
import { crossingBands } from "../../../packages/sim/src/content/lublin/crossing-bands.ts";
import { type Pt, centroid } from "./geometry.ts";
import { MAPPED, propOf, withShape } from "./props-kinds.ts";
import { type SideMode, type Station, evenStations, fnv, offRoad, offWall, openFacing, scatter, sideOffset, stations, towardsStreet, unit, yawOf } from "./props-place.ts";
import { type BollardRef, stringBollards } from "./props-rows.ts";
import { Site } from "./props-site.ts";
import { SolidIndex, clearSpot } from "./props-solid.ts";
import { nearTraffic, placeStreetGroup } from "./props-streets.ts";

/** One group of the plan, as far as placement reads it. */
export interface PlanItem {
  readonly id: string;
  readonly kind: string;
  readonly area?: { readonly district?: string; readonly chunk?: string | readonly string[] | null };
  readonly position?: { readonly x: number; readonly z: number };
  readonly points?: readonly (readonly [number, number])[];
  readonly line?: readonly number[];
  readonly lines?: readonly (readonly number[])[];
  readonly polygon?: readonly number[];
  readonly count?: number;
  readonly spacing?: number;
  readonly yaw?: number;
  readonly osm?: string | readonly string[];
  readonly look?: string;
  readonly note?: string;
}

export interface PropsPlan {
  readonly items: readonly PlanItem[];
}

/** A placed piece before it is split into chunks: `key` seeds its variant. */
export interface Placed {
  readonly prop: StreetPropKind;
  readonly p: Pt;
  readonly yaw: number | null;
  readonly key: string;
  readonly shape?: number;
  /** Id of the plan's group (filled in by the generator). */
  readonly from?: string;
}

export interface PropsStats {
  /** Pieces per kind and per district. */
  readonly perKind: Record<string, number>;
  readonly perDistrict: Record<string, number>;
  /** Pieces the plan asked for in groups that were left out, per plan kind. */
  readonly skipped: Record<string, number>;
  /** Plan kinds drawn as another kind. */
  readonly mapped: Record<string, string>;
  /** Pieces dropped: outside every chunk, inside a building outline, or too close to the same kind. */
  readonly outside: number;
  readonly inBuilding: number;
  /** Pieces moved off the carriageway onto the pavement or out from a wall, and dropped on a road with no pavement near. */
  readonly offRoad: number;
  readonly onRoad: number;
  readonly merged: number;
  /** Pieces dropped because their solid ran into one placed before, with no clear spot beside. */
  readonly crowded: number;
  /** Per group of the plan: pieces asked for and pieces placed. */
  readonly perItem: Record<string, [number, number]>;
}

export interface PropsOut {
  readonly byChunk: ReadonlyMap<string, StreetPropItem[]>;
  readonly stats: PropsStats;
}

const flat = (f: readonly number[]): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < f.length; i += 2) out.push({ x: f[i]!, z: f[i + 1]! });
  return out;
};

const linesOf = (item: PlanItem): Pt[][] => [...(item.line ? [flat(item.line)] : []), ...(item.lines ?? []).map(flat)].filter((l) => l.length >= 2);

const osmAt = (item: PlanItem, i: number): string => (Array.isArray(item.osm) ? (item.osm[i] ?? `${item.id}#${i}`) : `${item.id}#${i}`);

/** Lamps' offsets from a pedestrian street's axis, and other things' distance from a facade. */
const FALLBACK: Partial<Record<StreetPropKind, number>> = { "lamp-pastoral": 5, "lamp-modern-pole": 4, "lamp-candelabra": 4, "lamp-road": 6, "lamp-park": 1.5, "trolley-pole": 6, "cafe-garden": 2.6, "a-frame-sign": 1 };

/** Line spacing for groups that give none (trees in a row, clipped shrubs). */
const ROW_SPACING: Partial<Record<StreetPropKind, number>> = { tree: 9, shrubs: 6 };

/** Least distance between two pieces of the same kind placed from lines or areas. */
const AREA_GAP: Partial<Record<StreetPropKind, number>> = { "market-stall": 3.6, "cafe-garden": 4.5, "fountain-jets": 2.2 };

/** Jets a fountain basin gets (the plan counts the fountain, not its jets). */
const JETS: Readonly<Record<string, number>> = { "fountain-multimedia": 16, fountain: 6 };

/** How pieces of a line find their place, from the plan's note. */
const lineMode = (item: PlanItem, prop: StreetPropKind): { mode: SideMode | "axis"; sides: 1 | 2 } => {
  const note = item.note ?? "";
  if (prop === "lamp-wall-lantern") return { mode: "facade", sides: 2 };
  if (prop === "lamp-park" || (prop === "lamp-candelabra" && item.spacing === undefined)) return { mode: "path", sides: prop === "lamp-park" ? 1 : 2 };
  if (prop.startsWith("lamp-") || prop === "trolley-pole") return { mode: "kerb", sides: note.includes("obu stronach") ? 2 : 1 };
  if (prop === "cafe-garden" || prop === "a-frame-sign") return { mode: "front", sides: 2 };
  return { mode: "axis", sides: 1 };
};

interface Slot {
  readonly st: Station;
  /** 1 left of the line's direction, -1 right. */
  readonly side: 1 | -1;
  readonly key: string;
}

/** Something placed before that a lamp keeps `r` metres from (a tree's crown, a bench). */
interface Obstacle {
  readonly x: number;
  readonly z: number;
  readonly r: number;
}

const blocked = (obstacles: readonly Obstacle[], p: Pt, extra = 0): boolean =>
  obstacles.some((q) => Math.abs(q.x - p.x) < q.r + extra && Math.abs(q.z - p.z) < q.r + extra && Math.hypot(q.x - p.x, q.z - p.z) < q.r + extra);

/** Slides along the line, a few metres either way, to where nothing placed stands in the way. */
const SLIDES = [0, 2.5, -2.5, 5, -5];

const besideLine = (site: Site, item: PlanItem, prop: StreetPropKind, slots: readonly Slot[], obstacles: readonly Obstacle[]): Placed[] => {
  const { mode } = lineMode(item, prop);
  const out: Placed[] = [];
  const fallback = FALLBACK[prop] ?? 2;
  const clear = (p: Pt) => mode === "facade" || !blocked(obstacles, p);
  for (const { st, side, key } of slots) {
    if (mode === "axis") {
      out.push({ prop, p: st.p, yaw: null, key });
      continue;
    }
    const n = { x: -st.dir.z * side, z: st.dir.x * side };
    for (const s of SLIDES) {
      const at = { x: st.p.x + st.dir.x * s, z: st.p.z + st.dir.z * s };
      const d = sideOffset(site, at, n, mode, fallback);
      if (d === null) continue;
      const p = { x: at.x + n.x * d, z: at.z + n.z * d };
      if (!clear(p)) continue;
      // Lamps' arms, lanterns and café fronts face the street's axis.
      out.push({ prop, p, yaw: yawOf(-n.x, -n.z), key });
      break;
    }
  }
  return out;
};

const onLines = (site: Site, item: PlanItem, prop: StreetPropKind, obstacles: readonly Obstacle[]): Placed[] => {
  const lines = linesOf(item);
  const spacing = item.spacing ?? ROW_SPACING[prop];
  const { sides, mode } = lineMode(item, prop);
  // Café gardens and boards take turns on the two sides; lamps stand on both at every station.
  const turns = mode === "front";
  if (spacing === undefined) {
    // A count spread over the lines, alternating sides for things on both.
    const sts = evenStations(lines, item.count ?? lines.length);
    return besideLine(site, item, prop, sts.map((st, k) => ({ st, side: sides === 2 && k % 2 === 1 ? -1 : 1, key: `${item.id}@${k}` })), obstacles);
  }
  const slots: Slot[] = [];
  lines.forEach((l, i) => {
    const step = turns ? spacing * 2 : spacing;
    stations(l, step).forEach((st, k) => slots.push({ st, side: 1, key: `${item.id}@${i}:${k}` }));
    // The far side's stations sit half a step on, so the two rows alternate.
    if (sides === 2) stations(l, step, step).forEach((st, k) => slots.push({ st, side: -1, key: `${item.id}@${i}:${k}:b` }));
  });
  return besideLine(site, item, prop, slots, obstacles);
};

/** One structure on its outline (kiosk, shelter): at the centroid, its front along the longest edge. */
const onOutline = (site: Site, item: PlanItem, prop: StreetPropKind, ring: readonly Pt[]): Placed => {
  let best = 0;
  let dir = { x: 0, z: 1 };
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    const l = Math.hypot(b.x - a.x, b.z - a.z);
    if (l > best) {
      best = l;
      dir = { x: (b.x - a.x) / l, z: (b.z - a.z) / l };
    }
  }
  const c = centroid(ring);
  const towards = towardsStreet(site, c) ?? { x: -dir.z, z: dir.x };
  const n = -dir.z * towards.x + dir.x * towards.z >= 0 ? { x: -dir.z, z: dir.x } : { x: dir.z, z: -dir.x };
  return { prop, p: c, yaw: yawOf(n.x, n.z), key: typeof item.osm === "string" ? item.osm : item.id };
};

const SINGLE_OUTLINE: ReadonlySet<StreetPropKind> = new Set(["kiosk", "bus-shelter", "bus-stop", "vending-machine"]);

/** How far scattered pieces keep from a car street's axis (m): its two lanes, a car's half and the piece's own. */
const TRAFFIC_REACH = 4.5;

const placeItem = (site: Site, item: PlanItem, prop: StreetPropKind, obstacles: readonly Obstacle[]): Placed[] => {
  if (item.position) return [{ prop, p: item.position, yaw: item.yaw === undefined ? null : (item.yaw * Math.PI) / 180, key: typeof item.osm === "string" ? item.osm : item.id }];
  if (item.points) return item.points.map((q, i) => ({ prop, p: { x: q[0], z: q[1] }, yaw: null, key: osmAt(item, i) }));
  if (item.polygon) {
    const ring = flat(item.polygon);
    // A kiosk or a shelter whose outline the importer already raised as a building would stand inside its own double.
    if (SINGLE_OUTLINE.has(prop)) return site.surfaceAt(centroid(ring)) === "building" ? [] : [onOutline(site, item, prop, ring)];
    const count = JETS[item.kind] ?? item.count ?? 1;
    // Off the lanes of the streets crossing the area (the car park of Plac Zamkowy under its flea market).
    const clear = { surfaceAt: (p: Pt) => site.surfaceAt(p), standable: (p: Pt) => site.standable(p) && !nearTraffic(site, p, TRAFFIC_REACH) } as Site;
    return scatter(clear, ring, count, item.id, AREA_GAP[prop] ?? 2).map((p, k) => ({ prop, p, yaw: null, key: `${item.id}~${k}` }));
  }
  if (item.line || item.lines) return [...onLines(site, item, prop, obstacles), ...fillPlace(site, item, prop, obstacles)];
  return [];
};

/**
 * Squares whose lamps the plan asks to spread over the whole square, not only along the axes
 * ("po obrysie placu i wzdłuż alejek"): the extra lamps scattered on its paving.
 */
const PLACE_FILL: Readonly<Record<string, { readonly ring: readonly Pt[]; readonly count: number; readonly gap: number }>> = {
  // Plac Litewski, x -100..135, z -55..70 in the plan.
  "lamps.plac-litewski": {
    ring: [
      { x: -95, z: -50 },
      { x: 130, z: -50 },
      { x: 130, z: 66 },
      { x: -95, z: 66 },
    ],
    count: 18,
    gap: 17,
  },
};


const fillPlace = (site: Site, item: PlanItem, prop: StreetPropKind, obstacles: readonly Obstacle[]): Placed[] => {
  const f = PLACE_FILL[item.id];
  if (!f) return [];
  const open = (p: Pt) => site.surfaceAt(p) === "walk" && !blocked(obstacles, p, 1);
  const paved = { surfaceAt: (p: Pt) => site.surfaceAt(p), standable: open } as Site;
  return scatter(paved, f.ring, f.count, `${item.id}#fill`, f.gap).map((p, k) => ({ prop, p, yaw: null, key: `${item.id}#fill${k}` }));
};

/** What a lamp beside a line keeps clear of, and how far (m): trees by their crowns. */
const OBSTACLE: Partial<Record<StreetPropKind, number>> = { tree: 3.4, bench: 1.8, "advertising-column": 1.8, kiosk: 2.5, "bus-shelter": 2.5, monument: 2.5, artwork: 1.8, "cafe-garden": 3, "fountain-jets": 1.8 };

/** Shapes the plan pins down: the Union obelisk, Koziołki, shrines, the tall mast. */
const shapeOf = (item: PlanItem, prop: StreetPropKind, key: string): number | undefined => {
  const text = `${item.id} ${item.look ?? ""}`.toLowerCase();
  if (prop === "flagpole") return item.kind === "flagpole-tall" ? 1 : 0;
  if (prop === "advertising-column") return text.includes("żółty") ? 1 : 0;
  if (prop !== "monument" && prop !== "artwork") return undefined;
  if (text.includes("obelisk") || item.id.endsWith("pomnik-unii")) return 0;
  if (text.includes("koziołek") || text.includes("koziolek")) return item.points ? [2, 3, 1][fnv(key) % 3] : 2;
  if (item.kind === "shrine" || prop === "monument") return 1;
  return [1, 3][fnv(key) % 2];
};

/** Who stands where it can be approached and faces open pavement (benches, machines, bins). */
const FACES_OPEN: ReadonlySet<StreetPropKind> = new Set(["bench", "vending-machine", "ticket-machine", "bike-rack", "bike-station", "waste-bin", "a-frame-sign", "advertising-column", "street-cabinet", "street-plate", "planter"]);
const FACES_STREET: ReadonlySet<StreetPropKind> = new Set(["bus-stop", "bus-shelter", "traffic-signal", "monument", "kiosk", "cctv", "floodlight"]);

/** The yaw of a piece the plan gives no direction for. */
export const facingOf = (site: Site, x: Placed): number => {
  if (x.yaw !== null) return x.yaw;
  const open = FACES_OPEN.has(x.prop) ? openFacing(site, x.p) : null;
  const street = FACES_OPEN.has(x.prop) || FACES_STREET.has(x.prop) ? towardsStreet(site, x.p) : null;
  const f = open ?? street;
  return f ? yawOf(f.x, f.z) : unit(`${x.key}#yaw`) * Math.PI * 2 - Math.PI;
};

const r2 = (v: number): number => Math.round(v * 100) / 100 + 0;
const r1 = (v: number): number => Math.round(v * 10) / 10 + 0;

/** Kinds that may stand on a building outline: the wall-mounted ones. */
const ON_BUILDINGS: ReadonlySet<StreetPropKind> = new Set(["lamp-wall-lantern", "cctv"]);

/** How far the bulky free-standing pieces keep from the walls (m): about their footprint's radius. */
const WALL_ROOM: Partial<Record<StreetPropKind, number>> = { artwork: 1.5, monument: 1.5, kiosk: 1.7, "bus-shelter": 2, bench: 1.2, "vending-machine": 0.7, "advertising-column": 0.8, floodlight: 0.4 };

/**
 * How far a piece may be moved out from a wall (m), beyond the default 4: the plan sketches the
 * floodlights on the lit building's outline, up to 8 m inside the Trinitarian Tower.
 */
const WALL_REACH: Partial<Record<StreetPropKind, number>> = { floodlight: 10 };

/** Kinds that belong on the carriageway: covers in it, bollards closing it. */
const ON_ROAD: ReadonlySet<StreetPropKind> = new Set(["manhole", "bollard"]);

/** Least distance between two pieces of one kind before the later one is dropped. */
const minGap = (prop: StreetPropKind, fromLine: boolean): number => (prop.startsWith("lamp-") && fromLine ? 7 : prop === "trolley-pole" ? 10 : 0.3);

/** The plan's groups placed (before the chunks): every piece with its prop, point, yaw and key. */
const placeAll = (site: Site, plan: PropsPlan, skipped: Record<string, number>): { placed: Placed[]; fromLine: Set<Placed> } => {
  const placed: Placed[] = [];
  const fromLine = new Set<Placed>();
  const deferred: PlanItem[] = [];
  for (const item of plan.items) {
    const prop = propOf(item.kind);
    if (!prop) {
      skipped[item.kind] = (skipped[item.kind] ?? 0) + (item.count ?? 0);
      continue;
    }
    const noGeometry = !item.position && !item.points && !item.polygon && !item.line && !item.lines;
    if (noGeometry || prop === "hanging-basket") {
      deferred.push(item);
      continue;
    }
    const obstacles = placed.flatMap((x) => (OBSTACLE[x.prop] ? [{ x: x.p.x, z: x.p.z, r: OBSTACLE[x.prop]! }] : []));
    for (const x of placeItem(site, item, prop, obstacles)) {
      const shape = shapeOf(item, prop, x.key);
      const p = shape === undefined ? { ...x, from: item.id } : { ...x, shape, from: item.id };
      placed.push(p);
      if (item.line || item.lines) fromLine.add(p);
    }
  }
  // Baskets hang on the lamps, the street groups follow the streets and the benches.
  for (const item of deferred) for (const x of placeStreetGroup(site, item, placed, (q) => facingOf(site, q))) placed.push({ ...x, from: item.id });
  return { placed, fromLine };
};

/** Every group of the plan as street furniture per chunk, with the control numbers. */
export const generateProps = (plan: PropsPlan, chunks: readonly LublinChunkData[]): PropsOut => {
  const site = new Site(chunks);
  const skipped: Record<string, number> = {};
  const { placed, fromLine } = placeAll(site, plan, skipped);
  const byChunk = new Map<string, StreetPropItem[]>(chunks.map((c) => [c.id, []]));
  const perKind: Record<string, number> = {};
  const perDistrict: Record<string, number> = {};
  const kept = new Map<StreetPropKind, Pt[]>();
  const solids = new SolidIndex();
  const perItem: Record<string, [number, number]> = {};
  for (const item of plan.items) if (propOf(item.kind)) perItem[item.id] = [item.count ?? 0, 0];
  // The plan's bollards (not the drinking fountains drawn as one), to string into rows.
  const bollardGroups = new Set(plan.items.filter((i) => i.kind === "bollard").map((i) => i.id));
  const bollards: (BollardRef & { district: string; from: string })[] = [];
  let outside = 0;
  let inBuilding = 0;
  let merged = 0;
  let crowded = 0;
  let moved = 0;
  let onRoad = 0;
  for (const placedAt of placed) {
    // A light, a machine or a tree from a node in the road stands on the nearest pavement.
    // Judged where it ends up, at the 0.1 m the chunks keep.
    const at = { x: r1(placedAt.p.x), z: r1(placedAt.p.z) };
    const off = ON_ROAD.has(placedAt.prop) ? at : offRoad(site, at);
    if (!off) {
      onRoad++;
      continue;
    }
    // A sculpture or a kiosk from a node on a facade stands clear of the wall.
    const room = ON_BUILDINGS.has(placedAt.prop) ? undefined : WALL_ROOM[placedAt.prop];
    const free = room === undefined ? off : offWall(site, off, room, WALL_REACH[placedAt.prop]);
    if (!free) {
      inBuilding++;
      continue;
    }
    if (free !== at) moved++;
    const x = free === at ? placedAt : { ...placedAt, p: { x: r1(free.x), z: r1(free.z) } };
    const chunk = site.chunkAt(x.p);
    if (!chunk) {
      outside++;
      continue;
    }
    if (!ON_BUILDINGS.has(x.prop) && site.surfaceAt(x.p) === "building") {
      inBuilding++;
      continue;
    }
    const same = kept.get(x.prop) ?? [];
    const gap = minGap(x.prop, fromLine.has(x));
    if (same.some((q) => Math.hypot(q.x - x.p.x, q.z - x.p.z) < gap)) {
      merged++;
      continue;
    }
    const hash = fnv(x.key) & 0xffff;
    // A bollard's variant is its chain (none until its row is strung), not a hash.
    const variant = x.prop === "bollard" ? 0 : x.shape === undefined ? hash : withShape(hash, x.prop, x.shape);
    // Earlier groups win: a bin beside a bench steps aside from a tree's trunk, on the same ground.
    const surface = site.surfaceAt(x.p);
    const fits = (q: Pt) => site.surfaceAt(q) === surface && site.chunkAt(q) === chunk && (room === undefined || offWall(site, q, room) === q);
    const item = clearSpot(solids, { prop: x.prop, x: r1(x.p.x), y: 0, z: r1(x.p.z), yaw: r2(facingOf(site, x)), variant }, fits);
    if (!item) {
      crowded++;
      continue;
    }
    same.push({ x: item.x, z: item.z });
    kept.set(x.prop, same);
    solids.add(item);
    const list = byChunk.get(chunk.id)!;
    list.push({ ...item, y: r2(site.heightAt(item)) });
    if (bollardGroups.has(x.from ?? "")) bollards.push({ chunk: chunk.id, index: list.length - 1, district: chunk.district, from: x.from ?? "" });
    perKind[x.prop] = (perKind[x.prop] ?? 0) + 1;
    perDistrict[chunk.district] = (perDistrict[chunk.district] ?? 0) + 1;
    const from = x.from ?? "";
    perItem[from] = [perItem[from]?.[0] ?? 0, (perItem[from]?.[1] ?? 0) + 1];
  }
  // Rows, chains and the zebras' mouths; a post with no room out of a mouth goes.
  const table = byChunk as Map<string, (StreetPropItem | undefined)[]>;
  for (const r of stringBollards(site, table, bollards, crossingBands(chunks))) {
    perKind.bollard = perKind.bollard! - 1;
    perDistrict[r.district] = perDistrict[r.district]! - 1;
    perItem[r.from] = [perItem[r.from]![0], perItem[r.from]![1] - 1];
  }
  for (const [id, list] of table) byChunk.set(id, list.filter((i): i is StreetPropItem => i !== undefined));
  const mapped: Record<string, string> = {};
  for (const item of plan.items) if (MAPPED[item.kind]) mapped[item.kind] = MAPPED[item.kind]!.prop;
  return { byChunk, stats: { perKind, perDistrict, skipped, mapped, outside, inBuilding, offRoad: moved, onRoad, merged, crowded, perItem } };
};
