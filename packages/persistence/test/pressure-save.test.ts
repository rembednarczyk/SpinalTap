import { describe, expect, it } from "vitest";
import { DIFFICULTY_PRESETS, type DifficultyProfile, NORMAL_DIFFICULTY, SAVE_SCHEMA_VERSION } from "@seki/core";
import { MIGRATIONS, checksum, decodeSave, findSchemaError } from "../src";
import { snapshot } from "./fixtures";

/** The difficulty's pressure in the save (ADR-0089 stage 5): schema v47 and the v46 -> v47 migration. */

const wrap = (payload: unknown) => {
  const text = JSON.stringify(payload);
  return JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text });
};
const six = (p: DifficultyProfile): Omit<DifficultyProfile, "npcPressure"> => {
  const { npcPressure: _p, ...rest } = p;
  return rest;
};

describe("the difficulty's pressure in the save (v46 to v47, ADR-0089 stage 5)", () => {
  it("is schema v47 or later", () => {
    expect(SAVE_SCHEMA_VERSION).toBeGreaterThanOrEqual(47);
  });

  it("a preset stays the preset: Story 0.6, Normal 1, Hard 1.5; a custom profile gets 1", () => {
    for (const p of [DIFFICULTY_PRESETS.story, DIFFICULTY_PRESETS.normal, DIFFICULTY_PRESETS.hard]) {
      const old = { version: 46, domain: { difficulty: six(p) } };
      expect(MIGRATIONS[46]!(old)).toEqual({ version: 47, domain: { difficulty: p } });
    }
    const custom = { ...six(DIFFICULTY_PRESETS.hard), awareness: 2 };
    expect(MIGRATIONS[46]!({ version: 46, domain: { difficulty: custom } })).toEqual({ version: 47, domain: { difficulty: { ...custom, npcPressure: 1 } } });
  });

  it("the profile waiting for a fight's end gets its pressure too", () => {
    const old = { version: 46, pendingDifficulty: six(DIFFICULTY_PRESETS.story), domain: { difficulty: six(NORMAL_DIFFICULTY) } };
    expect(MIGRATIONS[46]!(old)).toEqual({ version: 47, pendingDifficulty: DIFFICULTY_PRESETS.story, domain: { difficulty: NORMAL_DIFFICULTY } });
  });

  it("a v46 Hard save loads as a valid current snapshot on Hard", () => {
    const s = snapshot();
    const loaded = decodeSave("v46", wrap({ ...s, version: 46, domain: { ...s.domain, difficulty: six(DIFFICULTY_PRESETS.hard) } }));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded.domain.difficulty).toEqual(DIFFICULTY_PRESETS.hard);
    expect(findSchemaError(loaded as unknown as Record<string, unknown>)).toBeNull();
  });
});
