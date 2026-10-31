import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { Scene, Vector3 } from "../src/babylon";
import type { CameraRig } from "../src/camera/camera-rig";
import type { MoonShadow } from "../src/npr/moon-shadow";
import { ToonMaterials } from "../src/npr/toon-material";
import { CharacterViews } from "../src/renderer/character-views";

const STAND = { position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, speed: 0 };

/** Seki standing still after `frames` frames of `dt`, as the joints the picture shows. */
const poseAfter = (frames: number, dt: number, frozen: boolean): number[] => {
  const scene = new Scene(new NullEngine());
  const views = new CharacterViews({
    scene,
    materials: new ToonMaterials(scene),
    shadow: { addCaster: () => undefined } as unknown as MoonShadow,
    camera: { camera: { position: new Vector3(2, 1.6, 2) } } as unknown as CameraRig,
    cameraTarget: () => 1,
    lift: () => 0,
  });
  views.spawn(1, { kind: "heroine" }, STAND);
  for (let i = 0; i < frames; i++) views.update(dt, frozen);
  const rig = views.rigOf(1)!;
  return [rig.body, rig.head, rig.armL, rig.armR, rig.legL, rig.legR].flatMap((n) => [...n.position.asArray(), ...n.rotation.asArray()]);
};

describe("character clock in the reference still (G-030)", () => {
  it("poses an idle character the same however long the page took to get the still ready", () => {
    // Two loads of the reference frame: a quick one and a slow one, at different frame rates.
    const quick = poseAfter(40, 1 / 60, true);
    const slow = poseAfter(170, 1 / 23, true);
    slow.forEach((v, i) => expect(v, `joint value ${i}`).toBeCloseTo(quick[i]!, 9));
  });

  it("keeps breathing in play", () => {
    expect(poseAfter(40, 1 / 60, false)).not.toEqual(poseAfter(170, 1 / 23, false));
  });
});
