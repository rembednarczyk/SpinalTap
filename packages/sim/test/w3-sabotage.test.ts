import { describe, expect, it } from "vitest";
import {
  type Contract,
  type DomainState,
  SABOTAGE,
  type SaveSnapshot,
  W3_VIRUS_FLAG,
  contractAlarmFlag,
  contractFailedFlag,
  contractTag,
  contractVirusKey,
} from "@seki/core";
import { SIM_HZ, Simulation, W3_PATROL_HALL, W3_VIRUS_TERMINAL, ground, inW3Zone, routePose, stateHash, w3 } from "../src";
import { byKey, collect, input, run, teleportPlayer } from "./helpers";

/**
 * W-3's sabotage, the silent way (ADR-0082 §1, stage 3), stepped headless: the virus upload by the
 * calibration core with its pause, the alarm and the lockdown, 06:00 shipping the batch, the way
 * out of the zone paid by phone, and the hall's patrol walking its loop by the clock.
 */

const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;
const reload = (sim: Simulation): Simulation => Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "mid", "")));
const hash = (sim: Simulation) => stateHash(sim.snapshot(null, "t", ""));

/** In front of the core's terminal, facing it. */
const atCore = (sim: Simulation) => teleportPlayer(sim, w3(W3_VIRUS_TERMINAL.x, 0, W3_VIRUS_TERMINAL.z - 1), 0);
/** On the public strip by the metro, outside the fence. */
const outside = (sim: Simulation) => teleportPlayer(sim, ground(2527, 384), 0);

const accept = (sim: Simulation): Contract => {
  atCore(sim);
  sim.step();
  sim.enqueue({ type: "accept-contract", kind: "sabotage" });
  sim.step();
  const c = sim.domain.contracts.active;
  if (c?.kind !== "sabotage") throw new Error("no sabotage");
  return c;
};

const crew = (sim: Simulation, c: Contract) => [...sim.world].filter((e) => e.tag === contractTag(c.id));
/** The server room's camera blinded, as `reboot_optics` does (ADR-0029). */
const blindCamera = (sim: Simulation) => {
  const cam = byKey(sim, "dev:w3-server-cam")!;
  sim.world.addComponent(cam, "hackFx", { pinged: 0, blind: 1e6, crippled: 0 });
};
/** The crew out of the way and the camera blind: the upload's own rules, nobody to see her. */
const knockOut = (sim: Simulation, c: Contract) => {
  for (const e of crew(sim, c)) e.health = { current: 0, max: e.health!.max };
  blindCamera(sim);
  sim.step();
};
type Holder = { holder: { domain: DomainState } };
const setDomain = (sim: Simulation, change: (d: DomainState) => DomainState): void => {
  const holder = (sim as unknown as Holder).holder;
  holder.domain = change(holder.domain);
};
const active = (sim: Simulation) => sim.domain.contracts.active;
const upload = SABOTAGE.uploadSeconds * SIM_HZ;

describe("W-3's sabotage (ADR-0082 stage 3)", () => {
  it("brings the hall's three guards, the patrols on their routes, the core's terminal and the server room's camera", () => {
    const sim = Simulation.create({ seed: 3 });
    const c = accept(sim);
    expect(c).toMatchObject({ siteId: "w3_hall", targets: 3, status: "active" });
    expect(c.variation).toBeUndefined();
    const guards = crew(sim, c);
    expect(guards).toHaveLength(3);
    expect(guards.filter((g) => g.ai?.route)).toHaveLength(2);
    expect(byKey(sim, contractVirusKey(c.id))?.interactable).toMatchObject({ kind: "terminal", prompt: "prompt.upload-virus" });
    expect(byKey(sim, "dev:w3-server-cam")?.device?.restricted?.during).toBe("sabotage");
  });

  it("the upload counts by the terminal, pauses away from it, and the way out unseen pays the agreed reward by phone", () => {
    const sim = Simulation.create({ seed: 3 });
    const c = accept(sim);
    knockOut(sim, c);
    sim.step(input({ interact: true }));
    // The step of the key counts already: the upload runs after the interaction.
    expect(active(sim)).toMatchObject({ route: "quiet", progress: 1 });
    run(sim, 10 * SIM_HZ);
    const half = active(sim)!.progress!;
    expect(half).toBeGreaterThanOrEqual(10 * SIM_HZ - 1);
    // Away (in corridor N): paused, not dropped, however long.
    teleportPlayer(sim, w3(2550, 0, 431), 0);
    run(sim, 30 * SIM_HZ);
    expect(active(sim)).toMatchObject({ status: "active", progress: half });
    atCore(sim);
    run(sim, upload - half + 1);
    expect(sim.domain.flags).toContain(W3_VIRUS_FLAG);
    expect(active(sim)?.status).toBe("active");
    const before = sim.domain.wallet.eddies;
    const tessenBefore = sim.domain.reputation.tessen;
    const phone = collect<{ from: string }>(sim, "PhoneMessage");
    outside(sim);
    sim.step();
    expect(inW3Zone(2527, 384)).toBe(false);
    expect(active(sim)).toBeNull();
    expect(sim.domain.contracts.completed).toBe(1);
    expect(sim.domain.wallet.eddies - before).toBeGreaterThanOrEqual(c.reward);
    expect(phone.some((m) => m.from === "genzo")).toBe(true);
    // Unseen: Tessen never learns who it was (the crew knocked out here costs its own).
    expect(sim.domain.reputation.tessen).toBe(tessenBefore);
  });

  it("a guard of the crew alerted raises the alarm: the lockdown stops the upload, and leaving after the virus is seen", () => {
    const sim = Simulation.create({ seed: 3 });
    const c = accept(sim);
    const [one, ...rest] = crew(sim, c);
    for (const e of rest) e.health = { current: 0, max: e.health!.max };
    blindCamera(sim);
    sim.step(input({ interact: true }));
    run(sim, 5 * SIM_HZ);
    one!.ai!.alerted = true;
    sim.step();
    expect(sim.domain.flags).toContain(contractAlarmFlag(c.id));
    const frozen = active(sim)!.progress!;
    run(sim, 5 * SIM_HZ);
    expect(active(sim)!.progress).toBe(frozen);
    expect(frozen).toBeLessThan(upload);
  });

  it("the server room's camera sees her at the core unless blinded, and its alarm is the job's", () => {
    const sim = Simulation.create({ seed: 3 });
    const c = accept(sim);
    for (const e of crew(sim, c)) e.health = { current: 0, max: e.health!.max };
    run(sim, 10 * SIM_HZ);
    expect(sim.domain.flags).toContain(contractAlarmFlag(c.id));
    sim.step(input({ interact: true }));
    expect(active(sim)?.progress).toBeUndefined();
  });

  it("the virus in with the alarm up: out of the zone she is seen leaving, paid the seen rate, Tessen -20", () => {
    const sim = Simulation.create({ seed: 3 });
    const c = accept(sim);
    knockOut(sim, c);
    sim.step(input({ interact: true }));
    run(sim, upload + 1);
    expect(sim.domain.flags).toContain(W3_VIRUS_FLAG);
    setDomain(sim, (d) => ({ ...d, flags: [...d.flags, contractAlarmFlag(c.id)] }));
    sim.step();
    expect(active(sim)?.seenLeaving).toBe(true);
    const before = sim.domain.wallet.eddies;
    const tessen = sim.domain.reputation.tessen;
    outside(sim);
    sim.step();
    expect(active(sim)).toBeNull();
    const paid = sim.domain.wallet.eddies - before;
    expect(paid).toBeGreaterThanOrEqual(Math.round((c.reward * SABOTAGE.seenReward) / SABOTAGE.quietReward));
    expect(paid).toBeLessThan(c.reward);
    expect(sim.domain.reputation.tessen - tessen).toBe(-20);
  });

  it("06:00 without the virus ships the batch: the job fails with batch-shipped; with the virus in it runs on", () => {
    const sim = Simulation.create({ seed: 3 });
    const c = accept(sim);
    const failed = collect<{ reason: string }>(sim, "ContractFailed");
    setDomain(sim, (d) => ({ ...d, contracts: { ...d.contracts, active: { ...c, deadlineTick: sim.tick + 2 } } }));
    run(sim, 3);
    expect(failed.map((f) => f.reason)).toEqual(["batch-shipped"]);
    expect(sim.domain.flags).toContain(contractFailedFlag(c.id));

    const late = Simulation.create({ seed: 3 });
    const d = accept(late);
    knockOut(late, d);
    late.step(input({ interact: true }));
    run(late, upload + 1);
    setDomain(late, (x) => ({ ...x, contracts: { ...x.contracts, active: { ...x.contracts.active!, deadlineTick: late.tick + 1 } } }));
    run(late, 5);
    expect(active(late)?.status).toBe("active");
  });

  it("a save during the upload loads to the same state, and the upload goes on from there", () => {
    const sim = Simulation.create({ seed: 3 });
    const c = accept(sim);
    knockOut(sim, c);
    sim.step(input({ interact: true }));
    run(sim, 12 * SIM_HZ);
    const restored = reload(sim);
    // Quickhack effects are not saved (a reboot_optics runs out with the load): blind it again.
    blindCamera(restored);
    expect(hash(restored)).toBe(hash(sim));
    run(sim, 300);
    run(restored, 300);
    expect(hash(restored)).toBe(hash(sim));
    expect(active(restored)?.progress).toBe(active(sim)?.progress);
  });

  it("the hall's patrol walks its loop by the clock, and after 10 000 steps with a save halfway it stands where it would have", () => {
    const sim = Simulation.create({ seed: 3 });
    const c = accept(sim);
    outside(sim);
    sim.step();
    // Out of the zone without the virus nothing ends; the hall stays streamed from the strip.
    const p1 = () => crew(sim, c).find((g) => g.ai?.route?.points === W3_PATROL_HALL)!;
    const start = { ...p1().position };
    run(sim, 30 * SIM_HZ);
    const pose = routePose(p1().ai!.route!, sim.tick / SIM_HZ);
    expect(Math.hypot(p1().position.x - start.x, p1().position.z - start.z)).toBeGreaterThan(5);
    expect(Math.hypot(p1().position.x - pose.position.x, p1().position.z - pose.position.z)).toBeLessThan(1.5);
    run(sim, 5000 - 30 * SIM_HZ);
    const restored = reload(sim);
    run(sim, 5000);
    run(restored, 5000);
    const a = p1().position;
    const b = crew(restored, c).find((g) => g.ai?.route?.points === W3_PATROL_HALL)!.position;
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(1e-6);
    expect(hash(restored)).toBe(hash(sim));
  });
});
