import { describe, expect, it } from "vitest";
import { ENEMY_TYPES, npcBand } from "@seki/core";
import type { EnemyTypeId } from "@seki/core";
import { SIM_HZ, gangerEntity } from "../src";
import { BACK_SPEED, GANGER_SPEED } from "../src/systems/ai/ganger-walk";
import { streetSim } from "./helpers";

/*
 * ADR-0089 stage 2: an enemy with a gun holds its weapon's band. Alerted 4 m or 30 m from a
 * standing player, it is inside the band within 5 s: it closes in from far, and backs off
 * from near while it shoots. Two walks are longer than 5 s at the AI's speeds (the shotgun's
 * 20 m in from 30 m, the rifle's 10 m back from 4 m): those get the walk's time and a second.
 */

const BANDED = (Object.keys(ENEMY_TYPES) as EnemyTypeId[]).filter((t) => npcBand(ENEMY_TYPES[t].weapon));

const secondsFor = (band: { readonly min: number; readonly max: number }, start: number): number =>
  Math.max(5, Math.ceil(1 + (start > band.max ? (start - band.max) / GANGER_SPEED : Math.max(0, band.min - start) / BACK_SPEED)));

const distanceAfter = (type: EnemyTypeId, start: number, seconds: number): number => {
  const sim = streetSim({ seed: 3 });
  sim.step();
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  const p = sim.player()!;
  const g = gangerEntity(90089, { key: "band", position: { ...p.position, z: p.position.z + start }, yaw: Math.PI }, null, 1e6, p.chunk ?? "", undefined, type);
  g.ai!.alerted = true;
  sim.world.add(g);
  for (let i = 0; i < seconds * SIM_HZ; i++) {
    p.health = { ...p.health!, current: p.health!.max };
    sim.step();
  }
  return Math.hypot(g.position.x - p.position.x, g.position.z - p.position.z);
};

describe("an enemy holds its weapon's band (ADR-0089 stage 2)", () => {
  it("every gun but the sniper's has a band", () => {
    expect([...new Set(BANDED.map((t) => ENEMY_TYPES[t].weapon))].sort()).toEqual(["hebi_smg", "raijin12", "tessen_ar5", "unity9"]);
  });

  for (const type of BANDED) {
    for (const start of [4, 30]) {
      it(`${type} from ${start} m ends in its band`, () => {
        const band = npcBand(ENEMY_TYPES[type].weapon)!;
        const d = distanceAfter(type, start, secondsFor(band, start));
        expect(d).toBeGreaterThanOrEqual(band.min - 0.5);
        expect(d).toBeLessThanOrEqual(band.max + 0.5);
      });
    }
  }
});
