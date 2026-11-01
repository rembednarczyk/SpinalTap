// @ts-expect-error The engine is typed for the browser; the test reads the files off disk.
import { readFileSync } from "node:fs";
import { LUBLIN_CHUNKS } from "@seki/sim/lublin";
import { describe, expect, it } from "vitest";
import { parseCityProps, triangleCount } from "../src/renderer/city-props";
import { MEGA_SITES, planSkyline } from "../src/renderer/mapcity/skyline";
import { BODY_GLOW, MEGATOWER, addBody, bodyScale, megaBodies } from "../src/renderer/mapcity/skyline-bodies";
import { MeshSink } from "../src/renderer/mesh-sink";

/** The skyline's megatowers from the CC-BY megacity cluster (ADR-0063 stage 2, ADR-0051). */

const read = (name: string): ArrayBuffer => {
  const f = (readFileSync as (url: URL) => Uint8Array)(new URL(`../../app/public/city/${name}`, import.meta.url));
  return f.buffer.slice(f.byteOffset, f.byteOffset + f.byteLength) as ArrayBuffer;
};
const props = parseCityProps(read("city-props.glb"));
const bodies = megaBodies(props);

/** The `extras.credit` of a node of the file, by its name. */
const creditOf = (key: string): string | undefined => {
  const b = new Uint8Array(read("city-props.glb"));
  const len = new DataView(b.buffer).getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(b.subarray(20, 20 + len))) as { nodes: { name: string; extras?: { credit?: string } }[] };
  return json.nodes.find((n) => n.name === key)?.extras?.credit;
};

/** Distance from (x, z) to the nearest chunk of Lublin's map data (0 inside one). */
const toData = (x: number, z: number): number =>
  Math.min(...LUBLIN_CHUNKS.map(({ bounds: b }) => Math.hypot(Math.max(b.minX - x, 0, x - b.maxX), Math.max(b.minZ - z, 0, z - b.maxZ))));

const nearestToData = (sink: MeshSink): number => {
  let d = Infinity;
  for (let i = 0; i < sink.positions.length; i += 3) d = Math.min(d, toData(sink.positions[i]!, sink.positions[i + 2]!));
  return d;
};

/** Metres between the skyline and the nearest chunk of map data: Tatary by the Nabrzeże, 936 m with the bodies (795 m procedural). */
const MIN_TO_DATA = 750;

const towerCount = MEGA_SITES.reduce((n, s) => n + s.towers.length, 0);

describe("skyline megatowers (ADR-0063)", () => {
  it("ships four megatower bodies in city-props.glb, a few thousand triangles at most, credited", () => {
    expect(bodies.map((b) => b.model.key)).toEqual(["mc-tower-a", "mc-tower-b", "mc-tower-c", "mc-tower-d"]);
    for (const b of bodies) {
      expect(b.model.styles).toEqual([MEGATOWER]);
      expect(triangleCount(b.model)).toBeGreaterThan(500);
      expect(triangleCount(b.model)).toBeLessThanOrEqual(3000);
      expect(creditOf(b.model.key)).toBe("sketchfab-megacity-cluster");
      // Taller than wide (a tower over its podium), standing on y = 0.
      expect(b.model.size.y).toBeGreaterThan(2 * Math.max(b.model.size.x, b.model.size.z));
      // Its windows and neon bands glow; most of it is facade.
      const lit = b.lit.filter(Boolean).length;
      expect(lit).toBeGreaterThan(0);
      expect(lit).toBeLessThan(b.lit.length * 0.25);
    }
  });

  it("is the procedural skyline without the bodies (the phone, and before the file is in)", () => {
    const plain = planSkyline();
    expect(planSkyline(MEGA_SITES, []).towers.positions).toEqual(plain.towers.positions);
    expect(plain.towers.uvs2.some((u) => u === BODY_GLOW)).toBe(false);
  });

  it("gives every tower a body in turn, deterministically, each as tall as its site says", () => {
    const a = planSkyline(MEGA_SITES, bodies);
    const b = planSkyline(MEGA_SITES, bodies);
    expect(a.towers.positions).toEqual(b.towers.positions);
    expect(a.lights.positions).toEqual(b.lights.positions);
    const perTower = bodies.map((x) => x.model.positions.length / 3);
    const expected = Array.from({ length: towerCount }, (_, i) => perTower[i % bodies.length]!).reduce((s, n) => s + n, 0);
    expect(a.towers.vertexCount).toBe(expected);
    const top = Math.max(...a.towers.positions.filter((_, i) => i % 3 === 1));
    expect(top).toBeCloseTo(Math.max(...MEGA_SITES.flatMap((s) => s.towers)), 0);
    expect(a.towers.uvs2.filter((u, i) => i % 2 === 0 && u === BODY_GLOW).length).toBeGreaterThan(0);
    // One ad and one beacon per tower: the bodies' own bands stand for the corner neon.
    expect(a.lights.vertexCount).toBe(towerCount * 2 * 4);
  });

  it("hangs the ad of a body tower in front of it, at its middle (not inside the body)", () => {
    for (const body of bodies) {
      for (const front of [{ x: 1, z: 0 }, { x: 0, z: -1 }]) {
        const at = { x: 3000, z: 2000, h: 700, front };
        const reach = addBody(new MeshSink(), body, at, 0.3);
        const { across } = bodyScale(body, at.h);
        expect(reach, body.model.key).toBeGreaterThan(across * Math.min(body.model.size.x, body.model.size.z) * 0.1);
        expect(reach, body.model.key).toBeLessThanOrEqual(across * Math.hypot(body.model.size.x, body.model.size.z) * 0.5 + 1e-6);
      }
    }
  });

  it("stands well outside Lublin's map data, towers and their lights", () => {
    const plan = planSkyline(MEGA_SITES, bodies);
    expect(nearestToData(plan.towers)).toBeGreaterThan(MIN_TO_DATA);
    expect(nearestToData(plan.lights)).toBeGreaterThan(MIN_TO_DATA);
    expect(nearestToData(planSkyline().towers)).toBeGreaterThan(MIN_TO_DATA);
  });
});
