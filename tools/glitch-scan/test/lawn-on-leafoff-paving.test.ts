import { describe, expect, it } from "vitest";
import { COVER } from "../../orto/src/classify.ts";
import { type Cover, coverFor, readCover } from "../../orto/src/cover.ts";
import { MAP_REGIONS } from "../../orto/src/region.ts";
import { samplesIn } from "../../orto/src/rings.ts";
import { THRESHOLDS } from "../../orto/src/thresholds.ts";
import { generatedCity } from "../../osm-import/test/city.ts";
import { type ChunkFills, lawnOnLeafOffPaving } from "./fill-on-green";

/**
 * Lawns the bare ground rule lays on paving under crowns (G-764, T-287): the curator's review of
 * ADR-0077 step 1.2 found 474-670 m² of them, the leaf-off flight 2025-04 showing light paving under
 * the trees (619 m² on the classifier's `canopyHard`). What is left is under the rule's minimum
 * mapping unit (`FILL.speck`, 2 m²): specks of paving in a lawn, 71.5 m² over the city (13.11.2026),
 * as specks of open paving in lawns are.
 */
const MAX_M2 = 80;
const SAMPLE_M2 = 0.25;

/** The curator's places (x0, x1, z0, z1): pavements under trees, and shrubs and a hedge (and the m² of lawn) that stay lawns. */
const PAVED = { vivo: [1088, 1097, 163, 204], furmanska: [640, 652, 251, 263], krakowskie: [294, 301, -220, -211], nabrzeze: [2688, 2695, 211, 226] } as const;
const GREEN = { "nabrzeze shrubs": [2500, 2534, 107, 139, 600], "podzamcze hedge": [551, 569, 353, 359, 35] } as const;

const inBox = (what: string, [x0, x1, z0, z1]: readonly number[]) => {
  const [x, z] = what.split(" ").at(-1)!.split(",").map(Number) as [number, number];
  return x >= x0! && x <= x1! && z >= z0! && z <= z1!;
};

/** The m² of `surface` the rule laid in a box. */
const laidIn = (chunks: readonly ChunkFills[], covers: readonly Cover[], surface: string, [x0, x1, z0, z1]: readonly number[]): number => {
  let n = 0;
  for (const c of chunks)
    for (const f of c.fills) {
      if (f.surface !== surface) continue;
      const ring = Array.from({ length: f.outline.length >> 1 }, (_, k) => ({ x: f.outline[2 * k]!, z: f.outline[2 * k + 1]! }));
      const cover = coverFor(covers, ring[0]!);
      if (!cover) continue;
      const h = cover.header;
      for (const k of samplesIn(h, ring)) {
        const [x, z] = [h.x0 + ((k % h.width) + 0.5) * h.step, h.z1 - (Math.floor(k / h.width) + 0.5) * h.step];
        if (x >= x0! && x <= x1! && z >= z0! && z <= z1!) n++;
      }
    }
  return n * SAMPLE_M2;
};

describe("lawns the bare ground rule lays on paving under crowns (lawn-on-leafoff-paving, G-764)", () => {
  it("names each sample of paving under crowns under a laid lawn, and none under laid paving", () => {
    const cover: Cover = {
      header: { district: "t", x0: 0, z1: 1, step: 0.5, width: 4, height: 2, classes: [], source: "", tiles: [], thresholds: THRESHOLDS },
      cls: Uint8Array.from({ length: 8 }, (_, k) => (k % 4 === 0 ? COVER.canopyHard : k % 4 === 1 ? COVER.canopy : COVER.green)),
    };
    const lawn = [0, 0, 2, 0, 2, 0.5, 0, 0.5];
    const found = lawnOnLeafOffPaving([{ id: "c", fills: [{ surface: "grass", outline: lawn }, { surface: "square", outline: [0, 0.5, 1, 0.5, 1, 1, 0, 1] }] }], [cover]);
    expect(found.map((f) => f.what)).toEqual(["c: lawn on leaf-off paving 0.25,0.25"]);
  });

  describe("over the city", () => {
    const chunks = generatedCity().stats;
    const covers = MAP_REGIONS.map((r) => readCover(r.slug)).filter((c) => c !== undefined);
    const found = lawnOnLeafOffPaving(chunks, covers);

    it(`lays under ${MAX_M2} m² of them`, () => {
      expect(found.length * SAMPLE_M2).toBeLessThan(MAX_M2);
    });

    it("lays none at the curator's pavements under trees", () => {
      for (const [name, box] of Object.entries(PAVED)) expect(found.filter((f) => inBox(f.what, box)).length * SAMPLE_M2, name).toBeLessThan(1);
    });

    it("keeps the shrubs and the hedge lawns", () => {
      for (const [name, [x0, x1, z0, z1, m2]] of Object.entries(GREEN)) expect(laidIn(chunks, covers, "grass", [x0, x1, z0, z1]), name).toBeGreaterThan(m2);
    });
  });
});
