import { describe, expect, it } from "vitest";
import {
  CONTRACT_BONUS,
  type Contract,
  EMPTY_CONTRACTS,
  SABOTAGE,
  SABOTAGE_LOUD,
  SECONDS_PER_DAY,
  SECONDS_PER_HOUR,
  TESSEN_HUNT,
  armouryLootValue,
  blastDamageAt,
  chargesLeft,
  contractObjective,
  contractSecondsLeft,
  createReputation,
  generateContractOfKind,
  loudTessenDelta,
  sabotagePay,
  styleBonusOf,
  tessenHuntActive,
  tessenHuntFlag,
  tessenHuntRollFlag,
  tessenHuntUntil,
  tessenSquadSize,
} from "../src";
import { sequenceRng } from "./helpers";

/** W-3's loud way (ADR-0082 §1 "Droga głośna", stage 3b), the pure rules of core. */
const TPS = 60;
const at = (hour: number, day = 3) => ({ seconds: day * SECONDS_PER_DAY + hour * SECONDS_PER_HOUR });
const ctx = { log: EMPTY_CONTRACTS, reputation: createReputation(), flags: [], tick: 1000, ticksPerSecond: TPS, clock: at(21) };
const job = (): Contract => generateContractOfKind("sabotage", ctx, sequenceRng(0));

describe("the loud way of W-3's sabotage (ADR-0082 stage 3b)", () => {
  it("the income per minute of the loud way, some 8 minutes, the armoury's loot sold with it, stays in the band of ADR-0018 and ADR-0024 (215–235 €$)", () => {
    const loud: Contract = { ...job(), route: "loud" };
    const pay = sabotagePay(loud);
    expect(pay).toBe(SABOTAGE_LOUD.loudReward);
    // The chest of armoury S (the user's decision of 16.11: its loot counts): the AR-5 and a medkit sold.
    const loot = armouryLootValue();
    expect(loot).toBe(472);
    // The loud way can keep "clean" (the waves are the job's targets), never "ghost": the charges always raise the alarm.
    for (const badges of [["clean"], ["ghost", "clean"]] as const) {
      const perMinute = (pay + loot + CONTRACT_BONUS.sabotage.bonus + styleBonusOf("sabotage", badges, pay)) / 8;
      expect(perMinute).toBeGreaterThanOrEqual(215);
      expect(perMinute).toBeLessThanOrEqual(235);
    }
    // After the switch from the quiet way the loud rate holds, whatever was uploaded or seen.
    expect(sabotagePay({ ...loud, progress: 20 * TPS, seenLeaving: true })).toBe(pay);
    expect(pay).toBeLessThan(SABOTAGE.quietReward);
  });

  it("the steps: the server room cut off, the charges planted so many of three, the fuse's clock, away after the blast", () => {
    const cut: Contract = { ...job(), route: "loud", progress: 10 * TPS };
    expect(contractObjective(cut, contractSecondsLeft(cut, 1000, TPS)).key).toBe("contract.objective.sabotageCutOffTimed");
    // The loud way shows the clock to the pickup, not the upload's.
    expect(contractSecondsLeft(cut, 1000, TPS)).toBe(9 * 60);
    const two: Contract = { ...cut, charges: ["S1", "S3"] };
    expect(chargesLeft(two)).toBe(1);
    expect(contractObjective(two, 60).params).toMatchObject({ planted: 2, needed: 3 });
    const fuse: Contract = { ...two, charges: ["S1", "S3", "S4"], fuseTick: 1000 + 42 * TPS };
    expect(contractSecondsLeft(fuse, 1000, TPS)).toBe(42);
    expect(contractObjective(fuse, 42)).toMatchObject({ key: "contract.objective.sabotageFuse", params: { time: "0:42" } });
    const done: Contract = { ...fuse, detonated: true };
    expect(contractSecondsLeft(done, 1000, TPS)).toBeNull();
    expect(contractObjective(done, null).key).toBe("contract.objective.sabotageEscape");
  });

  it("the blast falls off from 60 at the charge to nothing at 10 m", () => {
    expect(blastDamageAt(0)).toBe(60);
    expect(blastDamageAt(5)).toBe(30);
    expect(blastDamageAt(9.9)).toBe(1);
    expect(blastDamageAt(10)).toBe(0);
    expect(blastDamageAt(25)).toBe(0);
  });

  it("Tessen goes down to -60 and never up", () => {
    expect(loudTessenDelta(0)).toBe(-60);
    expect(loudTessenDelta(-20)).toBe(-40);
    expect(loudTessenDelta(-80)).toBe(0);
  });

  it("the hunt runs three game days, rolls once per district and 6-hour stretch, a squad of 2 or 3", () => {
    const flags = [tessenHuntFlag(3 + TESSEN_HUNT.days)];
    expect(tessenHuntUntil(flags)).toBe(6);
    expect(tessenHuntActive(flags, at(23, 5))).toBe(true);
    expect(tessenHuntActive(flags, at(0, 6))).toBe(false);
    expect(tessenHuntActive([], at(12))).toBe(false);
    expect(tessenHuntRollFlag("stare-miasto", at(7))).toBe(tessenHuntRollFlag("stare-miasto", at(11.9)));
    expect(tessenHuntRollFlag("stare-miasto", at(12))).not.toBe(tessenHuntRollFlag("stare-miasto", at(11.9)));
    expect(tessenHuntRollFlag("krakowskie", at(7))).not.toBe(tessenHuntRollFlag("stare-miasto", at(7)));
    expect([0, 0.49, 0.5, 0.99].map(tessenSquadSize)).toEqual([2, 2, 3, 3]);
  });
});
