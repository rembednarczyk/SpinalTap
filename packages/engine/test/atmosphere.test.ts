import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { FreeCamera, Scene, Vector3 } from "../src/babylon";
import { NIGHT_RIG } from "../src/npr/lighting";
import { Atmosphere, SKY_DIAMETER } from "../src/renderer/atmosphere";

describe("sky dome", () => {
  it("follows the camera, so its far side never falls behind the far plane (dark disc at the market)", () => {
    const scene = new Scene(new NullEngine());
    const camera = new FreeCamera("cam", new Vector3(0, 1.6, 0), scene);
    camera.maxZ = 320;
    const atmosphere = new Atmosphere(scene, NIGHT_RIG);
    const sky = atmosphere.skyMesh!;
    expect(sky.isWorldMatrixFrozen).toBe(false);
    // The overpass deck over the market, a hundred metres from where the game starts.
    camera.position.set(98.5, 11.6, 92);
    scene.render();
    const centre = sky.getAbsolutePosition();
    expect(Vector3.Distance(centre, camera.position)).toBeLessThan(0.01);
    expect(SKY_DIAMETER / 2).toBeLessThan(camera.maxZ);
    scene.dispose();
  });
});
