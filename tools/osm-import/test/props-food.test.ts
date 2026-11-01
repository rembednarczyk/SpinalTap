import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { StreetPropItem } from "../../../packages/core/src/world/city-geo.ts";
import { crossingBands, inCrossingBand } from "../../../packages/sim/src/content/lublin/crossing-bands.ts";
import { distanceToPiece, furniturePrisms, turnLocal } from "../../../packages/sim/src/content/lublin/furniture.ts";
import { KRAKOWSKIE_CHUNKS } from "../../../packages/sim/src/content/lublin/krakowskie.generated.ts";
import { NABRZEZE_CHUNKS } from "../../../packages/sim/src/content/lublin/nabrzeze.generated.ts";
import { PODZAMCZE_CHUNKS } from "../../../packages/sim/src/content/lublin/podzamcze.generated.ts";
import { STARE_MIASTO_CHUNKS } from "../../../packages/sim/src/content/lublin/stare-miasto.generated.ts";
import { pointInRing } from "../src/geometry.ts";
import { REPO } from "../src/paths.ts";
import { Clearances, SPARSE_DISTRICTS, foodStalls } from "../src/props-food.ts";
import { FOOD_STALLS, type PropsPlan, generateProps } from "../src/props-gen.ts";
import { Site } from "../src/props-site.ts";
import { gameDoors } from "../src/game-doors.ts";
import { loadCarriageways } from "../src/props-roads.ts";
import { lublinVenueBoards } from "../src/venue-boards.ts";

/** The market's stock and the food booths of ADR-0058 stage 3, as the generator places them by its rules. */

const CHUNKS = [...KRAKOWSKIE_CHUNKS, ...STARE_MIASTO_CHUNKS, ...PODZAMCZE_CHUNKS, ...NABRZEZE_CHUNKS];
const PLAN = JSON.parse(readFileSync(join(REPO, "docs/world/lublin-props.todo.json"), "utf8")) as PropsPlan;
const BOARDS = lublinVenueBoards();
const MARKET = { roads: loadCarriageways(), doors: gameDoors() };
const { byChunk, stats } = generateProps(PLAN, CHUNKS, new Map(), BOARDS, MARKET);
const site = new Site(CHUNKS);
const pieces = [...byChunk.values()].flat();
const of = (prop: string) => pieces.filter((i) => i.prop === prop);
const bands = crossingBands(CHUNKS);

/** Points of a piece's solid, every 0.25 m. */
const footprint = (i: StreetPropItem) =>
  furniturePrisms(i).flatMap((p) => {
    const xs = p.points.map((q) => q.x);
    const zs = p.points.map((q) => q.z);
    const out = [];
    for (let x = Math.min(...xs); x <= Math.max(...xs) + 1e-9; x += 0.25)
      for (let z = Math.min(...zs); z <= Math.max(...zs) + 1e-9; z += 0.25) if (distanceToPiece(i, i.x + x, i.z + z) === 0) out.push({ x: i.x + x, z: i.z + z });
    return out;
  });

/** Is (x, z) under a stall's canvas (2.4 x 1.8 m)? */
const underCanvas = (s: StreetPropItem, x: number, z: number, pad = 0) => {
  const c = Math.cos(s.yaw);
  const n = Math.sin(s.yaw);
  const dx = x - s.x;
  const dz = z - s.z;
  return Math.abs(dx * c - dz * n) <= 1.2 + pad && Math.abs(dx * n + dz * c) <= 0.9 + pad;
};

const markets = PLAN.items.filter((i) => i.kind === "market" || i.kind === "market-stall").map((i) => {
  const f = i.polygon!;
  const ring = [];
  for (let k = 0; k + 1 < f.length; k += 2) ring.push({ x: f[k]!, z: f[k + 1]! });
  return { id: i.id, ring };
});

describe("the market's stock (ADR-0058 stage 3, generator)", () => {
  const goods = of("market-goods");
  const stalls = of("market-stall");

  it("stands beside a stall of every marketplace and the flea market, none in the old town", () => {
    expect(goods.length).toBe(59);
    for (const m of ["ruska.targ-na-ruskiej", "nowy-plac-targowy.bazar", "nabrzeze.gielda-kresowa", "plac-zamkowy.flea-market"]) {
      const ring = markets.find((x) => x.id === m)!.ring;
      expect(goods.filter((g) => pointInRing(g, ring)).length, m).toBeGreaterThan(3);
    }
    for (const g of goods) expect(SPARSE_DISTRICTS.has(site.chunkAt(g)!.district), `${g.x},${g.z}`).toBe(false);
  });

  it("each beside its stall, turned like it, inside the market's outline, on its paving", () => {
    for (const g of goods) {
      const host = stalls.find((s) => Math.hypot(s.x - g.x, s.z - g.z) < 2.6 && Math.abs(Math.cos(s.yaw - g.yaw) - 1) < 1e-3);
      expect(host, `${g.x},${g.z}`).toBeDefined();
      expect(markets.some((m) => pointInRing(g, m.ring))).toBe(true);
      for (const q of footprint(g)) {
        expect(site.surfaceAt(q), `${g.x},${g.z}`).toBe("walk");
        expect(site.onPath(q)).toBe(false);
        expect(bands.some((b) => inCrossingBand(b, q, 2))).toBe(false);
      }
    }
  });

  it("under no canvas, and leaves a passage of 1.5 m along the row past it", () => {
    for (const g of goods) {
      const near = stalls.filter((s) => Math.hypot(s.x - g.x, s.z - g.z) < 10);
      for (const q of footprint(g)) expect(near.some((s) => underCanvas(s, q.x, q.z)), `${g.x},${g.z}`).toBe(false);
      // One side or the other of it along the row is open for 1.5 m (the side away from its stall).
      const open = [1, -1].some((side) => {
        for (let a = 0.75; a <= 2.15; a += 0.25)
          for (const b of [-0.3, 0, 0.3]) {
            const q = turnLocal(g.yaw, side * a, b);
            if (near.some((s) => underCanvas(s, g.x + q.x, g.z + q.z))) return false;
          }
        return true;
      });
      expect(open, `${g.x},${g.z}`).toBe(true);
    }
  });
});

describe("the food booths (ADR-0058 stage 3, generator)", () => {
  const booths = of("food-stall");

  it("stand by the fast-food venues' boards, one a venue, none in the old town", () => {
    expect(booths.length).toBe(10);
    expect(stats.perItem[FOOD_STALLS]).toEqual([0, 10]);
    for (const b of booths) expect(SPARSE_DISTRICTS.has(site.chunkAt(b)!.district)).toBe(false);
    // In front of a wall, within the slide of a fast-food venue's board.
    const food = new Set(CHUNKS.flatMap((c) => c.buildings.flatMap((h) => (h.venues ?? []).filter((v) => v.kind === "fast-food").map((v) => v.name))));
    for (const b of booths) {
      const back = turnLocal(b.yaw, 0, -1.65);
      expect(site.surfaceAt({ x: b.x + back.x, z: b.z + back.z }), `${b.x},${b.z}`).toBe("building");
      const board = BOARDS.filter((s) => food.has(s.text)).find((s) => Math.min(Math.hypot(s.a.x - b.x, s.a.z - b.z), Math.hypot(s.b.x - b.x, s.b.z - b.z)) < 10);
      expect(board, `${b.x},${b.z}`).toBeDefined();
    }
  });

  it("keep off the venues' boards, the roads and the zebras, with 2 m of open pavement in front of the stools", () => {
    for (const b of booths) {
      for (const q of footprint(b)) {
        expect(["road", "building", "green", "water", "rail"]).not.toContain(site.surfaceAt(q));
        expect(bands.some((x) => inCrossingBand(x, q, 2))).toBe(false);
      }
      for (let a = -1.1; a <= 1.1; a += 0.55)
        for (let z = 1.3; z <= 3.0; z += 0.5) {
          const q = turnLocal(b.yaw, a, z);
          expect(["road", "building", "green", "water", "rail"], `${b.x},${b.z}`).not.toContain(site.surfaceAt({ x: b.x + q.x, z: b.z + q.z }));
        }
      // No board's span along the wall behind it.
      for (const s of BOARDS) {
        if (Math.abs(s.nx * Math.sin(b.yaw) + s.nz * Math.cos(b.yaw)) < 0.95) continue;
        const off = (b.x - s.a.x) * s.nx + (b.z - s.a.z) * s.nz;
        if (off < 0 || off > 3) continue;
        const len = Math.hypot(s.b.x - s.a.x, s.b.z - s.a.z);
        const u = ((b.x - s.a.x) * (s.b.x - s.a.x) + (b.z - s.a.z) * (s.b.z - s.a.z)) / len;
        expect(u < -1.2 || u > len + 1.2, `${b.x},${b.z} in front of ${s.text}`).toBe(true);
      }
    }
  });

  it("keep 3 m from the game's doors: none by the clinic's door, where the game starts", () => {
    const doors = gameDoors();
    expect(doors.length).toBeGreaterThanOrEqual(2);
    const gap = (q: { x: number; z: number }, d: (typeof doors)[number]) => {
      const dx = d.b.x - d.a.x;
      const dz = d.b.z - d.a.z;
      const t = Math.max(0, Math.min(1, ((q.x - d.a.x) * dx + (q.z - d.a.z) * dz) / (dx * dx + dz * dz)));
      return Math.hypot(d.a.x + dx * t - q.x, d.a.z + dz * t - q.z);
    };
    for (const piece of [...booths, ...of("market-goods")]) for (const q of footprint(piece)) for (const d of doors) expect(gap(q, d), `${piece.x},${piece.z}`).toBeGreaterThanOrEqual(3);
    expect(booths.some((b) => b.x === 318.9 && b.z === -73.9)).toBe(false);
  });

  it("follow the venues of the data, not a list: without the boards there are none, with one board one at most", () => {
    const clear = new Clearances(CHUNKS);
    expect(foodStalls(site, clear, [], [])).toEqual([]);
    const one = BOARDS.find((s) => s.text === "KEBAB TENDENCJA")!;
    const got = foodStalls(site, clear, [one], []);
    expect(got.length).toBe(1);
    expect(got[0]!.key).toBe("food-stall:KEBAB TENDENCJA");
  });
});
