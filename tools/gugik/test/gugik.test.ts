/**
 * The GUGiK tools of ADR-0077 without the network: the CityGML reader on the Collegium Maximum
 * cut from both sets (`fixtures/`), the GeoPackage line decoder on a file made here, the grid
 * transform, the extract coding, and the matching of game buildings to the committed extracts.
 */
import { mkdtempSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { centroid } from "../../osm-import/src/geometry.ts";
import { parseBbox } from "../src/bbox.ts";
import { buildingElements, parseLod1, parseLod2 } from "../src/citygml.ts";
import { decode, encode, loadLod1, loadLod2, tileKey } from "../src/extracts.ts";
import { puwgToWorld, worldToEn } from "../src/frame.ts";
import { gameBuildings } from "../src/game.ts";
import { readGpkgLines } from "../src/gpkg.ts";
import { matchFootprints } from "../src/match.ts";
import { footprint, iou } from "../src/overlap.ts";
import { barrierStats } from "../src/analysis.ts";

const fixture = (f: string) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8");
const COLLEGIUM = "26780F22-4CA6-DA8A-E053-CC2BA8C01EC0";

describe("CityGML reader", () => {
  it("reads the LoD1 prism of the Collegium Maximum: id, measuredHeight and footprint at its foot", () => {
    const els = [...buildingElements(fixture("collegium-lod1.gml"))];
    expect(els).toHaveLength(1);
    const b = parseLod1(els[0]!)!;
    expect(b.id).toBe(COLLEGIUM);
    expect(b.measuredHeight).toBeCloseTo(16.5, 1);
    expect(b.top! - b.ground).toBeCloseTo(b.measuredHeight!, 1);
    expect(b.footprint).toHaveLength(1);
    expect(b.footprint[0]!.every((p) => p[2] === b.ground)).toBe(true);
  });

  it("reads the LoD2 roof of the same building: type, eaves and ridge over the ground surface", () => {
    const b = parseLod2([...buildingElements(fixture("collegium-lod2.gml"))][0]!)!;
    expect(b.id).toBe(COLLEGIUM);
    expect(b.roofType).toBe(1130);
    expect(b.eaves! - b.ground).toBeGreaterThan(10);
    expect(b.ridge!).toBeGreaterThan(b.eaves!);
    // The main mass's eaves and ridge (G-639) lie within the whole roof's.
    expect(b.mainEaves!).toBeGreaterThanOrEqual(b.eaves!);
    expect(b.mainRidge!).toBeLessThanOrEqual(b.ridge!);
    expect(b.mainRidge!).toBeGreaterThan(b.mainEaves!);
    expect(b.footprint.length).toBeGreaterThan(0);
  });
});

describe("grid transform and coding", () => {
  it("puwgToWorld inverts the importer's world → EPSG:2180 map to under a millimetre", () => {
    for (const p of [{ x: 0, z: 0 }, { x: 2700, z: 480 }, { x: -6000, z: 7000 }]) {
      const g = worldToEn(p);
      const q = puwgToWorld(g.e, g.n);
      expect(Math.hypot(q.x - p.x, q.z - p.z)).toBeLessThan(1e-3);
    }
  });

  it("the Collegium Maximum's LoD1 footprint lands on the game's building", () => {
    const b = parseLod1([...buildingElements(fixture("collegium-lod1.gml"))][0]!)!;
    const ring = b.footprint[0]!.map(([e, n]) => puwgToWorld(e, n));
    const game = gameBuildings().find((g) => g.id === "w67499318")!;
    expect(iou(footprint(ring), footprint(game.ring))).toBeGreaterThan(0.7);
  });

  it("IoU of two 10 m squares half over each other is 1/3; an L around a square's corner shares nothing", () => {
    const sq = (x: number, z: number) => [{ x, z }, { x: x + 10, z }, { x: x + 10, z: z + 10 }, { x, z: z + 10 }];
    expect(iou(footprint(sq(0, 0)), footprint(sq(5, 0)))).toBeCloseTo(1 / 3, 2);
    const l = [{ x: 0, z: 0 }, { x: 20, z: 0 }, { x: 20, z: 5 }, { x: 5, z: 5 }, { x: 5, z: 20 }, { x: 0, z: 20 }];
    expect(iou(footprint(l), footprint(sq(8, 8)))).toBe(0);
    // The two halves of a square across its diagonal: the same box, no shared area.
    const lower = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 0, z: 10 }];
    const upper = [{ x: 10, z: 0 }, { x: 10, z: 10 }, { x: 0, z: 10 }];
    expect(iou(footprint(lower), footprint(upper))).toBeLessThan(0.01);
  });

  it("with a least IoU, gives 0 for a pair under it and the same value for a pair over it", () => {
    const sq = (x: number, z: number, s = 10) => footprint([{ x, z }, { x: x + s, z }, { x: x + s, z: z + s }, { x, z: z + s }]);
    // Under on the areas alone (the bound before sampling), under after sampling, over.
    expect(iou(sq(0, 0), sq(0, 0, 5))).toBeCloseTo(0.25, 2);
    expect(iou(sq(0, 0), sq(0, 0, 5), 0.7)).toBe(0);
    expect(iou(sq(0, 0), sq(2, 2), 0.5)).toBe(0);
    expect(iou(sq(0, 0), sq(1, 0), 0.7)).toBe(iou(sq(0, 0), sq(1, 0)));
    expect(iou(sq(0, 0), sq(1, 0))).toBeCloseTo(9 / 11, 2);
  });

  it("delta-codes outlines in decimetres and reads them back", () => {
    const pts = [{ x: 162.94, z: 25.71 }, { x: -3.2, z: 40 }, { x: 0, z: -0.04 }];
    expect(decode(encode(pts))).toEqual([{ x: 162.9, z: 25.7 }, { x: -3.2, z: 40 }, { x: 0, z: 0 }]);
    expect(tileKey({ x: -0.1, z: 1000 })).toBe("-1_1");
  });

  it("takes a rectangle in game metres or in EPSG:2180", () => {
    expect(parseBbox(["--bbox", "-200,-270,760,580"])).toEqual({ minX: -200, minZ: -270, maxX: 760, maxZ: 580 });
    expect(parseBbox([])).toBeUndefined();
    const o = worldToEn({ x: 0, z: 0 });
    const r = parseBbox([`--bbox-2180=${o.e - 10},${o.n - 10},${o.e + 10},${o.n + 10}`])!;
    expect(r.minX).toBeLessThan(-9);
    expect(r.maxZ).toBeGreaterThan(9);
    expect(() => parseBbox(["--bbox", "1,2,0,3"])).toThrow();
  });
});

describe("GeoPackage lines", () => {
  it("decodes (multi)linestrings with Z out of GeoPackage blobs", () => {
    const file = join(mkdtempSync(join(tmpdir(), "gugik-")), "t.gpkg");
    const db = new DatabaseSync(file);
    db.exec(`CREATE TABLE gpkg_geometry_columns (table_name TEXT, column_name TEXT, srs_id INTEGER);
      INSERT INTO gpkg_geometry_columns VALUES ('OT_X_L', 'geometria', 2180);
      CREATE TABLE OT_X_L (LOKALNYID TEXT, RODZAJ TEXT, geometria BLOB);`);
    // GeoPackage header without envelope, then a little-endian WKB LineString Z (1002) of two points.
    const wkb = new DataView(new ArrayBuffer(8 + 9 + 2 * 24));
    [0x47, 0x50, 0, 1 /* little-endian, no envelope */].forEach((v, i) => wkb.setUint8(i, v));
    wkb.setInt32(4, 2180, true);
    wkb.setUint8(8, 1);
    wkb.setUint32(9, 1002, true);
    wkb.setUint32(13, 2, true);
    [748000, 381000, 190, 748010, 381000, 191].forEach((v, i) => wkb.setFloat64(17 + 8 * i, v, true));
    db.prepare("INSERT INTO OT_X_L VALUES (?, ?, ?)").run("a1", "ściana oporowa", new Uint8Array(wkb.buffer));
    db.close();
    expect(readGpkgLines(file)).toEqual([{ id: "a1", kind: "ściana oporowa", lines: [[[748000, 381000], [748010, 381000]]] }]);
  });
});

describe("matching the game to the committed extracts", () => {
  const game = gameBuildings().filter((b) => !b.part);
  const pick = (id: string) => game.find((b) => b.id === id)!;
  const tiles = (id: string) => [tileKey(centroid(pick(id).ring))];

  it("Collegium Maximum (w67499318): LoD1 16.5 m at IoU > 0.7, LoD2 its combined roof", () => {
    const lod1 = loadLod1(tiles("w67499318"));
    const m = matchFootprints([pick("w67499318")], lod1).byA.get("w67499318")!;
    expect(m.b).toBe(COLLEGIUM);
    expect(m.iou).toBeGreaterThan(0.7);
    expect(lod1.find((b) => b.id === m.b)!.height).toBeCloseTo(16.5, 1);
    const lod2 = loadLod2(tiles("w67499318"));
    expect(lod2.find((b) => b.id === COLLEGIUM)?.roofType).toBe(1130);
  });

  it("Brama Krakowska (r7224409): matched, its LoD1 prism as tall as the gate tower", () => {
    const lod1 = loadLod1(tiles("r7224409"));
    const m = matchFootprints([pick("r7224409")], lod1).byA.get("r7224409")!;
    // The game's outline takes in the gate's side wings, so the overlap is only about half.
    expect(m.iou).toBeGreaterThan(0.5);
    expect(lod1.find((b) => b.id === m.b)!.height).toBeGreaterThan(25);
    expect(pick("r7224409").partsMid).toBeGreaterThan(20);
  });

  it("an OSM wall along a BDOT10k line is its counterpart; one 5 m off is not", () => {
    const bdot = [{ id: "b", kind: "ściana oporowa", line: [{ x: 0, z: 0 }, { x: 20, z: 0 }] }];
    const r = { minX: -50, minZ: -50, maxX: 50, maxZ: 50 };
    expect(barrierStats(bdot, [{ id: "w1", kind: "retaining_wall", line: [{ x: 0, z: 1.5 }, { x: 20, z: 1.5 }] }], r).bdotWithoutOsm).toBe(0);
    const off = barrierStats(bdot, [{ id: "w1", kind: "retaining_wall", line: [{ x: 0, z: 5 }, { x: 20, z: 5 }] }], r);
    expect(off.bdotWithoutOsm).toBe(1);
    expect(off.bdotLength["ściana oporowa"]).toBe(20);
    expect(off.osmLength.retaining_wall).toBe(20);
  });
});
