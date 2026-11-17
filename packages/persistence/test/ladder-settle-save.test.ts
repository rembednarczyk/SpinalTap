import { describe, expect, it } from "vitest";
import { type EntitySnapshot, type LadderSettleSnapshot, SAVE_SCHEMA_VERSION, type StanceSnapshot } from "@seki/core";
import { MIGRATIONS, checksum, decodeSave, encodeSave, findSchemaError } from "../src";
import { snapshot } from "./fixtures";

/** The step onto a ladder's rungs in the save (G-913): schema v44 and the v43 -> v44 migration. */

const STANCE: StanceSnapshot = { crouched: false, crouch: 0, sprinting: false, aiming: false, aim: 0, holstered: false, reloading: 0, drawing: 0, bloom: 0, jump: { coyote: 0, buffer: 0 } };
const SWING: LadderSettleSnapshot = { ladder: "w3-hatch", from: { x: 2564.4, y: -18.2, z: 439.9 }, fromYaw: 3.14, y: -19, over: true, duration: 0.6, t: 0.35 };
const PLAYER: EntitySnapshot = { key: "player", position: { x: 2564, y: -18.4, z: 439.3 }, yaw: 1.2, pitch: 0, hp: 100, cooldown: 0, alerted: false, stance: { ...STANCE, ladderSettle: SWING } };

const wrap = (payload: unknown) => {
  const text = JSON.stringify(payload);
  return JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text });
};
const errorOf = (...entities: EntitySnapshot[]) => findSchemaError(snapshot({ entities }) as unknown as Record<string, unknown>);

describe("the step onto a ladder's rungs in the save (v43 to v44, G-913)", () => {
  it("is schema v44 or later", () => {
    expect(SAVE_SCHEMA_VERSION).toBeGreaterThanOrEqual(44);
  });

  it("a v43 save changes only the version: one made in the step loads hanging where she was", () => {
    const old = { version: 43, tick: 5, entities: [{ ...PLAYER, stance: STANCE }] };
    expect(MIGRATIONS[43]!(old)).toEqual({ ...old, version: 44 });
    const loaded = decodeSave("v43", wrap({ ...snapshot(), version: 43 }));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(findSchemaError(loaded as unknown as Record<string, unknown>)).toBeNull();
  });

  it("keeps the step through the codec, from the top and at the foot", () => {
    for (const ladderSettle of [SWING, { ...SWING, ladder: "targ-escape-1", over: false, duration: 0.3, t: 0 }]) {
      const entities = [{ ...PLAYER, stance: { ...STANCE, ladderSettle } }];
      expect(errorOf(...entities)).toBeNull();
      expect(decodeSave("slot", encodeSave(snapshot({ entities }))).entities).toEqual(entities);
    }
  });

  it("refuses a step that is not one", () => {
    const bad: unknown[] = [
      { ...SWING, ladder: 3 },
      { ...SWING, from: { x: 1, z: 2 } },
      { ...SWING, fromYaw: Number.NaN },
      { ...SWING, over: "yes" },
      { ...SWING, duration: 0 },
      { ...SWING, t: -0.1 },
      { ...SWING, t: 0.7 },
      null,
    ];
    for (const ladderSettle of bad) expect(errorOf({ ...PLAYER, stance: { ...STANCE, ladderSettle: ladderSettle as LadderSettleSnapshot } })).toBe("entity player stance");
  });
});
