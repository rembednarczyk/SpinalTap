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
import { readFileSync } from "node:fs";
import { KRAKOWSKIE_CHUNKS } from "../../../packages/sim/src/content/lublin/krakowskie.generated.ts";
import { NABRZEZE_CHUNKS } from "../../../packages/sim/src/content/lublin/nabrzeze.generated.ts";
import { PODZAMCZE_CHUNKS } from "../../../packages/sim/src/content/lublin/podzamcze.generated.ts";
import { STARE_MIASTO_CHUNKS } from "../../../packages/sim/src/content/lublin/stare-miasto.generated.ts";
import type { StreetPropItem } from "../../../packages/core/src/world/city-geo.ts";
import { REPO } from "./paths.ts";
import { loadFurniture } from "./furniture.ts";
import { withOsmFurniture } from "./props-osm.ts";
import { emitProps } from "./props-emit.ts";
import { type PropsPlan, type PropsStats, generateProps } from "./props-gen.ts";
import { loadBuildingTags, loadNodeTags } from "./props-art.ts";
import type * as DecalWalls from "./decal-walls.ts";
import { type DecalsOut, addDecals } from "./props-decals.ts";
import { Site } from "./props-site.ts";
import type * as GameDoors from "./game-doors.ts";
import { loadCarriageways, loadUndergroundWays } from "./props-roads.ts";
import { addDoors, loadEntrances } from "./props-doors.ts";
import type * as CrowdClear from "./crowd-clear.ts";
import { type FiguresOut, addFigures } from "./props-figures.ts";

const PLAN = join(REPO, "docs/world/lublin-props.todo.json");
/** The table the generator writes, and the simulation imports. */
export const PROPS_OUT = join(REPO, "packages/sim/src/content/lublin/props.generated.ts");

/** A module runner plugin that answers the simulation's import of the table with `source`. */
const tableAs = (source: string): Plugin => ({
  name: "seki-props-table",
  load: (id) => (id.split("?")[0] === PROPS_OUT ? source : null),
});

/** `file` through the module runner, the simulation's table being `table`; `extra` plugins after (tests). */
const runWith = async <T>(file: string, table: ReadonlyMap<string, readonly StreetPropItem[]>, extra: readonly Plugin[]): Promise<T> =>
  (await runnerImport<T>(join(REPO, file), { root: REPO, configFile: false, logLevel: "warn", plugins: [tableAs(emitProps(table)), ...extra] })).module;

export interface BuiltProps {
  /** The text of `props.generated.ts`. */
  readonly text: string;
  readonly byChunk: ReadonlyMap<string, StreetPropItem[]>;
  readonly stats: PropsStats;
  readonly decals: DecalsOut;
  readonly doors: ReturnType<typeof addDoors>;
  readonly figures: FiguresOut;
  readonly entrances: number;
  readonly doorWalls: { readonly walls: number; readonly boards: number };
}

/** The whole table, in one pass: furniture, doors, decals, then the still crowd. */
export const buildProps = async (extra: readonly Plugin[] = []): Promise<BuiltProps> => {
  // The current extract's furniture the plan lacks, after the plan's groups (ADR-0077 point 4, G-099).
  const plan = withOsmFurniture(JSON.parse(readFileSync(PLAN, "utf8")) as PropsPlan, loadFurniture());
  const chunks = [...KRAKOWSKIE_CHUNKS, ...STARE_MIASTO_CHUNKS, ...PODZAMCZE_CHUNKS, ...NABRZEZE_CHUNKS];
  // The venues' boards from the renderer's plan, whose modules Node does not load by itself, with the
  // decals' walls (ADR-0058 stage 6) from the same module runner: the city is framed once for both.
  // Nothing of the furniture is placed yet, so the simulation they read has none.
  const decalWalls = await runWith<typeof DecalWalls>("tools/osm-import/src/decal-walls.ts", new Map(), extra);
  // The game's doors (ADR-0038) the same way: the market's furniture keeps clear of them (ADR-0058 stage 3).
  const doors = await runWith<typeof GameDoors>("tools/osm-import/src/game-doors.ts", new Map(), extra);
  const { byChunk, stats } = generateProps(plan, chunks, loadNodeTags(), decalWalls.lublinVenueBoards(), { roads: loadCarriageways(), doors: doors.gameDoors() });
  const table = byChunk as Map<string, StreetPropItem[]>;
  // The doors on the facades (ADR-0058 stage 9), after the furniture, whose solids keep their fronts clear.
  const doorWalls = decalWalls.lublinDoorWalls();
  const entrances = loadEntrances();
  const doorsOut = addDoors(table, new Site(chunks), doorWalls, entrances, { surfaceY: (p) => decalWalls.surfaceY(p.x, p.z), gameDoors: doors.gameDoors(), underground: loadUndergroundWays() });
  // The decals (ADR-0058 stage 6) after the furniture and the doors: the stickers go on its poles, the
  // grates keep off its manholes, the wall decals off the doors.
  const decals = addDecals(table, new Site(chunks), decalWalls.lublinDecalWalls(), {
    groundY: (p) => decalWalls.groundY(p.x, p.z),
    surfaceY: (p) => decalWalls.surfaceY(p.x, p.z),
    buildingTags: loadBuildingTags(),
    poleLamp: decalWalls.poleLampAt,
    blockOf: decalWalls.furnitureBlock,
  });
  // The still crowd (ADR-0058 stage 8) last: it keeps clear of every piece, and of the simulation's moving
  // crowd, which seats itself on this run's furniture (the crowd does not read the figures).
  const crowd = await runWith<typeof CrowdClear>("tools/osm-import/src/crowd-clear.ts", table, extra);
  const figures = addFigures(table, new Site(chunks), {
    groundY: (p) => decalWalls.groundY(p.x, p.z),
    surfaceY: (p) => decalWalls.surfaceY(p.x, p.z),
    crowd: crowd.crowdClear(),
    gameDoors: doors.gameDoors(),
    blockOf: decalWalls.furnitureBlock,
  });
  return {
    text: emitProps(byChunk),
    byChunk,
    stats,
    decals,
    doors: doorsOut,
    figures,
    entrances: entrances.length,
    doorWalls: { walls: doorWalls.length, boards: doorWalls.reduce((n, w) => n + w.boards.length, 0) },
  };
};
