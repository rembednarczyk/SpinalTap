import { describe, expect, it } from "vitest";
import { type DomainEvents, SECONDS_PER_HOUR, type Vec3 } from "@seki/core";
import { BALCONY_TOP, JUMP_SPEED, MARKET_PLACE, Simulation, type Entity, aabbFromCenter, gangerEntity, ground, market } from "../src";
import { withCarry } from "../src/world/bodies";
import { STREET_START, collect, input, run, teleportPlayer } from "./helpers";
import { CROUCH, patrol, quietStreet, stallholder, takeDown, ticks, victim, walkAway } from "./takedown-scenes";

/**
 * What a body on the shoulder rules out (ADR-0065, stage 3, after the review of PR #128): the
 * ladders, the street scenes, the weapon, the abilities and the quickhacks; and that hiding and
 * finding do not hang on the geometry or on who looked first.
 */

const STAND = input();

/** A knocked-out Tessen guard 1 m south of the player, put on her shoulder. */
const shoulder = (sim: Simulation): Entity => {
  const p = sim.player()!;
  const g = sim.world.add(gangerEntity(4000, { key: "carried", position: { ...p.position, z: p.position.z - 1 }, yaw: 0 }, null, 80, p.chunk ?? "", undefined, "tessen_guard"));
  sim.world.addComponent(g, "unconscious", true);
  sim.world.addComponent(g, "downed", {
    playerAt: { ...p.position },
    fought: false,
    found: false,
    reported: false,
    finder: null,
    wake: 0,
    dead: false,
    lookedBy: [],
    carried: false,
    hidden: false,
    frame: null,
  });
  sim.step(STAND);
  sim.enqueue({ type: "carry-body" });
  sim.step(STAND);
  expect(sim.session.carrying).toBe(g.id);
  return g;
};

describe("a body on her shoulder rules out (ADR-0065)", () => {
  it("the fire escape ladder: she walks into it and stays on the ground", () => {
    const climbs = (carry: boolean): number => {
      const sim = Simulation.create({ seed: 1 });
      const start = market(73.2, 0, 65.6);
      teleportPlayer(sim, start, Math.PI);
      run(sim, 2);
      teleportPlayer(sim, start, Math.PI);
      for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
      if (carry) {
        shoulder(sim);
        teleportPlayer(sim, start, Math.PI);
      }
      const p = sim.player()!;
      let top = p.position.y;
      for (let i = 0; i < 360; i++) {
        sim.step(input({ moveZ: 1 }));
        top = Math.max(top, p.position.y);
      }
      return top - MARKET_PLACE.y;
    };
    // Without a body she is up on the balcony.
    expect(climbs(false)).toBeGreaterThan(BALCONY_TOP - 0.5);
    expect(climbs(true)).toBeLessThan(0.5);
  });

  it("a pull-up onto a ledge: in the air against a wall she slides down instead of catching it", () => {
    const mantles = (carry: boolean): number => {
      const sim = Simulation.create({ seed: 1 });
      const o = STREET_START;
      const c = { x: o.x, y: o.y + 1.1, z: o.z + 1.7 };
      sim.world.add({ id: 90001, position: c, prevPosition: c, yaw: 0, prevYaw: 0, pitch: 0, solid: aabbFromCenter(c, { x: 3, y: 2.2, z: 2 }) });
      teleportPlayer(sim, o, 0);
      run(sim, 1);
      if (carry) {
        shoulder(sim);
        teleportPlayer(sim, o, 0);
      }
      const done = collect(sim, "Mantled");
      // Up in the air (a jump of her own, or thrown up by a blast): the jump button is not hers.
      const p = sim.player()!;
      p.fall = JUMP_SPEED;
      p.airPeak = p.position.y;
      run(sim, 60, input({ moveZ: 1 }));
      return done.length;
    };
    expect(mantles(false)).toBe(1);
    expect(mantles(true)).toBe(0);
  });

  it("a street scene: the poet does not stop her while she carries a body", () => {
    const evening = (): Simulation => {
      const snap = Simulation.create({ seed: 6 }).snapshot(null, "t", "");
      const sim = Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, flags: ["met_fixer"], clock: { seconds: 21 * SECONDS_PER_HOUR } } });
      run(sim, 1);
      return sim;
    };
    const POET = { x: 102, z: -23 };
    const sim = evening();
    const started = collect(sim, "EncounterStarted");
    // Out of the poet's reach she picks the body up, then walks up to him.
    teleportPlayer(sim, ground(POET.x, POET.z + 10));
    shoulder(sim);
    teleportPlayer(sim, ground(POET.x, POET.z + 3));
    run(sim, 3, STAND);
    expect(started).toEqual([]);
    expect(sim.session.dialogueActive).toBe(false);
    // Put down, the scene starts.
    sim.enqueue({ type: "drop-body" });
    run(sim, 2, STAND);
    expect(started).toHaveLength(1);
  });

  it("the weapon: no change of weapon, no reload, no holstering", () => {
    const sim = quietStreet();
    const p = sim.player()!;
    const holstered = p.combatant!.holstered;
    shoulder(sim);
    const switched = collect(sim, "WeaponSwitched");
    sim.step(input({ toggleWeapon: true }));
    sim.step(input({ weaponCycle: 1 }));
    sim.step(input({ weaponSlot: 3 }));
    sim.step(input({ reload: true }));
    expect(p.combatant!.holstered).toBe(holstered);
    expect(switched).toEqual([]);
    expect(p.combatant!.reloading).toBe(0);
    sim.enqueue({ type: "drop-body" });
    sim.step(STAND);
    sim.step(input({ toggleWeapon: true }));
    expect(p.combatant!.holstered).toBe(!holstered);
  });

  it("every hand action of the input frame, but the medkit, the move and the crouch", () => {
    const all = { ...STAND, moveZ: 1, crouch: true, useItem: true, scan: true, fire: true, aim: true, reload: true, toggleWeapon: true, weaponSlot: 2, weaponCycle: -1, ability: true, quickhack: 1, sprint: true, jump: true, dash: true } as const;
    expect(withCarry(null, all)).toBe(all);
    expect(withCarry(7, all)).toEqual({ ...all, fire: false, aim: false, reload: false, toggleWeapon: false, weaponSlot: 0, weaponCycle: 0, ability: false, quickhack: 0, sprint: false, jump: false, dash: false });
  });
});

/** A crate 0.2 m high (a lid on the ground): it hides nothing from a guard's eyes. */
const lowCrate = (sim: Simulation, id: number, at: Vec3): Entity =>
  sim.world.add({
    id,
    position: { ...at, y: at.y + 0.1 },
    prevPosition: { ...at, y: at.y + 0.1 },
    yaw: 0,
    prevYaw: 0,
    pitch: 0,
    view: { kind: "block", size: { x: 1.2, y: 0.2, z: 1.2 }, material: "metal" },
    solid: { min: { x: at.x - 0.6, y: at.y, z: at.z - 0.6 }, max: { x: at.x + 0.6, y: at.y + 0.2, z: at.z + 0.6 } },
    hide: "container",
  });

describe("hidden and found, whatever the geometry and whoever came first (ADR-0065)", () => {
  it("a hidden body in plain sight of a guard (the hiding place covers nothing) is not found", () => {
    const sim = quietStreet();
    const guard = victim(sim);
    takeDown(sim);
    const p = sim.player()!.position;
    const crate = lowCrate(sim, 4500, { x: p.x + 1.2, y: p.y, z: p.z });
    sim.step(STAND);
    sim.enqueue({ type: "carry-body" });
    sim.step(STAND);
    sim.enqueue({ type: "drop-body" });
    sim.step(STAND);
    expect(guard.downed?.hidden).toBe(true);
    // The point the eyes look for, 0.3 m over the floor of the crate, is above its 0.2 m.
    expect(crate.solid!.max.y).toBeLessThan(guard.position.y + 0.3);
    walkAway(sim);
    const found = collect(sim, "BodyFound");
    patrol(sim, 4100, { ...guard.position, x: guard.position.x + 4 }, -Math.PI / 2);
    run(sim, ticks(12), CROUCH);
    expect(found).toEqual([]);
  });

  it("a dead body looked at by a passer-by first is still found and reported by the security", () => {
    const sim = quietStreet();
    victim(sim);
    takeDown(sim, true);
    const body = [...sim.world.with("downed")][0]!;
    walkAway(sim);
    const reports = collect<DomainEvents["CrimeReported"]>(sim, "CrimeReported");
    // A bystander comes by once the street has calmed down after the death, stops by it and looks.
    const civ = stallholder(sim, 4300, { ...body.position, x: body.position.x + 1 });
    run(sim, ticks(20), CROUCH);
    delete civ.civilian!.crowd;
    civ.position = { ...body.position, x: body.position.x + 1 };
    civ.prevPosition = civ.position;
    sim.step(CROUCH);
    expect(body.downed.lookedBy).toContain(civ.id);
    const g = patrol(sim, 4100, { ...body.position, x: body.position.x + 6 }, -Math.PI / 2);
    run(sim, ticks(12), CROUCH);
    expect(reports.map((r) => [r.crime, r.channel, r.witnessId])).toEqual([["murder", "patrol", g.id]]);
  });

  it("the weapon slots in the character menu: no drawing or holstering through the equipment (G-164)", () => {
    const sim = Simulation.create({ seed: 1 });
    teleportPlayer(sim, STREET_START, 0);
    run(sim, 2);
    for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
    const before = { ...sim.domain.equipment };
    expect(before.secondary).not.toBeNull();
    shoulder(sim);
    sim.enqueue({ type: "unequip-item", slot: "secondary" });
    sim.step(STAND);
    expect(sim.domain.equipment).toEqual(before);
    // Down with the body, the menu works again.
    sim.enqueue({ type: "drop-body" });
    sim.step(STAND);
    sim.enqueue({ type: "unequip-item", slot: "secondary" });
    sim.step(STAND);
    expect(sim.domain.equipment.secondary).toBeNull();
  });
});
