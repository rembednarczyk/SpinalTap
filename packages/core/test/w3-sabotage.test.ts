import { describe, expect, it } from "vitest";
import {
  CONTRACT_BONUS,
  FIXER_STYLE,
  type Contract,
  EMPTY_CONTRACTS,
  SABOTAGE,
  SECONDS_PER_HOUR,
  contractObjective,
  contractSecondsLeft,
  createReputation,
  generateContractOfKind,
  sabotageDeadlineTick,
  sabotagePay,
  styleBonusOf,
  virusUploaded,
} from "../src";
import { sequenceRng } from "./helpers";

/** W-3's job "Odbiór partii" (ADR-0082 §1 and the balance table), the pure rules of core. */
const TPS = 60;
const at = (hour: number) => ({ seconds: 3 * 86_400 + hour * SECONDS_PER_HOUR });
const ctx = (hour: number) => ({ log: EMPTY_CONTRACTS, reputation: createReputation(), flags: [], tick: 1000, ticksPerSecond: TPS, clock: at(hour) });

describe("the sabotage of W-3 (ADR-0082)", () => {
  it("is Genzō's job in the hall, with no roll, three guards and the unseen pay at neutral standing", () => {
    const rng = sequenceRng(0.9, 0.9);
    const job = generateContractOfKind("sabotage", ctx(21), rng);
    expect(job).toMatchObject({ kind: "sabotage", siteId: "w3_hall", targets: SABOTAGE.crew, reward: SABOTAGE.quietReward, status: "active" });
    // No randomness consumed: the next draw is still the first one.
    expect(rng.next()).toBe(0.9);
  });

  it("the batch ships at the next 06:00 at least six game hours away: 6 to 30 real minutes", () => {
    // From 21:00 it is 9 hours (9 real minutes); from 01:00 only 5, so the next day's (29 h).
    expect((sabotageDeadlineTick(0, at(21), TPS) / TPS) * 60).toBe(9 * SECONDS_PER_HOUR);
    expect((sabotageDeadlineTick(0, at(1), TPS) / TPS) * 60).toBe(29 * SECONDS_PER_HOUR);
    expect((sabotageDeadlineTick(0, at(0), TPS) / TPS) * 60).toBe(6 * SECONDS_PER_HOUR);
    for (let h = 0; h < 24; h += 0.5) {
      const left = sabotageDeadlineTick(5, at(h), TPS) - 5;
      expect(left).toBeGreaterThanOrEqual(6 * TPS * 60);
      expect(left).toBeLessThan(30 * TPS * 60 + 1);
    }
    expect(generateContractOfKind("sabotage", ctx(21), sequenceRng(0)).deadlineTick).toBe(1000 + 9 * 60 * TPS);
  });

  it("the upload lasts 40 s, 25 s with ICEpick, and its clock is the objective's", () => {
    const job = generateContractOfKind("sabotage", ctx(21), sequenceRng(0));
    const started: Contract = { ...job, route: "quiet", progress: 15 * TPS };
    expect(virusUploaded(started, TPS)).toBe(false);
    expect(contractSecondsLeft(started, 0, TPS)).toBe(25);
    expect(contractSecondsLeft({ ...started, breach: ["icepick"] }, 0, TPS)).toBe(10);
    expect(virusUploaded({ ...started, progress: 40 * TPS }, TPS)).toBe(true);
    expect(virusUploaded({ ...started, progress: 25 * TPS, breach: ["icepick"] }, TPS)).toBe(true);
    expect(contractObjective(job, 540).key).toBe("contract.objective.sabotageTimed");
    expect(contractObjective(started, 25).key).toBe("contract.objective.sabotageUploadTimed");
    expect(contractObjective({ ...started, progress: 40 * TPS }, 0).key).toBe("contract.objective.sabotageLeave");
  });

  it("the income per minute of a perfect silent way stays in the band of ADR-0018 and ADR-0024 (215–235 €$)", () => {
    const job = generateContractOfKind("sabotage", ctx(21), sequenceRng(0));
    // Everything a perfect run pays: the reward, the condition's bonus and Genzō's style (both his badges).
    const style = styleBonusOf("sabotage", FIXER_STYLE.genzo, job.reward);
    expect(style).toBeGreaterThan(0);
    const perMinute = (job.reward + CONTRACT_BONUS.sabotage.bonus + style) / 11;
    expect(perMinute).toBeGreaterThanOrEqual(215);
    expect(perMinute).toBeLessThanOrEqual(235);
    expect(sabotagePay({ ...job, seenLeaving: true }) / 11).toBeLessThan(job.reward / 11);
  });

  it("leaving seen pays the seen rate of the table, unseen the agreed reward", () => {
    const job = generateContractOfKind("sabotage", ctx(21), sequenceRng(0));
    expect(sabotagePay(job)).toBe(SABOTAGE.quietReward);
    expect(sabotagePay({ ...job, seenLeaving: true })).toBe(SABOTAGE.seenReward);
  });
});
