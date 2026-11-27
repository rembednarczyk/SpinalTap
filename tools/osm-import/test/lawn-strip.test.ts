import { describe, expect, it } from "vitest";
import { readCover } from "../../orto/src/cover.ts";
import { MAP_REGIONS } from "../../orto/src/region.ts";
import { walkLawnBare } from "../../glitch-scan/test/walk-lawn-bare.ts";
import { pointInRing } from "../src/geometry.ts";
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

describe("the lawns snapped to the walks a pass of their own (the curator's review of #1087)", () => {
  // Snapped in the rule's first pass, a lawn at a walk's edge cut the frontages' zones off their
  // walks in the second, and their paving went: 135 m² on the castle's slope between Plac Zamkowy
  // and Al. Tysiąclecia, 15 m² round the lawn by Plac Wolności. As much paving there as before.
  const pavingIn = (chunks: ReturnType<typeof generatedAround>["chunks"], id: string, x0: number, x1: number, z0: number, z1: number) => {
    const c = chunks.find((k) => k.id === id)!;
    const rings = c.ground.filter((g) => g.surface === "square").map((g) => Array.from({ length: g.outline.length / 2 }, (_, i) => ({ x: g.outline[2 * i]!, z: g.outline[2 * i + 1]! })));
    let n = 0;
    for (let x = x0 + 0.125; x < x1; x += 0.25) for (let z = z0 + 0.125; z < z1; z += 0.25) if (rings.some((r) => pointInRing({ x, z }, r))) n++;
    return n * 0.0625;
  };
  it("leaves the paving of the castle's slope and of Plac Wolności's lawn as it was", () => {
    expect(pavingIn(generatedAround([{ x: 810, z: 307 }]).chunks, "podzamcze-1-0", 750, 870, 300, 315)).toBeGreaterThan(135);
    expect(pavingIn(generatedAround([{ x: 345, z: -195 }]).chunks, "krakowskie-2-0", 337, 354, -198, -193)).toBeGreaterThan(13);
  });
});
