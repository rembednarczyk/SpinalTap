import { describe, expect, it } from "vitest";
import { MAX_LEVEL, PITY_AFTER, QUEST_ECHO, QUEST_FIRST_CONTRACT, QUEST_MIRROR, type Rarity } from "@seki/core";
import { type DistrictPass, type PassageResult, raritySample, runPassage } from "./balance-model";

/**
 * The balance test of ADR-0059 stage 8: a passage through the content as it is, district after
 * district in the order of their bands, on the sim's formulas (`balance-model.ts`). Four measures
 * with the thresholds written into the ADR:
 * 1. pace: 8 to 10 levels a district, and the last one ends the road at level 30;
 * 2. time of combat in the band: every fight within 0.75 to 1.33 of the same fight at the band's
 *    floor, both ways (the player downing the enemy, the enemy downing the player);
 * 3. rarities at item levels 1, 10, 20 and 30: rare and better grow with the level, common and
 *    uncommon stay the most, epic not at 1, legendary not below 11 and 2 to 10% at 30, and the
 *    protection against bad luck lifts rare at level 1 to at most 20%;
 * 4. no run of bad luck longer than 8 rolled pieces below rare.
 */

const KAITO_ROUND = ["eliminate", "delivery"] as const;
const HANA_ROUND = ["retrieve", "protect"] as const;
const GENZO_ROUND = ["escort", "infiltrate", "hack"] as const;
const jobs = <T,>(round: readonly T[], n = 10): T[] => Array.from({ length: n }, (_, i) => round[i % round.length] as T);

/**
 * The content in order. Krakowskie: the first contract and act I with ten of Kaito's jobs on its
 * own sites (a delivery goes to Hana's stall); Stare Miasto: ten jobs under the footbridge on
 * Grodzka; the market: act II with Kagami's cleaners and ten of Hana's jobs; the docks: ten of
 * Genzō's. Only Krakowskie and the market have a main thread.
 */
export const PASSAGE: readonly DistrictPass[] = [
  {
    district: "shinsekai-7",
    quests: [QUEST_FIRST_CONTRACT, QUEST_ECHO],
    questFights: [{ type: "hebi_ganger", count: 2, band: "shinsekai-7" }],
    jobs: jobs(KAITO_ROUND),
    sites: ["east_lot", "koi_back", "car_wash", "south_gate", "hana_stall"],
    foe: "hebi_ganger",
    gun: "hebi_smg",
    jacket: "hebi_jacket",
  },
  { district: "kanal", quests: [], questFights: [], jobs: jobs(["eliminate"]), sites: ["kanal_bridge"], foe: "hebi_ganger", gun: "hebi_smg", jacket: "hebi_jacket" },
  {
    district: "targ",
    quests: [QUEST_MIRROR],
    questFights: [{ type: "kagami_cleaner", count: 3, band: "targ" }],
    jobs: jobs(HANA_ROUND),
    foe: "hebi_ganger",
    gun: "hebi_smg",
    jacket: "hebi_jacket",
  },
  { district: "doki", quests: [], questFights: [], jobs: jobs(GENZO_ROUND), foe: "tessen_guard", gun: "tessen_ar5", jacket: "tessen_vest" },
];

const SEEDS = [1, 2, 3, 4, 5];
const runs: readonly PassageResult[] = SEEDS.map((seed) => runPassage(PASSAGE, seed));

/** The thresholds of the ADR. */
export const PACE = { min: 8, max: 10 } as const;
export const COMBAT_TIME = { min: 0.75, max: 1.33 } as const;
const SAMPLE_LEVELS = [1, 10, 20, 30] as const;
const SAMPLE_PIECES = 3000;

describe("balance of the passage (ADR-0059 stage 8)", () => {
  it("each district but the last gives 8 to 10 levels, the last ends the road at 30", () => {
    for (const r of runs) {
      const levels = r.districts.map((d) => d.to - d.from);
      const last = r.districts[r.districts.length - 1]!;
      for (const gained of levels.slice(0, -1)) {
        expect(gained, `levels by district ${levels.join("/")}`).toBeGreaterThanOrEqual(PACE.min);
        expect(gained, `levels by district ${levels.join("/")}`).toBeLessThanOrEqual(PACE.max);
      }
      expect(last.from, "the docks still teach").toBeLessThan(MAX_LEVEL);
      expect(last.to).toBe(MAX_LEVEL);
    }
  });

  it("every fight takes 0.75 to 1.33 of the same fight at its band's floor, both ways", () => {
    for (const r of runs) {
      expect(r.fights.length).toBeGreaterThan(100);
      for (const f of r.fights) {
        const at = `${f.district}, player ${f.player}, enemy ${f.enemy}`;
        expect(f.ttk, at).toBeGreaterThanOrEqual(COMBAT_TIME.min);
        expect(f.ttk, at).toBeLessThanOrEqual(COMBAT_TIME.max);
        expect(f.ttd, at).toBeGreaterThanOrEqual(COMBAT_TIME.min);
        expect(f.ttd, at).toBeLessThanOrEqual(COMBAT_TIME.max);
      }
    }
  });

  it("no run of bad luck in the player's bags is longer than 8", () => {
    for (const r of runs) {
      expect(r.pieces.length).toBeGreaterThan(20);
      expect(r.worstRun).toBeLessThanOrEqual(PITY_AFTER);
    }
  });
});

describe("rarities at item levels 1, 10, 20 and 30 (ADR-0059 stage 8)", () => {
  const rarePlus = (s: Readonly<Record<Rarity, number>>): number => s.rare + s.epic + s.legendary;
  const table = SAMPLE_LEVELS.map((level) => raritySample(level, SAMPLE_PIECES, 7, false).shares);
  const lucky = SAMPLE_LEVELS.map((level) => raritySample(level, SAMPLE_PIECES, 7, true));

  it("rare and better grow with the level, common and uncommon stay the most", () => {
    for (let i = 1; i < table.length; i++) expect(rarePlus(table[i]!)).toBeGreaterThan(rarePlus(table[i - 1]!));
    for (const s of table) expect(s.common + s.uncommon).toBeGreaterThanOrEqual(0.6);
  });

  it("no epic at level 1, no legendary below 11, and 2 to 10% legendary at 30", () => {
    const [l1, l10, l20, l30] = table;
    expect(l1!.epic).toBe(0);
    expect(l1!.legendary).toBe(0);
    expect(l10!.legendary).toBe(0);
    expect(l20!.legendary).toBeGreaterThan(0);
    expect(l30!.legendary).toBeGreaterThanOrEqual(0.02);
    expect(l30!.legendary).toBeLessThanOrEqual(0.1);
  });

  it("the protection against bad luck caps the runs at 8 and leaves rare at level 1 at most 20%", () => {
    for (const s of lucky) expect(s.worstRun).toBeLessThanOrEqual(PITY_AFTER);
    expect(rarePlus(lucky[0]!.shares)).toBeGreaterThan(rarePlus(table[0]!));
    expect(rarePlus(lucky[0]!.shares)).toBeLessThanOrEqual(0.2);
  });
});
