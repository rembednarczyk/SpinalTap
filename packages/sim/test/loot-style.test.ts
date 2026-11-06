import { describe, expect, it } from "vitest";
import { type DomainState, LOOT_TABLES, PITY_AFTER, RARITIES, type StyleKind, hasItemLevel, rollLootFor } from "@seki/core";
import { Simulation, deriveRandom, gangerEntity, type Entity } from "../src";
import { input, streetSim } from "./helpers";
import { quietStreet, takeDown, victim } from "./takedown-scenes";

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
