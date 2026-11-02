import { describe, expect, it } from "vitest";
import { Simulation, TPP_AIM_SHOULDER_OFFSET, aimOrigin, eyeOf } from "../src";
import { byKey, collect, input, run, teleportPlayer } from "./helpers";

type Hit = { targetId: number };

/**
 * The guard alone in the alley, the player in TPP 3 m south of it facing north (yaw 0, right is
 * +x), stepped `aside` metres east (west when negative): `TPP_AIM_SHOULDER_OFFSET` east puts the
 * guard on the aim line over the left shoulder, as far west on the one over the right.
 */
const besideGuard = (aside: number) => {
  let sim = Simulation.create({ seed: 11 });
  sim = Simulation.fromSnapshot({ ...sim.snapshot(null, "t", ""), domain: { ...sim.domain, preferences: { ...sim.domain.preferences, cameraMode: "TPP" } } });
  const guard = byKey(sim, "guard")!;
  for (const g of [...sim.world.with("ai")]) if (g !== guard) sim.world.remove(g);
  // A standing target: without its AI the guard neither walks up nor shoots back.
  sim.world.removeComponent(guard, "ai");
  guard.health = { current: 10_000, max: 10_000 };
  teleportPlayer(sim, { x: guard.position.x + aside, y: guard.position.y, z: guard.position.z - 3 }, 0, 0);
  return { sim, guard, hits: collect<Hit>(sim, "DamageDealt") };
};

describe("TPP shots over either shoulder (G-275)", () => {
  it.each([
    ["crouched", true],
    ["standing", false],
  ])("%s and aimed, the shot starts over the shoulder the camera shows and hits what is on that side", (_, crouch) => {
    for (const left of [true, false]) {
      const { sim, guard, hits } = besideGuard(TPP_AIM_SHOULDER_OFFSET);
      run(sim, 40, input({ crouch, aim: true, leftShoulder: left }));
      const p = sim.player()!;
      // The aim line runs past the eye on the chosen side, as the camera's does.
      expect(Math.sign(aimOrigin(p, "TPP", left).x - eyeOf(p).x)).toBe(left ? -1 : 1);
      run(sim, 20, input({ crouch, aim: true, fire: true, leftShoulder: left }));
      const onGuard = hits.filter((h) => h.targetId === guard.id).length;
      // Over the left shoulder the line goes through the guard; over the right it passes 1.6 m east of him.
      if (left) expect(onGuard).toBeGreaterThan(0);
      else expect(onGuard).toBe(0);
    }
  });

  it("keeps to the right shoulder for frames without the side (older replays)", () => {
    const { sim, guard, hits } = besideGuard(-TPP_AIM_SHOULDER_OFFSET);
    run(sim, 40, input({ crouch: true, aim: true }));
    run(sim, 20, input({ crouch: true, aim: true, fire: true }));
    expect(hits.filter((h) => h.targetId === guard.id).length).toBeGreaterThan(0);
  });
});
