import { describe, expect, it } from "vitest";
import type { Vec3 } from "@seki/core";
import { Simulation, ground, stateHash } from "../src";
import type { LadderDef } from "../src/world/components";
import { market, oldMarketFloor, oldMarketFloorOf } from "./fixtures/old-market";
import { input, run, teleportPlayer } from "./helpers";

/** Ladders of W-3 and of the old market's test floor, by where to stand for the chunk to be streamed in. */
const LADDERS: readonly { readonly key: string; readonly near: Vec3 }[] = [
  { key: "w3-hatch", near: ground(2564, 439.3) },
  { key: "w3-pipe", near: ground(2444, 440.6) },
  { key: "targ-escape-1", near: market(72, 4.5, 64.65) },
];

const hashOf = (sim: Simulation): string => stateHash(sim.snapshot(null, "test", ""));

/** A new game with her at the foot of ladder `key`, facing it. */
const atFoot = (key: string, near: Vec3): { sim: Simulation; l: LadderDef } => {
  const sim = Simulation.create({ seed: 1, ...oldMarketFloor(near) });
  teleportPlayer(sim, near);
  run(sim, 2);
  const l = [...sim.world.with("ladder")].find((e) => e.ladder.key === key)?.ladder;
  if (!l) throw new Error(`no ladder ${key}`);
  const p = sim.player()!;
  delete p.fall;
  delete p.airPeak;
  p.velocity = { x: 0, y: 0, z: 0 };
  teleportPlayer(sim, { x: l.x - Math.sin(l.yaw) * 0.3, y: l.bottom, z: l.z - Math.cos(l.yaw) * 0.3 }, l.yaw);
  run(sim, 2);
  return { sim, l };
};

/** Saved as the game saves (calmForSave first), through JSON as on disk, and loaded. */
const saveAndLoad = (sim: Simulation): Simulation => {
  sim.calmForSave();
  const snap = JSON.parse(JSON.stringify(sim.snapshot(null, "ladder", ""))) as ReturnType<Simulation["snapshot"]>;
  return Simulation.fromSnapshot(snap, undefined, "off", "off", oldMarketFloorOf(snap));
};

describe("a game saved on a ladder after looking around (G-913)", () => {
  for (const { key, near } of LADDERS) {
    it(`${key}: loads facing where she looked, and goes on as the game saved from`, () => {
      const { sim, l } = atFoot(key, near);
      for (let i = 0; i < 40; i++) sim.step(input({ moveZ: 1 }));
      expect(sim.player()!.climb?.ladder, key).toBe(key);
      // On the rungs the view turns freely (player control), 1 rad off the wall.
      for (let i = 0; i < 10; i++) sim.step(input({ lookYaw: 0.1 }));
      const p = sim.player()!;
      expect(p.yaw - l.yaw, key).toBeCloseTo(1, 6);
      const loaded = saveAndLoad(sim);
      run(sim, 600);
      run(loaded, 600);
      const q = loaded.player()!;
      expect(q.climb?.ladder, key).toBe(key);
      expect(q.position.y, key).toBeCloseTo(p.position.y, 9);
      // Before: the load turned her back to the wall (yaw 0 off it, 1 rad in the game saved from).
      expect(q.yaw, key).toBeCloseTo(p.yaw, 9);
      expect(hashOf(loaded), key).toBe(hashOf(sim));
    });

    it(`${key}: saved in the swing down onto the rungs from the top, loads facing the wall, as the swing ends`, () => {
      const { sim, l } = atFoot(key, near);
      // At the top, her back to the ladder: the swing turns her round to face the wall.
      teleportPlayer(sim, l.exit, l.yaw + Math.PI);
      run(sim, 2);
      sim.step(input({ interact: true }));
      let saves = 0;
      // Above where a climb up reaches (the pull-over starts 0.6 m under the top): only the swing.
      for (let i = 0; i < 60 && sim.player()!.climb?.settle; i++, sim.step(input())) {
        const p = sim.player()!;
        if (Math.hypot(p.position.x - l.x, p.position.z - l.z) > 1e-6 || p.position.y < l.top - 0.6) continue;
        saves++;
        const loaded = saveAndLoad(sim);
        run(loaded, 60);
        expect(loaded.player()!.climb?.ladder, `${key} step ${i}`).toBe(key);
        expect(loaded.player()!.yaw - l.yaw, `${key} step ${i}`).toBeCloseTo(0, 9);
      }
      expect(saves, key).toBeGreaterThan(0);
      expect(sim.player()!.yaw - l.yaw, key).toBeCloseTo(0, 9);
    });
  }
});
