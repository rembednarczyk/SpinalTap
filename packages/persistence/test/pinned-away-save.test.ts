import { describe, expect, it } from "vitest";
import { SAVE_SCHEMA_VERSION, type EntitySnapshot, type SaveSnapshot } from "@seki/core";
import { MIGRATIONS, checksum, decodeSave, encodeSave, findSchemaError } from "../src";
import { snapshot } from "./fixtures";

/** An AI pinned in the world while its chunk sleeps (G-188): schema v24 and the v23 -> v24 migration. */

const wrap = (payload: unknown) => {
  const text = JSON.stringify(payload);
  return JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text });
};

const GUARD: EntitySnapshot = {
  key: "c3-g1",
  position: { x: 2484, y: -28.6, z: 418 },
  yaw: 1.57,
  pitch: 0,
  hp: 120,
  cooldown: 0,
  alerted: true,
  lastKnown: { x: 60, y: 0, z: 40 },
  search: 0,
  lost: 12.5,
};

describe("a pinned AI's time away in the save (v23 to v24, G-188)", () => {
  it("is schema v24 or later", () => {
    expect(SAVE_SCHEMA_VERSION).toBeGreaterThanOrEqual(24);
  });

  it("a v23 save loads as it was, with nobody marked pinned", () => {
    const loaded = decodeSave("v23", wrap({ ...snapshot({ entities: [GUARD] }), version: 23 }));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded.entities[0]).toEqual(GUARD);
    expect(findSchemaError(loaded as unknown as Record<string, unknown>)).toBeNull();
    expect(MIGRATIONS[23]!({ version: 23, entities: [] })).toEqual({ version: 24, entities: [] });
  });

  it("keeps the time away through the codec, 0 too", () => {
    for (const away of [0, 12.25]) {
      const s: SaveSnapshot = snapshot({ entities: [{ ...GUARD, away }] });
      expect(decodeSave("slot", encodeSave(s)).entities[0]?.away).toBe(away);
    }
  });

  it("refuses a time away that is not a number of seconds", () => {
    const bad = (away: unknown) => findSchemaError({ ...snapshot({ entities: [{ ...GUARD, away } as EntitySnapshot] }) } as unknown as Record<string, unknown>);
    expect(bad(undefined)).toBeNull();
    expect(bad(0)).toBeNull();
    for (const v of [-0.5, Number.NaN, null, "3"]) expect(bad(v)).toBe("entity c3-g1 away");
  });
});
