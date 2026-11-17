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

/** The grabs of a ladder, the one from the top in its two parts. */
const GRABS: readonly { readonly end: "top" | "bottom"; readonly part?: "across" | "down" }[] = [
  { end: "top", part: "across" },
  { end: "top", part: "down" },
  { end: "bottom" },
];

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

    // The swing from the top in two parts, across onto the ladder's line and down it (each under
    // a few seconds of steps: 600 after every save).
    for (const { end, part } of GRABS) {
      it(`${key}: saved in any step of the grab at the ${end}${part ? ` (${part})` : ""}, goes on as the game saved from`, () => {
        const { sim, l } = atFoot(key, near);
        if (end === "top") {
          // At the top, her back to the ladder: the swing turns her round to face the wall.
          teleportPlayer(sim, l.exit, l.yaw + Math.PI);
          run(sim, 2);
          sim.step(input({ interact: true }));
        } else {
          // Half a radian off the wall: the grab turns her to it.
          sim.player()!.yaw = l.yaw + 0.5;
          sim.step(input({ moveZ: 1 }));
        }
        const saves: { tick: number; sim: Simulation }[] = [];
        for (let i = 0; i < 60 && sim.player()!.climb?.settle; i++, sim.step(input())) {
          const p = sim.player()!;
          const onLine = Math.hypot(p.position.x - l.x, p.position.z - l.z) < 1e-6;
          if (part === undefined || onLine === (part === "down")) saves.push({ tick: sim.tick, sim: saveAndLoad(sim) });
        }
        expect(saves.length, key).toBeGreaterThan(5);
        // The game saved from, 600 steps after each save.
        const after = new Map<number, { yaw: number; y: number; hash: string }>();
        while (sim.tick < saves.at(-1)!.tick + 600) {
          sim.step(input());
          const p = sim.player()!;
          if (saves.some((s) => s.tick + 600 === sim.tick)) after.set(sim.tick, { yaw: p.yaw, y: p.position.y, hash: hashOf(sim) });
        }
        const off: string[] = [];
        for (const { tick, sim: loaded } of saves) {
          run(loaded, 600);
          const want = after.get(tick + 600)!;
          const q = loaded.player()!;
          // Before (v43): a save in the swing loaded on the roof, or hanging where she was (the
          // swing's y), facing the wall or turned half way; a save in the grab at the foot standing.
          if (Math.abs(q.yaw - want.yaw) > 1e-9 || Math.abs(q.position.y - want.y) > 1e-9 || hashOf(loaded) !== want.hash) {
            off.push(`step ${tick - saves[0]!.tick}: yaw ${(q.yaw - l.yaw).toFixed(3)} y ${q.position.y.toFixed(3)} (${(want.yaw - l.yaw).toFixed(3)}, ${want.y.toFixed(3)})`);
          }
        }
        expect(off, key).toEqual([]);
        expect(sim.player()!.climb?.ladder, key).toBe(key);
        expect(sim.player()!.yaw - l.yaw, key).toBeCloseTo(0, 9);
      });
    }

    it(`${key}: a v43 save in the swing from the top, above where a climb reaches, loads facing the wall`, () => {
      const { sim, l } = atFoot(key, near);
      teleportPlayer(sim, l.exit, l.yaw + Math.PI);
      run(sim, 2);
      sim.step(input({ interact: true }));
      let saves = 0;
      // Above where a climb up reaches (the pull-over starts 0.6 m under the top): only the swing.
      for (let i = 0; i < 60 && sim.player()!.climb?.settle; i++, sim.step(input())) {
        const p = sim.player()!;
        if (Math.hypot(p.position.x - l.x, p.position.z - l.z) > 1e-6 || p.position.y < l.top - 0.6) continue;
        saves++;
        // A save of before v44: no step onto the rungs in it.
        const snap = JSON.parse(JSON.stringify(sim.snapshot(null, "v43", ""))) as ReturnType<Simulation["snapshot"]>;
        const entities = snap.entities.map((e) => (e.key === "player" && e.stance ? { ...e, stance: { ...e.stance, ladderSettle: undefined } } : e));
        const loaded = Simulation.fromSnapshot({ ...snap, entities }, undefined, "off", "off", oldMarketFloorOf(snap));
        run(loaded, 60);
        expect(loaded.player()!.climb?.ladder, `${key} step ${i}`).toBe(key);
        expect(loaded.player()!.yaw - l.yaw, `${key} step ${i}`).toBeCloseTo(0, 9);
      }
      expect(saves, key).toBeGreaterThan(0);
    });
  }
});
