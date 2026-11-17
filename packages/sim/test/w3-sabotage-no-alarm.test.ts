import { describe, expect, it } from "vitest";
import {
  type Contract,
  type ContractKind,
  type DomainEvents,
  HACK_SECONDS,
  SABOTAGE,
  SABOTAGE_LOUD,
  type W3StationId,
  W3_VIRUS_FLAG,
  contractAlarmFlag,
  contractTag,
} from "@seki/core";
import { GENZO_SPOT, SIM_HZ, Simulation, W3_CORE_BLIND_SPOT, W3_STATION_SPOTS, W3_TECHNICIANS, W3_TERMINAL_SPOTS, W3_VIRUS_TERMINAL, ground, w3 } from "../src";
import { collect, input, teleportPlayer } from "./helpers";

/**
 * G-914: the alarm of W-3's sabotage counts in the debrief: the charges' case or anyone of the job
 * seeing her takes `no_alarm` away (not `ghost`: that is only whether anyone saw her). The docks'
 * own scripted alarm (the hack's wave) still does not count. Nobody is killed here, so the badges
 * are the rules' own: the crew and the waves stay up (sent back out while she plants), and Seki
 * is patched up where they shoot her.
 */

type Card = DomainEvents["ContractDebrief"];
const active = (sim: Simulation) => sim.domain.contracts.active;
const tally = (sim: Simulation) => sim.domain.contracts.tally;
/** Steps with Seki kept on her feet (the waves shoot; `untouched` is not what is checked here). */
const hold = (sim: Simulation, steps: number, interact = false) => {
  for (let i = 0; i < steps; i++) {
    const me = sim.player()!;
    me.health = { ...me.health!, current: me.health!.max };
    sim.step(input({ interact }));
  }
};
const atCore = (sim: Simulation) =>
  teleportPlayer(sim, W3_CORE_BLIND_SPOT, Math.atan2(W3_VIRUS_TERMINAL.x - W3_CORE_BLIND_SPOT.x, W3_VIRUS_TERMINAL.z - W3_CORE_BLIND_SPOT.z));
const accept = (sim: Simulation, kind: ContractKind): Contract => {
  sim.step();
  sim.enqueue({ type: "accept-contract", kind });
  sim.step();
  const c = active(sim);
  if (c?.kind !== kind) throw new Error(`no ${kind}`);
  return c;
};
const sabotage = (sim: Simulation): Contract => {
  atCore(sim);
  return accept(sim, "sabotage");
};
/** The job's men still up sent back out to the east yard: a hit starts a charge over, and nobody is killed here. */
const sendAway = (sim: Simulation, c: Contract) => {
  const yard = w3(2585, 0, 415);
  for (const e of [...sim.world].filter((g) => g.tag === contractTag(c.id) && (g.health?.current ?? 0) > 0)) {
    e.position = yard;
    e.prevPosition = yard;
  }
};
const plant = (sim: Simulation, c: Contract, s: W3StationId) => {
  const p = W3_STATION_SPOTS[s];
  const north = s === "S3" || s === "S4";
  sendAway(sim, c);
  teleportPlayer(sim, w3(p.x, 0, p.z + (north ? -0.4 : 0.4)), north ? 0 : Math.PI);
  hold(sim, 1);
  hold(sim, 1, true);
  hold(sim, Math.round(SABOTAGE_LOUD.plantSeconds * SIM_HZ) + 1);
};
/** On the public strip by the metro, out of W-3's zone. */
const outside = (sim: Simulation) => teleportPlayer(sim, ground(2527, 384), 0);

describe("the alarm of W-3's sabotage in the debrief (G-914)", () => {
  it("loud: the charges' case raises the job's alarm, and the card has no no_alarm", () => {
    const sim = Simulation.create({ seed: 3 });
    const c = sabotage(sim);
    const cards = collect<Card>(sim, "ContractDebrief");
    teleportPlayer(sim, w3(2555, 0, 402), Math.PI);
    hold(sim, 1);
    expect(sim.domain.flags).not.toContain(contractAlarmFlag(c.id));
    hold(sim, 1, true);
    expect(sim.domain.flags).toContain(contractAlarmFlag(c.id));
    expect(tally(sim)?.alarm).toBe(true);
    for (const s of ["S1", "S2", "S3"] as const) plant(sim, c, s);
    expect(active(sim)?.charges).toEqual(["S1", "S2", "S3"]);
    teleportPlayer(sim, w3(2585, 0, 415), 0);
    hold(sim, 1);
    outside(sim);
    hold(sim, 1);
    expect(active(sim)).toBeNull();
    expect(cards).toHaveLength(1);
    expect(cards[0]!.badges).not.toContain("no_alarm");
    // Nobody killed: the waves are the job's targets, the bonus of the sabotage holds.
    expect(cards[0]!.badges).toContain("clean");
  });

  it("quiet and unseen: no alarm, the card keeps no_alarm and ghost", () => {
    const sim = Simulation.create({ seed: 3 });
    const c = sabotage(sim);
    const cards = collect<Card>(sim, "ContractDebrief");
    hold(sim, 1, true);
    hold(sim, SABOTAGE.uploadSeconds * SIM_HZ + 1);
    expect(sim.domain.flags).toContain(W3_VIRUS_FLAG);
    expect(sim.domain.flags).not.toContain(contractAlarmFlag(c.id));
    outside(sim);
    hold(sim, 1);
    expect(cards).toHaveLength(1);
    expect(cards[0]!.badges).toEqual(expect.arrayContaining(["ghost", "no_alarm"]));
  });

  it("seen on the line (a technician by S2, the crew still up): the job's alarm, and it counts as one", () => {
    const sim = Simulation.create({ seed: 3 });
    const c = sabotage(sim);
    const [tech] = W3_TECHNICIANS;
    teleportPlayer(sim, w3(tech!.at.x - 1.5, 0, 413.3), 0);
    hold(sim, 1);
    expect(sim.domain.flags).not.toContain(contractAlarmFlag(c.id));
    expect(tally(sim)?.alarm).toBe(false);
    hold(sim, 3 * SIM_HZ);
    expect(sim.domain.flags).toContain(contractAlarmFlag(c.id));
    expect(tally(sim)?.alarm).toBe(true);
  });

  it("the docks' hack: its own wave's alarm is still not one, the card keeps no_alarm", () => {
    const sim = Simulation.create({ seed: 9 });
    teleportPlayer(sim, ground(GENZO_SPOT.x + 0.4, GENZO_SPOT.z - 2), 0);
    const c = accept(sim, "hack");
    const cards = collect<Card>(sim, "ContractDebrief");
    const t = W3_TERMINAL_SPOTS.quay_terminal!;
    teleportPlayer(sim, ground(t.x, t.z - 1.4), 0);
    hold(sim, 1, true);
    expect(sim.domain.flags).toContain(contractAlarmFlag(c.id));
    hold(sim, HACK_SECONDS * SIM_HZ);
    expect(active(sim)?.status).toBe("cleared");
    expect(tally(sim)?.alarm).toBe(false);
    sim.enqueue({ type: "complete-contract" });
    sim.step();
    expect(cards).toHaveLength(1);
    expect(cards[0]!.badges).toContain("no_alarm");
  });
});
