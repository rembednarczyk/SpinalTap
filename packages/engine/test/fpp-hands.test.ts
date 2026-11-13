import type { AppearanceDescriptor, Transform, WeaponLook } from "@seki/core";
import { afterAll, describe, expect, it, vi } from "vitest";
import { type AbstractMesh, type TransformNode, Vector3 } from "../src/babylon";
import { CameraRig } from "../src/camera/camera-rig";
import type { MoonShadow } from "../src/npr/moon-shadow";
import { ToonMaterials } from "../src/npr/toon-material";
import { CharacterKit } from "../src/renderer/character-kit";
import { buildHeroine } from "../src/renderer/characters";
import { type CharacterModelManifest, ModelLibrary } from "../src/renderer/model-library";
import { disposeModelScenes, modelScene, readModelFile, serveModels } from "./game-models";
import { allWeaponUrls } from "./weapon-files";

/**
 * Seki's own forearms and hands in first person (user's wish of 13.11): from her model file once
 * it is in, hidden in TPP, the procedural forearm without the model; the right hand holds the
 * weapon's grip whatever the viewmodel does, and the arms cost one mesh of under 5000 triangles.
 */

const manifest = JSON.parse(new TextDecoder().decode(readModelFile("manifest.json"))) as CharacterModelManifest;
const heroine = manifest.heroine!;

const armed = (active: WeaponLook): AppearanceDescriptor => ({
  weapons: { primary: active === "baton" ? "rifle" : active, secondary: "pistol", melee: "baton", active: active === "baton" ? "melee" : "primary" },
  garments: {},
  implants: [],
});

const standing: Transform = { position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, speed: 0 };

afterAll(disposeModelScenes);

const setup = () => {
  serveModels();
  const served = globalThis.fetch;
  const fetched: string[] = [];
  vi.stubGlobal("fetch", (url: string) => {
    fetched.push(url);
    return served(url);
  });
  const scene = modelScene();
  const materials = new ToonMaterials(scene);
  const camera = new CameraRig(scene, materials, () => false);
  const library = new ModelLibrary(scene, materials);
  const kit = new CharacterKit({ scene, materials, shadow: { addCaster: () => {} } as unknown as MoonShadow, camera, cameraTarget: () => 1, library });
  kit.setWeaponModels(allWeaponUrls());
  const rig = buildHeroine(scene, materials, "hero");
  const settle = (target: Transform = standing, seconds = 1) => {
    for (let t = 0; t < seconds; t += 0.05) camera.update(target, 0.05);
  };
  const props = () => ["vm-sleeve", "vm-wrist", "vm-hand"].map((n) => scene.getMeshByName(n)!);
  return { scene, camera, library, kit, rig, settle, props, fetched };
};

/** Model arms are in and drawn. */
const ready = async (kit: CharacterKit, settle: () => void) => {
  await vi.waitFor(() => {
    settle();
    expect(kit.hands.drawn.length).toBeGreaterThan(0);
  }, 30_000);
};

const triangles = (meshes: readonly AbstractMesh[]) => meshes.reduce((n, m) => n + (m.getTotalIndices() / 3), 0);

/** Where `point` (world) lies in the frame of `node`. */
const inFrame = (node: TransformNode, point: Vector3): Vector3 => {
  node.computeWorldMatrix(true);
  return Vector3.TransformCoordinates(point, node.getWorldMatrix().clone().invert());
};

describe("FPP hands from Seki's model (13.11)", () => {
  it("shows her forearms and hands in FPP once her file is in, instead of the procedural forearm, at one mesh under 5000 triangles", async () => {
    const { kit, rig, settle, props, library, fetched } = setup();
    // The start has loaded her file behind the loading screen (`startFiles`).
    await library.preload(heroine);
    const before = fetched.filter((u) => u.endsWith(".vrm")).length;
    kit.arm(1, rig, "hero", armed("pistol"));
    settle();
    expect(props().every((m) => m.isEnabled())).toBe(true);
    kit.setViewArms(heroine);
    await ready(kit, settle);
    const arms = kit.hands.drawn;
    expect(arms).toHaveLength(1);
    expect(triangles(arms)).toBeGreaterThan(1500);
    expect(triangles(arms)).toBeLessThan(5000);
    expect(arms.every((m) => m.isEnabled() && m.skeleton !== null)).toBe(true);
    expect(props().some((m) => m.isEnabled())).toBe(false);
    // Nothing more fetched: the arms come from the file already loaded.
    expect(fetched.filter((u) => u.endsWith(".vrm")).length).toBe(before);
  }, 60_000);

  it("hides them in TPP and brings them back in FPP", async () => {
    const { kit, rig, settle, camera, library } = setup();
    await library.preload(heroine);
    kit.arm(1, rig, "hero", armed("rifle"));
    kit.setViewArms(heroine);
    await ready(kit, settle);
    camera.setMode("TPP");
    settle();
    expect(kit.hands.drawn).toHaveLength(0);
    camera.setMode("FPP");
    settle();
    expect(kit.hands.drawn).toHaveLength(1);
  }, 60_000);

  it("never fetches her file itself: until the start has loaded it, the procedural forearm stays", async () => {
    const { kit, rig, settle, props, fetched } = setup();
    kit.arm(1, rig, "hero", armed("pistol"));
    kit.setViewArms(heroine);
    for (let i = 0; i < 5; i++) {
      settle();
      await Promise.resolve();
    }
    expect(fetched.filter((u) => u.endsWith(".vrm"))).toEqual([]);
    expect(kit.hands.drawn).toHaveLength(0);
    expect(props().every((m) => m.isEnabled())).toBe(true);
  });

  it("keeps the procedural forearm without a model (`?models=off`)", () => {
    const { kit, rig, settle, props } = setup();
    kit.arm(1, rig, "hero", armed("pistol"));
    kit.setViewArms(undefined);
    settle();
    expect(kit.hands.drawn).toHaveLength(0);
    expect(props().every((m) => m.isEnabled())).toBe(true);
  });

  it.each(["pistol", "rifle", "shotgun", "smg", "baton"] as const)("%s: the weapon stays fixed in the right hand's bone through hip, aim, reload and the walk", async (look) => {
    const { kit, rig, settle, camera, library } = setup();
    await library.preload(heroine);
    kit.arm(1, rig, "hero", armed(look));
    kit.setViewArms(heroine);
    await ready(kit, settle);
    const hand = kit.hands.handBone("r")!;
    const holder = look === "baton" ? camera.meleeMount : camera.weaponMount;
    const grip = () => inFrame(hand, holder.computeWorldMatrix(true).getTranslation());
    settle();
    const hip = grip();
    if (look === "pistol") {
      // The bones land on the pose: the wrist where the pose puts it, the knuckles the way its fingers point.
      const wrist = inFrame(holder, hand.getAbsolutePosition());
      expect(Vector3.Distance(wrist, new Vector3(0.034, -0.028, -0.075))).toBeLessThan(0.003);
      const knuckle = hand.getChildren((n) => /Middle1$/.test(n.name), false)[0] as TransformNode;
      const fingers = inFrame(holder, knuckle.getAbsolutePosition()).subtract(wrist).normalize();
      expect(Vector3.Dot(fingers, new Vector3(-0.12, 0.22, 1).normalize())).toBeGreaterThan(0.999);
    }
    // The grip sits in the palm: a few centimetres from the wrist bone, not across the view.
    expect(hip.length()).toBeLessThan(0.12);
    settle({ ...standing, aim: 1 });
    expect(Vector3.Distance(grip(), hip)).toBeLessThan(0.002);
    camera.startReload(1);
    settle(standing, 0.5);
    expect(Vector3.Distance(grip(), hip)).toBeLessThan(0.002);
    settle({ ...standing, speed: 3 }, 0.7);
    expect(Vector3.Distance(grip(), hip)).toBeLessThan(0.002);
  }, 60_000);

  it("puts the left hand under a long gun's fore-end and by the right fist with a pistol", async () => {
    const { kit, rig, settle, camera, library } = setup();
    await library.preload(heroine);
    kit.arm(1, rig, "hero", armed("rifle"));
    kit.setViewArms(heroine);
    await ready(kit, settle);
    const gunFrame = () => camera.weaponMount.computeWorldMatrix(true).clone().invert();
    const left = () => Vector3.TransformCoordinates(kit.hands.handBone("l")!.getAbsolutePosition(), gunFrame());
    settle();
    // The rifle's fore-end lies about 0.2 m ahead of the grip.
    expect(left().z).toBeGreaterThan(0.08);
    kit.arm(1, rig, "hero", armed("pistol"));
    settle();
    const l = left();
    expect(Math.hypot(l.x, l.y, l.z)).toBeLessThan(0.15);
  }, 60_000);
});
