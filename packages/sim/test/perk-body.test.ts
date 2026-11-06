import { describe, expect, it } from "vitest";
import { type CyberwareLoadout, type DomainState, type ItemInstance, type PerkId, SECOND_HEART_COOLDOWN, WEAPON_CATALOG, addStack } from "@seki/core";
import { DASH_COOLDOWN, SIM_DT, Simulation, cyberCapacityOf, freshPerks, gangerEntity, playerStatsOf, type Entity } from "../src";
import { collect, input, run, streetSim } from "./helpers";
import { patchDomain, withPerks } from "./perk-scenes";

/*
 * The Might, Reflex and Tech perks in the running game (ADR-0059, stage 3): each one reaches the
 * system it changes. Every scene runs once with the perk and once without, at the same level.
 */

const ticks = (seconds: number) => Math.ceil(seconds / SIM_DT - 1e-9);
type Perks = Partial<Record<PerkId, number>>;

/** The street with nobody armed about, the player at level 30 with `perks` (or only their attributes) and `cyberware`. */
const street = (perks: Perks, bought = true, cyberware?: CyberwareLoadout, seed = 21): Simulation => {
  const base = streetSim({ seed });
  const snap = base.snapshot(null, "t", "");
  const sim = Simulation.fromSnapshot({ ...snap, domain: cyberware ? { ...snap.domain, character: { ...snap.domain.character, cyberware } } : snap.domain });
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  return withPerks(sim, perks, bought);
};

const LEGS: CyberwareLoadout = { optics: "hitomi_optics_mk1", skeleton: "kitsune_tendons" };

const withBaton = (d: DomainState): DomainState => {
  const baton: ItemInstance = { uid: "i9", def: "baton", rarity: "common" };
  return { ...d, inventory: { ...d.inventory, items: [...d.inventory.items, baton], nextUid: d.inventory.nextUid + 1 }, equipment: { ...d.equipment, melee: "i9", active: "melee" } };
};

/** An alerted Hebi with an SMG `distance` m north of the player, facing her. */
const shooter = (sim: Simulation, distance = 7): Entity => {
  const p = sim.player()!;
  const e = gangerEntity(4000, { key: "shooter", position: { x: p.position.x, y: p.position.y, z: p.position.z + distance }, yaw: Math.PI }, null, 5000, p.chunk ?? "", undefined, "hebi_ganger");
  e.ai!.alerted = true;
  return sim.world.add(e);
};

describe("stat perks through StatModifiers", () => {
  it("Tough, Hardened, Steady, Deadeye, Brawler and Tailor add to the player's stats; the health at once", () => {
    const fighter: Perks = { might_tough: 3, might_hardened: 2, reflex_steady: 3, reflex_deadeye: 2 };
    const brawler: Perks = { might_brawler: 2, tech_tailor: 2 };
    const plain = street(fighter, false);
    const built = street(fighter);
    const [a, b] = [plain, built].map((s) => playerStatsOf(s.domain));
    const [c, d] = [street(brawler, false), street(brawler)].map((s) => playerStatsOf(s.domain));
    expect(b!.maxHp - a!.maxHp).toBe(24);
    expect(b!.armor - a!.armor).toBe(4);
    expect(b!.aimStability - a!.aimStability).toBeCloseTo(0.12);
    expect(b!.critMultiplier - a!.critMultiplier).toBeCloseTo(0.4);
    expect(d!.meleeDamage - c!.meleeDamage).toBeCloseTo(0.2);
    expect(d!.garmentArmor - c!.garmentArmor).toBe(2);
    plain.step();
    built.step();
    expect(built.player()!.health!.max - plain.player()!.health!.max).toBe(24);
  });
});

describe("Might", () => {
  it("Second Wind: the guard's stamina comes back half again as fast", () => {
    const rest = (bought: boolean) => {
      const sim = street({ might_second_wind: 1 }, bought);
      sim.step();
      sim.player()!.perks = { ...freshPerks(), stamina: 0.2 };
      run(sim, ticks(1));
      return sim.player()!.perks!.stamina - 0.2;
    };
    expect(rest(true)).toBeCloseTo(rest(false) * 1.5, 6);
  });

  it("Crushing Parry: a parried brawler stays stunned twice as long, the takedown window with it", () => {
    const stun = (bought: boolean) => {
      const sim = street({ might_crushing_parry: 1 }, bought, undefined, 5);
      patchDomain(sim, withBaton);
      run(sim, ticks(0.4));
      const p = sim.player()!;
      const b = sim.world.add(gangerEntity(4000, { key: "brawler", position: { x: p.position.x, y: p.position.y, z: p.position.z + 1.5 }, yaw: Math.PI }, null, 10_000, p.chunk ?? "", undefined, "hebi_brawler"));
      b.ai!.alerted = true;
      const swing = collect(sim, "MeleeSwing");
      for (let i = 0; i < ticks(3) && swing.length === 0; i++) sim.step();
      run(sim, ticks(WEAPON_CATALOG.baton.melee.npcWindup) - 4);
      run(sim, 8, input({ aim: true }));
      return b.melee!.stagger;
    };
    const plain = stun(false);
    expect(plain).toBeGreaterThan(0.5);
    expect(stun(true)).toBeGreaterThan(plain + WEAPON_CATALOG.baton.melee.block.parryStun - 0.05);
  });
});

describe("Reflex", () => {
  it("Quick Reload: the player's reload takes 30% less at two ranks", () => {
    const reload = (bought: boolean) => {
      const sim = withPerks(Simulation.create({ seed: 5 }), { reflex_quick_reload: 2 }, bought);
      const started = collect<{ duration: number }>(sim, "ReloadStarted");
      run(sim, ticks(1.3), input({ fire: true }));
      sim.step(input({ reload: true }));
      return started[0]!.duration;
    };
    expect(reload(false)).toBe(1.4);
    expect(reload(true)).toBeCloseTo(0.98, 9);
  });

  it("Slipstream: the dash comes back 40% sooner", () => {
    const dashesAfter = (bought: boolean, wait: number) => {
      const sim = street({ reflex_slipstream: 1 }, bought, LEGS);
      const dashes = collect(sim, "Dashed");
      run(sim, 5);
      sim.step(input({ dash: true }));
      run(sim, ticks(wait));
      sim.step(input({ dash: true }));
      return dashes.length;
    };
    const wait = DASH_COOLDOWN * 0.6;
    expect(dashesAfter(false, wait)).toBe(1);
    expect(dashesAfter(true, wait)).toBe(2);
  });

  it("Bullet Dance: a bullet that meets her dash flies back instead of passing by", () => {
    const back = (bought: boolean) => {
      const sim = street({ reflex_bullet_dance: 1 }, bought, LEGS);
      const p = sim.player()!;
      p.yaw = 0;
      const reflected = collect(sim, "ProjectileReflected");
      const hurt = collect<{ targetId: number }>(sim, "DamageDealt");
      shooter(sim);
      for (let i = 0; i < ticks(3); i++) {
        p.perks = { ...(p.perks ?? freshPerks()), iframes: 0.3, stamina: 1 };
        sim.step();
      }
      return { reflected: reflected.length, hurt: hurt.filter((h) => h.targetId === p.id).length };
    };
    expect(back(false)).toEqual({ reflected: 0, hurt: 0 });
    const dance = back(true);
    expect(dance.reflected).toBeGreaterThan(0);
    expect(dance.hurt).toBe(0);
  });
});

describe("Tech", () => {
  it("Field Medic: a medkit heals a quarter more per rank", () => {
    const healed = (bought: boolean) => {
      const sim = street({ tech_field_medic: 2 }, bought);
      patchDomain(sim, (d) => ({ ...d, inventory: addStack(d.inventory, d.equipment, "medkit", 1).inventory }));
      sim.step();
      sim.player()!.health = { current: 10, max: sim.player()!.health!.max };
      const used = collect<{ healed: number }>(sim, "ItemUsed");
      sim.enqueue({ type: "use-item", ref: { stack: "medkit" } });
      sim.step();
      return used[0]!.healed;
    };
    expect(healed(false)).toBe(40);
    expect(healed(true)).toBe(60);
  });

  it("Coolant: the active implant's cooldown runs 40% faster", () => {
    const left = (bought: boolean) => {
      const sim = street({ tech_coolant: 1 }, bought);
      patchDomain(sim, (d) => ({ ...d, ability: { activeTime: 0, cooldown: 10 } }));
      run(sim, ticks(1));
      return 10 - sim.domain.ability.cooldown;
    };
    expect(left(true)).toBeCloseTo(left(false) * 1.4, 6);
  });

  it("Second Heart: a lethal blow leaves a quarter of her health, once per cooldown", () => {
    const sim = street({ tech_second_heart: 1 });
    sim.step();
    const p = sim.player()!;
    const died = collect(sim, "PlayerDied");
    p.health = { current: 0, max: p.health!.max };
    sim.step();
    expect(sim.session.gameOver).toBe(false);
    expect(p.health.current).toBe(Math.round(p.health.max * 0.25));
    expect(p.perks!.secondHeart).toBeGreaterThan(SECOND_HEART_COOLDOWN - 1);
    p.health = { current: 0, max: p.health.max };
    sim.step();
    expect(died).toHaveLength(1);
    const plain = street({ tech_second_heart: 1 }, false);
    plain.step();
    plain.player()!.health = { current: 0, max: 100 };
    plain.step();
    expect(plain.session.gameOver).toBe(true);
  });

  it("Overclock: the pool the clinic and the HUD read grows by 2 per rank", () => {
    const pool = (bought: boolean) => cyberCapacityOf(street({ tech_overclock: 2 }, bought).domain).max;
    expect(pool(true) - pool(false)).toBe(4);
  });
});
