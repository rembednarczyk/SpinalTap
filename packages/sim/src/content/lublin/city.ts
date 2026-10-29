import type { Doorway, GroundPoint, Vec3, ViewDescriptor } from "@seki/core";
import type { PrismDef } from "../../world/prism";
import type { StaticProp } from "../builders";
import { buildingView, groundView, toPoints } from "./index";
import { type GroundRect } from "./shape";
import { CLEARED, CLEARED_BUILDINGS, ROOM_STOREY, type RoomSite } from "./sites";
import { SHAPED_TERRAIN } from "./terrain";
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

/** The part of a convex polygon on one side of an axis line: `keep` -1 for coordinates below `at`, 1 above. */
const clip = (poly: readonly GroundPoint[], axis: "x" | "z", at: number, keep: 1 | -1): Poly => {
  const out: Poly = [];
  const side = (p: GroundPoint) => (p[axis] - at) * keep;
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

/** A convex part split by a rectangle: the pieces outside it, and the piece inside. */
const splitByRect = (part: readonly GroundPoint[], r: GroundRect): { outside: Poly[]; inside: Poly } => {
  const outside: Poly[] = [];
  let rest: Poly = [...part];
  const cuts: readonly ["x" | "z", number, 1 | -1][] = [
    ["x", r.minX, -1],
    ["x", r.maxX, 1],
    ["z", r.minZ, -1],
    ["z", r.maxZ, 1],
  ];
  for (const [axis, at, side] of cuts) {
    const away = clip(rest, axis, at, side);
    if (away.length >= 3 && area(away) > 0.01) outside.push(away);
    rest = clip(rest, axis, at, side === 1 ? -1 : 1);
    if (rest.length < 3) break;
  }
  return { outside, inside: rest.length >= 3 && area(rest) > 0.01 ? rest : [] };
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
    const { outside, inside } = splitByRect(pts, site.rect);
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

/** The buildings of a chunk that stay, as props (rooms cut into those named by `cuts`). */
export const chunkBuildings = (c: LublinChunkData, cuts: readonly RoomCut[]): StaticProp[] =>
  c.buildings.filter((b) => !clearedBuilding(b)).map((b) => buildingProp(b, cuts.find((r) => r.site.building === b.id)));

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
