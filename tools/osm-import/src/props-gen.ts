/**
 * Street furniture of Lublin 2077 (ADR-0047) from `docs/world/lublin-props.todo.json`: every
 * group of the plan becomes `StreetPropItem`s per chunk. Points stay exact, lines with a
 * spacing are walked (lamps on the pavement beside the axis or on the facades), areas are
 * scattered by a Halton sequence, and the groups without geometry (manholes, cabinets, name
 * plates, bins) follow the streets and benches of the chunks. `y` is the chunk's terrain.
 */
import type { StreetPropItem, StreetPropKind } from "../../../packages/core/src/world/city-geo.ts";
import type { LublinChunkData } from "../../../packages/sim/src/content/lublin/types.ts";
import { type Pt, centroid } from "./geometry.ts";
import { MAPPED, propOf, withShape } from "./props-kinds.ts";
import { type SideMode, type Station, evenStations, fnv, openFacing, scatter, sideOffset, stations, towardsStreet, unit, yawOf } from "./props-place.ts";
import { Site } from "./props-site.ts";
import { placeStreetGroup } from "./props-streets.ts";

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
  readonly merged: number;
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
const JETS: Readonly<Record<string, number>> = { "fountain-multimedia": 28, fountain: 8 };

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

const besideLine = (site: Site, item: PlanItem, prop: StreetPropKind, slots: readonly Slot[]): Placed[] => {
  const { mode } = lineMode(item, prop);
  const out: Placed[] = [];
  const fallback = FALLBACK[prop] ?? 2;
  for (const { st, side, key } of slots) {
    if (mode === "axis") {
      out.push({ prop, p: st.p, yaw: null, key });
      continue;
    }
    const n = { x: -st.dir.z * side, z: st.dir.x * side };
    const d = sideOffset(site, st.p, n, mode, fallback);
    if (d === null) continue;
    // Lamps' arms, lanterns and café fronts face the street's axis.
    out.push({ prop, p: { x: st.p.x + n.x * d, z: st.p.z + n.z * d }, yaw: yawOf(-n.x, -n.z), key });
  }
  return out;
};

const onLines = (site: Site, item: PlanItem, prop: StreetPropKind): Placed[] => {
  const lines = linesOf(item);
  const spacing = item.spacing ?? ROW_SPACING[prop];
  const { sides, mode } = lineMode(item, prop);
  // Café gardens and boards take turns on the two sides; lamps stand on both at every station.
  const turns = mode === "front";
  if (spacing === undefined) {
    // A count spread over the lines, alternating sides for things on both.
    const sts = evenStations(lines, item.count ?? lines.length);
    return besideLine(site, item, prop, sts.map((st, k) => ({ st, side: sides === 2 && k % 2 === 1 ? -1 : 1, key: `${item.id}@${k}` })));
  }
  const slots: Slot[] = [];
  lines.forEach((l, i) => {
    const step = turns ? spacing * 2 : spacing;
    stations(l, step).forEach((st, k) => slots.push({ st, side: 1, key: `${item.id}@${i}:${k}` }));
    // The far side's stations sit half a step on, so the two rows alternate.
    if (sides === 2) stations(l, step, step).forEach((st, k) => slots.push({ st, side: -1, key: `${item.id}@${i}:${k}:b` }));
  });
  return besideLine(site, item, prop, slots);
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

const placeItem = (site: Site, item: PlanItem, prop: StreetPropKind): Placed[] => {
  if (item.position) return [{ prop, p: item.position, yaw: item.yaw === undefined ? null : (item.yaw * Math.PI) / 180, key: typeof item.osm === "string" ? item.osm : item.id }];
  if (item.points) return item.points.map((q, i) => ({ prop, p: { x: q[0], z: q[1] }, yaw: null, key: osmAt(item, i) }));
  if (item.polygon) {
    const ring = flat(item.polygon);
    if (SINGLE_OUTLINE.has(prop)) return [onOutline(site, item, prop, ring)];
    const count = JETS[item.kind] ?? item.count ?? 1;
    return scatter(site, ring, count, item.id, AREA_GAP[prop] ?? 2).map((p, k) => ({ prop, p, yaw: null, key: `${item.id}~${k}` }));
  }
  if (item.line || item.lines) return onLines(site, item, prop);
  return [];
};

/** Shapes the plan pins down: the Union obelisk, Koziołki, shrines, the tall mast. */
const shapeOf = (item: PlanItem, prop: StreetPropKind, key: string): number | undefined => {
  const text = `${item.id} ${item.look ?? ""}`.toLowerCase();
  if (prop === "flagpole") return item.kind === "flagpole-tall" ? 1 : 0;
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

/** Kinds that may stand on a building outline: wall-mounted, or a structure that is the outline itself. */
const ON_BUILDINGS: ReadonlySet<StreetPropKind> = new Set(["lamp-wall-lantern", "floodlight", "cctv", "kiosk", "bus-shelter"]);

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
    for (const x of placeItem(site, item, prop)) {
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
  const perItem: Record<string, [number, number]> = {};
  for (const item of plan.items) if (propOf(item.kind)) perItem[item.id] = [item.count ?? 0, 0];
  let outside = 0;
  let inBuilding = 0;
  let merged = 0;
  for (const x of placed) {
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
    same.push(x.p);
    kept.set(x.prop, same);
    const hash = fnv(x.key) & 0xffff;
    const variant = x.shape === undefined ? hash : withShape(hash, x.prop, x.shape);
    byChunk.get(chunk.id)!.push({ prop: x.prop, x: r1(x.p.x), y: r2(site.heightAt(x.p)), z: r1(x.p.z), yaw: r2(facingOf(site, x)), variant });
    perKind[x.prop] = (perKind[x.prop] ?? 0) + 1;
    perDistrict[chunk.district] = (perDistrict[chunk.district] ?? 0) + 1;
    const from = x.from ?? "";
    perItem[from] = [perItem[from]?.[0] ?? 0, (perItem[from]?.[1] ?? 0) + 1];
  }
  const mapped: Record<string, string> = {};
  for (const item of plan.items) if (MAPPED[item.kind]) mapped[item.kind] = MAPPED[item.kind]!.prop;
  return { byChunk, stats: { perKind, perDistrict, skipped, mapped, outside, inBuilding, merged, perItem } };
};
