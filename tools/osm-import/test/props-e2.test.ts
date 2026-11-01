import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { StreetPropItem } from "../../../packages/core/src/world/city-geo.ts";
import { distanceToPiece, furniturePrisms } from "../../../packages/sim/src/content/lublin/furniture.ts";
import { KRAKOWSKIE_CHUNKS } from "../../../packages/sim/src/content/lublin/krakowskie.generated.ts";
import { NABRZEZE_CHUNKS } from "../../../packages/sim/src/content/lublin/nabrzeze.generated.ts";
import { PODZAMCZE_CHUNKS } from "../../../packages/sim/src/content/lublin/podzamcze.generated.ts";
import { STARE_MIASTO_CHUNKS } from "../../../packages/sim/src/content/lublin/stare-miasto.generated.ts";
import { REPO } from "../src/paths.ts";
import { type PropsPlan, generateProps } from "../src/props-gen.ts";
import { propOf } from "../src/props-kinds.ts";
import { Site } from "../src/props-site.ts";

/** The street furniture of ADR-0058 stage 2 as the generator places it. */

const CHUNKS = [...KRAKOWSKIE_CHUNKS, ...STARE_MIASTO_CHUNKS, ...PODZAMCZE_CHUNKS, ...NABRZEZE_CHUNKS];
const PLAN = JSON.parse(readFileSync(join(REPO, "docs/world/lublin-props.todo.json"), "utf8")) as PropsPlan;
const { byChunk } = generateProps(PLAN, CHUNKS);
const site = new Site(CHUNKS);
const pieces = [...byChunk.values()].flat();
const of = (prop: string) => pieces.filter((i) => i.prop === prop);

/** Points of a piece's solid footprint, every 0.25 m. */
const footprint = (i: StreetPropItem) =>
  furniturePrisms(i).flatMap((p) => {
    const xs = p.points.map((q) => q.x);
    const zs = p.points.map((q) => q.z);
    const out = [];
    for (let x = Math.min(...xs); x <= Math.max(...xs) + 1e-9; x += 0.25)
      for (let z = Math.min(...zs); z <= Math.max(...zs) + 1e-9; z += 0.25) {
        const at = { x: i.x + x, z: i.z + z };
        if (distanceToPiece(i, at.x, at.z) === 0) out.push(at);
      }
    return out;
  });

describe("street furniture of ADR-0058 stage 2 (generator)", () => {
  it("draws the plan's cash machines, which it used to leave in the facades", () => {
    expect(propOf("atm")).toBe("atm");
    const asked = PLAN.items.filter((i) => i.kind === "atm").reduce((n, i) => n + (i.count ?? 0), 0);
    expect(asked).toBe(11);
    expect(of("atm").length).toBe(10);
    for (const a of of("atm")) expect(["road", "building"]).not.toContain(site.surfaceAt(a));
  });

  it("stands fire hydrants at the kerb along the roads, on the pavement", () => {
    expect(of("hydrant").length).toBeGreaterThanOrEqual(30);
    for (const h of of("hydrant")) {
      expect(site.surfaceAt(h)).not.toBe("road");
      expect(site.surfaceAt(h)).not.toBe("building");
    }
  });

  it("sets food carts and containers whole on open ground, clear of the stalls, the roads and each other", () => {
    expect(of("food-cart").length).toBe(5);
    expect(of("container").length).toBe(8);
    const solids = pieces.filter((i) => furniturePrisms(i).length > 0 && i.prop !== "bollard");
    for (const piece of [...of("food-cart"), ...of("container")]) {
      for (const q of footprint(piece)) {
        expect(site.chunkAt(q), piece.prop).not.toBeNull();
        expect(["road", "building", "water", "rail", "green"]).not.toContain(site.surfaceAt(q));
        expect(site.onPath(q)).toBe(false);
      }
      const near = solids.filter((o) => o !== piece && Math.hypot(o.x - piece.x, o.z - piece.z) < 9);
      for (const o of near) expect(footprint(o).some((q) => distanceToPiece(piece, q.x, q.z) === 0), `${piece.prop} at ${piece.x},${piece.z} and ${o.prop}`).toBe(false);
    }
  });
});
