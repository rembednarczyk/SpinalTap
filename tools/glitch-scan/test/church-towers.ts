import { type P2, centroid, pointInRing } from "../../../packages/engine/src/renderer/mapcity/polygon";
import { addTowers } from "../../../packages/engine/src/renderer/mapcity/roof-plan";
import type { FacadeFrame, Palette } from "../../../packages/engine/src/renderer/mapcity/facade-frame";
import { MeshSink } from "../../../packages/engine/src/renderer/mesh-sink";
import { type TowerEntry, towerVertices } from "./landmark-towers";

/**
 * The renderer's bell towers against the churches' real ones (G-215, T-121): which churches have
 * a tower at all, and where and how high it stands in NMPT GUGiK 0.5 m. Both lists are the
 * curator's measurements, kept here apart from the renderer's own table, so the checks hold it to
 * the city rather than to itself.
 */

/**
 * The churches with a real tower (NMPT, OSM): the Brigittines, St Josaphat's, St Nicholas's, the
 * Holy Spirit, the Transfiguration, the Bernardines. Any other church crowned by the renderer's
 * towers has none in Lublin (the Capuchins, St Peter's, St Adalbert's, Niecała 4, T-121).
 */
export const TOWERED_CHURCHES: readonly string[] = ["w66264082", "w69916021", "w66258180", "w66264126", "w66264148", "w66330578"];

/** A real tower in NMPT: its plan (world metres) and the world y of its tip. */
export interface NmptTower {
  readonly id: string;
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
  readonly tip: number;
}

/**
 * Real towers by their churches (T-121, T-120, T-060, T-129): the Holy Spirit's slender one at
 * the south-west corner, the Transfiguration's belfry over the west entrance, the Bernardines' by
 * the south wall (G-214), the Brigittines' and St Josaphat's of the map.
 */
export const NMPT_TOWERS: readonly NmptTower[] = [
  { id: "w66264126", x0: 369, x1: 374.5, z0: -84, z1: -79, tip: 26.5 },
  { id: "w66264148", x0: 979.7, x1: 986.2, z0: 427.7, z1: 434.3, tip: 6.5 },
  { id: "w66330578", x0: 375.35, x1: 380.85, z0: -250.45, z1: -244.95, tip: 39.2 },
  { id: "w66264082", x0: 158.1, x1: 164.1, z0: -232.3, z1: -226.3, tip: 32.4 },
  { id: "w69916021", x0: 266, x1: 274, z0: -13, z1: -6, tip: 9.4 },
];

/** How far a tower's tip may lie outside its NMPT plan, metres, and off its height. */
const PLAN_SLACK = 1;
const TIP_SLACK = 1.5;

/** Each church not on `TOWERED_CHURCHES` (a split piece by its whole's id) without parts that gets the renderer's towers (G-215). */
export const churchFakeTowers = (entries: readonly TowerEntry[]): { readonly at: string; readonly what: string }[] =>
  entries.flatMap((e) => {
    if (e.frame.b.use !== "church" || e.parts || TOWERED_CHURCHES.includes(e.id.split("/")[0]!)) return [];
    const n = towerVertices(e.frame);
    return n > 0 ? [{ at: `${e.x.toFixed(0)},${e.z.toFixed(0)}`, what: `${e.id} ${e.frame.b.name ?? ""}: ${n} vertices of towers it has not`.trim() }] : [];
  });

const GREY: Palette = { wall: [0.5, 0.5, 0.5, 1], trim: [0.5, 0.5, 0.5, 1], plinth: [0.5, 0.5, 0.5, 1], roof: [0.5, 0.5, 0.5, 1] };

/** How near in plan a vertex higher than another makes that one no tip, metres: more than the half diagonal of the widest tower the renderer stood (4.5 m half side). */
const APEX_REACH = 7;

/** The tips of the renderer's far towers on a building with their world y: each spire's apex, no vertex within 7 m in plan higher. */
export const towerApexes = (f: FacadeFrame): (P2 & { readonly y: number })[] => {
  if (!f.style.tower) return [];
  const sink = new MeshSink();
  addTowers(sink, f, GREY, false);
  const pos = sink.positions;
  const tips = new Map<string, P2 & { readonly y: number }>();
  for (let i = 0; i < pos.length; i += 3) {
    let top = true;
    for (let j = 0; j < pos.length && top; j += 3) top = !(pos[j + 1]! > pos[i + 1]! + 1e-6 && Math.hypot(pos[j]! - pos[i]!, pos[j + 2]! - pos[i + 2]!) < APEX_REACH);
    if (top) tips.set(`${pos[i]!.toFixed(2)},${pos[i + 2]!.toFixed(2)}`, { x: pos[i]!, y: pos[i + 1]!, z: pos[i + 2]! });
  }
  return [...tips.values()];
};

/** A building of the data standing as a tower: its outline's middle and the world y of its top. */
export interface DataTop {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly y: number;
}

const inPlan = (t: NmptTower, p: P2): boolean => p.x >= t.x0 - PLAN_SLACK && p.x <= t.x1 + PLAN_SLACK && p.z >= t.z0 - PLAN_SLACK && p.z <= t.z1 + PLAN_SLACK;

/**
 * Each tower of the renderer's on a church of `NMPT_TOWERS` whose tip stands off every real tower
 * of it (outside its plan grown by 1 m, or over 1.5 m off its tip's height), and each real tower
 * with no tip of the renderer's nor top of a building of the data there (G-215).
 */
export const towersOffNmpt = (entries: readonly TowerEntry[], tops: readonly DataTop[], real: readonly NmptTower[] = NMPT_TOWERS): { readonly at: string; readonly what: string }[] => {
  const listed = new Set(real.map((t) => t.id));
  const tips = entries.filter((e) => listed.has(e.id.split("/")[0]!)).flatMap((e) => towerApexes(e.frame).map((a) => ({ id: e.id.split("/")[0]!, ...a })));
  const fits = (t: NmptTower, p: P2 & { readonly y: number }) => inPlan(t, p) && Math.abs(p.y - t.tip) <= TIP_SLACK;
  const off = tips
    .filter((p) => !real.some((t) => t.id === p.id && fits(t, p)))
    .map((p) => ({ at: `${p.x.toFixed(0)},${p.z.toFixed(0)}`, what: `${p.id}: a tower of the renderer's to y ${p.y.toFixed(1)} off the real one` }));
  const missing = real
    .filter((t) => !tips.some((p) => p.id === t.id && fits(t, p)) && !tops.some((b) => fits(t, b)))
    .map((t) => ({ at: `${((t.x0 + t.x1) / 2).toFixed(0)},${((t.z0 + t.z1) / 2).toFixed(0)}`, what: `${t.id}: no tower to y ${t.tip} where NMPT has one` }));
  return [...off, ...missing];
};

/** The tops of the data's buildings and parts (world y of the roof's top) by their outline's middle. */
export const dataTops = (buildings: readonly { readonly id: string; readonly x: number; readonly y: number; readonly z: number; readonly height: number; readonly roof?: number; readonly outline: readonly number[] }[]): DataTop[] =>
  buildings.map((b) => {
    const ring = Array.from({ length: b.outline.length / 2 }, (_, i) => ({ x: b.x + b.outline[i * 2]!, z: b.z + b.outline[i * 2 + 1]! }));
    const c = pointInRing(centroid(ring), ring) ? centroid(ring) : { x: b.x, z: b.z };
    return { id: b.id, x: c.x, z: c.z, y: b.y + b.height + (b.roof ?? 0) };
  });
