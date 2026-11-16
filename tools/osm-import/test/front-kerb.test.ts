import { describe, expect, it } from "vitest";
import { DISTRICTS } from "../src/config.ts";
import { generate } from "../src/generate.ts";
import { type Pt, pointInRing } from "../src/geometry.ts";
import { loadInputs } from "../src/load.ts";

describe("a pedestrian street's frontage by a carriageway's kerb", () => {
  const inputs = loadInputs();
  const chunk = (id: string, d: number, x: number, z: number) => ({ id, district: DISTRICTS[d]!, rect: { minX: x - 40, minZ: z - 40, maxX: x + 40, maxZ: z + 40 } });
  // The strip between the path and the car park south of Karmelicka, and Królewska's south kerb by the cathedral.
  const ground = generate(inputs.osm, () => 190, [chunk("karmelicka", 0, 345, 75), chunk("krolewska", 1, 577, -213)], undefined, undefined, undefined, inputs.covers)
    .chunks.flatMap((c) => c.ground)
    .map((g) => ({ surface: g.surface, ring: Array.from({ length: g.outline.length / 2 }, (_, i) => ({ x: g.outline[2 * i]!, z: g.outline[2 * i + 1]! })) }));
  const surface = (p: Pt) => {
    const s = ground.filter((g) => pointInRing(p, g.ring)).map((g) => g.surface);
    return s.length === 1 ? s[0]! : "other";
  };
  // The ground 0.3 m past the carriageway's edge, met walking off it from `from` by `step`.
  const pastKerb = (from: Pt, step: Pt) => {
    let p = from;
    for (let k = 0; k < 400 && surface(p) === "road"; k++) p = { x: p.x + step.x, z: p.z + step.z };
    const len = Math.hypot(step.x, step.z);
    return surface({ x: p.x + (step.x / len) * 0.25, z: p.z + (step.z / len) * 0.25 });
  };
  // Runs under 5 m of grass or square, 0.5 m a sample, with the other of the two on both sides, as `kerb-fill-flicker` reads them.
  const flicker = (strip: readonly string[]) => {
    const runs: { kind: string; n: number }[] = [];
    for (const s of strip) {
      const last = runs[runs.length - 1];
      if (last?.kind === s) last.n++;
      else runs.push({ kind: s, n: 1 });
    }
    return runs.filter((r, i) => i > 0 && i + 1 < runs.length && r.n * 0.5 < 5 && r.kind !== "other" && runs[i - 1]!.kind === runs[i + 1]!.kind && runs[i - 1]!.kind !== r.kind && runs[i - 1]!.kind !== "other");
  };
  const along = (a: number, b: number) => Array.from({ length: Math.floor((b - a) / 0.5) + 1 }, (_, k) => a + k * 0.5);

  it("lays one surface along the kerb, not the cover's crowns and paving by turns", () => {
    // PZGiK: crowns over the strip by the car park, the map's paths and lawns round them; on
    // Królewska crowns over the asphalt of its south kerb. Laid by the frontage cell by cell, the
    // strip went grass and square by turns (1.5, 1.5, 0.5 m of square in grass by the car park; 4 m
    // and 0.5 m of grass in square on Królewska, G-825 after #599's frontages).
    const karmelicka = flicker(along(60, 84).map((z) => pastKerb({ x: 355, z }, { x: -0.05, z: 0 })));
    const krolewska = flicker(along(563, 592).map((x) => pastKerb({ x, z: -210 }, { x: 0, z: -0.05 })));
    expect({ karmelicka, krolewska }).toEqual({ karmelicka: [], krolewska: [] });
  });
});
