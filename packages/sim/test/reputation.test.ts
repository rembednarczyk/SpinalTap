import { describe, expect, it } from "vitest";
import { CYBERWARE_CATALOG, STACKABLE_CATALOG, type ReputationState, priceWithTerms, shopTerms } from "@seki/core";
import { FLEE_RADIUS, HOSTILE_AGGRO_MULTIPLIER, Simulation, effectiveAggroRange, stateHash } from "../src";
import { byKey, collect, input, run, teleportPlayer } from "./helpers";

/** A fresh game whose standings are patched in, built the way a load would build it. */
const simWith = (reputation: Partial<ReputationState>, seed = 3): Simulation => {
  const snap = Simulation.create({ seed }).snapshot(null, "test", "");
  return Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, reputation: { ...snap.domain.reputation, ...reputation }, wallet: { eddies: 5000 } } });
};

const gangerShots = (sim: Simulation) => {
  const shots = collect<{ shooterId: number }>(sim, "ShotFired");
  return () => shots.filter((s) => s.shooterId !== sim.player()?.id);
};

/** Stands the player in the alley mouth, in plain view of the guard. */
const intoAlley = (sim: Simulation) => teleportPlayer(sim, { x: 0, y: 0, z: 33 });

describe("reputation from deeds", () => {
  it("killing a ganger costs standing with Hebi and the street", () => {
    const sim = Simulation.create({ seed: 1 });
    const changes = collect(sim, "ReputationChanged");
    byKey(sim, "guard")!.health = { current: 0, max: 80 };
    sim.step();
    expect(sim.domain.reputation).toEqual({ fixers: 0, hebi: -4, civilians: -1, clinic: 0 });
    expect(changes).toEqual([
      { faction: "hebi", value: -4, delta: -4 },
      { faction: "civilians", value: -1, delta: -1 },
    ]);
  });

  it("paying customers raise the clinic's opinion", () => {
    const sim = simWith({});
    sim.enqueue({ type: "buy-cyberware", cyberwareId: "steady_grip" });
    sim.enqueue({ type: "buy-item", itemId: "medkit" });
    sim.step();
    expect(sim.domain.reputation.clinic).toBe(5);
  });
});

describe("the ripperdoc", () => {
  it("gives regulars a discount", () => {
    const sim = simWith({ clinic: 60 });
    const bought = collect<{ price: number }>(sim, "ItemBought");
    sim.enqueue({ type: "buy-item", itemId: "medkit" });
    sim.step();
    const price = priceWithTerms(STACKABLE_CATALOG.medkit.value, shopTerms(60));
    expect(price).toBeLessThan(STACKABLE_CATALOG.medkit.value);
    expect(bought).toEqual([{ itemId: "medkit", price, shopId: "clinic", qty: 1 }]);
    expect(sim.domain.wallet.eddies).toBe(5000 - price);
  });

  it("charges a wary customer extra", () => {
    const sim = simWith({ clinic: -20 });
    const installed = collect<{ price: number }>(sim, "CyberwareInstalled");
    sim.enqueue({ type: "buy-cyberware", cyberwareId: "steady_grip" });
    sim.step();
    expect(installed[0]?.price).toBe(Math.round(CYBERWARE_CATALOG.steady_grip.price * 1.25));
  });

  it("refuses to sell to, or even see, a hostile customer", () => {
    const sim = simWith({ clinic: -60 });
    const failed = collect(sim, "PurchaseFailed");
    const refused = collect(sim, "InteractionRefused");
    const started = collect(sim, "InteractionStarted");
    sim.enqueue({ type: "buy-item", itemId: "medkit" });
    const mori = byKey(sim, "mori")!;
    teleportPlayer(sim, { x: mori.position.x + 1.2, y: 0, z: mori.position.z });
    sim.step();
    sim.step(input({ interact: true }));
    expect(failed).toEqual([{ reason: "refused", shopId: "clinic" }]);
    expect(sim.domain.wallet.eddies).toBe(5000);
    expect(refused).toEqual([{ targetId: mori.id, dialogueId: "mori", faction: "clinic" }]);
    expect(started).toHaveLength(0);
    expect(sim.session.dialogueActive).toBe(false);
  });

  it("opens the shop as usual for a neutral customer", () => {
    const sim = simWith({});
    const started = collect(sim, "InteractionStarted");
    const mori = byKey(sim, "mori")!;
    teleportPlayer(sim, { x: mori.position.x + 1.2, y: 0, z: mori.position.z });
    sim.step();
    sim.step(input({ interact: true }));
    expect(started).toEqual([{ targetId: mori.id, dialogueId: "mori", kind: "shop", shopId: "clinic" }]);
  });
});

describe("gangers and Hebi's stance", () => {
  it("a neutral gang opens fire on sight", () => {
    const sim = simWith({});
    const shots = gangerShots(sim);
    intoAlley(sim);
    run(sim, 120);
    expect(byKey(sim, "guard")?.ai?.alerted).toBe(true);
    expect(shots().length).toBeGreaterThan(0);
  });

  it("a friendly gang watches instead of shooting, and warns once", () => {
    const sim = simWith({ hebi: 30 });
    const shots = gangerShots(sim);
    const reactions = collect<{ reaction: string; faction: string }>(sim, "NpcReacted");
    intoAlley(sim);
    run(sim, 240);
    expect(shots()).toHaveLength(0);
    expect(byKey(sim, "guard")?.ai?.alerted).toBe(false);
    const warns = reactions.filter((r) => r.reaction === "warn");
    expect(warns.length).toBeGreaterThan(0);
    expect(new Set(warns.map((w) => JSON.stringify(w))).size).toBe(warns.length);
    expect(warns.every((w) => w.faction === "hebi")).toBe(true);
    // The guard turned to face the player but stayed at its post.
    const guard = byKey(sim, "guard")!;
    expect(Math.hypot(guard.position.x - -2.5, guard.position.z - 39.5)).toBeLessThan(0.05);
  });

  it("a friendly gang fights back once provoked", () => {
    const sim = simWith({ hebi: 30 });
    const shots = gangerShots(sim);
    intoAlley(sim);
    run(sim, 30);
    sim.step(input({ fire: true }));
    expect(byKey(sim, "guard")?.ai?.alerted).toBe(true);
    run(sim, 180);
    expect(shots().length).toBeGreaterThan(0);
  });

  it("a hostile gang spots the player from further away", () => {
    expect(effectiveAggroRange(17, "hostile")).toBe(17 * HOSTILE_AGGRO_MULTIPLIER);
    expect(effectiveAggroRange(17, "neutral")).toBe(17);
    expect(effectiveAggroRange(17, "friendly")).toBe(17);
    // ~21 m from the guard, straight down the street: beyond the base range, within the hostile one.
    const at = { x: -2.5, y: 0, z: 18.5 };
    const neutral = simWith({});
    teleportPlayer(neutral, at);
    run(neutral, 5);
    expect(byKey(neutral, "guard")?.ai?.alerted).toBe(false);
    const hostile = simWith({ hebi: -40 });
    teleportPlayer(hostile, at);
    run(hostile, 5);
    expect(byKey(hostile, "guard")?.ai?.alerted).toBe(true);
  });
});

describe("civilians and the street's opinion", () => {
  const umeDistance = (sim: Simulation) => {
    const ume = byKey(sim, "ume")!;
    const p = sim.player()!;
    return Math.hypot(ume.position.x - p.position.x, ume.position.z - p.position.z);
  };

  it("stay put while the street is neutral", () => {
    const sim = simWith({});
    const ume = byKey(sim, "ume")!;
    const home = ume.position;
    teleportPlayer(sim, { x: home.x + 2, y: 0, z: home.z });
    run(sim, 120);
    expect(byKey(sim, "ume")!.position).toEqual(home);
  });

  it("run from a feared player, then walk back home", () => {
    const sim = simWith({ civilians: -30 });
    const reactions = collect<{ reaction: string; faction: string }>(sim, "NpcReacted");
    const home = byKey(sim, "ume")!.position;
    teleportPlayer(sim, { x: home.x + 2, y: 0, z: home.z });
    run(sim, 60);
    expect(umeDistance(sim)).toBeGreaterThan(2.5);
    expect(reactions).toEqual([{ entityId: byKey(sim, "ume")!.id, faction: "civilians", reaction: "flee" }]);
    // The player walks away; once out of range she returns to her spot.
    teleportPlayer(sim, { x: 0, y: 0, z: 30 });
    run(sim, 900);
    const ume = byKey(sim, "ume")!;
    expect(Math.hypot(ume.position.x - home.x, ume.position.z - home.z)).toBeLessThanOrEqual(0.3);
    expect(ume.velocity).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("only flee within the flee radius", () => {
    const sim = simWith({ civilians: -30 });
    const home = byKey(sim, "ume")!.position;
    teleportPlayer(sim, { x: home.x + FLEE_RADIUS + 1.5, y: 0, z: home.z });
    run(sim, 60);
    expect(byKey(sim, "ume")!.position).toEqual(home);
  });

  it("the ripperdoc does not run: the clinic is a faction of its own", () => {
    const sim = simWith({ civilians: -80 });
    const mori = byKey(sim, "mori")!;
    const home = mori.position;
    expect(mori.faction).toBe("clinic");
    teleportPlayer(sim, { x: home.x + 1.5, y: 0, z: home.z });
    run(sim, 60);
    expect(byKey(sim, "mori")!.position).toEqual(home);
  });

  it("a load mid-escape continues exactly like the original", () => {
    const sim = simWith({ civilians: -30 }, 11);
    const home = byKey(sim, "ume")!.position;
    teleportPlayer(sim, { x: home.x + 2, y: 0, z: home.z });
    run(sim, 20);
    const restored = Simulation.fromSnapshot(sim.snapshot(null, "x", ""));
    const frame = input({ moveX: -1 });
    run(sim, 90, frame);
    run(restored, 90, frame);
    expect(stateHash(restored.snapshot(null, "x", ""))).toBe(stateHash(sim.snapshot(null, "x", "")));
  });
});
