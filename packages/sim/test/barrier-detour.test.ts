import { describe, expect, it } from "vitest";
import { nearestBarrier, standOff } from "./barrier-standoff";

/**
 * An alerted ganger and the player on two sides of a long fence or wall of the map (G-625). The
 * way round leaves the near window of the steering (80 m), so it took none and stood pressed
 * against the barrier. Where a way leads round, it walks it and gets its shot; where none does
 * (a walled yard), it leaves the barrier for its post instead of standing at it.
 */

describe("a ganger cut off from the player by a long barrier (G-625)", () => {
  it("walks the long way round a fence (some 85 m, out of the near window) and gets its shot", () => {
    for (const side of [1, -1] as const) {
      const { sim, player, ganger, hp } = standOff(2359.33, 445.19, side);
      for (let i = 0; i < 60 * 40; i++) sim.step();
      const at = `side ${side}: at ${ganger.position.x.toFixed(1)}, ${ganger.position.z.toFixed(1)}`;
      expect(hp - player.health!.current, at).toBeGreaterThan(0);
    }
  }, 120_000);

  it("with no way round, leaves the barrier instead of standing pressed against it", () => {
    // A wall 3 m high round a yard on Krakowskie (seen through: no) and a fence (seen through: yes).
    for (const [x, z] of [
      [214, -28.13],
      [114.7, 85.3],
    ] as const) {
      const { sim, ganger } = standOff(x, z, 1);
      for (let s = 1; s <= 30; s++) {
        for (let i = 0; i < 60; i++) sim.step();
        if (s % 10 !== 0) continue;
        const away = nearestBarrier(ganger.position.x, ganger.position.z);
        expect(away, `barrier at ${x}, ${z}, after ${s} s: ${away.toFixed(2)} m off it`).toBeGreaterThan(2);
      }
    }
  }, 120_000);
});
