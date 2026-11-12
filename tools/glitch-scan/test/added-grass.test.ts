import { describe, expect, it } from "vitest";
import { ADDED_AREAS, type AddedArea } from "../../osm-import/src/corrections.ts";
import { COVER } from "../../orto/src/classify.ts";
import { emptyCover } from "../../orto/src/cover.ts";
import { THRESHOLDS } from "../../orto/src/thresholds.ts";
import { GRASS_OFF_GREEN_KNOWN, addedGrassOffGreen, addedPavingOnGreen } from "./added-grass";

/** A 10 × 10 m cover, green on its west half (x < 5) and paving on its east. */
const cover = () => {
  const c = emptyCover("t", { minX: 0, minZ: 0, maxX: 10, maxZ: 10 }, THRESHOLDS);
  c.cls.forEach((_, i) => (c.cls[i] = i % 20 < 10 ? COVER.green : COVER.paving));
  return c;
};

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
    expect(addedPavingOnGreen([area("T-1/kostka", PAVING, 1, 4)], [cover()]).map((f) => f.what)).toEqual(["T-1/kostka: 100% green on the orthophoto"]);
    expect(addedPavingOnGreen([area("T-1/kostka", PAVING, 3, 7)], [cover()])).toHaveLength(1);
    expect(addedPavingOnGreen([area("T-1/kostka", PAVING, 3.5, 7)], [cover()])).toEqual([]);
    expect(addedPavingOnGreen([area("T-1/kostka", PAVING, 6, 9)], [cover()])).toEqual([]);
    expect(addedPavingOnGreen([area("T-1/trawnik", LAWN, 1, 4)], [cover()])).toEqual([]);
    expect(addedPavingOnGreen([area("T-1/kostka", PAVING, 20, 24)], [cover()])).toEqual([]);
  });

  it("lists as known only lawns of ADDED_AREAS, each with its T-NNN entry and a reason", () => {
    const lawns = new Set(ADDED_AREAS.filter((a) => a.tags.landuse === "grass" || a.tags.landuse === "flowerbed").map((a) => a.id));
    for (const [id, why] of Object.entries(GRASS_OFF_GREEN_KNOWN)) {
      expect(lawns.has(id), id).toBe(true);
      expect(why.startsWith(`${id.split("/")[0]}: `), id).toBe(true);
    }
  });
});
