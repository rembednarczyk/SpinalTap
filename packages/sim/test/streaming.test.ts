import { describe, expect, it } from "vitest";
import type { DespawnReason, EntityId, RenderPort, SaveSnapshot } from "@seki/core";
import {
  RenderSync,
  STREAMING_RADII,
  Simulation,
  TARG_NORTH_BOUNDS,
  TARG_SOUTH_BOUNDS,
  WORLD_CHUNKS,
  distanceToRect,
  stateHash,
  type Entity,
} from "../src";
import { byKey, input, run, teleportPlayer } from "./helpers";

const at = (x: number, z: number) => ({ x, y: 0, z });

const hasKey = (sim: Simulation, key: string) => byKey(sim, key) !== undefined;

const chunkEntities = (sim: Simulation, chunk: string): Entity[] => [...sim.world].filter((e) => e.chunk === chunk);

/** Teleports and runs one step, which is when streaming reacts. */
const goTo = (sim: Simulation, x: number, z: number, yaw = 0) => {
  teleportPlayer(sim, at(x, z), yaw);
  sim.step();
};

const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;

const hash = (sim: Simulation) => stateHash(sim.snapshot(null, "t", ""));

/** Walks with sprint towards a point along the current heading until close, or gives up. */
const walk = (sim: Simulation, yaw: number, reached: (p: { x: number; z: number }) => boolean, maxSteps = 1200) => {
  const p = sim.player()!;
  p.yaw = yaw;
  for (let i = 0; i < maxSteps && !reached(p.position); i++) sim.step(input({ moveZ: 1, sprint: true }));
  return p.position;
};

describe("world streaming: loading and unloading", () => {
  it("a new game holds only Shinsekai 7", () => {
    const sim = Simulation.create({ seed: 1 });
    expect(sim.streamer.loadedChunks).toEqual(["shinsekai-7"]);
    expect(sim.district).toBe("shinsekai-7");
    expect(chunkEntities(sim, "kanal")).toHaveLength(0);
    expect(hasKey(sim, "oyaji")).toBe(false);
    expect(hasKey(sim, "fixer")).toBe(true);
  });

  it("loads the street before the player reaches the passage, and the market only once on the street", () => {
    const sim = Simulation.create({ seed: 1 });
    goTo(sim, 7, 40);
    expect(sim.streamer.loadedChunks).toEqual(["shinsekai-7", "kanal"]);
    goTo(sim, 40, 78);
    expect(sim.district).toBe("kanal");
    expect(sim.streamer.loadedChunks).toEqual(["shinsekai-7", "kanal", "targ-south", "targ-north", "doki-yard"]);
    expect(hasKey(sim, "oyaji")).toBe(true);
    expect(hasKey(sim, "hebi-lookout")).toBe(true);
  });

  it("unloads Shinsekai deep in the market and brings it back on return", () => {
    const sim = Simulation.create({ seed: 1 });
    const fixerId = byKey(sim, "fixer")!.id;
    const propCount = chunkEntities(sim, "shinsekai-7").length;
    goTo(sim, 30, 78);
    goTo(sim, 95, 78);
    expect(sim.district).toBe("targ");
    // Kanałowa's streaming bounds run on under the gate; the market names that strip.
    expect(sim.streamer.districtAt({ x: 72, y: 0, z: 78 })).toBe("targ");
    expect(sim.streamer.districtAt({ x: 60, y: 0, z: 78 })).toBe("kanal");
    expect(sim.streamer.isLoaded("shinsekai-7")).toBe(false);
    expect(hasKey(sim, "fixer")).toBe(false);
    expect(chunkEntities(sim, "shinsekai-7")).toHaveLength(0);
    expect(sim.streamer.streamedOut.has(fixerId)).toBe(true);
    // Nothing of the old district collides any more, the market does.
    expect([...sim.world.with("solid")].every((e) => e.chunk !== "shinsekai-7")).toBe(true);

    goTo(sim, 0, 0);
    expect(sim.streamer.loadedChunks).toEqual(["shinsekai-7"]);
    expect(byKey(sim, "fixer")?.id).toBe(fixerId);
    expect(sim.streamer.streamedOut.has(fixerId)).toBe(false);
    expect(chunkEntities(sim, "shinsekai-7")).toHaveLength(propCount);
  });

  it("uses hysteresis: loads within the load radius, unloads only beyond the unload radius", () => {
    const { loadRadius, unloadRadius } = STREAMING_RADII;
    expect(unloadRadius).toBeGreaterThan(loadRadius);
    const sim = Simulation.create({ seed: 1 });
    const edge = TARG_SOUTH_BOUNDS.minX;
    goTo(sim, 7, 60);
    goTo(sim, 7, 78);
    const loaded = () => sim.streamer.isLoaded("targ-south");
    goTo(sim, edge - loadRadius - 0.5, 78);
    expect(loaded()).toBe(false);
    goTo(sim, edge - loadRadius + 0.5, 78);
    expect(loaded()).toBe(true);
    // Backing off between the two radii keeps it resident.
    goTo(sim, edge - (loadRadius + unloadRadius) / 2, 78);
    expect(loaded()).toBe(true);
    goTo(sim, edge - unloadRadius + 0.5, 78);
    expect(loaded()).toBe(true);
    goTo(sim, edge - unloadRadius - 0.5, 78);
    expect(loaded()).toBe(false);
    // ...and coming back between the radii does not reload it.
    goTo(sim, edge - (loadRadius + unloadRadius) / 2, 78);
    expect(loaded()).toBe(false);
  });

  it("keeps the state of characters that slept in an unloaded chunk", () => {
    const sim = Simulation.create({ seed: 1 });
    const guard = byKey(sim, "guard")!;
    guard.health = { ...guard.health!, current: 37 };
    guard.yaw = 1.25;
    goTo(sim, 30, 78);
    goTo(sim, 95, 78);
    expect(hasKey(sim, "guard")).toBe(false);
    expect(sim.snapshot(null, "x", "").entities.find((e) => e.key === "guard")).toMatchObject({ hp: 37, yaw: 1.25, alerted: false });
    goTo(sim, 0, 20);
    expect(byKey(sim, "guard")).toMatchObject({ id: guard.id, health: { current: 37 }, yaw: 1.25 });
  });

  it("does not stream out a ganger that is chasing the player", () => {
    const sim = Simulation.create({ seed: 1 });
    byKey(sim, "courier")!.ai!.alerted = true;
    goTo(sim, 30, 78);
    goTo(sim, 95, 78);
    expect(sim.streamer.isLoaded("shinsekai-7")).toBe(false);
    expect(hasKey(sim, "courier")).toBe(true);
    expect(hasKey(sim, "guard")).toBe(false);
    // Its home chunk coming back does not duplicate it.
    goTo(sim, 0, 20);
    expect([...sim.world].filter((e) => e.key === "courier")).toHaveLength(1);
  });

  it("never brings the dead back", () => {
    const sim = Simulation.create({ seed: 1 });
    goTo(sim, 95, 78);
    const lookout = byKey(sim, "hebi-lookout")!;
    lookout.health = { ...lookout.health!, current: 0 };
    sim.step();
    expect(sim.domain.flags).toContain("dead:hebi-lookout");
    goTo(sim, 0, 0);
    expect(sim.streamer.isLoaded("targ-north")).toBe(false);
    goTo(sim, 95, 78);
    expect(hasKey(sim, "hebi-lookout")).toBe(false);
  });

  it("a contract is not cleared while its targets sleep in an unloaded chunk", () => {
    const sim = Simulation.create({ seed: 5 });
    sim.enqueue({ type: "accept-contract" });
    sim.step();
    const contract = sim.domain.contracts.active!;
    expect(contract.status).toBe("active");
    goTo(sim, 30, 78);
    goTo(sim, 95, 78);
    expect([...sim.world].some((e) => e.key?.startsWith(`${contract.id}-g`))).toBe(false);
    const lookout = byKey(sim, "hebi-lookout")!;
    lookout.health = { ...lookout.health!, current: 0 };
    sim.step();
    expect(sim.domain.contracts.active?.status).toBe("active");
    goTo(sim, 0, 0);
    expect([...sim.world].filter((e) => e.key?.startsWith(`${contract.id}-g`))).toHaveLength(contract.targets);
  });
});

describe("world streaming: saves", () => {
  it("a save in the market loads back into the market, with Shinsekai still asleep", () => {
    const sim = Simulation.create({ seed: 9 });
    const guard = byKey(sim, "guard")!;
    guard.health = { ...guard.health!, current: 41 };
    goTo(sim, 30, 78);
    goTo(sim, 92, 70, 0.7);
    const saved = roundTrip(sim.snapshot(null, "market", ""));
    expect(saved.streaming.loadedChunks).toEqual(["kanal", "targ-south", "targ-north"]);
    expect(saved.entities.find((e) => e.key === "player")?.position).toEqual(sim.player()!.position);

    const loaded = Simulation.fromSnapshot(saved);
    expect(loaded.streamer.loadedChunks).toEqual(saved.streaming.loadedChunks);
    expect(loaded.district).toBe("targ");
    expect(loaded.player()!.position).toEqual(sim.player()!.position);
    expect(loaded.player()!.yaw).toBeCloseTo(0.7);
    expect(hasKey(loaded, "fixer")).toBe(false);
    expect(hash(loaded)).toBe(hash(sim));

    // Walking home wakes the guard with the state it had when the save was made.
    goTo(loaded, 0, 20);
    expect(byKey(loaded, "guard")?.health?.current).toBe(41);
  });

  it("a loaded game keeps streaming exactly like the original", () => {
    const sim = Simulation.create({ seed: 11 });
    byKey(sim, "courier")!.ai!.alerted = true;
    teleportPlayer(sim, at(7, 70));
    run(sim, 1);
    const yawEast = Math.PI / 2;
    sim.player()!.yaw = 0;
    run(sim, 120, input({ moveZ: 1 }));
    sim.player()!.yaw = yawEast;
    run(sim, 540, input({ moveZ: 1, sprint: true }));
    expect(sim.streamer.isLoaded("shinsekai-7")).toBe(false);
    const restored = Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "mid", "")));
    expect(hasKey(restored, "courier")).toBe(true);
    expect(hash(restored)).toBe(hash(sim));
    sim.player()!.yaw = -yawEast;
    restored.player()!.yaw = -yawEast;
    const back = input({ moveZ: 1, sprint: true, fire: true });
    for (let i = 0; i < 420; i++) {
      sim.step(back);
      restored.step(back);
    }
    expect(sim.streamer.isLoaded("shinsekai-7")).toBe(true);
    expect(restored.streamer.loadedChunks).toEqual(sim.streamer.loadedChunks);
    expect(hash(restored)).toBe(hash(sim));
  });

  it("an M1 save without chunk state loads the chunks around the player", () => {
    const old = Simulation.create({ seed: 2 }).snapshot(null, "m1", "");
    const migrated: SaveSnapshot = { ...old, streaming: { loadedChunks: [] } };
    expect(Simulation.fromSnapshot(migrated).streamer.loadedChunks).toEqual(["shinsekai-7"]);
    const unknown: SaveSnapshot = { ...old, streaming: { loadedChunks: ["moon-base"] } };
    expect(Simulation.fromSnapshot(unknown).streamer.loadedChunks).toEqual(["shinsekai-7"]);
  });

  it("restores a ganger that was chasing the player outside its chunk", () => {
    const sim = Simulation.create({ seed: 3 });
    byKey(sim, "guard")!.ai!.alerted = true;
    goTo(sim, 30, 78);
    goTo(sim, 95, 78);
    const restored = Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "x", "")));
    expect(restored.streamer.isLoaded("shinsekai-7")).toBe(false);
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
    goTo(sim, 30, 78);
    goTo(sim, 95, 78);
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

  it("Shinsekai 7 is out of the unload radius anywhere in the market", () => {
    const home = WORLD_CHUNKS[0]!.bounds;
    for (const b of [TARG_SOUTH_BOUNDS, TARG_NORTH_BOUNDS]) {
      // Walkable interior: inside the 2 m outer walls, minus the body radius.
      for (let x = b.minX + 2.38; x <= b.maxX - 2.38; x += 2) {
        for (let z = Math.max(b.minZ, 56) + 2.38; z <= Math.min(b.maxZ, 114); z += 2) {
          expect(distanceToRect(x, z, home)).toBeGreaterThan(STREAMING_RADII.unloadRadius);
        }
      }
    }
  });

  it("the street is walkable from the car-wash passage into the market", () => {
    const sim = Simulation.create({ seed: 6 });
    teleportPlayer(sim, at(7, 45));
    const districts = new Set<string | null>();
    const track = () => districts.add(sim.district);
    track();
    expect(walk(sim, 0, (p) => p.z >= 79).z).toBeGreaterThanOrEqual(79);
    track();
    expect(walk(sim, Math.PI / 2, (p) => p.x >= 69.5).x).toBeGreaterThanOrEqual(69.5);
    track();
    expect(walk(sim, 0, (p) => p.z >= 85).z).toBeGreaterThanOrEqual(85);
    expect(walk(sim, Math.PI / 2, (p) => p.x >= 90).x).toBeGreaterThanOrEqual(90);
    track();
    expect([...districts]).toEqual(["shinsekai-7", "kanal", "targ"]);
    expect(sim.streamer.isLoaded("shinsekai-7")).toBe(false);
  });
});
