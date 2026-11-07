import { describe, expect, it } from "vitest";
import { SAVE_SCHEMA_VERSION } from "@seki/core";
import { MIGRATIONS, checksum, decodeSave } from "../src";
import { PARKING_WAKE } from "../src/alchemia-parking";
import { PAVILION_STASHES } from "../src/alchemia-rebuild";
import { snapshot } from "./fixtures";

/** P-1 under Alchemia's car park (ADR-0074 stage 4): schema v36 and the v35 -> v36 migration. */

const wrap = (payload: unknown) => {
  const text = JSON.stringify(payload);
  return JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text });
};

const at = (key: string, x: number, y: number, z: number) => ({ key, position: { x, y, z }, yaw: 0, pitch: 0, hp: 100, cooldown: 0, alerted: false });
const WAKE = { x: PARKING_WAKE.x, y: PARKING_WAKE.y, z: PARKING_WAKE.z };
const bag = (key: string, x: number, y: number, z: number) => ({ key, position: { x, y, z }, chunk: "krakowskie-2-1", expiresAtTick: 9999, lines: [{ kind: "eddies", qty: 5 }] });

/** A v35 save on the car park where the ramp's trench is dug: a bag on it, one on the car park, Sachiko in her kiosk, Kaito on the deptak. */
const onTheRamp = () => {
  const s = snapshot({});
  return {
    ...s,
    version: 35,
    entities: [at("player", 414, -1.3, 2), at("sachiko", 406.05, -6.4, 36.1), at("fixer", 320, -0.3, -93), at("passerby-1", 405, -1.5, 8)],
    domain: { ...s.domain, loot: { ...s.domain.loot, containers: [bag("loot:trench", 416, -1.5, 8), bag("loot:car-park", 400, -1.6, 10)] } },
  };
};

const migrate = <T>(old: T): T => MIGRATIONS[35]!(old as unknown as Record<string, unknown>) as unknown as T;

describe("P-1 under Alchemia's car park in the save (v35 to v36, ADR-0074 stage 4)", () => {
  it("is schema v36 or later", () => {
    expect(SAVE_SCHEMA_VERSION).toBeGreaterThanOrEqual(36);
  });

  it("wakes a player saved where the ramp's trench is on the car park, her bag with her, and drops Sachiko's state", () => {
    const moved = migrate(onTheRamp());
    expect(moved.version).toBe(36);
    // Sachiko comes back from the content; Kaito and a passer-by on the car park over P-1 stay.
    expect(moved.entities.map((e) => e.key)).toEqual(["player", "fixer", "passerby-1"]);
    expect(moved.entities[0]!.position).toEqual(WAKE);
    expect(moved.entities[2]).toEqual(onTheRamp().entities[3]);
    const [trench, park] = moved.domain.loot.containers;
    expect(trench).toMatchObject({ key: "loot:trench", position: WAKE, chunk: PARKING_WAKE.chunk });
    expect(park).toEqual(onTheRamp().domain.loot.containers[1]);
  });

  it("wakes a player saved in the trench or the stair house, and leaves one on the car park over P-1 where she was", () => {
    for (const [x, y, z] of [
      [409.6, -1.1, -5.4],
      [418.4, -1.2, 11.9],
      [420, -1.4, 15],
      [421.6, -1.6, 22.5],
    ] as const) {
      const moved = migrate({ ...snapshot({}), version: 35, entities: [at("player", x, y, z)] });
      expect(moved.entities[0]!.position, `${x},${z}`).toEqual(WAKE);
    }
    for (const [x, y, z] of [
      [405, -1.5, 8],
      [414, -1.0, -7],
      [414, -1.9, 20],
      [423.5, -0.73, -1.75],
      [416, -6.35, 62.5],
    ] as const) {
      const moved = migrate({ ...snapshot({}), version: 35, entities: [at("player", x, y, z)] });
      expect(moved.entities[0]!.position, `${x},${z}`).toEqual({ x, y, z });
    }
  });

  it("drops the heat's reinforcements and a mugging's bodies left in the trench", () => {
    const person = (x: number, z: number) => ({ state: at("r", x, -1.2, z) });
    const old = { ...snapshot({}), version: 35, reinforcements: { sent: 2, wait: 3, people: [person(414, 0), person(300, -90)] }, strayBodies: [person(420, 18), person(310, -90)] };
    const moved = migrate(old);
    expect(moved.reinforcements.people.map((p) => p.state.position.x)).toEqual([300]);
    expect(moved.strayBodies.map((p) => p.state.position.x)).toEqual([310]);
  });

  it("walks a v34 save through the pavilion's stage onto P-1's: the bag on the pavilion's roof, the player by the ramp", () => {
    const save = { ...snapshot({}), version: 34, entities: [at("player", 415, -1.4, 4)] };
    const loaded = decodeSave("v34", wrap(save));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded.entities[0]!.position).toEqual(WAKE);
    expect(PAVILION_STASHES["stash:targ-roof"]).toBeDefined();
  });
});
