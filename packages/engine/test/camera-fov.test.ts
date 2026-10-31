import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { type Transform, degToRad, horizontalFovOf, radToDeg, verticalFov } from "@seki/core";
import { EYE_HEIGHT, TPP_HEIGHT_OFFSET, TPP_SHOULDER_OFFSET } from "@seki/sim";
import { describe, expect, it } from "vitest";
import { Scene } from "../src/babylon";
import { BASE_FOV, CameraRig, DEFAULT_HORIZONTAL_FOV } from "../src/camera/camera-rig";
import { ToonMaterials } from "../src/npr/toon-material";

/** A rig on a screen of the given size (the null engine reports its aspect from it). */
const rigOn = (width: number, height: number) => {
  const scene = new Scene(new NullEngine({ renderWidth: width, renderHeight: height, textureSize: 256, deterministicLockstep: false, lockstepMaxSteps: 1 }));
  return new CameraRig(scene, new ToonMaterials(scene), () => false);
};

const standing: Transform = { position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, speed: 0 };

const settle = (rig: CameraRig, target: Transform, seconds = 2) => {
  for (let t = 0; t < seconds; t += 0.05) rig.update(target, 0.05);
};

describe("camera field of view (ADR-0049)", () => {
  it("defaults to 80 degrees across a 16:9 screen, about 0.88 rad tall", () => {
    expect(radToDeg(DEFAULT_HORIZONTAL_FOV)).toBeCloseTo(80);
    expect(BASE_FOV).toBeCloseTo(0.882, 3);
    const rig = rigOn(1280, 720);
    settle(rig, standing);
    expect(rig.camera.fov).toBeCloseTo(BASE_FOV, 4);
    expect(rig.lookScale).toBeCloseTo(1);
  });

  it("keeps the horizontal angle on a phone held sideways instead of widening it", () => {
    const rig = rigOn(800, 370);
    settle(rig, standing);
    expect(radToDeg(horizontalFovOf(rig.camera.fov, 800 / 370))).toBeCloseTo(80, 4);
    // Before ADR-0049 the vertical 1.08 rad showed ~105 degrees across this screen.
    expect(radToDeg(horizontalFovOf(1.08, 800 / 370))).toBeGreaterThan(104);
  });

  it("follows the setting, and the screen's proportions in the reference view too", () => {
    const rig = rigOn(1280, 720);
    rig.horizontalFov = degToRad(100);
    settle(rig, standing);
    expect(rig.camera.fov).toBeCloseTo(verticalFov(degToRad(100), 16 / 9), 4);
    rig.horizontalFov = DEFAULT_HORIZONTAL_FOV;
    rig.setReferenceView({ x: 0, y: 2, z: -5 }, { x: 0, y: 1, z: 0 });
    rig.update(null, 0.05);
    expect(rig.camera.fov).toBeCloseTo(BASE_FOV, 4);
  });

  it("widens a little in a sprint and narrows by the weapon's zoom when aimed", () => {
    const rig = rigOn(1280, 720);
    settle(rig, { ...standing, speed: 7 });
    expect(rig.camera.fov).toBeCloseTo(BASE_FOV * 1.1, 3);
    settle(rig, { ...standing, aim: 1, aimZoom: 0.6 });
    expect(rig.camera.fov).toBeCloseTo(BASE_FOV * 0.6, 3);
    expect(rig.lookScale).toBeLessThan(0.7);
  });

  it("holds still with camera motion off: no walking bob, hit shake or sprint widening (gap audit, accessibility)", () => {
    const moving = (motion: boolean) => {
      const rig = rigOn(1280, 720);
      rig.cameraMotion = motion;
      const heights: number[] = [];
      for (let t = 0; t < 2; t += 0.05) {
        rig.shake(0.5);
        rig.update({ ...standing, speed: 7 }, 0.05);
        heights.push(rig.camera.position.y);
      }
      return { bob: Math.max(...heights) - Math.min(...heights), roll: Math.abs(rig.camera.rotation.z), fov: rig.camera.fov };
    };
    const on = moving(true);
    expect(on.bob).toBeGreaterThan(0.01);
    expect(on.roll).toBeGreaterThan(0);
    expect(on.fov).toBeGreaterThan(BASE_FOV * 1.05);
    const off = moving(false);
    expect(off.bob).toBeCloseTo(0, 6);
    expect(off.roll).toBe(0);
    expect(off.fov).toBeCloseTo(BASE_FOV, 4);
  });
});

describe("TPP camera (ADR-0049)", () => {
  it("sits 2.2 m behind the shoulder pivot, low over the right shoulder", () => {
    const rig = rigOn(1280, 720);
    rig.setMode("TPP");
    settle(rig, standing);
    const p = rig.camera.position;
    expect(p.z).toBeCloseTo(-2.2, 2);
    expect(p.x).toBeCloseTo(TPP_SHOULDER_OFFSET, 2);
    expect(p.y).toBeCloseTo(EYE_HEIGHT + TPP_HEIGHT_OFFSET, 2);
    // Below the top of a 1.8 m head: the camera looks past the shoulder, not down on the head.
    expect(p.y).toBeLessThan(1.7);
  });

  it("is still pulled in front of a building between the shoulder and the camera", () => {
    const rig = rigOn(1280, 720);
    rig.setMode("TPP");
    rig.setOccluder(() => 1);
    settle(rig, standing);
    expect(rig.camera.position.z).toBeCloseTo(-0.75, 2);
  });
});
