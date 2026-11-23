import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { Color4, type ParticleSystem, Scene, type Vector3 } from "../src/babylon";
import { STEAM_REACH, SteamVents } from "../src/renderer/steam-vents";

/*
 * The street's steam steams near the camera only (#957): a running particle system is a draw call wherever the
 * camera is, and every vent of Krakowskie Przedmieście cost one in W-3's night scene at the other end of the city.
 */

/** A vent's system as the culling sees it: started or not, and its puffs (a running one has some, a reset one none). */
interface Fake {
  readonly at: Vector3;
  started: boolean;
  puffs: number;
}

const tint = new Color4(1, 1, 1, 0.3);
const vents = () => {
  const made: Fake[] = [];
  const make = (_scene: Scene, at: Vector3): ParticleSystem => {
    const f: Fake = { at, started: true, puffs: 12 };
    made.push(f);
    return {
      start: () => {
        f.started = true;
        f.puffs = 12;
      },
      stop: () => {
        f.started = false;
      },
      reset: () => {
        f.puffs = 0;
      },
    } as unknown as ParticleSystem;
  };
  const steam = new SteamVents(
    new Scene(new NullEngine()),
    [
      { at: { x: 0, y: 0, z: 0 }, tint, rate: 20 },
      { at: { x: 400, y: 0, z: 0 }, tint, rate: 20 },
    ],
    make,
  );
  return { steam, made };
};

describe("the street's steam (#957)", () => {
  it("steams none until the camera comes, then only the vents within its reach", () => {
    const { steam, made } = vents();
    expect(made.map((f) => [f.started, f.puffs])).toEqual([
      [false, 0],
      [false, 0],
    ]);
    steam.follow({ x: STEAM_REACH - 1, z: 0 });
    expect(steam.running).toBe(1);
    expect(made.map((f) => f.started)).toEqual([true, false]);
  });

  it("stops a vent left behind and drops its puffs at once, so it draws nothing far off", () => {
    const { steam, made } = vents();
    steam.follow({ x: 0, z: 0 });
    steam.follow({ x: 400, z: 0 });
    expect(made[0]).toMatchObject({ started: false, puffs: 0 });
    expect(made[1]).toMatchObject({ started: true });
    expect(steam.running).toBe(1);
  });
});
