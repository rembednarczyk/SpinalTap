// @ts-expect-error The engine is typed for the browser; the test reads and writes files on disk.
import { readFileSync, writeFileSync } from "node:fs";
import { LUBLIN_CHUNKS } from "@seki/sim/lublin";
import { describe, expect, it } from "vitest";
import { parseCityProps } from "../src/renderer/city-props";
import { MEGA_LAYOUT, MEGA_SITES, planSkyline, skylineLayoutFor } from "../src/renderer/mapcity/skyline";
import { megaBodies } from "../src/renderer/mapcity/skyline-bodies";
import { NO_LAYOUT, type SkylineRow } from "../src/renderer/mapcity/skyline-layout";
import { LAYOUT_TABLES } from "../src/renderer/mapcity/skyline-layout-data";
import { generateLayout, layoutSource } from "../src/renderer/mapcity/skyline-layout-gen";
import type { MeshSink } from "../src/renderer/mesh-sink";

/** The megablocks hemming Lublin in (ADR-0067, variant B): layout, distance from the data, budget, the phone. */

/** The environment of the run (the engine is typed for the browser). */
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

const DATA_FILE = new URL("../src/renderer/mapcity/skyline-layout-data.ts", import.meta.url);

const bodies = megaBodies(
  parseCityProps(
    (() => {
      const f = (readFileSync as (url: URL) => Uint8Array)(new URL("../../app/public/city/city-props.glb", import.meta.url));
      return f.buffer.slice(f.byteOffset, f.byteOffset + f.byteLength) as ArrayBuffer;
    })(),
  ),
);

/** Distance from (x, z) to the nearest chunk of Lublin's map data (0 inside one). */
const toData = (x: number, z: number): number =>
  Math.min(...LUBLIN_CHUNKS.map(({ bounds: b }) => Math.hypot(Math.max(b.minX - x, 0, x - b.maxX), Math.max(b.minZ - z, 0, z - b.maxZ))));

const nearestToData = (sink: MeshSink): number => {
  let d = Infinity;
  for (let i = 0; i < sink.positions.length; i += 3) d = Math.min(d, toData(sink.positions[i]!, sink.positions[i + 2]!));
  return d;
};

/** Metres from any megablock (body, bridge, ad) to the nearest chunk of map data (ADR-0067). */
const MIN_TO_DATA = 190;
/** About 100 thousand triangles and 12 MB of mesh data for the whole skyline (ADR-0067). */
const MAX_TRIANGLES = 100_000;
const MAX_BYTES = 12_000_000;

/** Bytes of a sink as a Babylon mesh: position, normal, colour, uv, uv2 as floats, 32-bit indices. */
const bytesOf = (s: MeshSink): number => s.vertexCount * (3 + 3 + 4 + 2 + 2) * 4 + s.indices.length * 4;
const trianglesOf = (s: MeshSink): number => s.indices.length / 3;

const row = (name: SkylineRow["name"]): SkylineRow => MEGA_LAYOUT.rows.find((r) => r.name === name)!;

/** A hash of a sink's numbers, to 1 mm. */
const fnv = (xs: readonly number[]): string => {
  let h = 0x811c9dc5;
  for (const ch of xs.map((n) => n.toFixed(3)).join(",")) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return h.toString(16);
};
/** Everything of the geometry but what carries the impostor's tower height (uv2.y; the lights' normal.y). */
const shape = (s: MeshSink, centreInNormal = false): string =>
  [s.positions, s.indices, s.colors, s.uvs, s.uvs2.filter((_, i) => i % 2 === 0), s.normals.filter((_, i) => !centreInNormal || i % 3 !== 1)]
    .map(fnv)
    .join("-");

describe("megablocks round Lublin (ADR-0067)", () => {
  it("keeps the layout as a table in the repo: what the generator gives, the same on every run", () => {
    const fresh = generateLayout();
    expect(generateLayout()).toEqual(fresh);
    if (env.SKYLINE_LAYOUT === "update") (writeFileSync as (url: URL, s: string) => void)(DATA_FILE, layoutSource(fresh));
    expect(LAYOUT_TABLES).toEqual(fresh);
    expect((readFileSync as (url: URL, enc: string) => string)(DATA_FILE, "utf8")).toBe(layoutSource(fresh));
  });

  it("has a near row with skybridges, the Nabrzeże's stretch and a far ring of simpler blocks", () => {
    const near = row("near");
    const docks = row("docks");
    const ring = row("ring");
    // Fewer than the 50, 112 and 85 of the prototype: the topography guard drops what cannot move.
    expect(near.towers.length).toBeGreaterThanOrEqual(40);
    expect(near.bridges.length).toBeGreaterThanOrEqual(70);
    expect(ring.towers.length).toBeGreaterThanOrEqual(70);
    expect([near.lod, docks.lod, ring.lod]).toEqual(["body", "body", "tiers"]);
    for (const r of MEGA_LAYOUT.rows) {
      for (const t of r.towers) expect(Math.hypot(t.front.x, t.front.z)).toBeCloseTo(1, 6);
      for (const b of r.bridges) expect(Math.max(b.a, b.b)).toBeLessThan(r.towers.length);
    }
    // The Nabrzeże is hemmed in on its north, east and south, not only by the far towers of the city.
    expect(docks.towers.filter((t) => t.z > 480).length).toBeGreaterThanOrEqual(3);
    expect(docks.towers.filter((t) => t.x > 2700).length).toBeGreaterThanOrEqual(3);
    expect(docks.towers.filter((t) => t.z < 60).length).toBeGreaterThanOrEqual(3);
    expect(docks.towers.every((t) => t.x >= 2300 - 300)).toBe(true);
  });

  it.each(["near", "docks", "ring"] as const)("stands %s at least 190 m from Lublin's map data, bodies, bridges and ads", (name) => {
    const plan = planSkyline([], bodies, { rows: [row(name)] });
    expect(nearestToData(plan.towers)).toBeGreaterThanOrEqual(MIN_TO_DATA);
    expect(nearestToData(plan.lights)).toBeGreaterThanOrEqual(MIN_TO_DATA);
    const tiers = planSkyline([], [], { rows: [row(name)] });
    expect(nearestToData(tiers.towers)).toBeGreaterThanOrEqual(MIN_TO_DATA);
  });

  it("fits the whole skyline in about 100 thousand triangles and 12 MB, the far ring as simpler blocks", () => {
    const plan = planSkyline(MEGA_SITES, bodies, MEGA_LAYOUT);
    expect(trianglesOf(plan.towers) + trianglesOf(plan.lights)).toBeLessThanOrEqual(MAX_TRIANGLES);
    expect(bytesOf(plan.towers) + bytesOf(plan.lights)).toBeLessThanOrEqual(MAX_BYTES);
    // The far ring is the LOD: the same with or without the bodies, a few dozen triangles a block.
    const ring = row("ring");
    const withBodies = planSkyline([], bodies, { rows: [ring] });
    expect(withBodies.towers.positions).toEqual(planSkyline([], [], { rows: [ring] }).towers.positions);
    expect(trianglesOf(withBodies.towers) / ring.towers.length).toBeLessThanOrEqual(60);
  });

  it("carries each tower's height for the impostor, so a near tall one keeps its top inside the far plane", () => {
    const plan = planSkyline(MEGA_SITES, bodies, MEGA_LAYOUT);
    const heights = new Set([...MEGA_SITES.flatMap((s) => s.towers), ...MEGA_LAYOUT.rows.flatMap((r) => r.towers.map((t) => t.h))]);
    for (let i = 0; i < plan.towers.vertexCount; i++) expect(heights.has(plan.towers.uvs2[i * 2 + 1]!)).toBe(true);
    for (let i = 0; i < plan.lights.vertexCount; i++) expect(heights.has(plan.lights.normals[i * 3 + 1]!)).toBe(true);
  });

  it("leaves the phone (low) with today's skyline, the others get the megablocks", () => {
    expect(skylineLayoutFor("low")).toBe(NO_LAYOUT);
    expect(skylineLayoutFor("medium")).toBe(MEGA_LAYOUT);
    expect(skylineLayoutFor("high")).toBe(MEGA_LAYOUT);
    const phone = planSkyline(MEGA_SITES, [], skylineLayoutFor("low"));
    expect(phone.towers.positions).toEqual(planSkyline().towers.positions);
    // The twelve procedural towers: the nine of Czechów, al. Kraśnicka and Tatary vertex for vertex
    // as before ADR-0067 (hash taken then); the three by the Zalew moved off the Bystrzyca to Zemborzyce.
    const kept = planSkyline(MEGA_SITES.filter((s) => s.name !== "Zemborzyce"));
    expect(shape(kept.towers)).toBe("51f9c573-6d2ab30-11278eb-14039997-c9949e8b-96ce0aa3");
    expect(shape(kept.lights, true)).toBe("6926a933-d2624c06-94b36cb3-b3d07ceb-d93fcca3-6efa0a0b");
    expect(shape(phone.towers)).toBe("5fafc119-c80da0b8-6c366853-9fb122b7-6c43e1db-2026afd3");
  });
});
