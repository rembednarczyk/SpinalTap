import { beforeAll, describe, expect, it } from "vitest";
import { Vector3 } from "../src/babylon";
import { aimLook, aimShot, updateAimTurn } from "../src/renderer/aim-point";
import { animateRig } from "../src/renderer/characters";
import { gunShape, onGun } from "./body-geometry";
import { type Cast, POINTS, arm, cast, heldGun, palmOf } from "./two-hand-cast";

/*
 * The gun points where the crosshair is (the user's ask of 17.11): aimed, the barrel lies on the
 * line from the muzzle to the aim point, so the tracer leaves along it. The point is off to the
 * right and above, and close by, where straight ahead was 30° and more out.
 */

type Kind = "pistol" | "rifle" | "shotgun" | "smg";

/** Plays a second aimed at `point` (world) as the views do: the turn, then the rig, then the model and the gun. */
const aimAt = (c: Cast, point: Vector3, frames = 30): void => {
  for (let i = 0; i < frames; i++) {
    aimShot(c.rig, { x: 0, y: 1.5, z: 0 }, point);
    updateAimTurn(c.rig);
    animateRig(c.rig, 0, 1 / 30, 0, { aim: 1 });
    c.models.update(1 / 30, i / 30);
    c.loadouts.update(c.rig);
  }
};

/** Degrees between the barrel and the line from the muzzle to `point`. */
const offTarget = (c: Cast, point: Vector3): number => {
  const at = new Vector3();
  const dir = new Vector3();
  const held = c.loadouts.muzzle(c.rig, at, dir);
  expect(held?.shown).toBe(true);
  const to = point.subtract(at).normalize();
  return (Math.acos(Math.min(1, Vector3.Dot(dir, to))) * 180) / Math.PI;
};

const SPOTS = [
  { name: "up and to the right, 8 m", point: new Vector3(3, 5.5, 7), slide: 0.12 },
  { name: "down a stair, 6 m", point: new Vector3(-1, -1.5, 6), slide: 0.05 },
  { name: "ahead, 15 m", point: new Vector3(0, 1.5, 15), slide: 0.05 },
] as const;

describe.each([["heroine"], [null]] as const)("the gun points at the aim point: %s", (who) => {
  let c: Cast;
  beforeAll(async () => {
    c = await cast(who);
  }, 60_000);

  it.each(["pistol", "rifle", "shotgun", "smg"] as const)("%s: aimed, the barrel lies on the line to the point", async (kind: Kind) => {
    await arm(c, kind);
    for (const s of SPOTS) {
      aimAt(c, s.point);
      // Before: 26-43° off the points out of line, 6° off the one ahead.
      expect(offTarget(c, s.point), s.name).toBeLessThan(2);
      if (kind === "pistol") continue;
      // Both hands stay on the turned gun; turned far up and aside, the left slides along the fore-end a little (its reach).
      const gun = gunShape(heldGun(c, kind)!);
      expect(Vector3.Distance(palmOf(c, "L"), onGun(gun, ...POINTS[kind].fore)), `${s.name}: left palm`).toBeLessThan(s.slide);
      expect(Vector3.Distance(palmOf(c, "R"), onGun(gun, ...POINTS[kind].grip)), `${s.name}: right palm`).toBeLessThan(0.05);
    }
  });

  it("the player's gun follows the look: pitched up, the barrel rises with it", async () => {
    await arm(c, "pistol");
    const dir = (pitch: number): number => {
      for (let i = 0; i < 30; i++) {
        aimLook(c.rig, { x: 0, y: 0, z: 0 }, 0, pitch, 0);
        updateAimTurn(c.rig);
        animateRig(c.rig, 0, 1 / 30, 0, { aim: 1 });
        c.models.update(1 / 30, i / 30);
        c.loadouts.update(c.rig);
      }
      const at = new Vector3();
      const d = new Vector3();
      c.loadouts.muzzle(c.rig, at, d);
      return d.y;
    };
    // The simulation's pitch is positive looking down.
    expect(dir(-0.5)).toBeGreaterThan(Math.sin(0.5) - 0.05);
    expect(dir(0.4)).toBeLessThan(-Math.sin(0.4) + 0.05);
  });
});
