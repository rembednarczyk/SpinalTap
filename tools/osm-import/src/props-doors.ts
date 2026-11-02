/**
 * The doors on the facades of Lublin 2077 (ADR-0058 stage 9), placed by rules from the map data,
 * no list of points, so they carry over to new districts with `pnpm osm:props`:
 * 1. **An entrance of the map** (`entrance=*`, `door=*` in `data/osm/points/entrances.json`) within
 *    `ENTRANCE_REACH` of a drawn wall gets a door there, in the wall's slot nearest it (`SNAP`).
 *    Its model by its tags: a roller shutter for a garage or a service entrance, a steel double
 *    door for a main one, a steel door for a staircase and the rest.
 * 2. **A venue's board with no entrance under it** (the map has entrances for few buildings: 59 in
 *    the four districts, against some 300 boards) gets a shop's door under it, in the slot nearest
 *    its middle within its span: a shop's door is where its sign is. A bank's is a door on a code.
 * 3. **A tenement with no door yet** (use `residential` or `historic`) gets the door of its staircase
 *    on its longest wall facing a street (a street's axis within `STREET_REACH` in front of it), in
 *    the slot nearest the wall's middle: every tenement is entered from its street, and the map
 *    tags almost none of those entrances.
 * Each door stands in a slot of its wall (`doorSlots` in the renderer: between the panes the facade
 * shader paints or over a whole one, under the boards), and only where:
 * - the game's own doors (ADR-0038) are `GAME_DOOR_ROOM` away, and no passage (ADR-0048) runs
 *   within `PASSAGE_ROOM` of it;
 * - the ground in front of it is open (not a building, water or rails) and flat across it
 *   (`ACROSS_SLOPE`), and the paving under it lies within `STEP_ROOM` of the ground floor; its foot
 *   stands on that paving;
 * - no solid of the street furniture stands within `FRONT_ROOM` in front of it;
 * - it keeps `SPACING` from every door placed before.
 * A door covering a pane takes its model by the wall: a shop's door over a shop window, a tall
 * door with a fanlight over a window.
 */
import type { StreetPropItem } from "../../../packages/core/src/world/city-geo.ts";
import { type DoorModel, doorLayout, doorVariant } from "../../../packages/core/src/world/doors.ts";
import { distanceToPiece, furniturePrisms } from "../../../packages/sim/src/content/lublin/furniture.ts";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Pt } from "./geometry.ts";
import { REPO } from "./paths.ts";
import { geoToWorld } from "./project.ts";
import type { DoorSpan } from "./props-roads.ts";
import type { Site } from "./props-site.ts";

/**
 * A slot for a door on a wall (the renderer's `DoorSlot`): middle along the wall, width, the lowest
 * and the highest top over the ground floor, over a pane or not.
 */
export interface WallSlot {
  readonly u: number;
  readonly width: number;
  readonly top: number;
  readonly max: number;
  readonly cover: boolean;
}

/** A wall of a drawn building that may take doors: its ends and outward normal, its ground floor (world y), its slots and the venues' boards on it. */
export interface DoorWall {
  readonly building: string;
  /** The building's use (`BuildingUse`): the tenements get a staircase's door. */
  readonly use: string;
  readonly a: Pt;
  readonly b: Pt;
  readonly nx: number;
  readonly nz: number;
  readonly length: number;
  readonly base: number;
  readonly slots: readonly WallSlot[];
  readonly boards: readonly { readonly u0: number; readonly u1: number; readonly kind: string }[];
}

/** An entrance of the map: node id, world point and its tags. */
export interface Entrance {
  readonly id: string;
  readonly p: Pt;
  readonly entrance: string;
  readonly door: string;
  readonly level: string;
}

export interface DoorContext {
  /** Height of the paving drawn at a point; the terrain without it. */
  readonly surfaceY?: (p: Pt) => number;
  /** The jambs of the game's doors. */
  readonly gameDoors?: readonly DoorSpan[];
  /** The street furniture placed before (its solids keep the doors' fronts clear). */
  readonly furniture?: readonly StreetPropItem[];
  /** The axes of the ways under ground (`loadUndergroundWays`): no tenement is entered from them. */
  readonly underground?: readonly (readonly Pt[])[];
}

/** A door placed: its piece (point on the wall's face, facing out) and why it is there. */
export interface PlacedDoor {
  readonly item: StreetPropItem;
  readonly rule: "entrance" | "venue" | "staircase";
  readonly from: string;
}

/** How far an entrance's node may lie from the wall it is on, and its door from the node along the wall (m). */
export const ENTRANCE_REACH = 1.5;
export const SNAP = 1.5;
/** How far from the game's doors and a passage's axis, and how much ground in front stays clear of the furniture (m). */
export const GAME_DOOR_ROOM = 3;
export const PASSAGE_ROOM = 3;
export const FRONT_ROOM = 1;
/** Between two doors' edges (m). */
export const SPACING = 0.6;
/** Step between the paving and the ground floor, and the paving's fall across a door (m). */
export const STEP_ROOM = 0.8;
export const ACROSS_SLOPE = 0.12;
/** How far in front of a wall a street's axis may run for the wall to face it (m). */
export const STREET_REACH = 14;
/** The uses of the buildings that get a staircase's door (rule 3). */
const TENEMENTS: ReadonlySet<string> = new Set(["residential", "historic"]);
/** How far out the ground in front of a door is looked at, and its foot's paving under its frame (m). */
const FRONT = 0.6;
const FOOT = 0.1;

const r2 = (v: number): number => Math.round(v * 100) / 100 + 0;

const pointOn = (w: DoorWall, u: number, out = 0): Pt => ({ x: w.a.x + ((w.b.x - w.a.x) * u) / w.length + w.nx * out, z: w.a.z + ((w.b.z - w.a.z) * u) / w.length + w.nz * out });

const segGap = (p: Pt, a: Pt, b: Pt): number => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z);
};

/** The model of an entrance's door by its tags, on a slot (over a pane: the wall's own kind of door). */
export const entranceModel = (e: Pick<Entrance, "entrance" | "door">, slot: WallSlot, shopWall: boolean): DoorModel => {
  if (["overhead", "roller", "garage", "sectional"].includes(e.door) || ["garage", "service"].includes(e.entrance)) return slot.width >= 1.6 ? "shutter" : "steel";
  if (slot.cover) return shopWall ? "shop" : "tall";
  if (["revolving", "sliding", "automatic"].includes(e.door)) return "shop";
  return e.entrance === "main" && slot.width >= 1.15 ? "steel-double" : "steel";
};

/** The checks every door passes; the placed doors, for the spacing. */
class DoorRules {
  readonly placed: PlacedDoor[] = [];
  /** Slots turned down, by the rule that turned them down. */
  readonly rejected: Record<string, number> = {};
  private readonly spans: { p: Pt; w: number }[] = [];
  private readonly site: Site;
  private readonly ctx: DoorContext;
  constructor(site: Site, ctx: DoorContext) {
    this.site = site;
    this.ctx = ctx;
  }

  private no(rule: string): null {
    this.rejected[rule] = (this.rejected[rule] ?? 0) + 1;
    return null;
  }

  surface(p: Pt): number {
    return this.ctx.surfaceY ? this.ctx.surfaceY(p) : this.site.heightAt(p);
  }

  /** The door for a slot of a wall as a piece, or null where a rule keeps it out. */
  fit(w: DoorWall, s: WallSlot, model: DoorModel): StreetPropItem | null {
    const at = pointOn(w, s.u);
    const front = pointOn(w, s.u, FRONT);
    if ((this.ctx.gameDoors ?? []).some((d) => segGap(at, d.a, d.b) < GAME_DOOR_ROOM)) return this.no("game-door");
    if (this.site.nearPassage(at, PASSAGE_ROOM) || this.site.nearPassage(front, PASSAGE_ROOM)) return this.no("passage");
    const jambs = [pointOn(w, s.u - s.width / 2, FRONT), pointOn(w, s.u + s.width / 2, FRONT)];
    if (![front, ...jambs].every((q) => this.site.standable(q))) return this.no("ground");
    // Its foot on the paving under its frame (a raised pavement in front hides its sill).
    const y = this.surface(pointOn(w, s.u, FOOT));
    const ys = [-1, 1].map((k) => this.surface(pointOn(w, s.u + (k * s.width) / 2, FOOT)));
    if (Math.abs(y - w.base) > STEP_ROOM) return this.no("step");
    if (Math.max(...ys) - Math.min(...ys) > ACROSS_SLOPE) return this.no("slope");
    if (this.spans.some((d) => Math.hypot(d.p.x - at.x, d.p.z - at.z) < (d.w + s.width) / 2 + SPACING)) return this.no("spacing");
    const reach = [0.5, 1].flatMap((k) => [-0.5, 0, 0.5].map((t) => pointOn(w, s.u + t * s.width, k * FRONT_ROOM)));
    const near = (this.ctx.furniture ?? []).filter((i) => Math.hypot(i.x - at.x, i.z - at.z) < 6 && furniturePrisms(i).length > 0);
    if (near.some((i) => reach.some((q) => distanceToPiece(i, q.x, q.z) < 0.05))) return this.no("furniture");
    const height = w.base + s.top - r2(y);
    const variant = doorVariant({ model, width: s.width, height });
    // Its height rounded up to what the variant keeps (2 m at least) must stay under a board or the first floor.
    if (r2(y) + doorLayout(variant).height > w.base + s.max + 1e-6) return this.no("rounding");
    this.spans.push({ p: at, w: doorLayout(variant).width });
    return { prop: "door", x: r2(at.x), y: r2(y), z: r2(at.z), yaw: Math.round(Math.atan2(w.nx, w.nz) * 10000) / 10000, variant };
  }
}

/** The slots of a wall nearest `u` first, within `reach` of it and inside [lo, hi] if given. */
const slotsNear = (w: DoorWall, u: number, reach: number, lo = -Infinity, hi = Infinity): WallSlot[] =>
  w.slots.filter((s) => Math.abs(s.u - u) <= reach && s.u >= lo && s.u <= hi).sort((p, q) => Math.abs(p.u - u) - Math.abs(q.u - u) || p.u - q.u);

/** Along a wall from `a`, and how far off its line. */
const onWall = (w: DoorWall, p: Pt): { u: number; off: number } => {
  const dx = (w.b.x - w.a.x) / w.length;
  const dz = (w.b.z - w.a.z) / w.length;
  return { u: (p.x - w.a.x) * dx + (p.z - w.a.z) * dz, off: Math.abs((p.x - w.a.x) * w.nx + (p.z - w.a.z) * w.nz) };
};

/** Rule 1: the map's entrances on the drawn walls. */
const entranceDoors = (rules: DoorRules, walls: readonly DoorWall[], entrances: readonly Entrance[]): void => {
  for (const e of [...entrances].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    // An entrance below the street (a cellar's, a passage's to the underground) is not on the facade.
    if (Number(e.level || 0) < 0 || e.entrance === "no") continue;
    const candidates = walls
      .map((w) => ({ w, ...onWall(w, e.p) }))
      .filter((c) => c.u >= -0.5 && c.u <= c.w.length + 0.5 && segGap(e.p, c.w.a, c.w.b) <= ENTRANCE_REACH)
      .sort((p, q) => segGap(e.p, p.w.a, p.w.b) - segGap(e.p, q.w.a, q.w.b));
    for (const c of candidates) {
      const shop = c.w.boards.length > 0;
      const item = slotsNear(c.w, c.u, SNAP)
        .map((s) => rules.fit(c.w, s, entranceModel(e, s, shop)))
        .find((x) => x !== null);
      if (item) {
        rules.placed.push({ item, rule: "entrance", from: `n${e.id}` });
        break;
      }
    }
  }
};

/** Rule 2: a shop's door under each venue's board without a door under it already. */
const venueDoors = (rules: DoorRules, walls: readonly DoorWall[]): void => {
  for (const w of walls) {
    for (const b of [...w.boards].sort((p, q) => p.u0 - q.u0)) {
      const under = rules.placed.some((d) => {
        const o = onWall(w, d.item);
        return o.off < 0.1 && o.u > b.u0 - 1 && o.u < b.u1 + 1;
      });
      if (under) continue;
      const model: DoorModel = b.kind === "bank" ? "code" : "shop";
      const item = slotsNear(w, (b.u0 + b.u1) / 2, Infinity, b.u0, b.u1)
        .map((s) => rules.fit(w, s, s.cover || model === "code" ? model : "shop"))
        .find((x) => x !== null);
      if (item) rules.placed.push({ item, rule: "venue", from: `${w.building}:${r2((b.u0 + b.u1) / 2)}` });
    }
  }
};

/** How far a street's simplified axis (1 m, `chunkStreets`) may stray from the map's way it was drawn from (m). */
const ALONG = 1.2;

/** Does a street's segment run along a way under ground: its ends and middle within `ALONG` of one? */
const underground = (under: readonly (readonly Pt[])[], a: Pt, b: Pt): boolean => {
  const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
  return under.some((l) => [a, b, mid].every((p) => l.slice(1).some((q, i) => segGap(p, l[i]!, q) <= ALONG)));
};

/**
 * Does a wall face a street: a street's axis within `STREET_REACH` in front of its middle, nothing built
 * between? A way under ground (Trasa Podziemna runs beneath the Old Town's yards) is not one (G-197).
 */
const facesStreet = (site: Site, w: DoorWall, under: readonly (readonly Pt[])[]): boolean => {
  const steps = [2, 6, 10].map((k) => pointOn(w, w.length / 2, k));
  if (steps.some((q) => site.surfaceAt(q) === "building")) return false;
  const front = pointOn(w, w.length / 2, STREET_REACH / 2);
  return site.streets.some((s) => s.line.slice(1).some((b, i) => segGap(front, s.line[i]!, b) < STREET_REACH / 2 && !underground(under, s.line[i]!, b)));
};

/** Rule 3: the staircase's door of each tenement without a door, on its longest wall facing a street. */
const staircaseDoors = (rules: DoorRules, site: Site, walls: readonly DoorWall[], under: readonly (readonly Pt[])[]): void => {
  const byBuilding = new Map<string, DoorWall[]>();
  for (const w of walls) if (TENEMENTS.has(w.use)) byBuilding.set(w.building, [...(byBuilding.get(w.building) ?? []), w]);
  for (const [building, own] of [...byBuilding].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const has = rules.placed.some((d) => own.some((w) => onWall(w, d.item).off < 0.1 && onWall(w, d.item).u > -0.1 && onWall(w, d.item).u < w.length + 0.1));
    if (has) continue;
    for (const w of [...own].sort((p, q) => q.length - p.length).filter((x) => facesStreet(site, x, under))) {
      const item = slotsNear(w, w.length / 2, Infinity)
        .map((s) => rules.fit(w, s, entranceModel({ entrance: "staircase", door: "" }, s, false)))
        .find((x) => x !== null);
      if (item) {
        rules.placed.push({ item, rule: "staircase", from: building });
        break;
      }
    }
  }
};

/** The map's entrances (`data/osm/points/entrances.json`, `pnpm osm:entrances`) as world points. */
export const loadEntrances = (root = REPO): Entrance[] => {
  const file = join(root, "data/osm/points/entrances.json");
  if (!existsSync(file)) return [];
  const rows = (JSON.parse(readFileSync(file, "utf8")) as { entrances: [number, number, number, string, string, string][] }).entrances;
  return rows.map(([id, lat, lon, entrance, door, level]) => ({ id: String(id), p: geoToWorld(lat, lon), entrance, door, level }));
};

/** The doors of the facades by the three rules, entrances first. */
export const placeDoors = (site: Site, walls: readonly DoorWall[], entrances: readonly Entrance[], ctx: DoorContext = {}): PlacedDoor[] => placeDoorsWithStats(site, walls, entrances, ctx).doors;

/**
 * The doors added to the street furniture per chunk (`generateProps`'s table, whose solids keep their
 * fronts clear), with the count per district and rule and the slots each rule turned down.
 */
export const addDoors = (
  byChunk: ReadonlyMap<string, StreetPropItem[]>,
  site: Site,
  walls: readonly DoorWall[],
  entrances: readonly Entrance[],
  ctx: Omit<DoorContext, "furniture"> = {},
): { per: Record<string, number>; rejected: Record<string, number> } => {
  const { doors, rejected } = placeDoorsWithStats(site, walls, entrances, { ...ctx, furniture: [...byChunk.values()].flat() });
  const per: Record<string, number> = {};
  for (const d of doors) {
    const chunk = site.chunkAt(d.item);
    const list = chunk ? byChunk.get(chunk.id) : undefined;
    if (!chunk || !list) continue;
    list.push(d.item);
    per[`${chunk.district} ${d.rule}`] = (per[`${chunk.district} ${d.rule}`] ?? 0) + 1;
  }
  return { per, rejected };
};

/** As `placeDoors`, with the slots each rule turned down. */
export const placeDoorsWithStats = (site: Site, walls: readonly DoorWall[], entrances: readonly Entrance[], ctx: DoorContext = {}): { doors: PlacedDoor[]; rejected: Record<string, number> } => {
  const rules = new DoorRules(site, ctx);
  entranceDoors(rules, walls, entrances);
  venueDoors(rules, walls);
  staircaseDoors(rules, site, walls, ctx.underground ?? []);
  return { doors: rules.placed, rejected: rules.rejected };
};
