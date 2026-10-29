import { describe, expect, it } from "vitest";
import { type Vec3, contractTag } from "@seki/core";
import { CONTRACT_SITE_SPAWNS, Simulation, contractSpawnYaw, market } from "../src";
import { byKey, teleportPlayer } from "./helpers";


describe("contract crews face the way trouble comes from (audit W11)", () => {
  const face = (from: Vec3, to: Vec3) => Math.atan2(to.x - from.x, to.z - from.z);
  const off = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

  it("a raid wave spawns looking at Oyaji, not west at the street axis", () => {
    const sites = new Set<string>();
    for (const seed of [2, 3, 5, 8, 13]) {
      const sim = Simulation.create({ seed });
      teleportPlayer(sim, market(90.5, 0, 74), Math.PI / 2);
      sim.step();
      sim.enqueue({ type: "accept-contract", kind: "protect" });
      sim.step();
      const c = sim.domain.contracts.active!;
      sites.add(c.siteId);
      const oyaji = byKey(sim, "oyaji")!.position;
      const wave = [...sim.world.with("ai")].filter((e) => e.tag === contractTag(c.id));
      expect(wave.length).toBeGreaterThan(0);
      for (const g of wave) {
        expect(off(contractSpawnYaw(c.siteId, g.position), face(g.position, oyaji))).toBeLessThan(0.05);
        // One step of turning towards whatever it does first.
        expect(off(g.yaw, face(g.position, oyaji))).toBeLessThan(0.3);
      }
    }
    expect(sites.size).toBe(2);
  });

  it("every site has a sensible facing: the stash guards look over the market, Kaito's crews onto the street", () => {
    for (const [site, points] of Object.entries(CONTRACT_SITE_SPAWNS) as [keyof typeof CONTRACT_SITE_SPAWNS, readonly Vec3[]][]) {
      for (const p of points) expect(Number.isFinite(contractSpawnYaw(site, p))).toBe(true);
    }
    // West (yaw -π/2) is towards the market floor from the stash in the east corner.
    for (const p of CONTRACT_SITE_SPAWNS.hebi_stash) expect(off(contractSpawnYaw("hebi_stash", p), -Math.PI / 2)).toBeLessThan(0.6);
    for (const p of CONTRACT_SITE_SPAWNS.east_lot) expect(off(contractSpawnYaw("east_lot", p), -Math.PI / 2)).toBeLessThan(0.5);
    // A site without a facing point (the docks posts carry their own) faces the middle of its points.
    const [first] = CONTRACT_SITE_SPAWNS.tessen_office;
    expect(Number.isFinite(contractSpawnYaw("tessen_office", first!))).toBe(true);
  });
});
