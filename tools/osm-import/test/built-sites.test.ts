import { describe, expect, it } from "vitest";
import { KRAKOWSKIE_CHUNKS } from "../../../packages/sim/src/content/lublin/krakowskie.generated.ts";
import { builtSites, finishedSites, withBuiltSites } from "../src/built-sites.ts";
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

describe("builtSites", () => {
  const ring = [
    { x: 0, z: 0 },
    { x: 10, z: 0 },
    { x: 10, z: 10 },
    { x: 0, z: 10 },
  ];
  const site = (tags: Record<string, string>) => ({ id: "w1", osmId: 1, tags: { building: "construction", ...tags } as Record<string, string>, ring, holes: 0 });
  const lod1 = [{ id: "L1", height: 9, ground: 200, ring }];

  it("takes the kind it was built as, `yes` for none", () => {
    expect(builtSites([site({ construction: "retail" })], lod1)[0]!.tags.building).toBe("retail");
    expect(builtSites([site({ construction: "yes" }), site({})], lod1).map((a) => a.tags.building)).toEqual(["yes", "yes"]);
  });

  it("finishes the site's land round it with the same construction=*, not another site's", () => {
    const big = [
      { x: -20, z: -20 },
      { x: 30, z: -20 },
      { x: 30, z: 30 },
      { x: -20, z: 30 },
    ];
    const land = (id: string, construction: string) => ({ id, osmId: 2, tags: { landuse: "construction", construction, name: "Budowa" } as Record<string, string>, ring: big, holes: 0 });
    const out = builtSites([site({ construction: "commercial" }), land("w2", "commercial"), land("w3", "residential")], lod1);
    expect(out.map((a) => a.tags)).toEqual([{ building: "commercial", construction: "commercial" }, { name: "Budowa" }, { landuse: "construction", construction: "residential", name: "Budowa" }]);
    expect(builtSites([site({ construction: "commercial" }), land("w2", "commercial")], undefined)[1]!.tags.landuse).toBe("construction");
  });

  it("keeps a site LoD1 does not match one to one, and every site without LoD1", () => {
    const off = [{ id: "L1", height: 9, ground: 200, ring: ring.map((p) => ({ x: p.x + 5, z: p.z })) }];
    expect(builtSites([site({})], off)[0]!.tags.building).toBe("construction");
    expect(builtSites([site({})], undefined)[0]!.tags.building).toBe("construction");
  });
});

describe("the map caught up (G-872)", () => {
  const map = withBuiltSites(inputs.osm, inputs.lod1);

  it("tags Karmelicka 7 commercial and its site's land w1261814241 no site; Zielona 5A stays a site", () => {
    expect(map.ways.get(1134342880)?.tags?.building).toBe("commercial");
    expect(map.ways.get(1261814241)?.tags?.landuse).toBeUndefined();
    expect(inputs.osm.ways.get(1261814241)?.tags?.landuse).toBe("construction");
    expect(map.ways.get(1382552286)?.tags?.building).toBe("construction");
    expect(map.ways.get(770678456)?.tags?.landuse).toBe("construction");
  });

  it("gives the cover the finished land only", () => {
    expect(finishedSites(inputs.osm, inputs.lod1)).toHaveLength(1);
    expect(finishedSites(inputs.osm, undefined)).toEqual([]);
  });
});
