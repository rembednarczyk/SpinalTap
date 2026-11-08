import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import type { EntityId } from "@seki/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Mesh, Scene, type TransformNode, Vector3, VertexBuffer } from "../src/babylon";
import type { CameraRig } from "../src/camera/camera-rig";
import type { MoonShadow } from "../src/npr/moon-shadow";
import { ToonMaterials } from "../src/npr/toon-material";
import { CharacterViews } from "../src/renderer/character-views";
import { UPRIGHT, clampFigure } from "../src/renderer/model-figure";
import { type CharacterModelManifest, toonSourceOf } from "../src/renderer/model-library";
import { normaliseBoneName } from "../src/renderer/model-rig";
import { BACKGROUND_VARIANTS, variantOf, variantText } from "../src/renderer/model-variant";
import { readModelFile, serveModels } from "./game-models";

/** Standing at the origin, facing +Z. */
const STAND = { position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, speed: 0 };
const WALK = { ...STAND, speed: 1.4 };

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

/** A bone of character `id`'s model by its normalised name ("head", "hips", "rhand"). */
const boneOf = (scene: Scene, id: EntityId, bone: string): TransformNode => {
  const prefix = `e${id}-m-`;
  const node = scene.transformNodes.find((n) => n.name.startsWith(prefix) && normaliseBoneName(n.name, prefix) === bone);
  expect(node, `e${id} ${bone}`).toBeDefined();
  return node!;
};

/** How far the head stands ahead of the hips (+Z: the character faces +Z), in metres. */
const headAhead = (scene: Scene, id: EntityId): number => {
  const z = (n: TransformNode) => (n.computeWorldMatrix(true), n.getAbsolutePosition().z);
  for (const n of scene.transformNodes) n.computeWorldMatrix(true);
  return z(boneOf(scene, id, "chead")) - z(boneOf(scene, id, "chips"));
};

/** The model's root: the last node of its own above the hips. */
const modelRoot = (scene: Scene, id: EntityId): TransformNode => {
  let n = boneOf(scene, id, "chips");
  while (n.parent && n.parent.name.startsWith(`e${id}-m-`)) n = n.parent as TransformNode;
  return n;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("figures of the variants (ADR-0076 decision 7)", () => {
  it("are part of the look: a dressed figure is clamped, and the named characters' numbers are never aged by the seed", () => {
    expect(variantOf(0).figure).toEqual(UPRIGHT);
    expect(clampFigure({ stoop: 3, build: 0.1, pace: 0 })).toEqual({ stoop: 0.7, build: 0.8, pace: 0.4 });
    const bent = variantOf(101, { figure: { stoop: 0.5 } });
    expect(bent.figure).toEqual({ stoop: 0.5, build: 1, pace: 1 });
    expect(variantText(bent)).not.toBe(variantText(variantOf(101)));
    for (let id = 100; id < 200; id++) expect(variantOf(id).figure, `${id}`).toEqual(UPRIGHT);
    // Some background variants are older: grey hair, a bent back, shorter steps.
    const old = Array.from({ length: BACKGROUND_VARIANTS }, (_, i) => variantOf(i + 1)).filter((v) => v.figure.stoop > 0);
    expect(old.length).toBeGreaterThan(0);
    expect(old.length).toBeLessThan(BACKGROUND_VARIANTS / 2);
    for (const v of old) expect(v.figure.pace).toBeLessThan(1);
  });

  it("bend Ume's back, narrow her, shorten her steps and put a stick in her hand and a shawl on her shoulders; all of it comes off in the pool", async () => {
    serveModels();
    const scene = new Scene(new NullEngine());
    const views = viewsOn(scene);
    // Ume, and the same file in its own look standing next to her.
    views.setCharacterModels({ ...GAME, civilian: { url: "base-female.vrm", scale: 0.86 } });
    views.spawn(2, { kind: "npc", preset: "civilian", cast: "ume", umbrella: false }, STAND);
    views.spawn(3, { kind: "npc", preset: "civilian", umbrella: false }, STAND);
    await settled(views);
    expect(views.dressedCount).toBe(2);
    // The head well ahead of the hips over a bent back; upright within a few centimetres.
    const bent = headAhead(scene, 2);
    expect(bent).toBeGreaterThan(headAhead(scene, 3) + 0.06);
    const root = modelRoot(scene, 2);
    expect(Math.abs(root.scaling.x / root.scaling.y)).toBeCloseTo(0.94, 3);
    expect(Math.abs(modelRoot(scene, 3).scaling.x / modelRoot(scene, 3).scaling.y)).toBeCloseTo(1, 3);
    expect(views.rigOf(2)!.pace).toBe(0.55);
    // The school bow of the file takes the cardigan's colour.
    const tieOf = (id: EntityId) => scene.meshes.find((m) => m.name.startsWith(`e${id}-m-`) && toonSourceOf(m)?.source.part === "tie")?.material;
    expect(tieOf(3)).toBeDefined();
    expect(tieOf(2)).not.toBe(tieOf(3));
    // The stick hangs from the right palm, upright, down to the ground, before every frame; the
    // shawl hangs on the chest and the long skirt from the waist down to the calves.
    const cane = scene.getMeshByName("e2-v-cane") as Mesh;
    views.update(1 / 60);
    scene.onBeforeRenderObservable.notifyObservers(scene);
    cane.computeWorldMatrix(true);
    cane.refreshBoundingInfo();
    const box = cane.getBoundingInfo().boundingBox;
    expect(box.minimumWorld.y).toBeLessThan(0.15);
    expect(box.minimumWorld.y).toBeGreaterThan(-0.15);
    const hand = boneOf(scene, 2, "rhand").getAbsolutePosition();
    expect(Math.hypot(box.centerWorld.x - hand.x, box.centerWorld.z - hand.z)).toBeLessThan(0.08);
    expect(box.maximumWorld.y).toBeGreaterThan(hand.y - 0.12);
    expect(scene.getMeshByName("e2-v-chest")).not.toBeNull();
    const skirt = scene.getMeshByName("e2-v-skirt") as Mesh;
    skirt.computeWorldMatrix(true);
    skirt.refreshBoundingInfo();
    const hem = skirt.getBoundingInfo().boundingBox;
    expect(hem.minimumWorld.y).toBeGreaterThan(0.1);
    expect(hem.minimumWorld.y).toBeLessThan(0.35);
    expect(hem.maximumWorld.y).toBeGreaterThan(boneOf(scene, 2, "chips").getAbsolutePosition().y);
    views.despawn(2, false);
    expect(scene.getMeshByName("e2-v-skirt")).toBeNull();
    expect(root.scaling.x / root.scaling.y).toBeCloseTo(Math.sign(root.scaling.x), 3);
    expect(scene.getMeshByName("e2-v-cane")).toBeNull();
    // The pooled model comes back upright on the next character of the same look.
    views.spawn(4, { kind: "npc", preset: "civilian", cast: "ume", umbrella: false }, STAND);
    await settled(views);
    expect(scene.getTransformNodeByName("e4-m-__root__")).toBeNull();
    expect(headAhead(scene, 2)).toBeCloseTo(bent, 3);
    expect(views.rigOf(4)!.pace).toBe(0.55);
  });

  it("take shorter strides on an older figure at the same speed", async () => {
    serveModels();
    const scene = new Scene(new NullEngine());
    const views = viewsOn(scene);
    views.setCharacterModels(GAME);
    views.spawn(2, { kind: "npc", preset: "civilian", cast: "ume", umbrella: false }, WALK);
    views.spawn(3, { kind: "npc", preset: "civilian", cast: "hana", umbrella: false }, WALK);
    await settled(views);
    const swing = (id: EntityId) => {
      let most = 0;
      for (let i = 0; i < 90; i++) {
        views.move(id, WALK);
        views.update(1 / 60);
        most = Math.max(most, Math.abs(views.rigOf(id)!.legL.rotation.x));
      }
      return most;
    };
    expect(swing(2)).toBeLessThan(0.7 * swing(3));
  });

  it("put a vest round Oyaji's body: a skinned shell of his top, front and back, without the sleeves", async () => {
    serveModels();
    const scene = new Scene(new NullEngine());
    const views = viewsOn(scene);
    views.setCharacterModels(GAME);
    views.spawn(2, { kind: "npc", preset: "civilian", cast: "oyaji", umbrella: false }, STAND);
    await settled(views);
    const vest = scene.getMeshByName("e2-v-vest") as Mesh | null;
    expect(vest).not.toBeNull();
    expect(vest!.skeleton).not.toBeNull();
    const pos = vest!.getVerticesData(VertexBuffer.PositionKind)!;
    const world = vest!.computeWorldMatrix(true);
    const xs: number[] = [];
    const zs: number[] = [];
    for (let i = 0; i < pos.length; i += 3) {
      const p = Vector3.TransformCoordinates(new Vector3(pos[i]!, pos[i + 1]!, pos[i + 2]!), world);
      xs.push(p.x);
      zs.push(p.z);
    }
    // Round the body (front and back), no wider than the chest.
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(0.12);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(0.4);
  });
});
