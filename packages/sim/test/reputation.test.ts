import { describe, expect, it } from "vitest";
import { CYBERWARE_CATALOG, STACKABLE_CATALOG, type ReputationState, priceWithTerms, shopTerms } from "@seki/core";
import { FLEE_DEAD_ZONE, FLEE_RADIUS, HOSTILE_AGGRO_MULTIPLIER, KRAKOWSKIE_SITE_POINTS, Simulation, effectiveAggroRange, ground, stateHash } from "../src";
import { byKey, collect, input, passerbyOnDeptak, run, teleportPlayer } from "./helpers";

/** A fresh game whose standings are patched in, built the way a load would build it. */
const simWith = (reputation: Partial<ReputationState>, seed = 3): Simulation => {
  const snap = Simulation.create({ seed }).snapshot(null, "test", "");
  return Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, reputation: { ...snap.domain.reputation, ...reputation }, wallet: { eddies: 5000 } } });
};

const gangerShots = (sim: Simulation) => {
  const shots = collect<{ shooterId: number }>(sim, "ShotFired");
  return () => shots.filter((s) => s.shooterId !== sim.player()?.id);
};

/** The M0 guard's post in the yard behind the car wash on Plac Łokietka (ADR-0045). */
const POST = KRAKOWSKIE_SITE_POINTS.car_wash(-2.5, 39.5);

/**
 * Turns the guard towards `at`: he faces into the yard, and the mouth of it is behind his back
 * (since ADR-0069 every ganger sees in a cone, so "in plain view" means in front of him).
 */
const guardFacing = (sim: Simulation, at: { x: number; z: number }) => {
  const g = byKey(sim, "guard")!;
  g.yaw = Math.atan2(at.x - g.position.x, at.z - g.position.z);
  g.prevYaw = g.yaw;
};

/** Stands the player at the mouth of the yard on Plac Łokietka, in plain view of the guard. */
const intoAlley = (sim: Simulation) => {
  const at = ground(POST.x + 0.5, POST.z + 7);
  guardFacing(sim, at);
  teleportPlayer(sim, at);
};

describe("reputation from deeds", () => {
  it("killing a ganger costs standing with Hebi and earns some with the street (ADR-0070)", () => {
    const sim = Simulation.create({ seed: 1 });
    const changes = collect(sim, "ReputationChanged");
    byKey(sim, "guard")!.health = { current: 0, max: 80 };
    sim.step();
    expect(sim.domain.reputation).toEqual({ fixers: 0, hebi: -4, civilians: 1, clinic: 0, kagami: 0, tessen: 0 });
    expect(changes).toEqual([
      { faction: "hebi", value: -4, delta: -4 },
      { faction: "civilians", value: 1, delta: 1 },
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

  it("opens the clinic to a hostile customer, with the basics only and half again the price (ADR-0070)", () => {
    const sim = simWith({ clinic: -60 });
    const failed = collect(sim, "PurchaseFailed");
    const bought = collect<{ price: number }>(sim, "ItemBought");
    const refused = collect(sim, "InteractionRefused");
    const started = collect(sim, "InteractionStarted");
    sim.enqueue({ type: "buy-item", itemId: "medkit" });
    sim.enqueue({ type: "buy-cyberware", cyberwareId: "steady_grip" });
    sim.enqueue({ type: "remove-cyberware", slot: "optics" });
    const mori = byKey(sim, "mori")!;
    teleportPlayer(sim, { x: mori.position.x + 1.2, y: mori.position.y, z: mori.position.z });
    sim.step();
    sim.step(input({ interact: true }));
    const price = priceWithTerms(STACKABLE_CATALOG.medkit.value, shopTerms(-60));
    expect(price).toBe(Math.round(STACKABLE_CATALOG.medkit.value * 1.5));
    expect(bought.map((e) => e.price)).toEqual([price]);
    expect(failed).toEqual([
      { reason: "refused", shopId: "clinic" },
      { reason: "refused", shopId: "clinic" },
    ]);
    expect(sim.domain.wallet.eddies).toBe(5000 - price);
    expect(sim.domain.character.cyberware.arms).toBeUndefined();
    expect(sim.domain.character.cyberware.optics).toBe("hitomi_optics_mk1");
    expect(refused).toHaveLength(0);
    expect(started).toEqual([{ targetId: mori.id, dialogueId: "mori", kind: "shop", shopId: "clinic" }]);
    expect(sim.session.dialogueActive).toBe(true);
  });

  it("opens the shop as usual for a neutral customer", () => {
    const sim = simWith({});
    const started = collect(sim, "InteractionStarted");
    const mori = byKey(sim, "mori")!;
    teleportPlayer(sim, { x: mori.position.x + 1.2, y: mori.position.y, z: mori.position.z });
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
    expect(Math.hypot(guard.position.x - POST.x, guard.position.z - POST.z)).toBeLessThan(0.05);
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
    // 21 m from the guard, straight out over Plac Łokietka: beyond the base range, within the hostile one.
    const at = ground(POST.x, POST.z + 21);
    // He looks out at her; it takes him a moment to make her out (ADR-0069), so both get two seconds.
    const neutral = simWith({});
    guardFacing(neutral, at);
    teleportPlayer(neutral, at);
    run(neutral, 100);
    expect(byKey(neutral, "guard")?.ai?.alerted).toBe(false);
    const hostile = simWith({ hebi: -40 });
    guardFacing(hostile, at);
    teleportPlayer(hostile, at);
    run(hostile, 100);
    expect(byKey(hostile, "guard")?.ai?.alerted).toBe(true);
  });
});

describe("civilians and the street's opinion", () => {
  it("stay put while the street is neutral", () => {
    const sim = simWith({});
    const ume = byKey(sim, "ume")!;
    const home = ume.position;
    teleportPlayer(sim, { x: home.x + 2, y: home.y, z: home.z });
    run(sim, 120);
    expect(byKey(sim, "ume")!.position).toEqual(home);
  });

  // ADR-0070: only passers-by run, and only from a street hostile to the player (≤ -50); Ume, with
  // her conversation, keeps to her spot (reputation-tiers.test.ts).
  const walkerDistance = (sim: Simulation, id: number) => {
    const w = [...sim.world].find((e) => e.id === id)!;
    const p = sim.player()!;
    return Math.hypot(w.position.x - p.position.x, w.position.z - p.position.z);
  };

  it("run from a player the street is hostile to, then walk back to their spot", () => {
    const sim = simWith({ civilians: -60 });
    const reactions = collect<{ reaction: string; faction: string }>(sim, "NpcReacted");
    const walker = passerbyOnDeptak(sim);
    const spot = { ...walker.position };
    run(sim, 60);
    expect(walkerDistance(sim, walker.id)).toBeGreaterThan(2.5);
    expect(reactions).toEqual([{ entityId: walker.id, faction: "civilians", reaction: "flee" }]);
    // The player walks away; once out of range it returns to its spot.
    teleportPlayer(sim, ground(290, -60));
    run(sim, 900);
    const now = [...sim.world].find((e) => e.id === walker.id)!;
    expect(Math.hypot(now.position.x - spot.x, now.position.z - spot.z)).toBeLessThanOrEqual(0.5);
  });

  it("cue one escape however long they stand off past the flee radius, a new one after a real break (G-281)", () => {
    const sim = simWith({ civilians: -60 });
    const reactions = collect<{ reaction: string }>(sim, "NpcReacted");
    const walker = passerbyOnDeptak(sim);
    const spot = { ...walker.position };
    // Runs off and stands past the radius, its spot within it (the dead zone, ADR-0070).
    run(sim, 1200);
    expect(walkerDistance(sim, walker.id)).toBeGreaterThanOrEqual(FLEE_RADIUS);
    expect(walkerDistance(sim, walker.id)).toBeLessThanOrEqual(FLEE_RADIUS + FLEE_DEAD_ZONE);
    expect(reactions).toHaveLength(1);
    teleportPlayer(sim, ground(290, -60));
    run(sim, 900);
    teleportPlayer(sim, { x: spot.x + 2, y: spot.y, z: spot.z });
    run(sim, 60);
    expect(reactions).toHaveLength(2);
  });

  it("only flee within the flee radius", () => {
    const sim = simWith({ civilians: -60 });
    const walker = passerbyOnDeptak(sim, FLEE_RADIUS + 1.5);
    const spot = { ...walker.position };
    run(sim, 60);
    const now = [...sim.world].find((e) => e.id === walker.id)!;
    expect(Math.hypot(now.position.x - spot.x, now.position.z - spot.z)).toBeLessThan(0.05);
  });

  it("the ripperdoc does not run: the clinic is a faction of its own", () => {
    const sim = simWith({ civilians: -80 });
    const mori = byKey(sim, "mori")!;
    const home = mori.position;
    expect(mori.faction).toBe("clinic");
    teleportPlayer(sim, { x: home.x + 1.5, y: home.y, z: home.z });
    run(sim, 60);
    expect(byKey(sim, "mori")!.position).toEqual(home);
  });

  // A passer-by has no key, so neither the save nor `stateHash` holds it (G-327): mid-escape, a
  // load cannot carry on its run. The save carries the player and the street's standing; the
  // passer-by comes back at its spot and, the street still hostile, runs from the player again.
  it("a load mid-escape keeps the player's game; the passer-by is back at its spot and runs again", () => {
    const sim = simWith({ civilians: -60 }, 11);
    const walker = passerbyOnDeptak(sim);
    const spot = { ...walker.position };
    run(sim, 20);
    expect(walker.key).toBeUndefined();
    const restored = Simulation.fromSnapshot(sim.snapshot(null, "x", ""));
    const reactions = collect<{ entityId: number; reaction: string }>(restored, "NpcReacted");
    const frame = input({ moveX: -1 });
    run(sim, 1, frame);
    run(restored, 1, frame);
    expect(walkerDistance(restored, walker.id)).toBeLessThan(walkerDistance(sim, walker.id));
    // Spawned at its spot in this step, and already one step into its run.
    const back = [...restored.world].find((e) => e.id === walker.id)!.position;
    expect(Math.hypot(back.x - spot.x, back.z - spot.z)).toBeLessThan(0.1);
    run(sim, 89, frame);
    run(restored, 89, frame);
    expect(stateHash(restored.snapshot(null, "x", ""))).toBe(stateHash(sim.snapshot(null, "x", "")));
    expect(reactions.map((r) => [r.entityId, r.reaction])).toEqual([[walker.id, "flee"]]);
    const now = [...restored.world].find((e) => e.id === walker.id)!.position;
    expect(Math.hypot(now.x - spot.x, now.z - spot.z)).toBeGreaterThan(2.5);
  });
});
