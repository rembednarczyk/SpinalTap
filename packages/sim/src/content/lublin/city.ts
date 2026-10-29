import type { BuildingPassage, Doorway, GroundPoint, Vec3, ViewDescriptor } from "@seki/core";
import type { PrismDef } from "../../world/prism";
import type { StaticProp } from "../builders";
import { buildingView, groundView, toPoints } from "./index";
import { type GroundRect } from "./shape";
import { type BuildingCut, CLEARED, CLEARED_BUILDINGS, type PassageSite, ROOM_STOREY, type RoomSite } from "./sites";
import { SHAPED_TERRAIN, groundY } from "./terrain";
import type { LublinBuildingData, LublinChunkData } from "./types";

/**
 * The map's city as the game's content (ADR-0045): every building of a chunk is a solid prop
 * (convex prisms from its parts, ADR-0043) whose view the renderer gets once, as scenery; the
 * terrain and the surfaces are scenery only. Set pieces clear the buildings (and, at the docks,
 * the surfaces) under them; a room cut into a tenement takes its ground floor out of the solid
 * and a doorway out of its facade.
 */

/** A room cut into a map building, with the doors through its facade. */
export interface RoomCut {
  readonly site: RoomSite;
  readonly doors: readonly { readonly x: number; readonly width: number; readonly height: number }[];
}

/** One view the renderer draws for good, outside the simulation's entities. */
export interface SceneryItem {
  readonly chunk: string;
  readonly view: ViewDescriptor;
  readonly at: Vec3;
}

const insideRect = (r: GroundRect, x: number, z: number): boolean => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;

/** Is a building of the map taken away for a set piece? */
export const clearedBuilding = (b: LublinBuildingData): boolean => CLEARED_BUILDINGS.some((r) => insideRect(r, b.x, b.z));

/** Is a surface of the map taken away for a set piece (its centre under one)? */
const clearedSurface = (pts: readonly GroundPoint[]): boolean => {
  const cx = pts.reduce((s, p) => s + p.x, 0) / Math.max(1, pts.length);
  const cz = pts.reduce((s, p) => s + p.z, 0) / Math.max(1, pts.length);
  return CLEARED.some((r) => insideRect(r, cx, cz));
};

type Poly = GroundPoint[];

/** A half-plane of the map: the points with n·p >= c. */
type HalfPlane = readonly [n: GroundPoint, c: number];

const dot = (a: GroundPoint, b: GroundPoint): number => a.x * b.x + a.z * b.z;

/** The part of a convex polygon inside a half-plane. */
const clip = (poly: readonly GroundPoint[], [n, c]: HalfPlane): Poly => {
  const out: Poly = [];
  const side = (p: GroundPoint) => dot(n, p) - c;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i] as GroundPoint;
    const b = poly[(i + 1) % poly.length] as GroundPoint;
    const sa = side(a);
    const sb = side(b);
    if (sa >= 0) out.push(a);
    if ((sa > 0 && sb < 0) || (sa < 0 && sb > 0)) {
      const t = sa / (sa - sb);
      out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
    }
  }
  return out;
};

const area = (p: readonly GroundPoint[]): number => {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i] as GroundPoint;
    const b = p[(i + 1) % p.length] as GroundPoint;
    s += a.x * b.z - b.x * a.z;
  }
  return Math.abs(s) / 2;
};

/** A convex part split by a convex region (its half-planes): the pieces outside it, and the piece inside. */
const splitBy = (part: readonly GroundPoint[], region: readonly HalfPlane[]): { outside: Poly[]; inside: Poly } => {
  const outside: Poly[] = [];
  let rest: Poly = [...part];
  for (const [n, c] of region) {
    const away = clip(rest, [{ x: -n.x, z: -n.z }, -c]);
    if (away.length >= 3 && area(away) > 0.01) outside.push(away);
    rest = clip(rest, [n, c]);
    if (rest.length < 3) break;
  }
  return { outside, inside: rest.length >= 3 && area(rest) > 0.01 ? rest : [] };
};

const rectRegion = (r: GroundRect): HalfPlane[] => [
  [{ x: 1, z: 0 }, r.minX],
  [{ x: -1, z: 0 }, -r.maxX],
  [{ x: 0, z: 1 }, r.minZ],
  [{ x: 0, z: -1 }, -r.maxZ],
];

/** The corridor of a passage: between its ends, half its width either side of the line. */
const corridor = (p: PassageSite): HalfPlane[] => {
  const len = Math.hypot(p.to.x - p.from.x, p.to.z - p.from.z);
  const u = { x: (p.to.x - p.from.x) / len, z: (p.to.z - p.from.z) / len };
  const n = { x: -u.z, z: u.x };
  const h = p.width / 2;
  return [
    [u, dot(u, p.from)],
    [{ x: -u.x, z: -u.z }, -dot(u, p.to)],
    [n, dot(n, p.from) - h],
    [{ x: -n.x, z: -n.z }, -(dot(n, p.from) + h)],
  ];
};

/**
 * Where the line of a passage crosses the outline of its building (the gate's mouths), with the
 * width of the opening along that wall: wider than the passage where it meets the wall slantwise.
 */
const mouths = (outline: readonly GroundPoint[], p: PassageSite): { at: GroundPoint; width: number }[] => {
  const out: { at: GroundPoint; width: number }[] = [];
  const dx = p.to.x - p.from.x;
  const dz = p.to.z - p.from.z;
  const len = Math.hypot(dx, dz) || 1;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i] as GroundPoint;
    const b = outline[(i + 1) % outline.length] as GroundPoint;
    const ex = b.x - a.x;
    const ez = b.z - a.z;
    const den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((a.x - p.from.x) * ez - (a.z - p.from.z) * ex) / den;
    const s = ((a.x - p.from.x) * dz - (a.z - p.from.z) * dx) / den;
    if (t < 0 || t > 1 || s < 0 || s > 1) continue;
    const cos = Math.abs(den) / (len * (Math.hypot(ex, ez) || 1));
    out.push({ at: { x: p.from.x + dx * t, z: p.from.z + dz * t }, width: p.width / Math.max(cos, 0.5) });
  }
  return out;
};

/** Moves the corners lying on the front line of a room (within 0.6 m) onto it. */
const straighten = (pts: readonly GroundPoint[], front: number, r: GroundRect): GroundPoint[] =>
  pts.map((p) => (Math.abs(p.z - front) < 0.6 && p.x > r.minX - 3 && p.x < r.maxX + 3 ? { x: p.x, z: front } : p));

const relative = (pts: readonly GroundPoint[], b: LublinBuildingData): GroundPoint[] => pts.map((p) => ({ x: p.x - b.x, z: p.z - b.z }));
const absolute = (flat: readonly number[], b: LublinBuildingData): GroundPoint[] => toPoints(flat).map((p) => ({ x: p.x + b.x, z: p.z + b.z }));

/** A building of the map as a solid prop of the game, drawn as scenery. */
export const buildingProp = (b: LublinBuildingData, cut?: RoomCut): StaticProp => {
  const view = buildingView(b);
  if (!cut) {
    const prisms: PrismDef[] = b.parts.map((p) => ({ points: toPoints(p), bottom: 0, top: b.height }));
    return { center: { x: b.x, y: b.y, z: b.z }, view, solid: true, prisms, scenery: true };
  }
  const { site } = cut;
  const roomBottom = site.floor + ROOM_STOREY - b.y;
  const prisms: PrismDef[] = [];
  for (const part of b.parts) {
    const pts = straighten(absolute(part, b), site.front, site.rect);
    const { outside, inside } = splitBy(pts, rectRegion(site.rect));
    for (const o of outside) prisms.push({ points: relative(o, b), bottom: 0, top: b.height });
    if (inside.length > 0) prisms.push({ points: relative(inside, b), bottom: roomBottom, top: b.height });
  }
  const doorways: Doorway[] = cut.doors.map((d) => ({
    at: { x: d.x - b.x, z: site.front - b.z },
    width: d.width,
    bottom: site.floor - b.y,
    top: site.floor + d.height - b.y,
  }));
  const outline = relative(straighten(absolute(b.outline, b), site.front, site.rect), b);
  return {
    center: { x: b.x, y: b.y, z: b.z },
    view: view.kind === "building" ? { ...view, outline, doorways } : view,
    solid: true,
    prisms,
    scenery: true,
  };
};

/** The floor of a passage at its two ends. */
const passageFloor = (p: PassageSite): readonly [number, number] => (p.floor !== undefined ? [p.floor, p.floor] : [groundY(p.from.x, p.from.z), groundY(p.to.x, p.to.z)]);

/** A region of a building's solid cut away below `bottom` (world y). */
interface Carve {
  readonly region: readonly HalfPlane[];
  readonly bottom: number;
}

/**
 * A building of the map with passages through its ground floor (open at their mouths, lined by
 * the renderer, ADR-0048) and boxes cut out of its solid. Each part of the solid is split by the
 * carved regions in turn: the pieces outside stay whole, the piece inside starts at the region's
 * bottom.
 */
export const carvedProp = (b: LublinBuildingData, passages: readonly PassageSite[], cuts: readonly BuildingCut[] = []): StaticProp => {
  const prop = buildingProp(b);
  const carves: Carve[] = [
    ...passages.map((p) => ({ region: corridor(p), bottom: Math.max(...passageFloor(p)) + p.height })),
    ...cuts.map((c) => ({ region: rectRegion(c.rect), bottom: c.bottom })),
  ];
  const prisms: PrismDef[] = [];
  for (const part of b.parts) {
    let rest: Poly[] = [absolute(part, b)];
    for (const c of carves) {
      const next: Poly[] = [];
      for (const piece of rest) {
        const { outside, inside } = splitBy(piece, c.region);
        next.push(...outside);
        if (inside.length > 0) prisms.push({ points: relative(inside, b), bottom: c.bottom - b.y, top: b.height });
      }
      rest = next;
    }
    for (const o of rest) prisms.push({ points: relative(o, b), bottom: 0, top: b.height });
  }
  const outline = absolute(b.outline, b);
  const doorways: Doorway[] = passages.flatMap((p) => {
    const crown = Math.max(...passageFloor(p)) + p.height;
    return mouths(outline, p).map((m) => ({
      at: { x: m.at.x - b.x, z: m.at.z - b.z },
      width: m.width,
      bottom: Math.min(...passageFloor(p)) - 0.3 - b.y,
      top: crown - b.y,
    }));
  });
  const views: BuildingPassage[] = passages.map((p) => {
    const floor = passageFloor(p);
    const crown = Math.max(...floor) + p.height;
    return {
      from: { x: p.from.x - b.x, z: p.from.z - b.z },
      to: { x: p.to.x - b.x, z: p.to.z - b.z },
      width: p.width,
      floor: [floor[0] - b.y, floor[1] - b.y],
      spring: crown - p.rise - b.y,
      crown: crown - b.y,
    };
  });
  return { ...prop, view: prop.view.kind === "building" ? { ...prop.view, doorways, passages: views } : prop.view, prisms };
};

/** Old Town buildings sign their shops on wrought-iron brackets (ADR-0048). */
const oldTownSigns = (prop: StaticProp): StaticProp => (prop.view.kind === "building" ? { ...prop, view: { ...prop.view, signs: "bracket" } } : prop);

/** The buildings of a chunk that stay, as props (rooms cut into those named by `rooms`, passages and cuts through others). */
export const chunkBuildings = (c: LublinChunkData, rooms: readonly RoomCut[], passages: readonly PassageSite[] = [], cuts: readonly BuildingCut[] = []): StaticProp[] =>
  c.buildings
    .filter((b) => !clearedBuilding(b))
    .map((b) => {
      const through = passages.filter((p) => p.building === b.id);
      const boxes = cuts.filter((k) => k.building === b.id);
      const prop = through.length > 0 || boxes.length > 0 ? carvedProp(b, through, boxes) : buildingProp(b, rooms.find((r) => r.site.building === b.id));
      return c.district === "kanal" ? oldTownSigns(prop) : prop;
    });

const ORIGIN: Vec3 = { x: 0, y: 0, z: 0 };

/** What the renderer draws of a chunk for good: its shaped terrain, its surfaces and its buildings. */
export const chunkScenery = (c: LublinChunkData, buildings: readonly StaticProp[]): SceneryItem[] => {
  const terrain = SHAPED_TERRAIN.get(c.id) ?? c.terrain;
  return [
    { chunk: c.id, view: { kind: "terrain", grid: terrain }, at: ORIGIN },
    ...c.ground.filter((g) => !clearedSurface(toPoints(g.outline))).map((g): SceneryItem => ({ chunk: c.id, view: groundView(g), at: ORIGIN })),
    ...buildings.map((p): SceneryItem => ({ chunk: c.id, view: p.view, at: p.center })),
  ];
};
