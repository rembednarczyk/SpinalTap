import { describe, expect, it } from "vitest";
import { ABILITY_CATALOG, CONTRACT_SITE_SPAWNS_COUNT_GUARD, contractTag, type Contract } from "./m1-helpers";
import { GANGER_SPEED, Simulation, contractGangerHp, stateHash } from "../src";
import { byKey, collect, input, run, teleportPlayer } from "./helpers";

/** A copy of the simulation with a patched domain, built the way a load would build it. */
const withDomain = (sim: Simulation, patch: (d: Simulation["domain"]) => Simulation["domain"]): Simulation => {
  const snap = sim.snapshot(null, "test", "");
  return Simulation.fromSnapshot({ ...snap, domain: patch(snap.domain) });
};

const contractTargets = (sim: Simulation, c: Contract) => [...sim.world].filter((e) => e.tag === contractTag(c.id));

const acceptContract = (sim: Simulation): Contract => {
  sim.enqueue({ type: "accept-contract" });
  sim.step();
  const c = sim.domain.contracts.active;
  if (!c) throw new Error("no contract");
  return c;
};

const killAll = (sim: Simulation, c: Contract) => {
  for (const e of contractTargets(sim, c)) e.health = { current: 0, max: e.health!.max };
  sim.step();
};

describe("fixer contracts", () => {
  it("accepting spawns tagged targets at the contract site", () => {
    const sim = Simulation.create({ seed: 9 });
    const accepted = collect(sim, "ContractAccepted");
    const c = acceptContract(sim);
    expect(accepted).toHaveLength(1);
    expect(c.status).toBe("active");
    expect(contractTargets(sim, c)).toHaveLength(c.targets);
    expect(contractTargets(sim, c)[0]?.health?.max).toBe(contractGangerHp(0));
    expect(CONTRACT_SITE_SPAWNS_COUNT_GUARD).toBe(true);
  });

  it("ignores a second accept while a contract is running", () => {
    const sim = Simulation.create({ seed: 9 });
    const c = acceptContract(sim);
    sim.enqueue({ type: "accept-contract" });
    sim.step();
    expect(sim.domain.contracts.active).toEqual(c);
  });

  it("clears when every target is down, then pays out once on completion", () => {
    const sim = Simulation.create({ seed: 9 });
    const cleared = collect(sim, "ContractCleared");
    const completed = collect<{ reward: number }>(sim, "ContractCompleted");
    const c = acceptContract(sim);
    sim.enqueue({ type: "complete-contract" });
    sim.step();
    expect(completed).toHaveLength(0);
    killAll(sim, c);
    expect(cleared).toHaveLength(1);
    expect(sim.domain.contracts.active?.status).toBe("cleared");
    const before = sim.domain.wallet.eddies;
    sim.enqueue({ type: "complete-contract" });
    sim.enqueue({ type: "complete-contract" });
    sim.step();
    expect(completed).toEqual([expect.objectContaining({ reward: c.reward })]);
    expect(sim.domain.wallet.eddies).toBe(before + c.reward);
    expect(sim.domain.contracts).toEqual({ active: null, completed: 1 });
    // -4 per target killed, -5 for completing the contract.
    expect(sim.domain.reputation).toEqual({ fixers: 3, hebi: -4 * c.targets - 5, civilians: 1 - c.targets, clinic: 0 });
  });

  it("a load in the middle of a contract restores only the surviving targets", () => {
    const sim = Simulation.create({ seed: 9 });
    const c = acceptContract(sim);
    const [first] = contractTargets(sim, c);
    first!.health = { current: 0, max: 80 };
    sim.step();
    const restored = Simulation.fromSnapshot(sim.snapshot(null, "x", ""));
    expect(contractTargets(restored, c).map((e) => e.key).sort()).toEqual(contractTargets(sim, c).map((e) => e.key).sort());
    expect(contractTargets(restored, c)).toHaveLength(c.targets - 1);
  });

  it("save/load with deaths and spawns continues exactly like the original", () => {
    const sim = Simulation.create({ seed: 77 });
    const c = acceptContract(sim);
    // Kill the M0 guard and one contract target so miniplex reorders its buckets.
    byKey(sim, "guard")!.health = { current: 0, max: 80 };
    contractTargets(sim, c)[0]!.health = { current: 0, max: 80 };
    sim.step();
    teleportPlayer(sim, { x: 0, y: 0, z: 0 });
    const restored = Simulation.fromSnapshot(sim.snapshot(null, "x", ""));
    const frames = [input({ moveZ: 1, fire: true }), input({ moveX: 1, lookYaw: 0.02, fire: true }), input({ moveZ: -1 })];
    for (let i = 0; i < 600; i++) {
      const f = frames[i % frames.length]!;
      sim.step(f);
      restored.step(f);
    }
    expect(stateHash(restored.snapshot(null, "x", ""))).toBe(stateHash(sim.snapshot(null, "x", "")));
  });
});

describe("ripperdoc", () => {
  it("installs cyberware for eddies and reports failures", () => {
    const sim = Simulation.create({ seed: 1 });
    const failed = collect<{ reason: string }>(sim, "PurchaseFailed");
    const installed = collect(sim, "CyberwareInstalled");
    sim.enqueue({ type: "buy-cyberware", cyberwareId: "kairos_overclock" });
    sim.step();
    expect(failed).toEqual([{ reason: "insufficient-funds" }]);
    const rich = withDomain(sim, (d) => ({ ...d, wallet: { eddies: 2000 } }));
    const richInstalled = collect(rich, "CyberwareInstalled");
    rich.enqueue({ type: "buy-cyberware", cyberwareId: "kairos_overclock" });
    rich.enqueue({ type: "buy-item", itemId: "medkit" });
    rich.step();
    expect(installed).toHaveLength(0);
    expect(richInstalled).toHaveLength(1);
    expect(rich.domain.character.cyberware.nervous).toBe("kairos_overclock");
    expect(rich.domain.wallet.eddies).toBe(2000 - 1100 - 90);
    expect(rich.domain.inventory.medkit).toBe(2);
  });

  it("opens as a shop interaction", () => {
    const sim = Simulation.create({ seed: 1 });
    const started = collect<{ kind: string; dialogueId: string }>(sim, "InteractionStarted");
    const mori = byKey(sim, "mori")!;
    teleportPlayer(sim, { x: mori.position.x + 1.5, y: 0, z: mori.position.z });
    sim.step(input({ interact: true }));
    expect(started).toEqual([expect.objectContaining({ kind: "shop", dialogueId: "mori" })]);
  });
});

describe("medkits", () => {
  it("heal a hurt player and are consumed; a healthy player keeps them", () => {
    const sim = Simulation.create({ seed: 1 });
    const used = collect<{ healed: number }>(sim, "ItemUsed");
    sim.step(input({ useItem: true }));
    expect(sim.domain.inventory.medkit).toBe(1);
    sim.player()!.health = { current: 30, max: 100 };
    sim.step(input({ useItem: true }));
    expect(used).toEqual([expect.objectContaining({ healed: 40 })]);
    expect(sim.player()!.health!.current).toBe(70);
    expect(sim.domain.inventory.medkit).toBe(0);
    sim.player()!.health = { current: 30, max: 100 };
    sim.step(input({ useItem: true }));
    expect(sim.player()!.health!.current).toBe(30);
  });
});

describe("reflex overdrive", () => {
  const withKairos = (sim: Simulation) =>
    withDomain(sim, (d) => ({ ...d, character: { ...d.character, cyberware: { ...d.character.cyberware, nervous: "kairos_overclock" } } }));

  it("does nothing without the implant", () => {
    const sim = Simulation.create({ seed: 1 });
    const on = collect(sim, "AbilityActivated");
    sim.step(input({ ability: true }));
    expect(on).toHaveLength(0);
  });

  it("slows gangers while active, ends on time and respects the cooldown", () => {
    const sim = withKairos(Simulation.create({ seed: 1 }));
    const on = collect(sim, "AbilityActivated");
    const off = collect(sim, "AbilityEnded");
    const guard = byKey(sim, "guard")!;
    guard.ai!.alerted = true;
    teleportPlayer(sim, { x: -2.5, y: 0, z: 20 });
    sim.step(input({ ability: true }));
    expect(on).toHaveLength(1);
    const z0 = guard.position.z;
    run(sim, 30);
    const slowed = z0 - guard.position.z;
    expect(slowed).toBeCloseTo(GANGER_SPEED * 0.5 * ABILITY_CATALOG.reflex_overdrive.enemyTimeScale, 1);
    run(sim, 60 * 4);
    expect(off).toHaveLength(1);
    sim.step(input({ ability: true }));
    expect(on).toHaveLength(1);
    run(sim, 60 * 12);
    sim.step(input({ ability: true }));
    expect(on).toHaveLength(2);
  });
});

describe("headshots", () => {
  it("deal more damage than body shots", () => {
    const damage = (pitch: number) => {
      const sim = Simulation.create({ seed: 5 });
      const hits = collect<{ amount: number; headshot: boolean; critical: boolean }>(sim, "DamageDealt");
      const guard = byKey(sim, "guard")!;
      teleportPlayer(sim, { x: guard.position.x, y: 0, z: guard.position.z - 4 }, 0, pitch);
      for (let i = 0; i < 40 && hits.length === 0; i++) sim.step(input({ fire: true }));
      return hits[0]!;
    };
    // Eye at 1.62 m: aim slightly up for the head (>1.49 m at 4 m), down for the chest.
    const head = damage(-0.02);
    const body = damage(0.1);
    expect(head.headshot).toBe(true);
    expect(body.headshot).toBe(false);
    expect(head.amount).toBeGreaterThan(body.amount);
  });
});
