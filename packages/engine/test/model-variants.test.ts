import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import type { EntityId } from "@seki/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type AbstractMesh, type Mesh, Scene, Vector3, VertexBuffer } from "../src/babylon";
import type { CameraRig } from "../src/camera/camera-rig";
import type { MoonShadow } from "../src/npr/moon-shadow";
import { ToonMaterials } from "../src/npr/toon-material";
import { CharacterModels } from "../src/renderer/character-models";
import { CharacterViews } from "../src/renderer/character-views";
import { buildCivilian } from "../src/renderer/characters";
import { Loadouts } from "../src/renderer/loadout";
import { BONE_OF } from "../src/renderer/model-accessories";
import { skinMultiplier } from "../src/renderer/model-dress";
import { type CharacterModelManifest, ModelLibrary, toonSourceOf } from "../src/renderer/model-library";
import { BACKGROUND_VARIANTS, OWN_LOOK, VARIANTS_PER_FILE, VariantBudget, backgroundVariantOf, variantOf, variantText } from "../src/renderer/model-variant";
import { WeaponMounts } from "../src/renderer/weapon-mount";
import { readModelFile, serveModels } from "./game-models";

const STAND = { position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, speed: 0 };

/** The game's manifest: its URLs are the file names `serveModels` reads. */
const GAME = JSON.parse(new TextDecoder().decode(readModelFile("manifest.json"))) as CharacterModelManifest;

const viewsOn = (scene: Scene) =>
  new CharacterViews({
    scene,
    materials: new ToonMaterials(scene),
    shadow: { addCaster: () => undefined } as unknown as MoonShadow,
    camera: { camera: { position: new Vector3(2, 1.6, 2) } } as unknown as CameraRig,
    cameraTarget: () => 1,
    lift: () => 0,
  });

const settled = async (views: CharacterViews) => {
  for (let i = 0; i < 4000 && views.loadingCount > 0; i++) await new Promise((ok) => setTimeout(ok, 0));
  expect(views.loadingCount).toBe(0);
};

/** The dressed model's meshes of a character, by what they paint. */
const meshesOf = (views: CharacterViews, id: EntityId): AbstractMesh[] => {
  let out: readonly AbstractMesh[] = [];
  views.scanTargets((who, _scan, meshes) => {
    if (who === id) out = meshes();
  });
  return out.filter((m) => m.getTotalVertices() > 0);
};
const materialOf = (views: CharacterViews, id: EntityId, part: string) => meshesOf(views, id).find((m) => toonSourceOf(m)?.source.part === part)?.material?.name;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("model variants (ADR-0076 §3)", () => {
  it("are the same look for the same number, the file's own for 0, with a named character's changes over the seed", () => {
    expect(variantOf(0)).toEqual(OWN_LOOK);
    expect(variantOf(7)).toEqual(variantOf(7));
    const looks = new Set(Array.from({ length: BACKGROUND_VARIANTS }, (_, i) => variantText(variantOf(i + 1))));
    expect(looks.size).toBe(BACKGROUND_VARIANTS);
    const dressed = variantOf(7, { hair: "#c9c9cf", top: null, accessories: ["glasses", { id: "apron", color: "#e8e4da" }] });
    expect(dressed).toMatchObject({ hair: "#c9c9cf", top: null, skin: variantOf(7).skin, bottom: variantOf(7).bottom });
    expect(dressed.accessories.map((a) => a.id)).toEqual(["glasses", "apron"]);
    expect(dressed.accessories[0]!.color).toMatch(/^#[0-9a-f]{6}$/);
    // Unknown accessories from a manifest are dropped.
    expect(variantOf(7, { accessories: ["crown" as "cap"] }).accessories).toEqual([]);
  });

  it("put a seeded accessory on one bone at most, so a background character costs one mesh more at most", () => {
    for (let id = 1; id <= 400; id++) expect(new Set(variantOf(id).accessories.map((a) => BONE_OF[a.id])).size).toBeLessThanOrEqual(1);
  });

  it("draw a background variant from the look, spread over all of them", () => {
    const ids = new Set<number>();
    for (let look = 0; look < 400; look++) ids.add(backgroundVariantOf(look * 7919));
    expect([...ids].sort((a, b) => a - b)).toEqual(Array.from({ length: BACKGROUND_VARIANTS }, (_, i) => i + 1));
    expect(backgroundVariantOf(123456)).toBe(backgroundVariantOf(123456));
  });

  it("dress at most four background variants of a file at once; a fifth character takes the nearest", () => {
    const budget = new VariantBudget();
    expect([1, 5, 9, 13].map((v) => budget.take("a.vrm", v))).toEqual([1, 5, 9, 13]);
    expect(budget.take("a.vrm", 6)).toBe(5);
    expect(budget.take("a.vrm", 16)).toBe(13);
    expect(budget.take("b.vrm", 6)).toBe(6);
    expect(budget.countOf("a.vrm")).toBe(VARIANTS_PER_FILE);
    budget.give("a.vrm", 1);
    expect(budget.take("a.vrm", 2)).toBe(2);
    // Variant 5 is worn twice: it stays until both are given back.
    budget.give("a.vrm", 5);
    expect(budget.take("a.vrm", 3)).toBe(2);
    budget.give("a.vrm", 5);
    expect(budget.take("a.vrm", 3)).toBe(3);
  });

  it("scale VRoid skin to the palette's colour, the lightest close to the file's own", () => {
    expect(skinMultiplier("#f6e2d6")).toBe("#FFFFFF");
    expect(skinMultiplier("#6a4330")).not.toBe("#FFFFFF");
  });
});

describe("variants on the game's models (ADR-0076 stage 2)", () => {
  it("dress Kurosawa unlike Kaito on Kaito's file, and Mori as a man in glasses and an apron", async () => {
    serveModels();
    const scene = new Scene(new NullEngine());
    const views = viewsOn(scene);
    views.setCharacterModels(GAME);
    views.spawn(2, { kind: "npc", preset: "fixer", cast: "kaito" }, STAND);
    views.spawn(3, { kind: "npc", preset: "fixer", cast: "kurosawa" }, STAND);
    views.spawn(4, { kind: "npc", preset: "ripperdoc", cast: "mori" }, STAND);
    await settled(views);
    expect(views.dressedCount).toBe(3);
    for (const part of ["hair", "torso", "legs", "skin"]) expect(materialOf(views, 3, part), part).not.toBe(materialOf(views, 2, part));
    // Kaito wears his file as it is: no accessory.
    expect(scene.meshes.filter((m) => m.name.startsWith("e2-v-"))).toEqual([]);
    expect(scene.getMeshByName("e3-v-head")).not.toBeNull();
    // Mori: Base_Male (M00), glasses on the head and the apron over his cloth, nothing hung on the chest.
    expect(meshesOf(views, 4).some((m) => toonSourceOf(m)?.source.family === "M00")).toBe(true);
    expect(scene.getMeshByName("e4-v-head")?.parent?.name).toBe("e4-v-head-variant");
    expect(scene.getMeshByName("e4-v-chest")).toBeNull();
    expect(scene.getMeshByName("e4-v-apron")).not.toBeNull();
  });

  it("lay the apron on the body: a skinned shell of the cloth's front, a centimetre out, chest to crotch", async () => {
    serveModels();
    const scene = new Scene(new NullEngine());
    const views = viewsOn(scene);
    views.setCharacterModels(GAME);
    views.spawn(4, { kind: "npc", preset: "ripperdoc", cast: "mori" }, STAND);
    views.spawn(5, { kind: "npc", preset: "civilian", cast: "fumiko" }, STAND);
    await settled(views);
    for (const id of [4, 5]) {
      const apron = scene.getMeshByName(`e${id}-v-apron`) as Mesh | null;
      expect(apron, `e${id}`).not.toBeNull();
      const top = meshesOf(views, id).find((m) => toonSourceOf(m)?.source.part === "torso") as Mesh;
      // On the cloth's skeleton: it bends with the body, a seated keeper's thighs too.
      expect(apron!.skeleton).toBe(top.skeleton);
      expect(apron!.isVerticesDataPresent(VertexBuffer.MatricesWeightsKind)).toBe(true);
      // It lies on the front of the cloth (STAND faces +Z), within a few centimetres of its surface.
      const zOf = (m: Mesh) => {
        const world = m.computeWorldMatrix(true);
        const pos = m.getVerticesData(VertexBuffer.PositionKind)!;
        const out: { z: number[]; y: number[] } = { z: [], y: [] };
        for (let i = 0; i < pos.length; i += 3) {
          const p = Vector3.TransformCoordinates(new Vector3(pos[i]!, pos[i + 1]!, pos[i + 2]!), world);
          out.z.push(p.z);
          out.y.push(p.y);
        }
        return out;
      };
      const cloth = zOf(top);
      const centre = (Math.min(...cloth.z) + Math.max(...cloth.z)) / 2;
      const { z: zs, y: ys } = zOf(apron!);
      const median = [...zs].sort((a, b) => a - b)[zs.length >> 1]!;
      expect(median, `e${id} behind the centre`).toBeGreaterThan(centre);
      expect(Math.max(...zs), `e${id} off the body`).toBeLessThan(Math.max(...cloth.z) + 0.03);
      // From about the chest to the crotch of a 1.5-1.8 m figure.
      expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0.35);
      expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(0.6);
    }
  });

  it("dress a rig once while its model loads: a second manifest neither starts a second model nor counts the variant twice", async () => {
    serveModels();
    const scene = new Scene(new NullEngine());
    const materials = new ToonMaterials(scene);
    const library = new ModelLibrary(scene, materials);
    const loadouts = new Loadouts(scene, materials, new WeaponMounts(library), () => {});
    const models = new CharacterModels({ library, loadouts, addCaster: () => {}, scene, materials });
    models.setManifest({ civilian: { url: "civilian.vrm" }, pools: { civilian: [{ url: "civilian.vrm" }] } });
    const rig = buildCivilian(scene, materials, "c", false);
    const choice = { fallback: "civilian", pool: "civilian", look: 7919 } as const;
    models.dress(rig, choice, "c");
    models.dress(rig, choice, "c");
    for (let i = 0; i < 4000 && models.loadingCount > 0; i++) await new Promise((ok) => setTimeout(ok, 0));
    expect(models.dressedCount).toBe(1);
    expect(models.variantsOf("civilian.vrm")).toBe(1);
    expect(scene.transformNodes.filter((n) => n.name.startsWith("c-m-")).length).toBeGreaterThan(0);
    expect(new Set(scene.meshes.filter((m) => m.name.startsWith("c-m-")).map((m) => m.name)).size).toBe(scene.meshes.filter((m) => m.name.startsWith("c-m-")).length);
    models.release(rig);
    expect(models.variantsOf("civilian.vrm")).toBe(0);
  });

  it("share materials between characters of one variant and give the file's own back to the pool", async () => {
    serveModels();
    const scene = new Scene(new NullEngine());
    const views = viewsOn(scene);
    views.setCharacterModels(GAME);
    views.spawn(2, { kind: "npc", preset: "fixer", cast: "kurosawa" }, STAND);
    await settled(views);
    const kurosawa = materialOf(views, 2, "hair");
    const materials = scene.materials.length;
    views.despawn(2, false);
    // The same file again, as Kaito: his own hair, not Kurosawa's, and no new material.
    views.spawn(3, { kind: "npc", preset: "fixer", cast: "kaito" }, STAND);
    await settled(views);
    expect(materialOf(views, 3, "hair")).not.toBe(kurosawa);
    views.despawn(3, false);
    views.spawn(4, { kind: "npc", preset: "fixer", cast: "kurosawa" }, STAND);
    await settled(views);
    expect(materialOf(views, 4, "hair")).toBe(kurosawa);
    expect(scene.materials.length).toBe(materials);
    expect(scene.meshes.filter((m) => m.name.startsWith("e2-v-") || m.name.startsWith("e3-v-"))).toEqual([]);
  });

  it("give the background of one file at most four looks at once, from its look seeds", async () => {
    serveModels();
    const scene = new Scene(new NullEngine());
    const views = viewsOn(scene);
    views.setCharacterModels({ civilian: { url: "civilian.vrm" }, pools: { civilian: [{ url: "civilian.vrm" }] } });
    const ids = Array.from({ length: 12 }, (_, i) => 10 + i);
    for (const id of ids) views.spawn(id, { kind: "npc", preset: "civilian", look: id * 7919 }, STAND);
    await settled(views);
    expect(views.dressedCount).toBe(12);
    const looks = new Set(ids.map((id) => ["skin", "hair", "torso", "legs"].map((p) => materialOf(views, id, p)).join()));
    expect(looks.size).toBeGreaterThan(1);
    expect(looks.size).toBeLessThanOrEqual(VARIANTS_PER_FILE);
    // A background character costs one accessory mesh at most.
    for (const id of ids) expect(scene.meshes.filter((m) => m.name.startsWith(`e${id}-v-`)).length).toBeLessThanOrEqual(1);
  });

  it("borrow the top or trousers of another file of the same base, never Seki's jacket", async () => {
    serveModels();
    const scene = new Scene(new NullEngine());
    const views = viewsOn(scene);
    views.setCharacterModels({ heroine: { url: "seki.vrm" }, civilian: { url: "civilian.vrm" }, ganger: { url: "ganger.vrm" }, fixer: { url: "kaito.vrm" }, pools: { civilian: [{ url: "civilian.vrm" }], ganger: [{ url: "ganger.vrm" }] } });
    // Background looks whose variants borrow a top (Kaito's for Base_Male; none for Shino, Seki's is hers).
    const borrowing = (want: "topFrom" | "bottomFrom") => {
      for (let look = 0; look < 5000; look++) if (variantOf(backgroundVariantOf(look))[want] !== null) return look;
      throw new Error("no such look");
    };
    views.spawn(2, { kind: "enemy", preset: "ganger", look: borrowing("topFrom") }, STAND);
    views.spawn(3, { kind: "npc", preset: "civilian", look: borrowing("topFrom") }, STAND);
    views.spawn(4, { kind: "npc", preset: "civilian", look: borrowing("bottomFrom") }, STAND);
    await settled(views);
    /** The texture a character's part is drawn with, and the one its own file gave it. */
    const textures = (id: EntityId, part: string) => {
      const m = meshesOf(views, id).find((x) => toonSourceOf(x)?.source.part === part)!;
      const drawn = (m.material as unknown as { getActiveTextures(): unknown[] }).getActiveTextures();
      return { drawn, own: toonSourceOf(m)!.source.texture };
    };
    // Base_Male wears Kaito's top.
    expect(textures(2, "torso").drawn).not.toContain(textures(2, "torso").own);
    // Shino has no top to borrow (Seki's jacket is hers), but Seki's trousers.
    expect(textures(3, "torso").drawn).toContain(textures(3, "torso").own);
    expect(textures(4, "legs").drawn).not.toContain(textures(4, "legs").own);
  });
});
