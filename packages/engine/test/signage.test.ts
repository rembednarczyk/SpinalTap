import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { WORLD_CHUNKS, chunkAt } from "@seki/sim";
import { describe, expect, it } from "vitest";
import { RawTexture, Scene } from "../src/babylon";
import { NIGHT_RIG } from "../src/npr/lighting";
import { Signage, drawSignAtlas } from "../src/renderer/signage";
import { ATLAS_BLADES, ATLAS_BOARDS, HOLO_PER_CHUNK, SIGNAGE_KIND, planSignage } from "../src/renderer/signage-plan";

/** Per quad (four vertices): kind, param and the centre of its corners. */
const quads = (sink: ReturnType<typeof planSignage>) => {
  const out: { kind: number; param: number; x: number; y: number; z: number; ny: number }[] = [];
  for (let q = 0; q < sink.vertexCount / 4; q++) {
    let x = 0;
    let y = 0;
    let z = 0;
    for (let k = 0; k < 4; k++) {
      const i = q * 4 + k;
      x += sink.positions[i * 3]! / 4;
      y += sink.positions[i * 3 + 1]! / 4;
      z += sink.positions[i * 3 + 2]! / 4;
    }
    out.push({ kind: sink.uvs2[q * 8 + 1]!, param: sink.uvs2[q * 8]!, x, y, z, ny: sink.normals[q * 12 + 1]! });
  }
  return out;
};

describe("signage (ADR-0030)", () => {
  const plan = planSignage(WORLD_CHUNKS);
  const all = quads(plan);

  it("is deterministic", () => {
    expect(planSignage(WORLD_CHUNKS).positions).toEqual(plan.positions);
  });

  it("puts signs, holo-ads and reflections in every district", () => {
    for (const district of new Set(WORLD_CHUNKS.map((c) => c.district))) {
      const mine = all.filter((q) => chunkAt(q.x, q.z)?.district === district);
      expect(mine.some((q) => q.kind === SIGNAGE_KIND.sign), district).toBe(true);
      expect(mine.some((q) => q.kind === SIGNAGE_KIND.reflection), district).toBe(true);
    }
    const holos = all.filter((q) => q.kind === SIGNAGE_KIND.holo);
    expect(holos.length).toBeGreaterThanOrEqual(4);
    expect(holos.length).toBeLessThanOrEqual(HOLO_PER_CHUNK * WORLD_CHUNKS.length);
  });

  it("reads only cells that exist in the atlas", () => {
    for (const q of all.filter((s) => s.kind === SIGNAGE_KIND.sign)) {
      expect(Number.isInteger(q.param)).toBe(true);
      expect(q.param).toBeGreaterThanOrEqual(0);
      expect(q.param).toBeLessThan(ATLAS_BLADES + ATLAS_BOARDS);
    }
  });

  it("lays reflections flat on the street and hangs signs above head height", () => {
    for (const q of all) {
      if (q.kind === SIGNAGE_KIND.reflection) {
        expect(q.y).toBeCloseTo(0.035);
        expect(q.ny).toBe(1);
      } else {
        expect(q.y).toBeGreaterThan(2.9);
        expect(q.ny).toBe(0);
      }
    }
  });

  it("keeps clear of the content's own neon signs", () => {
    const neon = WORLD_CHUNKS.flatMap((c) => c.props.filter((p) => p.view.kind === "neon"));
    for (const q of all.filter((s) => s.kind === SIGNAGE_KIND.holo)) {
      for (const n of neon) {
        const size = n.view.kind === "neon" ? n.view.size : { x: 0, y: 0, z: 0 };
        const inside = Math.abs(n.center.x - q.x) < size.x / 2 + 1 && Math.abs(n.center.y - q.y) < size.y / 2 + 1 && Math.abs(n.center.z - q.z) < size.z / 2 + 1;
        expect(inside).toBe(false);
      }
    }
  });

  it("draws every atlas cell", () => {
    const calls = { text: 0, rects: 0, strokes: 0 };
    const ctx = {
      fillRect: () => calls.rects++,
      strokeRect: () => calls.strokes++,
      fillText: () => calls.text++,
    } as unknown as CanvasRenderingContext2D;
    drawSignAtlas(ctx);
    expect(calls.strokes).toBe(ATLAS_BLADES + ATLAS_BOARDS);
    expect(calls.text).toBeGreaterThan(ATLAS_BLADES);
  });

  it("stays small: one mesh for the whole city", () => {
    expect(plan.vertexCount).toBeLessThan(6000);
    const scene = new Scene(new NullEngine());
    const signage = new Signage(scene, WORLD_CHUNKS, RawTexture.CreateRGBATexture(new Uint8Array(4), 1, 1, scene));
    expect(signage.mesh).not.toBeNull();
    expect(scene.meshes.filter((m) => m.material === signage.material)).toHaveLength(1);
    signage.setDaylight(NIGHT_RIG, 0.5);
    signage.setReduceFlashes(true);
    signage.update(0.1, false);
    signage.update(0.1, true);
    scene.dispose();
  });
});
