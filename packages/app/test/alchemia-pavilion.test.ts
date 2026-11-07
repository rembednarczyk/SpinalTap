import { describe, expect, it } from "vitest";
import { EMPTY_INPUT, type InputFrame, REN_TRAIL_FLAG, SAVE_SCHEMA_VERSION } from "@seki/core";
import { PAVILION_STASHES, PAVILION_WAKE, REBUILT_STASHES, checksum } from "@seki/persistence";
import { ALCHEMIA_PAVILION, PAVILION_LADDER, REN_SPOT, TARG_ROOF_STASH, chunkAt, groundY } from "@seki/sim";
import { frame, setup, steps, teleport } from "./story-helpers";
import type { GameSession } from "../src/game-session";

/**
 * The triangular pavilion on Alchemia's corner (ADR-0074 stage 3), headless: Seki climbs its
 * service ladder from the car park onto the roof, where Ren waits with the Hebi bag by him
 * (`m3_lustro`); a game saved before it stood (v34), with Ren and the bag on the food hall's green
 * roof and Seki on the ground it now covers, loads with Seki by the ladder and the bag up there.
 */

const EAST = Math.PI / 2;

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

/** From the car park west of the ladder, walked into its foot and up it onto the roof. */
const climbOnto = (session: GameSession): void => {
  const l = PAVILION_LADDER;
  teleport(session, l.x - 1.6, l.z, EAST);
  steps(session, 2);
  for (const g of [...session.sim.world.with("ai")]) session.sim.world.remove(g);
  const me = session.sim.player()!;
  for (let i = 0; i < 120 && !me.climb; i++) steps(session, 1, frame({ moveZ: 1 }));
  expect(me.climb?.ladder).toBe(l.key);
  for (let i = 0; i < 600 && (me.climb || me.mantle); i++) steps(session, 1, frame({ moveZ: 1 }));
};

describe("the pavilion on Alchemia's corner (ADR-0074 stage 3)", () => {
  it("is climbed by its ladder from the car park, and Ren waits on its roof with the Hebi bag, and talks", () => {
    const { session, ui } = setup();
    session.newGame();
    session.sim.enqueue({ type: "set-flag", flag: REN_TRAIL_FLAG });
    climbOnto(session);
    const me = session.sim.player()!;
    expect(me.climb).toBeFalsy();
    expect(me.position.y).toBeCloseTo(ALCHEMIA_PAVILION.roof, 2);
    walkAt(session, { x: REN_SPOT.x - 1.2, z: REN_SPOT.z + 0.7 }, 900);
    expect(me.position.y).toBeCloseTo(ALCHEMIA_PAVILION.roof, 2);
    const ren = [...session.sim.world].find((e) => e.key === "ren")!;
    expect(ren.position.y).toBeCloseTo(ALCHEMIA_PAVILION.roof, 1);
    expect(Math.hypot(ren.position.x - REN_SPOT.x, ren.position.z - REN_SPOT.z)).toBeLessThan(0.3);
    const want = Math.atan2(ren.position.x - me.position.x, ren.position.z - me.position.z);
    steps(session, 2, { ...EMPTY_INPUT, lookYaw: Math.atan2(Math.sin(want - me.yaw), Math.cos(want - me.yaw)) });
    expect(ui.getState().prompt ?? "").toContain("Ren");
    steps(session, 1, frame({ interact: true }));
    expect(ui.getState().dialogue).not.toBeNull();
    const bag = session.sim.domain.loot.containers.find((c) => c.key === TARG_ROOF_STASH.key);
    expect(bag?.position).toEqual(TARG_ROOF_STASH.at);
  });

  it("takes Seki down the ladder again, unhurt, onto the car park", () => {
    const { session } = setup();
    session.newGame();
    climbOnto(session);
    const me = session.sim.player()!;
    const hp = me.health!.current;
    // Back to the ladder's head and down it.
    walkAt(session, { x: PAVILION_LADDER.exit.x, z: PAVILION_LADDER.exit.z }, 300, 0.2);
    steps(session, 2, { ...EMPTY_INPUT, lookYaw: Math.atan2(Math.sin(-EAST - me.yaw), Math.cos(-EAST - me.yaw)) });
    steps(session, 1, frame({ interact: true }));
    expect(me.climb?.ladder).toBe(PAVILION_LADDER.key);
    for (let i = 0; i < 600 && (me.climb || me.mantle); i++) steps(session, 1, frame({ moveZ: -1 }));
    steps(session, 30);
    expect(me.position.y).toBeCloseTo(groundY(me.position.x, me.position.z), 1);
    expect(me.position.x).toBeLessThan(PAVILION_LADDER.x + 0.2);
    expect(me.health!.current).toBe(hp);
  });

  it("loads a game saved before it stood (v34) with Seki by the ladder, the bag on its roof and Ren back up there", async () => {
    // The migration's places are the content's (persistence knows no map).
    const by = PAVILION_STASHES[TARG_ROOF_STASH.key]!;
    expect(Math.hypot(by.x - TARG_ROOF_STASH.at.x, by.y - TARG_ROOF_STASH.at.y, by.z - TARG_ROOF_STASH.at.z)).toBeLessThan(0.01);
    expect(chunkAt(by.x, by.z)?.id).toBe(by.chunk);
    expect(PAVILION_WAKE.y - groundY(PAVILION_WAKE.x, PAVILION_WAKE.z)).toBeCloseTo(0.05, 2);
    expect(chunkAt(PAVILION_WAKE.x, PAVILION_WAKE.z)?.id).toBe(PAVILION_WAKE.chunk);

    const { session, store } = setup();
    session.newGame();
    session.sim.enqueue({ type: "set-flag", flag: REN_TRAIL_FLAG });
    steps(session, 2);
    const now = session.sim.snapshot(null, "old", "");
    const green = REBUILT_STASHES[TARG_ROOF_STASH.key]!;
    const player = { ...now.entities.find((e) => e.key === "player")!, position: { x: 430, y: -0.5, z: -4 } };
    const ren = { key: "ren", position: { x: 419, y: -2.2, z: 55.8 }, yaw: 0, pitch: 0, hp: 100, cooldown: 0, alerted: false };
    const entities = [...now.entities.filter((e) => e.key !== "player" && e.key !== "ren"), player, ren];
    const containers = [{ key: TARG_ROOF_STASH.key, position: { x: green.x, y: green.y, z: green.z }, chunk: green.chunk, expiresAtTick: Number.MAX_SAFE_INTEGER, lines: TARG_ROOF_STASH.lines }];
    const text = JSON.stringify({ ...now, version: 34, entities, domain: { ...now.domain, loot: { ...now.domain.loot, containers } }, streaming: { loadedChunks: ["krakowskie-2-1"] } });
    await store.put("old", JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text }));
    expect(await session.saves.loadAsync("old")).toBe(true);
    expect(SAVE_SCHEMA_VERSION).toBeGreaterThanOrEqual(35);
    const p = session.sim.player()!;
    expect({ x: p.position.x, z: p.position.z }).toEqual({ x: PAVILION_WAKE.x, z: PAVILION_WAKE.z });
    const hp = p.health!.current;
    steps(session, 30);
    expect(p.position.y).toBeCloseTo(groundY(PAVILION_WAKE.x, PAVILION_WAKE.z), 1);
    expect(p.health!.current).toBe(hp);
    const bag = session.sim.domain.loot.containers.find((c) => c.key === TARG_ROOF_STASH.key)!;
    expect(bag.position).toEqual(TARG_ROOF_STASH.at);
    const back = [...session.sim.world].find((e) => e.key === "ren")!;
    expect(Math.hypot(back.position.x - REN_SPOT.x, back.position.y - REN_SPOT.y, back.position.z - REN_SPOT.z)).toBeLessThan(0.3);
  });
});
