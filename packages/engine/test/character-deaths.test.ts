import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { Scene, Vector3 } from "../src/babylon";
import type { CameraRig } from "../src/camera/camera-rig";
import type { MoonShadow } from "../src/npr/moon-shadow";
import { ToonMaterials } from "../src/npr/toon-material";
import { CharacterViews } from "../src/renderer/character-views";

const LIFT = 0.15;

const viewsOn = (scene: Scene) =>
  new CharacterViews({
    scene,
    materials: new ToonMaterials(scene),
    shadow: { addCaster: () => undefined } as unknown as MoonShadow,
    camera: { camera: { position: new Vector3(2, 4, 2) } } as unknown as CameraRig,
    cameraTarget: () => 1,
    lift: () => LIFT,
  });

describe("death fall on raised ground (G-457)", () => {
  it("lays the body on the terrain where the character died, not at y = 0", () => {
    for (const ground of [3, 0, -2]) {
      const views = viewsOn(new Scene(new NullEngine()));
      views.spawn(7, { kind: "enemy", preset: "ganger" }, { position: { x: 0, y: ground, z: 0 }, yaw: 0, pitch: 0, speed: 0 });
      for (let i = 0; i < 30; i++) views.update(0.1);
      const rig = views.rigOf(7)!;
      const standing = rig.root.position.y;
      expect(standing).toBeCloseTo(ground + LIFT, 3);
      views.despawn(7, true);
      for (let i = 0; i < 10; i++) views.update(0.1);
      // Fully fallen and lying still: the root rests 0.12 m above the ground it stood on.
      expect(rig.root.position.y).toBeCloseTo(standing + 0.12, 5);
    }
  });
});
