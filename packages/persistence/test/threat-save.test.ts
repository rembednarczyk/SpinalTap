import { describe, expect, it } from "vitest";
import { SAVE_SCHEMA_VERSION } from "@seki/core";
import { MIGRATIONS, checksum, decodeSave, encodeSave, findSchemaError } from "../src";
import { snapshot } from "./fixtures";

/** The last shot at the player in the save (G-901): schema v43 and the v42 -> v43 migration. */

const wrap = (payload: unknown) => {
  const text = JSON.stringify(payload);
  return JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text });
};
const asJson = (v: unknown) => v as Record<string, unknown>;

describe("the last threat in the save (v42 to v43, G-901)", () => {
  it("is schema v43 or later", () => {
    expect(SAVE_SCHEMA_VERSION).toBeGreaterThanOrEqual(43);
  });

  it("a v42 save loads with none, only the version changed", () => {
    expect(MIGRATIONS[42]!({ version: 42, tick: 5, entities: [] })).toEqual({ version: 43, tick: 5, entities: [] });
    const loaded = decodeSave("v42", wrap({ ...snapshot(), version: 42 }));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded.lastThreat).toBeUndefined();
    expect(findSchemaError(asJson(loaded))).toBeNull();
  });

  it("keeps the tick and the shooter's key through the codec, with or without one", () => {
    for (const lastThreat of [{ tick: 880, source: "guard" }, { tick: 880, source: "security:2@640" }, { tick: 900 }]) {
      expect(decodeSave("slot", encodeSave(snapshot({ tick: 900, lastThreat }))).lastThreat).toEqual(lastThreat);
    }
  });

  it("refuses a threat after the save's tick or a shooter that is no key", () => {
    expect(findSchemaError(asJson(snapshot({ tick: 900, lastThreat: { tick: 901 } })))).toBe("last threat");
    expect(findSchemaError(asJson(snapshot({ tick: 900, lastThreat: { tick: 1.5 } })))).toBe("last threat");
    expect(findSchemaError(asJson({ ...snapshot({ tick: 900 }), lastThreat: { tick: 880, source: 7 } }))).toBe("last threat");
    expect(findSchemaError(asJson({ ...snapshot({ tick: 900 }), lastThreat: null }))).toBe("last threat");
  });
});
