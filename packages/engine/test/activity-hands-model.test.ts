import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import type { ActivityId, Transform } from "@seki/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Scene, Vector3 } from "../src/babylon";
import type { CameraRig } from "../src/camera/camera-rig";
import type { MoonShadow } from "../src/npr/moon-shadow";
import { ToonMaterials } from "../src/npr/toon-material";
import { CharacterActivities } from "../src/renderer/character-activities";
import { type CharacterDescriptor, CharacterViews } from "../src/renderer/character-views";
import type { CharacterModelManifest } from "../src/renderer/model-library";
import { readModelFile, serveModels } from "./game-models";

/*
 * G-731: on the imported models the procedural activity poses put the hands up by the head (the
 * lean's both, the phone's free one), which reads as hands up. With the Mixamo clips (ADR-0090) a
 * figure leaning keeps both hands below its shoulders, and one on the phone the free hand too.
 */

const GAME = JSON.parse(new TextDecoder().decode(readModelFile("manifest.json"))) as CharacterModelManifest;
const STAND: Transform = { position: { x: 0, y: 0, z: 0 }, yaw: Math.PI, pitch: 0, speed: 0 };
afterEach(() => vi.unstubAllGlobals());

describe("activity hands on the models (G-731)", () => {
  it.each([
    ["lean", ["L", "R"]],
    ["phone", ["L"]],
  ] as const)("%s: the hands that hold nothing stay below the shoulders", async (activity: ActivityId, free) => {
    serveModels();
    const scene = new Scene(new NullEngine());
    const cam = new Vector3(0, 1.6, -4);
    const acts = new CharacterActivities(scene, new ToonMaterials(scene), () => cam);
    const views = new CharacterViews({
      scene,
      materials: new ToonMaterials(scene),
      shadow: { addCaster: () => undefined } as unknown as MoonShadow,
      camera: { camera: { position: cam }, handsBusy: false, setHeldWeapon: () => undefined, setPlaceholders: () => undefined } as unknown as CameraRig,
      cameraTarget: () => 999,
      lift: () => 0,
      pose: (id, rig, speed, dt, retarget, clock) => acts.apply(id, rig, speed, dt, retarget, clock),
    });
    views.setCharacterModels(GAME);
    // The two figures of the user's picture: a civilian on civilian.vrm and one on mori.vrm.
    const who = [
      [1, { kind: "npc", preset: "civilian", cast: "akane" }],
      [2, { kind: "npc", preset: "civilian", cast: "hana" }],
    ] as const;
    for (const [id, d] of who) {
      views.spawn(id, d as CharacterDescriptor, STAND);
      acts.set(id, activity);
    }
    for (let i = 0; i < 4000 && views.modelCounts.loading > 0; i++) await new Promise((ok) => setTimeout(ok, 0));
    for (let i = 0; i < 90; i++) {
      views.update(1 / 30);
      if (i < 45) continue;
      for (const [id] of who) {
        const prefix = `e${id}-m-`;
        for (const side of free) {
          const hand = scene.getTransformNodeByName(`${prefix}J_Bip_${side}_Hand`)!;
          const shoulder = scene.getTransformNodeByName(`${prefix}J_Bip_${side}_UpperArm`)!;
          const h = hand.computeWorldMatrix(true).getTranslation().y;
          const s = shoulder.computeWorldMatrix(true).getTranslation().y;
          expect(h, `e${id} ${activity}: ${side} hand ${(h - s).toFixed(2)} m from the shoulder`).toBeLessThan(s);
        }
      }
    }
  });
});
