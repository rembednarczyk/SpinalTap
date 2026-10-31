import { describe, expect, it } from "vitest";
import {
  CONTRACT_SITES,
  type ContractContext,
  DOCKS_CONTRACT_KINDS,
  EMPTY_CONTRACTS,
  ENEMY_TYPES,
  HACK_SECONDS,
  LOOT_TABLES,
  contractAlarmFlag,
  contractEscortKey,
  contractFailureNote,
  contractGiver,
  contractObjective,
  contractSecondsLeft,
  contractTerminalKey,
  createReputation,
  generateContractOfKind,
  npcWeapon,
  outfitDefense,
  reputationEffects,
  rollLoot,
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

describe("docks contracts (ADR-0024)", () => {
  it("Genzō gives all three; fixer standing scales them", () => {
    for (const kind of DOCKS_CONTRACT_KINDS) {
      const c = generateContractOfKind(kind, ctx(), sequenceRng(0));
      expect(contractGiver(c).name).toBe("Genzō");
      expect(c.kind).toBe(kind);
    }
    const liked = generateContractOfKind("hack", ctx({ reputation: { ...createReputation(), fixers: 40 } }), sequenceRng(0));
    expect(liked.reward).toBe(Math.round(700 * 1.2));
  });

  it("sites, sizes and growth with experience", () => {
    expect(generateContractOfKind("escort", ctx(), sequenceRng(0))).toMatchObject({ siteId: "docks_escort", targets: 2, reward: 580, status: "active" });
    expect(generateContractOfKind("infiltrate", ctx(), sequenceRng(0.99))).toMatchObject({ siteId: "tessen_office", targets: 4, reward: 700 });
    expect(generateContractOfKind("hack", ctx(), sequenceRng(0))).toMatchObject({ siteId: "quay_terminal", targets: 3 });
    const veteran = ctx({ log: { active: null, completed: 12 } });
    expect(generateContractOfKind("escort", veteran, sequenceRng(0.99)).targets).toBe(4);
    expect(generateContractOfKind("infiltrate", veteran, sequenceRng(0.99)).targets).toBe(5);
    expect(generateContractOfKind("hack", veteran, sequenceRng(0.99)).targets).toBe(5);
  });

  it("keys and flags of the docks jobs", () => {
    expect(contractEscortKey("c4")).toBe("c4-escort");
    expect(contractTerminalKey("c4")).toBe("c4-terminal");
    expect(contractAlarmFlag("c4")).toBe("alarm:c4");
  });

  it("a hack shows its own clock once it runs", () => {
    const hack = generateContractOfKind("hack", ctx(), sequenceRng(0));
    expect(contractSecondsLeft(hack, 0, 60)).toBeNull();
    expect(contractObjective(hack)).toEqual({ key: "contract.objective.hack", params: { seconds: HACK_SECONDS, site: { key: CONTRACT_SITES.quay_terminal.text } } });
    const running = { ...hack, progress: 15 * 60 };
    expect(contractSecondsLeft(running, 0, 60)).toBe(HACK_SECONDS - 15);
    expect(contractObjective(running, contractSecondsLeft(running, 0, 60))).toEqual({
      key: "contract.objective.hackHoldingTimed",
      params: { site: { key: "contract.site.quay_terminal" }, time: "0:25" },
    });
    expect(contractSecondsLeft({ ...hack, progress: HACK_SECONDS * 60 + 5 }, 0, 60)).toBe(0);
  });

  it("describes every stage and every failure", () => {
    const [escort, infiltrate] = DOCKS_CONTRACT_KINDS.map((k) => generateContractOfKind(k, ctx(), sequenceRng(0)));
    expect(contractObjective(escort!).key).toBe("contract.objective.escort");
    expect(contractObjective(infiltrate!).key).toBe("contract.objective.infiltrate");
    expect(contractObjective({ ...escort!, status: "cleared" })).toEqual({
      key: "contract.objective.cleared",
      params: { note: { key: "contract.cleared.escort" }, giver: { key: "contract.giver.genzo" } },
    });
    expect(contractFailureNote("escort-killed")).toBe("contract.failure.escort-killed");
    expect(contractFailureNote("detected")).toBe("contract.failure.detected");
    expect(contractFailureNote("connection-lost")).toBe("contract.failure.connection-lost");
  });

  it("reputation: Tessen notices, the fixers care about Genzō's name", () => {
    expect(reputationEffects({ type: "contract-completed", kind: "hack" })).toEqual([
      { faction: "fixers", delta: 2 },
      { faction: "tessen", delta: -5 },
    ]);
    expect(reputationEffects({ type: "contract-failed", kind: "infiltrate" })).toEqual([
      { faction: "fixers", delta: -3 },
      { faction: "tessen", delta: -5 },
    ]);
    expect(reputationEffects({ type: "contract-failed", kind: "escort" })).toEqual([
      { faction: "civilians", delta: -3 },
      { faction: "fixers", delta: -2 },
    ]);
    // A dead corporate guard is not a dead neighbour.
    expect(reputationEffects({ type: "member-killed", faction: "tessen" })).toEqual([{ faction: "tessen", delta: -4 }]);
  });
});

describe("Tessen enemies (ADR-0024)", () => {
  it("the guard's vest shrugs off an SMG on the torso but not a shot to the face", () => {
    const guard = outfitDefense(ENEMY_TYPES.tessen_guard.outfit);
    expect(guard.zoneArmor).toMatchObject({ torso: 6, arm: 3, head: 3, leg: 3 });
    const hebi = outfitDefense(ENEMY_TYPES.hebi_ganger.outfit);
    expect(guard.zoneArmor!.torso!).toBeGreaterThan(hebi.zoneArmor!.torso!);
  });

  it("the sniper hits hard from far away, slowly; the guard fires bursts at street range", () => {
    const dmr = npcWeapon(ENEMY_TYPES.tessen_sniper.weapon);
    const ar = npcWeapon(ENEMY_TYPES.tessen_guard.weapon);
    expect(dmr.range).toBeGreaterThanOrEqual(75);
    expect(dmr.damage).toBeGreaterThan(ar.damage * 2.5);
    expect(dmr.interval).toBeGreaterThan(2);
    expect(ar.range).toBe(30);
  });

  it("bags roll from their own tables", () => {
    const lines = rollLoot(LOOT_TABLES.tessen_sniper, sequenceRng(0.5, 0.5, 0.5, 0.5, 0.5, 0.5));
    expect(lines[0]).toMatchObject({ kind: "eddies" });
    expect(lines[1]).toMatchObject({ kind: "ammo", ammo: "556" });
    expect(lines).toHaveLength(3);
  });
});
