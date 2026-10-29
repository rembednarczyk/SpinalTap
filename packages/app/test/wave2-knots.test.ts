import { describe, expect, it } from "vitest";
import type { ContractHookDef } from "@seki/core";
import { STORY_SOURCE, compileInk } from "@seki/narrative";
import * as sim from "@seki/sim";

/**
 * The sim's wave 2 tables (ADR-0032) name ink knots: every street encounter and every
 * observation hook must point at a knot the story has. The hook table comes from the world and
 * contracts work; until it is merged this test checks the encounters alone.
 */

const KNOTS = new Set([...STORY_SOURCE.matchAll(/^===\s*(\w+)\s*===/gm)].map((m) => m[1]));

const isHookTable = (v: unknown): v is readonly ContractHookDef[] => Array.isArray(v) && v.every((h) => typeof h === "object" && h !== null && "knot" in h);
const hooksTable: unknown = Reflect.get(sim, "CONTRACT_HOOKS");
const HOOKS: readonly ContractHookDef[] = isHookTable(hooksTable) ? hooksTable : [];

describe("wave 2 knots named by the simulation's content", () => {
  it("the story compiles with every wave 2 file in it", () => {
    expect(() => compileInk(STORY_SOURCE)).not.toThrow();
  });

  it.each(sim.ENCOUNTERS.map((e) => [e.id, e.knot] as const))("encounter %s plays knot %s", (_id, knot) => {
    expect(KNOTS.has(knot)).toBe(true);
  });

  it("every observation hook in the table has its knot", () => {
    expect(HOOKS.filter((h) => !KNOTS.has(h.knot)).map((h) => h.id)).toEqual([]);
  });
});
