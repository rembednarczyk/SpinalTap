import { describe, expect, it } from "vitest";
import { EMPTY_INPUT, type InputFrame, SAVE_SCHEMA_VERSION, type Vec3 } from "@seki/core";
import { PARKING_WAKE, checksum } from "@seki/persistence";
import { FOODHALL, P1, P1_HALL_DOOR, P1_RAMP, P1_RAMP_WALK, P1_STAIR, STALL_KEEPERS, beforeKeeper, chunkAt, groundY, p1RampY } from "@seki/sim";
import { frame, setup, steps, teleport } from "./story-helpers";
import type { GameSession } from "../src/game-session";

/**
 * P-1 under Alchemia's car park (ADR-0074 stage 4), headless: Seki walks from Sachiko's kiosk in
 * the food hall through the door in its back wall onto P-1 (an interior of ADR-0061), down the
 * ramp's footway from the car park by Bajkowskiego to the apron at its foot, and up the stair core
 * by metro B onto the car park, unhurt; a game saved before P-1 was dug (v35) with Seki where its
 * ramp's trench now is loads with her on the car park by the ramp's top.
 */

const DOOR = (P1_HALL_DOOR.x0 + P1_HALL_DOOR.x1) / 2;
const at = (session: GameSession): Vec3 => session.sim.player()!.position;
const flat = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

/** Walks towards (x, z), turning to it every step, for at most `n` steps or until within `near` of it. */
const walkAt = (session: GameSession, to: { x: number; z: number }, n: number, near = 0.3): void => {
  for (let i = 0; i < n; i++) {
    const p = session.sim.player()!;
    if (Math.hypot(to.x - p.position.x, to.z - p.position.z) < near) return;
    const want = Math.atan2(to.x - p.position.x, to.z - p.position.z);
    const input: InputFrame = { ...EMPTY_INPUT, moveZ: 1, lookYaw: Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw)) };
    steps(session, 1, input);
  }
};

const start = () => {
  const { session, ui, store } = setup();
  session.newGame();
  steps(session, 2);
  for (const g of [...session.sim.world.with("ai")]) session.sim.world.remove(g);
  return { session, ui, store };
};

describe("P-1 under Alchemia's car park (ADR-0074 stage 4)", () => {
  it("lets her from Sachiko's kiosk through the door in the hall's back wall onto P-1, level, and counts it an interior", () => {
    const { session, ui } = start();
    teleport(session, beforeKeeper("sachiko").x, beforeKeeper("sachiko").z, -Math.PI / 2, 0, FOODHALL.floor);
    steps(session, 2);
    expect(session.sim.session.interior).toBe("alchemia-foodhall");
    // Sachiko answers across her counter turned to the door.
    const k = STALL_KEEPERS.sachiko;
    const me = session.sim.player()!;
    const want = Math.atan2(k.x - me.position.x, k.z - me.position.z);
    steps(session, 2, { ...EMPTY_INPUT, lookYaw: Math.atan2(Math.sin(want - me.yaw), Math.cos(want - me.yaw)) });
    expect(ui.getState().prompt ?? "").toMatch(/Sachiko/);
    const hp = me.health!.current;
    for (const p of [{ x: DOOR, z: FOODHALL.minZ + 1.2 }, { x: DOOR, z: FOODHALL.minZ - 1.5 }, { x: 402, z: 20 }]) walkAt(session, p, 600);
    expect(flat(at(session), { x: 402, z: 20 })).toBeLessThan(0.5);
    expect(at(session).y).toBeCloseTo(P1.floor, 2);
    expect(session.sim.session.interior).toBe("alchemia-parking");
    expect(me.health!.current).toBe(hp);
  });

  it("takes her down the ramp's footway from the car park to the apron at its foot", () => {
    const { session } = start();
    teleport(session, P1_RAMP_WALK, P1_RAMP.top - 3, 0);
    steps(session, 2);
    const me = session.sim.player()!;
    const hp = me.health!.current;
    for (const z of [P1_RAMP.top + 4, P1_RAMP.covered + 2, 20]) {
      walkAt(session, { x: P1_RAMP_WALK, z }, 900);
      expect(at(session).y, `${z}`).toBeCloseTo(p1RampY(z), 0);
    }
    walkAt(session, { x: 412, z: 28 }, 900);
    expect(flat(at(session), { x: 412, z: 28 })).toBeLessThan(0.5);
    expect(at(session).y).toBeCloseTo(P1.floor, 2);
    expect(session.sim.session.interior).toBe("alchemia-parking");
    expect(me.health!.current).toBe(hp);
  });

  it("takes her up the stair core by metro B from P-1 out onto the car park", () => {
    const { session } = start();
    const x = (P1_STAIR.minX + P1_STAIR.maxX) / 2;
    teleport(session, x, P1_STAIR.maxZ + 1.5, Math.PI, 0, P1.floor);
    steps(session, 2);
    const me = session.sim.player()!;
    const hp = me.health!.current;
    walkAt(session, { x, z: P1_STAIR.minZ + 0.8 }, 900);
    expect(at(session).y).toBeCloseTo(P1_STAIR.top, 1);
    walkAt(session, { x, z: P1_STAIR.minZ - 2 }, 300);
    expect(flat(at(session), { x, z: P1_STAIR.minZ - 2 })).toBeLessThan(0.5);
    steps(session, 20);
    expect(at(session).y).toBeCloseTo(groundY(x, P1_STAIR.minZ - 2), 1);
    expect(session.sim.session.interior).toBeNull();
    expect(me.health!.current).toBe(hp);
  });

  it("loads a game saved where the ramp's trench now is (v35) with Seki on the car park by the ramp's top, unhurt", async () => {
    // The migration's place is the content's (persistence knows no map).
    expect(PARKING_WAKE.y - groundY(PARKING_WAKE.x, PARKING_WAKE.z)).toBeGreaterThan(0);
    expect(PARKING_WAKE.y - groundY(PARKING_WAKE.x, PARKING_WAKE.z)).toBeLessThan(0.1);
    expect(chunkAt(PARKING_WAKE.x, PARKING_WAKE.z)?.id).toBe(PARKING_WAKE.chunk);

    const { session, store } = start();
    const now = session.sim.snapshot(null, "old", "");
    const player = { ...now.entities.find((e) => e.key === "player")!, position: { x: 414, y: groundY(414, 4), z: 4 } };
    const text = JSON.stringify({ ...now, version: 35, entities: [...now.entities.filter((e) => e.key !== "player"), player], streaming: { loadedChunks: ["krakowskie-2-1"] } });
    await store.put("old", JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text }));
    expect(await session.saves.loadAsync("old")).toBe(true);
    expect(SAVE_SCHEMA_VERSION).toBeGreaterThanOrEqual(36);
    const p = session.sim.player()!;
    expect({ x: p.position.x, z: p.position.z }).toEqual({ x: PARKING_WAKE.x, z: PARKING_WAKE.z });
    const hp = p.health!.current;
    steps(session, 30, frame());
    expect(p.position.y).toBeCloseTo(groundY(PARKING_WAKE.x, PARKING_WAKE.z), 1);
    expect(p.health!.current).toBe(hp);
  });
});
