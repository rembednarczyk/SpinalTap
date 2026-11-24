/**
 * The street furniture of Lublin 2077 (ADR-0047) from `docs/world/lublin-props.todo.json`, the OSM
 * furniture it lacks (`data/osm/points/furniture.json`, `props-osm.ts`) and the generated chunks, as `pnpm osm:props` (`props.ts`) writes it to `props.generated.ts`.
 *
 * The rules read the simulation's and the renderer's modules through Vite's module runner, and the
 * simulation imports the table this builds. The runner never gets the committed table (G-745): the
 * modules read before the furniture see none, the crowd the furniture of this run, so the output
 * depends on the inputs alone, not on the file it overwrites.
 */
import { join } from "node:path";
import { type Plugin, runnerImport } from "vite";
import { KRAKOWSKIE_CHUNKS } from "../../../packages/sim/src/content/lublin/krakowskie.generated.ts";
import { NABRZEZE_CHUNKS } from "../../../packages/sim/src/content/lublin/nabrzeze.generated.ts";
import { PODZAMCZE_CHUNKS } from "../../../packages/sim/src/content/lublin/podzamcze.generated.ts";
import { STARE_MIASTO_CHUNKS } from "../../../packages/sim/src/content/lublin/stare-miasto.generated.ts";
import type { StreetPropItem } from "../../../packages/core/src/world/city-geo.ts";
import { REPO } from "./paths.ts";
import { loadLitWays, loadPropsPlan, loadKerbRule, loadStreetWays } from "./props-osm.ts";
import { type CrownStats } from "./crown-trees.ts";
import { loadCrownData, placeWithCrowns } from "./props-crowns.ts";
import { emitProps } from "./props-emit.ts";
import { type PropsStats, placeProps } from "./props-gen.ts";
import { loadBuildingTags, loadNodeTags } from "./props-art.ts";
import type * as DecalWalls from "./decal-walls.ts";
import type * as VenueBoards from "./venue-boards.ts";
import { type DecalsOut, addDecals } from "./props-decals.ts";
import { Site } from "./props-site.ts";
import { SITES_OUT, emitSites, loadSiteOutlines, planSites } from "./construction-table.ts";
import type { SitePlan } from "./construction-site.ts";
import type * as GameDoors from "./game-doors.ts";
import { loadCarriageways, loadUndergroundWays } from "./props-roads.ts";
import { addDoors, loadEntrances } from "./props-doors.ts";
import { buildingAddresses } from "./props-addresses.ts";
import type * as CrowdClear from "./crowd-clear.ts";
import { type FiguresOut, addFigures } from "./props-figures.ts";

/** The table the generator writes, and the simulation imports. */
export const PROPS_OUT = join(REPO, "packages/sim/src/content/lublin/props.generated.ts");

/** A module runner plugin that answers the simulation's import of the furniture's table with `source`, and of the building sites' with `sites`. */
const tableAs = (source: string, sites: string): Plugin => ({
  name: "seki-props-table",
  load: (id) => (id.split("?")[0] === PROPS_OUT ? source : id.split("?")[0] === SITES_OUT ? sites : null),
});

/**
 * `file` through the module runner, the simulation's table being `table` and the building sites'
 * `sites` (ADR-0087: this run's, not the committed one); `extra` plugins after (tests).
 */
const runWith = async <T>(file: string, table: ReadonlyMap<string, readonly StreetPropItem[]>, sites: string, extra: readonly Plugin[]): Promise<T> =>
  (await runnerImport<T>(join(REPO, file), { root: REPO, configFile: false, logLevel: "warn", plugins: [tableAs(emitProps(table), sites), ...extra] })).module;

export interface BuiltProps {
  /** The text of `props.generated.ts`. */
  readonly text: string;
  /** The text of `construction.generated.ts` (ADR-0087), and its sites. */
  readonly sitesText: string;
  readonly sites: readonly SitePlan[];
  readonly byChunk: ReadonlyMap<string, StreetPropItem[]>;
  readonly stats: PropsStats;
  readonly decals: DecalsOut;
  readonly doors: ReturnType<typeof addDoors>;
  readonly figures: FiguresOut;
  readonly entrances: number;
  readonly doorWalls: { readonly walls: number; readonly boards: number };
  /** The control numbers of the crowns' trees (`crown-trees.ts`). */
  readonly crowns: CrownStats & { readonly placed: number };
}

/** The whole table, in one pass: furniture, doors, decals, then the still crowd. */
export const buildProps = async (extra: readonly Plugin[] = []): Promise<BuiltProps> => {
  // The current extract's furniture the plan lacks, after the plan's groups (ADR-0077 point 4, G-099).
  const plan = loadPropsPlan();
  const chunks = [...KRAKOWSKIE_CHUNKS, ...STARE_MIASTO_CHUNKS, ...PODZAMCZE_CHUNKS, ...NABRZEZE_CHUNKS];
  // The building sites first (ADR-0087): the simulation every pass reads has their fences and digs.
  // They read the buildings' tags (G-894: a listed building's front) and the venues' boards (G-893:
  // no scaffold over one), which the renderer hangs by the buildings alone: framed here with no site.
  const buildingTags = loadBuildingTags();
  const siteBoards = (await runWith<typeof VenueBoards>("tools/osm-import/src/venue-boards.ts", new Map(), emitSites([]), extra)).lublinVenueBoards();
  // The plan's furniture at its points: the building sites' pieces keep off the map's lamps and benches (24.11).
  const furniture = plan.items.flatMap((i) => [...(i.position ? [i.position] : []), ...(i.points ?? []).map(([x, z]) => ({ x, z }))]);
  const ways = loadStreetWays().filter((w) => w.tags.area !== "yes").map((w) => w.pts);
  const sites = planSites(loadSiteOutlines(), chunks, { tags: buildingTags, boards: siteBoards, furniture, ways });
  const sitesText = emitSites(sites);
  // The venues' boards from the renderer's plan, whose modules Node does not load by itself, with the
  // decals' walls (ADR-0058 stage 6) from the same module runner: the city is framed once for both.
  // Nothing of the furniture is placed yet, so the simulation they read has none.
  const decalWalls = await runWith<typeof DecalWalls>("tools/osm-import/src/decal-walls.ts", new Map(), sitesText, extra);
  // The game's doors (ADR-0038) the same way: the market's furniture keeps clear of them (ADR-0058 stage 3).
  const doors = await runWith<typeof GameDoors>("tools/osm-import/src/game-doors.ts", new Map(), sitesText, extra);
  // The rows of bollards along the kerbs of the centre (G-820) once the plan stands, broken by the taxi ranks and the bays the orthophoto shows.
  const kerbRule = loadKerbRule();
  // Read once for every pass of the plan.
  // The map's entrances: the doors (below) take them, and the furniture keeps their fronts clear (ADR-0094 stage 1).
  const entrances = loadEntrances();
  const [tags, boards, market] = [loadNodeTags(), decalWalls.lublinVenueBoards(), { roads: loadCarriageways(), doors: doors.gameDoors(), entrances: [...entrances.map((e) => e.p), ...doors.passageMouths()], addresses: buildingAddresses(chunks, buildingTags) }];
  // The sites' pieces stand first: the furniture steps aside from their fences and cabins (24.11).
  const sitePieces = sites.flatMap((s) => s.pieces);
  const place = (p: typeof plan) => placeProps(p, chunks, tags, boards, market, kerbRule, sitePieces);
  // The `lit` rule's second pass (G-798): once the lamps stand, its plain lamps on a way with styled ones take their look, and
  // the lit ways still dark get lamps of their own; the furniture is placed again. Then the trees of the crowns no tree
  // stands under (G-797), after every other piece, and the furniture once more.
  const { byChunk, stats, crowns } = placeWithCrowns(plan, place, loadLitWays(), loadStreetWays(), new Site(chunks), loadCrownData());
  const table = byChunk as Map<string, StreetPropItem[]>;
  // The doors on the facades (ADR-0058 stage 9), after the furniture, whose solids keep their fronts clear.
  const doorWalls = decalWalls.lublinDoorWalls();
  const doorsOut = addDoors(table, new Site(chunks), doorWalls, entrances, { surfaceY: (p) => decalWalls.surfaceY(p.x, p.z), gameDoors: doors.gameDoors(), underground: loadUndergroundWays() });
  // The decals (ADR-0058 stage 6) after the furniture and the doors: the stickers go on its poles, the
  // grates keep off its manholes, the wall decals off the doors.
  const decals = addDecals(table, new Site(chunks), decalWalls.lublinDecalWalls(), {
    groundY: (p) => decalWalls.groundY(p.x, p.z),
    surfaceY: (p) => decalWalls.surfaceY(p.x, p.z),
    buildingTags,
    poleLamp: decalWalls.poleLampAt,
    blockOf: decalWalls.furnitureBlock,
  });
  // The still crowd (ADR-0058 stage 8) last: it keeps clear of every piece, and of the simulation's moving
  // crowd, which seats itself on this run's furniture (the crowd does not read the figures).
  const crowd = await runWith<typeof CrowdClear>("tools/osm-import/src/crowd-clear.ts", table, sitesText, extra);
  const figures = addFigures(table, new Site(chunks), {
    groundY: (p) => decalWalls.groundY(p.x, p.z),
    surfaceY: (p) => decalWalls.surfaceY(p.x, p.z),
    crowd: crowd.crowdClear(),
    gameDoors: doors.gameDoors(),
    blockOf: decalWalls.furnitureBlock,
  });
  return {
    text: emitProps(byChunk),
    sitesText,
    sites,
    byChunk,
    stats,
    crowns,
    decals,
    doors: doorsOut,
    figures,
    entrances: entrances.length,
    doorWalls: { walls: doorWalls.length, boards: doorWalls.reduce((n, w) => n + w.boards.length, 0) },
  };
};
