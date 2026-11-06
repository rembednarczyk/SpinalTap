import { describe, expect, it } from "vitest";
import { EMPTY_INPUT, type InputFrame, REN_TRAIL_FLAG, SAVE_SCHEMA_VERSION } from "@seki/core";
import { ALCHEMIA_WAKE, MOVED_STASHES, OLD_MARKET_WAKE, REBUILT_STASHES, checksum } from "@seki/persistence";
import { FOODHALL, REN_SPOT, STALL_KEEPERS, TARG_OVERPASS_STASH, TARG_ROOF_STASH, beforeKeeper, chunkAt, groundY, opening } from "@seki/sim";
import { frame, setup, steps, teleport } from "./story-helpers";
import type { GameSession } from "../src/game-session";

/**
 * The market in Alchemia's food hall (ADR-0074 stage 1), headless: Seki walks from T1 to each
 * keeper's counter and each answers, Oyaji and Fumiko trade; the hours hold (Fumiko's bar shut by
 * day, Oyaji's shop after 22:00, Kenta's and Goro's units after midnight); Ren is on the green roof;
 * a game saved on the old hall's roof terrace (v31) and one saved in the old market on Aleja
 * Tysiąclecia (v28) load with Seki safe on the ground and the people at their new places.
 */

type Keeper = keyof typeof STALL_KEEPERS;
const ENTRANCE = (opening("entrance").x0 + opening("entrance").x1) / 2;

/** Walks towards (x, z), turning to it every step, until within `near` of it. */
const walkAt = (session: GameSession, to: { x: number; z: number }, n: number, near = 0.25): void => {
  for (let i = 0; i < n; i++) {
    const p = session.sim.player()!;
    if (Math.hypot(to.x - p.position.x, to.z - p.position.z) < near) return;
    const want = Math.atan2(to.x - p.position.x, to.z - p.position.z);
    const input: InputFrame = { ...EMPTY_INPUT, moveZ: 1, lookYaw: Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw)) };
    steps(session, 1, input);
  }
};

/** The way from T1 before the hall to a keeper's counter: in through the way in, but to Fumiko's hatch on T1. */
const wayTo = (key: Keeper): { x: number; z: number }[] => {
  const before = beforeKeeper(key);
  if (key === "fumiko") return [before];
  if (key === "sachiko") return [{ x: ENTRANCE, z: 55 }, { x: 418, z: 50 }, { x: 418, z: 40.2 }, before];
  if (key === "oyaji") return [{ x: ENTRANCE, z: 55 }, { x: 418, z: 50 }, { x: 428, z: 48.5 }, before];
  return [{ x: ENTRANCE, z: 55 }, { x: 418, z: 50 }, before];
};

/** From T1, walked to the keeper and turned to face the counter; the hall's people but the keepers out of the way. */
const walkToKeeper = (session: GameSession, key: Keeper): void => {
  teleport(session, ENTRANCE, 63, Math.PI);
  steps(session, 2);
  for (const g of [...session.sim.world.with("ai")]) session.sim.world.remove(g);
  for (const p of wayTo(key)) walkAt(session, p, 600);
  const k = STALL_KEEPERS[key];
  const me = session.sim.player()!;
  const want = Math.atan2(k.x - me.position.x, k.z - me.position.z);
  steps(session, 2, { ...EMPTY_INPUT, lookYaw: Math.atan2(Math.sin(want - me.yaw), Math.cos(want - me.yaw)) });
};

describe("the market in Alchemia's food hall (ADR-0074 stage 1)", () => {
  it("each keeper answers at his or her counter, walked to from T1; Oyaji's and Fumiko's counters trade", () => {
    const { session, ui } = setup();
    session.newGame();
    // A new game is in the evening (21:00): Oyaji's shop is open till 22, Fumiko's bar from 16, the hall till midnight.
    const expected: Readonly<Record<Keeper, RegExp>> = { sachiko: /Sachiko/, kenta: /Kenta/, fumiko: /Fumiko/, goro: /Goro/, oyaji: /Oyaji's stall/ };
    for (const key of Object.keys(expected) as Keeper[]) {
      walkToKeeper(session, key);
      const p = session.sim.player()!.position;
      expect(Math.hypot(p.x - beforeKeeper(key).x, p.z - beforeKeeper(key).z), key).toBeLessThan(0.5);
      expect(ui.getState().prompt ?? "", key).toMatch(expected[key]);
    }
    for (const key of ["oyaji", "fumiko"] as const) {
      walkToKeeper(session, key);
      steps(session, 1, frame({ interact: true }));
      expect(ui.getState().shopOpen, key).toBe(true);
      session.intents.closeShop();
      steps(session, 2);
    }
  });

  it("keeps the hours: Fumiko's bar shut by day, Oyaji's shop after 22:00, Kenta at the back of his unit after midnight", () => {
    const { session, ui } = setup();
    session.newGame();
    session.sim.enqueue({ type: "wait", minutes: 61 }); // 22:01
    walkToKeeper(session, "goro");
    steps(session, 60 * 5);
    const oyaji = [...session.sim.world].find((e) => e.key === "oyaji")!;
    expect(oyaji.interactable?.dialogueId).toBe("oyaji_closed");
    session.sim.enqueue({ type: "wait", minutes: 120 }); // past midnight
    steps(session, 60 * 5);
    const kenta = [...session.sim.world].find((e) => e.key === "kenta")!;
    expect(Math.hypot(kenta.position.x - STALL_KEEPERS.kenta.x, kenta.position.z - STALL_KEEPERS.kenta.z)).toBeGreaterThan(1.5);
    session.sim.enqueue({ type: "wait", minutes: 10 * 60 }); // past 10:00
    walkToKeeper(session, "fumiko");
    steps(session, 60 * 5);
    walkToKeeper(session, "fumiko");
    expect(ui.getState().prompt ?? "").toMatch(/closed/i);
    expect(Math.hypot(kenta.position.x - STALL_KEEPERS.kenta.x, kenta.position.z - STALL_KEEPERS.kenta.z)).toBeLessThan(0.5);
  });

  it("Ren waits on the green roof, walked onto from the car park, and he talks", () => {
    const { session, ui } = setup();
    session.newGame();
    session.sim.enqueue({ type: "set-flag", flag: REN_TRAIL_FLAG });
    teleport(session, 420, 28, 0);
    steps(session, 2);
    for (const g of [...session.sim.world.with("ai")]) session.sim.world.remove(g);
    walkAt(session, { x: REN_SPOT.x - 1, z: REN_SPOT.z - 1.4 }, 900);
    const ren = [...session.sim.world].find((e) => e.key === "ren")!;
    expect(ren.position.y).toBeCloseTo(FOODHALL.roof, 1);
    expect(session.sim.player()!.position.y).toBeCloseTo(FOODHALL.roof, 1);
    expect(ui.getState().prompt ?? "").toContain("Ren");
    steps(session, 1, frame({ interact: true }));
    expect(ui.getState().dialogue).not.toBeNull();
  });

  it("loads a game saved on the old hall's roof terrace (v31) with Seki on T1, unhurt, and the bag by Ren", async () => {
    // The migration's places are the content's (persistence knows no map).
    const by = REBUILT_STASHES[TARG_ROOF_STASH.key]!;
    expect(Math.hypot(by.x - TARG_ROOF_STASH.at.x, by.y - TARG_ROOF_STASH.at.y, by.z - TARG_ROOF_STASH.at.z)).toBeLessThan(0.01);
    expect(chunkAt(by.x, by.z)?.id).toBe(by.chunk);
    expect(ALCHEMIA_WAKE.y - groundY(ALCHEMIA_WAKE.x, ALCHEMIA_WAKE.z)).toBeCloseTo(0.05, 2);
    expect(chunkAt(ALCHEMIA_WAKE.x, ALCHEMIA_WAKE.z)?.id).toBe(ALCHEMIA_WAKE.chunk);

    const { session, store } = setup();
    session.newGame();
    steps(session, 2);
    const now = session.sim.snapshot(null, "old", "");
    const roof = MOVED_STASHES[TARG_ROOF_STASH.key]!;
    const entities = [...now.entities.filter((e) => e.key !== "player"), { ...now.entities.find((e) => e.key === "player")!, position: { x: 422.3, y: 7.09, z: 46.1 } }];
    const containers = [{ key: TARG_ROOF_STASH.key, position: { x: roof.x, y: roof.y, z: roof.z }, chunk: roof.chunk, expiresAtTick: Number.MAX_SAFE_INTEGER, lines: TARG_ROOF_STASH.lines }];
    const text = JSON.stringify({ ...now, version: 31, entities, domain: { ...now.domain, loot: { ...now.domain.loot, containers } }, streaming: { loadedChunks: ["krakowskie-2-1"] } });
    await store.put("old", JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text }));
    expect(await session.saves.loadAsync("old")).toBe(true);
    expect(SAVE_SCHEMA_VERSION).toBeGreaterThanOrEqual(32);
    const p = session.sim.player()!;
    expect({ x: p.position.x, z: p.position.z }).toEqual({ x: ALCHEMIA_WAKE.x, z: ALCHEMIA_WAKE.z });
    const hp = p.health!.current;
    steps(session, 30);
    expect(p.position.y).toBeCloseTo(groundY(ALCHEMIA_WAKE.x, ALCHEMIA_WAKE.z), 1);
    expect(p.health!.current).toBe(hp);
    const bag = session.sim.domain.loot.containers.find((c) => c.key === TARG_ROOF_STASH.key)!;
    expect(bag.position).toEqual(TARG_ROOF_STASH.at);
  });

  it("loads a game saved in the old market on Aleja Tysiąclecia (v28) with Seki on the avenue and its people in the food hall", async () => {
    const { session, store } = setup();
    session.newGame();
    steps(session, 2);
    const now = session.sim.snapshot(null, "old", "");
    const entities = [
      ...now.entities.filter((e) => e.key !== "player"),
      { ...now.entities.find((e) => e.key === "player")!, position: { x: 775, y: -7.9, z: 319.6 } },
      { key: "oyaji", position: { x: 769, y: -20.6, z: 326.6 }, yaw: 0, pitch: 0, hp: 120, cooldown: 0, alerted: false },
    ];
    const text = JSON.stringify({ ...now, version: 28, entities, streaming: { loadedChunks: ["podzamcze-1-0"] } });
    await store.put("old", JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text }));
    expect(await session.saves.loadAsync("old")).toBe(true);
    const p = session.sim.player()!;
    expect({ x: p.position.x, z: p.position.z }).toEqual({ x: OLD_MARKET_WAKE.x, z: OLD_MARKET_WAKE.z });
    steps(session, 30);
    expect(p.position.y).toBeCloseTo(groundY(OLD_MARKET_WAKE.x, OLD_MARKET_WAKE.z), 1);
    walkToKeeper(session, "oyaji");
    const oyaji = [...session.sim.world].find((e) => e.key === "oyaji")!;
    expect(Math.hypot(oyaji.position.x - STALL_KEEPERS.oyaji.x, oyaji.position.z - STALL_KEEPERS.oyaji.z)).toBeLessThan(0.5);
    expect(TARG_OVERPASS_STASH.at.z).toBeGreaterThan(FOODHALL.maxZ);
  });
});
