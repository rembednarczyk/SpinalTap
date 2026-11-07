import { describe, expect, it } from "vitest";
import {
  EMPTY_CONTRACTS,
  type ContractContext,
  type ContractSiteId,
  type LootLine,
  bandLevel,
  contractExperience,
  contractPay,
  contractXp,
  createReputation,
  enemyLevel,
  enemyScale,
  generateContract,
  generateContractOfKind,
  killXp,
  killXpShare,
  levelScale,
  stashLines,
  undetectedXp,
  XP_BASE_LEVEL,
  xpLevelScale,
  quickhackXp,
  QUICKHACK_XP,
  xpToNext,
} from "../src";
import { sequenceRng } from "./helpers";

/** Stage 5 of ADR-0059: district bands, enemy levels and contract levels. */
describe("enemy level by district band (ADR-0059)", () => {
  const band = { min: 5, max: 14 };

  it("is the player's level kept within the band", () => {
    expect(enemyLevel(1, band)).toBe(5);
    expect(enemyLevel(9, band)).toBe(9);
    expect(enemyLevel(20, band)).toBe(14);
    expect(bandLevel(30, { min: 16, max: 30 })).toBe(30);
  });

  it("is the player's own outside every district", () => {
    expect(enemyLevel(7, null)).toBe(7);
  });

  it("an elite and a boss are a level above the band's, never past 30", () => {
    expect(enemyLevel(1, band, "elite")).toBe(6);
    expect(enemyLevel(20, band, "boss")).toBe(15);
    expect(enemyLevel(9, band, "regular")).toBe(9);
    expect(enemyLevel(30, { min: 16, max: 30 }, "boss")).toBe(30);
  });

  it("health and damage grow 4% a level, as an item's level does", () => {
    expect(enemyScale(1)).toBe(1);
    expect(enemyScale(10)).toBeCloseTo(1.36, 10);
    expect(enemyScale(30)).toBeCloseTo(2.16, 10);
    for (const l of [1, 5, 14, 30]) expect(enemyScale(l)).toBe(levelScale(l));
  });
});

describe("kill XP by the level difference (ADR-0059)", () => {
  it("5 levels weaker 10%, even 100%, 5 stronger 150%, flat beyond", () => {
    expect(killXpShare(5, 10)).toBeCloseTo(0.1, 10);
    expect(killXpShare(1, 10)).toBeCloseTo(0.1, 10);
    expect(killXpShare(10, 10)).toBe(1);
    expect(killXpShare(15, 10)).toBeCloseTo(1.5, 10);
    expect(killXpShare(20, 10)).toBeCloseTo(1.5, 10);
    expect(killXpShare(12, 10)).toBeCloseTo(1.2, 10);
  });

  it("scales the type's XP, which is its own up to level 6 for an even fight", () => {
    expect(killXp("hebi_ganger", 6, 6)).toBe(60);
    expect(killXp("hebi_ganger", 4, 4)).toBe(60);
    expect(killXp("hebi_ganger")).toBe(60);
    // An enemy 5 levels weaker: 10% of its own.
    expect(killXp("hebi_ganger", 1, 6)).toBe(6);
  });

  it("grows with the enemy's level as the cost of a level does, from level 6 on (stage 8, round 3)", () => {
    expect(xpLevelScale(XP_BASE_LEVEL)).toBe(1);
    // Below level 6 the floor: the type's own XP (the user's decision of 7.11).
    expect(xpLevelScale(1)).toBe(1);
    expect(xpLevelScale(5)).toBe(1);
    expect(xpLevelScale(12)).toBeCloseTo(2 ** 1.6, 10);
    expect(xpLevelScale(30)).toBeCloseTo(5 ** 1.6, 10);
    expect(xpLevelScale(40)).toBe(xpLevelScale(30));
    // From level 6 an even fight is worth about the same share of a level: 60 of 1753 at 6, 182 of 5330 at 12.
    expect(killXp("hebi_ganger", 12, 12)).toBe(182);
    expect(killXp("hebi_ganger", 12, 12) / xpToNext(12)).toBeCloseTo(killXp("hebi_ganger", 6, 6) / xpToNext(6), 2);
    expect(killXp("hebi_ganger", 9, 4)).toBe(172);
  });

  it("a quickhack on an enemy takes the same share by the level difference (stage 8, round 3)", () => {
    expect(quickhackXp(6, 6)).toBe(QUICKHACK_XP);
    expect(quickhackXp()).toBe(QUICKHACK_XP);
    expect(quickhackXp(1, 6)).toBe(2);
    expect(quickhackXp(1, 20)).toBe(2);
    expect(quickhackXp(11, 10)).toBe(28);
    expect(quickhackXp(15, 10)).toBe(38);
  });
});

describe("loot level from a stash: its district's level (ADR-0059)", () => {
  const lines: LootLine[] = [
    { kind: "eddies", qty: 50 },
    { kind: "item", item: "unity9", rarity: "common", qty: 1 },
    { kind: "item", item: "holo_sight", rarity: "uncommon", qty: 1 },
    { kind: "item", item: "hebi_jacket", rarity: "rare", qty: 1, level: 3 },
  ];

  it("gives a weapon without a level the district's, kept within the player's ± 2", () => {
    expect(stashLines(lines, 10, 9)[1]).toMatchObject({ item: "unity9", rarity: "common", level: 10 });
    expect(stashLines(lines, 16, 1)[1]).toMatchObject({ level: 3 });
    expect(stashLines(lines, 5, 12)[1]).toMatchObject({ level: 10 });
  });

  it("leaves a mod, money and a piece with a level of its own as they are", () => {
    const out = stashLines(lines, 16, 14);
    expect(out[0]).toEqual(lines[0]);
    expect(out[2]).toEqual(lines[2]);
    expect(out[3]).toEqual(lines[3]);
  });
});

describe("contract level (ADR-0059)", () => {
  const ctx = (levelAt?: ContractContext["levelAt"]): ContractContext => ({
    log: EMPTY_CONTRACTS,
    reputation: createReputation(),
    flags: [],
    tick: 0,
    ticksPerSecond: 60,
    ...(levelAt ? { levelAt } : {}),
  });

  it("sends one more man every 5 levels, none below level 5", () => {
    expect([1, 4, 5, 9, 10, 14, 15, 16, 20, 30].map(contractExperience)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 6]);
  });

  it("the old rates are those of level 1, and the pay grows 4% a level before the standing", () => {
    expect(contractPay(500, 1, 0)).toBe(500);
    expect(contractPay(500, 10, 0)).toBe(680);
    expect(contractPay(500, 10, 40)).toBe(Math.round(680 * 1.2));
  });

  it("a job of level 1 is what it was; its district's level sends more and pays more", () => {
    expect(generateContractOfKind("retrieve", ctx(), sequenceRng(0))).toMatchObject({ targets: 2, reward: 250 + 2 * 110 });
    expect(generateContractOfKind("retrieve", ctx(() => 1), sequenceRng(0))).toMatchObject({ targets: 2, reward: 470 });
    expect(generateContractOfKind("retrieve", ctx(() => 4), sequenceRng(0))).toMatchObject({ targets: 2, reward: Math.round((250 + 2 * 110) * 1.12) });
    expect(generateContractOfKind("retrieve", ctx(() => 5), sequenceRng(0))).toMatchObject({ targets: 3, reward: Math.round((250 + 3 * 110) * 1.16) });
    // The template's limit of 4 caps the crew from level 10 on.
    expect(generateContractOfKind("retrieve", ctx(() => 12), sequenceRng(0))).toMatchObject({ targets: 4, reward: Math.round((250 + 4 * 110) * 1.44) });
    expect(generateContractOfKind("retrieve", ctx(() => 20), sequenceRng(0))).toMatchObject({ targets: 4, reward: Math.round((250 + 4 * 110) * 1.76) });
    expect(generateContractOfKind("infiltrate", ctx(() => 25), sequenceRng(0.99)).targets).toBe(5);
  });

  it("asks the level of the site it picked", () => {
    const asked: ContractSiteId[] = [];
    const c = generateContract(EMPTY_CONTRACTS, sequenceRng(0.99, 0), 0, (site) => {
      asked.push(site);
      return 30;
    });
    expect(asked).toEqual(["kanal_bridge"]);
    expect(c).toMatchObject({ siteId: "kanal_bridge", targets: 4, reward: Math.round((250 + 4 * 125) * 2.16) });
  });

  it("a delivery pays by the level the sim gives it for its kind, asked for Hana's stall", () => {
    const asked: string[] = [];
    const at = (level: number) =>
      generateContractOfKind(
        "delivery",
        ctx((site, kind) => {
          asked.push(`${kind}@${site}`);
          return level;
        }),
        sequenceRng(0),
      ).reward;
    expect(at(1)).toBe(400);
    expect(at(10)).toBe(544);
    expect(asked).toEqual(["delivery@hana_stall", "delivery@hana_stall"]);
  });

  it("its XP grows with its level as the cost of a level does, from level 6 on (stage 8, round 3)", () => {
    expect(contractXp("eliminate", 3, 6)).toBe(860);
    expect(contractXp("eliminate", 3)).toBe(860);
    expect(contractXp("eliminate", 3, 11)).toBe(Math.round(860 * (11 / 6) ** 1.6));
    // From level 6 about half a level: 860 of 1753 at 6, 2607 of 5330 at 12.
    expect(contractXp("eliminate", 3, 12) / xpToNext(12)).toBeCloseTo(contractXp("eliminate", 3, 6) / xpToNext(6), 2);
    expect(undetectedXp(6)).toBe(150);
    expect(undetectedXp()).toBe(150);
    expect(undetectedXp(12)).toBe(455);
  });
});
