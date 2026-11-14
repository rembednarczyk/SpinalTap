import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { restoreDateOnly } from "../src/files.ts";
import { renderReport } from "../src/render.ts";
import { type MapState, type ReportInput, buildReport, changes, fileChanges } from "../src/report.ts";
import { RATE_LIMIT } from "../src/run.ts";
import { scanDiff } from "../src/scan.ts";
import { outlineArea, tableStats } from "../src/table-stats.ts";

const square = (x: number, z: number, s: number) => [x, z, x + s, z, x + s, z + s, x, z + s];
const chunk = (id: string, buildings: number, grass: number) => ({
  id,
  district: "targ",
  bounds: { minX: 0, maxX: 100, minZ: 0, maxZ: 100 },
  terrain: { cells: [1, 2, 3] },
  buildings: Array.from({ length: buildings }, (_, i) => ({ id: `b${i}` })),
  ground: [{ surface: "grass", outline: square(0, 0, grass) }, { surface: "road", outline: square(50, 50, 10) }],
  busStops: [1, 2, 3, 4],
});

const state = (buildings: number, grass: number, sha = "a"): MapState => ({
  files: { "packages/sim/src/content/lublin/a.generated.ts": { bytes: 100 + buildings, sha256: sha } },
  stats: tableStats([chunk("a-0-0", buildings, grass)], { "a-0-0": { bench: [0, 0, 0, 0, 1, 5, 0, 5, 0, 2] } }),
  widths: { streets: { osm: 10, default: 90 }, all: { osm: 10, default: 190 } },
});

const input = (before: MapState, after: MapState, over: Partial<ReportInput> = {}): ReportInput => ({
  base: "0123456789",
  mode: { offline: true, sources: ["osm"] },
  steps: [{ id: "osm-build", status: "ran", note: "" }],
  before,
  after,
  restored: [],
  scan: { ran: true, kinds: [] },
  hashes: { ran: true, rows: [] },
  orto: null,
  ...over,
});

describe("map:refresh's report", () => {
  it("counts the tables: a chunk's lists, flat points by two, props by rows of five, ground by its outline's area", () => {
    expect(outlineArea(square(0, 0, 10))).toBe(100);
    const s = tableStats([chunk("a-0-0", 3, 10), chunk("a-0-1", 1, 20)], { "a-0-0": { bench: Array(10).fill(0) } });
    expect(s.objects).toEqual({ buildings: 4, busStops: 4, ground: 4, "prop:bench": 2 });
    expect(s.byChunk).toEqual({ "a-0-0": 9, "a-0-1": 5 });
    expect(s.surfaces).toEqual({ grass: 500, road: 200 });
    expect(s.surfaceByChunk["a-0-1"]).toEqual({ grass: 400, road: 100 });
  });

  it("lists the files and the counts that differ, nothing else", () => {
    const a = { x: { bytes: 1, sha256: "1" }, y: { bytes: 2, sha256: "2" } };
    const b = { y: { bytes: 3, sha256: "3" }, z: { bytes: 4, sha256: "4" }, x: { bytes: 1, sha256: "1" } };
    expect(fileChanges(a, b)).toEqual([
      { path: "y", before: 2, after: 3 },
      { path: "z", before: null, after: 4 },
    ]);
    expect(changes({ a: 1, b: 2 }, { b: 2, c: 5 })).toEqual({ a: { before: 1, after: 0 }, c: { before: 0, after: 5 } });
  });

  it("needs no review when nothing is over a threshold", () => {
    const r = buildReport(input(state(100, 10), state(101, 10.04, "b")));
    expect(r.files).toEqual([{ path: "packages/sim/src/content/lublin/a.generated.ts", before: 200, after: 201 }]);
    expect(r.objects).toEqual({ buildings: { before: 100, after: 101 } });
    expect(r.surfaceMovedM2).toBe(0.8);
    expect(r.verdict).toMatchObject({ review: false, reasons: [], places: [] });
  });

  it("asks the curator past the objects' and the surfaces' thresholds, with the chunks", () => {
    const r = buildReport(input(state(100, 10), state(110, 12, "b")));
    expect(r.verdict.review).toBe(true);
    expect(r.verdict.reasons).toEqual(["obiekty razem: 106 -> 116 (9.4%, próg 2%)", "rodzaj buildings: 100 -> 110", "nawierzchnia w tablicach: przesunięte 44 m² (próg 1 m²)"]);
    expect(r.verdict.places).toEqual(["rodzaj buildings", "kawałek a-0-0: 44 m² nawierzchni"]);
  });

  it("asks the curator for a new key of an S1–S3 kind, not of an S4 one, and when the scan did not run", () => {
    const base = new Map([["lane-dead-end", new Map([["a-0-0 1,2", 1]])], ["levels-tag-lost", new Map<string, number>()]]);
    const found = new Map([
      ["lane-dead-end", new Map([["a-0-0 5,6", 1]])],
      ["levels-tag-lost", new Map([["a-0-0 7,8", 1]])],
      ["walk-blocked", new Map<string, number>()],
    ]);
    const scan = scanDiff(base, found);
    expect(scan.kinds).toEqual([
      { kind: "lane-dead-end", severity: "S1-S3", before: 1, after: 1, added: ["lane-dead-end a-0-0 5,6"], removed: ["lane-dead-end a-0-0 1,2"] },
      { kind: "levels-tag-lost", severity: "S4", before: 0, after: 1, added: ["levels-tag-lost a-0-0 7,8"], removed: [] },
    ]);
    const r = buildReport(input(state(100, 10), state(100, 10), { scan }));
    expect(r.verdict.reasons).toEqual(["nowe klucze skanu S1–S3: lane-dead-end +1"]);
    expect(r.verdict.places).toEqual(["lane-dead-end a-0-0 5,6"]);
    const s4 = buildReport(input(state(100, 10), state(100, 10), { scan: { ran: true, kinds: scan.kinds.filter((k) => k.severity === "S4") } }));
    expect(s4.verdict.review).toBe(false);
    expect(buildReport(input(state(1, 1), state(1, 1), { scan: { ran: false, kinds: [] } })).verdict.reasons).toEqual(["skan glitchy nie przebiegł"]);
  });

  it("takes a golden whose hash alone moved as no review, one whose numbers moved as one", () => {
    const row = (verdict: string) => ({ file: "packages/engine/test/map-ground-golden.test.ts", test: "ground", verdict, hashes: ["skrót 1 -> 2"], numbersChanged: verdict === "numbers-changed" ? ["meshes"] : [] });
    expect(buildReport(input(state(1, 1), state(1, 1), { hashes: { ran: true, rows: [row("same-numbers")] } })).verdict.review).toBe(false);
    expect(buildReport(input(state(1, 1), state(1, 1), { hashes: { ran: true, rows: [row("numbers-changed")] } })).verdict.reasons).toEqual([
      "testy złote z innymi liczbami niż sam skrót: packages/engine/test/map-ground-golden.test.ts (ground)",
    ]);
  });

  it("takes orto:diff's surface, terrain and decks into the verdict", () => {
    const orto = { changedM2: 3.5, addedM2ByCell: { "krakowskie-0-1": 3.5, "nabrzeze-0-0": 0 }, terrainMaxAbs: 0.2, decksChanged: 1 };
    const r = buildReport(input(state(1, 1), state(1, 1), { orto }));
    expect(r.verdict.reasons).toEqual(["orto:diff: zmienione 3.5 m² nawierzchni", "teren: największe przesunięcie 0.2 m (próg 0.05 m)", "pomosty: zmienione 1"]);
    expect(r.verdict.places).toEqual(["komórka krakowskie-0-1: +3.5 m² (orto:diff)"]);
  });

  it("writes the same Markdown for the same report, with the verdict and the widths", () => {
    const r = buildReport(input(state(100, 10), state(110, 12, "b")));
    const md = renderReport(r);
    expect(renderReport(buildReport(input(state(100, 10), state(110, 12, "b"))))).toBe(md);
    expect(md).toContain("## Werdykt: **przegląd kuratora**");
    expect(md).toContain("- packages/sim/src/content/lublin/a.generated.ts: 200 B -> 210 B");
    expect(md).toContain("- buildings: 100 -> 110 (+10)");
    expect(md).toContain("- ulice: bez zmian, osm 0.01 km (10.0%), default 0.09 km (90.0%)");
    expect(renderReport(buildReport(input(state(1, 1), state(1, 1))))).toContain("## Werdykt: **bez przeglądu**");
  });

  it("gives a manifest its old text back when only its download dates moved", () => {
    const root = mkdtempSync(join(tmpdir(), "map-refresh-dates-"));
    try {
      mkdirSync(join(root, "data"), { recursive: true });
      const old = `${JSON.stringify({ lod1: { url: "u", fetched: "2026-11-11", sha256: "x" } }, null, 1)}\n`;
      writeFileSync(join(root, "data/a.json"), JSON.stringify({ lod1: { url: "u", fetched: "2026-11-14", sha256: "x" } }));
      writeFileSync(join(root, "data/b.json"), JSON.stringify({ lod1: { url: "u", fetched: "2026-11-14", sha256: "y" } }));
      const before = new Map([
        ["data/a.json", old],
        ["data/b.json", old],
      ]);
      expect(restoreDateOnly(root, before)).toEqual(["data/a.json"]);
      expect(readFileSync(join(root, "data/a.json"), "utf8")).toBe(old);
      expect(readFileSync(join(root, "data/b.json"), "utf8")).toContain('"y"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("tells a 429 in a fetch script's error from a 429 in a number", () => {
    expect(RATE_LIMIT.test("Error: 429 Too Many Requests: https://api.openstreetmap.org/…")).toBe(true);
    expect(RATE_LIMIT.test("Error: 429 : https://…")).toBe(true);
    expect(RATE_LIMIT.test("HTTP 429 (no retry): https://mapy.geoportal.gov.pl/…")).toBe(true);
    expect(RATE_LIMIT.test("osm stare-miasto: 4290 nodes, 429 ways")).toBe(false);
  });
});
