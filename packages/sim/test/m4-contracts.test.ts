import { describe, expect, it } from "vitest";
import {
  type Contract,
  type ContractKind,
  type SaveSnapshot,
  contractFailedFlag,
  contractItemKey,
  contractTag,
  takenFlag,
} from "@seki/core";
import { CONTRACT_ITEM_SPOTS, OYAJI_MAX_HP, SIM_HZ, Simulation, ground, market, stateHash } from "../src";
import { byKey, collect, input, run, teleportPlayer, debriefExtras } from "./helpers";

/** A point on the ground at (x, z) (the terrain of ADR-0045). */
const at = (x: number, z: number) => ground(x, z);

const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;

const reload = (sim: Simulation): Simulation => Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "mid", "")));

const hash = (sim: Simulation) => stateHash(sim.snapshot(null, "t", ""));

/** A copy of the simulation with a patched domain, built the way a load would build it. */
const withDomain = (sim: Simulation, patch: (d: Simulation["domain"]) => Simulation["domain"]): Simulation => {
  const snap = sim.snapshot(null, "test", "");
  return Simulation.fromSnapshot({ ...snap, domain: patch(snap.domain) });
};

/** Next to Hana's cart in the market; one step lets streaming load the market around the player. */
const toMarket = (sim: Simulation) => {
  teleportPlayer(sim, market(90.5, 0, 74), Math.PI / 2);
  sim.step();
};

const accept = (sim: Simulation, kind: ContractKind): Contract => {
  sim.enqueue({ type: "accept-contract", kind });
  sim.step();
  const c = sim.domain.contracts.active;
  if (!c) throw new Error(`no ${kind} contract`);
  return c;
};

const gangers = (sim: Simulation, c: Contract) => [...sim.world].filter((e) => e.tag === contractTag(c.id));

const killAll = (sim: Simulation, c: Contract) => {
  for (const e of gangers(sim, c)) e.health = { current: 0, max: e.health!.max };
  sim.step();
};

const complete = (sim: Simulation) => {
  sim.enqueue({ type: "complete-contract" });
  sim.step();
};

describe("delivery (Kaito → Hana, against the clock)", () => {
  it("accept, hand over before the deadline, collect from Kaito", () => {
    const sim = Simulation.create({ seed: 3 });
    const cleared = collect(sim, "ContractCleared");
    const c = accept(sim, "delivery");
    expect(c).toMatchObject({ id: "c1", kind: "delivery", siteId: "hana_stall", targets: 0, status: "active" });
    expect(c.deadlineTick! - sim.tick).toBeGreaterThanOrEqual(50 * SIM_HZ - 1);
    // Nothing spawns for a delivery.
    expect([...sim.world].filter((e) => e.tag?.startsWith("contract:"))).toHaveLength(0);
    // Paying before the hand-over does nothing.
    complete(sim);
    expect(sim.domain.contracts.active?.status).toBe("active");
    sim.enqueue({ type: "deliver-contract" });
    sim.step();
    expect(cleared).toHaveLength(1);
    expect(sim.domain.contracts.active?.status).toBe("cleared");
    const before = sim.domain.wallet.eddies;
    // The card adds the bonus condition and the fixer's style (ADR-0029).
    const extra = debriefExtras(sim);
    complete(sim);
    expect(sim.domain.wallet.eddies).toBe(before + c.reward + extra());
    expect(sim.domain.contracts).toEqual({ active: null, completed: 1 });
    expect(sim.domain.reputation).toEqual({ fixers: 2, hebi: 0, civilians: 1, clinic: 0, kagami: 0, tessen: 0 });
  });

  it("fails at the deadline: no pay, Kaito's network is unhappy, the id is retired", () => {
    const sim = Simulation.create({ seed: 3 });
    const failed = collect<{ reason: string; contract: Contract }>(sim, "ContractFailed");
    const c = accept(sim, "delivery");
    // The next step runs at sim.tick: the last step before the deadline still counts.
    run(sim, c.deadlineTick! - sim.tick);
    expect(sim.domain.contracts.active?.status).toBe("active");
    sim.step();
    expect(failed).toEqual([{ contract: c, reason: "timeout" }]);
    expect(sim.domain.contracts).toEqual({ active: null, completed: 0 });
    expect(sim.domain.flags).toContain(contractFailedFlag("c1"));
    expect(sim.domain.reputation.fixers).toBe(-4);
    // Too late to hand anything over.
    sim.enqueue({ type: "deliver-contract" });
    sim.step();
    expect(sim.domain.contracts.active).toBeNull();
    expect(accept(sim, "delivery").id).toBe("c2");
  });

  it("the clock survives a save: a loaded game fails on the same tick", () => {
    const sim = Simulation.create({ seed: 3 });
    const c = accept(sim, "delivery");
    run(sim, 600);
    const restored = reload(sim);
    expect(restored.domain.contracts.active).toEqual(c);
    const failedA = collect(sim, "ContractFailed");
    const failedB = collect(restored, "ContractFailed");
    const left = c.deadlineTick! - sim.tick;
    run(sim, left);
    run(restored, left);
    expect(failedA).toHaveLength(0);
    expect(failedB).toHaveLength(0);
    sim.step();
    restored.step();
    expect(failedA).toHaveLength(1);
    expect(failedB).toHaveLength(1);
    expect(hash(restored)).toBe(hash(sim));
  });

  it("a delivery saved after the hand-over is paid after the load", () => {
    const sim = Simulation.create({ seed: 3 });
    const c = accept(sim, "delivery");
    sim.enqueue({ type: "deliver-contract" });
    sim.step();
    // Past the deadline does not matter any more.
    run(sim, c.deadlineTick! - sim.tick + 10);
    const restored = reload(sim);
    const before = restored.domain.wallet.eddies;
    // The card adds the bonus condition and the fixer's style (ADR-0029).
    const extra = debriefExtras(restored);
    complete(restored);
    expect(restored.domain.wallet.eddies).toBe(before + c.reward + extra());
  });
});

describe("retrieval (Hana's crate from the Hebi stash)", () => {
  const crateOf = (sim: Simulation, c: Contract) => byKey(sim, contractItemKey(c.id));
  const grab = (sim: Simulation) => {
    const spot = CONTRACT_ITEM_SPOTS.hebi_stash!;
    teleportPlayer(sim, at(spot.x - 1, spot.z), Math.PI / 2);
    sim.step(input({ interact: true }));
  };

  it("spawns guards and the crate; taking the crate clears the job; Hana pays", () => {
    const sim = Simulation.create({ seed: 4 });
    toMarket(sim);
    const c = accept(sim, "retrieve");
    expect(c).toMatchObject({ kind: "retrieve", siteId: "hebi_stash", status: "active" });
    expect(gangers(sim, c)).toHaveLength(c.targets);
    expect(crateOf(sim, c)?.interactable?.kind).toBe("pickup");
    const started = collect(sim, "InteractionStarted");
    grab(sim);
    expect(started).toHaveLength(0);
    expect(crateOf(sim, c)).toBeUndefined();
    expect(sim.domain.flags).toContain(takenFlag(contractItemKey(c.id)));
    expect(sim.domain.contracts.active?.status).toBe("cleared");
    // Killing the guards is optional and does not matter any more.
    killAll(sim, c);
    expect(sim.domain.contracts.active?.status).toBe("cleared");
    const before = sim.domain.wallet.eddies;
    // The card adds the bonus condition and the fixer's style (ADR-0029).
    const extra = debriefExtras(sim);
    const rep = sim.domain.reputation;
    complete(sim);
    expect(sim.domain.wallet.eddies).toBe(before + c.reward + extra());
    expect(sim.domain.reputation).toEqual({ ...rep, civilians: rep.civilians + 3, hebi: rep.hebi - 4, fixers: rep.fixers + 1 });
  });

  it("killing the guards alone does not clear it", () => {
    const sim = Simulation.create({ seed: 4 });
    toMarket(sim);
    const c = accept(sim, "retrieve");
    killAll(sim, c);
    expect(sim.domain.contracts.active?.status).toBe("active");
    expect(crateOf(sim, c)).toBeDefined();
  });

  it("the crate waits in its chunk and in the save; once taken it never comes back", () => {
    const sim = Simulation.create({ seed: 4 });
    // Accepted far away: the crate is registered, not spawned.
    const c = accept(sim, "retrieve");
    expect(crateOf(sim, c)).toBeUndefined();
    const restored = reload(sim);
    toMarket(restored);
    expect(crateOf(restored, c)).toBeDefined();
    grab(restored);
    expect(restored.domain.contracts.active?.status).toBe("cleared");
    // Leave the market and come back, then save and load: still gone.
    teleportPlayer(restored, at(300, -84));
    restored.step();
    toMarket(restored);
    expect(crateOf(restored, c)).toBeUndefined();
    const again = reload(restored);
    toMarket(again);
    expect(crateOf(again, c)).toBeUndefined();
  });

  it("a save in the middle of the raid continues exactly like the original", () => {
    const sim = Simulation.create({ seed: 4 });
    toMarket(sim);
    accept(sim, "retrieve");
    run(sim, 30);
    const restored = reload(sim);
    expect(hash(restored)).toBe(hash(sim));
    for (const s of [sim, restored]) {
      grab(s);
      run(s, 120, input({ fire: true }));
    }
    expect(hash(restored)).toBe(hash(sim));
    expect(restored.domain.contracts.active?.status).toBe("cleared");
  });
});

describe("protection (Hebi come for Oyaji)", () => {
  /** Hebi friendly to the player: the wave ignores Seki and goes straight for Oyaji. */
  const friendlyHebi = (sim: Simulation) => withDomain(sim, (d) => ({ ...d, reputation: { ...d.reputation, hebi: 30 } }));

  it("the wave goes for Oyaji; killing it clears the job; Hana pays", () => {
    const sim = Simulation.create({ seed: 5 });
    toMarket(sim);
    const oyaji = byKey(sim, "oyaji")!;
    oyaji.health = { current: 40, max: OYAJI_MAX_HP };
    const c = accept(sim, "protect");
    expect(c).toMatchObject({ kind: "protect", status: "active" });
    // He has patched himself up since last time.
    expect(byKey(sim, "oyaji")!.health!.current).toBe(OYAJI_MAX_HP);
    const wave = gangers(sim, c);
    expect(wave).toHaveLength(c.targets);
    expect(wave.every((g) => g.ai?.victim === "oyaji")).toBe(true);
    const rep = sim.domain.reputation;
    killAll(sim, c);
    expect(sim.domain.contracts.active?.status).toBe("cleared");
    const before = sim.domain.wallet.eddies;
    // The card adds the bonus condition and the fixer's style (ADR-0029).
    const extra = debriefExtras(sim);
    complete(sim);
    expect(sim.domain.wallet.eddies).toBe(before + c.reward + extra());
    expect(sim.domain.reputation).toEqual({
      ...rep,
      hebi: rep.hebi - 4 * c.targets - 3,
      civilians: rep.civilians - c.targets + 6,
    });
  });

  it("left alone, the wave walks up to Oyaji and shoots him; the job fails without blaming Seki for the death", () => {
    const sim = friendlyHebi(Simulation.create({ seed: 5 }));
    toMarket(sim);
    const failed = collect<{ reason: string }>(sim, "ContractFailed");
    const c = accept(sim, "protect");
    const [g] = gangers(sim, c);
    const start = Math.hypot(g!.position.x - 80, g!.position.z - 66.6);
    run(sim, 120);
    expect(Math.hypot(g!.position.x - 80, g!.position.z - 66.6)).toBeLessThan(start - 3);
    const civilians = sim.domain.reputation.civilians;
    for (let i = 0; i < 60 * 90 && failed.length === 0; i++) sim.step();
    expect(failed).toEqual([{ contract: c, reason: "protectee-killed" }]);
    expect(sim.domain.flags).toContain("dead:oyaji");
    expect(sim.domain.contracts.active).toBeNull();
    // Only the failed job counts, not Oyaji's death (Hebi pulled the trigger).
    expect(sim.domain.reputation.civilians).toBe(civilians - 5);
    // Nobody left to protect.
    sim.enqueue({ type: "accept-contract", kind: "protect" });
    sim.step();
    expect(sim.domain.contracts.active).toBeNull();
    // Oyaji runs from the shots now (ADR-0029), so the wave needs about 45 s of play: roomy timeout.
  }, 20_000);

  it("is only on while Oyaji's stall is open (8:00 to 22:00)", () => {
    const at = (hour: number, minute = 0) =>
      withDomain(Simulation.create({ seed: 5 }), (d) => ({ ...d, clock: { seconds: (hour * 60 + minute) * 60 } }));
    for (const [hour, minute] of [[23, 0], [7, 59], [22, 0]] as const) {
      const sim = at(hour, minute);
      sim.enqueue({ type: "accept-contract", kind: "protect" });
      sim.step();
      expect(sim.domain.contracts.active).toBeNull();
    }
    const morning = at(8, 0);
    morning.enqueue({ type: "accept-contract", kind: "protect" });
    morning.step();
    expect(morning.domain.contracts.active?.kind).toBe("protect");
  });

  it("is refused while Oyaji lies knocked out (ADR-0065)", () => {
    const sim = Simulation.create({ seed: 5 });
    toMarket(sim);
    const oyaji = byKey(sim, "oyaji")!;
    sim.world.addComponent(oyaji, "unconscious", true);
    sim.enqueue({ type: "accept-contract", kind: "protect" });
    sim.step();
    expect(sim.domain.contracts.active).toBeNull();
    sim.world.removeComponent(oyaji, "unconscious");
    sim.enqueue({ type: "accept-contract", kind: "protect" });
    sim.step();
    expect(sim.domain.contracts.active?.kind).toBe("protect");
  });

  it("Seki killing Oyaji is a civilian murder and fails the job too", () => {
    const sim = Simulation.create({ seed: 5 });
    toMarket(sim);
    accept(sim, "protect");
    const oyaji = byKey(sim, "oyaji")!;
    const civilians = sim.domain.reputation.civilians;
    oyaji.lastHitBy = sim.player()!.id;
    oyaji.health = { current: 0, max: OYAJI_MAX_HP };
    sim.step();
    expect(sim.domain.contracts.active).toBeNull();
    expect(sim.domain.reputation.civilians).toBe(civilians - 25 - 5);
  });

  it("a save during the raid continues exactly like the original", () => {
    const sim = friendlyHebi(Simulation.create({ seed: 5 }));
    toMarket(sim);
    accept(sim, "protect");
    // Saved while the wave walks in, before anyone fires: weapon bloom is transient and not saved (ADR-0016).
    const shots = collect(sim, "ShotFired");
    run(sim, 60);
    expect(shots).toHaveLength(0);
    const restored = reload(sim);
    expect(hash(restored)).toBe(hash(sim));
    run(sim, 900);
    run(restored, 900);
    expect(byKey(sim, "oyaji")?.health?.current ?? 0).toBeLessThan(OYAJI_MAX_HP);
    expect(byKey(restored, "oyaji")?.health).toEqual(byKey(sim, "oyaji")?.health);
    expect(hash(restored)).toBe(hash(sim));
  });
});

describe("one contract at a time", () => {
  it("a running job from either giver blocks the other", () => {
    const sim = Simulation.create({ seed: 6 });
    const c = accept(sim, "delivery");
    sim.enqueue({ type: "accept-contract", kind: "retrieve" });
    sim.enqueue({ type: "accept-contract" });
    sim.step();
    expect(sim.domain.contracts.active).toEqual(c);
  });

  it("deliver-contract only applies to a running delivery", () => {
    const sim = Simulation.create({ seed: 6 });
    accept(sim, "eliminate");
    sim.enqueue({ type: "deliver-contract" });
    sim.step();
    expect(sim.domain.contracts.active?.status).toBe("active");
  });
});
