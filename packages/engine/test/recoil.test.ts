import { beforeAll, describe, expect, it } from "vitest";
import { Vector3 } from "../src/babylon";
import { animateRig } from "../src/renderer/characters";
import { BODY_CLIPS } from "../src/renderer/clips/body-clips.generated";
import { poseBodyFromClips } from "../src/renderer/clips/body-pose";
import { startRecoil } from "../src/renderer/clips/recoil";
import { type Cast, arm, cast, palmOf } from "./two-hand-cast";

/*
 * A shot's kick from Mixamo's "firing rifle" (ADR-0090): the gun goes back along its barrel some
 * 3 cm (a pistol's barrel flips up with it) and the torso jolts, then all is as before the shot.
 */

const DT = 1 / 60;

/** One frame as the views run it, then the gun where the hands hold it. */
const frame = (c: Cast): void => {
  // The idle clock stands still (no sway), so only the kick moves the gun.
  animateRig(c.rig, 0, DT, 0, { aim: 1 }, { clock: 0 });
  poseBodyFromClips(c.rig, 0, DT, 0);
  c.models.update(DT, 0);
  c.loadouts.update(c.rig);
};

const muzzle = (c: Cast): { at: Vector3; dir: Vector3 } => {
  const at = new Vector3();
  const dir = new Vector3();
  c.loadouts.muzzle(c.rig, at, dir);
  return { at, dir };
};

describe.each([["heroine"], [null]] as const)("a shot's kick: %s", (who) => {
  let c: Cast;
  beforeAll(async () => {
    c = await cast(who);
  }, 60_000);

  it.each(["rifle", "smg", "pistol"] as const)("%s: the gun goes back and comes forward again", async (kind) => {
    await arm(c, kind);
    for (let i = 0; i < 60; i++) frame(c);
    const rest = muzzle(c);
    const hands = () => Vector3.Distance(palmOf(c, "L"), palmOf(c, "R"));
    const apart = hands();
    startRecoil(c.rig);
    let back = 0;
    let flip = 0;
    let slip = 0;
    for (let i = 0; i < Math.ceil(BODY_CLIPS.fire.cycle / DT); i++) {
      frame(c);
      const m = muzzle(c);
      back = Math.max(back, Vector3.Dot(rest.at.subtract(m.at), rest.dir));
      flip = Math.max(flip, m.dir.y - rest.dir.y);
      slip = Math.max(slip, Math.abs(hands() - apart));
    }
    // The hands go together: the supporting one stays on the gun.
    expect(slip).toBeLessThan(0.01);
    // Some 3 cm back along the barrel at the most (more for a long gun: the torso goes back too).
    expect(back).toBeGreaterThan(0.015);
    expect(back).toBeLessThan(0.08);
    if (kind === "pistol") expect(flip).toBeGreaterThan(Math.sin((2 * Math.PI) / 180));
    for (let i = 0; i < 10; i++) frame(c);
    const after = muzzle(c);
    expect(Vector3.Distance(after.at, rest.at)).toBeLessThan(0.003);
  });
});
