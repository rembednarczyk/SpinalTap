import { describe, expect, it } from "vitest";
import { SAVE_SCHEMA_VERSION } from "@seki/core";
import { MIGRATIONS, checksum, decodeSave } from "../src";
import { PAVILION_STASHES, PAVILION_WAKE, REBUILT_STASHES } from "../src/alchemia-rebuild";
import { MOVED_STASHES } from "../src/market-move";
import { snapshot } from "./fixtures";

/** The triangular pavilion on the corner (ADR-0074 stage 3): schema v35 and the v34 -> v35 migration. */

const wrap = (payload: unknown) => {
  const text = JSON.stringify(payload);
  return JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text });
};

const at = (key: string, x: number, y: number, z: number) => ({ key, position: { x, y, z }, yaw: 0, pitch: 0, hp: 100, cooldown: 0, alerted: false });
const WAKE = { x: PAVILION_WAKE.x, y: PAVILION_WAKE.y, z: PAVILION_WAKE.z };
const ROOF = PAVILION_STASHES["stash:targ-roof"]!;
const bag = (key: string, x: number, y: number, z: number) => ({ key, position: { x, y, z }, chunk: "krakowskie-2-1", expiresAtTick: 9999, lines: [{ kind: "eddies", qty: 5 }] });

/** A v34 save in the car park's notch: Ren on the green roof with the Hebi bag by him, a bag in the notch, Kaito on the deptak. */
const inTheNotch = () => {
  const s = snapshot({});
  const green = REBUILT_STASHES["stash:targ-roof"]!;
  return {
    ...s,
    version: 34,
    entities: [at("player", 430, -0.5, -4), at("ren", 419, -2.2, 55.8), at("fixer", 320, -0.3, -93), at("passerby-1", 434.5, -0.4, -5)],
    domain: {
      ...s.domain,
      loot: {
        ...s.domain.loot,
        containers: [
          { key: "stash:targ-roof", position: { x: green.x, y: green.y, z: green.z }, chunk: green.chunk, expiresAtTick: Number.MAX_SAFE_INTEGER, lines: [{ kind: "eddies", qty: 180 }] },
          bag("loot:notch", 426, -0.6, -1),
          bag("loot:sidewalk", 433.5, -0.4, -10),
        ],
      },
    },
  };
};

const migrate = <T>(old: T): T => MIGRATIONS[34]!(old as unknown as Record<string, unknown>) as unknown as T;

describe("the pavilion on the corner in the save (v34 to v35, ADR-0074 stage 3)", () => {
  it("is schema v35 or later", () => {
    expect(SAVE_SCHEMA_VERSION).toBeGreaterThanOrEqual(35);
  });

  it("moves the Hebi bag onto the pavilion's roof, drops Ren, wakes a player saved in the notch by the ladder", () => {
    const moved = migrate(inTheNotch());
    expect(moved.version).toBe(35);
    // Ren comes back from the content; Kaito and a passer-by on Lubartowska's sidewalk (outside the pavilion) stay.
    expect(moved.entities.map((e) => e.key)).toEqual(["player", "fixer", "passerby-1"]);
    expect(moved.entities[0]!.position).toEqual(WAKE);
    expect(moved.entities[2]).toEqual(inTheNotch().entities[3]);
    const [roof, notch, sidewalk] = moved.domain.loot.containers;
    expect(roof).toMatchObject({ key: "stash:targ-roof", position: { x: ROOF.x, y: ROOF.y, z: ROOF.z }, chunk: ROOF.chunk, lines: [{ kind: "eddies", qty: 180 }] });
    expect(notch).toMatchObject({ key: "loot:notch", position: WAKE, chunk: PAVILION_WAKE.chunk });
    expect(sidewalk).toEqual(inTheNotch().domain.loot.containers[2]);
  });

  it("wakes a player saved anywhere on the pavilion's ground by the ladder, and leaves one saved off it where she was", () => {
    for (const [x, y, z] of [
      [421.5, -0.75, -8.6],
      [432, -0.4, -8.1],
      [435.8, -0.65, 5.2],
      [424.6, -0.75, -0.1],
      [428.4, -0.7, -3.4],
    ] as const) {
      const moved = migrate({ ...snapshot({}), version: 34, entities: [at("player", x, y, z)] });
      expect(moved.entities[0]!.position, `${x},${z}`).toEqual(WAKE);
    }
    for (const [x, y, z] of [
      [419, -2.2, 55.8],
      [423.5, -0.73, -1.75],
      [422.6, -0.8, -5],
      [433.8, -0.4, -9.5],
      [437.5, -0.6, 4],
      [428, -0.7, 6],
    ] as const) {
      const moved = migrate({ ...snapshot({}), version: 34, entities: [at("player", x, y, z)] });
      expect(moved.entities[0]!.position, `${x},${z}`).toEqual({ x, y, z });
    }
  });

  it("drops the heat's reinforcements and a mugging's bodies left where the pavilion stands", () => {
    const person = (x: number, z: number) => ({ state: at("r", x, -0.5, z) });
    const old = { ...snapshot({}), version: 34, reinforcements: { sent: 2, wait: 3, people: [person(430, -4), person(300, -90)] }, strayBodies: [person(426, -2), person(310, -90)] };
    const moved = migrate(old);
    expect(moved.reinforcements.people.map((p) => p.state.position.x)).toEqual([300]);
    expect(moved.strayBodies.map((p) => p.state.position.x)).toEqual([310]);
  });

  it("walks a v30 save with the bag on the old roof terrace through every stage of the rebuild onto the pavilion's roof", () => {
    const s = snapshot({});
    const old = MOVED_STASHES["stash:targ-roof"]!;
    const save = {
      ...s,
      version: 30,
      entities: [at("player", 422.3, 7.09, 46.1)],
      domain: { ...s.domain, loot: { ...s.domain.loot, containers: [{ key: "stash:targ-roof", position: { x: old.x, y: old.y, z: old.z }, chunk: old.chunk, expiresAtTick: Number.MAX_SAFE_INTEGER, lines: [] }] } },
    };
    const loaded = decodeSave("v30", wrap(save));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded.domain.loot.containers[0]!.position).toEqual({ x: ROOF.x, y: ROOF.y, z: ROOF.z });
  });
});
