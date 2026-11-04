import { describe, expect, it } from "vitest";
import { type Entity, CAPSULE_INTERIOR_ROOM, INTERIORS, Simulation, TPP_SHOULDER_OFFSET, aimOrigin, eyeOf, ground, hitscan, lineOfSight, rayGeometry } from "../src";
import { byKey, collect, input, run, teleportPlayer } from "./helpers";

type Hit = { targetId: number };

/**
 * The guard alone in the alley, the player in TPP 2.5 m south of it facing north (yaw 0, right is
 * +x; 3 m puts the crouched aim line in a low solid), stepped `aside` metres east (west when
 * negative): `TPP_SHOULDER_OFFSET` east puts the guard on the aim line over the left shoulder, as
 * far west on the one over the right.
 */
const besideGuard = (aside: number) => {
  let sim = Simulation.create({ seed: 11 });
  sim = Simulation.fromSnapshot({ ...sim.snapshot(null, "t", ""), domain: { ...sim.domain, preferences: { ...sim.domain.preferences, cameraMode: "TPP" } } });
  const guard = byKey(sim, "guard")!;
  for (const g of [...sim.world.with("ai")]) if (g !== guard) sim.world.remove(g);
  // A standing target: without its AI the guard neither walks up nor shoots back.
  sim.world.removeComponent(guard, "ai");
  guard.health = { current: 10_000, max: 10_000 };
  teleportPlayer(sim, { x: guard.position.x + aside, y: guard.position.y, z: guard.position.z - 2.5 }, 0, 0);
  return { sim, guard, hits: collect<Hit>(sim, "DamageDealt") };
};

describe("TPP shots over either shoulder (G-275)", () => {
  it.each([
    ["crouched", true],
    ["standing", false],
  ])("%s and aimed, the shot starts over the shoulder the camera shows and hits what is on that side", (_, crouch) => {
    for (const left of [true, false]) {
      const { sim, guard, hits } = besideGuard(TPP_SHOULDER_OFFSET);
      run(sim, 40, input({ crouch, aim: true, leftShoulder: left }));
      const p = sim.player()!;
      // The aim line runs past the eye on the chosen side, as the camera's does.
      expect(Math.sign(aimOrigin(p, "TPP", left).x - eyeOf(p).x)).toBe(left ? -1 : 1);
      run(sim, 20, input({ crouch, aim: true, fire: true, leftShoulder: left }));
      const onGuard = hits.filter((h) => h.targetId === guard.id).length;
      // Over the left shoulder the line goes through the guard; over the right it passes 1.1 m east of him.
      if (left) expect(onGuard).toBeGreaterThan(0);
      else expect(onGuard).toBe(0);
    }
  });

  it("keeps to the right shoulder for frames without the side (older replays)", () => {
    const { sim, guard, hits } = besideGuard(-TPP_SHOULDER_OFFSET);
    run(sim, 40, input({ crouch: true, aim: true }));
    run(sim, 20, input({ crouch: true, aim: true, fire: true }));
    expect(hits.filter((h) => h.targetId === guard.id).length).toBeGreaterThan(0);
  });
});

/** The player as the shots see her at `x, z` on the floor `y`, crouched and aimed in TPP. */
const crouchedAt = (x: number, y: number, z: number, yaw: number): Entity =>
  ({
    id: -1,
    position: { x, y, z },
    prevPosition: { x, y, z },
    yaw,
    prevYaw: yaw,
    pitch: 0,
    posture: { crouched: true, amount: 1, prevAmount: 1, sprinting: false, aiming: true, aim: 1, prevAim: 1 },
  }) as Entity;

describe("TPP shots by a wall on the shoulder's side (G-275)", () => {
  it("from the capsule's front wall, crouched and aimed, do not reach a guard in the street", () => {
    for (const crouch of [true, false]) {
      let sim = Simulation.create({ seed: 11 });
      sim = Simulation.fromSnapshot({ ...sim.snapshot(null, "t", ""), domain: { ...sim.domain, preferences: { ...sim.domain.preferences, cameraMode: "TPP" } } });
      const room = CAPSULE_INTERIOR_ROOM;
      // Facing east along the front (south) wall, the right shoulder against it.
      const at = { x: room.minX + 0.9, y: room.bottom, z: room.minZ + 0.385 };
      const guard = byKey(sim, "guard")!;
      for (const g of [...sim.world.with("ai")]) if (g !== guard) sim.world.remove(g);
      sim.world.removeComponent(guard, "ai");
      guard.health = { current: 10_000, max: 10_000 };
      guard.position = guard.prevPosition = ground(at.x + 6, at.z - 0.8);
      teleportPlayer(sim, at, Math.PI / 2, 0);
      const hits = collect<Hit>(sim, "DamageDealt");
      run(sim, 40, input({ crouch, aim: true }));
      teleportPlayer(sim, at, Math.PI / 2, 0);
      run(sim, 20, input({ crouch, aim: true, fire: true }));
      // Before the fix the aim line stood 0.8 m out, in the street past the facade.
      expect(aimOrigin(sim.player()!, "TPP").z).toBeGreaterThan(room.minZ - 0.3);
      expect(hits.filter((h) => h.targetId === guard.id)).toHaveLength(0);
    }
  });

  it("from inside the rooms, crouched and aimed with a wall on the right, start past a wall no more often than before G-275", () => {
    let leaks = 0;
    let places = 0;
    for (const def of INTERIORS) {
      for (const r of def.rooms) {
        const sim = Simulation.create({ seed: 11 });
        teleportPlayer(sim, { x: (r.minX + r.maxX) / 2, y: r.bottom, z: (r.minZ + r.maxZ) / 2 }, 0, 0);
        run(sim, 20);
        const w = sim.world;
        const inSolid = (p: { x: number; y: number; z: number }) =>
          [{ x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 }].every((d) => (rayGeometry(w, p, d, 0.05) ?? 1) < 1e-4);
        const m = 0.39;
        // Along each wall, facing so that the wall is on the right (right of yaw is (cos, -sin)).
        const walls = [
          { yaw: 0, from: [r.maxX - m, r.minZ + 0.3], to: [r.maxX - m, r.maxZ - 0.3] },
          { yaw: Math.PI, from: [r.minX + m, r.minZ + 0.3], to: [r.minX + m, r.maxZ - 0.3] },
          { yaw: Math.PI / 2, from: [r.minX + 0.3, r.minZ + m], to: [r.maxX - 0.3, r.minZ + m] },
          { yaw: -Math.PI / 2, from: [r.minX + 0.3, r.maxZ - m], to: [r.maxX - 0.3, r.maxZ - m] },
        ] as const;
        for (const s of walls) {
          const len = Math.hypot(s.to[0] - s.from[0], s.to[1] - s.from[1]);
          for (let d = 0; d <= len; d += 0.25) {
            const p = crouchedAt(s.from[0] + ((s.to[0] - s.from[0]) * d) / len, r.bottom, s.from[1] + ((s.to[1] - s.from[1]) * d) / len, s.yaw);
            const eye = eyeOf(p);
            if (inSolid(eye)) continue;
            places++;
            const o = aimOrigin(p, "TPP");
            // Past a wall, in the open on the other side, with a clear metre of flight from there.
            if (!lineOfSight(w, eye, o, false) && !inSolid(o) && hitscan(w, o, { x: Math.sin(s.yaw), y: 0, z: Math.cos(s.yaw) }, 30, -1).distance > 1) leaks++;
          }
        }
      }
    }
    expect(places).toBeGreaterThan(700);
    // 8 of 739 with the aim line 0.55 m out (before G-275 and now), 388 with 0.8 m.
    expect(leaks).toBeLessThanOrEqual(8);
  });
});
