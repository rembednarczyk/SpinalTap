import { describe, expect, it } from "vitest";
import { SAVE_SCHEMA_VERSION } from "@seki/core";
import { MIGRATIONS } from "../src";
import { snapshot } from "./fixtures";

/** Hebi's stash in the shelter under T2 (ADR-0074 stage 5d2): schema v50 and the v49 -> v50 migration. */

const at = (key: string, x: number, y: number, z: number) => ({ key, position: { x, y, z }, yaw: 0, pitch: 0, hp: 100, cooldown: 0, alerted: false });

/** A v49 save in a retrieval at the stash by the Arkady: the player by it, the crew and the crate, the lookout under the arches, Hana, a passer-by at the stash. */
const atTheStash = () => {
  const s = snapshot({});
  return {
    ...s,
    version: 49,
    entities: [at("player", 442, -9.17, 93), at("c7-g0", 441, -9.2, 92), at("c7-g1", 445, -9.2, 96), at("c7-item", 443.4, -8.9, 91.8), at("hebi-lookout", 449.5, -9.0, 104.5), at("hana", 428, -6.4, 66), at("passerby-2", 440, -9.2, 99)],
    domain: { ...s.domain, contracts: { ...s.domain.contracts, active: { id: "c7", kind: "retrieve", siteId: "hebi_stash", targets: 2, reward: 500, status: "active" } } },
    strayBodies: [{ state: at("c3-g0", 444, -9.2, 95) }, { state: at("c3-g1", 416, -6.4, 64) }],
  };
};

const migrate = <T>(old: T): T => MIGRATIONS[49]!(old as unknown as Record<string, unknown>) as unknown as T;

describe("Hebi's stash in the shelter in the save (v49 to v50, ADR-0074 stage 5d2)", () => {
  it("is schema v50 or later", () => {
    expect(SAVE_SCHEMA_VERSION).toBeGreaterThanOrEqual(50);
  });

  it("keeps the player and the people away from the stash, drops the lookout, the job's crew and crate and whoever was on the stash's old ground", () => {
    const moved = migrate(atTheStash());
    expect(moved.version).toBe(50);
    expect(moved.entities.map((e) => e.key)).toEqual(["player", "hana"]);
    expect(moved.entities[0]).toEqual(atTheStash().entities[0]);
    expect(moved.strayBodies.map((b) => b.state.key)).toEqual(["c3-g1"]);
    expect(moved.domain).toEqual(atTheStash().domain);
  });

  it("keeps a crew of another job and the people under T2's ground", () => {
    const s = atTheStash();
    const other = { ...s, domain: { ...s.domain, contracts: { ...s.domain.contracts, active: { ...s.domain.contracts.active, id: "c9", siteId: "hana_stall" } } }, entities: [...s.entities, at("c9-g0", 426.5, -6.4, 66), at("deep", 440, -12.2, 95)] };
    expect(migrate(other).entities.map((e) => e.key)).toEqual(["player", "hana", "c9-g0", "deep"]);
  });
});
