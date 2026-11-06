import { describe, expect, it } from "vitest";
import {
  CYBERWARE_CATALOG,
  LOOT_TABLES,
  NO_DECK,
  type Rarity,
  STYLE_LOOT_BONUS,
  type StyleKind,
  addInstance,
  buyCyberware,
  createCharacter,
  createDomainState,
  deckStats,
  findItem,
  fitImplant,
  hasItemLevel,
  implantOffer,
  installCyberwareItem,
  installFee,
  isPreciousGrade,
  itemIcon,
  lootStyleOf,
  removeCyberware,
  rollGrade,
  shopTerms,
  starterKit,
  styledEntries,
  takeOutImplant,
  usedCells,
  workingDeck,
} from "../src";

const DECK = "kumo_cyberdeck" as const;
const NEUTRAL = shopTerms(0);
const FRIENDLY = shopTerms(30);
const TRUSTED = shopTerms(80);

describe("the cyberdeck implant (decision of 6.11 after ADR-0059 stage 6)", () => {
  it("is a nervous implant with a tier and a level, an icon and no traits", () => {
    expect(CYBERWARE_CATALOG[DECK]).toMatchObject({ slot: "nervous", capacity: 4, price: 800 });
    expect(itemIcon(DECK)).toBe("deck");
    expect(hasItemLevel(DECK)).toBe(true);
    expect(hasItemLevel("synapse_booster")).toBe(false);
    // A legendary deck rolls a level but no traits: the trait tables are for weapons and garments.
    expect(rollGrade(DECK, "roll", 12, 0.999, 0.1, 0.9)).toEqual({ rarity: "legendary", level: 12 });
  });

  it("adds RAM, takes a share off the upload and speeds the RAM recovery, more with tier and level", () => {
    expect(deckStats(DECK, { rarity: "common", level: 1 })).toEqual({ ram: 2, uploadScale: 0.92, regenScale: 1.1 });
    expect(deckStats(DECK, { rarity: "rare", level: 10 })).toEqual({ ram: 3, uploadScale: 0.874, regenScale: 1.158 });
    expect(deckStats(DECK, { rarity: "rare", level: 15 })).toEqual({ ram: 4, uploadScale: 0.855, regenScale: 1.181 });
    expect(deckStats(DECK, { rarity: "legendary", level: 30 })).toEqual({ ram: 6, uploadScale: 0.772, regenScale: 1.285 });
    const tiers: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];
    for (const level of [1, 10, 20, 30]) {
      const stats = tiers.map((rarity) => deckStats(DECK, { rarity, level }));
      for (let i = 1; i < stats.length; i++) {
        expect(stats[i]!.ram).toBeGreaterThanOrEqual(stats[i - 1]!.ram);
        expect(stats[i]!.uploadScale).toBeLessThan(stats[i - 1]!.uploadScale);
        expect(stats[i]!.regenScale).toBeGreaterThan(stats[i - 1]!.regenScale);
      }
    }
    // Other implants are no deck; a level out of range is clamped.
    expect(deckStats("synapse_booster")).toBe(NO_DECK);
    expect(deckStats(DECK, { rarity: "common", level: 99 })).toEqual(deckStats(DECK, { rarity: "common", level: 30 }));
  });

  it("keeps its grade while installed, and gives it back when it comes out or is replaced", () => {
    const grade = { rarity: "epic" as const, level: 9 };
    const fitted = fitImplant(createCharacter(), DECK, grade);
    expect(fitted.character.cyberware.nervous).toBe(DECK);
    expect(fitted.character.implantGrades).toEqual({ nervous: grade });
    const swapped = fitImplant(fitted.character, "synapse_booster");
    expect(swapped).toMatchObject({ replaced: DECK, replacedGrade: grade });
    expect(swapped.character.implantGrades).toBeUndefined();
    const out = takeOutImplant(fitted.character, "nervous");
    expect(out.grade).toEqual(grade);
    expect(out.character).toEqual(createCharacter());
  });

  it("works from the domain only while installed: RAM and the upload of the working deck", () => {
    const d = createDomainState();
    expect(workingDeck(d)).toBe(NO_DECK);
    const character = fitImplant(d.character, DECK, { rarity: "rare", level: 10 }).character;
    expect(workingDeck({ ...d, character })).toEqual(deckStats(DECK, { rarity: "rare", level: 10 }));
    // An old save's deck without a grade counts as common level 1.
    expect(workingDeck({ ...d, character: { ...d.character, cyberware: { ...d.character.cyberware, nervous: DECK } } })).toEqual(deckStats(DECK));
  });
});

describe("the cyberdeck at Mori's clinic", () => {
  it("comes at the player's level, a tier better with each step of standing, never past rare", () => {
    expect(implantOffer(DECK, "neutral", 1)).toEqual({ grade: { rarity: "common", level: 1 }, listPrice: 800 });
    expect(implantOffer(DECK, "friendly", 1)).toEqual({ grade: { rarity: "uncommon", level: 1 }, listPrice: 1280 });
    expect(implantOffer(DECK, "trusted", 10)).toEqual({ grade: { rarity: "rare", level: 10 }, listPrice: 2829 });
    expect(implantOffer(DECK, "wary", 5).grade?.rarity).toBe("common");
    // The other implants keep their catalog price and have no grade.
    expect(implantOffer("synapse_booster", "trusted", 20)).toEqual({ listPrice: 900 });
  });

  it("installs the offered grade for the offered price after terms, and swaps a deck of another grade", () => {
    const bought = buyCyberware({ eddies: 5000 }, createCharacter(), DECK, FRIENDLY, Infinity, 4);
    if (!bought.ok) throw new Error(bought.reason);
    const list = implantOffer(DECK, "friendly", 4).listPrice;
    expect(bought.price).toBe(Math.round(list * 0.9));
    expect(bought.wallet.eddies).toBe(5000 - bought.price);
    expect(bought.character.implantGrades).toEqual({ nervous: { rarity: "uncommon", level: 4 } });
    // The same grade again is refused; a level later the new one replaces it, the old one with its grade.
    expect(buyCyberware(bought.wallet, bought.character, DECK, FRIENDLY, Infinity, 4)).toEqual({ ok: false, reason: "already-installed" });
    const again = buyCyberware(bought.wallet, bought.character, DECK, TRUSTED, Infinity, 5);
    expect(again).toMatchObject({ ok: true, replaced: DECK, replacedGrade: { rarity: "uncommon", level: 4 } });
    expect(buyCyberware({ eddies: 799 }, createCharacter(), DECK, NEUTRAL)).toEqual({ ok: false, reason: "insufficient-funds" });
  });

  it("fits a looted deck from the bag with its grade for a quarter of its value, and takes it out the same", () => {
    const kit = starterKit();
    const added = addInstance(kit.inventory, kit.equipment, DECK, { rarity: "legendary", level: 12 });
    if (!added.ok) throw new Error("bag full");
    expect(added.item).toMatchObject({ rarity: "legendary", level: 12 });
    const fee = installFee({ def: DECK, rarity: "legendary", level: 12 });
    expect(fee).toBe(Math.round(800 * 6 * 1.44 * 0.25));
    const fitted = installCyberwareItem({ eddies: 5000 }, createCharacter(), added.inventory, kit.equipment, added.item.uid);
    if (!fitted.ok) throw new Error(fitted.reason);
    expect(fitted.fee).toBe(fee);
    expect(fitted.character.implantGrades).toEqual({ nervous: { rarity: "legendary", level: 12 } });
    const out = removeCyberware(fitted.character, fitted.inventory, kit.equipment, "nervous");
    if (!out.ok) throw new Error(out.reason);
    expect(findItem(out.inventory, out.item.uid)).toMatchObject({ def: DECK, rarity: "legendary", level: 12 });
    expect(out.character.implantGrades).toBeUndefined();
  });

  it("refuses a swap from an overfull bag rather than lose the graded deck it replaces", () => {
    const kit = starterKit();
    const added = addInstance(kit.inventory, kit.equipment, DECK, { rarity: "common", level: 1 });
    if (!added.ok) throw new Error("bag full");
    const character = fitImplant(createCharacter(), DECK, { rarity: "legendary", level: 20 }).character;
    // A smaller backpack than what is carried: taking the new deck out still leaves no cell.
    const overfull = { ...added.inventory, capacity: usedCells(added.inventory, kit.equipment) - 1 };
    expect(isPreciousGrade({ rarity: "legendary", level: 20 })).toBe(true);
    expect(isPreciousGrade({ rarity: "common", level: 1 })).toBe(false);
    expect(isPreciousGrade(undefined)).toBe(false);
    expect(installCyberwareItem({ eddies: 5000 }, character, overfull, kit.equipment, added.item.uid)).toEqual({ ok: false, reason: "inventory-full" });
  });
});

describe("the cyberdeck in the hacker's loot", () => {
  const all = (kind: StyleKind): StyleKind[] => Array.from({ length: 50 }, () => kind);
  const weightOf = (entries: ReturnType<typeof styledEntries>) => entries.find((e) => e.item === DECK)?.weight ?? 0;

  it("drops from Tessen's stores, of a rolled tier, with the weight taken from the rifle rounds", () => {
    for (const id of ["tessen_guard", "tessen_sniper"] as const) {
      expect(LOOT_TABLES[id].entries.find((e) => e.item === DECK), id).toMatchObject({ weight: 1, rarity: "roll" });
    }
    expect(LOOT_TABLES.tessen_guard.entries.find((e) => e.item === "556")?.weight).toBe(28);
    expect(LOOT_TABLES.tessen_guard.entries.reduce((s, e) => s + e.weight, 0)).toBe(99);
  });

  it("leans to a hacker by the style's +60% at most, and not to the others", () => {
    expect(lootStyleOf(DECK)).toBe("quickhack");
    const entries = LOOT_TABLES.tessen_guard.entries;
    expect(weightOf(styledEntries(entries, all("quickhack")))).toBeCloseTo(1 + STYLE_LOOT_BONUS, 9);
    expect(weightOf(styledEntries(entries, all("smg")))).toBe(1);
    expect(weightOf(styledEntries(entries, [...all("quickhack").slice(0, 25), ...all("stealth").slice(0, 25)]))).toBeCloseTo(1.3, 9);
  });
});
