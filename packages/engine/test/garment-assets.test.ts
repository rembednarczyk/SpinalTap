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
import { BodyGrid, GARMENT_LIFT } from "../src/renderer/garment-fit";
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
      // One mesh of 5140 triangles on the J_Bip_ bones of the model, in the gang's green.
      expect(jacket!.getIndices()!.length / 3).toBe(5140);
      const bones = new Set<string>();
      const idx = jacket!.getVerticesData(VertexBuffer.MatricesIndicesKind)!;
      const w = jacket!.getVerticesData(VertexBuffer.MatricesWeightsKind)!;
      for (let i = 0; i < idx.length; i++) if (w[i]! > 0) bones.add(jacket!.skeleton!.bones[idx[i]!]!.name);
      expect([...bones].every((b) => b.startsWith("J_Bip_")), [...bones].join()).toBe(true);
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
