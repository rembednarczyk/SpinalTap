import { describe, expect, it } from "vitest";
import { INTERIORS } from "../src";

/*
 * ADR-0082 §3: inside W-3's fence the autosave waits for the metro or the gate. Every interior of the zone, the pass
 * office in the tower too (its card's debt, `docs/pomieszczenia/tessen-office.md`), says so.
 */
describe("W-3's interiors save no game (ADR-0082 §3)", () => {
  it("marks the hall, its basement and the pass office autosave: false", () => {
    const zone = ["w3-hall", "w3-basement", "tessen-office"];
    for (const id of zone) expect(INTERIORS.find((i) => i.id === id)?.autosave, id).toBe(false);
  });
});
