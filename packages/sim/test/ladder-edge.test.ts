import { describe, expect, it } from "vitest";
import type { CyberwareLoadout, InputFrame, Vec3 } from "@seki/core";
import { Simulation, docks, gangerEntity, market } from "../src";
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

/**
 * A new game with the player standing at `position`, facing `yaw`, nobody around to shoot her
 * (with these implants, when given).
 */
const standing = (near: Vec3, position: Vec3, yaw: number, cyberware?: CyberwareLoadout): Simulation => {
  let sim = Simulation.create({ seed: 1 });
  teleportPlayer(sim, near);
  run(sim, 2);
  if (cyberware) {
    const snap = sim.snapshot(null, "t", "");
    sim = Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, character: { ...snap.domain.character, cyberware } } });
  }
  teleportPlayer(sim, position, yaw);
  // Not falling from wherever `near` put her.
  delete sim.player()!.fall;
  delete sim.player()!.airPeak;
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  run(sim, 2);
  return sim;
};

const ladderOf = (key: string, near: Vec3): LadderDef => {
  const sim = Simulation.create({ seed: 1 });
  teleportPlayer(sim, near);
  run(sim, 2);
  const l = [...sim.world.with("ladder")].find((e) => e.ladder.key === key)?.ladder;
  if (!l) throw new Error(`no ladder ${key}`);
  return l;
};

/** The heading from `a` to `b` (forward is (sin yaw, cos yaw)). */
const heading = (a: Vec3, b: Pick<Vec3, "x" | "z">): number => Math.atan2(b.x - a.x, b.z - a.z);

interface Walk {
  readonly caught: boolean;
  readonly landed: number;
  /** Longest move of the player in one step, metres. */
  readonly longest: number;
  /** Largest turn of her facing in one step, radians. */
  readonly turn: number;
}

/** Steps `frame` until she is on the rungs or has landed (at most `limit` steps). */
const walk = (sim: Simulation, frame: InputFrame, limit = 240): Walk => {
  const landed = collect<{ drop: number }>(sim, "Landed");
  let longest = 0;
  let turn = 0;
  for (let i = 0; i < limit && landed.length === 0; i++) {
    const p = sim.player()!;
    const from = { ...p.position };
    const yaw = p.yaw;
    sim.step(frame);
    longest = Math.max(longest, Math.hypot(p.position.x - from.x, p.position.y - from.y, p.position.z - from.z));
    turn = Math.max(turn, Math.abs(Math.atan2(Math.sin(p.yaw - yaw), Math.cos(p.yaw - yaw))));
    if (p.climb && !p.climb.settle) break;
  }
  const p = sim.player()!;
  return { caught: p.climb !== undefined, landed: landed.length, longest, turn };
};

describe("stepping off a roof over a ladder's top (G-308)", () => {
  for (const { key, near } of LADDERS) {
    const l = ladderOf(key, near);
    const out = heading(l.exit, l);
    const onRungs = (sim: Simulation) => {
      const p = sim.player()!;
      expect(p.climb?.ladder).toBe(key);
      expect(Math.hypot(p.position.x - l.x, p.position.z - l.z)).toBeLessThan(1e-6);
      expect(p.position.y).toBeCloseTo(l.top - 0.8, 5);
      expect(Math.abs(Math.atan2(Math.sin(p.yaw - l.yaw), Math.cos(p.yaw - l.yaw)))).toBeLessThan(1e-6);
    };

    it(`${key}: walking forward over the edge catches the top of the ladder`, () => {
      const sim = standing(near, l.exit, out);
      const w = walk(sim, input({ moveZ: 1 }));
      // Before: she fell 2.6-4.6 m past the rungs.
      expect(w).toMatchObject({ caught: true, landed: 0 });
      expect(w.longest).toBeLessThan(0.2);
      expect(w.turn).toBeLessThan(0.2);
      onRungs(sim);
    });

    it(`${key}: walking backwards over the edge catches it too`, () => {
      const sim = standing(near, l.exit, out + Math.PI);
      const w = walk(sim, input({ moveZ: -1 }));
      expect(w).toMatchObject({ caught: true, landed: 0 });
      expect(w.longest).toBeLessThan(0.2);
      onRungs(sim);
    });

    it(`${key}: walking along the roof through the exit does not pull her onto the ladder`, () => {
      // Across the way over the edge, through the exit and past the ladder's top, on the roof
      // (on the balcony of the first ladder, between the wall and the rail).
      const sim = standing(near, l.exit, out + Math.PI / 2);
      const p = sim.player()!;
      const from = (d: number) => (p.position.x - l.exit.x) * Math.sin(p.yaw) + (p.position.z - l.exit.z) * Math.cos(p.yaw) - d;
      for (let i = 0; i < 15 && from(-0.7) > 0; i++) sim.step(input({ moveZ: -1 }));
      for (let i = 0; i < 30 && from(0.7) < 0; i++) {
        sim.step(input({ moveZ: 1 }));
        expect(p.climb).toBeUndefined();
      }
      expect(p.position.y).toBeCloseTo(l.top, 5);
    });
  }

  it("walking along the very edge past the ladder's top stays on the roof", () => {
    const l = ladderOf("targ-escape-2", LADDERS[1]!.near);
    // The roof's edge runs along x, 0.4 m from the ladder's line; she walks 0.1 m inside it.
    const sim = standing(LADDERS[1]!.near, { x: l.x - 1.5, y: l.top, z: l.z - 0.5 }, Math.PI / 2);
    const w = walk(sim, input({ moveZ: 1 }), 100);
    expect(w.caught).toBe(false);
    expect(w.landed).toBe(0);
    expect(sim.player()!.position.x).toBeGreaterThan(l.x + 1);
    expect(sim.player()!.position.y).toBeCloseTo(l.top, 5);
  });

  it("a sprint or a jump over the edge still leaves the ladder behind", () => {
    const { key, near } = LADDERS[1]!;
    const l = ladderOf(key, near);
    const sprint = standing(near, l.exit, heading(l.exit, l));
    expect(walk(sprint, input({ moveZ: 1, sprint: true }))).toMatchObject({ caught: false, landed: 1 });
    const jump = standing(near, l.exit, heading(l.exit, l));
    run(jump, 8, input({ moveZ: 1 }));
    jump.step(input({ moveZ: 1, jump: true }));
    expect(walk(jump, input({ moveZ: 1 }))).toMatchObject({ caught: false, landed: 1 });
  });
});

/** A knocked-out Tessen guard on her shoulder (ADR-0065), picked up where she stands. */
const shoulder = (sim: Simulation): void => {
  const p = sim.player()!;
  const g = sim.world.add(gangerEntity(4000, { key: "carried", position: { ...p.position }, yaw: 0 }, null, 80, p.chunk ?? "", undefined, "tessen_guard"));
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

describe("what does not catch the top of a ladder (G-308)", () => {
  const LEGS: CyberwareLoadout = { optics: "hitomi_optics_mk1", skeleton: "kitsune_tendons" };
  /** Where she stands `side` metres along the edge from the exit, facing the way over it. */
  const beside = (l: LadderDef, side: number): { at: Vec3; yaw: number } => {
    const yaw = heading(l.exit, l);
    return { at: { x: l.exit.x + Math.cos(yaw) * side, y: l.exit.y, z: l.exit.z - Math.sin(yaw) * side }, yaw };
  };

  for (const { key, near } of LADDERS) {
    const l = ladderOf(key, near);
    const { at, yaw } = beside(l, 0);

    it(`${key}: a dash over the edge flies past the rungs`, () => {
      const sim = standing(near, at, yaw, LEGS);
      sim.step(input({ moveZ: 1, dash: true }));
      expect(sim.player()!.perks?.dash ?? 0).toBeGreaterThan(0);
      expect(walk(sim, input({ moveZ: 1 }))).toMatchObject({ caught: false, landed: 1 });
    });

    it(`${key}: a sprint let go of in the air keeps its momentum past the rungs`, () => {
      const sim = standing(near, at, yaw);
      const p = sim.player()!;
      for (let i = 0; i < 60 && p.fall === undefined; i++) sim.step(input({ moveZ: 1, sprint: true }));
      expect(p.fall).toBeDefined();
      expect(walk(sim, input({ moveZ: 1 }))).toMatchObject({ caught: false, landed: 1 });
    });
  }

  it("catches a step off the edge 0.6 m to the side of the ladder, not 0.8 m", () => {
    for (const { key, near } of [LADDERS[1]!, LADDERS[3]!]) {
      const l = ladderOf(key, near);
      for (const side of [0.6, -0.6]) {
        const { at, yaw } = beside(l, side);
        expect(walk(standing(near, at, yaw), input({ moveZ: 1 })), `${key} ${side}`).toMatchObject({ caught: true, landed: 0 });
      }
      for (const side of [0.8, -0.8]) {
        const { at, yaw } = beside(l, side);
        expect(walk(standing(near, at, yaw), input({ moveZ: 1 })), `${key} ${side}`).toMatchObject({ caught: false, landed: 1 });
      }
    }
  });

  it("a fall from higher up past the top is no catch", () => {
    const { key, near } = LADDERS[1]!;
    const l = ladderOf(key, near);
    const sim = standing(near, l.exit, 0);
    // Half a metre over the top, between the edge and the rungs.
    teleportPlayer(sim, { x: l.x + (l.exit.x - l.x) * 0.2, y: l.top + 0.5, z: l.z + (l.exit.z - l.z) * 0.2 }, 0);
    expect(walk(sim, input())).toMatchObject({ caught: false, landed: 1 });
  });

  it("with a body on her shoulder she steps off and falls", () => {
    const { key, near } = LADDERS[3]!;
    const l = ladderOf(key, near);
    const sim = standing(near, l.exit, heading(l.exit, l));
    shoulder(sim);
    teleportPlayer(sim, l.exit, heading(l.exit, l));
    expect(walk(sim, input({ moveZ: 1 }))).toMatchObject({ caught: false, landed: 1 });
  });

  it("jumping off the rungs at the very top is a push-off, not a catch", () => {
    for (const { key, near } of LADDERS) {
      const l = ladderOf(key, near);
      // A game loaded with her on the rungs at the top (G-313).
      const sim = standing(near, { x: l.x, y: l.top, z: l.z }, l.yaw);
      expect(sim.player()!.climb?.ladder).toBe(key);
      sim.step(input({ jump: true }));
      expect(sim.player()!.climb).toBeUndefined();
      expect(walk(sim, input()), key).toMatchObject({ caught: false, landed: 1 });
    }
  });
});
