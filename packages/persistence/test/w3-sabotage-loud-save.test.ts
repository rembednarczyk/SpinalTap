import { describe, expect, it } from "vitest";
import { type Contract, SAVE_SCHEMA_VERSION } from "@seki/core";
import { MIGRATIONS, decodeSave, encodeSave, findSchemaError } from "../src";
import { snapshot } from "./fixtures";

/** W-3's loud way in the save (ADR-0082 stage 3b): schema v41 and the v40 -> v41 migration. */
const JOB: Contract = {
  id: "c4",
  kind: "sabotage",
  siteId: "w3_hall",
  targets: 4,
  reward: 2000,
  status: "active",
  deadlineTick: 90_000,
  route: "loud",
  progress: 600,
  alarmTick: 4000,
  charges: ["S1", "S3"],
  planting: { station: "S4", ticks: 80, hp: 87 },
};

const withJob = (c: unknown) => {
  const s = snapshot();
  return { ...s, domain: { ...s.domain, contracts: { ...s.domain.contracts, active: c as Contract } } };
};

describe("the loud way in the save (v40 to v41, ADR-0082 stage 3b)", () => {
  it("is schema v41 or later", () => {
    expect(SAVE_SCHEMA_VERSION).toBeGreaterThanOrEqual(41);
  });

  it("a v40 save changes only the version: its sabotage, if any, is on the quiet way", () => {
    const old = { version: 40, tick: 5, entities: [] };
    expect(MIGRATIONS[40]!(old)).toEqual({ ...old, version: 41 });
  });

  it("keeps the charges, the one being planted, the fuse and the blast through the codec", () => {
    const fuse: Contract = { ...JOB, charges: ["S1", "S3", "S4"], planting: undefined, fuseTick: 9000 };
    const { planting: _, ...lit } = fuse;
    expect(decodeSave("slot", encodeSave(withJob(JOB))).domain.contracts.active).toEqual(JOB);
    expect(decodeSave("slot", encodeSave(withJob(lit))).domain.contracts.active).toEqual(lit);
    const blown = { ...lit, detonated: true as const };
    expect(decodeSave("slot", encodeSave(withJob(blown))).domain.contracts.active).toEqual(blown);
  });

  it("refuses an unknown station, a station twice, four charges, a bad planting, a negative fuse and a detonated that is not true", () => {
    expect(findSchemaError(withJob(JOB))).toBeNull();
    expect(findSchemaError(withJob({ ...JOB, charges: ["S5"] }))).toBe("contract charges");
    expect(findSchemaError(withJob({ ...JOB, charges: ["S1", "S1"] }))).toBe("contract charges");
    expect(findSchemaError(withJob({ ...JOB, charges: ["S1", "S2", "S3", "S4"] }))).toBe("contract charges");
    expect(findSchemaError(withJob({ ...JOB, planting: { station: "S2", ticks: -1, hp: 50 } }))).toBe("contract planting");
    expect(findSchemaError(withJob({ ...JOB, planting: { station: "S2", ticks: 3 } }))).toBe("contract planting");
    expect(findSchemaError(withJob({ ...JOB, fuseTick: -3 }))).toBe("contract fuse");
    expect(findSchemaError(withJob({ ...JOB, alarmTick: 1.5 }))).toBe("contract fuse");
    expect(findSchemaError(withJob({ ...JOB, detonated: false }))).toBe("contract detonated");
  });
});
