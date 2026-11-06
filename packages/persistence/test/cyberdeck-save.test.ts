import { describe, expect, it } from "vitest";
import { SAVE_SCHEMA_VERSION, type SaveSnapshot } from "@seki/core";
import { MIGRATIONS, checksum, decodeSave, findSchemaError } from "../src";
import { snapshot } from "./fixtures";

const wrap = (payload: unknown) => {
  const text = JSON.stringify(payload);
  return JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text });
};

type Json = Record<string, unknown>;

const withCharacter = (patch: Json): Json => {
  const s = snapshot();
  return { ...s, domain: { ...s.domain, character: { ...s.domain.character, ...patch } } };
};

const deckIn = (grades: unknown): Json => withCharacter({ cyberware: { optics: "hitomi_optics_mk1", nervous: "kumo_cyberdeck" }, implantGrades: grades });

const withBagItem = (item: Json): Json => {
  const s = snapshot();
  const inv = s.domain.inventory;
  return { ...s, domain: { ...s.domain, inventory: { ...inv, items: [...inv.items, item], nextUid: inv.nextUid + 1 } } };
};

describe("the cyberdeck in the save (v31 to v32, decision of 6.11 after ADR-0059 stage 6)", () => {
  it("an older save had no cyberdeck, so the migration changes nothing but the version", () => {
    expect(SAVE_SCHEMA_VERSION).toBeGreaterThanOrEqual(32);
    const s = snapshot();
    const old = { ...s, version: 31 };
    expect(MIGRATIONS[31]!(old)).toEqual({ ...old, version: 32 });
    const loaded = decodeSave("v31", wrap(old));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded.domain.character).toEqual(s.domain.character);
  });

  it("keeps an installed deck's tier and level, and a deck's level in the bag", () => {
    const s = deckIn({ nervous: { rarity: "epic", level: 14 } });
    expect(findSchemaError(s)).toBeNull();
    expect((decodeSave("x", wrap(s)) as SaveSnapshot).domain.character.implantGrades).toEqual({ nervous: { rarity: "epic", level: 14 } });
    expect(findSchemaError(withBagItem({ uid: "i99", def: "kumo_cyberdeck", rarity: "rare", level: 7 }))).toBeNull();
    // Other implants still have no level.
    expect(findSchemaError(withBagItem({ uid: "i99", def: "synapse_booster", rarity: "common", level: 7 }))).not.toBeNull();
  });

  it("refuses a grade on a slot without a deck, an unknown tier and a level out of 1..30", () => {
    expect(findSchemaError(withCharacter({ implantGrades: { optics: { rarity: "common", level: 1 } } }))).toBe("implant grades");
    expect(findSchemaError(withCharacter({ implantGrades: { nervous: { rarity: "common", level: 1 } } }))).toBe("implant grades");
    expect(findSchemaError(deckIn({ nervous: { rarity: "mythic", level: 1 } }))).toBe("implant grades");
    expect(findSchemaError(deckIn({ nervous: { rarity: "rare", level: 0 } }))).toBe("implant grades");
    expect(findSchemaError(deckIn({ nervous: { rarity: "rare", level: 31 } }))).toBe("implant grades");
    expect(findSchemaError(deckIn({ nervous: { rarity: "rare", level: 2.5 } }))).toBe("implant grades");
    expect(findSchemaError(deckIn([]))).toBe("implant grades");
    // A deck without a saved grade is common level 1.
    expect(findSchemaError(deckIn(undefined))).toBeNull();
  });
});
