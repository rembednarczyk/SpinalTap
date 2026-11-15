import { it } from "vitest";
import { KRAKOWSKIE_CHUNKS } from "../../../../packages/sim/src/content/lublin/krakowskie.generated.ts";
import { NABRZEZE_CHUNKS } from "../../../../packages/sim/src/content/lublin/nabrzeze.generated.ts";
import { PODZAMCZE_CHUNKS } from "../../../../packages/sim/src/content/lublin/podzamcze.generated.ts";
import { STARE_MIASTO_CHUNKS } from "../../../../packages/sim/src/content/lublin/stare-miasto.generated.ts";
import { generateProps, type PropsPlan } from "../../src/props-gen.ts";
import { loadNodeTags } from "../../src/props-art.ts";
import { lublinVenueBoards } from "../../src/venue-boards.ts";
import { loadCarriageways } from "../../src/props-roads.ts";
import { gameDoors } from "../../src/game-doors.ts";
import { loadLitWays, loadPropsPlan, loadStreetWays } from "../../src/props-osm.ts";
import { litSecondPass } from "../../src/props-lit.ts";
import { stations } from "../../src/props-place.ts";
const CHUNKS = [...KRAKOWSKIE_CHUNKS, ...STARE_MIASTO_CHUNKS, ...PODZAMCZE_CHUNKS, ...NABRZEZE_CHUNKS];
const inBox = (x: number, z: number) => x > -200 && x < -100 && z > -290 && z < -240;
it("p816", () => {
  const plan = loadPropsPlan();
  const market = { roads: loadCarriageways(), doors: gameDoors() };
  const place = (p: PropsPlan) => generateProps(p, CHUNKS, loadNodeTags(), lublinVenueBoards(), market);
  const lit = (items: readonly PropsPlan["items"][number][]) => items.filter((i) => i.id.startsWith("lit.w"));
  const ptsOf = (l: readonly number[]) => { const o = []; for (let k = 0; k < l.length; k += 2) o.push({ x: l[k]!, z: l[k + 1]! }); return o; };
  const sts = (i: PropsPlan["items"][number]) => (i.lines ?? []).flatMap((l) => { const pts = ptsOf(l); const a = stations(pts, i.spacing!).map((s) => s.p); const b = (i.note ?? "").includes("obu stronach") ? stations(pts, i.spacing!, i.spacing!).map((s) => s.p) : []; return [...a, ...b]; });
  let none = 0;
  for (const i of lit(plan.items)) for (const l of i.lines ?? []) if (stations(ptsOf(l), i.spacing!).length === 0) { none++; console.log("NOST first", i.id, JSON.stringify(l.slice(0, 2)), JSON.stringify(l.slice(-2))); }
  const first = place(plan);
  const lamps = [...first.byChunk.values()].flat().filter((i) => i.prop.startsWith("lamp-"));
  const firstSt = lit(plan.items).flatMap((i) => sts(i));
  const dropped = firstSt.filter((p) => !lamps.some((l) => Math.hypot(l.x - p.x, l.z - p.z) < 3));
  const items = litSecondPass(plan, loadLitWays(), loadStreetWays(), lamps);
  const fills = items.filter((i) => i.id.endsWith(".fill"));
  for (const i of fills) for (const l of i.lines ?? []) if (stations(ptsOf(l), i.spacing!).length === 0) { none++; console.log("NOST fill", i.id, JSON.stringify(l.slice(0, 2)), JSON.stringify(l.slice(-2))); }
  let rep = 0;
  for (const i of fills) for (const p of sts(i)) { const d = dropped.find((q) => Math.hypot(q.x - p.x, q.z - p.z) < 1); if (d) { rep++; console.log("REPEAT", i.id, p.x.toFixed(1), p.z.toFixed(1)); } }
  console.log("SUM firstStations", firstSt.length, "dropped", dropped.length, "fills", fills.length, "nostation", none, "repeat", rep);
});
