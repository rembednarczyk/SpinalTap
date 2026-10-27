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
      streaming: { loadedChunks: [] },
      domain: { wallet: { eddies: 0 }, inventory: { medkit: 1 }, reputation: { clinic: 0 }, story: { choices: {}, ending: null } },
    });
  });

  it("upgrades an M1 (v3) save: the clinic becomes its own neutral faction", () => {
    const s = snapshot();
    const { clinic: _c, ...m1Reputation } = { ...s.domain.reputation, fixers: 12, hebi: -30, civilians: 4 };
    const loaded = decodeSave("m1", wrap({ ...s, version: 3, domain: { ...s.domain, reputation: m1Reputation } }));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
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

  it("upgrades an M2 (v4) save: empty story state, act I started when the first contract is done", () => {
    const s = snapshot();
    const { story: _s, ...domain } = s.domain;
    const fresh = decodeSave("m2", wrap({ ...s, version: 4, domain }));
    expect(fresh.version).toBe(SAVE_SCHEMA_VERSION);
    expect(fresh.domain.story).toEqual({ choices: {}, ending: null });
    expect(fresh.domain.quests).toEqual(s.domain.quests);

    const done = { ...domain, quests: { m0_first_contract: { status: "completed" } } };
    const upgraded = decodeSave("m2", wrap({ ...s, version: 4, domain: done }));
    expect(upgraded.domain.quests).toEqual({ m0_first_contract: { status: "completed" }, m3_echo: { status: "active", stepIndex: 0 } });

    // Never resets act I progress that is already there, and tolerates a missing domain.
    const ahead = { ...domain, quests: { m0_first_contract: { status: "completed" }, m3_echo: { status: "active", stepIndex: 2 } } };
    expect(decodeSave("m2", wrap({ ...s, version: 4, domain: ahead })).domain.quests.m3_echo).toEqual({ status: "active", stepIndex: 2 });
    expect(MIGRATIONS[4]!({ version: 4 })).toEqual({ version: 5, domain: { quests: {}, story: { choices: {}, ending: null } } });
  });

  it("walks an M1 (v3) save through both steps: clinic faction (v4), then story state (v5)", () => {
    const s = snapshot();
    const { story: _s, ...domain } = s.domain;
    const { clinic: _c, ...m1Reputation } = domain.reputation;
    const m1 = { ...domain, reputation: m1Reputation, quests: { m0_first_contract: { status: "completed" } } };
    const loaded = decodeSave("m1", wrap({ ...s, version: 3, domain: m1 }));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded.domain.reputation.clinic).toBe(0);
    expect(loaded.domain.story).toEqual({ choices: {}, ending: null });
    expect(loaded.domain.quests.m3_echo).toEqual({ status: "active", stepIndex: 0 });
  });

  it("keeps story choices and the ending through the round trip", () => {
    const s = snapshot();
    const story = { choices: { case: "opened" as const, name: "silent" as const, crash: "wheel" as const }, ending: "aya" as const };
    const withStory = { ...s, domain: { ...s.domain, story } };
    expect(decodeSave("st", encodeSave(withStory)).domain.story).toEqual(story);
  });

  it("upgrades an M3 (v5) save to world streaming with nothing preloaded", () => {
    const { streaming: _s, ...v5 } = snapshot();
    const loaded = decodeSave("m3", wrap({ ...v5, version: 5 }));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded.streaming).toEqual({ loadedChunks: [] });
    expect(loaded.entities).toEqual(v5.entities);
    expect(loaded.domain).toEqual(v5.domain);
  });

  it("upgrades an M2 streaming (v6) save to the day clock, telling the time from the saved tick", () => {
    const s = snapshot({ tick: 5400 });
    const { clock: _c, ...v6Domain } = s.domain;
    const loaded = decodeSave("m2", wrap({ ...s, version: 6, domain: v6Domain }));
    expect(loaded.version).toBe(7);
    // 21:00 plus 5400 ticks of one game second each: 22:30.
    expect(loaded.domain.clock).toEqual({ seconds: 21 * 3600 + 5400 });
    expect(loaded.domain).toEqual({ ...v6Domain, clock: { seconds: 81000 } });
    expect(loaded.entities).toEqual(s.entities);
    expect(loaded.streaming).toEqual(s.streaming);
  });

  it("the v6 migration keeps an existing clock and tolerates a missing tick or domain", () => {
    expect(MIGRATIONS[6]!({ version: 6, domain: { clock: { seconds: 5 } } })).toEqual({ version: 7, domain: { clock: { seconds: 5 } } });
    expect(MIGRATIONS[6]!({ version: 6, tick: -3 })).toEqual({ version: 7, tick: -3, domain: { clock: { seconds: 75600 } } });
  });

  it("keeps the clock of a current save through the round trip", () => {
    const s = snapshot();
    const later = { ...s, domain: { ...s.domain, clock: { seconds: 200_000 } } };
    expect(decodeSave("t", encodeSave(later)).domain.clock).toEqual({ seconds: 200_000 });
  });

  it("keeps the streaming state of a current save through the round trip", () => {
    const s = snapshot({ streaming: { loadedChunks: ["kanal", "targ-south"] } });
    expect(decodeSave("s", encodeSave(s)).streaming.loadedChunks).toEqual(["kanal", "targ-south"]);
  });

  it("keeps an active contract through the round trip", () => {
    const s = snapshot();
    const contract = { id: "c2", siteId: "east_lot" as const, targets: 3, reward: 700, status: "active" as const };
    const withContract = { ...s, domain: { ...s.domain, contracts: { active: contract, completed: 1 } } };
    expect(decodeSave("c", encodeSave(withContract)).domain.contracts.active).toEqual(contract);
  });

  it("keeps a market contract (M4 fields) through the round trip without a schema bump", () => {
    const s = snapshot();
    const contract = { id: "c3", kind: "delivery" as const, siteId: "hana_stall" as const, targets: 0, reward: 325, status: "active" as const, deadlineTick: 4800 };
    const withContract = { ...s, domain: { ...s.domain, contracts: { active: contract, completed: 2 } } };
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
    ["streaming", { streaming: null }],
    ["streaming", { streaming: { loadedChunks: "kanal" } }],
    ["streaming", { streaming: { loadedChunks: [3] } }],
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
    ["contract kind", { contracts: { active: { id: "c1", kind: "heist", siteId: "east_lot", targets: 2, reward: 1, status: "active" }, completed: 0 } }],
    ["contract deadline", { contracts: { active: { id: "c1", kind: "delivery", siteId: "hana_stall", targets: 0, reward: 1, status: "active", deadlineTick: 1.5 }, completed: 0 } }],
    ["ability", { ability: { activeTime: "x", cooldown: 0 } }],
    ["cyberware", { character: { alias: null, memories: [], cyberware: { optics: "fake" } } }],
    ["story", { story: null }],
    ["story", { story: { choices: [], ending: null } }],
    ["story choices", { story: { choices: { mood: "opened" }, ending: null } }],
    ["story choices", { story: { choices: { case: "wheel" }, ending: null } }],
    ["story choices", { story: { choices: { case: 1 }, ending: null } }],
    ["story ending", { story: { choices: {}, ending: "happy" } }],
    ["clock", { clock: null }],
    ["clock", { clock: { seconds: 1.5 } }],
    ["clock", { clock: { seconds: -60 } }],
    ["story ending", { story: { choices: {}, ending: 0 } }],
  ])("rejects bad domain %s", (_name, patch) => {
    const s = snapshot();
    expect(findSchemaError({ ...s, domain: { ...s.domain, ...patch } } as unknown as Record<string, unknown>)).not.toBeNull();
  });
});
