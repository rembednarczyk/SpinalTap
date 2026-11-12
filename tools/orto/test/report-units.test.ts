import { describe, expect, it } from "vitest";
import type { LublinChunkData } from "../../../packages/sim/src/content/lublin/types.ts";
import type { OsmData } from "../../osm-import/src/osm.ts";
import { worldToGeo } from "../../osm-import/src/project.ts";
import { barrierReport } from "../src/barriers.ts";
import { emptyCover } from "../src/cover.ts";
import { emptyRuns, furnitureCounts } from "../src/furniture.ts";
import { THRESHOLDS } from "../src/thresholds.ts";

describe("the cell report's furniture and barriers", () => {
  it("finds a pavement left empty and tells the map's pieces from the generator's", () => {
    const chunk = {
      id: "t-0-0",
      bounds: { minX: 0, maxX: 200, minZ: 0, maxZ: 40 },
      buildings: [],
      ground: [{ surface: "sidewalk", outline: [0, 6, 200, 6, 200, 9, 0, 9] }],
      streets: [{ name: "Próbna", kind: "residential", line: [0, 0, 200, 0] }],
    } as unknown as LublinChunkData;
    const h = emptyCover("t", { minX: 0, minZ: 0, maxX: 200, maxZ: 40 }, THRESHOLDS).header;
    const pieces = [
      { kind: "bench", x: 50, z: 7 },
      { kind: "lamp-road", x: 150, z: 7 },
    ];
    const runs = emptyRuns(h, chunk, pieces);
    expect(runs.map((r) => [r.street, r.side, r.length])).toEqual([["Próbna", "left", 88]]);
    const counts = furnitureCounts(pieces, new Map([["bench", [{ x: 50.5, z: 7 }]]]), chunk.bounds);
    expect(counts.bench).toEqual({ total: 1, osm: 1, generator: 0 });
    expect(counts.lamp).toEqual({ total: 1, osm: 0, generator: 1 });
  });

  it("measures the map's barriers in a cell and lists those the game does not draw", () => {
    const node = (id: number, x: number, z: number, tags?: Record<string, string>) => [id, { id, ...worldToGeo({ x, z }), ...(tags ? { tags } : {}) }] as const;
    const osm: OsmData = {
      nodes: new Map([node(1, 10, 10), node(2, 30, 10), node(3, 300, 10), node(4, 15, 15, { barrier: "gate" })]),
      ways: new Map([
        [7, { id: 7, nodes: [1, 2], tags: { barrier: "wall" } }],
        [8, { id: 8, nodes: [2, 3], tags: { barrier: "fence" } }],
      ]),
      relations: new Map(),
    };
    const r = barrierReport(osm, { minX: 0, maxX: 100, minZ: 0, maxZ: 100 }, []);
    expect(r.kinds.wall).toEqual({ osmLines: 1, osmMetres: 20, osmPoints: 0, game: 0 });
    expect(r.kinds.gate!.osmPoints).toBe(1);
    // The fence's one segment has its middle off the cell.
    expect(r.notDrawn.map((l) => l.id)).toEqual(["w7"]);
  });
});
