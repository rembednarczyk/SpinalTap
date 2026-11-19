// @ts-expect-error The engine is typed for the browser; the tests read the files off disk.
import { readFileSync } from "node:fs";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import type { AppearanceDescriptor } from "@seki/core";
import { GARMENT_CATALOG } from "@seki/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type AbstractMesh, type Mesh, Scene, VertexBuffer } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { buildCivilian, buildHeroine } from "../src/renderer/characters";
import { GarmentAssets, bodySurfaceOf } from "../src/renderer/garment-assets";
import { BodyGrid, GARMENT_LIFT, TRANSFER_FULL, fitGarment } from "../src/renderer/garment-fit";
import { activityJoints } from "../src/renderer/activity-poses";
import { applyActivityPose } from "../src/renderer/activity-rig";
import { Loadouts } from "../src/renderer/loadout";
import { ModelLibrary, toonSourceOf } from "../src/renderer/model-library";
import { HumanoidRetarget } from "../src/renderer/model-rig";
import { WeaponMounts } from "../src/renderer/weapon-mount";

const read = readFileSync as (u: URL) => Uint8Array;

/** The game's model and garment files, served from disk to `fetch`. */
const serve = (): void => {
  vi.stubGlobal("fetch", (url: string) => {
    const path = url.replace(/^\.\//, "");
    const b = read(new URL(`../../app/public/${path.startsWith("garments/") ? path : `models/${path}`}`, import.meta.url));
    return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)) });
  });
};

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The look of a Hebi ganger: the Hebi jacket (the techwear jacket in the gang's green) and cargo trousers. */
const HEBI: AppearanceDescriptor = {
  weapons: { primary: null, secondary: null, melee: null, active: "secondary" },
  garments: { torso: GARMENT_CATALOG.hebi_jacket.look, legs: GARMENT_CATALOG.cargo_pants.look },
  implants: [],
};
const PLAIN: AppearanceDescriptor = { ...HEBI, garments: { legs: GARMENT_CATALOG.cargo_pants.look } };

const tops = (meshes: readonly AbstractMesh[]) => meshes.filter((m) => toonSourceOf(m)?.source.garment === "torso");

/** A cast file dressed over a rig as the game does it, wearing a look. */
const dress = async (file: string, look: AppearanceDescriptor) => {
  serve();
  const scene = new Scene(new NullEngine());
  const materials = new ToonMaterials(scene);
  const library = new ModelLibrary(scene, materials);
  const loadouts = new Loadouts(scene, materials, new WeaponMounts(library), () => {});
  const model = await library.instantiate({ url: file }, "c");
  const rig = file === "seki.vrm" ? buildHeroine(scene, materials, "r") : buildCivilian(scene, materials, "r", false);
  const retarget = HumanoidRetarget.create(rig, model.root, model.prefix)!;
  loadouts.set(rig, look, "c");
  loadouts.setModel(rig, { retarget, meshes: model.meshes });
  await loadouts.dress.settled();
  const jacket = scene.getMeshByName("c-jacket-techwear") as Mesh | null;
  return { scene, loadouts, rig, model, jacket };
};

/**
 * How far each garment vertex stands out of the body (metres, negative inside), against the normal
 * of the nearest vertex of the model's skin and trousers, in the bind pose.
 */
const standOffs = (jacket: Mesh, meshes: readonly AbstractMesh[]): number[] => {
  const body = bodySurfaceOf(meshes, jacket.skeleton!)!;
  const grid = new BodyGrid(body);
  const p = jacket.getVerticesData(VertexBuffer.PositionKind)!;
  const out: number[] = [];
  for (let i = 0; i < p.length; i += 3) {
    const at = grid.standOff(p[i]!, p[i + 1]!, p[i + 2]!);
    if (at) out.push(at.out);
  }
  return out;
};

/** A skinned mesh's positions and normals in its skeleton's current pose, worked out on the CPU (what the GPU draws). */
const skinned = (m: AbstractMesh): { positions: Float32Array; normals: Float32Array } => {
  const p = m.getVerticesData(VertexBuffer.PositionKind)!;
  const n = m.getVerticesData(VertexBuffer.NormalKind)!;
  const j = m.getVerticesData(VertexBuffer.MatricesIndicesKind)!;
  const w = m.getVerticesData(VertexBuffer.MatricesWeightsKind)!;
  const mats = m.skeleton!.getTransformMatrices(m);
  const positions = new Float32Array(p.length);
  const normals = new Float32Array(p.length);
  for (let v = 0; v < p.length / 3; v++) {
    for (let k = 0; k < 4; k++) {
      const wt = w[v * 4 + k]!;
      if (!wt) continue;
      const o = j[v * 4 + k]! * 16;
      for (let a = 0; a < 3; a++) {
        positions[v * 3 + a]! += wt * (p[v * 3]! * mats[o + a]! + p[v * 3 + 1]! * mats[o + 4 + a]! + p[v * 3 + 2]! * mats[o + 8 + a]! + mats[o + 12 + a]!);
        normals[v * 3 + a]! += wt * (n[v * 3]! * mats[o + a]! + n[v * 3 + 1]! * mats[o + 4 + a]! + n[v * 3 + 2]! * mats[o + 8 + a]!);
      }
    }
  }
  return { positions, normals };
};

describe("garment assets (ADR-0086)", () => {
  // Seki (F00) and the ganger (Base_Male, M00): the jacket was cut out of an N00 file of another figure.
  for (const file of ["seki.vrm", "ganger.vrm"]) {
    it(`${file}: the Hebi jacket is the techwear jacket on the model's own skeleton, the top under it hidden`, async () => {
      const { scene, loadouts, rig, model, jacket } = await dress(file, HEBI);
      expect(loadouts.dress.garments(rig)).toEqual(["jacket-techwear"]);
      expect(jacket).not.toBeNull();
      const top = tops(model.meshes);
      expect(top.length).toBeGreaterThan(0);
      expect(jacket!.skeleton).toBe(top[0]!.skeleton);
      expect(jacket!.parent).toBe(top[0]!.parent);
      // The top under the jacket is hidden; only its front between the flaps is drawn, by a small mesh of its own.
      for (const m of top) {
        expect(m.isEnabled(false), m.name).toBe(false);
        const rest = scene.getMeshByName(`${m.name}-jacket-techwear-rest`)!;
        expect(rest.skeleton).toBe(m.skeleton);
        expect(rest.material).toBe(m.material);
        // The jacket takes the gang's green; the shirt under it keeps its own colours.
        expect(m.material?.name, m.name).not.toContain(":tint");
        const [all, left] = [m.getIndices()!.length, rest.getIndices()!.length];
        expect(left / all, m.name).toBeGreaterThan(0.2);
        expect(left / all, m.name).toBeLessThan(0.6);
      }
      // One mesh of 5140 triangles on the bones of the model (its J_Bip_, and the J_Sec_ of the cloth it lies on), in the gang's green.
      expect(jacket!.getIndices()!.length / 3).toBe(5140);
      const bones = new Set<string>();
      const idx = jacket!.getVerticesData(VertexBuffer.MatricesIndicesKind)!;
      const w = jacket!.getVerticesData(VertexBuffer.MatricesWeightsKind)!;
      for (let i = 0; i < idx.length; i++) if (w[i]! > 0) bones.add(jacket!.skeleton!.bones[idx[i]!]!.name);
      expect([...bones].every((b) => /^J_(Bip|Sec)_/.test(b)), [...bones].join()).toBe(true);
      expect(jacket!.material?.name).toContain(":tint");
    });

    it(`${file}: no vertex of the jacket lies in the body in the bind pose`, async () => {
      const { model, jacket } = await dress(file, HEBI);
      const out = standOffs(jacket!, model.meshes);
      expect(out.length).toBeGreaterThan(1000);
      // Pushed GARMENT_LIFT off the nearest vertex of the body and the cloth under it; a little less where the push brought another one nearer.
      expect(out.filter((d) => d < 0)).toEqual([]);
      expect(Math.min(...out)).toBeGreaterThan(GARMENT_LIFT - 0.003);
    });
  }

  it("ganger.vrm: hides the skin of the arms and the torso under the jacket, draws the hands, the neck and the legs", async () => {
    const { scene, model, jacket } = await dress("ganger.vrm", HEBI);
    const body = model.meshes.find((m) => m.name === "c-Body_primitive0")!;
    expect(body.isEnabled(false)).toBe(false);
    const rest = scene.getMeshByName("c-Body_primitive0-jacket-techwear-rest") as Mesh;
    expect(rest.skeleton).toBe(jacket!.skeleton);
    const [all, left] = [body.getIndices()!.length, rest.getIndices()!.length];
    expect(left / all).toBeGreaterThan(0.3);
    expect(left / all).toBeLessThan(0.9);
    // What the drawn skin follows most: the hands, the head and the legs among it.
    const j = rest.getVerticesData(VertexBuffer.MatricesIndicesKind)!;
    const w = rest.getVerticesData(VertexBuffer.MatricesWeightsKind)!;
    const follows = new Set<string>();
    for (let v = 0; v < j.length / 4; v++) {
      let k = 0;
      for (let i = 1; i < 4; i++) if (w[v * 4 + i]! > w[v * 4 + k]!) k = i;
      follows.add(rest.skeleton!.bones[j[v * 4 + k]!]!.name.replace(/^.*J_Bip_/, ""));
    }
    for (const b of ["L_Hand", "R_Hand", "C_Head", "L_UpperLeg", "R_LowerLeg"]) expect(follows.has(b), b).toBe(true);
  });

  // The user's notes of 19.11: the shoulders and the armpits showed through the jacket once the arms came down.
  for (const file of ["ganger.vrm", "kaito.vrm"]) {
    it(`${file}: no drawn skin comes through the jacket in the activities' poses`, async () => {
      const { scene, rig, model, jacket } = await dress(file, HEBI);
      const retarget = HumanoidRetarget.create(rig, model.root, model.prefix)!;
      const rest = scene.getMeshByName("c-Body_primitive0-jacket-techwear-rest") as Mesh;
      // The drawn skin's vertices in the bind pose that lie under the jacket: each with the jacket's vertex over it.
      const jb = jacket!.getVerticesData(VertexBuffer.PositionKind)!;
      const jn = jacket!.getVerticesData(VertexBuffer.NormalKind)!;
      const rb = rest.getVerticesData(VertexBuffer.PositionKind)!;
      const grid = new BodyGrid({ positions: jb, normals: jn });
      const under: [number, number][] = [];
      for (let v = 0; v < rb.length / 3; v++) {
        const g = grid.nearest(rb[v * 3]!, rb[v * 3 + 1]!, rb[v * 3 + 2]!);
        if (g < 0) continue;
        const out = (rb[v * 3]! - jb[g * 3]!) * jn[g * 3]! + (rb[v * 3 + 1]! - jb[g * 3 + 1]!) * jn[g * 3 + 1]! + (rb[v * 3 + 2]! - jb[g * 3 + 2]!) * jn[g * 3 + 2]!;
        if (out < -0.004) under.push([v, g]);
      }
      expect(under.length).toBeGreaterThan(50);
      for (const act of ["idle", "phone", "drink", "smoke"] as const) {
        applyActivityPose(rig, activityJoints(act, 2.5), 1);
        retarget.update();
        for (const n of scene.transformNodes) n.computeWorldMatrix(true);
        for (const m of scene.meshes) m.computeWorldMatrix(true);
        jacket!.skeleton!.prepare(true);
        const J = skinned(jacket!);
        const R = skinned(rest);
        const through = under.filter(([v, g]) => {
          const d = [0, 1, 2].map((a) => R.positions[v * 3 + a]! - J.positions[g * 3 + a]!);
          return d[0]! * J.normals[g * 3]! + d[1]! * J.normals[g * 3 + 1]! + d[2]! * J.normals[g * 3 + 2]! > 0.002;
        });
        expect(through.length, act).toBe(0);
      }
    });
  }

  it("fits a garment's weights to the skin under it, and keeps its own over the legs and away from the body", () => {
    // Bones: 0 the root, 1 an arm, 2 a leg, 3 the garment's own. A body vertex on the arm and one on the leg, both facing +z.
    const target = { names: ["root", "arm", "leg", "own"], bind: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]] as [number, number, number][] };
    const body = {
      positions: Float32Array.from([0, 1, 0, 0, 0, 0]),
      normals: Float32Array.from([0, 0, 1, 0, 0, 1]),
      joints: Float32Array.from([1, 0, 0, 0, 2, 0, 0, 0]),
      weights: Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0]),
      keepOwn: new Set([2]),
    };
    // Garment vertices: over the arm close, over the arm far, over the leg close; all on the garment's own bone.
    const at = [0, 1, 0.02, 0, 1, 0.3, 0, 0, 0.02];
    const g = {
      positions: Float32Array.from(at),
      normals: Float32Array.from([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      uvs: new Float32Array(6),
      indices: Uint32Array.from([0, 1, 2]),
      joints: Float32Array.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      weights: Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]),
      bones: ["own"],
      bind: [[0, 0, 0]] as [number, number, number][],
      parents: [-1],
    };
    expect(0.02).toBeLessThan(TRANSFER_FULL);
    const fit = fitGarment(g, target, body);
    expect([fit.joints[0], fit.weights[0]]).toEqual([1, 1]);
    expect([fit.joints[4], fit.weights[4]]).toEqual([3, 1]);
    expect([fit.joints[8], fit.weights[8]]).toEqual([3, 1]);
  });

  it("takes the jacket off with the look or the model, and the top shows again", async () => {
    const { scene, loadouts, rig, model, jacket } = await dress("seki.vrm", HEBI);
    expect(jacket).not.toBeNull();
    loadouts.set(rig, PLAIN, "c");
    expect(loadouts.dress.garments(rig)).toEqual([]);
    expect(jacket!.isDisposed()).toBe(true);
    for (const m of tops(model.meshes)) expect(m.isEnabled(false)).toBe(true);
    expect(scene.meshes.filter((m) => m.name.endsWith("-rest"))).toEqual([]);
    loadouts.set(rig, HEBI, "c");
    await loadouts.dress.settled();
    expect(loadouts.dress.garments(rig)).toEqual(["jacket-techwear"]);
    loadouts.setModel(rig, null);
    expect(loadouts.dress.garments(rig)).toEqual([]);
    expect(scene.getMeshByName("c-jacket-techwear")).toBeNull();
    for (const m of tops(model.meshes)) expect(m.isEnabled(false)).toBe(true);
  });

  it("leaves the procedural rig as it was: no garment asset, only the tint", async () => {
    serve();
    const scene = new Scene(new NullEngine());
    const materials = new ToonMaterials(scene);
    const loadouts = new Loadouts(scene, materials, new WeaponMounts(new ModelLibrary(scene, materials)), () => {});
    const rig = buildHeroine(scene, materials, "r");
    const meshes = scene.meshes.length;
    loadouts.set(rig, HEBI, "c");
    await loadouts.dress.settled();
    expect(loadouts.dress.garments(rig)).toEqual([]);
    expect(loadouts.attachments(rig)).toEqual([]);
    expect(scene.meshes.length).toBe(meshes);
  });

  it("reads the garment file once: one J_Bip_ skeleton, its texture at most 512 px", async () => {
    serve();
    const scene = new Scene(new NullEngine());
    const assets = new GarmentAssets(scene, new ToonMaterials(scene));
    const [a, b] = await Promise.all([assets.template("jacket-techwear"), assets.template("jacket-techwear")]);
    expect(a).toBe(b);
    expect(a!.geometry.bones.every((n) => n.startsWith("J_Bip_"))).toBe(true);
    expect(a!.geometry.indices.length / 3).toBe(5140);
    expect(a!.texture).not.toBeNull();
    // Kept for the toon material when the rest of the file went.
    expect(a!.texture!.getInternalTexture()).not.toBeNull();
    expect(scene.meshes.length).toBe(0);
  });
});
