import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type TerrainGrid, terrainHeightAt } from "../../../packages/core/src";
import { ALCHEMIA_PADS, ALCHEMIA_RAMPS } from "../../../packages/sim/src/content/alchemia/terraces";
import { MAP_CHUNKS } from "../../../packages/sim/src/content/lublin/sites";
import { SHAPED_TERRAIN } from "../../../packages/sim/src/content/lublin/terrain";
import { extractFeatures } from "../../osm-import/src/features.ts";
import type { Line } from "../../osm-import/src/features.ts";
import { parseExtract } from "../../osm-import/src/osm.ts";
import { MOST, isStreet, padOnRoadFindings } from "./pad-on-road";

/** A flat 40 × 40 m chunk at y 0 on a 4 m grid. */
const flat = (): { bounds: { minX: number; maxX: number; minZ: number; maxZ: number }; terrain: TerrainGrid } => ({
  bounds: { minX: 0, maxX: 40, minZ: 0, maxZ: 40 },
  terrain: { originX: 0, originZ: 0, cell: 4, cols: 11, rows: 11, heights: new Array<number>(121).fill(0) },
});
const way = (id: string, tags: Record<string, string>, ...pts: [number, number][]): Line => ({ id, osmId: 0, tags, line: pts.map(([x, z]) => ({ x, z })) });
const street = way("w1", { highway: "residential", name: "Test" }, [6, 0], [6, 40]);

describe("pad-on-road (T-209)", () => {
  it("finds a pad whose blend lifts a street's axis, and not one a grid's cell clear of it", () => {
    const pad = (minX: number, blend: number) => ({ name: "pad", pads: [{ rect: { minX, maxX: 36, minZ: 8, maxZ: 32 }, y: 2, blend }], ramps: [] });
    expect(padOnRoadFindings([pad(12, 8)], [flat()], [street])).toHaveLength(1);
    expect(padOnRoadFindings([pad(12, 2)], [flat()], [street])).toEqual([]);
  });

  it("finds a ramp too, and leaves out informal tracks, steps and bridges", () => {
    const ramp = { name: "ramp", pads: [], ramps: [{ a: { x: 8, z: 4 }, b: { x: 8, z: 36 }, ya: 0, yb: 3, width: 4, blend: 2 }] };
    expect(padOnRoadFindings([ramp], [flat()], [street])[0]?.what).toMatch(/ramp moves w1 \(residential Test\)/);
    expect(isStreet({ highway: "path", informal: "yes" })).toBe(false);
    expect(isStreet({ highway: "steps" })).toBe(false);
    expect(isStreet({ highway: "footway", bridge: "yes" })).toBe(false);
    expect(isStreet({ highway: "footway", footway: "sidewalk" })).toBe(true);
  });

  it("keeps Świętoduska, its sidewalk and its parking lane on the NMT by Alchemia's T1 and T2 (ADR-0042)", () => {
    const osm = parseExtract(readFileSync(join(__dirname, "../../../data/osm/krakowskie.json"), "utf8"));
    const { lines, areas } = extractFeatures(osm);
    const lane = areas.find((a) => a.id === "w1514058885")!;
    const ways = [...lines.filter((l) => l.id === "w230503896" || l.id === "w232464426"), { ...lane, line: [...lane.ring, lane.ring[0]!] }];
    expect(ways).toHaveLength(3);
    const chunk = MAP_CHUNKS.find((c) => c.id === "krakowskie-2-1")!;
    const game = SHAPED_TERRAIN.get(chunk.id)!;
    const near = (x: number, z: number) => x > 380 && x < 460 && z > 20 && z < 140;
    let worst = 0;
    for (const w of ways) {
      for (let i = 0; i + 1 < w.line.length; i++) {
        const a = w.line[i]!;
        const b = w.line[i + 1]!;
        for (let k = 0; k <= 50; k++) {
          const x = a.x + ((b.x - a.x) * k) / 50;
          const z = a.z + ((b.z - a.z) * k) / 50;
          if (near(x, z)) worst = Math.max(worst, Math.abs(terrainHeightAt(game, x, z) - terrainHeightAt(chunk.terrain, x, z)));
        }
      }
    }
    expect(worst).toBeLessThanOrEqual(MOST);
    const pieces = [...ALCHEMIA_PADS.map((p) => ({ name: p.row ?? "pad", pads: [p], ramps: [] })), ...ALCHEMIA_RAMPS.map((r) => ({ name: "ramp", pads: [], ramps: [r] }))];
    expect(padOnRoadFindings(pieces, MAP_CHUNKS, lines.filter((l) => isStreet(l.tags)))).toEqual([]);
  });
});
