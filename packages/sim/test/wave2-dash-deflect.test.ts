import { describe, expect, it } from "vitest";
import type { CyberwareLoadout, DomainState, ItemInstance } from "@seki/core";
import { DASH_COOLDOWN, DASH_IFRAMES, DASH_SPEED, DASH_TIME, DEFLECT_THRESHOLD, JUMP_SPEED, SIM_DT, Simulation, freshPerks, gangerEntity, type Entity } from "../src";
import { collect, input, run } from "./helpers";

const ticks = (seconds: number) => Math.ceil(seconds / SIM_DT - 1e-9);

/** A new game with these implants (and `patch`), loaded through a snapshot; the street's AI removed. */
const simWith = (cyberware: CyberwareLoadout, patch: (d: DomainState) => DomainState = (d) => d): Simulation => {
  const base = Simulation.create({ seed: 21 });
  const snap = base.snapshot(null, "t", "");
  const domain = patch({ ...snap.domain, character: { ...snap.domain.character, cyberware } });
  const sim = Simulation.fromSnapshot({ ...snap, domain });
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  return sim;
};

const LEGS: CyberwareLoadout = { optics: "hitomi_optics_mk1", skeleton: "kitsune_tendons" };
const ARMS: CyberwareLoadout = { optics: "hitomi_optics_mk1", arms: "tsubame_reflex" };

/** The player holds a blade in the melee slot, drawn. */
const withBlade = (d: DomainState): DomainState => {
  const blade: ItemInstance = { uid: "i9", def: "shirasaya", rarity: "common" };
  return { ...d, inventory: { ...d.inventory, items: [...d.inventory.items, blade], nextUid: d.inventory.nextUid + 1 }, equipment: { ...d.equipment, melee: "i9", active: "melee" } };
};

/** An alerted Hebi with an SMG `distance` m north of the player, facing her. */
const shooter = (sim: Simulation, distance = 7): Entity => {
  const p = sim.player()!;
  const e = gangerEntity(4000, { key: "shooter", position: { x: p.position.x, y: 0, z: p.position.z + distance }, yaw: Math.PI }, null, 5000, p.chunk ?? "", undefined, "hebi_ganger");
  e.ai!.alerted = true;
  return sim.world.add(e);
};

type Hit = { sourceId: number; targetId: number; amount: number };

describe("dash (ADR-0033)", () => {
  it("needs the Kitsune tendons", () => {
    const sim = simWith({ optics: "hitomi_optics_mk1" });
    const dashes = collect(sim, "Dashed");
    sim.step(input({ dash: true }));
    expect(dashes).toEqual([]);
  });

  it("bursts DASH_SPEED along the stick for DASH_TIME, then waits for the cooldown", () => {
    const sim = simWith(LEGS);
    const p = sim.player()!;
    p.yaw = 0;
    const dashes = collect<{ air: boolean }>(sim, "Dashed");
    run(sim, 5);
    const start = { ...p.position };
    sim.step(input({ dash: true, moveX: 1 }));
    expect(dashes).toEqual([{ entityId: p.id, air: false, at: expect.any(Object) }]);
    expect(Math.hypot(p.velocity!.x, p.velocity!.z)).toBeCloseTo(DASH_SPEED);
    run(sim, ticks(DASH_TIME));
    // A strafe to the right of a player facing +Z: +X.
    expect(p.position.x - start.x).toBeGreaterThan(DASH_SPEED * DASH_TIME * 0.85);
    expect(Math.abs(p.position.z - start.z)).toBeLessThan(0.05);
    sim.step(input({ dash: true }));
    expect(dashes).toHaveLength(1);
    run(sim, ticks(DASH_COOLDOWN));
    sim.step(input({ dash: true }));
    expect(dashes).toHaveLength(2);
  });

  it("once in the air, again only after landing", () => {
    const sim = simWith(LEGS);
    const p = sim.player()!;
    const dashes = collect<{ air: boolean }>(sim, "Dashed");
    run(sim, 5);
    sim.step(input({ jump: true }));
    run(sim, 6);
    expect(p.fall).toBeDefined();
    sim.step(input({ dash: true }));
    expect(dashes.map((d) => d.air)).toEqual([true]);
    expect(p.fall).toBeGreaterThanOrEqual(0);
    expect(p.fall).toBeLessThan(JUMP_SPEED);
    // The cooldown is over before the landing, the air dash is not.
    run(sim, ticks(DASH_COOLDOWN) - 1);
    expect(p.fall).toBeUndefined();
    sim.step(input({ jump: true }));
    run(sim, 4);
    p.perks!.dashCooldown = 0;
    p.perks!.airDash = true;
    sim.step(input({ dash: true }));
    expect(dashes).toHaveLength(1);
    run(sim, ticks(1.2));
    sim.step(input({ dash: true }));
    expect(dashes.map((d) => d.air)).toEqual([true, false]);
  });

  it("bullets pass the player by while the dash's invulnerability lasts", () => {
    const hurt = (iframes: number): number => {
      const sim = simWith(LEGS);
      const p = sim.player()!;
      const hits = collect<Hit>(sim, "DamageDealt");
      shooter(sim);
      for (let i = 0; i < ticks(4); i++) {
        p.perks = { ...(p.perks ?? freshPerks()), iframes };
        sim.step();
      }
      return hits.filter((h) => h.targetId === p.id).length;
    };
    expect(hurt(DASH_IFRAMES)).toBe(0);
    expect(hurt(0)).toBeGreaterThan(0);
  });

  it("runs the cooldown faster with the synthetic coffee", () => {
    const sim = simWith(LEGS, (d) => ({ ...d, buffs: [{ id: "quick_cooldown", left: 60 }] }));
    const dashes = collect(sim, "Dashed");
    run(sim, 5);
    sim.step(input({ dash: true }));
    run(sim, ticks(DASH_COOLDOWN / 1.5));
    sim.step(input({ dash: true }));
    expect(dashes).toHaveLength(2);
  });
});

describe("deflecting bullets (ADR-0033)", () => {
  const duel = (cyberware: CyberwareLoadout, seconds = 3) => {
    const sim = simWith(cyberware, withBlade);
    const p = sim.player()!;
    p.yaw = 0;
    p.pitch = 0;
    const s = shooter(sim);
    const hits = collect<Hit>(sim, "DamageDealt");
    const back = collect<{ defenderId: number; attackerId: number; hitEntity: number | null }>(sim, "ProjectileReflected");
    const blocked = collect(sim, "AttackBlocked");
    run(sim, ticks(0.4), input({ aim: true }));
    run(sim, ticks(seconds), input({ aim: true }));
    return { sim, p, s, hits, back, blocked };
  };

  it("a guard with the Tsubame reflex sends the bullets back where she looks, into the shooter", () => {
    const { p, s, hits, back } = duel(ARMS, 2);
    expect(back.length).toBeGreaterThan(0);
    expect(back[0]).toMatchObject({ defenderId: p.id, attackerId: s.id });
    expect(back.some((b) => b.hitEntity === s.id)).toBe(true);
    expect(hits.some((h) => h.sourceId === p.id && h.targetId === s.id)).toBe(true);
  });

  it("spends stamina: under a third the blade only blocks, and the stamina comes back", () => {
    const { p, back, blocked, sim } = duel(ARMS, 12);
    expect(p.perks!.stamina).toBeLessThanOrEqual(DEFLECT_THRESHOLD + 0.05);
    expect(blocked.length).toBeGreaterThan(0);
    const reflected = back.length;
    expect(reflected).toBeGreaterThan(3);
    for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
    run(sim, ticks(3));
    expect(p.perks!.stamina).toBe(1);
  });

  it("without the implant the bullets are only partly blocked", () => {
    const { back, blocked, hits, p } = duel({ optics: "hitomi_optics_mk1" }, 2);
    expect(back).toEqual([]);
    expect(blocked.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.targetId === p.id)).toBe(true);
  });

  it("is the same run after run (no new randomness)", () => {
    const a = duel(ARMS, 3);
    const b = duel(ARMS, 3);
    expect(a.hits).toEqual(b.hits);
    expect(a.back.length).toBe(b.back.length);
  });
});
