import { describe, expect, it } from "vitest";
import { STARE_MIASTO_CHUNKS } from "../../../packages/sim/src/content/lublin/stare-miasto.generated.ts";
import { defaultCache } from "../../orto/src/config.ts";
import { pointInRing } from "../../osm-import/src/geometry.ts";
import { generatedCity } from "../../osm-import/test/city.ts";
import { grassOnLightPaving, hasTiles, hueOf, pavedLook } from "./grass-on-light-paving";

/**
 * Lawns laid on paving the orthophoto's leaf-off flight shows green by a colour no lawn has (G-775):
 * in stare-miasto-0-0 and 0-1 one summer flight is blank (G-771), so the other could not outvote a
 * patina leaning onto the setts by the monument on Królewska, nor show beige setts in a building's
 * shade as anything but a lawn. The places are probed on the committed tables; the city over the
 * cached tiles (14.11.2026: 61.5 m² before the fix, 38.25 m² after it, in the cells of two summer
 * flights, which outvote the leaf-off one there, and specks under the bare ground rule's minimum
 * mapping unit).
 */
const MAX_M2 = 40;
const SAMPLE_M2 = 0.25;

/** The places of the report (x0, x1, z0, z1): the monument's setts on Królewska and the corner of Lubartowska and Noworybna. */
const PLACES = { krolewska: [607, 610.5, -212, -207], lubartowska: [476, 480, 75, 82] } as const;

/** The m² of grass the committed tables of Stare Miasto lay in a box, on a 0.25 m grid. */
const grassIn = ([x0, x1, z0, z1]: readonly number[]): number => {
  let n = 0;
  for (let x = x0! + 0.125; x < x1!; x += 0.25)
    for (let z = z0! + 0.125; z < z1!; z += 0.25) {
      let top: string | undefined;
      for (const c of STARE_MIASTO_CHUNKS)
        for (const g of c.ground) {
          const ring = Array.from({ length: g.outline.length >> 1 }, (_, k) => ({ x: g.outline[2 * k]!, z: g.outline[2 * k + 1]! }));
          if (pointInRing({ x, z }, ring)) top = g.surface;
        }
      if (top === "grass") n++;
    }
  return n * 0.0625;
};

describe("lawns on paving the leaf-off flight shows green by a colour no lawn has (grass-on-light-paving, G-775)", () => {
  it("takes patina the summer flight shows grey and beige setts in its shade for paving, not a lawn", () => {
    expect(hueOf([0, 255, 0])).toBe(120);
    // Measured on the cached tiles, 2025-04 first: the monument's patina on Królewska over the setts of 2024-06, and the corner of Lubartowska in 2023-09's shade.
    expect(pavedLook([[109, 130, 126], [155, 153, 149]])).toBe("patina");
    expect(pavedLook([[199, 188, 157], [57, 72, 79]])).toBe("setts");
    // A lawn: fresh and teal in April, green in June; green in April in a summer shade; a tree in blossom over a lawn.
    expect(pavedLook([[100, 133, 129], [103, 115, 97]])).toBeUndefined();
    expect(pavedLook([[93, 114, 77], [41, 51, 60]])).toBeUndefined();
    expect(pavedLook([[195, 194, 173], [66, 88, 85]])).toBeUndefined();
  });

  it("lays no lawn at the places of the report", () => {
    for (const [name, box] of Object.entries(PLACES)) expect(grassIn(box), name).toBe(0);
  });

  describe.skipIf(!hasTiles(defaultCache()))("over the city, on the cached orthophoto", () => {
    it(`lays under ${MAX_M2} m² of them`, { timeout: 120_000 }, () => {
      const found = grassOnLightPaving(generatedCity().stats, defaultCache());
      expect(found.length * SAMPLE_M2, found.slice(0, 20).map((f) => f.what).join("\n")).toBeLessThan(MAX_M2);
    });
  });
});
