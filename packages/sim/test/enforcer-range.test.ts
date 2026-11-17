import { describe, expect, it } from "vitest";
import { ENEMY_TYPES, npcWeapon } from "@seki/core";
import { SIM_HZ, gangerEntity } from "../src";
import { run, streetSim } from "./helpers";

/*
 * G-917: an enemy with a gun opens fire from where its shots land. The Hebi enforcer's shotgun
 * reaches 12 m, but every Hebi gun opened fire from 15 m, so the elite stood there and missed.
 */

describe("an enemy fires from inside its weapon's range (G-917)", () => {
  it("every gun of the catalogue opens fire short of its range", () => {
    for (const t of Object.values(ENEMY_TYPES)) {
      const w = npcWeapon(t.weapon);
      if (w.melee) continue;
      const g = gangerEntity(1, { key: "", position: { x: 0, y: 0, z: 0 }, yaw: 0 }, null, 10, "c", undefined, t.id);
      expect(g.ai!.attackRange, t.id).toBeLessThan(w.range);
    }
  });

  it.each([1, 2, 3])("an alerted enforcer 13 m from a standing player hurts them within 30 s (seed %i)", (seed) => {
    const sim = streetSim({ seed });
    sim.step();
    for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
    const p = sim.player()!;
    const g = gangerEntity(90017, { key: "g917", position: { ...p.position, z: p.position.z + 13 }, yaw: Math.PI }, null, 1e6, p.chunk ?? "", undefined, "hebi_enforcer");
    g.ai!.alerted = true;
    sim.world.add(g);
    const before = p.health!.current;
    run(sim, 30 * SIM_HZ);
    expect(p.health!.current).toBeLessThan(before);
  });
});
