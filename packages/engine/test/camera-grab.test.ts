import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import type { Transform } from "@seki/core";
import { eyeHeightAt } from "@seki/sim";
import { describe, expect, it } from "vitest";
import { Scene } from "../src/babylon";
import { CameraRig } from "../src/camera/camera-rig";
import { ToonMaterials } from "../src/npr/toon-material";

/**
 * The FPP camera in a takedown grab and with a body on the shoulder (ADR-0075 stage 2, G-459):
 * the weapon viewmodel goes away, the forearms on the target's neck come up in a grab, the eye
 * stands up beside the target's head and goes down with the choke, and all of it comes back after.
 */

const setup = () => {
  const scene = new Scene(new NullEngine());
  const rig = new CameraRig(scene, new ToonMaterials(scene), () => false);
  const node = (name: string) => scene.getTransformNodeByName(name)!;
  return { rig, viewmodel: () => node("viewmodel").isEnabled(false), arms: () => node("vm-choke").isEnabled(false) };
};

/** Sneaking up crouched, facing +Z (her left is −X). */
const crouched: Transform = { position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, speed: 0, crouch: 1 };

const settle = (rig: CameraRig, target: Transform, seconds = 1) => {
  for (let t = 0; t < seconds; t += 0.05) rig.update(target, 0.05);
};

describe("the FPP camera in a grab and carrying (ADR-0075, G-459)", () => {
  it("puts the weapon away with a body on the shoulder and brings it back after", () => {
    const { rig, viewmodel, arms } = setup();
    settle(rig, crouched);
    expect(viewmodel()).toBe(true);
    rig.handsBusy = true;
    settle(rig, crouched);
    expect(viewmodel()).toBe(false);
    expect(arms()).toBe(false);
    rig.handsBusy = false;
    settle(rig, crouched);
    expect(viewmodel()).toBe(true);
  });

  it("in a grab shows the forearms instead of the weapon, the eye up and 0.16 m to her left, down with the choke", () => {
    const { rig, viewmodel, arms } = setup();
    settle(rig, crouched);
    const low = rig.camera.position.y;
    expect(low).toBeCloseTo(eyeHeightAt(1), 3);
    settle(rig, { ...crouched, grab: "hold" });
    expect(viewmodel()).toBe(false);
    expect(arms()).toBe(true);
    expect(rig.camera.position.x).toBeCloseTo(-0.16, 3);
    const up = rig.camera.position.y;
    expect(up).toBeCloseTo(eyeHeightAt(0), 3);
    settle(rig, { ...crouched, grab: "choke" }, 1.5);
    expect(rig.camera.position.y).toBeLessThan(up - 0.1);
    settle(rig, crouched);
    expect(arms()).toBe(false);
    expect(viewmodel()).toBe(true);
    expect(rig.camera.position.x).toBeCloseTo(0, 6);
    expect(rig.camera.position.y).toBeCloseTo(low, 3);
  });
});
