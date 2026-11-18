import { describe, expect, it } from "vitest";
import {
  CITY_DISTRICT_IDS,
  FACTION_IDS,
  GANG_RULES,
  GRUDGE_STEP,
  NO_GANG_STANDING,
  NO_GANG_STANDINGS,
  SECONDS_PER_DAY,
  SECONDS_PER_HOUR,
  TERRITORIES,
  TERRITORY_IDS,
  createDomainState,
  dawnGrudge,
  dawnsBetween,
  gangProvoked,
  gangStandingKey,
  gangTolerates,
  gangWarning,
  grudgeAfter,
  isTerritoryId,
  provokeGang,
  standingOf,
} from "../src";

const at = (hours: number) => ({ seconds: hours * SECONDS_PER_HOUR });
const free = { hunted: false, disguiseBurned: false };

describe("gang territories (ADR-0091 stage 2)", () => {
  it("lists ten territories, each of a known faction in a district of the city, none on the Nabrzeże", () => {
    expect(TERRITORY_IDS).toHaveLength(10);
    for (const id of TERRITORY_IDS) {
      expect(isTerritoryId(id)).toBe(true);
      expect(FACTION_IDS).toContain(TERRITORIES[id].faction);
      expect(CITY_DISTRICT_IDS).toContain(TERRITORIES[id].district);
      expect(TERRITORIES[id].district).not.toBe("doki");
    }
    expect(isTerritoryId("moon")).toBe(false);
    expect(isTerritoryId("constructor")).toBe(false);
  });

  it("starts a game with every gang calm", () => {
    expect(createDomainState().gangStandings).toEqual(NO_GANG_STANDINGS);
    expect(standingOf(NO_GANG_STANDINGS, "hebi", "kanal")).toEqual(NO_GANG_STANDING);
  });

  it("keeps the grudge per gang and district: a kill on the Rynek is not known on the Podzamcze", () => {
    const s = grudgeAfter(NO_GANG_STANDINGS, "hebi", "kanal", "kill");
    expect(s[gangStandingKey("hebi", "kanal")]).toEqual({ grudge: GRUDGE_STEP.kill, provokedUntil: null });
    expect(standingOf(s, "hebi", "targ")).toEqual(NO_GANG_STANDING);
    // Not tied to Hebi: another faction's standing is its own.
    expect(standingOf(grudgeAfter(s, "tessen", "kanal", "knockout"), "tessen", "kanal").grudge).toBe(GRUDGE_STEP.knockout);
  });

  it("holds the grudge between 0 and 100: helping lowers it, never below calm", () => {
    let s = NO_GANG_STANDINGS;
    for (let i = 0; i < 8; i++) s = grudgeAfter(s, "hebi", "targ", "kill");
    expect(standingOf(s, "hebi", "targ").grudge).toBe(GANG_RULES.maxGrudge);
    s = grudgeAfter(grudgeAfter(NO_GANG_STANDINGS, "hebi", "targ", "foil"), "hebi", "targ", "assist");
    expect(standingOf(s, "hebi", "targ").grudge).toBe(0);
  });

  it("one foiled crime does not start a war, a series does", () => {
    let s = grudgeAfter(NO_GANG_STANDINGS, "hebi", "kanal", "foil");
    expect(gangTolerates(standingOf(s, "hebi", "kanal"), at(0), free)).toBe(true);
    for (let i = 1; i < Math.ceil(GANG_RULES.hostileGrudge / GRUDGE_STEP.foil); i++) s = grudgeAfter(s, "hebi", "kanal", "foil");
    expect(gangTolerates(standingOf(s, "hebi", "kanal"), at(0), free)).toBe(false);
  });

  it("a provocation holds six game hours and adds to the grudge", () => {
    const s = standingOf(provokeGang(NO_GANG_STANDINGS, "hebi", "kanal", at(10)), "hebi", "kanal");
    expect(s).toEqual({ grudge: GRUDGE_STEP.provoke, provokedUntil: (10 + GANG_RULES.provokedHours) * SECONDS_PER_HOUR });
    expect(gangProvoked(s, at(15.9))).toBe(true);
    expect(gangTolerates(s, at(15.9), free)).toBe(false);
    expect(gangProvoked(s, at(16))).toBe(false);
    expect(gangTolerates(s, at(16), free)).toBe(true);
  });

  it("does not tolerate a player the gang hunts or who wears its burned disguise", () => {
    expect(gangTolerates(NO_GANG_STANDING, at(0), { hunted: true, disguiseBurned: false })).toBe(false);
    expect(gangTolerates(NO_GANG_STANDING, at(0), { hunted: false, disguiseBurned: true })).toBe(false);
    expect(gangTolerates(NO_GANG_STANDING, at(0), free)).toBe(true);
  });

  it("counts the dawns at 05:00 between two moments", () => {
    expect(dawnsBetween(at(21), at(28))).toBe(0);
    expect(dawnsBetween(at(21), at(29))).toBe(1);
    expect(dawnsBetween(at(4), at(5))).toBe(1);
    expect(dawnsBetween(at(5), at(5 + 72))).toBe(3);
    expect(dawnsBetween(at(30), at(20))).toBe(0);
  });

  it("each dawn takes 20 off every grudge and forgets a provocation that ran out; calm entries leave", () => {
    let s = grudgeAfter(grudgeAfter(NO_GANG_STANDINGS, "hebi", "kanal", "kill"), "hebi", "kanal", "kill");
    s = provokeGang(s, "hebi", "targ", at(22));
    const night = dawnGrudge(s, at(22), at(29.5));
    expect(standingOf(night, "hebi", "kanal").grudge).toBe(2 * GRUDGE_STEP.kill - GANG_RULES.dawnRelief);
    // The provocation of 22:00 ran out at 04:00; its grudge of 5 went at the dawn.
    expect(standingOf(night, "hebi", "targ")).toEqual(NO_GANG_STANDING);
    const twoDays = dawnGrudge(s, at(22), { seconds: at(22).seconds + 2 * SECONDS_PER_DAY });
    expect(twoDays).toEqual({});
    // A provocation still running stays through the dawn, with the grudge gone.
    expect(dawnGrudge(provokeGang(NO_GANG_STANDINGS, "hebi", "kanal", at(4)), at(4), at(5.5))).toEqual({ "hebi:kanal": { grudge: 0, provokedUntil: 10 * SECONDS_PER_HOUR } });
    // Without a dawn between, only a provocation that ran out goes.
    expect(dawnGrudge(provokeGang(NO_GANG_STANDINGS, "hebi", "kanal", at(6)), at(6), at(13))).toEqual({ "hebi:kanal": { grudge: GRUDGE_STEP.provoke, provokedUntil: null } });
  });

  it("warns from 8 m with 3 s at a neutral standing, from farther when wary, sooner when hostile", () => {
    expect(gangWarning(0)).toEqual({ range: 8, seconds: 3 });
    expect(gangWarning(30)).toEqual({ range: 8, seconds: 3 });
    expect(gangWarning(-19)).toEqual({ range: 10, seconds: 3 });
    expect(gangWarning(-50)).toEqual({ range: 12, seconds: 2 });
  });
});
