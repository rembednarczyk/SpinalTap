import { describe, expect, it } from "vitest";
import { ENEMY_TYPES, SAVE_SCHEMA_VERSION, type EntitySnapshot, type SaveSnapshot, npcWeapon } from "@seki/core";
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

  it("refuses more rounds than any NPC's magazine holds, and a reinforcement's more than its own weapon's", () => {
    const most = Math.max(...Object.values(ENEMY_TYPES).map((t) => npcWeapon(t.weapon).magazine));
    expect(errorOf({ gun: { ...GUN, loaded: most } })).toBeNull();
    expect(errorOf({ gun: { ...GUN, loaded: most + 1 } })).toBe("entity c1-g1 gun");
    const pistol = npcWeapon(ENEMY_TYPES.hebi_lookout.weapon).magazine;
    expect(pistol).toBeLessThan(most);
    const reinforced = (loaded: number) =>
      findSchemaError({
        ...snapshot({
          reinforcements: { sent: 1, wait: 0, people: [{ n: 1, since: 0, type: "hebi_lookout", home: SNIPER.position, state: { ...SNIPER, key: "security:1", gun: { ...GUN, loaded } } }] },
        }),
      } as unknown as Record<string, unknown>);
    expect(reinforced(pistol)).toBeNull();
    expect(reinforced(pistol + 1)).toBe("reinforcements");
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
