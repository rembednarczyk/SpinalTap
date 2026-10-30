/**
 * `pnpm osm:props`: street furniture of Lublin 2077 (ADR-0047) from
 * `docs/world/lublin-props.todo.json` and the generated chunks into
 * `packages/sim/src/content/lublin/props.generated.ts`, then the control numbers.
 */
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { KRAKOWSKIE_CHUNKS } from "../../../packages/sim/src/content/lublin/krakowskie.generated.ts";
import { NABRZEZE_CHUNKS } from "../../../packages/sim/src/content/lublin/nabrzeze.generated.ts";
import { PODZAMCZE_CHUNKS } from "../../../packages/sim/src/content/lublin/podzamcze.generated.ts";
import { STARE_MIASTO_CHUNKS } from "../../../packages/sim/src/content/lublin/stare-miasto.generated.ts";
import { REPO } from "./paths.ts";
import { emitProps } from "./props-emit.ts";
import { type PropsPlan, generateProps } from "./props-gen.ts";
import { MAPPED, SKIPPED } from "./props-kinds.ts";

const PLAN = join(REPO, "docs/world/lublin-props.todo.json");
const OUT = join(REPO, "packages/sim/src/content/lublin/props.generated.ts");

const plan = JSON.parse(readFileSync(PLAN, "utf8")) as PropsPlan;
const chunks = [...KRAKOWSKIE_CHUNKS, ...STARE_MIASTO_CHUNKS, ...PODZAMCZE_CHUNKS, ...NABRZEZE_CHUNKS];
const { byChunk, stats } = generateProps(plan, chunks);
writeFileSync(OUT, emitProps(byChunk));
const total = Object.values(stats.perKind).reduce((a, b) => a + b, 0);
console.log(`props.generated.ts: ${(statSync(OUT).size / 1024).toFixed(0)} KiB, ${total} pieces in ${byChunk.size} chunks`);
console.log("per kind:", Object.entries(stats.perKind).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", "));
console.log("per district:", Object.entries(stats.perDistrict).map(([k, n]) => `${k} ${n}`).join(", "));
console.log(`dropped: ${stats.outside} outside the chunks, ${stats.inBuilding} inside building outlines, ${stats.onRoad} on a road with no pavement near, ${stats.merged} too close to the same kind`);
console.log(`moved off the road onto the pavement: ${stats.offRoad}`);
console.log("mapped:", Object.entries(stats.mapped).map(([k, v]) => `${k} -> ${v} (${MAPPED[k]?.why ?? ""})`).join("; "));
console.log("skipped:", Object.entries(stats.skipped).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n} (${SKIPPED[k] ?? "unknown kind"})`).join("; "));
if (process.argv.includes("--items")) {
  for (const [id, [asked, got]] of Object.entries(stats.perItem)) if (asked !== got) console.log(`${id}: ${asked} asked, ${got} placed`);
}
