import { describe, expect, it } from "vitest";
import {
  BASE_RAM,
  CONTRACT_BONUS,
  type Contract,
  type ContractKind,
  type DomainEvents,
  QUICKHACKS,
  type SaveSnapshot,
  SHORT_CIRCUIT_DAMAGE,
  type Vec3,
  contractTag,
  contractTerminalKey,
  createDomainState,
  styleBonusOf,
} from "@seki/core";
import {
  BREACH_DATAMINE_EDDIES,
  BREACH_ICEPICK_SECONDS,
  DOKI_TERMINAL_SPOTS,
  GENZO_SPOT,
  SIM_HZ,
  Simulation,
  cameraSees,
  gangerEntity,
  phoneKnot,
  stateHash,
  worldTimeScale,
} from "../src";
import { byKey, collect, input, run, teleportPlayer } from "./helpers";

const at = (x: number, z: number, y = 0) => ({ x, y, z });
const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;
const hash = (sim: Simulation) => stateHash(sim.snapshot(null, "t", ""));

const tough = (sim: Simulation) => {
  sim.player()!.health = { current: 1e6, max: 1e6 };
};

/** Turns the player to look straight at a point (the scanner's focus follows the view). */
const lookAt = (sim: Simulation, p: Vec3) => {
  const me = sim.player()!;
  const eyeY = me.position.y + 1.62;
  const dx = p.x - me.position.x;
  const dz = p.z - me.position.z;
  me.yaw = Math.atan2(dx, dz);
  me.pitch = Math.atan2(eyeY - p.y, Math.hypot(dx, dz));
};

const chest = (e: { position: Vec3 }) => ({ x: e.position.x, y: e.position.y + 1.25, z: e.position.z });

/** Holds the scanner (and hack `slot` on the first step) until the upload lands. */
const hack = (sim: Simulation, slot: 1 | 2 | 3 | 4 | 5, seconds: number) => {
  sim.step(input({ scan: true, quickhack: slot }));
  run(sim, Math.ceil(seconds * SIM_HZ) + 1, input({ scan: true }));
};

/**
 * In the docks yard, south of the first container row, with a guard of Tessen placed by the test
 * (not part of any job). By default it stands 14 m west, looking away.
 */
const yard = (opts: { guardAt?: Vec3; guardYaw?: number } = {}) => {
  const sim = Simulation.create({ seed: 21 });
  teleportPlayer(sim, at(16, 97), -Math.PI / 2);
  sim.step();
  tough(sim);
  const g = gangerEntity(90010, { key: "test-guard", position: opts.guardAt ?? at(2, 96), yaw: opts.guardYaw ?? -Math.PI / 2 }, null, 110, "doki-yard", undefined, "tessen_guard");
  sim.world.add(g);
  sim.step();
  return { sim, g };
};

describe("the scanner (ADR-0029)", () => {
  it("held, it slows the world a little and focuses what is in the middle of the view", () => {
    const { sim, g } = yard();
    const focus = collect<DomainEvents["ScanFocusChanged"]>(sim, "ScanFocusChanged");
    lookAt(sim, chest(g));
    sim.step(input({ scan: true }));
    expect(focus).toEqual([{ targetId: g.id }]);
    const ctx = { input: input({ scan: true }), session: sim.session, state: { domain: sim.domain } } as never;
    expect(worldTimeScale(ctx)).toBeCloseTo(0.6);
    sim.step();
    expect(focus.at(-1)).toEqual({ targetId: null });
  });
});

describe("quickhacks (ADR-0028, ADR-0029)", () => {
  it("distract: the guard nearby goes to the device to look; RAM is paid and comes back", () => {
    const { sim, g } = yard();
    const speaker = byKey(sim, "dev:doki-speaker")!;
    const ram = collect<DomainEvents["RamChanged"]>(sim, "RamChanged");
    const applied = collect<DomainEvents["QuickhackApplied"]>(sim, "QuickhackApplied");
    const traced = collect(sim, "QuickhackTraced");
    lookAt(sim, speaker.position);
    hack(sim, 2, QUICKHACKS.distract.upload);
    expect(applied).toEqual([{ hackId: "distract", targetId: speaker.id, duration: QUICKHACKS.distract.duration }]);
    expect(traced).toHaveLength(0);
    expect(ram[0]).toEqual({ current: BASE_RAM - QUICKHACKS.distract.ram, max: BASE_RAM });
    expect(g.ai!.lastKnown).not.toBeNull();
    const before = Math.hypot(g.position.x - speaker.position.x, g.position.z - speaker.position.z);
    run(sim, 2 * SIM_HZ);
    expect(Math.hypot(g.position.x - speaker.position.x, g.position.z - speaker.position.z)).toBeLessThan(before - 2);
  });

  it("RAM comes back outside combat, not while an enemy close by fights the player", () => {
    const { sim, g } = yard({ guardAt: at(28, 120) });
    const speaker = byKey(sim, "dev:doki-speaker")!;
    const ram = collect<DomainEvents["RamChanged"]>(sim, "RamChanged");
    lookAt(sim, speaker.position);
    hack(sim, 2, QUICKHACKS.distract.upload);
    expect(ram[0]).toEqual({ current: BASE_RAM - QUICKHACKS.distract.ram, max: BASE_RAM });
    // Fighting: nothing comes back.
    g.ai!.alerted = true;
    const low = sim.domain.netrun.ram;
    run(sim, SIM_HZ);
    expect(sim.domain.netrun.ram).toBe(low);
    sim.world.remove(g);
    run(sim, (QUICKHACKS.distract.ram / 0.5 + 0.2) * SIM_HZ);
    expect(sim.domain.netrun.ram).toBe(BASE_RAM);
    expect(ram.at(-1)).toEqual({ current: BASE_RAM, max: BASE_RAM });
  });

  it("ping marks the target's people and cameras for a while", () => {
    const { sim, g } = yard();
    const cam = byKey(sim, "dev:doki-yard-cam")!;
    lookAt(sim, chest(g));
    hack(sim, 1, QUICKHACKS.ping.upload);
    expect(g.hackFx?.pinged).toBeGreaterThan(QUICKHACKS.ping.duration - 1);
    expect(cam.hackFx?.pinged).toBeGreaterThan(QUICKHACKS.ping.duration - 1);
    run(sim, (QUICKHACKS.ping.duration + 1) * SIM_HZ);
    expect(g.hackFx?.pinged).toBe(0);
  });

  it("reboot optics: an alerted guard in front of the player stops seeing them and loses the trail", () => {
    const { sim, g } = yard({ guardAt: at(10, 96), guardYaw: Math.PI / 2 });
    for (let i = 0; i < 2 * SIM_HZ && !g.ai!.alerted; i++) sim.step();
    expect(g.ai!.alerted).toBe(true);
    lookAt(sim, chest(g));
    hack(sim, 2, QUICKHACKS.reboot_optics.upload);
    expect(g.hackFx?.blind).toBeGreaterThan(0);
    sim.step();
    expect(g.ai!.sees).toBe(false);
    // It goes to where it last saw the player and searches there instead of shooting.
    run(sim, 5 * SIM_HZ);
    expect(g.ai!.alerted).toBe(false);
  });

  it("reboot optics on a camera: it sees nothing for a while", () => {
    const { sim } = yard({ guardAt: at(28, 120) });
    const cam = byKey(sim, "dev:doki-yard-cam")!;
    teleportPlayer(sim, at(-8, 98), -Math.PI / 2);
    sim.step();
    expect(cameraSees({ world: sim.world } as never, cam, sim.player()!)).toBe(true);
    lookAt(sim, cam.position);
    hack(sim, 2, QUICKHACKS.reboot_optics.upload);
    expect(cameraSees({ world: sim.world } as never, cam, sim.player()!)).toBe(false);
    run(sim, (QUICKHACKS.reboot_optics.duration + 1) * SIM_HZ);
    expect(cameraSees({ world: sim.world } as never, cam, sim.player()!)).toBe(true);
  });

  it("cripple movement: a chasing guard stands where it is", () => {
    const { sim, g } = yard({ guardAt: at(8, 92), guardYaw: 0 });
    g.ai!.alerted = true;
    sim.step();
    lookAt(sim, chest(g));
    hack(sim, 3, QUICKHACKS.cripple_movement.upload);
    const still = { ...g.position };
    run(sim, 2 * SIM_HZ);
    expect(Math.hypot(g.position.x - still.x, g.position.z - still.z)).toBeLessThan(0.05);
  });

  it("short circuit: damage through DamageDealt; the target looks around where it stands, not at Seki", () => {
    const { sim, g } = yard();
    const hits = collect<DomainEvents["DamageDealt"]>(sim, "DamageDealt");
    lookAt(sim, chest(g));
    const hp = g.health!.current;
    hack(sim, 4, QUICKHACKS.short_circuit.upload);
    expect(hits.filter((h) => h.sourceId === sim.player()!.id)).toEqual([expect.objectContaining({ targetId: g.id, amount: SHORT_CIRCUIT_DAMAGE })]);
    expect(g.health!.current).toBe(hp - SHORT_CIRCUIT_DAMAGE);
    expect(g.ai!.alerted).toBe(false);
    expect(g.ai!.search).toBeGreaterThan(0);
    expect(Math.hypot(g.ai!.lastKnown!.x - g.position.x, g.ai!.lastKnown!.z - g.position.z)).toBeLessThan(1);
  });

  it("an upload seen by an enemy is traced: it learns where the player is", () => {
    const { sim, g } = yard({ guardAt: at(10, 94), guardYaw: Math.PI / 2 });
    const speaker = byKey(sim, "dev:doki-speaker")!;
    const traced = collect<DomainEvents["QuickhackTraced"]>(sim, "QuickhackTraced");
    lookAt(sim, speaker.position);
    hack(sim, 1, QUICKHACKS.ping.upload);
    expect(traced).toEqual([{ hackId: "ping", targetId: speaker.id }]);
    expect(g.ai!.lastKnown).not.toBeNull();
  });

  it("losing the focus cuts the upload off and gives half the RAM back; busy and no RAM are refused", () => {
    const { sim, g } = yard();
    const failed = collect<DomainEvents["QuickhackFailed"]>(sim, "QuickhackFailed");
    lookAt(sim, chest(g));
    sim.step(input({ scan: true, quickhack: 4 }));
    expect(sim.domain.netrun.ram).toBe(BASE_RAM - QUICKHACKS.short_circuit.ram);
    sim.step(input({ scan: true, quickhack: 1 }));
    expect(failed).toEqual([{ hackId: "ping", targetId: g.id, reason: "busy" }]);
    sim.step();
    expect(failed.at(-1)).toMatchObject({ hackId: "short_circuit", reason: "lost-target" });
    expect(sim.domain.netrun.upload).toBeNull();
    expect(sim.domain.netrun.ram).toBeCloseTo(BASE_RAM - QUICKHACKS.short_circuit.ram / 2, 1);

    const poor = Simulation.fromSnapshot({ ...sim.snapshot(null, "p", ""), domain: { ...sim.domain, netrun: { ram: 1, upload: null } } });
    const refused = collect<DomainEvents["QuickhackFailed"]>(poor, "QuickhackFailed");
    poor.world.add(gangerEntity(90011, { key: "test-guard", position: g.position, yaw: g.yaw }, null, 110, "doki-yard", undefined, "tessen_guard"));
    poor.step();
    lookAt(poor, chest(byKey(poor, "test-guard")!));
    poor.step(input({ scan: true, quickhack: 4 }));
    expect(refused.at(-1)).toMatchObject({ hackId: "short_circuit", reason: "no-ram" });
  });

  it("RAM and the upload in progress survive a save; the loaded game finishes it the same way", () => {
    const { sim, g } = yard();
    // The test's own guard is not part of the content, so it would not come back after a load.
    sim.world.remove(g);
    const speaker = byKey(sim, "dev:doki-speaker")!;
    lookAt(sim, speaker.position);
    sim.step(input({ scan: true, quickhack: 2 }));
    run(sim, 10, input({ scan: true }));
    const saved = sim.domain.netrun;
    expect(saved.upload).toMatchObject({ hackId: "distract", target: "dev:doki-speaker", ram: QUICKHACKS.distract.ram });
    const restored = Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "u", "")));
    expect(restored.domain.netrun).toEqual(saved);
    const applied = collect(restored, "QuickhackApplied");
    for (let i = 0; i < SIM_HZ; i++) {
      sim.step(input({ scan: true }));
      restored.step(input({ scan: true }));
    }
    expect(applied).toHaveLength(1);
    expect(hash(restored)).toBe(hash(sim));
  });
});

describe("cameras (ADR-0029)", () => {
  it("a camera reports a crime it sees at once", () => {
    const { sim } = yard({ guardAt: at(28, 120) });
    const reports = collect<DomainEvents["CrimeReported"]>(sim, "CrimeReported");
    const cam = byKey(sim, "dev:doki-yard-cam")!;
    teleportPlayer(sim, at(-8, 98), -Math.PI / 2);
    sim.step();
    sim.player()!.pitch = -0.6;
    sim.step(input({ fire: true }));
    expect(reports).toEqual([expect.objectContaining({ crime: "gunfire", channel: "camera", witnessId: cam.id })]);
    expect(sim.domain.heat).toMatchObject({ level: 1, faction: "tessen" });
  });

  it("the office camera spots Seki in the office during an infiltration and raises the alarm", () => {
    const sim = Simulation.create({ seed: 8 });
    teleportPlayer(sim, at(GENZO_SPOT.x + 0.4, GENZO_SPOT.z - 2), 0);
    sim.step();
    tough(sim);
    sim.enqueue({ type: "accept-contract", kind: "infiltrate" });
    sim.step();
    const c = sim.domain.contracts.active!;
    // Nobody of the crew around: only the camera can see.
    for (const e of [...sim.world].filter((x) => x.tag === contractTag(c.id))) e.health = { current: 0, max: 1 };
    sim.step();
    const cam = byKey(sim, "dev:doki-office-cam")!;
    const reports = collect<DomainEvents["CrimeReported"]>(sim, "CrimeReported");
    const aware = collect<DomainEvents["AwarenessChanged"]>(sim, "AwarenessChanged");
    // Six metres in front of it, inside the office.
    teleportPlayer(sim, at(cam.position.x + Math.sin(cam.yaw) * 6, cam.position.z + Math.cos(cam.yaw) * 6), 0);
    run(sim, 0.5 * SIM_HZ);
    expect(reports).toHaveLength(0);
    expect(aware.filter((a) => a.observerId === cam.id).at(-1)?.state).toBe("suspicious");
    run(sim, 0.7 * SIM_HZ);
    expect(reports).toEqual([expect.objectContaining({ crime: "trespass", channel: "camera", witnessId: cam.id })]);
    expect(aware.filter((a) => a.observerId === cam.id).at(-1)?.state).toBe("alerted");
    expect(sim.domain.contracts.tally).toMatchObject({ detected: true, alarm: true });
  });
});

/** Accepts a job of `kind` with the player at its giver, and returns it. */
const take = (sim: Simulation, kind: ContractKind): Contract => {
  sim.enqueue({ type: "accept-contract", kind });
  sim.step();
  return sim.domain.contracts.active!;
};
const crew = (sim: Simulation, c: Contract) => [...sim.world].filter((e) => e.tag === contractTag(c.id));

describe("the contract layer (ADR-0028, ADR-0029)", () => {
  it("a clean, quick elimination earns S: the card, the bonus and Kaito's style are paid in one transfer", () => {
    // Hebi on good terms: the targets do not go for Seki on sight, so nobody detects her.
    const base = Simulation.create({ seed: 31 });
    const snap = base.snapshot(null, "t", "");
    const sim = Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, reputation: { ...snap.domain.reputation, hebi: 60 } } });
    const bonus = collect<DomainEvents["ContractBonusChanged"]>(sim, "ContractBonusChanged");
    const cards = collect<DomainEvents["ContractDebrief"]>(sim, "ContractDebrief");
    const paid = collect<DomainEvents["EddiesChanged"]>(sim, "EddiesChanged");
    const phone = collect<DomainEvents["PhoneMessage"]>(sim, "PhoneMessage");
    const c = take(sim, "eliminate");
    expect(bonus).toEqual([{ contractId: c.id, condition: CONTRACT_BONUS.eliminate, kept: true }]);
    for (const e of crew(sim, c)) e.health = { current: 0, max: 1 };
    sim.step();
    expect(sim.domain.contracts.active?.status).toBe("cleared");
    const before = sim.domain.wallet.eddies;
    sim.enqueue({ type: "complete-contract" });
    sim.step();
    const style = styleBonusOf("eliminate", ["swift", "untouched"], c.reward);
    expect(cards).toEqual([
      { contractId: c.id, badges: ["ghost", "no_alarm", "clean", "untouched", "swift"], rank: "S", reward: c.reward, bonus: CONTRACT_BONUS.eliminate.bonus, styleBonus: style, seconds: 0 },
    ]);
    expect(sim.domain.wallet.eddies).toBe(before + c.reward + CONTRACT_BONUS.eliminate.bonus + style);
    expect(paid.at(-1)?.delta).toBe(c.reward + CONTRACT_BONUS.eliminate.bonus + style);
    expect(phone.at(-1)).toEqual({ from: "kaito", kind: "text", knot: phoneKnot("kaito", "paid"), priority: "contract" });
    // The counters went with the job.
    expect(sim.domain.contracts.tally).toBeUndefined();
  });

  it("getting hurt on a protection job loses the bonus once and lowers the rank", () => {
    const sim = Simulation.create({ seed: 32 });
    teleportPlayer(sim, at(90.5, 74), Math.PI / 2);
    sim.step();
    const bonus = collect<DomainEvents["ContractBonusChanged"]>(sim, "ContractBonusChanged");
    const cards = collect<DomainEvents["ContractDebrief"]>(sim, "ContractDebrief");
    const c = take(sim, "protect");
    const p = sim.player()!;
    p.health = { ...p.health!, current: p.health!.current - 10 };
    run(sim, 3);
    expect(bonus).toEqual([
      { contractId: c.id, condition: CONTRACT_BONUS.protect, kept: true },
      { contractId: c.id, condition: CONTRACT_BONUS.protect, kept: false },
    ]);
    for (const e of crew(sim, c)) e.health = { current: 0, max: 1 };
    sim.step();
    sim.enqueue({ type: "complete-contract" });
    sim.step();
    expect(cards[0]!.rank).not.toBe("S");
    expect(cards[0]!.badges).not.toContain("untouched");
    expect(cards[0]!.bonus).toBe(0);
  });

  it("killing someone who is not a target costs `clean`; the counters are saved and start at zero in a new game", () => {
    const sim = Simulation.create({ seed: 33 });
    const c = take(sim, "eliminate");
    const bystander = gangerEntity(90020, { key: "extra", position: at(3, -20), yaw: 0 }, null, 1, "shinsekai-7");
    sim.world.add(bystander);
    bystander.lastHitBy = sim.player()!.id;
    bystander.health = { current: 0, max: 1 };
    sim.step();
    expect(sim.domain.contracts.tally).toMatchObject({ extraKills: 1 });
    const restored = Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "c", "")));
    expect(restored.domain.contracts.tally).toEqual(sim.domain.contracts.tally);
    expect(restored.domain.contracts.active?.id).toBe(c.id);
    expect(createDomainState().contracts.tally).toBeUndefined();
    expect(Simulation.create({ seed: 33 }).domain.contracts.tally).toBeUndefined();
  });

  it("entering a fixer's district without a job brings one offer by phone, once per entry", () => {
    const sim = Simulation.create({ seed: 34 });
    sim.enqueue({ type: "set-flag", flag: "met_hana" });
    teleportPlayer(sim, at(40, 78), Math.PI / 2);
    sim.step();
    const phone = collect<DomainEvents["PhoneMessage"]>(sim, "PhoneMessage");
    teleportPlayer(sim, at(90.5, 74), Math.PI / 2);
    run(sim, 30);
    expect(phone).toEqual([{ from: "hana", kind: "text", knot: phoneKnot("hana", "offer"), priority: "contract" }]);
    teleportPlayer(sim, at(40, 78), Math.PI / 2);
    run(sim, 2);
    teleportPlayer(sim, at(90.5, 74), Math.PI / 2);
    run(sim, 2);
    expect(phone).toHaveLength(2);
    // With a job running, nothing.
    take(sim, "retrieve");
    teleportPlayer(sim, at(40, 78), Math.PI / 2);
    run(sim, 2);
    teleportPlayer(sim, at(90.5, 74), Math.PI / 2);
    run(sim, 2);
    expect(phone).toHaveLength(2);
  });
});

describe("Breach Protocol on the docks terminal (ADR-0029)", () => {
  it("applies the daemons once: ICEpick shortens the hack and makes hacks cheaper, Datamine pays", () => {
    const sim = Simulation.create({ seed: 41 });
    teleportPlayer(sim, at(GENZO_SPOT.x + 0.4, GENZO_SPOT.z - 2), 0);
    sim.step();
    tough(sim);
    const c = take(sim, "hack");
    const t = DOKI_TERMINAL_SPOTS.quay_terminal!;
    const breach = collect<DomainEvents["BreachCompleted"]>(sim, "BreachCompleted");
    // Not before the hack has started.
    sim.enqueue({ type: "breach-result", terminalKey: contractTerminalKey(c.id), daemons: ["icepick"] });
    sim.step();
    expect(breach).toHaveLength(0);
    teleportPlayer(sim, at(t.x, t.z - 1.4), 0);
    sim.step(input({ interact: true }));
    const progress = sim.domain.contracts.active!.progress!;
    const eddies = sim.domain.wallet.eddies;
    sim.enqueue({ type: "breach-result", terminalKey: contractTerminalKey(c.id), daemons: ["datamine", "icepick", "icepick"] });
    sim.step();
    expect(breach).toEqual([{ terminalKey: contractTerminalKey(c.id), daemons: ["icepick", "datamine"] }]);
    expect(sim.domain.contracts.active!.progress).toBe(progress + 1 + BREACH_ICEPICK_SECONDS * SIM_HZ);
    expect(sim.domain.wallet.eddies).toBe(eddies + BREACH_DATAMINE_EDDIES);
    expect(sim.domain.contracts.tally?.hacked).toBe(true);
    // Once per job.
    sim.enqueue({ type: "breach-result", terminalKey: contractTerminalKey(c.id), daemons: ["datamine"] });
    sim.step();
    expect(breach).toHaveLength(1);
    // ICEpick: a quickhack costs one RAM less while the job runs.
    const guard = gangerEntity(90030, { key: "near", position: at(t.x + 4, t.z - 1.4), yaw: 0 }, null, 110, "doki-quay", undefined, "tessen_guard");
    sim.world.add(guard);
    sim.step();
    lookAt(sim, chest(guard));
    sim.step(input({ scan: true, quickhack: 1 }));
    expect(sim.domain.netrun.upload?.ram).toBe(QUICKHACKS.ping.ram - 1);
  });
});
