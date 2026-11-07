import { describe, expect, it } from "vitest";
import { SAVE_SCHEMA_VERSION } from "@seki/core";
import { MIGRATIONS, checksum, decodeSave } from "../src";
import { PLAZA_STASHES, PLAZA_WAKE } from "../src/alchemia-rebuild";
import { snapshot } from "./fixtures";

/** The lower square T2 before the rebuilt Arkady (ADR-0074 stage 2): schema v34 and the v33 -> v34 migration. */

const wrap = (payload: unknown) => {
  const text = JSON.stringify(payload);
  return JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text });
};

const at = (key: string, x: number, y: number, z: number) => ({ key, position: { x, y, z }, yaw: 0, pitch: 0, hp: 100, cooldown: 0, alerted: false });
const WAKE = { x: PLAZA_WAKE.x, y: PLAZA_WAKE.y, z: PLAZA_WAKE.z };
const bag = (key: string, x: number, y: number, z: number) => ({ key, position: { x, y, z }, chunk: "krakowskie-2-1", expiresAtTick: 9999, lines: [{ kind: "eddies", qty: 5 }] });

/** A v33 save in the Hebi hollow by the ruin: the lookout at his post, the overpass bag behind the ruin, a bag on the ridge, Kaito on the deptak. */
const inTheHollow = () => {
  const s = snapshot({});
  return {
    ...s,
    version: 33,
    entities: [at("player", 442, -9.17, 93), at("hebi-lookout", 444, -8.9, 112), at("fixer", 320, -0.3, -93), at("passerby-3", 463, -5.5, 100)],
    domain: {
      ...s.domain,
      loot: {
        ...s.domain.loot,
        containers: [
          { key: "stash:targ-overpass", position: { x: 452.8, y: -8.9, z: 111.8 }, chunk: "krakowskie-2-1", expiresAtTick: Number.MAX_SAFE_INTEGER, lines: [{ kind: "eddies", qty: 120 }] },
          bag("loot:ridge", 440, -5.7, 112),
          bag("loot:lubartowska", 463, -5.5, 100),
          bag("loot:t1", 416, -6.4, 64),
        ],
      },
    },
  };
};

const migrate = <T>(old: T): T => MIGRATIONS[33]!(old as unknown as Record<string, unknown>) as unknown as T;

describe("T2 and the Arkady in the save (v33 to v34, ADR-0074 stage 2)", () => {
  it("is schema v34 or later", () => {
    expect(SAVE_SCHEMA_VERSION).toBeGreaterThanOrEqual(34);
  });

  it("wakes a player saved in the hollow on T2 by the Arkady, drops the lookout, moves the overpass bag and the bags on the square", () => {
    const moved = migrate(inTheHollow());
    expect(moved.version).toBe(34);
    // The player on T2; the lookout gone (he comes back at his post under the arches); Kaito and a passer-by on Lubartowska kept.
    expect(moved.entities.map((e) => e.key)).toEqual(["player", "fixer", "passerby-3"]);
    expect(moved.entities[0]!.position).toEqual(WAKE);
    const [overpass, ridge, lubartowska, t1] = moved.domain.loot.containers;
    const by = PLAZA_STASHES["stash:targ-overpass"]!;
    expect(overpass).toMatchObject({ key: "stash:targ-overpass", position: { x: by.x, y: by.y, z: by.z }, chunk: by.chunk, lines: [{ kind: "eddies", qty: 120 }] });
    // A bag on the ridge the square cut away is put down on T2; the ones east of the Arkady and on T1 stay.
    expect(ridge).toMatchObject({ key: "loot:ridge", position: WAKE, chunk: PLAZA_WAKE.chunk });
    expect(lubartowska).toEqual(inTheHollow().domain.loot.containers[2]);
    expect(t1).toEqual(inTheHollow().domain.loot.containers[3]);
  });

  it("wakes a player saved anywhere on the new square on T2, and leaves one saved off it where she was", () => {
    for (const [x, y, z] of [
      [442, -9.2, 93],
      [440, -5.8, 112],
      [452, -8.9, 111.8],
      [430, -9.6, 104],
      [447, -6.9, 126],
    ] as const) {
      const moved = migrate({ ...snapshot({}), version: 33, entities: [at("player", x, y, z)] });
      expect(moved.entities[0]!.position, `${x},${z}`).toEqual(WAKE);
    }
    for (const [x, y, z] of [
      [416, -6.35, 62.5],
      [463, -5.5, 100],
      [410, -9.7, 104],
      [414, -1.0, -7],
      [445, -6.4, 72],
    ] as const) {
      const moved = migrate({ ...snapshot({}), version: 33, entities: [at("player", x, y, z)] });
      expect(moved.entities[0]!.position, `${x},${z}`).toEqual({ x, y, z });
    }
  });

  it("drops the heat's reinforcements and a mugging's bodies left on the square", () => {
    const person = (x: number, z: number) => ({ state: at("r", x, -9.2, z) });
    const old = { ...snapshot({}), version: 33, reinforcements: { sent: 2, wait: 3, people: [person(440, 100), person(300, -90)] }, strayBodies: [person(436, 118), person(310, -90)] };
    const moved = migrate(old);
    expect(moved.reinforcements.people.map((p) => p.state.position.x)).toEqual([300]);
    expect(moved.strayBodies.map((p) => p.state.position.x)).toEqual([310]);
  });

  it("walks a v32 save from the hollow through both stages of the rebuild to T2", () => {
    const s = snapshot({});
    const old = { ...s, version: 32, entities: [at("player", 442, -9.2, 93)], domain: { ...s.domain, loot: { ...s.domain.loot, containers: [inTheHollow().domain.loot.containers[0]!] } } };
    const loaded = decodeSave("v32", wrap(old));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded.entities.find((e) => e.key === "player")!.position).toEqual(WAKE);
    const by = PLAZA_STASHES["stash:targ-overpass"]!;
    expect(loaded.domain.loot.containers[0]!.position).toEqual({ x: by.x, y: by.y, z: by.z });
  });
});
