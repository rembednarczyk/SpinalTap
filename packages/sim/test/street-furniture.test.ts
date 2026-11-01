import { describe, expect, it } from "vitest";
import type { StreetPropItem } from "@seki/core";
import { CROWD_SPOTS, Simulation, WORLD_CHUNKS, WORLD_SCENERY, WORLD_STREET_PROPS, ground, groundY, rayGeometry, residentOf } from "../src";
import { SOLID_FURNITURE, distanceToPiece, furniturePrisms, turnLocal } from "../src/content/lublin/furniture";
import { seatGroups } from "../src/content/lublin/seats";
import { STREET_ID_BASE } from "../src/world/streaming";
import { steerPoint } from "../src/systems/ai/steering";
import { input, run, teleportPlayer } from "./helpers";

/** A bench of the deptak's chunk with open ground in front of it (the first in table order). */
const benchOf = (chunk: string): StreetPropItem => {
  const b = (WORLD_STREET_PROPS[chunk] ?? []).find((i) => i.prop === "bench");
  if (!b) throw new Error(`no bench in ${chunk}`);
  return b;
};

describe("street furniture in the game (ADR-0050)", () => {
  it("the scenery draws every chunk's furniture, on the game's terrain, clear of the set pieces", () => {
    const views = WORLD_SCENERY.filter((s) => s.view.kind === "street-props");
    expect(views).toHaveLength(WORLD_CHUNKS.filter((c) => c.street).length);
    let total = 0;
    for (const v of views) {
      if (v.view.kind !== "street-props") continue;
      total += v.view.items.length;
      // A door on a facade (ADR-0058 stage 9) keeps its foot on the paving the import measured (the glitch scan's `door-floating`).
      for (const i of v.view.items) if (i.prop !== "door") expect(i.y).toBeCloseTo(groundY(i.x, i.z), 1);
    }
    expect(total).toBeGreaterThan(3000);
    // Nothing in the market under the viaduct (its own stalls and kiosk stand there).
    expect(views.flatMap((v) => (v.view.kind === "street-props" ? v.view.items : [])).some((i) => i.x > 757 && i.x < 813 && i.z > 318 && i.z < 374)).toBe(false);
  });

  it("solid kinds get convex prisms in the piece's frame; small things none", () => {
    expect(SOLID_FURNITURE.has("bench")).toBe(true);
    expect(SOLID_FURNITURE.has("manhole")).toBe(false);
    const bench: StreetPropItem = { prop: "bench", x: 0, y: 0, z: 0, yaw: Math.PI / 2, variant: 0 };
    const [p] = furniturePrisms(bench);
    // Turned a quarter: the 2.2 m bench runs along z.
    const xs = p!.points.map((q) => q.x);
    const zs = p!.points.map((q) => q.z);
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(2.2);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(0.54);
    expect(distanceToPiece(bench, 0, 0)).toBe(0);
    expect(distanceToPiece(bench, 1, 0)).toBeCloseTo(0.73);
    expect(furniturePrisms({ ...bench, prop: "manhole" })).toEqual([]);
    expect(turnLocal(Math.PI / 2, 0, 1).x).toBeCloseTo(1);
  });

  it("stream in with their chunk as solids with ids of their own, out with it", () => {
    const sim = Simulation.create({ seed: 1 });
    const pieces = [...sim.world].filter((e) => e.id >= STREET_ID_BASE && e.id < STREET_ID_BASE + 1_000_000);
    expect(pieces.length).toBeGreaterThan(100);
    expect(pieces.every((e) => e.solid && e.prisms && !e.view && e.seeThrough)).toBe(true);
    const chunks = new Set(pieces.map((e) => e.chunk));
    for (const c of chunks) expect(sim.streamer.isLoaded(c!)).toBe(true);
    teleportPlayer(sim, ground(2580, 400));
    run(sim, 2);
    expect([...sim.world].some((e) => e.id >= STREET_ID_BASE && e.chunk === "krakowskie-2-0")).toBe(false);
  });

  it("a bench stops the player walking into it; the TPP camera looks past it, bullets do not", () => {
    const bench = benchOf("krakowskie-1-0");
    const sim = Simulation.create({ seed: 1 });
    // Two metres in front of the bench, facing it.
    const front = turnLocal(bench.yaw, 0, 2);
    teleportPlayer(sim, ground(bench.x + front.x, bench.z + front.z), bench.yaw + Math.PI);
    run(sim, 2);
    run(sim, 90, input({ moveZ: 1 }));
    const p = sim.player()!.position;
    expect(distanceToPiece(bench, p.x, p.z)).toBeGreaterThan(0.3);
    const eye = { x: p.x, y: groundY(p.x, p.z) + 0.4, z: p.z };
    const dx = bench.x - p.x;
    const dz = bench.z - p.z;
    const len = Math.hypot(dx, dz);
    const dir = { x: dx / len, y: 0, z: dz / len };
    expect(rayGeometry(sim.world, eye, dir, 3)).not.toBeNull();
    const t = rayGeometry(sim.world, eye, dir, 3, true);
    expect(t === null || t > len).toBe(true);
  });

  it("the AI walks round a bench in its way", () => {
    const bench = benchOf("krakowskie-1-0");
    const sim = Simulation.create({ seed: 1 });
    teleportPlayer(sim, ground(bench.x, bench.z + 30));
    run(sim, 2);
    const a = turnLocal(bench.yaw, 0, 1.6);
    const b = turnLocal(bench.yaw, 0, -1.6);
    const from = ground(bench.x + a.x, bench.z + a.z);
    const to = ground(bench.x + b.x, bench.z + b.z);
    const step = steerPoint(sim.world, from, to);
    // Not straight through: the first waypoint is off the bench's line.
    expect(Math.hypot(step.x - to.x, step.z - to.z)).toBeGreaterThan(0.5);
  });

  it("residents sit on the benches and at the café tables, queue at the kiosks, wait under the shelters", () => {
    const seated = CROWD_SPOTS.filter((s) => s.group && s.does[0] === "sit");
    expect(seated.length).toBeGreaterThan(40);
    expect(CROWD_SPOTS.some((s) => s.group && s.does[0] === "talk")).toBe(true);
    // A group fills one after another: some chunk has a seat group whose members are next to each other.
    const all = Array.from({ length: 24 }, (_, i) => residentOf(4, "krakowskie-1-0", i)).flatMap((r) => (r?.role.kind === "stander" ? [r.role.spot] : []));
    const groups = new Map<string, number>();
    for (const s of all) if (s.group) groups.set(s.group, (groups.get(s.group) ?? 0) + 1);
    expect([...groups.values()].some((n) => n >= 2)).toBe(true);
    // A bench seats its sitters in front of it, a body's radius off its solid.
    const bench = benchOf("krakowskie-1-0");
    for (const s of seatGroups(bench)[0]!) expect(distanceToPiece(bench, s.x, s.z)).toBeGreaterThanOrEqual(0.38);
  });
});
