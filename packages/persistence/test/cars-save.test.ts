import { describe, expect, it } from "vitest";
import { type CarSnapshot, SAVE_SCHEMA_VERSION } from "@seki/core";
import { MIGRATIONS, checksum, decodeSave, encodeSave, findSchemaError } from "../src";
import { snapshot } from "./fixtures";

/** The player's cars in the save (ADR-0097): schema v52 and the v51 -> v52 migration. */

const wrap = (payload: unknown) => {
  const text = JSON.stringify(payload);
  return JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text });
};

const wheel = { omega: 12.5, compression: 0.06, alpha: 0.01 };
const CAR: CarSnapshot = {
  model: "sedan",
  tint: 41,
  pos: { x: 820.4, y: -20.1, z: 351.9 },
  q: { w: 0.98, x: 0, y: 0.199, z: 0 },
  vel: { x: 1.2, y: 0, z: 4.8 },
  ang: { x: 0, y: 0.1, z: 0 },
  wheels: [wheel, wheel, wheel, wheel],
  rpm: 2400,
  gear: 2,
  shift: 0,
  controls: { throttle: 0.6, brake: 0, steer: -0.2, handbrake: false },
  asleep: false,
  still: 0,
  driving: true,
};
const errorOf = (cars: unknown): string | null => findSchemaError(snapshot({ cars } as never) as unknown as Record<string, unknown>);

describe("the player's cars in the save (v51 to v52, ADR-0097)", () => {
  it("is schema v52 or later", () => {
    expect(SAVE_SCHEMA_VERSION).toBeGreaterThanOrEqual(52);
  });

  it("a v51 save changes only the version: it has no cars, she loads on foot", () => {
    const old = { version: 51, tick: 5, entities: [] };
    expect(MIGRATIONS[51]!(old)).toEqual({ ...old, version: 52 });
    const loaded = decodeSave("v51", wrap({ ...snapshot({}), version: 51 }));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded.cars).toBeUndefined();
  });

  it("keeps them through the codec: the one she drives, getting out of it, and one she left", () => {
    const cars = [{ ...CAR, driving: undefined, hold: { x: 800, y: -20, z: 340 } }, { ...CAR, act: { kind: "exit" as const, t: 1.2 } }].map((c) => JSON.parse(JSON.stringify(c)) as CarSnapshot);
    expect(decodeSave("slot", encodeSave(snapshot({ cars }))).cars).toEqual(cars);
  });

  it("refuses a car that cannot be: no trolleybus, a whole attitude, four wheels, controls in range, one driven at most", () => {
    expect(errorOf([CAR])).toBeNull();
    expect(errorOf([{ ...CAR, model: "trolleybus" }])).toBe("car model");
    expect(errorOf([{ ...CAR, q: { w: 2, x: 0, y: 0, z: 0 } }])).toBe("car attitude");
    expect(errorOf([{ ...CAR, wheels: [wheel] }])).toBe("car wheels");
    expect(errorOf([{ ...CAR, controls: { ...CAR.controls, throttle: 3 } }])).toBe("car controls");
    expect(errorOf([CAR, CAR])).toBe("cars driven");
    expect(errorOf([{ ...CAR, driving: undefined, act: { kind: "enter", t: 0 } }])).toBe("car act");
    expect(errorOf("cars")).toBe("cars");
  });

  it("keeps a car's damage (v53, ADR-0097 §5): a v52 save changes only the version, its cars whole; damage within 0..1", () => {
    const old = { version: 52, tick: 5, entities: [] };
    expect(MIGRATIONS[52]!(old)).toEqual({ ...old, version: 53 });
    const cars = [{ ...CAR, damage: 0.45 }].map((c) => JSON.parse(JSON.stringify(c)) as CarSnapshot);
    expect(decodeSave("slot", encodeSave(snapshot({ cars }))).cars?.[0]?.damage).toBe(0.45);
    expect(errorOf([{ ...CAR, damage: 1 }])).toBeNull();
    expect(errorOf([{ ...CAR, damage: 1.5 }])).toBe("car damage");
    expect(errorOf([{ ...CAR, damage: -0.1 }])).toBe("car damage");
  });
});
