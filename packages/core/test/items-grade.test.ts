import { describe, expect, it } from "vitest";
import {
  mulberry32,
  BASE_LOOT_GRADE,
  EMPTY_EQUIPMENT,
  EMPTY_INVENTORY,
  LOOT_TABLES,
  MAX_ITEM_LEVEL,
  RARITY,
  RARITY_WEIGHTS,
  ROLLED_RARITIES,
  type RandomPort,
  type Rarity,
  TRAIT_CATALOG,
  TRAIT_TABLES,
  addInstance,
  bestRarity,
  clampItemLevel,
  enemyLootLevel,
  hasItemLevel,
  isTraitId,
  itemLevelOf,
  levelScale,
  lootLevel,
  newInstance,
  rarityAtLeast,
  rarityWeights,
  rollGrade,
  rollLoot,
  rollRarityAt,
  rollTraits,
  traitEffects,
  traitTableOf,
  traitsFit,
} from "../src";

/** A seeded stream (mulberry32) for the distribution tests. */
const seeded = (seed: number): RandomPort => ({ next: mulberry32(seed) });

const counting = (values: number[]) => {
  let i = 0;
  const rng: RandomPort & { calls: number } = {
    calls: 0,
    next() {
      rng.calls += 1;
      return values[i++ % values.length] ?? 0;
    },
  };
  return rng;
};

/** How many of `n` evenly spaced draws give each tier at a level. */
const evenCounts = (level: number, n: number): Record<string, number> => {
  const out: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const r = rollRarityAt(level, (i + 0.5) / n);
    out[r] = (out[r] ?? 0) + 1;
  }
  return out;
};

describe("item level", () => {
  it("scales by 4% a level above 1, ×2.16 at 30, in whole levels 1..30", () => {
    expect(levelScale()).toBe(1);
    expect(levelScale(1)).toBe(1);
    expect(levelScale(10)).toBeCloseTo(1.36);
    expect(levelScale(MAX_ITEM_LEVEL)).toBeCloseTo(2.16);
    expect(levelScale(45)).toBeCloseTo(2.16);
    expect(levelScale(0)).toBe(1);
    expect(clampItemLevel(2.4)).toBe(2);
  });

  it("is kept by weapons and garments only; a piece without one is of level 1", () => {
    expect(hasItemLevel("unity9")).toBe(true);
    expect(hasItemLevel("moto_helmet")).toBe(true);
    expect(hasItemLevel("suppressor")).toBe(false);
    expect(hasItemLevel("hitomi_optics_mk1")).toBe(false);
    expect(itemLevelOf({ def: "unity9" })).toBe(1);
    expect(itemLevelOf({ def: "unity9", level: 12 })).toBe(12);
    expect(itemLevelOf({ def: "suppressor", level: 12 })).toBeNull();
  });

  it("puts loot in the player's band: clamp(source, player ± 2)", () => {
    expect(lootLevel(20, 10)).toBe(12);
    expect(lootLevel(3, 10)).toBe(8);
    expect(lootLevel(11, 10)).toBe(11);
    expect(lootLevel(0, 1)).toBe(1);
    expect(lootLevel(31, 30)).toBe(30);
    expect(lootLevel(5, 40)).toBe(28);
  });

  it("gives an enemy's loot its level −1, 0 or +1, in the band", () => {
    expect(enemyLootLevel(10, 10, 0)).toBe(9);
    expect(enemyLootLevel(10, 10, 0.5)).toBe(10);
    expect(enemyLootLevel(10, 10, 0.99)).toBe(11);
    expect(enemyLootLevel(10, 10, 1)).toBe(11);
    expect(enemyLootLevel(1, 1, 0)).toBe(1);
    // A much stronger enemy still drops within two levels of the player.
    expect(enemyLootLevel(20, 10, 0.99)).toBe(12);
  });
});

describe("rarity by level", () => {
  it("has five rolled tiers plus unique, epic and legendary with traits", () => {
    expect(ROLLED_RARITIES).toEqual(["common", "uncommon", "rare", "epic", "legendary"]);
    expect(RARITY.epic).toMatchObject({ damage: 1.24, spread: 0.8, armor: 3, value: 4, traits: 1, label: "inventory.rarity.epic" });
    expect(RARITY.legendary).toMatchObject({ damage: 1.32, spread: 0.75, armor: 4, value: 6, traits: 2 });
    for (const r of ["common", "uncommon", "rare", "unique"] as const) expect(RARITY[r].traits).toBe(0);
    expect(bestRarity(["rare", "legendary", "epic"])).toBe("legendary");
    expect(bestRarity(["legendary", "unique"])).toBe("unique");
    expect([..."common uncommon rare epic legendary unique".split(" ")].map((r) => rarityAtLeast(r as Rarity, "rare"))).toEqual([false, false, true, true, true, true]);
  });

  it("weights the tiers by the rows at 1, 10, 20 and 30, linear in between, every row 100", () => {
    expect(rarityWeights(1)).toEqual([75, 20, 5, 0, 0]);
    expect(rarityWeights(10)).toEqual([60, 26, 10, 4, 0]);
    expect(rarityWeights(20)).toEqual([45, 30, 15, 8, 2]);
    expect(rarityWeights(30)).toEqual([32, 32, 19, 12, 5]);
    expect(rarityWeights(0)).toEqual(rarityWeights(1));
    expect(rarityWeights(31)).toEqual(rarityWeights(30));
    const mid = rarityWeights(15);
    expect(mid[0]).toBeCloseTo(52.5);
    expect(mid[4]).toBeCloseTo(1);
    for (let level = 1; level <= 30; level++) expect(rarityWeights(level).reduce((a, b) => a + b, 0)).toBeCloseTo(100);
    for (const row of RARITY_WEIGHTS) expect(row.weights.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("keeps the 75 / 20 / 5 thresholds of before at level 1", () => {
    expect(rollRarityAt(1, 0.7499)).toBe("common");
    expect(rollRarityAt(1, 0.75)).toBe("uncommon");
    expect(rollRarityAt(1, 0.9499)).toBe("uncommon");
    expect(rollRarityAt(1, 0.95)).toBe("rare");
    expect(rollRarityAt(1, 0.9999)).toBe("rare");
    // Past the end (a draw of exactly 1) the rarest tier.
    expect(rollRarityAt(30, 1)).toBe("legendary");
  });

  it("deals 1000 evenly spaced draws out as the weights say at levels 1, 10, 20 and 30", () => {
    expect(evenCounts(1, 1000)).toEqual({ common: 750, uncommon: 200, rare: 50 });
    expect(evenCounts(10, 1000)).toEqual({ common: 600, uncommon: 260, rare: 100, epic: 40 });
    expect(evenCounts(20, 1000)).toEqual({ common: 450, uncommon: 300, rare: 150, epic: 80, legendary: 20 });
    expect(evenCounts(30, 1000)).toEqual({ common: 320, uncommon: 320, rare: 190, epic: 120, legendary: 50 });
  });

  it("gives the same tiers for the same seed, within 2 points of the weights over 4000 draws", () => {
    for (const level of [1, 10, 20, 30]) {
      const draw = (): Rarity[] => {
        const rng = seeded(level * 7919);
        return Array.from({ length: 4000 }, () => rollRarityAt(level, rng.next()));
      };
      const tiers = draw();
      expect(tiers).toEqual(draw());
      rarityWeights(level).forEach((w, i) => {
        const share = (100 * tiers.filter((t) => t === ROLLED_RARITIES[i]).length) / tiers.length;
        expect(Math.abs(share - w)).toBeLessThan(2);
      });
    }
  });
});

describe("traits", () => {
  it("are data with catalog keys, in a table per kind of piece", () => {
    expect(TRAIT_TABLES.firearm).toEqual(["silenced", "match_barrel", "hot_loads", "quick_draw", "light_trigger"]);
    expect(TRAIT_TABLES.melee).toEqual(["weighted", "balanced", "long_reach"]);
    expect(TRAIT_TABLES.garment).toEqual(["padded", "durable", "lightweight"]);
    expect(TRAIT_CATALOG.padded).toMatchObject({ label: "trait.padded.name", description: "trait.padded.desc", effect: { armor: 1 } });
    expect(traitTableOf("unity9")).toBe("firearm");
    expect(traitTableOf("shirasaya")).toBe("melee");
    expect(traitTableOf("cargo_pants")).toBe("garment");
    expect(traitTableOf("suppressor")).toBeNull();
    expect(isTraitId("padded")).toBe(true);
    expect(isTraitId("cursed")).toBe(false);
    expect(isTraitId(1)).toBe(false);
    expect(traitEffects()).toEqual([]);
  });

  it("come one for epic, two different ones for legendary, none below or on mods", () => {
    expect(rollTraits("unity9", "rare", 0, 0)).toEqual([]);
    expect(rollTraits("suppressor", "legendary", 0, 0)).toEqual([]);
    expect(rollTraits("unity9", "epic", 0, 0.9)).toEqual(["silenced"]);
    expect(rollTraits("unity9", "legendary", 0, 0)).toEqual(["silenced", "match_barrel"]);
    // The second is drawn from the rest, so it never repeats the first; a draw of 1 is the last.
    expect(rollTraits("baton", "legendary", 1, 1)).toEqual(["long_reach", "balanced"]);
    for (let i = 0; i < 20; i++) {
      const [a, b] = rollTraits("hebi_jacket", "legendary", i / 20, (19 - i) / 20);
      expect(a).not.toBe(b);
    }
  });

  it("fit a piece when known, of its table and not repeated", () => {
    expect(traitsFit("unity9", ["silenced", "hot_loads"])).toBe(true);
    expect(traitsFit("unity9", ["padded"])).toBe(false);
    expect(traitsFit("unity9", ["silenced", "silenced"])).toBe(false);
    expect(traitsFit("unity9", ["cursed"])).toBe(false);
    expect(traitsFit("suppressor", ["silenced"])).toBe(false);
  });
});

describe("grade of a new piece", () => {
  it("rolls the tier at the piece's level and an epic or legendary piece's traits", () => {
    expect(rollGrade("unity9", "roll", 1, 0.5, 0, 0)).toEqual({ rarity: "common", level: 1 });
    expect(rollGrade("unity9", "roll", 30, 0.9, 0, 0)).toEqual({ rarity: "epic", level: 30, traits: ["silenced"] });
    expect(rollGrade("hebi_jacket", "legendary", 12.2, 0, 0.5, 0.5)).toEqual({ rarity: "legendary", level: 12, traits: ["durable", "lightweight"] });
    // Mods have no level: the tier as at level 1, and no traits.
    expect(rollGrade("suppressor", "roll", 30, 0.97, 0, 0)).toEqual({ rarity: "rare" });
    expect(rollGrade("suppressor", "common", 30, 0.97, 0, 0)).toEqual({ rarity: "common" });
  });

  it("goes onto the instance: level and traits on weapons and garments, the tier alone on the rest", () => {
    expect(newInstance("i1", "hebi_smg", { rarity: "epic", level: 7, traits: ["hot_loads"] })).toEqual({
      uid: "i1",
      def: "hebi_smg",
      rarity: "epic",
      level: 7,
      traits: ["hot_loads"],
      loaded: 0,
      mods: {},
    });
    expect(newInstance("i1", "cargo_pants", { rarity: "rare", level: 40, traits: [] })).toEqual({ uid: "i1", def: "cargo_pants", rarity: "rare", level: 30, condition: 100 });
    expect(newInstance("i1", "holo_sight", { rarity: "rare", level: 9, traits: ["silenced"] })).toEqual({ uid: "i1", def: "holo_sight", rarity: "rare" });
    const r = addInstance(EMPTY_INVENTORY, EMPTY_EQUIPMENT, "baton", { rarity: "uncommon", level: 4 }, { condition: 50 });
    expect(r.ok && r.item).toMatchObject({ def: "baton", rarity: "uncommon", level: 4 });
  });
});

describe("rollLoot with a grade", () => {
  it("draws three numbers of the grade's stream per line and leaves the main stream as it was", () => {
    const main = counting([0.4]);
    const grade = counting([0.5]);
    const lines = rollLoot(LOOT_TABLES.hebi_enforcer, main, { source: 10, player: 10, rng: grade });
    expect(main.calls).toBe(1 + 2 * 2 + 3 * 3);
    expect(grade.calls).toBe(3 * (2 + 3));
    expect(lines.map((l) => l.kind)).toEqual(rollLoot(LOOT_TABLES.hebi_enforcer, counting([0.4])).map((l) => l.kind));
  });

  it("gives an enemy's pieces a level in the band and the tier of that level", () => {
    // Shotgun guaranteed: rarity 0.97 at level 21 is epic (cumulative 43.7 + 30.2 + 15.4 = 89.3 .. 97.7).
    const lines = rollLoot(LOOT_TABLES.hebi_enforcer, counting([0.4, 0.4, 0.97]), { source: 20, player: 20, rng: counting([0.99, 0.3, 0.3]) });
    expect(lines[1]).toEqual({ kind: "item", item: "raijin12", rarity: "epic", level: 21, traits: ["match_barrel"], qty: 1 });
    // Ammo and stacks carry no level.
    expect(lines[2]).toEqual({ kind: "ammo", ammo: "12g", qty: 8 });
  });

  it("without a grade every piece is of level 1, as the loot of before", () => {
    const lines = rollLoot(LOOT_TABLES.hebi_enforcer, counting([0.4]), BASE_LOOT_GRADE);
    expect(lines[1]).toMatchObject({ item: "raijin12", rarity: "common", level: 1 });
    expect(lines[1]).not.toHaveProperty("traits");
  });
});
