import { describe, expect, it } from "vitest";
import { GAME_SECONDS_PER_REAL_SECOND } from "@seki/core";
import { ALCHEMIA_PIECES, ALCHEMIA_PROPS, MALL_PROPS, SHOP_SOLID_PROPS, FOODHALL_SOLID_PROPS, ROOF_SOLID_PROPS, CAR_LIFT_PIECES, CAR_LIFT_PROPS, CAR_LIFT_TRAVEL, P1, P1_CABINS, P1_CAR_LIFT, P1_PIECES, P2, P2_PALLETS, P2_ROBOT, P2_SHELL_PIECES, P2_STORE_PIECES, Simulation, type AlchemiaBox } from "../src";
import { shuttleProgress } from "../src/systems/shuttle-system";
import { teleportPlayer } from "./helpers";

/**
 * The car lift from P-1's north hand-over cabin down to P-2's lane (ADR-0074 stage 5e): a platform
 * with a car going up and down by the clock through holes in P-1's deck and P-2's ceiling, inside
 * the cabin's walls at P-1, railed at P-2 but on the lane's side, past the robots' runs.
 */

const H = P1_CAR_LIFT;
const overlap = (a: AlchemiaBox, b: AlchemiaBox): number =>
  Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
const shaft: AlchemiaBox = { x0: H.minX, x1: H.maxX, z0: H.minZ, z1: H.maxZ, y0: P2.floor + 0.01, y1: P1.floor - 0.01 };

describe("the car lift from P-1's cabins to P-2 (ADR-0074 stage 5e)", () => {
  it("runs inside the north cabin's walls, past the last pallets and the robots' runs", () => {
    const cabin = P1_CABINS[1]!;
    expect(H.minX).toBeGreaterThanOrEqual(cabin.minX + 0.2);
    expect(H.maxX).toBeLessThanOrEqual(cabin.maxX - 0.2);
    expect(H.minZ).toBeGreaterThanOrEqual(cabin.minZ + 0.2);
    expect(H.maxZ).toBeLessThanOrEqual(cabin.maxZ - 0.2);
    expect(H.maxZ).toBeLessThan(P2.maxZ - P2.wall);
    for (const p of P2_PALLETS) expect(p.maxZ <= H.minZ || p.minX >= H.maxX + 0.2 || p.maxX <= H.minX - 0.2).toBe(true);
    // The north robot's run ends short of it.
    expect(17.8 + 9.5 + P2_ROBOT.length).toBeLessThan(H.minZ);
    expect(CAR_LIFT_TRAVEL).toBeCloseTo(P1.floor - P2.floor, 6);
  });

  it("has its shaft open through P-1's deck and P-2's ceiling, and nothing else of Alchemia in it", () => {
    const solids = [...P1_PIECES, ...P2_SHELL_PIECES, ...P2_STORE_PIECES, ...ALCHEMIA_PIECES, ...CAR_LIFT_PIECES].filter((p) => p.solid);
    expect(solids.filter((p) => overlap(p.box, shaft) > 1e-6).map((p) => `${p.kind} ${p.box.x0},${p.box.z0},${p.box.y0}`)).toEqual([]);
  });

  it("is the last of Alchemia's props, its platform and car riding up y by the clock, together", () => {
    // The gallery round the atrium (ADR-0093 O1) comes after it, its shops (O2) after the gallery, the food hall's fittings (O3) last.
    // The green roof's solids (ADR-0093 O4) come after the food hall's, the last of Alchemia's.
    const after = MALL_PROPS.length + SHOP_SOLID_PROPS.length + FOODHALL_SOLID_PROPS.length + ROOF_SOLID_PROPS.length;
    expect(ALCHEMIA_PROPS.slice(-CAR_LIFT_PROPS.length - after, -after)).toEqual(CAR_LIFT_PROPS);
    const riders = CAR_LIFT_PROPS.filter((p) => p.mechanism?.kind === "shuttle");
    expect(riders).toHaveLength(3);
    for (const r of riders) expect(r.mechanism).toMatchObject({ axis: "y", travel: CAR_LIFT_TRAVEL });
    expect(new Set(riders.map((r) => (r.mechanism?.kind === "shuttle" ? `${r.mechanism.period}/${r.mechanism.phase}/${r.mechanism.pause}` : "")))).toHaveProperty("size", 1);
  });

  it("brings its platform level with P-2's floor at the bottom and with P-1's at the top, and puts out whoever stands under it", () => {
    const sim = Simulation.create({ seed: 5 });
    teleportPlayer(sim, { x: (H.minX + H.maxX) / 2, y: P2.floor, z: H.minZ - 1.5 });
    sim.step();
    const platform = [...sim.world.with("shuttle", "solid")].find((e) => e.shuttle.key === "alchemia-car-lift")!;
    expect(platform).toBeDefined();
    const s = platform.shuttle;
    const tops = new Set<number>();
    const p = sim.player()!;
    for (let i = 0; i < 60 * 45; i++) {
      sim.step();
      const t = sim.domain.clock.seconds / GAME_SECONDS_PER_REAL_SECOND;
      const at = shuttleProgress(s, t);
      if (at === 0) tops.add(Math.round(platform.solid.max.y * 100) / 100);
      if (at === 1) tops.add(Math.round(platform.solid.max.y * 100) / 100);
      // Nobody stands inside it.
      const b = platform.solid;
      const inside = p.position.x > b.min.x && p.position.x < b.max.x && p.position.z > b.min.z && p.position.z < b.max.z && p.position.y < b.max.y - 0.05 && p.position.y + p.body!.height > b.min.y + 0.05;
      expect(inside, `step ${i}`).toBe(false);
      // Halfway through, she steps under it.
      if (i === 60 * 20) teleportPlayer(sim, { x: (H.minX + H.maxX) / 2, y: P2.floor, z: (H.minZ + H.maxZ) / 2 });
    }
    expect([...tops].sort()).toEqual([Math.round(P2.floor * 100) / 100, Math.round(P1.floor * 100) / 100].sort());
  });
});
