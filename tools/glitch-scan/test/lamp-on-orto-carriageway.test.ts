import { describe, expect, it } from "vitest";
import { COVER } from "../../orto/src/classify.ts";
import type { Cover } from "../../orto/src/cover.ts";
import { THRESHOLDS } from "../../orto/src/thresholds.ts";
import { lampOnOrtoCarriageway } from "./lamp-on-orto-carriageway";

describe("a lamp in the orthophoto's carriageway (lamp-on-orto-carriageway, G-821)", () => {
  it("names a lamp on asphalt further than 0.5 m from its edge, not one by the kerb, off the raster or a piece other than a lamp", () => {
    // A 10 x 4 m raster: asphalt x 0..6, paving x 6..10.
    const cls = new Uint8Array(20 * 8).map((_, k) => (k % 20 < 12 ? COVER.asphalt : COVER.paving));
    const cover: Cover = { header: { district: "t", x0: 0, z1: 4, step: 0.5, width: 20, height: 8, classes: [], source: "", tiles: [], thresholds: THRESHOLDS }, cls };
    const at = (prop: string, x: number) => ({ prop, x, y: 0, z: 2, yaw: 0, variant: 0 }) as Parameters<typeof lampOnOrtoCarriageway>[0][number];
    const found = lampOnOrtoCarriageway([at("lamp-road", 3), at("lamp-road", 5.7), at("lamp-park", 8), at("lamp-road", 30), at("bench", 3)], [cover]);
    expect(found.map((f) => f.at)).toEqual(["3,2"]);
  });
});
