import { describe, expect, it } from "vitest";
import {
  BASE_RAM,
  CONTRACT_BONUS,
  CONTRACT_KIND_IDS,
  CONTRACT_PAR_SECONDS,
  HEAT_REPORT_COOLDOWN,
  HEAT_SEARCH_SECONDS,
  NO_HEAT,
  QUICKHACKS,
  RAM_REGEN_PER_SECOND,
  contractRank,
  debriefOf,
  earnedBadges,
  freshTally,
  hackCost,
  hackInSlot,
  hacksFor,
  heatContact,
  heatLost,
  regenRam,
  refundOf,
  reportCrime,
  styleBonusOf,
  tickHeat,
} from "../src";

const at = { x: 1, y: 0, z: 2 };

describe("heat rules (ADR-0029)", () => {
  it("a report brings the heat up to the crime's level and starts a fresh contact", () => {
    const h = reportCrime(NO_HEAT, "gunfire", "hebi", at);
    expect(h).toEqual({ level: 1, faction: "hebi", searching: false, lastKnown: at, searchLeft: HEAT_SEARCH_SECONDS[1], cooldown: HEAT_REPORT_COOLDOWN });
    expect(reportCrime(NO_HEAT, "murder", "tessen", at).level).toBe(2);
  });

  it("a second report escalates only after the cooldown, and never past 3", () => {
    let h = reportCrime(NO_HEAT, "gunfire", "hebi", at);
    expect(reportCrime(h, "gunfire", "tessen", at).level).toBe(1);
    h = tickHeat(h, HEAT_REPORT_COOLDOWN);
    h = reportCrime(h, "gunfire", "tessen", at);
    expect(h.level).toBe(2);
    // The first faction keeps the pursuit.
    expect(h.faction).toBe("hebi");
    for (let i = 0; i < 4; i++) h = reportCrime(tickHeat(h, HEAT_REPORT_COOLDOWN), "murder", "hebi", at);
    expect(h.level).toBe(3);
  });

  it("losing contact runs the search down one level at a time, contact resets it", () => {
    let h = heatLost(reportCrime(NO_HEAT, "murder", "hebi", at));
    expect(h.searching).toBe(true);
    h = tickHeat(h, HEAT_SEARCH_SECONDS[2] - 1);
    expect(h.level).toBe(2);
    h = heatContact(h, { x: 5, y: 0, z: 5 });
    expect(h).toMatchObject({ searching: false, searchLeft: HEAT_SEARCH_SECONDS[2], lastKnown: { x: 5, y: 0, z: 5 } });
    h = tickHeat(heatLost(h), HEAT_SEARCH_SECONDS[2]);
    expect(h).toMatchObject({ level: 1, searching: true, searchLeft: HEAT_SEARCH_SECONDS[1] });
    expect(tickHeat(h, HEAT_SEARCH_SECONDS[1])).toEqual(NO_HEAT);
    // Nothing happens to no heat.
    expect(tickHeat(NO_HEAT, 5)).toBe(NO_HEAT);
    expect(heatContact(NO_HEAT, at)).toBe(NO_HEAT);
    expect(heatLost(NO_HEAT)).toBe(NO_HEAT);
  });
});

describe("cyberdeck rules (ADR-0029)", () => {
  it("lists hacks per target in QUICKHACK_IDS order", () => {
    expect(hacksFor("person")).toEqual(["ping", "reboot_optics", "cripple_movement", "short_circuit"]);
    expect(hacksFor("camera")).toEqual(["ping", "reboot_optics"]);
    expect(hacksFor("device")).toEqual(["ping", "distract", "short_circuit"]);
    expect(hackInSlot("device", 2)).toBe("distract");
    expect(hackInSlot("camera", 3)).toBeNull();
  });

  it("costs, ICEpick, refund and regeneration", () => {
    expect(hackCost("short_circuit", false)).toBe(QUICKHACKS.short_circuit.ram);
    expect(hackCost("short_circuit", true)).toBe(QUICKHACKS.short_circuit.ram - 1);
    expect(hackCost("ping", true)).toBe(1);
    expect(refundOf({ hackId: "ping", target: "x", left: 0.2, ram: 3 })).toBe(1.5);
    expect(regenRam(2, BASE_RAM, 2)).toBe(2 + 2 * RAM_REGEN_PER_SECOND);
    expect(regenRam(7.9, BASE_RAM, 10)).toBe(BASE_RAM);
  });

  it("the full deck pays for a covert opening and one combat hack, not for everything", () => {
    expect(QUICKHACKS.ping.ram + QUICKHACKS.distract.ram + QUICKHACKS.reboot_optics.ram).toBeLessThanOrEqual(BASE_RAM);
    expect(QUICKHACKS.short_circuit.ram + QUICKHACKS.cripple_movement.ram).toBeLessThanOrEqual(BASE_RAM + 1);
    expect(Object.values(QUICKHACKS).reduce((s, h) => s + h.ram, 0)).toBeGreaterThan(BASE_RAM);
    // An empty deck is full again in well under a minute.
    expect(BASE_RAM / RAM_REGEN_PER_SECOND).toBeLessThan(30);
  });
});

describe("contract scoring (ADR-0028 ranks, ADR-0029 numbers)", () => {
  const clean = freshTally(0);

  it("every template has a bonus condition and a par time", () => {
    for (const kind of CONTRACT_KIND_IDS) {
      expect(CONTRACT_BONUS[kind].bonus).toBeGreaterThan(0);
      expect(CONTRACT_BONUS[kind].label.length).toBeGreaterThan(0);
      expect(CONTRACT_PAR_SECONDS[kind]).toBeGreaterThan(0);
    }
  });

  it("badges follow the counters", () => {
    expect(earnedBadges(clean, 10, "eliminate")).toEqual(["ghost", "no_alarm", "clean", "untouched", "swift"]);
    const messy = { ...clean, detected: true, alarm: true, extraKills: 2, damaged: true, hacked: true };
    expect(earnedBadges(messy, 999, "eliminate")).toEqual(["netrunner"]);
  });

  it("ranks: S needs 4 badges and the bonus, A three, B one or two, C none", () => {
    expect(contractRank(["ghost", "no_alarm", "clean", "untouched"], true)).toBe("S");
    expect(contractRank(["ghost", "no_alarm", "clean", "untouched"], false)).toBe("A");
    expect(contractRank(["ghost", "no_alarm", "clean"], true)).toBe("A");
    expect(contractRank(["ghost", "clean"], true)).toBe("B");
    expect(contractRank(["netrunner"], false)).toBe("B");
    expect(contractRank([], false)).toBe("C");
  });

  it("the style bonus pays the giver's badges; the debrief adds the condition", () => {
    // Kaito likes speed and no scratches.
    expect(styleBonusOf("eliminate", ["swift", "untouched", "ghost"], 500)).toBe(60);
    expect(styleBonusOf("hack", ["swift", "untouched"], 500)).toBe(0);
    const d = debriefOf("eliminate", { ...clean, clearedTick: 60 * 30 }, 500, 60 * 200, 60);
    expect(d).toEqual({ badges: ["ghost", "no_alarm", "clean", "untouched", "swift"], rank: "S", bonus: CONTRACT_BONUS.eliminate.bonus, styleBonus: 60, seconds: 30 });
    const slow = debriefOf("eliminate", { ...clean, extraKills: 1 }, 500, 60 * 200, 60);
    expect(slow).toMatchObject({ badges: ["ghost", "no_alarm", "untouched"], rank: "A", bonus: 0, styleBonus: 30, seconds: 200 });
  });
});
