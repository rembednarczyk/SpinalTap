import { describe, expect, it } from "vitest";
import { SAVE_SCHEMA_VERSION, type SaveSnapshot } from "@seki/core";
import { MIGRATIONS, checksum, decodeSave, encodeSave, findSchemaError } from "../src";
import { snapshot } from "./fixtures";

const wrap = (payload: unknown) => {
  const text = JSON.stringify(payload);
  return JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text });
};

/** A v47 save: today's snapshot without the gangs' standings. */
const v47 = (): Record<string, unknown> => {
  const s = snapshot();
  const { gangStandings: _g, ...domain } = s.domain;
  return { ...s, version: 47, domain };
};

describe("the gangs' standings in the save (v47 to v48, ADR-0091 stage 2)", () => {
  it("an old save loads with every gang calm everywhere and is a valid current snapshot", () => {
    expect(SAVE_SCHEMA_VERSION).toBeGreaterThanOrEqual(48);
    const loaded = decodeSave("v47", wrap(v47()));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded.domain.gangStandings).toEqual({});
    expect(findSchemaError(loaded as unknown as Record<string, unknown>)).toBeNull();
    // A save with no domain at all does not throw.
    expect(MIGRATIONS[47]!({ version: 47 })).toEqual({ version: 48, domain: { gangStandings: {} } });
  });

  it("keeps a grudge and a provocation through encoding", () => {
    const gangStandings = { "hebi:kanal": { grudge: 45, provokedUntil: 90_000 }, "hebi:targ": { grudge: 10, provokedUntil: null } };
    const s: SaveSnapshot = snapshot({ domain: { ...snapshot().domain, gangStandings } });
    expect(decodeSave("slot", encodeSave(s)).domain.gangStandings).toEqual(gangStandings);
  });

  it.each([
    ["an unknown faction", { "yakuza:kanal": { grudge: 1, provokedUntil: null } }],
    ["an unknown district", { "hebi:moon": { grudge: 1, provokedUntil: null } }],
    ["a key of three parts", { "hebi:kanal:x": { grudge: 1, provokedUntil: null } }],
    ["a grudge over 100", { "hebi:kanal": { grudge: 101, provokedUntil: null } }],
    ["a negative grudge", { "hebi:kanal": { grudge: -1, provokedUntil: null } }],
    ["a grudge that is no number", { "hebi:kanal": { grudge: "1", provokedUntil: null } }],
    ["a provocation that is no number", { "hebi:kanal": { grudge: 1, provokedUntil: "soon" } }],
    ["a standing that is no object", { "hebi:kanal": 3 }],
    ["standings that are a list", []],
  ])("refuses %s", (_name, gangStandings) => {
    const s = snapshot();
    expect(findSchemaError({ ...s, domain: { ...s.domain, gangStandings } } as unknown as Record<string, unknown>)).toBe("gang standings");
  });
});
