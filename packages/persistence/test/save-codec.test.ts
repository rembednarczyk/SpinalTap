import { describe, expect, it } from "vitest";
import { CorruptSaveError, SAVE_SCHEMA_VERSION } from "@seki/core";
import { MIGRATIONS, checksum, decodeSave, encodeSave, findSchemaError, migrate } from "../src";
import { snapshot, v1Payload } from "./fixtures";

const wrap = (payload: unknown) => {
  const text = JSON.stringify(payload);
  return JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text });
};

const expectCorrupt = (raw: string, reason: RegExp) => {
  expect(() => decodeSave("slot-1", raw)).toThrow(CorruptSaveError);
  expect(() => decodeSave("slot-1", raw)).toThrow(reason);
};

describe("save codec", () => {
  it("round-trips a snapshot losslessly", () => {
    const s = snapshot();
    expect(decodeSave("a", encodeSave(s))).toEqual(s);
  });

  it("rejects non-JSON, unknown formats and checksum mismatches", () => {
    expectCorrupt("{nope", /envelope is not valid JSON/);
    expectCorrupt(JSON.stringify({ format: "other" }), /unknown format/);
    expectCorrupt("null", /unknown format/);
    const tampered = JSON.parse(encodeSave(snapshot())) as { payload: string };
    tampered.payload = tampered.payload.replace('"eddies":120', '"eddies":999999');
    expectCorrupt(JSON.stringify(tampered), /checksum mismatch/);
  });

  it("rejects truncated payloads and non-object payloads", () => {
    const text = JSON.stringify(snapshot()).slice(0, 50);
    expectCorrupt(JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text }), /payload is not valid JSON/);
    expectCorrupt(wrap([1, 2]), /not an object/);
  });

  it("rejects saves from the future or without a version", () => {
    expectCorrupt(wrap({ ...snapshot(), version: 99 }), /newer version/);
    expectCorrupt(wrap({ ...snapshot(), version: "2" }), /missing schema version/);
  });

  it("names the invalid field", () => {
    expectCorrupt(wrap({ ...snapshot(), entities: [{ key: "p" }] }), /entity shape/);
    const s = snapshot();
    expectCorrupt(wrap({ ...s, domain: { ...s.domain, character: { ...s.domain.character, memories: ["fake"] } } }), /memories/);
    expectCorrupt(wrap({ ...s, domain: { ...s.domain, wallet: { eddies: -1 } } }), /wallet/);
  });
});

describe("migrations", () => {
  it("upgrades a v1 save to the current schema", () => {
    const s = decodeSave("old", wrap(v1Payload()));
    expect(s.version).toBe(SAVE_SCHEMA_VERSION);
    expect(s.domain.wallet).toEqual({ eddies: 250 });
    expect(s.domain.preferences.cameraMode).toBe("FPP");
    expect(s.rngState).toBe(42);
    expect(s.entities.every((e) => e.alerted === false)).toBe(true);
  });

  it("has a migration for every version below the current one", () => {
    for (let v = 1; v < SAVE_SCHEMA_VERSION; v++) expect(MIGRATIONS[v]).toBeTypeOf("function");
  });

  it("leaves current saves untouched and fails on gaps", () => {
    const s = snapshot() as unknown as Record<string, unknown>;
    expect(migrate(s)).toBe(s);
    expect(() => migrate({ version: 0 })).toThrow(/no migration from version 0/);
  });

  it("tolerates a v1 save with missing optional sections", () => {
    const m = migrate({ version: 1, seed: 5 });
    expect(m).toMatchObject({
      version: SAVE_SCHEMA_VERSION,
      rngState: 5,
      entities: [],
      domain: { wallet: { eddies: 0 }, inventory: { medkit: 1 }, reputation: { clinic: 0 } },
    });
  });

  it("upgrades an M1 (v3) save: the clinic becomes its own neutral faction", () => {
    const s = snapshot();
    const { clinic: _c, ...m1Reputation } = { ...s.domain.reputation, fixers: 12, hebi: -30, civilians: 4 };
    const loaded = decodeSave("m1", wrap({ ...s, version: 3, domain: { ...s.domain, reputation: m1Reputation } }));
    expect(loaded.version).toBe(4);
    expect(loaded.domain.reputation).toEqual({ fixers: 12, hebi: -30, civilians: 4, clinic: 0 });
    expect(loaded.domain.inventory).toEqual(s.domain.inventory);
  });

  it("the v3 migration keeps an existing clinic standing and tolerates a missing reputation", () => {
    expect(MIGRATIONS[3]?.({ version: 3, domain: { reputation: { clinic: 7 } } })).toMatchObject({ domain: { reputation: { clinic: 7 } } });
    expect(MIGRATIONS[3]?.({ version: 3 })).toEqual({ version: 4, domain: { reputation: { clinic: 0 } } });
  });

  it("upgrades an M0 (v2) save with the M1 starter kit", () => {
    const s = snapshot();
    const { inventory: _i, contracts: _c, ability: _a, ...domain } = s.domain;
    const loaded = decodeSave("m0", wrap({ ...s, version: 2, domain }));
    expect(loaded.domain.inventory).toEqual({ medkit: 1 });
    expect(loaded.domain.contracts).toEqual({ active: null, completed: 0 });
    expect(loaded.domain.ability).toEqual({ activeTime: 0, cooldown: 0 });
    expect(loaded.domain.flags).toEqual(s.domain.flags);
  });

  it("keeps an active contract through the round trip", () => {
    const s = snapshot();
    const contract = { id: "c2", siteId: "east_lot" as const, targets: 3, reward: 700, status: "active" as const };
    const withContract = { ...s, domain: { ...s.domain, contracts: { active: contract, completed: 1 } } };
    expect(decodeSave("c", encodeSave(withContract)).domain.contracts.active).toEqual(contract);
  });
});

describe("schema validation", () => {
  it("accepts a well-formed snapshot", () => {
    expect(findSchemaError(snapshot() as unknown as Record<string, unknown>)).toBeNull();
  });

  it.each([
    ["seed", { seed: Number.NaN }],
    ["narrative", { narrative: 5 }],
    ["meta", { meta: { label: 1 } }],
    ["entities", { entities: {} }],
  ])("rejects a bad %s", (_name, patch) => {
    expect(findSchemaError({ ...snapshot(), ...patch } as unknown as Record<string, unknown>)).not.toBeNull();
  });

  it.each([
    ["quests", { quests: { q: { status: "active", stepIndex: 0.5 } } }],
    ["quests", { quests: { q: { status: "weird" } } }],
    ["flags", { flags: [1] }],
    ["preferences", { preferences: { cameraMode: "VR" } }],
    ["reputation", { reputation: { fixers: 0 } }],
    ["reputation", { reputation: { fixers: 0, hebi: 0, civilians: 0 } }],
    ["inventory", { inventory: { medkit: -1 } }],
    ["inventory", { inventory: { rocket: 1 } }],
    ["contracts", { contracts: { active: null, completed: 0.5 } }],
    ["contracts", { contracts: { active: { id: "c1", siteId: "moon", targets: 2, reward: 1, status: "active" }, completed: 0 } }],
    ["contracts", { contracts: { active: { id: "c1", siteId: "east_lot", targets: 2, reward: 1, status: "done" }, completed: 0 } }],
    ["ability", { ability: { activeTime: "x", cooldown: 0 } }],
    ["cyberware", { character: { alias: null, memories: [], cyberware: { optics: "fake" } } }],
  ])("rejects bad domain %s", (_name, patch) => {
    const s = snapshot();
    expect(findSchemaError({ ...s, domain: { ...s.domain, ...patch } } as unknown as Record<string, unknown>)).not.toBeNull();
  });
});
