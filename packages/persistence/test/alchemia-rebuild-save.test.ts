import { describe, expect, it } from "vitest";
import { SAVE_SCHEMA_VERSION } from "@seki/core";
import { MIGRATIONS, checksum, decodeSave } from "../src";
import { ALCHEMIA_WAKE, REBUILT_STASHES } from "../src/alchemia-rebuild";
import { MOVED_STASHES } from "../src/market-move";
import { snapshot } from "./fixtures";

/** Alchemia rebuilt by the investor's plan (ADR-0074 stage 1): schema v31 and the v30 -> v31 migration. */

const wrap = (payload: unknown) => {
  const text = JSON.stringify(payload);
  return JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text });
};

const at = (key: string, x: number, y: number, z: number) => ({ key, position: { x, y, z }, yaw: 0, pitch: 0, hp: 100, cooldown: 0, alerted: false });
const WAKE = { x: ALCHEMIA_WAKE.x, y: ALCHEMIA_WAKE.y, z: ALCHEMIA_WAKE.z };
const roof = MOVED_STASHES["stash:targ-roof"]!;

/** A v30 save on the old hall's roof terrace: Oyaji at his stall, the lift's cage up, the lookout at his post, Kaito on the deptak. */
const onTheTerrace = () => {
  const s = snapshot({});
  return {
    ...s,
    version: 30,
    entities: [
      at("player", 422.3, 7.09, 46.1),
      at("oyaji", 429.5, -8.1, 91.2),
      at("alchemia-lift", 422.3, 7.0, 52.6),
      at("hebi-lookout", 444, -8.9, 112),
      at("fixer", 320, -0.3, -93),
      at("passerby-9", 440, -6.9, 70),
    ],
    domain: {
      ...s.domain,
      loot: {
        ...s.domain.loot,
        containers: [
          { key: "stash:targ-roof", position: { x: roof.x, y: roof.y, z: roof.z }, chunk: roof.chunk, expiresAtTick: Number.MAX_SAFE_INTEGER, lines: [{ kind: "eddies", qty: 180 }] },
          { key: "loot:hebi-1", position: { x: 415, y: -7.2, z: 70 }, chunk: "krakowskie-2-1", expiresAtTick: 9999, lines: [{ kind: "eddies", qty: 5 }] },
          { key: "loot:hollow", position: { x: 442, y: -9.2, z: 93 }, chunk: "krakowskie-2-1", expiresAtTick: 9999, lines: [{ kind: "eddies", qty: 6 }] },
          { key: "loot:far", position: { x: 300, y: 0, z: -90 }, chunk: "krakowskie-2-0", expiresAtTick: 9999, lines: [{ kind: "eddies", qty: 7 }] },
        ],
      },
    },
  };
};

describe("Alchemia rebuilt in the save (v30 to v31, ADR-0074)", () => {
  it("is schema v31 or later", () => {
    expect(SAVE_SCHEMA_VERSION).toBeGreaterThanOrEqual(31);
  });

  it("wakes a player saved on the old roof terrace on T1, drops the market's people and the old lift, moves the roof stash by Ren", () => {
    const moved = MIGRATIONS[30]!(onTheTerrace() as unknown as Record<string, unknown>) as unknown as ReturnType<typeof onTheTerrace>;
    expect(moved.version).toBe(31);
    // The player on T1; Oyaji, the lookout and the cage gone (they come back from content), a passer-by in the rebuilt square too; Kaito kept.
    expect(moved.entities.map((e) => e.key)).toEqual(["player", "fixer"]);
    expect(moved.entities[0]!.position).toEqual(WAKE);
    const [stash, bag, hollow, far] = moved.domain.loot.containers;
    const by = REBUILT_STASHES["stash:targ-roof"]!;
    expect(stash).toMatchObject({ key: "stash:targ-roof", position: { x: by.x, y: by.y, z: by.z }, chunk: by.chunk, lines: [{ kind: "eddies", qty: 180 }] });
    // A bag in the old stalls' band is put down on T1; the hollow of the Hebi stash stays until stage 2; the rest stays.
    expect(bag).toMatchObject({ position: WAKE, chunk: ALCHEMIA_WAKE.chunk });
    expect(hollow).toEqual(onTheTerrace().domain.loot.containers[2]);
    expect(far).toEqual(onTheTerrace().domain.loot.containers[3]);
  });

  it("wakes a player saved anywhere in the rebuilt Alchemia on T1, and leaves one saved elsewhere where she was", () => {
    for (const [x, y, z] of [
      [421, -1.2, 45],
      [412, -6.9, 66],
      [426, -8.5, 92],
      [398, -4, 44],
    ] as const) {
      const old = { ...snapshot({}), version: 30, entities: [at("player", x, y, z)] };
      const moved = MIGRATIONS[30]!(old as unknown as Record<string, unknown>) as unknown as typeof old;
      expect(moved.entities[0]!.position, `${x},${z}`).toEqual(WAKE);
    }
    for (const [x, y, z] of [
      [442, -9.2, 93],
      [452, -8.9, 111.8],
      [414, -1.0, -7],
    ] as const) {
      const old = { ...snapshot({}), version: 30, entities: [at("player", x, y, z)] };
      const moved = MIGRATIONS[30]!(old as unknown as Record<string, unknown>) as unknown as typeof old;
      expect(moved.entities[0]!.position, `${x},${z}`).toEqual({ x, y, z });
    }
  });

  it("walks a v29 save from the old market on the avenue through both moves", () => {
    const s = snapshot({});
    const old = {
      ...s,
      version: 29,
      domain: {
        ...s.domain,
        loot: { ...s.domain.loot, containers: [{ key: "stash:targ-roof", position: { x: 780.2, y: -7.9, z: 320.4 }, chunk: "podzamcze-1-0", expiresAtTick: Number.MAX_SAFE_INTEGER, lines: [{ kind: "eddies", qty: 180 }] }] },
      },
    };
    const loaded = decodeSave("v29", wrap(old));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded.domain.loot.containers[0]!.position).toEqual({ x: 420.6, y: -2.2, z: 56.2 });
  });

  it("drops the heat's reinforcements and a mugging's bodies left in the rebuilt Alchemia", () => {
    const person = (x: number, z: number) => ({ state: at("r", x, -6.4, z) });
    const old = { ...snapshot({}), version: 30, reinforcements: { sent: 2, wait: 3, people: [person(420, 64), person(300, -90)] }, strayBodies: [person(410, 70), person(310, -90)] };
    const moved = MIGRATIONS[30]!(old as unknown as Record<string, unknown>) as unknown as typeof old;
    expect(moved.reinforcements.people.map((p) => p.state.position.x)).toEqual([300]);
    expect(moved.strayBodies.map((p) => p.state.position.x)).toEqual([310]);
  });
});
