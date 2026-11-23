import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pointInPairRingEvenOdd } from "../../../packages/core/src";
import { LUBLIN_CHUNKS } from "../../../packages/sim/src/content/lublin";
import type { Declaration } from "../src/evaluate.ts";

/**
 * The probes of a new grid (`pnpm grid:verify <name>`, `GRID_NAME`): what the scan has no kind for yet and a row of
 * chunks got wrong before. Skipped without `GRID_NAME`, so the suite pays nothing for them.
 */
const name = process.env.GRID_NAME;
const decl = name ? (JSON.parse(readFileSync(join(import.meta.dirname, "../../../docs/siatki", `${name}.json`), "utf8")) as Declaration) : null;

type Flat = readonly number[];
const ringOf = (flat: Flat) => Array.from({ length: flat.length / 2 }, (_, i): [number, number] => [flat[2 * i]!, flat[2 * i + 1]!]);

/** Whether (x, z) lies on a street's carriageway, by its reach left and right of its line (`half`). */
const onCarriageway = (streets: readonly { line: Flat; half?: Flat }[], x: number, z: number): boolean =>
  streets.some(({ line: l, half: h }) => {
    if (!h) return false;
    for (let i = 0; i + 3 < l.length; i += 2) {
      const [ax, az, bx, bz] = [l[i]!, l[i + 1]!, l[i + 2]!, l[i + 3]!];
      const [dx, dz] = [bx - ax, bz - az];
      const len2 = dx * dx + dz * dz;
      if (len2 < 1e-9) continue;
      const t = ((x - ax) * dx + (z - az) * dz) / len2;
      if (t < 0 || t > 1) continue;
      const side = (dx * (z - az) - dz * (x - ax)) / Math.sqrt(len2);
      const [left, right] = [h[i]! + (h[i + 2]! - h[i]!) * t, h[i + 1]! + (h[i + 3]! - h[i + 1]!) * t];
      if ((side > 0 && side < left - 0.05) || (side <= 0 && -side < right - 0.05)) return true;
    }
    return false;
  });

describe.skipIf(!decl)(`the probes of the grid ${name ?? ""}`, () => {
  const chunks = decl ? LUBLIN_CHUNKS.filter((c) => decl.chunki.includes(c.id)) : [];

  it("has every chunk of its declaration in the city's tables", () => {
    expect(chunks.map((c) => c.id).sort()).toEqual([...decl!.chunki].sort());
  });

  it("lays no steps on a carriageway (G-963)", () => {
    const streets = LUBLIN_CHUNKS.flatMap((c) => c.streets);
    const found: string[] = [];
    for (const c of chunks)
      for (const g of c.ground) {
        if (g.surface !== "steps" || g.bridge) continue;
        const r = ringOf(g.outline);
        const [xs, zs] = [r.map((p) => p[0]), r.map((p) => p[1])];
        let n = 0;
        for (let x = Math.min(...xs) + 0.125; x < Math.max(...xs); x += 0.25)
          for (let z = Math.min(...zs) + 0.125; z < Math.max(...zs); z += 0.25) if (pointInPairRingEvenOdd(x, z, r) && onCarriageway(streets, x, z)) n++;
        if (n > 0) found.push(`${c.id} ${(n / 16).toFixed(2)} m² przy ${Math.min(...xs).toFixed(0)},${Math.min(...zs).toFixed(0)}`);
      }
    expect(found).toEqual([]);
  });
});
