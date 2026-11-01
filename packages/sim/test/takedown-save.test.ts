import { describe, expect, it } from "vitest";
import type { Vec3 } from "@seki/core";
import { SIM_DT, Simulation, TAKEDOWN_TIME, type Entity } from "../src";
import { byKey, input, run, streetSim, teleportPlayer } from "./helpers";

/** Stage 3 of ADR-0065: bodies in the save and in a chunk streamed out and back. */

const STAND = input();
const ticks = (seconds: number) => Math.ceil(seconds / SIM_DT - 1e-9);
const inCreationOrder = <T extends { id: number }>(es: T[]): T[] => [...es].sort((a, b) => a.id - b.id);
const flat = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.z - b.z);

/** A ganger of the content (keyed, so the save knows it) taken down by the player standing right by it. */
const contentBody = (lethal = false): { sim: Simulation; key: string } => {
  const sim = streetSim({ seed: 7 });
  const ganger = inCreationOrder([...sim.world.with("ai")].filter((g) => g.key))[0]!;
  for (const g of [...sim.world.with("ai")]) if (g !== ganger) sim.world.remove(g);
  teleportPlayer(sim, { ...ganger.position, z: ganger.position.z - 1.2 });
  // Blinded by a hack, it stays unaware of her: the takedown is open from any side.
  ganger.hackFx = { pinged: 0, blind: 100, crippled: 0 };
  sim.step(STAND);
  sim.enqueue({ type: "takedown", lethal });
  run(sim, ticks(TAKEDOWN_TIME), STAND);
  expect(byKey(sim, ganger.key!)?.unconscious).toBe(true);
  return { sim, key: ganger.key! };
};

const pickUp = (sim: Simulation): void => {
  sim.step(STAND);
  sim.enqueue({ type: "carry-body" });
  sim.step(STAND);
};

/** A dumpster 2 m east of the player (not in the content: the save keeps the body, not the bin). */
const dumpster = (sim: Simulation): Entity => {
  const p = sim.player()!.position;
  const c = { x: p.x + 2, y: p.y + 0.7, z: p.z };
  return sim.world.add({
    id: 4500,
    position: c,
    prevPosition: c,
    yaw: 0,
    prevYaw: 0,
    pitch: 0,
    view: { kind: "block", size: { x: 2.4, y: 1.4, z: 1.4 }, material: "metal" },
    solid: { min: { x: c.x - 1.2, y: p.y, z: c.z - 0.7 }, max: { x: c.x + 1.2, y: p.y + 1.4, z: c.z + 0.7 } },
    hide: "dumpster",
  });
};

const reload = (sim: Simulation): Simulation => Simulation.fromSnapshot(JSON.parse(JSON.stringify(sim.snapshot(null, "t", ""))));

describe("bodies in the save (ADR-0065, stage 3)", () => {
  it("a knocked-out ganger stays down after a load, where it lay", () => {
    const { sim, key } = contentBody();
    const at = { ...byKey(sim, key)!.position };
    const loaded = reload(sim);
    const back = byKey(loaded, key)!;
    expect(back.unconscious).toBe(true);
    expect(back.downed?.dead).toBe(false);
    expect(back.ai!.alerted).toBe(false);
    expect(flat(back.position, at)).toBeLessThan(1e-9);
    // Lying in reach, it is offered again.
    loaded.step(STAND);
    expect(loaded.session.bodyTarget?.id).toBe(back.id);
  });

  it("with the body on her shoulder: still carried after a load, at her slow walk", () => {
    const { sim, key } = contentBody();
    pickUp(sim);
    expect(sim.session.carrying).toBe(byKey(sim, key)!.id);
    const loaded = reload(sim);
    const back = byKey(loaded, key)!;
    expect(loaded.session.carrying).toBe(back.id);
    expect(back.downed?.carried).toBe(true);
    expect(back.body).toBeUndefined();
    run(loaded, ticks(1), input({ moveZ: 1 }));
    expect(flat(back.position, loaded.player()!.position)).toBeLessThan(1e-9);
    expect(loaded.session.focusPrompt).toBe("prompt.body.drop");
    loaded.enqueue({ type: "drop-body" });
    loaded.step(STAND);
    expect(loaded.session.carrying).toBeNull();
    expect(back.body).toBeDefined();
  });

  it("a body in a hiding place stays hidden after a load: out of sight, not drawn", () => {
    const { sim, key } = contentBody();
    const bin = dumpster(sim);
    pickUp(sim);
    sim.enqueue({ type: "drop-body" });
    sim.step(STAND);
    expect(byKey(sim, key)!.downed?.hidden).toBe(true);
    const loaded = reload(sim);
    const back = byKey(loaded, key)!;
    expect(back.downed?.hidden).toBe(true);
    expect(back.view).toBeUndefined();
    expect(back.body).toBeUndefined();
    expect(flat(back.position, bin.position)).toBeLessThan(1e-9);
    loaded.step(STAND);
    expect(loaded.session.bodyTarget).toBeNull();
  });

  it("the dead of a takedown are saved as bodies, and lie there after a load", () => {
    const { sim, key } = contentBody(true);
    const body = byKey(sim, key)!;
    expect(body.downed?.dead).toBe(true);
    expect(sim.domain.flags).toContain(`dead:${key}`);
    const loaded = reload(sim);
    const back = byKey(loaded, key)!;
    expect(back.downed?.dead).toBe(true);
    expect(back.health).toBeUndefined();
    expect(back.ai).toBeUndefined();
    expect(back.id).toBe(body.id);
    expect(flat(back.position, body.position)).toBeLessThan(1e-9);
  });

  it("a body in a chunk streamed out and back is still down; one on her shoulder goes with her", () => {
    const { sim, key } = contentBody();
    const body = byKey(sim, key)!;
    const chunk = body.chunk!;
    const at = { ...body.position };
    const far = { x: at.x + 600, y: at.y, z: at.z };
    teleportPlayer(sim, far);
    run(sim, 5, STAND);
    expect(sim.streamer.loadedChunks).not.toContain(chunk);
    expect(byKey(sim, key)).toBeUndefined();
    teleportPlayer(sim, { ...at, z: at.z - 1.2 });
    run(sim, 5, STAND);
    const back = byKey(sim, key)!;
    expect(back.unconscious).toBe(true);
    expect(flat(back.position, at)).toBeLessThan(1e-9);
    // Carried, it does not sleep with its chunk.
    pickUp(sim);
    teleportPlayer(sim, far);
    run(sim, 5, STAND);
    expect(sim.streamer.loadedChunks).not.toContain(chunk);
    expect(byKey(sim, key)?.downed?.carried).toBe(true);
    expect(flat(byKey(sim, key)!.position, far)).toBeLessThan(1e-9);
  });

  it("a body carried into another chunk and left there comes back with the chunk it lies in", () => {
    const { sim, key } = contentBody();
    const body = byKey(sim, key)!;
    const own = body.chunk!;
    const at = { ...body.position };
    const st = sim.streamer;
    // The first point due east, west, north or south in another chunk, far enough that `own` sleeps there.
    let drop: Vec3 | null = null;
    for (let r = 60; r <= 400 && !drop; r += 20) {
      for (const [dx, dz] of [[r, 0], [-r, 0], [0, r], [0, -r]] as const) {
        const q = { x: at.x + dx, y: at.y, z: at.z + dz };
        if (st.chunkIdAt(q) !== own) {
          drop = q;
          break;
        }
      }
    }
    pickUp(sim);
    teleportPlayer(sim, drop!);
    run(sim, 5, STAND);
    sim.enqueue({ type: "drop-body" });
    run(sim, 4, STAND);
    const lies = { ...byKey(sim, key)!.position };
    const there = st.chunkIdAt(lies);
    expect(there).not.toBe(own);
    // Far off: both chunks sleep.
    teleportPlayer(sim, { x: at.x + 5000, y: at.y, z: at.z + 5000 });
    run(sim, 5, STAND);
    expect(byKey(sim, key)).toBeUndefined();
    // Back by the body: the chunk it lies in is loaded, its own is not.
    teleportPlayer(sim, { ...lies, x: lies.x + 2 });
    run(sim, 5, STAND);
    expect(st.loadedChunks).toContain(there);
    expect(st.loadedChunks).not.toContain(own);
    const back = byKey(sim, key)!;
    expect(back).toBeDefined();
    expect(back.unconscious).toBe(true);
    expect(flat(back.position, lies)).toBeLessThan(1e-6);
  });
});
