import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { SIDEWALKS, SIDEWALK_HEIGHT } from "@seki/sim";
import { Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { crowdLook } from "../src/renderer/crowd-look";
import { freshPuppet, gaitJoints, partMatrices, plantedHips, poseParts, puppetPose, setPuppetActivity, stepPuppet } from "../src/renderer/crowd-pose";
import { PART, PART_COUNT, buildPuppet, puppetDims } from "../src/renderer/crowd-puppet";
import { CrowdViews } from "../src/renderer/crowd-views";
import { easeLift, groundLift } from "../src/renderer/ground-lift";
import { MeshSink } from "../src/renderer/mesh-sink";
import { planSidewalks } from "../src/renderer/sidewalk-plan";

const still = { position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, speed: 0 };

/** World position of a template vertex at a pose. */
const lowest = (look: number, umbrella: boolean, pose = puppetPose(freshPuppet(), 0, puppetDims(1.7, 1), umbrella)) => {
  const t = buildPuppet(crowdLook(look), umbrella);
  const parts = partMatrices();
  poseParts(parts, t.dims, puppetPose(freshPuppet(), 0, t.dims, umbrella) ?? pose, 0, 0, 0, 0);
  let min = Infinity;
  let max = -Infinity;
  for (let v = 0; v < t.vertexCount; v++) {
    const m = parts[t.parts[v]!]!;
    const y = m[4]! * t.positions[v * 3]! + m[5]! * t.positions[v * 3 + 1]! + m[6]! * t.positions[v * 3 + 2]! + m[7]!;
    min = Math.min(min, y);
    max = Math.max(max, y);
  }
  return { min, max, template: t };
};

describe("residents' looks and figures (ADR-0041)", () => {
  it("a look is a pure function of its seed, and the seeds give a varied crowd", () => {
    expect(crowdLook(42)).toEqual(crowdLook(42));
    const looks = Array.from({ length: 300 }, (_, i) => crowdLook(i * 7919));
    expect(new Set(looks.map((l) => l.hair)).size).toBe(5);
    expect(new Set(looks.map((l) => l.garment)).size).toBe(3);
    expect(new Set(looks.map((l) => l.colors.top)).size).toBeGreaterThan(10);
    for (const l of looks) {
      expect(l.height).toBeGreaterThanOrEqual(1.5);
      expect(l.height).toBeLessThanOrEqual(1.9);
    }
  });

  it("a figure stands on the ground at its height; an umbrella rises above the head", () => {
    for (const seed of [1, 99, 12345, 777777]) {
      const plain = lowest(seed, false);
      expect(plain.min).toBeGreaterThan(-0.03);
      expect(plain.min).toBeLessThan(0.03);
      expect(plain.max).toBeGreaterThan(crowdLook(seed).height - 0.12);
      expect(plain.max).toBeLessThan(crowdLook(seed).height + 0.12);
      expect(lowest(seed, true).max).toBeGreaterThan(1.95);
      const t = plain.template;
      expect(t.vertexCount).toBeLessThan(800);
      for (const i of t.indices) expect(i).toBeLessThan(t.vertexCount);
      for (const p of t.parts) expect(p).toBeLessThan(PART_COUNT);
      expect(t.colors.length).toBe(t.vertexCount * 4);
    }
  });

  it("walking swings the legs against each other; standing still does not", () => {
    const step = gaitJoints(Math.PI / 2, 1.3);
    expect(step.legLX).toBeCloseTo(-step.legRX);
    expect(Math.abs(step.legLX)).toBeGreaterThan(0.4);
    expect(gaitJoints(Math.PI / 2, 0).legLX).toBe(0);
    // Running leans forward and bends the elbows.
    expect(gaitJoints(1, 3.4).lean).toBeGreaterThan(0.1);
  });

  it("an activity and a cower blend in; seated and cowering figures drop their hips, the umbrella arm holds", () => {
    const d = puppetDims(1.7, 1);
    const s = freshPuppet();
    setPuppetActivity(s, "sit");
    for (let i = 0; i < 30; i++) stepPuppet(s, 0, 0, 1 / 30);
    expect(puppetPose(s, 0, d, false).dropY).toBeLessThan(-0.3);
    const c = freshPuppet();
    for (let i = 0; i < 30; i++) stepPuppet(c, 0, 1, 1 / 30);
    const down = puppetPose(c, 0, d, true);
    expect(down.dropY).toBeLessThan(-0.3);
    expect(down.armLX - down.lean).toBeCloseTo(-0.55);
    expect(plantedHips(d, 0, 0.04).y).toBeCloseTo(0);
  });

  it("the pelvis follows the position and the facing", () => {
    const t = buildPuppet(crowdLook(5), false);
    const parts = partMatrices();
    poseParts(parts, t.dims, puppetPose(freshPuppet(), 0, t.dims, false), 3, 0.12, -4, Math.PI / 2);
    const pelvis = parts[PART.pelvis]!;
    expect(pelvis[3]).toBeCloseTo(3);
    expect(pelvis[7]).toBeCloseTo(0.12 + t.dims.hipY, 1);
    expect(pelvis[11]).toBeCloseTo(-4);
    // Facing +X: the local forward axis (z) turns into world x.
    expect(pelvis[2]).toBeCloseTo(1);
  });
});

describe("crowd views (ADR-0041)", () => {
  const scene = new Scene(new NullEngine());
  const materials = new ToonMaterials(scene);

  it("draws everyone in one mesh, leaves out the far ones and lays the buffers out again on a change", () => {
    const eye = { x: 0, z: 0 };
    const crowd = new CrowdViews({ scene, materials, eye: () => eye, drawDistance: 30 });
    crowd.spawn(1, { kind: "crowd", look: 11, umbrella: false }, still);
    crowd.spawn(2, { kind: "crowd", look: 12, umbrella: true }, { ...still, position: { x: 2, y: 0, z: 1 }, speed: 1.2 });
    crowd.spawn(3, { kind: "crowd", look: 13, umbrella: false }, { ...still, position: { x: 80, y: 0, z: 0 } });
    crowd.update(1 / 60);
    const mesh = crowd.meshOrNull!;
    expect(scene.meshes.filter((m) => m.name === "crowd")).toHaveLength(1);
    expect(crowd.size).toBe(3);
    expect(crowd.drawn).toBe(2);
    expect(mesh.isEnabled()).toBe(true);
    expect(mesh.renderOutline).toBe(true);
    const verts = mesh.getTotalVertices();
    crowd.setActivity(1, "phone");
    expect(crowd.move(2, { ...still, position: { x: 3, y: 0, z: 1 }, speed: 1.2 })).toBe(true);
    expect(crowd.move(9, still)).toBe(false);
    crowd.despawn(3);
    crowd.update(1 / 60);
    expect(mesh.getTotalVertices()).toBeLessThan(verts);
    crowd.clear();
    crowd.update(1 / 60);
    expect(mesh.isEnabled()).toBe(false);
  });
});

describe("sidewalks in the picture (ADR-0041)", () => {
  it("lift whoever stands on one, eased like a step; floors above the street stay as they are", () => {
    const w = SIDEWALKS[0]!;
    const x = (w.minX + w.maxX) / 2;
    const z = (w.minZ + w.maxZ) / 2;
    expect(groundLift(x, 0, z)).toBe(SIDEWALK_HEIGHT);
    expect(groundLift(x, 5, z)).toBe(0);
    expect(groundLift(0, 0, 0)).toBe(0);
    expect(easeLift(0, SIDEWALK_HEIGHT, 1 / 60)).toBeGreaterThan(0);
    expect(easeLift(0, SIDEWALK_HEIGHT, 1)).toBe(SIDEWALK_HEIGHT);
    expect(easeLift(SIDEWALK_HEIGHT, 0, 1)).toBe(0);
  });

  it("bake slabs, kerbs, joints and crossings into a chunk's dressing, nothing for a chunk without", () => {
    const sink = new MeshSink();
    planSidewalks(sink, "shinsekai-7");
    expect(sink.vertexCount).toBeGreaterThan(500);
    const top = Math.max(...sink.positions.filter((_, i) => i % 3 === 1));
    expect(top).toBeCloseTo(SIDEWALK_HEIGHT + 0.012, 3);
    const none = new MeshSink();
    planSidewalks(none, "nowhere");
    expect(none.empty).toBe(true);
  });
});
