import { describe, expect, it } from "vitest";
import {
  CONTRACT_KIND_IDS,
  GANG_KILL_CEILING,
  type ReputationDelta,
  changeReputation,
  createReputation,
  reputationEffects,
} from "../src";

/** ADR-0070 stage 4: the street's view of dead gangers, reported crimes and finished jobs. */
const civilians = (effects: readonly ReputationDelta[]): number => effects.filter((d) => d.faction === "civilians").reduce((n, d) => n + d.delta, 0);
const hebi = (effects: readonly ReputationDelta[]): number => effects.filter((d) => d.faction === "hebi").reduce((n, d) => n + d.delta, 0);

describe("a dead Hebi ganger and the street (ADR-0070)", () => {
  const neutral = createReputation();

  it("killed in a fight outside jobs: +1 with the street, the gang −4 as before", () => {
    const fx = reputationEffects({ type: "member-killed", faction: "hebi", how: {} }, neutral);
    expect(fx).toEqual([
      { faction: "hebi", delta: -4 },
      { faction: "civilians", delta: 1 },
    ]);
  });

  it("the thanks stop at +25 (the ceiling): higher only jobs and help lead", () => {
    const below = changeReputation(neutral, "civilians", GANG_KILL_CEILING - 1);
    const at = changeReputation(neutral, "civilians", GANG_KILL_CEILING);
    expect(civilians(reputationEffects({ type: "member-killed", faction: "hebi" }, below))).toBe(1);
    expect(reputationEffects({ type: "member-killed", faction: "hebi" }, at)).toEqual([{ faction: "hebi", delta: -4 }]);
  });

  it("nothing for the street from behind, from the heat's people, from a job's crew", () => {
    for (const how of [{ wronged: true }, { security: true }, { crew: true }]) {
      const fx = reputationEffects({ type: "member-killed", faction: "hebi", how }, neutral);
      expect(civilians(fx), JSON.stringify(how)).toBe(0);
      expect(hebi(fx)).toBe(-4);
    }
  });

  it("nothing for the street while the gang is friendly (scores, not the street's defence)", () => {
    const friends = changeReputation(neutral, "hebi", 11);
    expect(civilians(reputationEffects({ type: "member-killed", faction: "hebi" }, friends))).toBe(0);
    // Wary or hostile gang: still the street's defence.
    expect(civilians(reputationEffects({ type: "member-killed", faction: "hebi" }, changeReputation(neutral, "hebi", -60)))).toBe(1);
  });

  it("the other factions as before, whatever the context", () => {
    const how = { wronged: true, crew: true };
    expect(reputationEffects({ type: "member-killed", faction: "civilians", how })).toEqual([{ faction: "civilians", delta: -25 }]);
    expect(reputationEffects({ type: "member-killed", faction: "fixers", how })).toEqual([
      { faction: "fixers", delta: -25 },
      { faction: "civilians", delta: -10 },
    ]);
    expect(reputationEffects({ type: "member-killed", faction: "kagami" })).toEqual([{ faction: "kagami", delta: -6 }]);
    expect(reputationEffects({ type: "member-killed", faction: "tessen" })).toEqual([{ faction: "tessen", delta: -4 }]);
  });
});

describe("witnesses (ADR-0070)", () => {
  it("a reported assault costs the street 1, a murder 2, the rest only the heat", () => {
    expect(reputationEffects({ type: "crime-reported", crime: "assault" })).toEqual([{ faction: "civilians", delta: -1 }]);
    expect(reputationEffects({ type: "crime-reported", crime: "murder" })).toEqual([{ faction: "civilians", delta: -2 }]);
    for (const crime of ["gunfire", "trespass", "hacking"] as const) expect(reputationEffects({ type: "crime-reported", crime })).toEqual([]);
  });
});

describe("the street's balance of finished jobs (ADR-0070)", () => {
  const street = { eliminate: 2, delivery: 1, retrieve: 3, protect: 6, escort: 3, infiltrate: 0, hack: 0 } as const;
  const clean = { eliminate: 4, delivery: 1, retrieve: 5, protect: 6, escort: 3, infiltrate: 0, hack: 0 } as const;

  it("each kind as in the table, a clean job more for elimination and retrieval", () => {
    for (const kind of CONTRACT_KIND_IDS) {
      expect(civilians(reputationEffects({ type: "contract-completed", kind })), kind).toBe(street[kind]);
      expect(civilians(reputationEffects({ type: "contract-completed", kind, clean: true })), kind).toBe(clean[kind]);
    }
  });

  it("the clean bonus changes only the street, in one change", () => {
    const plain = reputationEffects({ type: "contract-completed", kind: "eliminate" });
    const quiet = reputationEffects({ type: "contract-completed", kind: "eliminate", clean: true });
    expect(quiet.map((d) => d.faction)).toEqual(plain.map((d) => d.faction));
    expect(quiet.filter((d) => d.faction !== "civilians")).toEqual(plain.filter((d) => d.faction !== "civilians"));
  });

  it("a shoot-out with two reported assaults leaves an elimination at 0, a quiet one at +4", () => {
    const loud = [
      ...reputationEffects({ type: "contract-completed", kind: "eliminate" }),
      ...reputationEffects({ type: "crime-reported", crime: "assault" }),
      ...reputationEffects({ type: "crime-reported", crime: "assault" }),
    ];
    expect(civilians(loud)).toBe(0);
    expect(civilians(reputationEffects({ type: "contract-completed", kind: "eliminate", clean: true }))).toBe(4);
  });
});
