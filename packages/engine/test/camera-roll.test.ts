import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { type Transform, directionFromAngles } from "@seki/core";
import { describe, expect, it } from "vitest";
import { Scene, Vector3 } from "../src/babylon";
import { CameraRig } from "../src/camera/camera-rig";
import { ToonMaterials } from "../src/npr/toon-material";

const rigOn = () => {
  const scene = new Scene(new NullEngine({ renderWidth: 1280, renderHeight: 720, textureSize: 256, deterministicLockstep: false, lockstepMaxSteps: 1 }));
  return new CameraRig(scene, new ToonMaterials(scene), () => false);
};

/** The camera's axes in the world, read from the view matrix the frame is drawn with. */
const axes = (rig: CameraRig) => {
  const world = rig.camera.getViewMatrix(true).clone().invert();
  const axis = (x: number, y: number, z: number) => Vector3.TransformNormal(new Vector3(x, y, z), world).normalize();
  return { right: axis(1, 0, 0), up: axis(0, 1, 0), forward: axis(0, 0, 1) };
};

/** Steady view: no roll (the right axis stays level), the right way up, looking along the aim. */
const expectLevel = (rig: CameraRig, t: Transform, what: string) => {
  const { right, up, forward } = axes(rig);
  const aim = directionFromAngles(t.yaw, t.pitch);
  expect(Math.abs(right.y), `${what}: roll`).toBeLessThan(1e-3);
  expect(up.y, `${what}: up`).toBeGreaterThan(0);
  expect(forward.x * aim.x + forward.y * aim.y + forward.z * aim.z, `${what}: aim`).toBeGreaterThan(0.9999);
};

/** Frames as the game draws them: the rig moves the camera, then the scene renders through it. */
const run = (rig: CameraRig, t: Transform, seconds: number) => {
  for (let s = 0; s < seconds; s += 0.05) {
    rig.update(t, 0.05);
    rig.camera.getScene().render();
  }
};

/** A metro ride: the seated reference view with the car's roll added after the rig, as `MetroRide` does. */
const ride = (rig: CameraRig, t: Transform) => {
  rig.setReferenceView({ x: 0, y: 2, z: -5 }, { x: 1, y: 0, z: 3 });
  for (let i = 0; i < 20; i++) {
    rig.update(t, 0.05);
    rig.camera.rotation.z += 0.02 * Math.sin(i);
    rig.camera.getScene().render();
  }
  rig.setReferenceView(null);
};

describe("camera roll (G-279)", () => {
  it("stays level when the view turns after a hit shake taken while looking up or down", () => {
    const rig = rigOn();
    for (const pitch of [0.9, -1.1]) {
      const t: Transform = { position: { x: 3, y: 0, z: -2 }, yaw: 0.4, pitch, speed: 0 };
      run(rig, t, 0.5);
      rig.shake(0.8);
      // The shake rolls the view a little while it lasts (only on the move), then it is gone.
      run(rig, { ...t, speed: 3 }, 0.1);
      expect(Math.abs(axes(rig).right.y)).toBeGreaterThan(1e-4);
      run(rig, { ...t, speed: 3 }, 1);
      run(rig, t, 0.5);
      expectLevel(rig, t, `after the shake, pitch ${pitch}`);
      for (const yaw of [1.2, 2.6, -2, 7.5]) {
        const turned = { ...t, yaw };
        run(rig, turned, 0.1);
        expectLevel(rig, turned, `turned to ${yaw}, pitch ${pitch}`);
      }
    }
  });

  it("stays level through mode switches, aim, sprint and a fixed reference view", () => {
    const rig = rigOn();
    const t: Transform = { position: { x: 0, y: 0, z: 0 }, yaw: -0.7, pitch: 0.6, speed: 0 };
    const steps: [string, () => Transform][] = [
      ["TPP", () => (rig.setMode("TPP"), t)],
      ["shake in TPP on the move", () => (rig.shake(1), run(rig, { ...t, speed: 3 }, 0.5), t)],
      ["aim", () => ({ ...t, aim: 1, aimZoom: 0.6, yaw: 0.9 })],
      ["sprint", () => ({ ...t, speed: 7, yaw: 2.1, pitch: -0.4 })],
      ["FPP", () => (rig.setMode("FPP"), { ...t, yaw: -2.5, pitch: 1.2 })],
      ["metro ride and back", () => (ride(rig, t), { ...t, yaw: 3 })],
      ["turn after the ride", () => ({ ...t, yaw: 4.4, pitch: -0.9 })],
    ];
    for (const [what, act] of steps) {
      const now = act();
      run(rig, now, 1.5);
      expectLevel(rig, now, what);
    }
  });
});
