import { describe, expect, it } from "vitest";
import {
  mulberry32,
  BASE_LOOT_GRADE,
  LOOT_TABLES,
  type LootLine,
  type LootTable,
  PITY_AFTER,
  type RandomPort,
  STYLE_KINDS,
  STYLE_LOOT_BONUS,
  STYLE_WINDOW,
  type StyleKind,
  lootStyleOf,
  recordStyle,
  rollGrade,
  rollLoot,
  rollLootFor,
  styleShares,
  styledEntries,
  weaponStyle,
} from "../src";

/** Counts draws and returns a fixed sequence, cycling. */
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

/** A small deterministic stream (mulberry32), the same for every run of the test. */
const seeded = (seed: number): RandomPort => ({ next: mulberry32(seed) });

const all = (kind: StyleKind, n = STYLE_WINDOW): StyleKind[] => Array.from({ length: n }, () => kind);
const weightOf = (entries: ReturnType<typeof styledEntries>, item: string) => entries.find((e) => e.item === item)!.weight;

describe("the player's style (ADR-0059, stage 6)", () => {
  it("remembers the last 50 fights, oldest forgotten first", () => {
    let style: readonly StyleKind[] = [];
    for (let i = 0; i < STYLE_WINDOW; i++) style = recordStyle(style, "pistol");
    expect(style).toHaveLength(STYLE_WINDOW);
    for (let i = 0; i < 10; i++) style = recordStyle(style, "smg");
    expect(style).toHaveLength(STYLE_WINDOW);
    expect(style.slice(-10)).toEqual(all("smg", 10));
    expect(styleShares(style)).toMatchObject({ pistol: 40 / 50, smg: 10 / 50, rifle: 0 });
    // 50 more of the SMG and the pistol is forgotten.
    for (let i = 0; i < STYLE_WINDOW; i++) style = recordStyle(style, "smg");
    expect(styleShares(style)).toMatchObject({ pistol: 0, smg: 1 });
    expect(Object.values(styleShares([])).every((s) => s === 0)).toBe(true);
  });

  it("counts weapons by kind: the revolver with the pistol, the baton and the blade as melee", () => {
    expect([weaponStyle("unity9"), weaponStyle("oni44"), weaponStyle("hebi_smg"), weaponStyle("raijin12"), weaponStyle("tessen_ar5"), weaponStyle("kagero_dmr"), weaponStyle("baton"), weaponStyle("shirasaya")]).toEqual([
      "pistol",
      "pistol",
      "smg",
      "shotgun",
      "rifle",
      "rifle",
      "melee",
      "melee",
    ]);
    expect([lootStyleOf("suppressor"), lootStyleOf("tessen_uniform"), lootStyleOf("datachip"), lootStyleOf("9mm"), lootStyleOf("medkit")]).toEqual(["stealth", "stealth", "quickhack", null, null]);
  });
});

describe("loot weights leant towards the style", () => {
  const base = LOOT_TABLES.hebi_common.entries;

  it("a player of the SMG alone gets its weight +60%, no more, and everything else as it was", () => {
    const styled = styledEntries(base, all("smg"));
    expect(weightOf(styled, "hebi_smg")).toBeCloseTo(weightOf(base, "hebi_smg") * (1 + STYLE_LOOT_BONUS), 10);
    expect(STYLE_LOOT_BONUS).toBe(0.6);
    for (const e of styled) if (e.item !== "hebi_smg") expect(e.weight).toBe(weightOf(base, e.item));
    // Every kind still drops.
    for (const e of styled) expect(e.weight).toBeGreaterThan(0);
  });

  it("a mixed style shares the bonus: half SMG, half stealth is +30% each", () => {
    const style = [...all("smg", 25), ...all("stealth", 25)];
    const styled = styledEntries(base, style);
    expect(weightOf(styled, "hebi_smg") / weightOf(base, "hebi_smg")).toBeCloseTo(1.3, 10);
    expect(weightOf(styled, "suppressor") / weightOf(base, "suppressor")).toBeCloseTo(1.3, 10);
    expect(weightOf(styled, "9mm")).toBe(weightOf(base, "9mm"));
  });

  it("no style moves any weight past +60% or to 0, in any table", () => {
    for (const table of Object.values(LOOT_TABLES)) {
      for (const kind of STYLE_KINDS) {
        for (const style of [all(kind), [kind], [...all(kind, 7), ...all("rifle", 3)]]) {
          const styled = styledEntries(table.entries, style);
          styled.forEach((e, i) => {
            const was = table.entries[i]!.weight;
            expect(e.weight).toBeGreaterThanOrEqual(was);
            expect(e.weight).toBeLessThanOrEqual(was * (1 + STYLE_LOOT_BONUS) + 1e-9);
          });
        }
      }
    }
    // No style: the very same entries.
    expect(styledEntries(base, [])).toBe(base);
  });

  it("draws as many random numbers as before, so neither stream shifts", () => {
    const flat = counting([0.4]);
    const styled = counting([0.4]);
    rollLoot(LOOT_TABLES.hebi_enforcer, flat);
    rollLootFor(LOOT_TABLES.hebi_enforcer, styled, BASE_LOOT_GRADE, { style: all("smg"), pity: 0 });
    expect(styled.calls).toBe(flat.calls);
    // Without a style and a count of bad luck it is `rollLoot`.
    expect(rollLootFor(LOOT_TABLES.hebi_common, counting([0.3, 0.9, 0.2]), BASE_LOOT_GRADE, { style: [] }).lines).toEqual(rollLoot(LOOT_TABLES.hebi_common, counting([0.3, 0.9, 0.2])));
  });

  it("an SMG player finds more SMGs over many bags with the same draws", () => {
    const smgs = (style: readonly StyleKind[]): number => {
      const rng = seeded(1234);
      let n = 0;
      for (let i = 0; i < 2000; i++) n += rollLootFor(LOOT_TABLES.hebi_common, rng, BASE_LOOT_GRADE, { style }).lines.filter((l) => l.kind === "item" && l.item === "hebi_smg").length;
      return n;
    };
    const plain = smgs([]);
    const smg = smgs(all("smg"));
    // 5 of 100 against 8 of 103: about half again as many.
    expect(plain).toBeGreaterThan(60);
    expect(smg / plain).toBeGreaterThan(1.35);
    expect(smg / plain).toBeLessThan(1.75);
    // A rifle player finds none more (no rifle in the Hebi table) and no fewer.
    expect(smgs(all("rifle"))).toBe(plain);
  });
});

describe("the tables after the user's calls of stage 6", () => {
  const items = (id: keyof typeof LOOT_TABLES) => LOOT_TABLES[id].entries.map((e) => e.item);
  const share = (id: keyof typeof LOOT_TABLES, style: readonly StyleKind[], of: readonly string[]): number => {
    const entries = styledEntries(LOOT_TABLES[id].entries, style);
    const total = entries.reduce((s, e) => s + e.weight, 0);
    return entries.filter((e) => of.includes(e.item)).reduce((s, e) => s + e.weight, 0) / total;
  };

  it("pistols and melee weapons drop from the enemies, of a rolled tier", () => {
    for (const id of ["hebi_common", "hebi_enforcer", "tessen_guard", "tessen_sniper"] as const) {
      expect(items(id).some((i) => lootStyleOf(i) === "pistol"), id).toBe(true);
      expect(items(id).some((i) => lootStyleOf(i) === "melee"), id).toBe(true);
    }
    expect(items("hebi_enforcer")).toEqual(expect.arrayContaining(["unity9", "oni44", "baton", "shirasaya"]));
    for (const e of LOOT_TABLES.hebi_enforcer.entries) if (lootStyleOf(e.item) === "pistol" || lootStyleOf(e.item) === "melee") expect(e.rarity).toBe("roll");
    // The Hebi table still sums to the plan's 100, Tessen's to its 99.
    expect(LOOT_TABLES.hebi_common.entries.reduce((s, e) => s + e.weight, 0)).toBe(100);
    expect(LOOT_TABLES.tessen_guard.entries.reduce((s, e) => s + e.weight, 0)).toBe(99);
  });

  it("the pistol and melee styles raise the share of their weapons, the others stay above 0", () => {
    const pistols = ["unity9", "oni44"];
    const blades = ["baton", "shirasaya"];
    expect(share("hebi_enforcer", all("pistol"), pistols)).toBeGreaterThan(share("hebi_enforcer", [], pistols) * 1.5);
    expect(share("hebi_enforcer", all("melee"), blades)).toBeGreaterThan(share("hebi_enforcer", [], blades) * 1.5);
    expect(share("tessen_guard", all("pistol"), ["unity9"])).toBeGreaterThan(share("tessen_guard", [], ["unity9"]));
    for (const style of [all("pistol"), all("melee")]) for (const e of styledEntries(LOOT_TABLES.hebi_enforcer.entries, style)) expect(e.weight).toBeGreaterThan(0);
  });

  it("a hacker finds more capacity shards, datachips and neural implants; a sneak more disguises and suppressors", () => {
    const hacker = ["capacity_shard", "synapse_booster", "datachip"];
    for (const i of hacker) expect(lootStyleOf(i as Parameters<typeof lootStyleOf>[0])).toBe("quickhack");
    expect(share("tessen_guard", all("quickhack"), hacker)).toBeGreaterThan(share("tessen_guard", [], hacker) * 1.3);
    expect(share("tessen_guard", all("quickhack"), ["synapse_booster"])).toBeGreaterThan(share("tessen_guard", [], ["synapse_booster"]));
    const sneak = ["suppressor", "hebi_jacket", "tessen_uniform", "tessen_overalls"];
    for (const i of sneak) expect(lootStyleOf(i as Parameters<typeof lootStyleOf>[0])).toBe("stealth");
    expect(share("tessen_guard", all("stealth"), sneak)).toBeGreaterThan(share("tessen_guard", [], sneak) * 1.3);
    expect(share("hebi_common", all("stealth"), sneak)).toBeGreaterThan(share("hebi_common", [], sneak) * 1.3);
    // Within the +60%, and nothing else goes to 0.
    for (const style of [all("quickhack"), all("stealth")]) {
      styledEntries(LOOT_TABLES.tessen_guard.entries, style).forEach((e, i) => {
        const was = LOOT_TABLES.tessen_guard.entries[i]!.weight;
        expect(e.weight).toBeGreaterThan(0);
        expect(e.weight).toBeLessThanOrEqual(was * 1.6 + 1e-9);
      });
    }
  });
});

describe("protection against bad luck", () => {
  /** One rolled SMG a bag, common for a rarity number of 0. */
  const table: LootTable = { eddies: [1, 1], guaranteed: [], rolls: 1, entries: [{ item: "hebi_smg", weight: 1, qty: [1, 1], rarity: "roll" }] };
  const tierOf = (lines: readonly LootLine[]) => lines.flatMap((l) => (l.kind === "item" ? [l.rarity] : []));
  const unlucky = () => counting([0, 0, 0, 0]);

  it("after 8 pieces in a row below rare the 9th is rare, and the count starts again", () => {
    let pity = 0;
    for (let i = 0; i < PITY_AFTER; i++) {
      const r = rollLootFor(table, unlucky(), BASE_LOOT_GRADE, { style: [], pity });
      expect(tierOf(r.lines)).toEqual(["common"]);
      pity = r.pity!;
    }
    expect(pity).toBe(8);
    const ninth = rollLootFor(table, unlucky(), BASE_LOOT_GRADE, { style: [], pity });
    expect(tierOf(ninth.lines)).toEqual(["rare"]);
    expect(ninth.pity).toBe(0);
    expect(tierOf(rollLootFor(table, unlucky(), BASE_LOOT_GRADE, { style: [], pity: 0 }).lines)).toEqual(["common"]);
  });

  it("a rare piece of its own starts the count again; a better roll is not pulled down", () => {
    expect(rollLootFor(table, counting([0, 0, 0, 0.99]), BASE_LOOT_GRADE, { style: [], pity: 5 })).toMatchObject({ pity: 0 });
    const high = { source: 20, player: 20, rng: counting([0.5, 0.5, 0.5]) };
    const legendary = rollLootFor(table, counting([0, 0, 0, 0.999]), high, { style: [], pity: PITY_AFTER });
    expect(tierOf(legendary.lines)).toEqual(["legendary"]);
    expect(rollGrade("hebi_smg", "roll", 20, 0.999, 0.5, 0.5, "rare").rarity).toBe("legendary");
  });

  it("counts every rolled piece of a bag in order, and never fixed tiers, stacks or money", () => {
    // The enforcer: a rolled shotgun and three rolls of the Hebi table (9mm, 9mm, 9mm for 0.1).
    const r = rollLootFor(LOOT_TABLES.hebi_enforcer, counting([0.1, 0.1, 0]), BASE_LOOT_GRADE, { style: [], pity: 7 });
    expect(r.lines.filter((l) => l.kind === "item")).toMatchObject([{ item: "raijin12", rarity: "common" }]);
    expect(r.pity).toBe(8);
    // A fixed tier (the grip is always common) is no draw of luck.
    const grip: LootTable = { ...table, entries: [{ item: "steady_grip", weight: 1, qty: [1, 1], rarity: "common" }] };
    expect(rollLootFor(grip, unlucky(), BASE_LOOT_GRADE, { style: [], pity: PITY_AFTER })).toMatchObject({ pity: PITY_AFTER, lines: [{}, { rarity: "common" }] });
  });

  it("a bag that is not the player's counts nothing and lifts nothing", () => {
    const r = rollLootFor(table, unlucky(), BASE_LOOT_GRADE, { style: [] });
    expect(r.pity).toBeUndefined();
    expect(tierOf(r.lines)).toEqual(["common"]);
  });
});
