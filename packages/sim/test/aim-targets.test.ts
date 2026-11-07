import { describe, expect, it } from "vitest";
import { AIM_ASSIST_RANGE, type Entity, type Simulation, aimTargets, gangerEntity, sniperEntity } from "../src";
import { offset, patrol, stallholder } from "./takedown-scenes";
import { streetSim } from "./helpers";

/*
 * The aim assist's targets (ADR-0072, stage 2): Plac Litewski with nobody armed on it, the player
 * standing and facing north, everyone 12 m north of her. Nothing steps: the query reads the state.
 */

const square = (seed = 7): Simulation => {
  const sim = streetSim({ seed });
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  const p = sim.player()!;
  p.yaw = 0;
  p.pitch = 0;
  return sim;
};

const ganger = (sim: Simulation, id: number, dx: number, dz: number, alerted = true): Entity => {
  const g = gangerEntity(id, { key: `aim-${id}`, position: offset(sim, dx, dz), yaw: Math.PI }, null, 80, sim.player()!.chunk ?? "");
  g.ai = { ...g.ai!, alerted };
  return sim.world.add(g);
};

/** A Tessen sniper (no `ai`, ADR-0024) on the ground `dz` m north, in `phase`. */
const sniper = (sim: Simulation, id: number, dx: number, dz: number, phase: "idle" | "aim" | "rest" | "move"): Entity => {
  const at = offset(sim, dx, dz);
  const s = sniperEntity(id, { key: `sniper-${id}`, position: at, yaw: Math.PI }, null, 70, sim.player()!.chunk ?? "", [at]);
  s.sniper = { ...s.sniper!, phase, timer: 1 };
  return sim.world.add(s);
};

/** A wall 4 m wide and 4 m tall across her view, `dz` m north. */
const wall = (sim: Simulation, dz: number): void => {
  const c = offset(sim, 0, dz);
  sim.world.add({
    id: 4900,
    position: { ...c, y: c.y + 2 },
    prevPosition: { ...c, y: c.y + 2 },
    yaw: 0,
    prevYaw: 0,
    pitch: 0,
    view: { kind: "block", size: { x: 4, y: 4, z: 0.3 }, material: "metal" },
    solid: { min: { x: c.x - 2, y: c.y, z: c.z - 0.15 }, max: { x: c.x + 2, y: c.y + 4, z: c.z + 0.15 } },
  });
};

const ids = (sim: Simulation): number[] => sim.aimTargets().map((t) => t.id);

describe("aimTargets (ADR-0072)", () => {
  it("an alerted ganger in plain sight is a target, at its chest", () => {
    const sim = square();
    const g = ganger(sim, 4100, 0, 12);
    const [t, ...rest] = sim.aimTargets();
    expect(rest).toEqual([]);
    expect(t).toMatchObject({ id: g.id, radius: g.body!.radius });
    expect(t!.point.y).toBeGreaterThan(g.position.y + 1);
    expect(t!.distance).toBeGreaterThan(11.9);
    expect(t!.distance).toBeLessThan(12.1);
  });

  it("holds on another seed and to the side", () => {
    const sim = square(23);
    const g = ganger(sim, 4100, 3, 10);
    expect(ids(sim)).toEqual([g.id]);
  });

  it("a passer-by is not a target", () => {
    const sim = square();
    stallholder(sim, 4100, offset(sim, 0, 12));
    expect(ids(sim)).toEqual([]);
  });

  it("a neutral street patrol is not, until it turns on her", () => {
    const sim = square();
    const g = patrol(sim, 4100, offset(sim, 0, 12), Math.PI);
    expect(ids(sim)).toEqual([]);
    g.ai!.alerted = true;
    expect(ids(sim)).toEqual([g.id]);
  });

  it("an unaware guard is not a target, however suspicious (stealth, ADR-0069)", () => {
    const sim = square();
    const g = ganger(sim, 4100, 0, 12, false);
    g.ai!.suspicion = 0.9;
    expect(ids(sim)).toEqual([]);
  });

  it("a knocked-out or dead enemy is not a target", () => {
    const sim = square();
    const out = ganger(sim, 4100, -2, 12);
    out.unconscious = true;
    const dead = ganger(sim, 4101, 2, 12);
    dead.health = { current: 0, max: 80 };
    expect(ids(sim)).toEqual([]);
  });

  it("an alerted ganger behind a wall is not a target, the one beside the wall is", () => {
    const sim = square();
    ganger(sim, 4100, 0, 12);
    const beside = ganger(sim, 4101, 6, 12);
    wall(sim, 6);
    expect(ids(sim)).toEqual([beside.id]);
  });

  it("an alerted ganger beyond the assist's reach is not a target", () => {
    const sim = square();
    ganger(sim, 4100, 0, AIM_ASSIST_RANGE + 3);
    expect(ids(sim)).toEqual([]);
    expect(aimTargets(sim.world, sim.player()!, AIM_ASSIST_RANGE + 5).length).toBe(1);
  });

  it("a sniper aiming at her is a target (user decision 6.11), resting, moving or idle it is not", () => {
    const sim = square();
    const aiming = sniper(sim, 4200, 0, 12, "aim");
    for (const [i, phase] of (["idle", "rest", "move"] as const).entries()) sniper(sim, 4201 + i, 3 + 2 * i, 14, phase);
    expect(ids(sim)).toEqual([aiming.id]);
    expect(sim.aimTargets()[0]!.radius).toBe(aiming.body!.radius);
  });

  it("an aiming sniper behind a wall or out of reach is not a target", () => {
    const sim = square(23);
    sniper(sim, 4200, 0, 12, "aim");
    wall(sim, 6);
    sniper(sim, 4201, 8, AIM_ASSIST_RANGE + 3, "aim");
    expect(ids(sim)).toEqual([]);
  });

  it("an aiming sniper knocked out or dead is not a target", () => {
    const sim = square();
    sniper(sim, 4200, -2, 12, "aim").unconscious = true;
    sniper(sim, 4201, 2, 12, "aim").health = { current: 0, max: 70 };
    expect(ids(sim)).toEqual([]);
  });

  it("reads only: the run does not change", () => {
    const a = square();
    const b = square();
    ganger(a, 4100, 0, 12);
    ganger(b, 4100, 0, 12);
    for (let i = 0; i < 30; i++) {
      a.aimTargets();
      a.step();
      b.step();
    }
    expect(a.rngState).toBe(b.rngState);
    expect(a.player()!.position).toEqual(b.player()!.position);
    expect(a.world.with("ai").first!.position).toEqual(b.world.with("ai").first!.position);
  });
});
