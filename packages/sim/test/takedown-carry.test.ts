import { describe, expect, it } from "vitest";
import type { DomainEvents, Vec3 } from "@seki/core";
import { CARRY_PROMPT, CARRY_SPEED, DROP_PROMPT, HIDE_PROMPT, type Entity, type Simulation, gangerEntity, playerStatsOf } from "../src";
import { collect, input, run } from "./helpers";
import { CROUCH, offset, patrol, quietStreet, takeDown, ticks, victim, walkAway } from "./takedown-scenes";

/** Stage 3 of ADR-0065: carrying a body, dropping it, hiding it; the dead left lying. */

const STAND = input();
const WALK = input({ moveZ: 1 });

/** A dumpster (2.4 x 1.4 x 1.4 m) of the content's kind, its centre on the ground at `at`. */
const dumpster = (sim: Simulation, id: number, at: Vec3): Entity => {
  const size = { x: 2.4, y: 1.4, z: 1.4 };
  const center = { x: at.x, y: at.y + size.y / 2, z: at.z };
  return sim.world.add({
    id,
    position: center,
    prevPosition: center,
    yaw: 0,
    prevYaw: 0,
    pitch: 0,
    chunk: sim.player()!.chunk ?? "",
    view: { kind: "block", size, material: "metal" },
    solid: { min: { x: center.x - 1.2, y: at.y, z: center.z - 0.7 }, max: { x: center.x + 1.2, y: at.y + 1.4, z: center.z + 0.7 } },
    hide: "dumpster",
  });
};

/** A Tessen guard knocked out 1.2 m north of the player, who stands up again. */
const knockedOut = (seed = 7): { sim: Simulation; guard: Entity } => {
  const sim = quietStreet(seed);
  const guard = victim(sim);
  takeDown(sim);
  expect(guard.unconscious).toBe(true);
  return { sim, guard };
};

/** Another Tessen guard 1.2 m north of the player, its back to her. */
const secondGuard = (sim: Simulation): Entity =>
  sim.world.add(gangerEntity(4001, { key: "second", position: offset(sim, 0, 1.2), yaw: 0 }, null, 80, sim.player()!.chunk ?? "", undefined, "tessen_guard"));

/** Picks up whatever body the prompt offers. */
const pickUp = (sim: Simulation, frame = STAND): void => {
  sim.step(frame);
  sim.enqueue({ type: "carry-body" });
  sim.step(frame);
};

const flat = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.z - b.z);

describe("carrying a body (ADR-0065, stage 3)", () => {
  it("offers the body, picks it up, carries it along and puts it down at her feet", () => {
    const { sim, guard } = knockedOut();
    sim.step(STAND);
    expect(sim.session.focusId).toBe(guard.id);
    expect(sim.session.focusPrompt).toBe(CARRY_PROMPT);
    sim.enqueue({ type: "carry-body" });
    sim.step(STAND);
    expect(sim.session.carrying).toBe(guard.id);
    expect(guard.downed?.carried).toBe(true);
    // Out of the street's collisions while on her shoulder.
    expect(guard.body).toBeUndefined();
    expect(sim.session.focusPrompt).toBe(DROP_PROMPT);
    run(sim, ticks(2), WALK);
    const p = sim.player()!;
    expect(flat(guard.position, p.position)).toBeLessThan(1e-9);
    const at = { ...p.position };
    sim.enqueue({ type: "drop-body" });
    sim.step(STAND);
    expect(sim.session.carrying).toBeNull();
    expect(guard.downed?.carried).toBe(false);
    expect(guard.body).toBeDefined();
    expect(guard.unconscious).toBe(true);
    // In front of where she stood, touching her.
    run(sim, 3, STAND);
    expect(flat(guard.position, at)).toBeLessThan(1);
    expect(guard.position.z).toBeGreaterThan(at.z);
    expect(flat(guard.position, sim.player()!.position)).toBeGreaterThan(0.5);
    // Lying again: the prompt offers it once more.
    expect(sim.session.focusPrompt).toBe(CARRY_PROMPT);
  });

  it("refuses a body out of reach, and a second one while she carries the first", () => {
    const { sim, guard } = knockedOut();
    const p = sim.player()!;
    sim.player()!.position = { ...p.position, z: p.position.z - 1 };
    sim.step(STAND);
    expect(sim.session.bodyTarget).toBeNull();
    sim.enqueue({ type: "carry-body" });
    sim.step(STAND);
    expect(sim.session.carrying).toBeNull();
    sim.player()!.position = { ...sim.player()!.position, z: guard.position.z - 1.2 };
    pickUp(sim);
    expect(sim.session.carrying).toBe(guard.id);
    sim.enqueue({ type: "carry-body" });
    sim.step(STAND);
    expect(sim.session.carrying).toBe(guard.id);
  });

  it("walks at 0.6 of her walk, does not sprint or jump, and holds no weapon", () => {
    const { sim } = knockedOut();
    const p = sim.player()!;
    const walk = playerStatsOf(sim.domain).moveSpeed;
    // Up from the crouch first.
    run(sim, ticks(1), STAND);
    sim.step(WALK);
    expect(Math.hypot(p.velocity!.x, p.velocity!.z)).toBeCloseTo(walk, 6);
    pickUp(sim);
    sim.step(WALK);
    expect(Math.hypot(p.velocity!.x, p.velocity!.z)).toBeCloseTo(walk * CARRY_SPEED, 6);
    sim.step(input({ moveZ: 1, sprint: true }));
    expect(Math.hypot(p.velocity!.x, p.velocity!.z)).toBeCloseTo(walk * CARRY_SPEED, 6);
    expect(p.posture!.sprinting).toBe(false);
    sim.step(input({ jump: true }));
    run(sim, 3, STAND);
    expect(p.fall).toBeUndefined();
    const shots = collect(sim, "ShotFired");
    const swings = collect(sim, "MeleeSwing");
    run(sim, ticks(1), input({ fire: true, aim: true }));
    expect(shots).toEqual([]);
    expect(swings).toEqual([]);
    expect(p.posture!.aim).toBe(0);
    // Put down, the jump is hers again.
    sim.enqueue({ type: "drop-body" });
    sim.step(STAND);
    sim.step(input({ jump: true }));
    expect(p.fall).toBeGreaterThan(0);
    // And the weapon: the same button strikes or shoots.
    run(sim, ticks(2), STAND);
    run(sim, ticks(1), input({ fire: true }));
    expect(shots.length + swings.length).toBeGreaterThan(0);
  });

  it("no takedown with the hands full", () => {
    const { sim, guard } = knockedOut();
    pickUp(sim);
    // Another guard, its back to her, right in front.
    const other = secondGuard(sim);
    sim.step(STAND);
    expect(other.unconscious).toBeUndefined();
    expect(sim.session.takedownTarget).toBeNull();
    expect(sim.session.focusPrompt).toBe(DROP_PROMPT);
    expect(guard.downed?.carried).toBe(true);
  });
});

describe("hiding a body (ADR-0065, stage 3)", () => {
  it("into a dumpster in reach: BodyHidden, gone from sight, and a guard looking right at it finds nothing", () => {
    const { sim, guard } = knockedOut();
    const bin = dumpster(sim, 4500, offset(sim, 2, 0));
    pickUp(sim);
    expect(sim.session.focusPrompt).toBe(HIDE_PROMPT);
    expect(sim.session.focusId).toBe(bin.id);
    const hidden = collect<DomainEvents["BodyHidden"]>(sim, "BodyHidden");
    sim.enqueue({ type: "drop-body" });
    sim.step(STAND);
    expect(hidden).toEqual([{ body: guard.id, spot: bin.id }]);
    expect(guard.downed?.hidden).toBe(true);
    expect(guard.view).toBeUndefined();
    expect(guard.body).toBeUndefined();
    expect(flat(guard.position, bin.position)).toBeLessThan(1e-9);
    // Nobody picks it up again, and the bin takes no second body.
    sim.step(STAND);
    expect(sim.session.bodyTarget).toBeNull();
    walkAway(sim);
    const found = collect(sim, "BodyFound");
    const reports = collect(sim, "CrimeReported");
    patrol(sim, 4100, { ...bin.position, x: bin.position.x + 4 }, -Math.PI / 2);
    run(sim, ticks(WAKE_SECONDS), CROUCH);
    expect(found).toEqual([]);
    expect(reports).toEqual([]);
    expect(sim.domain.heat.level).toBe(0);
    expect(guard.unconscious).toBe(true);
  });

  it("left out in the open, the same guard finds it", () => {
    const { sim, guard } = knockedOut();
    const bin = dumpster(sim, 4500, offset(sim, 6, 0));
    pickUp(sim);
    // Out of reach of the bin: the key drops it.
    expect(sim.session.focusPrompt).toBe(DROP_PROMPT);
    sim.enqueue({ type: "drop-body" });
    sim.step(STAND);
    expect(guard.downed?.hidden).toBe(false);
    walkAway(sim);
    const found = collect<DomainEvents["BodyFound"]>(sim, "BodyFound");
    const g = patrol(sim, 4100, { ...guard.position, x: guard.position.x + 4 }, -Math.PI / 2);
    sim.step(CROUCH);
    expect(found).toEqual([{ body: guard.id, finder: g.id }]);
    expect(bin.hide).toBe("dumpster");
  });

  it("one body per hiding place", () => {
    const { sim, guard } = knockedOut();
    dumpster(sim, 4500, offset(sim, 2, 0));
    pickUp(sim);
    sim.enqueue({ type: "drop-body" });
    sim.step(STAND);
    expect(guard.downed?.hidden).toBe(true);
    const second = secondGuard(sim);
    takeDown(sim);
    pickUp(sim);
    expect(sim.session.carrying).toBe(second.id);
    expect(sim.session.hideSpot).toBeNull();
    expect(sim.session.focusPrompt).toBe(DROP_PROMPT);
  });
});

/** Long enough for a guard to see the body, walk over and wake it, were it in sight. */
const WAKE_SECONDS = 12;

describe("the dead of a takedown (ADR-0065, stage 3)", () => {
  it("stay lying as a body: found as a murder, woken by nobody, carried like the rest", () => {
    const sim = quietStreet();
    const guard = victim(sim);
    const killed = collect<DomainEvents["EntityKilled"]>(sim, "EntityKilled");
    takeDown(sim, true);
    expect(killed.map((k) => k.entityId)).toEqual([guard.id]);
    const body = [...sim.world.with("downed")].find((e) => e.id === guard.id)!;
    expect(body).toBeDefined();
    expect(body.downed.dead).toBe(true);
    expect(body.health).toBeUndefined();
    expect(body.ai).toBeUndefined();
    expect(body.unconscious).toBe(true);
    walkAway(sim);
    const found = collect<DomainEvents["BodyFound"]>(sim, "BodyFound");
    const reports = collect<DomainEvents["CrimeReported"]>(sim, "CrimeReported");
    const g = patrol(sim, 4100, { ...body.position, x: body.position.x + 6 }, -Math.PI / 2);
    run(sim, ticks(WAKE_SECONDS), CROUCH);
    expect(found).toEqual([{ body: body.id, finder: g.id }]);
    expect(reports.map((r) => [r.crime, r.channel])).toEqual([["murder", "patrol"]]);
    expect(body.downed.checked).toBe(true);
    expect([...sim.world].includes(body)).toBe(true);
  });

  it("can be carried and hidden", () => {
    const sim = quietStreet();
    victim(sim);
    takeDown(sim, true);
    const body = [...sim.world.with("downed")][0]!;
    const bin = dumpster(sim, 4500, offset(sim, 2, 0));
    pickUp(sim);
    expect(sim.session.carrying).toBe(body.id);
    sim.enqueue({ type: "drop-body" });
    sim.step(STAND);
    expect(body.downed.hidden).toBe(true);
    expect(flat(body.position, bin.position)).toBeLessThan(1e-9);
  });
});
