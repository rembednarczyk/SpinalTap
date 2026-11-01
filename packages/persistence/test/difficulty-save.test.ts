import { describe, expect, it } from "vitest";
import { DIFFICULTY_PRESETS, NORMAL_DIFFICULTY, SAVE_SCHEMA_VERSION, type SaveSnapshot } from "@seki/core";
import { MIGRATIONS, checksum, decodeSave, encodeSave, findSchemaError } from "../src";
import { snapshot } from "./fixtures";

const wrap = (payload: unknown) => {
  const text = JSON.stringify(payload);
  return JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text });
};

/** A v17 save: today's snapshot without the difficulty. */
const v17 = (): Record<string, unknown> => {
  const s = snapshot();
  const { difficulty: _d, ...domain } = s.domain;
  return { ...s, version: 17, domain };
};

describe("the difficulty in the save (v17 to v18, ADR-0066)", () => {
  it("an old save plays on 'normal' and is a valid current snapshot", () => {
    expect(SAVE_SCHEMA_VERSION).toBe(18);
    const loaded = decodeSave("v17", wrap(v17()));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded.domain.difficulty).toEqual(NORMAL_DIFFICULTY);
    expect(findSchemaError(loaded as unknown as Record<string, unknown>)).toBeNull();
    // A broken one does not throw.
    expect(MIGRATIONS[17]!({ version: 17 })).toEqual({ version: 18, domain: { difficulty: NORMAL_DIFFICULTY } });
  });

  it("keeps the profile of a save through encoding", () => {
    const s: SaveSnapshot = snapshot({ domain: { ...snapshot().domain, difficulty: DIFFICULTY_PRESETS.hard } });
    expect(decodeSave("slot", encodeSave(s)).domain.difficulty).toEqual(DIFFICULTY_PRESETS.hard);
  });

  it("refuses a profile with a multiplier missing or out of range", () => {
    const s = snapshot();
    const bad = (difficulty: unknown) => findSchemaError({ ...s, domain: { ...s.domain, difficulty } } as unknown as Record<string, unknown>);
    expect(bad(DIFFICULTY_PRESETS.story)).toBeNull();
    expect(bad(undefined)).toBe("difficulty");
    expect(bad({ ...NORMAL_DIFFICULTY, npcHealth: 0 })).toBe("difficulty");
    expect(bad({ ...NORMAL_DIFFICULTY, awareness: "1" })).toBe("difficulty");
    const { snipeTell: _s, ...partial } = NORMAL_DIFFICULTY;
    expect(bad(partial)).toBe("difficulty");
  });
});
