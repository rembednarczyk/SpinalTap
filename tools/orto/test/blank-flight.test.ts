import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type Pt, type Rect } from "../../osm-import/src/geometry.ts";
import { COVER } from "../src/classify.ts";
import { CELLS, FLIGHTS, defaultCache } from "../src/config.ts";
import { classifyRect, emptyCover, readCover } from "../src/cover.ts";
import { leanSection } from "../src/lean.ts";
import { MAP_REGIONS } from "../src/region.ts";
import { THRESHOLDS } from "../src/thresholds.ts";
import { type Tile, blankShare, gridBox, isBlank, loadTile } from "../src/tiles.ts";

const CELL: Rect = { minX: 0, minZ: 0, maxX: 40, maxZ: 40 };
const box = (x0: number, z0: number, x1: number, z1: number): Pt[] => [
  { x: x0, z: z0 },
  { x: x1, z: z0 },
  { x: x1, z: z1 },
  { x: x0, z: z1 },
];

/** A tile of the cell in one colour; `holes` of its pixels transparent. */
const flat = (flight: string, [r, g, b]: readonly [number, number, number], holes = 0): Tile => {
  const bx = gridBox(CELL, 3, 0.25);
  const [width, height] = [Math.round((bx.maxE - bx.minE) / 0.25), Math.round((bx.maxN - bx.minN) / 0.25)];
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0; i < width * height; i++) rgb.set([r, g, b], i * 3);
  const empty = new Uint8Array(width * height).fill(1, 0, Math.round(holes * width * height));
  return { meta: { cell: "t", flight, service: "t", crs: "EPSG:2180", box: bx, width, height, fetched: "2026-11-13" }, rgb, empty };
};

const WHITE = [255, 255, 255] as const;
const classes = (tiles: readonly Tile[]) => {
  const c = emptyCover("t", CELL, THRESHOLDS);
  classifyRect(c, tiles, CELL);
  return new Set(c.cls);
};

describe("a blank flight (G-771)", () => {
  it("is a tile with over 95% of its pixels white or transparent", () => {
    expect(blankShare(flat("a", WHITE))).toBe(1);
    expect(isBlank(flat("a", [254, 255, 255]))).toBe(false);
    expect(isBlank(flat("a", [90, 90, 90], 0.96))).toBe(true);
    expect(isBlank(flat("a", [90, 90, 90], 0.9))).toBe(false);
  });

  it("does not enter the cover: a lawn stays green, not white paving", () => {
    // A lawn of little excess green (0.03 in April, 0.037 in June): a white third flight would bring it under 0.026.
    const lawn = [flat("2025-04", [100, 103, 97]), flat("2024-06", [90, 94, 88])];
    expect(classes(lawn)).toEqual(new Set([COVER.green]));
    expect(classes([...lawn, flat("2023-09", WHITE)])).toEqual(new Set([COVER.green]));
    expect(classes([lawn[0]!, flat("2024-06", WHITE), lawn[1]!])).toEqual(new Set([COVER.green]));
  });

  it("leaves the cell out without the current image: no leaf-off ground to tell crowns from lawns", () => {
    expect(classes([flat("2025-04", WHITE), flat("2024-06", [50, 110, 40])])).toEqual(new Set([COVER.none]));
  });

  it("is not measured for the lean, so it is never the flight leaning least", () => {
    const roofs = [box(4, 4, 16, 12), box(22, 5, 30, 20), box(6, 26, 14, 36), box(20, 28, 36, 34)];
    const dark = flat("2025-04", [60, 60, 60]);
    const s = leanSection(CELL, roofs, [
      { flight: "2025-04", tile: dark },
      { flight: "2023-09", tile: flat("2023-09", WHITE) },
    ]);
    expect(s.flights.map((f) => f.flight)).toEqual(["2025-04"]);
    expect(s.recommended).not.toBe("2023-09");
    expect(s.verdict).toMatch(/pusty nalot 2023-09/);
    expect(leanSection(CELL, roofs, [{ flight: "2023-09", tile: flat("2023-09", WHITE) }]).recommended).toBeUndefined();
  });
});

/**
 * `cover-blank-flight`: the committed covers' tiles that are blank in the cache, as `cell flight`.
 * The tiles stay in the cache outside the repository (ADR-0077), so the check runs where they are.
 */
const cache = defaultCache();
const blankInCovers = (): string[] => {
  const out: string[] = [];
  for (const r of MAP_REGIONS) {
    const used = readCover(r.slug)?.header.tiles ?? [];
    for (const t of used) {
      const cell = CELLS.find((c) => c.id === t.cell);
      const tile = cell && FLIGHTS.some((f) => f.id === t.flight) ? loadTile(cache, t.flight, cell) : undefined;
      if (tile && isBlank(tile)) out.push(`${t.cell} ${t.flight}`);
    }
  }
  return out;
};

describe.skipIf(!existsSync(cache))("cover-blank-flight on the cached orthophoto", () => {
  it("finds no blank tile among the flights a committed cover was made of", { timeout: 120_000 }, () => {
    expect(blankInCovers()).toEqual([]);
  });
});
