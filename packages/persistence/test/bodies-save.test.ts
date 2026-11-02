import { describe, expect, it } from "vitest";
import { type BodySnapshot, SAVE_SCHEMA_VERSION } from "@seki/core";
import { MIGRATIONS, checksum, decodeSave, encodeSave, findSchemaError } from "../src";
import { snapshot } from "./fixtures";

/** Bodies in the save (ADR-0065, stage 3): schema v19 and the v18 -> v19 migration. */

const wrap = (payload: unknown) => {
  const text = JSON.stringify(payload);
  return JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text });
};

const BODY: BodySnapshot = { playerAt: { x: -2, y: 0, z: 38.8 }, fought: false, found: true, reported: false, dead: false, carried: true, hidden: false };

describe("bodies in the save (v18 to v19, ADR-0065)", () => {
  it("is schema v19 or later", () => {
    // v20 (G-171, a waiting difficulty) walks on from here with no change to the bodies.
    expect(SAVE_SCHEMA_VERSION).toBeGreaterThanOrEqual(19);
  });

  it("a v18 save loads as it was: nobody in it lies knocked out", () => {
    const today = snapshot();
    const loaded = decodeSave("v18", wrap({ ...today, version: 18 }));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded.entities).toEqual(today.entities);
    expect(loaded.entities.some((e) => e.downed)).toBe(false);
    expect(MIGRATIONS[18]!({ version: 18, entities: [] })).toEqual({ version: 19, entities: [] });
  });

  it("keeps a carried, a hidden and a dead body through the codec", () => {
    const s = snapshot({
      entities: [
        ...snapshot().entities,
        { key: "carried", position: { x: 1, y: 0, z: -3.5 }, yaw: 0, pitch: 0, hp: 80, cooldown: 0, alerted: false, downed: BODY },
        { key: "hidden", position: { x: 4, y: 0, z: 2 }, yaw: 0, pitch: 0, hp: 80, cooldown: 0, alerted: false, downed: { ...BODY, carried: false, hidden: true } },
        { key: "dead", position: { x: 5, y: 0, z: 2 }, yaw: 0, pitch: 0, hp: null, cooldown: 0, alerted: false, downed: { ...BODY, carried: false, dead: true } },
      ],
    });
    expect(findSchemaError(s as unknown as Record<string, unknown>)).toBeNull();
    const back = decodeSave("slot", encodeSave(s));
    expect(back.entities.map((e) => e.downed ?? null)).toEqual(s.entities.map((e) => e.downed ?? null));
  });

  it("refuses a body with a broken shape", () => {
    const broken = snapshot({ entities: [{ key: "x", position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, hp: 1, cooldown: 0, alerted: false, downed: { ...BODY, hidden: "yes" } as unknown as BodySnapshot }] });
    expect(findSchemaError(broken as unknown as Record<string, unknown>)).toBe("entity x downed");
  });
});
