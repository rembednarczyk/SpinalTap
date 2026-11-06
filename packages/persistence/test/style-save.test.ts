import { describe, expect, it } from "vitest";
import { type EntitySnapshot, INITIAL_PROGRESSION, PITY_AFTER, SAVE_SCHEMA_VERSION, STYLE_WINDOW, type SaveSnapshot, type StyleKind } from "@seki/core";
import { MIGRATIONS, checksum, decodeSave, encodeSave, findSchemaError } from "../src";
import { snapshot } from "./fixtures";

const wrap = (payload: unknown) => {
  const text = JSON.stringify(payload);
  return JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text });
};

type Json = Record<string, unknown>;

/** A v30 save: today's snapshot with a progression that has no style and no count of bad luck. */
const v30 = (progression: Json = { ...INITIAL_PROGRESSION, hacked: ["cam-1"] }): Json => {
  const s = snapshot();
  const { style: _s, unlucky: _u, ...old } = progression as Json & { style?: unknown; unlucky?: unknown };
  return { ...s, version: 30, domain: { ...s.domain, progression: old } };
};

const withProgression = (p: Json): Json => {
  const s = snapshot();
  return { ...s, domain: { ...s.domain, progression: { ...s.domain.progression, ...p } } };
};

describe("style and bad luck in the save (v30 to v31, ADR-0059 stage 6)", () => {
  it("gives an old save an empty style and a count of 0, and keeps the rest of the progression", () => {
    expect(SAVE_SCHEMA_VERSION).toBe(31);
    const migrated = MIGRATIONS[30]!(v30()) as { version: number; domain: SaveSnapshot["domain"] };
    expect(migrated.version).toBe(31);
    expect(migrated.domain.progression).toEqual({ ...INITIAL_PROGRESSION, hacked: ["cam-1"], style: [], unlucky: 0 });
    const loaded = decodeSave("v30", wrap(v30()));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded.domain.progression).toMatchObject({ style: [], unlucky: 0 });
  });

  it("a broken old save does not throw", () => {
    expect(MIGRATIONS[30]!({ version: 30 })).toEqual({ version: 31 });
    expect(MIGRATIONS[30]!({ version: 30, domain: { progression: null } })).toEqual({ version: 31, domain: { progression: null } });
  });

  it("keeps a style and a count of bad luck through a save", () => {
    const style: StyleKind[] = ["smg", "smg", "stealth", "quickhack", "melee"];
    const s = withProgression({ style, unlucky: 5 });
    expect(findSchemaError(s)).toBeNull();
    expect(decodeSave("x", wrap(s)).domain.progression).toMatchObject({ style, unlucky: 5 });
  });

  it("refuses a style past the window, an unknown kind, and bad luck past the protection", () => {
    expect(findSchemaError(withProgression({ style: Array.from({ length: STYLE_WINDOW }, () => "rifle") }))).toBeNull();
    expect(findSchemaError(withProgression({ style: Array.from({ length: STYLE_WINDOW + 1 }, () => "rifle") }))).toBe("progression style");
    expect(findSchemaError(withProgression({ style: ["bazooka"] }))).toBe("progression style");
    expect(findSchemaError(withProgression({ style: undefined }))).toBe("progression style");
    expect(findSchemaError(withProgression({ unlucky: PITY_AFTER }))).toBeNull();
    expect(findSchemaError(withProgression({ unlucky: PITY_AFTER + 1 }))).toBe("progression luck");
    expect(findSchemaError(withProgression({ unlucky: -1 }))).toBe("progression luck");
    expect(findSchemaError(withProgression({ unlucky: 1.5 }))).toBe("progression luck");
  });

  it("keeps the mark of an enemy whose fight is counted, and refuses anything but true", () => {
    const guard: EntitySnapshot = { key: "c3-g1", position: { x: 1, y: 0, z: 2 }, yaw: 0, pitch: 0, hp: 80, cooldown: 0, alerted: false, fought: true };
    expect(decodeSave("x", encodeSave(snapshot({ entities: [guard] }))).entities[0]?.fought).toBe(true);
    const bad = (fought: unknown) => findSchemaError(snapshot({ entities: [{ ...guard, fought } as EntitySnapshot] }) as unknown as Json);
    expect(bad(undefined)).toBeNull();
    for (const v of [false, 1, "yes", null]) expect(bad(v)).toBe("entity c3-g1 fought");
  });
});
