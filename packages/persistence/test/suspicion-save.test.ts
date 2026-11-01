import { describe, expect, it } from "vitest";
import { SAVE_SCHEMA_VERSION, type EntitySnapshot, type SaveSnapshot } from "@seki/core";
import { MIGRATIONS, checksum, decodeSave, encodeSave, findSchemaError } from "../src";
import { snapshot } from "./fixtures";

/** A guard's suspicion in the save (G-174): schema v21 and the v20 -> v21 migration. */

const wrap = (payload: unknown) => {
  const text = JSON.stringify(payload);
  return JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text });
};

const GUARD: EntitySnapshot = { key: "c6-g3", position: { x: 2551, y: -28.6, z: 422.6 }, yaw: 1.67, pitch: 0, hp: 80, cooldown: 0, alerted: false };

describe("a guard's suspicion in the save (v20 to v21, G-174)", () => {
  it("is schema v21", () => {
    expect(SAVE_SCHEMA_VERSION).toBe(21);
  });

  it("a v20 save loads as it was, with every guard calm", () => {
    const loaded = decodeSave("v20", wrap({ ...snapshot({ entities: [GUARD] }), version: 20 }));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded.entities[0]).toEqual(GUARD);
    expect(findSchemaError(loaded as unknown as Record<string, unknown>)).toBeNull();
    expect(MIGRATIONS[20]!({ version: 20, entities: [] })).toEqual({ version: 21, entities: [] });
  });

  it("keeps a guard's suspicion through the codec", () => {
    const s: SaveSnapshot = snapshot({ entities: [{ ...GUARD, suspicion: 0.0229 }] });
    expect(decodeSave("slot", encodeSave(s)).entities[0]?.suspicion).toBe(0.0229);
  });

  it("refuses a suspicion that is not a share between nothing and sure", () => {
    const bad = (suspicion: unknown) => findSchemaError({ ...snapshot({ entities: [{ ...GUARD, suspicion } as EntitySnapshot] }) } as unknown as Record<string, unknown>);
    expect(bad(undefined)).toBeNull();
    expect(bad(1)).toBeNull();
    expect(bad(0.5)).toBeNull();
    for (const v of [0, -0.1, 1.01, Number.NaN, null, "0.5"]) expect(bad(v)).toBe("entity c6-g3 suspicion");
    expect(() => decodeSave("slot", encodeSave(snapshot({ entities: [{ ...GUARD, suspicion: 2 }] })))).toThrow();
  });
});
