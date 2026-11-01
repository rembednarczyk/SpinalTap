import { describe, expect, it } from "vitest";
import type { DomainEvents, EntityId, HeatState, SaveSnapshot } from "@seki/core";
import { SIM_HZ, Simulation, stateHash, type Entity } from "../src";
import { reinforcementEntity } from "../src/world/reinforcements";
import { collect, run } from "./helpers";
import { CROUCH, offset, patrol, quietStreet, takeDown, walkAway } from "./takedown-scenes";

/** The body of one of the heat's reinforcements in the save (G-193): it lies there after a load, to be found as before. */

const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;
const hash = (sim: Simulation) => stateHash(sim.snapshot(null, "t", ""));
const FINDER = 4100;

/** The first reinforcement of the heat, 1.2 m north of the player with its back to her, blinded by a hack. */
const reinforcement = (sim: Simulation): Entity => {
  const g = sim.world.add(reinforcementEntity(4000, 1, "hebi_ganger", offset(sim, 0, 1.2), sim.domain.difficulty.npcHealth));
  g.hackFx = { pinged: 0, blind: 100, crippled: 0 };
  sim.session.watch.sent = 1;
  return g;
};

/** Killed in the takedown, or knocked out and then shot dead (the death system leaves the body). */
const killed = (lethal: boolean, seed = 7): { sim: Simulation; body: Entity } => {
  const sim = quietStreet(seed);
  const g = reinforcement(sim);
  takeDown(sim, lethal);
  if (!lethal) {
    expect(g.downed?.dead).toBe(false);
    g.health = { ...g.health!, current: 0 };
    g.lastHitBy = sim.player()!.id;
    sim.step(CROUCH);
  }
  const body = sim.world.with("downed").entities.find((b) => b.id === g.id)!;
  expect(body.downed.dead).toBe(true);
  return { sim, body };
};

/** The unkeyed body of a Hebi ganger: only a reinforcement is one (not `security`, which is what is to be kept). */
const theBody = (sim: Simulation) => sim.world.with("downed").entities.find((b) => !b.key && b.enemy?.type === "hebi_ganger");

/** What finding it brings, with the body's id (another in a loaded game) left out. */
const watching = (sim: Simulation, body: () => EntityId | undefined) => {
  const found = collect<DomainEvents["BodyFound"]>(sim, "BodyFound");
  const reports = collect<DomainEvents["CrimeReported"]>(sim, "CrimeReported");
  return () => ({
    found: found.map((f) => ({ ...f, body: f.body === body() })),
    reports: reports.map((r) => ({ crime: r.crime, channel: r.channel, witness: r.witnessId, at: r.at })),
  });
};

/** Both runs step together with a patrol looking at the body; the first step they differ at, or null. */
const together = (a: Simulation, b: Simulation, steps: number) => {
  const at = theBody(a)!.position;
  const seen = [a, b].map((s) => {
    patrol(s, FINDER, { ...at, x: at.x + 12 }, -Math.PI / 2);
    return watching(s, () => theBody(s)?.id);
  });
  for (let i = 1; i <= steps; i++) {
    a.step(CROUCH);
    b.step(CROUCH);
    if (hash(a) !== hash(b)) return { diverged: i, events: seen.map((f) => f()) };
  }
  return { diverged: null, events: seen.map((f) => f()) };
};

describe("the body of a reinforcement in the save (G-193)", () => {
  for (const lethal of [true, false]) {
    const how = lethal ? "killed in the takedown" : "shot dead knocked out";
    it(`${how}: it lies there after a load and is found and reported as in the saved game`, () => {
      const { sim, body } = killed(lethal);
      walkAway(sim);
      run(sim, 5, CROUCH);
      const loaded = Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "t", "")));
      const back = theBody(loaded);
      expect(back).toBeDefined();
      // A passer-by of the square has seen it already: the security has not been told.
      expect(back!.downed).toMatchObject({ dead: true, carried: false, hidden: false, found: body.downed!.found, reported: false });
      expect(back!.position).toEqual(body.position);
      expect(back!.enemy?.type).toBe("hebi_ganger");
      expect(back!.health).toBeUndefined();
      expect(back!.ai).toBeUndefined();
      expect(hash(loaded)).toBe(hash(sim));
      const run2 = together(sim, loaded, 200);
      expect(run2.diverged).toBeNull();
      const [saved, again] = run2.events;
      expect(saved!.found).toEqual([{ body: true, finder: FINDER }]);
      expect(saved!.reports.length).toBeGreaterThan(0);
      expect(again).toEqual(saved);
    });
  }

  it("on her shoulder: still carried after a load", () => {
    const { sim } = killed(true, 11);
    sim.step(CROUCH);
    sim.enqueue({ type: "carry-body" });
    sim.step(CROUCH);
    expect(sim.session.carrying).toBe(theBody(sim)!.id);
    const loaded = Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "t", "")));
    const back = theBody(loaded)!;
    expect(back.downed.carried).toBe(true);
    expect(back.body).toBeUndefined();
    expect(loaded.session.carrying).toBe(back.id);
    expect(hash(loaded)).toBe(hash(sim));
    for (let i = 0; i < 60; i++) {
      sim.step(CROUCH);
      loaded.step(CROUCH);
    }
    expect(hash(loaded)).toBe(hash(sim));
  });

  it("in a hiding place: still hidden after a load, not drawn, found by nobody", () => {
    const { sim } = killed(true, 11);
    const p = sim.player()!.position;
    const c = { x: p.x + 2, y: p.y + 0.7, z: p.z };
    sim.world.add({
      id: 4500,
      position: c,
      prevPosition: c,
      yaw: 0,
      prevYaw: 0,
      pitch: 0,
      view: { kind: "block", size: { x: 2.4, y: 1.4, z: 1.4 }, material: "metal" },
      solid: { min: { x: c.x - 1.2, y: p.y, z: c.z - 0.7 }, max: { x: c.x + 1.2, y: p.y + 1.4, z: c.z + 0.7 } },
      hide: "dumpster",
    });
    sim.step(CROUCH);
    sim.enqueue({ type: "carry-body" });
    sim.step(CROUCH);
    sim.enqueue({ type: "drop-body" });
    sim.step(CROUCH);
    expect(theBody(sim)!.downed.hidden).toBe(true);
    const loaded = Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "t", "")));
    const back = theBody(loaded)!;
    expect(back.downed.hidden).toBe(true);
    expect(back.view).toBeUndefined();
    expect(back.body).toBeUndefined();
    expect(back.position).toEqual(theBody(sim)!.position);
    expect(hash(loaded)).toBe(hash(sim));
  });

  it("the next heat counts on from the body's number: no two of the save are the same", () => {
    const { sim } = killed(true);
    walkAway(sim);
    run(sim, 5, CROUCH);
    expect(sim.domain.heat.level).toBe(0);
    expect(sim.session.watch.sent).toBe(1);
    const snap = roundTrip(sim.snapshot(null, "t", ""));
    const heat: HeatState = { level: 2, faction: "hebi", searching: true, lastKnown: sim.player()!.position, searchLeft: 30, cooldown: 0 };
    const hot = Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, heat } });
    const alive = () => hot.world.with("security").entities.filter((e) => e.ai);
    for (let i = 0; i < 10 * SIM_HZ && alive().length === 0; i++) hot.step(CROUCH);
    expect(alive().map((e) => e.security.n)).toEqual([2]);
    expect(hot.snapshot(null, "t", "").reinforcements!.people.map((p) => [p.n, !!p.state.downed?.dead])).toEqual([
      [1, true],
      [2, false],
    ]);
  });

  it("saved again after a load, it is saved as it was", () => {
    const { sim } = killed(false, 3);
    const snap = roundTrip(sim.snapshot(null, "t", ""));
    const loaded = Simulation.fromSnapshot(snap);
    expect(roundTrip(loaded.snapshot(null, "t", "")).reinforcements).toEqual(snap.reinforcements);
    expect(snap.reinforcements!.people.map((p) => [p.n, p.state.downed?.dead])).toEqual([[1, true]]);
  });
});
