import { describe, expect, it } from "vitest";
import { DIFFICULTY_PRESETS, NORMAL_DIFFICULTY, SAVE_SCHEMA_VERSION, type SaveSnapshot } from "@seki/core";
import { MIGRATIONS, checksum, decodeSave, encodeSave, findSchemaError } from "../src";
import { snapshot } from "./fixtures";

/** A difficulty asked for in a fight, waiting for its end, in the save (G-171): schema v20 and the v19 -> v20 migration. */

const wrap = (payload: unknown) => {
  const text = JSON.stringify(payload);
  return JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text });
};

describe("a waiting difficulty in the save (v19 to v20, G-171)", () => {
  it("is schema v20", () => {
    expect(SAVE_SCHEMA_VERSION).toBe(20);
  });

  it("a v19 save loads as it was, with no profile waiting", () => {
    const today = snapshot();
    const loaded = decodeSave("v19", wrap({ ...today, version: 19 }));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded.pendingDifficulty).toBeUndefined();
    expect(loaded.domain.difficulty).toEqual(NORMAL_DIFFICULTY);
    expect(findSchemaError(loaded as unknown as Record<string, unknown>)).toBeNull();
    expect(MIGRATIONS[19]!({ version: 19, entities: [] })).toEqual({ version: 20, entities: [] });
  });

  it("keeps a waiting profile through the codec, next to the one in force", () => {
    const s: SaveSnapshot = snapshot({ pendingDifficulty: DIFFICULTY_PRESETS.hard });
    const back = decodeSave("slot", encodeSave(s));
    expect(back.pendingDifficulty).toEqual(DIFFICULTY_PRESETS.hard);
    expect(back.domain.difficulty).toEqual(NORMAL_DIFFICULTY);
  });

  it("refuses a waiting profile with a multiplier missing or out of range", () => {
    const bad = (pendingDifficulty: unknown) => findSchemaError({ ...snapshot(), pendingDifficulty } as unknown as Record<string, unknown>);
    expect(bad(undefined)).toBeNull();
    expect(bad(DIFFICULTY_PRESETS.story)).toBeNull();
    expect(bad(null)).toBe("pending difficulty");
    expect(bad({ ...NORMAL_DIFFICULTY, npcHealth: 0 })).toBe("pending difficulty");
    expect(bad({ ...NORMAL_DIFFICULTY, awareness: "1" })).toBe("pending difficulty");
    const { snipeTell: _s, ...partial } = NORMAL_DIFFICULTY;
    expect(bad(partial)).toBe("pending difficulty");
    const edited = snapshot({ pendingDifficulty: { ...DIFFICULTY_PRESETS.hard, damageTaken: 0.01 } });
    expect(() => decodeSave("slot", encodeSave(edited))).toThrow();
  });
});
