import { describe, expect, it } from "vitest";
import { EMPTY_INPUT, type InputFrame, type Vec3 } from "@seki/core";
import { ALCHEMIA_T2, P2, SHELTER, SHELTER_GATE_STAIR, SHELTER_HATCH, SHELTER_STAIR_FOOT, groundY } from "@seki/sim";
import { setup, steps, teleport } from "./story-helpers";
import type { GameSession } from "../src/game-session";

/**
 * The air-raid shelter under T2 (ADR-0074 stages 5d1 and 5d2), headless: Seki goes down the hatch
 * on T2 into the shelter (an interior of its own, ADR-0061), across its room past the exhibit, down
 * the passage and up the flight to the steel gate, Hebi's and coded: shut to her without a job;
 * from P-2's corridor it keeps her out; from the room she goes back up the hatch onto T2, unhurt.
 */

const at = (session: GameSession): Vec3 => session.sim.player()!.position;
const flat = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const HATCH_Z = (SHELTER_HATCH.minZ + SHELTER_HATCH.maxZ) / 2;
const STAIR_X = (SHELTER_GATE_STAIR.minX + SHELTER_GATE_STAIR.maxX) / 2;
const GATE_Z = 69.8;

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

/** From T2 east of the hatch down into the room, across it to the passage, along it and up the gate's flight into P-2's corridor. */
const OUT = { x: SHELTER_HATCH.maxX + 2, z: HATCH_Z } as const;
const WAY = [
  { x: SHELTER.maxX - 0.8, z: HATCH_Z },
  { x: STAIR_X, z: 93.8 },
  { x: STAIR_X, z: SHELTER.minZ + 1.5 },
  { x: STAIR_X, z: SHELTER_STAIR_FOOT + 1 },
  { x: STAIR_X, z: GATE_Z },
  { x: 418.4, z: GATE_Z },
] as const;

describe("the shelter under T2 (ADR-0074 stages 5d1, 5d2)", () => {
  it("takes her down the hatch from T2 into the shelter, across it and up the gate's flight, where the Hebi's locked gate holds her", () => {
    const session = start();
    teleport(session, OUT.x, OUT.z, -Math.PI / 2);
    steps(session, 2);
    const me = session.sim.player()!;
    const hp = me.health!.current;
    const [foot, west, south, passage, landing, corridor] = WAY;
    walkAt(session, foot, 900);
    expect(flat(at(session), foot)).toBeLessThan(0.5);
    expect(at(session).y).toBeCloseTo(SHELTER.floor, 1);
    steps(session, 2);
    expect(session.sim.session.interior).toBe("alchemia-shelter");
    for (const p of [west, south, passage]) walkAt(session, p, 900);
    expect(flat(at(session), passage)).toBeLessThan(0.5);
    walkAt(session, landing, 900);
    expect(flat(at(session), landing)).toBeLessThan(0.5);
    expect(at(session).y).toBeCloseTo(P2.floor, 1);
    // Against the gate (stage 5d2): coded, Hebi's; no job, no way through.
    walkAt(session, corridor, 300);
    expect(at(session).x).toBeGreaterThan(SHELTER_GATE_STAIR.minX);
    expect(session.sim.session.interior).toBe("alchemia-shelter");
    expect(me.health!.current).toBe(hp);
  });

  it("keeps her out of the gate from P-2's corridor, and takes her back up the hatch onto T2 from inside", () => {
    const session = start();
    const corridor = WAY.at(-1)!;
    teleport(session, corridor.x, corridor.z, Math.PI / 2, 0, P2.floor);
    steps(session, 2);
    const me = session.sim.player()!;
    const hp = me.health!.current;
    walkAt(session, WAY.at(-2)!, 300);
    expect(at(session).x).toBeLessThan(SHELTER_GATE_STAIR.minX - P2.wall);
    expect(session.sim.session.interior).toBe("alchemia-p2");
    // From the room up the hatch.
    teleport(session, WAY[1].x, WAY[1].z, Math.PI / 2, 0, SHELTER.floor);
    steps(session, 2);
    for (const p of [WAY[0], OUT]) walkAt(session, p, 900);
    expect(flat(at(session), OUT)).toBeLessThan(0.5);
    steps(session, 10);
    expect(at(session).y).toBeCloseTo(groundY(OUT.x, OUT.z), 1);
    expect(at(session).y).toBeCloseTo(ALCHEMIA_T2, 1);
    expect(session.sim.session.interior).toBeNull();
    expect(me.health!.current).toBe(hp);
  });
});
