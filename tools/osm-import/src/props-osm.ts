/**
 * The furniture of the current OSM extract the plan does not hold (ADR-0077 point 4: OSM first, G-099,
 * T-061): every point of `data/osm/points/furniture.json` (`furniture.ts`) inside the map's districts
 * whose node id no group of `docs/world/lublin-props.todo.json` lists becomes a point of a group of its
 * own, `osm.furniture.<kind>`, after the plan's groups, so the plan's pieces keep their places and win
 * where the two meet. The plan of 29.10 stays the source of its descriptions, its hand-drawn lines and
 * areas; the lamps (the `lit` rule, `props-lit.ts`, G-798) and the hydrants (`osm.hydrants`) are placed by rules of their own.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DISTRICTS } from "./config.ts";
import { type FurniturePoint, loadBollardLines, loadFurniture, planKindOf } from "./furniture.ts";
import { type DriveWay, withBollardLines } from "./props-bollard-lines.ts";
import { type OsmData, type Tags, mergeOsm, parseExtract } from "./osm.ts";
import { REPO } from "./paths.ts";
import type { Pt } from "./geometry.ts";
import { COVER } from "../../orto/src/classify.ts";
import { coverAt, readCover } from "../../orto/src/cover.ts";
import { ROW_DISTRICTS } from "./props-kerb-lines.ts";
import type { KerbRuleContext } from "./props-kerb-bollards.ts";
import type { PlanItem, PropsPlan } from "./props-gen.ts";
import { type LitWay, isLitWay, lampLineOf, markCourts, withLitRule } from "./props-lit.ts";
import { SidewalkIndex, kerbsOf } from "./props-lit-sides.ts";
import { WallIndex, isCourtyard, isPedestrianSquare } from "./courtyards.ts";
import { geoToWorld } from "./project.ts";
import { type Structure, structuresOf } from "./structures.ts";
import { withBuiltSites } from "./built-sites.ts";
import { loadMapLod1 } from "./load.ts";

/** The id of the group of an OSM kind. */
export const OSM_GROUP = "osm.furniture";

const inMap = (p: { readonly x: number; readonly z: number }): boolean => DISTRICTS.some(({ rect: r }) => p.x >= r.minX && p.x <= r.maxX && p.z >= r.minZ && p.z <= r.maxZ);

/** Every node id a group of the plan lists (`n123`). */
export const planNodeIds = (plan: PropsPlan): Set<string> => new Set(plan.items.flatMap((i) => (i.osm === undefined ? [] : typeof i.osm === "string" ? [i.osm] : i.osm)));

/** The groups of the extract's points the plan lacks, one a kind, in the order of the file (by node id). */
export const osmFurnitureItems = (plan: PropsPlan, points: readonly FurniturePoint[]): PlanItem[] => {
  const held = planNodeIds(plan);
  const groups = new Map<string, { points: [number, number][]; osm: string[] }>();
  for (const f of points) {
    const kind = planKindOf(f);
    if (kind === null || held.has(f.id) || !inMap(f.p)) continue;
    const g = groups.get(kind) ?? { points: [], osm: [] };
    g.points.push([Math.round(f.p.x * 10) / 10, Math.round(f.p.z * 10) / 10]);
    g.osm.push(f.id);
    groups.set(kind, g);
  }
  return [...groups].sort(([a], [b]) => (a < b ? -1 : 1)).map(([kind, g]) => ({ id: `${OSM_GROUP}.${kind}`, kind, inOsm: true, points: g.points, osm: g.osm, count: g.points.length, note: "From data/osm/points/furniture.json (pnpm osm:fetch): nodes the plan lacks." }));
};

/** The plan with the extract's groups after its own. */
export const withOsmFurniture = (plan: PropsPlan, points: readonly FurniturePoint[]): PropsPlan => ({ ...plan, items: [...plan.items, ...osmFurnitureItems(plan, points)] });

/** The ways of an extract whose tags `keep` takes (the lit ones by default), by id, with their points in the world (`props-lit.ts`). */
export const litWaysOf = (osm: OsmData, keep: (tags: Tags | undefined) => boolean = isLitWay): LitWay[] =>
  [...osm.ways.values()]
    .filter((w) => keep(w.tags))
    .sort((a, b) => a.id - b.id)
    .flatMap((w) => {
      const pts = w.nodes.map((id) => osm.nodes.get(id));
      return pts.every((n) => n !== undefined) ? [{ id: w.id, tags: w.tags!, pts: pts.map((n) => geoToWorld(n!.lat, n!.lon)) }] : [];
    });

const loadDistricts = (root: string): OsmData => mergeOsm(DISTRICTS.map((d) => parseExtract(readFileSync(join(root, "data/osm", `${d.slug}.json`), "utf8"))));

/** The structures of the districts' extracts no tree of the crowns stands in (`structures.ts`, G-815), the finished sites' land none (G-872). */
export const loadStructures = (root = REPO): Structure[] => structuresOf(withBuiltSites(loadDistricts(root), loadMapLod1(root)));

/** The closed ways whose tags `keep` takes, as rings in the world. */
const ringsOf = (osm: OsmData, keep: (tags: Tags | undefined) => boolean): LitWay[] => litWaysOf(osm, (tags) => keep(tags)).filter((w) => w.pts.length >= 4 && w.pts[0]!.x === w.pts[w.pts.length - 1]!.x && w.pts[0]!.z === w.pts[w.pts.length - 1]!.z);

/** The courtyards of an extract (`courtyards.ts`): its pedestrian squares whose outline runs along its buildings. */
export const courtsOf = (osm: OsmData): { id: number; ring: readonly LitWay["pts"][number][] }[] => {
  const walls = new WallIndex(ringsOf(osm, (tags) => tags?.building !== undefined).map((w) => w.pts.slice(0, -1)));
  return ringsOf(osm, isPedestrianSquare)
    .map((w) => ({ id: w.id, ring: w.pts.slice(0, -1) }))
    .filter((c) => isCourtyard(c.ring, walls));
};

/** The ways a sidewalk may be mapped as: Lublin's are footways, a few tagged `footway=sidewalk`. */
const WALKS: ReadonlySet<string> = new Set(["footway", "path", "cycleway"]);
const isWalk = (tags: Tags | undefined): boolean => tags !== undefined && WALKS.has(tags.highway ?? "") && tags.footway !== "crossing" && tags.cycleway !== "crossing" && tags.area !== "yes";

/** The lit ways with their car streets' separately mapped sidewalks measured (`LitWay.kerbs`, G-804). */
export const withKerbs = (osm: OsmData, ways: readonly LitWay[]): LitWay[] => {
  const sidewalks = new SidewalkIndex(litWaysOf(osm, isWalk).map((w) => w.pts));
  return ways.map((w) => (lampLineOf(w.tags)?.kind === "lamp-road" ? { ...w, kerbs: kerbsOf(w.pts, sidewalks) } : w));
};

/** The lit ways of the districts' extracts in `data/osm`, their courtyards marked (`markCourts`) and their sidewalks measured (`withKerbs`). */
export const loadLitWays = (root = REPO): LitWay[] => {
  const osm = loadDistricts(root);
  return withKerbs(osm, markCourts(litWaysOf(osm), courtsOf(osm)));
};

/** Every street and path of the districts' extracts, for the lamps' looks along them (`styleClashes`). */
export const loadStreetWays = (root = REPO): LitWay[] => litWaysOf(loadDistricts(root), (tags) => tags?.highway !== undefined);

/** The ways cars take, with their width (m): the tag, else a lane each way, a drive's one (G-818: the lines of bollards break across them). */
const CAR_WAYS: ReadonlySet<string> = new Set(["primary", "secondary", "tertiary", "unclassified", "residential", "living_street", "service", "primary_link", "secondary_link", "tertiary_link"]);
export const driveWaysOf = (ways: readonly LitWay[]): DriveWay[] =>
  ways.filter((w) => CAR_WAYS.has(w.tags.highway ?? "")).map((w) => ({ pts: w.pts, width: Number.parseFloat(w.tags.width ?? "") || (w.tags.highway === "service" ? 3.5 : 6) }));

/** The taxi ranks of the districts' extracts (`amenity=taxi` areas) as rings: the kerb rows break by them (G-820). */
export const loadTaxiRanks = (root = REPO): Pt[][] => ringsOf(loadDistricts(root), (tags) => tags?.amenity === "taxi").map((w) => w.pts.slice(0, -1));

/**
 * The orthophoto's cover of the kerb rule's districts (`data/orto/<slug>.cover.png`, ADR-0077) as
 * asphalt or not at a point, null off it: the bays of cars across the pavement the map lacks (G-820 P2).
 */
export const loadOrtoAsphalt = (dir?: string): ((p: Pt) => boolean | null) => {
  const covers = ROW_DISTRICTS.flatMap((slug) => readCover(slug, dir) ?? []);
  return (p) => {
    for (const c of covers) {
      const k = coverAt(c, p.x, p.z);
      if (k !== COVER.none) return k === COVER.asphalt;
    }
    return null;
  };
};

/** The plan as its file has it, before the extract's groups and the `lit` rule. */
export const loadPlanFile = (root = REPO): PropsPlan => JSON.parse(readFileSync(join(root, "docs/world/lublin-props.todo.json"), "utf8")) as PropsPlan;

/**
 * The plan `pnpm osm:props` places: `docs/world/lublin-props.todo.json` with the extract's groups
 * after its own, its lines of bollards laid out as posts (`props-bollard-lines.ts`, G-818), then
 * the street lamps of the `lit` rule's first pass (`props-lit.ts`, G-798).
 */
export const loadPropsPlan = (root = REPO): PropsPlan => {
  const furniture = loadFurniture(root);
  const plan = withBollardLines(withOsmFurniture(loadPlanFile(root), furniture), loadBollardLines(root), driveWaysOf(loadStreetWays(root)), inMap);
  return withLitRule(plan, loadLitWays(root), furniture).plan;
};

/** What the kerb rows' rule (G-820) reads beyond the chunks: OSM's taxi ranks and the orthophoto's asphalt. */
export const loadKerbRule = (root = REPO): KerbRuleContext => ({ taxis: loadTaxiRanks(root), asphalt: loadOrtoAsphalt() });
