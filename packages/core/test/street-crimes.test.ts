import { describe, expect, it } from "vitest";
import {
  DAILY_FULL_REWARDS,
  LATE_SHARE,
  MICRO_EVENT_REWARD,
  SECONDS_PER_DAY,
  SECONDS_PER_HOUR,
  STREET_CRIME_SLOT_HOURS,
  TESSEN_PAYS_ABOVE,
  advanceStreetCrimes,
  closeStreetCrime,
  createDomainState,
  crimeSlot,
  streetCrimePay,
  streetCrimesAt,
} from "../src";

const at = (hours: number) => ({ seconds: hours * SECONDS_PER_HOUR });

describe("the street's crimes in progress (ADR-0091 stage 5)", () => {
  it("counts boards of 4 game hours, and a new game starts on its clock's", () => {
    expect(STREET_CRIME_SLOT_HOURS).toBe(4);
    expect([crimeSlot(at(0)), crimeSlot(at(3.9)), crimeSlot(at(4)), crimeSlot(at(21))]).toEqual([0, 0, 1, 5]);
    const d = createDomainState();
    expect(d.streetCrimes).toEqual({ slot: crimeSlot(d.clock), done: [], day: 1, paidToday: 0, tracked: null });
  });

  it("forgets a board's crimes and its follow on the next board, the day's count on the next day", () => {
    const log = { ...streetCrimesAt(at(21)), done: ["a"], paidToday: 3, tracked: "a" };
    expect(advanceStreetCrimes(log, at(22))).toBe(log);
    expect(advanceStreetCrimes(log, at(24 + 0.5))).toEqual({ slot: 6, done: [], day: 2, paidToday: 0, tracked: null });
    const morning = { ...streetCrimesAt(at(25)), done: ["b"], paidToday: 2 };
    expect(advanceStreetCrimes(morning, at(28.5))).toEqual({ ...morning, slot: 7, done: [], tracked: null });
    expect(advanceStreetCrimes({ ...morning, day: 1 }, at(25.5))).toEqual({ ...morning, paidToday: 0 });
  });

  it("pays the kind's stake grown with the level, a quarter past the day's 6, nothing while Tessen holds her wanted", () => {
    expect(streetCrimePay("mugging", 1, 0, 0)).toBe(MICRO_EVENT_REWARD.mugging.eddies);
    expect(streetCrimePay("extortion", 11, 0, 0)).toBe(MICRO_EVENT_REWARD.extortion.eddies * 2);
    expect(streetCrimePay("aid", 0, 0, 0)).toBe(MICRO_EVENT_REWARD.aid.eddies);
    expect(streetCrimePay("mugging", 1, DAILY_FULL_REWARDS - 1, 0)).toBe(70);
    expect(streetCrimePay("mugging", 1, DAILY_FULL_REWARDS, 0)).toBe(Math.round(70 * LATE_SHARE));
    expect(streetCrimePay("mugging", 1, 0, TESSEN_PAYS_ABOVE)).toBe(0);
    expect(streetCrimePay("mugging", 1, 0, TESSEN_PAYS_ABOVE + 1)).toBe(70);
  });

  it("closes a crime once, counts it when paid, and drops the follow of it", () => {
    const log = { ...streetCrimesAt(at(0)), tracked: "x" };
    const paid = closeStreetCrime(log, "x", true);
    expect(paid).toEqual({ ...log, done: ["x"], paidToday: 1, tracked: null });
    expect(closeStreetCrime(paid, "x", false)).toEqual(paid);
    expect(closeStreetCrime({ ...log, tracked: "y" }, "x", false).tracked).toBe("y");
    expect(SECONDS_PER_DAY / (STREET_CRIME_SLOT_HOURS * SECONDS_PER_HOUR)).toBe(6);
  });
});
