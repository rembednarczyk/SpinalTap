import { describe, expect, it } from "vitest";
import { EMPTY_INPUT, type InputFrame, type Vec3 } from "@seki/core";
import { P1, P2, P2_CORRIDOR, P2_CUTTING, P2_STAIR, groundY, p2StairY } from "@seki/sim";
import { setup, steps, teleport } from "./story-helpers";
import type { GameSession } from "../src/game-session";

/**
 * P-2 under Alchemia's P-1 (ADR-0074 stage 5a), headless: Seki walks from P-1's apron by the
 * passage from metro B down the flight into the automated store (an interior of its own, ADR-0061),
 * along the service corridor under the food hall and T1, out of its portal and through the cutting
 * onto T2's ground, unhurt; and back in from T2 to the store.
 */

const at = (session: GameSession): Vec3 => session.sim.player()!.position;
const flat = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const STAIR_Z = (P2_STAIR.minZ + P2_STAIR.maxZ) / 2;
const CUT_X = (P2_CUTTING.minX + P2_CUTTING.maxX) / 2;

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
  const { session } = setup();
  session.newGame();
  steps(session, 2);
  for (const g of [...session.sim.world.with("ai")]) session.sim.world.remove(g);
  return session;
};

/** The way from P-1's floor at the flight's head down into the store's annex, along the corridor and out onto T2. */
const FOOT_X = (P2_STAIR.maxX + P2_CORRIDOR.maxX - 0.3) / 2;
const DOWN_AND_OUT = [
  { x: P2_STAIR.minX - 1, z: STAIR_Z },
  { x: FOOT_X, z: STAIR_Z },
  { x: FOOT_X, z: P2_CORRIDOR.minZ + 2 },
  { x: CUT_X, z: P2_CORRIDOR.maxZ - 1.5 },
  { x: CUT_X, z: P2_CUTTING.maxZ + 2 },
] as const;

describe("P-2 under Alchemia's P-1 (ADR-0074 stage 5a)", () => {
  it("takes her from P-1's floor by the hall's door down the flight into the store, along the corridor and out of the cutting onto T2", () => {
    const session = start();
    // By the door from the food hall onto P-1.
    teleport(session, 411.4, 30.6, Math.PI / 2, 0, P1.floor);
    steps(session, 2);
    expect(session.sim.session.interior).toBe("alchemia-parking");
    const me = session.sim.player()!;
    const hp = me.health!.current;
    const [landing, foot, corridor, end, out] = DOWN_AND_OUT;
    walkAt(session, landing, 300);
    expect(at(session).y).toBeCloseTo(P1.floor, 1);
    walkAt(session, foot, 600);
    expect(flat(at(session), foot)).toBeLessThan(0.5);
    expect(at(session).y).toBeCloseTo(P2.floor, 1);
    steps(session, 2);
    expect(session.sim.session.interior).toBe("alchemia-p2");
    walkAt(session, corridor, 300);
    walkAt(session, end, 2400);
    expect(flat(at(session), end)).toBeLessThan(0.5);
    // At the corridor's end: P-2's tunnel, a room of its own since 22.11.
    expect(session.sim.session.interior).toBe("alchemia-p2-tunnel");
    walkAt(session, out, 600);
    expect(flat(at(session), out)).toBeLessThan(0.5);
    steps(session, 10);
    expect(at(session).y).toBeCloseTo(groundY(out.x, out.z), 1);
    expect(session.sim.session.interior).toBeNull();
    expect(me.health!.current).toBe(hp);
  });

  it("takes her back in from T2 through the cutting and the corridor to the store and up the flight onto P-1", () => {
    const session = start();
    const [landing, foot, corridor, end, out] = DOWN_AND_OUT;
    teleport(session, out.x, out.z + 2, Math.PI);
    steps(session, 2);
    const me = session.sim.player()!;
    const hp = me.health!.current;
    for (const p of [end, corridor, foot]) walkAt(session, p, 2400);
    expect(flat(at(session), foot)).toBeLessThan(0.5);
    expect(at(session).y).toBeCloseTo(p2StairY(foot.x), 1);
    expect(session.sim.session.interior).toBe("alchemia-p2");
    walkAt(session, landing, 600);
    expect(flat(at(session), landing)).toBeLessThan(0.5);
    expect(at(session).y).toBeCloseTo(P1.floor, 1);
    steps(session, 2);
    expect(session.sim.session.interior).toBe("alchemia-parking");
    expect(me.health!.current).toBe(hp);
  });
});
