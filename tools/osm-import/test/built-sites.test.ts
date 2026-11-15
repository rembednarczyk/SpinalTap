import { describe, expect, it } from "vitest";
import { KRAKOWSKIE_CHUNKS } from "../../../packages/sim/src/content/lublin/krakowskie.generated.ts";
import { DISTRICTS } from "../src/config.ts";
import { extractFeatures } from "../src/features.ts";
import { generate } from "../src/generate.ts";
import { loadInputs } from "../src/load.ts";
import { lod1Index, lod1Match } from "../src/lod1-heights.ts";

/** A building site of the map that LoD1 2024 shows standing is a building (G-872, T-317). */

const inputs = loadInputs();
const areas = extractFeatures(inputs.osm).areas;
const around = (x: number, z: number) => [{ id: "test-0-0", district: DISTRICTS[0]!, rect: { minX: x - 30, minZ: z - 30, maxX: x + 30, maxZ: z + 30 } }];
const built = (id: string, x: number, z: number, lod1?: typeof inputs.lod1) =>
  generate(inputs.osm, inputs.src, around(x, z), undefined, lod1).chunks[0]!.buildings.find((b) => b.id === id);

describe("building=construction (G-872)", () => {
  it("Karmelicka 7, finished under LoD1 2024, stands at its LoD1 height as the building it was built for", () => {
    expect(areas.find((a) => a.id === "w1134342880")?.tags.building).toBe("construction");
    const m = lod1Match(lod1Index(inputs.lod1), areas.find((a) => a.id === "w1134342880")!.ring)!.lod1.height;
    const b = built("w1134342880", 323, 77, inputs.lod1)!;
    expect(b.source).toBe("lod1");
    expect(b.use).toBe("commercial");
    expect(b.height + (b.roof ?? 0) / 2).toBeCloseTo(m, 0);
    expect(KRAKOWSKIE_CHUNKS.flatMap((c) => c.buildings).find((g) => g.id === "w1134342880")?.source).toBe("lod1");
  });

  it("a site LoD1 does not show, and any site without LoD1, stays bare (Zielona 5A: a dig)", () => {
    expect(areas.find((a) => a.id === "w1382552286")?.tags.building).toBe("construction");
    expect(built("w1382552286", 251, 24, inputs.lod1)).toBeUndefined();
    expect(built("w1134342880", 323, 77)).toBeUndefined();
  });
});
