import { describe, expect, it } from "vitest";
import { SAVE_SCHEMA_VERSION, type Contract } from "@seki/core";
import { MIGRATIONS, checksum, decodeSave, encodeSave, findSchemaError } from "../src";
import { snapshot } from "./fixtures";

/** A contract ended with its people still in the world (G-178): schema v22 and the v21 -> v22 migration. */

const wrap = (payload: unknown) => {
  const text = JSON.stringify(payload);
  return JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text });
};

const LOST: Contract = { id: "c3", kind: "infiltrate", siteId: "east_lot", targets: 3, reward: 900, status: "active" };

describe("a contract ended with its people about in the save (v21 to v22, G-178)", () => {
  it("is schema v22", () => {
    expect(SAVE_SCHEMA_VERSION).toBe(22);
  });

  it("a v21 save loads as it was, with no contract ended", () => {
    const loaded = decodeSave("v21", wrap({ ...snapshot(), version: 21 }));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded.endedContract).toBeUndefined();
    expect(findSchemaError(loaded as unknown as Record<string, unknown>)).toBeNull();
    expect(MIGRATIONS[21]!({ version: 21, entities: [] })).toEqual({ version: 22, entities: [] });
  });

  it("keeps the ended contract and the jobs done when it was made through the codec, its variation too", () => {
    const varied = { contract: { ...LOST, variation: { modifiers: ["ambush"], security: "lockdown" } }, completed: 2 } as const;
    expect(decodeSave("slot", encodeSave(snapshot({ endedContract: varied }))).endedContract).toEqual(varied);
    const paid = { contract: { ...LOST, status: "cleared" }, completed: 0 } as const;
    expect(decodeSave("slot", encodeSave(snapshot({ endedContract: paid }))).endedContract).toEqual(paid);
  });

  it("refuses an ended contract that is not a whole contract with a count of jobs done", () => {
    const bad = (endedContract: unknown) => findSchemaError({ ...snapshot(), endedContract } as unknown as Record<string, unknown>);
    const on = (contract: unknown, completed: unknown = 1) => ({ contract, completed });
    expect(bad(undefined)).toBeNull();
    expect(bad(on(LOST))).toBeNull();
    expect(bad(on(LOST, 0))).toBeNull();
    const broken = [{ ...LOST, siteId: "moon" }, { ...LOST, status: "failed" }, { ...LOST, kind: "heist" }, { ...LOST, variation: { modifiers: ["laser"], security: "light" } }];
    for (const v of [null, "c3", LOST, on(null), on("c3"), on(LOST, -1), on(LOST, 1.5), on(LOST, "2"), ...broken.map((c) => on(c))]) {
      expect(bad(v)).toBe("ended contract");
    }
    expect(() => decodeSave("slot", encodeSave(snapshot({ endedContract: on({ ...LOST, targets: 1.5 }) as never })))).toThrow();
  });
});
