import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { FreeCamera, Scene, Vector3 } from "../src/babylon";
import { NIGHT_RIG } from "../src/npr/lighting";
import { MoonShadow } from "../src/npr/moon-shadow";
import { SHADOW_EXTENTS, nextExtent } from "../src/npr/shadow-fit";

/** The phone of the report: 915x412 CSS px at DPR 2.75, rendered at 70 %. */
const phoneScene = (): Scene => new Scene(new NullEngine({ renderWidth: 1761, renderHeight: 793, textureSize: 512, deterministicLockstep: false, lockstepMaxSteps: 1 }));

/** The TPP camera over the player at `player`, `pitch` radians below the horizon, 2.2 m back. */
const tppCamera = (scene: Scene, player: Vector3, pitch: number): FreeCamera => {
  const pivot = player.add(new Vector3(0, 1.5, 0));
  const back = new Vector3(0, Math.sin(pitch), -Math.cos(pitch)).scale(2.2);
  const cam = new FreeCamera("view", pivot.add(back), scene);
  // 80 degrees across at the phone's 2.22:1 (the default horizontal FOV).
  cam.fov = 0.72;
  cam.setTarget(pivot);
  cam.getViewMatrix(true);
  return cam;
};

describe("moon shadow fitted to the view (report 14.11: jagged hard shadow)", () => {
  it("looking down at the player (pitch limit), one texel shrinks from 2.7 cm to 1.1 cm", () => {
    const scene = phoneScene();
    const shadow = new MoonShadow(scene, NIGHT_RIG, 28, 2048);
    const player = new Vector3(120, 4, -40);
    expect(shadow.texelMetres).toBeCloseTo(56 / 2048, 6);
    expect(shadow.update(player, tppCamera(scene, player, 1.25))).not.toBeNull();
    expect(shadow.texelMetres).toBeLessThanOrEqual(0.4 * (56 / 2048));
    expect(shadow.coverage).toBeGreaterThanOrEqual(2 * Math.min(...SHADOW_EXTENTS));
  });

  it("looking along the street, it keeps the whole range", () => {
    const scene = phoneScene();
    const shadow = new MoonShadow(scene, NIGHT_RIG, 28, 2048);
    const player = new Vector3(0, 0, 0);
    shadow.update(player, tppCamera(scene, player, 1.2));
    shadow.update(player, tppCamera(scene, player, 0.1));
    expect(shadow.coverage).toBe(56);
    // Without a view (the start behind the loading screen) too.
    shadow.update(player, tppCamera(scene, player, 1.2));
    shadow.update(player);
    expect(shadow.coverage).toBe(56);
  });

  it("covers every ground point the screen shows", () => {
    const scene = phoneScene();
    const shadow = new MoonShadow(scene, NIGHT_RIG, 28, 2048);
    const player = new Vector3(10, 0, 10);
    for (const pitch of [0.5, 0.7, 0.9, 1.2, 1.5]) {
      const cam = tppCamera(scene, player, pitch);
      const m = shadow.update(player, cam) ?? null;
      if (!m) continue;
      for (const [sx, sy] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) {
        const ray = scene.createPickingRay(((sx + 1) / 2) * 1761, ((sy + 1) / 2) * 793, null, cam);
        if (ray.direction.y >= 0) continue;
        const hit = ray.origin.add(ray.direction.scale(-ray.origin.y / ray.direction.y));
        if (hit.subtract(player).length() > 25) continue;
        const p = Vector3.TransformCoordinates(hit, m);
        expect(Math.abs(p.x), `pitch ${pitch}`).toBeLessThanOrEqual(1);
        expect(Math.abs(p.y), `pitch ${pitch}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("steps grow at once and shrink only well inside the smaller step", () => {
    expect(nextExtent(6, 9, 28)).toBe(11);
    expect(nextExtent(11, 7.5, 28)).toBe(11);
    expect(nextExtent(11, 6.5, 28)).toBe(8);
    expect(nextExtent(28, 3, 28)).toBe(6);
    expect(nextExtent(6, 40, 28)).toBe(28);
    // A smaller cap (another renderer) is the largest step.
    expect(nextExtent(10, 30, 12)).toBe(12);
  });
});
