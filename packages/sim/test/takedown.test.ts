import { describe, expect, it } from "vitest";
import type { DomainEvents } from "@seki/core";
import { SIM_DT, Simulation, TAKEDOWN_PROMPT, TAKEDOWN_REACH, TAKEDOWN_TIME, gangerEntity, takedownDistance, type Entity } from "../src";
import { byKey, collect, input, run, streetSim, teleportPlayer } from "./helpers";

const inCreationOrder = <T extends { id: number }>(es: T[]): T[] => [...es].sort((a, b) => a.id - b.id);

const ticks = (seconds: number) => Math.ceil(seconds / SIM_DT - 1e-9);
const CROUCH = input({ crouch: true });

/** A street with nobody else on it, the player crouched (a Tessen guard does not hear her behind it). */
const quietStreet = (seed = 7): Simulation => {
  const sim = streetSim({ seed });
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  const p = sim.player()!;
  p.posture!.crouched = true;
  p.posture!.amount = 1;
  p.posture!.prevAmount = 1;
  return sim;
};

/** A Tessen guard `distance` m north of the player, facing `yaw` (0 looks north, away from her). */
const guardAt = (sim: Simulation, distance: number, yaw = 0, key = "guard"): Entity => {
  const p = sim.player()!;
  const at = { x: p.position.x, y: p.position.y, z: p.position.z + distance };
  return sim.world.add(gangerEntity(4000 + distance * 10, { key, position: at, yaw }, null, 80, p.chunk ?? "", undefined, "tessen_guard"));
};

type Target = Entity & { health: NonNullable<Entity["health"]>; combatant: NonNullable<Entity["combatant"]> };

/** A bare target for the pure rules: the player stands at the origin, the target `d` m off, seeing her at `bearing`, facing `yaw`. */
const target = (d: number, bearing: number, yaw: number, patch: Partial<Entity> = {}): Target => {
  const position = { x: -Math.sin(bearing) * d, y: 0, z: -Math.cos(bearing) * d };
  const e = gangerEntity(9, { key: "t", position, yaw }, null, 80, "c", undefined, "tessen_guard");
  return Object.assign(e, patch) as Target;
};
const PLAYER: Entity = { id: 1, player: true, position: { x: 0, y: 0, z: 0 }, prevPosition: { x: 0, y: 0, z: 0 }, yaw: 0, prevYaw: 0, pitch: 0 };
const alerted = (t: Target): Target => {
  t.ai!.alerted = true;
  return t;
};

describe("takedown rules (ADR-0065)", () => {
  // `bearing` is where the player stands as seen from the target, against its facing: π is right behind it.
  const at = (d: number, offBack: number, yaw = 0) => target(d, yaw + Math.PI + offBack, yaw);

  it("reaches 1.6 m and no further", () => {
    expect(takedownDistance(PLAYER, alerted(at(1.5, 0)))).toBeCloseTo(1.5);
    expect(takedownDistance(PLAYER, alerted(at(TAKEDOWN_REACH, 0)))).toBeCloseTo(TAKEDOWN_REACH);
    expect(takedownDistance(PLAYER, alerted(at(1.7, 0)))).toBeNull();
  });

  it("takes an alerted target only from the 120° cone behind its back", () => {
    for (const yaw of [0, 1, -2.5]) {
      expect(takedownDistance(PLAYER, alerted(at(1.2, 0, yaw)))).not.toBeNull();
      expect(takedownDistance(PLAYER, alerted(at(1.2, 0.95, yaw)))).not.toBeNull();
      expect(takedownDistance(PLAYER, alerted(at(1.2, -0.95, yaw)))).not.toBeNull();
      expect(takedownDistance(PLAYER, alerted(at(1.2, 1.15, yaw)))).toBeNull();
      expect(takedownDistance(PLAYER, alerted(at(1.2, Math.PI / 2, yaw)))).toBeNull();
      expect(takedownDistance(PLAYER, alerted(at(1.2, Math.PI, yaw)))).toBeNull();
    }
  });

  it("takes a target from any side while it is stunned by a parry or unaware of her", () => {
    const front = () => at(1.2, Math.PI);
    const stunned = alerted(front());
    stunned.melee!.stagger = 0.5;
    stunned.melee!.stunned = true;
    expect(takedownDistance(PLAYER, stunned)).not.toBeNull();
    // A plain hit's stagger is no stun.
    const hit = alerted(front());
    hit.melee!.stagger = 0.5;
    expect(takedownDistance(PLAYER, hit)).toBeNull();
    // Unaware: not alerted, no suspicion, no lead.
    expect(takedownDistance(PLAYER, front())).not.toBeNull();
    const suspicious = front();
    suspicious.ai!.suspicion = 0.2;
    expect(takedownDistance(PLAYER, suspicious)).toBeNull();
    const searching = front();
    searching.ai!.lastKnown = { x: 0, y: 0, z: 0 };
    expect(takedownDistance(PLAYER, searching)).toBeNull();
  });

  it("leaves out the dead, the unconscious and anyone a floor away", () => {
    expect(takedownDistance(PLAYER, at(1.2, 0, 0))).not.toBeNull();
    expect(takedownDistance(PLAYER, target(1.2, Math.PI, 0, { health: { current: 0, max: 80 } }))).toBeNull();
    expect(takedownDistance(PLAYER, target(1.2, Math.PI, 0, { unconscious: true }))).toBeNull();
    const above = at(1.2, 0);
    above.position = { ...above.position, y: 1 };
    expect(takedownDistance(PLAYER, above)).toBeNull();
  });
});

describe("takedown in the simulation (ADR-0065)", () => {
  it("offers the takedown behind a guard and drops the prompt out of reach", () => {
    const sim = quietStreet();
    const focus = collect<DomainEvents["InteractionFocusChanged"]>(sim, "InteractionFocusChanged");
    const guard = guardAt(sim, 1.3);
    sim.step(CROUCH);
    expect(focus.at(-1)).toEqual({ targetId: guard.id, prompt: TAKEDOWN_PROMPT });
    expect(sim.session.takedownTarget?.id).toBe(guard.id);
    const p = sim.player()!;
    teleportPlayer(sim, { ...p.position, z: p.position.z - 0.6 });
    sim.step(CROUCH);
    expect(focus.at(-1)).toEqual({ targetId: null, prompt: null });
  });

  it("does nothing without a target in reach", () => {
    const sim = quietStreet();
    guardAt(sim, 2.5);
    const started = collect(sim, "TakedownStarted");
    sim.step(CROUCH);
    sim.enqueue({ type: "takedown", lethal: false });
    run(sim, 3, CROUCH);
    expect(started).toHaveLength(0);
    expect(sim.session.takedown).toBeNull();
  });

  it("holds both for 1.2 s and knocks the guard out", () => {
    const sim = quietStreet();
    const guard = guardAt(sim, 1.2);
    const done = collect<DomainEvents["TakedownDone"]>(sim, "TakedownDone");
    const started = collect<DomainEvents["TakedownStarted"]>(sim, "TakedownStarted");
    sim.step(CROUCH);
    const p = sim.player()!;
    const from = { ...p.position };
    const guardFrom = { ...guard.position };
    sim.enqueue({ type: "takedown", lethal: false });
    const hold = input({ crouch: true, moveZ: 1, moveX: 1, lookYaw: 0.1 });
    run(sim, ticks(TAKEDOWN_TIME) - 1, hold);
    expect(started).toEqual([{ target: guard.id, duration: TAKEDOWN_TIME }]);
    expect(done).toHaveLength(0);
    expect(p.position.x).toBeCloseTo(from.x, 6);
    expect(p.position.z).toBeCloseTo(from.z, 6);
    expect(p.yaw).toBe(0);
    expect(guard.position.x).toBeCloseTo(guardFrom.x, 6);
    expect(guard.position.z).toBeCloseTo(guardFrom.z, 6);
    sim.step(hold);
    expect(done).toEqual([{ target: guard.id, lethal: false, witnessed: false }]);
    expect(guard.unconscious).toBe(true);
    expect(guard.health!.current).toBe(80);
    expect(sim.world.has(guard)).toBe(true);
    // Free again: she walks, and the guard is nobody to take down twice.
    run(sim, 10, hold);
    expect(Math.hypot(p.position.x - from.x, p.position.z - from.z)).toBeGreaterThan(0.1);
    expect(sim.session.takedownTarget).toBeNull();
  });

  it("kills with `lethal`, as a death in a fight", () => {
    const sim = quietStreet();
    const guard = guardAt(sim, 1.2);
    const done = collect<DomainEvents["TakedownDone"]>(sim, "TakedownDone");
    const killed = collect<DomainEvents["EntityKilled"]>(sim, "EntityKilled");
    sim.step(CROUCH);
    sim.enqueue({ type: "takedown", lethal: true });
    run(sim, ticks(TAKEDOWN_TIME), CROUCH);
    expect(done).toEqual([{ target: guard.id, lethal: true, witnessed: false }]);
    expect(killed).toEqual([{ entityId: guard.id, tag: null, killerId: sim.player()!.id }]);
    expect(sim.world.has(guard)).toBe(false);
    expect(sim.domain.flags).toContain("dead:guard");
  });

  it("kills when the attack button is held through most of it, and fires nothing until let go", () => {
    const sim = quietStreet();
    const guard = guardAt(sim, 1.2);
    const done = collect<DomainEvents["TakedownDone"]>(sim, "TakedownDone");
    const shots = collect(sim, "ShotFired");
    const swings = collect(sim, "MeleeSwing");
    sim.step(CROUCH);
    sim.enqueue({ type: "takedown", lethal: false });
    const fire = input({ crouch: true, fire: true });
    run(sim, ticks(TAKEDOWN_TIME), fire);
    expect(done).toEqual([{ target: guard.id, lethal: true, witnessed: false }]);
    // Still held after the kill: no shot, no swing.
    run(sim, 30, fire);
    expect(shots).toHaveLength(0);
    expect(swings).toHaveLength(0);
    // Let go and pressed again: the gun fires as before.
    sim.step(CROUCH);
    run(sim, 5, fire);
    expect(shots.length).toBeGreaterThan(0);
  });

  it("knocks out when the attack button is held only for the last moment", () => {
    const sim = quietStreet();
    const guard = guardAt(sim, 1.2);
    const done = collect<DomainEvents["TakedownDone"]>(sim, "TakedownDone");
    sim.step(CROUCH);
    sim.enqueue({ type: "takedown", lethal: false });
    run(sim, ticks(TAKEDOWN_TIME) - 5, CROUCH);
    run(sim, 5, input({ crouch: true, fire: true }));
    expect(done).toEqual([{ target: guard.id, lethal: false, witnessed: false }]);
  });

  it("does not take down past a nearer prompt (talk, loot, a door): the key is theirs", () => {
    const sim = quietStreet();
    const guard = guardAt(sim, 1.4);
    const p = sim.player()!;
    const at = { x: p.position.x + 0.5, y: p.position.y, z: p.position.z };
    sim.world.add({ id: 99_999, position: at, prevPosition: at, yaw: 0, prevYaw: 0, pitch: 0, interactable: { kind: "dialogue", dialogueId: "kaito", prompt: "prompt.talk.kaito", radius: 2 } });
    const focus = collect<DomainEvents["InteractionFocusChanged"]>(sim, "InteractionFocusChanged");
    const started = collect(sim, "TakedownStarted");
    sim.step(CROUCH);
    expect(focus.at(-1)?.prompt).toBe("prompt.talk.kaito");
    expect(sim.session.takedownTarget).toBeNull();
    sim.enqueue({ type: "takedown", lethal: false });
    sim.step(CROUCH);
    expect(started).toHaveLength(0);
    expect(guard.unconscious).toBeUndefined();
  });

  it("wipes the mind of a guard knocked out mid-fight: it no longer counts as fighting", () => {
    const sim = quietStreet();
    const guard = guardAt(sim, 1.2, Math.PI);
    guard.ai!.alerted = true;
    guard.ai!.lastKnown = { ...sim.player()!.position };
    // Stunned by a parry: open from the front.
    guard.melee!.stagger = 2;
    guard.melee!.stunned = true;
    sim.step(CROUCH);
    sim.enqueue({ type: "takedown", lethal: false });
    run(sim, ticks(TAKEDOWN_TIME), CROUCH);
    expect(guard.unconscious).toBe(true);
    expect(guard.ai!.alerted).toBe(false);
    expect(guard.ai!.lastKnown ?? null).toBeNull();
    expect(guard.ai!.search ?? 0).toBe(0);
    // A shot into the body hurts it, but provokes nothing.
    const hits = collect<DomainEvents["DamageDealt"]>(sim, "DamageDealt");
    teleportPlayer(sim, { ...guard.position, z: guard.position.z - 3 }, 0, 0.1);
    run(sim, 3, input({ fire: true }));
    expect(hits.some((h) => h.targetId === guard.id)).toBe(true);
    expect(guard.ai!.alerted).toBe(false);
  });

  it("breaks when the player is hurt: the guard breaks free alerted", () => {
    const sim = quietStreet();
    const guard = guardAt(sim, 1.2);
    const broken = collect<DomainEvents["TakedownBroken"]>(sim, "TakedownBroken");
    const done = collect(sim, "TakedownDone");
    sim.step(CROUCH);
    sim.enqueue({ type: "takedown", lethal: false });
    run(sim, ticks(TAKEDOWN_TIME / 2), CROUCH);
    const p = sim.player()!;
    p.health = { ...p.health!, current: p.health!.current - 5 };
    sim.step(CROUCH);
    expect(broken).toEqual([{ target: guard.id, reason: "damage" }]);
    expect(guard.ai!.alerted).toBe(true);
    expect(guard.ai!.lastKnown?.x).toBeCloseTo(p.position.x);
    expect(guard.unconscious).toBeUndefined();
    run(sim, ticks(TAKEDOWN_TIME), CROUCH);
    expect(done).toHaveLength(0);
    expect(sim.session.takedown).toBeNull();
  });

  it("breaks when the target is gone", () => {
    const sim = quietStreet();
    const guard = guardAt(sim, 1.2);
    const broken = collect<DomainEvents["TakedownBroken"]>(sim, "TakedownBroken");
    sim.step(CROUCH);
    sim.enqueue({ type: "takedown", lethal: false });
    run(sim, 5, CROUCH);
    sim.world.remove(guard);
    sim.step(CROUCH);
    expect(broken).toEqual([{ target: guard.id, reason: "gone" }]);
    expect(sim.session.takedown).toBeNull();
  });

  it("the knocked-out guard sees, hears and fights nothing, and is nobody's target", () => {
    const sim = quietStreet();
    const guard = guardAt(sim, 1.2);
    sim.step(CROUCH);
    sim.enqueue({ type: "takedown", lethal: false });
    run(sim, ticks(TAKEDOWN_TIME), CROUCH);
    expect(guard.unconscious).toBe(true);
    // Standing in front of it, then a shot right by it.
    const p = sim.player()!;
    // In front of it, looking away (the shot goes north, not into the guard).
    teleportPlayer(sim, { ...guard.position, z: guard.position.z + 1.5 }, 0);
    const shots = collect<DomainEvents["ShotFired"]>(sim, "ShotFired");
    run(sim, ticks(2), input());
    sim.step(input({ fire: true }));
    run(sim, ticks(1), input());
    expect(guard.ai!.alerted).toBe(false);
    expect(guard.ai!.sees).toBe(false);
    expect(guard.ai!.lastKnown ?? null).toBeNull();
    expect(shots.filter((s) => s.shooterId === guard.id)).toHaveLength(0);
    // A killer sent after it leaves it be.
    teleportPlayer(sim, { ...p.position, x: p.position.x + 60 });
    const at = { x: guard.position.x + 4, y: guard.position.y, z: guard.position.z };
    const killer = sim.world.add(gangerEntity(4100, { key: "killer", position: at, yaw: -Math.PI / 2 }, null, 80, guard.chunk ?? "", "guard"));
    run(sim, ticks(3), input());
    expect(shots.filter((s) => s.shooterId === killer.id)).toHaveLength(0);
    expect(guard.health!.current).toBe(80);
  });

  it("is not saved yet: a load brings the knocked-out ganger round (stage 3 saves it)", () => {
    const sim = streetSim({ seed: 7 });
    const ganger = inCreationOrder([...sim.world.with("ai")].filter((g) => g.key))[0];
    for (const g of [...sim.world.with("ai")]) if (g !== ganger) sim.world.remove(g);
    expect(ganger?.key).toBeDefined();
    // She stands right by it, where it is at home (its chunk stays loaded).
    teleportPlayer(sim, { ...ganger!.position, z: ganger!.position.z - 1.2 });
    // Blinded by a hack, it stays unaware of her: the takedown is open from any side.
    ganger!.hackFx = { pinged: 0, blind: 100, crippled: 0 };
    sim.step(input());
    sim.enqueue({ type: "takedown", lethal: false });
    run(sim, ticks(TAKEDOWN_TIME), input());
    expect(ganger!.unconscious).toBe(true);
    const loaded = Simulation.fromSnapshot(sim.snapshot(null, "t", ""));
    const back = byKey(loaded, ganger!.key!);
    expect(back).toBeDefined();
    expect(back!.unconscious).toBeUndefined();
  });
});
