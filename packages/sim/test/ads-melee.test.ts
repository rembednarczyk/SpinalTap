import { describe, expect, it } from "vitest";
import { BASE_STATS, type DomainState, type ItemInstance, PARRY_COOLDOWN, WEAPON_CATALOG } from "@seki/core";
import { KNOCKBACK_SPEED, KNOCKBACK_TIME, MELEE_CHASE_SPEED, RenderSync, SIM_DT, SPRINT_MULTIPLIER, Simulation, aimSpreadOf, gangerEntity, idleMelee, playerStatsOf, type Entity } from "../src";
import { STREET_START, byKey, collect, input, run, teleportPlayer, streetSim } from "./helpers";

const ticks = (seconds: number) => Math.ceil(seconds / SIM_DT - 1e-9);
const UNITY = WEAPON_CATALOG.unity9;
const BATON = WEAPON_CATALOG.baton.melee;

/** A new game with `patch` applied to the domain, loaded through a snapshot; other gangers removed. */
const simWith = (patch: (d: DomainState) => DomainState = (d) => d, seed = 5): Simulation => {
  const base = streetSim({ seed });
  const sim = Simulation.fromSnapshot({ ...base.snapshot(null, "t", ""), domain: patch(base.snapshot(null, "t", "").domain) });
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  return sim;
};

/** The player holds the baton in the melee slot, drawn. */
const withBaton = (d: DomainState): DomainState => {
  const baton: ItemInstance = { uid: "i9", def: "baton", rarity: "common" };
  return { ...d, inventory: { ...d.inventory, items: [...d.inventory.items, baton], nextUid: d.inventory.nextUid + 1 }, equipment: { ...d.equipment, melee: "i9", active: "melee" } };
};

/** A target with plenty of health `z` metres north of the origin (x to the side), facing south. */
const target = (id: number, x: number, z: number, patch: Partial<Entity> = {}): Entity => ({
  id,
  position: { x, y: STREET_START.y, z },
  prevPosition: { x, y: STREET_START.y, z },
  yaw: Math.PI,
  prevYaw: Math.PI,
  pitch: 0,
  body: { radius: 0.38, height: 1.8 },
  health: { current: 10_000, max: 10_000 },
  ...patch,
});

/** A Hebi brawler (baton) `distance` m north of the player, alerted. */
const brawler = (sim: Simulation, distance: number): Entity => {
  const p = sim.player()!;
  const e = gangerEntity(4000, { key: "brawler", position: { x: p.position.x, y: p.position.y, z: p.position.z + distance }, yaw: Math.PI }, null, 10_000, p.chunk ?? "", undefined, "hebi_brawler");
  e.ai!.alerted = true;
  return sim.world.add(e);
};

type Hit = { sourceId: number; targetId: number; amount: number; zone: string; critical: boolean };

describe("aim down sights (ADR-0019)", () => {
  it("eases in over the weapon's ADS time and narrows the cone by its multiplier", () => {
    const sim = simWith();
    const p = sim.player()!;
    const hip = sim.aimSpread();
    sim.step(input({ aim: true }));
    expect(p.posture!.aim).toBeGreaterThan(0);
    expect(p.posture!.aim).toBeLessThan(1);
    run(sim, ticks(UNITY.ads.time), input({ aim: true }));
    expect(p.posture!.aim).toBe(1);
    expect(sim.aimSpread()).toBeCloseTo(hip * UNITY.ads.spread);
    run(sim, ticks(UNITY.ads.time) + 1);
    expect(p.posture!.aim).toBe(0);
    expect(sim.aimSpread()).toBeCloseTo(hip);
  });

  it("slows the walk by the weapon's ADS move multiplier and rules out sprinting", () => {
    const speed = (frame: Parameters<typeof input>[0]) => {
      const sim = simWith();
      run(sim, ticks(UNITY.ads.time) + 2, input(frame));
      const v = sim.player()!.velocity!;
      return { speed: Math.hypot(v.x, v.z), sprinting: sim.player()!.posture!.sprinting };
    };
    expect(speed({ moveZ: 1, sprint: true }).speed).toBeCloseTo(BASE_STATS.moveSpeed * SPRINT_MULTIPLIER);
    expect(speed({ moveZ: 1, aim: true }).speed).toBeCloseTo(BASE_STATS.moveSpeed * UNITY.ads.move);
    expect(speed({ moveZ: 1, aim: true, sprint: true })).toEqual({ speed: expect.closeTo(BASE_STATS.moveSpeed * UNITY.ads.move, 5), sprinting: false });
  });

  it("drops while reloading or holstered", () => {
    const sim = simWith();
    const p = sim.player()!;
    run(sim, ticks(UNITY.ads.time) + 1, input({ aim: true }));
    expect(p.posture!.aiming).toBe(true);
    sim.step(input({ aim: true, fire: true }));
    sim.step(input({ aim: true, reload: true }));
    sim.step(input({ aim: true }));
    expect(p.combatant!.reloading).toBeGreaterThan(0);
    expect(p.posture!.aiming).toBe(false);
    run(sim, ticks(2), input({ aim: false }));
    sim.step(input({ toggleWeapon: true }));
    run(sim, 5, input({ aim: true }));
    expect(p.posture!.aim).toBe(0);
  });

  it("reaches the renderer as an interpolated aim with the weapon's zoom", () => {
    const sim = simWith();
    const seen: { aim?: number; aimZoom?: number }[] = [];
    const sync = new RenderSync({
      spawn: () => {},
      updateTransform: (id, t) => id === sim.player()!.id && seen.push(t),
      despawn: () => {},
      clear: () => {},
      setCameraMode: () => {},
      attachCamera: () => {},
      playEffect: () => {},
      setAppearance: () => {},
    });
    sync.sync(sim.world, 0);
    run(sim, ticks(UNITY.ads.time) + 1, input({ aim: true }));
    sync.sync(sim.world, 1);
    expect(seen.at(-1)).toMatchObject({ aim: 1, aimZoom: UNITY.ads.zoom });
  });

  it("aims a ganger's weapon up while it fights", () => {
    const sim = streetSim({ seed: 11 });
    const guard = byKey(sim, "guard")!;
    teleportPlayer(sim, { x: guard.position.x, y: guard.position.y, z: guard.position.z - 6 });
    guard.ai!.alerted = true;
    sim.step();
    expect(guard.combatant!.engaged).toBe(true);
  });
});

describe("melee combo and arc (ADR-0019)", () => {
  it("holding the button chains the three swings of the combo, then starts over", () => {
    const sim = simWith(withBaton);
    const swings = collect<{ strike: number; windup: number }>(sim, "MeleeSwing");
    run(sim, ticks(0.4));
    run(sim, ticks(2.2), input({ fire: true }));
    expect(swings.map((s) => s.strike).slice(0, 4)).toEqual([0, 1, 2, 0]);
    expect(swings[0]!.windup).toBe(BATON.combo[0].windup);
  });

  it("a pause longer than the combo window starts the combo over", () => {
    const sim = simWith(withBaton);
    const swings = collect<{ strike: number }>(sim, "MeleeSwing");
    run(sim, ticks(0.4));
    sim.step(input({ fire: true }));
    run(sim, ticks(BATON.combo[0].windup + BATON.combo[0].recovery) + 1);
    // Inside the window: the second swing.
    sim.step(input({ fire: true }));
    run(sim, ticks(BATON.combo[1].windup + BATON.combo[1].recovery + BATON.comboWindow) + 2);
    sim.step(input({ fire: true }));
    expect(swings.map((s) => s.strike)).toEqual([0, 1, 0]);
  });

  it("hits bodies in reach and in the arc in front, not behind or out of reach", () => {
    const sim = simWith(withBaton);
    const p = sim.player()!;
    const { x, z } = p.position;
    const front = sim.world.add(target(5001, x + 0.3, z + 1.8));
    const side = sim.world.add(target(5002, x + 1.6, z + 0.3));
    const behind = sim.world.add(target(5003, x, z - 1.5));
    const far = sim.world.add(target(5004, x, z + 3.5));
    const hits = collect<Hit>(sim, "DamageDealt");
    run(sim, ticks(0.4));
    sim.step(input({ fire: true }));
    run(sim, ticks(BATON.combo[0].windup) + 1);
    const hitIds = hits.map((h) => h.targetId);
    expect(hitIds).toContain(front.id);
    expect(hitIds).not.toContain(behind.id);
    expect(hitIds).not.toContain(far.id);
    expect(hitIds).not.toContain(side.id);
    // A level swing lands on the chest; looking down takes the legs.
    expect(hits.find((h) => h.targetId === front.id)?.zone).toBe("torso");
  });

  it("the look pitch picks the zone: a low swing takes the legs, a high one the head", () => {
    const zoneAt = (pitch: number) => {
      const sim = simWith(withBaton);
      const p = sim.player()!;
      sim.world.add(target(5001, p.position.x, p.position.z + 1.5));
      const hits = collect<Hit>(sim, "DamageDealt");
      run(sim, ticks(0.4));
      p.pitch = pitch;
      sim.step(input({ fire: true }));
      run(sim, ticks(BATON.combo[0].windup) + 1);
      return hits[0]?.zone;
    };
    expect(zoneAt(0.6)).toBe("leg");
    expect(zoneAt(0)).toBe("torso");
    expect(zoneAt(-0.25)).toBe("head");
  });

  it("deals the weapon's damage times the strike's, and the finisher hits harder", () => {
    const sim = simWith(withBaton);
    const p = sim.player()!;
    sim.world.add(target(5001, p.position.x, p.position.z + 1.5));
    const hits = collect<Hit>(sim, "DamageDealt");
    run(sim, ticks(0.4));
    run(sim, ticks(2), input({ fire: true }));
    const bonus = playerStatsOf(sim.domain).damageBonus;
    expect(hits.slice(0, 3).map((h) => (h.critical ? "crit" : h.amount))).toEqual([
      Math.round(WEAPON_CATALOG.baton.damage + bonus),
      Math.round(WEAPON_CATALOG.baton.damage * BATON.combo[1].damage + bonus),
      Math.round(WEAPON_CATALOG.baton.damage * BATON.combo[2].damage + bonus),
    ]);
  });

  it("staggers the target unguarded and cuts its own swing short", () => {
    const sim = simWith(withBaton);
    const p = sim.player()!;
    const t = sim.world.add(target(5001, p.position.x, p.position.z + 1.5, { melee: { ...idleMelee(), phase: "windup", timer: 5 } }));
    const staggered = collect<{ entityId: number; duration: number }>(sim, "Staggered");
    run(sim, ticks(0.4));
    sim.step(input({ fire: true }));
    run(sim, ticks(BATON.combo[0].windup) + 1);
    expect(staggered).toEqual([{ entityId: t.id, duration: BATON.combo[0].stagger, cause: "hit" }]);
    expect(t.melee!.phase).toBe("idle");
  });
});

describe("knockback (ADR-0019)", () => {
  it("an unguarded hit shoves the brawler back and it stands staggered", () => {
    const sim = simWith(withBaton);
    run(sim, ticks(0.4));
    const b = brawler(sim, 1.6);
    const z0 = b.position.z;
    sim.step(input({ fire: true }));
    run(sim, ticks(BATON.combo[0].windup) + 1);
    expect(b.melee!.stagger).toBeGreaterThan(0);
    run(sim, ticks(KNOCKBACK_TIME) + 1);
    // About speed x time / 2 metres, away from the player (north).
    expect(b.position.z - z0).toBeGreaterThan((KNOCKBACK_SPEED * KNOCKBACK_TIME) / 3);
    const z1 = b.position.z;
    run(sim, 5);
    expect(b.position.z).toBeCloseTo(z1);
  });
});

describe("guard and parry (ADR-0019)", () => {
  /** The player with the baton up, a brawler `distance` m north of her, facing her. */
  const duel = (distance = 1.5) => {
    const sim = simWith(withBaton);
    // The baton is drawn before the brawler shows up.
    run(sim, ticks(0.4));
    const b = brawler(sim, distance);
    return { sim, b, p: sim.player()! };
  };

  it("the brawler telegraphs its swing with the NPC windup and hits the open player", () => {
    const { sim, b, p } = duel();
    const swings = collect<{ entityId: number; windup: number }>(sim, "MeleeSwing");
    const hits = collect<Hit>(sim, "DamageDealt");
    run(sim, ticks(BATON.npcWindup) + 2);
    expect(swings[0]).toMatchObject({ entityId: b.id, windup: BATON.npcWindup });
    expect(hits.some((h) => h.targetId === p.id && h.sourceId === b.id)).toBe(true);
  });

  it("a guard raised early takes a quarter of the blow and slows the walk", () => {
    const { sim, b, p } = duel();
    const blocked = collect<{ parried: boolean; kind: string }>(sim, "AttackBlocked");
    const hits = collect<Hit>(sim, "DamageDealt");
    run(sim, ticks(BATON.npcWindup) + 2, input({ aim: true, moveX: 0.0001 }));
    expect(p.melee!.guard).toBe(true);
    expect(blocked).toEqual([expect.objectContaining({ parried: false, kind: "melee" })]);
    const hit = hits.find((h) => h.targetId === p.id)!;
    expect(hit.amount).toBeLessThanOrEqual(Math.ceil(WEAPON_CATALOG.baton.damage * BATON.block.melee));
    expect(b.melee!.stagger).toBe(0);
    run(sim, 2, input({ aim: true, moveZ: -1 }));
    expect(Math.hypot(p.velocity!.x, p.velocity!.z)).toBeCloseTo(BASE_STATS.moveSpeed * BATON.block.move);
  });

  it("a guard raised just before the blow parries it: no damage, the attacker is stunned", () => {
    const { sim, b, p } = duel();
    const blocked = collect<{ parried: boolean }>(sim, "AttackBlocked");
    const hits = collect<Hit>(sim, "DamageDealt");
    const swing = collect(sim, "MeleeSwing");
    while (swing.length === 0) sim.step();
    run(sim, ticks(BATON.npcWindup) - 4);
    run(sim, 8, input({ aim: true }));
    expect(blocked).toEqual([expect.objectContaining({ parried: true })]);
    expect(hits.filter((h) => h.targetId === p.id)).toHaveLength(0);
    expect(b.melee!.stagger).toBeGreaterThan(BATON.block.parryStun - 0.2);
    // A stunned brawler neither moves nor swings.
    const before = swing.length;
    run(sim, ticks(BATON.block.parryStun - 0.3));
    expect(swing.length).toBe(before);
    expect(b.velocity).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("raising the guard again within the cooldown opens no parry window", () => {
    const { sim, p } = duel(30);
    sim.step(input({ aim: true }));
    expect(p.melee!.parry).toBeGreaterThan(0);
    sim.step();
    sim.step(input({ aim: true }));
    expect(p.melee!.parry).toBe(0);
    run(sim, ticks(PARRY_COOLDOWN) + 1);
    sim.step(input({ aim: true }));
    expect(p.melee!.parry).toBeGreaterThan(0);
  });

  it("a shot into the guard is only partly blocked", () => {
    const shot = (guarding: boolean) => {
      const sim = Simulation.fromSnapshot({ ...streetSim({ seed: 11 }).snapshot(null, "t", ""), domain: withBaton(streetSim({ seed: 11 }).domain) });
      const guard = byKey(sim, "guard")!;
      for (const g of [...sim.world.with("ai")]) if (g !== guard) sim.world.remove(g);
      teleportPlayer(sim, { x: guard.position.x, y: guard.position.y, z: guard.position.z - 4 }, 0);
      guard.ai!.alerted = true;
      const p = sim.player()!;
      const hits = collect<Hit>(sim, "DamageDealt");
      const blocked = collect<{ kind: string }>(sim, "AttackBlocked");
      run(sim, ticks(0.4), input({ aim: guarding }));
      for (let i = 0; i < 900 && !hits.some((h) => h.targetId === p.id && h.zone === "torso" && !h.critical); i++) {
        p.health = { ...p.health!, current: p.health!.max };
        sim.step(input({ aim: guarding }));
      }
      return { amount: hits.find((h) => h.targetId === p.id && h.zone === "torso" && !h.critical)?.amount, blocked: blocked.length };
    };
    const open = shot(false);
    const guarded = shot(true);
    expect(open.blocked).toBe(0);
    expect(guarded.blocked).toBeGreaterThan(0);
    expect(guarded.amount).toBeLessThan(open.amount!);
  });
});

describe("melee AI (ADR-0019)", () => {
  it("closes the distance at the melee chase speed and stops in reach to swing", () => {
    const sim = simWith();
    const b = brawler(sim, 10);
    sim.step();
    expect(Math.hypot(b.velocity!.x, b.velocity!.z)).toBeCloseTo(MELEE_CHASE_SPEED);
    const swings = collect(sim, "MeleeSwing");
    for (let i = 0; i < 400 && swings.length === 0; i++) sim.step();
    expect(swings.length).toBe(1);
    const p = sim.player()!;
    expect(Math.hypot(b.position.x - p.position.x, b.position.z - p.position.z)).toBeLessThanOrEqual(WEAPON_CATALOG.baton.range);
  });

  it("a player who steps back during the windup is missed", () => {
    const sim = simWith();
    const b = brawler(sim, 1.6);
    const strikes = collect<{ hits: number }>(sim, "MeleeStrike");
    const swings = collect(sim, "MeleeSwing");
    while (swings.length === 0) sim.step();
    run(sim, ticks(BATON.npcWindup) + 2, input({ moveZ: -1 }));
    expect(strikes[0]).toMatchObject({ hits: 0 });
    expect(aimSpreadOf(b, null)).toBe(0);
  });
});
