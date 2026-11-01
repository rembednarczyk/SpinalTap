/**
 * `pnpm osm:props`: street furniture of Lublin 2077 (ADR-0047) from
 * `docs/world/lublin-props.todo.json` and the generated chunks into
 * `packages/sim/src/content/lublin/props.generated.ts`, then the control numbers.
 */
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runnerImport } from "vite";
import { KRAKOWSKIE_CHUNKS } from "../../../packages/sim/src/content/lublin/krakowskie.generated.ts";
import { NABRZEZE_CHUNKS } from "../../../packages/sim/src/content/lublin/nabrzeze.generated.ts";
import { PODZAMCZE_CHUNKS } from "../../../packages/sim/src/content/lublin/podzamcze.generated.ts";
import { STARE_MIASTO_CHUNKS } from "../../../packages/sim/src/content/lublin/stare-miasto.generated.ts";
import { REPO } from "./paths.ts";
import { emitProps } from "./props-emit.ts";
import { type PropsPlan, generateProps } from "./props-gen.ts";
import { loadBuildingTags, loadNodeTags } from "./props-art.ts";
import type * as DecalWalls from "./decal-walls.ts";
import { addDecals } from "./props-decals.ts";
import { Site } from "./props-site.ts";
import type { StreetPropItem } from "../../../packages/core/src/world/city-geo.ts";
import { MAPPED, SKIPPED, SKIPPED_ART } from "./props-kinds.ts";
import type * as GameDoors from "./game-doors.ts";
import { loadCarriageways } from "./props-roads.ts";
import { addDoors, loadEntrances } from "./props-doors.ts";

const PLAN = join(REPO, "docs/world/lublin-props.todo.json");
const OUT = join(REPO, "packages/sim/src/content/lublin/props.generated.ts");

const plan = JSON.parse(readFileSync(PLAN, "utf8")) as PropsPlan;
const chunks = [...KRAKOWSKIE_CHUNKS, ...STARE_MIASTO_CHUNKS, ...PODZAMCZE_CHUNKS, ...NABRZEZE_CHUNKS];
// The venues' boards from the renderer's plan, whose modules Node does not load by itself, with the
// decals' walls (ADR-0058 stage 6) from the same module runner: the city is framed once for both.
const { module: decalWalls } = await runnerImport<typeof DecalWalls>(join(REPO, "tools/osm-import/src/decal-walls.ts"), { root: REPO, configFile: false, logLevel: "warn" });
// The game's doors (ADR-0038) the same way: the market's furniture keeps clear of them (ADR-0058 stage 3).
const { module: doors } = await runnerImport<typeof GameDoors>(join(REPO, "tools/osm-import/src/game-doors.ts"), { root: REPO, configFile: false, logLevel: "warn" });
const { byChunk, stats } = generateProps(plan, chunks, loadNodeTags(), decalWalls.lublinVenueBoards(), { roads: loadCarriageways(), doors: doors.gameDoors() });
// The doors on the facades (ADR-0058 stage 9), after the furniture, whose solids keep their fronts clear.
const doorWalls = decalWalls.lublinDoorWalls();
const entrances = loadEntrances();
const { per: doorsPer, rejected } = addDoors(byChunk as Map<string, StreetPropItem[]>, new Site(chunks), doorWalls, entrances, { surfaceY: (p) => decalWalls.surfaceY(p.x, p.z), gameDoors: doors.gameDoors() });
// The decals (ADR-0058 stage 6) after the furniture and the doors: the stickers go on its poles, the
// grates keep off its manholes, the wall decals off the doors.
const decals = addDecals(byChunk as Map<string, StreetPropItem[]>, new Site(chunks), decalWalls.lublinDecalWalls(), {
  groundY: (p) => decalWalls.groundY(p.x, p.z),
  surfaceY: (p) => decalWalls.surfaceY(p.x, p.z),
  buildingTags: loadBuildingTags(),
  poleLamp: decalWalls.poleLampAt,
  blockOf: decalWalls.furnitureBlock,
});
writeFileSync(OUT, emitProps(byChunk));
const total = Object.values(stats.perKind).reduce((a, b) => a + b, 0);
console.log(`props.generated.ts: ${(statSync(OUT).size / 1024).toFixed(0)} KiB, ${total} pieces in ${byChunk.size} chunks`);
console.log("per kind:", Object.entries(stats.perKind).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", "));
console.log("per district:", Object.entries(stats.perDistrict).map(([k, n]) => `${k} ${n}`).join(", "));
console.log(`dropped: ${stats.outside} outside the chunks, ${stats.inBuilding} inside building outlines, ${stats.onRoad} on a road with no pavement near, ${stats.merged} too close to the same kind, ${stats.crowded} with no room beside a solid placed before`);
console.log(`moved off the road onto the pavement or away from a wall: ${stats.offRoad}`);
console.log("decals (ADR-0058 stage 6):", Object.entries(decals.per).map(([k, by]) => `${k} ${Object.entries(by).map(([d, n]) => `${d} ${n}`).join(" ")}`).join("; "));
console.log("  spots turned down:", Object.entries(decals.rejected).sort().map(([k, n]) => `${k} ${n}`).join(", "));
console.log("doors (ADR-0058 stage 9):", Object.entries(doorsPer).sort().map(([k, n]) => `${k} ${n}`).join(", "));
console.log(`  from ${entrances.length} entrances and ${doorWalls.reduce((n, w) => n + w.boards.length, 0)} boards on ${doorWalls.length} walls with slots; slots turned down:`, Object.entries(rejected).map(([k, n]) => `${k} ${n}`).join(", "));
console.log(`wall lanterns slid off a venue's board: ${stats.offBoard}, dropped with no wall beside it: ${stats.onBoard}`);
console.log("mapped:", Object.entries(stats.mapped).map(([k, v]) => `${k} -> ${v} (${MAPPED[k]?.why ?? ""})`).join("; "));
console.log("skipped:", Object.entries(stats.skipped).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n} (${SKIPPED[k] ?? (SKIPPED_ART as Record<string, string>)[k] ?? "unknown kind"})`).join("; "));
if (process.argv.includes("--items")) {
  for (const [id, [asked, got]] of Object.entries(stats.perItem)) if (asked !== got) console.log(`${id}: ${asked} asked, ${got} placed`);
}
