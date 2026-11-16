import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PODZAMCZE_CHUNKS } from "../../../packages/sim/src/content/lublin/podzamcze.generated.ts";
import { TAG_CORRECTIONS, corrected } from "../src/corrections.ts";
import type { Area } from "../src/features.ts";
import { mergeOsm, parseExtract } from "../src/osm.ts";
import { geoToWorld } from "../src/project.ts";

/** A landmark's outline corrected where the surface model puts its wall elsewhere (G-874, T-319). */

const OSM_DIR = join(__dirname, "../../../data/osm");

const jogged: Area = { id: "w1", osmId: 1, tags: { building: "castle" }, ring: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10.1, z: 3 }, { x: 10, z: 10 }, { x: 0, z: 10 }], holes: 0 };

/** Where the outline's northmost wall crosses the line x = `x`: the highest z of its edges over it. */
const northWall = (ring: readonly { readonly x: number; readonly z: number }[], x: number): number => {
  let best = -Infinity;
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length]!;
    if ((a.x - x) * (b.x - x) > 0 || a.x === b.x) return;
    best = Math.max(best, a.z + ((b.z - a.z) * (x - a.x)) / (b.x - a.x));
  });
  return best;
};

describe("landmark outline corrections (G-874)", () => {
  it("leaves out the vertices by the dropped points only, and the other elements as mapped", () => {
    const drop = new Map([["w1", { id: "w1", tags: {}, drop: [{ x: 10.05, z: 3.1 }], reason: "uskok obrysu", ref: "T-319" }]]);
    expect(corrected(jogged, drop).ring).toEqual([{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }, { x: 0, z: 10 }]);
    expect(corrected({ ...jogged, id: "w2" }, drop)).toEqual({ ...jogged, id: "w2" });
  });

  it("takes each dropped vertex from a node of the map within 0.2 m, so a new extract that moves it shows", () => {
    const osm = mergeOsm(readdirSync(OSM_DIR).filter((f) => f.endsWith(".json")).map((f) => parseExtract(readFileSync(join(OSM_DIR, f), "utf8"))));
    const dropped = TAG_CORRECTIONS.filter((c) => c.drop?.length);
    expect(dropped.length).toBeGreaterThan(0);
    const off: string[] = [];
    for (const c of dropped)
      for (const p of c.drop ?? []) {
        const nodes = (osm.ways.get(Number(c.id.slice(1)))?.nodes ?? []).flatMap((id) => {
          const n = osm.nodes.get(id);
          return n ? [geoToWorld(n.lat, n.lon)] : [];
        });
        const d = Math.min(...nodes.map((n) => Math.hypot(n.x - p.x, n.z - p.z)));
        if (!(d <= 0.2)) off.push(`${c.id} ${p.x},${p.z} ${d.toFixed(2)} m`);
      }
    expect(off.join(", ")).toEqual("");
  });

  // GUGiK NMPT 0.5 m and the orthophoto 2023-09..2025-04 (curator, G-841 r3): Zamek's north wing
  // has one straight wall, its roof's edge at z 257.75/256.3/254.0 abreast of x 910/925/940. Its
  // line from the map's corners (903.6; 258.6)-(941.0; 253.8) runs 0.45 m south of the edge at
  // x 925; the import's simplification (0.3 m) takes the corner at x 941 into the east wall's line
  // to (947.5; 252.8), which moves the wall's middle 0.08 m further south, inside the roof.
  it("lays Zamek's north wing within 0.55 m of NMPT's roof edge, with no jog to the north", () => {
    const zamek = PODZAMCZE_CHUNKS.flatMap((c) => c.buildings).find((b) => b.id === "w48500136")!;
    const ring = Array.from({ length: zamek.outline.length / 2 }, (_, i) => ({ x: zamek.x + zamek.outline[2 * i]!, z: zamek.z + zamek.outline[2 * i + 1]! }));
    for (const [x, z] of [
      [910, 257.75],
      [925, 256.3],
      [940, 254.0],
    ] as const) {
      const at = northWall(ring, x);
      expect(Math.abs(at - z), `x ${x}: wall at z ${at.toFixed(2)}`).toBeLessThanOrEqual(0.55);
    }
  });
});
