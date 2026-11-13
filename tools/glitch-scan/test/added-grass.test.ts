import { describe, expect, it } from "vitest";
import { ADDED_AREAS, type AddedArea } from "../../osm-import/src/corrections.ts";
import { COVER } from "../../orto/src/classify.ts";
import { emptyCover, readCover } from "../../orto/src/cover.ts";
import { ringCounts } from "../../orto/src/overlay.ts";
import { MAP_REGIONS } from "../../orto/src/region.ts";
import { share } from "../../orto/src/rings.ts";
import { THRESHOLDS } from "../../orto/src/thresholds.ts";
import { loadOsm, truthAreas } from "../../orto/src/truth.ts";
import { GRASS_OFF_GREEN_KNOWN, MIN_GREEN, PAVING_ON_GREEN_KNOWN, addedGrassOffGreen, addedPavingOnGreen } from "./added-grass";

/** A 10 × 10 m cover, `west` on its west half (x < 5: green also on the leaf-off flight by default) and paving on its east. */
const cover = (west: number = COVER.green) => {
  const c = emptyCover("t", { minX: 0, minZ: 0, maxX: 10, maxZ: 10 }, THRESHOLDS);
  c.cls.forEach((_, i) => (c.cls[i] = i % 20 < 10 ? west : COVER.paving));
  return c;
};

const COVERS = MAP_REGIONS.map((r) => readCover(r.slug)).filter((c) => c !== undefined);

const area = (id: string, tags: AddedArea["tags"], x0: number, x1: number): AddedArea => ({
  id,
  tags,
  ring: [{ x: x0, z: 2 }, { x: x1, z: 2 }, { x: x1, z: 8 }, { x: x0, z: 8 }],
  nodesOf: [null, null, null, null],
  reason: "",
  ref: "",
});

const LAWN = { landuse: "grass" };
const PAVING = { "area:highway": "pedestrian", surface: "paving_stones" };

describe("added-grass-off-green and added-paving-on-green (G-627, G-670)", () => {
  it("finds a lawn on paving unless it is listed as known, and keeps one on the green", () => {
    const onPaving = area("T-1/trawnik", LAWN, 6, 9);
    expect(addedGrassOffGreen([onPaving], [cover()], {}).map((f) => f.what)).toEqual(["T-1/trawnik: 0% green on the orthophoto"]);
    expect(addedGrassOffGreen([onPaving], [cover()], { "T-1/trawnik": "T-1: on purpose" })).toEqual([]);
    expect(addedGrassOffGreen([onPaving], [cover()], { "T-1/inny": "T-1: on purpose" })).toHaveLength(1);
    expect(addedGrassOffGreen([area("T-1/trawnik", LAWN, 1, 4)], [cover()], {})).toEqual([]);
    expect(addedGrassOffGreen([area("T-1/trawnik", LAWN, 20, 24)], [cover()], {})).toEqual([]);
  });

  it("finds paving with half of it or more green, and keeps paving on paving and lawns out", () => {
    expect(addedPavingOnGreen([area("T-1/kostka", PAVING, 1, 4)], [cover()], {}).map((f) => f.what)).toEqual(["T-1/kostka: 100% green on the orthophoto"]);
    expect(addedPavingOnGreen([area("T-1/kostka", PAVING, 3, 7)], [cover()], {})).toHaveLength(1);
    expect(addedPavingOnGreen([area("T-1/kostka", PAVING, 3.5, 7)], [cover()], {})).toEqual([]);
    expect(addedPavingOnGreen([area("T-1/kostka", PAVING, 6, 9)], [cover()], {})).toEqual([]);
    expect(addedPavingOnGreen([area("T-1/trawnik", LAWN, 1, 4)], [cover()], {})).toEqual([]);
    expect(addedPavingOnGreen([area("T-1/kostka", PAVING, 20, 24)], [cover()], {})).toEqual([]);
    expect(addedPavingOnGreen([area("T-1/kostka", PAVING, 1, 4)], [cover()], { "T-1/kostka": "T-1: crowns" })).toEqual([]);
    expect(addedPavingOnGreen([area("T-1/kostka", PAVING, 1, 4)], [cover()], { "T-1/inna": "T-1: crowns" })).toHaveLength(1);
  });

  it("takes green only under crowns for a lawn, and not for paving: no green on the leaf-off flight (G-672)", () => {
    expect(addedGrassOffGreen([area("T-1/trawnik", LAWN, 1, 4)], [cover(COVER.canopy)], {})).toEqual([]);
    expect(addedPavingOnGreen([area("T-1/kostka", PAVING, 1, 4)], [cover(COVER.canopy)], {})).toEqual([]);
    const mixed = cover(COVER.canopy);
    mixed.cls.forEach((v, i) => (mixed.cls[i] = v === COVER.canopy && Math.floor(i / 20) % 4 === 0 ? COVER.green : v));
    expect(addedPavingOnGreen([area("T-1/kostka", PAVING, 1, 4)], [mixed], {})).toHaveLength(1);
  });

  it("counts no paving under the crowns by Ruska and Zana as on green: grey on the leaf-off flight 2025-04 (G-672)", () => {
    const crowns = ADDED_AREAS.filter((a) => ["T-246/ruska-b", "T-245/zn2-wschod-trawnik"].includes(a.id));
    expect(crowns).toHaveLength(2);
    expect(addedPavingOnGreen(crowns, COVERS, {})).toEqual([]);
  });

  it("still counts paving laid over the map's lawns as on green (G-672)", () => {
    const lawns = truthAreas(loadOsm()).filter((a) => a.kind === "lawn");
    const asPaving = lawns.map((a) => ({ id: a.id, tags: PAVING, ring: a.ring, nodesOf: a.ring.map(() => null), reason: "", ref: "" }));
    // Out of the lawns the summer flights see green; those under trees all along stay out (83% counted, 12.11.2026).
    const summerGreen = asPaving.filter((a) => {
      const n = ringCounts(COVERS, a.ring);
      return n !== undefined && share(n, ["green", "canopy"]) >= MIN_GREEN;
    });
    expect(summerGreen.length).toBeGreaterThan(200);
    expect(addedPavingOnGreen(summerGreen, COVERS, {}).length / summerGreen.length).toBeGreaterThanOrEqual(0.8);
  });

  const listedIn = (known: Readonly<Record<string, string>>, of: (a: AddedArea) => boolean) => {
    const ids = new Set(ADDED_AREAS.filter(of).map((a) => a.id));
    for (const [id, why] of Object.entries(known)) {
      expect(ids.has(id), id).toBe(true);
      expect(why.startsWith(`${id.split("/")[0]}: `), id).toBe(true);
    }
  };

  it("lists as known only lawns of ADDED_AREAS, each with its T-NNN entry and a reason", () => {
    listedIn(GRASS_OFF_GREEN_KNOWN, (a) => a.tags.landuse === "grass" || a.tags.landuse === "flowerbed");
  });

  it("lists as known only paving of ADDED_AREAS, each with its T-NNN entry and a reason", () => {
    listedIn(PAVING_ON_GREEN_KNOWN, (a) => a.tags["area:highway"] !== undefined);
  });
});
