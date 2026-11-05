import { describe, expect, it } from "vitest";
import type { Vec3 } from "@seki/core";
import { Simulation, docks, market } from "../src";
import type { LadderDef } from "../src/world/components";
import { collect, input, run, teleportPlayer } from "./helpers";

/** Every ladder of the game, by where to stand for its chunk to be streamed in. */
const LADDERS: readonly { readonly key: string; readonly near: Vec3 }[] = [
  { key: "targ-escape-1", near: market(72, 4.5, 64.65) },
  { key: "targ-escape-2", near: market(69.2, 4.5, 64.6) },
  { key: "targ-escape-3", near: market(80, 4.5, 62) },
  { key: "doki-stack-1", near: docks(3, 0, 98) },
  { key: "doki-stack-2", near: docks(4, 0, 98) },
];

/** Where a grab from the top puts her on the rungs, below the top (as `TOP_GRAB_DROP`). */
const GRAB_DEPTH = 0.8;

/** A game with the ladder's chunk streamed in and nobody around to shoot her. */
const near = (at: Vec3): Simulation => {
  const sim = Simulation.create({ seed: 1 });
  teleportPlayer(sim, at);
  run(sim, 2);
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  return sim;
};

const ladderIn = (sim: Simulation, key: string): LadderDef => {
  const l = [...sim.world.with("ladder")].find((e) => e.ladder.key === key)?.ladder;
  if (!l) throw new Error(`no ladder ${key}`);
  return l;
};

/**
 * The nearest guard knocked out and on her shoulder (ADR-0065), picked up where she stands:
 * one of the content's, so the save keeps it. The other guards are gone.
 */
const shoulder = (sim: Simulation): void => {
  const p = sim.player()!;
  const away = (e: { position: Vec3 }) => Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z);
  const g = [...sim.world.with("ai")].sort((a, b) => away(a) - away(b))[0];
  if (!g) throw new Error("no guard");
  for (const other of [...sim.world.with("ai")]) if (other !== g) sim.world.remove(other);
  g.position = { ...p.position };
  sim.world.addComponent(g, "unconscious", true);
  sim.world.addComponent(g, "downed", {
    playerAt: { ...p.position },
    fought: false,
    found: false,
    reported: false,
    finder: null,
    wake: 0,
    dead: false,
    lookedBy: [],
    carried: false,
    hidden: false,
    frame: null,
  });
  sim.step(input());
  sim.enqueue({ type: "carry-body" });
  sim.step(input());
  expect(sim.session.carrying).toBe(g.id);
};

/** A copy of `sim` as saved now (where she was), run for `steps` without input; whether she landed after a drop. */
const loadAndRun = (sim: Simulation, steps: number): { sim: Simulation; saved: Vec3; fell: boolean } => {
  const saved = { ...sim.player()!.position };
  const loaded = Simulation.fromSnapshot(sim.snapshot(null, "ladder", ""));
  const landed = collect<{ drop: number }>(loaded, "Landed");
  run(loaded, steps);
  return { sim: loaded, saved, fell: landed.some((d) => d.drop > 0.5) };
};

/**
 * After loading she stands where she was saved, or is settled on the rungs: never hanging with
 * her feet at the roof's height (in the air by the edge), and unhurt.
 */
const settled = (loaded: Simulation, l: LadderDef, saved: Vec3, what: string): void => {
  const p = loaded.player()!;
  if (p.climb) {
    expect(p.climb.ladder, what).toBe(l.key);
    expect(Math.hypot(p.position.x - l.x, p.position.z - l.z), what).toBeLessThan(1e-6);
    expect(p.position.y, what).toBeLessThan(l.top - 0.05 + 1e-9);
    expect(p.position.y, what).toBeGreaterThan(l.top - GRAB_DEPTH - 1e-9);
  } else {
    const moved = Math.hypot(p.position.x - saved.x, p.position.y - saved.y, p.position.z - saved.z);
    expect(moved, `${what}: moved ${moved} m, y ${p.position.y - l.top}`).toBeLessThan(1e-6);
  }
  expect(p.health?.current, what).toBe(100);
};

describe("loading a game saved by a ladder's top (G-313)", () => {
  for (const { key, near: at } of LADDERS) {
    it(`${key}: on the roof she stays where she stood; over the gap she is on the rungs`, () => {
      const base = near(at);
      const l = ladderIn(base, key);
      const dx = l.exit.x - l.x;
      const dz = l.exit.z - l.z;
      const len = Math.hypot(dx, dz);
      let roof = 0;
      let gap = 0;
      // Along the way from the ladder's line to its exit and beside it, every 5 cm.
      for (let s = 0; s <= len + 1e-9; s += 0.05) {
        for (const side of [-0.15, 0, 0.15]) {
          const point = { x: l.x + (dx * s - dz * side) / len, y: l.top, z: l.z + (dz * s + dx * side) / len };
          const b = base.player()!;
          delete b.climb;
          delete b.fall;
          delete b.airPeak;
          b.velocity = { x: 0, y: 0, z: 0 };
          teleportPlayer(base, point);
          const saved = base.snapshot(null, "probe", "");
          // Whether she stands there: a step without loading leaves her on the floor under her.
          base.step(input());
          const stands = !b.climb && Math.abs(b.position.y - l.top) < 1e-6;
          const what = `${key} ${s.toFixed(2)} m, ${side} m aside`;
          const loaded = Simulation.fromSnapshot(saved);
          const landed = collect<{ drop: number }>(loaded, "Landed");
          run(loaded, 10);
          const fell = landed.some((d) => d.drop > 0.5);
          expect(fell, `${what}: fell`).toBe(false);
          const p = loaded.player()!.position;
          if (stands) {
            roof++;
            // Before: within half the way to the exit she was moved onto the ladder's top.
            expect(Math.hypot(p.x - point.x, p.y - point.y, p.z - point.z), `${what}: moved off the roof`).toBeLessThan(1e-6);
            expect(loaded.player()!.climb, what).toBeUndefined();
          } else {
            gap++;
            expect(loaded.player()!.climb?.ladder, `${what}: not on the rungs`).toBe(key);
            expect(p.y, what).toBeCloseTo(l.top - GRAB_DEPTH, 6);
          }
          settled(loaded, l, point, what);
        }
      }
      expect(roof).toBeGreaterThan(0);
      expect(gap).toBeGreaterThan(0);
    });

    it(`${key}: a game saved in any step of the swing or the pull-over loads without a fall`, () => {
      // Down: the interact key at the top, saved in every step of the swing.
      const down = near(at);
      const l = ladderIn(down, key);
      teleportPlayer(down, l.exit);
      run(down, 2);
      down.step(input({ interact: true }));
      expect(down.player()!.climb?.ladder).toBe(key);
      for (let k = 0; k < 40; k++) {
        const { sim, saved, fell } = loadAndRun(down, 10);
        expect(fell, `swing ${k}: fell`).toBe(false);
        settled(sim, l, saved, `swing ${k}`);
        down.step(input());
      }
      // Up: from where the swing ended, the pull-over, saved in every step of it.
      for (let i = 0; i < 300 && down.player()!.climb; i++) down.step(input({ moveZ: 1 }));
      expect(down.player()!.mantle).toBeDefined();
      for (let k = 0; k <= 40; k++) {
        const { sim, saved, fell } = loadAndRun(down, 10);
        expect(fell, `pull-over ${k}: fell`).toBe(false);
        settled(sim, l, saved, `pull-over ${k}`);
        down.step(input());
      }
      expect(Math.abs(down.player()!.position.y - l.top)).toBeLessThan(1e-6);
    });

    it(`${key}: a game saved in the first steps of a fall off the edge about 1 m aside loads falling`, () => {
      const sim = near(at);
      const l = ladderIn(sim, key);
      // Facing over the edge, the way from the exit to the ladder's line.
      const yaw = Math.atan2(l.x - l.exit.x, l.z - l.exit.z);
      let saves = 0;
      for (const side of [-1, 1]) {
        // Beyond the reach of the catch (0.7 m from the line): she falls past the rungs live too.
        const start = { x: l.exit.x + Math.cos(yaw) * side, y: l.top, z: l.exit.z - Math.sin(yaw) * side };
        const p = sim.player()!;
        delete p.climb;
        delete p.fall;
        delete p.airPeak;
        p.velocity = { x: 0, y: 0, z: 0 };
        teleportPlayer(sim, start, yaw);
        run(sim, 2);
        for (let i = 0; i < 60 && p.position.y > l.top - 0.05; i++) {
          sim.step(input({ moveZ: 1 }));
          const aside = Math.hypot(p.position.x - l.x, p.position.z - l.z);
          // Only off the edge well past the catch's reach (on the first ladder's balcony one
          // side runs along the wall towards the line).
          if (p.fall === undefined || p.position.y <= l.top - 0.05 || aside < 0.85) continue;
          expect(p.climb, `${side} m aside, live`).toBeUndefined();
          saves++;
          const what = `${side} m aside, step ${i}, ${aside.toFixed(2)} m from the line`;
          const { sim: loaded, saved } = loadAndRun(sim, 5);
          const q = loaded.player()!;
          // Before (a reach of 1.5 m): moved 1.25-1.48 m onto the rungs.
          expect(q.climb, what).toBeUndefined();
          expect(Math.hypot(q.position.x - saved.x, q.position.z - saved.z), what).toBeLessThan(0.3);
          expect(q.position.y, what).toBeLessThan(saved.y);
        }
      }
      expect(saves).toBeGreaterThan(0);
    });
  }

  it("with a body on her shoulder, a game saved over the gap loads on the roof, not in a fall", () => {
    // The market's: the docks have no guards to carry in a new game.
    for (const { key, near: at } of LADDERS.slice(0, 3)) {
      const sim = Simulation.create({ seed: 1 });
      teleportPlayer(sim, at);
      run(sim, 2);
      const l = ladderIn(sim, key);
      teleportPlayer(sim, l.exit);
      run(sim, 2);
      shoulder(sim);
      // Over the gap, a fifth of the way from the line to the exit.
      teleportPlayer(sim, { x: l.x + (l.exit.x - l.x) * 0.2, y: l.top, z: l.z + (l.exit.z - l.z) * 0.2 });
      const { sim: loaded, fell } = loadAndRun(sim, 30);
      expect(loaded.session.carrying, key).not.toBeNull();
      expect(fell, `${key}: fell`).toBe(false);
      const p = loaded.player()!;
      expect(p.climb, key).toBeUndefined();
      expect(Math.hypot(p.position.x - l.exit.x, p.position.y - l.exit.y, p.position.z - l.exit.z), key).toBeLessThan(1e-6);
    }
  });
});
