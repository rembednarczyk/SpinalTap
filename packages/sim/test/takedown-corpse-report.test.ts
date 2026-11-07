import { describe, expect, it } from "vitest";
import { type DomainEvents, WITNESS_CALL_SECONDS } from "@seki/core";
import { Simulation, type Entity } from "../src";
import { collect, run } from "./helpers";
import { CROUCH, offset, patrol, quietStreet, stallholder, takeDown, ticks, victim, walkAway } from "./takedown-scenes";

/**
 * G-334 (ADR-0065, ADR-0070): the report of a knock-out is the assault's, not the murder's. The
 * one knocked out and finished later is found as a murder, and finishing it after a load is the
 * crime it is in a game played through.
 */

/** The player finishes the one she knocked out (as in the street's reputation tests). */
const finish = (sim: Simulation, g: Entity): void => {
  g.lastHitBy = sim.player()!.id;
  g.health = { current: 0, max: g.health!.max };
  sim.step(CROUCH);
};

const reportsOf = (sim: Simulation) => collect<DomainEvents["CrimeReported"]>(sim, "CrimeReported");

/** A patrol 12 m east of the body, looking at it, and a few seconds for it to see it. */
const findBody = (sim: Simulation, body: Entity): void => {
  patrol(sim, 4101, { ...body.position, x: body.position.x + 12 }, -Math.PI / 2);
  run(sim, ticks(2), CROUCH);
};

describe("a corpse of one knocked out first (G-334)", () => {
  it("knocked out in sight of a patrol, finished unseen: the patrol that finds the corpse reports the murder", () => {
    const sim = quietStreet();
    const guard = victim(sim);
    const w = patrol(sim, 4100, offset(sim, 7, 0), -Math.PI / 2);
    const reports = reportsOf(sim);
    takeDown(sim);
    expect(reports.map((r) => r.crime)).toEqual(["assault"]);
    expect(guard.downed?.reported).toBe(true);
    sim.world.remove(w);
    finish(sim, guard);
    walkAway(sim);
    run(sim, ticks(1), CROUCH);
    expect(reports.map((r) => r.crime)).toEqual(["assault"]);
    const body = sim.world.with("downed").entities.find((e) => e.id === guard.id)!;
    expect(body.downed.dead).toBe(true);
    findBody(sim, body);
    expect(reports.map((r) => [r.crime, r.channel])).toEqual([
      ["assault", "patrol"],
      ["murder", "patrol"],
    ]);
    expect(sim.domain.heat.level).toBe(2);
  });

  it("finished unseen while a bystander still phones in the knock-out: its call does not report the corpse", () => {
    const sim = quietStreet();
    const guard = victim(sim);
    stallholder(sim, 4300, offset(sim, -2, 0));
    const reports = reportsOf(sim);
    takeDown(sim);
    finish(sim, guard);
    walkAway(sim);
    run(sim, ticks(WITNESS_CALL_SECONDS + 1), CROUCH);
    expect(reports.map((r) => [r.crime, r.channel])).toEqual([["assault", "civilian"]]);
    const body = sim.world.with("downed").entities.find((e) => e.id === guard.id)!;
    expect(body.downed.reported).toBe(false);
    findBody(sim, body);
    expect(reports.map((r) => [r.crime, r.channel])).toEqual([
      ["assault", "civilian"],
      ["murder", "patrol"],
    ]);
  });

  it("finished in sight of a patrol: one murder reported, the corpse brings no second report", () => {
    const sim = quietStreet();
    const guard = victim(sim);
    takeDown(sim);
    patrol(sim, 4100, offset(sim, 7, 0), -Math.PI / 2);
    const reports = reportsOf(sim);
    finish(sim, guard);
    run(sim, ticks(12), CROUCH);
    expect(reports.map((r) => [r.crime, r.channel])).toEqual([["murder", "patrol"]]);
  });
});

describe("finishing one knocked out after a load (G-334)", () => {
  /** Saved and loaded, with nobody armed on the square but the bodies. */
  const reload = (sim: Simulation): Simulation => {
    const loaded = Simulation.fromSnapshot(JSON.parse(JSON.stringify(sim.snapshot(null, "t", ""))));
    for (const g of [...loaded.world.with("ai")]) if (!g.downed) loaded.world.remove(g);
    return loaded;
  };

  /**
   * Knocked out unseen (mid-fight or not), maybe saved and loaded, then finished with a bystander
   * by her side. A bystander reports what it sees done, never a body (only the security does), so
   * the call is the murder's own.
   */
  const finishedInSight = (fought: boolean, load: boolean) => {
    const sim = quietStreet();
    const guard = victim(sim);
    // Unknown to the content (as a mugger's, G-233): its body is saved by itself.
    delete guard.key;
    if (fought) {
      guard.ai!.alerted = true;
      guard.melee!.stagger = 2;
      guard.melee!.stunned = true;
    }
    takeDown(sim);
    expect(guard.downed?.fought).toBe(fought);
    const game = load ? reload(sim) : sim;
    const body = game.world.with("downed").first!;
    stallholder(game, 4300, offset(game, -2, 0));
    const reports = reportsOf(game);
    finish(game, body);
    run(game, ticks(WITNESS_CALL_SECONDS + 1), CROUCH);
    return { reports: reports.map((r) => [r.crime, r.channel]), heat: game.domain.heat.level };
  };

  it("not fighting her: a murder phoned in by the bystander, as in a game played through", () => {
    const through = finishedInSight(false, false);
    expect(through).toEqual({ reports: [["murder", "civilian"]], heat: 2 });
    expect(finishedInSight(false, true)).toEqual(through);
  });

  it("knocked out mid-fight: no crime either way", () => {
    const through = finishedInSight(true, false);
    expect(through).toEqual({ reports: [], heat: 0 });
    expect(finishedInSight(true, true)).toEqual(through);
  });
});
