import { describe, expect, it } from "vitest";
import { SAVE_SCHEMA_VERSION, type EntitySnapshot, type SaveSnapshot } from "@seki/core";
import { MIGRATIONS, checksum, decodeSave, encodeSave, findSchemaError } from "../src";
import { snapshot } from "./fixtures";

/** An NPC's gun and a sniper's state mid-fight (G-185): schema v25 and the v24 -> v25 migration. */

const wrap = (payload: unknown) => {
  const text = JSON.stringify(payload);
  return JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text });
};

const SNIPER: EntitySnapshot = {
  key: "c1-g1",
  position: { x: 2560, y: -20.6, z: 410 },
  yaw: 1.2,
  pitch: 0,
  hp: 120,
  cooldown: 0,
  alerted: true,
  lastKnown: { x: 2576, y: -28.6, z: 421 },
  search: 0,
  lost: 0,
};

const GUN = { loaded: 4, reloading: 0, drawing: 0, bloom: 0.0087 };
const AIM = { phase: "aim", timer: 0.0167, perch: 1 } as const;

const errorOf = (e: Record<string, unknown>) => findSchemaError({ ...snapshot({ entities: [{ ...SNIPER, ...e } as EntitySnapshot] }) } as unknown as Record<string, unknown>);

describe("an NPC's gun and a sniper's aim in the save (v24 to v25, G-185)", () => {
  it("is schema v25 or later", () => {
    expect(SAVE_SCHEMA_VERSION).toBeGreaterThanOrEqual(25);
  });

  it("a v24 save loads as it was, every gun at rest and every sniper idle", () => {
    const loaded = decodeSave("v24", wrap({ ...snapshot({ entities: [SNIPER] }), version: 24 }));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded.entities[0]).toEqual(SNIPER);
    expect(findSchemaError(loaded as unknown as Record<string, unknown>)).toBeNull();
    expect(MIGRATIONS[24]!({ version: 24, entities: [] })).toEqual({ version: 25, entities: [] });
  });

  it("keeps the gun and the aim through the codec", () => {
    const s: SaveSnapshot = snapshot({ entities: [{ ...SNIPER, gun: GUN, sniper: AIM }] });
    const back = decodeSave("slot", encodeSave(s)).entities[0];
    expect(back?.gun).toEqual(GUN);
    expect(back?.sniper).toEqual(AIM);
  });

  it("refuses a gun or a sniper that is not one", () => {
    expect(errorOf({ gun: GUN, sniper: AIM })).toBeNull();
    for (const gun of [null, { ...GUN, loaded: -1 }, { ...GUN, loaded: 2.5 }, { ...GUN, reloading: -0.1 }, { ...GUN, bloom: Number.NaN }, { loaded: 3 }]) {
      expect(errorOf({ gun })).toBe("entity c1-g1 gun");
    }
    for (const sniper of [null, { ...AIM, phase: "sleep" }, { ...AIM, timer: -1 }, { ...AIM, perch: 0.5 }, { ...AIM, perch: -1 }]) {
      expect(errorOf({ sniper })).toBe("entity c1-g1 sniper");
    }
  });
});
