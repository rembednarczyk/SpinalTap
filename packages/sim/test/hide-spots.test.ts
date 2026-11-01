import { describe, expect, it } from "vitest";
import type { ContractSiteId, Vec3 } from "@seki/core";
import { CONTRACT_SITE_SPAWNS, WORLD_CHUNKS } from "../src";

/**
 * Hiding places for bodies in the content (ADR-0065, stage 3): props flagged `hide` by the guard
 * posts and in the docks, and at least one at every stealth job.
 */

const spots = WORLD_CHUNKS.flatMap((c) => c.props.filter((p) => p.hide).map((p) => ({ chunk: c, prop: p })));

/** Ground distance from `at` to the footprint of a block prop. */
const toFootprint = (prop: (typeof spots)[number]["prop"], at: Vec3): number => {
  if (prop.view.kind !== "block") return Infinity;
  const { size } = prop.view;
  const dx = Math.max(Math.abs(at.x - prop.center.x) - size.x / 2, 0);
  const dz = Math.max(Math.abs(at.z - prop.center.z) - size.z / 2, 0);
  return Math.hypot(dx, dz);
};

const nearest = (at: Vec3): number => Math.min(...spots.map((s) => toFootprint(s.prop, at)));

/** The jobs played by sneaking: the retrieval from the Hebi stash and the infiltration of Tessen's office. */
const STEALTH_SITES: readonly ContractSiteId[] = ["hebi_stash", "tessen_office"];
/** Close enough to drag a guard of the job there unseen. */
const NEAR_JOB = 15;

const actorAt = (key: string): Vec3 => {
  const a = WORLD_CHUNKS.flatMap((c) => c.actors).find((x) => x.spawn.key === key);
  if (!a) throw new Error(`no actor ${key}`);
  return a.spawn.position;
};

describe("hiding places in the content (ADR-0065)", () => {
  it("are solid blocks of the content's kinds: containers, dumpsters, lockers", () => {
    expect(spots.length).toBeGreaterThanOrEqual(6);
    for (const { prop } of spots) {
      expect(prop.solid).toBe(true);
      expect(prop.view.kind).toBe("block");
      expect(["container", "dumpster", "locker"]).toContain(prop.hide);
    }
  });

  it("every stealth job has one by its guards", () => {
    for (const site of STEALTH_SITES) {
      const posts = CONTRACT_SITE_SPAWNS[site];
      expect(posts.length, site).toBeGreaterThan(0);
      expect(Math.min(...posts.map(nearest)), site).toBeLessThanOrEqual(NEAR_JOB);
    }
  });

  it("the docks have them, and so do the Hebi posts on the street", () => {
    expect(spots.filter((s) => s.chunk.district === "doki").length).toBeGreaterThanOrEqual(2);
    // The Hebi post on Grodzka, under the footbridge; the bins behind Neon Koi and at the car wash.
    expect(nearest(actorAt("hebi-grodzka"))).toBeLessThanOrEqual(6);
    for (const site of ["koi_back", "car_wash", "kanal_bridge"] as const) {
      expect(Math.min(...CONTRACT_SITE_SPAWNS[site].map(nearest)), site).toBeLessThanOrEqual(NEAR_JOB);
    }
  });
});
