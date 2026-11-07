import { describe, expect, it } from "vitest";
import { INITIAL_PROGRESSION, LOOT_TABLES, type LootLine, hasItemLevel, rollLoot, xpForLevel } from "@seki/core";
import { Simulation, deriveRandom } from "../src";
import { alleySim, byKey } from "./helpers";

/**
 * The alley with only its guard, made an enforcer (whose bag always holds a shotgun) and the
 * player at `level`, so a kill shows the item level of the loot (ADR-0059, stage 4).
 */
const enforcerAt = (level: number, seed: number) => {
  const base = alleySim({ seed });
  const snap = base.snapshot(null, "t", "");
  const progression = { ...INITIAL_PROGRESSION, level, xp: xpForLevel(level) };
  const sim = Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, progression } });
  const guard = byKey(sim, "guard")!;
  for (const g of [...sim.world.with("ai")]) if (g !== guard) sim.world.remove(g);
  guard.enemy = { ...guard.enemy!, type: "hebi_enforcer" };
  return { sim, guard };
};

const killGuard = (sim: Simulation): readonly LootLine[] => {
  const guard = byKey(sim, "guard")!;
  guard.health = { ...guard.health!, current: 0 };
  sim.step();
  return sim.domain.loot.containers.find((c) => c.key === "loot:guard")!.lines;
};

const levels = (lines: readonly LootLine[]): number[] => lines.flatMap((l) => (l.kind === "item" && hasItemLevel(l.item) ? [l.level!] : []));

describe("item level of an enemy's loot (ADR-0059)", () => {
  it("lies within one level of the enemy, of the player's level inside the district's band", () => {
    const seen = new Set<number>();
    for (const seed of [3, 5, 8, 13, 21, 34]) {
      // Krakowskie (1-8): the guard is of the player's level 6.
      const { sim, guard } = enforcerAt(6, seed);
      expect(guard.enemy?.level).toBe(6);
      const lines = killGuard(sim);
      // The shotgun is always in the bag, so every bag has a levelled piece.
      expect(lines[1]).toMatchObject({ kind: "item", item: "raijin12" });
      for (const level of levels(lines)) {
        expect(level).toBeGreaterThanOrEqual(5);
        expect(level).toBeLessThanOrEqual(7);
        seen.add(level);
      }
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("is drawn from a stream of its own: the bag's contents are those of the main stream as before", () => {
    // The guard is of Krakowskie's top level 8 (ADR-0059), its loot kept within the player's 18..22.
    const { sim, guard } = enforcerAt(20, 7);
    expect(guard.enemy?.level).toBe(8);
    const lines = killGuard(sim);
    const grade = { source: 8, player: 20, rng: deriveRandom(7, "loot:guard:grade") };
    expect(levels(lines).every((l) => l === 18)).toBe(true);
    expect(lines).toEqual(rollLoot(LOOT_TABLES.hebi_enforcer, deriveRandom(7, "loot:guard"), grade));
    // The same draws without levels give the same kinds and quantities.
    const flat = rollLoot(LOOT_TABLES.hebi_enforcer, deriveRandom(7, "loot:guard"));
    expect(lines.map((l) => [l.kind, l.qty])).toEqual(flat.map((l) => [l.kind, l.qty]));
  });

  it("keeps its level and traits when picked up and dropped again", () => {
    const { sim } = enforcerAt(25, 11);
    const lines = killGuard(sim);
    const shotgun = lines[1]!;
    sim.enqueue({ type: "take-loot", containerKey: "loot:guard", line: 1 });
    sim.step();
    const item = sim.domain.inventory.items.find((i) => i.def === "raijin12")!;
    expect(shotgun.kind === "item" && { level: item.level, rarity: item.rarity, traits: item.traits }).toEqual({
      level: shotgun.kind === "item" ? shotgun.level : null,
      rarity: shotgun.kind === "item" ? shotgun.rarity : null,
      traits: shotgun.kind === "item" ? shotgun.traits : null,
    });
    sim.enqueue({ type: "drop-item", ref: { uid: item.uid }, qty: 1 });
    sim.step();
    const dropped = sim.domain.loot.containers.find((c) => c.key.startsWith("drop:"))!;
    expect(dropped.lines).toEqual([shotgun]);
  });
});
