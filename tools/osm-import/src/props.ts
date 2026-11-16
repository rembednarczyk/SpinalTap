/**
 * `pnpm osm:props`: street furniture of Lublin 2077 (ADR-0047) from
 * `docs/world/lublin-props.todo.json`, the OSM furniture it lacks (`data/osm/points/furniture.json`)
 * and the generated chunks into
 * `packages/sim/src/content/lublin/props.generated.ts` (`props-build.ts`), then the control numbers;
 * `--check` compares the table with what it would write (`pnpm tables:check`, exit 1 when they differ).
 */
import { PROPS_OUT, buildProps } from "./props-build.ts";
import { MAPPED, SKIPPED, SKIPPED_ART } from "./props-kinds.ts";
import { endCheck, writeTable } from "./table-write.ts";

const { text, byChunk, stats, crowns, decals, doors, figures, entrances, doorWalls } = await buildProps();
writeTable(PROPS_OUT, text);
endCheck("pnpm osm:props");
const total = Object.values(stats.perKind).reduce((a, b) => a + b, 0);
console.log(`props.generated.ts: ${(Buffer.byteLength(text) / 1024).toFixed(0)} KiB, ${total} pieces in ${byChunk.size} chunks`);
console.log("per kind:", Object.entries(stats.perKind).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", "));
console.log("per district:", Object.entries(stats.perDistrict).map(([k, n]) => `${k} ${n}`).join(", "));
console.log(`dropped: ${stats.outside} outside the chunks, ${stats.inBuilding} inside building outlines, ${stats.onRoad} on a road with no pavement near, ${stats.merged} too close to the same kind, ${stats.crowded} with no room beside a solid placed before`);
console.log(`moved off the road onto the pavement or away from a wall: ${stats.offRoad}`);
console.log(`trees of the crowns (G-797): ${crowns.cells} crown cells, ${crowns.tops} tops, ${crowns.nearTree} under a tree before, ${crowns.noGround} with no ground for a trunk, ${crowns.eave} on an eave, ${crowns.byWall} by walls even their narrowest crown reaches, ${crowns.placed} placed`);
if (stats.kerbRows) {
  const k = stats.kerbRows;
  console.log(`kerb rows (G-820): ${k.posts} posts, ${k.posts - k.bare} with chains along ${k.metres} m, ${k.bare} without along ${k.bareMetres} m`);
}
console.log("decals (ADR-0058 stage 6):", Object.entries(decals.per).map(([k, by]) => `${k} ${Object.entries(by).map(([d, n]) => `${d} ${n}`).join(" ")}`).join("; "));
console.log("  spots turned down:", Object.entries(decals.rejected).sort().map(([k, n]) => `${k} ${n}`).join(", "));
console.log("doors (ADR-0058 stage 9):", Object.entries(doors.per).sort().map(([k, n]) => `${k} ${n}`).join(", "));
console.log(`  from ${entrances} entrances and ${doorWalls.boards} boards on ${doorWalls.walls} walls with slots; slots turned down:`, Object.entries(doors.rejected).map(([k, n]) => `${k} ${n}`).join(", "));
console.log("figures (ADR-0058 stage 8) by host:", Object.entries(figures.per).sort().map(([k, n]) => `${k} ${n}`).join(", "));
console.log("  spots turned down:", Object.entries(figures.rejected).sort().map(([k, n]) => `${k} ${n}`).join(", "));
console.log(`wall lanterns slid off a venue's board: ${stats.offBoard}, dropped with no wall beside it: ${stats.onBoard}`);
console.log("mapped:", Object.entries(stats.mapped).map(([k, v]) => `${k} -> ${v} (${MAPPED[k]?.why ?? ""})`).join("; "));
console.log("skipped:", Object.entries(stats.skipped).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n} (${SKIPPED[k] ?? (SKIPPED_ART as Record<string, string>)[k] ?? "unknown kind"})`).join("; "));
if (process.argv.includes("--items")) {
  for (const [id, [asked, got]] of Object.entries(stats.perItem)) if (asked !== got) console.log(`${id}: ${asked} asked, ${got} placed`);
}
