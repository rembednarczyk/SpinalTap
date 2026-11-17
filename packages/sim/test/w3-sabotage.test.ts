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
  QUICKHACKS,
  type Vec3,
} from "@seki/core";
import { SIM_HZ, Simulation, W3_CORE_BLIND_SPOT, W3_PATROL_HALL, W3_PATROL_MANAGER, W3_VIRUS_TERMINAL, ground, inW3Zone, routePose, stateHash, w3 } from "../src";
import { byKey, collect, input, run, teleportPlayer } from "./helpers";

/**
 * W-3's sabotage, the silent way (ADR-0082 §1, stage 3), stepped headless: the virus upload by the
 * calibration core with its pause, the alarm and the lockdown, 06:00 shipping the batch, the way
 * out of the zone paid by phone, and the hall's patrol walking its loop by the clock.
 */

const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;
const reload = (sim: Simulation): Simulation => Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "mid", "")));
const hash = (sim: Simulation) => stateHash(sim.snapshot(null, "t", ""));

/** By the core's terminal in the camera's dead angle on the east rack's side, facing the terminal. */
const atCore = (sim: Simulation) =>
  teleportPlayer(sim, W3_CORE_BLIND_SPOT, Math.atan2(W3_VIRUS_TERMINAL.x - W3_CORE_BLIND_SPOT.x, W3_VIRUS_TERMINAL.z - W3_CORE_BLIND_SPOT.z));
/** In front of the core's terminal, in the camera's view. */
const inFront = (sim: Simulation) => teleportPlayer(sim, w3(W3_VIRUS_TERMINAL.x, 0, W3_VIRUS_TERMINAL.z - 1), 0);
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
/** The crew out of the way: the upload's own rules, only the camera to fear. */
const knockOut = (sim: Simulation, c: Contract) => {
  for (const e of crew(sim, c)) e.health = { current: 0, max: e.health!.max };
  sim.step();
};
const camera = (sim: Simulation) => byKey(sim, "dev:w3-server-cam")!;

/** Turns the player to look straight at a point (the scanner's focus follows the view). */
const lookAt = (sim: Simulation, p: Vec3) => {
  const me = sim.player()!;
  const dx = p.x - me.position.x;
  const dz = p.z - me.position.z;
  me.yaw = Math.atan2(dx, dz);
  me.pitch = Math.atan2(me.position.y + 1.62 - p.y, Math.hypot(dx, dz));
};
/** `reboot_optics` (slot 2) on what she looks at, held until the upload lands. */
const rebootOptics = (sim: Simulation) => {
  sim.step(input({ scan: true, quickhack: 2 }));
  run(sim, Math.ceil(QUICKHACKS.reboot_optics.upload * SIM_HZ) + 1, input({ scan: true }));
};
type Holder = { holder: { domain: DomainState } };
const setDomain = (sim: Simulation, change: (d: DomainState) => DomainState): void => {
  const holder = (sim as unknown as Holder).holder;
  holder.domain = change(holder.domain);
};
const active = (sim: Simulation) => sim.domain.contracts.active;
const upload = SABOTAGE.uploadSeconds * SIM_HZ;

describe("W-3's sabotage (ADR-0082 stage 3)", () => {
  it("brings the hall's four guards and the shift manager, the patrols on their routes, the core's terminal and the server room's camera", () => {
    const sim = Simulation.create({ seed: 3 });
    const c = accept(sim);
    expect(c).toMatchObject({ siteId: "w3_hall", targets: 4, status: "active" });
    expect(c.variation).toBeUndefined();
    const guards = crew(sim, c);
    // The four posts of the crew and, after them, the manager on the mezzanine (G-929): the only enforcer.
    expect(guards).toHaveLength(5);
    expect(guards.filter((g) => g.ai?.route)).toHaveLength(3);
    expect(guards.filter((g) => g.ai?.enforcer).map((g) => g.key)).toEqual([`${c.id}-manager`]);
    expect(byKey(sim, `${c.id}-manager`)?.ai?.route?.points).toBe(W3_PATROL_MANAGER);
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

  it("the server room's camera misses her in its dead angle by the terminal, but sees her come in unhacked: the job's alarm", () => {
    const sim = Simulation.create({ seed: 3 });
    const c = accept(sim);
    knockOut(sim, c);
    run(sim, 10 * SIM_HZ);
    expect(camera(sim).device!.spot).toBe(0);
    expect(sim.domain.flags).not.toContain(contractAlarmFlag(c.id));
    // In through the door, without a hack: seen within seconds, the lockdown refuses the upload.
    teleportPlayer(sim, w3(W3_VIRUS_TERMINAL.x, 0, 432.8), 0);
    run(sim, 3 * SIM_HZ);
    expect(sim.domain.flags).toContain(contractAlarmFlag(c.id));
    inFront(sim);
    sim.step(input({ interact: true }));
    expect(active(sim)?.progress).toBeUndefined();
  });

  it("the silent way without ICEpick: one reboot from the corridor (30 s), in, and the whole 40 s upload from the dead angle, no alarm", () => {
    const sim = Simulation.create({ seed: 3 });
    const c = accept(sim);
    knockOut(sim, c);
    // In corridor N by the server room's door, out of its no-go zone: the door opens, the hack goes through it.
    teleportPlayer(sim, w3(2567, 0, 430.6), 0);
    run(sim, SIM_HZ);
    lookAt(sim, camera(sim).position);
    rebootOptics(sim);
    expect(camera(sim).hackFx?.blind ?? 0).toBeGreaterThan(SABOTAGE.cameraRebootSeconds - 2);
    // Across the room in its view while it is blind, to the terminal, and the upload in the dead angle.
    inFront(sim);
    run(sim, 2 * SIM_HZ);
    atCore(sim);
    sim.step(input({ interact: true }));
    expect(active(sim)).toMatchObject({ route: "quiet" });
    expect(active(sim)?.breach).toBeUndefined();
    run(sim, upload + 1);
    expect(sim.domain.flags).toContain(W3_VIRUS_FLAG);
    expect(sim.domain.flags).not.toContain(contractAlarmFlag(c.id));
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
    expect(hash(restored)).toBe(hash(sim));
    run(sim, 300);
    run(restored, 300);
    expect(hash(restored)).toBe(hash(sim));
    expect(active(restored)?.progress).toBe(active(sim)?.progress);
  });

  it("a save of the running job from before the shift manager (v44, G-929) loads with him on his round", () => {
    const sim = Simulation.create({ seed: 3 });
    const c = accept(sim);
    run(sim, 2 * SIM_HZ);
    const key = `${c.id}-manager`;
    const saved = roundTrip(sim.snapshot(null, "mid", ""));
    expect(saved.entities.some((e) => e.key === key)).toBe(true);
    // Without his entry, as a save made before him: the job's templates bring him in fresh at his post.
    const restored = Simulation.fromSnapshot({ ...saved, entities: saved.entities.filter((e) => e.key !== key) });
    const m = byKey(restored, key)!;
    expect(m.ai?.enforcer).toBe(true);
    expect(crew(restored, c)).toHaveLength(5);
    run(restored, 20 * SIM_HZ);
    const pose = routePose(m.ai!.route!, restored.tick / SIM_HZ);
    expect(Math.hypot(m.position.x - pose.position.x, m.position.z - pose.position.z)).toBeLessThan(1.5);
  });

  // P1's loop is ~199 s (phase 0): halted at the aisle's east end at 30 s, up the east door to corridor N
  // at 32-42 s, west along it, down the west door at 74-83 s, east along the aisle again from 87 s. Saved
  // at 40 s, mid-walk on the leg through the east door (a metre short of it), the run after the load
  // holds the door, a halt, a turn, the corridor, the west door and the next leg's start. Every step is run twice after the save (the game and its load),
  // so the 5 000 steps either side of a save at 83 s (15 000 in all, 16 s of a 20 s limit in CI) gave
  // the same coverage at nearly twice the cost.
  it("the hall's patrol walks its loop by the clock, and after a save mid-walk to a door it stands where it would have 50 s on", () => {
    const sim = Simulation.create({ seed: 3 });
    const c = accept(sim);
    outside(sim);
    sim.step();
    // Out of the zone without the virus nothing ends; the hall stays streamed from the strip.
    const patrolIn = (s: Simulation) => crew(s, c).find((g) => g.ai?.route?.points === W3_PATROL_HALL)!;
    const offRoute = (s: Simulation) => {
      const p = patrolIn(s);
      const pose = routePose(p.ai!.route!, s.tick / SIM_HZ);
      return Math.hypot(p.position.x - pose.position.x, p.position.z - pose.position.z);
    };
    const start = { ...patrolIn(sim).position };
    run(sim, 30 * SIM_HZ);
    expect(Math.hypot(patrolIn(sim).position.x - start.x, patrolIn(sim).position.z - start.z)).toBeGreaterThan(5);
    expect(offRoute(sim)).toBeLessThan(1.5);
    run(sim, 10 * SIM_HZ);
    expect(routePose(patrolIn(sim).ai!.route!, sim.tick / SIM_HZ)).toMatchObject({ stop: 1, arrived: false });
    const restored = reload(sim);
    run(sim, 50 * SIM_HZ);
    run(restored, 50 * SIM_HZ);
    const a = patrolIn(sim).position;
    const b = patrolIn(restored).position;
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(1e-6);
    expect(offRoute(restored)).toBeLessThan(1.5);
    expect(hash(restored)).toBe(hash(sim));
  });
});
