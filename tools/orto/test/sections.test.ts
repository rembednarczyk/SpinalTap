import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type Pt, type Rect } from "../../osm-import/src/geometry.ts";
import { puwgFrame } from "../../osm-import/src/project.ts";
import { absentSection } from "../src/absent.ts";
import { partsSection } from "../src/bare-parts.ts";
import { cellById, defaultCache } from "../src/config.ts";
import { coverFor, readCover } from "../src/cover.ts";
import { fitSection } from "../src/fit.ts";
import { bestOverlap, components, depthOf, gridOver, opening, rectMask, ringMask } from "../src/grid.ts";
import { type Registers, knownSection, placesIn, readRegisters, refsInText } from "../src/known.ts";
import { leanSection } from "../src/lean.ts";
import { MAP_REGIONS } from "../src/region.ts";
import { cellSections } from "../src/sections.ts";
import { THRESHOLDS } from "../src/thresholds.ts";
import { type Tile, gridBox } from "../src/tiles.ts";

const box = (x0: number, z0: number, x1: number, z1: number): Pt[] => [
  { x: x0, z: z0 },
  { x: x1, z: z0 },
  { x: x1, z: z1 },
  { x: x0, z: z1 },
];
const moved = (r: readonly Pt[], dx: number, dz: number) => r.map((p) => ({ x: p.x + dx, z: p.z + dz }));
const inRing = (r: readonly Pt[], x: number, z: number) => {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) if (r[i]!.z > z !== r[j]!.z > z && x < ((r[j]!.x - r[i]!.x) * (z - r[i]!.z)) / (r[j]!.z - r[i]!.z) + r[i]!.x) c = !c;
  return c;
};

/** Houses on a 60 × 60 m cell, of different sizes so no shift but the true one fits. */
const CELL: Rect = { minX: 0, minZ: 0, maxX: 60, maxZ: 60 };
const HOUSES = [box(5, 5, 17, 13), box(25, 4, 33, 20), box(40, 8, 55, 15), box(6, 30, 14, 50), box(22, 34, 38, 42), box(44, 28, 52, 54)];

/** A photograph of the cell whose roofs lie at the footprints + (dx, dz): bright roofs on dark ground. */
const photo = (dx: number, dz: number): Tile => {
  const b = gridBox(CELL, 3, 0.25);
  const [width, height] = [Math.round((b.maxE - b.minE) / 0.25), Math.round((b.maxN - b.minN) / 0.25)];
  const f = puwgFrame();
  const g = (f.gammaDeg * Math.PI) / 180;
  const rgb = new Uint8Array(width * height * 3).fill(60);
  for (let row = 0; row < height; row++)
    for (let col = 0; col < width; col++) {
      const [de, dn] = [(b.minE + (col + 0.5) * 0.25 - f.origin.e) / f.scale, (b.maxN - (row + 0.5) * 0.25 - f.origin.n) / f.scale];
      const [x, z] = [Math.cos(g) * de + Math.sin(g) * dn, -Math.sin(g) * de + Math.cos(g) * dn];
      if (HOUSES.some((h) => inRing(h, x - dx, z - dz))) rgb.fill(200, (row * width + col) * 3, (row * width + col) * 3 + 3);
    }
  const meta = { cell: "t", flight: "t", service: "t", crs: "EPSG:2180" as const, box: b, width, height, fetched: "2026-11-12" };
  return { meta, rgb, empty: new Uint8Array(width * height) };
};

describe("the cell report's sections on made-up cells", () => {
  it("finds a mask shifted by a known vector, and opens away a thin strip", () => {
    const g = gridOver(CELL, 0.5, 8);
    const a = ringMask(g, HOUSES);
    const b = ringMask(g, HOUSES.map((h) => moved(h, 2, -1.5)));
    const r = bestOverlap(g, a, b, rectMask(g, CELL), 4);
    expect(r.best).toEqual({ dx: 2, dz: -1.5, iou: 1 });
    expect(r.zero).toBeLessThan(0.7);
    // A 10 × 10 m square with a 0.5 m tail: the opening by 1 m keeps the square, drops the tail.
    const m = ringMask(g, [box(10, 10, 20, 20), box(20, 14.5, 30, 15)]);
    const parts = components(g, opening(g, m, 2));
    expect(parts.map((p) => p.length)).toEqual([400]);
    expect(depthOf(g, parts[0]!)).toBe(10);
  });

  it("pairs footprints moved as a whole and reports the shift", () => {
    const game = HOUSES.map((ring, i) => ({ id: `g${i}`, ring }));
    const lod2 = HOUSES.map((ring, i) => ({ id: `l${i}`, ring: moved(ring, 3, 0) }));
    const s = fitSection(CELL, game, lod2);
    expect(s.best).toMatchObject({ dx: 3, dz: 0 });
    expect(s.best.iou).toBeGreaterThan(0.95);
    expect(s.pairs).toMatchObject({ count: 6, of: 6, medianDx: 3, medianDz: 0 });
    expect(s.verdict).toMatch(/przesunięcie/);
    expect(fitSection(CELL, game, HOUSES.map((ring, i) => ({ id: `l${i}`, ring }))).verdict).toMatch(/zgodne/);
  });

  it("measures each flight's lean and recommends the one leaning least", () => {
    const s = leanSection(CELL, HOUSES, [
      { flight: "a", tile: photo(4, 3) },
      { flight: "b", tile: photo(1, -2) },
    ]);
    // Lines and the gradient are drawn on whole 0.25 m samples: within one sample (diagonal) of the truth.
    const off = (f: string, dx: number, dz: number) => {
      const l = s.flights.find((x) => x.flight === f)!;
      return Math.hypot(l.dx - dx, l.dz - dz);
    };
    expect(off("a", 4, 3)).toBeLessThanOrEqual(0.36);
    expect(off("b", 1, -2)).toBeLessThanOrEqual(0.36);
    expect(s.recommended).toBe("b");
    expect(leanSection(CELL, HOUSES.slice(0, 1), [{ flight: "a", tile: photo(0, 0) }]).recommended).toBeUndefined();
    expect(leanSection(CELL, HOUSES, []).verdict).toMatch(/brak kafli/);
  });

  it("classes a yard among walls, a frontage on a street and a gap by the carriageway", () => {
    const rect: Rect = { minX: 0, minZ: 0, maxX: 100, maxZ: 60 };
    // A block round a 20 × 20 m yard; north of it a 4 m frontage, a sidewalk and the carriageway.
    const block = [box(10, 10, 40, 15), box(10, 35, 40, 40), box(10, 15, 15, 35), box(35, 15, 40, 35)];
    const pieces = [
      { surface: "sidewalk", ring: box(0, 44, 100, 47) },
      { surface: "road", ring: box(0, 47, 100, 54) },
      // East of the block: a carriageway with a 5 m strip of bare ground and then a sidewalk.
      { surface: "road", ring: box(60, 0, 67, 44) },
      { surface: "sidewalk", ring: box(72, 0, 75, 44) },
      { surface: "grass", ring: box(0, 0, 10, 44) },
      { surface: "grass", ring: box(40, 0, 60, 44) },
      { surface: "grass", ring: box(75, 0, 100, 44) },
      { surface: "grass", ring: box(10, 0, 40, 10) },
      { surface: "grass", ring: box(0, 54, 100, 60) },
    ];
    const s = partsSection({ rect, buildings: block, pieces, carParks: [], lod2: [], thresholds: THRESHOLDS });
    const byClass = Object.fromEntries(s.parts.map((p) => [p.cls, p]));
    expect(byClass.yard).toMatchObject({ m2: 400, walls: 100, box: { minX: 15, maxX: 35, minZ: 15, maxZ: 35 } });
    expect(byClass.frontage).toMatchObject({ m2: 120, box: { minX: 10, maxX: 40, minZ: 40, maxZ: 44 } });
    expect(byClass.gap).toMatchObject({ m2: 220, width: 5, road: 45 });
    expect(s.classes.yard.count).toBe(1);
    // The same yard under a LoD2 roof is a building the game may lack.
    expect(partsSection({ rect, buildings: block, pieces, carParks: [], lod2: [box(15, 15, 35, 35)], thresholds: THRESHOLDS }).classes.lod2.m2).toBe(400);
  });

  it("lists the LoD2 buildings the game lacks that LoD1 2024 still has", () => {
    const lod2 = [
      { id: "standing", ring: box(10, 10, 20, 20), eaves: 6, ridge: 9 },
      { id: "gone", ring: box(30, 10, 40, 20) },
      { id: "in-game", ring: box(10, 30, 20, 40) },
      { id: "cleared", ring: box(30, 30, 40, 40) },
      { id: "small", ring: box(50, 50, 54, 54) },
    ];
    const lod1 = [box(10, 10, 20, 20), box(30, 30, 40, 40), box(50, 50, 54, 54)].map((ring) => ({ ring, height: 7.5 }));
    const s = absentSection(CELL, lod2, lod1, [box(10, 30, 20, 40)], [{ minX: 29, minZ: 29, maxX: 41, maxZ: 41 }]);
    expect(s.standing.map((b) => [b.id, b.m2, b.lod1, b.lod1Height, b.eaves])).toEqual([["standing", 100, 100, 7.5, 6]]);
    expect(s.gone).toEqual({ count: 1, m2: 100 });
    expect(s.nmpt).toMatch(/NMPT/);
  });

  it("links the scan's kinds to the glitches and T rows anywhere in the registers, the cell's first", () => {
    const rect: Rect = { minX: 610, maxX: 760, minZ: -240, maxZ: -40 };
    const note = "trafienia znane (Podwale: sidewalk-under-carriageway 36 i footway-on-carriageway 19 to T-046/G-082, kerb-strip-bare 7 to T-063/G-113; kerb-gap 372: G-451; landuse-bare przy Złotej T-045).";
    expect(refsInText(note, "sidewalk-under-carriageway")).toEqual(["T-046", "G-082"]);
    expect(refsInText(note, "kerb-strip")).toEqual([]);
    expect(refsInText(note, "kerb-gap-bare")).toEqual(["G-451"]);
    expect(placesIn("(732,7; 151,4) i (613..760, −220..−150)")).toEqual([
      { minX: 732.7, maxX: 732.7, minZ: 151.4, maxZ: 151.4 },
      { minX: 613, maxX: 760, minZ: -220, maxZ: -150 },
    ]);
    const reg: Registers = {
      glitches: [
        "### G-703 Schody\n- Zasięg: `steps-riser-tall` (760; −210)\n",
        "### G-686 Schody\n- Zasięg: `steps-riser-tall` (732,7; 151,4)\n",
        "### G-801 Gdzie indziej\n- `new-elsewhere` (2658; 60)\n",
        "## Proponowane kontrole skanu\n| `table-kind` | baza 3 | G-802 |\n",
      ].join(""),
      topography: "| T-049 | schody na brzegu | `steps-riser-tall` 20 m |\n",
      notes: [{ cell: "stare-miasto-1-0", text: note }],
      scan: '  /** A gap (ADR-0078 stage 5). */\n  "only-scan": () => 0,\n',
    };
    const hits = { findings: 9, kinds: { "steps-riser-tall": 4, "landuse-bare": 3, "kerb-gap-bare": 2, "new-elsewhere": 1, "table-kind": 1, "only-scan": 1, "new-kind": 1 } };
    const s = knownSection("stare-miasto-1-0", rect, hits, reg);
    const refs = Object.fromEntries(s.kinds.map((k) => [k.kind, k.refs.map((r) => `${r.id}${r.inCell ? "*" : ""}`)]));
    // The entry in the cell first, then the others in the registers' order: three at most.
    expect(refs).toEqual({
      "steps-riser-tall": ["G-703*", "G-686", "T-049"],
      "landuse-bare": ["T-045*"],
      "kerb-gap-bare": ["G-451*"],
      "new-elsewhere": ["G-801"],
      "table-kind": ["G-802"],
      "only-scan": ["ADR-0078"],
      "new-kind": [],
    });
    expect(s.verdict).toMatch(/bez odsyłacza w rejestrach: new-kind;/);
    expect(s.verdict).toMatch(/w tej komórce .*: new-elsewhere, only-scan, table-kind/);
    expect(knownSection("x", rect, undefined, reg).missing).toMatch(/map-coverage-hits/);
  });

  // The checkout's own registers, on main and on the registers' branch: a cell nobody walked still gets the city's references.
  it("finds references for an unwalked cell's kinds in the checkout's registers", () => {
    const hits = { findings: 3, kinds: { "landuse-bare": 160, "kerb-gap-bare": 77, "ground-strip-overlap": 180 } };
    const s = knownSection("krakowskie-2-0", cellById("krakowskie-2-0").rect, hits, readRegisters());
    for (const k of s.kinds) expect(k.refs.length, k.kind).toBeGreaterThan(0);
  });
});

describe("the cell report's sections on stare-miasto-1-0", () => {
  const cell = cellById("stare-miasto-1-0");
  const covers = MAP_REGIONS.map((r) => readCover(r.slug)).filter((c) => c !== undefined);
  const cover = coverFor(covers, { x: (cell.rect.minX + cell.rect.maxX) / 2, z: (cell.rect.minZ + cell.rect.maxZ) / 2 });
  const s = cellSections({ cell, ...(cover ? { cover } : {}), cleared: [] });

  // The curators' probes of 12.11 (topo-sm10, topo-k10): IoU 0.939 at (0; 0), pairs 0.26 m; 7 yards of about 2500 m² without an opening.
  it("matches the curators' footprints and yards", () => {
    expect(s.footprints.iouZero).toBeCloseTo(0.939, 2);
    expect(s.footprints.best).toMatchObject({ dx: 0, dz: 0 });
    expect(s.footprints.pairs.count).toBe(22);
    expect(Math.abs(s.footprints.pairs.medianOffset - 0.26)).toBeLessThan(0.05);
    // The opening by 1 m trims the yards' edges: 7 yards within 10% of 2500 m².
    expect(s.bare.classes.yard.count).toBe(7);
    expect(Math.abs(s.bare.classes.yard.m2 - 2500)).toBeLessThan(250);
    expect(s.absent.standing).toEqual([]);
  });

  // The orthophoto is not in the repository: with its cache, within 0.5 m (two image samples) of the curators' leans.
  it.skipIf(!existsSync(join(defaultCache(), "2024-06", "stare-miasto-1-0.png")))("matches the curators' leans of the flights", () => {
    const at = (f: string) => s.lean.flights.find((x) => x.flight === f)!;
    expect(Math.hypot(at("2025-04").dx + 0.25, at("2025-04").dz + 3.5)).toBeLessThanOrEqual(0.5);
    expect(Math.hypot(at("2024-06").dx - 1.25, at("2024-06").dz + 1)).toBeLessThanOrEqual(0.5);
    expect(s.lean.recommended).toBe("2024-06");
  });
});
