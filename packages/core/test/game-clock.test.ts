import { describe, expect, it } from "vitest";
import {
  SECONDS_PER_DAY,
  START_CLOCK,
  advanceClock,
  createDomainState,
  dayOf,
  dayPhase,
  daylight,
  formatClock,
  hm,
  hourOf,
  inHours,
  minuteOfDay,
  secondsSince,
} from "../src";

const at = (h: number, m = 0, day = 1) => ({ seconds: (day - 1) * SECONDS_PER_DAY + h * 3600 + m * 60 });

describe("game clock", () => {
  it("a new game starts at 21:00 of day 1", () => {
    expect(createDomainState().clock).toEqual(START_CLOCK);
    expect(formatClock(START_CLOCK)).toBe("21:00");
    expect(dayOf(START_CLOCK)).toBe(1);
  });

  it("wraps past midnight into the next day", () => {
    const c = advanceClock(START_CLOCK, 3 * 3600 + 5 * 60 + 59);
    expect(formatClock(c)).toBe("00:05");
    expect(hourOf(c)).toBe(0);
    expect(minuteOfDay(c)).toBe(5);
    expect(dayOf(c)).toBe(2);
  });

  it("names the phase of the day", () => {
    expect(dayPhase(at(3))).toBe("night");
    expect(dayPhase(at(6))).toBe("dawn");
    expect(dayPhase(at(12))).toBe("day");
    expect(dayPhase(at(19))).toBe("dusk");
    expect(dayPhase(at(21))).toBe("night");
  });

  it("daylight is exactly 0 all night, 1 by day and eases in between", () => {
    expect(daylight(at(21))).toBe(0);
    expect(daylight(at(4, 59))).toBe(0);
    expect(daylight(at(12))).toBe(1);
    expect(daylight(at(6))).toBeCloseTo(0.5);
    expect(daylight(at(19))).toBeCloseTo(0.5);
    expect(daylight(at(5, 30))).toBeLessThan(daylight(at(6, 30)));
    expect(daylight(at(18, 30))).toBeGreaterThan(daylight(at(19, 30)));
    expect(daylight(at(20))).toBe(0);
  });

  it("measures time since a minute of the day, across midnight", () => {
    expect(secondsSince(at(22, 30), hm(22))).toBe(1800);
    expect(secondsSince(at(1, 0, 2), hm(23))).toBe(7200);
  });

  it("checks hour ranges, also ones that wrap", () => {
    expect(inHours(hm(12), hm(8), hm(22))).toBe(true);
    expect(inHours(hm(22), hm(8), hm(22))).toBe(false);
    expect(inHours(hm(2), hm(22), hm(5))).toBe(true);
    expect(inHours(hm(12), hm(22), hm(5))).toBe(false);
  });
});
