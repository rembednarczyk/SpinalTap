import { describe, expect, it } from "vitest";
import { type DomainEvents, type DomainState, GANG_RULES, GRUDGE_STEP, SECONDS_PER_HOUR, type TerritoryProvocation, standingOf } from "@seki/core";
import { type Entity, SIM_HZ, Simulation, gangerEntity, spotNear, stateHash } from "../src";
import { byKey, input, run, streetSim, teleportPlayer } from "./helpers";

/*
 * The gangs' territories in the simulation (ADR-0091 stage 3): a member of the Rynek's watches a
 * player Hebi tolerate on the Stare Miasto. A drawn gun within 8 m starts the warning (3 s to put
 * it away), a kill adds to the grudge and provokes the gang, each dawn lowers the grudge. The
 * gang's memory is the save's: a load in the middle of a warning goes on the same.
 */

const ticks = (seconds: number): number => Math.round(seconds * SIM_HZ);

/** The street with nobody else on it, the weapon put away; `patch` changes the domain. */
const street = (patch: (d: DomainState) => DomainState = (d) => d): Simulation => {
  const snap = streetSim({ seed: 11 }).snapshot(null, "t", "");
  const sim = Simulation.fromSnapshot({ ...snap, domain: patch(snap.domain) });
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  for (const c of [...sim.world.with("device")]) sim.world.remove(c);
  sim.step(input({ toggleWeapon: true }));
  run(sim, ticks(1));
  return sim;
};

/** A member of the Rynek's territory `metres` north of the player, facing her. */
const member = (sim: Simulation, metres = 6): Entity => {
  const p = sim.player()!;
  const e = gangerEntity(5000 + sim.world.entities.length, { key: "rynek-member", position: { x: p.position.x, y: p.position.y, z: p.position.z + metres }, yaw: Math.PI }, null, 500, p.chunk ?? "");
  if (e.ai) e.ai = { ...e.ai, territory: "rynek" };
  return sim.world.add(e);
};

const rynek = (sim: Simulation) => standingOf(sim.domain.gangStandings, "hebi", "kanal");

/** The territory events of the run, in order. */
const listen = (sim: Simulation) => {
  const heard: { warned: number; provoked: TerritoryProvocation[]; calmed: number } = { warned: 0, provoked: [], calmed: 0 };
  sim.bus.on("TerritoryWarned", () => heard.warned++);
  sim.bus.on("TerritoryProvoked", (e: DomainEvents["TerritoryProvoked"]) => heard.provoked.push(e.cause));
  sim.bus.on("TerritoryCalmed", () => heard.calmed++);
  return heard;
};

describe("a gang's territory (ADR-0091 stage 3)", () => {
  it("lets a player with her gun away stand by the group a minute, though Hebi hate her in the city", () => {
    const sim = street((d) => ({ ...d, reputation: { ...d.reputation, hebi: -40 } }));
    const heard = listen(sim);
    const m = member(sim);
    run(sim, ticks(60));
    expect(m.ai!.alerted).toBe(false);
    expect(m.ai!.sees).toBe(true);
    expect(heard).toEqual({ warned: 0, provoked: [], calmed: 0 });
    expect(sim.domain.gangStandings).toEqual({});
  });

  it("warns a drawn gun within 8 m, and fights once 3 s ran out with it still drawn", () => {
    const sim = street();
    const heard = listen(sim);
    const m = member(sim);
    run(sim, ticks(1));
    sim.step(input({ toggleWeapon: true }));
    run(sim, ticks(2));
    expect(heard.warned).toBe(1);
    expect(rynek(sim).warnedUntil).toBeDefined();
    expect(heard.provoked).toEqual([]);
    run(sim, ticks(2));
    // The Rynek's territory is the only one on the Stare Miasto with this member's: the gang's three there hear it.
    expect(new Set(heard.provoked)).toEqual(new Set(["warning"]));
    expect(rynek(sim).grudge).toBe(GRUDGE_STEP.provoke);
    expect(rynek(sim).warnedUntil).toBeUndefined();
    run(sim, ticks(3));
    expect(m.ai!.alerted).toBe(true);
  });

  it("ends the warning when the gun goes away in time, with no grudge", () => {
    const sim = street();
    const heard = listen(sim);
    member(sim);
    sim.step(input({ toggleWeapon: true }));
    run(sim, ticks(1.5));
    expect(heard.warned).toBe(1);
    sim.step(input({ toggleWeapon: true }));
    run(sim, ticks(5));
    expect(heard.provoked).toEqual([]);
    expect(sim.domain.gangStandings).toEqual({ "hebi:kanal": { grudge: 0, provokedUntil: null } });
  });

  it("does not warn a drawn gun from beyond the range, and warns from farther and sooner when Hebi hate her", () => {
    const calm = street();
    const heard = listen(calm);
    member(calm, 10);
    calm.step(input({ toggleWeapon: true }));
    run(calm, ticks(4));
    expect(heard.warned).toBe(0);
    const hated = street((d) => ({ ...d, reputation: { ...d.reputation, hebi: -60 } }));
    const told = listen(hated);
    member(hated, 10);
    hated.step(input({ toggleWeapon: true }));
    run(hated, ticks(1));
    expect(told.warned).toBe(1);
    run(hated, ticks(1.5));
    expect(told.provoked).toContain("warning");
  });

  it("holds a kill against the gang in the district, and lets it go at the dawns", () => {
    const sim = street();
    const heard = listen(sim);
    const m = member(sim);
    run(sim, ticks(1));
    m.health = { ...m.health!, current: 0 };
    m.lastHitBy = sim.player()!.id;
    sim.step(input());
    expect(heard.provoked).toContain("kill");
    expect(rynek(sim).grudge).toBe(GRUDGE_STEP.kill + GRUDGE_STEP.provoke);
    expect(standingOf(sim.domain.gangStandings, "hebi", "targ")).toEqual({ grudge: 0, provokedUntil: null });
    // A day later: past the provocation's hours and a dawn.
    sim.enqueue({ type: "wait", minutes: 24 * 60 });
    sim.step(input());
    expect(heard.calmed).toBeGreaterThan(0);
    expect(rynek(sim).grudge).toBe(Math.max(0, GRUDGE_STEP.kill + GRUDGE_STEP.provoke - GANG_RULES.dawnRelief));
    expect(rynek(sim).provokedUntil === null || rynek(sim).provokedUntil! <= sim.domain.clock.seconds).toBe(true);
    expect(GANG_RULES.provokedHours * SECONDS_PER_HOUR).toBeLessThan(24 * SECONDS_PER_HOUR);
  });

  it("goes on the same after a save in the middle of a warning (the Bramowa patrol of the content)", () => {
    const sim = streetSim({ seed: 11 });
    // The street starts with the gun drawn: away first, then drawn in front of the patrol.
    sim.step(input({ toggleWeapon: true }));
    teleportPlayer(sim, spotNear(504, -60), Math.PI);
    run(sim, ticks(2));
    const patrol = byKey(sim, "hebi-bramowa")!;
    expect(patrol.ai?.territory).toBe("rynek");
    // 6 m in front of it, facing it.
    const at = { x: patrol.position.x + Math.sin(patrol.yaw ?? 0) * 6, y: patrol.position.y, z: patrol.position.z + Math.cos(patrol.yaw ?? 0) * 6 };
    teleportPlayer(sim, at, (patrol.yaw ?? 0) + Math.PI);
    sim.step(input({ toggleWeapon: true }));
    run(sim, ticks(1.5));
    expect(rynek(sim).warnedUntil).toBeDefined();
    const restored = Simulation.fromSnapshot(JSON.parse(JSON.stringify(sim.snapshot(null, "mid", ""))));
    for (const s of [sim, restored]) run(s, ticks(10));
    expect(stateHash(restored.snapshot(null, "end", ""))).toBe(stateHash(sim.snapshot(null, "end", "")));
    expect(rynek(restored).grudge).toBe(GRUDGE_STEP.provoke);
  });
});
