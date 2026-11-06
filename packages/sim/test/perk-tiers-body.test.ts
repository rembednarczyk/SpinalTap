import { describe, expect, it } from "vitest";
import { ABILITY_CATALOG, BUFF_CATALOG, type CyberwareLoadout, type DomainEvents, type DomainState, type ItemInstance, type PerkId, WEAPON_CATALOG, type WeaponId, addStack, defenseOf, findItem, wornGarments } from "@seki/core";
import { KNOCKBACK_SPEED, SIM_DT, Simulation, gangerEntity, playerStatsOf, type Entity } from "../src";
import { collect, input, run, streetSim } from "./helpers";
import { withPerks } from "./perk-scenes";

/*
 * The Might, Reflex and Tech perks of stage 3b (ADR-0059) in the running game: each one reaches
 * the system it changes. Every scene runs once with the perk and once without, at the same level,
 * with the same attributes and the same path through the lower tiers.
 */

const ticks = (seconds: number) => Math.ceil(seconds / SIM_DT - 1e-9);
type Perks = Partial<Record<PerkId, number>>;

/** The street with nobody armed about, the player at level 30 with `perks` (or only their attributes and path) and `cyberware`. */
const street = (perks: Perks, bought = true, cyberware?: CyberwareLoadout, patch: (d: DomainState) => DomainState = (d) => d): Simulation => {
  const base = streetSim({ seed: 21 });
  const snap = base.snapshot(null, "t", "");
  const domain = patch(cyberware ? { ...snap.domain, character: { ...snap.domain.character, cyberware } } : snap.domain);
  const sim = Simulation.fromSnapshot({ ...snap, domain });
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  return withPerks(sim, perks, bought);
};

const ARMS: CyberwareLoadout = { optics: "hitomi_optics_mk1", arms: "tsubame_reflex" };

/** The player holds `def` in the melee slot, drawn. */
const melee =
  (def: WeaponId) =>
  (d: DomainState): DomainState => {
    const item: ItemInstance = { uid: "i9", def, rarity: "common" };
    return { ...d, inventory: { ...d.inventory, items: [...d.inventory.items, item], nextUid: d.inventory.nextUid + 1 }, equipment: { ...d.equipment, melee: "i9", active: "melee" } };
  };

/** An alerted Hebi of `type` `distance` m north of the player, facing her. */
const enemy = (sim: Simulation, type: "hebi_ganger" | "hebi_brawler", distance: number): Entity => {
  const p = sim.player()!;
  const e = gangerEntity(4000, { key: "foe", position: { x: p.position.x, y: p.position.y, z: p.position.z + distance }, yaw: Math.PI }, null, 10_000, p.chunk ?? "", undefined, type);
  e.ai!.alerted = true;
  return sim.world.add(e);
};

describe("stat perks of stage 3b", () => {
  it("Thick Skull adds head armor the hits read; Sharpshooter and Assassin crit chance; Light Step walk speed", () => {
    const perks: Perks = { might_thick_skull: 2, reflex_sharpshooter: 2, shadow_assassin: 1, reflex_light_step: 2 };
    const [plain, built] = [street(perks, false), street(perks)];
    const [a, b] = [plain, built].map((s) => playerStatsOf(s.domain));
    expect(b!.headArmor - a!.headArmor).toBe(4);
    expect(b!.critChance - a!.critChance).toBeCloseTo(0.1, 9);
    expect(b!.moveSpeed - a!.moveSpeed).toBeCloseTo(0.4, 9);
    // The head zone of the profile the hits on her read (combat's defenderOf).
    const head = (s: Simulation) => defenseOf(playerStatsOf(s.domain), wornGarments(s.domain.inventory, s.domain.equipment)).zoneArmor!.head!;
    expect(head(built) - head(plain)).toBe(4);
  });

  it("Light Step: her walk is 0.4 m/s quicker at two ranks", () => {
    const speed = (bought: boolean) => {
      const sim = street({ reflex_light_step: 2 }, bought);
      run(sim, 30, input({ moveZ: 1 }));
      const v = sim.player()!.velocity!;
      return Math.hypot(v.x, v.z);
    };
    expect(speed(true) - speed(false)).toBeCloseTo(0.4, 6);
  });
});

describe("Might", () => {
  it("Iron Guard: a deflected bullet costs half the stamina at two ranks", () => {
    const perDeflect = (bought: boolean) => {
      const sim = street({ might_iron_guard: 2 }, bought, ARMS, melee("shirasaya"));
      const p = sim.player()!;
      p.yaw = 0;
      p.pitch = 0;
      enemy(sim, "hebi_ganger", 7);
      const back = collect(sim, "ProjectileReflected");
      run(sim, ticks(2.4), input({ aim: true }));
      expect(back.length).toBeGreaterThan(0);
      return (1 - p.perks!.stamina) / back.length;
    };
    expect(perDeflect(true)).toBeCloseTo(perDeflect(false) * 0.5, 6);
  });

  it("Battering Ram: her unguarded hit shoves the brawler twice as hard", () => {
    const shove = (bought: boolean) => {
      const sim = street({ might_battering_ram: 1 }, bought, undefined, melee("baton"));
      run(sim, ticks(0.4));
      const b = enemy(sim, "hebi_brawler", 1.6);
      sim.step(input({ fire: true }));
      run(sim, ticks(WEAPON_CATALOG.baton.melee.combo[0]!.windup) + 1);
      const k = b.melee!.knock!;
      return Math.hypot(k.x, k.z);
    };
    expect(shove(false)).toBeCloseTo(KNOCKBACK_SPEED, 6);
    expect(shove(true)).toBeCloseTo(KNOCKBACK_SPEED * 2, 6);
  });
});

describe("Reflex", () => {
  it("Snap Aim: aiming down sights comes 30% sooner at two ranks", () => {
    const aimed = (bought: boolean) => {
      const sim = street({ reflex_snap_aim: 2 }, bought);
      run(sim, ticks(0.4));
      run(sim, 3, input({ aim: true }));
      return sim.player()!.posture!.aim;
    };
    expect(aimed(true)).toBeCloseTo(aimed(false) / 0.7, 6);
  });
});

describe("Tech", () => {
  it("Stim Tolerance: the coffee's buff lasts half again as long at two ranks", () => {
    const lasts = (bought: boolean) => {
      const sim = street({ tech_stim_tolerance: 2 }, bought, undefined, (d) => ({ ...d, inventory: addStack(d.inventory, d.equipment, "synth_coffee", 1).inventory }));
      const applied = collect<DomainEvents["BuffApplied"]>(sim, "BuffApplied");
      sim.enqueue({ type: "use-item", ref: { stack: "synth_coffee" } });
      sim.step();
      return applied[0]!.duration;
    };
    expect(lasts(false)).toBe(BUFF_CATALOG.quick_cooldown.duration);
    expect(lasts(true)).toBeCloseTo(BUFF_CATALOG.quick_cooldown.duration * 1.5, 9);
  });

  it("Capacitor: the overdrive runs 40% longer at two ranks", () => {
    const runs = (bought: boolean) => {
      const sim = street({ tech_capacitor: 2 }, bought, { optics: "hitomi_optics_mk1", nervous: "kairos_overclock" });
      const on = collect<DomainEvents["AbilityActivated"]>(sim, "AbilityActivated");
      sim.step(input({ ability: true }));
      return { event: on[0]!.duration, left: sim.domain.ability.activeTime };
    };
    const base = ABILITY_CATALOG.reflex_overdrive.duration;
    expect(runs(false).event).toBe(base);
    const longer = runs(true);
    expect(longer.event).toBeCloseTo(base * 1.4, 9);
    expect(longer.left).toBeCloseTo(base * 1.4, 9);
  });

  it("Reinforced Seams: a hit wears her jacket by half as much", () => {
    const wearPerHit = (bought: boolean) => {
      const sim = street({ tech_reinforced_seams: 1 }, bought);
      const p = sim.player()!;
      p.yaw = 0;
      enemy(sim, "hebi_ganger", 7);
      const hits = collect<DomainEvents["DamageDealt"]>(sim, "DamageDealt");
      for (let i = 0; i < ticks(3); i++) {
        p.health = { current: p.health!.max, max: p.health!.max };
        sim.step();
      }
      const torso = hits.filter((h) => h.targetId === p.id && (h.zone === "torso" || h.zone === "arm")).length;
      expect(torso).toBeGreaterThan(0);
      const jacket = findItem(sim.domain.inventory, sim.domain.equipment.torso!)!;
      return (100 - jacket.condition!) / torso;
    };
    expect(wearPerHit(false)).toBe(2);
    expect(wearPerHit(true)).toBe(1);
  });
});
