import { describe, expect, it } from "vitest";
import { SAVE_SCHEMA_VERSION, type SaveSnapshot } from "@seki/core";
import { MIGRATIONS, checksum, decodeSave, encodeSave, findSchemaError } from "../src";
import { snapshot } from "./fixtures";

const wrap = (payload: unknown) => {
  const text = JSON.stringify(payload);
  return JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text });
};

describe("metro, encounters and contract variations (v11 to v12, ADR-0034)", () => {
  /** What v11 wrote: no metro, no encounters, a running contract without a variation. */
  const v11Payload = () => {
    const s = snapshot();
    const { metro: _m, encounters: _e, ...domain } = s.domain;
    const job = { id: "c2", kind: "eliminate", siteId: "east_lot", targets: 3, reward: 625, status: "active" } as const;
    return { ...s, version: 11, domain: { ...domain, contracts: { active: job, completed: 1 } } };
  };

  it("adds no ride and no played encounters, and keeps the contract plain", () => {
    const loaded = decodeSave("v11", wrap(v11Payload()));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded.domain.metro).toEqual({ ride: null });
    expect(loaded.domain.encounters).toEqual({ used: [], nights: {} });
    expect(loaded.domain.contracts.active?.variation).toBeUndefined();
    expect(loaded.domain.contracts.hooks).toBeUndefined();
  });

  it("tolerates a missing domain and keeps what is already there", () => {
    expect(MIGRATIONS[11]!({ version: 11 })).toEqual({ version: 12, domain: { metro: { ride: null }, encounters: { used: [], nights: {} } } });
    const metro = { ride: { from: "kanal", to: "doki", arriveTick: 40 } };
    expect(MIGRATIONS[11]!({ version: 11, domain: { metro } })).toMatchObject({ domain: { metro } });
  });

  it("round-trips a ride, a varied contract with hooks and the encounter log", () => {
    const s = snapshot();
    const job = {
      id: "c4",
      kind: "eliminate",
      siteId: "koi_back",
      targets: 4,
      reward: 812,
      status: "active",
      deadlineTick: 9000,
      variation: { modifiers: ["time_limit", "twin"], security: "lockdown", trait: "paranoid", twist: "wrong_target" },
    } as const;
    const full: SaveSnapshot = {
      ...s,
      domain: {
        ...s.domain,
        metro: { ride: { from: "shinsekai", to: "targ", arriveTick: 1200 } as const },
        encounters: { used: ["enc_kanal_test"], nights: { enc_targ_test: 3 } },
        contracts: { active: job, completed: 3, hooks: ["hook_eliminate_1"] },
      },
    };
    expect(decodeSave("w2", encodeSave(full))).toEqual(full);
  });

  it("rejects broken wave 2 fields", () => {
    const s = snapshot();
    const bad = (domain: Record<string, unknown>) => findSchemaError({ ...s, domain: { ...s.domain, ...domain } } as unknown as Record<string, unknown>);
    expect(bad({ metro: null })).toBe("metro");
    expect(bad({ metro: { ride: { from: "moon", to: "kanal", arriveTick: 1 } } })).toBe("metro ride");
    expect(bad({ metro: { ride: { from: "doki", to: "kanal", arriveTick: 1.5 } } })).toBe("metro ride");
    expect(bad({ encounters: { used: [1], nights: {} } })).toBe("encounters");
    expect(bad({ encounters: { used: [], nights: { a: "x" } } })).toBe("encounters");
    const job = { id: "c2", kind: "eliminate", siteId: "east_lot", targets: 2, reward: 470, status: "active" };
    expect(bad({ contracts: { active: { ...job, variation: { modifiers: ["laser"], security: "light" } }, completed: 1 } })).toBe("contract variation");
    expect(bad({ contracts: { active: { ...job, variation: { modifiers: [], security: "ninja" } }, completed: 1 } })).toBe("contract variation");
    expect(bad({ contracts: { active: { ...job, variation: { modifiers: [], security: "light", trait: "x" } }, completed: 1 } })).toBe("contract variation");
    expect(bad({ contracts: { active: { ...job, variation: { modifiers: [], security: "light", twist: 3 } }, completed: 1 } })).toBe("contract variation");
    expect(bad({ contracts: { active: job, completed: 1, hooks: [7] } })).toBe("contract hooks");
  });
});
