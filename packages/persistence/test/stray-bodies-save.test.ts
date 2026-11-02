import { describe, expect, it } from "vitest";
import { SAVE_SCHEMA_VERSION, type StrayBodySnapshot } from "@seki/core";
import { MIGRATIONS, checksum, decodeSave, encodeSave, findSchemaError } from "../src";
import { snapshot } from "./fixtures";

/** The bodies of a won mugging's muggers (G-233): schema v28 and the v27 -> v28 migration. */

const wrap = (payload: unknown) => {
  const text = JSON.stringify(payload);
  return JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text });
};

const DOWNED = { playerAt: { x: 529.4, y: 0.3, z: -55.8 }, fought: true, found: true, reported: false, dead: true, carried: true, hidden: false };
const BODY: StrayBodySnapshot = {
  type: "hebi_ganger",
  enforcer: false,
  home: { x: 530.8, y: 0.3, z: -54.6 },
  chunk: "c8_-1",
  state: { key: "stray:0", position: { x: 529.4, y: 0.3, z: -55.8 }, yaw: 1, pitch: 0, hp: null, cooldown: 0, alerted: false, downed: DOWNED },
};
const errorOf = (strayBodies: unknown): string | null => findSchemaError(snapshot({ strayBodies } as never) as unknown as Record<string, unknown>);

describe("the bodies of a won mugging in the save (v27 to v28, G-233)", () => {
  it("is schema v28 or later", () => {
    expect(SAVE_SCHEMA_VERSION).toBeGreaterThanOrEqual(28);
  });

  it("a v27 save changes only the version: it has no such bodies, as before", () => {
    const old = { version: 27, tick: 5, entities: [] };
    expect(MIGRATIONS[27]!(old)).toEqual({ ...old, version: 28 });
    const loaded = decodeSave("v27", wrap({ ...snapshot({}), version: 27 }));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded.strayBodies).toBeUndefined();
  });

  it("keeps them through the codec", () => {
    const strayBodies = [BODY, { ...BODY, enforcer: true, state: { ...BODY.state, key: "stray:1", hp: 0, downed: { ...DOWNED, dead: false, carried: false } } }];
    expect(decodeSave("slot", encodeSave(snapshot({ strayBodies }))).strayBodies).toEqual(strayBodies);
  });

  it("refuses what is not a body of one", () => {
    expect(errorOf(undefined)).toBeNull();
    expect(errorOf([BODY])).toBeNull();
    const { downed: _d, ...standing } = BODY.state;
    for (const bad of [
      {},
      [{ ...BODY, type: "dragon" }],
      [{ ...BODY, enforcer: 1 }],
      [{ ...BODY, home: null }],
      [{ ...BODY, chunk: 3 }],
      [{ ...BODY, state: standing }],
      [{ ...BODY, state: { ...BODY.state, key: "stray:1" } }],
      [{ ...BODY, state: { ...BODY.state, yaw: "x" } }],
      [BODY, BODY],
    ]) {
      expect(errorOf(bad)).toBe("stray bodies");
    }
  });
});
