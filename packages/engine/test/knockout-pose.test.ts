import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import type { Transform } from "@seki/core";
import { describe, expect, it } from "vitest";
import { Scene, type TransformNode, Vector3 } from "../src/babylon";
import type { CameraRig } from "../src/camera/camera-rig";
import type { MoonShadow } from "../src/npr/moon-shadow";
import { ToonMaterials } from "../src/npr/toon-material";
import { CharacterViews } from "../src/renderer/character-views";

/** G-449: a body knocked out in a takedown (ADR-0065) lies down, stays down, gets up and hangs over the shoulder. */

const HEROINE = 1;
const GUARD = 2;
const at = (x: number, z: number, more: Partial<Transform> = {}): Transform => ({ position: { x, y: 0, z }, yaw: 0, pitch: 0, speed: 0, ...more });
const OUT = { unconscious: true } as const;

const setup = () => {
  const scene = new Scene(new NullEngine());
  const views = new CharacterViews({
    scene,
    materials: new ToonMaterials(scene),
    shadow: { addCaster: () => undefined } as unknown as MoonShadow,
    camera: { camera: { position: new Vector3(3, 1.6, 3) } } as unknown as CameraRig,
    cameraTarget: () => HEROINE,
    lift: () => 0,
  });
  views.spawn(HEROINE, { kind: "heroine" }, at(0, 0));
  views.spawn(GUARD, { kind: "enemy", preset: "corpo" }, at(0, 1.2));
  return { views };
};

const run = (views: CharacterViews, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 60) views.update(1 / 60);
};

/** World position of a joint, its parents computed first. */
const world = (node: TransformNode): Vector3 => {
  const chain: TransformNode[] = [];
  for (let n: TransformNode | null = node; n; n = n.parent as TransformNode | null) chain.unshift(n);
  for (const n of chain) n.computeWorldMatrix(true);
  return Vector3.TransformCoordinates(Vector3.Zero(), node.getWorldMatrix());
};

const rig = (views: CharacterViews, id: number) => views.rigOf(id)!;

describe("a knocked-out body (G-449)", () => {
  it("slumps down where it stood and lies there, without sinking out of view", () => {
    const { views } = setup();
    run(views, 0.5);
    expect(world(rig(views, GUARD).head).y).toBeGreaterThan(1.4);
    views.move(GUARD, at(0, 1.2, OUT));
    run(views, 1.5);
    const head = world(rig(views, GUARD).head);
    expect(head.y).toBeLessThan(0.45);
    expect(head.y).toBeGreaterThan(0);
    const hips = world(rig(views, GUARD).legL);
    expect(Math.hypot(hips.x, hips.z - 1.2)).toBeLessThan(0.35);
    run(views, 30);
    expect(world(rig(views, GUARD).head).y).toBeCloseTo(head.y, 3);
  });

  it("lies with the knees together when knocked out in a crouch (G-512)", () => {
    const { views } = setup();
    views.move(GUARD, at(0, 1.2, { crouch: 1 }));
    run(views, 1);
    expect(Math.abs(rig(views, GUARD).legL.rotation.z)).toBeGreaterThan(0.05);
    views.move(GUARD, at(0, 1.2, { ...OUT, crouch: 1 }));
    run(views, 2);
    expect(rig(views, GUARD).legL.rotation.z).toBeCloseTo(0, 5);
    expect(rig(views, GUARD).legR.rotation.z).toBeCloseTo(0, 5);
  });

  it("gets back on its feet when woken", () => {
    const { views } = setup();
    views.move(GUARD, at(0, 1.2, OUT));
    run(views, 2);
    views.move(GUARD, at(0, 1.2));
    run(views, 2);
    expect(world(rig(views, GUARD).head).y).toBeGreaterThan(1.4);
    expect(rig(views, GUARD).body.rotation.x).toBeLessThan(0.3);
  });

  it("hangs over the carrier's shoulder while carried, hidden with her in first person, and lies again put down", () => {
    const { views } = setup();
    views.move(GUARD, at(0, 1.2, OUT));
    run(views, 2);
    views.move(GUARD, at(0, 0, OUT));
    run(views, 1);
    const shoulder = world(rig(views, HEROINE).armL);
    const hips = world(rig(views, GUARD).legL);
    expect(Vector3.Distance(hips, shoulder)).toBeLessThan(0.3);
    const head = world(rig(views, GUARD).head);
    // Head down behind her back, the legs down in front.
    expect(head.y).toBeLessThan(shoulder.y - 0.4);
    expect(head.z).toBeLessThan(-0.2);
    expect(world(rig(views, GUARD).kneeL).z).toBeGreaterThan(0.1);
    views.setBodyVisible(HEROINE, false);
    run(views, 0.1);
    expect(rig(views, GUARD).root.isEnabled(false)).toBe(false);
    views.setBodyVisible(HEROINE, true);
    views.move(GUARD, at(0, 0.7, OUT));
    run(views, 1);
    expect(rig(views, GUARD).root.isEnabled(false)).toBe(true);
    expect(world(rig(views, GUARD).head).y).toBeLessThan(0.45);
  });

  it("comes in lying when it streams in knocked out, and goes without a death fall when hidden away", () => {
    const { views } = setup();
    views.spawn(3, { kind: "enemy", preset: "ganger" }, at(2, 0, OUT));
    run(views, 1 / 60);
    expect(world(rig(views, 3).head).y).toBeLessThan(0.45);
    const body = rig(views, 3);
    views.despawn(3, true);
    expect(body.root.isDisposed()).toBe(true);
  });
});
