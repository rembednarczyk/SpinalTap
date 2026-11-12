import { describe, expect, it } from "vitest";
import { SAVE_SCHEMA_VERSION, type EntitySnapshot, type WalkSnapshot } from "@seki/core";
import { MIGRATIONS, decodeSave, encodeSave, findSchemaError } from "../src";
import { snapshot } from "./fixtures";

/** The goal of a chasing ganger's wide way round a long barrier (G-625): schema v37 and the v36 -> v37 migration. */

const WALK: WalkSnapshot = { x: 2358.7, z: 449.1, since: 880, unstickUntil: 0, side: 1, chase: { x: 2359.6, y: -28.4, z: 443.7 } };
const GUARD: EntitySnapshot = { key: "guard", position: { x: 2358.7, y: -28.4, z: 449.1 }, yaw: 0, pitch: 0, hp: 80, cooldown: 0, alerted: true, walk: WALK };
const errorOf = (walk: unknown): string | null =>
  findSchemaError(snapshot({ tick: 900, entities: [{ ...GUARD, walk } as unknown as EntitySnapshot] }) as unknown as Record<string, unknown>);

describe("a chase's wide way in the save (v36 to v37, G-625)", () => {
  it("is schema v37 or later", () => {
    expect(SAVE_SCHEMA_VERSION).toBeGreaterThanOrEqual(37);
  });

  it("a v36 save changes only the version: a chase plans its wide way on its first step, if it needs one", () => {
    const old = { version: 36, tick: 5, entities: [{ ...GUARD, walk: { ...WALK, chase: undefined } }] };
    expect(MIGRATIONS[36]!(old)).toEqual({ ...old, version: 37 });
  });

  it("keeps it through the codec", () => {
    const loaded = decodeSave("slot", encodeSave(snapshot({ entities: [GUARD] })));
    expect(loaded.entities).toEqual([GUARD]);
  });

  it("refuses one that is not a point", () => {
    expect(errorOf(WALK)).toBeNull();
    for (const bad of [{ ...WALK, chase: null }, { ...WALK, chase: { x: 1, z: 2 } }, { ...WALK, chase: { x: Number.NaN, y: 0, z: 0 } }]) {
      expect(errorOf(bad)).toBe("entity guard walk");
    }
  });
});
