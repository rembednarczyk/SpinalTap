import { describe, expect, it } from "vitest";
import { MOST_PLAN_STEPS, SAVE_SCHEMA_VERSION, type EntitySnapshot, type WalkSnapshot } from "@seki/core";
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

/** The next wide way of a chase while it is made a slice a step (G-643): schema v38 and the v37 -> v38 migration. */
describe("a chase's next wide way in the save (v37 to v38, G-643)", () => {
  const NEXT: WalkSnapshot = { ...WALK, chaseNext: { goal: { x: 2352.4, y: -28.4, z: 431.6 }, ready: 930 } };

  it("is schema v38 or later", () => {
    expect(SAVE_SCHEMA_VERSION).toBeGreaterThanOrEqual(38);
  });

  it("a v37 save changes only the version: a chase walks the way it has, or asks for one on its first step", () => {
    const old = { version: 37, tick: 5, entities: [GUARD] };
    expect(MIGRATIONS[37]!(old)).toEqual({ ...old, version: 38 });
  });

  it("keeps it through the codec", () => {
    const guard = { ...GUARD, walk: NEXT };
    expect(decodeSave("slot", encodeSave(snapshot({ tick: 900, entities: [guard] }))).entities).toEqual([guard]);
  });

  it("refuses one that is not a point and a step at most MOST_PLAN_STEPS past the save's", () => {
    expect(errorOf(NEXT)).toBeNull();
    expect(errorOf({ ...NEXT, chaseNext: { ...NEXT.chaseNext, ready: 900 + MOST_PLAN_STEPS } })).toBeNull();
    for (const chaseNext of [null, { goal: { x: 1, z: 2 }, ready: 930 }, { goal: NEXT.chaseNext!.goal, ready: 930.5 }, { goal: NEXT.chaseNext!.goal, ready: -1 }, { goal: NEXT.chaseNext!.goal, ready: 901 + MOST_PLAN_STEPS }]) {
      expect(errorOf({ ...NEXT, chaseNext })).toBe("entity guard walk");
    }
  });
});
