import { describe, expect, it } from "vitest";
import type { GroundPoint } from "@seki/core";
import { type ChunkDef, Simulation, type StaticProp, gangerEntity } from "../src";
import { solidIndexOf } from "../src/world/solid-index";
import { input, teleportPlayer } from "./helpers";
import { gridOf } from "./terrain-world";

/** The measurement goes to the test output (the sim's lib has no DOM types). */
const host = globalThis as { console?: { info(s: string): void }; performance?: { now(): number } };
const report = (line: string): void => host.console?.info(line);
const now = (): number => host.performance?.now() ?? 0;

/** Gentle rolling ground, a 2 m grid. */
const rolling = (x: number, z: number): number => 3 * Math.sin(x / 40) + 2 * Math.cos(z / 55);

/** A small convex block of flats: a turned quad or a hexagon, by index. */
const footprint = (i: number): GroundPoint[] => {
  const n = i % 3 === 0 ? 6 : 4;
  const r = 3 + (i % 4) * 0.5;
  const turn = (i * 0.37) % Math.PI;
  return Array.from({ length: n }, (_, k) => {
    const a = turn + (k * 2 * Math.PI) / n;
    return { x: Math.cos(a) * r, z: Math.sin(a) * r };
  });
};

/** 300 prisms on a 20 × 15 lattice, 11 m apart, within the streaming radius of the middle. */
const denseChunk = (): ChunkDef => {
  const props: StaticProp[] = [];
  for (let i = 0; i < 300; i++) {
    const x = -104.5 + (i % 20) * 11;
    const z = -77 + Math.floor(i / 20) * 11;
    const outline = footprint(i);
    props.push({
      center: { x, y: Math.min(...outline.map((p) => rolling(x + p.x, z + p.z))) - 0.2, z },
      view: { kind: "building", outline, height: 8 + (i % 5) * 3, levels: 3, use: "residential", look: i },
      solid: true,
    });
  }
  return { id: "dense", district: "shinsekai-7", bounds: { minX: -120, maxX: 120, minZ: -90, maxZ: 90 }, props, actors: [], terrain: gridOf(-120, -90, 2, 121, 91, rolling) };
};

/** Solids per index query, of 300 in range: 13 measured; a scan without the index hands back 300. */
const PER_QUERY_LIMIT = 20;

describe("cost of a step with 300 prisms in range (ADR-0043)", () => {
  it("checks only the solids near each query", () => {
    const sim = Simulation.create({ seed: 3, chunks: [denseChunk()] });
    teleportPlayer(sim, { x: 0, y: rolling(0, 5.5), z: 5.5 });
    sim.step();
    expect(sim.world.with("prisms").entities.length).toBe(300);
    // Ten alerted gangers in the streets of the lattice: movement, sight lines, shots, detours.
    for (let i = 0; i < 10; i++) {
      const x = -49.5 + i * 11;
      const g = gangerEntity(6000 + i, { key: `g${i}`, position: { x, y: rolling(x, 27.5), z: 27.5 }, yaw: Math.PI }, null, 5000, "dense");
      if (g.ai) g.ai.alerted = true;
      sim.world.add(g);
    }
    const frame = (i: number) => input({ moveZ: i % 240 < 120 ? 1 : -1, moveX: i % 100 < 50 ? 0.5 : -0.5, fire: i % 30 < 3 });
    for (let i = 0; i < 240; i++) sim.step(frame(i));
    // Wall-clock time is a report only (ADR-0046): a shared CI runner measures itself, not the
    // simulation. The gate is the work the spatial index leaves: solids handed back per query.
    const index = solidIndexOf(sim.world);
    const before = { ...index.stats };
    const t0 = now();
    for (let i = 0; i < 600; i++) sim.step(frame(i));
    const ms = (now() - t0) / 600;
    const queries = index.stats.queries - before.queries;
    const perQuery = (index.stats.candidates - before.candidates) / Math.max(1, queries);
    report(`ADR-0043 bench: 300 prisms, terrain, 10 gangers: ${ms.toFixed(3)} ms per step, ${(queries / 600).toFixed(1)} queries and ${perQuery.toFixed(2)} solids per query`);
    expect(queries).toBeGreaterThan(0);
    expect(perQuery).toBeLessThan(PER_QUERY_LIMIT);
  });
});
