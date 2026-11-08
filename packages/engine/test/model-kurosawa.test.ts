import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import type { EntityId } from "@seki/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type AbstractMesh, Scene, Vector3 } from "../src/babylon";
import type { CameraRig } from "../src/camera/camera-rig";
import type { MoonShadow } from "../src/npr/moon-shadow";
import { ToonMaterials } from "../src/npr/toon-material";
import { CharacterViews } from "../src/renderer/character-views";
import { type CharacterModelManifest, ModelLibrary, toonSourceOf } from "../src/renderer/model-library";
import { backgroundVariantOf, variantOf } from "../src/renderer/model-variant";
import { readModelFile, serveModels } from "./game-models";

const STAND = { position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, speed: 0 };
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

const meshesOf = (views: CharacterViews, id: EntityId): AbstractMesh[] => {
  let out: readonly AbstractMesh[] = [];
  views.scanTargets((who, _scan, meshes) => {
    if (who === id) out = meshes();
  });
  return out.filter((m) => m.getTotalVertices() > 0);
};

/** The texture a character's part is drawn with, and the one its own file gave it. */
const texturesOf = (views: CharacterViews, id: EntityId, part: string) => {
  const m = meshesOf(views, id).find((x) => toonSourceOf(x)?.source.part === part)!;
  return { drawn: (m.material as unknown as { getActiveTextures(): unknown[] }).getActiveTextures(), own: toonSourceOf(m)!.source.texture };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

/** ADR-0076 decision 4, stage 3: Kurosawa on a model of his own (HairSample_Male, CC0). */
describe("Kurosawa's model (ADR-0076 stage 3)", () => {
  it("is a VRoid M00 figure with his own face and hair, not Kaito's, in the game's cast", async () => {
    serveModels();
    const scene = new Scene(new NullEngine());
    const views = viewsOn(scene);
    views.setCharacterModels(GAME);
    views.spawn(2, { kind: "npc", preset: "fixer", cast: "kaito" }, STAND);
    views.spawn(3, { kind: "npc", preset: "fixer", cast: "kurosawa" }, STAND);
    await settled(views);
    expect(views.dressedCount).toBe(2);
    for (const part of ["hair", "skin", "torso", "legs"]) {
      const own = texturesOf(views, 3, part).own;
      expect(own, part).not.toBeNull();
      expect(own, part).not.toBe(texturesOf(views, 2, part).own);
    }
    expect(meshesOf(views, 3).some((m) => toonSourceOf(m)?.source.family === "M00")).toBe(true);
    // The retarget finds his head (the glasses hang on it).
    expect(scene.getMeshByName("e3-v-head")?.parent?.name).toBe("e3-v-head-variant");
  });

  it("costs no more meshes than Kaito, but for his glasses: a draw call and an outline each", async () => {
    serveModels();
    const scene = new Scene(new NullEngine());
    const views = viewsOn(scene);
    views.setCharacterModels(GAME);
    views.spawn(2, { kind: "npc", preset: "fixer", cast: "kaito" }, STAND);
    views.spawn(3, { kind: "npc", preset: "fixer", cast: "kurosawa" }, STAND);
    await settled(views);
    const kaito = meshesOf(views, 2).length;
    const kurosawa = meshesOf(views, 3).length;
    const glasses = scene.meshes.filter((m) => m.name.startsWith("e3-v-") && m.getTotalVertices() > 0).length;
    expect(glasses).toBe(1);
    console.info(`[kurosawa] meshes: Kaito ${kaito}, Kurosawa ${kurosawa} + ${glasses} accessory`);
    expect(kurosawa).toBeLessThanOrEqual(kaito);
  });

  it("lends his trousers to Base_Male and Kaito, but his coat to no one: it is another cut (M00_006)", async () => {
    serveModels();
    const library = new ModelLibrary(new Scene(new NullEngine()), new ToonMaterials(new Scene(new NullEngine())));
    const cloth = await library.clothOf({ url: "kurosawa.vrm" });
    expect(cloth.cuts).toEqual({ torso: "M00_006", legs: "M00_001" });
    expect((await library.clothOf({ url: "kaito.vrm" })).cuts).toEqual({ torso: "M00_001", legs: "M00_001" });

    const scene = new Scene(new NullEngine());
    const views = viewsOn(scene);
    // Base_Male and Kurosawa only: his file is the one lender Base_Male has.
    views.setCharacterModels({ ganger: { url: "ganger.vrm" }, cast: { kurosawa: { url: "kurosawa.vrm" } }, pools: { ganger: [{ url: "ganger.vrm" }] } });
    const borrowing = (want: "topFrom" | "bottomFrom") => {
      for (let look = 0; look < 5000; look++) if (variantOf(backgroundVariantOf(look), undefined, false)[want] !== null) return look;
      throw new Error("no such look");
    };
    views.spawn(2, { kind: "enemy", preset: "ganger", look: borrowing("topFrom") }, STAND);
    views.spawn(3, { kind: "enemy", preset: "ganger", look: borrowing("bottomFrom") }, STAND);
    await settled(views);
    // A coat on a shirt's UVs would scatter its texels: Base_Male keeps his own top.
    // Booleans: a failing `toContain` would print the scene graph of the textures.
    const wearsOwn = (id: EntityId, part: string) => texturesOf(views, id, part).drawn.includes(texturesOf(views, id, part).own);
    expect(wearsOwn(2, "torso"), "Base_Male in Kurosawa's coat").toBe(true);
    expect(wearsOwn(3, "legs"), "Base_Male in Kurosawa's trousers").toBe(false);
  });
});
