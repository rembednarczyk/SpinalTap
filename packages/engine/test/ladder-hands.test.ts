import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import type { Transform } from "@seki/core";
import { describe, expect, it } from "vitest";
import { Scene } from "../src/babylon";
import { CameraRig } from "../src/camera/camera-rig";
import { ToonMaterials } from "../src/npr/toon-material";
import { animateRig, buildHeroine } from "../src/renderer/characters";

/** Seconds of frames at 60 Hz, on a ladder (climbing at `climb` m/s) or off it. */
const frames = (seconds: number, frame: (dt: number) => void): void => {
  for (let t = 0; t < seconds; t += 1 / 60) frame(1 / 60);
};

describe("both hands on the ladder (ADR-0021)", () => {
  it("the heroine puts the pistol away for the climb and draws it again at the top", () => {
    const scene = new Scene(new NullEngine());
    const rig = buildHeroine(scene, new ToonMaterials(scene), "h");
    frames(0.5, (dt) => animateRig(rig, 0, dt));
    expect(rig.gunHand!.scaling.x).toBe(1);
    // Before: the pistol stayed in her right hand on the rungs.
    frames(1, (dt) => animateRig(rig, 0, dt, 0, {}, { climb: 2.2 }));
    expect(rig.gunHand!.scaling.x).toBe(0);
    expect(rig.gunHip!.scaling.x).toBe(1);
    // Still drawn as far as the game goes: off the ladder it comes back into the hand.
    expect(rig.drawTarget).toBe(true);
    frames(1, (dt) => animateRig(rig, 0, dt));
    expect(rig.gunHand!.scaling.x).toBe(1);
  });

  it("the FPP weapon drops out of view on the ladder and comes back off it", () => {
    const scene = new Scene(new NullEngine());
    const camera = new CameraRig(scene, new ToonMaterials(scene), () => false);
    camera.setMode("FPP");
    const standing: Transform = { position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, speed: 0 };
    frames(0.5, (dt) => camera.update(standing, dt));
    expect(camera.weaponMount.isEnabled()).toBe(true);
    frames(1, (dt) => camera.update({ ...standing, climb: 2.2 }, dt));
    expect(camera.weaponMount.isEnabled()).toBe(false);
    frames(1, (dt) => camera.update(standing, dt));
    expect(camera.weaponMount.isEnabled()).toBe(true);
  });
});
