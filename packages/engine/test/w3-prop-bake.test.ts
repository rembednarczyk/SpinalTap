import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { W3_HALL_DOORS, WORLD_CHUNKS, w3 } from "@seki/sim";
import { type Mesh, Scene, Vector3 } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { type Block, buildBlock } from "../src/renderer/props";
import { inW3Interior } from "../src/renderer/tessen-w3/w3-interior-cull";
import { W3PropBake, atRest, w3Bakeable } from "../src/renderer/tessen-w3/w3-prop-bake";

/**
 * W-3's hall's own props baked while they stand still (ADR-0082 §4, the debt of stage 2b): its
 * doors' leaves, stairs and ladders one mesh per preset; a sliding leaf or a focused scan target
 * drawn as its own mesh, a shut leaf back in the bake.
 */

const scene = new Scene(new NullEngine());
const materials = new ToonMaterials(scene);

/**
 * The props of W-3's chunk the renderer draws as meshes of their own (`PropViews.spawnLit`): no
 * scenery, no plain interior block, no ladder's grab point or culvert's mouth (places, no view).
 */
const ownMeshes = WORLD_CHUNKS.find((c) => c.id === "nabrzeze-w3")!.props.filter(
  (p) =>
    !p.scenery &&
    p.mechanism?.kind !== "ladder-end" &&
    p.mechanism?.kind !== "crawl" &&
    p.view.kind === "block" &&
    !(p.view.interior && !p.view.skin && !p.view.slope && !p.view.rungs),
);
const block = (p: (typeof ownMeshes)[number]) => p.view as Block;

const spawn = (name: string, view: Block, at: Vector3) => {
  const prop = buildBlock(scene, materials, name, view, at);
  return { root: prop.root, mesh: prop.root.getChildMeshes(true)[0] as Mesh };
};
const leaf = (): Block => ({ kind: "block", size: { x: 1.6, y: 2.6, z: 0.2 }, material: "metal" });
const ladder = (): Block => ({ kind: "block", size: { x: 0.6, y: 5, z: 0.08 }, material: "metal", rungs: 16 });

describe("W-3's hall's doors, stairs and ladders baked (ADR-0082 §4)", () => {
  it("bakes every prop of the hall's rooms that is a mesh of its own, but glass and what stands outside them", () => {
    const bakeable = ownMeshes.filter((p) => w3Bakeable(block(p), p.center));
    const leaves = W3_HALL_DOORS.filter((d) => inW3Interior({ x: d.at.x, y: d.at.y + d.height / 2, z: d.at.z })).reduce((n, d) => n + d.leaves, 0);
    const stairs = bakeable.filter((p) => block(p).slope?.steps);
    const ladders = bakeable.filter((p) => block(p).rungs);
    // Every leaf of the inner doors (24); four flights (stair N to the mezzanine with its railing, stairs A and B and the parts line's down to the basement);
    // the three ladders (the crane's track, the lift's shaft, the roof hatch).
    expect(leaves).toBe(24);
    expect(bakeable.filter((p) => !block(p).slope && !block(p).rungs)).toHaveLength(leaves);
    expect(stairs).toHaveLength(4);
    expect(bakeable.filter((p) => block(p).slope && !block(p).slope?.steps)).toHaveLength(1);
    expect(ladders).toHaveLength(3);
    // Out: the doors in its outer walls, the roofs and parapets, the tower, the quay, the yards, and glass anywhere.
    for (const p of ownMeshes.filter((q) => !w3Bakeable(block(q), q.center))) expect(!inW3Interior(p.center) || block(p).material === "glass", `${p.center.x},${p.center.z}`).toBe(true);
    expect(w3Bakeable({ material: "glass" }, w3(2566, 1, 437))).toBe(false);
    expect(w3Bakeable({ material: "metal", skin: { style: "dumpster", front: "x-" } }, w3(2566, 1, 437))).toBe(false);
    expect(w3Bakeable({ material: "metal" }, w3(2566, 1, 437))).toBe(true);
  });

  it("draws the props still in one mesh per preset, in world space, hidden and shown with the hall", () => {
    const bake = new W3PropBake(scene);
    const a = spawn("a", leaf(), new Vector3(2504, -27.3, 404));
    const b = spawn("b", leaf(), new Vector3(2534, -27.3, 404));
    const l = spawn("l", ladder(), new Vector3(2520, -26, 429.6));
    bake.add(1, a.mesh, a.root.position);
    bake.add(2, b.mesh, b.root.position);
    bake.add(3, l.mesh, l.root.position);
    expect(a.mesh.isEnabled(false)).toBe(true);
    bake.flush();
    expect(bake.meshes).toHaveLength(2);
    for (const m of [a, b, l]) expect(m.mesh.isEnabled(false)).toBe(false);
    const leaves = bake.meshes.find((m) => m.material === a.mesh.material)!;
    expect(leaves.getTotalVertices()).toBe(48);
    const box = leaves.getBoundingInfo().boundingBox;
    expect(box.minimumWorld.x).toBeCloseTo(2503.2, 5);
    expect(box.maximumWorld.x).toBeCloseTo(2534.8, 5);
    expect(box.maximumWorld.y).toBeCloseTo(-26, 5);
    expect(bake.meshes.every((m) => !m.isEnabled(false) && !m.isPickable)).toBe(true);
    bake.setShown(true);
    expect(bake.meshes.every((m) => m.isEnabled(false))).toBe(true);
    for (const id of [1, 2, 3]) bake.remove(id);
    bake.flush();
    expect(bake.meshes).toHaveLength(0);
    expect(bake.size).toBe(0);
  });

  it("takes a sliding leaf out at once and puts it back once shut", () => {
    const bake = new W3PropBake(scene);
    bake.setShown(true);
    const a = spawn("a", leaf(), new Vector3(2504, -27.3, 404));
    const b = spawn("b", leaf(), new Vector3(2534, -27.3, 404));
    bake.add(1, a.mesh, a.root.position);
    bake.add(2, b.mesh, b.root.position);
    bake.flush();
    const before = bake.meshes[0]!;
    // The leaf starts to slide: out of the bake before the frame is drawn, never shut and open at once.
    a.root.position.set(2504.4, -27.3, 404);
    bake.moved(1, a.root.position);
    expect(bake.baked(1)).toBe(false);
    expect(a.mesh.isEnabled(false)).toBe(true);
    expect(before.isDisposed()).toBe(true);
    expect(bake.meshes[0]!.getTotalVertices()).toBe(24);
    expect(bake.meshes[0]!.isEnabled(false)).toBe(true);
    bake.moved(1, new Vector3(2505.6, -27.3, 404));
    expect(bake.meshes[0]!.getTotalVertices()).toBe(24);
    // Shut again: its own mesh drawn until the bake has it back on the next flush.
    a.root.position.set(2504, -27.3, 404.0004);
    bake.moved(1, a.root.position);
    expect(a.mesh.isEnabled(false)).toBe(true);
    bake.flush();
    expect(bake.baked(1)).toBe(true);
    expect(a.mesh.isEnabled(false)).toBe(false);
    const box = bake.meshes[0]!.getBoundingInfo().boundingBox;
    expect(box.minimumWorld.x).toBeCloseTo(2503.2, 5);
    expect(bake.meshes[0]!.getTotalVertices()).toBe(48);
  });

  it("leaves a focused scan target its own mesh for good", () => {
    const bake = new W3PropBake(scene);
    const a = spawn("cam", { kind: "block", size: { x: 0.3, y: 0.25, z: 0.45 }, material: "metal" }, new Vector3(2561.8, -25, 438.8));
    const b = spawn("b", leaf(), new Vector3(2534, -27.3, 404));
    bake.add(1, a.mesh, a.root.position);
    bake.add(2, b.mesh, b.root.position);
    bake.flush();
    bake.release(1);
    expect(a.mesh.isEnabled(false)).toBe(true);
    expect(bake.baked(2)).toBe(true);
    bake.moved(1, new Vector3(2562, -25, 438.8));
    bake.moved(1, a.root.position);
    bake.flush();
    expect(bake.baked(1)).toBe(false);
    expect(a.mesh.isEnabled(false)).toBe(true);
    bake.release(2);
    expect(bake.meshes).toHaveLength(0);
    expect(b.mesh.isEnabled(false)).toBe(true);
  });

  it("judges rest to a millimetre", () => {
    const p = { x: 2504, y: -27.3, z: 404 };
    expect(atRest(p, { x: 2504.0009, y: -27.3, z: 404 })).toBe(true);
    expect(atRest(p, { x: 2504.002, y: -27.3, z: 404 })).toBe(false);
  });
});
