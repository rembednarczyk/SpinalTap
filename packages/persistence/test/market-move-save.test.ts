import { describe, expect, it } from "vitest";
import { SAVE_SCHEMA_VERSION } from "@seki/core";
import { MIGRATIONS, checksum, decodeSave } from "../src";
import { MOVED_STASHES, OLD_MARKET_WAKE } from "../src/market-move";
import { snapshot } from "./fixtures";

/** The market moved off Aleja Tysiąclecia to Alchemia (ADR-0063 stage 6): schema v30 and the v29 -> v30 migration. */

const wrap = (payload: unknown) => {
  const text = JSON.stringify(payload);
  return JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text });
};

const at = (key: string, x: number, y: number, z: number) => ({ key, position: { x, y, z }, yaw: 0, pitch: 0, hp: 100, cooldown: 0, alerted: false });
/** A v29 save on the old market's south roof: Oyaji at his stall, the lookout under the deck, Kaito on the deptak. */
const onTheRoof = () => {
  const s = snapshot({});
  return {
    ...s,
    version: 29,
    entities: [at("player", 775, -7.9, 319.6), at("oyaji", 769, -20.6, 326.6), at("hebi-lookout", 793, -20.6, 352), at("ren", 1500, 0, 1500), at("fixer", 320, -0.3, -93)],
    domain: {
      ...s.domain,
      loot: {
        ...s.domain.loot,
        containers: [
          { key: "stash:targ-roof", position: { x: 780.2, y: -7.9, z: 320.4 }, chunk: "podzamcze-1-0", expiresAtTick: Number.MAX_SAFE_INTEGER, lines: [{ kind: "eddies", qty: 180 }] },
          { key: "loot:hebi-1", position: { x: 790, y: -20.6, z: 340 }, chunk: "podzamcze-1-0", expiresAtTick: 9999, lines: [{ kind: "eddies", qty: 5 }] },
          { key: "loot:far", position: { x: 300, y: 0, z: -90 }, chunk: "krakowskie-2-0", expiresAtTick: 9999, lines: [{ kind: "eddies", qty: 7 }] },
        ],
      },
    },
  };
};

describe("the market moved to Alchemia in the save (v29 to v30, ADR-0063)", () => {
  it("is schema v30 or later", () => {
    expect(SAVE_SCHEMA_VERSION).toBeGreaterThanOrEqual(30);
  });

  it("wakes a player saved in the old market on the avenue and sends its people and stashes to Alchemia", () => {
    const moved = MIGRATIONS[29]!(onTheRoof() as unknown as Record<string, unknown>) as unknown as ReturnType<typeof onTheRoof>;
    expect(moved.version).toBe(30);
    // The player on the ground where the square was; the market's people gone from the save (they spawn in Alchemia), Kaito kept.
    expect(moved.entities.map((e) => e.key)).toEqual(["player", "fixer"]);
    expect(moved.entities[0]!.position).toEqual({ x: OLD_MARKET_WAKE.x, y: OLD_MARKET_WAKE.y, z: OLD_MARKET_WAKE.z });
    expect(moved.entities[1]).toEqual(at("fixer", 320, -0.3, -93));
    // The roof stash keeps what is left in it, on the terrace now; a bag dropped in the market lies by the wake point; the rest stays.
    const [roof, bag, far] = moved.domain.loot.containers;
    const stash = MOVED_STASHES["stash:targ-roof"]!;
    expect(roof).toMatchObject({ key: "stash:targ-roof", position: { x: stash.x, y: stash.y, z: stash.z }, chunk: stash.chunk, lines: [{ kind: "eddies", qty: 180 }] });
    expect(bag).toMatchObject({ position: { x: OLD_MARKET_WAKE.x, y: OLD_MARKET_WAKE.y, z: OLD_MARKET_WAKE.z }, chunk: OLD_MARKET_WAKE.chunk });
    expect(far).toEqual(onTheRoof().domain.loot.containers[2]);
  });

  it("leaves a save made anywhere else as it was, but for the market's people", () => {
    const s = snapshot({});
    const old = { ...s, version: 29 };
    expect(MIGRATIONS[29]!(old as unknown as Record<string, unknown>)).toEqual({ ...old, version: 30 });
    const loaded = decodeSave("v29", wrap(old));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded.entities).toEqual(s.entities);
  });

  it("drops the heat's reinforcements and a mugging's bodies left in the old market", () => {
    const person = (x: number) => ({ state: at("r", x, -20.6, 340) });
    const old = { ...snapshot({}), version: 29, reinforcements: { sent: 2, wait: 3, people: [person(790), person(300)] }, strayBodies: [person(800), person(310)] };
    const moved = MIGRATIONS[29]!(old as unknown as Record<string, unknown>) as unknown as typeof old;
    expect(moved.reinforcements.people.map((p) => p.state.position.x)).toEqual([300]);
    expect(moved.strayBodies.map((p) => p.state.position.x)).toEqual([310]);
  });
});
