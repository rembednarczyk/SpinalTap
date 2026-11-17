import { describe, expect, it } from "vitest";
import { readCover } from "../../orto/src/cover.ts";
import { MAP_REGIONS } from "../../orto/src/region.ts";
import { walkLawnBare } from "../../glitch-scan/test/walk-lawn-bare.ts";
import { generatedAround } from "./city.ts";

describe("the paving of a strip between a pavement and a lawn far from the asphalt (G-902)", () => {
  it("leaves no bare paving between the sidewalk w793299545 and the lawn w804709930 by Ruska in Podzamcze", () => {
    // PZGiK: paving from the sidewalk to the lawn, 5-9 m from Ruska's asphalt. The kerbs' strip of
    // the bare ground rule ended 5 m from it (z 479.5) and the rest, 17 m², was a loose region.
    const covers = MAP_REGIONS.map((r) => readCover(r.slug)).filter((c) => c !== undefined);
    // South-east of the sidewalk's line from (1065, 482.8) to (1074.5, 487.7), north of the kerbs' strip.
    const pocket = (x: number, z: number) => x > 1065 && x < 1074 && z > 479.5 && (1074.5 - 1065) * (z - 482.8) - (487.7 - 482.8) * (x - 1065) < 0;
    const found = walkLawnBare(generatedAround([{ x: 1068, z: 482 }]).chunks, covers).filter((f) => {
      const m = /bare paving (-?[\d.]+),(-?[\d.]+)/.exec(f.what);
      return m !== null && pocket(Number(m[1]), Number(m[2]));
    });
    expect(found.map((f) => f.what)).toEqual([]);
  });
});
