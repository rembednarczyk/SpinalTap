import { describe, expect, it } from "vitest";
import { chaseDetour, followDetour, planDetour } from "../src/systems/ai/steering";
import { BYSTRZYCA_FENCE, FENCED_YARD, WALLED_YARD, nearestBarrier, standOff } from "./fixtures/barrier-floor";

/**
 * An alerted ganger and the player on two sides of a long fence or wall of the map (G-625). The
 * way round leaves the near window of the steering (80 m), so it took none and stood pressed
 * against the barrier. Where a way leads round, it walks it and gets its shot; where none does
 * (a walled yard), it leaves the barrier for its post instead of standing at it. On the floors of
 * the map's barriers there (`barrier-floor.ts`): the rule needs the barriers, not the city.
 */

describe("a ganger cut off from the player by a long barrier (G-625)", () => {
  it("walks the long way round a fence (some 85 m, out of the near window) and gets its shot", () => {
    for (const side of [1, -1] as const) {
      const { sim, player, ganger, hp } = standOff(BYSTRZYCA_FENCE, side);
      for (let i = 0; i < 60 * 40; i++) sim.step();
      const at = `side ${side}: at ${ganger.position.x.toFixed(1)}, ${ganger.position.z.toFixed(1)}`;
      expect(hp - player.health!.current, at).toBeGreaterThan(0);
    }
  });

  it("with no way round, leaves the barrier instead of standing pressed against it", () => {
    // A wall 3 m high round a yard on Krakowskie (seen through: no) and a fence (seen through: yes).
    for (const yard of [WALLED_YARD, FENCED_YARD]) {
      const { sim, chunks, player, ganger } = standOff(yard, 1);
      const near = planDetour(sim.world, ganger.position, player.position);
      const wide = chaseDetour(sim.world, ganger.position, player.position);
      expect([near && followDetour(near, ganger.position), wide && followDetour(wide, ganger.position)], `no way round the yard at ${yard.x}, ${yard.z}`).toEqual([null, null]);
      for (let s = 1; s <= 30; s++) {
        for (let i = 0; i < 60; i++) sim.step();
        if (s % 10 !== 0) continue;
        const away = nearestBarrier(chunks, ganger.position.x, ganger.position.z);
        expect(away, `barrier at ${yard.x}, ${yard.z}, after ${s} s: ${away.toFixed(2)} m off it`).toBeGreaterThan(2);
      }
    }
  });
});
