import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import type { AppearanceDescriptor, GrabPhase, Transform } from "@seki/core";
import { describe, expect, it } from "vitest";
import { Scene, type TransformNode, Vector3 } from "../src/babylon";
import type { CameraRig } from "../src/camera/camera-rig";
import type { MoonShadow } from "../src/npr/moon-shadow";
import { ToonMaterials } from "../src/npr/toon-material";
import { CharacterViews } from "../src/renderer/character-views";
import { buildCorpo, buildHeroine } from "../src/renderer/characters";
import { CHOKE_TIME, GRAB_PULL, KILL_TIME, SNAP, heldPose, holderPose } from "../src/renderer/grab-pose";

/**
 * The takedown grab's clips (ADR-0075 stage 2): the poses per phase as pure functions of the rig,
 * and played through the views from `Transform.grab`: the target pulled in front of the player,
 * her hands on its neck, the choke and the kill ending on its knees and lying where the
 * simulation has it, the weapon put away in the grab (G-459).
 */

const HEROINE = 1;
const GUARD = 2;
const at = (x: number, z: number, more: Partial<Transform> = {}): Transform => ({ position: { x, y: 0, z }, yaw: 0, pitch: 0, speed: 0, ...more });
const ARMED: AppearanceDescriptor = { weapons: { primary: null, secondary: "pistol", melee: null, active: "secondary" }, garments: {}, implants: [] };

const camera = () => ({ camera: { position: new Vector3(3, 1.6, 3) }, handsBusy: false, setHeldWeapon: () => undefined, setPlaceholders: () => undefined });

const setup = () => {
  const scene = new Scene(new NullEngine());
  const cam = camera();
  const views = new CharacterViews({
    scene,
    materials: new ToonMaterials(scene),
    shadow: { addCaster: () => undefined } as unknown as MoonShadow,
    camera: cam as unknown as CameraRig,
    cameraTarget: () => HEROINE,
    lift: () => 0,
  });
  // She sneaks up crouched; the guard stands 1.2 m ahead and a little to the side, its back to her.
  views.spawn(HEROINE, { kind: "heroine" }, at(0, 0, { crouch: 1 }));
  views.spawn(GUARD, { kind: "enemy", preset: "corpo" }, at(0.3, 1.2));
  views.setAppearance(HEROINE, ARMED);
  return { scene, views, cam };
};

const run = (views: CharacterViews, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 60) views.update(1 / 60);
};

/** Both in the grab's `phase` (or out of it), as the simulation's views would say. */
const grab = (views: CharacterViews, phase: GrabPhase | null, guard: Partial<Transform> = {}) => {
  views.move(HEROINE, at(0, 0, { crouch: 1, ...(phase ? { grab: phase } : {}) }));
  views.move(GUARD, at(0.3, 1.2, { ...(phase ? { grab: phase } : {}), ...guard }));
};

const world = (node: TransformNode): Vector3 => {
  const chain: TransformNode[] = [];
  for (let n: TransformNode | null = node; n; n = n.parent as TransformNode | null) chain.unshift(n);
  for (const n of chain) n.computeWorldMatrix(true);
  return Vector3.TransformCoordinates(Vector3.Zero(), node.getWorldMatrix());
};

const rig = (views: CharacterViews, id: number) => views.rigOf(id)!;

describe("the grab's poses (ADR-0075 stage 2)", () => {
  const scene = new Scene(new NullEngine());
  const materials = new ToonMaterials(scene);
  const held = buildCorpo(scene, materials, "held");
  const holder = buildHeroine(scene, materials, "holder");

  it("hold: the target leans back into her, chin up, the hands up at its throat; she stands up behind it", () => {
    const p = heldPose(held, "hold", 0.3);
    expect(p.pitch).toBeLessThan(0);
    expect(p.headX).toBeLessThan(-0.2);
    expect(p.elbowL).toBeLessThan(-1.5);
    expect(p.elbowR).toBeLessThan(-1.5);
    const h = holderPose(holder, "hold", 0.3);
    expect(h.y).toBe(0);
    expect(Math.abs(h.pitch)).toBeLessThan(0.15);
    // The struggle goes on as long as the grab waits.
    const kick = heldPose(held, "hold", 0.3).thighL;
    expect(heldPose(held, "hold", 0.5).thighL).not.toBeCloseTo(kick, 2);
  });

  it("choke: the struggle dies down and both go down, the target onto its knees, the head dropped", () => {
    // The poses are mixed into one object reused every frame: copied to compare.
    const start = { ...heldPose(held, "choke", 0) };
    const end = { ...heldPose(held, "choke", CHOKE_TIME) };
    expect(end.y).toBeLessThan(start.y - 0.3);
    expect(end.kneeL).toBeGreaterThan(1.3);
    expect(end.headX).toBeGreaterThan(0.4);
    const late = heldPose(held, "choke", CHOKE_TIME).thighL;
    expect(heldPose(held, "choke", CHOKE_TIME + 0.2).thighL).toBeCloseTo(late, 6);
    expect(holderPose(holder, "choke", CHOKE_TIME).y).toBeLessThan(-0.2);
  });

  it("kill: the head goes round at the snap, the arms let go, and the body sags onto its knees", () => {
    const before = { ...heldPose(held, "kill", SNAP - 0.05) };
    const after = { ...heldPose(held, "kill", SNAP + 0.2) };
    expect(after.headY - before.headY).toBeGreaterThan(0.7);
    expect(after.elbowL).toBeGreaterThan(before.elbowL + 1);
    expect(heldPose(held, "kill", KILL_TIME).y).toBeLessThan(-0.3);
    // Her shoulders wrench round with the snap and come back.
    expect(holderPose(holder, "kill", SNAP + 0.08).yaw).toBeLessThan(-0.2);
    expect(Math.abs(holderPose(holder, "kill", KILL_TIME).yaw)).toBeLessThan(0.01);
  });
});

describe("the grab in the views (ADR-0075 stage 2)", () => {
  it("pulls the target in front of her, facing her way, with her right forearm on its throat and the left hand on its head", () => {
    const { views } = setup();
    run(views, 0.5);
    grab(views, "hold");
    run(views, 0.8);
    const g = rig(views, GUARD).root;
    expect(g.position.x).toBeCloseTo(0, 3);
    expect(g.position.z).toBeCloseTo(GRAB_PULL, 3);
    expect(g.rotation.y).toBeCloseTo(0, 3);
    const neck = world(rig(views, GUARD).head);
    expect(Vector3.Distance(world(rig(views, HEROINE).wristR), neck)).toBeLessThan(0.2);
    expect(Vector3.Distance(world(rig(views, HEROINE).wristL), neck)).toBeLessThan(0.25);
    // Up on her feet out of the crouch she came in.
    expect(world(rig(views, HEROINE).head).y).toBeGreaterThan(1.45);
  });

  it("chokes it down onto its knees, then lets it fall where the simulation has it, and lets go", () => {
    const { views } = setup();
    grab(views, "hold");
    run(views, 1);
    grab(views, "choke");
    run(views, CHOKE_TIME);
    const kneeling = world(rig(views, GUARD).head);
    expect(kneeling.y).toBeLessThan(1.35);
    expect(world(rig(views, GUARD).kneeL).y).toBeLessThan(0.2);
    expect(Vector3.Distance(world(rig(views, HEROINE).wristR), kneeling)).toBeLessThan(0.25);
    grab(views, null, { unconscious: true });
    run(views, 2);
    const root = rig(views, GUARD).root;
    expect(root.position.x).toBeCloseTo(0.3, 3);
    expect(root.position.z).toBeCloseTo(1.2, 3);
    expect(world(rig(views, GUARD).head).y).toBeLessThan(0.45);
    // She is back in her own crouch.
    expect(world(rig(views, HEROINE).head).y).toBeLessThan(1.3);
  });

  it("a grab run out (3 s) chokes it onto its knees and keeps it there however long the choke lasts (G-517)", () => {
    const { views } = setup();
    grab(views, "hold");
    run(views, 3);
    grab(views, "choke");
    const head = () => world(rig(views, GUARD).head).y;
    const knee = () => world(rig(views, GUARD).kneeL).y;
    // Quick Takedown ends the choke at 0.72 s: by then well on the way down (G-482).
    run(views, 0.72);
    expect(head()).toBeLessThan(1.45);
    run(views, CHOKE_TIME - 0.72);
    const kneeling = head();
    expect(kneeling).toBeLessThan(1.35);
    expect(knee()).toBeLessThan(0.15);
    // Held past the clip, the pose holds its end every frame: no getting up again.
    for (let t = 0; t < 3; t += 1 / 60) {
      views.update(1 / 60);
      expect(head()).toBeCloseTo(kneeling, 2);
      expect(knee()).toBeLessThan(0.15);
    }
    grab(views, null, { unconscious: true });
    run(views, 2);
    expect(head()).toBeLessThan(0.45);
  });

  it("kills: the head goes round at the snap, the body goes limp and lies as a corpse", () => {
    const { views } = setup();
    grab(views, "hold");
    run(views, 0.6);
    grab(views, "kill");
    run(views, SNAP - 0.1);
    const turned = () => rig(views, GUARD).head.rotation.y;
    expect(turned()).toBeLessThan(0.4);
    run(views, 0.3);
    expect(turned()).toBeGreaterThan(0.7);
    run(views, KILL_TIME - SNAP);
    grab(views, null, { unconscious: true });
    run(views, 2);
    expect(world(rig(views, GUARD).head).y).toBeLessThan(0.45);
    expect(rig(views, GUARD).root.position.z).toBeCloseTo(1.2, 3);
  });

  it("puts the weapon away in the grab and draws it again after (G-459)", () => {
    const { scene, views, cam } = setup();
    run(views, 1);
    const inHand = () => scene.transformNodes.filter((n) => n.name.startsWith("e1-hand-") && n.isEnabled()).length;
    expect(inHand()).toBe(1);
    grab(views, "hold");
    run(views, 0.6);
    expect(cam.handsBusy).toBe(true);
    expect(rig(views, HEROINE).drawn).toBe(0);
    expect(inHand()).toBe(0);
    grab(views, "kill");
    run(views, 0.5);
    expect(inHand()).toBe(0);
    grab(views, null, { unconscious: true });
    run(views, 1);
    expect(cam.handsBusy).toBe(false);
    expect(inHand()).toBe(1);
  });

  it("keeps the weapon away while she carries a body (G-459)", () => {
    const { scene, views, cam } = setup();
    views.move(GUARD, at(0.3, 1.2, { unconscious: true }));
    run(views, 2);
    const inHand = () => scene.transformNodes.filter((n) => n.name.startsWith("e1-hand-") && n.isEnabled()).length;
    expect(inHand()).toBe(1);
    // On her spot: on her shoulder.
    views.move(GUARD, at(0, 0, { unconscious: true }));
    run(views, 0.6);
    expect(cam.handsBusy).toBe(true);
    expect(inHand()).toBe(0);
    views.move(GUARD, at(0, 0.7, { unconscious: true }));
    run(views, 1);
    expect(cam.handsBusy).toBe(false);
    expect(inHand()).toBe(1);
  });
});
