import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { rectsOverlap, ringBounds } from "../../osm-import/src/geometry.ts";
import { mergeOsm, parseExtract } from "../../osm-import/src/osm.ts";
import { structuresOf } from "../../osm-import/src/structures.ts";
import { COVER } from "../src/classify.ts";
import { type Cover, coverAt, readCover } from "../src/cover.ts";
import { COVER_FIXES, applyFixes } from "../src/cover-fixes.ts";
import { THRESHOLDS } from "../src/thresholds.ts";

describe("the cover's corrections checked on the photographs (G-853)", () => {
  it("changes only the samples of its class in its rectangle, in its district", () => {
    const cls = new Uint8Array(16).fill(COVER.green);
    cls[5] = COVER.asphalt;
    const cover: Cover = { header: { district: "t", x0: 0, z1: 2, step: 0.5, width: 4, height: 4, classes: [], source: "", tiles: [], thresholds: THRESHOLDS }, cls };
    const fix = { district: "t", rect: { minX: 0, minZ: 1, maxX: 1, maxZ: 2 }, from: COVER.green, to: COVER.paving, why: "" };
    expect(applyFixes(cover, [fix, { ...fix, district: "u" }])).toBe(3);
    expect([coverAt(cover, 0.25, 1.75), coverAt(cover, 0.75, 1.25), coverAt(cover, 1.25, 1.75), coverAt(cover, 0.25, 0.75)]).toEqual([COVER.paving, COVER.asphalt, COVER.green, COVER.green]);
  });

  it("is in the committed cover: Krakowskie Przedmieście's strip by Brama Krakowska reads as paving, not a lawn", () => {
    const cover = readCover("krakowskie")!;
    const fix = COVER_FIXES[0]!;
    let green = 0;
    for (let x = fix.rect.minX + 0.25; x < fix.rect.maxX; x += 0.5) for (let z = fix.rect.minZ + 0.25; z < fix.rect.maxZ; z += 0.5) if (coverAt(cover, x, z) === COVER.green) green++;
    expect(green).toBe(0);
    expect(applyFixes({ ...cover, cls: cover.cls.slice() })).toBe(0);
  });

  it("corrects no sample on a building site of the map: its ground changes from flight to flight (G-866)", () => {
    const dir = join(import.meta.dirname, "../../../data/osm");
    const osm = mergeOsm(readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => parseExtract(readFileSync(join(dir, f), "utf8"))));
    const sites = structuresOf(osm).filter((s) => s.kind === "construction");
    expect(sites.length).toBeGreaterThan(0);
    const on = COVER_FIXES.flatMap((f, k) => sites.filter((s) => rectsOverlap(ringBounds(s.ring), f.rect)).map((s) => `${k}: ${s.id}`));
    expect(on).toEqual([]);
  });
});
