import { describe, expect, it } from "vitest";
import { MOST_AVOIDED, MOST_UNSTICK_STEPS, SAVE_SCHEMA_VERSION, type EntitySnapshot, type ReinforcementSnapshot, type WalkSnapshot } from "@seki/core";
import { MIGRATIONS, checksum, decodeSave, encodeSave, findSchemaError } from "../src";
import { snapshot } from "./fixtures";

/** A walker's stuck check (G-208): schema v27 and the v26 -> v27 migration. */

const wrap = (payload: unknown) => {
  const text = JSON.stringify(payload);
  return JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text });
};

const WALK: WalkSnapshot = {
  x: 415.6,
  z: -98.9,
  since: 880,
  unstickUntil: 930,
  side: -1,
  plan: { from: { x: 415.6, y: 0.07, z: -98.9 }, goal: { x: 420, y: 0.07, z: -96 }, avoid: [{ x: 415.9, y: 0.07, z: -98.4 }] },
};
const GUARD: EntitySnapshot = { key: "guard", position: { x: 392.5, y: 0, z: -29.5 }, yaw: 0, pitch: 0, hp: 80, cooldown: 0, alerted: true };
const ONE: ReinforcementSnapshot = {
  n: 1,
  since: 640,
  type: "hebi_ganger",
  home: { x: 423.5, y: 0.07, z: -99.8 },
  state: { key: "security:1", position: { x: 415.6, y: 0.07, z: -98.9 }, yaw: 0, pitch: 0, hp: 80, cooldown: 0, alerted: true, walk: WALK },
};

/** The fixture's save is made at tick 900. */
const TICK = 900;
const errorOf = (walk: unknown): string | null =>
  findSchemaError(snapshot({ tick: TICK, entities: [{ ...GUARD, walk } as unknown as EntitySnapshot] }) as unknown as Record<string, unknown>);

describe("a walker's stuck check in the save (v26 to v27, G-208)", () => {
  it("is schema v27 or later", () => {
    expect(SAVE_SCHEMA_VERSION).toBeGreaterThanOrEqual(27);
  });

  it("a v26 save changes only the version: every walker starts a new stretch, as before", () => {
    const old = { version: 26, tick: 5, entities: [GUARD] };
    expect(MIGRATIONS[26]!(old)).toEqual({ ...old, version: 27 });
    const loaded = decodeSave("v26", wrap({ ...snapshot({ entities: [GUARD] }), version: 26 }));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded.entities[0]!.walk).toBeUndefined();
  });

  it("keeps it through the codec, a keyed NPC's and a reinforcement's, with and without a repath", () => {
    const { plan: _p, ...noPlan } = WALK;
    const entities = [{ ...GUARD, walk: noPlan }];
    const reinforcements = { sent: 1, wait: 0, people: [ONE] };
    const loaded = decodeSave("slot", encodeSave(snapshot({ entities, reinforcements })));
    expect(loaded.entities).toEqual(entities);
    expect(loaded.reinforcements).toEqual(reinforcements);
  });

  it("refuses one that is not a stuck check", () => {
    expect(errorOf(WALK)).toBeNull();
    const { plan: _p, ...noPlan } = WALK;
    expect(errorOf(noPlan)).toBeNull();
    for (const bad of [
      { ...WALK, side: 0 },
      { ...WALK, since: -1 },
      { ...WALK, unstickUntil: 1.5 },
      { ...WALK, x: Number.NaN },
      { ...WALK, plan: { ...WALK.plan, goal: null } },
      { ...WALK, plan: { ...WALK.plan, avoid: [{ x: 1 }] } },
      { ...WALK, plan: { ...WALK.plan, avoid: Array.from({ length: MOST_AVOIDED + 1 }, () => ({ x: 0, y: 0, z: 0 })) } },
      [],
    ]) {
      expect(errorOf(bad)).toBe("entity guard walk");
    }
    const people = [{ ...ONE, state: { ...ONE.state, walk: { ...WALK, side: 2 } } }];
    expect(findSchemaError(snapshot({ reinforcements: { sent: 1, wait: 0, people } as never }) as unknown as Record<string, unknown>)).toBe("reinforcements");
  });

  it("refuses one from after the save, or getting unstuck longer than any walker does", () => {
    expect(errorOf({ ...WALK, since: TICK, unstickUntil: TICK + MOST_UNSTICK_STEPS })).toBeNull();
    expect(errorOf({ ...WALK, since: TICK + 1 })).toBe("entity guard walk");
    expect(errorOf({ ...WALK, unstickUntil: TICK + MOST_UNSTICK_STEPS + 1 })).toBe("entity guard walk");
    // Without it a loaded NPC would lean to the side for ever.
    expect(errorOf({ ...WALK, unstickUntil: 1e12 })).toBe("entity guard walk");
    const ahead = (walk: WalkSnapshot) =>
      findSchemaError(snapshot({ tick: TICK, reinforcements: { sent: 1, wait: 0, people: [{ ...ONE, state: { ...ONE.state, walk } }] } }) as unknown as Record<string, unknown>);
    expect(ahead(WALK)).toBeNull();
    expect(ahead({ ...WALK, unstickUntil: 1e12 })).toBe("reinforcements");
  });
});
