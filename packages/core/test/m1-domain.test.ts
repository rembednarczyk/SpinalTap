import { describe, expect, it } from "vitest";
import {
  ABILITY_CATALOG,
  CONTRACT_SITE_IDS,
  CYBERWARE_CATALOG,
  EMPTY_EQUIPMENT,
  EMPTY_INVENTORY,
  EMPTY_CONTRACTS,
  IDLE_ABILITY,
  activate,
  buyCyberware,
  buyItem,
  contractObjective,
  contractTag,
  createCharacter,
  enemyTimeScale,
  generateContract,
  isContractSiteId,
  loadoutAbility,
  tickAbility,
} from "../src";
import { sequenceRng } from "./helpers";

describe("ripperdoc", () => {
  it("charges and installs, replacing the implant in the same slot", () => {
    const c = createCharacter();
    const r = buyCyberware({ eddies: 2000 }, { ...c, cyberware: { ...c.cyberware, nervous: "synapse_booster" } }, "kairos_overclock");
    expect(r).toMatchObject({ ok: true, wallet: { eddies: 900 }, replaced: "synapse_booster", price: 1100 });
    if (r.ok) expect(r.character.cyberware.nervous).toBe("kairos_overclock");
  });

  it("refuses a duplicate install and an empty wallet", () => {
    const c = createCharacter();
    expect(buyCyberware({ eddies: 9999 }, c, "hitomi_optics_mk1")).toEqual({ ok: false, reason: "already-installed" });
    expect(buyCyberware({ eddies: 10 }, c, "subdermal_weave")).toEqual({ ok: false, reason: "insufficient-funds" });
  });

  it("installs free implants without charging", () => {
    const c = { ...createCharacter(), cyberware: {} };
    expect(buyCyberware({ eddies: 0 }, c, "hitomi_optics_mk1")).toMatchObject({ ok: true, wallet: { eddies: 0 } });
  });

  it("sells medkits while there is room and money", () => {
    const eq = EMPTY_EQUIPMENT;
    expect(buyItem({ eddies: 100 }, EMPTY_INVENTORY, eq, "medkit")).toMatchObject({ ok: true, wallet: { eddies: 10 }, inventory: { stacks: { medkit: 1 } }, price: 90 });
    expect(buyItem({ eddies: 10 }, EMPTY_INVENTORY, eq, "medkit")).toEqual({ ok: false, reason: "insufficient-funds" });
    const full = { ...EMPTY_INVENTORY, capacity: 1, stacks: { medkit: 9 } };
    expect(buyItem({ eddies: 1000 }, full, eq, "medkit")).toEqual({ ok: false, reason: "inventory-full" });
    expect(buyItem({ eddies: 1000 }, full, eq, "bandage")).toEqual({ ok: false, reason: "inventory-full" });
  });

  it("every implant has a description and a non-negative price", () => {
    for (const def of Object.values(CYBERWARE_CATALOG)) {
      expect(def.description.length).toBeGreaterThan(10);
      expect(def.price).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("abilities", () => {
  const def = ABILITY_CATALOG.reflex_overdrive;

  it("is granted by the Kairos implant only", () => {
    expect(loadoutAbility({ nervous: "kairos_overclock" })).toBe("reflex_overdrive");
    expect(loadoutAbility({ optics: "hitomi_optics_mk1" })).toBeNull();
  });

  it("activates, slows enemies, expires and cools down", () => {
    const on = activate(IDLE_ABILITY, def);
    expect(on).toEqual({ activeTime: def.duration, cooldown: def.cooldown });
    expect(enemyTimeScale(on!, def)).toBe(def.enemyTimeScale);
    expect(activate(on!, def)).toBeNull();
    const later = tickAbility(on!, def.duration);
    expect(enemyTimeScale(later, def)).toBe(1);
    expect(activate(later, def)).toBeNull();
    expect(activate(tickAbility(later, def.cooldown), def)).not.toBeNull();
    expect(tickAbility(IDLE_ABILITY, 1)).toBe(IDLE_ABILITY);
    expect(enemyTimeScale(on!, null)).toBe(1);
  });
});

describe("contracts", () => {
  it("generates a contract from two random numbers", () => {
    const c = generateContract(EMPTY_CONTRACTS, sequenceRng(0, 0.99), 0);
    expect(c).toEqual({ id: "c1", siteId: CONTRACT_SITE_IDS[0], targets: 3, reward: 625, status: "active" });
    expect(isContractSiteId(c.siteId)).toBe(true);
    expect(isContractSiteId("moon")).toBe(false);
  });

  it("grows with experience and caps at four targets", () => {
    const c = generateContract({ active: null, completed: 9 }, sequenceRng(0.99, 0.99), 100);
    expect(c.id).toBe("c10");
    expect(c.siteId).toBe(CONTRACT_SITE_IDS.at(-1));
    expect(c.targets).toBe(4);
    expect(c.reward).toBe(1125);
  });

  it("describes the objective for both states", () => {
    const c = generateContract(EMPTY_CONTRACTS, sequenceRng(0, 0), 0);
    expect(contractObjective(c)).toContain("(2)");
    expect(contractObjective({ ...c, status: "cleared" })).toContain("Wróć do Kaito");
    expect(contractTag("c3")).toBe("contract:c3");
  });
});
