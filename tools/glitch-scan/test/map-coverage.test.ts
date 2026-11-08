import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MAP_CHUNKS } from "../../../packages/sim/src/content/lublin/sites";
import { coverageSummary, formatSummary } from "../src/coverage-summary.ts";
import { type CoverageCell, type CoverageRegister, cellAt, hitsPerCell, registerProblems } from "../src/map-coverage.ts";

/** The map's coverage register (`docs/mapa-pokrycie.md`) against the city, and its counting. */

const REGISTER = JSON.parse(readFileSync(join(__dirname, "../../../docs/mapa-pokrycie.json"), "utf8")) as CoverageRegister;

const bounds = (minX: number, maxX: number) => ({ minX, maxX, minZ: 0, maxZ: 100 });
const cell = (id: string, minX: number, maxX: number, more: Partial<CoverageCell> = {}): CoverageCell => ({
  id,
  dzielnica: id.replace(/-\d+-\d+$/, ""),
  dzielnicaGry: "targ",
  bounds: bounds(minX, maxX),
  status: "nieprzejrzane",
  data: null,
  pr: [],
  wierszeT: { otwarte: [], rozwiazane: [] },
  przeglady: [],
  notatka: "",
  ...more,
});
const chunks = [
  { id: "a-0-0", district: "targ", bounds: bounds(0, 100) },
  { id: "a-1-0", district: "targ", bounds: bounds(100, 200) },
  { id: "b-0-0", district: "targ", bounds: bounds(300, 400) },
];
const register = (...komorki: CoverageCell[]): CoverageRegister => ({ opis: "", komorki });
const full = () => [cell("a-0-0", 0, 100), cell("a-1-0", 100, 200), cell("b-0-0", 300, 400)];

describe("the coverage register in docs (docs/mapa-pokrycie.json)", () => {
  it("has a cell for every chunk of the city and none more, with its bounds, district and a status off the list", () => {
    expect(REGISTER.komorki).toHaveLength(MAP_CHUNKS.length);
    expect(registerProblems(REGISTER, MAP_CHUNKS)).toEqual([]);
  });
});

describe("the coverage's counting", () => {
  it("puts a seam in one cell and the city's outer edge in its cell", () => {
    expect(cellAt(chunks, 100, 50)).toBe("a-1-0");
    expect(cellAt(chunks, 200, 100)).toBe("a-1-0");
    expect(cellAt(chunks, 250, 50)).toBeUndefined();
  });

  it("counts a kind once per 10 m square, findings one by one, and those off the cells apart", () => {
    const hits = hitsPerCell(
      {
        "landuse-bare": [{ at: "1,1", what: "" }, { at: "2,3", what: "" }, { at: "15,1", what: "" }],
        "pad-on-road": [{ at: "1,1", what: "" }],
        "lane-dead-end": [{ at: "250,50", what: "" }, { at: "?", what: "" }],
      },
      chunks,
    );
    expect(hits.cells["a-0-0"]).toEqual({ findings: 4, hits: 3, kinds: { "landuse-bare": 2, "pad-on-road": 1 } });
    expect(hits.cells["b-0-0"]).toEqual({ findings: 0, hits: 0, kinds: {} });
    expect([hits.outside, hits.unplaced]).toEqual([1, 1]);
  });

  it("finds a chunk without its cell, a cell of no chunk, moved bounds and a status off the list", () => {
    expect(registerProblems(register(...full()), chunks)).toEqual([]);
    expect(registerProblems(register(cell("a-0-0", 0, 100), cell("a-1-0", 100, 200)), chunks)).toEqual(["b-0-0: no cell in the register"]);
    expect(registerProblems(register(...full(), cell("c-0-0", 500, 600)), chunks)).toEqual(["c-0-0: no such chunk in the city"]);
    expect(registerProblems(register(cell("a-0-0", 0, 90), cell("a-1-0", 100, 200), cell("b-0-0", 300, 400)), chunks)).toEqual(["a-0-0: bounds differ from the chunk's"]);
    const odd = { ...cell("b-0-0", 300, 400), status: "gotowe" } as unknown as CoverageCell;
    expect(registerProblems(register(cell("a-0-0", 0, 100), cell("a-1-0", 100, 200), odd), chunks)[0]).toMatch(/status "gotowe"/);
  });

  it("holds a date to every status past nieprzejrzane, a PR to poprawione, and no open T row to czyste", () => {
    const [a, b] = [cell("a-0-0", 0, 100), cell("a-1-0", 100, 200)];
    const with3 = (c: CoverageCell) => registerProblems(register(a, b, c), chunks);
    expect(with3(cell("b-0-0", 300, 400, { status: "przejrzane" }))).toEqual(['b-0-0: data "null" for przejrzane']);
    expect(with3(cell("b-0-0", 300, 400, { data: "2026-11-07" }))).toEqual(['b-0-0: data "2026-11-07" for nieprzejrzane']);
    expect(with3(cell("b-0-0", 300, 400, { status: "poprawione", data: "2026-11-07" }))).toEqual(["b-0-0: poprawione without a PR"]);
    expect(with3(cell("b-0-0", 300, 400, { status: "czyste", data: "2026-11-07", wierszeT: { otwarte: ["T-240"], rozwiazane: [] } }))).toEqual(["b-0-0: czyste with T rows open (T-240)"]);
  });

  it("calls a cell czyste only with no hit of the scan in it", () => {
    const clean = cell("b-0-0", 300, 400, { status: "czyste", data: "2026-11-07" });
    const r = register(cell("a-0-0", 0, 100), cell("a-1-0", 100, 200), clean);
    expect(registerProblems(r, chunks, hitsPerCell({}, chunks))).toEqual([]);
    expect(registerProblems(r, chunks, hitsPerCell({ "pad-on-road": [{ at: "350,50", what: "" }] }, chunks))).toEqual(["b-0-0: czyste with 1 hits of the scan"]);
  });

  it("gives the shares per status for the city and each district, and queues the least reviewed with most hits first", () => {
    const r = register(
      cell("a-0-0", 0, 100, { status: "przejrzane", data: "2026-11-07" }),
      cell("a-1-0", 100, 200, { wierszeT: { otwarte: ["T-001"], rozwiazane: [] } }),
      cell("b-0-0", 300, 400, { status: "czyste", data: "2026-11-07" }),
    );
    const hits = hitsPerCell({ "landuse-bare": [{ at: "5,5", what: "" }, { at: "25,5", what: "" }, { at: "350,5", what: "" }] }, chunks);
    const s = coverageSummary(r, hits);
    expect(s.city).toEqual({ nieprzejrzane: 33.3, przejrzane: 33.3, poprawione: 0, czyste: 33.3 });
    expect(s.districts).toEqual({ a: { nieprzejrzane: 50, przejrzane: 50, poprawione: 0, czyste: 0 }, b: { nieprzejrzane: 0, przejrzane: 0, poprawione: 0, czyste: 100 } });
    expect(s.queue.map((q) => [q.id, q.hits, q.open])).toEqual([["a-1-0", 0, 1], ["a-0-0", 2, 0]]);
    const fixedOne = register(cell("a-0-0", 0, 100, { wierszeT: { otwarte: [], rozwiazane: ["T-002"] } }), cell("a-1-0", 100, 200), cell("b-0-0", 300, 400));
    expect(coverageSummary(fixedOne, hits).withFixes).toEqual({ miasto: 33.3, a: 50, b: 0 });
    expect(formatSummary(s)).toContain("| 1 | a-1-0 | nieprzejrzane | 0 | 0 | 1 |");
  });
});
