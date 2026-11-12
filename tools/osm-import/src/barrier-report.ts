/**
 * `node tools/osm-import/src/barrier-report.ts`: the map's barriers (ADR-0077 point 4) counted by
 * kind and length, as the chunks have them and as the game lays them (after its own cuts), and
 * what each cut took. Offline; reads the simulation's content through Vite's module runner.
 */
import { join } from "node:path";
import { runnerImport } from "vite";
import { barrierLayout } from "../../../packages/core/src/world/barriers.ts";
import type * as WorldBarriers from "../../../packages/sim/src/content/world-barriers.ts";
import type * as Sites from "../../../packages/sim/src/content/lublin/sites.ts";
import { REPO } from "./paths.ts";

const load = async <T>(file: string): Promise<T> => (await runnerImport<T>(join(REPO, file), { root: REPO, configFile: false, logLevel: "warn" })).module;
const { WORLD_BARRIERS } = await load<typeof WorldBarriers>("packages/sim/src/content/world-barriers.ts");
const { MAP_CHUNKS } = await load<typeof Sites>("packages/sim/src/content/lublin/sites.ts");

const add = (m: Map<string, { n: number; m: number }>, k: string, len: number, n = 1) => {
  const e = m.get(k) ?? { n: 0, m: 0 };
  m.set(k, { n: e.n + n, m: e.m + len });
};
const print = (title: string, m: Map<string, { n: number; m: number }>) =>
  console.log(`${title}: ${[...m].sort().map(([k, e]) => `${k} ${e.n} (${e.m.toFixed(0)} m)`).join(", ")}`);

const data = new Map<string, { n: number; m: number }>();
for (const c of MAP_CHUNKS) {
  for (const b of c.barriers ?? []) {
    let len = 0;
    for (let i = 0; i + 3 < b.line.length; i += 2) len += Math.hypot(b.line[i + 2]! - b.line[i]!, b.line[i + 3]! - b.line[i + 1]!);
    add(data, b.kind, len);
  }
}
const game = new Map<string, { n: number; m: number }>();
for (const items of Object.values(WORLD_BARRIERS)) for (const i of items) add(game, barrierLayout(i.variant).kind, barrierLayout(i.variant).length);
print("chunk data (lines, length)", data);
print("in the game (pieces, length)", game);
