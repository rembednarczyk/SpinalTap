import { describe, expect, it } from "vitest";
import type { DespawnReason, EntityId, RenderPort, SaveSnapshot, Vec3 } from "@seki/core";
import {
  RenderSync,
  STREAMING_RADII,
  Simulation,
  TARG_NORTH_BOUNDS,
  TARG_SOUTH_BOUNDS,
  WORLD_CHUNKS,
  distanceToRect,
  ground,
  market,
  stateHash,
  type Entity,
} from "../src";
import { ALLEY_START, AWAY, byKey, input, run, teleportPlayer } from "./helpers";

/**
 * Lublin's chunks (ADR-0045): the deptak with the clinic, Neon Koi and the car wash; the Rynek
 * end of the Old Town; the two chunks of Podzamcze the market straddles.
 */
const HOME = "krakowskie-2-0";
const RYNEK = "stare-miasto-0-0";
const MARKET = "podzamcze-1-0";
/** Plac Łokietka by Brama Krakowska, Plac Zamkowy, and the market floor under the viaduct. */
const LOKIETKA = ground(440, -100);
const ZAMKOWY = ground(717.5, 296);
const IN_MARKET = market(96, 0, 90);

const hasKey = (sim: Simulation, key: string) => byKey(sim, key) !== undefined;

/** What the chunk holds of its own: loot bags come and go (stashes appear as Seki walks by, ADR-0026). */
const chunkEntities = (sim: Simulation, chunk: string): Entity[] => [...sim.world].filter((e) => e.chunk === chunk && !e.lootBag);

/** Teleports and runs one step, which is when streaming reacts. */
const goTo = (sim: Simulation, p: Vec3, yaw = 0) => {
  teleportPlayer(sim, p, yaw);
  sim.step();
};

const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;

const hash = (sim: Simulation) => stateHash(sim.snapshot(null, "t", ""));

/** Sprints to a point, turning towards it every step, until within half a metre or it gives up. */
const walkTo = (sim: Simulation, x: number, z: number, maxSteps = 1200): number => {
  const p = sim.player()!;
  for (let i = 0; i < maxSteps; i++) {
    const d = Math.hypot(x - p.position.x, z - p.position.z);
    if (d < 0.5) return d;
    p.yaw = Math.atan2(x - p.position.x, z - p.position.z);
    sim.step(input({ moveZ: 1, sprint: true }));
  }
  return Math.hypot(x - p.position.x, z - p.position.z);
};

describe("world streaming: loading and unloading", () => {
  it("a new game holds only the deptak's chunk", () => {
    const sim = Simulation.create({ seed: 1 });
    expect(sim.streamer.loadedChunks).toEqual([HOME]);
    expect(sim.district).toBe("shinsekai-7");
    expect(chunkEntities(sim, RYNEK)).toHaveLength(0);
    expect(hasKey(sim, "oyaji")).toBe(false);
    expect(hasKey(sim, "fixer")).toBe(true);
  });

  it("loads the Old Town before the player reaches Brama Krakowska, and the market from Plac Zamkowy", () => {
    const sim = Simulation.create({ seed: 1 });
    goTo(sim, LOKIETKA);
    expect(sim.streamer.loadedChunks).toEqual([HOME, RYNEK]);
    expect(hasKey(sim, "oyaji")).toBe(false);
    goTo(sim, ZAMKOWY);
    expect(sim.district).toBe("targ");
    expect(sim.streamer.loadedChunks).toEqual(["podzamcze-0-0", MARKET]);
    expect(hasKey(sim, "oyaji")).toBe(true);
    expect(hasKey(sim, "hebi-lookout")).toBe(true);
  });

  it("unloads the deptak deep in the market and brings it back on return", () => {
    const sim = Simulation.create({ seed: 1 });
    const fixerId = byKey(sim, "fixer")!.id;
    const propCount = chunkEntities(sim, HOME).length;
    goTo(sim, ZAMKOWY);
    goTo(sim, IN_MARKET);
    expect(sim.district).toBe("targ");
    // Brama Grodzka is the Old Town's; the slope under it, Plac Zamkowy, is Podzamcze's.
    expect(sim.streamer.districtAt(ground(715, 140))).toBe("kanal");
    expect(sim.streamer.districtAt(ground(730, 175))).toBe("targ");
    expect(sim.streamer.isLoaded(HOME)).toBe(false);
    expect(hasKey(sim, "fixer")).toBe(false);
    expect(chunkEntities(sim, HOME)).toHaveLength(0);
    expect(sim.streamer.streamedOut.has(fixerId)).toBe(true);
    // Nothing of the deptak collides any more, the market does.
    expect([...sim.world.with("solid")].every((e) => e.chunk !== HOME)).toBe(true);

    goTo(sim, ALLEY_START);
    expect(sim.streamer.loadedChunks).toEqual([HOME]);
    expect(byKey(sim, "fixer")?.id).toBe(fixerId);
    expect(sim.streamer.streamedOut.has(fixerId)).toBe(false);
    // Everything that was there, and the background passers-by of ADR-0040, who come in with the first step.
    expect(chunkEntities(sim, HOME)).toHaveLength(propCount + (sim.streamer.passerbyIds.get(HOME)?.length ?? 0));
  });

  it("uses hysteresis: loads within the load radius, unloads only beyond the unload radius", () => {
    const { loadRadius, unloadRadius } = STREAMING_RADII;
    expect(unloadRadius).toBeGreaterThan(loadRadius);
    const sim = Simulation.create({ seed: 1 });
    // Along z = 300 across Plac Zamkowy, towards the market's chunk.
    const edge = WORLD_CHUNKS.find((c) => c.id === MARKET)!.bounds.minX;
    const on = (x: number) => ground(x, 300);
    goTo(sim, on(edge - 80));
    const loaded = () => sim.streamer.isLoaded(MARKET);
    goTo(sim, on(edge - loadRadius - 0.5));
    expect(loaded()).toBe(false);
    goTo(sim, on(edge - loadRadius + 0.5));
    expect(loaded()).toBe(true);
    // Backing off between the two radii keeps it resident.
    goTo(sim, on(edge - (loadRadius + unloadRadius) / 2));
    expect(loaded()).toBe(true);
    goTo(sim, on(edge - unloadRadius + 0.5));
    expect(loaded()).toBe(true);
    goTo(sim, on(edge - unloadRadius - 0.5));
    expect(loaded()).toBe(false);
    // ...and coming back between the radii does not reload it.
    goTo(sim, on(edge - (loadRadius + unloadRadius) / 2));
    expect(loaded()).toBe(false);
  });

  it("keeps the state of characters that slept in an unloaded chunk", () => {
    const sim = Simulation.create({ seed: 1 });
    const guard = byKey(sim, "guard")!;
    guard.health = { ...guard.health!, current: 37 };
    guard.yaw = 1.25;
    goTo(sim, ZAMKOWY);
    goTo(sim, IN_MARKET);
    expect(hasKey(sim, "guard")).toBe(false);
    expect(sim.snapshot(null, "x", "").entities.find((e) => e.key === "guard")).toMatchObject({ hp: 37, yaw: 1.25, alerted: false });
    goTo(sim, ALLEY_START);
    expect(byKey(sim, "guard")).toMatchObject({ id: guard.id, health: { current: 37 }, yaw: 1.25 });
  });

  it("does not stream out a ganger that is chasing the player", () => {
    const sim = Simulation.create({ seed: 1 });
    byKey(sim, "courier")!.ai!.alerted = true;
    goTo(sim, ZAMKOWY);
    goTo(sim, IN_MARKET);
    expect(sim.streamer.isLoaded(HOME)).toBe(false);
    expect(hasKey(sim, "courier")).toBe(true);
    expect(hasKey(sim, "guard")).toBe(false);
    // Its home chunk coming back does not duplicate it.
    goTo(sim, ALLEY_START);
    expect([...sim.world].filter((e) => e.key === "courier")).toHaveLength(1);
  });

  it("never brings the dead back", () => {
    const sim = Simulation.create({ seed: 1 });
    goTo(sim, IN_MARKET);
    const lookout = byKey(sim, "hebi-lookout")!;
    lookout.health = { ...lookout.health!, current: 0 };
    sim.step();
    expect(sim.domain.flags).toContain("dead:hebi-lookout");
    goTo(sim, AWAY);
    expect(sim.streamer.isLoaded(MARKET)).toBe(false);
    goTo(sim, IN_MARKET);
    expect(hasKey(sim, "hebi-lookout")).toBe(false);
  });

  it("a contract is not cleared while its targets sleep in an unloaded chunk", () => {
    // Seed 6 sends Kaito's job to the yard behind the car wash on Plac Łokietka.
    const sim = Simulation.create({ seed: 6 });
    sim.enqueue({ type: "accept-contract" });
    sim.step();
    const contract = sim.domain.contracts.active!;
    expect(contract.status).toBe("active");
    expect(contract.siteId).toBe("car_wash");
    goTo(sim, ZAMKOWY);
    goTo(sim, IN_MARKET);
    expect([...sim.world].some((e) => e.key?.startsWith(`${contract.id}-g`))).toBe(false);
    const lookout = byKey(sim, "hebi-lookout")!;
    lookout.health = { ...lookout.health!, current: 0 };
    sim.step();
    expect(sim.domain.contracts.active?.status).toBe("active");
    goTo(sim, ALLEY_START);
    expect([...sim.world].filter((e) => e.key?.startsWith(`${contract.id}-g`))).toHaveLength(contract.targets);
  });
});

describe("world streaming: saves", () => {
  it("a save in the market loads back into the market, with the deptak still asleep", () => {
    const sim = Simulation.create({ seed: 9 });
    const guard = byKey(sim, "guard")!;
    guard.health = { ...guard.health!, current: 41 };
    goTo(sim, ZAMKOWY);
    goTo(sim, market(92, 0, 70), 0.7);
    const saved = roundTrip(sim.snapshot(null, "market", ""));
    expect(saved.streaming.loadedChunks).toEqual([MARKET]);
    expect(saved.entities.find((e) => e.key === "player")?.position).toEqual(sim.player()!.position);

    const loaded = Simulation.fromSnapshot(saved);
    expect(loaded.streamer.loadedChunks).toEqual(saved.streaming.loadedChunks);
    expect(loaded.district).toBe("targ");
    expect(loaded.player()!.position).toEqual(sim.player()!.position);
    expect(loaded.player()!.yaw).toBeCloseTo(0.7);
    expect(hasKey(loaded, "fixer")).toBe(false);
    expect(hash(loaded)).toBe(hash(sim));

    // Walking home wakes the guard with the state it had when the save was made.
    goTo(loaded, ALLEY_START);
    expect(byKey(loaded, "guard")?.health?.current).toBe(41);
  });

  it("a loaded game keeps streaming exactly like the original", () => {
    const sim = Simulation.create({ seed: 11 });
    byKey(sim, "courier")!.ai!.alerted = true;
    // Up Bramowa from Brama Krakowska towards the Rynek: the deptak falls behind.
    teleportPlayer(sim, ground(497, -79));
    run(sim, 1);
    const upBramowa = Math.atan2(520 - 497, -63 - -79);
    sim.player()!.yaw = upBramowa;
    run(sim, 240, input({ moveZ: 1, sprint: true }));
    expect(sim.streamer.isLoaded(HOME)).toBe(false);
    const restored = Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "mid", "")));
    expect(hasKey(restored, "courier")).toBe(true);
    expect(hash(restored)).toBe(hash(sim));
    sim.player()!.yaw = upBramowa + Math.PI;
    restored.player()!.yaw = upBramowa + Math.PI;
    const back = input({ moveZ: 1, sprint: true, fire: true });
    for (let i = 0; i < 420; i++) {
      sim.step(back);
      restored.step(back);
    }
    expect(sim.streamer.isLoaded(HOME)).toBe(true);
    expect(restored.streamer.loadedChunks).toEqual(sim.streamer.loadedChunks);
    expect(hash(restored)).toBe(hash(sim));
  });

  it("an M1 save without chunk state loads the chunks around the player", () => {
    const old = Simulation.create({ seed: 2 }).snapshot(null, "m1", "");
    const migrated: SaveSnapshot = { ...old, streaming: { loadedChunks: [] } };
    expect(Simulation.fromSnapshot(migrated).streamer.loadedChunks).toEqual([HOME]);
    const unknown: SaveSnapshot = { ...old, streaming: { loadedChunks: ["moon-base"] } };
    expect(Simulation.fromSnapshot(unknown).streamer.loadedChunks).toEqual([HOME]);
  });

  it("restores a ganger that was chasing the player outside its chunk", () => {
    const sim = Simulation.create({ seed: 3 });
    byKey(sim, "guard")!.ai!.alerted = true;
    goTo(sim, ZAMKOWY);
    goTo(sim, IN_MARKET);
    const restored = Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "x", "")));
    expect(restored.streamer.isLoaded(HOME)).toBe(false);
    expect(byKey(restored, "guard")?.ai?.alerted).toBe(true);
    expect(hash(restored)).toBe(hash(sim));
  });
});

describe("world streaming: presentation", () => {
  class Port implements RenderPort {
    readonly views = new Set<EntityId>();
    readonly despawns: [EntityId, DespawnReason | undefined][] = [];
    spawn(id: EntityId) {
      this.views.add(id);
    }
    updateTransform() {}
    despawn(id: EntityId, reason?: DespawnReason) {
      this.views.delete(id);
      this.despawns.push([id, reason]);
    }
    clear() {
      this.views.clear();
    }
    setCameraMode() {}
    attachCamera() {}
    playEffect() {}
    setAppearance() {}
  }

  it("despawns streamed-out views as unloaded and killed ones as removed", () => {
    const sim = Simulation.create({ seed: 4 });
    const port = new Port();
    const sync = new RenderSync(port);
    sync.sync(sim.world, 0, sim.streamer.streamedOut);
    const fixer = byKey(sim, "fixer")!.id;
    const guard = byKey(sim, "guard")!;
    guard.health = { ...guard.health!, current: 0 };
    sim.step();
    sync.sync(sim.world, 0, sim.streamer.streamedOut);
    expect(port.despawns).toEqual([[guard.id, "removed"]]);
    goTo(sim, ZAMKOWY);
    goTo(sim, IN_MARKET);
    sync.sync(sim.world, 0, sim.streamer.streamedOut);
    expect(port.despawns).toContainEqual([fixer, "unloaded"]);
    expect(port.despawns.filter(([, r]) => r === "removed")).toHaveLength(1);
    expect(port.views.has(byKey(sim, "oyaji")!.id)).toBe(true);
  });
});

describe("world map", () => {
  it("has unique chunk ids and every prop inside its chunk's bounds", () => {
    expect(new Set(WORLD_CHUNKS.map((c) => c.id)).size).toBe(WORLD_CHUNKS.length);
    for (const c of WORLD_CHUNKS) {
      for (const p of c.props) expect(distanceToRect(p.center.x, p.center.z, c.bounds), `${c.id} prop at ${p.center.x},${p.center.z}`).toBe(0);
      for (const a of c.actors) expect(distanceToRect(a.spawn.position.x, a.spawn.position.z, c.bounds)).toBe(0);
    }
  });

  it("the deptak's chunk is out of the unload radius anywhere in the market", () => {
    const home = WORLD_CHUNKS.find((c) => c.id === HOME)!.bounds;
    for (const b of [TARG_SOUTH_BOUNDS, TARG_NORTH_BOUNDS]) {
      for (let x = b.minX; x <= b.maxX; x += 2) {
        for (let z = b.minZ; z <= b.maxZ; z += 2) {
          expect(distanceToRect(x, z, home)).toBeGreaterThan(STREAMING_RADII.unloadRadius);
        }
      }
    }
  });

  it("the streets are walkable from the deptak through the Old Town's gates into the market", () => {
    const sim = Simulation.create({ seed: 6 });
    teleportPlayer(sim, ALLEY_START);
    const districts = new Set<string | null>();
    // Plac Łokietka, Brama Krakowska, Bramowa, the Rynek, Grodzka under the footbridge, Brama
    // Grodzka, Zamkowa down to Plac Zamkowy and under the viaduct to the market (ADR-0045).
    const route = [
      [440, -100], [447, -95], [457, -95.6], [472, -91.4], [487, -87.2], [497, -79], [520, -63], [561, -40], [573, -28], [577, -23],
      [610, 14], [637, 47], [685, 112], [708, 134], [722, 147], [730, 155], [739, 174], [725, 193], [720, 203], [720, 267],
      [737, 286], [741, 327],
    ] as const;
    for (const [x, z] of route) {
      expect(walkTo(sim, x, z), `${x},${z}`).toBeLessThan(0.5);
      districts.add(sim.district);
    }
    expect([...districts]).toEqual(["shinsekai-7", "kanal", "targ"]);
    expect(sim.streamer.isLoaded(HOME)).toBe(false);
  }, 30_000);
});
