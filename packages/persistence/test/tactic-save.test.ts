import { describe, expect, it } from "vitest";
import { type EntitySnapshot, SAVE_SCHEMA_VERSION, type TacticSnapshot } from "@seki/core";
import { MIGRATIONS, checksum, decodeSave, encodeSave, findSchemaError } from "../src";
import { snapshot } from "./fixtures";

/** A gunner's burst and sidestep in the save (ADR-0089 stage 3): schema v45 and the v44 -> v45 migration. */

const TACTIC: TacticSnapshot = { shots: 3, side: -1, stride: 1.8, rest: 0.9 };
const GUARD: EntitySnapshot = { key: "guard", position: { x: 392.5, y: -0.25, z: -29.5 }, yaw: 3.1, pitch: 0, hp: 80, cooldown: 0.4, alerted: true, tactic: TACTIC };

const wrap = (payload: unknown) => {
  const text = JSON.stringify(payload);
  return JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text });
};
const errorOf = (...entities: EntitySnapshot[]) => findSchemaError(snapshot({ entities }) as unknown as Record<string, unknown>);

describe("a gunner's burst and sidestep in the save (v44 to v45, ADR-0089 stage 3)", () => {
  it("is schema v45 or later", () => {
    expect(SAVE_SCHEMA_VERSION).toBeGreaterThanOrEqual(45);
  });

  it("a v44 save changes only the version: its gunners start a whole burst", () => {
    const old = { version: 44, tick: 5, entities: [{ ...GUARD, tactic: undefined }] };
    expect(MIGRATIONS[44]!(old)).toEqual({ ...old, version: 45 });
    const loaded = decodeSave("v44", wrap({ ...snapshot(), version: 44 }));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(findSchemaError(loaded as unknown as Record<string, unknown>)).toBeNull();
  });

  it("keeps the burst and the sidestep through the codec, mid-sidestep and standing", () => {
    for (const tactic of [TACTIC, { shots: 1, side: 1 as const, stride: 0, rest: 0 }]) {
      const entities = [{ ...GUARD, tactic }];
      expect(errorOf(...entities)).toBeNull();
      expect(decodeSave("slot", encodeSave(snapshot({ entities }))).entities).toEqual(entities);
    }
  });

  it("a v45 save changes only the version: its gunners take the tokens again (v45 to v46, ADR-0089 stage 4)", () => {
    const old = { version: 45, tick: 5, entities: [GUARD] };
    expect(MIGRATIONS[45]!(old)).toEqual({ ...old, version: 46 });
  });

  it("keeps an attack token through the codec and refuses one taken or fired on after the save", () => {
    const entities = [{ ...GUARD, tactic: { ...TACTIC, token: { since: 2, last: 5 } } }];
    expect(errorOf(...entities)).toBeNull();
    expect(decodeSave("slot", encodeSave(snapshot({ entities }))).entities).toEqual(entities);
    for (const token of [{ since: 4, last: 3 }, { since: -1, last: 3 }, { since: 1, last: 999_999 }, { since: 1.5, last: 3 }]) {
      expect(errorOf({ ...GUARD, tactic: { ...TACTIC, token } })).toBe("entity guard tactic");
    }
  });

  it("refuses a burst or a sidestep that is not one", () => {
    const bad: unknown[] = [
      { ...TACTIC, shots: 0 },
      { ...TACTIC, shots: 1.5 },
      { ...TACTIC, shots: 99 },
      { ...TACTIC, side: 0 },
      { ...TACTIC, stride: -0.1 },
      { ...TACTIC, stride: 6.5 },
      { ...TACTIC, rest: Number.NaN },
      null,
    ];
    for (const tactic of bad) expect(errorOf({ ...GUARD, tactic: tactic as TacticSnapshot })).toBe("entity guard tactic");
  });
});
