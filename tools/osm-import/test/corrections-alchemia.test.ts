import { describe, expect, it } from "vitest";
import { REPLACED_WAYS, withoutReplaced } from "../src/corrections-alchemia.ts";

/** The map's ways a set piece of the game replaces (ADR-0074 stage 7): left out of the import, each with its register's row. */

const pt = (x: number, z: number) => ({ x, z });

describe("the ways the game replaces (ADR-0042, ADR-0074 stage 7)", () => {
  it("names each replaced way's set piece, reason and register entry, once", () => {
    for (const w of REPLACED_WAYS) {
      expect(w.id).toMatch(/^w\d+$/);
      expect(w.by.length).toBeGreaterThan(3);
      expect(w.reason.length).toBeGreaterThan(10);
      expect(w.ref).toMatch(/^T-\d{3}$/);
    }
    expect(new Set(REPLACED_WAYS.map((w) => w.id)).size).toBe(REPLACED_WAYS.length);
  });

  it("leaves out the replaced areas and lines by id, and the rest as mapped", () => {
    const area = { id: "w1", osmId: 1, tags: { amenity: "parking" }, ring: [pt(0, 0), pt(1, 0), pt(1, 1)], holes: 0 };
    const line = { id: "w2", osmId: 2, tags: { highway: "service" }, line: [pt(0, 0), pt(1, 1)] };
    const other = { ...line, id: "w3", osmId: 3 };
    const f = { areas: [area], lines: [line, other] };
    expect(withoutReplaced(f, new Set(["w1", "w2"]))).toEqual({ areas: [], lines: [other] });
    expect(withoutReplaced(f, new Set())).toEqual({ areas: [area], lines: [line, other] });
  });
});
