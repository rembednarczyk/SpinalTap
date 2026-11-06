import { describe, expect, it } from "vitest";
import { type DomainState, LOOT_TABLES, PITY_AFTER, QUICKHACKS, RARITIES, type SaveSnapshot, type StyleKind, hasItemLevel, rollLootFor } from "@seki/core";
import { SIM_HZ, Simulation, deriveRandom, gangerEntity, stateHash, type Entity } from "../src";
import { enemyScalingOf } from "../src/world/enemy-grade";
import { reinforcementEntity } from "../src/world/reinforcements";
import { input, run, streetSim } from "./helpers";
import { offset, quietStreet, takeDown, victim } from "./takedown-scenes";

/*
 * The player's style and bad luck in the running game (ADR-0059, stage 6): what defeats an enemy
 * goes into the style, and the bag of an enemy she defeated counts towards her bad luck.
 */

/** Plac Litewski, nobody about, with `patch` on the domain (as a load would bring it). */
const simWith = (patch: (d: DomainState) => DomainState): Simulation => {
  const base = streetSim({ seed: 5 });
  const snap = base.snapshot(null, "t", "");
  const sim = Simulation.fromSnapshot({ ...snap, domain: patch(snap.domain) });
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  return sim;
};

const withSmg = (d: DomainState): DomainState => ({
  ...d,
  inventory: { ...d.inventory, items: [...d.inventory.items, { uid: "i9", def: "hebi_smg", rarity: "common", level: 1, loaded: 30, mods: {} }], nextUid: d.inventory.nextUid + 1 },
  equipment: { ...d.equipment, primary: "i9", active: "primary" },
});

/** A Hebi ganger `ahead` metres in front of the player, in her line of fire, one hit from death. */
const ganger = (sim: Simulation, ahead: number, type: "hebi_ganger" | "hebi_enforcer" = "hebi_ganger", id = 4100): Entity => {
  const p = sim.player()!;
  const g = gangerEntity(id, { key: `style-${id}`, position: { x: p.position.x, y: p.position.y, z: p.position.z + ahead }, yaw: Math.PI }, null, 1, p.chunk ?? "", undefined, type);
  return sim.world.add(g);
};

const style = (sim: Simulation): readonly StyleKind[] => sim.domain.progression.style;

describe("the style in play", () => {
  it("an enemy shot down with the SMG is a fight of the SMG", () => {
    const sim = simWith(withSmg);
    sim.step();
    const g = ganger(sim, 5);
    for (let i = 0; i < 60 && sim.world.has(g); i++) sim.step(input({ fire: true, lookPitch: 0 }));
    expect(sim.world.has(g)).toBe(false);
    expect(style(sim)).toEqual(["smg"]);
  });

  it("a takedown is a fight of stealth, once, whether she knocks it out or kills it, and shooting the body adds none", () => {
    const sim = quietStreet();
    victim(sim);
    takeDown(sim);
    expect(style(sim)).toEqual(["stealth"]);
    const body = [...sim.world].find((e) => e.key === "victim")!;
    body.health = { ...body.health!, current: 0 };
    body.lastHitBy = sim.player()!.id;
    body.lastHitStyle = "pistol";
    sim.step();
    expect(style(sim)).toEqual(["stealth"]);
    const lethal = quietStreet(8);
    victim(lethal);
    takeDown(lethal, true);
    expect([...lethal.world].some((e) => e.key === "victim" && e.health && e.health.current > 0)).toBe(false);
    expect(style(lethal)).toEqual(["stealth"]);
  });

  /** Hack `slot` (1 ping, 4 Short Circuit) on `g` in front of her, held until the upload lands. */
  const hack = (sim: Simulation, g: Entity, slot: 1 | 4, upload: number): void => {
    const me = sim.player()!;
    me.pitch = Math.atan2(me.position.y + 1.62 - (g.position.y + 1.25), Math.hypot(g.position.x - me.position.x, g.position.z - me.position.z));
    sim.step(input({ scan: true, quickhack: slot, lookPitch: 0 }));
    run(sim, Math.ceil(upload * SIM_HZ) + 2, input({ scan: true, lookPitch: 0 }));
  };

  it("a Short Circuit that kills a fresh enemy is one fight of quickhacks, not two", () => {
    const sim = simWith((d) => d);
    sim.step();
    const g = ganger(sim, 5);
    g.health = { ...g.health!, current: 1 };
    hack(sim, g, 4, QUICKHACKS.short_circuit.upload);
    expect(sim.world.has(g)).toBe(false);
    expect(style(sim)).toEqual(["quickhack"]);
  });

  it("an enemy hacked first and then shot dead is one fight, the hack's: the first use on it counts", () => {
    const sim = simWith(withSmg);
    sim.step();
    const g = ganger(sim, 5);
    hack(sim, g, 1, QUICKHACKS.ping.upload);
    expect(sim.domain.progression.hacked).toContain("style-4100");
    expect(style(sim)).toEqual(["quickhack"]);
    for (let i = 0; i < 60 && sim.world.has(g); i++) sim.step(input({ fire: true, lookPitch: 0 }));
    expect(sim.world.has(g)).toBe(false);
    expect(style(sim)).toEqual(["quickhack"]);
  });

  /** As the body watch wakes it: up, alerted, then calm again for the next takedown. */
  const wake = (sim: Simulation, e: Entity): void => {
    sim.world.removeComponent(e, "downed");
    sim.world.removeComponent(e, "unconscious");
    e.ai!.alerted = false;
  };

  it("an enemy knocked out, woken and knocked out again is one fight of stealth; killed after waking, too", () => {
    const sim = quietStreet();
    const v = victim(sim);
    takeDown(sim);
    wake(sim, v);
    takeDown(sim);
    expect(v.unconscious).toBe(true);
    expect(style(sim)).toEqual(["stealth"]);
    wake(sim, v);
    v.health = { ...v.health!, current: 0 };
    v.lastHitBy = sim.player()!.id;
    v.lastHitStyle = "pistol";
    sim.step();
    expect(sim.world.has(v)).toBe(false);
    expect(style(sim)).toEqual(["stealth"]);
  });

  it("the mark of a fight counted goes into the save: knocked out, woken, saved, knocked out after the load is still one fight", () => {
    const sim = quietStreet();
    const g = sim.world.add(reinforcementEntity(4000, 1, sim.tick, "hebi_ganger", offset(sim, 0, 1.2), enemyScalingOf(sim.domain)));
    g.hackFx = { pinged: 0, blind: 100, crippled: 0 };
    sim.session.watch.sent = 1;
    takeDown(sim);
    wake(sim, g);
    const snap = sim.snapshot(null, "t", "");
    expect(snap.reinforcements?.people[0]?.state.fought).toBe(true);
    const loaded = Simulation.fromSnapshot(JSON.parse(JSON.stringify(snap)) as SaveSnapshot);
    expect(stateHash(loaded.snapshot(null, "t", ""))).toBe(stateHash(snap));
    const back = loaded.world.with("security").entities.find((e) => e.enemy)!;
    // The hack's blindness is not saved: both blinded again, so they step alike.
    for (const e of [g, back]) e.hackFx = { pinged: 0, blind: 100, crippled: 0 };
    for (const s of [sim, loaded]) takeDown(s);
    expect(back.unconscious).toBe(true);
    expect(style(loaded)).toEqual(["stealth"]);
    expect(stateHash(loaded.snapshot(null, "t", ""))).toBe(stateHash(sim.snapshot(null, "t", "")));
  });

  it("an enemy someone else killed is no fight of hers", () => {
    const sim = simWith((d) => d);
    sim.step();
    const g = ganger(sim, 5);
    g.health = { ...g.health!, current: 0 };
    g.lastHitBy = 99999;
    sim.step();
    expect(style(sim)).toEqual([]);
  });
});

describe("bad luck in play", () => {
  const unluckyEnforcer = (byPlayer: boolean) => {
    const sim = simWith((d) => ({ ...d, progression: { ...d.progression, unlucky: PITY_AFTER } }));
    sim.step();
    const g = ganger(sim, 6, "hebi_enforcer", 4200);
    g.health = { ...g.health!, current: 0 };
    if (byPlayer) g.lastHitBy = sim.player()!.id;
    sim.step();
    const bag = sim.domain.loot.containers.find((c) => c.key === "loot:style-4200")!;
    return { sim, bag };
  };

  it("after 8 pieces below rare, the next piece from an enemy she defeats is rare at least", () => {
    const { sim, bag } = unluckyEnforcer(true);
    const shotgun = bag.lines.find((l) => l.kind === "item" && l.item === "raijin12");
    expect(shotgun?.kind === "item" && RARITIES.indexOf(shotgun.rarity) >= RARITIES.indexOf("rare")).toBe(true);
    // The count starts again with it; the bag's other rolled pieces (if any) count on from there.
    // In the Hebi table the rolled tiers are the weapons and garments (mods and the grip have fixed ones).
    const after = bag.lines.slice(bag.lines.indexOf(shotgun!) + 1).filter((l) => l.kind === "item" && hasItemLevel(l.item));
    expect(sim.domain.progression.unlucky).toBeLessThanOrEqual(after.length);
  });

  it("the bag of an enemy someone else killed neither counts nor is lifted", () => {
    const { sim, bag } = unluckyEnforcer(false);
    expect(sim.domain.progression.unlucky).toBe(PITY_AFTER);
    const grade = { source: 1, player: 1, rng: deriveRandom(5, "loot:style-4200:grade") };
    expect(bag.lines).toEqual(rollLootFor(LOOT_TABLES.hebi_enforcer, deriveRandom(5, "loot:style-4200"), grade, { style: [] }).lines);
  });
});

describe("a blade from the loot (ADR-0059 stage 6, the user's call)", () => {
  it("an enforcer's shirasaya comes into the bag, into the melee slot and into her hand", () => {
    // The first key (in a fixed order) whose bag holds a shirasaya: the entry comes from the main stream alone.
    const grade = (key: string) => ({ source: 1, player: 1, rng: deriveRandom(5, `loot:${key}:grade`) });
    const key = Array.from({ length: 400 }, (_, i) => `blade-${i}`).find((k) =>
      rollLootFor(LOOT_TABLES.hebi_enforcer, deriveRandom(5, `loot:${k}`), grade(k), { style: [] }).lines.some((l) => l.kind === "item" && l.item === "shirasaya"),
    )!;
    expect(key).toBeDefined();
    const sim = simWith((d) => d);
    sim.step();
    const p = sim.player()!;
    const g = sim.world.add(gangerEntity(4300, { key, position: { x: p.position.x, y: p.position.y, z: p.position.z + 1 }, yaw: Math.PI }, null, 1, p.chunk ?? "", undefined, "hebi_enforcer"));
    g.health = { ...g.health!, current: 0 };
    sim.step();
    sim.enqueue({ type: "take-loot", containerKey: `loot:${key}`, line: "all" });
    sim.step();
    const blade = sim.domain.inventory.items.find((i) => i.def === "shirasaya")!;
    // A weapon of a level (ADR-0059 stage 4), whatever the pick of the main stream gives.
    expect(blade.level).toBeGreaterThanOrEqual(1);
    sim.enqueue({ type: "equip-item", uid: blade.uid });
    sim.step();
    expect(sim.domain.equipment.melee).toBe(blade.uid);
    sim.step(input({ weaponSlot: 3 }));
    for (let i = 0; i < 60; i++) sim.step();
    expect(sim.player()!.combatant).toMatchObject({ weapon: "shirasaya", slot: "melee" });
    expect(sim.player()!.combatant!.stats!.look).toBe("blade");
  });
});
