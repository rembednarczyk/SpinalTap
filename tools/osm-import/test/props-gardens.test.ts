import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { KRAKOWSKIE_CHUNKS } from "../../../packages/sim/src/content/lublin/krakowskie.generated.ts";
import { NABRZEZE_CHUNKS } from "../../../packages/sim/src/content/lublin/nabrzeze.generated.ts";
import { PODZAMCZE_CHUNKS } from "../../../packages/sim/src/content/lublin/podzamcze.generated.ts";
import { LUBLIN_PROP_TABLE } from "../../../packages/sim/src/content/lublin/props.generated.ts";
import { STARE_MIASTO_CHUNKS } from "../../../packages/sim/src/content/lublin/stare-miasto.generated.ts";
import { segmentDistance } from "../../../packages/core/src/math/geometry2d.ts";
import { REPO } from "../src/paths.ts";
import { AFRAME_WALL } from "../src/props-aframes.ts";
import { GARDEN_WALL } from "../src/props-gardens.ts";
import type { PropsPlan } from "../src/props-gen.ts";
import { Site } from "../src/props-site.ts";

/*
 * The cafés' gardens by their venues (ADR-0094 stage 2), read from the generated table: a garden
 * the plan does not pin to a point of the map stands with its back to a facade and its fence
 * towards the street; none stands round the Trybunał (no venue there; the user's report of 20.11:
 * a garden on its entrance).
 */

const CHUNKS = [...KRAKOWSKIE_CHUNKS, ...STARE_MIASTO_CHUNKS, ...PODZAMCZE_CHUNKS, ...NABRZEZE_CHUNKS];
const site = new Site(CHUNKS);
const PLAN = JSON.parse(readFileSync(join(REPO, "docs/world/lublin-props.todo.json"), "utf8")) as PropsPlan;

/** The plan's gardens pinned to points of the map (OSM), which stay where the map has them. */
const PINNED = PLAN.items.filter((i) => i.kind === "cafe-garden").flatMap((i) => [...(i.position ? [{ x: i.position.x, z: i.position.z }] : []), ...(i.points ?? []).map(([x, z]) => ({ x, z }))]);

const gardens = Object.values(LUBLIN_PROP_TABLE).flatMap((kinds) => {
  const a = kinds["cafe-garden"] ?? [];
  const out: { x: number; z: number; yaw: number }[] = [];
  for (let i = 0; i + 4 < a.length; i += 5) out.push({ x: a[i]!, z: a[i + 2]!, yaw: a[i + 3]! });
  return out;
});
const ruled = gardens.filter((g) => !PINNED.some((p) => Math.hypot(p.x - g.x, p.z - g.z) < 1));

/** The Trybunał Koronny's outline (OSM way 66264159), in the world. */
const trybunal = (() => {
  const b = STARE_MIASTO_CHUNKS.flatMap((c) => c.buildings).find((x) => x.id === "w66264159")!;
  return Array.from({ length: b.outline.length / 2 }, (_, i) => ({ x: b.x + b.outline[i * 2]!, z: b.z + b.outline[i * 2 + 1]! }));
})();
const toTrybunal = (x: number, z: number): number =>
  Math.min(...trybunal.map((a, i) => {
    const b = trybunal[(i + 1) % trybunal.length]!;
    return segmentDistance(x, z, a.x, a.z, b.x, b.z);
  }));

describe("the cafés' gardens by their venues (ADR-0094 stage 2)", () => {
  it("places most gardens by venues, a few on the map's own points", () => {
    expect(ruled.length).toBeGreaterThan(20);
  });

  it("puts no garden round the Trybunał, which runs no café", () => {
    for (const g of gardens) expect(toTrybunal(g.x, g.z), `${g.x},${g.z}`).toBeGreaterThan(6);
  });

  it("stands each with its back to a facade and its fence towards the street", () => {
    for (const g of ruled) {
      // The front is +z of its frame: yaw from +z towards +x.
      const back = { x: g.x - Math.sin(g.yaw) * (GARDEN_WALL + 0.3), z: g.z - Math.cos(g.yaw) * (GARDEN_WALL + 0.3) };
      const front = { x: g.x + Math.sin(g.yaw) * (GARDEN_WALL + 1), z: g.z + Math.cos(g.yaw) * (GARDEN_WALL + 1) };
      expect(site.surfaceAt(back), `${g.x},${g.z}`).toBe("building");
      expect(site.surfaceAt(front), `${g.x},${g.z}`).not.toBe("building");
    }
  });

  it("stands the boards on the pavement beside a door, a step off the facade, square to it", () => {
    const boards = Object.values(LUBLIN_PROP_TABLE).flatMap((kinds) => {
      const a = kinds["a-frame-sign"] ?? [];
      const out: { x: number; z: number; yaw: number }[] = [];
      for (let i = 0; i + 4 < a.length; i += 5) out.push({ x: a[i]!, z: a[i + 2]!, yaw: a[i + 3]! });
      return out;
    });
    expect(boards.length).toBeGreaterThan(15);
    for (const b of boards) {
      // Square to the wall: the facade lies across its faces, on one side or the other.
      const side = (s: number) => site.surfaceAt({ x: b.x + Math.cos(b.yaw) * s * (AFRAME_WALL + 0.3), z: b.z - Math.sin(b.yaw) * s * (AFRAME_WALL + 0.3) });
      expect(side(1) === "building" || side(-1) === "building", `${b.x},${b.z}`).toBe(true);
    }
  });
});
