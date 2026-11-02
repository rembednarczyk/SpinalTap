import { describe, expect, it } from "vitest";
import {
  DECAL_KINDS,
  GRAFFITI_MAX_LIFT,
  PLATE_MAX_LIFT,
  STICKER_HOSTS,
  WALL_DECALS,
  grateLayout,
  grateVariant,
  graffitiLayout,
  graffitiVariant,
  hostFace,
  hostFaces,
  parseHouseNumber,
  plateLayout,
  plateVariant,
  stickerLayout,
  stickerVariant,
} from "../src/world/decals";

/** The decals' variants (ADR-0058 stage 6): what the importer packs, the renderer and the glitch scan read back. */
describe("decal layouts", () => {
  it("packs and reads back graffiti, plates, stickers and grates, to their steps and in their ranges", () => {
    expect(graffitiLayout(graffitiVariant({ design: 5, width: 2.34, height: 1.06, lift: 12.36 }))).toEqual({ design: 5, width: 2.3, height: 1.1, lift: 12.4 });
    expect(graffitiLayout(graffitiVariant({ design: 9, width: 99, height: -1, lift: 99 }))).toEqual({ design: 1, width: 6.3, height: 0, lift: 51.1 });
    expect(plateLayout(plateVariant({ number: 128, letter: 2, lift: 2.2 }))).toEqual({ number: 128, letter: 2, lift: 2.2 });
    expect(plateLayout(plateVariant({ number: 5000, letter: 0, lift: 9 })).number).toBe(999);
    expect(stickerLayout(stickerVariant({ design: 7, host: 4, face: 3, lift: 0.6 }))).toEqual({ design: 7, host: 4, face: 3, lift: 0.6 });
    expect(grateLayout(grateVariant({ casting: 1, slopeX: -0.084, slopeZ: 0.31 }))).toEqual({ casting: 1, slopeX: -0.08, slopeZ: 0.15 });
    expect(grateLayout(grateVariant({ casting: 0, slopeX: 0, slopeZ: -0.5 }))).toEqual({ casting: 0, slopeX: 0, slopeZ: -0.15 });
    // Every variant stays a positive integer under 2^31 (the table's JSON, the 32-bit shifts).
    for (const v of [
      graffitiVariant({ design: 7, width: 6.3, height: 6.3, lift: 51.1 }),
      plateVariant({ number: 999, letter: 31, lift: 6.3 }),
      stickerVariant({ design: 7, host: 7, face: 15, lift: 3.1 }),
    ]) {
      expect(Number.isInteger(v) && v >= 0 && v < 2 ** 31).toBe(true);
    }
  });

  it("holds the highest lifts it names and graffiti on the plinth band", () => {
    expect(graffitiLayout(graffitiVariant({ design: 2, width: 1, height: 0.5, lift: GRAFFITI_MAX_LIFT })).lift).toBe(GRAFFITI_MAX_LIFT);
    expect(plateLayout(plateVariant({ number: 1, letter: 0, lift: PLATE_MAX_LIFT })).lift).toBe(PLATE_MAX_LIFT);
    expect(plateLayout(plateVariant({ number: 1, letter: 0, lift: PLATE_MAX_LIFT + 1 })).lift).toBe(PLATE_MAX_LIFT);
    const banded = graffitiVariant({ design: 7, width: 6.3, height: 6.3, lift: GRAFFITI_MAX_LIFT, band: true });
    expect(graffitiLayout(banded)).toEqual({ design: 7, width: 6.3, height: 6.3, lift: GRAFFITI_MAX_LIFT, band: true });
    expect(Number.isInteger(banded) && banded > 0 && banded < 2 ** 31).toBe(true);
    expect(graffitiLayout(graffitiVariant({ design: 7, width: 1, height: 1, lift: 1 })).band).toBeUndefined();
  });

  it("reads the map's house numbers: the first number and its letter, none without a number", () => {
    expect(parseHouseNumber("12")).toEqual({ number: 12, letter: 0 });
    expect(parseHouseNumber("12A")).toEqual({ number: 12, letter: 1 });
    expect(parseHouseNumber(" 5b/7")).toEqual({ number: 5, letter: 2 });
    expect(parseHouseNumber("12-14")).toEqual({ number: 12, letter: 0 });
    expect(parseHouseNumber("3ab")).toBeNull();
    expect(parseHouseNumber("0")).toBeNull();
    expect(parseHouseNumber("bez numeru")).toBeNull();
    expect(parseHouseNumber(undefined)).toBeNull();
  });

  it("knows the decal kinds and the faces of the stickers' hosts", () => {
    expect([...WALL_DECALS].every((k) => DECAL_KINDS.has(k))).toBe(true);
    const modern = STICKER_HOSTS[0]!;
    expect(hostFaces(modern)).toEqual([0, 1, 3]);
    expect(hostFace(modern, 1, 1.5)).toEqual({ nx: -1, nz: 0, out: 0.07 });
    expect(hostFace(modern, 3, 1.5)).toEqual({ nx: 0, nz: -1, out: 0.07 });
    const road = STICKER_HOSTS[1]!;
    expect(hostFaces(road)).toHaveLength(8);
    // An octagon's apothem, tapering up the shaft.
    const low = hostFace(road, 0, 0.3);
    expect(low.out).toBeCloseTo(0.11 * Math.cos(Math.PI / 8), 6);
    expect(Math.atan2(low.nz, low.nx)).toBeCloseTo(Math.PI / 8, 6);
    expect(hostFace(road, 0, 8.5).out).toBeCloseTo(0.07 * Math.cos(Math.PI / 8), 6);
  });
});
