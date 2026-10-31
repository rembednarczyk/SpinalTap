import { describe, expect, it } from "vitest";
import {
  CONTRACT_KIND_IDS,
  CONTRACT_SITES,
  type ContractContext,
  DELIVERY_LIMITS,
  EMPTY_CONTRACTS,
  contractClearedNote,
  contractFailedFlag,
  contractFailureNote,
  contractGiver,
  contractKind,
  contractObjective,
  contractSecondsLeft,
  createReputation,
  deliveryBase,
  generateContract,
  generateContractOfKind,
  isContractKind,
  reputationEffects,
} from "../src";
import { sequenceRng } from "./helpers";

const ctx = (patch: Partial<ContractContext> = {}): ContractContext => ({
  log: EMPTY_CONTRACTS,
  reputation: createReputation(),
  flags: [],
  tick: 600,
  ticksPerSecond: 60,
  ...patch,
});

/** Counts how many random numbers a generator draws. */
const countingRng = () => {
  let n = 0;
  return { rng: { next: () => (n++, 0.5) }, used: () => n };
};

describe("contract kinds (M4)", () => {
  it("knows its kinds and who hands them out", () => {
    expect(CONTRACT_KIND_IDS).toEqual(["eliminate", "delivery", "retrieve", "protect", "escort", "infiltrate", "hack"]);
    expect(isContractKind("protect")).toBe(true);
    expect(isContractKind("heist")).toBe(false);
    const delivery = generateContractOfKind("delivery", ctx(), sequenceRng(0));
    expect(contractGiver(delivery).name).toBe("Kaito");
    expect(contractGiver(generateContractOfKind("protect", ctx(), sequenceRng(0, 0))).name).toBe("Hana");
  });

  it("treats a contract without a kind (a save from before M4) as an elimination", () => {
    const old = generateContract(EMPTY_CONTRACTS, sequenceRng(0, 0), 0);
    expect(old.kind).toBeUndefined();
    expect(contractKind(old)).toBe("eliminate");
    expect(contractGiver(old).name).toBe("Kaito");
  });

  it("an elimination through the new entry point is the M1 contract", () => {
    const a = generateContract(EMPTY_CONTRACTS, sequenceRng(0.3, 0.7), 20);
    const b = generateContractOfKind("eliminate", ctx({ reputation: { ...createReputation(), fixers: 20 } }), sequenceRng(0.3, 0.7));
    expect(b).toEqual(a);
  });

  it("draws a fixed amount of randomness per kind", () => {
    const draws = Object.fromEntries(
      CONTRACT_KIND_IDS.map((k) => {
        const c = countingRng();
        generateContractOfKind(k, ctx(), c.rng);
        return [k, c.used()];
      }),
    );
    expect(draws).toEqual({ eliminate: 2, delivery: 1, retrieve: 1, protect: 2, escort: 1, infiltrate: 1, hack: 1 });
  });

  it("a delivery runs against the clock: tighter limits pay more", () => {
    const tight = generateContractOfKind("delivery", ctx(), sequenceRng(0));
    const loose = generateContractOfKind("delivery", ctx(), sequenceRng(0.99));
    expect(tight).toEqual({ id: "c1", kind: "delivery", siteId: "hana_stall", targets: 0, reward: 400, status: "active", deadlineTick: 600 + 50 * 60 });
    expect(loose.deadlineTick).toBe(600 + 80 * 60);
    expect(loose.reward).toBe(250);
    expect(DELIVERY_LIMITS.map(deliveryBase)).toEqual([400, 325, 250]);
    expect(contractSecondsLeft(tight, 600, 60)).toBe(50);
    expect(contractSecondsLeft(tight, 600 + 50 * 60 - 1, 60)).toBe(1);
    expect(contractSecondsLeft(tight, 99999, 60)).toBe(0);
    expect(contractSecondsLeft(generateContract(EMPTY_CONTRACTS, sequenceRng(0, 0), 0), 0, 60)).toBeNull();
  });

  it("Hana's jobs scale with the street's standing, Kaito's with the fixers'", () => {
    const street = { ...createReputation(), civilians: 40, fixers: -40 };
    expect(generateContractOfKind("retrieve", ctx(), sequenceRng(0)).reward).toBe(250 + 2 * 110);
    expect(generateContractOfKind("retrieve", ctx({ reputation: street }), sequenceRng(0)).reward).toBe(Math.round(470 * 1.2));
    expect(generateContractOfKind("delivery", ctx({ reputation: street }), sequenceRng(0)).reward).toBe(Math.round(400 * 0.8));
  });

  it("protection waves come from one of two sides and grow with experience", () => {
    const first = generateContractOfKind("protect", ctx(), sequenceRng(0, 0));
    expect(first).toMatchObject({ kind: "protect", siteId: "raid_north", targets: 2, reward: 550 });
    const veteran = generateContractOfKind("protect", ctx({ log: { active: null, completed: 9 } }), sequenceRng(0.99, 0.99));
    expect(veteran).toMatchObject({ siteId: "raid_east", targets: 4, reward: 800 });
  });

  it("never reuses the id of a failed contract", () => {
    const flags = [contractFailedFlag("c3"), contractFailedFlag("c4"), "met_fixer"];
    const c = generateContractOfKind("eliminate", ctx({ log: { active: null, completed: 2 }, flags }), sequenceRng(0, 0));
    expect(c.id).toBe("c5");
  });

  it("describes every stage of every kind", () => {
    const kinds = CONTRACT_KIND_IDS.map((k) => generateContractOfKind(k, ctx(), sequenceRng(0, 0)));
    const [eliminate, delivery, retrieve, protect] = kinds;
    // Keys with parameters (ADR-0056); the sentences are checked in both languages in ui.
    expect(contractObjective(eliminate!)).toEqual({ key: "contract.objective.eliminate", params: { targets: 2, site: { key: "contract.site.east_lot" } } });
    expect(contractObjective(delivery!, 75)).toEqual({ key: "contract.objective.deliveryTimed", params: { site: { key: CONTRACT_SITES.hana_stall.text }, time: "1:15" } });
    expect(contractObjective(delivery!)).toEqual({ key: "contract.objective.delivery", params: { site: { key: CONTRACT_SITES.hana_stall.text } } });
    expect(contractObjective(retrieve!).key).toBe("contract.objective.retrieve");
    expect(contractObjective(protect!).key).toBe("contract.objective.protect");
    expect(contractObjective({ ...retrieve!, status: "cleared" }).params).toEqual({ note: { key: "contract.cleared.retrieve" }, giver: { key: "contract.giver.hana" } });
    expect(new Set(kinds.map(contractClearedNote)).size).toBe(CONTRACT_KIND_IDS.length);
    expect(contractClearedNote(protect!)).toBe("contract.cleared.protect");
    expect(contractFailureNote("timeout")).toBe("contract.failure.timeout");
    expect(contractFailureNote("protectee-killed")).toBe("contract.failure.protectee-killed");
  });
});

describe("contract reputation (M4)", () => {
  it("each kind pleases its own people", () => {
    expect(reputationEffects({ type: "contract-completed" })).toEqual(reputationEffects({ type: "contract-completed", kind: "eliminate" }));
    expect(reputationEffects({ type: "contract-completed", kind: "delivery" })).toEqual([
      { faction: "fixers", delta: 2 },
      { faction: "civilians", delta: 1 },
    ]);
    expect(reputationEffects({ type: "contract-completed", kind: "retrieve" })).toEqual([
      { faction: "civilians", delta: 3 },
      { faction: "hebi", delta: -4 },
      { faction: "fixers", delta: 1 },
    ]);
    expect(reputationEffects({ type: "contract-completed", kind: "protect" })).toEqual([
      { faction: "civilians", delta: 6 },
      { faction: "hebi", delta: -3 },
    ]);
  });

  it("failing costs the giver's people", () => {
    expect(reputationEffects({ type: "contract-failed", kind: "delivery" })).toEqual([{ faction: "fixers", delta: -4 }]);
    expect(reputationEffects({ type: "contract-failed", kind: "protect" })).toEqual([{ faction: "civilians", delta: -5 }]);
    expect(reputationEffects({ type: "contract-failed", kind: "eliminate" })).toEqual([]);
    expect(reputationEffects({ type: "contract-failed", kind: "retrieve" })).toEqual([]);
  });
});
