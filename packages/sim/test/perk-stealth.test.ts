import { describe, expect, it } from "vitest";
import { type DomainEvents, type PerkId, contractTag, findItem, updateItem } from "@seki/core";
import { GENZO_SPOT, SIM_HZ, Simulation, TAKEDOWN_TIME, docks, gangerEntity, ground, type Entity } from "../src";
import { byKey, collect, input, run, streetSim, teleportPlayer } from "./helpers";
import { emptySquare, enemyAt } from "./stealth-scenes";
import { CROUCH, quietStreet, takeDown, ticks, victim } from "./takedown-scenes";
import { tough } from "./difficulty-scenes";
import { patchDomain, withPerks } from "./perk-scenes";

/*
 * The Net and Shadow perks in the running game (ADR-0059, stage 3), in the scenes of the hacking,
 * hearing and takedown tests: once with the perk, once with only the attribute it needs.
 */

type Perks = Partial<Record<PerkId, number>>;

/** In the docks with one Tessen guard 8 m west (and `second` more next to it), the scanner on its chest. */
const hackScene = (perks: Perks, bought: boolean, second = false): { sim: Simulation; first: Entity; other: Entity | null } => {
  const base = streetSim({ seed: 5 });
  const sim = Simulation.fromSnapshot(base.snapshot(null, "t", ""));
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  withPerks(sim, perks, bought);
  teleportPlayer(sim, docks(16, 0, 97), -Math.PI / 2);
  sim.step();
  const p = sim.player()!.position;
  const guard = (id: number, dz: number) => sim.world.add(gangerEntity(id, { key: `guard-${id}`, position: { ...p, x: p.x - 8, z: p.z + dz }, yaw: Math.PI / 2 }, null, 1e6, "nabrzeze-1-1", undefined, "tessen_guard"));
  const first = guard(90010, 0);
  const other = second ? guard(90011, 2.5) : null;
  sim.player()!.pitch = Math.atan2(1.62 - 1.25, 8);
  return { sim, first, other };
};

describe("Net", () => {
  it("Fast Upload: the upload takes 20% less at two ranks", () => {
    const upload = (bought: boolean) => {
      const { sim } = hackScene({ net_fast_upload: 2 }, bought);
      const started = collect<DomainEvents["QuickhackStarted"]>(sim, "QuickhackStarted");
      sim.step(input({ scan: true }));
      sim.step(input({ scan: true, quickhack: 1 }));
      return started[0]!.upload;
    };
    expect(upload(true)).toBeCloseTo(upload(false) * 0.8, 9);
  });

  it("Chain: the quickhack also lands on the next guard 2.5 m away, with one XP and no trace of its own", () => {
    const applied = (bought: boolean) => {
      const { sim, first, other } = hackScene({ net_chain: 1 }, bought, true);
      const hits = collect<DomainEvents["QuickhackApplied"]>(sim, "QuickhackApplied");
      const xp = collect(sim, "ExperienceGained");
      sim.step(input({ scan: true }));
      sim.step(input({ scan: true, quickhack: 1 }));
      run(sim, ticks(3), input({ scan: true }));
      return { targets: hits.map((h) => h.targetId), first: first.id, other: other!.id, xp: xp.length };
    };
    const plain = applied(false);
    expect(plain.targets).toEqual([plain.first]);
    const chained = applied(true);
    expect(chained.targets).toEqual([chained.first, chained.other]);
    expect(chained.xp).toBe(plain.xp);
  });

  it("Buffer and Recycler: a bigger pool that fills half again as fast", () => {
    const regen = (bought: boolean) => {
      const { sim } = hackScene({ net_buffer: 2, net_recycler: 1 }, bought);
      for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
      patchDomain(sim, (d) => ({ ...d, netrun: { ...d.netrun, ram: 0 } }));
      run(sim, ticks(1));
      return sim.domain.netrun.ram;
    };
    expect(regen(true)).toBeCloseTo(regen(false) * 1.5, 6);
  });

  it("Ghost Signal: a camera's spot meter fills 30% slower at two ranks", () => {
    const spot = (bought: boolean) => {
      const sim = withPerks(Simulation.create({ seed: 8 }), { net_ghost_signal: 2 }, bought);
      teleportPlayer(sim, ground(GENZO_SPOT.x + 0.4, GENZO_SPOT.z - 2), 0);
      sim.step();
      tough(sim);
      sim.enqueue({ type: "accept-contract", kind: "infiltrate" });
      sim.step();
      const c = sim.domain.contracts.active!;
      for (const e of [...sim.world].filter((x) => x.tag === contractTag(c.id))) e.health = { current: 0, max: 1 };
      sim.step();
      const cam = byKey(sim, "dev:doki-office-cam")!;
      teleportPlayer(sim, { x: cam.position.x + Math.sin(cam.yaw) * 6, y: sim.player()!.position.y, z: cam.position.z + Math.cos(cam.yaw) * 6 }, 0);
      run(sim, 0.2 * SIM_HZ);
      return cam.device!.spot;
    };
    const plain = spot(false);
    expect(plain).toBeGreaterThan(0);
    expect(spot(true)).toBeCloseTo(0.7 * plain, 9);
  });
});

describe("Shadow", () => {
  it("Soft Steps: a walk 3 m behind a ganger is not heard at two ranks", () => {
    const heard = (bought: boolean) => {
      const sim = withPerks(emptySquare(false), { shadow_soft_steps: 2 }, bought);
      const p = sim.player()!;
      p.yaw = Math.PI / 2;
      p.prevYaw = p.yaw;
      const g = enemyAt(sim, "hebi_ganger", 3);
      sim.step(input({ moveZ: 1 }));
      return !!g.ai!.lastKnown;
    };
    expect(heard(false)).toBe(true);
    expect(heard(true)).toBe(false);
  });

  it("Quick Takedown: the hold is 40% shorter at two ranks", () => {
    const hold = (bought: boolean) => {
      const sim = withPerks(quietStreet(), { shadow_quick_takedown: 2 }, bought);
      const g = victim(sim);
      const started = collect<DomainEvents["TakedownStarted"]>(sim, "TakedownStarted");
      sim.step(CROUCH);
      sim.enqueue({ type: "takedown", lethal: false });
      run(sim, ticks(TAKEDOWN_TIME * 0.6) + 1, CROUCH);
      return { duration: started[0]!.duration, down: g.unconscious === true };
    };
    expect(hold(false)).toEqual({ duration: TAKEDOWN_TIME, down: false });
    const quick = hold(true);
    expect(quick.duration).toBeCloseTo(TAKEDOWN_TIME * 0.6, 9);
    expect(quick.down).toBe(true);
  });

  it("Mule: she carries a body at 0.85 of her walk instead of 0.6", () => {
    const speed = (bought: boolean) => {
      const sim = withPerks(quietStreet(), { shadow_mule: 1 }, bought);
      victim(sim);
      takeDown(sim);
      sim.step(CROUCH);
      sim.enqueue({ type: "carry-body" });
      sim.step(CROUCH);
      expect(sim.session.carrying).not.toBeNull();
      run(sim, 3, input({ moveZ: 1, crouch: true }));
      const v = sim.player()!.velocity!;
      return Math.hypot(v.x, v.z);
    };
    expect(speed(true)).toBeCloseTo(speed(false) * (0.85 / 0.6), 6);
  });

  it("Prowler: the crouched walk goes at 0.7 of the walk instead of half", () => {
    const speed = (bought: boolean) => {
      const sim = withPerks(emptySquare(true), { shadow_prowler: 1 }, bought);
      run(sim, 3, input({ moveZ: 1, crouch: true }));
      const v = sim.player()!.velocity!;
      return Math.hypot(v.x, v.z);
    };
    expect(speed(true)).toBeCloseTo(speed(false) * 1.4, 6);
  });

  it("Ghost Reload: a takedown nobody saw, of someone not fighting her, fills the magazine in hand", () => {
    const after = (bought: boolean) => {
      const sim = withPerks(quietStreet(), { shadow_ghost_reload: 1 }, bought);
      const uid = sim.player()!.combatant!.uid!;
      patchDomain(sim, (d) => ({ ...d, inventory: updateItem(d.inventory, uid, (i) => ({ ...i, loaded: 3 })) }));
      victim(sim);
      takeDown(sim);
      sim.step(CROUCH);
      return findItem(sim.domain.inventory, uid)?.loaded;
    };
    expect(after(false)).toBe(3);
    expect(after(true)).toBe(12);
  });

  it("Ghost Reload: not after a takedown of a parried fighter", () => {
    const sim = withPerks(quietStreet(), { shadow_ghost_reload: 1 });
    const uid = sim.player()!.combatant!.uid!;
    patchDomain(sim, (d) => ({ ...d, inventory: updateItem(d.inventory, uid, (i) => ({ ...i, loaded: 3 })) }));
    const g = victim(sim);
    g.combatant!.engaged = true;
    g.ai!.alerted = true;
    g.melee = { ...g.melee!, stagger: 1, stunned: true };
    takeDown(sim);
    sim.step(CROUCH);
    expect(findItem(sim.domain.inventory, uid)?.loaded).toBe(3);
  });
});

