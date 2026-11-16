import { describe, expect, it } from "vitest";
import { type Contract, SAVE_SCHEMA_VERSION } from "@seki/core";
import { MIGRATIONS, decodeSave, encodeSave, findSchemaError } from "../src";
import { snapshot } from "./fixtures";

/** W-3's sabotage in the save (ADR-0082 stage 3): schema v40 and the v39 -> v40 migration. */
const JOB: Contract = { id: "c4", kind: "sabotage", siteId: "w3_hall", targets: 3, reward: 2400, status: "active", deadlineTick: 9000, route: "quiet", progress: 600 };

const withJob = (c: unknown) => {
  const s = snapshot();
  return { ...s, domain: { ...s.domain, contracts: { ...s.domain.contracts, active: c as Contract } } };
};

describe("the sabotage in the save (v39 to v40, ADR-0082 stage 3)", () => {
  it("is schema v40 or later", () => {
    expect(SAVE_SCHEMA_VERSION).toBeGreaterThanOrEqual(40);
  });

  it("a v39 save changes only the version: it runs no sabotage", () => {
    const old = { version: 39, tick: 5, entities: [] };
    expect(MIGRATIONS[39]!(old)).toEqual({ ...old, version: 40 });
  });

  it("keeps the running upload, its way and the way out seen through the codec", () => {
    const seen = { ...JOB, seenLeaving: true as const };
    expect(decodeSave("slot", encodeSave(withJob(seen))).domain.contracts.active).toEqual(seen);
  });

  it("refuses a way that is not quiet or loud, and a seen way out that is not true", () => {
    expect(findSchemaError(withJob(JOB))).toBeNull();
    expect(findSchemaError(withJob({ ...JOB, route: "sneaky" }))).toBe("contract route");
    expect(findSchemaError(withJob({ ...JOB, seenLeaving: false }))).toBe("contract route");
  });
});
