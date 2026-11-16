import { describe, expect, it } from "vitest";
import { type EntitySnapshot, type MeleeSnapshot, SAVE_SCHEMA_VERSION, type StanceSnapshot } from "@seki/core";
import { MIGRATIONS, decodeSave, encodeSave, findSchemaError } from "../src";
import { snapshot } from "./fixtures";

/** What a fight leaves between two steps (G-883): schema v41 and the v40 -> v41 migration. */

const PLAYER: EntitySnapshot = { key: "player", position: { x: -2000, y: 0, z: -2016 }, yaw: 0.1, pitch: 0, hp: 80, cooldown: 0.05, alerted: false };
const BRAWLER: EntitySnapshot = { key: "floor-brawler", position: { x: -2001, y: 0, z: -2014 }, yaw: 3.2, pitch: 0, hp: 25, cooldown: 0.4, alerted: true };

const VELOCITY = { x: 2.1, y: 0, z: -0.3 };
const SWING: MeleeSnapshot = { phase: "windup", timer: 0.083, strike: 1, combo: 0.45, queued: false, stagger: 0, stunned: false, guard: false, parry: 0, parryCooldown: 0.35, knock: { x: -2.2, z: 1.4, time: 0.1 } };
const STANCE: StanceSnapshot = {
  crouched: true,
  crouch: 0.68,
  sprinting: false,
  aiming: false,
  aim: 0,
  holstered: false,
  reloading: 1.2,
  drawing: 0,
  bloom: 0.069,
  fall: 3.4,
  airPeak: 0.86,
  jump: { coyote: 0, buffer: 0 },
  perks: { dash: 0, dashDir: { x: 0, z: 1 }, dashCooldown: 0.6, airDash: false, dashFlight: false, iframes: 0, stamina: 1, secondHeart: 0 },
};

const errorOf = (...entities: EntitySnapshot[]) => findSchemaError(snapshot({ entities }) as unknown as Record<string, unknown>);

describe("a fight between two steps in the save (v40 to v41, G-883)", () => {
  it("is schema v41 or later", () => {
    expect(SAVE_SCHEMA_VERSION).toBeGreaterThanOrEqual(41);
  });

  it("a v40 save changes only the version: everyone loads at rest", () => {
    const old = { version: 40, tick: 5, entities: [PLAYER] };
    expect(MIGRATIONS[40]!(old)).toEqual({ ...old, version: 41 });
  });

  it("keeps the velocity, the blow and the player's stance through the codec", () => {
    const entities = [{ ...BRAWLER, velocity: VELOCITY, melee: SWING }, { ...PLAYER, velocity: VELOCITY, stance: STANCE }];
    expect(errorOf(...entities)).toBeNull();
    expect(decodeSave("slot", encodeSave(snapshot({ entities }))).entities).toEqual(entities);
  });

  it("refuses a velocity, a blow or a stance that is not one, and a stance of anyone but the player", () => {
    expect(errorOf({ ...BRAWLER, velocity: { x: 1, z: 0 } as never })).toBe("entity floor-brawler velocity");
    for (const melee of [{ ...SWING, phase: "spin" }, { ...SWING, strike: -1 }, { ...SWING, stagger: -0.1 }, { ...SWING, guard: 1 }, { ...SWING, knock: { x: 0, z: 0 } }]) {
      expect(errorOf({ ...BRAWLER, melee: melee as never })).toBe("entity floor-brawler melee");
    }
    expect(errorOf({ ...BRAWLER, stance: STANCE })).toBe("entity floor-brawler stance");
    const bad: unknown[] = [{ ...STANCE, crouch: 1.5 }, { ...STANCE, reloading: -1 }, { ...STANCE, holstered: "no" }, { ...STANCE, jump: { coyote: 0.1 } }, { ...STANCE, perks: { ...STANCE.perks, stamina: 2 } }, { ...STANCE, fall: Number.NaN }];
    for (const stance of bad) expect(errorOf({ ...PLAYER, stance: stance as StanceSnapshot })).toBe("entity player stance");
  });
});
