import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { KRAKOWSKIE_CHUNKS } from "../../../packages/sim/src/content/lublin/krakowskie.generated.ts";
import { NABRZEZE_CHUNKS } from "../../../packages/sim/src/content/lublin/nabrzeze.generated.ts";
import { PODZAMCZE_CHUNKS } from "../../../packages/sim/src/content/lublin/podzamcze.generated.ts";
import { STARE_MIASTO_CHUNKS } from "../../../packages/sim/src/content/lublin/stare-miasto.generated.ts";
import type { LublinChunkData } from "../../../packages/sim/src/content/lublin/types.ts";
import { type Pt, pointInRing } from "../src/geometry.ts";
import { REPO } from "../src/paths.ts";
import { type PropsPlan, generateProps } from "../src/props-gen.ts";
import { Site } from "../src/props-site.ts";

const CHUNKS = [...KRAKOWSKIE_CHUNKS, ...STARE_MIASTO_CHUNKS, ...PODZAMCZE_CHUNKS, ...NABRZEZE_CHUNKS];
const PLAN = JSON.parse(readFileSync(join(REPO, "docs/world/lublin-props.todo.json"), "utf8")) as PropsPlan;

const ringOf = (f: readonly number[]): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < f.length; i += 2) out.push({ x: f[i]!, z: f[i + 1]! });
  return out;
};

/**
 * A paved 120 x 80 m chunk with a marketplace of `w` x `d` m in its middle, crossed by a 3 m
 * footpath (`path` across x = 60 or z = 40, by the longer side) that comes in through its edges.
 */
const square = (w: number, d: number): { chunk: LublinChunkData; ring: Pt[] } => {
  const [x0, x1, z0, z1] = [60 - w / 2, 60 + w / 2, 40 - d / 2, 40 + d / 2];
  const path = w >= d ? [58.5, 0, 61.5, 0, 61.5, 80, 58.5, 80] : [0, 38.5, 120, 38.5, 120, 41.5, 0, 41.5];
  const line = w >= d ? [60, 0, 60, 80] : [0, 40, 120, 40];
  return {
    ring: ringOf([x0, z0, x1, z0, x1, z1, x0, z1]),
    chunk: {
      id: "test-0-0",
      district: "targ",
      bounds: { minX: 0, maxX: 120, minZ: 0, maxZ: 80 },
      terrain: { originX: 0, originZ: 0, cell: 60, cols: 3, rows: 2, heights: [0, 0, 0, 0, 0, 0] },
      buildings: [],
      ground: [
        { surface: "square", outline: [0, 0, 120, 0, 120, 80, 0, 80] },
        { surface: "footway", outline: path },
      ],
      streets: [{ name: "", kind: "footway", line }],
      markings: [],
      pois: [],
    },
  };
};

const stallsOf = (ring: readonly Pt[], chunk: LublinChunkData) =>
  generateProps({ items: [{ id: "test.market", kind: "market", polygon: ring.flatMap((p) => [p.x, p.z]), count: 1 }] }, [chunk])
    .byChunk.get(chunk.id)!
    .filter((i) => i.prop === "market-stall");

describe("marketplace stalls (G-064)", () => {
  it("gives every marketplace of the plan at least a stall per 150 m² of its open ground", () => {
    const site = new Site(CHUNKS);
    const stalls = [...generateProps(PLAN, CHUNKS).byChunk.values()].flat().filter((i) => i.prop === "market-stall");
    const markets = PLAN.items.filter((i) => i.kind === "market" && i.polygon);
    expect(markets.map((m) => m.osm)).toEqual(["w231445090", "w182461192", "w67502759"]);
    for (const m of markets) {
      const ring = ringOf(m.polygon!);
      let open = 0;
      for (let x = Math.floor(Math.min(...ring.map((p) => p.x))) + 0.5; x < Math.max(...ring.map((p) => p.x)); x++)
        for (let z = Math.floor(Math.min(...ring.map((p) => p.z))) + 0.5; z < Math.max(...ring.map((p) => p.z)); z++)
          if (pointInRing({ x, z }, ring) && site.chunkAt({ x, z }) && site.standable({ x, z })) open++;
      const n = stalls.filter((s) => pointInRing(s, ring)).length;
      expect(n * 150, `${m.id}: ${n} stalls on ${open} m²`).toBeGreaterThanOrEqual(open);
    }
  });

  it("stands the stalls in rows along the longer axis, back to back, with passages, off the path and its entrances", () => {
    for (const [w, d] of [
      [90, 40],
      [40, 70],
    ] as const) {
      const { chunk, ring } = square(w, d);
      const stalls = stallsOf(ring, chunk);
      expect(stalls).toEqual(stallsOf(ring, chunk));
      expect(stalls.length, `${w} x ${d}`).toBeGreaterThan(40);
      const long = w >= d;
      // The counters run along the longer axis, so the fronts face across it: two ways, back to back.
      const fronts = new Set(stalls.map((s) => Math.round(((long ? s.yaw : s.yaw - Math.PI / 2) / Math.PI) * 2) & 3));
      expect([...fronts].sort()).toEqual([0, 2]);
      const across = (s: Pt) => (long ? s.z : s.x);
      const along = (s: Pt) => (long ? s.x : s.z);
      const rows = new Map<number, number[]>();
      for (const s of stalls) rows.set(Math.round(across(s) * 10), [...(rows.get(Math.round(across(s) * 10)) ?? []), along(s)]);
      expect(rows.size).toBeLessThan(stalls.length / 4);
      for (const [, us] of rows) {
        const sorted = us.sort((a, b) => a - b);
        const gaps = sorted.slice(1).map((u, k) => u - sorted[k]!);
        expect(Math.min(...gaps)).toBeGreaterThanOrEqual(2.5);
        // A row longer than a block has a passage across it.
        if (sorted.length > 4) expect(Math.max(...gaps)).toBeGreaterThanOrEqual(6);
      }
      for (const s of stalls) {
        expect(pointInRing(s, ring)).toBe(true);
        // The canvas (1.2 m to its side) keeps clear of the 3 m path across the rows.
        expect(Math.abs(along(s) - (long ? 60 : 40)), `${s.x}, ${s.z}`).toBeGreaterThan(1.5 + 1.2);
        const gates = long ? [{ x: 60, z: 40 - d / 2 }, { x: 60, z: 40 + d / 2 }] : [{ x: 60 - w / 2, z: 40 }, { x: 60 + w / 2, z: 40 }];
        for (const g of gates) expect(Math.hypot(s.x - g.x, s.z - g.z)).toBeGreaterThanOrEqual(6);
      }
    }
  });

  it("leaves a marketplace off the map or under a building without stalls", () => {
    const { chunk } = square(90, 40);
    expect(stallsOf(ringOf([200, 200, 260, 200, 260, 240, 200, 240]), chunk)).toEqual([]);
    const built = { ...chunk, buildings: [{ id: "w1", x: 60, z: 40, y: 0, outline: [-50, -25, 50, -25, 50, 25, -50, 25], parts: [], height: 6, plinth: 0, levels: 1, use: "commercial", look: 1, source: "default" }] } as LublinChunkData;
    expect(stallsOf(ringOf([20, 20, 100, 20, 100, 60, 20, 60]), built)).toEqual([]);
  });
});
