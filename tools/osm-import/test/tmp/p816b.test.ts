import { it } from "vitest";
import { KRAKOWSKIE_CHUNKS } from "../../../../packages/sim/src/content/lublin/krakowskie.generated.ts";
import { Site } from "../../src/props-site.ts";
import { loadLitWays } from "../../src/props-osm.ts";
it("p", () => {
  const site = new Site(KRAKOWSKIE_CHUNKS);
  for (const p of [{ x: 122.2, z: 44.8 }, { x: -68.7, z: 107.2 }]) {
    const near = [-3,-1.5,0,1.5,3].map((d) => site.surfaceAt({ x: p.x + d, z: p.z })).join(",");
    const nearz = [-3,-1.5,0,1.5,3].map((d) => site.surfaceAt({ x: p.x, z: p.z + d })).join(",");
    console.log("AT", p.x, p.z, site.surfaceAt(p), "x:", near, "z:", nearz);
  }
  for (const w of loadLitWays()) {
    const d = Math.min(...w.pts.map((q) => Math.hypot(q.x - 122.2, q.z - 44.8)));
    if (d < 40) console.log("WAY", w.id, w.tags.highway, w.tags.footway ?? "", d.toFixed(1), JSON.stringify(w.pts.map((q) => [Math.round(q.x), Math.round(q.z)])));
  }
});
