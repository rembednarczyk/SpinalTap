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
import { depthInside, skinVertices, trianglesIn } from "./mesh-depth";
import { VIEW_MELEE_TILT } from "../src/renderer/weapon-mount";
import { viewmodelPose } from "../src/camera/viewmodel-poses";

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

  it("puts the left hand under a long gun's fore-end", async () => {
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
      // A handgun in both fists, the left under the right, from the hip and aimed in (round 2, the user's choice).
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
          // The left hand cupping the pistol's fist from under (round 2): its knuckles show, its little finger may go under the frame.
          const knuckles = (look === "rifle" && aim === 0 && side === "r") || (look === "pistol" && side === "l");
          for (const n of knuckles ? ["Middle1"] : ["Middle1", "Little1", "Little2"]) {
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

  /**
   * The handgun grip the user chose out of seven rounds (13.11: round 2, commit e17dc2e; round 7's
   * one hand was "not even a right hand"): the right hand round the grip, the wrist behind and right
   * of it, the fingers closing round its front; the left hand under the right fist, cupping it; the
   * same from the hip and aimed in. Read off the bones and the skinned hand as drawn, in the gun's
   * frame (the grip at the origin, the barrel along +Z).
   */
  /** Round 2 on a 16:9 screen with the guns' aim zoom (e17dc2e, read off its poses): the grip on the screen and 10 cm up it, from the hip and aimed in. */
  const SCREEN = {
    pistol: { zoom: 0.8, at: [[0.683, -0.752, 0.342], [0, -0.652, 0.513]] },
    revolver: { zoom: 0.78, at: [[0.683, -0.752, 0.342], [0, -0.7, 0.434]] },
  } as const;
  /** Seated (14.11): aimed in, round 2's grip point this much lower than round 2 (the sights' line steeper) and the gun this much smaller (further out to keep the hands in the frame). */
  const DROP = { pistol: [0, 0.011], revolver: [0, 0.016] } as const;
  const SHRINK = { pistol: [1, 0.965], revolver: [1, 0.939] } as const;
  /** The right wrist and the way to its knuckles in the gun's frame (`HANDGUN_FIST`). */
  const WRIST = { pistol: new Vector3(0.041, -0.012, -0.056), revolver: new Vector3(0.0417, -0.0181, -0.0608) };
  const KNUCKLES = { pistol: new Vector3(-0.12, 0.22, 1), revolver: new Vector3(-0.0215, 0.1081, 1.025) };
  it.each(["pistol", "revolver"] as const)("%s: the user's chosen grip (round 2): the right fist round the grip, the left under it, from the hip and aimed in, the fingers outside the gun (G-770)", async (look) => {
    const { kit, rig, settle, camera, library } = setup([1280, 720]);
    await library.preload(heroine);
    kit.arm(1, rig, "hero", armed(look));
    kit.setViewArms(heroine);
    await ready(kit, settle);
    for (const aim of [0, 1]) {
      settle({ ...standing, aim, aimZoom: SCREEN[look].zoom });
      const when = `${look} aim ${aim}`;
      const mount = camera.weaponMount;
      // Where the grip shows on the screen (a share of the half height) as in round 2: low on the right from the hip, low in the middle aimed in.
      // And as big: 10 cm up the grip this much of the half height (not nearer, as round 4 drew the guns).
      const inv = camera.camera.getWorldMatrix().clone().invert();
      const tan = Math.tan(camera.camera.fov / 2);
      const onScreen = (p: Vector3) => {
        const c = Vector3.TransformCoordinates(Vector3.TransformCoordinates(p, mount.computeWorldMatrix(true)), inv);
        return new Vector3(c.x / c.z / tan, c.y / c.z / tan, 0);
      };
      const grip = onScreen(Vector3.Zero());
      const [sx, sy, size] = SCREEN[look].at[aim]!;
      // Seated (14.11): the gun 15 mm lower under the hands than round 2, from the hip and aimed in.
      // Round 2's grip point, 15 mm up the grip now, shows where round 2's grip showed from the hip;
      // aimed in the sights keep their angle, so it drops a little more (DROP).
      const held = onScreen(new Vector3(0, 0.015, 0));
      expect(held.x, `${when}: round 2's grip across the screen`).toBeCloseTo(sx, 2);
      expect(held.y, `${when}: round 2's grip up the screen`).toBeCloseTo(sy - DROP[look][aim]!, 2);
      expect(sy - grip.y, `${when}: the grip under round 2's`).toBeGreaterThan(0.04);
      expect(Vector3.Distance(onScreen(new Vector3(0, 0.1, 0)), grip), `${when}: the gun's size on the screen`).toBeCloseTo(size * SHRINK[look][aim]!, 2);
      const right = kit.hands.handBone("r")!;
      const wrist = inFrame(mount, right.getAbsolutePosition());
      expect(Vector3.Distance(wrist, WRIST[look]), `${when}: the right wrist`).toBeLessThan(0.003);
      const knuckles = inFrame(mount, bone(right, "Middle1").getAbsolutePosition()).subtract(wrist).normalize();
      expect(Vector3.Dot(knuckles, KNUCKLES[look].normalizeToNew()), `${when}: the right fingers`).toBeGreaterThan(0.999);
      // The left hand under the right fist, near the grip, not hanging out of the view.
      const left = inFrame(mount, kit.hands.handBone("l")!.getAbsolutePosition());
      expect(left.length(), `${when}: the left hand by the grip`).toBeLessThan(0.15);
      expect(left.y, `${when}: the left hand under the fist`).toBeLessThan(wrist.y);
      // The right hand as drawn, skinned. Its fingers, all their joints, no more than 2 mm inside
      // the gun (the seated test below, both hands); its palm ahead of the grip's back (the frame,
      // the trigger guard, the revolver's cylinder: G-770) no more than 2.5 mm (the pistol 2.3).
      // The thumb is the rigid fist's compromise: closed, its root sinks into the top of the grip
      // and the frame under the web, up to 12 mm (round 2: 11.7 behind the grip's front; seated,
      // 14.11, 2 cm further forward: pistol 9.3 ahead and 11.8 behind it, revolver 10.8 and 9.3);
      // laid straight to clear it, it stood up beside the slide. Behind, the fist no deeper than 13 mm.
      const gun = trianglesIn(mount.getChildMeshes(false), mount);
      expect(gun.length).toBeGreaterThan(1000);
      const skinOf = (bones: RegExp) => skinVertices(kit.hands.drawn[0]!, mount, (n) => bones.test(n));
      const deepest = (points: readonly Vector3[]) => Math.max(...points.map((p) => depthInside(gun, p)));
      const hand = skinOf(/_R_(Hand|Index\d|Middle\d|Ring\d|Little\d)$/);
      const thumb = skinOf(/_R_Thumb\d$/);
      expect(hand.length).toBeGreaterThan(500);
      const ahead = deepest(hand.filter((p) => p.z > 0));
      expect(ahead, `${when}: the hand ${(ahead * 1000).toFixed(1)} mm inside the gun ahead of the grip`).toBeLessThan(0.0025);
      const behind = deepest([...hand, ...thumb].filter((p) => p.z <= 0));
      expect(behind, `${when}: the hand ${(behind * 1000).toFixed(1)} mm inside the grip`).toBeLessThan(0.013);
      const root = deepest(thumb);
      expect(root, `${when}: the thumb ${(root * 1000).toFixed(1)} mm inside the gun`).toBeLessThan(0.012);
      // The fingers closed on the grip, not off it: their joints touch it (round 2: 2.7 to 4.1 mm in, seated 0 to 0.6).
      const touch = deepest(skinOf(/_R_(Index|Middle|Ring|Little)[23]$/));
      expect(touch, `${when}: the fingers ${(touch * 1000).toFixed(1)} mm into the grip`).toBeGreaterThan(-0.001);
      expect(touch, `${when}: the fingers ${(touch * 1000).toFixed(1)} mm into the grip`).toBeLessThan(0.002);
    }
  }, 60_000);

  /**
   * The user's wish of 14.11 ("lower, more in the fist"): the handguns hang 15 mm lower in the view
   * than round 2 (main before it: the pistol from the hip at y -0.22, aimed in -0.118; the revolver
   * aimed in -0.14), from the hip and aimed in, and the hands close as much higher up their grips
   * (round 2: the right wrist at y -0.028, the left -0.085 in the gun's frame), on a desktop and a phone.
   */
  it.each([
    ["pistol", [1280, 720]],
    ["revolver", [844, 390]],
  ] as const)("%s at %j: the gun 15 mm lower in the view and in both fists than round 2, from the hip and aimed in", async (look, size) => {
    const pose = viewmodelPose(look);
    expect(pose.hip.y - -0.22, "from the hip").toBeCloseTo(-0.015, 6);
    expect(pose.ads.y - (look === "pistol" ? -0.118 : -0.14), "aimed in").toBeCloseTo(-0.015, 6);
    const { kit, rig, settle, camera, library } = setup(size);
    await library.preload(heroine);
    kit.arm(1, rig, "hero", armed(look));
    kit.setViewArms(heroine);
    await ready(kit, settle);
    const at = (side: "r" | "l") => inFrame(camera.weaponMount, kit.hands.handBone(side)!.getAbsolutePosition());
    for (const aim of [0, 1]) {
      settle({ ...standing, aim });
      // The revolver's fist a little lower on its longer, rounder grip.
      expect(at("r").y - -0.028, `aim ${aim}: the right hand up the grip`).toBeGreaterThan(look === "pistol" ? 0.015 : 0.009);
      expect(at("l").y - -0.085, `aim ${aim}: the left hand up the grip`).toBeCloseTo(0.015, 3);
    }
  }, 60_000);

  /**
   * Round 2 of 14.11 (the user on PR #537: aimed in, "the pistol goes into the hand; seat it so it
   * does not clip"): no finger of either hand, any joint, more than 2 mm inside the gun, from the
   * hip and aimed in. At 07ee12a the right index finger sank 9.5 mm (the revolver 11.0), the left
   * one 11.3 mm (10.7), through the grip, and aimed in the grip showed across the fingers.
   */
  it.each(["pistol", "revolver"] as const)("%s: the gun seated in the fists, no finger through it, from the hip and aimed in", async (look) => {
    const { kit, rig, settle, camera, library } = setup([1280, 720]);
    await library.preload(heroine);
    kit.arm(1, rig, "hero", armed(look));
    kit.setViewArms(heroine);
    await ready(kit, settle);
    for (const aim of [0, 1]) {
      settle({ ...standing, aim, aimZoom: SCREEN[look].zoom });
      const mount = camera.weaponMount;
      const gun = trianglesIn(mount.getChildMeshes(false), mount);
      for (const side of ["R", "L"] as const) {
        for (const finger of ["Index", "Middle", "Ring", "Little"]) {
          const skin = skinVertices(kit.hands.drawn[0]!, mount, (n) => new RegExp(`_${side}_${finger}\\d$`).test(n));
          expect(skin.length).toBeGreaterThan(20);
          const depth = Math.max(...skin.map((p) => depthInside(gun, p)));
          expect(depth, `${look} aim ${aim}: ${side} ${finger} ${(depth * 1000).toFixed(1)} mm inside the gun`).toBeLessThan(0.002);
        }
      }
    }
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
