import { describe, expect, it } from "vitest";
import { type DomainEvents, type ReputationState, contractTag } from "@seki/core";
import { CONTRACT_SITE_SPAWNS, Simulation, gangerEntity, type Entity } from "../src";
import { collect, run, teleportPlayer } from "./helpers";
import { CROUCH, offset, patrol, quietStreet, takeDown, ticks } from "./takedown-scenes";

/**
 * ADR-0070, stage 4: the street thanks the player for a Hebi ganger killed in a fight, not for
 * one taken from behind, of the heat's people or of a job's crew, and up to +25 only; witnesses
 * cost what they report; a job is judged as a whole.
 */

/** Plac Litewski without the armed (`quietStreet`), with the standings patched in as a load would. */
const streetWith = (reputation: Partial<ReputationState>): Simulation => {
  const base = quietStreet();
  const snap = base.snapshot(null, "t", "");
  const sim = Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, reputation: { ...snap.domain.reputation, ...reputation } } });
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  return sim;
};

/** A Hebi ganger `dz` metres north of the player, its back to her. */
const ganger = (sim: Simulation, id: number, dz = 1.2): Entity =>
  sim.world.add(gangerEntity(id, { key: `hebi-${id}`, position: offset(sim, 0, dz), yaw: 0 }, null, 80, sim.player()!.chunk ?? ""));

/** It fought her and her last shot put it down. */
const killedInFight = (sim: Simulation, g: Entity): void => {
  g.ai!.alerted = true;
  g.lastHitBy = sim.player()!.id;
  g.health = { current: 0, max: g.health!.max };
  sim.step();
};

describe("a dead Hebi ganger and the street (ADR-0070)", () => {
  it("killed in a fight: +1 with the street, −4 with the gang", () => {
    const sim = streetWith({});
    const changes = collect<DomainEvents["ReputationChanged"]>(sim, "ReputationChanged");
    killedInFight(sim, ganger(sim, 4000, 10));
    expect(sim.domain.reputation).toMatchObject({ hebi: -4, civilians: 1 });
    expect(changes).toEqual([
      { faction: "hebi", value: -4, delta: -4 },
      { faction: "civilians", value: 1, delta: 1 },
    ]);
  });

  it("the thanks stop at +25", () => {
    const sim = streetWith({ civilians: 24 });
    killedInFight(sim, ganger(sim, 4000, 10));
    expect(sim.domain.reputation.civilians).toBe(25);
    killedInFight(sim, ganger(sim, 4001, 12));
    expect(sim.domain.reputation).toMatchObject({ hebi: -8, civilians: 25 });
  });

  it("nothing while the gang is friendly: a score between friends", () => {
    const sim = streetWith({ hebi: 30 });
    killedInFight(sim, ganger(sim, 4000, 10));
    expect(sim.domain.reputation).toMatchObject({ hebi: 26, civilians: 0 });
  });

  it("nothing for one of the heat's reinforcements", () => {
    const sim = streetWith({});
    const g = ganger(sim, 4000, 10);
    g.security = { n: 1, since: 0 };
    killedInFight(sim, g);
    expect(sim.domain.reputation).toMatchObject({ hebi: -4, civilians: 0 });
  });

  it("from behind, unseen: nothing with the street; seen, one deed costs once: a murder, −2", () => {
    const unseen = streetWith({});
    ganger(unseen, 4000);
    takeDown(unseen, true);
    run(unseen, ticks(2), CROUCH);
    expect(unseen.domain.reputation).toMatchObject({ hebi: -4, civilians: 0 });

    const seen = streetWith({});
    ganger(seen, 4000);
    // Seven metres east, looking at her (as in the takedown's witness tests).
    patrol(seen, 4100, offset(seen, 7, 0), -Math.PI / 2);
    const reports = collect<DomainEvents["CrimeReported"]>(seen, "CrimeReported");
    takeDown(seen, true);
    // Two reports of one deed (the blow, the death): the street counts the murder, not both.
    expect(reports.map((r) => r.crime)).toEqual(["assault", "murder"]);
    expect(seen.domain.reputation).toMatchObject({ hebi: -4, civilians: -2 });
  });
});

describe("witnesses: one deed costs the street once (ADR-0070)", () => {
  /** A Hebi ganger knocked out from behind with a patrol watching: a reported assault. */
  const assaulted = () => {
    const sim = streetWith({});
    const g = ganger(sim, 4000);
    const w = patrol(sim, 4100, offset(sim, 7, 0), -Math.PI / 2);
    const reports = collect<DomainEvents["CrimeReported"]>(sim, "CrimeReported");
    takeDown(sim);
    expect(reports.map((r) => r.crime)).toEqual(["assault"]);
    return { sim, g, w, reports };
  };

  /** The player finishes the one she knocked out (it was not fighting: a murder). */
  const finish = (sim: Simulation, g: Entity): void => {
    g.lastHitBy = sim.player()!.id;
    g.health = { current: 0, max: g.health!.max };
    sim.step(CROUCH);
  };

  it("the victim lives: the assault costs −1", () => {
    const { sim } = assaulted();
    run(sim, ticks(2), CROUCH);
    expect(sim.domain.reputation.civilians).toBe(-1);
  });

  it("the victim dies later in sight of the witness: the murder costs only the rest, −2 in all", () => {
    const { sim, g, reports } = assaulted();
    finish(sim, g);
    expect(reports.map((r) => r.crime)).toEqual(["assault", "murder"]);
    expect(sim.domain.reputation).toMatchObject({ hebi: -4, civilians: -2 });
  });

  it("the victim dies unseen: the reported assault stays −1", () => {
    const { sim, g, w, reports } = assaulted();
    sim.world.remove(w);
    finish(sim, g);
    run(sim, ticks(2), CROUCH);
    expect(reports.map((r) => r.crime)).toEqual(["assault"]);
    expect(sim.domain.reputation.civilians).toBe(-1);
  });

  it("another victim's murder costs its own −2", () => {
    const { sim } = assaulted();
    const other = ganger(sim, 4001, 3);
    other.wronged = true;
    finish(sim, other);
    expect(sim.domain.reputation.civilians).toBe(-3);
  });
});

describe("the street's balance of a job (ADR-0070)", () => {
  /** Kaito's job, the player at its site (as `m1.test.ts` does it). */
  const atTheJob = () => {
    const sim = Simulation.create({ seed: 9 });
    sim.enqueue({ type: "accept-contract" });
    sim.step();
    const c = sim.domain.contracts.active!;
    const site = CONTRACT_SITE_SPAWNS[c.siteId][0]!;
    teleportPlayer(sim, { x: site.x, y: site.y, z: site.z - 6 });
    sim.step();
    const targets = [...sim.world].filter((e) => e.tag === contractTag(c.id));
    expect(targets).toHaveLength(c.targets);
    return { sim, targets };
  };

  const finish = (sim: Simulation, targets: readonly Entity[]): void => {
    for (const t of targets) {
      t.lastHitBy = sim.player()!.id;
      t.health = { current: 0, max: t.health!.max };
    }
    sim.step();
    expect(sim.domain.contracts.active?.status).toBe("cleared");
    sim.enqueue({ type: "complete-contract" });
    sim.step();
  };

  it("the targets cost the street nothing; a clean elimination +4", () => {
    const { sim, targets } = atTheJob();
    const [first, ...rest] = targets;
    first!.lastHitBy = sim.player()!.id;
    first!.health = { current: 0, max: 80 };
    sim.step();
    expect(sim.domain.reputation.civilians).toBe(0);
    finish(sim, rest);
    expect(sim.domain.reputation.civilians).toBe(4);
  });

  it("one killed besides the targets: its own +1, the job +2 without the clean bonus", () => {
    const { sim, targets } = atTheJob();
    killedInFight(sim, ganger(sim, 4500, 3));
    expect(sim.domain.contracts.tally?.extraKills).toBe(1);
    finish(sim, targets);
    expect(sim.domain.reputation.civilians).toBe(3);
  });
});
