import type { AppearanceDescriptor, Transform, WeaponLook } from "@seki/core";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { afterAll, describe, expect, it, vi } from "vitest";
import { type AbstractMesh, Scene, type TransformNode, Vector3 } from "../src/babylon";
import { CameraRig } from "../src/camera/camera-rig";
import type { MoonShadow } from "../src/npr/moon-shadow";
import { ToonMaterials } from "../src/npr/toon-material";
import { CharacterKit } from "../src/renderer/character-kit";
import { buildHeroine } from "../src/renderer/characters";
import { type CharacterModelManifest, ModelLibrary } from "../src/renderer/model-library";
import { disposeModelScenes, modelScene, readModelFile, serveModels } from "./game-models";
import { allWeaponUrls } from "./weapon-files";
import { weaponHands } from "../src/renderer/fpp-hand-poses";
import { VIEW_MELEE_TILT } from "../src/renderer/weapon-mount";

/**
 * Seki's own forearms and hands in first person (user's wish of 13.11): from her model file once
 * it is in, hidden in TPP, the procedural forearm without the model; the right hand holds the
 * weapon's grip whatever the viewmodel does, and the arms cost one mesh of under 5000 triangles.
 */

const manifest = JSON.parse(new TextDecoder().decode(readModelFile("manifest.json"))) as CharacterModelManifest;
const heroine = manifest.heroine!;

const isMelee = (look: WeaponLook) => look === "baton" || look === "blade";
const armed = (active: WeaponLook): AppearanceDescriptor => ({
  weapons: { primary: isMelee(active) ? "rifle" : active, secondary: "pistol", melee: active === "blade" ? "blade" : "baton", active: isMelee(active) ? "melee" : "primary" },
  garments: {},
  implants: [],
});

const standing: Transform = { position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, speed: 0 };

afterAll(disposeModelScenes);

/** The camera's frame drawn at `size` (a 16:9 desktop, a phone); the null engine's own otherwise. */
const sceneOf = (size?: readonly [number, number]): Scene =>
  size ? new Scene(new NullEngine({ renderWidth: size[0], renderHeight: size[1], textureSize: 256, deterministicLockstep: false, lockstepMaxSteps: 1 })) : modelScene();

const setup = (size?: readonly [number, number]) => {
  const real = globalThis.fetch;
  serveModels();
  const served = globalThis.fetch;
  const fetched: string[] = [];
  vi.stubGlobal("fetch", (url: string) => {
    fetched.push(url);
    // The weapon files come as data URLs.
    return url.startsWith("data:") ? real(url) : served(url);
  });
  const scene = sceneOf(size);
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

/** A bone under the hand by the end of its name, its world matrix fresh. */
const bone = (hand: TransformNode, name: string): TransformNode => {
  for (const n of hand.getDescendants(false) as TransformNode[]) n.computeWorldMatrix(true);
  return hand.getDescendants(false).find((n) => n.name.endsWith(name)) as TransformNode;
};

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

  it.each(["pistol", "revolver", "rifle", "shotgun", "smg", "baton", "blade"] as const)("%s: the weapon stays fixed in the right hand's bone through hip, aim, reload and the walk", async (look) => {
    const { kit, rig, settle, camera, library } = setup();
    await library.preload(heroine);
    kit.arm(1, rig, "hero", armed(look));
    kit.setViewArms(heroine);
    await ready(kit, settle);
    const hand = kit.hands.handBone("r")!;
    const holder = isMelee(look) ? camera.meleeMount : camera.weaponMount;
    const grip = () => inFrame(hand, holder.computeWorldMatrix(true).getTranslation());
    settle();
    const hip = grip();
    // The bones land on the pose: the wrist where it puts it, the knuckles the way its fingers point.
    const pose = weaponHands(look, { position: Vector3.Zero(), turn: (d) => d.clone() }).right;
    const wrist = inFrame(holder, hand.getAbsolutePosition());
    expect(Vector3.Distance(wrist, pose.wrist)).toBeLessThan(0.003);
    const fingers = inFrame(holder, bone(hand, "Middle1").getAbsolutePosition()).subtract(wrist).normalize();
    expect(Vector3.Dot(fingers, pose.fingers)).toBeGreaterThan(0.999);
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
  it.each([
    ["desktop", [1280, 720]],
    ["phone", [844, 390]],
  ] as const)("%s: the hands on the weapon stay in the frame: both fists round a pistol and on a rifle from the hip, the left on its fore-end aimed (the DMR's zoom too), the fists on a baton and a sword", async (_, size) => {
    const { kit, rig, settle, camera, library } = setup(size);
    await library.preload(heroine);
    kit.setViewArms(heroine);
    const both = ["r", "l"] as const;
    const hands = [
      ["pistol", 0.8, both, both],
      ["rifle", 0.55, both, ["l"]],
      ["rifle", 0.38, both, ["l"]],
      ["baton", 1, ["r"], []],
      ["blade", 1, both, []],
    ] as const;
    for (const [look, zoom, hip, aimed] of hands) {
      kit.arm(1, rig, "hero", armed(look));
      await ready(kit, settle);
      for (const [aim, sides] of [[0, hip], [1, aimed]] as const) {
        settle({ ...standing, aim, aimZoom: zoom });
        const inv = camera.camera.getWorldMatrix().clone().invert();
        const tan = Math.tan(camera.camera.fov / 2);
        for (const side of sides) {
          const hand = kit.hands.handBone(side)!;
          // The rifle from the hip, its butt on the shoulder: the right fist's knuckles show, its little finger may go under the frame.
          for (const n of look === "rifle" && aim === 0 && side === "r" ? ["Middle1"] : ["Middle1", "Little1", "Little2"]) {
            const p = Vector3.TransformCoordinates(bone(hand, n).getAbsolutePosition(), inv);
            expect(p.y / p.z, `${look} ${zoom} aim ${aim}: ${side} ${n} under the frame`).toBeGreaterThan(-tan);
            expect(Math.abs(p.x / p.z), `${look} ${zoom} aim ${aim}: ${side} ${n} beside the frame`).toBeLessThan(tan * (size[0] / size[1]));
          }
        }
        // Only the forearms are drawn: where they end, at the elbows, stays out of the frame (the guns).
        for (const side of isMelee(look) ? [] : (["r", "l"] as const)) {
          const elbow = Vector3.TransformCoordinates((kit.hands.handBone(side)!.parent as TransformNode).getAbsolutePosition(), inv);
          const out = elbow.z <= 0 || elbow.y / elbow.z < -tan * 1.05 || Math.abs(elbow.x / elbow.z) > tan * (size[0] / size[1]) * 1.05;
          expect(out, `${look} ${zoom} aim ${aim}: ${side} elbow in the frame`).toBe(true);
        }
      }
    }
  }, 120_000);

  it("rifle from the hip: the barrel ahead, the grip low on the right, the butt out under the frame's right corner towards the shoulder", async () => {
    const { kit, rig, settle, camera, library } = setup([1280, 720]);
    await library.preload(heroine);
    kit.setViewArms(heroine);
    kit.arm(1, rig, "hero", armed("rifle"));
    await ready(kit, settle);
    settle();
    const mount = camera.weaponMount.computeWorldMatrix(true);
    const inv = camera.camera.getWorldMatrix().clone().invert();
    const at = (x: number, y: number, z: number) => Vector3.TransformCoordinates(Vector3.TransformCoordinates(new Vector3(x, y, z), mount), inv);
    const barrel = at(0, 0, 1).subtract(at(0, 0, 0)).normalize();
    // Ahead, turned a little in towards the view's centre: the eye looks along it, not at its side.
    expect(barrel.z).toBeGreaterThan(0.99);
    expect(barrel.x).toBeLessThanOrEqual(0);
    const tan = Math.tan(camera.camera.fov / 2);
    const grip = at(0, 0, 0);
    expect(grip.x).toBeGreaterThan(0.1);
    expect(grip.y / grip.z).toBeLessThan(-0.5 * tan);
    // The butt (0.27 m behind the grip) leaves the frame low on the right; the sights stay under the crosshair's line.
    const butt = at(0, 0.05, -0.27);
    expect(butt.y / butt.z).toBeLessThan(-tan);
    expect(butt.x).toBeGreaterThan(0.1);
    const sight = at(0, 0.17, 0.45);
    expect(sight.y / sight.z).toBeLessThan(0.05 * tan);
    // The butt on the collarbone (round 4): close by the eye from the hip and aimed.
    expect(butt.z).toBeLessThan(0.12);
    settle({ ...standing, aim: 1, aimZoom: 0.55 });
    camera.weaponMount.computeWorldMatrix(true);
    const aimedInv = camera.camera.getWorldMatrix().clone().invert();
    const aimedButt = Vector3.TransformCoordinates(Vector3.TransformCoordinates(new Vector3(0, 0.05, -0.27), camera.weaponMount.getWorldMatrix()), aimedInv);
    expect(aimedButt.z).toBeLessThan(0.12);
  }, 60_000);

  it("draws the weapon and the hands with their own field of view: aimed with the DMR's zoom (0.38) the weapon is as big on the screen as with no zoom, its sights over 3 degrees under the crosshair in the world", async () => {
    const { kit, rig, settle, camera, library } = setup([1280, 720]);
    await library.preload(heroine);
    kit.setViewArms(heroine);
    kit.arm(1, rig, "hero", armed("rifle"));
    await ready(kit, settle);
    const view = (zoom: number) => {
      settle({ ...standing, aim: 1, aimZoom: zoom });
      const inv = camera.camera.getWorldMatrix().clone().invert();
      const tan = Math.tan(camera.camera.fov / 2);
      const mount = camera.weaponMount.computeWorldMatrix(true);
      const at = (x: number, y: number, z: number) => Vector3.TransformCoordinates(Vector3.TransformCoordinates(new Vector3(x, y, z), mount), inv);
      const screen = (p: Vector3) => new Vector3(p.x / p.z / tan, p.y / p.z / tan, 0);
      // The grip to the muzzle on the screen, and the front sight's angle under the crosshair (the camera's frame is the world's).
      const sight = at(0, 0.17, 0.45);
      return { size: Vector3.Distance(screen(at(0, 0, 0)), screen(at(0, 0.096, 0.53))), sight: Math.atan2(sight.y, sight.z) };
    };
    const plain = view(1);
    const zoomed = view(0.38);
    // Not smaller (lower on the screen, its perspective stretches it a little).
    expect(zoomed.size / plain.size).toBeGreaterThan(0.97);
    expect(zoomed.size / plain.size).toBeLessThan(1.4);
    // The sights stay over 3 degrees under the crosshair in the world (G-275), zoomed in too.
    expect(plain.sight).toBeLessThan(-(3 * Math.PI) / 180);
    expect(zoomed.sight).toBeLessThan(-(3 * Math.PI) / 180);
    // The world's view does zoom.
    expect(camera.lookScale).toBeLessThan(0.45);
  }, 60_000);

  it("holds a pistol deep: web high on the backstrap, fingers round the front, index along the frame, thumb on the left", async () => {
    const { kit, rig, settle, camera, library } = setup();
    await library.preload(heroine);
    kit.arm(1, rig, "hero", armed("pistol"));
    kit.setViewArms(heroine);
    await ready(kit, settle);
    settle();
    const hand = kit.hands.handBone("r")!;
    const at = (n: string) => inFrame(camera.weaponMount, bone(hand, n).getAbsolutePosition());
    // The web between thumb and index sits high, under the slide (0.05 m over the grip point), not under the grip.
    expect(at("Index1").y).toBeGreaterThan(0.015);
    expect(at("Index1").y).toBeLessThan(0.06);
    expect(at("Middle3_end").x).toBeLessThan(0);
    expect(at("Index3_end").z).toBeGreaterThan(0.06);
    expect(at("Thumb3_end").x).toBeLessThan(-0.012);
    // A firm grip in both hands (round 4): the right fingers tight round the grip's front, the left's
    // closed hard over them.
    expect(at("Middle3_end").length()).toBeLessThan(0.045);
    const left = kit.hands.handBone("l")!;
    const leftTip = inFrame(camera.weaponMount, bone(left, "Middle3_end").getAbsolutePosition());
    expect(leftTip.x, "the left fingertips round on the grip's right side").toBeGreaterThan(0.01);
    const leftMiddle = inFrame(camera.weaponMount, bone(left, "Middle2").getAbsolutePosition());
    expect(Vector3.Distance(leftMiddle, at("Middle2")), `${leftMiddle} ${at("Middle2")}`).toBeLessThan(0.03);
  }, 60_000);

  it.each(["baton", "blade"] as const)("%s: a hammer grip: a full fist on the handle, the index side towards the tip", async (look) => {
    const { kit, rig, settle, camera, library } = setup();
    await library.preload(heroine);
    kit.arm(1, rig, "hero", armed(look));
    kit.setViewArms(heroine);
    await ready(kit, settle);
    settle();
    const handle = new Vector3(0, Math.cos(VIEW_MELEE_TILT), Math.sin(VIEW_MELEE_TILT));
    // The sword takes both hands on its long handle, the baton one.
    for (const side of look === "blade" ? (["r", "l"] as const) : (["r"] as const)) {
      const hand = kit.hands.handBone(side)!;
      const at = (n: string) => inFrame(camera.meleeMount, bone(hand, n).getAbsolutePosition());
      expect(Vector3.Dot(at("Index1").subtract(at("Little1")).normalize(), handle), `${side} knuckles`).toBeGreaterThan(0.8);
      expect(at("Middle1").length(), `${side} on the handle`).toBeLessThan(0.16);
    }
    // At the ready (round 4): the weapon upright, a little back over the shoulder, not ahead; the fist low in the frame.
    const mount = camera.meleeMount.computeWorldMatrix(true);
    const inv = camera.camera.getWorldMatrix().clone().invert();
    const up = Vector3.TransformNormal(Vector3.TransformNormal(handle, mount), inv).normalize();
    expect(up.y).toBeGreaterThan(0.95);
    expect(up.z).toBeLessThanOrEqual(0);
    const fist = Vector3.TransformCoordinates(kit.hands.handBone(look === "blade" ? "l" : "r")!.getAbsolutePosition(), inv);
    expect(fist.y / fist.z).toBeLessThan(-0.5 * Math.tan(camera.camera.fov / 2));
  }, 60_000);
});
