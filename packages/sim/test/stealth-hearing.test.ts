import { describe, expect, it } from "vitest";
import { type InputFrame, type SaveSnapshot, angleTo } from "@seki/core";
import { SIM_DT, Simulation, type Entity } from "../src";
import { NOISE_SUSPICION } from "../src/systems/ai/ganger-hearing";
import { input, run } from "./helpers";
import { SIGHTED, STAND, emptySquare, enemyAt } from "./stealth-scenes";

/*
 * Stage 2 of ADR-0069: the player's steps are heard (sprint 9 m, walk 3.5 m, crouch 0, landing
 * 6 m), on her level. An unalerted enemy that hears her grows suspicious and goes to look; the
 * noise never raises the alarm. Plac Litewski (seed 7, Normal), the enemy north of the player
 * with its back to her, she faces east and moves across its back.
 */

const WALK = input({ moveZ: 1 });
const SPRINT = input({ moveZ: 1, sprint: true });
const CREEP_ACROSS = input({ moveZ: 1, crouch: true });

/** The empty square with the player facing east (across the enemy's back). */
const square = (crouch = false, awareness = 1): Simulation => {
  const sim = emptySquare(crouch, awareness);
  const p = sim.player()!;
  p.yaw = Math.PI / 2;
  p.prevYaw = p.yaw;
  return sim;
};

/** How far off its facing the player is, rad. */
const offFacing = (sim: Simulation, g: Entity): number => {
  const p = sim.player()!.position;
  return Math.abs(angleTo({ x: g.position.x, z: g.position.z, yaw: g.yaw }, p.x, p.z));
};

/** Steps `frame` until `done`, at most `seconds`; the seconds it took, null if it never did. */
const until = (sim: Simulation, done: () => boolean, seconds: number, frame: InputFrame = STAND): number | null => {
  for (let i = 1; i <= Math.ceil(seconds / SIM_DT); i++) {
    sim.step(frame);
    if (done()) return i * SIM_DT;
  }
  return null;
};

describe("hearing the player's steps (ADR-0069, stage 2)", () => {
  for (const type of SIGHTED) {
    it(`${type}: walking 3 m behind it, it hears her, turns round and is not alerted by the noise`, () => {
      const sim = square();
      const g = enemyAt(sim, type, 3);
      sim.step(WALK);
      expect(g.ai!.lastKnown).toBeTruthy();
      expect(g.ai!.suspicion).toBeGreaterThan(NOISE_SUSPICION - 0.02);
      expect(g.ai!.alerted).toBe(false);
      expect(until(sim, () => offFacing(sim, g) < 1, 1)).not.toBeNull();
    });
  }

  it("a noise alone never raises the alarm: a blinded ganger hears her walk round it for 3 s and only looks", () => {
    const sim = square();
    const g = enemyAt(sim, "hebi_ganger", 3);
    g.hackFx = { pinged: 0, blind: 1e6, crippled: 0 };
    run(sim, Math.ceil(3 / SIM_DT), WALK);
    expect(g.ai!.alerted).toBe(false);
    expect(g.ai!.lastKnown).toBeTruthy();
    expect(g.ai!.suspicion ?? 0).toBeLessThanOrEqual(NOISE_SUSPICION);
  });

  it("hears a sprint 8 m off and gets a lead to her, not a walk", () => {
    const sprint = square();
    const heard = enemyAt(sprint, "hebi_ganger", 8);
    sprint.step(SPRINT);
    const p = sprint.player()!.position;
    expect(heard.ai!.lastKnown).toBeTruthy();
    expect(Math.hypot(heard.ai!.lastKnown!.x - p.x, heard.ai!.lastKnown!.z - p.z)).toBeLessThan(0.5);
    expect(heard.ai!.alerted).toBe(false);
    const walk = square();
    const deaf = enemyAt(walk, "hebi_ganger", 8);
    run(walk, 30, WALK);
    expect(deaf.ai!.lastKnown ?? null).toBeNull();
  });

  it("does not hear her creep crouched 1 m behind it", () => {
    const sim = square(true);
    const g = enemyAt(sim, "hebi_ganger", 1);
    run(sim, Math.ceil(2 / SIM_DT), CREEP_ACROSS);
    expect(g.ai!.lastKnown ?? null).toBeNull();
    expect(g.ai!.suspicion ?? 0).toBe(0);
    expect(g.ai!.alerted).toBe(false);
  });

  it("hears a landing 5 m off once she is down, not 7 m off, and not while she is in the air", () => {
    const sim = square();
    const g = enemyAt(sim, "hebi_ganger", 5);
    sim.step(input({ jump: true }));
    const p = sim.player()!;
    const landed = until(sim, () => p.fall === undefined, 2);
    expect(landed).not.toBeNull();
    expect(g.ai!.lastKnown).toBeTruthy();
    expect(g.ai!.alerted).toBe(false);
    const far = square();
    const deaf = enemyAt(far, "hebi_ganger", 7);
    far.step(input({ jump: true }));
    until(far, () => far.player()!.fall === undefined, 2);
    expect(deaf.ai!.lastKnown ?? null).toBeNull();
  });

  it("does not hear her from another level", () => {
    const sim = square();
    const p = sim.player()!.position;
    const g = enemyAt(sim, "hebi_ganger", 3);
    g.position = { ...g.position, y: p.y + 4 };
    g.prevPosition = g.position;
    sim.step(WALK);
    expect(g.ai!.lastKnown ?? null).toBeNull();
  });

  it("a friendly ganger does not come over for the steps it hears", () => {
    const base = square().snapshot(null, "t", "");
    const sim = Simulation.fromSnapshot(JSON.parse(JSON.stringify({ ...base, domain: { ...base.domain, reputation: { ...base.domain.reputation, hebi: 30 } } })) as SaveSnapshot);
    for (const e of [...sim.world.with("ai")]) sim.world.remove(e);
    const g = enemyAt(sim, "hebi_ganger", 3);
    run(sim, 10, WALK);
    expect(g.ai!.lastKnown ?? null).toBeNull();
  });

  it("awareness 0.6 and 1.3 (ADR-0066) scale the suspicion a noise gives and move the alarm after it", () => {
    const after = (awareness: number) => {
      const sim = square(false, awareness);
      const g = enemyAt(sim, "hebi_ganger", 3);
      sim.step(WALK);
      const suspicion = g.ai!.suspicion ?? 0;
      return { suspicion, alarm: until(sim, () => g.ai!.alerted, 6)! };
    };
    const story = after(0.6);
    const normal = after(1);
    const hard = after(1.3);
    expect(story.suspicion).toBeLessThan(normal.suspicion);
    expect(hard.suspicion).toBeGreaterThan(normal.suspicion);
    expect(hard.suspicion).toBeLessThan(1);
    expect(story.alarm).toBeGreaterThan(normal.alarm);
    expect(hard.alarm).toBeLessThan(normal.alarm);
  });
});

describe("a suspicious enemy does not look after her through its back (G-294)", () => {
  it("out of its sight, it keeps its facing instead of turning to her", () => {
    const sim = emptySquare(false);
    const g = enemyAt(sim, "hebi_ganger", 5);
    g.ai!.suspicion = 0.6;
    const yaw0 = g.yaw;
    run(sim, 30);
    expect(g.ai!.alerted).toBe(false);
    expect(g.yaw).toBeCloseTo(yaw0, 6);
  });
});
