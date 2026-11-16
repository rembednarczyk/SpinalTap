import { describe, expect, it } from "vitest";
import type { StreetPropItem } from "../../../packages/core/src/world/city-geo.ts";
import { emitSites } from "../src/construction-table.ts";
import type { SitePlan } from "../src/construction-site.ts";
import { terrainText } from "../src/emit.ts";
import { emitProps, rowText } from "../src/props-emit.ts";

/** The value of a fragment of a table: its text is JSON with trailing commas. */
const value = (text: string): unknown => JSON.parse(text.replace(/,(\s*[\]}])/g, "$1"));

describe("the map tables' line format (decision of 16.11: git merges them as text)", () => {
  it("writes the terrain's heights one grid row per line, with the same values", () => {
    const t = { originX: -200, originZ: 60, cell: 2.5, cols: 3, rows: 2, heights: [-1.5, 0, 2.25, 3, -0.1, 1e-7] };
    const text = terrainText(t);
    expect(text.split("\n")).toEqual(['{"originX":-200,"originZ":60,"cell":2.5,"cols":3,"rows":2,"heights":[', "      -1.5,0,2.25,", "      3,-0.1,1e-7,", "    ]}"]);
    expect(value(text)).toEqual(t);
    expect(value(terrainText({ ...t, rows: 0, heights: [] }))).toEqual({ ...t, rows: 0, heights: [] });
  });

  it("writes a kind's row one piece per line, so a moved piece changes one line", () => {
    const row = [1.5, -2, 3, 0.39, 17, -4, 0.5, 6, 3.14, 2];
    expect(rowText(row).split("\n")).toEqual(["[", "      1.5,-2,3,0.39,17,", "      -4,0.5,6,3.14,2,", "    ]"]);
    expect(value(rowText(row))).toEqual(row);
    expect(rowText([])).toBe("[]");
  });

  it("changes only the moved piece's line in the furniture table", () => {
    const piece = (x: number): StreetPropItem => ({ prop: "bench", x, y: 0, z: 1, yaw: 0, variant: 3 });
    const before = emitProps(new Map([["c-0-0", [piece(1), piece(2), piece(3)]]])).split("\n");
    const after = emitProps(new Map([["c-0-0", [piece(1), piece(2.5), piece(3)]]])).split("\n");
    expect(after.length).toBe(before.length);
    expect(after.filter((l, i) => l !== before[i])).toEqual(["      2.5,0,1,0,3,"]);
  });

  it("changes only the moved piece's line in the building sites' table", () => {
    const piece = (x: number): StreetPropItem => ({ prop: "site-fence", x, y: 0, z: 1, yaw: 0, variant: 2 });
    const plan = (x: number): SitePlan => ({ id: "w1", seed: 7, set: "fence", area: 120, outline: [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 3 }], gate: null, board: null, dig: null, crane: null, scaffold: null, pieces: [piece(1), piece(x)], unfenced: 0 });
    const before = emitSites([plan(2)]).split("\n");
    const after = emitSites([plan(2.5)]).split("\n");
    expect(before).toContain("      \"site-fence\": [");
    expect(after.length).toBe(before.length);
    expect(after.filter((l, i) => l !== before[i])).toEqual(["        2.5,0,1,0,2,"]);
  });

  it("changes only the moved corner's line in a building site's outline", () => {
    const plan = (x: number): SitePlan => ({ id: "w1", seed: 7, set: "fence", area: 120, outline: [{ x: 0, z: 0 }, { x, z: 0 }, { x: 4, z: 3 }], gate: null, board: null, dig: null, crane: null, scaffold: null, pieces: [], unfenced: 0 });
    const before = emitSites([plan(4)]).split("\n");
    const after = emitSites([plan(4.5)]).split("\n");
    expect(after.length).toBe(before.length);
    expect(after.filter((l, i) => l !== before[i])).toEqual(["      4.5,0,"]);
  });
});
