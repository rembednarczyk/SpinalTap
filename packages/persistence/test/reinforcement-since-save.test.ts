import { describe, expect, it } from "vitest";
import { SAVE_SCHEMA_VERSION, type ReinforcementSnapshot } from "@seki/core";
import { MIGRATIONS, checksum, decodeSave, encodeSave, findSchemaError } from "../src";
import { snapshot } from "./fixtures";

/** The tick each of the heat's reinforcements came in at (G-202): schema v26 and the v25 -> v26 migration. */

const wrap = (payload: unknown) => {
  const text = JSON.stringify(payload);
  return JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text });
};

const ONE: ReinforcementSnapshot = {
  n: 1,
  since: 640,
  type: "hebi_ganger",
  home: { x: 423.5, y: 0.07, z: -99.8 },
  state: { key: "security:1", position: { x: 421, y: 0.07, z: -98 }, yaw: 0, pitch: 0, hp: 80, cooldown: 0, alerted: true },
};
const TWO: ReinforcementSnapshot = { ...ONE, n: 2, since: 700, state: { ...ONE.state, key: "security:2" } };

/** As a v25 save had them: no tick. */
const older = (p: ReinforcementSnapshot): Omit<ReinforcementSnapshot, "since"> => {
  const { since: _since, ...rest } = p;
  return rest;
};

describe("the tick the heat's reinforcements came in at, in the save (v25 to v26, G-202)", () => {
  it("is schema v26 or later", () => {
    expect(SAVE_SCHEMA_VERSION).toBeGreaterThanOrEqual(26);
  });

  it("a v25 save's reinforcements come in at the save's tick", () => {
    const s = snapshot({ tick: 900 });
    const v25 = { ...s, version: 25, reinforcements: { sent: 2, wait: 1.5, people: [older(ONE), older(TWO)] } };
    const loaded = decodeSave("v25", wrap(v25));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded.reinforcements).toEqual({ sent: 2, wait: 1.5, people: [{ ...ONE, since: 900 }, { ...TWO, since: 900 }] });
    expect(findSchemaError(loaded as unknown as Record<string, unknown>)).toBeNull();
  });

  it("a v25 save with none sent changes only the version", () => {
    expect(MIGRATIONS[25]!({ version: 25, tick: 5, entities: [] })).toEqual({ version: 26, tick: 5, entities: [] });
    const loaded = decodeSave("v25", wrap({ ...snapshot(), version: 25 }));
    expect(loaded.reinforcements).toBeUndefined();
  });

  it("keeps the tick through the codec", () => {
    const reinforcements = { sent: 2, wait: 0, people: [ONE, TWO] };
    expect(decodeSave("slot", encodeSave(snapshot({ reinforcements }))).reinforcements).toEqual(reinforcements);
  });
});
