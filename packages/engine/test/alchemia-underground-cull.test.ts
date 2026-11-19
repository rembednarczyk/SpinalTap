import { describe, expect, it } from "vitest";
import { CAR_LIFT_RIDERS, DEVICES, P2_ROBOTS, SHELTER_PROPS } from "@seki/sim";
import { alchemiaUndergroundDistance, inAlchemiaUnderground } from "../src/renderer/alchemia/underground-cull";

/**
 * Alchemia's buried levels from afar (ADR-0074 stage 5e): P-2's robots, the car lift's riders, the
 * shelter's gate and Hebi's devices in it are drawn only near P-2 and the shelter; from Zielona's
 * building site (some 170 m off) they are not.
 */
describe("Alchemia's buried props drawn near only (ADR-0074 stage 5e)", () => {
  it("counts P-2's robots, the car lift's riders, the shelter's gate and its devices as down there", () => {
    for (const p of [...P2_ROBOTS, ...CAR_LIFT_RIDERS]) expect(inAlchemiaUnderground(p.center), JSON.stringify(p.center)).toBe(true);
    const gate = SHELTER_PROPS.find((p) => p.mechanism?.kind === "door")!;
    expect(inAlchemiaUnderground(gate.center)).toBe(true);
    for (const d of DEVICES.filter((d) => d.key.startsWith("dev:targ-"))) expect(inAlchemiaUnderground(d.position), d.key).toBe(true);
  });

  it("leaves out the props over the ground: Hana's cart on T1, the lift's cage at T0", () => {
    expect(inAlchemiaUnderground({ x: 429.3, y: -5.5, z: 66 })).toBe(false);
    expect(inAlchemiaUnderground({ x: 413.5, y: -1.0, z: 33.6 })).toBe(false);
  });

  it("is near from inside P-2 and from T0 over it, far from Zielona's building site", () => {
    expect(alchemiaUndergroundDistance({ x: 413.5, y: -7.6, z: 8 })).toBe(0);
    expect(alchemiaUndergroundDistance({ x: 410, y: 0.5, z: 15 })).toBeLessThan(30);
    expect(alchemiaUndergroundDistance({ x: 238.8, y: 1, z: -6.5 })).toBeGreaterThan(100);
  });
});
